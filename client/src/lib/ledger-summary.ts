type LedgerRecord = { type: string; amount: string; status: string };

const debitTypes = new Set(["debit", "withdrawal", "wire_transfer", "external_transfer", "internal_transfer", "bill_pay"]);

function toCents(amount: string): bigint {
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(amount)) throw new Error("Invalid ledger amount");
  const negative = amount.startsWith("-");
  const [whole, fraction = ""] = (negative ? amount.slice(1) : amount).split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return negative ? -cents : cents;
}

function decimalAmount(cents: bigint): string {
  const absolute = cents < 0n ? -cents : cents;
  return `${cents < 0n ? "-" : ""}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, "0")}`;
}

export function formatLedgerAmount(amount: string): string {
  const normalized = decimalAmount(toCents(amount));
  const negative = normalized.startsWith("-");
  const [whole, fraction] = (negative ? normalized.slice(1) : normalized).split(".");
  return `${negative ? "-" : ""}$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}

export function summarizeLedger(entries: LedgerRecord[]) {
  let credits = 0n;
  let debits = 0n;
  for (const entry of entries) {
    if (entry.status !== "completed") continue;
    if (entry.type === "credit" || entry.type === "deposit") credits += toCents(entry.amount);
    else if (debitTypes.has(entry.type)) debits += toCents(entry.amount);
  }
  return {
    postedCredits: decimalAmount(credits),
    postedDebits: decimalAmount(debits),
    pendingCount: entries.filter((entry) => entry.status === "pending").length,
    recordedCount: entries.length,
  };
}
