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

interface HubSpotWorkflowListResponse {
  results?: unknown[];
  workflows?: unknown[];
  objects?: unknown[];
}

interface HubSpotEmailListResponse {
  results?: unknown[];
  objects?: unknown[];
}

interface HubSpotFormListResponse {
  forms?: unknown[];
}

interface HubSpotDealListResponse {
  results?: unknown[];
}

export interface WorkflowSummary {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  enrollmentCount: number | null;
  stepCount: number;
  createdAt: string | null;
  updatedAt: string | null;
  isActive: boolean;
  lastModifiedDaysAgo: number | null;
}

export interface WorkflowSummaryResult {
  items: WorkflowSummary[];
  error?: string;
}

export interface PipelineStageSummary {
  id: string;
  label: string;
  probability: number | null;
  dealCount?: number | null;
}

export interface PipelineSummary {
  id: string;
  label: string;
  objectType: string;
  stageCount: number;
  stages: PipelineStageSummary[];
}

export interface PipelineSummaryResult {
  items: PipelineSummary[];
  error?: string;
}

export interface PropertyAuditResult {
  totalCount: number;
  customCount: number;
  unusedCount: number;
  duplicateLabels: string[];
  propertiesWithoutDescription: number;
  error?: string;
}

export interface EmailSummary {
  id: string;
  name: string;
  updatedAt: string | null;
  openRate: number | null;
  clickRate: number | null;
  sendCount: number | null;
}

export interface EmailHealthResult {
  totalDrafts: number;
  totalPublished: number;
  avgOpenRate: number | null;
  avgClickRate: number | null;
  lowPerformers: EmailSummary[];
  error?: string;
}

export interface ListItem {
  id: string;
  name: string;
  size: number | null;
  updatedAt: string | null;
}

export interface ListSummary {
  staticCount: number;
  dynamicCount: number;
  emptyListCount: number;
  largeLists: ListItem[];
  staleListCount: number;
  error?: string;
}

export interface FormItem {
  id: string;
  name: string;
  submissionCount: number | null;
  updatedAt: string | null;
}

export interface FormActivityResult {
  totalForms: number;
  activeForms: number;
  noSubmissionsCount: number;
  abandonedForms: FormItem[];
  error?: string;
}

export interface DealItem {
  id: string;
  amount: number | null;
  pipeline: string | null;
  stage: string | null;
  closeDate: string | null;
  ageDays: number | null;
  lastModifiedDaysAgo: number | null;
}

export interface DealHealthResult {
  totalOpenDeals: number;
  overdueCount: number;
  noCloseDateCount: number;
  avgDealAge: number | null;
  stuckDeals: DealItem[];
  error?: string;
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

interface HubSpotContactSearchFilter {
  propertyName: string;
  operator: string;
  value: string;
}

interface HubSpotContactSearchInput {
  filters?: HubSpotContactSearchFilter[];
  limit?: number;
  after?: number;
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

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return null;
  }

  return parsed.toISOString();
}

function extractNumericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function calculateDaysAgo(value: unknown): number | null {
  const isoDate = normalizeIsoDate(value);
  if (!isoDate) {
    return null;
  }

  const delta = Date.now() - new Date(isoDate).valueOf();
  if (!Number.isFinite(delta) || delta < 0) {
    return 0;
  }

  return Math.floor(delta / (1000 * 60 * 60 * 24));
}

function countNestedSteps(value: unknown): number {
  if (!Array.isArray(value)) {
    return 0;
  }

  return value.reduce((count, step) => {
    if (!step || typeof step !== "object") {
      return count + 1;
    }

    const record = step as Record<string, unknown>;
    const nested = Array.isArray(record.actions)
      ? record.actions.length
      : Array.isArray(record.children)
        ? record.children.length
        : 0;

    return count + 1 + nested;
  }, 0);
}

function isClosedDealStage(stageValue: string | null) {
  if (!stageValue) {
    return false;
  }

  const normalized = stageValue.toLowerCase();
  return normalized.includes("closedwon") || normalized.includes("closedlost");
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

  private assertAccessToken() {
    if (!this.accessToken?.trim()) {
      throw new Error("HubSpot access token is not configured");
    }
  }

  private async requestJson<T>(
    path: string,
    init: RequestInit,
    errorLabel: string
  ): Promise<T> {
    this.assertAccessToken();
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

  private async runAuditCall<T>(fallback: T, operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      return {
        ...fallback,
        error: error instanceof Error ? error.message : "Unknown HubSpot audit error"
      };
    }
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

  /**
   * Check if a specific property exists by exact internal name.
   * Uses GET /crm/v3/properties/{objectType}/{propertyName}
   * Returns the property definition if found, null if not found (404).
   */
  public async getPropertyByName(
    objectType: string,
    propertyName: string
  ): Promise<ComparablePropertyDefinition | null> {
    this.assertAccessToken();
    const url = `${this.baseUrl}/crm/v3/properties/${objectType}/${propertyName}`;
    this.logger.info("Fetching HubSpot CRM property by name.", {
      objectType,
      propertyName,
      url
    });

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json"
        }
      });

      if (response.status === 404) {
        this.logger.info("Property not found.", { objectType, propertyName });
        return null;
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `HubSpot property fetch failed with status ${response.status}: ${body}`
        );
      }

      const payload = (await response.json()) as HubSpotPropertyResponse;
      return normalizeProperty(payload);
    } catch (err: any) {
      if (err?.code === 404 || err?.response?.status === 404) {
        return null;
      }
      throw err;
    }
  }

  public async createProperty(
    objectType: string,
    property: ComparablePropertyDefinition
  ): Promise<ComparablePropertyDefinition> {
    this.assertAccessToken();
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

  public async updateProperty(
    objectType: string,
    name: string,
    updates: Partial<ComparablePropertyDefinition>
  ): Promise<ComparablePropertyDefinition> {
    this.assertAccessToken();

    const payload = await this.requestJson<HubSpotPropertyResponse>(
      `/crm/v3/properties/${objectType}/${encodeURIComponent(name)}`,
      {
        method: "PATCH",
        body: JSON.stringify(updates)
      },
      "HubSpot property update"
    );

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
    this.assertAccessToken();
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

  public async updatePipelineStage(
    objectType: PipelineObjectType,
    pipelineId: string,
    stageId: string,
    updates: {
      label?: string;
      displayOrder?: number;
      probability?: number;
    }
  ): Promise<ComparablePipelineStageDefinition> {
    this.assertAccessToken();

    const payload = await this.requestJson<HubSpotPipelineStageResponse>(
      `/crm/v3/pipelines/${objectType}/${encodeURIComponent(
        pipelineId
      )}/stages/${encodeURIComponent(stageId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          ...(updates.label ? { label: updates.label } : {}),
          ...(updates.displayOrder !== undefined
            ? { displayOrder: updates.displayOrder }
            : {}),
          ...(updates.probability !== undefined
            ? { metadata: { probability: String(updates.probability) } }
            : {})
        })
      },
      "HubSpot pipeline stage update"
    );

    return normalizePipelineStage(pipelineId, payload, 0);
  }

  public async updateContactProperty(
    contactId: string,
    properties: Record<string, string>
  ): Promise<void> {
    this.assertAccessToken();

    await this.requestJson<Record<string, unknown>>(
      `/crm/v3/objects/contacts/${encodeURIComponent(contactId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ properties })
      },
      "HubSpot contact update"
    );
  }

  public async searchContacts(input: HubSpotContactSearchInput) {
    this.assertAccessToken();

    return this.requestJson<Record<string, unknown>>(
      "/crm/v3/objects/contacts/search",
      {
        method: "POST",
        body: JSON.stringify({
          filterGroups: [
            {
              filters: input.filters ?? []
            }
          ],
          ...(input.limit !== undefined ? { limit: input.limit } : {}),
          ...(input.after !== undefined ? { after: input.after } : {})
        })
      },
      "HubSpot contact search"
    );
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

  public async getWorkflows(portalId: string): Promise<WorkflowSummaryResult> {
    return this.runAuditCall({ items: [] }, async () => {
      this.logger.info("Fetching HubSpot workflows for portal audit.", {
        portalId
      });

      const v4Payload = await this.requestOptionalJson<HubSpotWorkflowListResponse>(
        "/automation/v4/flows",
        { method: "GET" },
        "HubSpot workflow fetch",
        {
          toleratedStatuses: [404]
        }
      );
      const payload =
        v4Payload ??
        (await this.requestOptionalJson<HubSpotWorkflowListResponse>(
          "/automation/v3/workflows",
          { method: "GET" },
          "HubSpot workflow fetch"
        ));

      const records = Array.isArray(payload?.results)
        ? payload.results
        : Array.isArray(payload?.workflows)
          ? payload.workflows
          : Array.isArray(payload?.objects)
            ? payload.objects
            : [];

      const items = records
        .map((entry) => {
          const record =
            entry && typeof entry === "object"
              ? (entry as Record<string, unknown>)
              : null;
          if (!record) {
            return null;
          }

          const id =
            typeof record.id === "string"
              ? record.id
              : typeof record.flowId === "string"
                ? record.flowId
                : null;
          const name =
            typeof record.name === "string"
              ? record.name
              : typeof record.label === "string"
                ? record.label
                : null;

          if (!id || !name) {
            return null;
          }

          const updatedAt =
            normalizeIsoDate(record.updatedAt) ??
            normalizeIsoDate(record.updatedAtTime) ??
            normalizeIsoDate(record.lastUpdatedAt);
          const enabled =
            record.enabled === true ||
            record.isEnabled === true ||
            (typeof record.status === "string" &&
              ["active", "enabled", "published", "on"].includes(
                record.status.toLowerCase()
              ));

          return {
            id,
            name,
            type:
              typeof record.type === "string"
                ? record.type
                : typeof record.flowType === "string"
                  ? record.flowType
                  : "workflow",
            enabled,
            enrollmentCount:
              extractNumericValue(record.enrollmentCount) ??
              extractNumericValue(record.activeEnrollments) ??
              extractNumericValue(record.totalEnrollments),
            stepCount:
              extractNumericValue(record.stepCount) ??
              countNestedSteps(record.actions) ??
              countNestedSteps(record.steps),
            createdAt:
              normalizeIsoDate(record.createdAt) ??
              normalizeIsoDate(record.insertedAt),
            updatedAt,
            isActive: enabled,
            lastModifiedDaysAgo: calculateDaysAgo(updatedAt)
          } satisfies WorkflowSummary;
        })
        .filter((item): item is WorkflowSummary => Boolean(item));

      return { items };
    });
  }

  public async getPipelines(portalId: string): Promise<PipelineSummaryResult> {
    return this.runAuditCall({ items: [] }, async () => {
      this.logger.info("Fetching HubSpot pipelines for portal audit.", {
        portalId
      });

      const [dealPipelines, ticketPipelines] = await Promise.all([
        this.requestJson<HubSpotPipelinesResponse>(
          "/crm/v3/pipelines/deals",
          { method: "GET" },
          "HubSpot deal pipelines fetch"
        ),
        this.requestOptionalJson<HubSpotPipelinesResponse>(
          "/crm/v3/pipelines/tickets",
          { method: "GET" },
          "HubSpot ticket pipelines fetch"
        )
      ]);

      const normalize = (
        objectType: string,
        payload: HubSpotPipelinesResponse | null
      ) =>
        (payload?.results ?? []).map((pipeline) => ({
          id: pipeline.id ?? pipeline.label.toLowerCase().replace(/\s+/g, "_"),
          label: pipeline.label,
          objectType,
          stageCount: pipeline.stages?.length ?? 0,
          stages: (pipeline.stages ?? []).map((stage) => ({
            id:
              stage.id ?? stage.label.toLowerCase().replace(/\s+/g, "_"),
            label: stage.label,
            probability: extractNumericValue(stage.metadata?.probability),
            dealCount: null
          }))
        }));

      return {
        items: [
          ...normalize("deals", dealPipelines),
          ...normalize("tickets", ticketPipelines)
        ]
      };
    });
  }

  public async getContactPropertyAudit(
    portalId: string
  ): Promise<PropertyAuditResult> {
    return this.runAuditCall(
      {
        totalCount: 0,
        customCount: 0,
        unusedCount: 0,
        duplicateLabels: [],
        propertiesWithoutDescription: 0
      },
      async () => {
        this.logger.info("Fetching contact property audit data.", { portalId });

        const payload = await this.requestJson<HubSpotPropertiesResponse>(
          "/crm/v3/properties/contacts?dataSensitivity=non_sensitive",
          { method: "GET" },
          "HubSpot contact property audit fetch"
        );

        const labelCounts = new Map<string, number>();
        let customCount = 0;
        let unusedCount = 0;
        let propertiesWithoutDescription = 0;

        for (const property of payload.results) {
          const labelKey = property.label.trim().toLowerCase();
          labelCounts.set(labelKey, (labelCounts.get(labelKey) ?? 0) + 1);

          if (!property.description?.trim()) {
            propertiesWithoutDescription += 1;
          }

          if (
            property.groupName &&
            !["contactinformation", "emailinformation", "socialmediainformation"].includes(
              property.groupName.toLowerCase()
            )
          ) {
            customCount += 1;
          }

          const updatedAt = calculateDaysAgo(
            (property as unknown as Record<string, unknown>).updatedAt
          );
          if (updatedAt !== null && updatedAt > 180 && property.formField !== true) {
            unusedCount += 1;
          }
        }

        return {
          totalCount: payload.results.length,
          customCount,
          unusedCount,
          duplicateLabels: Array.from(labelCounts.entries())
            .filter(([, count]) => count > 1)
            .map(([label]) => label),
          propertiesWithoutDescription
        };
      }
    );
  }

  public async getEmailHealthMetrics(
    portalId: string
  ): Promise<EmailHealthResult> {
    return this.runAuditCall(
      {
        totalDrafts: 0,
        totalPublished: 0,
        avgOpenRate: null,
        avgClickRate: null,
        lowPerformers: []
      },
      async () => {
        this.logger.info("Fetching marketing email health data.", { portalId });

        const payload = await this.requestJson<HubSpotEmailListResponse>(
          "/marketing/v3/emails?limit=20&sort=-updatedAt",
          { method: "GET" },
          "HubSpot marketing email fetch"
        );

        const records = Array.isArray(payload.results)
          ? payload.results
          : Array.isArray(payload.objects)
            ? payload.objects
            : [];

        let totalDrafts = 0;
        let totalPublished = 0;
        const openRates: number[] = [];
        const clickRates: number[] = [];
        const lowPerformers: EmailSummary[] = [];

        for (const entry of records) {
          const record =
            entry && typeof entry === "object"
              ? (entry as Record<string, unknown>)
              : null;
          if (!record) {
            continue;
          }

          const status =
            typeof record.status === "string" ? record.status.toLowerCase() : "";
          if (["draft", "drafted"].includes(status)) {
            totalDrafts += 1;
          } else {
            totalPublished += 1;
          }

          const openRate =
            extractNumericValue(record.openRate) ??
            extractNumericValue(record.openPercentage) ??
            extractNumericValue(record.stats && typeof record.stats === "object"
              ? (record.stats as Record<string, unknown>).openRate
              : null);
          const clickRate =
            extractNumericValue(record.clickRate) ??
            extractNumericValue(record.clickPercentage) ??
            extractNumericValue(record.stats && typeof record.stats === "object"
              ? (record.stats as Record<string, unknown>).clickRate
              : null);
          const sendCount =
            extractNumericValue(record.sent) ??
            extractNumericValue(record.sendCount) ??
            extractNumericValue(record.stats && typeof record.stats === "object"
              ? (record.stats as Record<string, unknown>).sent
              : null);

          if (openRate !== null) {
            openRates.push(openRate);
          }
          if (clickRate !== null) {
            clickRates.push(clickRate);
          }

          if (
            sendCount !== null &&
            sendCount > 100 &&
            ((openRate !== null && openRate < 15) ||
              (clickRate !== null && clickRate < 1))
          ) {
            lowPerformers.push({
              id:
                typeof record.id === "string"
                  ? record.id
                  : typeof record.guid === "string"
                    ? record.guid
                    : String(lowPerformers.length + 1),
              name:
                typeof record.name === "string"
                  ? record.name
                  : typeof record.subject === "string"
                    ? record.subject
                    : "Untitled email",
              updatedAt:
                normalizeIsoDate(record.updatedAt) ??
                normalizeIsoDate(record.lastUpdatedTime),
              openRate,
              clickRate,
              sendCount
            });
          }
        }

        return {
          totalDrafts,
          totalPublished,
          avgOpenRate: average(openRates),
          avgClickRate: average(clickRates),
          lowPerformers
        };
      }
    );
  }

  public async getActiveListSummary(portalId: string): Promise<ListSummary> {
    return this.runAuditCall(
      {
        staticCount: 0,
        dynamicCount: 0,
        emptyListCount: 0,
        largeLists: [],
        staleListCount: 0
      },
      async () => {
        this.logger.info("Fetching HubSpot list activity summary.", { portalId });

        const [staticListsPayload, dynamicListsPayload] = await Promise.all([
          this.requestOptionalJson<HubSpotCountableCollectionResponse>(
            "/contacts/v1/lists/static/all?count=250",
            { method: "GET" },
            "HubSpot static lists fetch"
          ),
          this.requestOptionalJson<HubSpotCountableCollectionResponse>(
            "/contacts/v1/lists/dynamic/all?count=250",
            { method: "GET" },
            "HubSpot dynamic lists fetch"
          )
        ]);

        const staticLists = Array.isArray(staticListsPayload?.lists)
          ? staticListsPayload.lists
          : [];
        const dynamicLists = Array.isArray(dynamicListsPayload?.lists)
          ? dynamicListsPayload.lists
          : [];
        const allLists = [...staticLists, ...dynamicLists];

        let emptyListCount = 0;
        let staleListCount = 0;
        const largeLists: ListItem[] = [];

        for (const entry of allLists) {
          const record =
            entry && typeof entry === "object"
              ? (entry as Record<string, unknown>)
              : null;
          if (!record) {
            continue;
          }

          const size =
            extractNumericValue(record.size) ??
            extractNumericValue(record.metaData && typeof record.metaData === "object"
              ? (record.metaData as Record<string, unknown>).size
              : null);
          const updatedAt =
            normalizeIsoDate(record.updatedAt) ??
            normalizeIsoDate(record.updatedAtTimestamp) ??
            normalizeIsoDate(record.lastUpdatedTime);
          const lastModifiedDaysAgo = calculateDaysAgo(updatedAt);
          const inWorkflow =
            record.referencedInWorkflows === true ||
            extractNumericValue(record.workflowCount) !== null;

          if (size === 0) {
            emptyListCount += 1;
          }

          if (!inWorkflow && lastModifiedDaysAgo !== null && lastModifiedDaysAgo > 90) {
            staleListCount += 1;
          }

          if (size !== null && size >= 1000) {
            largeLists.push({
              id:
                typeof record.listId === "string"
                  ? record.listId
                  : typeof record.listId === "number"
                    ? String(record.listId)
                    : typeof record.internalListId === "number"
                      ? String(record.internalListId)
                      : String(largeLists.length + 1),
              name:
                typeof record.name === "string" ? record.name : "Untitled list",
              size,
              updatedAt
            });
          }
        }

        return {
          staticCount: staticLists.length,
          dynamicCount: dynamicLists.length,
          emptyListCount,
          largeLists: largeLists.slice(0, 10),
          staleListCount
        };
      }
    );
  }

  public async getFormActivity(portalId: string): Promise<FormActivityResult> {
    return this.runAuditCall(
      {
        totalForms: 0,
        activeForms: 0,
        noSubmissionsCount: 0,
        abandonedForms: []
      },
      async () => {
        this.logger.info("Fetching HubSpot form activity.", { portalId });

        const payload = await this.requestJson<HubSpotFormListResponse | unknown[]>(
          "/forms/v2/forms",
          { method: "GET" },
          "HubSpot forms fetch"
        );

        const forms = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.forms)
            ? payload.forms
            : [];

        let activeForms = 0;
        let noSubmissionsCount = 0;
        const abandonedForms: FormItem[] = [];

        for (const entry of forms) {
          const record =
            entry && typeof entry === "object"
              ? (entry as Record<string, unknown>)
              : null;
          if (!record) {
            continue;
          }

          const submissionCount =
            extractNumericValue(record.submissionCount) ??
            extractNumericValue(record.numSubmissions);
          const recentSubmissionCount =
            extractNumericValue(record.submissionsLast90Days) ??
            extractNumericValue(record.recentSubmissionCount);
          const updatedAt =
            normalizeIsoDate(record.updatedAt) ??
            normalizeIsoDate(record.editVersion);

          if (submissionCount !== null && submissionCount > 0) {
            activeForms += 1;
          } else {
            noSubmissionsCount += 1;
          }

          if (
            submissionCount !== null &&
            submissionCount > 0 &&
            (recentSubmissionCount === 0 || recentSubmissionCount === null) &&
            ((calculateDaysAgo(updatedAt) ?? -1) > 90)
          ) {
            abandonedForms.push({
              id:
                typeof record.guid === "string"
                  ? record.guid
                  : typeof record.id === "string"
                    ? record.id
                    : String(abandonedForms.length + 1),
              name:
                typeof record.name === "string" ? record.name : "Untitled form",
              submissionCount,
              updatedAt
            });
          }
        }

        return {
          totalForms: forms.length,
          activeForms,
          noSubmissionsCount,
          abandonedForms: abandonedForms.slice(0, 10)
        };
      }
    );
  }

  public async getDealHealthMetrics(
    portalId: string
  ): Promise<DealHealthResult> {
    return this.runAuditCall(
      {
        totalOpenDeals: 0,
        overdueCount: 0,
        noCloseDateCount: 0,
        avgDealAge: null,
        stuckDeals: []
      },
      async () => {
        this.logger.info("Fetching HubSpot deal health metrics.", { portalId });

        const payload = await this.requestJson<HubSpotDealListResponse>(
          "/crm/v3/objects/deals?properties=dealstage,closedate,amount,pipeline,createdate,hs_lastmodifieddate&limit=100",
          { method: "GET" },
          "HubSpot deal health fetch"
        );

        const ageDays: number[] = [];
        let overdueCount = 0;
        let noCloseDateCount = 0;
        const stuckDeals: DealItem[] = [];

        const deals = (payload.results ?? []).map((entry) => {
          const record =
            entry && typeof entry === "object"
              ? (entry as Record<string, unknown>)
              : {};
          const properties =
            record.properties && typeof record.properties === "object"
              ? (record.properties as Record<string, unknown>)
              : {};
          const stage =
            typeof properties.dealstage === "string" ? properties.dealstage : null;
          const closeDate = normalizeIsoDate(properties.closedate);
          const createdAt = normalizeIsoDate(properties.createdate);
          const dealAge = calculateDaysAgo(createdAt);
          const lastModifiedDaysAgo = calculateDaysAgo(
            properties.hs_lastmodifieddate
          );

          if (!isClosedDealStage(stage)) {
            if (!closeDate) {
              noCloseDateCount += 1;
            }

            if (
              closeDate &&
              new Date(closeDate).valueOf() < Date.now() &&
              !isClosedDealStage(stage)
            ) {
              overdueCount += 1;
            }
          }

          if (dealAge !== null) {
            ageDays.push(dealAge);
          }

          const item: DealItem = {
            id: typeof record.id === "string" ? record.id : String(ageDays.length),
            amount: extractNumericValue(properties.amount),
            pipeline:
              typeof properties.pipeline === "string" ? properties.pipeline : null,
            stage,
            closeDate,
            ageDays: dealAge,
            lastModifiedDaysAgo
          };

          if (
            !isClosedDealStage(stage) &&
            lastModifiedDaysAgo !== null &&
            lastModifiedDaysAgo > 30
          ) {
            stuckDeals.push(item);
          }

          return item;
        });

        return {
          totalOpenDeals: deals.filter((deal) => !isClosedDealStage(deal.stage))
            .length,
          overdueCount,
          noCloseDateCount,
          avgDealAge: average(ageDays),
          stuckDeals: stuckDeals.slice(0, 10)
        };
      }
    );
  }
}
