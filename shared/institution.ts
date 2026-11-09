export const INSTITUTION = {
  name: "Alderbridge Private Wealth",
  accountReference: "662201833012",
} as const;

export const ADMIN_CREDIT_REFERENCE = "CAVENWF88210B";

export function isCreditTransaction(type: string): boolean {
  return type === "credit" || type === "deposit";
}

export const OPENING_BALANCE_DESCRIPTION = `Internal opening balance recorded by ${INSTITUTION.name}`;
export const LEGACY_OPENING_DESCRIPTION = "Internal opening balance recorded by administrator";

type HistoryEntry = {
  description: string;
  reference: string | null;
  source: string;
  type: string;
  institutionAccountReference?: string | null;
};

export function presentHistoryEntry(entry: HistoryEntry) {
  const legacyOpening = entry.source === "internal" && entry.type === "credit"
    && Boolean(entry.reference?.startsWith("OPEN-"))
    && entry.description === LEGACY_OPENING_DESCRIPTION;
  return {
    description: legacyOpening ? OPENING_BALANCE_DESCRIPTION : presentBankDescription(entry),
    institutionAccountReference: entry.source === "internal"
      ? entry.institutionAccountReference || (legacyOpening ? INSTITUTION.accountReference : null)
      : null,
  };
}

function presentBankDescription(entry: HistoryEntry) {
  // Only recognized, application-generated internal labels get a display alias.
  // Never rewrite stored ledger text or arbitrary user-entered transaction descriptions.
  const knownPrefixes = ["Internal opening balance recorded by ", "Internal credit recorded by "];
  if (entry.source === "internal" && (entry.type === "credit" || entry.type === "deposit")) {
    for (const prefix of knownPrefixes) {
      if (["Caven Wealth", "Caven Wealth & Finance"].some((name) => entry.description === prefix + name)) {
        return prefix + INSTITUTION.name;
      }
    }
  }
  return entry.description;
}
