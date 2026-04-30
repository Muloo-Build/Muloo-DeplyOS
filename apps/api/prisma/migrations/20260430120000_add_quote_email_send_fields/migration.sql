-- Add email-send tracking fields to ProjectQuote
-- sendCount: number of times the quote has been emailed to recipients
-- lastSentAt: timestamp of the most recent send
-- lastSentTo: recipient list (To addresses) of the most recent send
ALTER TABLE "ProjectQuote"
  ADD COLUMN "sendCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastSentAt" TIMESTAMP(3),
  ADD COLUMN "lastSentTo" TEXT[] DEFAULT ARRAY[]::TEXT[];
