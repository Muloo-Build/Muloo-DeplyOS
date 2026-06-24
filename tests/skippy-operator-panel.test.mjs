import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const projectsListPath = path.join(repoRoot, "apps/web/app/components/ProjectsListView.tsx");
const workspacePath = path.join(repoRoot, "apps/web/app/components/ProjectWorkspaceView.tsx");
const commandPagePath = path.join(repoRoot, "apps/web/app/projects/[id]/command/page.tsx");
const commandPanelPath = path.join(repoRoot, "apps/web/app/components/project/panels/ProjectSkippyCommandPanel.tsx");
const apiAppPath = path.join(repoRoot, "apps/api/src/app.ts");
const apiServerPath = path.join(repoRoot, "apps/api/src/server.ts");

test("Projects list treats live API status=active as active delivery work", async () => {
  const source = await readFile(projectsListPath, "utf8");

  assert.match(
    source,
    /statuses:\s*\[[^\]]*["']active["']/s,
    "Active tab must include the live API's active status so W.Consulting and Magnisol do not disappear"
  );
  assert.match(source, /statusLabel\(status\?\)/, "status labels should remain centralized");
  assert.match(source, /active:\s*["']Active["']/, "active status should have a human label");
});

test("Project workspace exposes an embedded Skippy command tab", async () => {
  const workspace = await readFile(workspacePath, "utf8");
  const commandPage = await readFile(commandPagePath, "utf8");

  assert.match(workspace, /id:\s*["']command["']/);
  assert.match(workspace, /label:\s*["']Skippy["']/);
  assert.match(commandPage, /ProjectSkippyCommandPanel/);
  assert.match(commandPage, /activeTab="command"/);
});

test("Skippy panel shows meeting import, execution queue, HubSpot guardrails and approvals", async () => {
  const source = await readFile(commandPanelPath, "utf8");

  assert.match(source, /Import Gemini notes/i);
  assert.match(source, /Execution queue/i);
  assert.match(source, /HubSpot guardrails/i);
  assert.match(source, /Approval required/i);
  assert.match(source, /Dry-run first/i);
  assert.match(source, /\/api\/projects\/\$\{encodeURIComponent\(projectId\)\}\/skippy\/command-centre/);
  assert.match(source, /\/api\/projects\/\$\{encodeURIComponent\(projectId\)\}\/gemini\/import/);
});

test("API has auditable Skippy command centre and Gemini import endpoints", async () => {
  const app = await readFile(apiAppPath, "utf8");
  const server = await readFile(apiServerPath, "utf8");

  assert.match(app, /\/api\/projects\/:projectId\/skippy\/command-centre/);
  assert.match(app, /\/api\/projects\/:projectId\/gemini\/import/);
  assert.match(server, /loadProjectSkippyCommandCentre/);
  assert.match(server, /importGeminiMeetingIntelligence/);
  assert.match(server, /taskOrigin:\s*"gemini_meeting"/);
  assert.match(server, /approvalRequired:\s*true/);
});
