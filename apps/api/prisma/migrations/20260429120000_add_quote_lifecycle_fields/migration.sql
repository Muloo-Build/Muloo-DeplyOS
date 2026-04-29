-- Add quote lifecycle and template fields to ProjectQuote
-- Statuses are still stored as strings for now: draft, shared, approved, won, lost, archived
-- Template values: full, one_pager
-- closedAt + closedReason capture won/lost outcomes
-- hubspotDealId + pdfUrl reserved for Phase 1 HubSpot sync and Puppeteer PDF generation

ALTER TABLE "ProjectQuote"
  ADD COLUMN "template" TEXT NOT NULL DEFAULT 'full',
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "closedReason" TEXT,
  ADD COLUMN "hubspotDealId" TEXT,
  ADD COLUMN "pdfUrl" TEXT;

-- Index for filtering quotes by status (won/lost reporting, pipeline views)
CREATE INDEX "ProjectQuote_status_idx" ON "ProjectQuote"("status");
