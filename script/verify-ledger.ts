import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, or } from "drizzle-orm";
import { db, pool } from "../server/db";
import { accessCodes, auditLogs, chatMessages, customers, transactions, transferConfirmationCodes, transfers } from "../shared/schema";
import { verifyDashboard } from "./verify-dashboard";

const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
assert.ok(process.env.REPLIT_DEV_DOMAIN, "The development preview domain is required");
assert.ok(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD, "Admin secrets are required");
const ids: number[] = [];
const suffix = randomUUID();
const password = `Test-only-${randomUUID()}`;
class Client {
  cookie = "";
  async request(path: string, method = "GET", body?: unknown, expected = 200): Promise<any> {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const cookie = response.headers.get("set-cookie");
    if (cookie) this.cookie = cookie.split(";")[0];
    const data = await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
    return data;
  }
}
const admin = new Client();
const user = new Client();
try {
  await new Client().request("/api/customers", "GET", undefined, 401);
  await admin.request("/api/admin/login", "POST", { username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD });
  const a = await admin.request("/api/admin/create-full-user", "POST", {
    firstName: "Ledger", lastName: "Verification", username: `verify-a-${suffix}`, password, balance: "1000.00",
  }, 201);
  ids.push(a.customer.id);
  const b = await admin.request("/api/customers", "POST", {
    firstName: "Ledger", lastName: "Recipient", username: `verify-b-${suffix}`, password, balance: "0.00",
  }, 201);
  ids.push(b.customer.id);
  assert.equal(a.transactionsCreated, 1);
  assert.equal(a.transfersCreated, 0);
  assert.equal(b.transactionsCreated, 0);
  await user.request("/api/customer/login", "POST", { username: a.customer.username, password });
  await user.request("/api/customer/verify-code", "POST", { code: b.accessCode }, 401);
  const login = await user.request("/api/customer/verify-code", "POST", { code: a.accessCode });
  assert.equal(login.customer.balance, "1000.00");
  await verifyDashboard({ base, username: b.customer.username, password, code: b.accessCode, balance: "$0.00", credits: "$0.00", label: "zero", mobile: true });
  await verifyDashboard({ base, username: a.customer.username, password, code: a.accessCode, balance: "$1,000.00", credits: "$1,000.00", label: "opening" });
  assert.equal((await admin.request(`/api/customers/${a.customer.id}/fund`, "POST", { amount: "50.10" })).balance, "1050.10");
  await admin.request(`/api/customers/${a.customer.id}/history`, "POST", {
    type: "credit", amount: "0.10", description: "Verification current entry", date: new Date().toISOString(), status: "completed",
  }, 201);
  const scheduled = await admin.request(`/api/customers/${a.customer.id}/history`, "POST", {
    type: "credit", amount: "25.15", description: "Verification future entry",
    date: new Date(Date.now() + 2 * 86400000).toISOString(), status: "completed",
  }, 201);
  assert.equal(scheduled.status, "pending");
  assert.equal(scheduled.source, "internal");
  assert.equal((await user.request("/api/customer/me")).balance, "1050.20");
  const makeConfirmedTransfer = async (amount: string, type = "external_transfer") => {
    const transfer = await user.request("/api/customer/transfers", "POST", {
      type, amount, internalToAccount: b.customer.accountNumber, description: "Verification transfer",
    }, 201);
    const code = await admin.request("/api/admin/transfer-codes/generate", "POST", { customerId: a.customer.id, transferId: transfer.id });
    await user.request(`/api/customer/transfers/${transfer.id}/confirm`, "POST", { code: code.code });
    return transfer;
  };
  const internal = await makeConfirmedTransfer("100.25", "internal_transfer");
  await admin.request(`/api/transfers/${internal.id}/status`, "PATCH", { status: "approved" });
  await admin.request(`/api/transfers/${internal.id}/status`, "PATCH", { status: "approved" });
  assert.equal((await user.request("/api/customer/me")).balance, "949.95");
  assert.equal((await admin.request(`/api/customers/${b.customer.id}`)).balance, "100.25");
  await admin.request(`/api/customers/${a.customer.id}/history`, "POST", {
    type: "debit", amount: "2000.00", description: "Verification insufficient funds", date: new Date().toISOString(),
  }, 400);
  await admin.request(`/api/transactions/${scheduled.id}`, "DELETE", undefined, 409);
  await db.update(transactions).set({ date: new Date(Date.now() - 86400000) }).where(eq(transactions.id, scheduled.id));
  assert.equal((await user.request("/api/customer/me")).balance, "975.10");
  assert.equal((await user.request("/api/customer/me")).balance, "975.10");
  const first = await makeConfirmedTransfer("600.00");
  const second = await makeConfirmedTransfer("600.00");
  const approve = async (id: number) => {
    const response = await fetch(`${base}/api/transfers/${id}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Cookie: admin.cookie }, body: JSON.stringify({ status: "approved" }),
    });
    return response.status;
  };
  assert.deepEqual((await Promise.all([approve(first.id), approve(second.id)])).sort(), [200, 400]);
  assert.equal((await user.request("/api/customer/me")).balance, "375.10");
  const history = await user.request("/api/customer/transactions");
  assert.ok(history.every((entry: any) => entry.source === "internal"));
  assert.equal(history.filter((entry: any) => entry.reference === `TRANSFER-${internal.id}`).length, 1);
  await admin.request(`/api/customers/${a.customer.id}`, "DELETE", undefined, 409);
  await db.update(accessCodes).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(accessCodes.customerId, a.customer.id));
  await user.request("/api/customer/login", "POST", { username: a.customer.username, password });
  await user.request("/api/customer/verify-code", "POST", { code: a.accessCode }, 401);
  const audit = await admin.request("/api/admin/audit-logs");
  assert.ok(audit.some((entry: any) => entry.action === "scheduled_ledger_entry_posted" && entry.entityId === scheduled.id));
  console.log("Ledger verification passed: authenticated zero/opening-balance dashboards, account setup, scoped codes, exact credits, scheduled posting, internal recipients, idempotent approvals, concurrent outflows, immutable history, and audit records.");
} finally {
  await user.request("/api/customer/logout", "POST", {}).catch(() => {});
  await admin.request("/api/admin/logout", "POST", {}).catch(() => {});
  if (ids.length) await db.transaction(async (tx) => {
    const entryIds = (await tx.select({ id: transactions.id }).from(transactions).where(inArray(transactions.customerId, ids))).map((entry) => entry.id);
    const transferIds = (await tx.select({ id: transfers.id }).from(transfers).where(inArray(transfers.customerId, ids))).map((entry) => entry.id);
    await tx.delete(auditLogs).where(or(
      and(eq(auditLogs.entityType, "customer"), inArray(auditLogs.entityId, ids)),
      entryIds.length ? and(eq(auditLogs.entityType, "transaction"), inArray(auditLogs.entityId, entryIds)) : undefined,
      transferIds.length ? and(eq(auditLogs.entityType, "transfer"), inArray(auditLogs.entityId, transferIds)) : undefined,
    ));
    await tx.delete(transferConfirmationCodes).where(inArray(transferConfirmationCodes.customerId, ids));
    await tx.delete(accessCodes).where(inArray(accessCodes.customerId, ids));
    await tx.delete(chatMessages).where(inArray(chatMessages.customerId, ids));
    await tx.delete(transfers).where(inArray(transfers.customerId, ids));
    await tx.delete(transactions).where(inArray(transactions.customerId, ids));
    await tx.delete(customers).where(inArray(customers.id, ids));
  });
  await pool.end();
}
