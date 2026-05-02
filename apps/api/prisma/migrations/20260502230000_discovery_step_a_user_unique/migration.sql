-- T3 Step A FIX — partial unique on canonical client-input mirror
--
-- The earlier migration (20260502210000) added the additive columns and
-- a non-unique index on (projectId, userId, sessionNumber). The legacy
-- ClientInputSubmission table is uniquely keyed by
-- (projectId, userId, sessionNumber), but the canonical DiscoverySubmission
-- only had a unique on (projectId, version). Mirroring with
-- version = 1_000_000 + sessionNumber would collide for two portal users
-- on the same project at the same session number — the second writer
-- would lose its row. At apply time of 20260502210000 there were 0 rows
-- in ClientInputSubmission so no data was actually corrupted, but the
-- live write path needed fixing before any real client-input traffic
-- arrives.
--
-- This migration:
--   1. Adds a partial unique index on (projectId, userId, sessionNumber)
--      so the live write path can upsert on the same composite key the
--      legacy table uses.
--   2. Leaves the (projectId, version) unique alone — it still applies to
--      the original per-section discovery submissions (version starts at
--      1) AND to the mirrored client-input rows (which we now allocate
--      version dynamically per project, see saveClientInputSubmission).

CREATE UNIQUE INDEX IF NOT EXISTS
    "DiscoverySubmission_projectId_userId_sessionNumber_unique"
    ON "DiscoverySubmission"("projectId", "userId", "sessionNumber")
    WHERE "userId" IS NOT NULL AND "sessionNumber" IS NOT NULL;
