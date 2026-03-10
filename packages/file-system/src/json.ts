import fs from "node:fs/promises";
import path from "node:path";

import {
  onboardingSpecSchema,
  type DryRunArtifact,
  type OnboardingSpec,
  type SpecFile
} from "@muloo/core";
import {
  moduleCatalog,
  onboardingProjectSchema,
  projectModuleSummarySchema,
  projectSummarySchema,
  type OnboardingProject,
  type ProjectModuleSummary,
  type ProjectSummary
} from "@muloo/shared";

export async function loadJsonFile(
  filePath: string
): Promise<{ absolutePath: string; raw: unknown }> {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const content = await fs.readFile(absolutePath, "utf8");

  return {
    absolutePath,
    raw: JSON.parse(content) as unknown
  };
}

export async function loadValidatedOnboardingSpec(
  filePath: string
): Promise<SpecFile<OnboardingSpec>> {
  const { absolutePath, raw } = await loadJsonFile(filePath);
  const spec = onboardingSpecSchema.parse(raw);

  return {
    absolutePath,
    raw,
    spec
  };
}

function createArtifactFileName(
  clientSlug: string,
  generatedAt: string
): string {
  const timestamp = generatedAt.replace(/[:.]/g, "-");
  return `${timestamp}-${clientSlug}-contact-properties-dry-run.json`;
}

export async function writeJsonArtifact(params: {
  artifactDir: string;
  artifact: DryRunArtifact;
}): Promise<string> {
  await fs.mkdir(params.artifactDir, { recursive: true });

  const fileName = createArtifactFileName(
    params.artifact.client.slug,
    params.artifact.generatedAt
  );
  const artifactPath = path.join(params.artifactDir, fileName);

  await fs.writeFile(
    artifactPath,
    `${JSON.stringify(params.artifact, null, 2)}\n`,
    "utf8"
  );
  return artifactPath;
}

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

export function summarizeProject(project: OnboardingProject): ProjectSummary {
  return projectSummarySchema.parse({
    id: project.id,
    name: project.name,
    status: project.status,
    clientName: project.clientContext.clientName,
    primaryRegion: project.clientContext.primaryRegion,
    implementationType: project.clientContext.implementationType,
    portalDisplayName: project.hubspotScope.portal.displayName,
    hubsInScope: project.hubspotScope.hubsInScope,
    moduleCount: project.modulePlanning.length,
    readyModuleCount: project.modulePlanning.filter(
      (module) => module.status === "ready"
    ).length,
    dryRunEnabled: project.executionContext.dryRunEnabled,
    updatedAt: project.updatedAt
  });
}

export function summarizeProjectModules(
  project: OnboardingProject
): ProjectModuleSummary[] {
  return project.modulePlanning.map((projectModule) => {
    const definition = moduleCatalog.find(
      (module) => module.id === projectModule.moduleId
    );

    return projectModuleSummarySchema.parse({
      moduleId: projectModule.moduleId,
      name: definition?.name ?? projectModule.moduleId,
      summary:
        definition?.summary ??
        projectModule.notes ??
        "Project-specific module plan.",
      category: definition?.category ?? "delivery",
      requiresHubSpot: definition?.requiresHubSpot ?? false,
      status: projectModule.status,
      dependencies: projectModule.dependencies
    });
  });
}

export async function loadAllProjectSummaries(options?: {
  cwd?: string;
}): Promise<ProjectSummary[]> {
  const projects = await loadAllProjects(options);
  return projects.map(summarizeProject);
}

export async function loadProjectSummaryById(
  projectId: string,
  options?: { cwd?: string }
): Promise<ProjectSummary> {
  return summarizeProject(await loadProjectById(projectId, options));
}

export function createPropertySpecFromProject(params: {
  project: OnboardingProject;
  moduleId: string;
}): SpecFile<OnboardingSpec> {
  const modulePlan = params.project.modulePlanning.find(
    (module) => module.moduleId === params.moduleId
  );

  if (!modulePlan) {
    throw new Error(
      `Project '${params.project.id}' does not include module '${params.moduleId}'.`
    );
  }

  if (params.moduleId !== "properties") {
    throw new Error(
      `Project module '${params.moduleId}' is not connected to a dry-run property slice yet.`
    );
  }

  const contactPlan = params.project.propertyPlanning.propertiesByObject.find(
    (group) => group.objectType === "contacts"
  );

  if (!contactPlan || contactPlan.properties.length === 0) {
    throw new Error(
      `Project '${params.project.id}' does not contain contact property planning for the properties module.`
    );
  }

  const spec: OnboardingSpec = onboardingSpecSchema.parse({
    schemaVersion: "1.0",
    client: {
      name: params.project.clientContext.clientName,
      slug: params.project.clientId
    },
    crm: {
      objectType: "contacts",
      properties: contactPlan.properties.map((property) => ({
        name: property.internalName,
        label: property.label,
        type: property.valueType,
        fieldType: property.fieldType,
        description: property.description,
        groupName: property.groupName,
        formField: !property.required,
        options: property.options?.map((option) => ({
          label: option.label,
          value: option.value,
          displayOrder: option.displayOrder
        }))
      }))
    }
  });

  return {
    absolutePath: `project:${params.project.id}:${params.moduleId}`,
    raw: params.project,
    spec
  };
}
