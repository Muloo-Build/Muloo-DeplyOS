-- T4.3 — Persist the onboarding-checklist tick state per project.
--
-- The wizard now lands the operator on a 5-item "now do these things"
-- checklist after project create. We store the tick state as a JSON
-- column on Project so we don't add a join table just for five rows
-- per project (and so reverting is a clean column drop).
ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "onboardingChecklist" JSONB;
