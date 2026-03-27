#!/bin/bash
set -e

echo "==> Installing dependencies..."
pnpm install --no-frozen-lockfile

echo "==> Generating Prisma client..."
cd apps/api
npx prisma generate
cd ../..

echo "==> Compiling TypeScript..."
node node_modules/typescript/lib/tsc.js -b tsconfig.json

echo "==> Building Next.js..."
cd apps/web
NODE_ENV=production npx next build
cd ../..

echo "==> Build complete."
