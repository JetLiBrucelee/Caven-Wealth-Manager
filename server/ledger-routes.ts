import type { Express, RequestHandler } from "express";
import { randomInt, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { desc, eq, inArray } from "drizzle-orm";
import {
  accessCodes, auditLogs, chatMessages, customers, insertCustomerSchema, transactions, transfers, transferConfirmationCodes,
} from "@shared/schema";
import { db } from "./db";
import { storage } from "./storage";
import { ADMIN_CREDIT_REFERENCE, INSTITUTION, OPENING_BALANCE_DESCRIPTION, isCreditTransaction } from "@shared/institution";
import { allocateCustomerAccount } from "./customer-account";
import {
  createLedgerEntryInTransaction, formatCents, parseMoneyToCents, writeAuditLog,
} from "./ledger";

const ledgerTypes = ["credit", "deposit", "debit", "withdrawal", "wire_transfer", "external_transfer", "internal_transfer", "bill_pay"];
const publicCustomer = (customer: any) => {
  const { password, ...safe } = customer;
  return safe;
};

export function registerLedgerRoutes(app: Express, requireAdmin: RequestHandler) {
  const createAccount: RequestHandler = async (req, res) => {
    try {
      const openingCents = parseMoneyToCents(req.body.balance ?? "0.00");
      if (openingCents === null) throw new Error("Enter a valid opening balance");
      if (typeof req.body.password !== "string" || req.body.password.length < 8) {
        throw new Error("The customer password must contain at least 8 characters");
      }
      if (![req.body.firstName, req.body.lastName, req.body.username].every((value) => typeof value === "string" && value.trim())) {
        throw new Error("First name, last name, and username are required");
      }
      const data = insertCustomerSchema.omit({ accountNumber: true }).parse({
        ...req.body,
        password: await bcrypt.hash(req.body.password, 10),
        routingNumber: "INTERNAL",
        balance: "0.00",
        accountType: req.body.accountType || "business",
        memberSince: req.body.memberSince ? new Date(req.body.memberSince) : new Date(),
      });
      const result = await db.transaction(async (tx) => {
        const customer = await allocateCustomerAccount(tx, data);
        if (openingCents > 0n) {
          await createLedgerEntryInTransaction(tx, {
            adminId: (req.session as any).adminId,
            customerId: customer.id,
            type: "credit",
            amount: formatCents(openingCents),
            description: OPENING_BALANCE_DESCRIPTION,
            institutionAccountReference: INSTITUTION.accountReference,
            date: new Date(),
            reference: ADMIN_CREDIT_REFERENCE,
          });
        }
        const code = String(randomInt(100000, 1000000));
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await tx.insert(accessCodes).values({ code, customerId: customer.id, status: "active", expiresAt });
        await writeAuditLog(tx, {
          adminId: (req.session as any).adminId,
          action: "customer_account_created",
          entityType: "customer",
          entityId: customer.id,
          details: { openingBalance: formatCents(openingCents), source: "internal" },
        });
        const [updated] = await tx.select().from(customers).where(eq(customers.id, customer.id));
        return {
          customer: publicCustomer(updated),
          transactionsCreated: openingCents > 0n ? 1 : 0,
          transfersCreated: 0,
          accessCode: code,
          accessCodeExpiresAt: expiresAt,
        };
      });
      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(400).json({ message: error.code === "23505" ? "That username or account already exists" : error.message });
    }
  };

  app.post("/api/customers", requireAdmin, createAccount);
  app.post("/api/admin/create-full-user", requireAdmin, createAccount);

  app.patch("/api/customers/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const body = { ...req.body };
      const requestedBalance = body.balance === undefined ? null : parseMoneyToCents(body.balance);
      if (body.balance !== undefined && requestedBalance === null) throw new Error("Enter a valid balance");
      delete body.balance;
      delete body.accountNumber;
      delete body.routingNumber;
      if (!body.password) delete body.password;
      else {
        if (body.password.length < 8) throw new Error("The password must contain at least 8 characters");
        body.password = await bcrypt.hash(body.password, 10);
      }
      if (body.memberSince) body.memberSince = new Date(body.memberSince);
      const changes = insertCustomerSchema.partial().parse(body);
      const result = await db.transaction(async (tx) => {
        const [customer] = await tx.select().from(customers).where(eq(customers.id, id)).for("update");
        if (!customer) throw new Error("Customer not found");
        if (Object.keys(changes).length) await tx.update(customers).set(changes).where(eq(customers.id, id));
        if (requestedBalance !== null) {
          const current = parseMoneyToCents(customer.balance);
          if (current === null) throw new Error("Existing account balance is invalid");
          const difference = requestedBalance - current;
          if (difference !== 0n) {
            await createLedgerEntryInTransaction(tx, {
              adminId: (req.session as any).adminId, customerId: id,
              type: difference > 0n ? "credit" : "debit",
              amount: formatCents(difference > 0n ? difference : -difference),
              description: "Internal balance adjustment recorded by administrator",
              institutionAccountReference: INSTITUTION.accountReference,
              date: new Date(), reference: difference > 0n ? ADMIN_CREDIT_REFERENCE : `ADJUST-${randomUUID()}`,
            });
          }
        }
        await writeAuditLog(tx, {
          adminId: (req.session as any).adminId, action: "customer_account_updated",
          entityType: "customer", entityId: id, details: { fields: Object.keys(changes).filter((key) => key !== "password"), passwordChanged: Boolean(changes.password) },
        });
        const [updated] = await tx.select().from(customers).where(eq(customers.id, id));
        return publicCustomer(updated);
      });
      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/customers/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const result = await db.transaction(async (tx) => {
        const [customer] = await tx.select().from(customers).where(eq(customers.id, id)).for("update");
        if (!customer) return false;
        const history = await tx.select({ id: transactions.id }).from(transactions).where(eq(transactions.customerId, id)).limit(1);
        const transferHistory = await tx.select({ id: transfers.id }).from(transfers).where(eq(transfers.customerId, id)).limit(1);
        if (history.length || transferHistory.length) throw new Error("An account with ledger history cannot be deleted. Block the account instead.");
        await tx.delete(transferConfirmationCodes).where(eq(transferConfirmationCodes.customerId, id));
        await tx.delete(accessCodes).where(eq(accessCodes.customerId, id));
        await tx.delete(chatMessages).where(eq(chatMessages.customerId, id));
        await tx.delete(customers).where(eq(customers.id, id));
        await writeAuditLog(tx, { adminId: (req.session as any).adminId, action: "empty_customer_account_deleted", entityType: "customer", entityId: id });
        return true;
      });
      return result ? res.json({ message: "Empty customer account deleted" }) : res.status(404).json({ message: "Customer not found" });
    } catch (error: any) {
      return res.status(409).json({ message: error.message });
    }
  });

  const createEntry: RequestHandler = async (req, res) => {
    try {
      const customerId = req.params.id ? Number(req.params.id) : Number(req.body.customerId);
      if (!ledgerTypes.includes(req.body.type)) throw new Error("Select a valid transaction type");
      if (!["completed", "pending", "failed"].includes(req.body.status || "completed")) throw new Error("Select a valid status");
      if (!req.body.description?.trim()) throw new Error("A description is required");
      const entry = await db.transaction((tx) => createLedgerEntryInTransaction(tx, {
        adminId: (req.session as any).adminId, customerId, type: req.body.type,
        amount: req.body.amount, description: req.body.description.trim(),
        date: new Date(req.body.date), status: req.body.status || "completed",
        reference: isCreditTransaction(req.body.type) ? ADMIN_CREDIT_REFERENCE : req.body.reference || `INT-${randomUUID()}`,
        beneficiary: req.body.beneficiary, beneficiaryBank: req.body.beneficiaryBank,
        beneficiaryAccount: req.body.beneficiaryAccount,
      }));
      return res.status(201).json(entry);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };
  app.post("/api/transactions", requireAdmin, createEntry);
  app.post("/api/customers/:id/history", requireAdmin, createEntry);
  app.patch("/api/transactions/:id", requireAdmin, (_req, res) => res.status(409).json({ message: "Ledger records are immutable. Record an offsetting entry with a reference to the original instead." }));
  app.delete("/api/transactions/:id", requireAdmin, (_req, res) => res.status(409).json({ message: "Ledger records cannot be deleted. Record an offsetting entry instead." }));

  app.post("/api/customers/:id/fund", requireAdmin, async (req, res) => {
    try {
      await db.transaction((tx) => createLedgerEntryInTransaction(tx, {
        adminId: (req.session as any).adminId, customerId: Number(req.params.id),
        type: "credit", amount: req.body.amount,
        description: req.body.description || `Internal credit recorded by ${INSTITUTION.name}`,
        institutionAccountReference: INSTITUTION.accountReference,
        date: new Date(), reference: ADMIN_CREDIT_REFERENCE,
      }));
      const customer = await storage.getCustomer(Number(req.params.id));
      return res.json(publicCustomer(customer));
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/transfers/:id/status", requireAdmin, async (req, res) => {
    try {
      const { status, declineReason } = req.body;
      if (!["approved", "declined", "processing"].includes(status)) throw new Error("Select a valid transfer status");
      const result = await db.transaction(async (tx) => {
        const [transfer] = await tx.select().from(transfers).where(eq(transfers.id, Number(req.params.id))).for("update");
        if (!transfer) throw new Error("Transfer not found");
        if (transfer.status === status) return transfer;
        if (["approved", "declined"].includes(transfer.status)) throw new Error("This transfer has already been finalized");
        if (status === "processing" && transfer.status === "pending_confirmation") throw new Error("The customer must confirm the transfer first");
        if (status === "approved") {
          if (transfer.status !== "processing") throw new Error("The customer must confirm the transfer before approval");
          let recipientId: number | null = null;
          if (transfer.type === "internal_transfer") {
            const [recipient] = await tx.select().from(customers).where(eq(customers.accountNumber, transfer.internalToAccount || ""));
            if (!recipient || recipient.status !== "active") throw new Error("The internal recipient account is unavailable");
            if (recipient.id === transfer.customerId) throw new Error("Choose a different recipient account");
            recipientId = recipient.id;
          }
          const accountIds = recipientId ? [transfer.customerId, recipientId] : [transfer.customerId];
          const lockedAccounts = await tx.select().from(customers).where(inArray(customers.id, accountIds)).orderBy(customers.id).for("update");
          if (!lockedAccounts.find((account) => account.id === transfer.customerId && account.status === "active")) throw new Error("The sending account is unavailable");
          await createLedgerEntryInTransaction(tx, {
            adminId: (req.session as any).adminId, customerId: transfer.customerId,
            type: transfer.type, amount: transfer.amount,
            description: transfer.description || `Internal ${transfer.type.replace(/_/g, " ")} request`,
            date: new Date(), reference: `TRANSFER-${transfer.id}`,
            beneficiary: transfer.recipientName || transfer.billPayee,
            beneficiaryBank: transfer.recipientBank,
            beneficiaryAccount: transfer.recipientAccount || transfer.internalToAccount,
          });
          if (recipientId) {
            await createLedgerEntryInTransaction(tx, {
              adminId: (req.session as any).adminId, customerId: recipientId,
              type: "credit", amount: transfer.amount,
              description: `Internal transfer received from account ${transfer.customerId}`,
              date: new Date(), reference: `TRANSFER-${transfer.id}-IN`,
            });
          }
        }
        if (status === "declined" && !declineReason?.trim()) throw new Error("A decline reason is required");
        const [updated] = await tx.update(transfers).set({
          status, declineReason: status === "declined" ? declineReason.trim() : null,
          source: "internal", updatedAt: new Date(),
        }).where(eq(transfers.id, transfer.id)).returning();
        await writeAuditLog(tx, {
          adminId: (req.session as any).adminId, action: `transfer_${status}`,
          entityType: "transfer", entityId: transfer.id,
          details: { customerId: transfer.customerId, amount: transfer.amount, source: "internal" },
        });
        return updated;
      });
      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/balance", requireAdmin, async (_req, res) => {
    const accounts = await db.select({ balance: customers.balance }).from(customers);
    const total = accounts.reduce((sum, account) => sum + (parseMoneyToCents(account.balance) ?? 0n), 0n);
    return res.json({ balance: formatCents(total), source: "internal" });
  });
  app.post("/api/admin/topup", requireAdmin, (_req, res) => res.status(409).json({ message: "Record an audited internal credit against a customer account instead." }));
  app.get("/api/admin/audit-logs", requireAdmin, async (_req, res) => {
    return res.json(await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(200));
  });
}
