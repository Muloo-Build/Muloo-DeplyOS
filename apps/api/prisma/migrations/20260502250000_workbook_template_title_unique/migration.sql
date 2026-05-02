-- T3 Step A FIX-UP — make WorkbookTemplate.title a true unique key so the
-- boot seed can use a real upsert instead of findFirst+create. Without
-- this, two API instances starting at the same time can race past the
-- findFirst probe and both call create, yielding duplicate seeded
-- workbook templates.
--
-- Verified at apply time: zero duplicate titles in the live DB
-- (`SELECT title, COUNT(*) FROM "WorkbookTemplate" GROUP BY title HAVING COUNT(*) > 1`
-- returns 0 rows).

CREATE UNIQUE INDEX IF NOT EXISTS "WorkbookTemplate_title_key"
  ON "WorkbookTemplate" ("title");
