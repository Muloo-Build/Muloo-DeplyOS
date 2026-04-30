# Project Route Audit

> Generated for `DeployOS_BugFixes_Prompt.md` Bug 5. Inventory of every `apps/web/app/projects/[id]/*` sub-route, where it's linked from, and recommended disposition.

## Sub-routes (10 total)

| Route | Linked from `projectWorkspaceConfig` | Total refs | Disposition |
|---|---|---|---|
| `/projects/[id]` (overview) | _entry point_ | n/a | **Active** — landing surface for every project. |
| `/projects/[id]/prepare` | Yes (Context cluster) | 7 | **Active** — Prepare workspace. |
| `/projects/[id]/inputs` | Yes (Context cluster) | 6 | **Active** — Inputs surface. |
| `/projects/[id]/audit` | Yes (Diagnose / Discover cluster, gated by `requiresAudit`) | 7 | **Active** — Portal Audit. |
| `/projects/[id]/discovery` | Yes (Discover cluster, gated by `showDiscovery`) | 15 | **Active** — Discovery surface. After Bug 4 fix, hidden by default for non-implementation engagements. |
| `/projects/[id]/proposal` | Yes (Discover cluster, gated by `showDiscovery`) | 9 | **Review** — labelled "Working Doc" in nav. Worth confirming this is still the right name and doesn't overlap with the Quote system. Looks live, low priority. |
| `/projects/[id]/quote` | Yes (Plan cluster, "Scope & Approval") | 25 | **Active but legacy renderer** — see `DeployOS_QuoteFlow_Unification_Prompt.md`. Phase 3 will redirect this to `/quotes/[id]`. |
| `/projects/[id]/changes` | Yes (Deliver cluster, "Change Mgmt") | 9 | **Active** — change request workflow. |
| `/projects/[id]/delivery` | Yes (Deliver cluster, "Delivery Board") | 11 | **Active** — main delivery board. |
| `/projects/[id]/edit` | _not in nav cluster definitions_ | 5 | **Active** — edit form launched from project header. Confirmed via grep, just not surfaced via the cluster nav. |

## Findings

- **No orphan routes.** Every page directory is linked from somewhere in the app, even if not always from the cluster nav.
- **Two routes worth follow-up:**
  - **`/projects/[id]/proposal`** — labelled "Working Doc" in the Discover cluster. Worth a quick read to confirm it's still the proposal/discovery doc surface and not a relic from a pre-Quote era. If overlapping with the quote flow, consolidate.
  - **`/projects/[id]/quote`** — explicitly handled in the Quote Unification prompt. Phase 3 of that work will replace the page body with a redirect to `/quotes/[id]`. No action here beyond confirming the Quote Unification work owns it.
- **`/projects/[id]/edit` is an under-the-radar route** — five references means it's used, but it's launched from headers/buttons rather than the workflow nav. That's intentional, but worth keeping in mind for future cluster nav changes.

## Recommendation

No deletions. No 404s. The earlier audit's worry about stale tabs doesn't reproduce on the current `main` — the codebase is tighter than expected. The Quote Unification work will collapse the `/projects/[id]/quote` route in its own dedicated PR; the rest can stay.

## What's done in this pass

Inventory only — no code changes. The Quote Unification prompt owns the `/projects/[id]/quote` migration.
