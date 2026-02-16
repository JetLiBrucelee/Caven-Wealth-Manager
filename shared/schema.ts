import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, serial, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  accountNumber: text("account_number").notNull().unique(),
  accountType: text("account_type").notNull().default("savings"),
  balance: text("balance").notNull().default("0.00"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  type: text("type").notNull(),
  amount: text("amount").notNull(),
  description: text("description").notNull(),
  date: timestamp("date").notNull(),
  status: text("status").notNull().default("completed"),
  reference: text("reference"),
  beneficiary: text("beneficiary"),
  beneficiaryBank: text("beneficiary_bank"),
  beneficiaryAccount: text("beneficiary_account"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const accessCodes = pgTable("access_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  customerId: integer("customer_id").references(() => customers.id),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const insertAdminSchema = createInsertSchema(admins).pick({
  username: true,
  password: true,
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertAccessCodeSchema = createInsertSchema(accessCodes).omit({
  id: true,
  createdAt: true,
});

export type Admin = typeof admins.$inferSelect;
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type AccessCode = typeof accessCodes.$inferSelect;
export type InsertAccessCode = z.infer<typeof insertAccessCodeSchema>;
