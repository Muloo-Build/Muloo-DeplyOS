export type HubSpotObjectType = "contacts";

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

export interface DryRunArtifact {
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

export interface DryRunExecutionResult {
  artifact: DryRunArtifact;
  artifactPath: string;
}

export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}
