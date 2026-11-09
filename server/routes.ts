import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { admins, customers, transactions, transfers, accessCodes } from "@shared/schema";
import { eq } from "drizzle-orm";
import { insertTransferSchema } from "@shared/schema";
import { registerLedgerRoutes } from "./ledger-routes";
import { parseMoneyToCents, formatCents, settleDueLedgerEntries, writeAuditLog } from "./ledger";
import { rateLimit } from "express-rate-limit";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET must be configured");
  app.set("trust proxy", 1);
  const pgStore = connectPg(session);
  app.use(
    session({
      store: new pgStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
        tableName: "sessions",
      }),
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  await seedAdmin();
  await settleDueLedgerEntries();
  const settlementTimer = setInterval(() => {
    settleDueLedgerEntries().catch((error) => console.error("Scheduled ledger settlement failed", error));
  }, 60_000);
  settlementTimer.unref();
  httpServer.on("close", () => clearInterval(settlementTimer));
  registerLedgerRoutes(app, requireAdmin);
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false,
    message: { message: "Too many login attempts. Try again in 15 minutes." },
  });
  app.use(["/api/admin/login", "/api/customer/login", "/api/customer/verify-code"], authLimiter);

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
      await new Promise<void>((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
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
      await new Promise<void>((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
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

      const accessCode = await storage.getAccessCode(String(code).trim(), customerLoginId);
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
    await settleDueLedgerEntries();
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
      const amountCents = parseMoneyToCents(req.body.amount);
      const customer = await storage.getCustomer(customerId);
      if (amountCents === null || amountCents <= 0n) throw new Error("Enter a valid amount greater than zero");
      if (!customer || amountCents > (parseMoneyToCents(customer.balance) ?? 0n)) throw new Error("Insufficient available balance");
      if (!["wire_transfer", "external_transfer", "internal_transfer", "bill_pay"].includes(req.body.type)) throw new Error("Invalid transfer type");
      const data = insertTransferSchema.parse({
        ...req.body,
        amount: formatCents(amountCents),
        customerId,
        status: "pending_confirmation",
        source: "internal",
      });
      const transfer = await storage.createTransfer(data);
      return res.status(201).json(transfer);
    } catch (error: any) {
      return res.status(400).json({ message: error.message || "Failed to create transfer" });
    }
  });

  app.post("/api/customer/transfers/:id/confirm", requireCustomer, async (req, res) => {
    try {
      const customerId = (req.session as any).customerId;
      const transferId = parseInt(req.params.id);
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ message: "Confirmation code is required" });
      }
      const transfer = await storage.getTransfer(transferId);
      if (!transfer || transfer.customerId !== customerId) {
        return res.status(404).json({ message: "Transfer not found" });
      }
      if (transfer.status !== "pending_confirmation") {
        return res.status(400).json({ message: "Transfer is not awaiting confirmation" });
      }
      const verified = await storage.verifyTransferConfirmationCode(String(code).trim(), customerId, transferId);
      if (!verified) {
        return res.status(400).json({ message: "Invalid confirmation code" });
      }
      const updated = await storage.updateTransferStatus(transferId, "processing");
      return res.json(updated);
    } catch (error: any) {
      return res.status(400).json({ message: error.message || "Failed to confirm transfer" });
    }
  });

  app.get("/api/customer/transfers", requireCustomer, async (req, res) => {
    const customerId = (req.session as any).customerId;
    const list = await storage.getTransfersByCustomer(customerId);
    return res.json(list);
  });

  app.get("/api/customer/transactions", requireCustomer, async (req, res) => {
    await settleDueLedgerEntries();
    const customerId = (req.session as any).customerId;
    const list = await storage.getTransactionsByCustomer(customerId);
    return res.json(list);
  });

  // ========== ADMIN: CUSTOMERS ==========
  app.get("/api/customers", requireAdmin, async (_req, res) => {
    await settleDueLedgerEntries();
    const list = await storage.getCustomers();
    return res.json(list.map(sanitizeCustomer));
  });

  app.get("/api/customers/:id", requireAdmin, async (req, res) => {
    const customer = await storage.getCustomer(parseInt(req.params.id));
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    return res.json(sanitizeCustomer(customer));
  });

  // ========== ADMIN: TRANSACTIONS ==========
  app.get("/api/transactions", requireAdmin, async (_req, res) => {
    await settleDueLedgerEntries();
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

  // ========== ADMIN: TRANSFERS ==========
  app.get("/api/transfers", requireAdmin, async (_req, res) => {
    const list = await storage.getTransfers();
    return res.json(list);
  });

  app.get("/api/transfers/pending", requireAdmin, async (_req, res) => {
    const list = await storage.getPendingTransfers();
    return res.json(list);
  });

  // ========== ACCESS CODES ==========
  app.get("/api/access-codes", requireAdmin, async (_req, res) => {
    const codes = await storage.getActiveAccessCodes();
    return res.json(codes);
  });

  app.post("/api/access-codes/generate", requireAdmin, async (req, res) => {
    const count = Math.min(100, Math.max(1, Number(req.body.count) || 30));
    const codes = await storage.generateAccessCodes(count);
    await writeAuditLog(db, { adminId: (req.session as any).adminId, action: "access_codes_generated", entityType: "access_code", details: { count: codes.length } });
    return res.json(codes);
  });

  app.post("/api/access-codes/verify", requireAdmin, async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: "Code required" });
    const accessCode = await storage.getAccessCode(code);
    if (!accessCode) return res.status(401).json({ message: "Invalid or expired code" });
    if (accessCode.customerId) {
      const customer = await storage.getCustomer(accessCode.customerId);
      const txns = await storage.getTransactionsByCustomer(accessCode.customerId);
      return res.json({ customer: customer ? sanitizeCustomer(customer) : null, transactions: txns });
    }
    return res.json({ message: "Valid code but no customer assigned", accessCode });
  });

  app.post("/api/access-codes/:id/assign", requireAdmin, async (req, res) => {
    try {
      const { customerId } = req.body;
      const id = parseInt(req.params.id);
      if (!await storage.getCustomer(Number(customerId))) return res.status(404).json({ message: "Customer not found" });
      const { accessCodes: acTable } = await import("@shared/schema");
      const [updated] = await db.update(acTable).set({ customerId }).where(eq(acTable.id, id)).returning();
      await writeAuditLog(db, { adminId: (req.session as any).adminId, action: "access_code_assigned", entityType: "access_code", entityId: id, details: { customerId } });
      return res.json(updated);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ========== ADMIN: TRANSFER CONFIRMATION CODES ==========
  app.get("/api/admin/transfer-codes", requireAdmin, async (_req, res) => {
    try {
      const codes = await storage.getAllTransferConfirmationCodes();
      return res.json(codes);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to fetch transfer codes" });
    }
  });

  app.get("/api/admin/transfer-codes/:customerId", requireAdmin, async (req, res) => {
    try {
      const codes = await storage.getTransferConfirmationCodes(parseInt(req.params.customerId));
      return res.json(codes);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to fetch transfer codes" });
    }
  });

  app.post("/api/admin/transfer-codes/generate", requireAdmin, async (req, res) => {
    try {
      const { customerId, transferId } = req.body;
      if (!customerId) {
        return res.status(400).json({ message: "Customer ID is required" });
      }
      const customer = await storage.getCustomer(parseInt(customerId));
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      if (transferId) {
        const transfer = await storage.getTransfer(Number(transferId));
        if (!transfer || transfer.customerId !== customer.id) return res.status(400).json({ message: "The transfer does not belong to this customer" });
      }
      const code = await storage.createTransferConfirmationCode(
        parseInt(customerId),
        transferId ? parseInt(transferId) : undefined
      );
      return res.json(code);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to generate transfer code" });
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
      await writeAuditLog(db, { adminId: (req.session as any).adminId, action: "customer_access_changed", entityType: "customer", entityId: updated.id, details: { status } });
      return res.json(sanitizeCustomer(updated));
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ========== CUSTOMER PROFILE ==========
  app.patch("/api/customer/profile", requireCustomer, async (req, res) => {
    try {
      const customerId = (req.session as any).customerId;
      const { email, phone, address, city, state, zipCode, country, avatar } = req.body;
      const updateData: any = {};
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (address !== undefined) updateData.address = address;
      if (city !== undefined) updateData.city = city;
      if (state !== undefined) updateData.state = state;
      if (zipCode !== undefined) updateData.zipCode = zipCode;
      if (country !== undefined) updateData.country = country;
      if (avatar !== undefined) updateData.avatar = avatar;

      const updated = await storage.updateCustomer(customerId, updateData);
      if (!updated) return res.status(404).json({ message: "Customer not found" });

      const { password: _, ...safe } = updated;
      return res.json(safe);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/customer/change-password", requireCustomer, async (req, res) => {
    try {
      const customerId = (req.session as any).customerId;
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters" });
      }
      const customer = await storage.getCustomer(customerId);
      if (!customer) return res.status(404).json({ message: "Customer not found" });

      const valid = await bcrypt.compare(currentPassword, customer.password);
      if (!valid) return res.status(401).json({ message: "Current password is incorrect" });

      await storage.updateCustomer(customerId, { password: newPassword });
      return res.json({ message: "Password changed successfully" });
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
  if (!(req.session as any).isAdmin || !(req.session as any).adminId) {
    return res.status(401).json({ message: "Admin authentication required" });
  }
  next();
}

async function requireCustomer(req: any, res: any, next: any) {
  if (!(req.session as any).customerAuthenticated) {
    return res.status(401).json({ message: "Customer authentication required" });
  }
  const customer = await storage.getCustomer(req.session.customerId);
  if (!customer || customer.status !== "active") return res.status(403).json({ message: "Account access is unavailable" });
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
    avatar: customer.avatar,
    memberSince: customer.memberSince,
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
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) throw new Error("Set ADMIN_USERNAME and ADMIN_PASSWORD in workspace secrets");
  if (password.length < 8) throw new Error("The admin password must contain at least 8 characters");
  const existing = await storage.getAdminByUsername(username);
  if (!existing) {
    await storage.createAdmin({ username, password });
    console.log("Admin account initialized from workspace secrets");
  }
}
