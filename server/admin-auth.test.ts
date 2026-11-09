import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { admins, auditLogs } from "../shared/schema";
import { adminAuthFixture, fixtureClient } from "../script/admin-auth-fixture";
import { createAdminAccess, RECOVERY_ERROR, validAdminPassword } from "./admin-auth";

const newPassword = "Fixture-replacement-password-73!";

test("password policy rejects truncation and recovery uses one active identity", async () => {
  assert.ok(validAdminPassword(newPassword));
  assert.ok(!validAdminPassword("short"));
  assert.ok(!validAdminPassword("😀".repeat(30)));
  const f = await adminAuthFixture();
  try {
    await f.database.insert(admins).values({ username: "retired-admin", password: (await f.access.login(f.username, f.password))!.password });
    assert.ok(!await f.access.login("retired-admin", f.password));
    assert.ok(!await f.access.sessionValid({ isAdmin: true, adminId: 2, adminAuthVersion: 1 }));
    assert.ok(!await f.access.sessionValid({ isAdmin: true, adminId: 1 }));
    assert.ok(await f.access.login(f.username, f.password));
  } finally { await f.close(); }
});

test("verified reset replaces the password, revokes sessions, persists across startup and consumes the code", async () => {
  const f = await adminAuthFixture();
  try {
    const admin = (await f.access.login(f.username, f.password))!;
    const session = { isAdmin: true, adminId: admin.id, adminAuthVersion: admin.authVersion };
    const { recoveryCode } = await f.access.issueRecoveryCode(admin.id, f.password, admin.authVersion);
    const result = await f.access.reset({ username: f.username, answer: ` ${f.answer.toUpperCase()} `, recoveryCode, newPassword, confirmPassword: newPassword });
    assert.ok(result.recoveryCode && result.recoveryCode !== recoveryCode);
    assert.ok(!await f.access.login(f.username, f.password));
    assert.ok(await f.access.login(f.username, newPassword));
    assert.ok(!await f.access.sessionValid(session));
    const restarted = createAdminAccess({ database: f.database, username: () => f.username, hashCost: 4 });
    await restarted.initialize({ password: f.password, answer: "different-bootstrap-answer" });
    assert.ok(await restarted.login(f.username, newPassword));
    await assert.rejects(f.access.reset({ username: f.username, answer: f.answer, recoveryCode, newPassword: f.password, confirmPassword: f.password }), { message: RECOVERY_ERROR });
    const stored = (await f.database.select().from(admins).where(eq(admins.id, admin.id)))[0];
    assert.ok(stored.password !== newPassword && stored.recoveryAnswerHash !== f.answer && stored.recoveryCodeHash !== result.recoveryCode);
    const audits = JSON.stringify(await f.database.select().from(auditLogs));
    for (const secret of [f.password, newPassword, f.answer, recoveryCode, result.recoveryCode]) assert.ok(!audits.includes(secret));
  } finally { await f.close(); }
});

test("initial rotation updates an existing administrator once without replacing their identity or balance", async () => {
  const f = await adminAuthFixture();
  try {
    const old = (await f.access.login(f.username, f.password))!;
    const [existing] = await f.database.insert(admins).values({ username: "existing-fixture", password: old.password, balance: "12.34", authVersion: 4 }).returning();
    const access = createAdminAccess({ database: f.database, username: () => "existing-fixture", hashCost: 4 });
    await access.initialize({ password: newPassword, answer: f.answer });
    assert.ok(!await access.login("existing-fixture", f.password));
    const updated = await access.login("existing-fixture", newPassword);
    assert.equal(updated?.id, existing.id);
    assert.equal(updated?.balance, "12.34");
    assert.equal(updated?.authVersion, 5);
    await access.initialize({ password: f.password, answer: f.answer });
    assert.ok(await access.login("existing-fixture", newPassword));
  } finally { await f.close(); }
});

test("wrong factors share a generic failure, are durable, and lock excessive attempts", async () => {
  const f = await adminAuthFixture();
  try {
    const admin = (await f.access.login(f.username, f.password))!;
    const { recoveryCode } = await f.access.issueRecoveryCode(admin.id, f.password, admin.authVersion);
    const base = { username: f.username, answer: f.answer, recoveryCode, newPassword, confirmPassword: newPassword };
    for (const override of [{ answer: "incorrect" }, { recoveryCode: "incorrect" }, { username: "unknown" }, { answer: "incorrect" }, { recoveryCode: "incorrect" }]) {
      await assert.rejects(f.access.reset({ ...base, ...override }), { message: RECOVERY_ERROR });
    }
    assert.equal((await f.database.select().from(admins))[0].recoveryFailures, 5);
    await assert.rejects(f.access.reset(base), { message: RECOVERY_ERROR });
    f.advance(16 * 60_000);
    assert.ok((await f.access.reset(base)).recoveryCode);
  } finally { await f.close(); }
});

test("racing resets permit only one use and replacing a recovery code revokes its predecessor", async () => {
  const f = await adminAuthFixture();
  try {
    const admin = (await f.access.login(f.username, f.password))!;
    await assert.rejects(f.access.issueRecoveryCode(admin.id, "incorrect", admin.authVersion));
    const first = await f.access.issueRecoveryCode(admin.id, f.password, admin.authVersion);
    const second = await f.access.issueRecoveryCode(admin.id, f.password, admin.authVersion);
    const payload = { username: f.username, answer: f.answer, newPassword, confirmPassword: newPassword };
    await assert.rejects(f.access.reset({ ...payload, recoveryCode: first.recoveryCode }), { message: RECOVERY_ERROR });
    const results = await Promise.allSettled([
      f.access.reset({ ...payload, recoveryCode: second.recoveryCode }),
      f.access.reset({ ...payload, recoveryCode: second.recoveryCode }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  } finally { await f.close(); }
});

test("HTTP routes enforce admin sessions, reauthentication, same origin and throttling", async () => {
  const f = await adminAuthFixture();
  try {
    const client = fixtureClient(f.base);
    assert.equal((await client.request("/api/admin/security")).status, 401);
    assert.equal((await client.request("/api/admin/login", { username: f.username, password: f.password }, { Origin: "https://untrusted.invalid" })).status, 403);
    assert.equal((await client.request("/api/admin/login", { username: f.username, password: f.password })).status, 200);
    assert.equal((await client.request("/api/admin/security/recovery-code", { currentPassword: "incorrect" })).status, 401);
    const issued = await client.request("/api/admin/security/recovery-code", { currentPassword: f.password });
    assert.equal(issued.status, 200);
    const reset = await client.request("/api/admin/password-reset", { username: f.username, answer: f.answer, recoveryCode: issued.body.recoveryCode, newPassword, confirmPassword: newPassword });
    assert.equal(reset.status, 200);
    assert.equal((await client.request("/api/protected-fixture")).status, 401);
    assert.equal((await client.request("/api/admin/security")).status, 401);
    for (let i = 0; i < 4; i++) await client.request("/api/admin/password-reset", {});
    assert.equal((await client.request("/api/admin/password-reset", {})).status, 429);
    assert.equal((await client.request("/api/admin/login", { username: f.username, password: f.password })).status, 401);
    assert.equal((await client.request("/api/admin/login", { username: f.username, password: newPassword })).status, 200);
  } finally { await f.close(); }
});
