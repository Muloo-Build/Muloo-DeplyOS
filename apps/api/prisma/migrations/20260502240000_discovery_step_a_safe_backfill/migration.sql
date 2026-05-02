-- T3 Step A FIX-UP — corrective backfill for the canonical client-input mirror
--
-- The original migration (20260502210000) backfilled ClientInputSubmission
-- rows into DiscoverySubmission using `version = 1_000_000 + sessionNumber`.
-- That formula collides for two portal users on the same project at the
-- same session number on the (projectId, version) unique, and the
-- `ON CONFLICT DO NOTHING` clause meant the second user's row would have
-- been silently dropped on a populated environment.
--
-- 20260502230000 added the partial unique on (projectId, userId,
-- sessionNumber) so the live write path stops colliding, but it did not
-- correct the backfill itself. This migration does:
--
--   1. Identify any ClientInputSubmission rows that have not yet been
--      mirrored into DiscoverySubmission (matched via
--      legacyClientInputSubmissionId, which is uniquely indexed).
--   2. Allocate a unique version per project using ROW_NUMBER() OVER
--      (PARTITION BY "projectId" ORDER BY "createdAt", "id"), starting
--      above the current max canonical version (or above the synthetic
--      floor of 1_000_000 if no canonical mirrors exist yet for the
--      project).
--   3. Insert them with the proper unique versions.
--
-- The query is fully idempotent: it only operates on rows where no
-- mirror exists yet, and it computes its starting offset from the
-- current state of DiscoverySubmission, so re-running this migration
-- on an already-mirrored DB is a no-op. At the time of authoring,
-- ClientInputSubmission has 0 rows, so this also runs as a no-op in
-- the dev/CI environment — but the SQL is correct for any future
-- environment that has historical client-input data.

WITH unmirrored AS (
    SELECT
        cis."id"            AS legacy_id,
        cis."projectId"     AS project_id,
        cis."userId"        AS user_id,
        cis."sessionNumber" AS session_number,
        cis."status"        AS status,
        cis."answers"       AS answers,
        cis."createdAt"     AS created_at,
        cis."updatedAt"     AS updated_at,
        ROW_NUMBER() OVER (
            PARTITION BY cis."projectId"
            ORDER BY cis."createdAt", cis."id"
        ) AS row_in_project
    FROM "ClientInputSubmission" cis
    WHERE NOT EXISTS (
        SELECT 1
        FROM "DiscoverySubmission" ds
        WHERE ds."legacyClientInputSubmissionId" = cis."id"
    )
),
project_floor AS (
    -- Highest canonical version per project, or the floor (1_000_000) - 1
    -- if no canonical rows exist yet for this project. Starting at
    -- floor - 1 means the first ROW_NUMBER (=1) lands at exactly the
    -- floor (1_000_000), keeping the synthetic-version invariant intact.
    SELECT
        u.project_id,
        COALESCE(
            (
                SELECT MAX(ds."version")
                FROM "DiscoverySubmission" ds
                WHERE ds."projectId" = u.project_id
                  AND ds."version" >= 1000000
            ),
            1000000 - 1
        ) AS max_version
    FROM (SELECT DISTINCT project_id FROM unmirrored) u
)
INSERT INTO "DiscoverySubmission" (
    "id",
    "projectId",
    "version",
    "status",
    "userId",
    "sessionNumber",
    "answers",
    "legacyClientInputSubmissionId",
    "createdAt",
    "updatedAt"
)
SELECT
    'cis_' || u.legacy_id,
    u.project_id,
    pf.max_version + u.row_in_project,
    u.status,
    u.user_id,
    u.session_number,
    u.answers,
    u.legacy_id,
    u.created_at,
    u.updated_at
FROM unmirrored u
JOIN project_floor pf ON pf.project_id = u.project_id
ON CONFLICT DO NOTHING;
