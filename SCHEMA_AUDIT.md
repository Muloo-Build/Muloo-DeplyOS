# Zod Validation Audit

> Inventory generated for `DeployOS_Production_Hardening_Prompt.md` Hardening 1 (Master Queue Row 5). Lists every mutating route in `apps/api/src/app.ts` that accepts a body, with current Zod coverage status.

## Summary

- **Total mutating routes:** 124
- **With body parsing:** 109
- **With Zod validation (existing):** 24
- **Without Zod validation:** 85 (78%)

The new Prisma + Zod error handler at `apps/api/src/app.ts` (added this session) means every route that throws a `ZodError` now returns a structured 400 with `{error: "Validation failed", fields: {...}}` automatically. Adding a `schema.parse(body)` line at the top of any route is enough — no try/catch needed.

## Pattern to apply

```ts
// 1. Define schema near the top of app.ts (or in apps/api/src/schemas/* once split)
const projectStatusUpdateSchema = z.object({
  status: z.enum(["draft", "active", "paused", "completed", "archived"])
});

// 2. Use inside the handler
app.patch("/api/projects/:projectId/status", async (c) => {
  const body = projectStatusUpdateSchema.parse(await readJsonBodyOrEmpty(c));
  const project = await updateProjectRecordStatus(
    c.req.param("projectId"),
    body.status
  );
  return c.json({ project });
});
```

The wrapping try/catch and manual error message can be deleted — the global `app.onError` handler now translates `ZodError` consistently.

## Uncovered routes (85)

Grouped by domain. Effort tag: **S** = trivial schema, **M** = needs the team to confirm body shape from frontend, **L** = bigger payload, multi-step parsing.

### Projects

| Line | Method | Route | Effort | Notes |
|---|---|---|---|---|
| 1907 | PATCH | `/api/projects/:projectId/status` | S | Status enum |
| 2180 | PATCH | `/api/projects/:projectId/sessions/:sessionId` | M | Session payload |
| 3109 | PUT | `/api/projects/:projectId/context/:contextType` | M | Context shape varies |
| 3130 | DELETE | `/api/projects/:projectId/context/:contextType` | S | Likely no body |
| 3151 | POST | `/api/projects/:projectId/run/portal-audit` | M | Audit run options |
| 3201 | POST | `/api/projects/:projectId/portal-audit/generate` | M | Generation options |
| 3421 | DELETE | `/api/projects/:projectId/messages/:messageId` | S | Likely no body |
| 3431 | PATCH | `/api/projects/:projectId/portal-settings` | M | Settings object |
| 3446 | POST | `/api/projects/:projectId/quote/share` | M | Share-to options |
| 3503 | POST | `/api/projects/:projectId/quote/save` | L | Big payload |
| 3537 | POST | `/api/projects/:projectId/quote/meta` | M | Meta object |
| 3632 | POST | `/api/projects/:projectId/email-draft` | M | Draft prompt |
| 3689 | POST | `/api/projects/:projectId/email/draft` | M | Draft prompt (duplicate?) |
| 3716 | POST | `/api/projects/:projectId/send-email` | M | Email payload |
| 3759 | POST | `/api/projects/:projectId/agenda/generate` | S | Generation options |
| 3800 | POST | `/api/projects/:projectId/prepare-brief/generate` | S | Generation options |

### Discovery

| Line | Method | Route | Effort |
|---|---|---|---|
| 2386 | POST | `/api/discovery/save` | M |
| 2409 | POST | `/api/discovery/extract` | M |
| 2422 | POST | `/api/discovery/fetch-doc` | S |

### Runs / Solutions

| Line | Method | Route | Effort |
|---|---|---|---|
| 2455 | PATCH | `/api/runs/:runId` | S |
| 3844 | POST | `/api/solution-options` | M |

### Workspace

| Line | Method | Route | Effort |
|---|---|---|---|
| 3927 | PUT | `/api/workspace/hubspot-settings` | M |
| 3972 | POST | `/api/workspace/todos` | S |
| 3987 | PATCH | `/api/workspace/todos/:todoId` | S |
| 4002 | DELETE | `/api/workspace/todos/:todoId` | S |
| 4016 | DELETE | `/api/workspace/todos` | S |
| 4028 | POST | `/api/workspace/email/draft` | M |
| 4045 | POST | `/api/workspace/email/send` | M |
| 4064 | POST | `/api/workspace/todos/from-email` | M |
| 4108 | POST | `/api/workspace/private-tasks` | S |
| 4125 | PATCH | `/api/workspace/private-tasks/:taskId` | S |
| 4144 | DELETE | `/api/workspace/private-tasks/:taskId` | S |
| 4160 | PATCH | `/api/workspace/email-filter` | S |
| 4212 | PATCH | `/api/workspace/calendar/connection` | S |
| 4237 | POST | `/api/workspace/api-keys` | S |
| 4514 | POST | `/api/workspace/summary/generate` | S |
| 4535 | PATCH | `/api/workspace/ai-routing/:workflowKey` | M |

### Quotes (Quick Quote system)

| Line | Method | Route | Effort |
|---|---|---|---|
| 4430 | POST | `/api/quotes/quick` | L |
| 4445 | POST | `/api/quotes/:quoteId/edit` | L |
| 4463 | POST | `/api/quotes/:quoteId/hubspot-link` | S |
| 4483 | POST | `/api/quotes/:quoteId/hubspot-sync` | S |
| 4497 | POST | `/api/quotes/:quoteId/recall` | S |
| 6184 | POST | `/api/client/quotes/:quoteId/approve` | M |

### Products / Retainers / Invoices

| Line | Method | Route | Effort |
|---|---|---|---|
| 4560 | POST | `/api/products` | M |
| 4584 | PATCH | `/api/products/:productId` | M |
| 4631 | POST | `/api/retainers` | M |
| 4655 | DELETE | `/api/retainers/:retainerId` | S |
| 4672 | POST | `/api/retainers/:retainerId/top-ups` | M |
| 4692 | POST | `/api/retainers/:retainerId/top-ups/:topUpId/approve` | S |
| 4711 | POST | `/api/retainers/:retainerId/log-hours` | M |
| 4848 | POST | `/api/invoices` | L |
| 4885 | PATCH | `/api/invoices/:invoiceId` | L |

### Agencies / Agents / Templates / Work Requests

| Line | Method | Route | Effort |
|---|---|---|---|
| 4784 | POST | `/api/agencies` | M |
| 4809 | PATCH | `/api/agencies/:agencyId` | M |
| 5079 | POST | `/api/agents` | L |
| 5106 | PATCH | `/api/agents/:agentId` | L |
| 5139 | POST | `/api/delivery-templates` | M |
| 5157 | PATCH | `/api/delivery-templates/:templateId` | M |
| 5184 | POST | `/api/work-requests` | M |
| 5202 | PATCH | `/api/work-requests/:requestId` | M |
| 5223 | POST | `/api/work-requests/:requestId/convert` | M |
| 5242 | POST | `/api/work-requests/:requestId/append-to-delivery` | M |

### HubSpot / Portals

| Line | Method | Route | Effort |
|---|---|---|---|
| 5274 | POST | `/api/hubspot/agent-execute` | M |
| 5292 | POST | `/api/hubspot/agent-request` | M |
| 5314 | POST | `/api/hubspot/oauth/start` | S |
| 5332 | POST | `/api/hubspot/oauth/callback` | S |
| 5375 | POST | `/api/portals/:portalId/snapshot` | S |
| 5398 | POST | `/api/portals` | M |
| 5430 | POST | `/api/portals/:portalId/mark-connected` | S |

### Clients / Contacts / Users

| Line | Method | Route | Effort |
|---|---|---|---|
| 5486 | POST | `/api/clients` | M |
| 5523 | PATCH | `/api/clients/:clientId` | M |
| 5572 | DELETE | `/api/clients/:clientId` | S |
| 5589 | POST | `/api/clients/:clientId/enrich` | S |
| 5608 | POST | `/api/clients/:clientId/contacts` | M |
| 5641 | PATCH | `/api/clients/:clientId/contacts/:contactId` | M |
| 5715 | POST | `/api/users` | M |
| 5733 | PATCH | `/api/users/:userId` | M |

### Settings / Connections

| Line | Method | Route | Effort |
|---|---|---|---|
| 5751 | PATCH | `/api/provider-connections/:providerKey` | S |
| 5772 | PATCH | `/api/ai-routing/:workflowKey` | M |
| 5793 | PATCH | `/api/email-settings` | M |
| 5811 | PATCH | `/api/email-oauth/google` | S |
| 5829 | DELETE | `/api/email-oauth/google` | S |
| 5846 | POST | `/api/email-oauth/google/start` | S |
| 5863 | POST | `/api/email-oauth/google/callback` | S |
| 6424 | POST | `/api/portal-session` | S |

## Recommended sweep order

1. **Tier 1 — quick wins (S effort, ~30 routes):** statuses, no-body deletes, OAuth start/callback. One sitting can clear them all.
2. **Tier 2 — domain wins (M effort, ~40 routes):** clients, products, retainers, work-requests. Each takes 5-10 mins to read the existing handler and write a permissive schema.
3. **Tier 3 — big payloads (L effort, ~10 routes):** quote save/edit, invoices, agents, blueprints. Treat each as its own micro-PR; the schemas are large and mistakes have user-visible blast radius.

For each route:
1. Read the handler.
2. Look at the frontend caller (grep the URL pattern in `apps/web/`).
3. Write a permissive schema (use `.optional()` and `.passthrough()` liberally on first pass).
4. Apply at the top of the handler.
5. Tighten the schema in a follow-up once you've watched it not fire false positives in staging.

## What's already covered (24 routes)

Auth login/logout, client auth, assistant chat (internal + portal), task status / approve / reject / execute, project task template load, portal private app token, marketing dashboard, research request, cowork start/complete, project status (added in this audit work). Confirmed via `.parse()` / `.safeParse()` calls within ~60 lines of each route declaration.
