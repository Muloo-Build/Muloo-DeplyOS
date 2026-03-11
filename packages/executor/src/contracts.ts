import type {
  ComparablePropertyDefinition,
  DryRunArtifact,
  Logger,
  OnboardingSpec
} from "@muloo/core";
import type {
  ComparablePipelineDefinition,
  PipelineObjectType
} from "@muloo/core";
import type {
  ExecutionJobOutput,
  ModuleExecutionContractDefinition,
  ModuleExecutionResult,
  ModuleInputRequirementStatus,
  ModuleValidationResult,
  OnboardingProject,
  ProjectModulePlan,
  ProjectValidationResult,
  ReadinessReason,
  ValidationFinding
} from "@muloo/shared";

export interface ModuleContractAssessment {
  errors: ValidationFinding[];
  warnings: ValidationFinding[];
  infos: ValidationFinding[];
  blockers: ReadinessReason[];
  inputRequirements: ModuleInputRequirementStatus[];
}

export interface ModuleContractContext {
  project: OnboardingProject;
  modulePlan: ProjectModulePlan;
}

export interface ModuleExecutionContextBase extends ModuleContractContext {
  projectValidation: ProjectValidationResult;
  moduleValidation: ModuleValidationResult;
}

export interface StepReporter {
  start(stepKey: string, summary?: string): Promise<void> | void;
  complete(
    stepKey: string,
    params?: {
      summary?: string;
      warnings?: string[];
      output?: Partial<ExecutionJobOutput>;
    }
  ): Promise<void> | void;
  fail(
    stepKey: string,
    params: {
      error: string;
      summary?: string;
      output?: Partial<ExecutionJobOutput>;
    }
  ): Promise<void> | void;
}

export interface PropertyReader {
  fetchProperties(
    objectType: OnboardingSpec["crm"]["objectType"]
  ): Promise<ComparablePropertyDefinition[]>;
}

export interface PipelineReader {
  fetchPipelines(
    objectType: PipelineObjectType
  ): Promise<ComparablePipelineDefinition[]>;
}

export interface ModuleDryRunContext<
  TResolvedInput
> extends ModuleExecutionContextBase {
  logger: Logger;
  artifactDir: string;
  resolvedInput: TResolvedInput;
  stepReporter: StepReporter;
  hubSpotClient?: PropertyReader & PipelineReader;
  writeArtifact?: (params: {
    artifactDir: string;
    artifact: DryRunArtifact;
  }) => Promise<string>;
}

export interface ModuleExecutionContract<TResolvedInput = unknown> {
  definition: ModuleExecutionContractDefinition;
  validate(context: ModuleContractContext): ModuleContractAssessment;
  readiness(context: ModuleContractContext): ModuleContractAssessment;
  resolveInput?(context: ModuleContractContext): TResolvedInput;
  dryRun?(
    context: ModuleDryRunContext<TResolvedInput>
  ): Promise<ModuleExecutionResult>;
  apply?(
    context: ModuleExecutionContextBase & { resolvedInput: TResolvedInput }
  ): Promise<ModuleExecutionResult>;
}
