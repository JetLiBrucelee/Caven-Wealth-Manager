import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, or } from "drizzle-orm";
import { db, pool } from "../server/db";
import { accessCodes, auditLogs, chatMessages, customers, transactions, transferConfirmationCodes, transfers } from "../shared/schema";
import { verifyDashboard } from "./verify-dashboard";
import { ADMIN_CREDIT_REFERENCE, INSTITUTION, LEGACY_OPENING_DESCRIPTION, OPENING_BALANCE_DESCRIPTION } from "../shared/institution";
import { createLedgerEntryInTransaction } from "../server/ledger";
import { verifyAdminCreditForms } from "./verify-admin-credit-forms";

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
  const adminLogin = await admin.request("/api/admin/login", "POST", { username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD });
  const a = await admin.request("/api/admin/create-full-user", "POST", {
    firstName: "Ledger", lastName: "Verification", username: `verify-a-${suffix}`, password, balance: "1000.00",
  }, 201);
  ids.push(a.customer.id);
  const b = await admin.request("/api/customers", "POST", {
    firstName: "Ledger", lastName: "Recipient", username: `verify-b-${suffix}`, password, balance: "0.00",
  }, 201);
  ids.push(b.customer.id);
  assert.match(a.customer.accountNumber, /^\d{12}$/);
  assert.match(b.customer.accountNumber, /^\d{12}$/);
  assert.notEqual(a.customer.accountNumber, b.customer.accountNumber);
  assert.notEqual(a.customer.accountNumber, INSTITUTION.accountReference);
  assert.notEqual(b.customer.accountNumber, INSTITUTION.accountReference);
  const originalAccountNumber = a.customer.accountNumber;
  const openingHistory = await admin.request(`/api/transactions/customer/${a.customer.id}`);
  const opening = openingHistory[0];
  assert.equal(opening.description, OPENING_BALANCE_DESCRIPTION);
  assert.equal(opening.reference, ADMIN_CREDIT_REFERENCE);
  assert.equal(opening.institutionAccountReference, INSTITUTION.accountReference);
  assert.equal(a.transactionsCreated, 1);
  assert.equal(a.transfersCreated, 0);
  assert.equal(b.transactionsCreated, 0);
  await user.request("/api/customer/login", "POST", { username: a.customer.username, password });
  await user.request("/api/customer/verify-code", "POST", { code: b.accessCode }, 401);
  const login = await user.request("/api/customer/verify-code", "POST", { code: a.accessCode });
  assert.equal(login.customer.balance, "1000.00");
  await verifyDashboard({ base, username: b.customer.username, password, code: b.accessCode, balance: "$0.00", credits: "$0.00", label: "zero", mobile: true });
  assert.equal((await admin.request(`/api/customers/${a.customer.id}/fund`, "POST", { amount: "50.10" })).balance, "1050.10");
  const fundingHistory = await admin.request(`/api/transactions/customer/${a.customer.id}`);
  const funding = fundingHistory.find((entry: any) => entry.id !== opening.id);
  assert.equal(funding.reference, ADMIN_CREDIT_REFERENCE);
  assert.notEqual(funding.id, opening.id);
  assert.equal(funding.institutionAccountReference, INSTITUTION.accountReference);
  await verifyDashboard({ base, username: a.customer.username, password, code: a.accessCode, balance: "$1,050.10", credits: "$1,050.10", label: "opening", historyEntries: [
    { id: opening.id, description: OPENING_BALANCE_DESCRIPTION, reference: ADMIN_CREDIT_REFERENCE, institutionReference: INSTITUTION.accountReference },
    { id: funding.id, description: funding.description, reference: ADMIN_CREDIT_REFERENCE, institutionReference: INSTITUTION.accountReference },
  ] });
  // Seed only this test account's historical fixture independently of today's admin-credit policy.
  const legacy = await db.transaction((tx) => createLedgerEntryInTransaction(tx, {
    adminId: adminLogin.id, customerId: b.customer.id,
    type: "credit", amount: "1.00", description: LEGACY_OPENING_DESCRIPTION,
    reference: `OPEN-legacy-${suffix}`, date: new Date(),
  }));
  await verifyDashboard({ base, username: b.customer.username, password, code: b.accessCode, balance: "$1.00", credits: "$1.00", label: "legacy-mobile", mobile: true, historyEntries: [
    { id: legacy.id, description: OPENING_BALANCE_DESCRIPTION, reference: legacy.reference, institutionReference: INSTITUTION.accountReference },
  ] });
  assert.equal((await admin.request(`/api/transactions/${legacy.id}`)).description, LEGACY_OPENING_DESCRIPTION);
  const current = await admin.request(`/api/customers/${a.customer.id}/history`, "POST", {
    type: "credit", amount: "0.10", description: "Verification current entry", date: new Date().toISOString(), status: "completed", reference: "CLIENT-OVERRIDE",
  }, 201);
  assert.equal(current.reference, ADMIN_CREDIT_REFERENCE);
  const scheduled = await admin.request(`/api/customers/${a.customer.id}/history`, "POST", {
    type: "credit", amount: "25.15", description: "Verification future entry",
    date: new Date(Date.now() + 2 * 86400000).toISOString(), status: "completed", reference: "FUTURE-OVERRIDE",
  }, 201);
  assert.equal(scheduled.status, "pending");
  assert.equal(scheduled.source, "internal");
  assert.equal(scheduled.reference, ADMIN_CREDIT_REFERENCE);
  assert.equal((await user.request("/api/customer/me")).balance, "1050.20");
  const makeConfirmedTransfer = async (amount: string, type = "external_transfer") => {
    const transfer = await user.request("/api/customer/transfers", "POST", {
      type, amount, internalToAccount: b.customer.accountNumber, description: "Verification transfer",
    }, 201);
    await admin.request(`/api/transfers/${transfer.id}/status`, "PATCH", { status: "approved" }, 400);
    await admin.request(`/api/transfers/${transfer.id}/status`, "PATCH", { status: "processing" }, 400);
    const code = await admin.request("/api/admin/transfer-codes/generate", "POST", { customerId: a.customer.id, transferId: transfer.id });
    await user.request(`/api/customer/transfers/${transfer.id}/confirm`, "POST", { code: code.code });
    return transfer;
  };
  const internal = await makeConfirmedTransfer("100.25", "internal_transfer");
  await admin.request(`/api/transfers/${internal.id}/status`, "PATCH", { status: "approved" });
  await admin.request(`/api/transfers/${internal.id}/status`, "PATCH", { status: "approved" });
  assert.equal((await user.request("/api/customer/me")).balance, "949.95");
  assert.equal((await admin.request(`/api/customers/${b.customer.id}`)).balance, "101.25");
  await admin.request(`/api/customers/${a.customer.id}/history`, "POST", {
    type: "debit", amount: "2000.00", description: "Verification insufficient funds", date: new Date().toISOString(),
  }, 400);
  await admin.request(`/api/transactions/${scheduled.id}`, "DELETE", undefined, 409);
  await db.update(transactions).set({ date: new Date(Date.now() - 86400000) }).where(eq(transactions.id, scheduled.id));
  assert.equal((await user.request("/api/customer/me")).balance, "975.10");
  assert.equal((await user.request("/api/customer/me")).balance, "975.10");
  const postedScheduled = await admin.request(`/api/transactions/${scheduled.id}`);
  assert.equal(postedScheduled.reference, ADMIN_CREDIT_REFERENCE);
  assert.equal(postedScheduled.status, "completed");
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
  const outgoing = history.find((entry: any) => entry.reference === `TRANSFER-${internal.id}`);
  assert.equal(outgoing.beneficiaryAccount, b.customer.accountNumber);
  assert.equal(outgoing.institutionAccountReference, null);
  const recipientHistory = await admin.request(`/api/transactions/customer/${b.customer.id}`);
  const incoming = recipientHistory.filter((entry: any) => entry.reference === `TRANSFER-${internal.id}-IN`);
  assert.equal(incoming.length, 1);
  assert.notEqual(incoming[0].reference, ADMIN_CREDIT_REFERENCE);
  assert.equal(incoming[0].amount, outgoing.amount);
  assert.equal(incoming[0].institutionAccountReference, null);
  assert.equal(recipientHistory.find((entry: any) => entry.id === legacy.id).reference, legacy.reference);
  const transferStates = await user.request("/api/customer/transfers");
  for (const transfer of [first, second]) {
    const ledgerEntries = history.filter((entry: any) => entry.reference === `TRANSFER-${transfer.id}`);
    const state = transferStates.find((entry: any) => entry.id === transfer.id);
    assert.equal(ledgerEntries.length, state.status === "approved" ? 1 : 0);
  }
  const directCreditIds = [opening.id, funding.id, current.id, scheduled.id];
  assert.equal(new Set(directCreditIds).size, directCreditIds.length);
  for (const id of directCreditIds) assert.equal(history.find((entry: any) => entry.id === id).reference, ADMIN_CREDIT_REFERENCE);

  const deposit = await admin.request("/api/transactions", "POST", {
    customerId: b.customer.id, type: "deposit", amount: "0.20",
    description: "Verification manual deposit", reference: "DEPOSIT-OVERRIDE", date: new Date().toISOString(),
  }, 201);
  assert.equal(deposit.reference, ADMIN_CREDIT_REFERENCE);
  assert.equal((await admin.request(`/api/customers/${b.customer.id}`)).balance, "101.45");
  assert.equal((await admin.request(`/api/customers/${b.customer.id}`, "PATCH", { balance: "102.50", reference: "ADJUST-OVERRIDE" })).balance, "102.50");
  const afterAdjustment = await admin.request(`/api/transactions/customer/${b.customer.id}`);
  const adjustment = afterAdjustment.find((entry: any) => !recipientHistory.some((old: any) => old.id === entry.id) && entry.id !== deposit.id);
  assert.equal(adjustment.type, "credit");
  assert.equal(adjustment.amount, "1.05");
  assert.equal(adjustment.reference, ADMIN_CREDIT_REFERENCE);
  assert.equal(adjustment.institutionAccountReference, INSTITUTION.accountReference);
  assert.equal((await admin.request(`/api/customers/${b.customer.id}`, "PATCH", { balance: "102.49" })).balance, "102.49");
  const afterDebit = await admin.request(`/api/transactions/customer/${b.customer.id}`);
  const debitAdjustment = afterDebit.find((entry: any) => entry.type === "debit");
  assert.match(debitAdjustment.reference, /^ADJUST-/);
  const manualDebit = await admin.request("/api/transactions", "POST", {
    customerId: b.customer.id, type: "debit", amount: "0.10",
    description: "Verification normal debit reference", reference: "NORMAL-DEBIT", date: new Date().toISOString(),
  }, 201);
  assert.equal(manualDebit.reference, "NORMAL-DEBIT");
  assert.equal((await admin.request(`/api/customers/${b.customer.id}`)).balance, "102.39");
  const transfersBeforeManualEntries = await admin.request("/api/transfers");
  const senderBeforeManualEntries = (await admin.request(`/api/customers/${a.customer.id}`)).balance;
  const uiCredit = await verifyAdminCreditForms({ base, cookie: admin.cookie, customerId: b.customer.id, accountNumber: b.customer.accountNumber });
  assert.equal(uiCredit.reference, ADMIN_CREDIT_REFERENCE);
  assert.equal((await admin.request(`/api/customers/${b.customer.id}`)).balance, "102.34");
  const entriesBeforeInvalidType = await admin.request(`/api/transactions/customer/${b.customer.id}`);
  const invalidType = await admin.request("/api/transactions", "POST", {
    customerId: b.customer.id, type: "transfer", amount: "0.01",
    description: "Must choose an explicit type", date: new Date().toISOString(),
  }, 400);
  assert.equal(invalidType.message, "Select a valid transaction type");
  assert.equal((await admin.request(`/api/transactions/customer/${b.customer.id}`)).length, entriesBeforeInvalidType.length);
  assert.equal((await admin.request(`/api/customers/${b.customer.id}`)).balance, "102.34");
  const manualOutgoingIds: number[] = [];
  for (const type of ["wire_transfer", "external_transfer", "internal_transfer", "bill_pay"]) {
    for (const reference of [`MANUAL-${type}-${suffix}`, ""]) {
      const entry = await admin.request("/api/transactions", "POST", {
        customerId: b.customer.id, type, amount: "0.01", reference,
        description: "Verification explicit outgoing entry", date: new Date().toISOString(),
        beneficiaryAccount: a.customer.accountNumber,
      }, 201);
      assert.equal(entry.type, type);
      assert.equal(entry.status, "completed");
      assert.equal(entry.institutionAccountReference, null);
      assert.notEqual(entry.reference, ADMIN_CREDIT_REFERENCE);
      if (reference) assert.equal(entry.reference, reference);
      else assert.match(entry.reference, /^INT-/);
      manualOutgoingIds.push(entry.id);
    }
  }
  assert.equal((await admin.request(`/api/customers/${b.customer.id}`)).balance, "102.26");
  assert.equal((await admin.request(`/api/customers/${a.customer.id}`)).balance, senderBeforeManualEntries);
  assert.deepEqual(await admin.request("/api/transfers"), transfersBeforeManualEntries);
  assert.equal((await admin.request(`/api/transactions/${legacy.id}`)).reference, legacy.reference);
  assert.equal((await admin.request(`/api/customers/${a.customer.id}`)).accountNumber, originalAccountNumber);
  await admin.request(`/api/customers/${a.customer.id}`, "DELETE", undefined, 409);
  await db.update(accessCodes).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(accessCodes.customerId, a.customer.id));
  await user.request("/api/customer/login", "POST", { username: a.customer.username, password });
  await user.request("/api/customer/verify-code", "POST", { code: a.accessCode }, 401);
  const audit = await admin.request("/api/admin/audit-logs");
  for (const id of [...directCreditIds, deposit.id, adjustment.id, uiCredit.id, ...manualOutgoingIds]) {
    assert.ok(audit.some((entry: any) => entry.entityType === "transaction" && entry.entityId === id && entry.actorType === "admin" && entry.adminId === adminLogin.id));
  }
  assert.ok(audit.some((entry: any) => entry.action === "scheduled_ledger_entry_posted" && entry.entityId === scheduled.id));
  assert.ok(audit.some((entry: any) => entry.entityType === "transaction" && entry.entityId === opening.id && entry.actorType === "admin" && entry.adminId));
  console.log("Ledger verification passed: explicit manual outgoing types and filters, rejected generic transfer, normal outgoing references and audits, no manual transfer requests or recipient credits, preserved customer confirmation/approval, fixed admin credit forms and references, historical entries, dashboards, exact balances, idempotent approvals, concurrent outflows, and scoped access codes.");
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
