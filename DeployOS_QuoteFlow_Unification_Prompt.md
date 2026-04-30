# DeployOS — Quote Flow Unification (Codex Prompt)

> **Codex role:** Senior platform engineer. Two parallel quote systems live in this codebase. Your job is to merge them into one, with zero data loss and zero regression for clients holding live quote URLs. Read this brief end to end before touching code.

## Why this exists

The Sales Hub buildout (April 2026) shipped a new "Quick Quote" system (focused builder, polished renderer, lifecycle states, client portal flow). The old "Full Quote" system from `QuoteDocument.tsx` (3,592 lines) is still wired to project-scoped routes. Both reference the same `ProjectQuote` Prisma model but render through different components, follow slightly different status flows, and have different client-facing UX. This is technical debt that is now actively confusing operators and Jarrud has called it out.

## Current state — confirmed

### Two renderers
| | `QuoteDocument.tsx` (legacy) | `QuickQuoteDocument.tsx` (new) |
|---|---|---|
| Lines | 3,592 | 1,053 |
| Builder | inline within QuoteDocument | `QuickQuoteBuilder.tsx` (818 lines) |
| Approach | All-in-one editor + renderer | Builder/renderer split |
| Modes | `mode="partner"`, `mode="client"`, default internal | `mode="preview"`, `mode="client"`, default internal |
| Origin | Pre-Sales-Hub | Sales Hub v1 (Apr 2026) |

### Routes wired to each

**Legacy (`QuoteDocument`):**
- `/projects/[id]/quote` — `apps/web/app/projects/[id]/quote/page.tsx`
- `/partner/projects/[id]/quote` — `apps/web/app/partner/projects/[id]/quote/page.tsx`
- `/client/projects/[id]/quote` — `apps/web/app/client/projects/[id]/quote/page.tsx`

**New (`QuickQuoteDocument`):**
- `/quotes/[id]` — `apps/web/app/quotes/[id]/page.tsx`
- `/quotes/[id]/preview` — `apps/web/app/quotes/[id]/preview/page.tsx`
- `/client/quotes/[id]` — `apps/web/app/client/quotes/[id]/page.tsx`

### Backend
- `ProjectQuote` model: `apps/api/prisma/schema.prisma`
- Quote routes: `apps/api/src/app.ts` (grep `'/api/quotes'` and `'/api/projects/:projectId/quote'`)
- Quote domain logic: `apps/api/src/server.ts` (grep `quote` — many functions; the relevant ones are around `loadProjectQuote`, `loadQuickQuote`, `applyQuoteApproval`, etc.)

## Decision — canonical flow

**The new Quick Quote system is canonical.** Three reasons:
1. Operators can now actually use it (Jarrud's words: "operators avoided" the legacy 3,400-line beast).
2. The lifecycle (Draft → Sent → Approved → Won/Lost/Archived/Superseded) is wired and tested through the Quick Quote routes.
3. Client-facing approval, internal preview, recall, revise, version-aware revisions all sit on the new system.

Legacy `QuoteDocument` becomes a deprecated read-only fallback during migration, then gets deleted.

## Out of scope

- Server-side PDF rendering via Puppeteer/Browserless — that's in `DeployOS_Production_Hardening_Prompt.md`.
- Email delivery of quotes — that's in `DeployOS_ClientPortal_Improvements_Prompt.md`.
- Version archive/compare UX — that's in `DeployOS_UX_Polish_Prompt.md`.

---

## Phase 1 — Audit and parity gap

Before any deletion, find every feature that lives in the legacy renderer but not in Quick Quote. The legacy file is 3,500 lines — assume some of those lines are real product capability the team will miss.

**Output:** `QUOTE_PARITY_REPORT.md` at repo root with three sections:
1. **Quick Quote already covers** (e.g. line items table, discount, signature block, client approval, retainer line composer).
2. **Legacy-only features that must be ported** (suspected: discovery-summary projection, partner pricing override, multi-option commercial selection, manual line items with hours/rate metadata for retainer-style quotes — last one was added per `PROJECT_MEMORY.md` §6).
3. **Legacy features being dropped** (with one-line reason each).

Jarrud reviews this report **before** Phase 2 starts. Pause and post the report to him.

---

## Phase 2 — Port the parity gap

For each item in section 2 of the parity report, port it into Quick Quote. Do this in `QuickQuoteBuilder.tsx` and `QuickQuoteDocument.tsx`. Keep both under their current size budgets where possible — push reusable pieces into `apps/web/app/components/quote/` subfolder.

**Most likely high-value ports**
- **Manual retainer-style options on quote drafts** with hours/rate metadata. Per `PROJECT_MEMORY.md` §6, client approval can follow the selected commercial option, not blindly approve every alternative. This logic must survive in Quick Quote.
- **Multi-option commercial selection** if it exists in legacy.
- **Discovery-summary projection** for discovery-led projects: when `engagementType=discovery-led`, pre-fill quote sections from latest `DiscoverySummary`.
- **Partner pricing override path** (legacy `mode="partner"`).

**Acceptance per port**
- Feature parity with legacy as observed in production.
- New unit tests in `apps/web/app/components/quote/__tests__/` (or wherever tests live) covering the ported logic.

---

## Phase 3 — Redirect legacy routes

Every legacy route (`/projects/[id]/quote`, `/partner/projects/[id]/quote`, `/client/projects/[id]/quote`) needs to land users on the canonical Quick Quote URL.

**Approach**
1. Each `ProjectQuote` should already have a `quoteId` (the Quick Quote system reads by id at `/quotes/[id]`). If a project has multiple historical quotes, redirect to the latest non-archived.
2. Replace each legacy `page.tsx` body:

```tsx
// apps/web/app/projects/[id]/quote/page.tsx
import { redirect } from "next/navigation";
import { resolveLatestQuoteIdForProject } from "@/lib/quotes";

export default async function ProjectQuoteRedirect({ params }: { params: { id: string } }) {
  const quoteId = await resolveLatestQuoteIdForProject(params.id);
  if (!quoteId) {
    redirect(`/projects/${params.id}?missingQuote=1`);
  }
  redirect(`/quotes/${quoteId}`);
}
```

3. Same pattern for partner and client variants, mapping to `/partner/projects/.../quote → /quotes/[id]?mode=partner` (or rebuild a partner mode in Quick Quote — see Phase 2).
4. Add a 410 Gone for any unreachable legacy URL pattern.

**Acceptance**
- Every legacy URL still resolves to the right quote in the new UI.
- `next-sitemap` or equivalent is rebuilt — new canonical URLs only.

---

## Phase 4 — Delete legacy

Only after Phase 3 is in production for at least one weekly cycle.

```bash
git rm apps/web/app/components/QuoteDocument.tsx
git rm apps/web/app/projects/[id]/quote/page.tsx  # if no longer needed beyond redirect
git rm apps/web/app/partner/projects/[id]/quote/page.tsx
git rm apps/web/app/client/projects/[id]/quote/page.tsx
```

Then sweep for orphaned API endpoints — anything only the legacy renderer called. Likely candidates:
- `GET /api/projects/:id/quote` (full quote shape)
- `POST /api/projects/:id/quote/approve` (legacy approve)
- Anything in `server.ts` named `loadFullQuote*`, `composeFullQuote*`, etc.

Each deletion gets its own commit so it's easy to revert one piece if a hidden consumer surfaces.

**Acceptance**
- `grep -rn "QuoteDocument\b" apps/` returns zero results.
- Legacy API endpoints return 404.
- Smoke test the full quote lifecycle on production: create → revise → send → client approve → mark won.

---

## Phase 5 — Lifecycle hardening (clean-up)

After legacy is gone, the canonical Quick Quote lifecycle is the only quote lifecycle. Tighten:

1. **State machine in code, not strings.** Replace `quote.status === "draft"` style checks across the codebase with a single `QuoteStatus` enum and `canTransition(from, to)` helper. Lives in `apps/api/src/quotes.ts` (create the file if not present).
2. **Audit log integration.** Every status transition writes an `AuditLog` row (model exists at `schema.prisma:947`). Action, actor, timestamp, optional note.
3. **Client portal recall window.** When operator recalls a sent quote, log who/when/why and notify the client portal user via `ClientShell` notification (the AppShell has an inbox path, mirror it for clients).

**Acceptance**
- All transitions go through `canTransition`.
- `AuditLog` rows present for every state change. Verifiable via `SELECT * FROM "AuditLog" WHERE entityType='ProjectQuote' ORDER BY "createdAt" DESC LIMIT 20;`.
- Recall notification reaches the client portal inbox.

---

## Final acceptance gate

The unification is done when:

1. `QUOTE_PARITY_REPORT.md` is approved by Jarrud.
2. `QuoteDocument.tsx` is deleted from `apps/web/app/components/`.
3. Every legacy route redirects to the canonical URL or returns 410.
4. The full lifecycle works end to end in production for one full quote (create → send → client approve → mark won → invoice).
5. `AuditLog` shows clean transition history for that quote.

Open the PR(s) on a branch `feature/quote-unification` with phases as separate commits so review can land in slices.
