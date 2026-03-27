# Muloo Deploy OS

Internal execution platform for Muloo delivery operations and HubSpot onboarding automation.

## Architecture

This is a **pnpm monorepo** with the following structure:

- `apps/web` — Next.js 14 frontend (served on port 5000)
- `apps/api` — Hono/Node.js API backend (served on port 3001 by default)
- `packages/` — Shared libraries (config, shared, hubspot-client, executor, etc.)

## Running on Replit

The workflow `Start application` runs:
```
pnpm install --no-frozen-lockfile && cd apps/web && pnpm dev
```

This starts the Next.js frontend only. The API backend requires additional environment variables to function.

## Environment Variables Required

See `.env.example` for a full list. Key variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis for job queue (BullMQ) |
| `HUBSPOT_ACCESS_TOKEN` | HubSpot private app token |
| `HUBSPOT_PORTAL_ID` | HubSpot portal ID |
| `OPENAI_API_KEY` | OpenAI API key |
| `API_PORT` | API server port (default: 3001) |

## Starting the Full Stack

To run both frontend and API:
```
pnpm install --no-frozen-lockfile && pnpm dev
```

The root `pnpm dev` script (`scripts/run-services.js dev`) will:
1. Run `prisma generate` in `apps/api`
2. Compile TypeScript for the monorepo
3. Start both the Next.js frontend (port 5000) and the API (port 3001)

Note: The API startup requires `DATABASE_URL` (Prisma) and `REDIS_URL` (BullMQ).

## Key Config Files

- `apps/web/next.config.js` — Next.js config, proxies `/api/*` to the API server
- `apps/api/src/index.ts` — API entry point
- `scripts/run-services.js` — Orchestrates dev/start for both services
- `.env.example` — Template for environment variables

## Port Configuration

- Frontend: port **5000** (Replit webview)
- API: port **3001** (configurable via `API_PORT` env var)

## Package Manager

Uses **pnpm** (v10+, included with nodejs-18 module). The `packageManager` field was removed from root `package.json` to avoid corepack version enforcement issues on Replit.

## Completed Features (recent)

- **DB migration**: `executionTier` and `coworkInstruction` columns added to `ExecutionJob` table
- **AI assistant**: Enhanced with live workspace context (active projects, clients, open tasks, blocked counts)
- **Client project workspace**: Messaging thread added at bottom for client-visible comms
- **Comms tab**: `ProjectMessagesPanel` allows operators to send client-visible messages per project
- **Human QA review panel**: Added to Delivery Board — shows agent output summary when `qaRequired=true` and the execution job completes; operators can "Mark QA Passed" (→ done) or "Send Back for Rework" (→ todo)
- **Task status transitions**: Updated to allow `in_progress → todo` and `done → todo` for rework scenarios
- **`outputSummary`**: Now returned in all serialized task `latestExecutionJob` responses from the API
