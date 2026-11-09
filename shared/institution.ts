export const INSTITUTION = {
  name: "Caven Wealth & Finance",
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
    description: legacyOpening ? OPENING_BALANCE_DESCRIPTION : entry.description,
    institutionAccountReference: entry.source === "internal"
      ? entry.institutionAccountReference || (legacyOpening ? INSTITUTION.accountReference : null)
      : null,
  };
}
