import type {
  DryRunExecutionResult,
  PipelineDryRunArtifact,
  PropertyDryRunArtifact
} from "./types";

function formatNames(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

export function formatDryRunSummary(result: DryRunExecutionResult): string {
  const { artifact } = result as { artifact: PropertyDryRunArtifact };

  return [
    `Muloo Deploy dry run for ${artifact.client.name} (${artifact.objectType})`,
    `Desired properties: ${artifact.summary.desiredPropertyCount}`,
    `Existing properties fetched: ${artifact.summary.existingPropertyCount}`,
    `Unchanged: ${artifact.summary.unchangedCount} [${formatNames(artifact.diff.unchanged.map((item) => item.name))}]`,
    `Create: ${artifact.summary.toCreateCount} [${formatNames(artifact.diff.toCreate.map((item) => item.property.name))}]`,
    `Needs review: ${artifact.summary.needsReviewCount} [${formatNames(artifact.diff.needsReview.map((item) => item.name))}]`
  ].join("\n");
}

export function formatPipelineDryRunSummary(
  artifact: PipelineDryRunArtifact
): string {
  return [
    `Muloo Deploy pipeline dry run for ${artifact.client.name}`,
    `Desired pipelines: ${artifact.summary.desiredPipelineCount}`,
    `Existing pipelines fetched: ${artifact.summary.existingPipelineCount}`,
    `Unchanged: ${artifact.summary.unchangedPipelineCount} [${formatNames(artifact.diff.unchanged.map((item) => `${item.objectType}:${item.internalName}`))}]`,
    `Create: ${artifact.summary.toCreatePipelineCount} [${formatNames(artifact.diff.toCreate.map((item) => `${item.pipeline.objectType}:${item.pipeline.internalName}`))}]`,
    `Needs review: ${artifact.summary.needsReviewPipelineCount} [${formatNames(artifact.diff.needsReview.map((item) => `${item.objectType}:${item.internalName}`))}]`,
    `Desired stages: ${artifact.summary.desiredStageCount}`,
    `Existing stages fetched: ${artifact.summary.existingStageCount}`
  ].join("\n");
}
