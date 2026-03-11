import fs from "node:fs/promises";
import path from "node:path";

import {
  onboardingTemplateSchema,
  type OnboardingTemplate
} from "@muloo/shared";

function getTemplatesDirectory(cwd: string): string {
  return path.resolve(cwd, "data", "templates");
}

async function loadValidatedTemplateFile(
  filePath: string
): Promise<OnboardingTemplate> {
  const content = await fs.readFile(filePath, "utf8");
  const raw = JSON.parse(content) as unknown;
  return onboardingTemplateSchema.parse(raw);
}

export async function loadAllTemplates(options?: {
  cwd?: string;
}): Promise<OnboardingTemplate[]> {
  const cwd = options?.cwd ?? process.cwd();
  const directory = getTemplatesDirectory(cwd);
  const entries = await fs.readdir(directory);
  const files = entries
    .filter((entry) => entry.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(
    files.map((file) => loadValidatedTemplateFile(path.join(directory, file)))
  );
}

export async function loadTemplateById(
  templateId: string,
  options?: { cwd?: string }
): Promise<OnboardingTemplate> {
  const templates = await loadAllTemplates(options);
  const template = templates.find((candidate) => candidate.id === templateId);

  if (!template) {
    throw new Error(`Template '${templateId}' was not found.`);
  }

  return template;
}
