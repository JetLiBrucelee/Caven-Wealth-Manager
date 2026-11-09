import type { Express, RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { AdminAuthError, type AdminAccess } from "./admin-auth";

export function createAdminMiddleware(access: AdminAccess): RequestHandler {
  return async (req, res, next) => {
    try {
      if (!await access.sessionValid(req.session as any)) {
        return res.status(401).json({ message: "Admin authentication required" });
      }
      return next();
    } catch {
      return res.status(503).json({ message: "Admin access is temporarily unavailable." });
    }
  };
}
const sameOrigin: RequestHandler = (req, res, next) => {
  const origin = req.get("origin");
  const host = req.get("x-forwarded-host") || req.get("host");
  try {
    if (req.get("sec-fetch-site") === "cross-site" || (origin && new URL(origin).host !== host)) {
      return res.status(403).json({ message: "This request is not allowed." });
    }
  } catch { return res.status(403).json({ message: "This request is not allowed." }); }
  next();
};
export function registerAdminAuthRoutes(app: Express, access: AdminAccess, requireAdmin = createAdminMiddleware(access)) {
  const recoveryLimit = rateLimit({
    windowMs: 15 * 60_000, limit: 5, standardHeaders: "draft-7", legacyHeaders: false,
    message: { message: "Too many recovery attempts. Try again in 15 minutes." },
  });
  const codeLimit = rateLimit({
    windowMs: 15 * 60_000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false,
    message: { message: "Too many verification attempts. Try again in 15 minutes." },
  });
  const errorResponse = (res: any, error: unknown) => res.status(error instanceof AdminAuthError ? error.status : 503)
    .json({ message: error instanceof AdminAuthError ? error.message : "Admin access is temporarily unavailable." });
  app.use("/api/admin", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  app.post("/api/admin/login", sameOrigin, async (req, res) => {
    try {
      const admin = await access.login(req.body?.username, req.body?.password);
      if (!admin) return res.status(401).json({ message: "Invalid credentials" });
      await new Promise<void>((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
      Object.assign(req.session, { isAdmin: true, adminId: admin.id, adminAuthVersion: admin.authVersion });
      return res.json({ id: admin.id, username: admin.username, needsRecoverySetup: !admin.recoveryCodeHash });
    } catch (error) { return errorResponse(res, error); }
  });
  app.post("/api/admin/logout", sameOrigin, (req, res) => {
    req.session.destroy((error) => error ? res.status(503).json({ message: "Could not sign out. Try again." }) : res.json({ message: "Logged out" }));
  });
  app.get("/api/admin/security", requireAdmin, async (_req, res) => {
    try { return res.json(await access.securityStatus()); } catch (error) { return errorResponse(res, error); }
  });
  app.post("/api/admin/security/recovery-code", sameOrigin, requireAdmin, codeLimit, async (req, res) => {
    try {
      return res.json(await access.issueRecoveryCode((req.session as any).adminId, req.body?.currentPassword, (req.session as any).adminAuthVersion));
    } catch (error) { return errorResponse(res, error); }
  });
  app.post("/api/admin/password-reset", sameOrigin, recoveryLimit, async (req, res) => {
    try { return res.json(await access.reset(req.body || {})); } catch (error) { return errorResponse(res, error); }
  });
}
