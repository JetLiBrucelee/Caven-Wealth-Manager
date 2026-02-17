import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, serial, index, jsonb, boolean } from "drizzle-orm/pg-core";
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
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country").default("United States"),
  gender: text("gender"),
  dateOfBirth: text("date_of_birth"),
  accountNumber: text("account_number").notNull().unique(),
  routingNumber: text("routing_number").notNull(),
  accountType: text("account_type").notNull().default("savings"),
  balance: text("balance").notNull().default("0.00"),
  status: text("status").notNull().default("active"),
  hasDebitCard: boolean("has_debit_card").notNull().default(false),
  hasCreditCard: boolean("has_credit_card").notNull().default(false),
  memberSince: timestamp("member_since").defaultNow(),
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

export const transfers = pgTable("transfers", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  type: text("type").notNull(),
  amount: text("amount").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  recipientName: text("recipient_name"),
  recipientBank: text("recipient_bank"),
  recipientAccount: text("recipient_account"),
  recipientRoutingNumber: text("recipient_routing_number"),
  swiftCode: text("swift_code"),
  bankAddress: text("bank_address"),
  memo: text("memo"),
  billPayee: text("bill_payee"),
  billAccountNumber: text("bill_account_number"),
  internalToAccount: text("internal_to_account"),
  wireType: text("wire_type"),
  beneficiaryAddress: text("beneficiary_address"),
  beneficiaryCity: text("beneficiary_city"),
  beneficiaryCountry: text("beneficiary_country"),
  intermediaryBank: text("intermediary_bank"),
  intermediarySwift: text("intermediary_swift"),
  intermediaryRouting: text("intermediary_routing"),
  purpose: text("purpose"),
  referenceNumber: text("reference_number"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

export const insertTransferSchema = createInsertSchema(transfers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  senderType: text("sender_type").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAccessCodeSchema = createInsertSchema(accessCodes).omit({
  id: true,
  createdAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export type Admin = typeof admins.$inferSelect;
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transfer = typeof transfers.$inferSelect;
export type InsertTransfer = z.infer<typeof insertTransferSchema>;
export type AccessCode = typeof accessCodes.$inferSelect;
export type InsertAccessCode = z.infer<typeof insertAccessCodeSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
