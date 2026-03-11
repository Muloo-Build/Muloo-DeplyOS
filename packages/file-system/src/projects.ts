import fs from "node:fs/promises";
import path from "node:path";

import type { OnboardingSpec, SpecFile } from "@muloo/core";
import { createPropertySpecFromProject as createPropertySpec } from "@muloo/executor";
import { onboardingProjectSchema, type OnboardingProject } from "@muloo/shared";

function getProjectsDirectory(cwd: string): string {
  return path.resolve(cwd, "data", "projects");
}

async function loadValidatedProjectFile(
  filePath: string
): Promise<SpecFile<OnboardingProject>> {
  const content = await fs.readFile(filePath, "utf8");
  const raw = JSON.parse(content) as unknown;
  const spec = onboardingProjectSchema.parse(raw);

  return {
    absolutePath: filePath,
    raw,
    spec
  };
}

export async function loadAllProjects(options?: {
  cwd?: string;
}): Promise<OnboardingProject[]> {
  const cwd = options?.cwd ?? process.cwd();
  const directory = getProjectsDirectory(cwd);
  const entries = await fs.readdir(directory);
  const files = entries
    .filter((entry) => entry.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right));

  const projects = await Promise.all(
    files.map((file) => loadValidatedProjectFile(path.join(directory, file)))
  );

  return projects.map((projectFile) => projectFile.spec);
}

export async function loadProjectById(
  projectId: string,
  options?: { cwd?: string }
): Promise<OnboardingProject> {
  const projects = await loadAllProjects(options);
  const project = projects.find((candidate) => candidate.id === projectId);

  if (!project) {
    throw new Error(`Project '${projectId}' was not found.`);
  }

  return project;
}

export function createPropertySpecFromProject(params: {
  project: OnboardingProject;
  moduleId: string;
}): SpecFile<OnboardingSpec> {
  return createPropertySpec(params.project, params.moduleId);
}
