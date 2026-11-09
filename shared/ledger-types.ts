// Manual ledger entries use the same explicit types as recorded customer activity.
// These options do not create or approve customer transfer requests.
export const LEDGER_TYPE_OPTIONS = [
  { value: "credit", label: "Credit" },
  { value: "deposit", label: "Deposit" },
  { value: "debit", label: "Debit" },
  { value: "withdrawal", label: "Withdrawal" },
  { value: "wire_transfer", label: "Wire transfer" },
  { value: "external_transfer", label: "External transfer" },
  { value: "internal_transfer", label: "Internal transfer" },
  { value: "bill_pay", label: "Bill payment" },
] as const;

export const LEDGER_TYPES: readonly string[] = LEDGER_TYPE_OPTIONS.map(({ value }) => value);

export function ledgerTypeLabel(type: string) {
  return LEDGER_TYPE_OPTIONS.find(({ value }) => value === type)?.label ?? type;
}
