ALTER TABLE "ClientProjectAccess"
ADD COLUMN "assignedInputSections" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
