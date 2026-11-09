# Replit Agent Guide

## Overview

This is **Caven Wealth & Finance**, an internal-ledger financial application. It provides a public website, customer portal, and admin dashboard. The user requires the backend database to be the authoritative ledger for account creation, deposits, withdrawals, transfers, histories, and balance changes. There is no external settlement provider connected: activity must be clearly labeled Internal or Pending, never represented as provider-verified funds.

## Running and verifying

- Install the declared npm dependencies, apply the development schema with `npm run db:push`, and run the existing `Start application` workflow (`npm run dev`, port 5000).
- Required secrets: `SESSION_SECRET`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD`. The database supplies `DATABASE_URL`. Never add credential values to source files or logs.
- Admin credentials bootstrap the matching admin account only when it does not already exist. They do not silently overwrite an existing database password.
- New accounts have no generated sample transactions or transfers. An optional opening amount is an audited Internal credit, and a customer-specific login code is assigned for 10 minutes.
- New customer account numbers are unique 12-digit identifiers, separate from the institution's reserved reference. Preserve existing identifiers. Customer-facing opening labels use the institution name; actual operators remain recorded in audit logs. Legacy label normalization is display-only, never a rewrite of posted records.
- Customer summaries must use recorded ledger entries only. Do not add preset investment positions, returns, yields, risk scores, advisor messages, or simulated live-market information.
- Ledger amounts use exact cents. Posted entries are immutable; corrections use referenced offsetting entries. Accounts with ledger or transfer history cannot be deleted.
- Future calendar dates remain Pending until their day arrives in `America/New_York`. Settlement runs every minute and on ledger/account reads, catches up after downtime, and posts each entry once. Insufficient-funds scheduled debits fail without reducing the balance.
- `npm run check`, `npm run test:ledger`, and `npm run build` check code, money/date rules, and production bundling.
- Post-merge setup restores locked dependencies, checks TypeScript, and rebuilds the app. It does not automatically approve schema changes or seed ledger data; database changes require separate review.
- `npm run verify:ledger` exercises the running development preview with temporary test accounts and removes their records afterward. It uses admin secrets without displaying them and checks authenticated zero/opening-balance dashboards in Chromium (`CHROMIUM_PATH` can override the executable). Test screenshots go to ignored `generated-artifacts/`.
- Production schema changes for Replit-managed PostgreSQL are applied by Publish, not by startup code or deployment build hooks.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (React + Vite)
- **Framework**: React with TypeScript, bundled by Vite
- **Routing**: Uses `wouter` (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state, with a centralized `queryClient`
- **UI Components**: shadcn/ui component library (New York style) built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Page Structure
- **Public pages**: Home (`/`), Operations, Company, Careers, Contact — all wrapped in `PublicLayout`
- **Customer Portal** (`/portal`): Login + full customer dashboard (account info, transactions, transfers, chat)
- **Admin Panel** (`/admin/*`): Login, then dashboard pages wrapped in `AdminLayout` with sidebar navigation
  - Overview, Customers, Transactions, Pending Transfers, External Transfers, Account Applications, Access Codes, Live Chat

### Backend (Express + Node.js)
- **Runtime**: Node.js with TypeScript (via `tsx`)
- **Framework**: Express.js with a custom HTTP server
- **API Pattern**: RESTful JSON API under `/api/*` prefix
- **Session Management**: `express-session` with `connect-pg-simple` for PostgreSQL-backed sessions
- **Authentication**: Two separate auth systems:
  1. **Admin auth**: Username/password with bcryptjs, session-based (`/api/admin/login`, `/api/admin/logout`)
  2. **Customer auth**: Username/password with bcryptjs, session-based (`/api/customer/login`)
  3. **Replit Auth integration**: OpenID Connect via Replit (exists in `server/replit_integrations/auth/` but appears secondary)
- **Development**: Vite dev server middleware with HMR
- **Production**: Static file serving from `dist/public`

### Database (PostgreSQL + Drizzle ORM)
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema location**: `shared/schema.ts` (main app schema) and `shared/models/auth.ts` (Replit auth tables)
- **Schema push**: `npm run db:push` (uses `drizzle-kit push`)
- **Connection**: `DATABASE_URL` environment variable required, uses `pg.Pool`

### Key Database Tables
- `admins` — admin users (username, hashed password)
- `customers` — banking customers (personal info, account number, routing number, balance, card flags)
- `transactions` — financial transactions linked to customers
- `transfers` — fund transfers with status tracking (pending/approved/rejected)
- `accessCodes` — generated access codes with expiration
- `chatMessages` — customer-admin messaging
- `sessions` — express-session storage
- `users` — Replit Auth user storage

### Storage Layer
- `server/storage.ts` defines an `IStorage` interface with a PostgreSQL implementation
- All database operations go through this storage abstraction
- Includes methods for CRUD on all entities, password validation, and access code management

### Build System
- **Development**: `npm run dev` — runs `tsx server/index.ts` with Vite middleware
- **Production build**: `npm run build` — Vite builds the client, esbuild bundles the server
- **Server bundle**: esbuild with selective dependency bundling (allowlist pattern to reduce cold start times)
- **Output**: `dist/index.cjs` (server) and `dist/public/` (client assets)

## External Dependencies

### Database
- **PostgreSQL** — primary data store, required via `DATABASE_URL` environment variable

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required)
- `SESSION_SECRET` — Required session encryption key
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — Secure first-time admin account initialization
- `ISSUER_URL` — Replit OIDC issuer (optional, for Replit Auth)
- `REPL_ID` — Replit environment identifier (auto-set by Replit)

### Key NPM Packages
- **Server**: express, drizzle-orm, pg, bcryptjs, express-session, connect-pg-simple, passport (for Replit Auth)
- **Client**: react, wouter, @tanstack/react-query, shadcn/ui (Radix primitives), tailwindcss, date-fns, recharts
- **Build**: vite, esbuild (via script/build.ts), tsx

### Third-Party Services
- **Replit Auth** (OpenID Connect) — optional authentication integration in `server/replit_integrations/`
- **Google Fonts** — DM Sans, Fira Code, Geist Mono, Architects Daughter