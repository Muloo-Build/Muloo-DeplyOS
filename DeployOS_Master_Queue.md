# DeployOS — Master Queue

> Operating manual for handing the six prompt files to Codex one stream at a time. Each row is a discrete piece of work. Pick the next row in priority order, hand the linked prompt file to Codex, work it to acceptance, then move to the next.

## How to use this queue

1. Take the **next pending row** in this table.
2. Hand Codex the file in the **Source prompt** column. Tell it: _"Work this prompt's tasks in order. Stop when acceptance is met."_
3. When done, mark the row Done and start the next. If a row reveals work that doesn't fit the source prompt, log it under "Discovered work" at the bottom of this file rather than smuggling it into the current task.
4. Keep one stream in flight at a time. Parallel streams on the same codebase create merge churn.

## Priority queue

| # | Stream | Slice | Source prompt | Effort | Why now | Status |
|---|---|---|---|---|---|---|
| 1 | Bugs | Tailwind unification (root + apps/web on v3.4.x) | `DeployOS_BugFixes_Prompt.md` Bug 1 | S | Fixes silent CSS drift across the team | Pending |
| 2 | Bugs | ClientMemory type alignment + recent runs panel | `DeployOS_BugFixes_Prompt.md` Bug 2 | S | Re-surfaces orphaned server work; quick win | Pending |
| 3 | Bugs | Discovery prominence based on engagement type | `DeployOS_BugFixes_Prompt.md` Bug 4 | S | Reflects PROJECT_MEMORY rule on UI; tidies daily ops | Pending |
| 4 | Bugs | Prisma error friendly-handler middleware | `DeployOS_BugFixes_Prompt.md` Bug 7 | S | No more raw DB errors leaking to UI | Pending |
| 5 | Hardening | Zod validation sweep across mutating routes | `DeployOS_Production_Hardening_Prompt.md` Hardening 1 | M | Blocks bad input at the door; foundational | Pending |
| 6 | Hardening | Web error boundaries + client error log table | `DeployOS_Production_Hardening_Prompt.md` Hardening 3 | S | Fewer "what just happened" moments for users | Pending |
| 7 | Bugs | Filesystem layer inventory (no migration yet) | `DeployOS_BugFixes_Prompt.md` Bug 3 (Step 1 only) | S | Establishes the baseline before ripping anything out | Pending |
| 8 | Bugs | Project route audit | `DeployOS_BugFixes_Prompt.md` Bug 5 | S | Drops dead routes, no surprises on the UI | Pending |
| 9 | Bugs | Command Centre vs Projects count test + central predicate | `DeployOS_BugFixes_Prompt.md` Bug 6 | S | Restores trust in the home-screen number | Pending |
| 10 | Bugs | Wizard validation regression test | `DeployOS_BugFixes_Prompt.md` Bug 9 | XS | Locks in already-shipped fix | Pending |
| 11 | Quote unification | Phase 1 — parity audit (`QUOTE_PARITY_REPORT.md`) | `DeployOS_QuoteFlow_Unification_Prompt.md` Phase 1 | M | Surfaces what legacy still does that Quick Quote doesn't | Pending |
| 12 | Quote unification | Phase 2 — port parity gap into Quick Quote | `DeployOS_QuoteFlow_Unification_Prompt.md` Phase 2 | M-L | Closes the gap so legacy can go | Pending |
| 13 | Quote unification | Phase 3 — redirect legacy routes to canonical URLs | `DeployOS_QuoteFlow_Unification_Prompt.md` Phase 3 | S | No broken client links during migration | Pending |
| 14 | Quote unification | Phase 4 — delete legacy renderer + orphaned API | `DeployOS_QuoteFlow_Unification_Prompt.md` Phase 4 | S | -3,500 lines, single source of truth | Pending |
| 15 | Quote unification | Phase 5 — lifecycle hardening (state machine + audit) | `DeployOS_QuoteFlow_Unification_Prompt.md` Phase 5 | M | Makes the flow tamper-proof | Pending |
| 16 | Project flow | Task dependencies UI (schema already in place) | `DeployOS_ProjectFlow_Improvements_Prompt.md` Improvement 1 | M | Schema is there; UI is missing; high visible win | Pending |
| 17 | Project flow | Activity log — full coverage hooks + Activity tab | `DeployOS_ProjectFlow_Improvements_Prompt.md` Improvement 4 | M | Foundational; milestones/health depend on signals | Pending |
| 18 | Project flow | Milestones model + UI + client-visible flag | `DeployOS_ProjectFlow_Improvements_Prompt.md` Improvement 3 | M-L | First-class anchors clients can see | Pending |
| 19 | Project flow | Health score (auto + override) | `DeployOS_ProjectFlow_Improvements_Prompt.md` Improvement 2 | M | Signals the at-risk projects without a manual sweep | Pending |
| 20 | Project flow | Portal auto-inherit on new project | `DeployOS_ProjectFlow_Improvements_Prompt.md` Improvement 5 | S | Cuts wizard time; small invest, big feel | Pending |
| 21 | Client portal | Comms log per project | `DeployOS_ClientPortal_Improvements_Prompt.md` Improvement 3 | M | Single timeline of every interaction | Pending |
| 22 | Client portal | Approvals surface | `DeployOS_ClientPortal_Improvements_Prompt.md` Improvement 2 | M | Clients stop missing things | Pending |
| 23 | Client portal | Email delivery of quotes (with tracking) | `DeployOS_ClientPortal_Improvements_Prompt.md` Improvement 4 | M | Replaces copy-link workflow | Pending |
| 24 | Client portal | Shareable status page (no-login URL) | `DeployOS_ClientPortal_Improvements_Prompt.md` Improvement 1 | M-L | Clients' CFO can see status without an account | Pending |
| 25 | Client portal | Portal nav polish + Cmd+K search (cross-cuts Hardening 4) | `DeployOS_ClientPortal_Improvements_Prompt.md` Improvement 5 + Hardening 4 | M | Search lifts the whole product | Pending |
| 26 | Hardening | Audit log everywhere + admin /operations/audit page | `DeployOS_Production_Hardening_Prompt.md` Hardening 6 | M | Compliance + trust | Pending |
| 27 | Hardening | RBAC + email invite flow | `DeployOS_Production_Hardening_Prompt.md` Hardening 7 | M-L | Prereq for partner/enterprise pilots | Pending |
| 28 | Hardening | Rate limit tightening (auth, AI, share-link) | `DeployOS_Production_Hardening_Prompt.md` Hardening 2 | S | Cost + abuse protection | Pending |
| 29 | Hardening | Logging, metrics, alerts | `DeployOS_Production_Hardening_Prompt.md` Hardening 8 | M | Operational visibility before scaling | Pending |
| 30 | Hardening | Export endpoints (CSV) | `DeployOS_Production_Hardening_Prompt.md` Hardening 5 | S | Operator workflow lift | Pending |
| 31 | Hardening | Backup runbook + migration safety guard | `DeployOS_Production_Hardening_Prompt.md` Hardening 9 | S | Safety net | Pending |
| 32 | Hardening | Env validation + safe-config helper | `DeployOS_Production_Hardening_Prompt.md` Hardening 10 | XS | Hygiene | Pending |
| 33 | UX | Empty states sweep | `DeployOS_UX_Polish_Prompt.md` Polish 1 | S-M | High visible value across every list | Pending |
| 34 | UX | Loading skeletons sweep | `DeployOS_UX_Polish_Prompt.md` Polish 2 | S-M | Eliminates flicker; cheap polish | Pending |
| 35 | UX | Forms component contract + auto-save | `DeployOS_UX_Polish_Prompt.md` Polish 5 | M | Tightens visual + behavioural consistency | Pending |
| 36 | UX | Toast/notification system | `DeployOS_UX_Polish_Prompt.md` Polish 6 | S | Standardises action feedback | Pending |
| 37 | UX | Navigation polish + breadcrumbs | `DeployOS_UX_Polish_Prompt.md` Polish 4 | S | Visual continuity | Pending |
| 38 | UX | Mobile sweep (client portal first) | `DeployOS_UX_Polish_Prompt.md` Polish 3 | M | Required for clients on phones | Pending |
| 39 | UX | Tooltips + dark-mode polish | `DeployOS_UX_Polish_Prompt.md` Polish 7 + 8 | S | Final spit and polish | Pending |
| 40 | Bugs | Filesystem layer migration (after inventory in row 7) | `DeployOS_BugFixes_Prompt.md` Bug 3 (Steps 2 + 3) | L | Single system of record | Pending |

## Effort key

- XS: <2 hours
- S: half a day to a day
- M: 1-3 days
- L: 3-7 days

## Phasing recommendation (working calendar)

If Codex (or the team) works one row per day in average:

- **Week 1 — Stabilise (rows 1–10):** every quick bug fix and the hardening foundations. By end of week, the platform has fewer rough edges and Zod plus error boundaries make production safer.
- **Weeks 2-3 — Quote unification (rows 11-15):** big single-stream lift. Don't mix with other streams.
- **Week 4 — Project flow (rows 16-20):** dependencies, activity, milestones, health, portal inherit.
- **Week 5 — Client portal (rows 21-25):** comms log → approvals → email → share page → search.
- **Week 6 — Hardening (rows 26-32):** audit, RBAC, rate limits, observability, exports, backups, env.
- **Week 7 — UX polish (rows 33-39):** empty states, skeletons, forms, toasts, nav, mobile, tooltips.
- **Week 8 — Filesystem migration (row 40) + buffer:** the riskiest single piece. Treat as its own week with a roll-back plan.

That's an 8-week production-hardening calendar starting from "shippable to existing clients" and landing on "ready for new client and partner pilots."

## Discovered work

> Add to this list as Codex (or you) hits work that doesn't fit any of the source prompts. Don't smuggle it into an existing task; surface it here so Jarrud can decide.

| Date | Discovered while working on | Note | Suggested owner |
|---|---|---|---|
| _none yet_ | | | |

## Acceptance for the whole queue

The queue is "done" when:
- Every row above is **Done** (or explicitly **Deferred** with a written reason).
- A walkthrough of: project create → quote create → quote send → client approve → milestone hit → invoice draft, runs end-to-end on production with no operator workarounds.
- A new partner can be onboarded via email invite and only see their assigned clients.
- A client can view a shareable status URL of their project without logging in.
- All forms validate, all errors translate to friendly messages, all lists have empty states.
- The platform feels considered, fast, and finished.

That's the bar for production-ready DeployOS.
