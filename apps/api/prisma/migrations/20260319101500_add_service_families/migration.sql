ALTER TABLE "ProductCatalogItem"
ADD COLUMN "serviceFamily" TEXT NOT NULL DEFAULT 'hubspot_architecture';

UPDATE "ProductCatalogItem"
SET "serviceFamily" = CASE
  WHEN "name" ILIKE '%automation%' THEN 'ai_automation'
  WHEN "name" ILIKE '%integration%' THEN 'custom_engineering'
  ELSE 'hubspot_architecture'
END;

ALTER TABLE "DeliveryTemplate"
ADD COLUMN "serviceFamily" TEXT NOT NULL DEFAULT 'hubspot_architecture';

UPDATE "DeliveryTemplate"
SET "serviceFamily" = CASE
  WHEN "category" = 'website' THEN 'custom_engineering'
  ELSE 'hubspot_architecture'
END;

ALTER TABLE "WorkRequest"
ADD COLUMN "serviceFamily" TEXT NOT NULL DEFAULT 'hubspot_architecture';

UPDATE "WorkRequest"
SET "serviceFamily" = CASE
  WHEN "requestType" = 'change_request' THEN 'custom_engineering'
  ELSE 'hubspot_architecture'
END;
