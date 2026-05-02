-- Slice 7: audit when a contributor token was last used.
-- Touched on every successful resolveContributorByToken call so
-- operators (and champions) can spot stale links and confirm
-- contributors received the link.
ALTER TABLE "ProjectContributor"
  ADD COLUMN "accessTokenLastUsedAt" TIMESTAMP(3);
