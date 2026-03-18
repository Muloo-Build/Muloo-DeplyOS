import http from "node:http";
import { getIntegrationStatus, type BaseConfig } from "@muloo/config";
import {
  createProjectFromTemplate,
  loadAllExecutionRecords,
  loadAllTemplates,
  loadExecutionById,
  loadExecutionSteps,
  loadProjectById,
  loadProjectDiscoveryById,
  loadProjectDesignById,
  loadProjectExecutions,
  loadProjectModuleDetail,
  loadProjectReadinessById,
  loadProjectSummaryById,
  loadTemplateById,
  summarizeProjectModules,
  summarizeProject,
  updateProjectDiscoverySection,
  updateProjectLifecycleDesign,
  updateProjectMetadata,
  updateProjectPipelinesDesign,
  updateProjectPropertiesDesign,
  updateProjectScope,
  validateAllProjects,
  validateProjectById
} from "@muloo/file-system";
import Prisma from "@prisma/client";
import { moduleCatalog } from "@muloo/shared";
import {
  createProjectFromTemplateRequestSchema,
  updateProjectDiscoverySectionRequestSchema,
  updateProjectLifecycleDesignRequestSchema,
  updateProjectMetadataRequestSchema,
  updateProjectPipelinesDesignRequestSchema,
  updateProjectPropertiesDesignRequestSchema,
  updateProjectScopeRequestSchema
} from "@muloo/shared";
import { z, ZodError } from "zod";

const { PrismaClient } = Prisma;
const prisma = new PrismaClient();

const contentTypes: Record<string, string> = {
  ".json": "application/json; charset=utf-8"
};

const pendingPortalPrefix = "pending-portal-";
const authCookieName = "muloo_deploy_os_auth";
const clientAuthCookieName = "muloo_deploy_os_client_auth";
const defaultSimpleAuthUsername = "jarrud";
const defaultSimpleAuthPassword = "deployos";
const validEngagementTypes = [
  "AUDIT",
  "IMPLEMENTATION",
  "MIGRATION",
  "OPTIMISATION",
  "GUIDED_DEPLOYMENT"
] as const;
const validProjectHubValues = [
  "sales",
  "marketing",
  "service",
  "ops",
  "cms"
] as const;
const projectOwnerOptions = [
  {
    id: "jarrud-vander-merwe",
    name: "Jarrud van der Merwe",
    email: "jarrud@muloo.co",
    role: "HubSpot Architect"
  },
  {
    id: "muloo-operator",
    name: "Muloo Operator",
    email: "operator@muloo.com",
    role: "Operations"
  }
] as const;
const industryOptions = [
  "Accounting & Advisory",
  "Agency & Professional Services",
  "Construction & Property",
  "Education & Training",
  "Financial Services",
  "Healthcare",
  "Legal",
  "Manufacturing",
  "Nonprofit",
  "Retail & Ecommerce",
  "SaaS & Technology",
  "Travel & Hospitality",
  "Other"
] as const;
const defaultProductCatalog = [
  {
    slug: "hubspot-implementation-phase",
    name: "Implementation Phase",
    category: "one_time",
    billingModel: "fixed",
    description:
      "One-off implementation phase delivered from approved discovery scope.",
    unitPrice: 15000,
    defaultQuantity: 1,
    unitLabel: "phase",
    sortOrder: 10
  },
  {
    slug: "monthly-support-retainer",
    name: "Monthly Support Retainer",
    category: "retainer",
    billingModel: "monthly",
    description:
      "Ongoing monthly HubSpot support, optimisation, and advisory cover.",
    unitPrice: 18000,
    defaultQuantity: 1,
    unitLabel: "month",
    sortOrder: 20
  },
  {
    slug: "additional-implementation-hours",
    name: "Additional Implementation Hours",
    category: "add_on",
    billingModel: "hourly",
    description:
      "Additional scoped implementation hours outside the base approved scope.",
    unitPrice: 1500,
    defaultQuantity: 10,
    unitLabel: "hour",
    sortOrder: 30
  },
  {
    slug: "training-workshop",
    name: "Training Workshop",
    category: "add_on",
    billingModel: "fixed",
    description:
      "Dedicated enablement or training workshop for client stakeholders.",
    unitPrice: 7500,
    defaultQuantity: 1,
    unitLabel: "workshop",
    sortOrder: 40
  }
] as const;
const sessionFieldLabels: Record<number, string[]> = {
  1: [
    "business_overview",
    "primary_pain_challenge",
    "goals_and_success_metrics",
    "key_stakeholders",
    "timeline_and_constraints"
  ],
  2: [
    "current_tech_stack",
    "current_hubspot_state",
    "data_landscape",
    "current_processes",
    "what_has_been_tried_before"
  ],
  3: [
    "hubs_and_features_required",
    "pipeline_and_process_design",
    "automation_requirements",
    "integration_requirements",
    "reporting_requirements"
  ],
  4: [
    "confirmed_scope",
    "out_of_scope",
    "risks_and_blockers",
    "client_responsibilities",
    "agreed_next_steps",
    "engagement_track",
    "platform_fit",
    "change_management_rating",
    "data_readiness_rating",
    "scope_volatility_rating"
  ]
};

type EngagementType = (typeof validEngagementTypes)[number];
type ProjectHub = (typeof validProjectHubValues)[number];
type DiscoverySessionFields = Record<string, string>;
type DiscoverySessionStatus = "draft" | "in_progress" | "complete";
type DiscoveryEvidenceType = (typeof discoveryEvidenceTypeValues)[number];

const sessionTitles: Record<number, string> = {
  1: "Business & Goals",
  2: "Current State",
  3: "Future State Design",
  4: "Scope & Handover"
};
const blueprintTaskTypeValues = ["Agent", "Human", "Client"] as const;
const discoveryEvidenceTypeValues = [
  "transcript",
  "summary",
  "uploaded-doc",
  "miro-note",
  "operator-note",
  "client-input"
] as const;
const blueprintGenerationSchema = z.object({
  phases: z
    .array(
      z.object({
        phase: z.number().int().positive(),
        phaseName: z.string().trim().min(1),
        tasks: z
          .array(
            z.object({
              name: z.string().trim().min(1),
              type: z.enum(blueprintTaskTypeValues),
              effortHours: z.number().positive(),
              order: z.number().int().positive()
            })
          )
          .min(1)
      })
    )
    .min(1)
    .max(5)
});
const discoverySummarySchema = z.object({
  executiveSummary: z.string().trim().min(1),
  engagementTrack: z.string().trim().min(1),
  platformFit: z.string().trim().min(1),
  changeManagementRating: z.string().trim().min(1),
  dataReadinessRating: z.string().trim().min(1),
  scopeVolatilityRating: z.string().trim().min(1),
  missingInformation: z.array(z.string().trim().min(1)).default([]),
  keyRisks: z.array(z.string().trim().min(1)).default([]),
  recommendedNextQuestions: z.array(z.string().trim().min(1)).default([])
});

function serializeDiscoverySummary<
  T extends {
    executiveSummary: string;
    engagementTrack: string;
    platformFit: string;
    changeManagementRating: string;
    dataReadinessRating: string;
    scopeVolatilityRating: string;
    missingInformation: string[];
    keyRisks: string[];
    recommendedNextQuestions: string[];
  }
>(summary: T) {
  return {
    executiveSummary: summary.executiveSummary,
    engagementTrack: summary.engagementTrack,
    platformFit: summary.platformFit,
    changeManagementRating: summary.changeManagementRating,
    dataReadinessRating: summary.dataReadinessRating,
    scopeVolatilityRating: summary.scopeVolatilityRating,
    missingInformation: summary.missingInformation,
    keyRisks: summary.keyRisks,
    recommendedNextQuestions: summary.recommendedNextQuestions
  };
}

function isValidEngagementType(value: string): value is EngagementType {
  return validEngagementTypes.includes(value as EngagementType);
}

function isValidProjectHub(value: string): value is ProjectHub {
  return validProjectHubValues.includes(value as ProjectHub);
}

function isValidDiscoveryEvidenceType(
  value: string
): value is DiscoveryEvidenceType {
  return discoveryEvidenceTypeValues.includes(value as DiscoveryEvidenceType);
}

function resolveProjectOwner(ownerName?: string, ownerEmail?: string) {
  const normalizedName = ownerName?.trim().toLowerCase() ?? "";
  const normalizedEmail = ownerEmail?.trim().toLowerCase() ?? "";
  const matchedOwner = projectOwnerOptions.find(
    (candidate) =>
      candidate.name.toLowerCase() === normalizedName ||
      candidate.email.toLowerCase() === normalizedEmail
  );

  if (matchedOwner) {
    return {
      owner: matchedOwner.name,
      ownerEmail: matchedOwner.email
    };
  }

  return {
    owner: ownerName?.trim() || projectOwnerOptions[0].name,
    ownerEmail: ownerEmail?.trim() || projectOwnerOptions[0].email
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    )
  );
}

function createSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function createPendingPortalId(): string {
  return `${pendingPortalPrefix}${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function normalizeProject<T extends { portal: { portalId: string } | null }>(
  project: T
): T {
  return project.portal &&
    project.portal.portalId.startsWith(pendingPortalPrefix)
    ? ({ ...project, portal: null } as T)
    : project;
}

function sendJson(
  response: http.ServerResponse,
  statusCode: number,
  payload: unknown
): void {
  response.writeHead(statusCode, { "Content-Type": contentTypes[".json"] });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function parseCookies(request: http.IncomingMessage): Record<string, string> {
  const cookieHeader = request.headers.cookie;

  if (!cookieHeader) {
    return {};
  }

  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf("=");
        if (separatorIndex === -1) {
          return [part, ""];
        }

        return [
          decodeURIComponent(part.slice(0, separatorIndex)),
          decodeURIComponent(part.slice(separatorIndex + 1))
        ];
      })
  );
}

function setCookie(
  response: http.ServerResponse,
  value: string,
  options?: { maxAge?: number; name?: string }
) {
  const cookieParts = [
    `${options?.name ?? authCookieName}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax"
  ];

  if (options?.maxAge !== undefined) {
    cookieParts.push(`Max-Age=${options.maxAge}`);
  }

  response.setHeader("Set-Cookie", cookieParts.join("; "));
}

function resolveSimpleAuthCredentials() {
  return {
    username: process.env.SIMPLE_AUTH_USERNAME ?? defaultSimpleAuthUsername,
    password: process.env.SIMPLE_AUTH_PASSWORD ?? defaultSimpleAuthPassword
  };
}

function createSimpleAuthToken(username: string) {
  const secret =
    process.env.SIMPLE_AUTH_SECRET ?? "muloo-deploy-os-internal-auth";

  return Buffer.from(`${username}:${secret}`).toString("base64url");
}

function createClientAuthToken(userId: string) {
  const secret =
    process.env.CLIENT_AUTH_SECRET ?? "muloo-deploy-os-client-auth";

  return Buffer.from(`${userId}:${secret}`).toString("base64url");
}

function isAuthenticated(request: http.IncomingMessage) {
  const cookies = parseCookies(request);
  const { username } = resolveSimpleAuthCredentials();

  return cookies[authCookieName] === createSimpleAuthToken(username);
}

function getAuthenticatedClientUserId(request: http.IncomingMessage) {
  const cookies = parseCookies(request);
  const token = cookies[clientAuthCookieName];

  if (!token) {
    return null;
  }

  try {
    const [userId, secret] = Buffer.from(token, "base64url")
      .toString("utf8")
      .split(":");

    if (
      !userId ||
      secret !==
        (process.env.CLIENT_AUTH_SECRET ?? "muloo-deploy-os-client-auth")
    ) {
      return null;
    }

    return userId;
  } catch {
    return null;
  }
}

async function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const content = Buffer.concat(chunks).toString("utf8").trim();
  return content.length > 0 ? (JSON.parse(content) as unknown) : {};
}

function matchProjectRoute(pathname: string): {
  projectId: string;
  resource?:
    | "modules"
    | "summary"
    | "validation"
    | "readiness"
    | "executions"
    | "scope"
    | "discovery"
    | "status";
} | null {
  const match =
    /^\/api\/projects\/([^/]+?)(?:\/(modules|summary|validation|readiness|executions|scope|discovery|status))?$/.exec(
      pathname
    );

  if (!match || !match[1]) {
    return null;
  }

  const projectId = decodeURIComponent(match[1]);
  const resource = match[2];
  const normalizedResource =
    resource === "modules" ||
    resource === "summary" ||
    resource === "validation" ||
    resource === "readiness" ||
    resource === "executions" ||
    resource === "scope" ||
    resource === "discovery" ||
    resource === "status"
      ? resource
      : undefined;

  return normalizedResource
    ? { projectId, resource: normalizedResource }
    : { projectId };
}

function matchProjectDesignRoute(pathname: string): {
  projectId: string;
  resource?: "lifecycle" | "properties" | "pipelines";
} | null {
  const match =
    /^\/api\/projects\/([^/]+?)\/design(?:\/(lifecycle|properties|pipelines))?$/.exec(
      pathname
    );

  if (!match || !match[1]) {
    return null;
  }

  const resource =
    match[2] === "lifecycle" ||
    match[2] === "properties" ||
    match[2] === "pipelines"
      ? match[2]
      : undefined;

  return {
    projectId: decodeURIComponent(match[1]),
    ...(resource ? { resource } : {})
  };
}

function matchTemplateRoute(pathname: string): { templateId: string } | null {
  const match = /^\/api\/templates\/([^/]+)$/.exec(pathname);

  if (!match || !match[1]) {
    return null;
  }

  return {
    templateId: decodeURIComponent(match[1])
  };
}

function matchProductRoute(pathname: string): { productId?: string } | null {
  const match = /^\/api\/products(?:\/([^/]+))?$/.exec(pathname);

  if (!match) {
    return null;
  }

  return match[1] ? { productId: decodeURIComponent(match[1]) } : {};
}

function matchClientProjectRoute(pathname: string): {
  projectId?: string;
  resource?: "submissions";
  sessionId?: number;
} | null {
  const listMatch = /^\/api\/client\/projects$/.exec(pathname);

  if (listMatch) {
    return {};
  }

  const projectMatch = /^\/api\/client\/projects\/([^/]+?)(?:\/submissions\/([1-4]))?$/.exec(
    pathname
  );

  if (!projectMatch || !projectMatch[1]) {
    return null;
  }

  return {
    projectId: decodeURIComponent(projectMatch[1]),
    ...(projectMatch[2]
      ? {
          resource: "submissions" as const,
          sessionId: Number(projectMatch[2])
        }
      : {})
  };
}

function matchProjectClientUsersRoute(pathname: string): {
  projectId: string;
} | null {
  const match = /^\/api\/projects\/([^/]+?)\/client-users$/.exec(pathname);

  if (!match || !match[1]) {
    return null;
  }

  return {
    projectId: decodeURIComponent(match[1])
  };
}

function matchProjectModuleRoute(pathname: string): {
  projectId: string;
  moduleKey: string;
} | null {
  const match = /^\/api\/projects\/([^/]+)\/modules\/([^/]+)$/.exec(pathname);

  if (!match || !match[1] || !match[2]) {
    return null;
  }

  return {
    projectId: decodeURIComponent(match[1]),
    moduleKey: decodeURIComponent(match[2])
  };
}

function matchExecutionRoute(pathname: string): {
  executionId: string;
  resource?: "steps";
} | null {
  const match = /^\/api\/executions\/([^/]+?)(?:\/(steps))?$/.exec(pathname);

  if (!match || !match[1]) {
    return null;
  }

  return match[2] === "steps"
    ? {
        executionId: decodeURIComponent(match[1]),
        resource: "steps"
      }
    : {
        executionId: decodeURIComponent(match[1])
      };
}

function matchDiscoveryRoute(pathname: string): { projectId: string } | null {
  const match = /^\/api\/discovery\/([^/]+)\/sessions$/.exec(pathname);

  if (!match || !match[1]) {
    return null;
  }

  return {
    projectId: decodeURIComponent(match[1])
  };
}

function matchProjectBlueprintRoute(pathname: string): {
  projectId: string;
  action?: "generate";
} | null {
  const match = /^\/api\/projects\/([^/]+?)\/blueprint(?:\/(generate))?$/.exec(
    pathname
  );

  if (!match || !match[1]) {
    return null;
  }

  return {
    projectId: decodeURIComponent(match[1]),
    ...(match[2] === "generate" ? { action: "generate" } : {})
  };
}

function matchProjectDiscoverySummaryRoute(
  pathname: string
): { projectId: string } | null {
  const match = /^\/api\/projects\/([^/]+?)\/discovery-summary$/.exec(pathname);

  if (!match || !match[1]) {
    return null;
  }

  return {
    projectId: decodeURIComponent(match[1])
  };
}

function matchProjectSessionRoute(pathname: string): {
  projectId: string;
  sessionId: number;
} | null {
  const match = /^\/api\/projects\/([^/]+?)\/sessions\/([1-4])$/.exec(pathname);

  if (!match || !match[1] || !match[2]) {
    return null;
  }

  return {
    projectId: decodeURIComponent(match[1]),
    sessionId: Number(match[2])
  };
}

function matchProjectSessionEvidenceRoute(pathname: string): {
  projectId: string;
  sessionId: number;
} | null {
  const match =
    /^\/api\/projects\/([^/]+?)\/sessions\/([1-4])\/evidence$/.exec(pathname);

  if (!match || !match[1] || !match[2]) {
    return null;
  }

  return {
    projectId: decodeURIComponent(match[1]),
    sessionId: Number(match[2])
  };
}

function emptyDiscoverySessions(): Record<number, DiscoverySessionFields> {
  return {
    1: {},
    2: {},
    3: {},
    4: {}
  };
}

function normalizeDiscoveryFields(value: unknown): DiscoverySessionFields {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(
      ([key, fieldValue]) => [
        key,
        typeof fieldValue === "string" ? fieldValue : ""
      ]
    )
  );
}

function normalizeDiscoverySessionFields(
  sessionNumber: number,
  value: unknown
): DiscoverySessionFields {
  const normalizedFields = normalizeDiscoveryFields(value);
  const allowedFields =
    sessionFieldLabels[sessionNumber] ?? sessionFieldLabels[1] ?? [];

  return Object.fromEntries(
    allowedFields.map((fieldName) => [
      fieldName,
      normalizedFields[fieldName] ?? ""
    ])
  );
}

function buildDiscoverySessions(
  submissions: Array<{ version: number; sections: unknown }>
): Record<number, DiscoverySessionFields> {
  const sessions = emptyDiscoverySessions();

  for (const submission of submissions) {
    if (submission.version >= 1 && submission.version <= 4) {
      sessions[submission.version] = normalizeDiscoveryFields(
        submission.sections
      );
    }
  }

  return sessions;
}

function getDiscoverySessionStatus(
  fields: DiscoverySessionFields
): DiscoverySessionStatus {
  const values = Object.values(fields).map((value) => value.trim());

  if (values.length === 0 || values.every((value) => value.length === 0)) {
    return "draft";
  }

  return values.every((value) => value.length > 0) ? "complete" : "in_progress";
}

function getCompletedDiscoverySections(
  fields: DiscoverySessionFields
): string[] {
  return Object.entries(fields)
    .filter(([, value]) => value.trim().length > 0)
    .map(([key]) => key);
}

function getDiscoverySessionStatusFromSubmission(
  submission?: {
    status?: string;
    completedSections?: string[];
    sections?: unknown;
  } | null
): DiscoverySessionStatus {
  const fields = normalizeDiscoveryFields(submission?.sections);
  const derivedStatus = getDiscoverySessionStatus(fields);

  if (derivedStatus === "complete") {
    return "complete";
  }

  if (
    derivedStatus === "in_progress" ||
    (submission?.completedSections?.length ?? 0) > 0
  ) {
    return "in_progress";
  }

  return "draft";
}

function buildDiscoverySessionsWithStatus(
  submissions: Array<{
    version: number;
    status: string;
    sections: unknown;
    completedSections?: string[];
  }>
) {
  return [1, 2, 3, 4].map((sessionNumber) => {
    const submission = submissions.find(
      (candidate) => candidate.version === sessionNumber
    );
    const fields = normalizeDiscoveryFields(submission?.sections);

    return {
      session: sessionNumber,
      title: sessionTitles[sessionNumber] ?? `Session ${sessionNumber}`,
      status: getDiscoverySessionStatusFromSubmission(submission),
      fields
    };
  });
}

function serializeProject<
  T extends {
    id: string;
    name: string;
    status: string;
    owner: string;
    ownerEmail: string;
    clientChampionFirstName?: string | null;
    clientChampionLastName?: string | null;
    clientChampionEmail?: string | null;
    selectedHubs: string[];
    engagementType: Prisma.$Enums.EngagementType;
    createdAt: Date;
    updatedAt: Date;
    client: {
      id: string;
      name: string;
      slug: string;
      industry: string | null;
      region: string | null;
      website: string | null;
      additionalWebsites: string[];
      linkedinUrl: string | null;
      facebookUrl: string | null;
      instagramUrl: string | null;
      xUrl: string | null;
      youtubeUrl: string | null;
    };
    portal: {
      id: string;
      portalId: string;
      displayName: string;
      region: string | null;
      connected: boolean;
    } | null;
  }
>(project: T) {
  const normalizedProject = normalizeProject(project);

  return {
    ...normalizedProject,
    clientName: normalizedProject.client.name,
    hubsInScope: normalizedProject.selectedHubs
  };
}

function serializeClientProject<
  T extends {
    id: string;
    name: string;
    status: string;
    engagementType: Prisma.$Enums.EngagementType;
    selectedHubs: string[];
    updatedAt: Date;
    client: {
      name: string;
      website: string | null;
    };
  }
>(project: T) {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    engagementType: project.engagementType,
    selectedHubs: project.selectedHubs,
    updatedAt: project.updatedAt.toISOString(),
    client: {
      name: project.client.name,
      website: project.client.website
    }
  };
}

function serializeClientPortalUser<
  T extends {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }
>(user: T) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email
  };
}

function serializeClientInputSubmission<
  T extends {
    id: string;
    projectId: string;
    userId: string;
    sessionNumber: number;
    status: string;
    answers: unknown;
    createdAt: Date;
    updatedAt: Date;
  }
>(submission: T) {
  return {
    id: submission.id,
    projectId: submission.projectId,
    userId: submission.userId,
    sessionNumber: submission.sessionNumber,
    status: submission.status,
    answers:
      submission.answers && typeof submission.answers === "object"
        ? submission.answers
        : {},
    createdAt: submission.createdAt.toISOString(),
    updatedAt: submission.updatedAt.toISOString()
  };
}

async function callClaude(
  system: string,
  user: string,
  options?: { maxTokens?: number }
): Promise<string> {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: options?.maxTokens ?? 2000,
      system,
      messages: [{ role: "user", content: user }]
    })
  });

  if (!claudeResponse.ok) {
    throw new Error(
      `Claude request failed with status ${claudeResponse.status}`
    );
  }

  const claudeData = (await claudeResponse.json()) as {
    content?: Array<{ text?: string }>;
  };

  return claudeData?.content?.[0]?.text?.trim() ?? "";
}

function extractJsonBlock(rawText: string): string {
  const trimmed = rawText.trim();

  if (!trimmed) {
    throw new SyntaxError("Model returned empty content");
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

async function parseModelJson<T>(
  rawText: string,
  schema: z.ZodSchema<T>,
  repairLabel: string
): Promise<T> {
  const normalizedJson = extractJsonBlock(rawText);

  try {
    return schema.parse(JSON.parse(normalizedJson) as unknown);
  } catch (initialError) {
    try {
      const repairedText = await callClaude(
        `You repair malformed JSON for Muloo Deploy OS.

Rules:
- Return ONLY valid JSON.
- Do not add markdown fences or commentary.
- Preserve the original intended structure and values as closely as possible.
`,
        JSON.stringify(
          {
            label: repairLabel,
            malformedJson: normalizedJson
          },
          null,
          2
        ),
        { maxTokens: 4000 }
      );

      const repairedJson = extractJsonBlock(repairedText);
      return schema.parse(JSON.parse(repairedJson) as unknown);
    } catch (repairError) {
      if (
        initialError instanceof SyntaxError ||
        initialError instanceof ZodError
      ) {
        throw initialError;
      }

      if (repairError instanceof SyntaxError || repairError instanceof ZodError) {
        throw repairError;
      }

      throw new SyntaxError(
        `Failed to parse ${repairLabel} JSON from model output`
      );
    }
  }
}

function createBlueprintTask(
  name: string,
  type: (typeof blueprintTaskTypeValues)[number],
  effortHours: number,
  order: number
) {
  return {
    name,
    type,
    effortHours,
    order
  };
}

function buildFallbackBlueprint(
  discoveryPayload: NonNullable<
    Awaited<ReturnType<typeof loadProjectDiscoveryForBlueprint>>
  >
) {
  const { discovery } = discoveryPayload;
  const session1 =
    discovery.sessions.find((session) => session.session === 1)?.fields ?? {};
  const session2 =
    discovery.sessions.find((session) => session.session === 2)?.fields ?? {};
  const session3 =
    discovery.sessions.find((session) => session.session === 3)?.fields ?? {};
  const session4 =
    discovery.sessions.find((session) => session.session === 4)?.fields ?? {};

  const phases: Array<{
    phase: number;
    phaseName: string;
    tasks: Array<{
      name: string;
      type: (typeof blueprintTaskTypeValues)[number];
      effortHours: number;
      order: number;
    }>;
  }> = [
    {
      phase: 1,
      phaseName: "Foundation & Alignment",
      tasks: [
        createBlueprintTask("Validate discovery findings and confirm scope", "Human", 3, 1),
        createBlueprintTask("Confirm client stakeholders, owners, and approvals", "Client", 1, 2),
        createBlueprintTask("Set up project workspace, documentation, and governance", "Human", 2, 3)
      ]
    },
    {
      phase: 2,
      phaseName: "Data & Process Design",
      tasks: [
        createBlueprintTask("Map current data sources and migration requirements", "Human", 4, 1),
        createBlueprintTask("Prepare data cleanup list and import strategy", "Agent", 3, 2),
        createBlueprintTask("Approve target lifecycle, pipeline, and process design", "Client", 1, 3)
      ]
    }
  ];

  const buildTasks: Array<{
    name: string;
    type: (typeof blueprintTaskTypeValues)[number];
    effortHours: number;
    order: number;
  }> = [];

  if (discovery.selectedHubs.includes("sales")) {
    buildTasks.push(
      createBlueprintTask("Configure Sales Hub properties, pipelines, and handoff stages", "Human", 5, buildTasks.length + 1),
      createBlueprintTask("Generate sales object and field checklist", "Agent", 2, buildTasks.length + 1)
    );
  }

  if (discovery.selectedHubs.includes("marketing")) {
    buildTasks.push(
      createBlueprintTask("Configure marketing lifecycle, campaign, and lead routing setup", "Human", 4, buildTasks.length + 1),
      createBlueprintTask("Draft marketing automation and nurture recommendations", "Agent", 2, buildTasks.length + 1)
    );
  }

  if (discovery.selectedHubs.includes("service")) {
    buildTasks.push(
      createBlueprintTask("Configure service pipelines, inbox, and support process foundations", "Human", 4, buildTasks.length + 1)
    );
  }

  if (discovery.selectedHubs.includes("cms")) {
    buildTasks.push(
      createBlueprintTask("Align CMS/content requirements with website rebuild dependencies", "Human", 3, buildTasks.length + 1)
    );
  }

  if (discovery.selectedHubs.includes("ops")) {
    buildTasks.push(
      createBlueprintTask("Define RevOps governance, custom objects, and operational controls", "Human", 4, buildTasks.length + 1)
    );
  }

  if ((session3.integration_requirements ?? "").trim().length > 0) {
    buildTasks.push(
      createBlueprintTask("Assess and sequence required integrations", "Human", 3, buildTasks.length + 1)
    );
  }

  phases.push({
    phase: 3,
    phaseName: "Hub Configuration & Automation",
    tasks:
      buildTasks.length > 0
        ? buildTasks
        : [
            createBlueprintTask("Configure core HubSpot setup based on approved future-state design", "Human", 6, 1),
            createBlueprintTask("Prepare automation implementation checklist", "Agent", 2, 2)
          ]
  });

  phases.push({
    phase: 4,
    phaseName: "Testing, Enablement & Launch",
    tasks: [
      createBlueprintTask("Run QA on records, workflows, and reporting outputs", "Human", 3, 1),
      createBlueprintTask("Support user acceptance testing and change readiness", "Client", 2, 2),
      createBlueprintTask("Prepare handover, adoption, and next-step recommendations", "Human", 3, 3)
    ]
  });

  const needsExtraPhase =
    discovery.engagementType === "MIGRATION" ||
    (session2.data_landscape ?? "").trim().length > 0 ||
    discovery.discoveryProfile.dataReadinessRating.toLowerCase() === "low";

  if (needsExtraPhase) {
    phases.splice(2, 0, {
      phase: 3,
      phaseName: "Migration Readiness",
      tasks: [
        createBlueprintTask("Audit legacy data structure and migration constraints", "Human", 4, 1),
        createBlueprintTask("Prepare migration mapping and issue log", "Agent", 3, 2),
        createBlueprintTask("Approve data owners and cutover responsibilities", "Client", 1, 3)
      ]
    });

    for (const [index, phase] of phases.entries()) {
      phase.phase = index + 1;
      phase.tasks = phase.tasks.map((task, taskIndex) => ({
        ...task,
        order: taskIndex + 1
      }));
    }
  }

  const scopeText = [session1.primary_pain_challenge, session4.confirmed_scope]
    .filter(Boolean)
    .join(" ");

  if (/report/i.test(scopeText) || (session3.reporting_requirements ?? "").trim().length > 0) {
    const finalPhase = phases[phases.length - 1];

    if (finalPhase) {
      finalPhase.tasks.splice(
        Math.max(finalPhase.tasks.length - 1, 0),
        0,
        createBlueprintTask(
          "Configure reporting views and success dashboards",
          "Human",
          3,
          0
        )
      );
      finalPhase.tasks = finalPhase.tasks.map((task, index) => ({
        ...task,
        order: index + 1
      }));
    }
  }

  return blueprintGenerationSchema.parse({ phases });
}

function includesAny(value: string, patterns: string[]) {
  const normalizedValue = value.toLowerCase();
  return patterns.some((pattern) => normalizedValue.includes(pattern));
}

function getDiscoveryEvidenceText(
  discoveryPayload: NonNullable<
    Awaited<ReturnType<typeof loadProjectDiscoveryForBlueprint>>
  >
) {
  return [
    discoveryPayload.discovery.projectName,
    discoveryPayload.discovery.engagementType,
    discoveryPayload.discovery.client.industry ?? "",
    ...discoveryPayload.discovery.sessions.flatMap((session) =>
      Object.values(session.fields)
    )
  ]
    .join(" \n")
    .toLowerCase();
}

function deriveBlueprintGuidance(
  discoveryPayload: NonNullable<
    Awaited<ReturnType<typeof loadProjectDiscoveryForBlueprint>>
  >
) {
  const evidenceText = getDiscoveryEvidenceText(discoveryPayload);
  const selectedHubs = new Set(discoveryPayload.discovery.selectedHubs);
  const engagementType = discoveryPayload.discovery.engagementType;

  const hasMigrationScope =
    engagementType === "MIGRATION" ||
    includesAny(evidenceText, [
      "migration",
      "migrate",
      "import",
      "legacy crm",
      "salesforce",
      "freshworks",
      "historical data",
      "excel",
      "outlook"
    ]);
  const hasWebsiteScope =
    selectedHubs.has("cms") ||
    includesAny(evidenceText, [
      "website",
      "cms",
      "site",
      "landing page",
      "brand refresh",
      "rebuild",
      "template",
      "seo"
    ]);
  const hasReportingScope = includesAny(evidenceText, [
    "report",
    "dashboard",
    "kpi",
    "attribution"
  ]);
  const hasMarketingScope =
    selectedHubs.has("marketing") ||
    includesAny(evidenceText, [
      "campaign",
      "form",
      "lead",
      "lifecycle",
      "email nurture",
      "segmentation"
    ]);
  const hasSalesScope =
    selectedHubs.has("sales") ||
    includesAny(evidenceText, [
      "pipeline",
      "deal",
      "sales",
      "mql",
      "sql",
      "qualification"
    ]);
  const hasServiceScope =
    selectedHubs.has("service") ||
    includesAny(evidenceText, [
      "service",
      "ticket",
      "support",
      "help desk",
      "customer portal"
    ]);
  const recommendedModules = [
    "CRM Core Foundation",
    hasSalesScope ? "Sales Hub Core" : null,
    hasMarketingScope ? "Marketing Hub Foundation" : null,
    hasServiceScope ? "Service Hub Core" : null,
    hasWebsiteScope ? "CMS / Website Foundation" : null,
    hasMigrationScope ? "Data Migration Foundation" : null,
    hasReportingScope ? "Reporting Foundation" : null
  ].filter((module): module is string => Boolean(module));

  return {
    hasMigrationScope,
    hasWebsiteScope,
    hasReportingScope,
    hasMarketingScope,
    hasSalesScope,
    hasServiceScope,
    recommendedModules
  };
}

function classifyBlueprintTaskType(
  taskName: string
): (typeof blueprintTaskTypeValues)[number] {
  const normalizedName = taskName.toLowerCase();
  const clientKeywords = [
    "approve",
    "confirm",
    "provide",
    "share",
    "grant",
    "review",
    "sign off",
    "finalize",
    "complete",
    "billing",
    "license",
    "seat",
    "stakeholder",
    "owner"
  ];
  const agentKeywords = [
    "generate",
    "prepare",
    "draft",
    "compile",
    "inventory",
    "checklist",
    "mapping",
    "issue log",
    "validate",
    "qa",
    "preflight",
    "audit"
  ];
  const manualOnlyKeywords = [
    "configure",
    "build",
    "design",
    "implement",
    "conduct",
    "train",
    "perform",
    "execute",
    "establish",
    "align",
    "set up",
    "create dashboard",
    "reporting views"
  ];

  if (includesAny(normalizedName, clientKeywords)) {
    return "Client";
  }

  if (
    includesAny(normalizedName, agentKeywords) &&
    !includesAny(normalizedName, manualOnlyKeywords)
  ) {
    return "Agent";
  }

  return "Human";
}

function normalizeBlueprintEffort(
  taskType: (typeof blueprintTaskTypeValues)[number],
  effortHours: number
) {
  const roundedHours = Math.max(1, Math.round(effortHours));

  switch (taskType) {
    case "Agent":
      return Math.min(Math.max(roundedHours, 1), 4);
    case "Client":
      return Math.min(Math.max(roundedHours, 1), 6);
    case "Human":
      return Math.min(Math.max(roundedHours, 2), 12);
  }
}

function taskMatchesScope(
  taskName: string,
  guidance: ReturnType<typeof deriveBlueprintGuidance>
) {
  const normalizedName = taskName.toLowerCase();

  if (
    !guidance.hasWebsiteScope &&
    includesAny(normalizedName, [
      "website",
      "cms",
      "page",
      "template",
      "seo",
      "theme",
      "landing page"
    ])
  ) {
    return false;
  }

  if (
    !guidance.hasMigrationScope &&
    includesAny(normalizedName, [
      "migration",
      "import",
      "legacy",
      "dedupe",
      "cutover",
      "historical data"
    ])
  ) {
    return false;
  }

  if (
    !guidance.hasServiceScope &&
    includesAny(normalizedName, ["service", "ticket", "support", "help desk"])
  ) {
    return false;
  }

  return true;
}

function normalizeGeneratedBlueprint(
  blueprint: z.infer<typeof blueprintGenerationSchema>,
  discoveryPayload: NonNullable<
    Awaited<ReturnType<typeof loadProjectDiscoveryForBlueprint>>
  >
) {
  const guidance = deriveBlueprintGuidance(discoveryPayload);

  const normalizedPhases = blueprint.phases
    .map((phase, phaseIndex) => {
      const dedupedTasks = Array.from(
        new Map(
          phase.tasks.map((task) => [task.name.trim().toLowerCase(), task])
        ).values()
      );

      const scopedTasks = dedupedTasks
        .filter((task) => taskMatchesScope(task.name, guidance))
        .map((task, taskIndex) => {
          const taskType = classifyBlueprintTaskType(task.name);

          return {
            ...task,
            type: taskType,
            effortHours: normalizeBlueprintEffort(taskType, task.effortHours),
            order: taskIndex + 1
          };
        });

      return {
        phase: phaseIndex + 1,
        phaseName: phase.phaseName,
        tasks: scopedTasks
      };
    })
    .filter((phase) => phase.tasks.length > 0);

  return blueprintGenerationSchema.parse({
    phases:
      normalizedPhases.length > 0
        ? normalizedPhases
        : buildFallbackBlueprint(discoveryPayload).phases
  });
}

async function loadProjectDiscoveryForBlueprint(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: true,
      portal: true,
      discovery: {
        orderBy: { version: "asc" },
        select: {
          version: true,
          status: true,
          sections: true,
          completedSections: true,
          updatedAt: true
        }
      }
    }
  });

  if (!project) {
    return null;
  }

  const sessions = buildDiscoverySessionsWithStatus(project.discovery).map(
    (session) => ({
      session: session.session,
      title: session.title,
      status: session.status,
      completedFieldCount: Object.values(session.fields).filter(
        (value) => value.trim().length > 0
      ).length,
      fields: session.fields
    })
  );
  const session4 = sessions.find((session) => session.session === 4);
  const discoveryProfile = {
    engagementTrack: session4?.fields.engagement_track?.trim() ?? "",
    platformFit: session4?.fields.platform_fit?.trim() ?? "",
    changeManagementRating:
      session4?.fields.change_management_rating?.trim() ?? "",
    dataReadinessRating:
      session4?.fields.data_readiness_rating?.trim() ?? "",
    scopeVolatilityRating:
      session4?.fields.scope_volatility_rating?.trim() ?? ""
  };

  return {
    project,
    discovery: {
      projectId: project.id,
      projectName: project.name,
      engagementType: project.engagementType,
      selectedHubs: project.selectedHubs,
      client: {
        name: project.client.name,
        industry: project.client.industry,
        region: project.client.region,
        website: project.client.website,
        additionalWebsites: project.client.additionalWebsites,
        linkedinUrl: project.client.linkedinUrl,
        facebookUrl: project.client.facebookUrl,
        instagramUrl: project.client.instagramUrl,
        xUrl: project.client.xUrl,
        youtubeUrl: project.client.youtubeUrl
      },
      portal: project.portal
        ? {
            portalId: project.portal.portalId,
            displayName: project.portal.displayName,
            region: project.portal.region,
            connected: project.portal.connected
          }
        : null,
      sessions,
      discoveryProfile
    }
  };
}

async function generateDiscoverySummary(projectId: string) {
  const discoveryPayload = await loadProjectDiscoveryForBlueprint(projectId);

  if (!discoveryPayload) {
    throw new Error("Project not found");
  }

  const missingInformation = discoveryPayload.discovery.sessions.flatMap(
    (session) =>
      Object.entries(session.fields)
        .filter(([, value]) => value.trim().length === 0)
        .map(([key]) => `Session ${session.session}: ${key}`)
  );

  const rawSummary = await callClaude(
    `You are Muloo Deploy OS's Discovery Structuring Agent.
Given a structured HubSpot discovery project, create a concise project-level discovery summary.

Rules:
- Return ONLY valid JSON. No markdown or explanation.
- Use exactly these keys: executiveSummary, engagementTrack, platformFit, changeManagementRating, dataReadinessRating, scopeVolatilityRating, missingInformation, keyRisks, recommendedNextQuestions
- Keep executiveSummary to one short paragraph.
- missingInformation should contain only the most important information gaps.
- keyRisks should focus on delivery, adoption, data, and scope risk.
- recommendedNextQuestions should be practical and operator-friendly.
- If discoveryProfile already contains a value for engagementTrack, platformFit, changeManagementRating, dataReadinessRating, or scopeVolatilityRating, preserve that meaning in the output.
`,
    JSON.stringify(
      {
        ...discoveryPayload.discovery,
        heuristicMissingInformation: missingInformation
      },
      null,
      2
    )
  );

  const parsedSummary = await parseModelJson(
    rawSummary,
    discoverySummarySchema,
    "discovery-summary"
  );
  const normalizedSummary = {
    ...parsedSummary,
    missingInformation: parsedSummary.missingInformation ?? [],
    keyRisks: parsedSummary.keyRisks ?? [],
    recommendedNextQuestions: parsedSummary.recommendedNextQuestions ?? []
  };

  const savedSummary = await prisma.discoverySummary.upsert({
    where: { projectId },
    update: normalizedSummary,
    create: {
      projectId,
      ...normalizedSummary
    }
  });

  return serializeDiscoverySummary(savedSummary);
}

async function loadDiscoverySummary(projectId: string) {
  const summary = await prisma.discoverySummary.findUnique({
    where: { projectId }
  });

  return summary ? serializeDiscoverySummary(summary) : null;
}

async function generateBlueprintFromDiscovery(projectId: string) {
  const discoveryPayload = await loadProjectDiscoveryForBlueprint(projectId);

  if (!discoveryPayload) {
    throw new Error("Project not found");
  }

  const session1 = discoveryPayload.discovery.sessions.find(
    (session) => session.session === 1
  );
  const session3 = discoveryPayload.discovery.sessions.find(
    (session) => session.session === 3
  );

  if (session1?.status !== "complete" || session3?.status !== "complete") {
    throw new Error(
      "Session 1 (Business & Goals) and Session 3 (Future State Design) must be complete before generating a blueprint"
    );
  }

  let parsedBlueprint: z.infer<typeof blueprintGenerationSchema>;
  const guidance = deriveBlueprintGuidance(discoveryPayload);

  try {
    const discoverySummary = await loadDiscoverySummary(projectId);
    const rawBlueprint = await callClaude(
      `You are a HubSpot implementation planning assistant for Muloo, a technical HubSpot delivery company.
Given structured discovery data from a client project, generate a phased implementation blueprint.

Rules:
- Return ONLY valid JSON. No explanation, no markdown, no preamble.
- Use exactly this structure: {"phases":[{"phase":1,"phaseName":"Foundation & Alignment","tasks":[{"name":"Task name","type":"Human","effortHours":3,"order":1}]}]}
- Organise work into 3 to 5 phases.
- Each phase must contain at least 1 task.
- Each task must have: name, type (Agent/Human/Client), effortHours (realistic estimate), order (within phase).
- Agent = automated by DeployOS tooling. Human = Muloo consultant time. Client = client must action.
- Human task hours must be realistic for a senior HubSpot consultant.
- Prefer concise, implementation-ready task names.
- Base the blueprint on enabled hubs, use cases, risks, data readiness, and complexity in the discovery.
- Do not invent scope that is not evidenced in discovery.
- Only include website or CMS implementation tasks if website/CMS scope is explicitly present.
- Only include migration tasks if migration/import/data-cutover work is explicitly present.
- Use Muloo standards modules where relevant: ${guidance.recommendedModules.join(", ")}.
- Agent tasks must be low-ambiguity operational support only, such as inventories, checklists, validation, or draft artefacts.
- Do not classify configuration, architecture, training, reporting design, stakeholder workshops, or content strategy as Agent work.
- Client tasks should be approvals, access, data provision, licensing, or sign-off items only.
- Default to Human when a task needs consultant judgment.
`,
      JSON.stringify(
        {
          ...discoveryPayload.discovery,
          discoverySummary,
          blueprintGuidance: guidance
        },
        null,
        2
      ),
      { maxTokens: 4000 }
    );

    parsedBlueprint = await parseModelJson(
      rawBlueprint,
      blueprintGenerationSchema,
      "blueprint"
    );
  } catch (error) {
    console.error("Falling back to heuristic blueprint generation", error);
    parsedBlueprint = buildFallbackBlueprint(discoveryPayload);
  }

  parsedBlueprint = normalizeGeneratedBlueprint(
    parsedBlueprint,
    discoveryPayload
  );

  return prisma.blueprint.upsert({
    where: { projectId },
    update: {
      generatedAt: new Date(),
      tasks: {
        deleteMany: {},
        create: parsedBlueprint.phases.flatMap((phase) =>
          phase.tasks.map((task) => ({
            phase: phase.phase,
            phaseName: phase.phaseName,
            name: task.name,
            type: task.type,
            effortHours: task.effortHours,
            order: task.order
          }))
        )
      }
    },
    create: {
      projectId,
      tasks: {
        create: parsedBlueprint.phases.flatMap((phase) =>
          phase.tasks.map((task) => ({
            phase: phase.phase,
            phaseName: phase.phaseName,
            name: task.name,
            type: task.type,
            effortHours: task.effortHours,
            order: task.order
          }))
        )
      }
    },
    include: {
      tasks: {
        orderBy: [{ phase: "asc" }, { order: "asc" }]
      }
    }
  });
}

async function loadBlueprint(projectId: string) {
  return prisma.blueprint.findUnique({
    where: { projectId },
    include: {
      tasks: {
        orderBy: [{ phase: "asc" }, { order: "asc" }]
      }
    }
  });
}

function serializeProductCatalogItem<
  T extends {
    id: string;
    slug: string;
    name: string;
    category: string;
    billingModel: string;
    description: string | null;
    unitPrice: number;
    defaultQuantity: number;
    unitLabel: string;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }
>(product: T) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    category: product.category,
    billingModel: product.billingModel,
    description: product.description,
    unitPrice: product.unitPrice,
    defaultQuantity: product.defaultQuantity,
    unitLabel: product.unitLabel,
    isActive: product.isActive,
    sortOrder: product.sortOrder,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString()
  };
}

async function ensureProductCatalogSeeded() {
  const existingCount = await prisma.productCatalogItem.count();

  if (existingCount > 0) {
    return;
  }

  await prisma.productCatalogItem.createMany({
    data: defaultProductCatalog.map((product) => ({
      ...product
    }))
  });
}

async function loadProductCatalog() {
  await ensureProductCatalogSeeded();

  const products = await prisma.productCatalogItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });

  return products.map((product) => serializeProductCatalogItem(product));
}

async function createProductCatalogItem(value: {
  name?: unknown;
  category?: unknown;
  billingModel?: unknown;
  description?: unknown;
  unitPrice?: unknown;
  defaultQuantity?: unknown;
  unitLabel?: unknown;
  isActive?: unknown;
  sortOrder?: unknown;
}) {
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const category = typeof value.category === "string" ? value.category.trim() : "";
  const billingModel =
    typeof value.billingModel === "string" ? value.billingModel.trim() : "";
  const description =
    typeof value.description === "string" ? value.description.trim() : "";
  const unitLabel =
    typeof value.unitLabel === "string" ? value.unitLabel.trim() : "";
  const unitPrice =
    typeof value.unitPrice === "number"
      ? value.unitPrice
      : Number(value.unitPrice);
  const defaultQuantity =
    typeof value.defaultQuantity === "number"
      ? value.defaultQuantity
      : Number(value.defaultQuantity);
  const sortOrder =
    typeof value.sortOrder === "number"
      ? value.sortOrder
      : Number(value.sortOrder);

  if (!name || !category || !billingModel || !Number.isFinite(unitPrice)) {
    throw new Error(
      "name, category, billingModel, and a valid unitPrice are required"
    );
  }

  const product = await prisma.productCatalogItem.create({
    data: {
      slug: createSlug(name),
      name,
      category,
      billingModel,
      description: description || null,
      unitPrice,
      defaultQuantity:
        Number.isFinite(defaultQuantity) && defaultQuantity > 0
          ? Math.round(defaultQuantity)
          : 1,
      unitLabel: unitLabel || "item",
      isActive: value.isActive === false ? false : true,
      sortOrder: Number.isFinite(sortOrder) ? Math.round(sortOrder) : 999
    }
  });

  return serializeProductCatalogItem(product);
}

async function createClientPortalUserForProject(
  projectId: string,
  value: {
    firstName?: unknown;
    lastName?: unknown;
    email?: unknown;
    password?: unknown;
    role?: unknown;
  }
) {
  const firstName =
    typeof value.firstName === "string" ? value.firstName.trim() : "";
  const lastName =
    typeof value.lastName === "string" ? value.lastName.trim() : "";
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const password =
    typeof value.password === "string" ? value.password.trim() : "";
  const role = typeof value.role === "string" ? value.role.trim() : "contributor";

  if (!firstName || !lastName || !email || !password) {
    throw new Error("firstName, lastName, email, and password are required");
  }

  const user = await prisma.clientPortalUser.upsert({
    where: { email },
    update: {
      firstName,
      lastName,
      password
    },
    create: {
      firstName,
      lastName,
      email,
      password
    }
  });

  await prisma.clientProjectAccess.upsert({
    where: {
      userId_projectId: {
        userId: user.id,
        projectId
      }
    },
    update: {
      role
    },
    create: {
      userId: user.id,
      projectId,
      role
    }
  });

  return serializeClientPortalUser(user);
}

async function loadClientUsersForProject(projectId: string) {
  const accessRecords = await prisma.clientProjectAccess.findMany({
    where: { projectId },
    include: { user: true },
    orderBy: [{ createdAt: "asc" }]
  });

  return accessRecords.map((record) => ({
    ...serializeClientPortalUser(record.user),
    role: record.role
  }));
}

async function loadClientProjectsForUser(userId: string) {
  const accessRecords = await prisma.clientProjectAccess.findMany({
    where: { userId },
    include: {
      project: {
        include: {
          client: true
        }
      }
    },
    orderBy: {
      project: {
        updatedAt: "desc"
      }
    }
  });

  return accessRecords.map((record) => ({
    role: record.role,
    project: serializeClientProject(record.project)
  }));
}

async function loadClientProjectDetail(projectId: string, userId: string) {
  const access = await prisma.clientProjectAccess.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId
      }
    },
    include: {
      project: {
        include: {
          client: true
        }
      },
      user: true
    }
  });

  if (!access) {
    return null;
  }

  const submissions = await prisma.clientInputSubmission.findMany({
    where: {
      projectId,
      userId
    },
    orderBy: [{ sessionNumber: "asc" }]
  });

  return {
    user: serializeClientPortalUser(access.user),
    role: access.role,
    project: serializeClientProject(access.project),
    submissions: submissions.map((submission) =>
      serializeClientInputSubmission(submission)
    )
  };
}

async function saveClientInputSubmission(
  projectId: string,
  userId: string,
  sessionNumber: number,
  answers: unknown
) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    throw new Error("answers must be an object");
  }

  const normalizedAnswers = Object.fromEntries(
    Object.entries(answers as Record<string, unknown>).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() : ""
    ])
  );
  const completedCount = Object.values(normalizedAnswers).filter(
    (value) => typeof value === "string" && value.trim().length > 0
  ).length;
  const status = completedCount > 0 ? "submitted" : "draft";

  const submission = await prisma.clientInputSubmission.upsert({
    where: {
      projectId_userId_sessionNumber: {
        projectId,
        userId,
        sessionNumber
      }
    },
    update: {
      answers: normalizedAnswers,
      status
    },
    create: {
      projectId,
      userId,
      sessionNumber,
      answers: normalizedAnswers,
      status
    }
  });

  return serializeClientInputSubmission(submission);
}

async function updateProductCatalogItem(
  productId: string,
  value: {
    name?: unknown;
    category?: unknown;
    billingModel?: unknown;
    description?: unknown;
    unitPrice?: unknown;
    defaultQuantity?: unknown;
    unitLabel?: unknown;
    isActive?: unknown;
    sortOrder?: unknown;
  }
) {
  const updateData: Prisma.Prisma.ProductCatalogItemUpdateInput = {};

  if (value.name !== undefined) {
    if (typeof value.name !== "string" || value.name.trim().length === 0) {
      throw new Error("name must be a non-empty string");
    }

    updateData.name = value.name.trim();
    updateData.slug = createSlug(value.name.trim());
  }

  if (value.category !== undefined) {
    if (typeof value.category !== "string" || value.category.trim().length === 0) {
      throw new Error("category must be a non-empty string");
    }

    updateData.category = value.category.trim();
  }

  if (value.billingModel !== undefined) {
    if (
      typeof value.billingModel !== "string" ||
      value.billingModel.trim().length === 0
    ) {
      throw new Error("billingModel must be a non-empty string");
    }

    updateData.billingModel = value.billingModel.trim();
  }

  if (value.description !== undefined) {
    if (typeof value.description !== "string") {
      throw new Error("description must be a string");
    }

    updateData.description = value.description.trim() || null;
  }

  if (value.unitPrice !== undefined) {
    const unitPrice =
      typeof value.unitPrice === "number"
        ? value.unitPrice
        : Number(value.unitPrice);

    if (!Number.isFinite(unitPrice)) {
      throw new Error("unitPrice must be a valid number");
    }

    updateData.unitPrice = unitPrice;
  }

  if (value.defaultQuantity !== undefined) {
    const defaultQuantity =
      typeof value.defaultQuantity === "number"
        ? value.defaultQuantity
        : Number(value.defaultQuantity);

    if (!Number.isFinite(defaultQuantity) || defaultQuantity <= 0) {
      throw new Error("defaultQuantity must be a positive number");
    }

    updateData.defaultQuantity = Math.round(defaultQuantity);
  }

  if (value.unitLabel !== undefined) {
    if (typeof value.unitLabel !== "string" || value.unitLabel.trim().length === 0) {
      throw new Error("unitLabel must be a non-empty string");
    }

    updateData.unitLabel = value.unitLabel.trim();
  }

  if (value.isActive !== undefined) {
    updateData.isActive = Boolean(value.isActive);
  }

  if (value.sortOrder !== undefined) {
    const sortOrder =
      typeof value.sortOrder === "number"
        ? value.sortOrder
        : Number(value.sortOrder);

    if (!Number.isFinite(sortOrder)) {
      throw new Error("sortOrder must be a valid number");
    }

    updateData.sortOrder = Math.round(sortOrder);
  }

  const product = await prisma.productCatalogItem.update({
    where: { id: productId },
    data: updateData
  });

  return serializeProductCatalogItem(product);
}

function serializeDiscoveryEvidence<
  T extends {
    id: string;
    projectId: string;
    sessionNumber: number;
    evidenceType: string;
    sourceLabel: string;
    sourceUrl: string | null;
    content: string | null;
    createdAt: Date;
    updatedAt: Date;
  }
>(evidence: T) {
  return {
    id: evidence.id,
    projectId: evidence.projectId,
    sessionNumber: evidence.sessionNumber,
    evidenceType: evidence.evidenceType,
    sourceLabel: evidence.sourceLabel,
    sourceUrl: evidence.sourceUrl,
    content: evidence.content,
    createdAt: evidence.createdAt.toISOString(),
    updatedAt: evidence.updatedAt.toISOString()
  };
}

async function loadDiscoveryEvidence(
  projectId: string,
  sessionNumber?: number
) {
  const evidenceItems = await prisma.discoveryEvidence.findMany({
    where: {
      projectId,
      ...(sessionNumber ? { sessionNumber } : {})
    },
    orderBy: [{ sessionNumber: "asc" }, { createdAt: "desc" }]
  });

  return evidenceItems.map((item) => serializeDiscoveryEvidence(item));
}

async function createDiscoveryEvidence(
  projectId: string,
  sessionNumber: number,
  value: {
    evidenceType?: unknown;
    sourceLabel?: unknown;
    sourceUrl?: unknown;
    content?: unknown;
  }
) {
  const evidenceType =
    typeof value.evidenceType === "string" &&
    isValidDiscoveryEvidenceType(value.evidenceType)
      ? value.evidenceType
      : null;
  const sourceLabel =
    typeof value.sourceLabel === "string" ? value.sourceLabel.trim() : "";
  const sourceUrl =
    typeof value.sourceUrl === "string" ? value.sourceUrl.trim() : "";
  const content = typeof value.content === "string" ? value.content.trim() : "";

  if (!evidenceType || !sourceLabel || (!content && !sourceUrl)) {
    throw new Error(
      "evidenceType, sourceLabel, and either content or sourceUrl are required"
    );
  }

  const evidenceItem = await prisma.discoveryEvidence.create({
    data: {
      projectId,
      sessionNumber,
      evidenceType,
      sourceLabel,
      sourceUrl: sourceUrl || null,
      content: content || null
    }
  });

  return serializeDiscoveryEvidence(evidenceItem);
}

async function saveDiscoverySession(
  projectId: string,
  sessionNumber: number,
  fields: unknown
) {
  const normalizedFields = normalizeDiscoverySessionFields(
    sessionNumber,
    fields
  );
  const completedSections = getCompletedDiscoverySections(normalizedFields);
  const status = getDiscoverySessionStatus(normalizedFields);

  await prisma.discoverySubmission.upsert({
    where: {
      projectId_version: {
        projectId,
        version: sessionNumber
      }
    },
    update: {
      sections: normalizedFields,
      completedSections,
      status
    },
    create: {
      projectId,
      version: sessionNumber,
      sections: normalizedFields,
      completedSections,
      status
    }
  });

  return {
    session: sessionNumber,
    title: sessionTitles[sessionNumber] ?? `Session ${sessionNumber}`,
    status,
    fields: normalizedFields
  };
}

async function extractDiscoveryFields(
  text: string,
  session: number
): Promise<{ fields: DiscoverySessionFields; message?: string }> {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    return {
      fields: {},
      message: "ANTHROPIC_API_KEY not configured — extraction unavailable"
    };
  }

  const fields = sessionFieldLabels[session] ?? sessionFieldLabels[1] ?? [];
  const systemPrompt = `You are extracting structured information from HubSpot discovery meeting notes.

Extract values for EXACTLY these fields: ${fields.join(", ")}

Rules:
- Return ONLY a valid JSON object. No markdown, no backticks, no explanation.
- Use the exact field names listed above as JSON keys.
- Values should be concise summaries (2-4 sentences max per field).
- If a field topic is not mentioned in the notes, return an empty string "" for that field.
- Do not add any fields not listed above.

Example format:
{
  "business_overview": "...",
  "primary_pain_challenge": "..."
}`;
  const userPrompt = `Meeting notes:\n\n${text}\n\nExtract the fields now.`;

  const rawText = await callClaude(systemPrompt, userPrompt).catch(() => "{}");
  console.log(
    "[discovery/extract] Claude raw response:",
    rawText.substring(0, 500)
  );

  try {
    const extractedFields = normalizeDiscoveryFields(
      JSON.parse(rawText) as unknown
    );
    console.log(
      "[discovery/extract] Parsed fields:",
      JSON.stringify(extractedFields)
    );
    return { fields: extractedFields };
  } catch {
    console.log("[discovery/extract] Parsed fields:", JSON.stringify({}));
    return { fields: {} };
  }
}

export function createAppServer(config: BaseConfig): http.Server {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", config.appBaseUrl);

    try {
      if (url.pathname === "/api/auth/session") {
        return sendJson(response, 200, {
          authenticated: isAuthenticated(request)
        });
      }

      if (request.method === "POST" && url.pathname === "/api/auth/login") {
        const body = (await readJsonBody(request)) as {
          username?: string;
          password?: string;
        };
        const credentials = resolveSimpleAuthCredentials();

        if (
          body.username?.trim() !== credentials.username ||
          body.password !== credentials.password
        ) {
          return sendJson(response, 401, { error: "Invalid credentials" });
        }

        setCookie(response, createSimpleAuthToken(credentials.username), {
          maxAge: 60 * 60 * 12
        });
        return sendJson(response, 200, { authenticated: true });
      }

      if (request.method === "POST" && url.pathname === "/api/auth/logout") {
        setCookie(response, "", { maxAge: 0 });
        return sendJson(response, 200, { authenticated: false });
      }

      if (url.pathname === "/api/client-auth/session") {
        const clientUserId = getAuthenticatedClientUserId(request);

        if (!clientUserId) {
          return sendJson(response, 200, { authenticated: false });
        }

        const user = await prisma.clientPortalUser.findUnique({
          where: { id: clientUserId }
        });

        return sendJson(response, 200, {
          authenticated: Boolean(user),
          user: user ? serializeClientPortalUser(user) : null
        });
      }

      if (request.method === "POST" && url.pathname === "/api/client-auth/login") {
        const body = (await readJsonBody(request)) as {
          email?: string;
          password?: string;
        };
        const email = body.email?.trim().toLowerCase() ?? "";
        const password = body.password ?? "";

        const user = email
          ? await prisma.clientPortalUser.findUnique({
              where: { email }
            })
          : null;

        if (!user || user.password !== password) {
          return sendJson(response, 401, { error: "Invalid client credentials" });
        }

        setCookie(response, createClientAuthToken(user.id), {
          name: clientAuthCookieName,
          maxAge: 60 * 60 * 24 * 14
        });

        return sendJson(response, 200, {
          authenticated: true,
          user: serializeClientPortalUser(user)
        });
      }

      if (
        request.method === "POST" &&
        url.pathname === "/api/client-auth/logout"
      ) {
        setCookie(response, "", {
          name: clientAuthCookieName,
          maxAge: 0
        });
        return sendJson(response, 200, { authenticated: false });
      }

      if (
        url.pathname.startsWith("/api/") &&
        !url.pathname.startsWith("/api/client-auth/") &&
        !url.pathname.startsWith("/api/auth/") &&
        !url.pathname.startsWith("/api/client/") &&
        url.pathname !== "/api/health"
      ) {
        if (!isAuthenticated(request)) {
          return sendJson(response, 401, { error: "Unauthorized" });
        }
      }

      if (url.pathname.startsWith("/api/client/")) {
        const clientUserId = getAuthenticatedClientUserId(request);

        if (!clientUserId) {
          return sendJson(response, 401, { error: "Client unauthorized" });
        }

        const clientProjectRoute = matchClientProjectRoute(url.pathname);

        if (clientProjectRoute) {
          if (request.method === "GET" && !clientProjectRoute.projectId) {
            return sendJson(response, 200, {
              projects: await loadClientProjectsForUser(clientUserId)
            });
          }

          if (
            request.method === "GET" &&
            clientProjectRoute.projectId &&
            !clientProjectRoute.resource
          ) {
            const detail = await loadClientProjectDetail(
              clientProjectRoute.projectId,
              clientUserId
            );

            if (!detail) {
              return sendJson(response, 404, { error: "Project not found" });
            }

            return sendJson(response, 200, detail);
          }

          if (
            request.method === "PATCH" &&
            clientProjectRoute.projectId &&
            clientProjectRoute.resource === "submissions" &&
            clientProjectRoute.sessionId
          ) {
            try {
              const body = (await readJsonBody(request)) as { answers?: unknown };
              const submission = await saveClientInputSubmission(
                clientProjectRoute.projectId,
                clientUserId,
                clientProjectRoute.sessionId,
                body.answers ?? {}
              );

              return sendJson(response, 200, { submission });
            } catch (error) {
              if (error instanceof Error) {
                return sendJson(response, 400, { error: error.message });
              }

              throw error;
            }
          }
        }

        return sendJson(response, 404, { error: "Client route not found" });
      }

      if (request.method === "GET" && url.pathname === "/api/templates") {
        return sendJson(response, 200, {
          templates: await loadAllTemplates()
        });
      }

      const templateRoute = matchTemplateRoute(url.pathname);
      if (request.method === "GET" && templateRoute) {
        return sendJson(response, 200, {
          template: await loadTemplateById(templateRoute.templateId)
        });
      }

      if (url.pathname === "/api/health") {
        await prisma.$queryRaw`SELECT 1`;
        return sendJson(response, 200, {
          status: "ok",
          service: "muloo-deploy-os-api",
          timestamp: new Date().toISOString(),
          environment: config.nodeEnv,
          database: "connected",
          executionMode: config.executionMode,
          applyEnabled: config.applyEnabled,
          moduleCount: moduleCatalog.length
        });
      }

      if (url.pathname === "/api/modules") {
        return sendJson(response, 200, {
          modules: moduleCatalog
        });
      }

      if (url.pathname === "/api/settings") {
        return sendJson(response, 200, {
          environment: config.nodeEnv,
          appBaseUrl: config.appBaseUrl,
          artifactDir: config.artifactDir,
          executionMode: config.executionMode,
          applyEnabled: config.applyEnabled,
          integrationStatus: getIntegrationStatus(config)
        });
      }

      if (url.pathname === "/api/users") {
        return sendJson(response, 200, {
          users: projectOwnerOptions
        });
      }

      const productRoute = matchProductRoute(url.pathname);
      if (productRoute) {
        if (request.method === "GET" && !productRoute.productId) {
          return sendJson(response, 200, {
            products: await loadProductCatalog()
          });
        }

        if (request.method === "POST" && !productRoute.productId) {
          try {
            const body = (await readJsonBody(request)) as {
              name?: unknown;
              category?: unknown;
              billingModel?: unknown;
              description?: unknown;
              unitPrice?: unknown;
              defaultQuantity?: unknown;
              unitLabel?: unknown;
              isActive?: unknown;
              sortOrder?: unknown;
            };

            const product = await createProductCatalogItem(body);
            return sendJson(response, 201, { product });
          } catch (error) {
            if (error instanceof Error) {
              return sendJson(response, 400, { error: error.message });
            }

            throw error;
          }
        }

        if (request.method === "PATCH" && productRoute.productId) {
          try {
            const body = (await readJsonBody(request)) as {
              name?: unknown;
              category?: unknown;
              billingModel?: unknown;
              description?: unknown;
              unitPrice?: unknown;
              defaultQuantity?: unknown;
              unitLabel?: unknown;
              isActive?: unknown;
              sortOrder?: unknown;
            };

            const product = await updateProductCatalogItem(
              productRoute.productId,
              body
            );
            return sendJson(response, 200, { product });
          } catch (error) {
            if (error instanceof Error) {
              return sendJson(response, 400, { error: error.message });
            }

            throw error;
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      if (url.pathname === "/api/industries") {
        return sendJson(response, 200, {
          industries: industryOptions
        });
      }

      if (url.pathname === "/api/runs") {
        return sendJson(response, 200, {
          runs: await loadAllExecutionRecords()
        });
      }

      if (url.pathname === "/api/projects") {
        if (request.method === "POST") {
          const body = (await readJsonBody(request)) as {
            name: string;
            clientName: string;
            hubspotPortalId?: string;
            selectedHubs: string[];
            owner?: string;
            ownerEmail?: string;
            engagementType?: string;
            industry?: string;
            website?: string;
            additionalWebsites?: string[];
            linkedinUrl?: string;
            facebookUrl?: string;
            instagramUrl?: string;
            xUrl?: string;
            youtubeUrl?: string;
            clientChampionFirstName?: string;
            clientChampionLastName?: string;
            clientChampionEmail?: string;
          };

          if (!body.name || !body.clientName || !body.selectedHubs?.length) {
            return sendJson(response, 400, {
              error: "name, clientName, and selectedHubs are required"
            });
          }

          if (
            body.engagementType &&
            !isValidEngagementType(body.engagementType)
          ) {
            return sendJson(response, 400, {
              error: "Invalid engagement type"
            });
          }

          const slug = createSlug(body.clientName);
          const client = await prisma.client.upsert({
            where: { slug },
            update: {
              name: body.clientName,
              industry: body.industry?.trim() || null,
              website: body.website?.trim() || null,
              additionalWebsites: normalizeStringArray(body.additionalWebsites),
              linkedinUrl: body.linkedinUrl?.trim() || null,
              facebookUrl: body.facebookUrl?.trim() || null,
              instagramUrl: body.instagramUrl?.trim() || null,
              xUrl: body.xUrl?.trim() || null,
              youtubeUrl: body.youtubeUrl?.trim() || null
            },
            create: {
              name: body.clientName,
              slug,
              industry: body.industry?.trim() || null,
              website: body.website?.trim() || null,
              additionalWebsites: normalizeStringArray(body.additionalWebsites),
              linkedinUrl: body.linkedinUrl?.trim() || null,
              facebookUrl: body.facebookUrl?.trim() || null,
              instagramUrl: body.instagramUrl?.trim() || null,
              xUrl: body.xUrl?.trim() || null,
              youtubeUrl: body.youtubeUrl?.trim() || null
            }
          });

          const requestedPortalId = body.hubspotPortalId?.trim() ?? "";
          const portal = requestedPortalId
            ? await prisma.hubSpotPortal.upsert({
                where: { portalId: requestedPortalId },
                update: {},
                create: {
                  portalId: requestedPortalId,
                  displayName: body.clientName
                }
              })
            : await prisma.hubSpotPortal.create({
                data: {
                  portalId: createPendingPortalId(),
                  displayName: body.clientName
                }
              });

          const project = await prisma.project.create({
            data: {
              name: body.name,
              status: "draft",
              engagementType: (body.engagementType ??
                "IMPLEMENTATION") as Prisma.$Enums.EngagementType,
              ...resolveProjectOwner(body.owner, body.ownerEmail),
              clientChampionFirstName:
                body.clientChampionFirstName?.trim() || null,
              clientChampionLastName:
                body.clientChampionLastName?.trim() || null,
              clientChampionEmail:
                body.clientChampionEmail?.trim() || null,
              selectedHubs: body.selectedHubs,
              clientId: client.id,
              portalId: portal.id
            },
            include: {
              client: true,
              portal: true
            }
          });

          return sendJson(response, 201, {
            project: serializeProject(project)
          });
        }

        const projects = await prisma.project.findMany({
          include: { client: true, portal: true },
          orderBy: { updatedAt: "desc" }
        });
        return sendJson(response, 200, {
          projects: projects.map((project) => serializeProject(project))
        });
      }

      const discoveryRoute = matchDiscoveryRoute(url.pathname);
      if (request.method === "GET" && discoveryRoute) {
        const [submissions, evidenceItems] = await Promise.all([
          prisma.discoverySubmission.findMany({
            where: { projectId: discoveryRoute.projectId },
            orderBy: { version: "asc" },
            select: {
              version: true,
              status: true,
              sections: true,
              completedSections: true
            }
          }),
          loadDiscoveryEvidence(discoveryRoute.projectId)
        ]);

        return sendJson(response, 200, {
          sessions: buildDiscoverySessions(
            submissions.map((submission) => ({
              version: submission.version,
              sections: submission.sections
            }))
          ),
          sessionDetails: buildDiscoverySessionsWithStatus(submissions),
          evidenceItems
        });
      }

      const projectSessionRoute = matchProjectSessionRoute(url.pathname);
      if (request.method === "PATCH" && projectSessionRoute) {
        const project = await prisma.project.findUnique({
          where: { id: projectSessionRoute.projectId },
          select: { id: true }
        });

        if (!project) {
          return sendJson(response, 404, { error: "Project not found" });
        }

        const body = (await readJsonBody(request)) as { fields?: unknown };
        const sessionDetail = await saveDiscoverySession(
          projectSessionRoute.projectId,
          projectSessionRoute.sessionId,
          body.fields ?? body
        );

        return sendJson(response, 200, { sessionDetail });
      }

      const projectClientUsersRoute = matchProjectClientUsersRoute(url.pathname);
      if (projectClientUsersRoute) {
        if (request.method === "GET") {
          return sendJson(response, 200, {
            clientUsers: await loadClientUsersForProject(
              projectClientUsersRoute.projectId
            )
          });
        }

        if (request.method === "POST") {
          try {
            const body = (await readJsonBody(request)) as {
              firstName?: unknown;
              lastName?: unknown;
              email?: unknown;
              password?: unknown;
              role?: unknown;
            };

            const clientUser = await createClientPortalUserForProject(
              projectClientUsersRoute.projectId,
              body
            );

            return sendJson(response, 201, { clientUser });
          } catch (error) {
            if (error instanceof Error) {
              return sendJson(response, 400, { error: error.message });
            }

            throw error;
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      const projectSessionEvidenceRoute = matchProjectSessionEvidenceRoute(
        url.pathname
      );
      if (projectSessionEvidenceRoute) {
        if (request.method === "GET") {
          const project = await prisma.project.findUnique({
            where: { id: projectSessionEvidenceRoute.projectId },
            select: { id: true }
          });

          if (!project) {
            return sendJson(response, 404, { error: "Project not found" });
          }

          const evidenceItems = await loadDiscoveryEvidence(
            projectSessionEvidenceRoute.projectId,
            projectSessionEvidenceRoute.sessionId
          );
          return sendJson(response, 200, { evidenceItems });
        }

        if (request.method === "POST") {
          const project = await prisma.project.findUnique({
            where: { id: projectSessionEvidenceRoute.projectId },
            select: { id: true }
          });

          if (!project) {
            return sendJson(response, 404, { error: "Project not found" });
          }

          try {
            const body = (await readJsonBody(request)) as {
              evidenceType?: unknown;
              sourceLabel?: unknown;
              sourceUrl?: unknown;
              content?: unknown;
            };
            const evidenceItem = await createDiscoveryEvidence(
              projectSessionEvidenceRoute.projectId,
              projectSessionEvidenceRoute.sessionId,
              body
            );

            return sendJson(response, 201, { evidenceItem });
          } catch (error) {
            if (error instanceof Error) {
              return sendJson(response, 400, { error: error.message });
            }

            throw error;
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      const projectDiscoverySummaryRoute = matchProjectDiscoverySummaryRoute(
        url.pathname
      );
      if (projectDiscoverySummaryRoute) {
        if (request.method === "GET") {
          const project = await prisma.project.findUnique({
            where: { id: projectDiscoverySummaryRoute.projectId },
            select: { id: true }
          });

          if (!project) {
            return sendJson(response, 404, { error: "Project not found" });
          }

          const summary = await loadDiscoverySummary(
            projectDiscoverySummaryRoute.projectId
          );
          return sendJson(response, 200, { summary });
        }

        if (request.method === "POST") {
          try {
            const summary = await generateDiscoverySummary(
              projectDiscoverySummaryRoute.projectId
            );
            return sendJson(response, 200, { summary });
          } catch (error: unknown) {
            if (
              error instanceof Error &&
              error.message === "Project not found"
            ) {
              return sendJson(response, 404, { error: error.message });
            }

            if (error instanceof ZodError) {
              return sendJson(response, 502, {
                error: "Discovery summary returned invalid JSON",
                details: error.flatten()
              });
            }

            if (error instanceof SyntaxError) {
              return sendJson(response, 502, {
                error: "Discovery summary returned invalid JSON"
              });
            }

            throw error;
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      const projectBlueprintRoute = matchProjectBlueprintRoute(url.pathname);
      if (projectBlueprintRoute) {
        if (
          request.method === "POST" &&
          projectBlueprintRoute.action === "generate"
        ) {
          try {
            const blueprint = await generateBlueprintFromDiscovery(
              projectBlueprintRoute.projectId
            );
            return sendJson(response, 200, { blueprint });
          } catch (error: unknown) {
            if (
              error instanceof Error &&
              error.message === "Project not found"
            ) {
              return sendJson(response, 404, { error: error.message });
            }

            if (
              error instanceof Error &&
              error.message.includes("must be complete before generating")
            ) {
              return sendJson(response, 400, { error: error.message });
            }

            if (error instanceof ZodError) {
              return sendJson(response, 502, {
                error: "Blueprint generation returned invalid JSON",
                details: error.flatten()
              });
            }

            if (error instanceof SyntaxError) {
              return sendJson(response, 502, {
                error: "Blueprint generation returned invalid JSON"
              });
            }

            throw error;
          }
        }

        if (request.method === "GET" && !projectBlueprintRoute.action) {
          const blueprint = await loadBlueprint(
            projectBlueprintRoute.projectId
          );

          if (!blueprint) {
            return sendJson(response, 404, { error: "Blueprint not found" });
          }

          return sendJson(response, 200, { blueprint });
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      if (request.method === "POST" && url.pathname === "/api/discovery/save") {
        const body = (await readJsonBody(request)) as {
          projectId?: string;
          session?: number;
          fields?: Record<string, unknown>;
        };

        if (
          !body.projectId ||
          !body.session ||
          !sessionFieldLabels[body.session] ||
          !body.fields ||
          typeof body.fields !== "object" ||
          Array.isArray(body.fields)
        ) {
          return sendJson(response, 400, {
            error: "Invalid discovery payload"
          });
        }

        await saveDiscoverySession(body.projectId, body.session, body.fields);

        return sendJson(response, 200, { success: true });
      }

      if (
        request.method === "POST" &&
        url.pathname === "/api/discovery/extract"
      ) {
        const body = (await readJsonBody(request)) as {
          text?: string;
          session?: number;
        };

        if (!body.text || !body.session || !sessionFieldLabels[body.session]) {
          return sendJson(response, 400, {
            error: "Invalid extraction payload"
          });
        }

        const extraction = await extractDiscoveryFields(
          body.text,
          body.session
        );
        return sendJson(response, 200, extraction);
      }

      if (
        request.method === "POST" &&
        url.pathname === "/api/discovery/fetch-doc"
      ) {
        const body = (await readJsonBody(request)) as {
          url?: string;
          session?: number;
        };

        if (!body.url || !body.session || !sessionFieldLabels[body.session]) {
          return sendJson(response, 400, { error: "Invalid document payload" });
        }

        const docIdMatch = body.url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
        if (!docIdMatch) {
          return sendJson(response, 400, {
            error: "Invalid Google Doc URL"
          });
        }

        const exportUrl = `https://docs.google.com/document/d/${docIdMatch[1]}/export?format=txt`;
        const docResponse = await fetch(exportUrl);
        if (!docResponse.ok) {
          return sendJson(response, 400, {
            error:
              "Could not fetch document. Make sure it is set to public access."
          });
        }

        const docText = await docResponse.text();
        const extraction = await extractDiscoveryFields(docText, body.session);
        return sendJson(response, 200, extraction);
      }

      if (request.method === "POST" && url.pathname === "/api/clients") {
        const body = (await readJsonBody(request)) as {
          name: string;
          website?: string;
          industry?: string;
          region?: string;
        };

        try {
          const client = await prisma.client.create({
            data: {
              name: body.name,
              slug: createSlug(body.name),
              website: body.website ?? null,
              industry: body.industry ?? null,
              region: body.region ?? null
            }
          });

          return sendJson(response, 201, { client });
        } catch (error: unknown) {
          if (isUniqueConstraintError(error)) {
            return sendJson(response, 409, {
              error: "A client with that name already exists"
            });
          }

          throw error;
        }
      }

      if (request.method === "POST" && url.pathname === "/api/portals") {
        const body = (await readJsonBody(request)) as {
          portalId: string;
          displayName: string;
          region?: string;
        };

        try {
          const portal = await prisma.hubSpotPortal.create({
            data: {
              portalId: body.portalId,
              displayName: body.displayName,
              region: body.region ?? null
            }
          });

          return sendJson(response, 201, { portal });
        } catch (error: unknown) {
          if (isUniqueConstraintError(error)) {
            return sendJson(response, 409, {
              error: "A portal with that ID already exists"
            });
          }

          throw error;
        }
      }

      if (
        request.method === "POST" &&
        url.pathname === "/api/projects/from-template"
      ) {
        const payload = createProjectFromTemplateRequestSchema.parse(
          await readJsonBody(request)
        );
        const project = await createProjectFromTemplate(payload);
        return sendJson(response, 201, {
          project,
          summary: await summarizeProject(project)
        });
      }

      if (url.pathname === "/api/projects/validation-summary") {
        return sendJson(response, 200, {
          validations: await validateAllProjects()
        });
      }

      const projectModuleRoute = matchProjectModuleRoute(url.pathname);
      if (projectModuleRoute) {
        return sendJson(response, 200, {
          module: await loadProjectModuleDetail(
            projectModuleRoute.projectId,
            projectModuleRoute.moduleKey
          )
        });
      }

      const projectDesignRoute = matchProjectDesignRoute(url.pathname);
      if (projectDesignRoute) {
        if (request.method === "GET" && !projectDesignRoute.resource) {
          const design = await loadProjectDesignById(
            projectDesignRoute.projectId
          );
          return sendJson(response, 200, {
            design,
            validation: await validateProjectById(projectDesignRoute.projectId),
            readiness: await loadProjectReadinessById(
              projectDesignRoute.projectId
            )
          });
        }

        if (
          request.method === "PUT" &&
          projectDesignRoute.resource === "lifecycle"
        ) {
          const payload = updateProjectLifecycleDesignRequestSchema.parse(
            await readJsonBody(request)
          );
          const project = await updateProjectLifecycleDesign(
            projectDesignRoute.projectId,
            payload
          );
          return sendJson(response, 200, {
            project,
            design: await loadProjectDesignById(project.id),
            validation: await validateProjectById(project.id),
            readiness: await loadProjectReadinessById(project.id),
            summary: await summarizeProject(project)
          });
        }

        if (
          request.method === "PUT" &&
          projectDesignRoute.resource === "properties"
        ) {
          const payload = updateProjectPropertiesDesignRequestSchema.parse(
            await readJsonBody(request)
          );
          const project = await updateProjectPropertiesDesign(
            projectDesignRoute.projectId,
            payload
          );
          return sendJson(response, 200, {
            project,
            design: await loadProjectDesignById(project.id),
            validation: await validateProjectById(project.id),
            readiness: await loadProjectReadinessById(project.id),
            summary: await summarizeProject(project)
          });
        }

        if (
          request.method === "PUT" &&
          projectDesignRoute.resource === "pipelines"
        ) {
          const payload = updateProjectPipelinesDesignRequestSchema.parse(
            await readJsonBody(request)
          );
          const project = await updateProjectPipelinesDesign(
            projectDesignRoute.projectId,
            payload
          );
          return sendJson(response, 200, {
            project,
            design: await loadProjectDesignById(project.id),
            validation: await validateProjectById(project.id),
            readiness: await loadProjectReadinessById(project.id),
            summary: await summarizeProject(project)
          });
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      const executionRoute = matchExecutionRoute(url.pathname);
      if (executionRoute) {
        if (executionRoute.resource === "steps") {
          return sendJson(response, 200, {
            executionId: executionRoute.executionId,
            steps: await loadExecutionSteps(executionRoute.executionId)
          });
        }

        return sendJson(response, 200, {
          execution: await loadExecutionById(executionRoute.executionId)
        });
      }

      const projectRoute = matchProjectRoute(url.pathname);
      if (projectRoute) {
        if (request.method === "PATCH" && !projectRoute.resource) {
          const body = (await readJsonBody(request)) as {
            clientName?: unknown;
            type?: unknown;
            portalId?: unknown;
            owner?: unknown;
            ownerEmail?: unknown;
            hubs?: unknown;
            clientIndustry?: unknown;
            clientWebsite?: unknown;
            clientAdditionalWebsites?: unknown;
            clientLinkedinUrl?: unknown;
            clientFacebookUrl?: unknown;
            clientInstagramUrl?: unknown;
            clientXUrl?: unknown;
            clientYoutubeUrl?: unknown;
            clientChampionFirstName?: unknown;
            clientChampionLastName?: unknown;
            clientChampionEmail?: unknown;
          };

          const normalizedPayload: {
            clientName?: string;
            type?: EngagementType;
            portalId?: string;
            owner?: string;
            ownerEmail?: string;
            hubs?: ProjectHub[];
            clientIndustry?: string;
            clientWebsite?: string;
            clientAdditionalWebsites?: string[];
            clientLinkedinUrl?: string;
            clientFacebookUrl?: string;
            clientInstagramUrl?: string;
            clientXUrl?: string;
            clientYoutubeUrl?: string;
            clientChampionFirstName?: string;
            clientChampionLastName?: string;
            clientChampionEmail?: string;
          } = {};

          if (body.clientName !== undefined) {
            if (
              typeof body.clientName !== "string" ||
              body.clientName.trim().length === 0
            ) {
              return sendJson(response, 400, {
                error: "clientName must be a non-empty string"
              });
            }

            normalizedPayload.clientName = body.clientName.trim();
          }

          if (body.type !== undefined) {
            if (
              typeof body.type !== "string" ||
              !isValidEngagementType(body.type)
            ) {
              return sendJson(response, 400, {
                error: "Invalid engagement type"
              });
            }

            normalizedPayload.type = body.type;
          }

          if (body.portalId !== undefined) {
            if (typeof body.portalId !== "string") {
              return sendJson(response, 400, {
                error: "portalId must be a string"
              });
            }

            normalizedPayload.portalId = body.portalId.trim();
          }

          if (body.owner !== undefined) {
            if (typeof body.owner !== "string") {
              return sendJson(response, 400, {
                error: "owner must be a string"
              });
            }

            normalizedPayload.owner = body.owner.trim();
          }

          if (body.ownerEmail !== undefined) {
            if (typeof body.ownerEmail !== "string") {
              return sendJson(response, 400, {
                error: "ownerEmail must be a string"
              });
            }

            normalizedPayload.ownerEmail = body.ownerEmail.trim();
          }

          if (body.clientIndustry !== undefined) {
            if (typeof body.clientIndustry !== "string") {
              return sendJson(response, 400, {
                error: "clientIndustry must be a string"
              });
            }

            normalizedPayload.clientIndustry = body.clientIndustry.trim();
          }

          if (body.clientWebsite !== undefined) {
            if (typeof body.clientWebsite !== "string") {
              return sendJson(response, 400, {
                error: "clientWebsite must be a string"
              });
            }

            normalizedPayload.clientWebsite = body.clientWebsite.trim();
          }

          if (body.clientAdditionalWebsites !== undefined) {
            normalizedPayload.clientAdditionalWebsites = normalizeStringArray(
              body.clientAdditionalWebsites
            );
          }

          if (body.clientLinkedinUrl !== undefined) {
            if (typeof body.clientLinkedinUrl !== "string") {
              return sendJson(response, 400, {
                error: "clientLinkedinUrl must be a string"
              });
            }

            normalizedPayload.clientLinkedinUrl = body.clientLinkedinUrl.trim();
          }

          if (body.clientFacebookUrl !== undefined) {
            if (typeof body.clientFacebookUrl !== "string") {
              return sendJson(response, 400, {
                error: "clientFacebookUrl must be a string"
              });
            }

            normalizedPayload.clientFacebookUrl = body.clientFacebookUrl.trim();
          }

          if (body.clientInstagramUrl !== undefined) {
            if (typeof body.clientInstagramUrl !== "string") {
              return sendJson(response, 400, {
                error: "clientInstagramUrl must be a string"
              });
            }

            normalizedPayload.clientInstagramUrl =
              body.clientInstagramUrl.trim();
          }

          if (body.clientXUrl !== undefined) {
            if (typeof body.clientXUrl !== "string") {
              return sendJson(response, 400, {
                error: "clientXUrl must be a string"
              });
            }

            normalizedPayload.clientXUrl = body.clientXUrl.trim();
          }

          if (body.clientYoutubeUrl !== undefined) {
            if (typeof body.clientYoutubeUrl !== "string") {
              return sendJson(response, 400, {
                error: "clientYoutubeUrl must be a string"
              });
            }

            normalizedPayload.clientYoutubeUrl = body.clientYoutubeUrl.trim();
          }

          if (body.hubs !== undefined) {
            if (
              !Array.isArray(body.hubs) ||
              body.hubs.length === 0 ||
              body.hubs.some((hub) => typeof hub !== "string")
            ) {
              return sendJson(response, 400, {
                error: "hubs must be a non-empty array of hub keys"
              });
            }

            const normalizedHubs = Array.from(
              new Set(body.hubs.map((hub) => hub.trim().toLowerCase()))
            );

            if (normalizedHubs.some((hub) => !isValidProjectHub(hub))) {
              return sendJson(response, 400, {
                error: "Invalid hubs selection"
              });
            }

            normalizedPayload.hubs = normalizedHubs;
          }

          if (body.clientChampionFirstName !== undefined) {
            if (typeof body.clientChampionFirstName !== "string") {
              return sendJson(response, 400, {
                error: "clientChampionFirstName must be a string"
              });
            }

            normalizedPayload.clientChampionFirstName =
              body.clientChampionFirstName.trim();
          }

          if (body.clientChampionLastName !== undefined) {
            if (typeof body.clientChampionLastName !== "string") {
              return sendJson(response, 400, {
                error: "clientChampionLastName must be a string"
              });
            }

            normalizedPayload.clientChampionLastName =
              body.clientChampionLastName.trim();
          }

          if (body.clientChampionEmail !== undefined) {
            if (typeof body.clientChampionEmail !== "string") {
              return sendJson(response, 400, {
                error: "clientChampionEmail must be a string"
              });
            }

            normalizedPayload.clientChampionEmail =
              body.clientChampionEmail.trim();
          }

          if (
            normalizedPayload.clientName === undefined &&
            normalizedPayload.type === undefined &&
            normalizedPayload.portalId === undefined &&
            normalizedPayload.owner === undefined &&
            normalizedPayload.ownerEmail === undefined &&
            normalizedPayload.hubs === undefined &&
            normalizedPayload.clientIndustry === undefined &&
            normalizedPayload.clientWebsite === undefined &&
            normalizedPayload.clientAdditionalWebsites === undefined &&
            normalizedPayload.clientLinkedinUrl === undefined &&
            normalizedPayload.clientFacebookUrl === undefined &&
            normalizedPayload.clientInstagramUrl === undefined &&
            normalizedPayload.clientXUrl === undefined &&
            normalizedPayload.clientYoutubeUrl === undefined &&
            normalizedPayload.clientChampionFirstName === undefined &&
            normalizedPayload.clientChampionLastName === undefined &&
            normalizedPayload.clientChampionEmail === undefined
          ) {
            return sendJson(response, 400, {
              error: "At least one editable field is required"
            });
          }

          const existingProject = await prisma.project.findUnique({
            where: { id: projectRoute.projectId },
            include: { client: true, portal: true }
          });

          if (!existingProject) {
            return sendJson(response, 404, { error: "Project not found" });
          }

          const nextClientName =
            normalizedPayload.clientName ?? existingProject.client.name;
          const nextOwnerDetails =
            normalizedPayload.owner !== undefined ||
            normalizedPayload.ownerEmail !== undefined
              ? resolveProjectOwner(
                  normalizedPayload.owner ?? existingProject.owner,
                  normalizedPayload.ownerEmail ?? existingProject.ownerEmail
                )
              : null;

          const project = await prisma.$transaction(async (transaction) => {
            let nextClientId = existingProject.clientId;
            let nextPortalId = existingProject.portalId;

            if (normalizedPayload.clientName) {
              const clientSlug = createSlug(normalizedPayload.clientName);
              const client = await transaction.client.upsert({
                where: { slug: clientSlug },
                update: { name: normalizedPayload.clientName },
                create: {
                  name: normalizedPayload.clientName,
                  slug: clientSlug
                }
              });

              nextClientId = client.id;
            }

            if (
              normalizedPayload.clientIndustry !== undefined ||
              normalizedPayload.clientWebsite !== undefined ||
              normalizedPayload.clientAdditionalWebsites !== undefined ||
              normalizedPayload.clientLinkedinUrl !== undefined ||
              normalizedPayload.clientFacebookUrl !== undefined ||
              normalizedPayload.clientInstagramUrl !== undefined ||
              normalizedPayload.clientXUrl !== undefined ||
              normalizedPayload.clientYoutubeUrl !== undefined
            ) {
              await transaction.client.update({
                where: { id: nextClientId },
                data: {
                  ...(normalizedPayload.clientIndustry !== undefined
                    ? {
                        industry: normalizedPayload.clientIndustry || null
                      }
                    : {}),
                  ...(normalizedPayload.clientWebsite !== undefined
                    ? {
                        website: normalizedPayload.clientWebsite || null
                      }
                    : {}),
                  ...(normalizedPayload.clientAdditionalWebsites !== undefined
                    ? {
                        additionalWebsites:
                          normalizedPayload.clientAdditionalWebsites
                      }
                    : {}),
                  ...(normalizedPayload.clientLinkedinUrl !== undefined
                    ? {
                        linkedinUrl:
                          normalizedPayload.clientLinkedinUrl || null
                      }
                    : {}),
                  ...(normalizedPayload.clientFacebookUrl !== undefined
                    ? {
                        facebookUrl:
                          normalizedPayload.clientFacebookUrl || null
                      }
                    : {}),
                  ...(normalizedPayload.clientInstagramUrl !== undefined
                    ? {
                        instagramUrl:
                          normalizedPayload.clientInstagramUrl || null
                      }
                    : {}),
                  ...(normalizedPayload.clientXUrl !== undefined
                    ? {
                        xUrl: normalizedPayload.clientXUrl || null
                      }
                    : {}),
                  ...(normalizedPayload.clientYoutubeUrl !== undefined
                    ? {
                        youtubeUrl:
                          normalizedPayload.clientYoutubeUrl || null
                      }
                    : {})
                }
              });
            }

            if (normalizedPayload.portalId !== undefined) {
              const portal = normalizedPayload.portalId
                ? await transaction.hubSpotPortal.upsert({
                    where: { portalId: normalizedPayload.portalId },
                    update: {},
                    create: {
                      portalId: normalizedPayload.portalId,
                      displayName: nextClientName
                    }
                  })
                : await transaction.hubSpotPortal.create({
                    data: {
                      portalId: createPendingPortalId(),
                      displayName: nextClientName
                    }
                  });

              nextPortalId = portal.id;
            }

            const updatedProject = await transaction.project.update({
              where: { id: projectRoute.projectId },
              data: {
                ...(normalizedPayload.type
                  ? {
                      engagementType:
                        normalizedPayload.type as Prisma.$Enums.EngagementType
                    }
                  : {}),
                ...(normalizedPayload.hubs
                  ? { selectedHubs: normalizedPayload.hubs }
                  : {}),
                ...(nextOwnerDetails ? nextOwnerDetails : {}),
                ...(nextClientId !== existingProject.clientId
                  ? { clientId: nextClientId }
                  : {}),
                ...(nextPortalId !== existingProject.portalId
                  ? { portalId: nextPortalId }
                  : {}),
                ...(normalizedPayload.clientChampionFirstName !== undefined
                  ? {
                      clientChampionFirstName:
                        normalizedPayload.clientChampionFirstName || null
                    }
                  : {}),
                ...(normalizedPayload.clientChampionLastName !== undefined
                  ? {
                      clientChampionLastName:
                        normalizedPayload.clientChampionLastName || null
                    }
                  : {}),
                ...(normalizedPayload.clientChampionEmail !== undefined
                  ? {
                      clientChampionEmail:
                        normalizedPayload.clientChampionEmail || null
                    }
                  : {})
              },
              include: { client: true, portal: true, discovery: true }
            });

            if (nextClientId !== existingProject.clientId) {
              const remainingClientProjects = await transaction.project.count({
                where: { clientId: existingProject.clientId }
              });

              if (remainingClientProjects === 0) {
                await transaction.client.delete({
                  where: { id: existingProject.clientId }
                });
              }
            }

            if (nextPortalId !== existingProject.portalId) {
              const remainingPortalProjects = await transaction.project.count({
                where: { portalId: existingProject.portalId }
              });

              if (remainingPortalProjects === 0) {
                await transaction.hubSpotPortal.delete({
                  where: { id: existingProject.portalId }
                });
              }
            }

            return updatedProject;
          });

          return sendJson(response, 200, {
            project: serializeProject(project)
          });
        }

        if (request.method === "PATCH" && projectRoute.resource === "status") {
          const body = (await readJsonBody(request)) as { status?: string };
          const allowedStatuses = ["active", "complete", "archived", "draft"];

          if (!body.status || !allowedStatuses.includes(body.status)) {
            return sendJson(response, 400, { error: "Invalid status" });
          }

          try {
            const project = await prisma.project.update({
              where: { id: projectRoute.projectId },
              data: { status: body.status },
              include: { client: true, portal: true, discovery: true }
            });

            return sendJson(response, 200, {
              project: serializeProject(project)
            });
          } catch (error: unknown) {
            if (
              typeof error === "object" &&
              error !== null &&
              "code" in error &&
              error.code === "P2025"
            ) {
              return sendJson(response, 404, { error: "Project not found" });
            }

            throw error;
          }
        }

        if (request.method === "DELETE" && !projectRoute.resource) {
          const existingProject = await prisma.project.findUnique({
            where: { id: projectRoute.projectId },
            select: { id: true, portalId: true }
          });

          if (!existingProject) {
            return sendJson(response, 404, { error: "Project not found" });
          }

          await prisma.executionJob.deleteMany({
            where: { projectId: projectRoute.projectId }
          });
          await prisma.task.deleteMany({
            where: { projectId: projectRoute.projectId }
          });
          await prisma.blueprintTask.deleteMany({
            where: { blueprint: { projectId: projectRoute.projectId } }
          });
          await prisma.blueprint.deleteMany({
            where: { projectId: projectRoute.projectId }
          });
          await prisma.discoverySubmission.deleteMany({
            where: { projectId: projectRoute.projectId }
          });
          await prisma.project.delete({
            where: { id: projectRoute.projectId }
          });

          const remainingProjects = await prisma.project.count({
            where: { portalId: existingProject.portalId }
          });

          if (remainingProjects === 0) {
            await prisma.hubSpotPortal.delete({
              where: { id: existingProject.portalId }
            });
          }

          return sendJson(response, 200, { success: true });
        }

        if (request.method === "PUT" && !projectRoute.resource) {
          const payload = updateProjectMetadataRequestSchema.parse(
            await readJsonBody(request)
          );
          const project = await updateProjectMetadata(
            projectRoute.projectId,
            payload
          );
          return sendJson(response, 200, {
            project,
            summary: await summarizeProject(project)
          });
        }

        if (request.method === "PUT" && projectRoute.resource === "scope") {
          const payload = updateProjectScopeRequestSchema.parse(
            await readJsonBody(request)
          );
          const project = await updateProjectScope(
            projectRoute.projectId,
            payload
          );
          return sendJson(response, 200, {
            project,
            summary: await summarizeProject(project)
          });
        }

        if (projectRoute.resource === "discovery") {
          if (request.method === "GET") {
            return sendJson(response, 200, {
              projectId: projectRoute.projectId,
              discovery: await loadProjectDiscoveryById(projectRoute.projectId)
            });
          }

          if (request.method === "PUT") {
            const payload = updateProjectDiscoverySectionRequestSchema.parse(
              await readJsonBody(request)
            );
            const project = await updateProjectDiscoverySection(
              projectRoute.projectId,
              payload
            );

            return sendJson(response, 200, {
              project,
              discovery: await loadProjectDiscoveryById(project.id),
              summary: await summarizeProject(project)
            });
          }
        }

        if (request.method !== "GET") {
          return sendJson(response, 405, { error: "Method Not Allowed" });
        }

        if (projectRoute.resource === "modules") {
          const project = await loadProjectById(projectRoute.projectId);
          return sendJson(response, 200, {
            projectId: project.id,
            modules: summarizeProjectModules(project)
          });
        }

        if (projectRoute.resource === "summary") {
          return sendJson(response, 200, {
            summary: await loadProjectSummaryById(projectRoute.projectId)
          });
        }

        if (projectRoute.resource === "validation") {
          return sendJson(response, 200, {
            validation: await validateProjectById(projectRoute.projectId)
          });
        }

        if (projectRoute.resource === "readiness") {
          return sendJson(response, 200, {
            readiness: await loadProjectReadinessById(projectRoute.projectId)
          });
        }

        if (projectRoute.resource === "executions") {
          return sendJson(response, 200, {
            executions: await loadProjectExecutions(projectRoute.projectId)
          });
        }

        const project = await prisma.project.findUnique({
          where: { id: projectRoute.projectId },
          include: { client: true, portal: true, discovery: true }
        });
        if (!project) {
          return sendJson(response, 404, { error: "Project not found" });
        }
        return sendJson(response, 200, {
          project: serializeProject(project)
        });
      }

      if (url.pathname.startsWith("/api/")) {
        return sendJson(response, 404, { error: "Not Found" });
      }

      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("Not Found");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unexpected server error";
      const statusCode =
        error instanceof ZodError
          ? 400
          : (error instanceof Error &&
                "code" in error &&
                error.code === "ENOENT") ||
              message.includes("was not found")
            ? 404
            : 500;
      sendJson(response, statusCode, { error: message });
    }
  });
}
