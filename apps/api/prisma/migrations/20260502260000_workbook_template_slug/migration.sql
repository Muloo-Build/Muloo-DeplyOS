-- T3 Step A FIX-UP — give WorkbookTemplate a stable, non-editable seed
-- identity (`slug`) so the boot upsert cannot duplicate or overwrite
-- operator-edited templates if their title is changed in-product.
--
-- The previous fix-up made `title` unique so we could call
-- prisma.upsert(where: { title }), but title is operator-editable: a
-- rename in the UI would cause the next boot to recreate the original
-- "canonical" title (because the upsert no longer finds a match) and
-- to overwrite seeded metadata fields against the original title.
--
-- A `slug` column matches how `DeliveryTemplate` already keys its
-- seed identity (slug @unique).
--
-- Backfill strategy: for the 3 known seeded titles we set the slug to
-- a stable kebab-cased identity. Any operator-created templates keep a
-- NULL slug (Postgres treats NULLs as distinct under a UNIQUE index by
-- default, so multiple NULL-slug rows are allowed). The seed code uses
-- prisma.upsert(where: { slug: <known slug> }), so operator rows are
-- never touched by the boot seed.

ALTER TABLE "WorkbookTemplate"
  ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- Backfill slugs for the three known seeded titles. Idempotent: only
-- writes the slug when it isn't already set.
UPDATE "WorkbookTemplate"
   SET "slug" = 'business-discovery-workbook'
 WHERE "slug" IS NULL
   AND "title" = 'Business Discovery Workbook';

UPDATE "WorkbookTemplate"
   SET "slug" = 'platform-architecture-workbook'
 WHERE "slug" IS NULL
   AND "title" = 'Platform Architecture Workbook';

UPDATE "WorkbookTemplate"
   SET "slug" = 'data-and-migration-workbook'
 WHERE "slug" IS NULL
   AND "title" = 'Data and Migration Workbook';

CREATE UNIQUE INDEX IF NOT EXISTS "WorkbookTemplate_slug_key"
  ON "WorkbookTemplate" ("slug");
