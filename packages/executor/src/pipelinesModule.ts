import {
  formatPipelineDryRunSummary,
  type ComparablePipelineDefinition
} from "@muloo/core";
import {
  moduleExecutionContractDefinitionSchema,
  moduleExecutionResultSchema,
  type ModuleInputRequirementStatus,
  type OnboardingProject,
  type ProjectModulePlan,
  type ReadinessReason,
  type ValidationFinding
} from "@muloo/shared";

import type {
  ModuleContractAssessment,
  ModuleContractContext,
  ModuleDryRunContext,
  ModuleExecutionContract
} from "./contracts";
import {
  executePipelineDryRun,
  type PipelineModuleInput
} from "./pipelineDryRunExecutor";

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

function createInputStatus(params: {
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

function findModulePlan(
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

function groupDuplicateValues(values: string[]): string[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value);
}

function buildPipelineAssessment(
  context: ModuleContractContext
): ModuleContractAssessment {
  const desiredPipelines = context.project.crmDesign.pipelines;
  const hasPipelinePlan = desiredPipelines.length > 0;
  const inputRequirements: ModuleInputRequirementStatus[] = [
    createInputStatus({
      key: "crm.pipeline-plan",
      label: "Pipeline plan",
      description:
        "At least one deal or ticket pipeline must be defined in crmDesign.pipelines.",
      required: true,
      present: hasPipelinePlan,
      message: hasPipelinePlan
        ? `${desiredPipelines.length} pipelines are defined in the project blueprint.`
        : "Add at least one pipeline to crmDesign.pipelines."
    })
  ];

  const errors: ValidationFinding[] = [];
  const warnings: ValidationFinding[] = [];
  const infos: ValidationFinding[] = [
    createFinding(
      "pipelines.dry_run_supported",
      "Pipelines module is connected to the contract-based project/module dry-run flow."
    )
  ];
  const blockers: ReadinessReason[] = [];

  if (!hasPipelinePlan) {
    errors.push(
      createFinding(
        "pipelines.missing_plan",
        "The pipelines module requires at least one pipeline definition."
      )
    );
    blockers.push(
      createReason(
        "pipelines.missing_plan",
        "The pipelines module requires at least one pipeline definition.",
        "input"
      )
    );
  }

  const duplicatePipelineKeys = groupDuplicateValues(
    desiredPipelines.map(
      (pipeline) => `${pipeline.objectType}:${pipeline.internalName}`
    )
  );

  for (const duplicate of duplicatePipelineKeys) {
    errors.push(
      createFinding(
        "pipelines.duplicate_pipeline",
        `Pipeline '${duplicate}' is defined more than once in the project blueprint.`
      )
    );
    blockers.push(
      createReason(
        "pipelines.duplicate_pipeline",
        `Pipeline '${duplicate}' is defined more than once in the project blueprint.`,
        "validation"
      )
    );
  }

  for (const pipeline of desiredPipelines) {
    if (pipeline.stages.length === 0) {
      errors.push(
        createFinding(
          "pipelines.stages_missing",
          `Pipeline '${pipeline.internalName}' must include at least one stage.`
        )
      );
      blockers.push(
        createReason(
          "pipelines.stages_missing",
          `Pipeline '${pipeline.internalName}' must include at least one stage.`,
          "input"
        )
      );
      continue;
    }

    const duplicateStageLabels = groupDuplicateValues(
      pipeline.stages.map((stage) => stage.label)
    );
    for (const duplicate of duplicateStageLabels) {
      errors.push(
        createFinding(
          "pipelines.duplicate_stage_label",
          `Pipeline '${pipeline.internalName}' contains duplicate stage label '${duplicate}'.`
        )
      );
      blockers.push(
        createReason(
          "pipelines.duplicate_stage_label",
          `Pipeline '${pipeline.internalName}' contains duplicate stage label '${duplicate}'.`,
          "validation"
        )
      );
    }

    const duplicateStageInternalNames = groupDuplicateValues(
      pipeline.stages.map((stage) => stage.internalName)
    );
    for (const duplicate of duplicateStageInternalNames) {
      errors.push(
        createFinding(
          "pipelines.duplicate_stage_internal_name",
          `Pipeline '${pipeline.internalName}' contains duplicate stage internal name '${duplicate}'.`
        )
      );
      blockers.push(
        createReason(
          "pipelines.duplicate_stage_internal_name",
          `Pipeline '${pipeline.internalName}' contains duplicate stage internal name '${duplicate}'.`,
          "validation"
        )
      );
    }

    const duplicateOrderValues = groupDuplicateValues(
      pipeline.stages.map((stage) => String(stage.order))
    );
    for (const duplicate of duplicateOrderValues) {
      errors.push(
        createFinding(
          "pipelines.duplicate_stage_order",
          `Pipeline '${pipeline.internalName}' contains duplicate stage order '${duplicate}'.`
        )
      );
      blockers.push(
        createReason(
          "pipelines.duplicate_stage_order",
          `Pipeline '${pipeline.internalName}' contains duplicate stage order '${duplicate}'.`,
          "validation"
        )
      );
    }

    const expectedOrders = [...pipeline.stages]
      .sort((left, right) => left.order - right.order)
      .map((stage, index) => stage.order === index);

    if (expectedOrders.includes(false)) {
      warnings.push(
        createFinding(
          "pipelines.non_sequential_stage_order",
          `Pipeline '${pipeline.internalName}' has non-sequential stage order values.`
        )
      );
    }
  }

  if (context.modulePlan.status !== "ready") {
    warnings.push(
      createFinding(
        "pipelines.not_ready",
        "The pipelines module plan is not yet marked ready for execution."
      )
    );
  }

  return {
    errors,
    warnings,
    infos,
    blockers,
    inputRequirements
  };
}

export function createPipelineInputFromProject(
  project: OnboardingProject,
  moduleId = "pipelines"
): PipelineModuleInput {
  findModulePlan(project, moduleId);

  if (moduleId !== "pipelines") {
    throw new Error(
      `Project module '${moduleId}' is not connected to a pipeline dry-run contract.`
    );
  }

  if (project.crmDesign.pipelines.length === 0) {
    throw new Error(
      `Project '${project.id}' does not contain pipeline planning for the pipelines module.`
    );
  }

  const pipelines: ComparablePipelineDefinition[] =
    project.crmDesign.pipelines.map((pipeline) => ({
      objectType: pipeline.objectType,
      internalName: pipeline.internalName,
      label: pipeline.label,
      stages: pipeline.stages.map((stage) => ({
        internalName: stage.internalName,
        label: stage.label,
        order: stage.order,
        ...(stage.probability !== undefined
          ? { probability: stage.probability }
          : {})
      }))
    }));

  return {
    absolutePath: `project:${project.id}:${moduleId}`,
    client: {
      name: project.clientContext.clientName,
      slug: project.clientId
    },
    pipelines
  };
}

const definition = moduleExecutionContractDefinitionSchema.parse({
  moduleKey: "pipelines",
  moduleLabel: "Pipelines",
  supportedModes: ["dry-run"],
  inputRequirements: [
    {
      key: "crm.pipeline-plan",
      label: "Pipeline plan",
      description:
        "At least one deal or ticket pipeline with stages must exist before execution work starts.",
      required: true
    }
  ],
  handlers: {
    validation: true,
    readiness: true,
    dryRun: true,
    apply: false
  },
  resultKind: "hubspot-pipeline-dry-run",
  executionSteps: {
    dryRun: [
      { key: "load-project", label: "Load project", type: "project" },
      {
        key: "validate-project",
        label: "Validate project",
        type: "validation"
      },
      {
        key: "resolve-module-input",
        label: "Resolve module input",
        type: "input"
      },
      {
        key: "load-existing-hubspot-state",
        label: "Load existing HubSpot state",
        type: "integration"
      },
      {
        key: "diff-desired-vs-existing",
        label: "Diff desired vs existing",
        type: "analysis"
      },
      { key: "write-artifact", label: "Write artifact", type: "artifact" },
      {
        key: "persist-execution-record",
        label: "Persist execution record",
        type: "persistence"
      }
    ],
    apply: []
  }
});

export const pipelinesModuleContract: ModuleExecutionContract<PipelineModuleInput> =
  {
    definition,
    validate: buildPipelineAssessment,
    readiness: buildPipelineAssessment,
    resolveInput(context) {
      return createPipelineInputFromProject(
        context.project,
        context.modulePlan.moduleId
      );
    },
    async dryRun(context: ModuleDryRunContext<PipelineModuleInput>) {
      if (!context.hubSpotClient?.fetchPipelines) {
        throw new Error(
          "Pipelines dry run requires a HubSpot pipeline client dependency."
        );
      }

      if (!context.writeArtifact) {
        throw new Error(
          "Pipelines dry run requires an artifact writer dependency."
        );
      }

      let activeStepKey:
        | "load-existing-hubspot-state"
        | "diff-desired-vs-existing"
        | "write-artifact"
        | undefined = "load-existing-hubspot-state";

      await context.stepReporter.start(
        "load-existing-hubspot-state",
        "Fetching current HubSpot pipeline configuration."
      );

      try {
        const result = await executePipelineDryRun({
          input: context.resolvedInput,
          artifactDir: context.artifactDir,
          logger: context.logger,
          hubSpotClient: context.hubSpotClient,
          writeArtifact: context.writeArtifact,
          onExistingStateLoaded(existingPipelines) {
            const completeResult = context.stepReporter.complete(
              "load-existing-hubspot-state",
              {
                summary: `Fetched ${existingPipelines.length} existing HubSpot pipelines.`
              }
            );
            activeStepKey = "diff-desired-vs-existing";
            const startResult = context.stepReporter.start(
              "diff-desired-vs-existing",
              "Comparing desired pipeline plan with existing HubSpot pipelines."
            );
            return Promise.all([completeResult, startResult]).then(
              () => undefined
            );
          },
          onDiffComputed(diff) {
            const completeResult = context.stepReporter.complete(
              "diff-desired-vs-existing",
              {
                summary: `${diff.toCreate.length} pipelines to create, ${diff.needsReview.length} pipelines need review, ${diff.unchanged.length} unchanged.`
              }
            );
            activeStepKey = "write-artifact";
            const startResult = context.stepReporter.start(
              "write-artifact",
              "Writing pipeline dry-run artifact to disk."
            );
            return Promise.all([completeResult, startResult]).then(
              () => undefined
            );
          },
          onArtifactWritten(artifactPath) {
            activeStepKey = undefined;
            return context.stepReporter.complete("write-artifact", {
              summary: "Pipeline dry-run artifact written to disk.",
              output: {
                artifactPath
              }
            });
          }
        });

        const summary = formatPipelineDryRunSummary(result.artifact);
        const warnings =
          result.artifact.summary.needsReviewPipelineCount > 0
            ? [
                `Dry run completed with ${result.artifact.summary.needsReviewPipelineCount} pipelines requiring review.`
              ]
            : [];

        return moduleExecutionResultSchema.parse({
          moduleKey: definition.moduleKey,
          moduleLabel: definition.moduleLabel,
          mode: "dry-run",
          status: "succeeded",
          summary,
          metrics: result.artifact.summary,
          warnings,
          errors: [],
          output: {
            artifactPath: result.artifactPath,
            summaryText: summary,
            specPath: context.resolvedInput.absolutePath
          }
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown pipelines dry-run failure";

        if (activeStepKey) {
          await context.stepReporter.fail(activeStepKey, {
            error: message,
            summary: "Pipelines dry run failed."
          });
        }

        throw error;
      }
    }
  };
