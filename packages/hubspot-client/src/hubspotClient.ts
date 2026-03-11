import type {
  ComparablePipelineDefinition,
  ComparablePipelineStageDefinition,
  ComparablePropertyDefinition,
  HubSpotObjectType,
  Logger,
  PipelineObjectType,
  PropertyOption
} from "@muloo/core";

interface HubSpotClientOptions {
  accessToken: string;
  logger: Logger;
  baseUrl?: string;
}

interface HubSpotPropertiesResponse {
  results: HubSpotPropertyResponse[];
}

interface HubSpotPropertyResponse {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  description?: string;
  groupName?: string;
  formField?: boolean;
  options?: HubSpotPropertyOptionResponse[];
}

interface HubSpotPropertyOptionResponse {
  label: string;
  value: string;
  displayOrder?: number;
  hidden?: boolean;
}

interface HubSpotPipelinesResponse {
  results: HubSpotPipelineResponse[];
}

interface HubSpotPipelineResponse {
  id?: string;
  label: string;
  displayOrder?: number;
  stages?: HubSpotPipelineStageResponse[];
}

interface HubSpotPipelineStageResponse {
  id?: string;
  label: string;
  displayOrder?: number;
  metadata?: {
    probability?: string;
  };
}

function normalizeOptions(
  options?: HubSpotPropertyOptionResponse[]
): PropertyOption[] | undefined {
  if (!options || options.length === 0) {
    return undefined;
  }

  return options.map((option) => {
    const normalized: PropertyOption = {
      label: option.label,
      value: option.value
    };

    if (option.displayOrder !== undefined) {
      normalized.displayOrder = option.displayOrder;
    }

    if (option.hidden !== undefined) {
      normalized.hidden = option.hidden;
    }

    return normalized;
  });
}

function normalizeProperty(
  property: HubSpotPropertyResponse
): ComparablePropertyDefinition {
  const normalized: ComparablePropertyDefinition = {
    name: property.name,
    label: property.label,
    type: property.type,
    fieldType: property.fieldType
  };

  if (property.description !== undefined) {
    normalized.description = property.description;
  }

  if (property.groupName !== undefined) {
    normalized.groupName = property.groupName;
  }

  if (property.formField !== undefined) {
    normalized.formField = property.formField;
  }

  const options = normalizeOptions(property.options);
  if (options !== undefined) {
    normalized.options = options;
  }

  return normalized;
}

function normalizePipelineStage(
  pipelineInternalName: string,
  stage: HubSpotPipelineStageResponse,
  index: number
): ComparablePipelineStageDefinition {
  return {
    ...(stage.id ? { id: stage.id } : {}),
    internalName: stage.id ?? `${pipelineInternalName}_stage_${index}`,
    label: stage.label,
    order: stage.displayOrder ?? index,
    ...(stage.metadata?.probability !== undefined
      ? { probability: Number(stage.metadata.probability) }
      : {})
  };
}

function normalizePipeline(
  objectType: PipelineObjectType,
  pipeline: HubSpotPipelineResponse
): ComparablePipelineDefinition {
  const internalName =
    pipeline.id ?? pipeline.label.toLowerCase().replace(/\s+/g, "_");

  return {
    ...(pipeline.id ? { id: pipeline.id } : {}),
    objectType,
    internalName,
    label: pipeline.label,
    stages: (pipeline.stages ?? []).map((stage, index) =>
      normalizePipelineStage(internalName, stage, index)
    )
  };
}

export class HubSpotClient {
  private readonly accessToken: string;
  private readonly baseUrl: string;
  private readonly logger: Logger;

  public constructor(options: HubSpotClientOptions) {
    this.accessToken = options.accessToken;
    this.baseUrl = options.baseUrl ?? "https://api.hubapi.com";
    this.logger = options.logger;
  }

  public async fetchProperties(
    objectType: HubSpotObjectType
  ): Promise<ComparablePropertyDefinition[]> {
    const url = `${this.baseUrl}/crm/v3/properties/${objectType}`;
    this.logger.info("Fetching HubSpot CRM properties.", { objectType, url });

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `HubSpot property fetch failed with status ${response.status}: ${body}`
      );
    }

    const payload = (await response.json()) as HubSpotPropertiesResponse;
    return payload.results.map(normalizeProperty);
  }

  public async fetchPipelines(
    objectType: PipelineObjectType
  ): Promise<ComparablePipelineDefinition[]> {
    const url = `${this.baseUrl}/crm/v3/pipelines/${objectType}`;
    this.logger.info("Fetching HubSpot CRM pipelines.", { objectType, url });

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `HubSpot pipeline fetch failed with status ${response.status}: ${body}`
      );
    }

    const payload = (await response.json()) as HubSpotPipelinesResponse;
    return payload.results.map((pipeline) =>
      normalizePipeline(objectType, pipeline)
    );
  }
}
