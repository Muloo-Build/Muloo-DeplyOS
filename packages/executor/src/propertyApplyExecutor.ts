import { diffProperties } from "@muloo/diff-engine";
import type {
  ApplyExecutionResult,
  ComparablePropertyDefinition,
  Logger,
  OnboardingSpec,
  PropertyApplyArtifact,
  ReviewPropertyResult,
  SpecFile
} from "@muloo/core";

export interface PropertyApplyOperationRecord {
  id: string;
  operationType:
    | "create-contact-property"
    | "update-contact-property"
    | "mutate-contact-property-options";
  status: "requested" | "executed" | "blocked";
  targetType: "contact-property";
  targetKey: string;
  targetLabel?: string;
  objectType: "contacts";
  message?: string;
}

export interface PropertyApplyGuardrailEvaluation {
  allowed: boolean;
  requestedOperations: PropertyApplyOperationRecord[];
  blockedOperations: PropertyApplyOperationRecord[];
  message?: string;
}

interface PropertyApplyWriter {
  createProperty(
    objectType: OnboardingSpec["crm"]["objectType"],
    property: ComparablePropertyDefinition
  ): Promise<ComparablePropertyDefinition>;
}

interface PropertyApplyReader {
  fetchProperties(
    objectType: OnboardingSpec["crm"]["objectType"]
  ): Promise<ComparablePropertyDefinition[]>;
  getPropertyByName(
    objectType: OnboardingSpec["crm"]["objectType"],
    propertyName: string
  ): Promise<ComparablePropertyDefinition | null>;
}

interface WriteArtifact {
  (params: {
    artifactDir: string;
    artifact: PropertyApplyArtifact;
  }): Promise<string>;
}

export interface ExecutePropertyApplyOptions {
  spec: SpecFile<OnboardingSpec>;
  specPath: string;
  artifactDir: string;
  logger: Logger;
  hubSpotClient: PropertyApplyReader & PropertyApplyWriter;
  writeArtifact: WriteArtifact;
  onExistingStateLoaded?: (
    existingProperties: ComparablePropertyDefinition[]
  ) => Promise<void> | void;
  onDiffComputed?: (
    diff: PropertyApplyArtifact["diff"]
  ) => Promise<void> | void;
  onGuardrailsEvaluated?: (
    evaluation: PropertyApplyGuardrailEvaluation
  ) => Promise<void> | void;
  onCreatesExecuted?: (
    createdProperties: ComparablePropertyDefinition[]
  ) => Promise<void> | void;
  onArtifactWritten?: (
    artifactPath: string,
    artifact: PropertyApplyArtifact
  ) => Promise<void> | void;
}

export interface PropertyApplyExecutionResult extends ApplyExecutionResult<PropertyApplyArtifact> {
  guardrails: PropertyApplyGuardrailEvaluation;
}

function createOperationId(prefix: string, propertyName: string): string {
  return `${prefix}:${propertyName}`;
}

function createRequestedOperation(
  property: ComparablePropertyDefinition
): PropertyApplyOperationRecord {
  return {
    id: createOperationId("create", property.name),
    operationType: "create-contact-property",
    status: "requested",
    targetType: "contact-property",
    targetKey: property.name,
    ...(property.label ? { targetLabel: property.label } : {}),
    objectType: "contacts"
  };
}

function createBlockedOperation(
  property: ReviewPropertyResult
): PropertyApplyOperationRecord {
  const includesOptionMutation = property.changes.some(
    (change) => change.field === "options"
  );

  return {
    id: createOperationId("blocked", property.name),
    operationType: includesOptionMutation
      ? "mutate-contact-property-options"
      : "update-contact-property",
    status: "blocked",
    targetType: "contact-property",
    targetKey: property.name,
    objectType: "contacts",
    message:
      "Existing contact property differs from the desired plan. Apply mode only allows create-only operations."
  };
}

function evaluateApplyGuardrails(
  spec: SpecFile<OnboardingSpec>,
  diff: PropertyApplyArtifact["diff"]
): PropertyApplyGuardrailEvaluation {
  const requestedOperations = diff.toCreate.map((item) =>
    createRequestedOperation(item.property)
  );
  const blockedOperations = diff.needsReview.map(createBlockedOperation);

  if (spec.spec.crm.objectType !== "contacts") {
    return {
      allowed: false,
      requestedOperations: [],
      blockedOperations: [
        {
          id: `blocked:${spec.spec.crm.objectType}`,
          operationType: "create-contact-property",
          status: "blocked",
          targetType: "contact-property",
          targetKey: spec.spec.crm.objectType,
          objectType: "contacts",
          message:
            "Apply mode is limited to create-only contact properties in this phase."
        }
      ],
      message:
        "Apply mode is blocked because only contact property creation is supported."
    };
  }

  if (blockedOperations.length > 0) {
    return {
      allowed: false,
      requestedOperations,
      blockedOperations,
      message:
        "Apply mode is blocked because the diff includes changes that are not safe create-only operations."
    };
  }

  return {
    allowed: true,
    requestedOperations,
    blockedOperations: []
  };
}

export async function executePropertyApply(
  options: ExecutePropertyApplyOptions
): Promise<PropertyApplyExecutionResult> {
  options.logger.info("Starting guarded apply execution.", {
    client: options.spec.spec.client.slug,
    objectType: options.spec.spec.crm.objectType,
    specPath: options.specPath
  });

  const existingProperties = await options.hubSpotClient.fetchProperties(
    options.spec.spec.crm.objectType
  );
  await options.onExistingStateLoaded?.(existingProperties);

  const diff = diffProperties({
    objectType: options.spec.spec.crm.objectType,
    desired: options.spec.spec.crm.properties,
    existing: existingProperties
  });
  await options.onDiffComputed?.(diff);

  const guardrails = evaluateApplyGuardrails(options.spec, diff);
  await options.onGuardrailsEvaluated?.(guardrails);

  const createdProperties: ComparablePropertyDefinition[] = [];
  const executedOperations: PropertyApplyOperationRecord[] = [];

  if (guardrails.allowed) {
    for (const requestedOperation of guardrails.requestedOperations) {
      const propertyToCreate = diff.toCreate.find(
        (item) => item.property.name === requestedOperation.targetKey
      )?.property;

      if (!propertyToCreate) {
        continue;
      }

      // Check if property already exists before attempting to create
      const existingProperty = await options.hubSpotClient.getPropertyByName(
        "contacts",
        propertyToCreate.name
      );

      if (existingProperty) {
        options.logger.info("Property already exists, skipping create.", {
          propertyName: propertyToCreate.name
        });
        createdProperties.push(existingProperty);
        executedOperations.push({
          ...requestedOperation,
          status: "executed",
          message: "Contact property already exists in HubSpot."
        });
        continue;
      }

      const createdProperty = await options.hubSpotClient.createProperty(
        "contacts",
        propertyToCreate
      );

      createdProperties.push(createdProperty);
      executedOperations.push({
        ...requestedOperation,
        status: "executed",
        message: "Contact property created in HubSpot."
      });
    }
  }

  await options.onCreatesExecuted?.(createdProperties);

  const artifact: PropertyApplyArtifact = {
    kind: "hubspot-property-apply",
    dryRun: false,
    generatedAt: new Date().toISOString(),
    specPath: options.specPath,
    client: options.spec.spec.client,
    objectType: "contacts",
    summary: {
      desiredPropertyCount: options.spec.spec.crm.properties.length,
      existingPropertyCount: existingProperties.length,
      unchangedCount: diff.unchanged.length,
      toCreateCount: diff.toCreate.length,
      needsReviewCount: diff.needsReview.length,
      requestedOperationCount: guardrails.requestedOperations.length,
      executedOperationCount: executedOperations.length,
      blockedOperationCount: guardrails.blockedOperations.length,
      createdPropertyCount: executedOperations.length
    },
    diff,
    operations: {
      requested: guardrails.requestedOperations,
      executed: executedOperations,
      blocked: guardrails.blockedOperations
    }
  };

  const artifactPath = await options.writeArtifact({
    artifactDir: options.artifactDir,
    artifact
  });
  await options.onArtifactWritten?.(artifactPath, artifact);

  options.logger.info("Guarded apply execution completed.", {
    artifactPath,
    requestedOperationCount: artifact.summary.requestedOperationCount,
    executedOperationCount: artifact.summary.executedOperationCount,
    blockedOperationCount: artifact.summary.blockedOperationCount
  });

  return {
    artifact,
    artifactPath,
    guardrails
  };
}
