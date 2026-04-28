# Sprint 05: Security Hardening + Data Model Cleanup

**Status:** Ready for implementation
**Priority:** P1 — must complete before any client access
**Estimated effort:** 1–2 days
**Depends on:** Sprints 01–04
**Authored:** 26 Mar 2026

---

## Goal

Make the platform safe for real client access. Fix critical security issues, remove hardcoded credentials, hash passwords, add rate limiting, and resolve the file system vs Prisma data model split.

---

## Part 1: Password Hashing

### Problem
Passwords are stored plaintext in the database. This is a critical security issue.

### Fix

Install: `pnpm add bcrypt @types/bcrypt --filter @muloo/api`

In `apps/api/src/server.ts` and `apps/api/src/app.ts`, find all places that:
- Create a user with a password: hash it with `bcrypt.hash(password, 12)` before storing
- Verify a password on login: use `bcrypt.compare(inputPassword, storedHash)` instead of direct equality

```typescript
import bcrypt from 'bcrypt';

// On create/update password:
const hash = await bcrypt.hash(plainPassword, 12);
// Store hash, not plainPassword

// On login:
const valid = await bcrypt.compare(inputPassword, user.passwordHash);
if (!valid) return c.json({ error: 'Invalid credentials' }, 401);
```

Also: run a one-time migration to hash any existing plaintext passwords in the DB. Write a script at `scripts/hash-existing-passwords.ts` that reads all users, hashes their passwords, and updates the records.

---

## Part 2: Remove Hardcoded Credentials

### Problem
There is a simple auth fallback with hardcoded credentials (`jarrud/deployos`) in `app.ts`.

### Fix
Remove it entirely. If a backdoor is needed for development, gate it behind `NODE_ENV === 'development'` with a clear comment. Do not ship hardcoded credentials to production.

Search for and remove/replace:
- Any `username === 'jarrud'` or `password === 'deployos'` checks
- Any hardcoded API keys or tokens in source files (move to env vars)
- Any `console.log` statements that print tokens, session cookies, or user data

---

## Part 3: Rate Limiting

Install: `pnpm add @hono/rate-limiter --filter @muloo/api`
Or use: `pnpm add hono-rate-limiter --filter @muloo/api`

Apply rate limiting to sensitive endpoints in `apps/api/src/app.ts`:

```typescript
import { rateLimiter } from 'hono-rate-limiter';

// Auth endpoints — strict
const authLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  keyGenerator: (c) => c.req.header('x-forwarded-for') ?? 'unknown',
  message: 'Too many login attempts. Please try again later.',
});

app.use('/api/auth/*', authLimiter);
app.use('/api/client-auth/*', authLimiter);

// General API — generous
const apiLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 200,
  keyGenerator: (c) => c.req.header('x-forwarded-for') ?? 'unknown',
});

app.use('/api/*', apiLimiter);
```

---

## Part 4: Resolve File System vs Prisma Split

### Problem
The platform uses both Prisma (PostgreSQL) and a JSON file system for project data. `loadProjectById()` reads from files. This creates confusion about source of truth and makes the platform hard to deploy reliably.

### Fix
Make Prisma the single source of truth. Migrate file-backed data to the database.

**Step 1:** Audit what data is loaded from files.
- Read `packages/file-system/src/projects.ts` fully
- List every field that is loaded from the file system that is NOT in the Prisma `Project` model

**Step 2:** Add missing fields to the Prisma schema.
Common candidates:
```prisma
model Project {
  // Add any file-backed fields not already in schema:
  blueprintData     Json?   // was blueprint.json
  discoveryData     Json?   // was discovery.json
  standardsData     Json?   // was standards.json
}
```

**Step 3:** Write a migration script at `scripts/migrate-file-data-to-db.ts`:
```typescript
// For each project directory in /data/projects/:
//   Read blueprint.json, discovery.json, standards.json
//   Upsert into Prisma Project record
//   Log success/failure per project
```

**Step 4:** Update `loadProjectById()` in `packages/file-system/src/projects.ts` to read from Prisma first, falling back to file system with a deprecation warning.

**Step 5:** Remove file-write operations from the main execution path — writes should only go to Prisma.

---

## Part 5: Input Validation

Add Zod validation to all API endpoints that accept request bodies. The `packages/shared/src/domain.ts` already has Zod schemas — use them.

For any endpoint that currently does `const body = await c.req.json()` without validation:

```typescript
// Before:
const body = await c.req.json();
const { name, portalId } = body;

// After:
import { z } from 'zod';
const schema = z.object({ name: z.string().min(1), portalId: z.string() });
const result = schema.safeParse(await c.req.json());
if (!result.success) return c.json({ error: result.error.flatten() }, 400);
const { name, portalId } = result.data;
```

Prioritise these endpoints: auth, project create, client create, execution trigger, portal session register.

---

## Part 6: Audit Log

Add a simple audit log so every significant action is traceable.

### New Prisma model

```prisma
model AuditLog {
  id         String   @id @default(cuid())
  createdAt  DateTime @default(now())
  actor      String   // user email or 'system'
  action     String   // e.g. 'task.status_changed', 'execution.started', 'property.created'
  entityType String   // 'Task', 'ExecutionJob', 'Project', etc.
  entityId   String
  before     Json?    // state before change
  after      Json?    // state after change
  metadata   Json?    // extra context
}
```

Run migration: `pnpm prisma migrate dev --name add-audit-log`

Add a helper function:
```typescript
export async function audit(
  actor: string,
  action: string,
  entityType: string,
  entityId: string,
  opts?: { before?: object; after?: object; metadata?: object }
) {
  await prisma.auditLog.create({
    data: { actor, action, entityType, entityId, ...opts }
  });
}
```

Call `audit()` in: task status changes, execution job creation, property creation, user login/logout.

---

## PR Checklist

- [ ] `pnpm build` passes
- [ ] All passwords hashed with bcrypt — no plaintext in DB
- [ ] `scripts/hash-existing-passwords.ts` created and documented
- [ ] Hardcoded `jarrud/deployos` credentials removed from production paths
- [ ] Rate limiting applied to auth and general API routes
- [ ] File system vs Prisma audit completed — missing fields added to schema
- [ ] `scripts/migrate-file-data-to-db.ts` created
- [ ] `loadProjectById` reads from Prisma
- [ ] Zod validation on priority endpoints
- [ ] `AuditLog` model and `audit()` helper created
- [ ] `audit()` called on key actions
- [ ] No tokens or passwords logged to console
