import type { DryRunExecutionResult } from "./types";

function formatNames(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

export function formatDryRunSummary(result: DryRunExecutionResult): string {
  const { artifact } = result;

  return [
    `Muloo Deploy dry run for ${artifact.client.name} (${artifact.objectType})`,
    `Desired properties: ${artifact.summary.desiredPropertyCount}`,
    `Existing properties fetched: ${artifact.summary.existingPropertyCount}`,
    `Unchanged: ${artifact.summary.unchangedCount} [${formatNames(artifact.diff.unchanged.map((item) => item.name))}]`,
    `Create: ${artifact.summary.toCreateCount} [${formatNames(artifact.diff.toCreate.map((item) => item.property.name))}]`,
    `Needs review: ${artifact.summary.needsReviewCount} [${formatNames(artifact.diff.needsReview.map((item) => item.name))}]`
  ].join("\n");
}
