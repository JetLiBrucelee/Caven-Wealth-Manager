import bcrypt from "bcryptjs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { admins, auditLogs, type Admin } from "@shared/schema";
import { db } from "./db";

export const RECOVERY_QUESTION = "What is your favorite hobby?";
export const RECOVERY_ERROR = "Unable to reset password. Check your recovery details or try again later.";
export class AdminAuthError extends Error {
  constructor(message: string, public status = 401) { super(message); }
}
export function validAdminPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 12 && Buffer.byteLength(value, "utf8") <= 72 && !/^\s+$/.test(value);
}
function normalizedAnswer(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 200) return null;
  const answer = value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
  return answer && Buffer.byteLength(answer, "utf8") <= 72 ? answer : null;
}
function newRecoveryCode() {
  return randomBytes(32).toString("hex").toUpperCase().match(/.{8}/g)!.join("-");
}
function codeHash(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 100) return null;
  const compact = value.replace(/[-\s]/g, "").toUpperCase();
  return /^[A-F0-9]{64}$/.test(compact) ? createHash("sha256").update(compact).digest("hex") : null;
}
function matchesHash(actual: string | null, expected: string | null) {
  const left = Buffer.from(actual || "0".repeat(64), "hex");
  const right = Buffer.from(expected || "f".repeat(64), "hex");
  return left.length === right.length && timingSafeEqual(left, right) && !!actual && !!expected;
}
export function createAdminAccess(options: {
  database?: typeof db; username?: () => string | undefined; now?: () => Date; hashCost?: number;
} = {}) {
  const database = options.database || db;
  const username = options.username || (() => process.env.ADMIN_USERNAME);
  const now = options.now || (() => new Date());
  const cost = options.hashCost ?? 12;
  const dummyHash = bcrypt.hash(randomBytes(32).toString("hex"), cost);
  const configuredName = () => {
    const value = username();
    if (typeof value !== "string" || !value.trim() || value.length > 120) throw new Error("Configure ADMIN_USERNAME securely");
    return value;
  };
  const getCurrent = async () => {
    const [admin] = await database.select().from(admins).where(eq(admins.username, configuredName()));
    return admin;
  };
  const audit = (tx: any, admin: Admin, action: string, details: Record<string, unknown> = {}) =>
    tx.insert(auditLogs).values({ adminId: admin.id, actorType: "admin", action, entityType: "admin", entityId: admin.id, details });

  return {
    // Environment credentials are an explicit one-time bootstrap, never a continuous password override.
    async initialize(secrets: { password?: string; answer?: string }) {
      const existing = await getCurrent();
      if (existing?.securityInitializedAt) return;
      if (!validAdminPassword(secrets.password)) throw new Error("Configure ADMIN_PASSWORD with at least 12 characters and at most 72 UTF-8 bytes");
      const answer = normalizedAnswer(secrets.answer);
      if (!answer) throw new Error("Configure a non-empty ADMIN_RECOVERY_ANSWER of at most 72 UTF-8 bytes");
      const passwordHash = await bcrypt.hash(secrets.password, cost);
      const recoveryAnswerHash = await bcrypt.hash(answer, cost);
      await database.transaction(async (tx) => {
        await tx.insert(admins).values({ username: configuredName(), password: passwordHash }).onConflictDoNothing();
        const [admin] = await tx.select().from(admins).where(eq(admins.username, configuredName())).for("update");
        if (admin.securityInitializedAt) return;
        await tx.update(admins).set({
          password: passwordHash, recoveryAnswerHash, recoveryCodeHash: null,
          authVersion: admin.authVersion + 1, securityInitializedAt: now(),
          recoveryFailures: 0, recoveryLockedUntil: null,
        }).where(eq(admins.id, admin.id));
        await audit(tx, admin, "admin_security_initialized", { sessionsRevoked: true });
      });
    },
    async login(inputUsername: unknown, password: unknown) {
      const admin = await getCurrent();
      const validInput = typeof password === "string" && password.length > 0 && Buffer.byteLength(password) <= 72;
      const valid = await bcrypt.compare(validInput ? password : "", admin?.password || await dummyHash);
      return valid && validInput && inputUsername === configuredName() && admin?.securityInitializedAt ? admin : null;
    },
    async sessionValid(session: { isAdmin?: boolean; adminId?: number; adminAuthVersion?: number }) {
      if (!session?.isAdmin || !session.adminId || !Number.isInteger(session.adminAuthVersion)) return false;
      const admin = await getCurrent();
      return !!admin?.securityInitializedAt && admin.id === session.adminId && admin.authVersion === session.adminAuthVersion;
    },
    async securityStatus() {
      const admin = await getCurrent();
      return { question: RECOVERY_QUESTION, recoveryConfigured: !!admin?.recoveryAnswerHash, hasRecoveryCode: !!admin?.recoveryCodeHash };
    },
    async issueRecoveryCode(adminId: number, currentPassword: unknown, expectedVersion: number) {
      return database.transaction(async (tx) => {
        const [admin] = await tx.select().from(admins).where(eq(admins.username, configuredName())).for("update");
        const password = typeof currentPassword === "string" && Buffer.byteLength(currentPassword) <= 72 ? currentPassword : "";
        const valid = await bcrypt.compare(password, admin?.password || await dummyHash);
        if (!admin || !admin.securityInitializedAt || !admin.recoveryAnswerHash || admin.id !== adminId || admin.authVersion !== expectedVersion || !valid) {
          throw new AdminAuthError("Could not verify administrator credentials.");
        }
        const recoveryCode = newRecoveryCode();
        await tx.update(admins).set({ recoveryCodeHash: codeHash(recoveryCode) }).where(eq(admins.id, admin.id));
        await audit(tx, admin, "admin_recovery_code_replaced");
        return { recoveryCode };
      });
    },
    async reset(input: { username?: unknown; answer?: unknown; recoveryCode?: unknown; newPassword?: unknown; confirmPassword?: unknown }) {
      if (!validAdminPassword(input.newPassword) || input.newPassword !== input.confirmPassword) {
        throw new AdminAuthError("Use matching passwords with at least 12 characters and at most 72 UTF-8 bytes.", 400);
      }
      // Commit failed-attempt counters too: throwing inside this transaction would roll them back.
      const result = await database.transaction(async (tx) => {
        const [admin] = await tx.select().from(admins).where(eq(admins.username, configuredName())).for("update");
        const answer = normalizedAnswer(input.answer);
        const answerValid = await bcrypt.compare(answer || "", admin?.recoveryAnswerHash || await dummyHash);
        const codeValid = matchesHash(codeHash(input.recoveryCode), admin?.recoveryCodeHash || null);
        const locked = !!admin?.recoveryLockedUntil && admin.recoveryLockedUntil > now();
        if (!admin?.securityInitializedAt || !answerValid || !answer || !codeValid || input.username !== configuredName() || locked) {
          if (admin && !locked) {
            const failures = admin.recoveryLockedUntil && admin.recoveryLockedUntil <= now() ? 1 : admin.recoveryFailures + 1;
            await tx.update(admins).set({
              recoveryFailures: failures, recoveryLockedUntil: failures >= 5 ? new Date(now().getTime() + 15 * 60_000) : null,
            }).where(eq(admins.id, admin.id));
            await audit(tx, admin, "admin_recovery_failed");
          }
          return null;
        }
        if (await bcrypt.compare(input.newPassword as string, admin.password)) {
          return { unchanged: true as const };
        }
        const password = await bcrypt.hash(input.newPassword as string, cost);
        const recoveryCode = newRecoveryCode();
        await tx.update(admins).set({
          password, recoveryCodeHash: codeHash(recoveryCode), authVersion: admin.authVersion + 1,
          recoveryFailures: 0, recoveryLockedUntil: null,
        }).where(eq(admins.id, admin.id));
        await audit(tx, admin, "admin_password_reset", { sessionsRevoked: true, recoveryCodeReplaced: true });
        return { recoveryCode };
      });
      if (!result) throw new AdminAuthError(RECOVERY_ERROR);
      if ("unchanged" in result) throw new AdminAuthError("Choose a password different from the current password.", 400);
      return { message: "Password reset successfully. Save your replacement recovery code, then sign in with your new password.", recoveryCode: result.recoveryCode };
    },
  };
}
export type AdminAccess = ReturnType<typeof createAdminAccess>;
