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
      const customer = await storage.createCustomer(req.body);
      return res.status(201).json(customer);
    } catch (error: any) {
      return res.status(400).json({ message: error.message || "Failed to create customer" });
    }
  });

  app.patch("/api/customers/:id", requireAdmin, async (req, res) => {
    const updated = await storage.updateCustomer(parseInt(req.params.id), req.body);
    if (!updated) return res.status(404).json({ message: "Customer not found" });
    return res.json(updated);
  });

  app.delete("/api/customers/:id", requireAdmin, async (req, res) => {
    const deleted = await storage.deleteCustomer(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ message: "Customer not found" });
    return res.json({ message: "Customer deleted" });
  });

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

  app.get("/api/user/transactions/:code", async (req, res) => {
    const accessCode = await storage.getAccessCode(req.params.code);
    if (!accessCode) return res.status(401).json({ message: "Invalid or expired code" });
    if (!accessCode.customerId) return res.status(400).json({ message: "No customer assigned to this code" });
    const customer = await storage.getCustomer(accessCode.customerId);
    const txns = await storage.getTransactionsByCustomer(accessCode.customerId);
    return res.json({ customer, transactions: txns });
  });

  return httpServer;
}

function requireAdmin(req: any, res: any, next: any) {
  if (!(req.session as any).isAdmin) {
    return res.status(401).json({ message: "Admin authentication required" });
  }
  next();
}

async function seedAdmin() {
  try {
    const existing = await storage.getAdminByUsername("admin");
    if (!existing) {
      await storage.createAdmin({ username: "admin", password: "admin123" });
      console.log("Default admin created: admin / admin123");
    }
  } catch (error) {
    console.log("Admin seeding will be attempted after DB push");
  }
}
