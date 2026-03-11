import {
  formatDryRunSummary,
  formatPropertyApplySummary,
  onboardingSpecSchema,
  type OnboardingSpec,
  type SpecFile
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
  ModuleApplyContext,
  ModuleContractAssessment,
  ModuleContractContext,
  ModuleDryRunContext,
  ModuleExecutionContract
} from "./contracts";
import { executePropertyDryRun } from "./dryRunExecutor";
import { executePropertyApply } from "./propertyApplyExecutor";

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

function buildAssessment(
  context: ModuleContractContext
): ModuleContractAssessment {
  const contactPlan = context.project.propertyPlanning.propertiesByObject.find(
    (group) => group.objectType === "contacts"
  );
  const contactGroups =
    context.project.propertyPlanning.propertyGroupsByObject.find(
      (group) => group.objectType === "contacts"
    );

  const inputRequirements: ModuleInputRequirementStatus[] = [
    createInputStatus({
      key: "crm.contacts-scope",
      label: "Contacts object scope",
      description: "Contacts must be included in the CRM object plan.",
      required: true,
      present: context.project.crmDesign.objectsInScope.includes("contacts"),
      message: context.project.crmDesign.objectsInScope.includes("contacts")
        ? "Contacts are included in scope."
        : "Add contacts to crmDesign.objectsInScope."
    }),
    createInputStatus({
      key: "properties.contacts-plan",
      label: "Contact property plan",
      description:
        "The properties module requires planned contact properties in the project blueprint.",
      required: true,
      present: Boolean(contactPlan && contactPlan.properties.length > 0),
      message:
        contactPlan && contactPlan.properties.length > 0
          ? `${contactPlan.properties.length} contact properties are planned.`
          : "Add at least one contact property to propertyPlanning.propertiesByObject."
    }),
    createInputStatus({
      key: "properties.contact-groups",
      label: "Contact property groups",
      description:
        "Explicit contact property groups improve grouping consistency for HubSpot setup.",
      required: false,
      present: Boolean(contactGroups && contactGroups.groups.length > 0),
      message:
        contactGroups && contactGroups.groups.length > 0
          ? `${contactGroups.groups.length} property groups are defined.`
          : "Define contact property groups or confirm that existing HubSpot groups will be reused."
    })
  ];

  const errors: ValidationFinding[] = [];
  const warnings: ValidationFinding[] = [];
  const infos: ValidationFinding[] = [
    createFinding(
      "properties.dry_run_supported",
      "Properties module is connected to the contract-based project/module dry-run flow."
    ),
    createFinding(
      "properties.apply_create_only_supported",
      "Properties module supports guarded apply for create-only contact properties."
    )
  ];
  const blockers: ReadinessReason[] = [];

  for (const requirement of inputRequirements) {
    if (requirement.status === "missing" && requirement.required) {
      errors.push(
        createFinding(
          "properties.missing_required_input",
          requirement.message ?? `${requirement.label} is missing.`
        )
      );
      blockers.push(
        createReason(
          "properties.required_input_missing",
          requirement.message ?? `${requirement.label} is missing.`,
          "input"
        )
      );
    }
  }

  if (inputRequirements[2]?.status === "missing") {
    warnings.push(
      createFinding(
        "properties.contacts_missing_groups",
        inputRequirements[2].message ??
          "Contact property groups are not explicitly defined."
      )
    );
  }

  for (const propertyGroup of context.project.propertyPlanning
    .propertiesByObject) {
    const availableGroups = new Set(
      context.project.propertyPlanning.propertyGroupsByObject
        .find((group) => group.objectType === propertyGroup.objectType)
        ?.groups.map((group) => group.internalName) ?? []
    );

    for (const property of propertyGroup.properties) {
      if (!property.internalName || !property.label || !property.valueType) {
        errors.push(
          createFinding(
            "properties.missing_core_fields",
            `Property '${property.internalName || property.label || "unknown"}' is missing required planning fields.`
          )
        );
        blockers.push(
          createReason(
            "properties.missing_core_fields",
            `Property '${property.internalName || property.label || "unknown"}' is missing required planning fields.`,
            "validation"
          )
        );
      }

      if (
        availableGroups.size > 0 &&
        !availableGroups.has(property.groupName)
      ) {
        warnings.push(
          createFinding(
            "properties.group_reference_missing",
            `Property '${property.internalName}' references missing group '${property.groupName}'.`
          )
        );
      }

      if (
        property.valueType === "enumeration" ||
        ["select", "radio", "checkbox"].includes(property.fieldType)
      ) {
        if (!property.options || property.options.length === 0) {
          errors.push(
            createFinding(
              "properties.options_required",
              `Property '${property.internalName}' requires at least one option.`
            )
          );
          blockers.push(
            createReason(
              "properties.options_required",
              `Property '${property.internalName}' requires at least one option.`,
              "validation"
            )
          );
        }
      }
    }
  }

  return {
    errors,
    warnings,
    infos,
    blockers,
    inputRequirements
  };
}

export function createPropertySpecFromProject(
  project: OnboardingProject,
  moduleId = "properties"
): SpecFile<OnboardingSpec> {
  findModulePlan(project, moduleId);

  if (moduleId !== "properties") {
    throw new Error(
      `Project module '${moduleId}' is not connected to a property dry-run contract.`
    );
  }

  const contactPlan = project.propertyPlanning.propertiesByObject.find(
    (group) => group.objectType === "contacts"
  );

  if (!contactPlan || contactPlan.properties.length === 0) {
    throw new Error(
      `Project '${project.id}' does not contain contact property planning for the properties module.`
    );
  }

  const spec = onboardingSpecSchema.parse({
    schemaVersion: "1.0",
    client: {
      name: project.clientContext.clientName,
      slug: project.clientId
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
    absolutePath: `project:${project.id}:${moduleId}`,
    raw: project,
    spec
  };
}

function toExecutionOperations(
  operations: Awaited<
    ReturnType<typeof executePropertyApply>
  >["artifact"]["operations"]
) {
  return {
    requested: operations.requested.map((operation) => ({ ...operation })),
    executed: operations.executed.map((operation) => ({ ...operation })),
    blocked: operations.blocked.map((operation) => ({ ...operation }))
  };
}

const definition = moduleExecutionContractDefinitionSchema.parse({
  moduleKey: "properties",
  moduleLabel: "Properties",
  supportedModes: ["dry-run", "apply"],
  inputRequirements: [
    {
      key: "crm.contacts-scope",
      label: "Contacts object scope",
      description: "Contacts must be in scope for property planning.",
      required: true
    },
    {
      key: "properties.contacts-plan",
      label: "Contact property plan",
      description:
        "A contact property plan must exist in the project blueprint.",
      required: true
    },
    {
      key: "properties.contact-groups",
      label: "Contact property groups",
      description: "Explicit contact property groups improve operator review.",
      required: false
    }
  ],
  handlers: {
    validation: true,
    readiness: true,
    dryRun: true,
    apply: true
  },
  applyGuardrails: {
    enabled: true,
    summary:
      "Only create-only contact property apply is enabled in this phase. Updates, deletes, renames, and option mutations remain blocked.",
    requiresExplicitFlag: true,
    confirmationFlags: ["--allow-create-only"],
    approvalRequirement:
      "Apply execution requires both an explicit CLI apply flag and an operator confirmation flag.",
    allowedOperationTypes: ["create-contact-property"],
    blockedOperationTypes: [
      "update-contact-property",
      "delete-contact-property",
      "rename-contact-property",
      "mutate-contact-property-options"
    ],
    guardConditions: [
      {
        key: "properties.contacts_only",
        label: "Contacts only",
        description:
          "Apply mode is limited to contact properties in this phase."
      },
      {
        key: "properties.create_only",
        label: "Create only",
        description:
          "Only missing contact properties may be created. Existing property mutations remain blocked."
      },
      {
        key: "properties.clean_diff_required",
        label: "Clean diff required",
        description:
          "Apply stops if the diff contains review/update-style changes."
      }
    ]
  },
  resultKind: "hubspot-property-execution",
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
    apply: [
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
      {
        key: "evaluate-apply-guardrails",
        label: "Evaluate apply guardrails",
        type: "guardrail"
      },
      {
        key: "execute-safe-creates",
        label: "Execute safe creates",
        type: "execution"
      },
      { key: "write-artifact", label: "Write artifact", type: "artifact" },
      {
        key: "persist-execution-record",
        label: "Persist execution record",
        type: "persistence"
      }
    ]
  }
});

export const propertiesModuleContract: ModuleExecutionContract<
  SpecFile<OnboardingSpec>
> = {
  definition,
  validate: buildAssessment,
  readiness: buildAssessment,
  resolveInput(context) {
    return createPropertySpecFromProject(
      context.project,
      context.modulePlan.moduleId
    );
  },
  async dryRun(context: ModuleDryRunContext<SpecFile<OnboardingSpec>>) {
    if (!context.hubSpotClient) {
      throw new Error(
        "Properties dry run requires a HubSpot client dependency."
      );
    }

    if (!context.writeArtifact) {
      throw new Error(
        "Properties dry run requires an artifact writer dependency."
      );
    }

    let activeStepKey:
      | "load-existing-hubspot-state"
      | "diff-desired-vs-existing"
      | "write-artifact"
      | undefined = "load-existing-hubspot-state";

    await context.stepReporter.start(
      "load-existing-hubspot-state",
      "Fetching current HubSpot CRM properties."
    );

    try {
      const result = await executePropertyDryRun({
        artifactDir: context.artifactDir,
        hubSpotClient: context.hubSpotClient,
        logger: context.logger,
        spec: context.resolvedInput,
        specPath: context.resolvedInput.absolutePath,
        writeArtifact: context.writeArtifact,
        onExistingStateLoaded(existingProperties) {
          const completeResult = context.stepReporter.complete(
            "load-existing-hubspot-state",
            {
              summary: `Fetched ${existingProperties.length} existing HubSpot properties.`
            }
          );
          activeStepKey = "diff-desired-vs-existing";
          const startResult = context.stepReporter.start(
            "diff-desired-vs-existing",
            "Comparing desired property plan with existing HubSpot properties."
          );
          return Promise.all([completeResult, startResult]).then(
            () => undefined
          );
        },
        onDiffComputed(diff) {
          const completeResult = context.stepReporter.complete(
            "diff-desired-vs-existing",
            {
              summary: `${diff.toCreate.length} properties to create, ${diff.needsReview.length} properties need review, ${diff.unchanged.length} unchanged.`
            }
          );
          activeStepKey = "write-artifact";
          const startResult = context.stepReporter.start(
            "write-artifact",
            "Writing dry-run artifact to disk."
          );
          return Promise.all([completeResult, startResult]).then(
            () => undefined
          );
        },
        onArtifactWritten(artifactPath) {
          activeStepKey = undefined;
          return context.stepReporter.complete("write-artifact", {
            summary: "Dry-run artifact written to disk.",
            output: {
              artifactPath
            }
          });
        }
      });

      const summary = formatDryRunSummary(result);
      const warnings =
        result.artifact.summary.needsReviewCount > 0
          ? [
              `Dry run completed with ${result.artifact.summary.needsReviewCount} properties requiring review.`
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
          : "Unknown properties dry-run failure";

      if (activeStepKey) {
        await context.stepReporter.fail(activeStepKey, {
          error: message,
          summary: "Properties dry run failed."
        });
      }

      throw error;
    }
  },
  async apply(context: ModuleApplyContext<SpecFile<OnboardingSpec>>) {
    if (!context.hubSpotClient?.fetchProperties) {
      throw new Error("Properties apply requires a HubSpot read dependency.");
    }

    if (!context.hubSpotClient?.createProperty) {
      throw new Error(
        "Properties apply requires a HubSpot property create dependency."
      );
    }

    if (!context.writeArtifact) {
      throw new Error(
        "Properties apply requires an artifact writer dependency."
      );
    }

    if (context.resolvedInput.spec.crm.objectType !== "contacts") {
      throw new Error(
        "Properties apply is limited to contact properties in this phase."
      );
    }

    let activeStepKey:
      | "load-existing-hubspot-state"
      | "diff-desired-vs-existing"
      | "evaluate-apply-guardrails"
      | "execute-safe-creates"
      | "write-artifact"
      | undefined = "load-existing-hubspot-state";

    await context.stepReporter.start(
      "load-existing-hubspot-state",
      "Fetching current HubSpot CRM properties before guarded apply."
    );

    try {
      const result = await executePropertyApply({
        artifactDir: context.artifactDir,
        hubSpotClient: context.hubSpotClient,
        logger: context.logger,
        spec: context.resolvedInput,
        specPath: context.resolvedInput.absolutePath,
        writeArtifact: context.writeArtifact,
        onExistingStateLoaded(existingProperties) {
          const completeResult = context.stepReporter.complete(
            "load-existing-hubspot-state",
            {
              summary: `Fetched ${existingProperties.length} existing HubSpot properties.`
            }
          );
          activeStepKey = "diff-desired-vs-existing";
          const startResult = context.stepReporter.start(
            "diff-desired-vs-existing",
            "Comparing desired property plan with existing HubSpot properties."
          );
          return Promise.all([completeResult, startResult]).then(
            () => undefined
          );
        },
        onDiffComputed(diff) {
          const completeResult = context.stepReporter.complete(
            "diff-desired-vs-existing",
            {
              summary: `${diff.toCreate.length} safe create candidates, ${diff.needsReview.length} blocked review items, ${diff.unchanged.length} unchanged.`
            }
          );
          activeStepKey = "evaluate-apply-guardrails";
          const startResult = context.stepReporter.start(
            "evaluate-apply-guardrails",
            "Evaluating create-only apply guardrails."
          );
          return Promise.all([completeResult, startResult]).then(
            () => undefined
          );
        },
        async onGuardrailsEvaluated(evaluation) {
          const warnings = evaluation.blockedOperations
            .map((operation) => operation.message)
            .filter((value): value is string => Boolean(value));
          const completeResult = context.stepReporter.complete(
            "evaluate-apply-guardrails",
            {
              summary: evaluation.allowed
                ? `Guardrails approved ${evaluation.requestedOperations.length} safe create operations.`
                : (evaluation.message ?? "Guardrails blocked apply execution."),
              warnings
            }
          );

          if (evaluation.allowed) {
            activeStepKey = "execute-safe-creates";
            const startResult = context.stepReporter.start(
              "execute-safe-creates",
              "Creating missing contact properties in HubSpot."
            );
            await Promise.all([completeResult, startResult]);
            return;
          }

          activeStepKey = "execute-safe-creates";
          const skippedStep = context.stepReporter.start(
            "execute-safe-creates",
            "Safe create execution skipped because guardrails blocked apply."
          );
          const completeSkippedStep = context.stepReporter.complete(
            "execute-safe-creates",
            {
              summary:
                "No property creates were executed because apply guardrails blocked the run."
            }
          );
          activeStepKey = "write-artifact";
          const startArtifact = context.stepReporter.start(
            "write-artifact",
            "Writing guarded apply artifact to disk."
          );
          await Promise.all([
            completeResult,
            skippedStep,
            completeSkippedStep,
            startArtifact
          ]);
        },
        onCreatesExecuted(createdProperties) {
          const completeResult = context.stepReporter.complete(
            "execute-safe-creates",
            {
              summary:
                createdProperties.length > 0
                  ? `Created ${createdProperties.length} contact properties in HubSpot.`
                  : "No missing contact properties required creation."
            }
          );
          activeStepKey = "write-artifact";
          const startResult = context.stepReporter.start(
            "write-artifact",
            "Writing guarded apply artifact to disk."
          );
          return Promise.all([completeResult, startResult]).then(
            () => undefined
          );
        },
        onArtifactWritten(artifactPath) {
          activeStepKey = undefined;
          return context.stepReporter.complete("write-artifact", {
            summary: "Guarded apply artifact written to disk.",
            output: {
              artifactPath
            }
          });
        }
      });

      const summary = formatPropertyApplySummary(result);
      const operations = toExecutionOperations(result.artifact.operations);
      const warnings = operations.blocked
        .map((operation) => operation.message)
        .filter((value): value is string => Boolean(value));

      if (!result.guardrails.allowed) {
        return moduleExecutionResultSchema.parse({
          moduleKey: definition.moduleKey,
          moduleLabel: definition.moduleLabel,
          mode: "apply",
          status: "failed",
          summary,
          metrics: result.artifact.summary,
          warnings,
          errors: [
            result.guardrails.message ??
              "Guarded apply blocked because the diff includes unsupported operations."
          ],
          output: {
            artifactPath: result.artifactPath,
            summaryText: summary,
            specPath: context.resolvedInput.absolutePath
          },
          operations
        });
      }

      return moduleExecutionResultSchema.parse({
        moduleKey: definition.moduleKey,
        moduleLabel: definition.moduleLabel,
        mode: "apply",
        status: "succeeded",
        summary,
        metrics: result.artifact.summary,
        warnings,
        errors: [],
        output: {
          artifactPath: result.artifactPath,
          summaryText: summary,
          specPath: context.resolvedInput.absolutePath
        },
        operations
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown properties apply failure";

      if (activeStepKey) {
        await context.stepReporter.fail(activeStepKey, {
          error: message,
          summary: "Properties apply failed."
        });
      }

      throw error;
    }
  }
};
