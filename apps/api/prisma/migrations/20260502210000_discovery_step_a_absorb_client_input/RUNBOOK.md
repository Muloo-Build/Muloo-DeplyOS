# T3 Step A — Discovery model unification (additive)

## Inventory at time of authoring

| Model                   | Rows | Distinct projects | Latest     | Notes                                                                                          |
|-------------------------|------|-------------------|------------|------------------------------------------------------------------------------------------------|
| `DiscoverySubmission`   | 8    | 2                 | 2026-04-28 | Per-section discovery payload. Canonical for **session payloads**.                             |
| `ClientInputSubmission` | 0    | 0                 | n/a        | Legacy unused write path. True duplicate; absorbed here. Dropped in Step B follow-up.          |
| `DiscoveryEvidence`     | 17   | 4                 | today      | Repurposed as the **workbook backing store** (`kind:"workbook"`, `workbookContent` jsonb).     |

## Canonical-model recommendation (the unification decision)

The audit framed this as "three overlapping discovery models → one canonical."
The data shows the picture is different and the recommendation Step A locks
in is:

- **Sessions** → `DiscoverySubmission` is the single canonical. Absorbs
  `userId`, `sessionNumber`, `answers`, `legacyClientInputSubmissionId`
  (Step A) and is the only table read after the cutover (Step B).
- **Workbooks** → `DiscoveryEvidence` (with `kind:"workbook"`,
  `workbookContent` jsonb) remains the canonical. It is **not** an
  overlapping duplicate of `DiscoverySubmission` — it stores a different
  shape (rich workbook content, contributors, evidence sources) that
  serves a different surface (operator workbooks, not client sessions).

Folding `DiscoveryEvidence` into `DiscoverySubmission` would be a much
larger, riskier refactor with no user-facing benefit and would break the
workbook surfaces. We treat sessions and workbooks as two clearly-bounded
canonicals and document the boundary instead. **This deviates from the
audit's "one canonical" framing — flagged here for explicit sign-off.**

So the cutover collapses to: deprecate `ClientInputSubmission`, keep
`DiscoverySubmission` (sessions) and `DiscoveryEvidence` (workbooks) as
two clearly-bounded canonicals.

## What this migration does

1. Adds `userId`, `sessionNumber`, `answers`, `legacyClientInputSubmissionId`
   columns to `DiscoverySubmission` (all nullable, additive only).
2. Adds index `(projectId, userId, sessionNumber)` and a partial unique on
   `legacyClientInputSubmissionId` to make backfill idempotent.
3. Backfills any `ClientInputSubmission` rows into `DiscoverySubmission`.
   At apply time this is a no-op (0 rows).
4. Re-categorises `DiscoveryQuestionLibraryItem.category` from the legacy
   13-value snake_case set to the canonical 12-value list. Idempotent.

> **Follow-up `20260502230000_discovery_step_a_user_unique`** — adds the
> partial unique index on `(projectId, userId, sessionNumber)` that this
> migration's backfill should have added. Without that index, two portal
> users on the same project at the same session number would mirror onto
> a single canonical row (the original `1_000_000 + sessionNumber` version
> formula collides across users on `(projectId, version)`).
>
> **Follow-up `20260502240000_discovery_step_a_safe_backfill`** —
> corrective backfill that re-mirrors any unmirrored `ClientInputSubmission`
> rows using `ROW_NUMBER() OVER (PARTITION BY projectId ORDER BY createdAt, id)`
> to allocate a unique version per project starting above
> `MAX(canonical version)`. Idempotent: a row that already has a
> canonical mirror (matched via `legacyClientInputSubmissionId`) is
> skipped. At the time of authoring `ClientInputSubmission` has 0 rows,
> so this is a no-op on dev/CI — but the SQL is correct for any future
> environment that has historical client-input data, replacing the
> `ON CONFLICT DO NOTHING` silent-drop in the original backfill.
>
> The live write path (`saveClientInputSubmission`) was rewritten to
> match: it allocates `version` dynamically per project inside the
> transaction with a retry-on-`P2002`-version-conflict loop (max 5
> attempts), so concurrent writers for two different `(userId,
> sessionNumber)` tuples on the same project always succeed. Conflicts
> on the partial `(projectId, userId, sessionNumber)` unique re-throw
> immediately so the caller sees the duplicate-write loud-fail. At the
> time of the original migration `ClientInputSubmission` had 0 rows so
> no data was actually corrupted, but this is the "fix the unique key
> + concurrency-safe writes before any real client-input traffic arrives"
> patch.

## Feature flags

Two independent env flags govern the cutover. Defaults preserve existing
behaviour so apply + restart is safe with no operator action.

| Env var                                    | Default | When `on`                                                                       | When `off`                                                                |
|--------------------------------------------|---------|---------------------------------------------------------------------------------|---------------------------------------------------------------------------|
| `DISCOVERY_LEGACY_CLIENT_INPUT_WRITES`     | `on`    | `saveClientInputSubmission` writes to BOTH legacy + canonical (in one $transaction) | Skips the legacy write — only writes the canonical.                        |
| `DISCOVERY_CANONICAL_READS`                | `off`   | All four read paths read from `DiscoverySubmission` (filtered to the mirrored rows).  | All four read paths read from `ClientInputSubmission` (current behaviour). |

Recommended cutover sequence:

1. Apply Step A. Both flags at default → app behaves exactly as before but
   now mirrors writes into `DiscoverySubmission`.
2. After ≥48h of clean dual-write, set `DISCOVERY_CANONICAL_READS=on`.
   Reads now come from canonical; legacy keeps being written so a flip
   back is instant.
3. After ≥1 week with `DISCOVERY_CANONICAL_READS=on` and no parity drift,
   set `DISCOVERY_LEGACY_CLIENT_INPUT_WRITES=off`. Legacy table goes
   read-only.
4. Run Step B (drop the legacy table) — see below.

## Read paths covered by the canonical-reads switch

All four legacy read paths are now wrapped behind the canonical-aware
helper `loadDiscoveryClientSubmissionsForRead` (and the
with-users variant for the operator list). When
`DISCOVERY_CANONICAL_READS=on` they read from `DiscoverySubmission`
filtered to `version >= 1_000_000` AND `userId IS NOT NULL`.

- `apps/api/src/server.ts` — internal project context loader (assistant prep)
- `loadClientProjectDetail` — client portal session list
- `loadPortalAssistantProjectContext` — portal AI context
- `loadProjectClientInputSubmissions` — operator-facing list (uses the
  with-users variant: `DiscoverySubmission` lacks a `user` relation, so
  we hand-stitch `ClientPortalUser` rows by `userId`).

The dual-write in `saveClientInputSubmission` is wrapped in
`prisma.$transaction`, so during the soak the two stores stay in
lockstep — flipping the read flag is safe at any time.

## Chase mechanics defaults

T3 also wires defaults so workbook chase signals never go dark:

- New workbooks (both `createDiscoveryEvidence` with `kind:"workbook"`
  and the template-spawn path) default `dueDate` to **+5 business days**
  when no explicit date is provided.
- They default `ownerName` to the project's **client champion** (full
  name, falling back to email) when no owner is provided.
- The overdue rule is unchanged: workbook is overdue when
  `dueDate < now()` AND any question still has `status:"unanswered"`.
- Per-question owner / due date is **deferred (YAGNI)** to a follow-up
  task — workbook-level granularity is sufficient for v1 chase.

## Boot seed

`apps/api/src/index.ts` calls `ensureDeliveryTemplatesSeeded()` and
`ensureWorkbookTemplatesSeeded()` at server boot inside a
`Promise.allSettled`, so a transient DB hiccup at startup logs a warning
but does not block the API from coming up. Both seed functions upsert by
stable identity (`slug` for delivery templates, `title` for workbook
templates), so they're safe to run on every boot. The lazy seed in
`loadWorkbookTemplates` / `loadDeliveryTemplates` remains as a fallback
for any caller that hits the loader before boot completes.

## Soak window

Minimum **1 week** between Step A apply and Step B prep. Monitor:
- Any errors from `loadProjectClientInputSubmissions` paths.
- Row counts in `DiscoverySubmission` filtered by
  `legacyClientInputSubmissionId IS NOT NULL` (should equal the count of
  any `ClientInputSubmission` rows that arrive during the soak).

## Rollback (Step A)

Step A is fully additive. Rollback = stop reading the new columns
(`DISCOVERY_CANONICAL_READS=off` is the in-app kill switch — no deploy
needed) and run a reverse migration:

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

## Step B prep (separate migration, after soak)

Before running Step B:

1. Confirm `DISCOVERY_CANONICAL_READS=on` AND
   `DISCOVERY_LEGACY_CLIENT_INPUT_WRITES=off` have both been live for
   the full soak window with no regressions.
2. Take an on-demand DB snapshot. **Log the snapshot ID at the top of the
   Step B RUNBOOK before running the migration.**
3. Step B drops `ClientInputSubmission`, removes the
   `saveClientInputSubmission` / `loadProjectClientInputSubmissions`
   server functions' legacy branches, removes both env flags, and
   removes the `legacyClientInputSubmissionId` column once no rollback
   is plausible.

## Sub-decision sign-off

- Canonical = `DiscoverySubmission` for sessions, `DiscoveryEvidence` for
  workbooks. **Deviates from the audit's "one canonical" framing —
  needs explicit sign-off.**
- Feature flag mechanism = `process.env`. Two independent booleans, no
  DB plumbing.
- Soak window = 1 week minimum.
- Canonical category list = the 12 entries in
  `apps/web/app/components/questionLibraryConstants.ts` →
  `CANONICAL_CATEGORIES`. Mirrored server-side in
  `apps/api/src/discoveryQuestionCategories.ts` (drift risk filed as a
  follow-up to move into `packages/shared`).
- Chase defaults: workbook `dueDate` = +5 business days, `ownerName` =
  project client champion. Per-question owner/due date deferred (YAGNI).
