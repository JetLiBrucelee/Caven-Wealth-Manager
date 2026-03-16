import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { admins, customers, transactions, transfers, accessCodes } from "@shared/schema";
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
        status: "pending_confirmation",
      });
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
      const verified = await storage.verifyTransferConfirmationCode(code, customerId);
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
      if (body.balance !== undefined && body.balance !== "") {
        const parsed = parseFloat(body.balance);
        if (isNaN(parsed)) {
          return res.status(400).json({ message: "Invalid balance amount" });
        }
        body.balance = parsed.toFixed(2);
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
    if (updateData.balance !== undefined && updateData.balance !== "") {
      const parsed = parseFloat(updateData.balance);
      if (isNaN(parsed)) {
        return res.status(400).json({ message: "Invalid balance amount" });
      }
      updateData.balance = parsed.toFixed(2);
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
      if (data.amount !== undefined && data.amount !== "") {
        const parsed = parseFloat(data.amount);
        if (isNaN(parsed)) {
          return res.status(400).json({ message: "Invalid amount" });
        }
        data.amount = parsed.toFixed(2);
      }
      const transaction = await storage.createTransaction(data);
      return res.status(201).json(transaction);
    } catch (error: any) {
      return res.status(400).json({ message: error.message || "Failed to create transaction" });
    }
  });

  app.patch("/api/transactions/:id", requireAdmin, async (req, res) => {
    const data = { ...req.body };
    if (data.date) data.date = new Date(data.date);
    if (data.amount !== undefined && data.amount !== "") {
      const parsed = parseFloat(data.amount);
      if (isNaN(parsed)) {
        return res.status(400).json({ message: "Invalid amount" });
      }
      data.amount = parsed.toFixed(2);
    }
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
      const { status, declineReason } = req.body;
      if (!["approved", "declined", "processing"].includes(status)) {
        return res.status(400).json({ message: "Status must be 'approved', 'declined', or 'processing'" });
      }
      const transfer = await storage.getTransfer(parseInt(req.params.id));
      if (!transfer) return res.status(404).json({ message: "Transfer not found" });
      if (status === "approved" && transfer.status === "pending_confirmation") {
        return res.status(400).json({ message: "Transfer must be confirmed by customer before approval" });
      }
      if (status === "declined" && !declineReason) {
        return res.status(400).json({ message: "Decline reason is required" });
      }

      const updated = await storage.updateTransferStatus(
        parseInt(req.params.id),
        status,
        status === "declined" ? declineReason : undefined
      );

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
          reference: `${Date.now()}`,
          beneficiary: updated.recipientName || updated.billPayee || null,
          beneficiaryBank: updated.recipientBank || null,
          beneficiaryAccount: updated.recipientAccount || updated.billAccountNumber || updated.internalToAccount || null,
        });
      }

      if (status === "declined" && updated) {
        await storage.createTransaction({
          customerId: updated.customerId,
          type: updated.type,
          amount: updated.amount,
          description: updated.declineReason ? `Transfer declined: ${updated.declineReason}` : "Transfer declined",
          date: new Date(),
          status: "declined",
          reference: `${Date.now()}`,
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
      return res.json(updated);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ========== ADMIN: BALANCE ==========
  app.get("/api/admin/balance", requireAdmin, async (req, res) => {
    try {
      const admin = await storage.getAdmin((req.session as any).adminId);
      if (!admin) return res.status(404).json({ message: "Admin not found" });
      return res.json({ balance: admin.balance });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/admin/topup", requireAdmin, async (req, res) => {
    try {
      const { amount } = req.body;
      const topupAmount = parseFloat(amount);
      if (isNaN(topupAmount) || topupAmount <= 0) {
        return res.status(400).json({ message: "Valid amount required" });
      }
      const admin = await storage.getAdmin((req.session as any).adminId);
      if (!admin) return res.status(404).json({ message: "Admin not found" });
      const currentBalance = parseFloat(admin.balance);
      const newBalance = (currentBalance + topupAmount).toFixed(2);
      await storage.updateAdminBalance(admin.id, newBalance);
      return res.json({ balance: newBalance });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ========== ADMIN: FUND USER ==========
  app.post("/api/customers/:id/fund", requireAdmin, async (req, res) => {
    try {
      const { amount, description } = req.body;
      const fundAmount = parseFloat(amount);
      if (isNaN(fundAmount) || fundAmount <= 0) {
        return res.status(400).json({ message: "Valid amount required" });
      }

      const admin = await storage.getAdmin((req.session as any).adminId);
      if (!admin) return res.status(404).json({ message: "Admin not found" });
      const adminBalance = parseFloat(admin.balance);
      if (fundAmount > adminBalance) {
        return res.status(400).json({ message: "Insufficient admin balance. Please top up your balance first." });
      }

      const customer = await storage.getCustomer(parseInt(req.params.id));
      if (!customer) return res.status(404).json({ message: "Customer not found" });

      const currentBalance = parseFloat(customer.balance);
      const newBalance = (currentBalance + fundAmount).toFixed(2);
      const newAdminBalance = (adminBalance - fundAmount).toFixed(2);

      await storage.updateCustomer(customer.id, { balance: newBalance });
      await storage.updateAdminBalance(admin.id, newAdminBalance);

      await storage.createTransaction({
        customerId: customer.id,
        type: "credit",
        amount: fundAmount.toFixed(2),
        description: description || "",
        date: new Date(),
        status: "completed",
        reference: `${Date.now()}`,
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
        reference: reference || `${Date.now()}`,
        beneficiary: beneficiary || null,
        beneficiaryBank: beneficiaryBank || null,
        beneficiaryAccount: beneficiaryAccount || null,
      });

      return res.status(201).json(transaction);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });

  // ========== ADMIN: CREATE USER WITH FULL HISTORY ==========
  app.post("/api/admin/create-full-user", requireAdmin, async (req, res) => {
    try {
      const { firstName, lastName, username, password, address, city, state, zipCode, gender, balance: rawBalance } = req.body;
      if (!firstName || !lastName || !username || !password || !address || !city || !state || !zipCode || !gender) {
        return res.status(400).json({ message: "All fields are required: first name, last name, username, password, address, city, state, zip code, and gender" });
      }
      const allowedBalances = ["18276999.30", "9230192.20"];
      const chosenBalance = allowedBalances.includes(rawBalance) ? rawBalance : "18276999.30";

      const existing = await db.select().from(customers).where(eq(customers.username, username));
      if (existing.length > 0) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const accountNumber = generateAccountNumber();
      const routingNumber = "121000358";

      const [newCustomer] = await db.insert(customers).values({
        firstName,
        lastName,
        username,
        password: hashedPassword,
        email: null,
        phone: null,
        address,
        city,
        state,
        zipCode,
        country: "United States",
        gender,
        accountNumber,
        routingNumber,
        accountType: "business",
        balance: chosenBalance,
        status: "active",
        hasDebitCard: true,
        hasCreditCard: true,
        memberSince: new Date("2024-03-15T00:00:00.000Z"),
      }).returning();

      const custId = newCustomer.id;

      const txns = [
        { type: "debit", amount: "425000.00", description: `PO-6341 - Purchase: Blowout Preventer Stack Assembly | Gulf Coast Drilling Solutions | JPMorgan Chase Bank | Acct: 3281047562 | Routing: 021000021 | SWIFT: CHASUS33`, date: new Date("2024-04-08T07:22:00.000Z"), reference: "PO-6341", beneficiary: "Gulf Coast Drilling Solutions", beneficiaryBank: "JPMorgan Chase Bank", beneficiaryAccount: "3281047562" },
        { type: "credit", amount: "189500.00", description: `INV-6290 - Sale: Subsea Wellhead Connector Kit | Permian Basin Equipment Co. | Wells Fargo Bank | Acct: 7610283945 | Routing: 121000248 | SWIFT: WFBIUS6S`, date: new Date("2024-04-22T15:40:00.000Z"), reference: "INV-6290", beneficiary: "Permian Basin Equipment Co.", beneficiaryBank: "Wells Fargo Bank", beneficiaryAccount: "7610283945" },
        { type: "debit", amount: "328500.00", description: `INV-7821 - Purchase: Subsea Manifold Assembly | Abyssal Dynamics Inc. | Pacific Maritime Bank | Acct: 4001122334 | Routing: 122000496 | SWIFT: PAMBUS4S`, date: new Date("2024-05-10T14:30:00.000Z"), reference: "INV-7821", beneficiary: "Abyssal Dynamics Inc.", beneficiaryBank: "Pacific Maritime Bank", beneficiaryAccount: "4001122334" },
        { type: "credit", amount: "198000.00", description: `SALE-8850 - Sale: ROV Tether Management System | Oceanic Robotics Ltd. | Harbor State Bank | Acct: 9876540123 | Routing: 065305436 | SWIFT: HARSUS3A`, date: new Date("2024-05-12T09:15:00.000Z"), reference: "SALE-8850", beneficiary: "Oceanic Robotics Ltd.", beneficiaryBank: "Harbor State Bank", beneficiaryAccount: "9876540123" },
        { type: "debit", amount: "156750.00", description: `PO-8103 - Purchase: High-Pressure Drilling Mud Pump | Texas Oilfield Supply Corp. | Bank of America | Acct: 5023891764 | Routing: 111000025 | SWIFT: BOFAUS3N`, date: new Date("2024-06-03T16:45:00.000Z"), reference: "PO-8103", beneficiary: "Texas Oilfield Supply Corp.", beneficiaryBank: "Bank of America", beneficiaryAccount: "5023891764" },
        { type: "credit", amount: "542000.00", description: `SALE-9021 - Sale: Deepwater ROV Intervention System | Bayou Offshore Services LLC | Regions Bank | Acct: 4187620935 | Routing: 062005690 | SWIFT: UPNBUS44`, date: new Date("2024-07-15T11:30:00.000Z"), reference: "SALE-9021", beneficiary: "Bayou Offshore Services LLC", beneficiaryBank: "Regions Bank", beneficiaryAccount: "4187620935" },
        { type: "debit", amount: "287350.00", description: `PO-9415 - Purchase: Offshore Christmas Tree Valve Assembly | Lone Star Petroleum Equipment | Frost Bank | Acct: 6034718290 | Routing: 114000093 | SWIFT: FRSTUS44`, date: new Date("2024-08-19T08:10:00.000Z"), reference: "PO-9415", beneficiary: "Lone Star Petroleum Equipment", beneficiaryBank: "Frost Bank", beneficiaryAccount: "6034718290" },
        { type: "credit", amount: "378200.00", description: `SALE-1087 - Sale: Hydraulic Workover Unit Components | Bakken Formation Resources Inc. | U.S. Bank | Acct: 8291034567 | Routing: 091000022 | SWIFT: USBKUS44`, date: new Date("2024-09-05T13:55:00.000Z"), reference: "SALE-1087", beneficiary: "Bakken Formation Resources Inc.", beneficiaryBank: "U.S. Bank", beneficiaryAccount: "8291034567" },
        { type: "debit", amount: "92800.00", description: `PO-1124 - Purchase: PDC Drill Bit Set - 12-1/4 inch | Oklahoma Drill Technologies | BOK Financial | Acct: 2047381956 | Routing: 103900036 | SWIFT: BOKFUS41`, date: new Date("2024-09-28T10:20:00.000Z"), reference: "PO-1124", beneficiary: "Oklahoma Drill Technologies", beneficiaryBank: "BOK Financial", beneficiaryAccount: "2047381956" },
        { type: "debit", amount: "463500.00", description: `PO-1298 - Purchase: Topside Separation Module | Midland Energy Systems Inc. | Comerica Bank | Acct: 9182730465 | Routing: 072000096 | SWIFT: MNBDUS33`, date: new Date("2024-10-14T17:05:00.000Z"), reference: "PO-1298", beneficiary: "Midland Energy Systems Inc.", beneficiaryBank: "Comerica Bank", beneficiaryAccount: "9182730465" },
        { type: "credit", amount: "215000.00", description: `SALE-1342 - Sale: Gas Compression Skid Package | Eagle Ford Industrial Co. | Capital One Bank | Acct: 3058172946 | Routing: 065000090 | SWIFT: HIBKUS44`, date: new Date("2024-11-07T14:35:00.000Z"), reference: "SALE-1342", beneficiary: "Eagle Ford Industrial Co.", beneficiaryBank: "Capital One Bank", beneficiaryAccount: "3058172946" },
        { type: "debit", amount: "679500.00", description: `PO-1510 - Purchase: FPSO Turret Mooring Assembly | Houston Subsea Engineering | Zions Bank | Acct: 7429061538 | Routing: 124000054 | SWIFT: ZFNBUS55`, date: new Date("2024-11-22T08:00:00.000Z"), reference: "PO-1510", beneficiary: "Houston Subsea Engineering", beneficiaryBank: "Zions Bank", beneficiaryAccount: "7429061538" },
        { type: "credit", amount: "145800.00", description: `SALE-1623 - Sale: Wellhead Flow Control Valves | Red River Oilfield Services | First Horizon Bank | Acct: 6501829374 | Routing: 084000026 | SWIFT: FTNBUS44`, date: new Date("2024-12-10T11:25:00.000Z"), reference: "SALE-1623", beneficiary: "Red River Oilfield Services", beneficiaryBank: "First Horizon Bank", beneficiaryAccount: "6501829374" },
        { type: "debit", amount: "312000.00", description: `PO-1780 - Purchase: Coiled Tubing Unit with BHA | Panhandle Drilling Equipment LLC | BBVA USA | Acct: 8173024596 | Routing: 062001186 | SWIFT: BBVAUS44`, date: new Date("2025-01-08T15:30:00.000Z"), reference: "PO-1780", beneficiary: "Panhandle Drilling Equipment LLC", beneficiaryBank: "BBVA USA", beneficiaryAccount: "8173024596" },
        { type: "credit", amount: "498750.00", description: `SALE-1855 - Sale: Offshore Pipeline Laying Equipment | Williston Basin Energy Corp. | Truist Bank | Acct: 2946107385 | Routing: 053101121 | SWIFT: SNTRUS3A`, date: new Date("2025-01-25T09:00:00.000Z"), reference: "SALE-1855", beneficiary: "Williston Basin Energy Corp.", beneficiaryBank: "Truist Bank", beneficiaryAccount: "2946107385" },
        { type: "debit", amount: "187400.00", description: `PO-2010 - Purchase: Mud Logging Sensor Array System | Tulsa Well Services Inc. | Arvest Bank | Acct: 5180394726 | Routing: 082000549 | SWIFT: ARVTUS44`, date: new Date("2025-03-12T16:45:00.000Z"), reference: "PO-2010", beneficiary: "Tulsa Well Services Inc.", beneficiaryBank: "Arvest Bank", beneficiaryAccount: "5180394726" },
        { type: "credit", amount: "356200.00", description: `SALE-2198 - Sale: Subsea Umbilical Distribution Hub | Kern River Energy Solutions | Silicon Valley Bank | Acct: 4062917385 | Routing: 121140399 | SWIFT: SVBKUS6S`, date: new Date("2025-05-06T13:15:00.000Z"), reference: "SALE-2198", beneficiary: "Kern River Energy Solutions", beneficiaryBank: "Silicon Valley Bank", beneficiaryAccount: "4062917385" },
        { type: "debit", amount: "128900.00", description: `PO-2445 - Purchase: Tri-Cone Roller Bit Assembly | North Dakota Oilfield Supplies | Gate City Bank | Acct: 7301824596 | Routing: 091407429 | SWIFT: GTCTUS41`, date: new Date("2025-07-21T08:50:00.000Z"), reference: "PO-2445", beneficiary: "North Dakota Oilfield Supplies", beneficiaryBank: "Gate City Bank", beneficiaryAccount: "7301824596" },
        { type: "credit", amount: "245600.00", description: `SALE-2710 - Sale: Electric Submersible Pump System | Shreveport Petroleum Technology | Origin Bank | Acct: 9028374615 | Routing: 065403626 | SWIFT: CMRCUS44`, date: new Date("2025-09-15T17:40:00.000Z"), reference: "SALE-2710", beneficiary: "Shreveport Petroleum Technology", beneficiaryBank: "Origin Bank", beneficiaryAccount: "9028374615" },
        { type: "debit", amount: "534000.00", description: `PO-2930 - Purchase: Riser Tensioning System | Odessa Production Equipment Co. | WestStar Bank | Acct: 6183029475 | Routing: 112200407 | SWIFT: WSTRUS41`, date: new Date("2025-11-03T14:20:00.000Z"), reference: "PO-2930", beneficiary: "Odessa Production Equipment Co.", beneficiaryBank: "WestStar Bank", beneficiaryAccount: "6183029475" },
        { type: "credit", amount: "167500.00", description: `SALE-3101 - Sale: Casing Running Tool Package | Bakersfield Energy Supply Inc. | Bank of the Sierra | Acct: 3947102856 | Routing: 121137027 | SWIFT: BKSIUS61`, date: new Date("2026-01-12T07:10:00.000Z"), reference: "SALE-3101", beneficiary: "Bakersfield Energy Supply Inc.", beneficiaryBank: "Bank of the Sierra", beneficiaryAccount: "3947102856" },
        { type: "debit", amount: "275800.00", description: `PO-3205 - Purchase: Mud Circulation System Upgrade | Corpus Christi Marine Systems | Prosperity Bank | Acct: 8214063597 | Routing: 113122655 | SWIFT: PRSPUS44`, date: new Date("2026-02-05T10:30:00.000Z"), reference: "PO-3205", beneficiary: "Corpus Christi Marine Systems", beneficiaryBank: "Prosperity Bank", beneficiaryAccount: "8214063597" },
      ];

      for (const txn of txns) {
        await db.insert(transactions).values({
          customerId: custId,
          type: txn.type,
          amount: txn.amount,
          description: txn.description,
          date: txn.date,
          status: "completed",
          reference: txn.reference,
          beneficiary: txn.beneficiary,
          beneficiaryBank: txn.beneficiaryBank,
          beneficiaryAccount: txn.beneficiaryAccount,
        });
      }

      const transferData = [
        { type: "wire_transfer", amount: "425000.00", description: "Wire payment for BOP Stack Assembly - PO-6341", status: "approved", recipientName: "Gulf Coast Drilling Solutions", recipientBank: "JPMorgan Chase Bank", recipientAccount: "3281047562", recipientRoutingNumber: "021000021", swiftCode: "CHASUS33", bankAddress: "383 Madison Ave, New York, NY 10179", memo: "Invoice #INV-GCD-6341", purpose: "Equipment purchase", referenceNumber: "WT-20240408-001", createdAt: new Date("2024-04-08T07:22:00.000Z") },
        { type: "wire_transfer", amount: "328500.00", description: "Wire payment for Subsea Manifold Assembly - INV-7821", status: "approved", recipientName: "Abyssal Dynamics Inc.", recipientBank: "Pacific Maritime Bank", recipientAccount: "4001122334", recipientRoutingNumber: "122000496", swiftCode: "PAMBUS4S", bankAddress: "1200 Harbor Blvd, Long Beach, CA 90802", memo: "Subsea equipment procurement", purpose: "Capital equipment", referenceNumber: "WT-20240510-002", createdAt: new Date("2024-05-10T14:30:00.000Z") },
        { type: "external_transfer", amount: "156750.00", description: "Transfer for High-Pressure Drilling Mud Pump - PO-8103", status: "approved", recipientName: "Texas Oilfield Supply Corp.", recipientBank: "Bank of America", recipientAccount: "5023891764", recipientRoutingNumber: "111000025", swiftCode: "BOFAUS3N", bankAddress: "100 N Tryon St, Charlotte, NC 28255", memo: "Drilling equipment order", referenceNumber: "ET-20240603-003", createdAt: new Date("2024-06-03T16:45:00.000Z") },
        { type: "wire_transfer", amount: "287350.00", description: "Wire for Offshore Christmas Tree Valve Assembly - PO-9415", status: "approved", recipientName: "Lone Star Petroleum Equipment", recipientBank: "Frost Bank", recipientAccount: "6034718290", recipientRoutingNumber: "114000093", swiftCode: "FRSTUS44", bankAddress: "100 W Houston St, San Antonio, TX 78205", memo: "Valve assembly procurement", purpose: "Equipment purchase", referenceNumber: "WT-20240819-004", createdAt: new Date("2024-08-19T08:10:00.000Z") },
        { type: "external_transfer", amount: "92800.00", description: "Transfer for PDC Drill Bit Set 12-1/4 inch - PO-1124", status: "approved", recipientName: "Oklahoma Drill Technologies", recipientBank: "BOK Financial", recipientAccount: "2047381956", recipientRoutingNumber: "103900036", swiftCode: "BOKFUS41", bankAddress: "Bank of Oklahoma Tower, Tulsa, OK 74172", memo: "Drill bit order", referenceNumber: "ET-20240928-005", createdAt: new Date("2024-09-28T10:20:00.000Z") },
        { type: "wire_transfer", amount: "463500.00", description: "Wire for Topside Separation Module - PO-1298", status: "approved", recipientName: "Midland Energy Systems Inc.", recipientBank: "Comerica Bank", recipientAccount: "9182730465", recipientRoutingNumber: "072000096", swiftCode: "MNBDUS33", bankAddress: "1717 Main St, Dallas, TX 75201", memo: "Separation module procurement", purpose: "Capital equipment", referenceNumber: "WT-20241014-006", createdAt: new Date("2024-10-14T17:05:00.000Z") },
        { type: "wire_transfer", amount: "679500.00", description: "Wire for FPSO Turret Mooring Assembly - PO-1510", status: "approved", recipientName: "Houston Subsea Engineering", recipientBank: "Zions Bank", recipientAccount: "7429061538", recipientRoutingNumber: "124000054", swiftCode: "ZFNBUS55", bankAddress: "1 S Main St, Salt Lake City, UT 84133", memo: "Turret mooring system", purpose: "Major equipment", referenceNumber: "WT-20241122-007", createdAt: new Date("2024-11-22T08:00:00.000Z") },
        { type: "external_transfer", amount: "312000.00", description: "Transfer for Coiled Tubing Unit with BHA - PO-1780", status: "approved", recipientName: "Panhandle Drilling Equipment LLC", recipientBank: "BBVA USA", recipientAccount: "8173024596", recipientRoutingNumber: "062001186", swiftCode: "BBVAUS44", bankAddress: "1500 Solano Ave, Albany, CA 94707", memo: "Coiled tubing unit purchase", referenceNumber: "ET-20250108-008", createdAt: new Date("2025-01-08T15:30:00.000Z") },
        { type: "wire_transfer", amount: "187400.00", description: "Wire for Mud Logging Sensor Array System - PO-2010", status: "approved", recipientName: "Tulsa Well Services Inc.", recipientBank: "Arvest Bank", recipientAccount: "5180394726", recipientRoutingNumber: "082000549", swiftCode: "ARVTUS44", bankAddress: "1 W 4th St, Tulsa, OK 74103", memo: "Sensor array procurement", purpose: "Equipment purchase", referenceNumber: "WT-20250312-009", createdAt: new Date("2025-03-12T16:45:00.000Z") },
        { type: "external_transfer", amount: "128900.00", description: "Transfer for Tri-Cone Roller Bit Assembly - PO-2445", status: "approved", recipientName: "North Dakota Oilfield Supplies", recipientBank: "Gate City Bank", recipientAccount: "7301824596", recipientRoutingNumber: "091407429", swiftCode: "GTCTUS41", bankAddress: "500 2nd Ave N, Fargo, ND 58102", memo: "Roller bit order", referenceNumber: "ET-20250721-010", createdAt: new Date("2025-07-21T08:50:00.000Z") },
        { type: "wire_transfer", amount: "534000.00", description: "Wire for Riser Tensioning System - PO-2930", status: "approved", recipientName: "Odessa Production Equipment Co.", recipientBank: "WestStar Bank", recipientAccount: "6183029475", recipientRoutingNumber: "112200407", swiftCode: "WSTRUS41", bankAddress: "500 N Grant Ave, Odessa, TX 79761", memo: "Riser tensioning system", purpose: "Capital equipment", referenceNumber: "WT-20251103-011", createdAt: new Date("2025-11-03T14:20:00.000Z") },
        { type: "wire_transfer", amount: "275800.00", description: "Wire for Mud Circulation System Upgrade - PO-3205", status: "approved", recipientName: "Corpus Christi Marine Systems", recipientBank: "Prosperity Bank", recipientAccount: "8214063597", recipientRoutingNumber: "113122655", swiftCode: "PRSPUS44", bankAddress: "4295 San Felipe, Houston, TX 77027", memo: "Circulation system upgrade", purpose: "System upgrade", referenceNumber: "WT-20260205-012", createdAt: new Date("2026-02-05T10:30:00.000Z") },
        { type: "wire_transfer", amount: "892000.00", description: "Wire for Deepwater Drilling Riser Package - PO-3380", status: "processing", recipientName: "Petrobras Equipment Solutions", recipientBank: "Citibank N.A.", recipientAccount: "4829105736", recipientRoutingNumber: "021000089", swiftCode: "CITIUS33", bankAddress: "388 Greenwich St, New York, NY 10013", memo: "Deepwater riser package", purpose: "Major capital equipment", referenceNumber: "WT-20260210-013", createdAt: new Date("2026-02-10T09:15:00.000Z") },
        { type: "external_transfer", amount: "165400.00", description: "Transfer for Wellhead Pressure Control Equipment - PO-3412", status: "processing", recipientName: "Appalachian Energy Equipment", recipientBank: "PNC Bank", recipientAccount: "3918274605", recipientRoutingNumber: "043000096", swiftCode: "PNCCUS33", bankAddress: "The Tower at PNC Plaza, Pittsburgh, PA 15222", memo: "Pressure control equipment", referenceNumber: "ET-20260212-014", createdAt: new Date("2026-02-12T11:40:00.000Z") },
        { type: "wire_transfer", amount: "1250000.00", description: "Wire for Semi-Submersible Platform Components - PO-3500", status: "pending", recipientName: "Nordic Offshore Manufacturing AS", recipientBank: "DNB ASA", recipientAccount: "NO9386011117947", recipientRoutingNumber: "N/A", swiftCode: "DNBANOKKXXX", bankAddress: "Dronning Eufemias gate 30, 0191 Oslo, Norway", memo: "Platform components international", purpose: "International equipment purchase", referenceNumber: "WT-20260214-015", wireType: "international", beneficiaryCountry: "Norway", createdAt: new Date("2026-02-14T08:00:00.000Z") },
        { type: "external_transfer", amount: "78500.00", description: "Transfer for Safety Valve Actuator Set - PO-3515", status: "pending", recipientName: "Permian Basin Safety Systems", recipientBank: "First Financial Bank", recipientAccount: "5601938274", recipientRoutingNumber: "111907700", swiftCode: "FFBKUS41", bankAddress: "400 Pine St, Abilene, TX 79601", memo: "Safety valve actuators", referenceNumber: "ET-20260215-016", createdAt: new Date("2026-02-15T14:25:00.000Z") },
        { type: "wire_transfer", amount: "345000.00", description: "Wire for Subsea BOP Control System - PO-3528", status: "pending", recipientName: "Cameron International Corp.", recipientBank: "HSBC Bank USA", recipientAccount: "6472910385", recipientRoutingNumber: "022000020", swiftCode: "MRMDUS33", bankAddress: "452 Fifth Ave, New York, NY 10018", memo: "BOP control system procurement", purpose: "Safety equipment", referenceNumber: "WT-20260216-017", createdAt: new Date("2026-02-16T10:00:00.000Z") },
        { type: "internal_transfer", amount: "50000.00", description: "Internal transfer to Operating Account for field expenses", status: "approved", internalToAccount: "****7823", memo: "Monthly operating fund allocation", referenceNumber: "IT-20260201-018", createdAt: new Date("2026-02-01T09:00:00.000Z") },
        { type: "internal_transfer", amount: "25000.00", description: "Internal transfer to Payroll Account for contractor payments", status: "approved", internalToAccount: "****4091", memo: "Contractor payroll February 2026", referenceNumber: "IT-20260210-019", createdAt: new Date("2026-02-10T08:30:00.000Z") },
      ];

      for (const t of transferData) {
        await db.insert(transfers).values({
          customerId: custId,
          type: t.type,
          amount: t.amount,
          description: t.description,
          status: t.status,
          recipientName: t.recipientName || null,
          recipientBank: t.recipientBank || null,
          recipientAccount: t.recipientAccount || null,
          recipientRoutingNumber: t.recipientRoutingNumber || null,
          swiftCode: t.swiftCode || null,
          bankAddress: t.bankAddress || null,
          memo: t.memo || null,
          internalToAccount: t.internalToAccount || null,
          wireType: (t as any).wireType || null,
          beneficiaryCountry: (t as any).beneficiaryCountry || null,
          purpose: t.purpose || null,
          referenceNumber: t.referenceNumber || null,
          createdAt: t.createdAt,
          updatedAt: t.createdAt,
        });
      }

      console.log(`[admin] Created full user: ${firstName} ${lastName} (ID: ${custId}) with 22 transactions, 19 transfers`);

      return res.status(201).json({
        customer: newCustomer,
        transactionsCreated: 22,
        transfersCreated: 19,
      });
    } catch (error: any) {
      console.error("[admin] Create full user error:", error);
      return res.status(400).json({ message: error.message || "Failed to create user with history" });
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
  try {
    const existing = await storage.getAdminByUsername("admin@cavenwealthfinancial.com");
    if (!existing) {
      await storage.createAdmin({ username: "admin@cavenwealthfinancial.com", password: "Adminproject2026!" });
      console.log("Default admin created");
    }
  } catch (error) {
    console.log("Admin seeding will be attempted after DB push");
  }

  try {
    const { seedJeffreyAnderson } = await import("./seed-jeffrey");
    await seedJeffreyAnderson();
  } catch (error) {
    console.log("Jeffrey Anderson seeding error:", error);
  }

  try {
    const { seedFredrickAnderson } = await import("./seed-fredrick");
    await seedFredrickAnderson();
  } catch (error) {
    console.log("Fredrick Anderson seeding error:", error);
  }
}
