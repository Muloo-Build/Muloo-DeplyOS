import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const skippyWorldPath = path.join(
  repoRoot,
  "apps/web/app/components/SkippyMulooWorldView.tsx"
);
const skippyWorldPagePath = path.join(
  repoRoot,
  "apps/web/app/skippy-world/page.tsx"
);
const sidebarPath = path.join(repoRoot, "apps/web/app/components/Sidebar.tsx");

test("Skippy world gives Jarrud a portal-level Muloo client work radar", async () => {
  const source = await readFile(skippyWorldPath, "utf8");
  const page = await readFile(skippyWorldPagePath, "utf8");
  const sidebar = await readFile(sidebarPath, "utf8");

  assert.match(page, /SkippyMulooWorldView/);
  assert.match(sidebar, /href:\s*"\/skippy-world"/);
  assert.match(sidebar, /label:\s*"Skippy world"/);

  assert.match(source, /Client work radar/);
  assert.match(source, /Client work Skippy can move/);
  assert.match(source, /On Skippy's radar/);
  assert.match(source, /Skippy can do this/);
  assert.match(source, /Muloo delivery world/);
  assert.match(source, /\/api\/projects\/needs-attention/);
  assert.match(source, /\/api\/workspace\/emails\/client-queues/);
});
