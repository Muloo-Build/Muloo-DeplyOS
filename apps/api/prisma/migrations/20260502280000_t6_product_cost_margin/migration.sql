-- T6.1 — Add cost / currency / marginTarget to ProductCatalogItem so the
-- Quote builder can show live gross margin. cost / marginTarget are nullable
-- so existing products gracefully degrade (no margin shown until an operator
-- fills in the cost). currency defaults to ZAR to match existing pricing.
ALTER TABLE "ProductCatalogItem"
  ADD COLUMN IF NOT EXISTS "cost" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'ZAR',
  ADD COLUMN IF NOT EXISTS "marginTarget" DOUBLE PRECISION;
