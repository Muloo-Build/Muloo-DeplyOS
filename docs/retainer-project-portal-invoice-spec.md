# Deploy OS — Retainer, Project, Portal & Invoice Spec

Session: 23 April 2026
Driver: Transnova retainer setup exposed gaps in Retainer, Project, Quote, and Client Portal flows.

---

## Hand-off status (read first)

### Phase 0 — IN WORKING TREE (uncommitted)

Schema, migration, API, and UI for **workspace-level HubSpot partner invite** and **retainer scope fields** were written in this session but are still in the uncommitted working tree. `git status` will show them as modified. Commit before executing later phases.

**Files changed:**
- `apps/api/prisma/schema.prisma` — `Retainer.scopeSummary/deliverables/approvalTerms/requirements`, new `WorkspaceHubSpotSettings` model
- `apps/api/prisma/migrations/20260423110000_add_retainer_scope_and_hubspot_settings/migration.sql`
- `apps/api/src/app.ts` — routes at lines 895, 3710, 3716
- `apps/api/src/server.ts` — handlers at lines 23044-23120
- `apps/web/app/components/WorkspaceSettings.tsx` — UI section at lines 1158-1227

**To activate:**
```
cd apps/api
pnpm db:generate
pnpm db:migrate
```

**Cleanup:** delete `apps/api/src/server.ts.bak` and `apps/api/src/server.ts.new` (subagent artifacts). Sandbox permissions blocked automatic removal.

### Decisions locked

1. Quote shows **single retainer line** + scope context, no broken-out deliverable pricing
2. Retainer fields (scope, deliverables, approvals, requirements) live on **Retainer**, not Project
3. Partner invite link is **workspace-level** (one link for all clients), stored on `WorkspaceHubSpotSettings`
4. No Xero API — invoices entered manually

---

## Phase 1 — Retainer scope fields (API + UI)

**Why first:** unlocks the Transnova quote.

### API

File: `apps/api/src/server.ts` + route registration in `apps/api/src/app.ts`

- Extend retainer create handler and retainer update handler to accept:
  - `scopeSummary: string | null`
  - `deliverables: Array<{ title: string; description?: string }> | null`
  - `approvalTerms: string | null`
  - `requirements: string | null`
- Validate: `deliverables` must be array of objects with non-empty `title`; all four fields optional
- Return fields in GET responses

Check `apps/api/src/retainers.ts` and wherever `prisma.retainer.create` / `prisma.retainer.update` is called from handlers; extend the payload mapping there.

### UI

Files:
- `apps/web/app/components/RetainerDetailWorkspace.tsx` — edit
- `apps/web/app/components/RetainersWorkspace.tsx` — create form

Add a "Scope & Terms" section below the commercial fields:
- Scope summary — textarea
- Deliverables — editable list (add/remove rows, each with `title` required + `description` optional)
- Requirements — textarea
- Approval terms — textarea

All optional so existing retainers aren't broken. Match existing card/section styling.

---

## Phase 2 — Project Edit retainer selector (UI only)

**API already exists:** `PATCH /api/projects/:projectId/retainer` at `apps/api/src/app.ts:2510`. Takes `{retainerId: string | null}` in body, validates retainer exists, updates `project.retainerId`. **Do not rebuild.**

Also need: endpoint to list retainers for a client. Verify existence; if absent, add `GET /api/clients/:clientId/retainers`.

### UI

File: `apps/web/app/components/ProjectEditWorkspace.tsx`

Add a "Retainer" section after "Engagement shape":
- Dropdown populated from `GET /api/clients/:clientId/retainers` (scoped to project's client)
- Show selected retainer's service line, block size, rate, term inline
- "Create new retainer" CTA that opens inline form (same fields as retainer create, pre-filled with client ID)
- "Remove link" button → `PATCH /api/projects/:projectId/retainer` with `{retainerId: null}`

---

## Phase 3 — Quote retainer line composition

**Why:** this is what Transnova will actually receive.

### Logic

Wherever `ProjectQuote` is composed (likely in server.ts quote handler or a dedicated file — grep for `projectQuote.create` and `phaseLines`):

- If `project.retainer` exists, auto-inject a single retainer line into the appropriate lines array (`productLines` or a dedicated `retainerLines` JSON field — check existing shape):
  - Label: `{serviceLine} retainer — {blockSize}h/month × {termMonths} months`
  - Amount: `blockSize × rate × termMonths` (termMonths derived from startDate → endDate or defaulted)
  - Currency: from retainer
- Scope context blocks (non-priced) pulled from retainer: requirements, deliverables, approvalTerms
- These context blocks live in `context` JSON field on ProjectQuote (already exists on the model)

### UI

Files: look under `apps/web/app/project/[id]/quote/` and quote-rendering components

- Display retainer line distinct from fixed-scope lines (icon or subtle label)
- Quote preview shows scope context above pricing

---

## Phase 4 — Client portal HubSpot Connect card

**Why:** clients self-serve the partner invite instead of email ping-pong.

### API

Add public-safe endpoint (auth = client portal user session, not internal auth):

`GET /api/client-portal/hubspot-invite` → `{ partnerInviteUrl: string | null, connected: boolean, portalId: string | null }`

Returns partnerInviteUrl from `WorkspaceHubSpotSettings` singleton + the authenticated client's `hubSpotPortalId` + connection status. Do NOT return `partnerAccountId` or `notes`.

### UI

Files: `apps/web/app/client/page.tsx` and its child components.

On mount, fetch endpoint. If `connected === false` and `partnerInviteUrl` is set:
- Render card: "Connect your HubSpot"
- Body: "This lets Muloo audit your portal and run the work you approved. A HubSpot Super Admin from your team needs to click the link. Takes about 10 seconds."
- Button: external link to `partnerInviteUrl` (new tab, `rel="noopener"`)

If `connected === true`: hide or show "✓ HubSpot connected — Portal ID {id}".

---

## Phase 5 — Client card invoices UI (UI only)

**All API already exists:**
- `GET /api/invoices` at `apps/api/src/app.ts:4434` (list, filter by clientId/retainerId/status)
- `POST /api/invoices` at `app.ts:4455` (create) → `createInvoiceRecord` in `apps/api/src/billing.ts:675`
- `GET /api/invoices/summary` at `app.ts:4477`
- `GET /api/invoices/:invoiceId` at `app.ts:4483`
- `PATCH /api/invoices/:invoiceId` at `app.ts:4492` → `updateInvoiceRecord` in `billing.ts:830`
- `listInvoices` domain function in `billing.ts:752`

**Do not rebuild any of the above.**

### UI

File: `apps/web/app/components/ClientsWorkspace.tsx` (expand client editor panel) or new `ClientInvoicesPanel.tsx` embedded in the editor.

- Table of existing invoices filtered by clientId (through bill-to/retainer joins):
  - Reference, Amount, Currency, Issue date, Due date, Status, Xero URL ("Open in Xero" button), Invoice type
- Manual entry form (POST /api/invoices):
  - Reference (required, unique)
  - Bill-to entity — dropdown scoped to client's billToEntities
  - Retainer — dropdown scoped to client's retainers
  - Invoice type — RETAINER_BLOCK / TOP_UP / OTHER
  - Amount, Currency
  - Issue date, Due date
  - Xero URL — paste field (no API sync)
  - Status — DRAFT / SENT / PAID / OVERDUE / VOID
  - Notes (optional)
- Edit row uses PATCH /api/invoices/:id
- Status chips: SENT blue, PAID green, OVERDUE red, DRAFT grey, VOID muted

---

## Transnova setup — do this in-app

Workaround steps until Phases 1–3 are shipped:

1. **Paste partner invite URL** (shipped in Phase 0):
   - Settings → Workspace → HubSpot Partner Invite
   - Paste: `https://app.hubspot.com/l/settings/users/partnerInviteLink/ODA2NjQxMz0xMTMzMTM1MA`
   - Save

2. **Create Transnova retainer** via `/retainers`:
   - Client: Transnova, Bill-to: Selected client (direct)
   - Service line: Consulting (R2,200 flat rate — enum value confirmed in `retainers.ts`)
   - Block size: 20 (or 15), Currency: ZAR
   - Start: 1 May 2026, Status: DRAFT
   - Term (3 months) → set endDate = 31 Jul 2026 after create if UI allows, otherwise revisit after Phase 1

3. **Link retainer to project** — until Phase 2 ships:
   ```sql
   UPDATE "Project"
   SET "retainerId" = '<retainer id>'
   WHERE id = 'cmobantsl000s2trg43jn5906';
   ```
   Or edit via Prisma Studio.

4. **Add discovery context** — paste Richard's email, meeting transcript, Stratitude agency brief, FYR dashboard link into Project Discovery Inputs.

5. **Compose quote manually** — until Phase 3 auto-composes:
   - Fixed lines: portal audit, reporting build, training
   - Retainer line: "Consulting retainer — 20h/month × 3 months @ R2,200/hr = R132,000"
   - Context: requirements + deliverables + approval terms (from Richard's email answers)

---

## Platform fix list — bloat & friction (non-blocking)

**Inconsistent:**
- Client card shows "0 contacts" but project sidebar shows client contact email. Contact link layer inconsistent between Client and Project
- Project shows "HubSpot: Transnova · needs reconnect" on client card but no CTA to fix. Phase 4 solves for client; add inline "Connect" button on client editor for operator view
- Retainer workspace currently creates retainers with no project link; after Phase 2 the /retainers view should become cross-project rollup only (no create)

**Bloat / unclear:**
- "Additional websites" on clients auto-enriches questionable URLs (e.g. maluti-x.com on Transnova). Require manual confirmation before adding enriched URLs
- "Include portal audit" checkbox on project edit — audit whether it actually gates anything; remove if dead
- Gmail watchlists showing "The label is live, but Gmail is not returning any messages for it yet" — noisy. Hide empty watchlists below a fold
- Command Centre "In delivery: 0" while "Live projects: 5" — audit status logic

**Missing:**
- No retainer term field (duration months or explicit endDate) in create flow — add in Phase 1
- Sophisticated `RolloverBucket` / 25% cap / 90-day expiry not exposed in UI — add defaults with override
- Client portal has no "hours burnt this month" view for retainers — valuable client-trust signal
