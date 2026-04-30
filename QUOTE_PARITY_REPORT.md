# Quote Parity Report

> Generated for `DeployOS_QuoteFlow_Unification_Prompt.md` Phase 1. Diffs the legacy `QuoteDocument.tsx` (3,592 lines) against the canonical `QuickQuoteDocument.tsx` (1,053) + `QuickQuoteBuilder.tsx` (818) to surface the parity gap before legacy is deleted.

## TL;DR

Quick Quote covers the modern lifecycle and renders polished output, but legacy carries seven discrete capabilities Quick Quote doesn't yet match. None are showstoppers. **Three are commercially load-bearing** and must port before legacy is deleted: linked-retainer line composer, multi-option commercial selection, and operator-owned content overrides (per `PROJECT_MEMORY.md` §6).

## Section 1 — What Quick Quote already covers

- Single-page focused builder with client picker, deal type (fixed / retainer / hybrid), template (full / one-pager), line items with discount, default rate apply-to-all, content blocks (Muloo intro, exec summary, terms).
- Status lifecycle: Draft → Sent → Approved → Won / Lost / Archived / Superseded.
- Mark Won, Mark Lost, Archive, Edit, Revise (in-place for drafts, new version for sent), Recall.
- Polished renderer with hero header, quote reference (`Q-XXXXXX-Vn`), Prepared for / Prepared by, Issued / Valid until, total card with brand gradient, line items with tabular numerals, signature placeholders.
- Three modes: `internal`, `client`, `preview` (preview banner + disabled approve).
- Currency support: ZAR, GBP, EUR, USD, AUD.
- Discount per line: percent or fixed.
- Client-facing approval flow at `/client/quotes/[id]` with one-click Approve, captures portal user name + email + timestamp.
- Internal preview at `/quotes/[id]/preview` with PREVIEW banner and disabled Approve action.

## Section 2 — Legacy-only features that must port to Quick Quote

These ride along inside `QuoteDocument.tsx` and are exercised by real production data. Each must port before legacy can be deleted (Phase 4 of the unification).

### 2.1 — Manual retainer-style lines with hours/rate metadata  *[Critical]*

Legacy: `ManualProductLineDraft` carries `hours`, `rate`, `optionGroup`, and `metadata: QuoteProductLineMetadata` (line 137). `getProductLineHours()` (line 439) and `getManualLineMetadata()` (line 388) attach commercial intent (hours/rate breakdown) to free-text lines so a retainer option in a quote stores not just a price but the hours-at-rate composition that drove it.

Why critical: `PROJECT_MEMORY.md` §6 states "Quote drafts can now carry retainer-style manual options with hours/rate metadata, and client approval can follow the selected commercial option rather than blindly approving every alternative." Lose this, lose the multi-option retainer flow.

**Port plan:** add `metadata?: { hours?: number; rate?: number; optionGroup?: string }` to the `LineItemDraft` interface in `QuickQuoteBuilder.tsx`. Render hours and rate in the UI under the line description when set. Persist in `QuoteData.lineItems`.

### 2.2 — Multi-option commercial lines (option groups)  *[Critical]*

Legacy: `resolveOptionProductLines<T>()` (line 408) groups lines by their `metadata.optionGroup` so the operator can present alternatives in a single quote (e.g. "10-hour retainer" vs "20-hour retainer" vs "40-hour retainer") and the client picks one to approve.

Why critical: same `PROJECT_MEMORY.md` §6 rule — selected option drives approval. Quick Quote today has no concept of options; everything in the quote totals up.

**Port plan:** add `optionGroup?: string` to `LineItemDraft`. In the renderer, group lines by `optionGroup` and render each group as a "Choose one" radio block. Approve flow records the selected `optionGroupSelection: { [groupName]: lineId }` on the `ProjectQuote`. Total card recomputes based on selection.

### 2.3 — Linked-retainer line composer  *[Critical]*

Legacy: `composeLinkedRetainerLine(retainer)` (line 450) generates a default line item from a linked `Retainer` record — title, billing frequency, hours, rate. Used when a quote is being shaped against a project that has a retainer.

Why critical: retainers are now first-class in the Sales Hub. A new retainer should auto-suggest a quote line so operators don't retype.

**Port plan:** in `QuickQuoteBuilder.tsx`, if the project has a linked retainer (resolved via `project.retainerId`), seed the line items with the composed retainer line. Operator can edit or remove like any other line. Same composition function, ported to a shared util at `apps/web/app/lib/quotes/composeRetainerLine.ts`.

### 2.4 — Operator-owned content overrides  *[Important]*

Legacy: `QuoteContentOverrides` interface (line 145), `buildDefaultQuoteContentOverrides()` (line 550), `emptyQuoteContentOverrides()` (line 321), state at line 658. Operators can override the discovery-derived narrative (problem statement, solution recommendation, exec summary) inside the quote without changing the source discovery doc.

Why important: per `PROJECT_MEMORY.md` §6, "Internal quote editing now supports explicit quote-content overrides and manual line items, rather than only projecting discovery/summary text read-only." Lose this, lose operator authoring control inside the quote.

**Port plan:** Quick Quote already has `QuoteData.content` for the static blocks (intro / exec summary / terms). Extend with `narrativeOverrides: { problemStatement, solutionRecommendation, scopeExecutiveSummary }` and a "Use discovery" toggle that fills from the latest `DiscoverySummary` for the project. Edits live in the quote, not the discovery.

### 2.5 — Phase-based commercial drafts

Legacy: `PhaseCommercialDraft` (line 115) and the grouping at line 989 — line items can carry a `phase` so the renderer shows phased totals (Phase 1: discovery, Phase 2: build, Phase 3: handover). Useful for larger implementations.

Why useful but not critical: it's a renderer concern. Most current quotes don't use phasing — operators can simulate it with section headers in the static blocks.

**Port plan:** add `phase?: string` (free-text) to `LineItemDraft`. Renderer groups by phase if any line has a non-empty phase, otherwise falls back to the flat list. Total card shows phase subtotals when grouped.

### 2.6 — Discovery summary projection

Legacy: `formatDiscoveryOutcome()` (line 477) and `buildDefaultQuoteContentOverrides({ discoverySummary })` — when a project has a `DiscoverySummary`, the quote pre-fills problem statement, solution recommendation and exec summary from it. Operator can override (per 2.4).

Why useful: cuts new-quote authoring time on discovery-led projects.

**Port plan:** in `QuickQuoteBuilder.tsx`, when creating a new quote against a project with `engagementType=discovery-led`, fetch `loadDiscoverySummary(projectId)` and prefill the static-block fields. Hooked behind the same "Use discovery" toggle as 2.4.

### 2.7 — Partner pricing mode

Legacy: `mode="partner"` (line 631, line 677) — different pricing visibility for partner-channel quotes (e.g. partner-only rates, partner margin lines hidden from the client view).

Why useful but minor: partner channels are still small. Most partner quotes today go through the standard internal/client modes.

**Port plan:** add `partner` to `QuoteMode` type in `QuickQuoteDocument.tsx` (currently `"internal" | "client" | "preview"`). Conditional rendering for any partner-only fields. Route `/partner/quotes/[id]` would mount Quick Quote with `mode="partner"`. Confirm with Jarrud before porting — may not be needed in v1 unification.

## Section 3 — Legacy features being dropped

These do not need to port. Each had a one-line reason for not surviving.

- **Inline blueprint task list inside the quote** — legacy embedded the full blueprint inside the quote document. Drops because Quick Quote keeps blueprint in `/blueprint/[id]`; quote stays focused on commercial scope.
- **Inline session detail rendering** — same logic as above.
- **Pre-Sales-Hub status taxonomy** — older statuses (`shared`, `pending`) had different semantics. Already migrated to the canonical lifecycle in the Quick Quote system; legacy ones can go.
- **Hard-coded `exchangeRatesToZar`** — legacy had a static exchange rate map for currency conversion. If currency conversion is needed, route through a fresh rate fetch or document the static-rate decision explicitly. Don't port the magic numbers as-is.

## Section 4 — Suggested order of porting

1. **Linked retainer line composer (2.3)** — smallest port, removes retyping immediately.
2. **Manual line metadata (2.1)** — additive change to `LineItemDraft`. Renderer just needs to show hours/rate when present.
3. **Content overrides + discovery projection (2.4 + 2.6)** — pair these; both touch the static-block authoring surface.
4. **Multi-option commercial lines (2.2)** — biggest UX change in the renderer. Requires a "Choose one" component pattern and a small approval flow extension to record the selection.
5. **Phase-based grouping (2.5)** — additive in renderer; defer if 1-4 take longer than expected.
6. **Partner mode (2.7)** — confirm with Jarrud before porting. Likely defer.

## Section 5 — Acceptance for Phase 1

- Jarrud reviews this report.
- Decisions confirmed for Section 2.7 (partner mode in/out) and Section 3 (currency conversion rule).
- Phase 2 (port) starts only after sign-off on this report.

## What's done in this pass

Section 1-5 written from a deep read of `QuoteDocument.tsx`, `QuickQuoteDocument.tsx`, `QuickQuoteBuilder.tsx`. No code changes. Phase 2 (the actual port) is a separate stream — `DeployOS_QuoteFlow_Unification_Prompt.md` Phase 2 owns it.
