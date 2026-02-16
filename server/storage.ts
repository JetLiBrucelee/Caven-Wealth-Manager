import {
  type Admin, type InsertAdmin,
  type Customer, type InsertCustomer,
  type Transaction, type InsertTransaction,
  type AccessCode, type InsertAccessCode,
  admins, customers, transactions, accessCodes
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
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<boolean>;

  getTransactions(): Promise<Transaction[]>;
  getTransactionsByCustomer(customerId: number): Promise<Transaction[]>;
  getTransaction(id: number): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: number, transaction: Partial<InsertTransaction>): Promise<Transaction | undefined>;
  deleteTransaction(id: number): Promise<boolean>;

  getAccessCodes(): Promise<AccessCode[]>;
  getActiveAccessCodes(): Promise<AccessCode[]>;
  getAccessCode(code: string): Promise<AccessCode | undefined>;
  createAccessCode(accessCode: InsertAccessCode): Promise<AccessCode>;
  expireAccessCode(id: number): Promise<void>;
  cleanupExpiredCodes(): Promise<void>;
  generateAccessCodes(count: number): Promise<AccessCode[]>;
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

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [created] = await db.insert(customers).values(customer).returning();
    return created;
  }

  async updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [updated] = await db.update(customers).set(customer).where(eq(customers.id, id)).returning();
    return updated;
  }

  async deleteCustomer(id: number): Promise<boolean> {
    await db.delete(transactions).where(eq(transactions.customerId, id));
    const result = await db.delete(customers).where(eq(customers.id, id)).returning();
    return result.length > 0;
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
}

export const storage = new DatabaseStorage();
