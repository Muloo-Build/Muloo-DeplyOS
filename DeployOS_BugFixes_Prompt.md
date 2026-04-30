# DeployOS — Bug Fixes (Codex Prompt)

> **Codex role:** Senior full-stack engineer on the Muloo DeployOS monorepo. Treat this file as your full brief. Read it once, then work the tasks in the order given. After each task, run `pnpm typecheck` and the relevant unit tests, then move on. Do not reorder unless a task is truly blocked.

## Repo orientation

- Repo: `/Users/jarrudvandermerwe/Work/03 Projects/Muloo-DeplyOS`
- Primary apps: `apps/api` (Hono + Prisma), `apps/web` (Next.js 14)
- Packages: `packages/{file-system, hubspot-client, executor, browser-session-executor, diff-engine, report-templates, shared, core, config}`
- Schema: `apps/api/prisma/schema.prisma` (48 models)
- Routes registered in: `apps/api/src/app.ts` (~6,863 lines)
- Domain logic in: `apps/api/src/server.ts` (~25,857 lines), `apps/api/src/billing.ts` (~1,127 lines), `apps/api/src/retainers.ts`, `apps/api/src/retainerLedger.ts`
- Web entry: `apps/web/app/`

**Rule before any new endpoint:** grep `apps/api/src/app.ts`, `server.ts`, `billing.ts` for the route prefix first. Half the time the API already exists.

## Out of scope for this prompt

Anything in `DeployOS_QuoteFlow_Unification_Prompt.md`, `DeployOS_ProjectFlow_Improvements_Prompt.md`, `DeployOS_ClientPortal_Improvements_Prompt.md`, `DeployOS_UX_Polish_Prompt.md`, `DeployOS_Production_Hardening_Prompt.md`. Bugs only here.

---

## Bug 1 — Tailwind version mismatch (root vs apps/web)

**Severity:** High. Causes silent class compilation failures and dev tooling drift.

**Symptom:** Root `package.json` declares `tailwindcss: ^4.2.1`, `apps/web/package.json` declares `tailwindcss: ^3.4.1`. Two majors apart. Tailwind v4 has a different config format (no `tailwind.config.js`, uses CSS-based config) and different plugin API. PostCSS processing in the web app is therefore non-deterministic across machines.

**Files**
- `package.json` (root)
- `apps/web/package.json`
- `apps/web/postcss.config.{js,mjs}` if present
- `apps/web/tailwind.config.{js,ts}` if present
- `apps/web/app/globals.css`

**Fix**
1. Decide canonical version. **Recommendation: pin to v3.4.x across the monorepo.** v4 is still settling and the web app is on v3 syntax.
2. Remove `tailwindcss` from root `package.json` `devDependencies` unless it's actually used at the root for something (it likely isn't — check first with `grep -r tailwind packages/ scripts/`).
3. If a root tooling pipeline (e.g. `report-templates`) actually needs Tailwind, add it to that package's own `package.json` at `^3.4.1`.
4. Run `pnpm install` then `pnpm -w build` to confirm clean.

**Acceptance**
- `pnpm why tailwindcss` returns a single major version (3).
- `apps/web` dev build (`pnpm --filter web dev`) starts without warnings.
- A representative page renders unchanged after a clean install.

---

## Bug 2 — `ClientMemory` type/shape mismatch between API and web

**Severity:** High. Silent data drop for client memory previous-projects on the Prepare workspace.

**Symptom:** Frontend `ClientMemory` interface (`apps/web/app/components/ProjectPrepareWorkspace.tsx:141`) does **not** include `recentRuns`, but the server's `loadClientMemory` (`apps/api/src/server.ts:15344`) builds `recentRuns` and is wired into the response at `apps/api/src/app.ts:5390`. Either:
- The server returns `recentRuns` and the component drops it (silent loss of useful UI surface), or
- The handler shapes the response and strips `recentRuns` (orphaned server work).

Confirm which by reading `app.ts` around line 5390 and the JSON shape returned to `GET /api/projects/:projectId/client-memory`. Also confirm every field in the frontend interface (`previousProjects`, `recentFindings`, `recentRecommendations`, `portalSnapshots`, `portalDiff`) maps 1:1 to the server selects in `loadClientMemory`.

**Fix**
1. Make the server function the source of truth for the contract.
2. Define the response shape once in `apps/api/src/types.ts` (or wherever shared types live) — `export type ClientMemoryResponse = ...` derived from the function return.
3. Re-export from `@muloo/shared` if appropriate.
4. Replace the frontend `interface ClientMemory` with an import of the shared type.
5. Add `recentRuns` to the UI as a small "Recent AI work" panel on the Prepare workspace right column. Title, model, status, ranAt — three rows max with a "see all in /runs" link.

**Acceptance**
- Network tab: response keys for `/api/projects/:id/client-memory` exactly match the `ClientMemory` type.
- TypeScript build catches any future drift (no `as any` anywhere).
- Recent runs render on the Prepare workspace.

---

## Bug 3 — Legacy filesystem layer running alongside the database

**Severity:** Medium-High. Two systems of record for project artefacts. Risk of divergence and a known source of confusion when the team debugs missing data.

**Symptom:** `@muloo/file-system` is imported in `apps/api/src/app.ts:28` and `apps/api/src/server.ts:16`. It exports `executions`, `json`, `modules`, `projects`, `summaries`, `templates`, `validation`. These were the original filesystem-based persistence before Prisma. Some routes still read/write through the FS layer; others go to the DB.

**Step 1 — Inventory.** Grep for every consumer:

```bash
grep -rn "@muloo/file-system" apps/ packages/ --include="*.ts" --include="*.tsx" \
  | grep -v node_modules > /tmp/fs-usage.txt
```

For each call site, record: caller file:line, function imported, whether the data is also persisted in Prisma, and whether the FS layer is the read or write side.

**Step 2 — Categorise.**
- **Cache:** FS layer caches DB reads (e.g. compiled summaries). **Action:** keep as cache, document, ensure invalidation. Out of scope for this prompt — flag in the master queue.
- **Active dual-write:** FS and DB both written on the same flow. **Action:** decide canonical (Prisma always wins) and remove FS write. Add a one-shot migration script in `scripts/` to backfill any FS-only rows.
- **Legacy read fallback:** FS is read only when DB row is missing. **Action:** backfill DB, remove FS read.

**Step 3 — Migrate.** For each "Active dual-write" or "Legacy read fallback" call site, raise a mini-PR with: removal, migration script if needed, and a Prisma read replacing the FS read.

**Acceptance**
- A single `MIGRATION_REPORT.md` lists every consumer and its disposition.
- `grep -rn "@muloo/file-system" apps/api/src` returns only call sites flagged "cache" with a comment line above each call: `// Cache layer — invalidated by ...`.
- Smoke test all six audit journeys (project create, blueprint, client portal, time/retainers, integrations, ops) pass.

---

## Bug 4 — Discovery still UI-prominent despite no longer being mandatory

**Severity:** Medium. Visual UX bug. Project memory rule (`PROJECT_MEMORY.md` §6) says "Discovery is still supported, but it is no longer the only valid front door." Yet `ProjectWorkflowNav` defaults `showDiscovery = true` and the Sidebar/landing surface treats Discovery as the primary path.

**Files**
- `apps/web/app/components/ProjectWorkflowNav.tsx:22` — `showDiscovery = true` default
- `apps/web/app/components/projectWorkspaceConfig.ts` — `buildProjectWorkspaceClusters` and `resolveProjectWorkspaceMode`
- `apps/web/app/components/ProjectWorkspaceLanding.tsx` — landing
- `apps/web/app/projects/[id]/page.tsx` — entry

**Fix**
1. In `projectWorkspaceConfig.ts`, make Discovery visibility a function of `engagementType`:
   - `discovery-led` → Discovery cluster shown first.
   - `optimisation`, `follow-on`, `retainer`, `workshop` → Discovery cluster either hidden or collapsed under "More" with text "Open discovery if scope expands".
2. Default `showDiscovery` in `ProjectWorkflowNav` to `false`. Pages that genuinely need it (Magnisol-style discovery-led projects) opt in.
3. On `ProjectWorkspaceLanding`, replace the "Open Discovery" hero CTA with a workflow-aware primary action: Prepare for `optimisation`, Build Quote for `follow-on`, Schedule next session for `retainer`, etc.

**Acceptance**
- Loading an `optimisation` project shows no Discovery cluster.
- Loading a `discovery-led` project shows the Discovery cluster as the first cluster.
- No regression on Magnisol Phase 1 (existing discovery-led project).

---

## Bug 5 — Project page route layout has stale tabs

**Severity:** Low-Medium. Several `apps/web/app/projects/[id]/*` directories exist (`audit`, `proposal`, `changes`, `inputs`) that were stand-up routes from earlier sprints. Some are still wired in `ProjectWorkflowNav`, some return 404 in practice, some duplicate live work.

**Audit pass**
For each directory under `apps/web/app/projects/[id]/`, confirm:
- Is it linked anywhere? (`grep -rn "/projects/[^\"']*/<dir>"` in `apps/web/`)
- Does the page render real content?
- Is it referenced in `projectWorkspaceConfig.ts`?

Drop or redirect anything that's orphaned. Surface anything broken in this prompt's task list (don't fix outside this prompt's scope).

**Acceptance**
- A short report `ROUTE_AUDIT.md` at the repo root listing each project sub-route and its disposition (active / archived / redirected).
- No 404s on any link rendered by `ProjectWorkflowNav`.

---

## Bug 6 — Command Centre vs Projects count drift (re-stress test)

**Severity:** Medium. Original audit (17 April) saw Command Centre showing 0 live projects while Projects page showed 4. Reconciled on reload but the cache/filter root cause was never confirmed.

**Test plan**
1. Cold-load `/command-centre` after `pnpm build && pnpm start`. Note "Live projects" tile.
2. Cold-load `/projects` in a new tab. Filter "Active". Count.
3. Repeat 5 times across different viewport widths and after creating a new project mid-test.
4. Inspect both data-loading paths. Command Centre tiles likely use a server action or a `loadCommandCentreSummary` function; Projects page hits `/api/projects`. Confirm both apply identical status filters.

**Likely root cause options**
- Status string normalisation drift (`active` vs `ACTIVE` vs `live`).
- Soft-deleted projects included in one path, excluded in the other.
- Stale RSC cache vs fresh client fetch.

**Fix**
- Centralise the "live project" predicate in one place (e.g. `apps/api/src/server.ts` `isLiveProject(project)` helper).
- Both summary and listing paths import that helper.
- Add a unit test in `tests/` that creates one project of each status and asserts both endpoints agree.

**Acceptance**
- Test passes on CI.
- Re-test the original journey 10 times — counts always match.

---

## Bug 7 — Raw error leakage on edge cases

**Severity:** Medium. The original Prisma scopes error was a symptom of a broader pattern: Prisma errors leaking to the UI. Audit Update confirms that specific case is fixed via friendly-error translation, but not globally.

**Audit pass**
Grep API handlers for any unprotected `await prisma.*` paths inside route handlers. Map every Prisma error code (`P2002` unique violation, `P2003` FK, `P2011` null, `P2025` not found) to a user-facing 4xx with a sensible message.

**Fix**
- Add a single `withPrismaErrors(handler)` middleware in `apps/api/src/app.ts` (or extend the existing error handler — grep `errorHandler\|onError`).
- Wrap all CRUD routes with it.
- Server logs the raw error, response body returns `{ error: friendly, code: prismaCode }`.

**Acceptance**
- A scripted unique-violation (e.g. duplicate client name where a unique constraint exists) returns `409` with `{error: "A client with that name already exists.", code: "P2002"}` instead of a 500.
- No raw `Invalid prisma.*.create()` strings reachable through the UI.

---

## Bug 8 — Tailwind class compilation regressions

**Severity:** Low. Ride-along clean-up after Bug 1. Once Tailwind is canonicalised, sweep:
- Any v4-style `@theme {}` blocks in CSS that won't compile under v3 — remove or rewrite.
- Any v3 plugins not on the v4 plugin path if v4 is the chosen direction (e.g. `@tailwindcss/forms`, `@tailwindcss/typography`).
- Run `pnpm --filter web build` and treat **any** Tailwind warning as an error.

**Acceptance**
- Build is warning-clean.
- A visual diff of three high-traffic pages (`/command-centre`, `/projects`, `/quotes`) before/after shows zero unintended changes.

---

## Bug 9 — Wizard validation regression guard

**Severity:** Low. Wizard validation was fixed in the 29 April push. Add a regression test so it doesn't slide back.

**Test**
- Cypress / Playwright (whichever is in `tests/`): start project wizard, submit Step 1 with required fields blank, assert (a) error banner appears, (b) Next button is enabled but does not advance, (c) first invalid input is focused.

**Acceptance**
- Test runs in CI on every PR touching `apps/web/app/components/ProjectCreationWizard*`.

---

## Final pass

After Bugs 1-9 land:

```bash
pnpm -w typecheck
pnpm -w build
pnpm -w test
```

Open a single PR titled `chore(platform): bug-fix sweep (Tailwind, ClientMemory, FS layer, Discovery, errors)` with the eight commits squashed by stream. Tag Jarrud for review.
