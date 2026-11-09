import { and, eq } from "drizzle-orm";
import { auditLogs, customers, transactions } from "@shared/schema";
import { db } from "./db";

export interface LedgerEntryInput {
  customerId: number;
  adminId: number;
  type: string;
  amount: unknown;
  description: string;
  date: Date;
  status?: string;
  reference?: string | null;
  beneficiary?: string | null;
  beneficiaryBank?: string | null;
  beneficiaryAccount?: string | null;
}

export function parseMoneyToCents(value: unknown): bigint | null {
  const raw = String(value ?? "").trim();
  if (!/^\d{1,15}(?:\.\d{1,2})?$/.test(raw)) return null;
  const [whole, fractional = ""] = raw.split(".");
  return BigInt(whole) * 100n + BigInt(fractional.padEnd(2, "0"));
}

export function formatCents(cents: bigint): string {
  const absolute = cents < 0n ? -cents : cents;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  return `${cents < 0n ? "-" : ""}${whole}.${fraction}`;
}

export function ledgerDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function isFutureLedgerDate(date: Date, now = new Date()): boolean {
  return ledgerDateKey(date) > ledgerDateKey(now);
}

function balanceEffect(type: string, amountCents: bigint): bigint {
  if (type === "credit" || type === "deposit") return amountCents;
  if (["debit", "withdrawal", "wire_transfer", "external_transfer", "internal_transfer", "bill_pay"].includes(type)) {
    return -amountCents;
  }
  return 0n;
}

export async function writeAuditLog(
  tx: any,
  input: {
    adminId?: number | null;
    actorType?: "admin" | "system";
    action: string;
    entityType: string;
    entityId?: number | null;
    details?: Record<string, unknown>;
  },
) {
  await tx.insert(auditLogs).values({
    adminId: input.adminId ?? null,
    actorType: input.actorType ?? "admin",
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    details: input.details ?? {},
  });
}

export async function createLedgerEntryInTransaction(tx: any, input: LedgerEntryInput) {
  const amountCents = parseMoneyToCents(input.amount);
  if (amountCents === null || amountCents <= 0n) {
    throw new Error("Enter a valid amount greater than zero");
  }
  if (!Number.isFinite(input.date.getTime())) {
    throw new Error("Enter a valid transaction date");
  }

  const [customer] = await tx
    .select()
    .from(customers)
    .where(eq(customers.id, input.customerId))
    .for("update");
  if (!customer) throw new Error("Customer not found");

  const currentCents = parseMoneyToCents(customer.balance);
  if (currentCents === null) throw new Error("Customer balance is invalid");

  const status = isFutureLedgerDate(input.date) ? "pending" : input.status || "completed";
  const effect = status === "completed" ? balanceEffect(input.type, amountCents) : 0n;
  const nextCents = currentCents + effect;
  if (nextCents < 0n) throw new Error("Insufficient available balance");

  const balanceAfter = formatCents(nextCents);
  if (effect !== 0n) {
    await tx.update(customers).set({ balance: balanceAfter }).where(eq(customers.id, customer.id));
  }

  const [created] = await tx.insert(transactions).values({
    customerId: input.customerId,
    type: input.type,
    amount: formatCents(amountCents),
    description: input.description,
    date: input.date,
    status,
    reference: input.reference || null,
    beneficiary: input.beneficiary || null,
    beneficiaryBank: input.beneficiaryBank || null,
    beneficiaryAccount: input.beneficiaryAccount || null,
    source: "internal",
    balanceAfter,
  }).returning();

  await writeAuditLog(tx, {
    adminId: input.adminId,
    action: status === "pending" ? "ledger_entry_scheduled" : "ledger_entry_created",
    entityType: "transaction",
    entityId: created.id,
    details: {
      customerId: input.customerId,
      type: input.type,
      amount: formatCents(amountCents),
      status,
      source: "internal",
      balanceAfter,
    },
  });

  return created;
}

export async function settleDueLedgerEntries(): Promise<number> {
  const today = ledgerDateKey(new Date());
  const pendingEntries = await db
    .select({ id: transactions.id, date: transactions.date })
    .from(transactions)
    .where(eq(transactions.status, "pending"));
  let settledCount = 0;

  for (const candidate of pendingEntries) {
    if (ledgerDateKey(candidate.date) > today) continue;

    const settled = await db.transaction(async (tx) => {
      const [entry] = await tx
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, candidate.id), eq(transactions.status, "pending")))
        .for("update");
      if (!entry || ledgerDateKey(entry.date) > ledgerDateKey(new Date())) return false;

      const [customer] = await tx
        .select()
        .from(customers)
        .where(eq(customers.id, entry.customerId))
        .for("update");
      if (!customer) return false;

      const currentCents = parseMoneyToCents(customer.balance);
      const amountCents = parseMoneyToCents(entry.amount);
      if (currentCents === null || amountCents === null || amountCents <= 0n) {
        await tx.update(transactions).set({ status: "failed" }).where(eq(transactions.id, entry.id));
        await writeAuditLog(tx, {
          actorType: "system",
          action: "scheduled_ledger_entry_failed",
          entityType: "transaction",
          entityId: entry.id,
          details: { reason: "invalid amount or account balance", customerId: entry.customerId },
        });
        return true;
      }

      const effect = balanceEffect(entry.type, amountCents);
      const nextCents = currentCents + effect;
      if (nextCents < 0n) {
        await tx.update(transactions).set({
          status: "failed",
          balanceAfter: formatCents(currentCents),
        }).where(eq(transactions.id, entry.id));
        await writeAuditLog(tx, {
          actorType: "system",
          action: "scheduled_ledger_entry_failed",
          entityType: "transaction",
          entityId: entry.id,
          details: { reason: "insufficient available balance", customerId: entry.customerId },
        });
        return true;
      }

      const balanceAfter = formatCents(nextCents);
      if (effect !== 0n) {
        await tx.update(customers).set({ balance: balanceAfter }).where(eq(customers.id, customer.id));
      }
      await tx.update(transactions).set({
        status: "completed",
        balanceAfter,
      }).where(eq(transactions.id, entry.id));
      await writeAuditLog(tx, {
        actorType: "system",
        action: "scheduled_ledger_entry_posted",
        entityType: "transaction",
        entityId: entry.id,
        details: {
          customerId: entry.customerId,
          type: entry.type,
          amount: entry.amount,
          source: entry.source,
          balanceAfter,
        },
      });
      return true;
    });

    if (settled) settledCount += 1;
  }

  return settledCount;
}
