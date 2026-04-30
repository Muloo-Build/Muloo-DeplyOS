# DeployOS — Production Hardening (Codex Prompt)

> **Codex role:** Senior backend / platform engineer. The product is shippable to existing clients. To put it in front of new clients and partners safely, you need the items below. Each one is a small production-hardening contract. Treat them as non-negotiable for an enterprise pilot.

## Context check

The audit (17 April) flagged these gaps. Some have moved (rate limiter exists, Zod is used in places, AuditLog model exists). Most have not. This prompt is about completing the picture.

Confirmed in code:
- Zod imported in `apps/api/src/{retainerLedger.ts, billing.ts, server.ts, app.ts}`. Coverage is partial.
- Rate limiter wired in `apps/api/src/app.ts:813` (`authLimiter`, `apiLimiter`). Coverage probably partial.
- `AuditLog` model exists at `schema.prisma:947`. Underused (see Project Flow Improvements).

## Out of scope

- Time tracking MVP (separate sprint).
- Xero invoice pipeline (separate sprint, integration-focused).
- Tooling for AI cost telemetry (Run detail drill-in is its own thing).

---

## Hardening 1 — Zod validation across all mutating routes

**Pattern:** every `POST/PUT/PATCH/DELETE` handler validates the request body against a Zod schema. Failures return 400 with a structured error.

**Audit step:**
```bash
grep -nE "app\.(post|put|patch|delete)" apps/api/src/app.ts \
  | wc -l   # total mutating routes
grep -nE "app\.(post|put|patch|delete)" apps/api/src/app.ts \
  | head -300 > /tmp/mutating-routes.txt
```

For each route, confirm Zod parsing of the body. Where missing, add. Centralise common schemas (`ClientId`, `ProjectId`, pagination cursors) in `apps/api/src/schemas/`.

**Error contract:**
```ts
if (!parsed.success) {
  return c.json({
    error: "Validation failed",
    fields: parsed.error.flatten().fieldErrors,
  }, 400);
}
```

**Acceptance**
- 100% of mutating routes have Zod validation.
- Frontend can render field-level errors using the `fields` payload.
- Test: posting an invalid body to any mutating route returns 400 with field paths.

---

## Hardening 2 — Rate limiter coverage

**Currently:** `authLimiter` and `apiLimiter` exist. Cover everything?

**Audit:** confirm `apiLimiter` wraps all `/api/*` routes via Hono middleware, not per-route. If per-route, rip the per-route applications and replace with one middleware mounted at `app.use("/api/*", apiLimiter)`.

**Tighter limits for sensitive endpoints:**
- Auth (`/api/auth/*`): 5 attempts per 15 min per IP — use `authLimiter`.
- Quote-send and approval: 30 per hour per user. Prevents accidental email bombs.
- AI agent execution endpoints: separate `aiLimiter` at 100 per hour per user. Cost protection.
- Public share-link endpoints: 200 per hour per IP.

**Acceptance**
- Hammering any auth endpoint with 6 requests in 60s returns 429.
- Hitting AI execute repeatedly is throttled.
- Limits are configurable via env (`RATE_LIMIT_API`, `RATE_LIMIT_AUTH`, `RATE_LIMIT_AI`).

---

## Hardening 3 — Error boundaries on the web app

**Currently:** No `error.tsx` boundaries detected in `apps/web/app/`.

**Implementation (Next.js 14 App Router pattern):**

```tsx
// apps/web/app/error.tsx
"use client";
import { Button } from "./components/ui/Button";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background-primary text-white">
      <h1 className="text-xl font-semibold">Something went wrong.</h1>
      <p className="max-w-md text-center text-sm text-white/60">
        We've logged it. Try again, or head back to your Command Centre.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="ghost" onClick={() => (window.location.href = "/command-centre")}>
          Back to Command Centre
        </Button>
      </div>
    </div>
  );
}
```

Add per-route error boundaries for the high-traffic surfaces:
- `apps/web/app/projects/[id]/error.tsx`
- `apps/web/app/quotes/error.tsx`
- `apps/web/app/client/error.tsx`

Each scoped boundary logs to a `/api/client-error` endpoint with the error stack + page URL + user id.

**Acceptance**
- Throwing an error in any route shows the friendly boundary, not a Next.js stack.
- Errors land in a backend log table (`ClientErrorLog` model — add it: id, message, stack, url, userId, createdAt).

---

## Hardening 4 — Search across primary entities

**Comparator:** Linear's Cmd+K, HubSpot's global search, Notion's search. The product is at the size where search is starting to hurt.

**Approach:**
- New endpoint `GET /api/search?q=...&types=client,project,quote,retainer,invoice,task`.
- Backed by a Postgres full-text index. For each searchable model, add a `searchVector` generated column or a trigger-maintained tsvector.

**Schema migration:**
```sql
ALTER TABLE "Project" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
  ) STORED;
CREATE INDEX project_search_idx ON "Project" USING GIN ("searchVector");
```

Repeat for `Client`, `ProjectQuote`, `Retainer`, `Invoice`, `Task`, `ClientContact`.

**UI:**
- Cmd+K palette mounted at the AppShell level. Lists results grouped by type, click jumps to the relevant page.
- Operator side: full power. Client portal: limited to the client's own visible entities.

**Acceptance**
- `Cmd+K → "magn"` returns Magnisol client + their active project + recent quote in under 200ms.
- Search respects access control — clients can't search across other clients.

---

## Hardening 5 — Export endpoints

**Why:** Operators want CSV/Excel exports for any list. Today they screenshot or copy-paste.

**Pattern:** add a `format=csv` (and `format=xlsx` later) query param to existing list endpoints.

**Endpoints to support:**
- `GET /api/projects?format=csv`
- `GET /api/quotes?format=csv`
- `GET /api/clients?format=csv`
- `GET /api/invoices?format=csv`
- `GET /api/retainers/:id/ledger?format=csv` (this one matters for accounting hand-off)
- `GET /api/runs?format=csv`

Each exports the columns currently visible in the UI list.

**UI:** every list page header gets a small "Export" dropdown (CSV / XLSX coming).

**Acceptance**
- Clicking Export downloads a CSV with the same rows as the on-screen list, respecting filters.
- Date columns formatted ISO-8601, currency columns formatted with currency code + value.

---

## Hardening 6 — Audit log everywhere

This cross-cuts with `DeployOS_ProjectFlow_Improvements_Prompt.md` Improvement 4 (Activity log). Same underlying `AuditLog` model.

**Production-grade requirements specifically for hardening:**
- Every authentication event (login, logout, failed login, password change attempt) writes an `AuditLog` row.
- Every settings change (workspace settings, AI routing, integrations connect/disconnect) writes one.
- Every team-member role change writes one.
- Every export (Hardening 5) writes one with row count.

**Storage protection:** never delete `AuditLog` rows. Add a retention policy at 18 months — hard archive (move to `AuditLogArchive` table or cold storage) but never silently destroy.

**Admin view:** new `/operations/audit` page. Filterable by entity type, actor, date range. CSV export (uses Hardening 5 pattern).

**Acceptance**
- A scripted audit of "today's activity" returns rows for every meaningful platform event.
- Audit log is immutable from the application layer (no UPDATE or DELETE routes for it).

---

## Hardening 7 — RBAC (proper roles)

**Currently:** `WorkspaceUser` exists; team settings allowed admin to set passwords (which the audit flagged); role granularity is light.

**Roles to define:**
- `OWNER` (Jarrud) — everything.
- `ADMIN` — everything except billing settings, owner promotion, workspace deletion.
- `OPERATOR` — full delivery (projects, tasks, agents, quotes, retainers); read-only on settings.
- `BILLING` — invoices, retainers, financials; no delivery edit.
- `PARTNER` — limited to assigned clients via `PartnerClientVisibility`.
- `CLIENT` — `ClientPortalUser` already covers this; documented for completeness.

**Schema:**
```prisma
enum WorkspaceRole {
  OWNER
  ADMIN
  OPERATOR
  BILLING
  PARTNER
}

model WorkspaceUser {
  // ...
  role WorkspaceRole @default(OPERATOR)
}
```

Migrate existing rows to OPERATOR (or ADMIN where currently elevated).

**Enforcement:** middleware reads `user.role` from session, maps to permission set, gates routes. Use a single `requireRole(role)` or `requirePermission(perm)` helper. Don't sprinkle role checks through handlers — centralise.

**Email-invite flow** (replaces admin-set-password):
- `POST /api/team/invite` creates a `WorkspaceInvite` with token + email + role.
- Email sent to invitee.
- Invitee accepts at `/invite/:token`, sets their own password, is added to workspace with the invited role.
- Invite expires in 7 days.

**Acceptance**
- An OPERATOR cannot access billing settings.
- A BILLING user cannot edit project tasks.
- Admins can no longer set another user's password directly.
- Invite flow tested end-to-end.

---

## Hardening 8 — Logging, metrics, and alerting

**Currently:** server logs to stdout. No structured logging, no metrics, no alerts.

**Implementation:**
1. **Structured logging:** add `pino` (or `winston`). Log every request with `traceId`, `userId`, `route`, `status`, `durationMs`. Log errors with stack + payload (redact secrets).
2. **Metrics:** expose `/metrics` Prometheus endpoint. Counters: HTTP requests by status code, AI runs by status, errors by type. Histograms: HTTP duration, AI run duration.
3. **Alerts:** wire to a free-tier service (Better Stack, Sentry, or Logtail). At minimum, alert on:
   - 5xx error rate > 1% over 5 min.
   - Any auth burst (already rate-limited but log it for visibility).
   - AI cost daily threshold (configurable via env).

**Acceptance**
- Hitting any endpoint produces a structured log line with traceId.
- A forced 500 triggers an alert in the chosen service.

---

## Hardening 9 — Backups and migrations safety

**Currently:** Prisma migrations exist, no documented backup/restore.

**Approach:**
1. Document the production database backup cadence (daily snapshot + WAL).
2. Add a `pnpm db:backup` script for ad-hoc dump.
3. Migration safety: any migration touching a high-write table (`Task`, `WorkflowRun`, `AuditLog`) gets a comment header `-- @safe-for-prod` after manual review. CI fails if a migration on those tables doesn't have the header.

**Acceptance**
- A documented runbook at `docs/ops/backup-and-restore.md`.
- CI pipeline rejects unreviewed migrations on hot tables.

---

## Hardening 10 — Secrets and env hygiene

**Audit:**
```bash
grep -rn "process.env\." apps/api/src --include="*.ts" | head -50
```
Confirm every secret is in `.env.example`, never hard-coded.

**Add:**
- Startup-time env validation using Zod. App refuses to boot with missing required env vars.
- A `printSafeConfig()` helper that logs the active config at startup with secrets redacted.

**Acceptance**
- Booting with a missing `DATABASE_URL` fails fast with a clear error.
- No secrets in source.

---

## Sequencing

Order of attack — do them in this order, each is a self-contained PR:

1. **Zod validation sweep** (foundational; blocks bad input early).
2. **Error boundaries** (small, high-visibility).
3. **Audit log everywhere** (foundational for trust + compliance).
4. **RBAC + invite flow** (security gate for new clients/partners).
5. **Logging/metrics/alerts** (operational visibility before scaling).
6. **Rate-limit coverage tightening** (already partial).
7. **Search** (medium effort, high operator value).
8. **Export endpoints** (small, broad use).
9. **Backups + migration safety** (ops runbook).
10. **Env hygiene** (small clean-up).

## Final acceptance gate

A new partner can be onboarded with:
- An invite link, not an admin-set password.
- Confidence that they can't see other clients' data.
- Search to find any of their assigned items quickly.
- A status URL they can share without exposing the operator UI.
- Clear error messages when something goes wrong, not raw stacks.

If all of the above is true, DeployOS is enterprise-pilot ready.
