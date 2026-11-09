import { test, after } from "node:test";
import assert from "node:assert/strict";
import { formatCents, isFutureLedgerDate, ledgerDateKey, parseMoneyToCents } from "./ledger";
import { pool } from "./db";
import { formatLedgerAmount, summarizeLedger } from "../client/src/lib/ledger-summary";
import { ADMIN_CREDIT_REFERENCE, INSTITUTION, LEGACY_OPENING_DESCRIPTION, OPENING_BALANCE_DESCRIPTION, presentHistoryEntry, isCreditTransaction } from "../shared/institution";
import { allocateCustomerAccount, generateCustomerAccountNumber } from "./customer-account";

after(() => pool.end());

test("admin credit types share a reference without changing outgoing transaction types", () => {
  assert.equal(ADMIN_CREDIT_REFERENCE, "CAVENWF88210B");
  for (const type of ["credit", "deposit"]) assert.equal(isCreditTransaction(type), true);
  for (const type of ["debit", "withdrawal", "wire_transfer", "external_transfer", "internal_transfer", "bill_pay"]) {
    assert.equal(isCreditTransaction(type), false);
  }
  assert.notEqual(ADMIN_CREDIT_REFERENCE, INSTITUTION.accountReference);
});

test("money is represented in exact cents", () => {
  assert.equal(parseMoneyToCents("0.10"), 10n);
  assert.equal(parseMoneyToCents("9230192.20"), 923019220n);
  assert.equal(formatCents(100010n - 25n), "999.85");
  assert.equal(formatCents(-1n), "-0.01");
  for (const invalid of ["1.001", "-1", "NaN", "Infinity", "10abc", "", "1000000000000000"]) {
    assert.equal(parseMoneyToCents(invalid), null);
  }
});

test("scheduled dates use the New York calendar day", () => {
  const now = new Date("2026-11-09T18:00:00Z");
  assert.equal(isFutureLedgerDate(new Date("2026-11-10T12:00:00Z"), now), true);
  assert.equal(isFutureLedgerDate(new Date("2026-11-09T23:59:00Z"), now), false);
  assert.equal(ledgerDateKey(new Date("2026-11-10T02:00:00Z")), "2026-11-09");
  assert.equal(ledgerDateKey(new Date("2026-07-01T03:00:00Z")), "2026-06-30");
});

test("dashboard summaries contain only recorded posted amounts", () => {
  assert.deepEqual(summarizeLedger([]), {
    postedCredits: "0.00", postedDebits: "0.00", pendingCount: 0, recordedCount: 0,
  });
  assert.deepEqual(summarizeLedger([
    { type: "credit", amount: "1000.05", status: "completed" },
    { type: "deposit", amount: "0.10", status: "completed" },
    { type: "internal_transfer", amount: "25.01", status: "completed" },
    { type: "credit", amount: "9000.00", status: "pending" },
    { type: "debit", amount: "100.00", status: "failed" },
  ]), { postedCredits: "1000.15", postedDebits: "25.01", pendingCount: 1, recordedCount: 5 });
  assert.equal(formatLedgerAmount("999999999999999.99"), "$999,999,999,999,999.99");
});

test("legacy labels are display-only and limited to recognized internal opening credits", () => {
  const entry = { description: LEGACY_OPENING_DESCRIPTION, reference: "OPEN-test", source: "internal", type: "credit" };
  assert.equal(presentHistoryEntry(entry).description, OPENING_BALANCE_DESCRIPTION);
  assert.equal(presentHistoryEntry(entry).institutionAccountReference, INSTITUTION.accountReference);
  assert.equal(entry.description, LEGACY_OPENING_DESCRIPTION);
  for (const changed of [{ reference: "TRANSFER-1" }, { type: "debit" }, { source: "external" }, { description: "Customer-written description" }]) {
    const unrelated = { ...entry, ...changed };
    assert.equal(presentHistoryEntry(unrelated).description, unrelated.description);
    assert.equal(presentHistoryEntry(unrelated).institutionAccountReference, null);
  }
  assert.equal(presentHistoryEntry({ ...entry, description: "Custom funding", reference: "CREDIT-test", institutionAccountReference: INSTITUTION.accountReference }).institutionAccountReference, INSTITUTION.accountReference);
});

test("account allocation skips reserved numbers and safely retries a database collision", async () => {
  const attempted: string[] = [];
  const tx: any = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    insert: () => ({ values: (data: any) => {
      attempted.push(data.accountNumber);
      return { onConflictDoNothing: ({ target }: any) => {
        assert.ok(target);
        return { returning: async () => attempted.length === 1 ? [] : [{ id: 1, ...data }] };
      } };
    } }),
  };
  const candidates = [INSTITUTION.accountReference, "123456789012", "123456789013"];
  const account = await allocateCustomerAccount(tx, {} as any, () => candidates.shift()!);
  assert.equal(account.accountNumber, "123456789013");
  assert.deepEqual(attempted, ["123456789012", "123456789013"]);
  await assert.rejects(allocateCustomerAccount(tx, {} as any, () => INSTITUTION.accountReference), /unique account number/);
  tx.select = () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: 99 }] }) }) });
  await assert.rejects(allocateCustomerAccount(tx, {} as any), /existing customer/);
});

test("new account candidates are numeric and username errors are not retried", async () => {
  for (let i = 0; i < 100; i++) assert.match(generateCustomerAccountNumber(), /^\d{12}$/);
  let attempts = 0;
  const tx: any = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    insert: () => { attempts++; throw new Error("Duplicate username"); },
  };
  await assert.rejects(allocateCustomerAccount(tx, {} as any, () => "123456789012"), /Duplicate username/);
  assert.equal(attempts, 1);
});
