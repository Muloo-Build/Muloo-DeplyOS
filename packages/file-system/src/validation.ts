import {
  getModuleExecutionContract,
  type ModuleContractAssessment
} from "@muloo/executor";
import {
  projectReadinessSummarySchema,
  projectValidationResultSchema,
  type ModuleValidationResult,
  type OnboardingProject,
  type ProjectReadinessSummary,
  type ProjectValidationResult,
  type ReadinessReason,
  type ValidationFinding
} from "@muloo/shared";

import { loadAllProjects, loadProjectById } from "./projects";

function createFinding(code: string, message: string): ValidationFinding {
  return { code, message };
}

function createReason(
  code: string,
  message: string,
  type: ReadinessReason["type"]
): ReadinessReason {
  return { code, message, type };
}

function findDuplicateValues(values: string[]): string[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value);
}

function createGenericAssessment(
  project: OnboardingProject,
  modulePlan: OnboardingProject["modulePlanning"][number]
): ModuleContractAssessment {
  const warnings: ValidationFinding[] = [];
  const infos: ValidationFinding[] = [];

  if (modulePlan.status !== "ready") {
    warnings.push(
      createFinding(
        "module.not_ready",
        `Module '${modulePlan.moduleId}' is planned but not yet marked ready.`
      )
    );
  }

  if (modulePlan.notes) {
    infos.push(createFinding("module.notes", modulePlan.notes));
  }

  if (
    modulePlan.moduleId === "crm-setup" &&
    project.crmDesign.pipelines.length === 0
  ) {
    infos.push(
      createFinding(
        "crm.no_pipelines_defined",
        "No pipelines are defined yet for the CRM setup module."
      )
    );
  }

  return {
    errors: [],
    warnings,
    infos,
    blockers: [],
    inputRequirements: []
  };
}

function deriveModuleValidation(params: {
  project: OnboardingProject;
  modulePlan: OnboardingProject["modulePlanning"][number];
  dependencyBlocked: boolean;
}): ModuleValidationResult {
  const contract = getModuleExecutionContract(params.modulePlan.moduleId);
  const assessment =
    contract?.validate({
      project: params.project,
      modulePlan: params.modulePlan
    }) ?? createGenericAssessment(params.project, params.modulePlan);

  const infos = [...assessment.infos];
  const warnings = [...assessment.warnings];
  const errors = [...assessment.errors];
  const blockers = [...assessment.blockers];

  if (params.dependencyBlocked) {
    blockers.push(
      createReason(
        "module.dependency_blocked",
        `Module '${params.modulePlan.moduleId}' depends on modules that are not yet marked ready.`,
        "dependency"
      )
    );
    infos.push(
      createFinding(
        "module.dependency_blocked",
        `Module '${params.modulePlan.moduleId}' depends on modules that are not yet marked ready.`
      )
    );
  }

  if (params.modulePlan.status === "blocked") {
    blockers.push(
      createReason(
        "module.plan_blocked",
        `Module '${params.modulePlan.moduleId}' is marked blocked in the project plan.`,
        "operator"
      )
    );
  }

  const missingInputs = assessment.inputRequirements.filter(
    (requirement) => requirement.required && requirement.status === "missing"
  );

  let status: ModuleValidationResult["status"] = "valid";
  if (errors.length > 0) {
    status = "invalid";
  } else if (blockers.length > 0) {
    status = "blocked";
  } else if (warnings.length > 0 || params.modulePlan.status !== "ready") {
    status = "warning";
  }

  return {
    moduleId: params.modulePlan.moduleId,
    status,
    readiness:
      errors.length === 0 &&
      blockers.length === 0 &&
      missingInputs.length === 0 &&
      params.modulePlan.status === "ready"
        ? "ready"
        : "not_ready",
    blockers,
    missingInputs,
    inputRequirements: assessment.inputRequirements,
    errors,
    warnings,
    infos
  };
}

function deriveExecutionValidationStatus(
  validationStatus: ProjectValidationResult["status"]
): ProjectValidationResult["derivedExecutionValidationStatus"] {
  return validationStatus === "valid" ? "validated" : "needs-review";
}

export function validateProject(
  project: OnboardingProject
): ProjectValidationResult {
  const errors: ValidationFinding[] = [];
  const warnings: ValidationFinding[] = [];
  const infos: ValidationFinding[] = [];

  if (
    !project.id ||
    !project.name ||
    !project.owner.name ||
    !project.owner.email
  ) {
    errors.push(
      createFinding(
        "project.metadata_missing",
        "Project metadata is incomplete."
      )
    );
  }

  if (!project.clientId || !project.clientContext.clientName) {
    errors.push(
      createFinding(
        "project.client_reference_missing",
        "Project must include client references and client context."
      )
    );
  }

  if (!project.portalId || !project.hubspotScope.portal.portalId) {
    errors.push(
      createFinding(
        "project.portal_reference_missing",
        "Project must include portal references and portal details."
      )
    );
  }

  if (project.hubspotScope.hubsInScope.length === 0) {
    errors.push(
      createFinding(
        "project.hubs_missing",
        "At least one HubSpot hub must be in scope."
      )
    );
  }

  if (project.modulePlanning.length === 0) {
    errors.push(
      createFinding(
        "project.modules_missing",
        "At least one module must be planned."
      )
    );
  }

  if (project.crmDesign.lifecycleStages.length === 0) {
    errors.push(
      createFinding(
        "project.lifecycle_stages_missing",
        "At least one lifecycle stage must be defined."
      )
    );
  }

  if (project.crmDesign.leadStatuses.length === 0) {
    errors.push(
      createFinding(
        "project.lead_statuses_missing",
        "At least one lead status must be defined."
      )
    );
  }

  for (const duplicate of findDuplicateValues(
    project.crmDesign.lifecycleStages
  )) {
    warnings.push(
      createFinding(
        "project.lifecycle_stage_duplicate",
        `Lifecycle stage '${duplicate}' is defined more than once.`
      )
    );
  }

  for (const duplicate of findDuplicateValues(project.crmDesign.leadStatuses)) {
    warnings.push(
      createFinding(
        "project.lead_status_duplicate",
        `Lead status '${duplicate}' is defined more than once.`
      )
    );
  }

  if (typeof project.executionContext.dryRunEnabled !== "boolean") {
    errors.push(
      createFinding(
        "project.dry_run_missing",
        "Execution context must include an explicit dry-run flag."
      )
    );
  } else if (!project.executionContext.dryRunEnabled) {
    warnings.push(
      createFinding(
        "project.dry_run_disabled",
        "Project dry-run flag is disabled, so readiness remains operator-review only."
      )
    );
  }

  const dependencyStatus = new Map(
    project.modulePlanning.map((module) => [module.moduleId, module.status])
  );

  const modules = project.modulePlanning.map((modulePlan) =>
    deriveModuleValidation({
      project,
      modulePlan,
      dependencyBlocked: modulePlan.dependencies.some(
        (dependency) => dependencyStatus.get(dependency) !== "ready"
      )
    })
  );

  const hasInvalidModule = modules.some(
    (module) => module.status === "invalid"
  );
  const hasBlockedModule = modules.some(
    (module) => module.status === "blocked"
  );
  const hasWarningModule = modules.some(
    (module) => module.status === "warning"
  );
  const allModulesReady =
    modules.length > 0 &&
    modules.every((module) => module.readiness === "ready");

  let status: ProjectValidationResult["status"] = "valid";
  if (errors.length > 0 || hasInvalidModule) {
    status = "invalid";
  } else if (hasBlockedModule) {
    status = "blocked";
  } else if (warnings.length > 0 || hasWarningModule) {
    status = "warning";
  }

  const derivedExecutionValidationStatus =
    deriveExecutionValidationStatus(status);

  if (
    project.executionContext.validationStatus !==
    derivedExecutionValidationStatus
  ) {
    infos.push(
      createFinding(
        "project.validation_state_derived",
        `Derived execution validation status is '${derivedExecutionValidationStatus}' while project file stores '${project.executionContext.validationStatus}'.`
      )
    );
  }

  return projectValidationResultSchema.parse({
    projectId: project.id,
    status,
    readiness: status === "valid" && allModulesReady ? "ready" : "not_ready",
    errors,
    warnings,
    infos,
    modules,
    validatedAt: new Date().toISOString(),
    derivedExecutionValidationStatus
  });
}

export function summarizeProjectReadiness(
  validation: ProjectValidationResult
): ProjectReadinessSummary {
  return projectReadinessSummarySchema.parse({
    projectId: validation.projectId,
    status: validation.status,
    readiness: validation.readiness,
    readyModuleIds: validation.modules
      .filter((module) => module.readiness === "ready")
      .map((module) => module.moduleId),
    blockedModuleIds: validation.modules
      .filter((module) => module.status === "blocked")
      .map((module) => module.moduleId),
    invalidModuleIds: validation.modules
      .filter((module) => module.status === "invalid")
      .map((module) => module.moduleId),
    warningModuleIds: validation.modules
      .filter((module) => module.status === "warning")
      .map((module) => module.moduleId),
    blockers: validation.modules.flatMap((module) => module.blockers),
    warnings: [
      ...validation.warnings,
      ...validation.modules.flatMap((module) => module.warnings)
    ],
    moduleDetails: validation.modules.map((module) => ({
      moduleId: module.moduleId,
      status: module.status,
      readiness: module.readiness,
      blockerCount: module.blockers.length,
      warningCount: module.warnings.length,
      missingInputCount: module.missingInputs.length
    }))
  });
}

export async function validateProjectById(
  projectId: string,
  options?: { cwd?: string }
): Promise<ProjectValidationResult> {
  return validateProject(await loadProjectById(projectId, options));
}

export async function validateAllProjects(options?: {
  cwd?: string;
}): Promise<ProjectValidationResult[]> {
  const projects = await loadAllProjects(options);
  return projects.map(validateProject);
}

export async function loadProjectReadinessById(
  projectId: string,
  options?: { cwd?: string }
): Promise<ProjectReadinessSummary> {
  return summarizeProjectReadiness(
    await validateProjectById(projectId, options)
  );
}
