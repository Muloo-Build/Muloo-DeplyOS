import { diffPipelines } from "@muloo/diff-engine";
import type {
  ComparablePipelineDefinition,
  DryRunExecutionResult,
  Logger,
  PipelineDryRunArtifact
} from "@muloo/core";

interface PipelineReader {
  fetchPipelines(
    objectType: ComparablePipelineDefinition["objectType"]
  ): Promise<ComparablePipelineDefinition[]>;
}

interface WriteArtifact {
  (params: {
    artifactDir: string;
    artifact: PipelineDryRunArtifact;
  }): Promise<string>;
}

export interface PipelineModuleInput {
  absolutePath: string;
  client: {
    name: string;
    slug: string;
  };
  pipelines: ComparablePipelineDefinition[];
}

interface ExecutePipelineDryRunOptions {
  input: PipelineModuleInput;
  artifactDir: string;
  logger: Logger;
  hubSpotClient: PipelineReader;
  writeArtifact: WriteArtifact;
  onExistingStateLoaded?: (
    existingPipelines: ComparablePipelineDefinition[]
  ) => Promise<void> | void;
  onDiffComputed?: (
    diff: PipelineDryRunArtifact["diff"]
  ) => Promise<void> | void;
  onArtifactWritten?: (
    artifactPath: string,
    artifact: PipelineDryRunArtifact
  ) => Promise<void> | void;
}

export async function executePipelineDryRun(
  options: ExecutePipelineDryRunOptions
): Promise<DryRunExecutionResult<PipelineDryRunArtifact>> {
  options.logger.info("Starting pipeline dry-run execution.", {
    client: options.input.client.slug,
    pipelineCount: options.input.pipelines.length,
    specPath: options.input.absolutePath
  });

  const objectTypes = [
    ...new Set(options.input.pipelines.map((pipeline) => pipeline.objectType))
  ];
  const existingPipelines = (
    await Promise.all(
      objectTypes.map((objectType) =>
        options.hubSpotClient.fetchPipelines(objectType)
      )
    )
  ).flat();

  await options.onExistingStateLoaded?.(existingPipelines);

  const diff = diffPipelines({
    desired: options.input.pipelines,
    existing: existingPipelines
  });

  await options.onDiffComputed?.(diff);

  const artifact: PipelineDryRunArtifact = {
    kind: "hubspot-pipeline-dry-run",
    dryRun: true,
    generatedAt: new Date().toISOString(),
    specPath: options.input.absolutePath,
    client: options.input.client,
    summary: {
      desiredPipelineCount: options.input.pipelines.length,
      existingPipelineCount: existingPipelines.length,
      unchangedPipelineCount: diff.unchanged.length,
      toCreatePipelineCount: diff.toCreate.length,
      needsReviewPipelineCount: diff.needsReview.length,
      desiredStageCount: options.input.pipelines.reduce(
        (total, pipeline) => total + pipeline.stages.length,
        0
      ),
      existingStageCount: existingPipelines.reduce(
        (total, pipeline) => total + pipeline.stages.length,
        0
      )
    },
    diff
  };

  const artifactPath = await options.writeArtifact({
    artifactDir: options.artifactDir,
    artifact
  });

  await options.onArtifactWritten?.(artifactPath, artifact);

  options.logger.info("Pipeline dry-run execution completed.", {
    artifactPath,
    unchangedPipelineCount: artifact.summary.unchangedPipelineCount,
    toCreatePipelineCount: artifact.summary.toCreatePipelineCount,
    needsReviewPipelineCount: artifact.summary.needsReviewPipelineCount
  });

  return {
    artifact,
    artifactPath
  };
}
