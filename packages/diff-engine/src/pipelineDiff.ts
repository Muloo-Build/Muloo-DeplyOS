import type {
  ComparablePipelineDefinition,
  PipelineDiffResult,
  PipelineObjectType
} from "@muloo/core";

function createPipelineKey(
  objectType: PipelineObjectType,
  internalName: string
): string {
  return `${objectType}:${internalName}`;
}

function normalizeStageOrder(
  stages: ComparablePipelineDefinition["stages"]
): string {
  return JSON.stringify(
    [...stages]
      .sort((left, right) => left.order - right.order)
      .map((stage) => ({
        internalName: stage.internalName,
        label: stage.label,
        order: stage.order
      }))
  );
}

export function diffPipelines(params: {
  desired: ComparablePipelineDefinition[];
  existing: ComparablePipelineDefinition[];
}): PipelineDiffResult {
  const existingByKey = new Map(
    params.existing.map((pipeline) => [
      createPipelineKey(pipeline.objectType, pipeline.internalName),
      pipeline
    ])
  );

  const result: PipelineDiffResult = {
    unchanged: [],
    toCreate: [],
    needsReview: []
  };

  for (const desiredPipeline of params.desired) {
    const key = createPipelineKey(
      desiredPipeline.objectType,
      desiredPipeline.internalName
    );
    const existingPipeline = existingByKey.get(key);

    if (!existingPipeline) {
      result.toCreate.push({ pipeline: desiredPipeline });
      continue;
    }

    const changes: Array<{
      field: "label";
      desired: string;
      existing: string;
    }> = [];

    if (desiredPipeline.label !== existingPipeline.label) {
      changes.push({
        field: "label",
        desired: desiredPipeline.label,
        existing: existingPipeline.label
      });
    }

    const desiredStageNames = new Set(
      desiredPipeline.stages.map((stage) => stage.internalName)
    );
    const existingStageNames = new Set(
      existingPipeline.stages.map((stage) => stage.internalName)
    );

    const missingInExisting = desiredPipeline.stages
      .filter((stage) => !existingStageNames.has(stage.internalName))
      .map((stage) => stage.internalName);
    const additionalInExisting = existingPipeline.stages
      .filter((stage) => !desiredStageNames.has(stage.internalName))
      .map((stage) => stage.internalName);

    const reordered = desiredPipeline.stages
      .filter((desiredStage) => {
        const existingStage = existingPipeline.stages.find(
          (stage) => stage.internalName === desiredStage.internalName
        );

        return existingStage
          ? existingStage.order !== desiredStage.order
          : false;
      })
      .map((stage) => stage.internalName);
    const relabelled = desiredPipeline.stages
      .filter((desiredStage) => {
        const existingStage = existingPipeline.stages.find(
          (stage) => stage.internalName === desiredStage.internalName
        );

        return existingStage
          ? existingStage.label !== desiredStage.label
          : false;
      })
      .map((stage) => stage.internalName);

    if (
      changes.length === 0 &&
      missingInExisting.length === 0 &&
      additionalInExisting.length === 0 &&
      reordered.length === 0 &&
      relabelled.length === 0 &&
      normalizeStageOrder(desiredPipeline.stages) ===
        normalizeStageOrder(existingPipeline.stages)
    ) {
      result.unchanged.push({
        objectType: desiredPipeline.objectType,
        internalName: desiredPipeline.internalName
      });
      continue;
    }

    result.needsReview.push({
      objectType: desiredPipeline.objectType,
      internalName: desiredPipeline.internalName,
      changes,
      stageSummary: {
        missingInExisting,
        additionalInExisting,
        reordered,
        relabelled
      }
    });
  }

  return result;
}
