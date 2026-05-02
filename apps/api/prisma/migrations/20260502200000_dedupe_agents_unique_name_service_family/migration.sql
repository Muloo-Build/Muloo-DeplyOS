-- T2: Dedupe AgentDefinition rows and add (name, serviceFamily) unique index.
--
-- Survivor selection rule per (name, serviceFamily) bucket:
--   ORDER BY "updatedAt" DESC, id DESC  (id break-tie keeps survivor deterministic)
--
-- Steps (atomic via Prisma migrate's implicit transaction):
--   1) Reassign any Task.assignedAgentId pointing at a loser → survivor.
--   2) Delete the loser AgentDefinition rows.
--   3) Add the unique index.
--
-- Pre-flight audit (read-only, executed manually before this migration ran in
-- dev — see ./RUNBOOK.md for the captured report and the snapshot ID).

WITH ranked AS (
  SELECT
    id,
    name,
    "serviceFamily",
    ROW_NUMBER() OVER (
      PARTITION BY name, "serviceFamily"
      ORDER BY "updatedAt" DESC, id DESC
    ) AS rn
  FROM "AgentDefinition"
),
losers AS (
  SELECT
    r.id   AS loser_id,
    s.id   AS survivor_id
  FROM ranked r
  JOIN ranked s
    ON s.name = r.name
   AND s."serviceFamily" = r."serviceFamily"
   AND s.rn = 1
  WHERE r.rn > 1
)
UPDATE "Task" t
SET "assignedAgentId" = l.survivor_id
FROM losers l
WHERE t."assignedAgentId" = l.loser_id;

DELETE FROM "AgentDefinition" a
USING (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY name, "serviceFamily"
      ORDER BY "updatedAt" DESC, id DESC
    ) AS rn
  FROM "AgentDefinition"
) ranked
WHERE a.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX "AgentDefinition_name_serviceFamily_key"
  ON "AgentDefinition"("name", "serviceFamily");
