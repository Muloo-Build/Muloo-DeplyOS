ALTER TABLE "Project"
ADD COLUMN "serviceFamily" TEXT NOT NULL DEFAULT 'hubspot_architecture';

UPDATE "Project"
SET "serviceFamily" = CASE
  WHEN "scopeType" = 'standalone_quote' AND EXISTS (
    SELECT 1
    FROM "DeliveryTemplate" dt
    WHERE dt."id" = "Project"."deliveryTemplateId"
      AND dt."category" = 'website'
  ) THEN 'custom_engineering'
  ELSE 'hubspot_architecture'
END;
