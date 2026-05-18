-- External-approval fields let us track engagements where the quote was
-- approved outside the platform (PDF, signed contract, etc.) without forcing
-- the in-platform ProjectQuote ceremony. Financials picks these up alongside
-- ProjectQuote-driven revenue.
ALTER TABLE "Project"
  ADD COLUMN "externalApprovalValue" DECIMAL(14,2),
  ADD COLUMN "externalApprovalCurrency" TEXT,
  ADD COLUMN "externalApprovedAt" TIMESTAMP(3),
  ADD COLUMN "externalApprovedByName" TEXT,
  ADD COLUMN "externalApprovedByEmail" TEXT,
  ADD COLUMN "externalApprovalDocUrl" TEXT,
  ADD COLUMN "externalApprovalSource" TEXT,
  ADD COLUMN "externalApprovalNotes" TEXT;

CREATE INDEX "Project_externalApprovedAt_idx" ON "Project"("externalApprovedAt");
