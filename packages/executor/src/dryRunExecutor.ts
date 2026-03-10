import { diffProperties } from "@muloo/diff-engine";
import type {
  ComparablePropertyDefinition,
  DryRunArtifact,
  DryRunExecutionResult,
  Logger,
  OnboardingSpec,
  SpecFile
} from "@muloo/core";

interface PropertyReader {
  fetchProperties(
    objectType: OnboardingSpec["crm"]["objectType"]
  ): Promise<ComparablePropertyDefinition[]>;
}

interface WriteArtifact {
  (params: { artifactDir: string; artifact: DryRunArtifact }): Promise<string>;
}

interface ExecutePropertyDryRunOptions {
  spec: SpecFile<OnboardingSpec>;
  specPath: string;
  artifactDir: string;
  logger: Logger;
  hubSpotClient: PropertyReader;
  writeArtifact: WriteArtifact;
}

export async function executePropertyDryRun(
  options: ExecutePropertyDryRunOptions
): Promise<DryRunExecutionResult> {
  options.logger.info("Starting dry-run execution.", {
    client: options.spec.spec.client.slug,
    objectType: options.spec.spec.crm.objectType,
    specPath: options.specPath
  });

  const existingProperties = await options.hubSpotClient.fetchProperties(
    options.spec.spec.crm.objectType
  );
  const diff = diffProperties({
    objectType: options.spec.spec.crm.objectType,
    desired: options.spec.spec.crm.properties,
    existing: existingProperties
  });

  const artifact: DryRunArtifact = {
    kind: "hubspot-property-dry-run",
    dryRun: true,
    generatedAt: new Date().toISOString(),
    specPath: options.specPath,
    client: options.spec.spec.client,
    objectType: options.spec.spec.crm.objectType,
    summary: {
      desiredPropertyCount: options.spec.spec.crm.properties.length,
      existingPropertyCount: existingProperties.length,
      unchangedCount: diff.unchanged.length,
      toCreateCount: diff.toCreate.length,
      needsReviewCount: diff.needsReview.length
    },
    diff
  };

  const artifactPath = await options.writeArtifact({
    artifactDir: options.artifactDir,
    artifact
  });

  options.logger.info("Dry-run execution completed.", {
    artifactPath,
    unchangedCount: artifact.summary.unchangedCount,
    toCreateCount: artifact.summary.toCreateCount,
    needsReviewCount: artifact.summary.needsReviewCount
  });

  return {
    artifact,
    artifactPath
  };
}
