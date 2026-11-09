import express from "express";
import session from "express-session";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import * as schema from "../shared/schema";
import { createAdminAccess } from "../server/admin-auth";
import { createAdminMiddleware, registerAdminAuthRoutes } from "../server/admin-auth-routes";

// Dedicated development-only schema and server. Never rotate the real administrator in tests.
export async function adminAuthFixture() {
  if (process.env.NODE_ENV === "production") throw new Error("Authentication fixtures are development-only");
  const namespace = `auth_test_${randomUUID().replace(/-/g, "")}`;
  const root = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await root.query(`CREATE SCHEMA ${namespace}`);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${namespace},public`, max: 4 });
  try {
    for (const table of ["admins", "audit_logs"]) {
      await root.query(`CREATE TABLE ${namespace}.${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
        CREATE SEQUENCE ${namespace}.${table}_id_seq;
        ALTER TABLE ${namespace}.${table} ALTER COLUMN id SET DEFAULT nextval('${namespace}.${table}_id_seq');
        ALTER TABLE ${namespace}.${table} ADD PRIMARY KEY (id);`);
    }
    await root.query(`ALTER TABLE ${namespace}.admins ADD UNIQUE (username)`);
    const database = drizzle(pool, { schema });
    let clock = new Date();
    const username = "fixture-admin";
    const password = "Fixture-initial-password-42!";
    const answer = "fixture-only-answer";
    const access = createAdminAccess({ database, username: () => username, hashCost: 4, now: () => clock });
    await access.initialize({ password, answer });
    const app = express();
    app.use(express.json());
    app.use(session({ secret: randomBytes(32).toString("hex"), resave: false, saveUninitialized: false }));
    registerAdminAuthRoutes(app, access);
    app.get("/api/admin/me", createAdminMiddleware(access), (req, res) => res.json({ id: (req.session as any).adminId, username }));
    app.get("/api/protected-fixture", createAdminMiddleware(access), (_req, res) => res.json({ authorized: true }));
    app.use("/api", (_req, res) => res.status(404).json({ message: "Fixture route not found" }));
    app.use(express.static(resolve("dist/public")));
    app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/public/index.html")));
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const port = (server.address() as { port: number }).port;
    return {
      access, database, pool, username, password, answer, base: `http://127.0.0.1:${port}`,
      advance(ms: number) { clock = new Date(clock.getTime() + ms); },
      async close() {
        await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        await pool.end();
        await root.query(`DROP SCHEMA ${namespace} CASCADE`);
        await root.end();
      },
    };
  } catch (error) {
    await pool.end();
    await root.query(`DROP SCHEMA ${namespace} CASCADE`);
    await root.end();
    throw error;
  }
}

export function fixtureClient(base: string) {
  let cookie = "";
  return {
    async request(path: string, body?: unknown, headers: Record<string, string> = {}) {
      const response = await fetch(base + path, {
        method: body === undefined ? "GET" : "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie, ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const nextCookie = response.headers.get("set-cookie");
      if (nextCookie) cookie = nextCookie.split(";")[0];
      return { status: response.status, body: await response.json() };
    },
  };
}
