CREATE TABLE "WorkspaceUser" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceUser_email_key" ON "WorkspaceUser"("email");

INSERT INTO "WorkspaceUser" ("id", "name", "email", "role", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('jarrud-vander-merwe', 'Jarrud van der Merwe', 'jarrud@muloo.co', 'HubSpot Architect', true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('muloo-operator', 'Muloo Operator', 'operator@muloo.com', 'Operations', true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
