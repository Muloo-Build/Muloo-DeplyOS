import type {
  ComparablePipelineDefinition,
  ComparablePipelineStageDefinition,
  ComparablePropertyDefinition,
  Logger,
  PipelineObjectType,
  PropertyOption
} from "@muloo/core";

interface HubSpotClientOptions {
  accessToken: string;
  logger: Logger;
  baseUrl?: string;
  scopes?: string[];
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

interface HubSpotAccountInfoResponse {
  [key: string]: unknown;
}

interface HubSpotSchemasResponse {
  results?: Array<Record<string, unknown>>;
}

interface HubSpotCountableCollectionResponse {
  results?: unknown[];
  lists?: unknown[];
  total?: number;
  count?: number;
}

export interface PortalSnapshotCaptureResult {
  capturedAt: string;
  hubTier?: string | null;
  activeHubs: string[];
  contactPropertyCount?: number | null;
  companyPropertyCount?: number | null;
  dealPropertyCount?: number | null;
  ticketPropertyCount?: number | null;
  customObjectCount?: number | null;
  dealPipelineCount?: number | null;
  dealStageCount?: number | null;
  ticketPipelineCount?: number | null;
  activeUserCount?: number | null;
  teamCount?: number | null;
  activeListCount?: number | null;
  rawApiResponses: Record<string, unknown>;
}

interface HubSpotPropertyGroupResponse {
  name: string;
  label: string;
  displayOrder?: number;
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

interface HubSpotCustomObjectSchemaInput {
  name: string;
  description?: string;
  labels: {
    singular: string;
    plural: string;
  };
  primaryDisplayProperty: string;
  secondaryDisplayProperties?: string[];
  searchableProperties?: string[];
  requiredProperties?: string[];
  properties: ComparablePropertyDefinition[];
  associatedObjects?: string[];
}

interface HubSpotCreatePipelineInput {
  label: string;
  displayOrder?: number;
  stages?: Array<{
    label: string;
    displayOrder?: number;
    probability?: number;
  }>;
}

interface HubSpotObjectRecordInput {
  objectType: string;
  id?: string;
  idProperty?: string;
  properties: Record<string, string | number | boolean | null>;
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

function countResults(payload: { results?: unknown[] } | null | undefined) {
  return Array.isArray(payload?.results) ? payload.results.length : null;
}

function countCollectionItems(
  payload: HubSpotCountableCollectionResponse | null | undefined
) {
  if (typeof payload?.total === "number") {
    return payload.total;
  }

  if (typeof payload?.count === "number") {
    return payload.count;
  }

  if (Array.isArray(payload?.results)) {
    return payload.results.length;
  }

  if (Array.isArray(payload?.lists)) {
    return payload.lists.length;
  }

  return null;
}

function normalizeHubLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function extractHubTier(payload: HubSpotAccountInfoResponse) {
  const candidateKeys = [
    "hubTier",
    "portalTier",
    "subscriptionLevel",
    "accountType",
    "tier"
  ];

  for (const key of candidateKeys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function extractActiveHubs(payload: HubSpotAccountInfoResponse) {
  const explicitActiveHubs = payload.activeHubs;
  if (Array.isArray(explicitActiveHubs)) {
    return explicitActiveHubs
      .filter((hub): hub is string => typeof hub === "string")
      .map((hub) => normalizeHubLabel(hub))
      .filter(Boolean);
  }

  const products = payload.products;
  if (Array.isArray(products)) {
    const productHubs = products
      .map((product) => {
        if (!product || typeof product !== "object") {
          return null;
        }

        const productRecord = product as Record<string, unknown>;

        const name =
          typeof productRecord.name === "string"
            ? productRecord.name
            : typeof productRecord.label === "string"
              ? productRecord.label
              : null;
        const isActive =
          productRecord.enabled === true ||
          productRecord.active === true ||
          (typeof productRecord.status === "string" &&
            ["active", "enabled", "purchased"].includes(
              productRecord.status.toLowerCase()
            ));

        return name && isActive ? normalizeHubLabel(name) : null;
      })
      .filter((hub): hub is string => Boolean(hub));

    if (productHubs.length > 0) {
      return Array.from(new Set(productHubs));
    }
  }

  const knownHubKeys = [
    "marketingHub",
    "salesHub",
    "serviceHub",
    "cmsHub",
    "operationsHub",
    "commerceHub"
  ] as const;

  const hubsFromFlags = knownHubKeys
    .map((key) => {
      const value = payload[key];
      if (
        value === true ||
        (typeof value === "string" && value.trim().length > 0) ||
        (value && typeof value === "object")
      ) {
        return normalizeHubLabel(key.replace(/Hub$/, ""));
      }

      return null;
    })
    .filter((hub): hub is string => Boolean(hub));

  return Array.from(new Set(hubsFromFlags));
}

export class HubSpotClient {
  private readonly accessToken: string;
  private readonly baseUrl: string;
  private readonly grantedScopes: Set<string> | null;
  private readonly logger: Logger;

  public constructor(options: HubSpotClientOptions) {
    this.accessToken = options.accessToken;
    this.baseUrl = options.baseUrl ?? "https://api.hubapi.com";
    this.grantedScopes =
      options.scopes && options.scopes.length > 0
        ? new Set(
            options.scopes
              .filter((scope): scope is string => typeof scope === "string")
              .map((scope) => scope.trim())
              .filter(Boolean)
          )
        : null;
    this.logger = options.logger;
  }

  private async requestJson<T>(
    path: string,
    init: RequestInit,
    errorLabel: string
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {})
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `${errorLabel} failed with status ${response.status}: ${body}`
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private async requestOptionalJson<T>(
    path: string,
    init: RequestInit,
    errorLabel: string,
    options?: {
      requiredScopes?: readonly string[];
      toleratedStatuses?: readonly number[];
    }
  ): Promise<T | null> {
    const toleratedStatuses = options?.toleratedStatuses ?? [403, 404];
    const requiredScopes = options?.requiredScopes ?? [];

    if (
      this.grantedScopes &&
      requiredScopes.length > 0 &&
      !requiredScopes.some((scope) => this.grantedScopes?.has(scope))
    ) {
      this.logger.warn(`${errorLabel} skipped because the token lacks scope.`, {
        path,
        requiredScopes,
        grantedScopes: Array.from(this.grantedScopes)
      });

      return null;
    }

    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {})
      }
    });

    if (!response.ok) {
      const body = await response.text();

      if (toleratedStatuses.includes(response.status)) {
        this.logger.warn(`${errorLabel} skipped because the token lacks scope.`, {
          path,
          status: response.status,
          body,
          requiredScopes: requiredScopes.length > 0 ? requiredScopes : undefined
        });

        return null;
      }

      throw new Error(
        `${errorLabel} failed with status ${response.status}: ${body}`
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  public async fetchProperties(
    objectType: string
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

  public async createProperty(
    objectType: string,
    property: ComparablePropertyDefinition
  ): Promise<ComparablePropertyDefinition> {
    const url = `${this.baseUrl}/crm/v3/properties/${objectType}`;
    this.logger.info("Creating HubSpot CRM property.", {
      objectType,
      propertyName: property.name,
      url
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: property.name,
        label: property.label,
        type: property.type,
        fieldType: property.fieldType,
        ...(property.description !== undefined
          ? { description: property.description }
          : {}),
        ...(property.groupName !== undefined
          ? { groupName: property.groupName }
          : {}),
        ...(property.formField !== undefined
          ? { formField: property.formField }
          : {}),
        ...(property.options !== undefined
          ? {
              options: property.options.map((option) => ({
                label: option.label,
                value: option.value,
                ...(option.displayOrder !== undefined
                  ? { displayOrder: option.displayOrder }
                  : {}),
                ...(option.hidden !== undefined
                  ? { hidden: option.hidden }
                  : {})
              }))
            }
          : {})
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `HubSpot property create failed with status ${response.status}: ${body}`
      );
    }

    const payload = (await response.json()) as HubSpotPropertyResponse;
    return normalizeProperty(payload);
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

  public async createPropertyGroup(
    objectType: string,
    group: {
      name: string;
      label: string;
      displayOrder?: number;
    }
  ): Promise<HubSpotPropertyGroupResponse> {
    this.logger.info("Creating HubSpot property group.", {
      objectType,
      groupName: group.name
    });

    return this.requestJson<HubSpotPropertyGroupResponse>(
      `/crm/v3/properties/${objectType}/groups`,
      {
        method: "POST",
        body: JSON.stringify({
          name: group.name,
          label: group.label,
          ...(group.displayOrder !== undefined
            ? { displayOrder: group.displayOrder }
            : {})
        })
      },
      "HubSpot property group create"
    );
  }

  public async createCustomObjectSchema(
    schema: HubSpotCustomObjectSchemaInput
  ): Promise<Record<string, unknown>> {
    this.logger.info("Creating HubSpot custom object schema.", {
      objectName: schema.name
    });

    return this.requestJson<Record<string, unknown>>(
      "/crm/v3/schemas",
      {
        method: "POST",
        body: JSON.stringify({
          name: schema.name,
          ...(schema.description ? { description: schema.description } : {}),
          labels: schema.labels,
          primaryDisplayProperty: schema.primaryDisplayProperty,
          ...(schema.secondaryDisplayProperties?.length
            ? { secondaryDisplayProperties: schema.secondaryDisplayProperties }
            : {}),
          ...(schema.searchableProperties?.length
            ? { searchableProperties: schema.searchableProperties }
            : {}),
          ...(schema.requiredProperties?.length
            ? { requiredProperties: schema.requiredProperties }
            : {}),
          properties: schema.properties.map((property) => ({
            name: property.name,
            label: property.label,
            type: property.type,
            fieldType: property.fieldType,
            ...(property.description !== undefined
              ? { description: property.description }
              : {}),
            ...(property.groupName !== undefined
              ? { groupName: property.groupName }
              : {}),
            ...(property.formField !== undefined
              ? { formField: property.formField }
              : {}),
            ...(property.options !== undefined
              ? {
                  options: property.options.map((option) => ({
                    label: option.label,
                    value: option.value,
                    ...(option.displayOrder !== undefined
                      ? { displayOrder: option.displayOrder }
                      : {}),
                    ...(option.hidden !== undefined
                      ? { hidden: option.hidden }
                      : {})
                  }))
                }
              : {})
          })),
          ...(schema.associatedObjects?.length
            ? { associatedObjects: schema.associatedObjects }
            : {})
        })
      },
      "HubSpot custom object schema create"
    );
  }

  public async createPipeline(
    objectType: PipelineObjectType,
    pipeline: HubSpotCreatePipelineInput
  ): Promise<ComparablePipelineDefinition> {
    this.logger.info("Creating HubSpot pipeline.", {
      objectType,
      label: pipeline.label
    });

    const payload = await this.requestJson<HubSpotPipelineResponse>(
      `/crm/v3/pipelines/${objectType}`,
      {
        method: "POST",
        body: JSON.stringify({
          label: pipeline.label,
          ...(pipeline.displayOrder !== undefined
            ? { displayOrder: pipeline.displayOrder }
            : {}),
          ...(pipeline.stages?.length
            ? {
                stages: pipeline.stages.map((stage) => ({
                  label: stage.label,
                  ...(stage.displayOrder !== undefined
                    ? { displayOrder: stage.displayOrder }
                    : {}),
                  ...(stage.probability !== undefined
                    ? {
                        metadata: {
                          probability: String(stage.probability)
                        }
                      }
                    : {})
                }))
              }
            : {})
        })
      },
      "HubSpot pipeline create"
    );

    return normalizePipeline(objectType, payload);
  }

  public async upsertObjectRecord(
    input: HubSpotObjectRecordInput
  ): Promise<Record<string, unknown>> {
    const isUpdate = Boolean(input.id);
    const query =
      input.id && input.idProperty
        ? `?idProperty=${encodeURIComponent(input.idProperty)}`
        : "";
    const path = isUpdate
      ? `/crm/v3/objects/${input.objectType}/${encodeURIComponent(input.id ?? "")}${query}`
      : `/crm/v3/objects/${input.objectType}`;

    this.logger.info("Upserting HubSpot CRM record.", {
      objectType: input.objectType,
      mode: isUpdate ? "update" : "create",
      idProperty: input.idProperty ?? null
    });

    return this.requestJson<Record<string, unknown>>(
      path,
      {
        method: isUpdate ? "PATCH" : "POST",
        body: JSON.stringify({
          properties: input.properties
        })
      },
      "HubSpot object upsert"
    );
  }

  public async capturePortalSnapshot(): Promise<PortalSnapshotCaptureResult> {
    this.logger.info("Capturing HubSpot portal snapshot.");

    const [
      accountInfo,
      contactProperties,
      companyProperties,
      dealProperties,
      ticketProperties,
      customObjectSchemas,
      dealPipelines,
      ticketPipelines,
      users,
      teams,
      lists
    ] = await Promise.all([
      this.requestJson<HubSpotAccountInfoResponse>(
        "/account-info/v3/details",
        { method: "GET" },
        "HubSpot account info fetch"
      ),
      this.requestJson<HubSpotPropertiesResponse>(
        "/crm/v3/properties/contacts",
        { method: "GET" },
        "HubSpot contact properties fetch"
      ),
      this.requestJson<HubSpotPropertiesResponse>(
        "/crm/v3/properties/companies",
        { method: "GET" },
        "HubSpot company properties fetch"
      ),
      this.requestJson<HubSpotPropertiesResponse>(
        "/crm/v3/properties/deals",
        { method: "GET" },
        "HubSpot deal properties fetch"
      ),
      this.requestOptionalJson<HubSpotPropertiesResponse>(
        "/crm/v3/properties/tickets",
        { method: "GET" },
        "HubSpot ticket properties fetch"
      ),
      this.requestOptionalJson<HubSpotSchemasResponse>(
        "/crm/v3/schemas",
        { method: "GET" },
        "HubSpot custom object schema fetch",
        {
          requiredScopes: [
            "crm.objects.custom.read",
            "crm.schemas.custom.read",
            "crm.schemas.custom.write"
          ]
        }
      ),
      this.requestJson<HubSpotPipelinesResponse>(
        "/crm/v3/pipelines/deals",
        { method: "GET" },
        "HubSpot deal pipelines fetch"
      ),
      this.requestOptionalJson<HubSpotPipelinesResponse>(
        "/crm/v3/pipelines/tickets",
        { method: "GET" },
        "HubSpot ticket pipelines fetch"
      ),
      this.requestOptionalJson<HubSpotCountableCollectionResponse>(
        "/settings/v3/users",
        { method: "GET" },
        "HubSpot users fetch",
        {
          requiredScopes: ["crm.objects.users.read", "settings.users.read"]
        }
      ),
      this.requestOptionalJson<HubSpotCountableCollectionResponse>(
        "/settings/v3/users/teams",
        { method: "GET" },
        "HubSpot teams fetch",
        {
          requiredScopes: ["settings.users.teams.read"]
        }
      ),
      this.requestOptionalJson<HubSpotCountableCollectionResponse>(
        "/crm/v3/lists?count=true",
        { method: "GET" },
        "HubSpot lists fetch",
        {
          requiredScopes: ["crm.lists.read"]
        }
      )
    ]);

    const dealPipelineCount = countResults(dealPipelines);
    const dealStageCount = Array.isArray(dealPipelines.results)
      ? dealPipelines.results.reduce(
          (total, pipeline) => total + (pipeline.stages?.length ?? 0),
          0
        )
      : null;
    const ticketPipelineCount = countResults(ticketPipelines);

    return {
      capturedAt: new Date().toISOString(),
      hubTier: extractHubTier(accountInfo),
      activeHubs: extractActiveHubs(accountInfo),
      contactPropertyCount: countResults(contactProperties),
      companyPropertyCount: countResults(companyProperties),
      dealPropertyCount: countResults(dealProperties),
      ticketPropertyCount: countResults(ticketProperties),
      customObjectCount: countResults(customObjectSchemas),
      dealPipelineCount,
      dealStageCount,
      ticketPipelineCount,
      activeUserCount: countCollectionItems(users),
      teamCount: countCollectionItems(teams),
      activeListCount: countCollectionItems(lists),
      rawApiResponses: {
        accountInfoDetails: accountInfo,
        contactProperties,
        companyProperties,
        dealProperties,
        ticketProperties,
        customObjectSchemas,
        dealPipelines,
        ticketPipelines,
        users,
        teams,
        lists
      }
    };
  }
}
