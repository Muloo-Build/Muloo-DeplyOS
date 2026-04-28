# Deploy OS — Retainer, Project, Portal & Invoice Spec

Session: 23 April 2026
Context: Transnova retainer setup exposed gaps in the Retainer, Project, Quote, and Client portal flows. This spec captures what's been built, what's left, and what order to build it in.

---

## Already shipped this session

### Schema

File: `apps/api/prisma/schema.prisma`

Added to `Retainer` model:
- `scopeSummary String?`
- `deliverables Json?`
- `approvalTerms String?`
- `requirements String?`

New singleton model: `WorkspaceHubSpotSettings`
- `id String @id @default("default")` (singleton key)
- `partnerInviteUrl String?`
- `partnerAccountId String?`
- `notes String?`

### Migration

File: `apps/api/prisma/migrations/20260423110000_add_retainer_scope_and_hubspot_settings/migration.sql`

Ready to run. Execute locally with:

```
cd apps/api
pnpm db:generate
pnpm db:migrate
```

### API: Workspace HubSpot Settings

Endpoints in `apps/api/src/app.ts` (routes) and `apps/api/src/server.ts` (handlers):
- `GET /api/workspace/hubspot-settings`
- `PUT /api/workspace/hubspot-settings`

Both wrapped by `internalAuth` middleware. Singleton seeded on first read.

### UI: Workspace HubSpot Settings

File: `apps/web/app/components/WorkspaceSettings.tsx`

New section "HubSpot Partner Invite" with:
- Partner invite URL input
- Partner account ID input
- Notes textarea
- Save button with status message

---

## What's left to build (priority order)

### Phase 1: Retainer scope fields (API + UI)

**Why first:** unlocks the Transnova quote. Without scope/deliverables on the retainer, the quote has nothing to reference.

**API changes** (`apps/api/src/server.ts` / `app.ts`):
- Extend retainer create/update handlers to accept: `scopeSummary`, `deliverables` (array of `{title, description}`), `approvalTerms`, `requirements`
- Validate `deliverables` as array of objects with `title` required
- Return these fields in retainer GET responses

**UI changes** (`apps/web/app/components/RetainerDetailWorkspace.tsx` and the retainer create form inside `RetainersWorkspace.tsx`):
- Add a "Scope & Terms" section below the commercial fields
  - Scope summary: textarea
  - Deliverables: editable list (add/remove rows, each with title + description)
  - Requirements: textarea (prerequisites like portal access, admin sign-off)
  - Approval terms: textarea (what needs sign-off, who approves, SLA)
- All four fields are optional so existing retainers aren't broken

### Phase 2: Project Edit retainer selector

**Why:** the Project ↔ Retainer link exists in schema (`Project.retainerId`) but no UI exposes it.

**UI changes** (`apps/web/app/components/ProjectEditWorkspace.tsx`):
- Add a "Retainer" section after "Engagement shape"
- Dropdown populated from `GET /api/clients/:clientId/retainers` (scoped to the project's client)
- Show selected retainer's service line, block size, rate, term inline
- "Create new retainer" CTA that opens an inline form (same fields as retainer create, pre-filled with client ID)
- "Remove link" to detach

**API changes:**
- Project PUT handler must accept `retainerId` (string | null)
- Add `GET /api/clients/:clientId/retainers` if it doesn't already exist

### Phase 3: Quote composition with retainer line

**Why:** this is what Transnova will actually receive.

**Logic** (in quote builder / wherever `ProjectQuote` is composed):
- If `project.retainer` exists, inject a single retainer line into `productLines` or `phaseLines` automatically:
  - Label: `{serviceLine} retainer — {blockSize}h/month × {termMonths} months`
  - Amount: `blockSize × rate × termMonths`
  - Currency: from retainer
- Above pricing, render scope context (non-priced):
  - Requirements block
  - Deliverables list
  - Approval terms block
- These context blocks pull from the retainer, not the project (Decision locked: scope lives on retainer)

**UI** (`apps/web/app/project/[id]/quote/` + Quote component):
- Display retainer line distinct from fixed-scope lines (icon or subtle label)
- Quote preview shows scope context above pricing

### Phase 4: Client portal HubSpot Connect card

**Why:** Richard should self-serve the partner invite instead of waiting on email.

**UI changes** (client portal landing — start in `apps/web/app/client/page.tsx` and the component it renders):
- On mount, fetch `/api/workspace/hubspot-settings` (or a new public-safe endpoint that returns only `partnerInviteUrl`)
- Also fetch the current client's `hubSpotPortalId` + connection status
- If `connected === false` and `partnerInviteUrl` is set:
  - Render a card: "Connect your HubSpot"
  - Body: short explainer — "This lets Muloo audit your portal and run the work you approved. A HubSpot Super Admin from your team needs to click the link. It takes about 10 seconds."
  - Button: external link to `partnerInviteUrl`, opens in new tab
- If `connected === true`, card hides or shows "✓ HubSpot connected — Portal ID {id}"

**API:**
- Public-safe endpoint: `GET /api/client-portal/hubspot-invite` that returns `{ partnerInviteUrl, connected, portalId }` for the authenticated client portal user only. Do NOT return `partnerAccountId` or `notes`.

### Phase 5: Client card invoices section (manual entry)

**Why:** visual tracking of billing, due dates, and invoice history per client.

**Note:** User confirmed no Xero API — manual entry only.

**UI changes** (`apps/web/app/components/ClientsWorkspace.tsx` or a new `ClientInvoicesPanel.tsx` embedded in the client detail view):
- New "Invoices" section in the client editor
- Table of existing invoices (joined via `client.billToEntities[].retainers[].invoices[]`):
  - Reference, Amount, Currency, Issue date, Due date, Status, Xero URL (button "Open in Xero")
- Manual entry form:
  - Reference (required, unique)
  - Bill-to entity (dropdown — scoped to this client's billToEntities)
  - Retainer (dropdown — scoped to this client's retainers)
  - Invoice type (RETAINER_BLOCK / TOP_UP / OTHER)
  - Amount, Currency
  - Issue date, Due date
  - Xero URL (paste field)
  - Status (DRAFT / SENT / PAID / OVERDUE / VOID)
  - Notes (optional)
- Edit/update invoice row (same form, prefilled)
- Status chips visually: SENT = blue, PAID = green, OVERDUE = red

**API:**
- `POST /api/clients/:clientId/invoices` — create manual invoice
- `PATCH /api/invoices/:id` — update status, due date, xeroUrl, etc.
- `GET /api/clients/:clientId/invoices` — list by client (joined through bill-to)

---

## Transnova setup — do this today in the existing UI

Workaround until Phase 1–3 land. You can get Transnova quoted this week.

1. **Set the HubSpot partner invite URL** (new feature, just shipped):
   - Settings → Workspace → HubSpot Partner Invite section
   - Paste: `https://app.hubspot.com/l/settings/users/partnerInviteLink/ODA2NjQxMz0xMTMzMTM1MA`
   - Save

2. **Create the Transnova retainer** (via existing `/retainers` workspace):
   - Client: Transnova
   - Bill to: Selected client (direct)
   - Service line: **Consulting** (enum exists; if dropdown doesn't show it, it's a Retainer workspace UI bug — check the options array)
   - Block size: 20 (or 15 if preferred)
   - Currency: ZAR
   - Start date: propose 1 May 2026 (adjust)
   - Status: DRAFT
   - Rate: auto (Consulting = R2,200 flat per commit `cb2be35`)
   - Note: term (3 months) isn't a field yet. Set endDate = 31 Jul 2026 after create if the detail view allows, otherwise leave blank and add in Phase 1.

3. **Link the retainer to the project** (manual DB update until Phase 2 lands):
   ```sql
   UPDATE "Project"
   SET "retainerId" = '<the retainer id>'
   WHERE id = 'cmobantsl000s2trg43jn5906';
   ```
   Alternative: edit directly via Prisma Studio (`pnpm db:studio`).

4. **Add discovery context** — use the existing Project Discovery Inputs tab to paste:
   - Richard's email thread (provided)
   - Meeting transcript (Fireflies)
   - Stratitude agency brief
   - FYR dashboard link
   - Link to uploaded SOCs

5. **Compose the quote manually** (until Phase 3 auto-composition):
   - Fixed lines: portal audit, reporting build, training (if scoped)
   - Retainer line: "Consulting retainer — 20h/month × 3 months @ R2,200/hr = R132,000"
   - Context notes (above pricing): requirements + deliverables + approval terms (copy from Richard's email answers)

---

## Decisions locked (reference)

1. Quote shows **single retainer line** + scope context, no broken-out deliverable pricing
2. Retainer fields (scope, deliverables, approvals, requirements) live on **Retainer**, not Project
3. Partner invite link is **workspace-level** (one link for all clients), stored on `WorkspaceHubSpotSettings`
4. No Xero API — invoices entered manually. `Invoice.xeroUrl` already exists, just paste the URL

---

## Platform fix list — bloat & friction found during Transnova setup

Non-blocking but worth queueing.

**Broken / inconsistent:**
- Client card says "0 contacts" but project sidebar shows `RKing@transnova.co.za` as client contact. Contact link layer between Client and Project is inconsistent
- Project shows "HubSpot: Transnova · needs reconnect" on client card but no CTA to fix it from there. After Phase 4 this is solved for the client; for Jarrud, add an inline "Connect" button on the client editor that opens Settings → Workspace → HubSpot
- Retainer workspace creates retainers with no project link; after Phase 2 the /retainers view becomes a cross-project rollup only

**Bloat / unclear:**
- "Additional websites" on Transnova has `maluti-x.com` — probably auto-enrichment overreach. Add a UI flag or require manual confirmation before adding enriched URLs
- "Include portal audit" checkbox on project edit is orphaned — what does it change? If it's unused, remove it. If it drives Audit workflow stages, make the effect explicit
- Gmail watchlists showing "The label is live, but Gmail is not returning any messages for it yet" — noisy. Hide empty watchlists below a fold
- Command Centre stats mix project counts (5 Live, 0 In delivery, 1 Awaiting approval, 3 Blocked external) — the "In delivery" definition seems fragile (why 0 when 5 are live?). Audit the status logic

**Missing:**
- No retainer term field (duration in months or explicit end date) exposed in create flow
- No "rollover rule" UI despite the sophisticated `RolloverBucket` model (90-day expiry, 25% cap) — expose these defaults with override
- No client-side view of hours burnt on a retainer in the client portal (should be there: "You've used 8 of 20 hours this month")
