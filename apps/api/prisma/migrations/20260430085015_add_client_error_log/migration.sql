-- CreateTable
CREATE TABLE "ClientErrorLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "digest" TEXT,
    "url" TEXT,
    "userAgent" TEXT,
    "userId" TEXT,
    "surface" TEXT,

    CONSTRAINT "ClientErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientErrorLog_createdAt_idx" ON "ClientErrorLog"("createdAt");

-- CreateIndex
CREATE INDEX "ClientErrorLog_surface_createdAt_idx" ON "ClientErrorLog"("surface", "createdAt");
