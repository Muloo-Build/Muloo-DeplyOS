# T3 Step A — Discovery model unification (additive)

## Inventory at time of authoring

| Model                   | Rows | Distinct projects | Latest     | Notes                                                                                          |
|-------------------------|------|-------------------|------------|------------------------------------------------------------------------------------------------|
| `DiscoverySubmission`   | 8    | 2                 | 2026-04-28 | Per-section discovery payload. Canonical for **session payloads**.                             |
| `ClientInputSubmission` | 0    | 0                 | n/a        | Legacy unused write path. True duplicate; absorbed here. Dropped in Step B follow-up.          |
| `DiscoveryEvidence`     | 17   | 4                 | today      | Repurposed as the **workbook backing store** (`kind:"workbook"`, `workbookContent` jsonb).     |

## Deviation from the audit framing

The audit phase 4.1 assumed three overlapping models needed unification onto
one canonical. The data shows the picture is different:

- `ClientInputSubmission` is the only true duplicate — it has zero rows and
  no live read path that can't be served by `DiscoverySubmission`. Step A
  absorbs its shape; Step B drops the table.
- `DiscoveryEvidence` is **not** duplicate. It's the active workbook store
  used by every workbook surface (`/api/projects/:id/workbooks`,
  `loadProjectWorkbooks`, `WorkbookContentEditor`). Folding it into
  `DiscoverySubmission` would be a much larger, riskier refactor with no
  user-facing benefit. We treat it as the canonical workbook model and
  document the boundary instead.

So the cutover collapses to: deprecate `ClientInputSubmission`, keep
`DiscoverySubmission` (sessions) and `DiscoveryEvidence` (workbooks) as
two clearly-bounded canonicals.

## What this migration does

1. Adds `userId`, `sessionNumber`, `answers`, `legacyClientInputSubmissionId`
   columns to `DiscoverySubmission` (all nullable, additive only).
2. Adds index `(projectId, userId, sessionNumber)` and a partial unique on
   `legacyClientInputSubmissionId` to make backfill idempotent.
3. Backfills any `ClientInputSubmission` rows into `DiscoverySubmission`.
   At apply time this is a no-op (0 rows). The backfill writes a
   synthetic version `1000000 + sessionNumber` so it cannot collide with
   the existing `(projectId, version)` unique used by real session payloads.
4. Re-categorises `DiscoveryQuestionLibraryItem.category` from the legacy
   13-value snake_case set to the canonical 12-value list. Idempotent.

## Feature flag

`DISCOVERY_LEGACY_CLIENT_INPUT_WRITES` (default: `on`).

- `on` — `saveClientInputSubmission` writes to BOTH
  `ClientInputSubmission` and `DiscoverySubmission` (mirrored). Reads always
  come from the canonical (`DiscoverySubmission`).
- `off` — write path skips `ClientInputSubmission`. Use this once Step A
  has soaked for at least a week and the team is ready for Step B.

## Soak window

Minimum **1 week** between Step A apply and Step B prep. Monitor:
- Any errors from `loadProjectClientInputSubmissions` paths.
- Row counts in `DiscoverySubmission` filtered by
  `legacyClientInputSubmissionId IS NOT NULL` (should equal the count of
  any `ClientInputSubmission` rows that arrive during the soak).

## Rollback (Step A)

Step A is fully additive. Rollback = stop reading the new columns (no app
deploy needed; the feature flag is the kill switch) and run a reverse
migration:

```sql
DROP INDEX IF EXISTS "DiscoverySubmission_legacyClientInputSubmissionId_key";
DROP INDEX IF EXISTS "DiscoverySubmission_projectId_userId_sessionNumber_idx";
ALTER TABLE "DiscoverySubmission"
  DROP COLUMN IF EXISTS "legacyClientInputSubmissionId",
  DROP COLUMN IF EXISTS "answers",
  DROP COLUMN IF EXISTS "sessionNumber",
  DROP COLUMN IF EXISTS "userId";
```

The category re-categorisation is left in place on rollback — no rollback
SQL is provided for that change because it lands the data into the right
home regardless of whether the additive Step A holds.

## Read-path migration (prerequisite for Step B)

Step A intentionally keeps the four read paths pointed at `ClientInputSubmission` because the dual-write keeps that table populated. **Before** Step B drops the legacy table, the following call sites must be repointed at `DiscoverySubmission` (filter: `version >= 1_000_000` AND `userId IS NOT NULL`):

- `apps/api/src/server.ts:11510` — internal project context loader (assistant prep)
- `apps/api/src/server.ts:23606` — `loadClientProjectDetail` (client portal session list)
- `apps/api/src/server.ts:23703` — `loadPortalAssistantProjectContext` (portal AI context)
- `apps/api/src/server.ts:24207` — `loadProjectClientInputSubmissions` (operator-facing list)

Because `DiscoverySubmission` does not have a `user` relation, the operator-facing list (24207) needs a hand-roll join to `User` by `userId` (or a schema relation added in Step B). The other three return shapes are simpler and just need `serializeClientInputSubmission` to accept the canonical row shape.

Atomicity: the dual-write in `saveClientInputSubmission` is wrapped in `prisma.$transaction`, so during the soak the two tables stay in lockstep — flipping `DISCOVERY_LEGACY_CLIENT_INPUT_WRITES=off` is safe once the read-path migration above lands.

## Step B prep (separate migration, after soak)

Before running Step B:

1. Confirm `DISCOVERY_LEGACY_CLIENT_INPUT_WRITES=off` has been live for
   the full soak window with no regressions.
2. Take an on-demand DB snapshot. **Log the snapshot ID at the top of the
   Step B RUNBOOK before running the migration.**
3. Step B drops `ClientInputSubmission`, removes the
   `saveClientInputSubmission` / `loadProjectClientInputSubmissions` server
   functions, and removes the `legacyClientInputSubmissionId` column once
   no rollback is plausible.

## Sub-decision sign-off

- Canonical = `DiscoverySubmission` for sessions, `DiscoveryEvidence` for
  workbooks. Documented above.
- Feature flag mechanism = `process.env`. Single boolean, no DB plumbing.
- Soak window = 1 week minimum.
- Canonical category list = the 12 entries in
  `apps/web/app/components/questionLibraryConstants.ts` →
  `CANONICAL_CATEGORIES`. Mirrored server-side.
