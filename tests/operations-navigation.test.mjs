import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const operationsPagePath = path.join(repoRoot, "apps/web/app/operations/page.tsx");
const sidebarPath = path.join(repoRoot, "apps/web/app/components/Sidebar.tsx");
const templatesPagePath = path.join(repoRoot, "apps/web/app/templates/page.tsx");

test("Operations page is a real reusable-asset control centre, not a redirect", async () => {
  const source = await readFile(operationsPagePath, "utf8");

  assert.doesNotMatch(
    source,
    /redirect\(/,
    "Operations should not dump operators into an unrelated runs page"
  );
  assert.match(source, /AppShell/, "Operations should render inside the app shell");
  assert.match(source, /Workbooks/, "Operations should link to workbook templates");
  assert.match(source, /Question library/, "Operations should link to question library");
  assert.match(
    source,
    /Implementation templates/,
    "Operations should name delivery templates clearly"
  );
});

test("Sidebar uses Operations for reusable delivery assets", async () => {
  const source = await readFile(sidebarPath, "utf8");

  assert.match(source, /label:\s*["']Operations["']/, "nav group should be Operations");
  assert.match(
    source,
    /label:\s*["']Implementation templates["']/,
    "templates nav label should avoid generic wording"
  );
});

test("Templates page is explicitly named Implementation templates", async () => {
  const source = await readFile(templatesPagePath, "utf8");

  assert.match(source, /title=\"Implementation templates\"/);
  assert.match(source, /reusable HubSpot delivery patterns/i);
});
