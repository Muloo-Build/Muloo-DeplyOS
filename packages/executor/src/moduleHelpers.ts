import {
  type ModuleInputRequirementStatus,
  type OnboardingProject,
  type ReadinessReason,
  type ValidationFinding,
  type ProjectModulePlan
} from "@muloo/shared";

export function createFinding(
  code: string,
  message: string
): ValidationFinding {
  return { code, message };
}

export function createReason(
  code: string,
  message: string,
  type: ReadinessReason["type"]
): ReadinessReason {
  return { code, message, type };
}

export function createInputStatus(params: {
  key: string;
  label: string;
  description: string;
  required: boolean;
  present: boolean;
  message?: string;
}): ModuleInputRequirementStatus {
  return {
    key: params.key,
    label: params.label,
    description: params.description,
    required: params.required,
    status: params.present ? "present" : "missing",
    message: params.message
  };
}

export function findModulePlan(
  project: OnboardingProject,
  moduleId: string
): ProjectModulePlan {
  const modulePlan = project.modulePlanning.find(
    (candidate) => candidate.moduleId === moduleId
  );

  if (!modulePlan) {
    throw new Error(
      `Project '${project.id}' does not include module '${moduleId}'.`
    );
  }

  return modulePlan;
}
