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
    "agreed_next_steps"
  ]
};

type EngagementType = (typeof validEngagementTypes)[number];
type ProjectHub = (typeof validProjectHubValues)[number];
type DiscoverySessionFields = Record<string, string>;
type DiscoverySessionStatus = "draft" | "in_progress" | "complete";

const sessionTitles: Record<number, string> = {
  1: "Business & Goals",
  2: "Current State",
  3: "Future State Design",
  4: "Scope & Handover"
};
const blueprintTaskTypeValues = ["Agent", "Human", "Client"] as const;
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

function isValidEngagementType(value: string): value is EngagementType {
  return validEngagementTypes.includes(value as EngagementType);
}

function isValidProjectHub(value: string): value is ProjectHub {
  return validProjectHubValues.includes(value as ProjectHub);
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

function buildDiscoverySessionsWithStatus(
  submissions: Array<{ version: number; status: string; sections: unknown }>
) {
  return [1, 2, 3, 4].map((sessionNumber) => {
    const submission = submissions.find(
      (candidate) => candidate.version === sessionNumber
    );
    const fields = normalizeDiscoveryFields(submission?.sections);

    return {
      session: sessionNumber,
      title: sessionTitles[sessionNumber] ?? `Session ${sessionNumber}`,
      status:
        submission?.status === "complete" ||
        submission?.status === "in_progress" ||
        submission?.status === "draft"
          ? submission.status
          : getDiscoverySessionStatus(fields),
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

async function callClaude(system: string, user: string): Promise<string> {
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
      max_tokens: 2000,
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
        website: project.client.website
      },
      portal: project.portal
        ? {
            portalId: project.portal.portalId,
            displayName: project.portal.displayName,
            region: project.portal.region,
            connected: project.portal.connected
          }
        : null,
      sessions
    }
  };
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

  const rawBlueprint = await callClaude(
    `You are a HubSpot implementation planning assistant for Muloo, a technical HubSpot delivery company.
Given structured discovery data from a client project, generate a phased implementation blueprint.
Rules:

Return ONLY valid JSON. No explanation, no markdown, no preamble.
Organise tasks into 3–5 phases (Foundation, Pipeline & Process, Automation, Reporting, Handover — adjust based on scope).
Each task must have: name, type (Agent/Human/Client), effortHours (realistic estimate), order (within phase).
Agent = automated by DeplyOS tooling. Human = Muloo consultant time. Client = client must action.
Human task hours must be realistic for a senior HubSpot consultant.
Base the blueprint on the hubs enabled, use cases, goals, and complexity indicated in the discovery data.`,
    JSON.stringify(discoveryPayload.discovery, null, 2)
  );

  const parsedBlueprint = blueprintGenerationSchema.parse(
    JSON.parse(rawBlueprint) as unknown
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
            update: {},
            create: { name: body.clientName, slug }
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
              owner: body.owner ?? "Jarrud",
              ownerEmail: body.ownerEmail ?? "jarrud@muloo.com",
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
        const submissions = await prisma.discoverySubmission.findMany({
          where: { projectId: discoveryRoute.projectId },
          orderBy: { version: "asc" },
          select: { version: true, status: true, sections: true }
        });

        return sendJson(response, 200, {
          sessions: buildDiscoverySessions(
            submissions.map((submission) => ({
              version: submission.version,
              sections: submission.sections
            }))
          ),
          sessionDetails: buildDiscoverySessionsWithStatus(submissions)
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
            hubs?: unknown;
          };

          const normalizedPayload: {
            clientName?: string;
            type?: EngagementType;
            portalId?: string;
            hubs?: ProjectHub[];
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

          if (
            normalizedPayload.clientName === undefined &&
            normalizedPayload.type === undefined &&
            normalizedPayload.portalId === undefined &&
            normalizedPayload.hubs === undefined
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
                ...(nextClientId !== existingProject.clientId
                  ? { clientId: nextClientId }
                  : {}),
                ...(nextPortalId !== existingProject.portalId
                  ? { portalId: nextPortalId }
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

      return sendJson(response, 404, { error: "Not Found" });
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
