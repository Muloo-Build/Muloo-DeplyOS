export interface HSPropertyOption {
  label: string;
  value: string;
  description?: string;
  displayOrder?: number;
  hidden?: boolean;
}

export interface HSPropertySpec {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  description?: string;
  groupName?: string;
  formField?: boolean;
  options?: HSPropertyOption[];
}

export interface HSProperty extends HSPropertySpec {
  updatedAt?: string;
  createdAt?: string;
}

export interface HSStageSpec {
  label?: string;
  displayOrder?: number;
  probability?: number;
  metadata?: Record<string, unknown>;
}

export interface HSStage {
  id: string;
  label: string;
  displayOrder?: number;
  metadata?: Record<string, unknown>;
}

export interface HSPipelineSpec {
  label: string;
  displayOrder?: number;
  stages?: Array<{
    label: string;
    displayOrder?: number;
    metadata?: Record<string, unknown>;
  }>;
}

export interface HSPipeline {
  id: string;
  label: string;
  displayOrder?: number;
  stages?: HSStage[];
}

export interface HSListSpec {
  name: string;
  objectTypeId?: string;
  processingType?: string;
  filterBranch?: Record<string, unknown>;
}

export interface HSList {
  listId?: string;
  id?: string;
  name?: string;
  processingType?: string;
  [key: string]: unknown;
}

export interface HSWorkflowSpec {
  name: string;
  type?: string;
  enabled?: boolean;
  objectTypeId?: string;
  triggerSets?: unknown[];
  actionTree?: Record<string, unknown>;
  actions?: unknown[];
  [key: string]: unknown;
}

export interface HSWorkflow {
  id?: string;
  flowId?: string;
  name?: string;
  [key: string]: unknown;
}

export interface HSBlogPostSpec {
  name: string;
  htmlTitle?: string;
  metaDescription?: string;
  blogId: string | number;
  slug?: string;
  postBody?: string;
  tagIds?: Array<string | number>;
  currentState?: string;
  publishDate?: string;
  [key: string]: unknown;
}

export interface HSBlogPost {
  id?: string;
  name?: string;
  slug?: string;
  url?: string;
  [key: string]: unknown;
}

export interface HSEmailSpec {
  name: string;
  subject?: string;
  previewText?: string;
  content?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface HSEmail {
  id?: string;
  name?: string;
  subject?: string;
  [key: string]: unknown;
}

export interface HSCampaignSpec {
  name: string;
  color?: string;
  campaignType?: string;
  [key: string]: unknown;
}

export interface HSCampaign {
  id?: string;
  name?: string;
  [key: string]: unknown;
}

interface HubSpotWriteClientConfig {
  portalId: string;
  privateAppToken: string;
  baseUrl?: string;
}

interface HubSpotCollectionResponse<T> {
  results?: T[];
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function parsePipelineStage(value: unknown): HSStage {
  const record = toRecord(value);

  return {
    id:
      typeof record.id === "string"
        ? record.id
        : typeof record.label === "string"
          ? record.label.toLowerCase().replace(/\s+/g, "_")
          : "stage",
    label: typeof record.label === "string" ? record.label : "Stage",
    ...(typeof record.displayOrder === "number"
      ? { displayOrder: record.displayOrder }
      : {}),
    ...(record.metadata && typeof record.metadata === "object"
      ? { metadata: record.metadata as Record<string, unknown> }
      : {})
  };
}

function parsePipeline(value: unknown): HSPipeline {
  const record = toRecord(value);

  return {
    id:
      typeof record.id === "string"
        ? record.id
        : typeof record.label === "string"
          ? record.label.toLowerCase().replace(/\s+/g, "_")
          : "pipeline",
    label: typeof record.label === "string" ? record.label : "Pipeline",
    ...(typeof record.displayOrder === "number"
      ? { displayOrder: record.displayOrder }
      : {}),
    ...(Array.isArray(record.stages)
      ? { stages: record.stages.map(parsePipelineStage) }
      : {})
  };
}

export class HubSpotWriteClient {
  private readonly portalId: string;
  private readonly privateAppToken: string;
  private readonly baseUrl: string;

  public constructor(config: HubSpotWriteClientConfig) {
    this.portalId = config.portalId;
    this.privateAppToken = config.privateAppToken.trim();
    this.baseUrl = (config.baseUrl ?? "https://api.hubapi.com").replace(/\/$/, "");

    if (!this.portalId.trim()) {
      throw new Error("portalId is required");
    }

    if (!this.privateAppToken) {
      throw new Error("privateAppToken is required");
    }
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    options?: { tolerate404?: boolean }
  ): Promise<T | null> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.privateAppToken}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {})
      }
    });

    if (options?.tolerate404 && response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `HubSpot request failed (${response.status}) for ${path}: ${body}`
      );
    }

    if (response.status === 204) {
      return null;
    }

    return (await response.json()) as T;
  }

  async getProperty(objectType: string, name: string): Promise<HSProperty | null> {
    return this.request<HSProperty>(
      `/crm/v3/properties/${encodeURIComponent(objectType)}/${encodeURIComponent(name)}`,
      { method: "GET" },
      { tolerate404: true }
    );
  }

  async createProperty(objectType: string, spec: HSPropertySpec): Promise<HSProperty> {
    return (await this.request<HSProperty>(
      `/crm/v3/properties/${encodeURIComponent(objectType)}`,
      { method: "POST", body: JSON.stringify(spec) }
    )) as HSProperty;
  }

  async updateProperty(
    objectType: string,
    name: string,
    patch: Partial<HSPropertySpec>
  ): Promise<HSProperty> {
    return (await this.request<HSProperty>(
      `/crm/v3/properties/${encodeURIComponent(objectType)}/${encodeURIComponent(name)}`,
      { method: "PATCH", body: JSON.stringify(patch) }
    )) as HSProperty;
  }

  async listProperties(objectType: string): Promise<HSProperty[]> {
    const payload = await this.request<HubSpotCollectionResponse<HSProperty>>(
      `/crm/v3/properties/${encodeURIComponent(objectType)}`,
      { method: "GET" }
    );

    return payload?.results ?? [];
  }

  async getPipelines(objectType: string): Promise<HSPipeline[]> {
    const payload = await this.request<HubSpotCollectionResponse<unknown>>(
      `/crm/v3/pipelines/${encodeURIComponent(objectType)}`,
      { method: "GET" }
    );

    return (payload?.results ?? []).map(parsePipeline);
  }

  async createPipeline(objectType: string, spec: HSPipelineSpec): Promise<HSPipeline> {
    const payload = await this.request<unknown>(
      `/crm/v3/pipelines/${encodeURIComponent(objectType)}`,
      { method: "POST", body: JSON.stringify(spec) }
    );

    return parsePipeline(payload);
  }

  async updatePipelineStage(
    objectType: string,
    pipelineId: string,
    stageId: string,
    patch: Partial<HSStageSpec>
  ): Promise<HSStage> {
    const payload = await this.request<unknown>(
      `/crm/v3/pipelines/${encodeURIComponent(objectType)}/${encodeURIComponent(
        pipelineId
      )}/stages/${encodeURIComponent(stageId)}`,
      { method: "PATCH", body: JSON.stringify(patch) }
    );

    return parsePipelineStage(payload);
  }

  async createList(spec: HSListSpec): Promise<HSList> {
    return (await this.request<HSList>("/crm/v3/lists", {
      method: "POST",
      body: JSON.stringify(spec)
    })) as HSList;
  }

  async getWorkflows(): Promise<HSWorkflow[]> {
    const payload = await this.request<HubSpotCollectionResponse<HSWorkflow>>(
      "/automation/v4/flows",
      { method: "GET" }
    );

    return payload?.results ?? [];
  }

  async createWorkflow(spec: HSWorkflowSpec): Promise<HSWorkflow> {
    return (await this.request<HSWorkflow>("/automation/v4/flows", {
      method: "POST",
      body: JSON.stringify(spec)
    })) as HSWorkflow;
  }

  async createBlogPost(spec: HSBlogPostSpec): Promise<HSBlogPost> {
    return (await this.request<HSBlogPost>("/cms/v3/blogs/posts", {
      method: "POST",
      body: JSON.stringify(spec)
    })) as HSBlogPost;
  }

  async scheduleBlogPost(id: string, publishDate: string): Promise<void> {
    await this.request(
      `/cms/v3/blogs/posts/${encodeURIComponent(id)}/schedule`,
      {
        method: "POST",
        body: JSON.stringify({ publishDate })
      }
    );
  }

  async createMarketingEmail(spec: HSEmailSpec): Promise<HSEmail> {
    return (await this.request<HSEmail>("/marketing/v3/emails", {
      method: "POST",
      body: JSON.stringify(spec)
    })) as HSEmail;
  }

  async createCampaign(spec: HSCampaignSpec): Promise<HSCampaign> {
    return (await this.request<HSCampaign>("/marketing/v3/campaigns", {
      method: "POST",
      body: JSON.stringify(spec)
    })) as HSCampaign;
  }

  async listBlogs(): Promise<Array<Record<string, unknown>>> {
    const payload = await this.request<HubSpotCollectionResponse<Record<string, unknown>>>(
      "/cms/v3/blogs/blogs",
      { method: "GET" }
    );

    return payload?.results ?? [];
  }
}
