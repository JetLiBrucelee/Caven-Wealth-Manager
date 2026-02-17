import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { admins } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const pgStore = connectPg(session);
  app.use(
    session({
      store: new pgStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
        tableName: "sessions",
      }),
      secret: process.env.SESSION_SECRET || "caven-financial-wealth-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  await seedAdmin();

  // ========== ADMIN AUTH ==========
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }
      const admin = await storage.validateAdminPassword(username, password);
      if (!admin) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      (req.session as any).adminId = admin.id;
      (req.session as any).isAdmin = true;
      return res.json({ id: admin.id, username: admin.username });
    } catch (error) {
      return res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/admin/me", requireAdmin, async (req, res) => {
    const admin = await storage.getAdmin((req.session as any).adminId);
    if (!admin) return res.status(401).json({ message: "Not authenticated" });
    return res.json({ id: admin.id, username: admin.username });
  });

  // ========== CUSTOMER AUTH ==========
  app.post("/api/customer/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }
      const customer = await storage.validateCustomerPassword(username, password);
      if (!customer) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      if (customer.status === "blocked") {
        return res.status(403).json({ message: "Your account has been suspended. Please contact support." });
      }
      (req.session as any).customerLoginId = customer.id;
      (req.session as any).customerLoginStep = "needs_code";
      return res.json({ step: "needs_code", customerId: customer.id });
    } catch (error) {
      return res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/customer/verify-code", async (req, res) => {
    try {
      const { code } = req.body;
      const customerLoginId = (req.session as any).customerLoginId;
      const step = (req.session as any).customerLoginStep;

      if (!customerLoginId || step !== "needs_code") {
        return res.status(401).json({ message: "Please login with username and password first" });
      }
      if (!code) {
        return res.status(400).json({ message: "Access code required" });
      }

      const accessCode = await storage.getAccessCode(code);
      if (!accessCode) {
        return res.status(401).json({ message: "Invalid or expired access code" });
      }

      (req.session as any).customerId = customerLoginId;
      (req.session as any).customerAuthenticated = true;
      (req.session as any).customerLoginStep = null;

      const customer = await storage.getCustomer(customerLoginId);
      return res.json({
        authenticated: true,
        customer: customer ? sanitizeCustomer(customer) : null,
      });
    } catch (error) {
      return res.status(500).json({ message: "Verification failed" });
    }
  });

  app.get("/api/customer/me", requireCustomer, async (req, res) => {
    const customer = await storage.getCustomer((req.session as any).customerId);
    if (!customer) return res.status(401).json({ message: "Not authenticated" });
    return res.json(sanitizeCustomer(customer));
  });

  app.post("/api/customer/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

  // ========== CUSTOMER TRANSFERS (user-initiated) ==========
  app.post("/api/customer/transfers", requireCustomer, async (req, res) => {
    try {
      const customerId = (req.session as any).customerId;
      const transfer = await storage.createTransfer({
        ...req.body,
        customerId,
        status: "pending",
      });
      return res.status(201).json(transfer);
    } catch (error: any) {
      return res.status(400).json({ message: error.message || "Failed to create transfer" });
    }
  });

  app.get("/api/customer/transfers", requireCustomer, async (req, res) => {
    const customerId = (req.session as any).customerId;
    const list = await storage.getTransfersByCustomer(customerId);
    return res.json(list);
  });

  app.get("/api/customer/transactions", requireCustomer, async (req, res) => {
    const customerId = (req.session as any).customerId;
    const list = await storage.getTransactionsByCustomer(customerId);
    return res.json(list);
  });

  // ========== ADMIN: CUSTOMERS ==========
  app.get("/api/customers", requireAdmin, async (_req, res) => {
    const list = await storage.getCustomers();
    return res.json(list);
  });

  app.get("/api/customers/:id", requireAdmin, async (req, res) => {
    const customer = await storage.getCustomer(parseInt(req.params.id));
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    return res.json(customer);
  });

  app.post("/api/customers", requireAdmin, async (req, res) => {
    try {
      const accountNumber = generateAccountNumber();
      const routingNumber = generateRoutingNumber();
      const body = { ...req.body };
      if (body.memberSince) {
        body.memberSince = new Date(body.memberSince);
      }
      const customer = await storage.createCustomer({
        ...body,
        accountNumber,
        routingNumber,
      });
      return res.status(201).json(customer);
    } catch (error: any) {
      return res.status(400).json({ message: error.message || "Failed to create customer" });
    }
  });

  app.patch("/api/customers/:id", requireAdmin, async (req, res) => {
    const updateData = { ...req.body };
    if (updateData.password === "") {
      delete updateData.password;
    }
    if (updateData.memberSince) {
      updateData.memberSince = new Date(updateData.memberSince);
    }
    const updated = await storage.updateCustomer(parseInt(req.params.id), updateData);
    if (!updated) return res.status(404).json({ message: "Customer not found" });
    return res.json(updated);
  });

  app.delete("/api/customers/:id", requireAdmin, async (req, res) => {
    const deleted = await storage.deleteCustomer(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ message: "Customer not found" });
    return res.json({ message: "Customer deleted" });
  });

  // ========== ADMIN: TRANSACTIONS ==========
  app.get("/api/transactions", requireAdmin, async (_req, res) => {
    const list = await storage.getTransactions();
    return res.json(list);
  });

  app.get("/api/transactions/customer/:customerId", requireAdmin, async (req, res) => {
    const list = await storage.getTransactionsByCustomer(parseInt(req.params.customerId));
    return res.json(list);
  });

  app.get("/api/transactions/:id", requireAdmin, async (req, res) => {
    const transaction = await storage.getTransaction(parseInt(req.params.id));
    if (!transaction) return res.status(404).json({ message: "Transaction not found" });
    return res.json(transaction);
  });

  app.post("/api/transactions", requireAdmin, async (req, res) => {
    try {
      const data = { ...req.body, date: new Date(req.body.date) };
      const transaction = await storage.createTransaction(data);
      return res.status(201).json(transaction);
    } catch (error: any) {
      return res.status(400).json({ message: error.message || "Failed to create transaction" });
    }
  });

  app.patch("/api/transactions/:id", requireAdmin, async (req, res) => {
    const data = { ...req.body };
    if (data.date) data.date = new Date(data.date);
    const updated = await storage.updateTransaction(parseInt(req.params.id), data);
    if (!updated) return res.status(404).json({ message: "Transaction not found" });
    return res.json(updated);
  });

  app.delete("/api/transactions/:id", requireAdmin, async (req, res) => {
    const deleted = await storage.deleteTransaction(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ message: "Transaction not found" });
    return res.json({ message: "Transaction deleted" });
  });

  // ========== ADMIN: TRANSFERS ==========
  app.get("/api/transfers", requireAdmin, async (_req, res) => {
    const list = await storage.getTransfers();
    return res.json(list);
  });

  app.get("/api/transfers/pending", requireAdmin, async (_req, res) => {
    const list = await storage.getPendingTransfers();
    return res.json(list);
  });

  app.patch("/api/transfers/:id/status", requireAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Status must be 'approved' or 'rejected'" });
      }
      const transfer = await storage.getTransfer(parseInt(req.params.id));
      if (!transfer) return res.status(404).json({ message: "Transfer not found" });

      const updated = await storage.updateTransferStatus(parseInt(req.params.id), status);

      if (status === "approved" && updated) {
        const customer = await storage.getCustomer(updated.customerId);
        if (customer) {
          const currentBalance = parseFloat(customer.balance);
          const amount = parseFloat(updated.amount);
          const newBalance = (currentBalance - amount).toFixed(2);
          await storage.updateCustomer(customer.id, { balance: newBalance });
        }
        await storage.createTransaction({
          customerId: updated.customerId,
          type: updated.type,
          amount: updated.amount,
          description: updated.description || `${updated.type} to ${updated.recipientName || updated.billPayee || updated.internalToAccount || 'N/A'}`,
          date: new Date(),
          status: "completed",
          reference: `TXN-${Date.now()}`,
          beneficiary: updated.recipientName || updated.billPayee || null,
          beneficiaryBank: updated.recipientBank || null,
          beneficiaryAccount: updated.recipientAccount || updated.billAccountNumber || updated.internalToAccount || null,
        });
      }

      return res.json(updated);
    } catch (error: any) {
      return res.status(400).json({ message: error.message || "Failed to update transfer" });
    }
  });

  // ========== ACCESS CODES ==========
  app.get("/api/access-codes", requireAdmin, async (_req, res) => {
    const codes = await storage.getActiveAccessCodes();
    return res.json(codes);
  });

  app.post("/api/access-codes/generate", requireAdmin, async (req, res) => {
    const count = req.body.count || 30;
    const codes = await storage.generateAccessCodes(count);
    return res.json(codes);
  });

  app.post("/api/access-codes/verify", async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: "Code required" });
    const accessCode = await storage.getAccessCode(code);
    if (!accessCode) return res.status(401).json({ message: "Invalid or expired code" });
    if (accessCode.customerId) {
      const customer = await storage.getCustomer(accessCode.customerId);
      const txns = await storage.getTransactionsByCustomer(accessCode.customerId);
      return res.json({ customer, transactions: txns });
    }
    return res.json({ message: "Valid code but no customer assigned", accessCode });
  });

  app.post("/api/access-codes/:id/assign", requireAdmin, async (req, res) => {
    try {
      const { customerId } = req.body;
      const id = parseInt(req.params.id);
      const { accessCodes: acTable } = await import("@shared/schema");
      const [updated] = await db.update(acTable).set({ customerId }).where(eq(acTable.id, id)).returning();
      return res.json(updated);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ========== ADMIN: BLOCK/UNBLOCK CUSTOMERS ==========
  app.patch("/api/customers/:id/block", requireAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      if (!["active", "blocked"].includes(status)) {
        return res.status(400).json({ message: "Status must be 'active' or 'blocked'" });
      }
      const updated = await storage.updateCustomer(parseInt(req.params.id), { status });
      if (!updated) return res.status(404).json({ message: "Customer not found" });
      return res.json(updated);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ========== ADMIN: FUND USER ==========
  app.post("/api/customers/:id/fund", requireAdmin, async (req, res) => {
    try {
      const { amount, description } = req.body;
      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: "Valid amount required" });
      }
      const customer = await storage.getCustomer(parseInt(req.params.id));
      if (!customer) return res.status(404).json({ message: "Customer not found" });

      const currentBalance = parseFloat(customer.balance);
      const fundAmount = parseFloat(amount);
      const newBalance = (currentBalance + fundAmount).toFixed(2);

      await storage.updateCustomer(customer.id, { balance: newBalance });

      await storage.createTransaction({
        customerId: customer.id,
        type: "credit",
        amount: fundAmount.toFixed(2),
        description: description || "Account funding by admin",
        date: new Date(),
        status: "completed",
        reference: `FUND-${Date.now()}`,
        beneficiary: null,
        beneficiaryBank: null,
        beneficiaryAccount: null,
      });

      const updatedCustomer = await storage.getCustomer(customer.id);
      return res.json(updatedCustomer);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ========== ADMIN: CREATE TRANSACTION HISTORY ==========
  app.post("/api/customers/:id/history", requireAdmin, async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      const customer = await storage.getCustomer(customerId);
      if (!customer) return res.status(404).json({ message: "Customer not found" });

      const { type, amount, description, date, status, reference, beneficiary, beneficiaryBank, beneficiaryAccount } = req.body;
      if (!type || !amount || !description || !date) {
        return res.status(400).json({ message: "Type, amount, description, and date are required" });
      }

      const transaction = await storage.createTransaction({
        customerId,
        type,
        amount: parseFloat(amount).toFixed(2),
        description,
        date: new Date(date),
        status: status || "completed",
        reference: reference || `TXN-${Date.now()}`,
        beneficiary: beneficiary || null,
        beneficiaryBank: beneficiaryBank || null,
        beneficiaryAccount: beneficiaryAccount || null,
      });

      return res.status(201).json(transaction);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ========== CHAT MESSAGES ==========
  app.get("/api/customer/chat/unread", requireCustomer, async (req, res) => {
    const customerId = (req.session as any).customerId;
    const messages = await storage.getChatMessagesByCustomer(customerId);
    const unreadCount = messages.filter(m => m.senderType === "admin" && !m.isRead).length;
    return res.json({ unreadCount });
  });

  app.get("/api/customer/chat", requireCustomer, async (req, res) => {
    const customerId = (req.session as any).customerId;
    const messages = await storage.getChatMessagesByCustomer(customerId);
    await storage.markMessagesAsRead(customerId, "admin");
    return res.json(messages);
  });

  app.post("/api/customer/chat", requireCustomer, async (req, res) => {
    try {
      const customerId = (req.session as any).customerId;
      const { message } = req.body;
      if (!message?.trim()) return res.status(400).json({ message: "Message required" });
      const chatMessage = await storage.createChatMessage({
        customerId,
        senderType: "customer",
        message: message.trim(),
        isRead: false,
      });
      return res.status(201).json(chatMessage);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/chats", requireAdmin, async (_req, res) => {
    const chats = await storage.getAllChatsWithLatestMessage();
    const customersData = await storage.getCustomers();
    const enriched = chats.map(chat => {
      const cust = customersData.find(c => c.id === chat.customerId);
      return { ...chat, customerName: cust ? `${cust.firstName} ${cust.lastName}` : "Unknown" };
    });
    return res.json(enriched);
  });

  app.get("/api/admin/chats/:customerId", requireAdmin, async (req, res) => {
    const customerId = parseInt(req.params.customerId);
    const messages = await storage.getChatMessagesByCustomer(customerId);
    await storage.markMessagesAsRead(customerId, "customer");
    return res.json(messages);
  });

  app.post("/api/admin/chats/:customerId", requireAdmin, async (req, res) => {
    try {
      const customerId = parseInt(req.params.customerId);
      const { message } = req.body;
      if (!message?.trim()) return res.status(400).json({ message: "Message required" });
      const chatMessage = await storage.createChatMessage({
        customerId,
        senderType: "admin",
        message: message.trim(),
        isRead: false,
      });
      return res.status(201).json(chatMessage);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/zipcode-lookup/:zip", async (req, res) => {
    try {
      const { zip } = req.params;
      if (!zip || zip.length < 3) {
        return res.status(400).json({ message: "Invalid zip code" });
      }
      const response = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (!response.ok) {
        return res.status(404).json({ message: "Zip code not found" });
      }
      const data = await response.json() as any;
      const place = data.places?.[0];
      if (place) {
        return res.json({
          city: place["place name"],
          state: place["state"],
          stateAbbreviation: place["state abbreviation"],
          country: data.country,
        });
      }
      return res.status(404).json({ message: "No results found" });
    } catch (error) {
      return res.status(500).json({ message: "Failed to lookup zip code" });
    }
  });

  return httpServer;
}

function requireAdmin(req: any, res: any, next: any) {
  if (!(req.session as any).isAdmin) {
    return res.status(401).json({ message: "Admin authentication required" });
  }
  next();
}

function requireCustomer(req: any, res: any, next: any) {
  if (!(req.session as any).customerAuthenticated) {
    return res.status(401).json({ message: "Customer authentication required" });
  }
  next();
}

function sanitizeCustomer(customer: any) {
  return {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    username: customer.username,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    city: customer.city,
    state: customer.state,
    zipCode: customer.zipCode,
    country: customer.country,
    gender: customer.gender,
    dateOfBirth: customer.dateOfBirth,
    accountNumber: customer.accountNumber,
    routingNumber: customer.routingNumber,
    accountType: customer.accountType,
    balance: customer.balance,
    status: customer.status,
    hasDebitCard: customer.hasDebitCard,
    hasCreditCard: customer.hasCreditCard,
    createdAt: customer.createdAt,
  };
}

function generateAccountNumber(): string {
  const segments = [
    String(Math.floor(Math.random() * 9) + 1),
    String(Math.floor(Math.random() * 900 + 100)),
    String(Math.floor(Math.random() * 900 + 100)),
    String(Math.floor(Math.random() * 900 + 100)),
  ];
  return segments.join("");
}

function generateRoutingNumber(): string {
  const prefix = "0";
  const mid = String(Math.floor(Math.random() * 90000000 + 10000000));
  return prefix + mid;
}

async function seedAdmin() {
  try {
    const existing = await storage.getAdminByUsername("admin@cavenwealthfinancial.com");
    if (!existing) {
      await storage.createAdmin({ username: "admin@cavenwealthfinancial.com", password: "Adminproject2026!" });
      console.log("Default admin created");
    }
  } catch (error) {
    console.log("Admin seeding will be attempted after DB push");
  }
}
