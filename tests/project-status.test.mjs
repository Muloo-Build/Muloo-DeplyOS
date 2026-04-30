import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

// The canonical "live project" predicate is defined in apps/api/src/server.ts.
// A mirror lives at apps/web/app/components/projectStatus.ts so the web
// runtime can answer the same question without an API round-trip. Both must
// agree on the rule. This test confirms the rule on each side stays "status
// !== 'archived'" and fails if either drifts.

const apiServerPath = path.join(repoRoot, "apps/api/src/server.ts");
const webStatusPath = path.join(
  repoRoot,
  "apps/web/app/components/projectStatus.ts"
);

const RULE_PATTERN = /return\s+status\s*!==\s*["']archived["']/;

test("isLiveProjectStatus rule is consistent on the API side", async () => {
  const source = await readFile(apiServerPath, "utf8");
  const fnIndex = source.indexOf("export function isLiveProjectStatus(");
  assert.ok(
    fnIndex >= 0,
    "isLiveProjectStatus must exist in apps/api/src/server.ts"
  );
  // Look for the rule within the next ~200 chars so we don't trip on later
  // unrelated archived comparisons.
  const slice = source.slice(fnIndex, fnIndex + 200);
  assert.match(
    slice,
    RULE_PATTERN,
    "API isLiveProjectStatus must read `return status !== \"archived\"`"
  );
});

test("isLiveProjectStatus rule is consistent on the web side", async () => {
  const source = await readFile(webStatusPath, "utf8");
  assert.match(
    source,
    /export function isLiveProjectStatus\(status: string\)/,
    "web mirror must export isLiveProjectStatus(status)"
  );
  assert.match(
    source,
    RULE_PATTERN,
    "web isLiveProjectStatus must read `return status !== \"archived\"`"
  );
});

test("getLiveProjectCount uses the same rule via Prisma where clause", async () => {
  const source = await readFile(apiServerPath, "utf8");
  const fnIndex = source.indexOf("export async function getLiveProjectCount(");
  assert.ok(
    fnIndex >= 0,
    "getLiveProjectCount must exist in apps/api/src/server.ts"
  );
  const slice = source.slice(fnIndex, fnIndex + 400);
  assert.match(
    slice,
    /NOT:\s*{\s*status:\s*["']archived["']\s*}/,
    "getLiveProjectCount must filter NOT status: 'archived'"
  );
});
