import {
  moduleCatalog,
  projectModuleSummarySchema,
  projectSummarySchema,
  type OnboardingProject,
  type ProjectModuleSummary,
  type ProjectSummary
} from "@muloo/shared";

import { loadProjectExecutions } from "./executions";
import { loadAllProjects, loadProjectById } from "./projects";
import { validateProject, validateProjectById } from "./validation";

export function summarizeProjectModules(
  project: OnboardingProject
): ProjectModuleSummary[] {
  const validation = validateProject(project);

  return project.modulePlanning.map((projectModule) => {
    const definition = moduleCatalog.find(
      (module) => module.id === projectModule.moduleId
    );
    const moduleValidation = validation.modules.find(
      (module) => module.moduleId === projectModule.moduleId
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
      dependencies: projectModule.dependencies,
      validationStatus: moduleValidation?.status ?? "warning",
      readiness: moduleValidation?.readiness ?? "not_ready",
      blockerCount: moduleValidation?.blockers.length ?? 0,
      missingInputCount: moduleValidation?.missingInputs.length ?? 0,
      errorCount: moduleValidation?.errors.length ?? 0,
      warningCount: moduleValidation?.warnings.length ?? 0,
      infoCount: moduleValidation?.infos.length ?? 0
    });
  });
}

export async function summarizeProject(
  project: OnboardingProject,
  options?: { cwd?: string }
): Promise<ProjectSummary> {
  const validation = validateProject(project);
  const executions = await loadProjectExecutions(project.id, options);
  const latestExecution = executions[0];

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
    readyModuleCount: validation.modules.filter(
      (module) => module.readiness === "ready"
    ).length,
    dryRunEnabled: project.executionContext.dryRunEnabled,
    validationStatus: validation.status,
    readiness: validation.readiness,
    executionCount: executions.length,
    lastExecutionStatus: latestExecution?.status,
    updatedAt: project.updatedAt
  });
}

export async function loadAllProjectSummaries(options?: {
  cwd?: string;
}): Promise<ProjectSummary[]> {
  const projects = await loadAllProjects(options);
  return Promise.all(
    projects.map((project) => summarizeProject(project, options))
  );
}

export async function loadProjectSummaryById(
  projectId: string,
  options?: { cwd?: string }
): Promise<ProjectSummary> {
  return summarizeProject(await loadProjectById(projectId, options), options);
}
