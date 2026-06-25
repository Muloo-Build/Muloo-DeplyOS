# Portal IA Simplification — Audit + Proposal

**Date:** 2026-06-25
**Status:** Proposal — for review before any change
**Why:** The portal has outgrown its navigation. 17 flat left-nav items + 10 project
tabs + 3 parallel project-nav systems. It's hard to work in. Goal: reduce surface
area without losing capability.

## Principle

Top-level navigation = the **few nouns you move between daily**. Everything else
**nests** under a parent or becomes a sub-view. Tabs map to the **delivery
lifecycle**, not to accumulated features. One lifecycle model, not three.

---

## Current state (audited)

**Global left nav (17 items):**
- Top: Today, Skippy world, Inbox
- WORK: Projects, Clients, Contacts, Calendar
- COMMERCIALS: Quotes, Retainers, Invoices, Financials
- OPERATIONS: Operations overview, Workbooks, Question library, Implementation templates, Agents
- REPORTING: Reporting (external SSO redirect)
- Hidden: Runs (under Agents), Skeleton Key (user menu)

**Project workspace — three coexisting nav systems:**
- Top tabs (10): Overview, Plan, Tasks, Approvals, Files, Skippy | (More:) Discovery, Meetings, Audit, Settings
- Pipeline rail (6 stages): Context, Discovery, Scope & approval, Delivery, QA, Handover
- Right rail (6 panels): Next actions, Client, Retainer, Quotes, Meeting summaries, Recent activity

**Overlap clusters found:**
- **Commercials chain** Quotes→Retainers→Invoices→Financials. Invoices is thin (read-only ledger, ~334 LOC); Financials is the substantial surface (~854 LOC) and likely consumes invoices.
- **Knowledge studios** Workbooks (~1771 LOC), Question library (~767), Implementation templates (~311) — questions feed workbooks feed templates. **"Operations overview" is already a hub landing that links to all of these + Runs**, yet they also sit top-level → double exposure.
- **AI fragmentation** Skippy world (~946), Agents (~964+514), Runs (~705), plus a project-level Skippy panel. No single "where do I see agent status?" answer.
- **Contacts** (~255 LOC, thin) is really a sub-view of **Clients** (~525).
- **Project tabs vs pipeline rail** duplicate the same lifecycle. **Approvals** tab is a wayfinding hub (3 links to other tabs), not content. **Settings** tab = the big edit form = should be the gear/"Edit" action (already in the header).

---

## Proposal

### A) Global left nav: 17 items → ~8 groups

| Group | Contains | Change |
|---|---|---|
| **Today** | — | keep |
| **Inbox** | — | keep |
| **Projects** | — | keep |
| **Clients** | + **Contacts** as a tab/drawer inside Clients | Contacts leaves top-level |
| **Commercials** | Quotes · Retainers · Invoices · Financials (as sub-views/tabs) | 4 items → 1 expandable group |
| **Operations** | Workbooks · Question library · Implementation templates · Runs (under the existing Operations hub) | 5 items → 1 expandable group |
| **AI** | Skippy world · Agents | group the two AI surfaces; Runs cross-links from here too |
| **Reporting** | external (unchanged) | keep |
| Calendar | fold into **Today**, or keep as a minor item | thin Google wrapper |

Net: from a 17-item flat list to ~8 grouped entries, each expandable. Nothing is
removed — it's nested under the right parent.

### B) Project workspace: collapse 3 nav systems → 1

**Reconcile tabs with the pipeline.** The pipeline rail (Context→Discovery→Scope→
Delivery→QA→Handover) becomes the **progress indicator**, and the tabs become the
**5 lifecycle work surfaces** (the cut you approved):

| Top tab (5) | Folds in | Maps to stage |
|---|---|---|
| **Overview** | Meeting summaries; Recent activity | Context |
| **Plan** | **Discovery** + **Audit** as sections (intake = "what they want"; audit = "what they have") | Discovery + Scope |
| **Tasks** | — | Delivery |
| **Approvals** | inline the 3 hub links (Proposal, Audit trail, guardrails) as real content; add QA/Handover here | Scope→QA→Handover gate |
| **Files** | — | cross-cutting |

- **Skippy** → persistent panel/button, not a tab (it's already global).
- **Settings** → the gear/"Edit" action in the header (already exists), not a tab.
- **Meetings** → lives inside Overview/Discovery (the right-rail summary already exists).
- **Drop the "More" dropdown entirely** (and with it the overflow-clipping bug).

Result: 10 tabs → 5, no "More", one lifecycle model shared by the tabs and the
pipeline rail.

---

## Phased delivery (lowest risk → highest)

**Phase 1 — Project tabs (contained, reversible, immediate relief).**
Reduce to the 5 tabs, remove "More", move Settings to the header gear, make Skippy a
panel. Fold Discovery/Audit into Plan; Meetings into Overview. No data/model changes —
pure presentation + routing. This is the approved direction.

**Phase 2 — Left-nav grouping.**
Nest Contacts under Clients; group Commercials (Quotes/Retainers/Invoices/Financials);
group Operations (Workbooks/Questions/Templates/Runs) under the existing hub; group AI
(Skippy/Agents). Collapsible sections. No pages deleted — just re-parented.

**Phase 3 — Tighten the thin surfaces.**
Invoices as a sub-tab of Financials; confirm Contacts as a Clients drawer; decide
Calendar's fate. Requires light per-surface work.

Each phase ships and is judged before the next.

---

## Open decisions (need your call before Phase 1 build)

1. **Discovery + Audit folded into Plan** — agreed, or should Discovery stay its own
   tab (it's a big workbook UI)? Audit is small and validation-only; Plan is its
   natural home.
2. **Approvals** — inline the 3 links as real content (recommended) vs remove the tab
   and surface approvals in Plan?
3. **Pipeline rail** — keep as the progress indicator (recommended) vs make it the
   primary nav and drop tabs? (Recommendation keeps both but de-duplicates roles.)
4. **Phase order** — start with Phase 1 (project tabs) as approved, or do the left-nav
   grouping (Phase 2) first since that's where the "17 items" overwhelm lives?

## Out of scope / non-goals

- No features deleted — only re-grouped/nested. Everything stays reachable.
- No commercial/quote/approval/retainer **data model** changes (protected areas).
- Reporting stays an external SSO redirect.
