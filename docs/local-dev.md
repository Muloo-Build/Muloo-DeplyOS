# Local Development

This repo expects a local Postgres instance for smoke tests and retainer verification work. The default setup uses Docker Compose and binds Postgres to `127.0.0.1:5432`.

## Prerequisites

- Docker Desktop or OrbStack running locally
- Node.js and `pnpm`

## Default local database

The repo's local default is:

- Host: `127.0.0.1`
- Port: `5432`
- Database: `muloo_smoke`
- Username: `smoke`
- Password: `smoke`

The matching local `DATABASE_URL` in [.env.example](/Users/jarrudvandermerwe/Work/03 Projects/Muloo-DeplyOS/.env.example) is:

```env
DATABASE_URL=postgresql://smoke:smoke@127.0.0.1:5432/muloo_smoke
```

## First run

1. Copy `.env.example` to `.env` if you do not already have one.
2. Start Postgres:

```bash
pnpm db:up
```

3. Apply migrations and seed retainer scenarios:

```bash
pnpm db:migrate
pnpm db:seed:retainers
```

If you want a full wipe-and-reseed:

```bash
pnpm db:reset
```

`db:reset` removes the Postgres volume, starts a fresh database, applies migrations, and reseeds the retainer scenarios.

## Smoke tests

Smoke tests now assume the local Postgres container is up first:

```bash
pnpm db:up
pnpm test:smoke
```

## Useful commands

```bash
pnpm db:up
pnpm db:down
pnpm db:reset
pnpm db:migrate
pnpm db:seed:retainers
```

## GUI clients

You can inspect the local database in TablePlus, DBeaver, or Postico with:

- Host: `127.0.0.1`
- Port: `5432`
- Database: `muloo_smoke`
- Username: `smoke`
- Password: `smoke`

## Troubleshooting

### Port 5432 already in use

Something else is already bound to local Postgres. Stop the other service, or change the host port mapping in [docker-compose.yml](/Users/jarrudvandermerwe/Work/03 Projects/Muloo-DeplyOS/docker-compose.yml) and update `DATABASE_URL` to match.

### Stale data or weird migration state

Start fresh:

```bash
pnpm db:reset
```

### Docker says the container is healthy but the app still cannot connect

Wait a few seconds and rerun `pnpm db:up`. The script already waits for the TCP port, but first-run volume initialization can still take a moment on slower machines.

### Seed script refuses to run

The seed/reset scripts intentionally refuse to run against a non-local `DATABASE_URL`. If your `.env` points at Railway or another shared host, override it with the localhost URL before running local setup.
