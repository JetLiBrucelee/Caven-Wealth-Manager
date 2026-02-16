import {
  type Admin, type InsertAdmin,
  type Customer, type InsertCustomer,
  type Transaction, type InsertTransaction,
  type Transfer, type InsertTransfer,
  type AccessCode, type InsertAccessCode,
  type ChatMessage, type InsertChatMessage,
  admins, customers, transactions, transfers, accessCodes, chatMessages
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, gt, lt, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  getAdmin(id: number): Promise<Admin | undefined>;
  getAdminByUsername(username: string): Promise<Admin | undefined>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;
  validateAdminPassword(username: string, password: string): Promise<Admin | null>;

  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  getCustomerByUsername(username: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<boolean>;
  validateCustomerPassword(username: string, password: string): Promise<Customer | null>;

  getTransactions(): Promise<Transaction[]>;
  getTransactionsByCustomer(customerId: number): Promise<Transaction[]>;
  getTransaction(id: number): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: number, transaction: Partial<InsertTransaction>): Promise<Transaction | undefined>;
  deleteTransaction(id: number): Promise<boolean>;

  getTransfers(): Promise<Transfer[]>;
  getTransfersByCustomer(customerId: number): Promise<Transfer[]>;
  getPendingTransfers(): Promise<Transfer[]>;
  getTransfer(id: number): Promise<Transfer | undefined>;
  createTransfer(transfer: InsertTransfer): Promise<Transfer>;
  updateTransferStatus(id: number, status: string): Promise<Transfer | undefined>;

  getAccessCodes(): Promise<AccessCode[]>;
  getActiveAccessCodes(): Promise<AccessCode[]>;
  getAccessCode(code: string): Promise<AccessCode | undefined>;
  createAccessCode(accessCode: InsertAccessCode): Promise<AccessCode>;
  expireAccessCode(id: number): Promise<void>;
  cleanupExpiredCodes(): Promise<void>;
  generateAccessCodes(count: number): Promise<AccessCode[]>;

  getChatMessagesByCustomer(customerId: number): Promise<ChatMessage[]>;
  getAllChatsWithLatestMessage(): Promise<any[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  markMessagesAsRead(customerId: number, senderType: string): Promise<void>;
  getUnreadMessageCount(customerId: number, senderType: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getAdmin(id: number): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.id, id));
    return admin;
  }

  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.username, username));
    return admin;
  }

  async createAdmin(admin: InsertAdmin): Promise<Admin> {
    const hashedPassword = await bcrypt.hash(admin.password, 10);
    const [created] = await db.insert(admins).values({
      ...admin,
      password: hashedPassword,
    }).returning();
    return created;
  }

  async validateAdminPassword(username: string, password: string): Promise<Admin | null> {
    const admin = await this.getAdminByUsername(username);
    if (!admin) return null;
    const valid = await bcrypt.compare(password, admin.password);
    return valid ? admin : null;
  }

  async getCustomers(): Promise<Customer[]> {
    return await db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async getCustomerByUsername(username: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.username, username));
    return customer;
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const hashedPassword = await bcrypt.hash(customer.password, 10);
    const [created] = await db.insert(customers).values({
      ...customer,
      password: hashedPassword,
    }).returning();
    return created;
  }

  async updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const updateData = { ...customer };
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    const [updated] = await db.update(customers).set(updateData).where(eq(customers.id, id)).returning();
    return updated;
  }

  async deleteCustomer(id: number): Promise<boolean> {
    await db.delete(transfers).where(eq(transfers.customerId, id));
    await db.delete(transactions).where(eq(transactions.customerId, id));
    const result = await db.delete(customers).where(eq(customers.id, id)).returning();
    return result.length > 0;
  }

  async validateCustomerPassword(username: string, password: string): Promise<Customer | null> {
    const customer = await this.getCustomerByUsername(username);
    if (!customer) return null;
    const valid = await bcrypt.compare(password, customer.password);
    return valid ? customer : null;
  }

  async getTransactions(): Promise<Transaction[]> {
    return await db.select().from(transactions).orderBy(desc(transactions.date));
  }

  async getTransactionsByCustomer(customerId: number): Promise<Transaction[]> {
    return await db.select().from(transactions).where(eq(transactions.customerId, customerId)).orderBy(desc(transactions.date));
  }

  async getTransaction(id: number): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
    return transaction;
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [created] = await db.insert(transactions).values(transaction).returning();
    return created;
  }

  async updateTransaction(id: number, transaction: Partial<InsertTransaction>): Promise<Transaction | undefined> {
    const [updated] = await db.update(transactions).set(transaction).where(eq(transactions.id, id)).returning();
    return updated;
  }

  async deleteTransaction(id: number): Promise<boolean> {
    const result = await db.delete(transactions).where(eq(transactions.id, id)).returning();
    return result.length > 0;
  }

  async getTransfers(): Promise<Transfer[]> {
    return await db.select().from(transfers).orderBy(desc(transfers.createdAt));
  }

  async getTransfersByCustomer(customerId: number): Promise<Transfer[]> {
    return await db.select().from(transfers).where(eq(transfers.customerId, customerId)).orderBy(desc(transfers.createdAt));
  }

  async getPendingTransfers(): Promise<Transfer[]> {
    return await db.select().from(transfers).where(eq(transfers.status, "pending")).orderBy(desc(transfers.createdAt));
  }

  async getTransfer(id: number): Promise<Transfer | undefined> {
    const [transfer] = await db.select().from(transfers).where(eq(transfers.id, id));
    return transfer;
  }

  async createTransfer(transfer: InsertTransfer): Promise<Transfer> {
    const [created] = await db.insert(transfers).values(transfer).returning();
    return created;
  }

  async updateTransferStatus(id: number, status: string): Promise<Transfer | undefined> {
    const [updated] = await db.update(transfers).set({ status, updatedAt: new Date() }).where(eq(transfers.id, id)).returning();
    return updated;
  }

  async getAccessCodes(): Promise<AccessCode[]> {
    return await db.select().from(accessCodes).orderBy(desc(accessCodes.createdAt));
  }

  async getActiveAccessCodes(): Promise<AccessCode[]> {
    const now = new Date();
    return await db.select().from(accessCodes)
      .where(and(eq(accessCodes.status, "active"), gt(accessCodes.expiresAt, now)))
      .orderBy(desc(accessCodes.createdAt));
  }

  async getAccessCode(code: string): Promise<AccessCode | undefined> {
    const now = new Date();
    const [accessCode] = await db.select().from(accessCodes)
      .where(and(eq(accessCodes.code, code), eq(accessCodes.status, "active"), gt(accessCodes.expiresAt, now)));
    return accessCode;
  }

  async createAccessCode(accessCode: InsertAccessCode): Promise<AccessCode> {
    const [created] = await db.insert(accessCodes).values(accessCode).returning();
    return created;
  }

  async expireAccessCode(id: number): Promise<void> {
    await db.update(accessCodes).set({ status: "expired" }).where(eq(accessCodes.id, id));
  }

  async cleanupExpiredCodes(): Promise<void> {
    const now = new Date();
    await db.update(accessCodes).set({ status: "expired" })
      .where(and(eq(accessCodes.status, "active"), lt(accessCodes.expiresAt, now)));
  }

  async generateAccessCodes(count: number): Promise<AccessCode[]> {
    await this.cleanupExpiredCodes();
    const codes: AccessCode[] = [];
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    for (let i = 0; i < count; i++) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      try {
        const created = await this.createAccessCode({
          code,
          customerId: null,
          status: "active",
          expiresAt,
        });
        codes.push(created);
      } catch (e) {
        // skip duplicate codes
      }
    }
    return codes;
  }

  async getChatMessagesByCustomer(customerId: number): Promise<ChatMessage[]> {
    return await db.select().from(chatMessages).where(eq(chatMessages.customerId, customerId)).orderBy(chatMessages.createdAt);
  }

  async getAllChatsWithLatestMessage(): Promise<any[]> {
    const allMessages = await db.select().from(chatMessages).orderBy(desc(chatMessages.createdAt));
    const chatMap = new Map<number, { customerId: number; lastMessage: ChatMessage; unreadCount: number }>();
    for (const msg of allMessages) {
      if (!chatMap.has(msg.customerId)) {
        chatMap.set(msg.customerId, { customerId: msg.customerId, lastMessage: msg, unreadCount: 0 });
      }
      if (msg.senderType === "customer" && !msg.isRead) {
        const entry = chatMap.get(msg.customerId)!;
        entry.unreadCount++;
      }
    }
    return Array.from(chatMap.values());
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [created] = await db.insert(chatMessages).values(message).returning();
    return created;
  }

  async markMessagesAsRead(customerId: number, senderType: string): Promise<void> {
    await db.update(chatMessages).set({ isRead: true }).where(
      and(eq(chatMessages.customerId, customerId), eq(chatMessages.senderType, senderType))
    );
  }

  async getUnreadMessageCount(customerId: number, senderType: string): Promise<number> {
    const msgs = await db.select().from(chatMessages).where(
      and(eq(chatMessages.customerId, customerId), eq(chatMessages.senderType, senderType), eq(chatMessages.isRead, false))
    );
    return msgs.length;
  }
}

export const storage = new DatabaseStorage();
