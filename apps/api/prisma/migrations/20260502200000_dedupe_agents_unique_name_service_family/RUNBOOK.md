# Runbook — Dedupe AgentDefinition + add `(name, serviceFamily)` unique index

## Why
`AgentDefinition` had no uniqueness constraint on `(name, serviceFamily)` and
the seed (`ensureAgentCatalogSeeded`) was producing visible duplicates (e.g.
"Scope & Commercial Agent" appeared twice in the workspace).

## Pre-flight audit (captured at T-minus-zero in dev)

```
SELECT name, "serviceFamily", COUNT(*) AS dup_count,
       array_agg(id ORDER BY "updatedAt" DESC) AS ids,
       array_agg("updatedAt" ORDER BY "updatedAt" DESC) AS updated_ats
FROM "AgentDefinition"
GROUP BY name, "serviceFamily"
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, name;
```

Result on dev DB at migration authoring time:

| name                       | serviceFamily        | dup_count | survivor_id (max updatedAt)   | loser_ids
| -------------------------- | -------------------- | --------- | ----------------------------- | --------------------------
| Scope & Commercial Agent   | hubspot_architecture | 2         | `cmn66e0y9002gvpexxc0i6aru`   | `cmmwc14gx00026xxqkolegqed`

FK reference audit on losers:

```
SELECT "assignedAgentId", COUNT(*) FROM "Task"
WHERE "assignedAgentId" IN (<loser ids>) GROUP BY "assignedAgentId";
```

Result: **0 rows** — no `Task.assignedAgentId` rows pointed at the loser, so
the FK reassignment step is a no-op in dev. The migration still includes the
reassignment defensively for prod.

## Survivor selection rule
`MAX(updatedAt)` per `(name, serviceFamily)`, with `id DESC` as the
deterministic tie-breaker.

## Snapshot policy (PROD)
Before running `pnpm prisma migrate deploy` on prod:

1. Take an on-demand snapshot of the production database via the platform
   console (Replit DB → Snapshots → Create snapshot).
2. Record the snapshot ID and timestamp here in this section before
   continuing:

   ```
   prod_snapshot_id: <fill in at deploy time>
   prod_snapshot_taken_at: <ISO timestamp>
   migration_run_at: <ISO timestamp>
   ```

3. Re-run the pre-flight audit against prod and append the result here so we
   know exactly which rows were collapsed.

## Rollback

- **Schema**: drop the unique index in a follow-up migration:
  `DROP INDEX "AgentDefinition_name_serviceFamily_key";`
- **Data**: deleted duplicate rows cannot be reconstructed from app state.
  Restore from the prod snapshot recorded above.
- **Code**: revert this migration directory + the `@@unique` line in
  `apps/api/prisma/schema.prisma` + the directory UI commit.

## Post-merge verification
1. `SELECT name, "serviceFamily", COUNT(*) FROM "AgentDefinition"
    GROUP BY name, "serviceFamily" HAVING COUNT(*) > 1;` → 0 rows.
2. `SELECT COUNT(*) FROM "Task" t LEFT JOIN "AgentDefinition" a
    ON a.id = t."assignedAgentId" WHERE t."assignedAgentId" IS NOT NULL
    AND a.id IS NULL;` → 0 (no orphaned FKs).
3. Open Agents directory, confirm only one "Scope & Commercial Agent" row.
