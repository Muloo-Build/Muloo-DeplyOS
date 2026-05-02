#!/bin/bash
set -e

# Post-merge setup for Muloo Deploy OS.
# Idempotent and non-interactive — safe to re-run.

pnpm install --no-frozen-lockfile

# Generate Prisma client (cheap; runs against current schema).
pnpm --filter ./apps/api run generate

# Apply any new migrations to the dev database. Additive migrations are safe;
# destructive ones must already have been authored to be backwards-compatible.
pnpm --filter ./apps/api run migrate
