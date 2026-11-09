import { test, after } from "node:test";
import assert from "node:assert/strict";
import { formatCents, isFutureLedgerDate, ledgerDateKey, parseMoneyToCents } from "./ledger";
import { pool } from "./db";
import { formatLedgerAmount, summarizeLedger } from "../client/src/lib/ledger-summary";

after(() => pool.end());

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
