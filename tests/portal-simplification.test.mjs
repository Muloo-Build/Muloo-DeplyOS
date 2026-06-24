import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const workspacePath = path.join(repoRoot, "apps/web/app/components/ProjectWorkspaceView.tsx");
const clientShellPath = path.join(repoRoot, "apps/web/app/components/ClientShell.tsx");
const skippyPanelPath = path.join(repoRoot, "apps/web/app/components/project/panels/ProjectSkippyCommandPanel.tsx");

test("internal project workspace has six primary tabs and moves specialist views behind More", async () => {
  const source = await readFile(workspacePath, "utf8");

  assert.match(source, /primaryProjectTabs/);
  assert.match(source, /secondaryProjectTabs/);
  assert.match(source, /label:\s*"Overview"/);
  assert.match(source, /label:\s*"Plan"/);
  assert.match(source, /label:\s*"Tasks"/);
  assert.match(source, /label:\s*"Approvals"/);
  assert.match(source, /label:\s*"Files"/);
  assert.match(source, /label:\s*"Skippy"/);
  assert.match(source, /<summary[^>]*>\s*More\s*<\/summary>/s);
  assert.match(source, /label:\s*"Discovery"/);
  assert.match(source, /label:\s*"Meetings"/);
  assert.match(source, /label:\s*"Audit"/);
});

test("client portal shell uses simpler client-facing navigation labels", async () => {
  const source = await readFile(clientShellPath, "utf8");

  assert.match(source, /label:\s*"Overview"/);
  assert.match(source, /label:\s*"Updates"/);
  assert.match(source, /label:\s*"Approvals"/);
  assert.match(source, /label:\s*"Requests"/);
  assert.match(source, /label:\s*"Support"/);
  assert.doesNotMatch(source, /label:\s*"Governance"/);
  assert.doesNotMatch(source, /label:\s*"Request Work"/);
});

test("Skippy command centre keeps the operator surface focused on five decisions", async () => {
  const source = await readFile(skippyPanelPath, "utf8");

  assert.match(source, /Current state/);
  assert.match(source, /Next actions/);
  assert.match(source, /Needs approval/);
  assert.match(source, /Blocked/);
  assert.match(source, /Safe actions/);
  assert.match(source, /safeActionLabels/);
});
