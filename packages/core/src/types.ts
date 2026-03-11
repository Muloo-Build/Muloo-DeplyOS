export type HubSpotObjectType = "contacts";
export type PipelineObjectType = "deals" | "tickets";

export interface PropertyOption {
  label: string;
  value: string;
  displayOrder?: number;
  hidden?: boolean;
}

export interface ComparablePropertyDefinition {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  description?: string;
  groupName?: string;
  formField?: boolean;
  options?: PropertyOption[];
}

export interface SpecFile<TSpec> {
  absolutePath: string;
  raw: unknown;
  spec: TSpec;
}

export interface PropertyDiffChange {
  field: keyof Omit<ComparablePropertyDefinition, "name">;
  desired: unknown;
  existing: unknown;
}

export interface UnchangedPropertyResult {
  name: string;
}

export interface CreatePropertyResult {
  property: ComparablePropertyDefinition;
}

export interface ReviewPropertyResult {
  name: string;
  changes: PropertyDiffChange[];
}

export interface PropertyDiffResult {
  objectType: HubSpotObjectType;
  unchanged: UnchangedPropertyResult[];
  toCreate: CreatePropertyResult[];
  needsReview: ReviewPropertyResult[];
}

export interface ComparablePipelineStageDefinition {
  id?: string;
  internalName: string;
  label: string;
  order: number;
  probability?: number;
}

export interface ComparablePipelineDefinition {
  id?: string;
  objectType: PipelineObjectType;
  internalName: string;
  label: string;
  stages: ComparablePipelineStageDefinition[];
}

export interface PipelineDiffChange {
  field: "label";
  desired: string;
  existing: string;
}

export interface PipelineStageReviewSummary {
  missingInExisting: string[];
  additionalInExisting: string[];
  reordered: string[];
  relabelled: string[];
}

export interface UnchangedPipelineResult {
  objectType: PipelineObjectType;
  internalName: string;
}

export interface CreatePipelineResult {
  pipeline: ComparablePipelineDefinition;
}

export interface ReviewPipelineResult {
  objectType: PipelineObjectType;
  internalName: string;
  changes: PipelineDiffChange[];
  stageSummary: PipelineStageReviewSummary;
}

export interface PipelineDiffResult {
  unchanged: UnchangedPipelineResult[];
  toCreate: CreatePipelineResult[];
  needsReview: ReviewPipelineResult[];
}

export interface PropertyDryRunArtifact {
  kind: "hubspot-property-dry-run";
  dryRun: true;
  generatedAt: string;
  specPath: string;
  client: {
    name: string;
    slug: string;
  };
  objectType: HubSpotObjectType;
  summary: {
    desiredPropertyCount: number;
    existingPropertyCount: number;
    unchangedCount: number;
    toCreateCount: number;
    needsReviewCount: number;
  };
  diff: PropertyDiffResult;
}

export interface PipelineDryRunArtifact {
  kind: "hubspot-pipeline-dry-run";
  dryRun: true;
  generatedAt: string;
  specPath: string;
  client: {
    name: string;
    slug: string;
  };
  summary: {
    desiredPipelineCount: number;
    existingPipelineCount: number;
    unchangedPipelineCount: number;
    toCreatePipelineCount: number;
    needsReviewPipelineCount: number;
    desiredStageCount: number;
    existingStageCount: number;
  };
  diff: PipelineDiffResult;
}

export type DryRunArtifact = PropertyDryRunArtifact | PipelineDryRunArtifact;

export interface DryRunExecutionResult<
  TArtifact extends DryRunArtifact = DryRunArtifact
> {
  artifact: TArtifact;
  artifactPath: string;
}

export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}
