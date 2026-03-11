import { getModuleExecutionContract } from "@muloo/executor";
import {
  moduleCatalog,
  moduleExecutionContractDefinitionSchema,
  projectModuleDetailSchema,
  type ModuleExecutionContractDefinition,
  type OnboardingProject,
  type ProjectModuleDetail
} from "@muloo/shared";

import { loadProjectExecutions } from "./executions";
import { loadProjectById } from "./projects";
import { summarizeProjectModules } from "./summaries";
import { validateProject, validateProjectById } from "./validation";

function createFallbackContract(
  moduleId: string
): ModuleExecutionContractDefinition {
  const definition = moduleCatalog.find((module) => module.id === moduleId);

  return moduleExecutionContractDefinitionSchema.parse({
    moduleKey: moduleId,
    moduleLabel: definition?.name ?? moduleId,
    supportedModes: [],
    inputRequirements: [],
    handlers: {
      validation: false,
      readiness: false,
      dryRun: false,
      apply: false
    },
    resultKind: "module-execution-placeholder",
    executionSteps: []
  });
}

function getContractDefinition(
  moduleId: string
): ModuleExecutionContractDefinition {
  return (
    getModuleExecutionContract(moduleId)?.definition ??
    createFallbackContract(moduleId)
  );
}

export function summarizeProjectModuleDetail(
  project: OnboardingProject,
  moduleKey: string,
  executions: Awaited<ReturnType<typeof loadProjectExecutions>>
): ProjectModuleDetail {
  const validation = validateProject(project);
  const moduleSummary = summarizeProjectModules(project).find(
    (module) => module.moduleId === moduleKey
  );
  const moduleValidation = validation.modules.find(
    (module) => module.moduleId === moduleKey
  );
  const moduleExecutions = executions.filter(
    (execution) => execution.moduleKey === moduleKey
  );
  const latestExecution = moduleExecutions[0];

  if (!moduleSummary || !moduleValidation) {
    throw new Error(
      `Project '${project.id}' does not include module '${moduleKey}'.`
    );
  }

  return projectModuleDetailSchema.parse({
    ...moduleSummary,
    blockers: moduleValidation.blockers,
    missingInputs: moduleValidation.missingInputs,
    inputRequirements: moduleValidation.inputRequirements,
    warnings: moduleValidation.warnings,
    infos: moduleValidation.infos,
    contract: getContractDefinition(moduleKey),
    executionSummary: {
      executionCount: moduleExecutions.length,
      lastExecutionId: latestExecution?.id,
      lastExecutionStatus: latestExecution?.status,
      lastExecutedAt:
        latestExecution?.completedAt ?? latestExecution?.startedAt,
      lastSummary:
        latestExecution?.result?.summary ?? latestExecution?.output.summaryText
    }
  });
}

export async function loadProjectModuleDetail(
  projectId: string,
  moduleKey: string,
  options?: { cwd?: string }
): Promise<ProjectModuleDetail> {
  const project = await loadProjectById(projectId, options);
  const executions = await loadProjectExecutions(project.id, options);

  return summarizeProjectModuleDetail(project, moduleKey, executions);
}

export async function loadProjectModuleValidation(
  projectId: string,
  moduleKey: string,
  options?: { cwd?: string }
) {
  const validation = await validateProjectById(projectId, options);
  const moduleValidation = validation.modules.find(
    (module) => module.moduleId === moduleKey
  );

  if (!moduleValidation) {
    throw new Error(
      `Project '${projectId}' does not include module '${moduleKey}'.`
    );
  }

  return moduleValidation;
}
