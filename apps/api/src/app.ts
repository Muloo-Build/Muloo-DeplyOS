import type * as http from "node:http";
import { createAdaptorServer, type HttpBindings } from "@hono/node-server";
import { type BaseConfig, getIntegrationStatus } from "@muloo/config";
import {
  createProjectFromTemplate,
  loadAllExecutionRecords,
  loadExecutionById,
  loadExecutionSteps,
  loadAllTemplates,
  loadProjectById,
  loadProjectDiscoveryById,
  loadProjectDesignById,
  loadProjectExecutions,
  loadProjectModuleDetail,
  loadProjectReadinessById,
  loadProjectSummaryById,
  loadTemplateById,
  summarizeProject,
  summarizeProjectModules,
  updateProjectDiscoverySection,
  updateProjectLifecycleDesign,
  updateProjectMetadata,
  updateProjectPipelinesDesign,
  updateProjectPropertiesDesign,
  updateProjectScope,
  validateAllProjects,
  validateProjectById
} from "@muloo/file-system";
import {
  createProjectFromTemplateRequestSchema,
  DEFAULT_WORKSPACE_ID,
  moduleCatalog,
  updateProjectDiscoverySectionRequestSchema,
  updateProjectLifecycleDesignRequestSchema,
  updateProjectMetadataRequestSchema,
  updateProjectPipelinesDesignRequestSchema,
  updateProjectPropertiesDesignRequestSchema,
  updateProjectScopeRequestSchema
} from "@muloo/shared";
import { type Context, Hono, type Next } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { z, ZodError } from "zod";
import { prisma } from "./prisma";
import { executionQueue } from "./queue/index";
import { startWorker } from "./queue/worker";
import {
  clientAuthCookieName,
  createAgentDefinition,
  createClientContact,
  createClientDirectoryRecord,
  createClientInviteLink,
  createClientPortalUserForProject,
  createClientResetLink,
  createDeliveryTemplate,
  createProjectRecord,
  createProjectFinding,
  createProjectRecommendation,
  createProductCatalogItem,
  createPortalSnapshotForPortal,
  createWorkRequest,
  createWorkspaceUser,
  createClientAuthToken,
  createCookieHeader,
  createWorkspaceUserAuthToken,
  createWorkspaceGoogleLoginStart,
  createWorkspaceGoogleEmailOAuthStart,
  createWorkspaceCalendarOAuthStart,
  createWorkspaceTodo,
  createWorkspaceTodoFromEmail,
  createWorkspaceXeroOAuthStart,
  createSimpleAuthToken,
  clearCompletedWorkspaceTodos,
  completeWorkspaceCalendarOAuthCallback,
  completeWorkspaceGoogleLoginCallback,
  completeWorkspaceGoogleEmailOAuthCallback,
  completeWorkspaceXeroOAuthCallback,
  completeHubSpotOAuthCallback,
  createWorkspacePrivateTask,
  createDiscoveryEvidence,
  disconnectWorkspaceGoogleEmailOAuthConnection,
  disconnectWorkspaceCalendarConnection,
  disconnectWorkspaceXeroConnection,
  ensureProjectScopeUnlocked,
  executeHubSpotAgentAction,
  extractDiscoveryFields,
  getAuthenticatedClientUserId,
  generateProjectEmailDraft,
  generateWorkspaceEmailDraft,
  generateProjectAgenda,
  generateSimplifiedProjectEmailDraft,
  generateSolutionOptions,
  industryOptions,
  isAuthenticated,
  isUniqueConstraintError,
  loadAuthenticatedWorkspaceSession,
  loadAgentRuns,
  loadAgentCatalog,
  loadAiRouting,
  loadClientMemory,
  loadDeliveryTemplates,
  loadHubSpotPortals,
  loadInboxSummary,
  loadInternalInbox,
  loadClientsDirectory,
  loadProductCatalog,
  loadProviderConnections,
  loadWorkRequests,
  loadWorkspaceEmailOAuthConnection,
  loadWorkspaceCalendarConnection,
  loadWorkspaceEmailSettings,
  loadWorkspacePrivateTasks,
  loadWorkspaceTodos,
  loadWorkspaceUsers,
  markAllProjectMessagesSeenByInternal,
  createHubSpotOAuthStart,
  buildHubSpotAgentCapabilitiesPayload,
  inviteClientContactToProjects,
  resolveInternalActor,
  resolveHubSpotAgentConnection,
  resolveSimpleAuthCredentials,
  serializeWorkspaceUser,
  serializeClientPortalUser,
  convertWorkRequestToProject,
  appendApprovedChangeRequestToDelivery,
  updateAgentDefinition,
  updateWorkspaceTodo,
  updateWorkspaceAiRouting,
  approveProjectQuote,
  createProjectMessage,
  updateClientContact,
  updateClientDirectoryRecord,
  updateDeliveryTemplate,
  deleteProjectContext,
  deleteWorkspaceApiKey,
  deleteWorkspacePrivateTask,
  updateWorkspaceEmailOAuthConnection,
  updateWorkspaceCalendarConnection,
  updateWorkspacePrivateTask,
  updateWorkspaceEmailSettings,
  updateProductCatalogItem,
  updateWorkspaceProviderConnection,
  deleteClientDirectoryRecord,
  loadClientInbox,
  loadClientInboxSummary,
  loadClientProjectDetail,
  loadClientProjectsForUser,
  loadClientQuoteDocument,
  loadClientUsersForProject,
  loadPortalAssistantProjectContext,
  loadPartnerUsersForProject,
  loadDiscoveryEvidence,
  loadDiscoverySessionsPayload,
  loadDiscoverySummary,
  loadDiscoverySummaryWithRetry,
  loadBlueprint,
  loadProjectRecord,
  loadProjectContext,
  loadProjectFindings,
  loadProjectRecommendations,
  loadProjectExecutionJobStatus,
  loadProjectTaskBoard,
  loadProjectsDirectory,
  loadProjectTasks,
  loadTaskApproval,
  loadWorkspaceApiKeys,
  loadWorkflowRuns,
  loadLatestPortalSnapshot,
  loadProjectChangeRequests,
  refreshClientEnrichment,
  loadProjectMessages,
  markProjectMessagesSeenByInternal,
  markProjectMessagesSeenByClient,
  requestTaskApproval,
  approveTaskApproval,
  rejectTaskApproval,
  resetDiscoverySummary,
  resolvePortalBasePathForClientUser,
  saveClientInputSubmission,
  saveDiscoverySession,
  serializePortalTask,
  serializeTask,
  deleteProjectRecord,
  deleteProjectFinding,
  deleteProjectTaskRecord,
  createProjectTask,
  executeProjectTask,
  generateDiscoverySummary,
  generateBlueprintForProject,
  generateProjectTaskPlan,
  loadProjectTaskTemplates,
  queueAgentRun,
  audit,
  hashPassword,
  runTrackedHubSpotAgentRequest,
  runTrackedProjectPortalAudit,
  runTrackedProjectPrepareBrief,
  startProjectPortalAuditExecutionJob,
  sendWorkspaceEmail,
  shareProjectQuote,
  updateProjectRecord,
  updateProjectRecordStatus,
  updateProjectFinding,
  updateProjectRecommendation,
  updateAgentRun,
  updateClientProjectAccess,
  updateProjectTaskRecord,
  transitionProjectTaskStatus,
  updateWorkRequest,
  updateWorkspaceUser,
  ensureProjectPlanGenerationAllowed,
  deleteWorkspaceTodo,
  generateWorkspaceDailySummary,
  getActiveProjects,
  getWorkspaceCalendarStatus,
  getWorkspaceClientEmailQueues,
  getWorkspaceIndustrySignals,
  getWorkspaceXeroStatus,
  getCalendarEvents,
  getGmailActionRequired,
  getLatestWorkspaceDailySummary,
  getQuotesPipeline,
  getWorkspaceAiRouting,
  getWorkspaceXeroInvoices,
  saveWorkspaceAiRouting,
  saveWorkspaceApiKey,
  saveProjectContext,
  verifyPassword
} from "./server";

type HonoBindings = {
  Bindings: HttpBindings;
  Variables: {
    clientUserId: string;
  };
};

async function readJsonBodyOrEmpty(context: {
  req: {
    json: () => Promise<unknown>;
  };
}) {
  try {
    return await context.req.json();
  } catch {
    return {};
  }
}

function normalizeWorkspaceLoginIdentifier(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const activeProjectStatuses = new Set([
  "draft",
  "scoping",
  "designed",
  "ready-for-execution",
  "in-flight"
]);

const taskAttentionStatuses = [
  "blocked",
  "waiting_on_client",
  "waiting_on_partner"
] as const;

function getProjectStatusMatch(
  project: {
    status: string;
    quoteApprovalStatus?: string | null;
    scopeLockedAt?: string | null;
    updatedAt: string | Date;
    id: string;
  },
  waitingOnExternalProjectIds: Set<string>,
  requestedStatus: string | null
) {
  if (!requestedStatus) {
    return true;
  }

  switch (requestedStatus) {
    case "live":
      return project.status !== "archived";
    case "in_delivery":
      return project.status === "in-flight";
    case "active":
      return activeProjectStatuses.has(project.status);
    case "awaiting_approval":
      return project.quoteApprovalStatus === "shared";
    case "blocked_external":
      return waitingOnExternalProjectIds.has(project.id);
    case "awaiting_client":
      return (
        waitingOnExternalProjectIds.has(project.id) ||
        project.quoteApprovalStatus === "shared"
      );
    case "blueprint_approved_no_delivery":
      return (
        (project.quoteApprovalStatus === "approved" || Boolean(project.scopeLockedAt)) &&
        project.status !== "in-flight" &&
        project.status !== "completed" &&
        project.status !== "archived"
      );
    default:
      return project.status === requestedStatus;
  }
}

function getRelativeAgeLabel(timestamp: string | Date) {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffHours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));

  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d`;
  }

  return `${Math.floor(diffDays / 7)}w`;
}

function getExecutionStatusMatch(
  status: string,
  requestedStatus: string | null
) {
  if (!requestedStatus || requestedStatus === "all") {
    return true;
  }

  if (requestedStatus === "complete") {
    return status === "completed" || status === "complete";
  }

  if (requestedStatus === "running") {
    return status === "running" || status === "in_progress";
  }

  if (requestedStatus === "failed") {
    return status === "failed";
  }

  return status === requestedStatus;
}

function getRateLimitKey(c: Context<HonoBindings>) {
  return c.req.header("x-forwarded-for") ?? "unknown";
}

const authLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

const clientLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const clientSetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8)
});

const taskStatusSchema = z.object({
  status: z.string().min(1)
});

const taskApprovalSchema = z.object({
  notes: z.string().trim().optional()
});

const taskRejectSchema = z.object({
  notes: z.string().trim().min(1)
});

const taskExecuteSchema = z.object({
  dryRun: z.boolean().optional(),
  sessionId: z.string().trim().optional()
});

const projectTaskTemplateLoadSchema = z.object({
  templateIds: z.array(z.string().min(1)).min(1)
});

const portalPrivateAppTokenSchema = z.object({
  privateAppToken: z.string().min(1)
});

const marketingDashboardSchema = z.object({
  portalId: z.string().min(1),
  projectId: z.string().min(1),
  dashboardName: z.string().trim().optional(),
  sessionId: z.string().trim().optional(),
  primaryLeadSourceProperty: z.string().trim().optional(),
  lastKeyActionProperty: z.string().trim().optional(),
  sectionsToInclude: z.array(z.string().min(1)).optional(),
  dryRun: z.boolean().optional()
});

const researchRequestSchema = z.object({
  query: z.string().min(1),
  context: z.string().optional(),
  projectId: z.string().min(1)
});

const coworkStartSchema = z.object({
  output: z.string().optional()
});

const coworkCompleteSchema = z.object({
  success: z.boolean(),
  output: z.string().min(1),
  screenshots: z.array(z.string().url()).optional()
});

const assistantChatSchema = z.object({
  message: z.string().trim().min(1),
  pathname: z.string().trim().optional(),
  pageLabel: z.string().trim().optional(),
  project: z
    .object({
      id: z.string().trim().min(1),
      name: z.string().trim().min(1),
      status: z.string().trim().optional(),
      clientName: z.string().trim().optional(),
      portalId: z.string().trim().optional().nullable()
    })
    .optional()
});

const portalAssistantChatSchema = z.object({
  message: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
  pathname: z.string().trim().optional(),
  pageLabel: z.string().trim().optional()
});

type AssistantAction = {
  type:
    | "run_portal_audit"
    | "queue_dashboard_build"
    | "generate_email_draft"
    | "navigate";
  label: string;
  description?: string;
  path?: string;
};

function inferAssistantActions(input: {
  message: string;
  pathname?: string;
  project?: {
    id: string;
    name: string;
    status?: string;
    clientName?: string;
    portalId?: string | null;
  };
}) {
  const message = input.message.toLowerCase();
  const actions: AssistantAction[] = [];

  if (
    input.project &&
    (message.includes("audit") ||
      message.includes("portal health") ||
      message.includes("hubspot audit"))
  ) {
    actions.push({
      type: "run_portal_audit",
      label: "Run portal audit"
    });
  }

  if (
    input.project?.portalId &&
    (message.includes("dashboard") || message.includes("report"))
  ) {
    actions.push({
      type: "queue_dashboard_build",
      label: "Plan dashboard build"
    });
  }

  if (
    input.project &&
    (message.includes("email") ||
      message.includes("draft reply") ||
      message.includes("client update"))
  ) {
    actions.push({
      type: "generate_email_draft",
      label: "Generate email draft"
    });
  }

  if (
    message.includes("portal ops") ||
    message.includes("private app token")
  ) {
    actions.push({
      type: "navigate",
      label: "Open Portal Ops",
      path: "/projects/portal-ops"
    });
  }

  if (
    message.includes("runs") ||
    message.includes("jobs") ||
    message.includes("queue")
  ) {
    actions.push({
      type: "navigate",
      label: "Open Runs",
      path: "/runs"
    });
  }

  return actions;
}

async function loadAssistantWorkspaceContext() {
  try {
    const [projects, clients, tasks] = await Promise.all([
      prisma.project.findMany({
        where: { status: { in: ["draft", "scoping", "designed", "ready-for-execution", "in-flight"] } },
        select: { id: true, name: true, status: true, updatedAt: true, client: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 20
      }),
      prisma.client.findMany({
        select: { id: true, name: true, industry: true },
        orderBy: { updatedAt: "desc" },
        take: 15
      }),
      prisma.task.findMany({
        where: { status: { notIn: ["done", "cancelled"] } },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          assigneeType: true,
          project: { select: { id: true, name: true, client: { select: { name: true } } } }
        },
        orderBy: { updatedAt: "desc" },
        take: 30
      })
    ]);

    const tasksByStatus = tasks.reduce<Record<string, number>>((acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      activeProjectCount: projects.length,
      activeProjects: projects.map(p => ({
        id: p.id,
        name: p.name,
        status: p.status,
        client: p.client?.name ?? "Unknown",
        updatedAt: p.updatedAt.toISOString().split("T")[0]
      })),
      clientCount: clients.length,
      recentClients: clients.map(c => ({ id: c.id, name: c.name, industry: c.industry })),
      openTaskCount: tasks.length,
      tasksByStatus,
      agentTaskCount: tasks.filter(t => t.assigneeType?.toLowerCase() === "agent").length,
      blockedTaskCount: tasks.filter(t => t.status === "blocked").length
    };
  } catch {
    return null;
  }
}

async function generateAssistantAnswer(input: {
  message: string;
  pathname?: string;
  pageLabel?: string;
  project?: {
    id: string;
    name: string;
    status?: string;
    clientName?: string;
    portalId?: string | null;
  };
  actions: AssistantAction[];
  workspaceContext?: Awaited<ReturnType<typeof loadAssistantWorkspaceContext>>;
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const fallbackContext = input.project
    ? `You’re on ${input.pageLabel ?? "a project page"} for ${input.project.name} (${input.project.clientName ?? "unknown client"}), currently ${input.project.status ?? "in progress"}.`
    : `You’re on ${input.pageLabel ?? "the workspace"} (${input.pathname ?? "/"}).`;

  if (!apiKey) {
    const actionHint =
      input.actions.length > 0
        ? ` I’ve suggested ${input.actions
            .map((action) => action.label.toLowerCase())
            .join(", ")} below.`
        : "";

    return `${fallbackContext} I can help explain the current context and steer you to the right workspace action.${actionHint}`;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system: [
        "You are the embedded AI assistant for Muloo Deploy OS — an internal platform for running HubSpot implementation and delivery operations.",
        "You have full admin visibility across all clients, projects, tasks, and jobs in the workspace.",
        "Answer concisely and directly. Reference real data from the workspace context when it is relevant to the question.",
        "Do not reveal to clients that AI agents or automation deliver any work — this is for internal use only.",
        "If suggested actions are listed, the UI will render them as buttons — focus on guidance, not repeating the action names.",
        input.workspaceContext
          ? `\nLive workspace data (as of now):\n${JSON.stringify(input.workspaceContext, null, 2)}`
          : ""
      ].join(" "),
      messages: [
        {
          role: "user",
          content: `Current page: ${input.pageLabel ?? "Workspace"}\nPath: ${input.pathname ?? "/"}\nProject context: ${JSON.stringify(
            input.project ?? null,
            null,
            2
          )}\nSuggested actions: ${JSON.stringify(input.actions, null, 2)}\n\nUser question: ${input.message}`
        }
      ]
    })
  });

  const body = (await response.json().catch(() => null)) as
    | { content?: Array<{ text?: string }>; error?: { message?: string } }
    | null;

  if (!response.ok || !body?.content?.[0]?.text?.trim()) {
    return fallbackContext;
  }

  return body.content[0].text.trim();
}

async function generatePortalAssistantAnswer(input: {
  message: string;
  pathname?: string;
  pageLabel?: string;
  portalContext: Awaited<ReturnType<typeof loadPortalAssistantProjectContext>>;
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const summary = input.portalContext?.project.portalSummary;
  const fallback = [
    summary?.summary,
    summary ? `Current phase: ${summary.currentPhaseLabel}.` : null,
    summary?.nextSteps?.length
      ? `Next steps: ${summary.nextSteps
          .map((step) => step.title)
          .join("; ")}.`
      : null
  ]
    .filter(Boolean)
    .join(" ");

  if (!apiKey) {
    return (
      fallback ||
      "I can help explain the parts of this project that are visible in your portal."
    );
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 700,
      system: [
        "You are the project assistant inside the Muloo client and partner portal.",
        "You may only answer using the project context provided in this request.",
        "Never reveal internal-only notes, private implementation details, other clients, workspace-wide data, task execution internals, or hidden operational processes.",
        "Do not mention AI agents, automation mechanics, or internal delivery tooling unless that information is explicitly visible in the supplied portal context.",
        "If the user asks for information outside what is visible in this portal, say that you can only help with what is available in this project view and suggest using Messages to ask Muloo for clarification.",
        "Answer clearly, directly, and in plain client-friendly language."
      ].join(" "),
      messages: [
        {
          role: "user",
          content: `Current page: ${input.pageLabel ?? "Project portal"}\nPath: ${
            input.pathname ?? "/client/projects"
          }\nVisible portal context:\n${JSON.stringify(
            input.portalContext,
            null,
            2
          )}\n\nUser question: ${input.message}`
        }
      ]
    })
  });

  const body = (await response.json().catch(() => null)) as
    | { content?: Array<{ text?: string }>; error?: { message?: string } }
    | null;

  if (!response.ok || !body?.content?.[0]?.text?.trim()) {
    return fallback;
  }

  return body.content[0].text.trim();
}

const portalPreviewTokens = new Map<
  string,
  { clientUserId: string; projectId: string; expiresAt: number }
>();

export function createApiApp(config: BaseConfig) {
  const app = new Hono<HonoBindings>();
  const authLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    keyGenerator: getRateLimitKey
  });
  const apiLimiter = rateLimiter({
    windowMs: 60 * 1000,
    limit: 200,
    keyGenerator: getRateLimitKey
  });
  const internalAuth = async (c: Context<HonoBindings>, next: Next) => {
    if (!(await isAuthenticated(c.env.incoming))) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    await next();
  };
  const clientAuth = async (c: Context<HonoBindings>, next: Next) => {
    const clientUserId = getAuthenticatedClientUserId(c.env.incoming);

    if (!clientUserId) {
      return c.json({ error: "Client unauthorized" }, 401);
    }

    c.set("clientUserId", clientUserId);
    await next();
  };

  app.onError((error, c) => {
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

    return c.json({ error: message }, statusCode);
  });

  app.use("/api/*", apiLimiter);
  app.use("/api/auth/*", authLimiter);
  app.use("/api/client-auth/*", authLimiter);

  app.use("/api/modules", internalAuth);
  app.use("/api/settings", internalAuth);
  app.use("/api/industries", internalAuth);
  app.use("/api/templates", internalAuth);
  app.use("/api/templates/*", internalAuth);
  app.use("/api/projects/validation-summary", internalAuth);
  app.use("/api/inbox", internalAuth);
  app.use("/api/inbox/*", internalAuth);
  app.use("/api/runs", internalAuth);
  app.use("/api/runs/*", internalAuth);
  app.use("/api/executions", internalAuth);
  app.use("/api/executions/*", internalAuth);
  app.use("/api/users", internalAuth);
  app.use("/api/users/*", internalAuth);
  app.use("/api/provider-connections", internalAuth);
  app.use("/api/provider-connections/*", internalAuth);
  app.use("/api/ai-routing", internalAuth);
  app.use("/api/ai-routing/*", internalAuth);
  app.use("/api/products", internalAuth);
  app.use("/api/products/*", internalAuth);
  app.use("/api/assistant", internalAuth);
  app.use("/api/assistant/*", internalAuth);
  app.use("/api/agents", internalAuth);
  app.use("/api/agents/*", internalAuth);
  app.use("/api/delivery-templates", internalAuth);
  app.use("/api/delivery-templates/*", internalAuth);
  app.use("/api/work-requests", internalAuth);
  app.use("/api/work-requests/*", internalAuth);
  app.use("/api/discovery", internalAuth);
  app.use("/api/discovery/*", internalAuth);
  app.use("/api/projects", internalAuth);
  app.use("/api/projects/*", internalAuth);
  app.use("/api/solution-options", internalAuth);
  app.use("/api/hubspot", internalAuth);
  app.use("/api/hubspot/*", internalAuth);
  app.use("/api/portals", internalAuth);
  app.use("/api/portals/*", internalAuth);
  app.use("/api/clients", internalAuth);
  app.use("/api/clients/*", internalAuth);
  app.use("/api/email-settings", internalAuth);
  app.use("/api/email-oauth/google", internalAuth);
  app.use("/api/email-oauth/google/*", internalAuth);
  app.use("/api/workspace", internalAuth);
  app.use("/api/workspace/*", internalAuth);
  app.use("/api/client", clientAuth);
  app.use("/api/client/*", clientAuth);

  app.all("/api/auth/session", async (c) =>
    c.json(await loadAuthenticatedWorkspaceSession(c.env.incoming))
  );

  app.post("/api/auth/login", async (c) => {
    const parsed = authLoginSchema.safeParse(await readJsonBodyOrEmpty(c));

    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const body = parsed.data;
    const loginIdentifier = body.username.trim();
    const credentials = resolveSimpleAuthCredentials();
    const matchesSimpleAuthUsername =
      Boolean(credentials) &&
      loginIdentifier.toLowerCase() ===
        (credentials?.username.toLowerCase() ?? "");

    if (
      credentials &&
      matchesSimpleAuthUsername &&
      body.password === credentials.password
    ) {
      c.header(
        "Set-Cookie",
        createCookieHeader(createSimpleAuthToken(credentials.username), {
          maxAge: 60 * 60 * 12
        })
      );

      await audit(
        credentials.username,
        "auth.login",
        "WorkspaceSession",
        credentials.username
      );

      return c.json({ authenticated: true });
    }

    const normalizedIdentifier =
      normalizeWorkspaceLoginIdentifier(loginIdentifier);
    const workspaceUsers = await loadWorkspaceUsers().catch(() => []);
    const matchingWorkspaceUser = workspaceUsers.find((user) => {
      const normalizedName = normalizeWorkspaceLoginIdentifier(user.name);
      const normalizedEmail = user.email.trim().toLowerCase();
      const normalizedEmailLocalPart = normalizedEmail.split("@")[0] ?? "";

      return (
        user.isActive &&
        (normalizedEmail === loginIdentifier.toLowerCase() ||
          normalizedEmailLocalPart === normalizedIdentifier ||
          normalizedName === normalizedIdentifier)
      );
    });

    if (
      !matchingWorkspaceUser ||
      !(await verifyPassword(body.password, matchingWorkspaceUser.password))
    ) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    c.header(
      "Set-Cookie",
      createCookieHeader(
        createWorkspaceUserAuthToken(matchingWorkspaceUser.id),
        {
          maxAge: 60 * 60 * 12
        }
      )
    );

    await audit(
      matchingWorkspaceUser.email,
      "auth.login",
      "WorkspaceUser",
      matchingWorkspaceUser.id
    );

    return c.json({ authenticated: true });
  });

  app.post("/api/auth/logout", async (c) => {
    const actor = await resolveInternalActor(c.env.incoming);
    c.header(
      "Set-Cookie",
      createCookieHeader("", {
        maxAge: 0
      })
    );

    await audit(
      actor.actor,
      "auth.logout",
      "WorkspaceSession",
      actor.userId ?? actor.actor
    );

    return c.json({ authenticated: false });
  });

  app.get("/api/auth/google/start", async (c) => {
    try {
      const { authUrl } = await createWorkspaceGoogleLoginStart();
      return c.redirect(authUrl);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to start Google sign-in";
      return c.redirect(`/login?error=${encodeURIComponent(message)}`);
    }
  });

  app.get("/api/auth/google/callback", async (c) => {
    try {
      const result = await completeWorkspaceGoogleLoginCallback({
        code: c.req.query("code"),
        state: c.req.query("state")
      });

      c.header(
        "Set-Cookie",
        createCookieHeader(createWorkspaceUserAuthToken(result.workspaceUser.id), {
          maxAge: 60 * 60 * 12
        })
      );

      await audit(
        result.workspaceUser.email,
        "auth.login",
        "WorkspaceUser",
        result.workspaceUser.id,
        {
          metadata: {
            provider: "google"
          }
        }
      );

      return c.redirect("/");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to complete Google sign-in";
      return c.redirect(`/login?error=${encodeURIComponent(message)}`);
    }
  });

  app.all("/api/client-auth/session", async (c) => {
    const clientUserId = getAuthenticatedClientUserId(c.env.incoming);

    if (!clientUserId) {
      return c.json({ authenticated: false });
    }

    const user = await prisma.clientPortalUser.findUnique({
      where: { id: clientUserId }
    });

    return c.json({
      authenticated: Boolean(user),
      user: user ? serializeClientPortalUser(user) : null
    });
  });

  app.post("/api/client-auth/login", async (c) => {
    const parsed = clientLoginSchema.safeParse(await readJsonBodyOrEmpty(c));

    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const email = parsed.data.email.trim().toLowerCase();
    const password = parsed.data.password;

    const user = email
      ? await prisma.clientPortalUser.findUnique({
          where: { email }
        })
      : null;

    if (!user || !(await verifyPassword(password, user.password))) {
      return c.json({ error: "Invalid client credentials" }, 401);
    }

    c.header(
      "Set-Cookie",
      createCookieHeader(createClientAuthToken(user.id), {
        name: clientAuthCookieName,
        maxAge: 60 * 60 * 24 * 14
      })
    );

    await audit(user.email, "auth.login", "ClientPortalUser", user.id);

    return c.json({
      authenticated: true,
      user: serializeClientPortalUser(user)
    });
  });

  app.post("/api/client-auth/set-password", async (c) => {
    const parsed = clientSetPasswordSchema.safeParse(
      await readJsonBodyOrEmpty(c)
    );

    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const token = parsed.data.token.trim();
    const password = parsed.data.password.trim();

    const now = new Date();
    const user =
      (await prisma.clientPortalUser.findFirst({
        where: {
          OR: [
            {
              inviteToken: token,
              inviteTokenExpiresAt: {
                gt: now
              }
            },
            {
              passwordResetToken: token,
              passwordResetTokenExpiresAt: {
                gt: now
              }
            }
          ]
        }
      })) ?? null;

    if (!user) {
      return c.json(
        {
          error: "This access link is invalid or has expired"
        },
        400
      );
    }

    const updatedUser = await prisma.clientPortalUser.update({
      where: { id: user.id },
      data: {
        password: await hashPassword(password),
        inviteToken: null,
        inviteTokenExpiresAt: null,
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
        inviteAcceptedAt: user.inviteAcceptedAt ?? now
      }
    });

    c.header(
      "Set-Cookie",
      createCookieHeader(createClientAuthToken(updatedUser.id), {
        name: clientAuthCookieName,
        maxAge: 60 * 60 * 24 * 14
      })
    );

    await audit(
      updatedUser.email,
      "auth.password_set",
      "ClientPortalUser",
      updatedUser.id
    );

    return c.json({
      authenticated: true,
      user: serializeClientPortalUser(updatedUser)
    });
  });

  app.post("/api/client-auth/logout", async (c) => {
    const clientUserId = getAuthenticatedClientUserId(c.env.incoming);
    c.header(
      "Set-Cookie",
      createCookieHeader("", {
        name: clientAuthCookieName,
        maxAge: 0
      })
    );

    if (clientUserId) {
      const user = await prisma.clientPortalUser.findUnique({
        where: { id: clientUserId },
        select: { id: true, email: true }
      });

      if (user) {
        await audit(user.email, "auth.logout", "ClientPortalUser", user.id);
      }
    }

    return c.json({ authenticated: false });
  });

  app.get("/api/client-auth/preview", async (c) => {
    const token = c.req.query("token");

    if (!token) {
      return c.text("Missing preview token", 400);
    }

    const record = portalPreviewTokens.get(token);

    if (!record || record.expiresAt < Date.now()) {
      portalPreviewTokens.delete(token);
      return c.text("Preview link expired or invalid", 400);
    }

    portalPreviewTokens.delete(token);

    c.header(
      "Set-Cookie",
      createCookieHeader(createClientAuthToken(record.clientUserId), {
        name: clientAuthCookieName,
        maxAge: 60 * 60
      })
    );

    const portalBasePath = await resolvePortalBasePathForClientUser(
      record.clientUserId
    );

    return c.redirect(`${portalBasePath}/projects/${record.projectId}`, 302);
  });

  app.all("/api/health", async (c) => {
    await prisma.$queryRaw`SELECT 1`;

    return c.json({
      status: "ok",
      service: "muloo-deploy-os-api",
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      database: "connected",
      executionMode: config.executionMode,
      applyEnabled: config.applyEnabled,
      moduleCount: moduleCatalog.length
    });
  });

  app.all("/api/modules", (c) => {
    return c.json({
      modules: moduleCatalog
    });
  });

  app.all("/api/settings", (c) => {
    return c.json({
      environment: config.nodeEnv,
      appBaseUrl: config.appBaseUrl,
      artifactDir: config.artifactDir,
      executionMode: config.executionMode,
      applyEnabled: config.applyEnabled,
      integrationStatus: getIntegrationStatus(config)
    });
  });

  app.post("/api/assistant/chat", async (c) => {
    const parsed = assistantChatSchema.safeParse(await readJsonBodyOrEmpty(c));

    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    try {
      const assistantProjectContext = parsed.data.project
        ? {
            id: parsed.data.project.id,
            name: parsed.data.project.name,
            ...(parsed.data.project.status
              ? { status: parsed.data.project.status }
              : {}),
            ...(parsed.data.project.clientName
              ? { clientName: parsed.data.project.clientName }
              : {}),
            ...(parsed.data.project.portalId !== undefined
              ? { portalId: parsed.data.project.portalId }
              : {})
          }
        : undefined;
      const [actions, workspaceContext] = await Promise.all([
        Promise.resolve(inferAssistantActions({
          message: parsed.data.message,
          ...(parsed.data.pathname ? { pathname: parsed.data.pathname } : {}),
          ...(assistantProjectContext ? { project: assistantProjectContext } : {})
        })),
        loadAssistantWorkspaceContext()
      ]);
      const answer = await generateAssistantAnswer({
        message: parsed.data.message,
        ...(parsed.data.pathname ? { pathname: parsed.data.pathname } : {}),
        ...(parsed.data.pageLabel ? { pageLabel: parsed.data.pageLabel } : {}),
        ...(assistantProjectContext ? { project: assistantProjectContext } : {}),
        actions,
        workspaceContext
      });

      return c.json({
        answer,
        actions
      });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to generate assistant response"
        },
        500
      );
    }
  });

  app.post("/api/client/assistant/chat", async (c) => {
    const parsed = portalAssistantChatSchema.safeParse(
      await readJsonBodyOrEmpty(c)
    );

    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const portalContext = await loadPortalAssistantProjectContext(
      parsed.data.projectId,
      c.get("clientUserId")
    );

    if (!portalContext) {
      return c.json({ error: "Project not found" }, 404);
    }

    try {
      const answer = await generatePortalAssistantAnswer({
        message: parsed.data.message,
        ...(parsed.data.pathname
          ? { pathname: parsed.data.pathname }
          : {}),
        ...(parsed.data.pageLabel
          ? { pageLabel: parsed.data.pageLabel }
          : {}),
        portalContext
      });

      return c.json({ answer });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to generate portal assistant response"
        },
        500
      );
    }
  });

  app.all("/api/industries", (c) => {
    return c.json({
      industries: industryOptions
    });
  });

  app.get("/api/templates", async (c) =>
    c.json({
      templates: await loadAllTemplates()
    })
  );

  app.get("/api/templates/:templateId", async (c) =>
    c.json({
      template: await loadTemplateById(c.req.param("templateId"))
    })
  );

  app.get("/api/projects/validation-summary", async (c) =>
    c.json({
      validations: await validateAllProjects()
    })
  );

  app.get("/api/inbox", async (c) => {
    await markAllProjectMessagesSeenByInternal();
    return c.json(await loadInternalInbox());
  });

  app.get("/api/inbox/summary", async (c) =>
    c.json({
      summary: await loadInboxSummary()
    })
  );

  app.get("/api/runs", async (c) =>
    c.json({
      runs: await loadAllExecutionRecords(),
      agentRuns: await loadAgentRuns(),
      workflowRuns: await loadWorkflowRuns({ limit: 40 })
    })
  );

  app.get("/api/execution-jobs", async (c) => {
    const status = c.req.query("status")?.trim() || null;
    const countOnly = c.req.query("count") === "true";
    const limit = Number.parseInt(c.req.query("limit") ?? "20", 10);
    const portalId = c.req.query("portalId")?.trim() || null;

    const [agentRuns, workflowRuns] = await Promise.all([
      portalId ? Promise.resolve([]) : loadAgentRuns(),
      loadWorkflowRuns({
        ...(portalId ? { portalId } : {}),
        limit: Number.isFinite(limit) ? Math.max(limit * 3, 20) : 40
      })
    ]);

    const mergedRuns = [
      ...workflowRuns.map((run) => ({
        ...run,
        type: "workflow" as const,
        name: run.title,
        projectName: run.projectName ?? run.clientName ?? run.portalDisplayName,
        executionTierLabel: "Workflow",
        coworkInstruction: null
      })),
      ...agentRuns.map((run) => ({
        ...run,
        type: "agent" as const,
        name:
          run.taskTitle ??
          (run.payload &&
          typeof run.payload === "object" &&
          !Array.isArray(run.payload) &&
          "agentName" in run.payload &&
          typeof run.payload.agentName === "string"
            ? run.payload.agentName
            : null) ??
          run.projectName ??
          "Agent run",
        executionTierLabel: run.executionMethod,
        coworkInstruction: null
      }))
    ]
      .filter((run) => getExecutionStatusMatch(run.status, status))
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      );

    if (countOnly) {
      return c.json({ count: mergedRuns.length });
    }

    return c.json({
      runs: mergedRuns.slice(0, Number.isFinite(limit) ? limit : 20)
    });
  });

  app.get("/api/tasks", async (c) => {
    const countOnly = c.req.query("count") === "true";
    const overdue = c.req.query("overdue") === "true";

    const where = overdue
      ? { status: { in: [...taskAttentionStatuses] } }
      : null;

    if (countOnly) {
      // TODO: Replace this with true due-date based overdue logic once tasks carry deadlines.
      const count = where
        ? await prisma.task.count({ where })
        : await prisma.task.count();
      return c.json({ count });
    }

    const tasks = await prisma.task.findMany({
      ...(where ? { where } : {}),
      orderBy: [{ updatedAt: "desc" }],
      take: 20,
      include: {
        project: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return c.json({
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        updatedAt: task.updatedAt.toISOString(),
        projectId: task.projectId,
        projectName: task.project.name
      }))
    });
  });

  app.get("/api/projects/needs-attention", async (c) => {
    const projects = await loadProjectsDirectory();
    const waitingTasks = await prisma.task.findMany({
      where: { status: { in: ["waiting_on_client", "waiting_on_partner"] } },
      select: { projectId: true }
    });

    const waitingOnExternalProjectIds = new Set(
      waitingTasks.map((task) => task.projectId)
    );

    const needsAttention = projects
      .map((project) => {
        const projectAgeMs = Date.now() - new Date(project.updatedAt).getTime();
        const ageDays = projectAgeMs / (1000 * 60 * 60 * 24);
        const isApprovedWithoutDelivery =
          (project.quoteApprovalStatus === "approved" ||
            Boolean(project.scopeLockedAt)) &&
          project.status !== "in-flight" &&
          project.status !== "completed" &&
          project.status !== "archived";

        if (ageDays >= 10 && activeProjectStatuses.has(project.status)) {
          return {
            id: project.id,
            projectId: project.id,
            projectName: project.name,
            clientName: project.clientName,
            href: project.defaultWorkspacePath ?? `/projects/${project.id}`,
            reason: "Project has been inactive for more than 10 days",
            reasonKey: "overdue",
            age: getRelativeAgeLabel(project.updatedAt),
            status: project.status,
            urgencyScore: 3
          };
        }

        if (
          waitingOnExternalProjectIds.has(project.id) ||
          project.quoteApprovalStatus === "shared"
        ) {
          return {
            id: project.id,
            projectId: project.id,
            projectName: project.name,
            clientName: project.clientName,
            href: project.defaultWorkspacePath ?? `/projects/${project.id}`,
            reason: waitingOnExternalProjectIds.has(project.id)
              ? "Waiting on external delivery dependency"
              : "Quote shared and awaiting client response",
            reasonKey: "awaiting_client",
            age: getRelativeAgeLabel(project.updatedAt),
            status: project.status,
            urgencyScore: 2
          };
        }

        if (isApprovedWithoutDelivery) {
          return {
            id: project.id,
            projectId: project.id,
            projectName: project.name,
            clientName: project.clientName,
            href: project.defaultWorkspacePath ?? `/projects/${project.id}`,
            reason: "Approved and ready to move into delivery",
            reasonKey: "blueprint_approved_no_delivery",
            age: getRelativeAgeLabel(project.updatedAt),
            status: project.status,
            urgencyScore: 1
          };
        }

        return null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((left, right) => right.urgencyScore - left.urgencyScore)
      .slice(0, 5);

    return c.json({ items: needsAttention });
  });

  app.all("/api/projects", async (c) => {
    if (c.req.method === "GET") {
      const requestedStatus = c.req.query("status")?.trim() || null;
      const countOnly = c.req.query("count") === "true";
      const limit = Number.parseInt(c.req.query("limit") ?? "", 10);
      const projects = await loadProjectsDirectory();
      const waitingTasks = await prisma.task.findMany({
        where: { status: { in: ["waiting_on_client", "waiting_on_partner"] } },
        select: { projectId: true }
      });
      const waitingOnExternalProjectIds = new Set(
        waitingTasks.map((task) => task.projectId)
      );
      const filteredProjects = projects.filter((project) =>
        getProjectStatusMatch(project, waitingOnExternalProjectIds, requestedStatus)
      );

      if (countOnly) {
        return c.json({ count: filteredProjects.length });
      }

      return c.json({
        projects:
          Number.isFinite(limit) && limit > 0
            ? filteredProjects.slice(0, limit)
            : filteredProjects
      });
    }

    if (c.req.method === "POST") {
      try {
        const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
        const project = await createProjectRecord(body);
        return c.json({ project }, 201);
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to create project"
          },
          400
        );
      }
    }

    return c.json({ error: "Method Not Allowed" }, 405);
  });

  app.post("/api/projects/from-template", async (c) => {
    const payload = createProjectFromTemplateRequestSchema.parse(
      await readJsonBodyOrEmpty(c)
    );
    const project = await createProjectFromTemplate(payload);
    return c.json(
      {
        project,
        summary: await summarizeProject(project)
      },
      201
    );
  });

  app.all("/api/projects/:projectId", async (c) => {
    if (c.req.method === "GET") {
      try {
        return c.json({
          project: await loadProjectRecord(c.req.param("projectId"))
        });
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error ? error.message : "Failed to load project"
          },
          error instanceof Error && error.message === "Project not found"
            ? 404
            : 400
        );
      }
    }

    if (c.req.method === "PUT") {
      const payload = updateProjectMetadataRequestSchema.parse(
        await readJsonBodyOrEmpty(c)
      );
      const project = await updateProjectMetadata(
        c.req.param("projectId"),
        payload
      );
      return c.json({
        project,
        summary: await summarizeProject(project)
      });
    }

    if (c.req.method === "PATCH") {
      try {
        const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
        const project = await updateProjectRecord(
          c.req.param("projectId"),
          body
        );
        return c.json({ project });
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to update project"
          },
          error instanceof Error && error.message === "Project not found"
            ? 404
            : error instanceof Error &&
                error.message ===
                  "Approved scope is locked. Use change management to revise this project."
              ? 409
              : 400
        );
      }
    }

    if (c.req.method === "DELETE") {
      try {
        await deleteProjectRecord(c.req.param("projectId"));
        return c.json({ success: true });
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to delete project"
          },
          error instanceof Error && error.message === "Project not found"
            ? 404
            : 400
        );
      }
    }

    return c.json({ error: "Method Not Allowed" }, 405);
  });

  app.get("/api/projects/:projectId/workflow-runs", async (c) =>
    c.json({
      workflowRuns: await loadWorkflowRuns({
        projectId: c.req.param("projectId"),
        limit: 12
      })
    })
  );

  app.patch("/api/projects/:projectId/status", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as { status?: unknown };
      const project = await updateProjectRecordStatus(
        c.req.param("projectId"),
        body.status
      );

      return c.json({ project });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to update project"
        },
        error instanceof Error && error.message === "Project not found"
          ? 404
          : 400
      );
    }
  });

  app.get("/api/projects/:projectId/modules", async (c) => {
    const project = await loadProjectById(c.req.param("projectId"));
    return c.json({
      projectId: project.id,
      modules: summarizeProjectModules(project)
    });
  });

  app.get("/api/projects/:projectId/modules/:moduleKey", async (c) =>
    c.json({
      module: await loadProjectModuleDetail(
        c.req.param("projectId"),
        c.req.param("moduleKey")
      )
    })
  );

  app.get("/api/projects/:projectId/summary", async (c) =>
    c.json({
      summary: await loadProjectSummaryById(c.req.param("projectId"))
    })
  );

  app.get("/api/projects/:projectId/validation", async (c) =>
    c.json({
      validation: await validateProjectById(c.req.param("projectId"))
    })
  );

  app.get("/api/projects/:projectId/readiness", async (c) =>
    c.json({
      readiness: await loadProjectReadinessById(c.req.param("projectId"))
    })
  );

  app.get("/api/projects/:projectId/executions", async (c) =>
    c.json({
      executions: await loadProjectExecutions(c.req.param("projectId"))
    })
  );

  app.post("/api/projects/:projectId/client-portal-preview-token", async (c) => {
    const projectId = c.req.param("projectId");

    const access = await prisma.clientProjectAccess.findFirst({
      where: { projectId },
      include: { user: { select: { id: true } } },
      orderBy: { createdAt: "asc" }
    });

    if (!access) {
      return c.json({ error: "No client users have been invited to this project yet. Invite a client user from the Portal tab first." }, 400);
    }

    for (const [tok, rec] of portalPreviewTokens) {
      if (rec.expiresAt < Date.now()) {
        portalPreviewTokens.delete(tok);
      }
    }

    const token = crypto.randomUUID();
    portalPreviewTokens.set(token, {
      clientUserId: access.user.id,
      projectId,
      expiresAt: Date.now() + 60 * 60 * 1000
    });

    return c.json({ token, previewUrl: `/api/client-auth/preview?token=${token}` });
  });

  app.post("/api/projects/:projectId/partner-portal-preview-token", async (c) => {
    const projectId = c.req.param("projectId");

    const allAccess = await prisma.clientProjectAccess.findMany({
      where: { projectId },
      include: { user: { select: { id: true, email: true } } },
      orderBy: { createdAt: "asc" }
    });

    if (allAccess.length === 0) {
      return c.json({ error: "No portal users have been invited to this project yet." }, 400);
    }

    let partnerAccess: (typeof allAccess)[number] | null = null;

    for (const access of allAccess) {
      const email = access.user.email?.toLowerCase();
      if (!email) continue;

      const partnerClient = await prisma.client.findFirst({
        where: {
          clientRoles: { has: "partner" },
          contacts: { some: { email: { equals: email, mode: "insensitive" } } }
        },
        select: { id: true }
      });

      if (partnerClient) {
        partnerAccess = access;
        break;
      }
    }

    if (!partnerAccess) {
      return c.json({ error: "No partner users have been invited to this project yet. Invite a partner user from the Portal tab first." }, 400);
    }

    for (const [tok, rec] of portalPreviewTokens) {
      if (rec.expiresAt < Date.now()) {
        portalPreviewTokens.delete(tok);
      }
    }

    const token = crypto.randomUUID();
    portalPreviewTokens.set(token, {
      clientUserId: partnerAccess.user.id,
      projectId,
      expiresAt: Date.now() + 60 * 60 * 1000
    });

    return c.json({ token, previewUrl: `/api/client-auth/preview?token=${token}` });
  });

  app.all("/api/projects/:projectId/design", async (c) => {
    if (c.req.method !== "GET") {
      return c.json({ error: "Method Not Allowed" }, 405);
    }

    const projectId = c.req.param("projectId");

    return c.json({
      design: await loadProjectDesignById(projectId),
      validation: await validateProjectById(projectId),
      readiness: await loadProjectReadinessById(projectId)
    });
  });

  app.put("/api/projects/:projectId/design/lifecycle", async (c) => {
    const payload = updateProjectLifecycleDesignRequestSchema.parse(
      await readJsonBodyOrEmpty(c)
    );
    const project = await updateProjectLifecycleDesign(
      c.req.param("projectId"),
      payload
    );

    return c.json({
      project,
      design: await loadProjectDesignById(project.id),
      validation: await validateProjectById(project.id),
      readiness: await loadProjectReadinessById(project.id),
      summary: await summarizeProject(project)
    });
  });

  app.put("/api/projects/:projectId/design/properties", async (c) => {
    const payload = updateProjectPropertiesDesignRequestSchema.parse(
      await readJsonBodyOrEmpty(c)
    );
    const project = await updateProjectPropertiesDesign(
      c.req.param("projectId"),
      payload
    );

    return c.json({
      project,
      design: await loadProjectDesignById(project.id),
      validation: await validateProjectById(project.id),
      readiness: await loadProjectReadinessById(project.id),
      summary: await summarizeProject(project)
    });
  });

  app.put("/api/projects/:projectId/design/pipelines", async (c) => {
    const payload = updateProjectPipelinesDesignRequestSchema.parse(
      await readJsonBodyOrEmpty(c)
    );
    const project = await updateProjectPipelinesDesign(
      c.req.param("projectId"),
      payload
    );

    return c.json({
      project,
      design: await loadProjectDesignById(project.id),
      validation: await validateProjectById(project.id),
      readiness: await loadProjectReadinessById(project.id),
      summary: await summarizeProject(project)
    });
  });

  app.all("/api/projects/:projectId/discovery", async (c) => {
    if (c.req.method === "GET") {
      return c.json({
        projectId: c.req.param("projectId"),
        discovery: await loadProjectDiscoveryById(c.req.param("projectId"))
      });
    }

    if (c.req.method === "PUT") {
      const payload = updateProjectDiscoverySectionRequestSchema.parse(
        await readJsonBodyOrEmpty(c)
      );
      const project = await updateProjectDiscoverySection(
        c.req.param("projectId"),
        payload
      );

      return c.json({
        project,
        discovery: await loadProjectDiscoveryById(project.id),
        summary: await summarizeProject(project)
      });
    }

    return c.json({ error: "Method Not Allowed" }, 405);
  });

  app.get("/api/discovery/:projectId/sessions", async (c) =>
    c.json(await loadDiscoverySessionsPayload(c.req.param("projectId")))
  );

  app.patch("/api/projects/:projectId/sessions/:sessionId", async (c) => {
    const sessionId = Number(c.req.param("sessionId"));

    if (![1, 2, 3, 4].includes(sessionId)) {
      return c.json({ error: "Not Found" }, 404);
    }

    try {
      await ensureProjectScopeUnlocked(c.req.param("projectId"));
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to save session"
        },
        error instanceof Error && error.message === "Project not found"
          ? 404
          : 409
      );
    }

    const body = (await readJsonBodyOrEmpty(c)) as { fields?: unknown };
    const sessionDetail = await saveDiscoverySession(
      c.req.param("projectId"),
      sessionId,
      body.fields ?? body
    );

    return c.json({ sessionDetail });
  });

  app.all(
    "/api/projects/:projectId/sessions/:sessionId/evidence",
    async (c) => {
      const sessionId = Number(c.req.param("sessionId"));

      if (![0, 1, 2, 3, 4].includes(sessionId)) {
        return c.json({ error: "Not Found" }, 404);
      }

      if (c.req.method === "GET") {
        const project = await prisma.project.findUnique({
          where: { id: c.req.param("projectId") },
          select: { id: true }
        });

        if (!project) {
          return c.json({ error: "Project not found" }, 404);
        }

        return c.json({
          evidenceItems: await loadDiscoveryEvidence(
            c.req.param("projectId"),
            sessionId
          )
        });
      }

      if (c.req.method === "POST") {
        try {
          await ensureProjectScopeUnlocked(c.req.param("projectId"));
        } catch (error) {
          return c.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to add evidence item"
            },
            error instanceof Error && error.message === "Project not found"
              ? 404
              : 409
          );
        }

        try {
          const body = (await readJsonBodyOrEmpty(c)) as {
            evidenceType?: unknown;
            sourceLabel?: unknown;
            sourceUrl?: unknown;
            content?: unknown;
          };
          const evidenceItem = await createDiscoveryEvidence(
            c.req.param("projectId"),
            sessionId,
            body
          );

          return c.json({ evidenceItem }, 201);
        } catch (error) {
          if (error instanceof Error) {
            return c.json({ error: error.message }, 400);
          }

          throw error;
        }
      }

      return c.json({ error: "Method Not Allowed" }, 405);
    }
  );

  app.all("/api/projects/:projectId/discovery-summary", async (c) => {
    if (c.req.method === "GET") {
      const project = await prisma.project.findUnique({
        where: { id: c.req.param("projectId") },
        select: { id: true }
      });

      if (!project) {
        return c.json({ error: "Project not found" }, 404);
      }

      return c.json({
        summary: await loadDiscoverySummary(c.req.param("projectId"))
      });
    }

    if (c.req.method === "POST") {
      let scopeUnlocked = false;

      try {
        await ensureProjectScopeUnlocked(c.req.param("projectId"));
        scopeUnlocked = true;
        const summary = await generateDiscoverySummary(
          c.req.param("projectId")
        );
        return c.json({ summary });
      } catch (error) {
        if (scopeUnlocked) {
          const recoveredSummary = await loadDiscoverySummaryWithRetry(
            c.req.param("projectId")
          ).catch(() => null);

          if (recoveredSummary) {
            return c.json({
              summary: recoveredSummary,
              recovered: true
            });
          }
        }

        if (error instanceof Error && error.message === "Project not found") {
          return c.json({ error: error.message }, 404);
        }

        if (
          error instanceof Error &&
          error.message ===
            "Approved scope is locked. Use change management to revise this project."
        ) {
          return c.json({ error: error.message }, 409);
        }

        if (error instanceof ZodError) {
          return c.json(
            {
              error: "Discovery summary returned invalid JSON",
              details: error.flatten()
            },
            502
          );
        }

        if (error instanceof SyntaxError) {
          return c.json(
            {
              error: "Discovery summary returned invalid JSON"
            },
            502
          );
        }

        if (error instanceof Error) {
          return c.json({ error: error.message }, 500);
        }

        throw error;
      }
    }

    if (c.req.method === "DELETE") {
      try {
        await ensureProjectScopeUnlocked(c.req.param("projectId"));
        await resetDiscoverySummary(c.req.param("projectId"));
        return c.json({ summary: null });
      } catch (error) {
        if (error instanceof Error) {
          return c.json(
            { error: error.message },
            error.message === "Project not found"
              ? 404
              : error.message ===
                  "Approved scope is locked. Use change management to revise this project."
                ? 409
                : 500
          );
        }

        throw error;
      }
    }

    return c.json({ error: "Method Not Allowed" }, 405);
  });

  app.post("/api/discovery/save", async (c) => {
    const body = (await readJsonBodyOrEmpty(c)) as {
      projectId?: string;
      session?: number;
      fields?: Record<string, unknown>;
    };

    if (
      !body.projectId ||
      !body.session ||
      ![1, 2, 3, 4].includes(body.session) ||
      !body.fields ||
      typeof body.fields !== "object" ||
      Array.isArray(body.fields)
    ) {
      return c.json({ error: "Invalid discovery payload" }, 400);
    }

    await saveDiscoverySession(body.projectId, body.session, body.fields);

    return c.json({ success: true });
  });

  app.post("/api/discovery/extract", async (c) => {
    const body = (await readJsonBodyOrEmpty(c)) as {
      text?: string;
      session?: number;
    };

    if (!body.text || !body.session || ![1, 2, 3, 4].includes(body.session)) {
      return c.json({ error: "Invalid extraction payload" }, 400);
    }

    return c.json(await extractDiscoveryFields(body.text, body.session));
  });

  app.post("/api/discovery/fetch-doc", async (c) => {
    const body = (await readJsonBodyOrEmpty(c)) as {
      url?: string;
      session?: number;
    };

    if (!body.url || !body.session || ![1, 2, 3, 4].includes(body.session)) {
      return c.json({ error: "Invalid document payload" }, 400);
    }

    const docIdMatch = body.url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);

    if (!docIdMatch) {
      return c.json({ error: "Invalid Google Doc URL" }, 400);
    }

    const exportUrl = `https://docs.google.com/document/d/${docIdMatch[1]}/export?format=txt`;
    const docResponse = await fetch(exportUrl);

    if (!docResponse.ok) {
      return c.json(
        {
          error:
            "Could not fetch document. Make sure it is set to public access."
        },
        400
      );
    }

    const docText = await docResponse.text();
    return c.json(await extractDiscoveryFields(docText, body.session));
  });

  app.patch("/api/runs/:runId", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      const run = await updateAgentRun(c.req.param("runId"), body);
      return c.json({ run });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to update agent run"
        },
        400
      );
    }
  });

  app.post(
    "/api/projects/:projectId/tasks/:taskId/queue-agent-run",
    async (c) => {
      try {
        const run = await queueAgentRun(
          c.req.param("projectId"),
          c.req.param("taskId")
        );
        return c.json({ run }, 201);
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to queue agent run"
          },
          400
        );
      }
    }
  );

  app.all("/api/projects/:projectId/blueprint", async (c) => {
    if (c.req.method === "GET") {
      const blueprint = await loadBlueprint(c.req.param("projectId"));

      if (!blueprint) {
        return c.json({ error: "Blueprint not found" }, 404);
      }

      return c.json({ blueprint });
    }

    return c.json({ error: "Method Not Allowed" }, 405);
  });

  app.post("/api/projects/:projectId/blueprint/generate", async (c) => {
    try {
      await ensureProjectScopeUnlocked(c.req.param("projectId"));
      const blueprint = await generateBlueprintForProject(
        c.req.param("projectId")
      );
      return c.json({ blueprint });
    } catch (error) {
      if (error instanceof Error && error.message === "Project not found") {
        return c.json({ error: error.message }, 404);
      }

      if (
        error instanceof Error &&
        error.message.includes("must be complete before generating")
      ) {
        return c.json({ error: error.message }, 400);
      }

      if (error instanceof ZodError) {
        return c.json(
          {
            error: "Blueprint generation returned invalid JSON",
            details: error.flatten()
          },
          502
        );
      }

      if (error instanceof SyntaxError) {
        return c.json(
          {
            error: "Blueprint generation returned invalid JSON"
          },
          502
        );
      }

      throw error;
    }
  });

  app.all("/api/projects/:projectId/tasks", async (c) => {
    if (c.req.method === "GET") {
      return c.json({
        tasks: await loadProjectTasks(c.req.param("projectId"))
      });
    }

    if (c.req.method === "POST") {
      try {
        await ensureProjectScopeUnlocked(
          c.req.param("projectId"),
          "Approved scope is locked. Use change management to add more project steps."
        );
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error ? error.message : "Failed to create task"
          },
          error instanceof Error && error.message === "Project not found"
            ? 404
            : 409
        );
      }

      try {
        const body = (await readJsonBodyOrEmpty(c)) as {
          title?: unknown;
          description?: unknown;
          category?: unknown;
          executionType?: unknown;
          executionLaneRationale?: unknown;
          hubspotTierRequired?: unknown;
          coworkBrief?: unknown;
          manualInstructions?: unknown;
          apiPayload?: unknown;
          agentModuleKey?: unknown;
          executionPayload?: unknown;
          validationStatus?: unknown;
          validationEvidence?: unknown;
          findingId?: unknown;
          recommendationId?: unknown;
          priority?: unknown;
          status?: unknown;
          plannedHours?: unknown;
          actualHours?: unknown;
          qaRequired?: unknown;
          approvalRequired?: unknown;
          assigneeType?: unknown;
          executionReadiness?: unknown;
          assignedAgentId?: unknown;
        };
        const task = await createProjectTask(c.req.param("projectId"), body);
        return c.json({ task }, 201);
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error ? error.message : "Failed to create task"
          },
          400
        );
      }
    }

    return c.json({ error: "Method Not Allowed" }, 405);
  });

  app.get("/api/projects/:projectId/tasks/board", async (c) => {
    return c.json(
      await loadProjectTaskBoard(c.req.param("projectId"))
    );
  });

  app.patch("/api/projects/:projectId/tasks/:taskId/status", async (c) => {
    const parsed = taskStatusSchema.safeParse(await readJsonBodyOrEmpty(c));

    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    try {
      const actor = await resolveInternalActor(c.env.incoming);
      const task = await transitionProjectTaskStatus({
        actor: actor.actor,
        projectId: c.req.param("projectId"),
        taskId: c.req.param("taskId"),
        status: parsed.data.status
      });

      return c.json({ task });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to transition task";
      const statusCode =
        message === "Task not found"
          ? 404
          : message === "This task requires approval before completion"
            ? 403
            : 400;

      return c.json({ error: message }, statusCode);
    }
  });

  app.post(
    "/api/projects/:projectId/tasks/:taskId/request-approval",
    async (c) => {
      const parsed = taskApprovalSchema.safeParse(await readJsonBodyOrEmpty(c));

      if (!parsed.success) {
        return c.json({ error: parsed.error.flatten() }, 400);
      }

      try {
        const actor = await resolveInternalActor(c.env.incoming);
        const result = await requestTaskApproval({
          actor: actor.actor,
          projectId: c.req.param("projectId"),
          taskId: c.req.param("taskId"),
          notes: parsed.data.notes ?? null
        });

        return c.json(result, 201);
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to request approval"
          },
          error instanceof Error && error.message === "Task not found" ? 404 : 400
        );
      }
    }
  );

  app.post("/api/projects/:projectId/tasks/:taskId/approve", async (c) => {
    const parsed = taskApprovalSchema.safeParse(await readJsonBodyOrEmpty(c));

    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    try {
      const actor = await resolveInternalActor(c.env.incoming);
      return c.json(
        await approveTaskApproval({
          actor: actor.actor,
          projectId: c.req.param("projectId"),
          taskId: c.req.param("taskId"),
          notes: parsed.data.notes ?? null
        })
      );
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to approve task"
        },
        error instanceof Error && error.message === "Task approval not found"
          ? 404
          : 400
      );
    }
  });

  app.post("/api/projects/:projectId/tasks/:taskId/reject", async (c) => {
    const parsed = taskRejectSchema.safeParse(await readJsonBodyOrEmpty(c));

    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    try {
      const actor = await resolveInternalActor(c.env.incoming);
      return c.json(
        await rejectTaskApproval({
          actor: actor.actor,
          projectId: c.req.param("projectId"),
          taskId: c.req.param("taskId"),
          notes: parsed.data.notes
        })
      );
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to reject task"
        },
        error instanceof Error && error.message === "Task approval not found"
          ? 404
          : 400
      );
    }
  });

  app.get("/api/projects/:projectId/tasks/:taskId/approval", async (c) =>
    c.json({
      approval: await loadTaskApproval(
        c.req.param("projectId"),
        c.req.param("taskId")
      )
    })
  );

  app.post("/api/projects/:projectId/tasks/:taskId/execute", async (c) => {
    const parsed = taskExecuteSchema.safeParse(await readJsonBodyOrEmpty(c));

    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    try {
      const actor = await resolveInternalActor(c.env.incoming);
      return c.json(
        await executeProjectTask({
          actor: actor.actor,
          projectId: c.req.param("projectId"),
          taskId: c.req.param("taskId"),
          dryRun: parsed.data.dryRun ?? false,
          sessionId: parsed.data.sessionId ?? null
        }),
        202
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to execute task";
      const statusCode =
        message === "Task not found"
          ? 404
          : message.includes("requires approval")
            ? 403
            : 400;

      return c.json({ error: message }, statusCode);
    }
  });

  app.post("/api/projects/:projectId/tasks/generate-plan", async (c) => {
    try {
      await ensureProjectPlanGenerationAllowed(c.req.param("projectId"));
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to generate project plan"
        },
        error instanceof Error && error.message === "Project not found"
          ? 404
          : 409
      );
    }

    return c.json({
      tasks: await generateProjectTaskPlan(c.req.param("projectId"))
    });
  });

  app.post("/api/projects/:projectId/tasks/load-templates", async (c) => {
    const parsed = projectTaskTemplateLoadSchema.safeParse(
      await readJsonBodyOrEmpty(c)
    );

    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    try {
      await ensureProjectPlanGenerationAllowed(c.req.param("projectId"));
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to load delivery templates"
        },
        error instanceof Error && error.message === "Project not found"
          ? 404
          : 409
      );
    }

    try {
      return c.json({
        tasks: await loadProjectTaskTemplates(
          c.req.param("projectId"),
          parsed.data.templateIds
        )
      });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to load delivery templates"
        },
        error instanceof Error && error.message === "Project not found"
          ? 404
          : 400
      );
    }
  });

  app.all("/api/projects/:projectId/tasks/:taskId", async (c) => {
    if (c.req.method === "PATCH") {
      try {
        const body = (await readJsonBodyOrEmpty(c)) as {
          status?: unknown;
          title?: unknown;
          description?: unknown;
          category?: unknown;
          executionType?: unknown;
          executionLaneRationale?: unknown;
          hubspotTierRequired?: unknown;
          coworkBrief?: unknown;
          manualInstructions?: unknown;
          apiPayload?: unknown;
          agentModuleKey?: unknown;
          executionPayload?: unknown;
          validationStatus?: unknown;
          validationEvidence?: unknown;
          findingId?: unknown;
          recommendationId?: unknown;
          priority?: unknown;
          qaRequired?: unknown;
          approvalRequired?: unknown;
          assigneeType?: unknown;
          executionReadiness?: unknown;
          assignedAgentId?: unknown;
          plannedHours?: unknown;
          actualHours?: unknown;
        };
        const task = await updateProjectTaskRecord(
          c.req.param("projectId"),
          c.req.param("taskId"),
          body
        );

        return c.json({ task });
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error ? error.message : "Failed to update task"
          },
          error instanceof Error && error.message === "Task not found"
            ? 404
            : error instanceof Error &&
                error.message ===
                  "Approved scope is locked. Use change management to revise scoped task details."
              ? 409
              : 400
        );
      }
    }

    if (c.req.method === "DELETE") {
      try {
        await ensureProjectScopeUnlocked(
          c.req.param("projectId"),
          "Approved scope is locked. Use change management to remove or replace project steps."
        );
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error ? error.message : "Failed to delete task"
          },
          error instanceof Error && error.message === "Project not found"
            ? 404
            : 409
        );
      }

      try {
        await deleteProjectTaskRecord(
          c.req.param("projectId"),
          c.req.param("taskId")
        );
        return c.json({ success: true });
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error ? error.message : "Failed to delete task"
          },
          error instanceof Error && error.message === "Task not found"
            ? 404
            : 400
        );
      }
    }

    return c.json({ error: "Method Not Allowed" }, 405);
  });

  app.all("/api/projects/:projectId/findings", async (c) => {
    if (c.req.method === "GET") {
      return c.json({
        findings: await loadProjectFindings(c.req.param("projectId"))
      });
    }

    if (c.req.method === "POST") {
      try {
        const finding = await createProjectFinding(
          c.req.param("projectId"),
          await readJsonBodyOrEmpty(c)
        );
        return c.json({ finding }, 201);
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to create finding"
          },
          400
        );
      }
    }

    return c.json({ error: "Method Not Allowed" }, 405);
  });

  app.get("/api/projects/:projectId/context", async (c) =>
    c.json(await loadProjectContext(c.req.param("projectId")))
  );

  app.put("/api/projects/:projectId/context/:contextType", async (c) => {
    try {
      const entry = await saveProjectContext(
        c.req.param("projectId"),
        c.req.param("contextType"),
        (await readJsonBodyOrEmpty(c)) as Record<string, unknown>
      );
      return c.json({ entry });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to save project context"
        },
        400
      );
    }
  });

  app.delete("/api/projects/:projectId/context/:contextType", async (c) => {
    try {
      return c.json(
        await deleteProjectContext(
          c.req.param("projectId"),
          c.req.param("contextType")
        )
      );
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to delete project context"
        },
        400
      );
    }
  });

  app.post("/api/projects/:projectId/run/portal-audit", async (c) => {
    const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
    const providerKey = typeof body.providerKey === "string" ? body.providerKey : "anthropic";
    const modelId = typeof body.modelId === "string" ? body.modelId : undefined;

    try {
      const job = await startProjectPortalAuditExecutionJob(
        c.req.param("projectId"),
        providerKey,
        modelId
      );
      return c.json({ job }, 202);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to start portal audit"
        },
        error instanceof Error && error.message === "Project not found"
          ? 404
          : 400
      );
    }
  });

  app.get("/api/projects/:projectId/runs/:jobId/status", async (c) => {
    try {
      const job = await loadProjectExecutionJobStatus(
        c.req.param("projectId"),
        c.req.param("jobId")
      );
      return c.json({ job });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to load execution job status"
        },
        error instanceof Error && error.message === "Execution job not found"
          ? 404
          : 400
      );
    }
  });

  app.post("/api/projects/:projectId/portal-audit/generate", async (c) => {
    try {
      const { run, result } = await runTrackedProjectPortalAudit(
        c.req.param("projectId")
      );
      return c.json({ audit: result, run });
    } catch (error) {
      if (error instanceof ZodError) {
        return c.json(
          {
            error: "Portal audit returned invalid JSON",
            details: error.flatten()
          },
          502
        );
      }

      return c.json(
        {
          run:
            error &&
            typeof error === "object" &&
            "workflowRun" in error
              ? (error as { workflowRun?: unknown }).workflowRun
              : null,
          error:
            error instanceof Error
              ? error.message
              : "Failed to generate portal audit"
        },
        error instanceof Error && error.message === "Project not found"
          ? 404
          : 400
      );
    }
  });

  app.all("/api/projects/:projectId/findings/:findingId", async (c) => {
    if (c.req.method === "PATCH") {
      try {
        const finding = await updateProjectFinding(
          c.req.param("projectId"),
          c.req.param("findingId"),
          await readJsonBodyOrEmpty(c)
        );
        return c.json({ finding });
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to update finding"
          },
          error instanceof Error && error.message === "Finding not found"
            ? 404
            : 400
        );
      }
    }

    if (c.req.method === "DELETE") {
      try {
        await deleteProjectFinding(
          c.req.param("projectId"),
          c.req.param("findingId")
        );
        return c.json({ success: true });
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to delete finding"
          },
          error instanceof Error && error.message === "Finding not found"
            ? 404
            : 400
        );
      }
    }

    return c.json({ error: "Method Not Allowed" }, 405);
  });

  app.all("/api/projects/:projectId/recommendations", async (c) => {
    if (c.req.method === "GET") {
      return c.json({
        recommendations: await loadProjectRecommendations(
          c.req.param("projectId")
        )
      });
    }

    if (c.req.method === "POST") {
      try {
        const recommendation = await createProjectRecommendation(
          c.req.param("projectId"),
          await readJsonBodyOrEmpty(c)
        );
        return c.json({ recommendation }, 201);
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to create recommendation"
          },
          400
        );
      }
    }

    return c.json({ error: "Method Not Allowed" }, 405);
  });

  app.patch(
    "/api/projects/:projectId/recommendations/:recommendationId",
    async (c) => {
      try {
        const recommendation = await updateProjectRecommendation(
          c.req.param("projectId"),
          c.req.param("recommendationId"),
          await readJsonBodyOrEmpty(c)
        );
        return c.json({ recommendation });
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to update recommendation"
          },
          error instanceof Error && error.message === "Recommendation not found"
            ? 404
            : 400
        );
      }
    }
  );

  app.put("/api/projects/:projectId/scope", async (c) => {
    const payload = updateProjectScopeRequestSchema.parse(
      await readJsonBodyOrEmpty(c)
    );
    const project = await updateProjectScope(c.req.param("projectId"), payload);
    return c.json({
      project,
      summary: await summarizeProject(project)
    });
  });

  app.all("/api/projects/:projectId/messages", async (c) => {
    const project = await prisma.project.findUnique({
      where: { id: c.req.param("projectId") },
      select: { id: true }
    });

    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    if (c.req.method === "GET") {
      await markProjectMessagesSeenByInternal(c.req.param("projectId"));
      return c.json({
        messages: await loadProjectMessages(c.req.param("projectId"))
      });
    }

    if (c.req.method === "POST") {
      try {
        const body = (await readJsonBodyOrEmpty(c)) as {
          body?: unknown;
          senderName?: unknown;
        };
        const message = await createProjectMessage({
          projectId: c.req.param("projectId"),
          senderType: "internal",
          senderName:
            typeof body.senderName === "string" &&
            body.senderName.trim().length > 0
              ? body.senderName
              : "Muloo",
          body: body.body
        });

        return c.json({ message }, 201);
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error ? error.message : "Failed to post message"
          },
          400
        );
      }
    }

    return c.json({ error: "Method Not Allowed" }, 405);
  });

  app.delete("/api/projects/:projectId/messages/:messageId", async (c) => {
    const { projectId, messageId } = c.req.param();
    const msg = await prisma.projectMessage.findFirst({
      where: { id: messageId, projectId }
    });
    if (!msg) return c.json({ error: "Message not found" }, 404);
    await prisma.projectMessage.delete({ where: { id: messageId } });
    return c.json({ deleted: true });
  });

  app.patch("/api/projects/:projectId/portal-settings", async (c) => {
    const projectId = c.req.param("projectId");
    const body = (await readJsonBodyOrEmpty(c)) as { portalQuoteEnabled?: unknown };
    if (typeof body.portalQuoteEnabled !== "boolean") {
      return c.json({ error: "portalQuoteEnabled must be a boolean" }, 400);
    }
    const project = await prisma.project.update({
      where: { id: projectId },
      data: { portalQuoteEnabled: body.portalQuoteEnabled }
    });
    return c.json({ portalQuoteEnabled: project.portalQuoteEnabled });
  });

  app.post("/api/projects/:projectId/quote/share", async (c) => {
    try {
      const result = await shareProjectQuote(
        c.req.param("projectId"),
        await readJsonBodyOrEmpty(c)
      );
      return c.json({
        project: result.project,
        quote: result.quote,
        shared: true
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Project not found") {
        return c.json({ error: error.message }, 404);
      }

      if (
        error instanceof Error &&
        error.message ===
          "Approved scope is locked. Use change management to revise this project."
      ) {
        return c.json({ error: error.message }, 409);
      }

      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to share quote"
        },
        400
      );
    }
  });

  app.all("/api/projects/:projectId/changes", async (c) => {
    if (c.req.method === "GET") {
      try {
        const result = await loadProjectChangeRequests(
          c.req.param("projectId")
        );
        return c.json(result);
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to load project change requests"
          },
          error instanceof Error && error.message === "Project not found"
            ? 404
            : 400
        );
      }
    }

    if (c.req.method === "POST") {
      try {
        const project = await prisma.project.findUnique({
          where: { id: c.req.param("projectId") },
          include: {
            client: true
          }
        });

        if (!project) {
          return c.json({ error: "Project not found" }, 404);
        }

        const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
        const workRequest = await createWorkRequest({
          ...body,
          projectId: project.id,
          serviceFamily: project.serviceFamily,
          companyName: project.client.name,
          contactName:
            typeof body.contactName === "string" &&
            body.contactName.trim().length > 0
              ? body.contactName
              : project.clientChampionFirstName ||
                project.owner ||
                project.client.name,
          contactEmail:
            typeof body.contactEmail === "string" &&
            body.contactEmail.trim().length > 0
              ? body.contactEmail
              : project.clientChampionEmail ||
                project.ownerEmail ||
                "hello@muloo.co",
          requestType: "change_request"
        });

        return c.json({ workRequest }, 201);
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to create project change request"
          },
          400
        );
      }
    }

    return c.json({ error: "Method Not Allowed" }, 405);
  });

  app.post("/api/projects/:projectId/email-draft", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as {
        intent?: unknown;
        mode?: unknown;
        providerKey?: unknown;
        modelOverride?: unknown;
        sourceSubject?: unknown;
        sourceBody?: unknown;
        customInstructions?: unknown;
      };

      if (typeof body.intent !== "string" || body.intent.trim().length === 0) {
        return c.json({ error: "intent must be a non-empty string" }, 400);
      }

      const draft = await generateProjectEmailDraft({
        projectId: c.req.param("projectId"),
        intent: body.intent.trim(),
        mode:
          body.mode === "cleanup" || body.mode === "generate"
            ? body.mode
            : "generate",
        ...(typeof body.providerKey === "string" &&
        body.providerKey.trim().length > 0
          ? { providerKey: body.providerKey.trim() }
          : {}),
        ...(typeof body.modelOverride === "string"
          ? { modelOverride: body.modelOverride.trim() }
          : {}),
        ...(typeof body.sourceSubject === "string"
          ? { sourceSubject: body.sourceSubject }
          : {}),
        ...(typeof body.sourceBody === "string"
          ? { sourceBody: body.sourceBody }
          : {}),
        ...(typeof body.customInstructions === "string"
          ? { customInstructions: body.customInstructions.trim() }
          : {})
      });

      return c.json({ draft });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to draft project email"
        },
        error instanceof Error && error.message === "Project not found"
          ? 404
          : 400
      );
    }
  });

  app.post("/api/projects/:projectId/email/draft", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as {
        notes?: unknown;
      };

      const draft = await generateSimplifiedProjectEmailDraft({
        projectId: c.req.param("projectId"),
        notes: typeof body.notes === "string" ? body.notes : ""
      });

      return c.json({ draft });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to draft project email"
        },
        error instanceof Error && error.message === "Project not found"
          ? 404
          : 400
      );
    }
  });

  app.post("/api/projects/:projectId/send-email", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as {
        to?: unknown;
        cc?: unknown;
        subject?: unknown;
        body?: unknown;
      };

      const result = await sendWorkspaceEmail(body);
      const toRecipients = (Array.isArray(body.to) ? body.to : [body.to])
        .flatMap((entry) =>
          typeof entry === "string" ? entry.split(/[,\n;]/) : []
        )
        .map((entry) => entry.trim())
        .filter(Boolean);
      const ccRecipients = (Array.isArray(body.cc) ? body.cc : [body.cc])
        .flatMap((entry) =>
          typeof entry === "string" ? entry.split(/[,\n;]/) : []
        )
        .map((entry) => entry.trim())
        .filter(Boolean);
      await createProjectMessage({
        projectId: c.req.param("projectId"),
        senderType: "internal",
        senderName: "Muloo Email Composer",
        body: `Email sent\nTo: ${toRecipients.join(", ")}${
          ccRecipients.length > 0 ? `\nCc: ${ccRecipients.join(", ")}` : ""
        }\nSubject: ${
          typeof body.subject === "string" ? body.subject.trim() : ""
        }\n\n${typeof body.body === "string" ? body.body.trim() : ""}`
      });
      return c.json({ sent: true, result });
    } catch (error) {
      return c.json(
        {
          error: error instanceof Error ? error.message : "Failed to send email"
        },
        400
      );
    }
  });

  app.post("/api/projects/:projectId/agenda/generate", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as {
        sessionType?: unknown;
        date?: unknown;
        duration?: unknown;
        notes?: unknown;
      };

      if (
        typeof body.sessionType !== "string" ||
        body.sessionType.trim().length === 0
      ) {
        throw new Error("sessionType is required");
      }

      const lastAgenda = await generateProjectAgenda({
        projectId: c.req.param("projectId"),
        sessionType: body.sessionType.trim(),
        date: typeof body.date === "string" ? body.date : null,
        duration: typeof body.duration === "string" ? body.duration : null,
        notes: typeof body.notes === "string" ? body.notes : null
      });

      return c.json({
        agenda: lastAgenda.content,
        lastAgenda
      });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to generate agenda"
        },
        error instanceof Error && error.message === "Project not found"
          ? 404
          : 400
      );
    }
  });

  app.post("/api/projects/:projectId/prepare-brief/generate", async (c) => {
    try {
      const { run, result } = await runTrackedProjectPrepareBrief(
        c.req.param("projectId")
      );
      return c.json({ brief: result, run });
    } catch (error) {
      if (error instanceof ZodError) {
        return c.json(
          {
            error: "Prepare brief returned invalid JSON",
            details: error.flatten()
          },
          502
        );
      }

      if (error instanceof SyntaxError) {
        return c.json(
          {
            error: "Prepare brief returned invalid JSON"
          },
          502
        );
      }

      return c.json(
        {
          run:
            error &&
            typeof error === "object" &&
            "workflowRun" in error
              ? (error as { workflowRun?: unknown }).workflowRun
              : null,
          error:
            error instanceof Error
              ? error.message
              : "Failed to generate prepare brief"
        },
        error instanceof Error && error.message === "Project not found"
          ? 404
          : 400
      );
    }
  });

  app.post("/api/solution-options", async (c) => {
    const body = (await readJsonBodyOrEmpty(c)) as {
      clientName?: string;
      website?: string;
      problemStatement?: string;
      serviceFamily?: string;
    };

    if (
      typeof body.problemStatement !== "string" ||
      body.problemStatement.trim().length < 20
    ) {
      return c.json(
        {
          error: "problemStatement must be at least 20 characters"
        },
        400
      );
    }

    return c.json(
      await generateSolutionOptions({
        problemStatement: body.problemStatement.trim(),
        ...(typeof body.clientName === "string" &&
        body.clientName.trim().length > 0
          ? { clientName: body.clientName.trim() }
          : {}),
        ...(typeof body.website === "string" && body.website.trim().length > 0
          ? { website: body.website.trim() }
          : {}),
        ...(typeof body.serviceFamily === "string" &&
        body.serviceFamily.trim().length > 0
          ? { serviceFamily: body.serviceFamily.trim() }
          : {})
      })
    );
  });

  app.get("/api/executions/:executionId", async (c) =>
    c.json({
      execution: await loadExecutionById(c.req.param("executionId"))
    })
  );

  app.get("/api/executions/:executionId/steps", async (c) =>
    c.json({
      executionId: c.req.param("executionId"),
      steps: await loadExecutionSteps(c.req.param("executionId"))
    })
  );

  app.get("/api/users", async (c) =>
    c.json({
      users: (await loadWorkspaceUsers()).map((user) =>
        serializeWorkspaceUser(user)
      )
    })
  );

  app.get("/api/provider-connections", async (c) =>
    c.json({
      providers: await loadProviderConnections()
    })
  );

  app.get("/api/ai-routing", async (c) =>
    c.json({
      routes: await loadAiRouting()
    })
  );

  app.get("/api/email-settings", async (c) =>
    c.json({
      settings: await loadWorkspaceEmailSettings()
    })
  );

  app.get("/api/email-oauth/google", async (c) =>
    c.json({
      connection: await loadWorkspaceEmailOAuthConnection()
    })
  );

  app.get("/api/email-oauth/google/start", async (c) => {
    try {
      const { authUrl } = await createWorkspaceGoogleEmailOAuthStart();
      return c.redirect(authUrl);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to start Google OAuth"
        },
        400
      );
    }
  });

  app.get("/api/workspace/todos", async (c) =>
    c.json(await loadWorkspaceTodos())
  );

  app.post("/api/workspace/todos", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      return c.json(await createWorkspaceTodo(body), 201);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to create todo"
        },
        400
      );
    }
  });

  app.patch("/api/workspace/todos/:todoId", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      return c.json(await updateWorkspaceTodo(c.req.param("todoId"), body));
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to update todo"
        },
        400
      );
    }
  });

  app.delete("/api/workspace/todos/:todoId", async (c) => {
    try {
      return c.json(await deleteWorkspaceTodo(c.req.param("todoId")));
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to delete todo"
        },
        400
      );
    }
  });

  app.delete("/api/workspace/todos", async (c) =>
    c.json(await clearCompletedWorkspaceTodos())
  );

  app.get("/api/workspace/emails/action-required", async (c) =>
    c.json(await getGmailActionRequired())
  );

  app.get("/api/workspace/emails/client-queues", async (c) =>
    c.json(await getWorkspaceClientEmailQueues())
  );

  app.post("/api/workspace/email/draft", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      return c.json(await generateWorkspaceEmailDraft(body));
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to draft workspace email"
        },
        400
      );
    }
  });

  app.post("/api/workspace/email/send", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as {
        to?: unknown;
        cc?: unknown;
        subject?: unknown;
        body?: unknown;
      };
      return c.json({ sent: true, result: await sendWorkspaceEmail(body) });
    } catch (error) {
      return c.json(
        {
          error: error instanceof Error ? error.message : "Failed to send email"
        },
        400
      );
    }
  });

  app.post("/api/workspace/todos/from-email", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      return c.json(await createWorkspaceTodoFromEmail(body), 201);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to create todo from email"
        },
        400
      );
    }
  });

  app.get("/api/workspace/private-tasks", async (c) =>
    c.json(await loadWorkspacePrivateTasks())
  );

  app.get("/api/workspace/google/connect", async (c) => {
    const gmailConnection = await loadWorkspaceEmailOAuthConnection();
    const calendarStatus = await getWorkspaceCalendarStatus();

    if (
      !calendarStatus.configured &&
      !gmailConnection.clientId &&
      !gmailConnection.hasClientSecret
    ) {
      return c.redirect("/settings/workspace?googleSetup=credentials");
    }

    if (!calendarStatus.connected || calendarStatus.requiresReconnect) {
      return c.redirect("/api/workspace/calendar/auth");
    }

    if (!gmailConnection.isConnected) {
      return c.redirect("/api/email-oauth/google/start");
    }

    return c.redirect("/command-centre?googleConnected=true");
  });

  app.post("/api/workspace/private-tasks", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      return c.json(await createWorkspacePrivateTask(body), 201);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to create private task"
        },
        400
      );
    }
  });

  app.patch("/api/workspace/private-tasks/:taskId", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      return c.json(
        await updateWorkspacePrivateTask(c.req.param("taskId"), body)
      );
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to update private task"
        },
        400
      );
    }
  });

  app.delete("/api/workspace/private-tasks/:taskId", async (c) => {
    try {
      return c.json(await deleteWorkspacePrivateTask(c.req.param("taskId")));
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to delete private task"
        },
        400
      );
    }
  });

  app.patch("/api/workspace/email-filter", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      const connection = await updateWorkspaceEmailOAuthConnection({
        gmailFilterLabel: body.gmailFilterLabel
      });
      return c.json({
        success: true,
        gmailFilterLabel: connection.gmailFilterLabel
      });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to update Gmail filter"
        },
        400
      );
    }
  });

  app.get("/api/workspace/calendar/auth", async (c) => {
    try {
      const { authUrl } = await createWorkspaceCalendarOAuthStart();
      return c.redirect(authUrl);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error &&
            error.message === "Google Calendar OAuth credentials are not configured"
              ? "not_configured"
              : "start_failed",
          message:
            error instanceof Error
              ? error.message
              : "Failed to start Google Calendar OAuth"
        },
        400
      );
    }
  });

  app.get("/api/workspace/calendar/connection", async (c) =>
    c.json({
      connection: await loadWorkspaceCalendarConnection()
    })
  );

  app.patch("/api/workspace/calendar/connection", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      return c.json({
        connection: await updateWorkspaceCalendarConnection(body)
      });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to update Google Calendar connection"
        },
        400
      );
    }
  });

  app.get("/api/workspace/api-keys", async (c) =>
    c.json({
      keys: await loadWorkspaceApiKeys()
    })
  );

  app.post("/api/workspace/api-keys", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      return c.json(
        {
          key: await saveWorkspaceApiKey(body)
        },
        201
      );
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to save API key"
        },
        400
      );
    }
  });

  app.delete("/api/workspace/api-keys/:keyName", async (c) => {
    try {
      return c.json(
        await deleteWorkspaceApiKey(c.req.param("keyName"))
      );
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to remove API key"
        },
        400
      );
    }
  });

  app.get("/api/workspace/calendar/status", async (c) =>
    c.json(await getWorkspaceCalendarStatus())
  );

  app.get("/api/workspace/calendar/callback", async (c) => {
    try {
      await completeWorkspaceCalendarOAuthCallback({
        code: c.req.query("code"),
        state: c.req.query("state")
      });
      return c.redirect("/api/workspace/google/connect");
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to complete Google Calendar OAuth"
        },
        400
      );
    }
  });

  app.get("/api/workspace/calendar/events", async (c) =>
    c.json(await getCalendarEvents())
  );

  app.get("/api/workspace/industry-signals", async (c) =>
    c.json(await getWorkspaceIndustrySignals())
  );

  app.delete("/api/workspace/calendar/connection", async (c) =>
    c.json(await disconnectWorkspaceCalendarConnection())
  );

  app.get("/api/workspace/xero/auth", async (c) => {
    if (
      !process.env.XERO_CLIENT_ID?.trim() ||
      !process.env.XERO_CLIENT_SECRET?.trim()
    ) {
      return c.json(
        {
          error: "not_configured",
          message:
            "OAuth credentials not set. Add XERO_CLIENT_ID and XERO_CLIENT_SECRET to environment variables."
        },
        400
      );
    }

    try {
      const { authUrl } = await createWorkspaceXeroOAuthStart();
      return c.redirect(authUrl);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to start Xero OAuth"
        },
        400
      );
    }
  });

  app.get("/api/workspace/xero/status", async (c) =>
    c.json(await getWorkspaceXeroStatus())
  );

  app.get("/api/workspace/xero/callback", async (c) => {
    try {
      await completeWorkspaceXeroOAuthCallback({
        code: c.req.query("code"),
        state: c.req.query("state")
      });
      return c.redirect("/workspace?xeroConnected=true");
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to complete Xero OAuth"
        },
        400
      );
    }
  });

  app.get("/api/workspace/xero/invoices", async (c) =>
    c.json(await getWorkspaceXeroInvoices())
  );

  app.delete("/api/workspace/xero/connection", async (c) =>
    c.json(await disconnectWorkspaceXeroConnection())
  );

  app.get("/api/workspace/projects/active", async (c) =>
    c.json(await getActiveProjects())
  );

  app.get("/api/workspace/quotes/pipeline", async (c) =>
    c.json(await getQuotesPipeline())
  );

  app.post("/api/workspace/summary/generate", async (c) => {
    try {
      return c.json(await generateWorkspaceDailySummary());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate summary";
      return c.json(
        { error: message },
        message === "No AI provider configured" ? 400 : 500
      );
    }
  });

  app.get("/api/workspace/summary/latest", async (c) =>
    c.json(await getLatestWorkspaceDailySummary())
  );

  app.get("/api/workspace/ai-routing/:workflowKey", async (c) =>
    c.json(await getWorkspaceAiRouting(c.req.param("workflowKey")))
  );

  app.patch("/api/workspace/ai-routing/:workflowKey", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      return c.json(
        await saveWorkspaceAiRouting(c.req.param("workflowKey"), body)
      );
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to update workspace AI routing"
        },
        400
      );
    }
  });

  app.get("/api/products", async (c) =>
    c.json({
      products: await loadProductCatalog()
    })
  );

  app.post("/api/products", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as {
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
      return c.json({ product }, 201);
    } catch (error) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400);
      }

      throw error;
    }
  });

  app.patch("/api/products/:productId", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as {
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
        c.req.param("productId"),
        body
      );
      return c.json({ product });
    } catch (error) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400);
      }

      throw error;
    }
  });

  app.get("/api/agents", async (c) =>
    c.json({
      agents: await loadAgentCatalog()
    })
  );

  app.post("/api/agents", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as {
        name?: unknown;
        purpose?: unknown;
        provider?: unknown;
        model?: unknown;
        triggerType?: unknown;
        approvalMode?: unknown;
        allowedActions?: unknown;
        systemPrompt?: unknown;
        isActive?: unknown;
        sortOrder?: unknown;
      };
      const agent = await createAgentDefinition(body);
      return c.json({ agent }, 201);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to create agent"
        },
        400
      );
    }
  });

  app.patch("/api/agents/:agentId", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as {
        name?: unknown;
        purpose?: unknown;
        provider?: unknown;
        model?: unknown;
        triggerType?: unknown;
        approvalMode?: unknown;
        allowedActions?: unknown;
        systemPrompt?: unknown;
        isActive?: unknown;
        sortOrder?: unknown;
      };
      const agent = await updateAgentDefinition(c.req.param("agentId"), body);
      return c.json({ agent });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to update agent"
        },
        400
      );
    }
  });

  app.get("/api/delivery-templates", async (c) =>
    c.json({
      templates: await loadDeliveryTemplates()
    })
  );

  app.post("/api/delivery-templates", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      const template = await createDeliveryTemplate(body);
      return c.json({ template }, 201);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to create delivery template"
        },
        400
      );
    }
  });

  app.patch("/api/delivery-templates/:templateId", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      const template = await updateDeliveryTemplate(
        c.req.param("templateId"),
        body
      );
      return c.json({ template });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to update delivery template"
        },
        400
      );
    }
  });

  app.get("/api/work-requests", async (c) =>
    c.json({
      workRequests: await loadWorkRequests()
    })
  );

  app.post("/api/work-requests", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      const workRequest = await createWorkRequest(body);
      return c.json({ workRequest }, 201);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to create work request"
        },
        400
      );
    }
  });

  app.patch("/api/work-requests/:requestId", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      const workRequest = await updateWorkRequest(
        c.req.param("requestId"),
        body
      );
      return c.json({ workRequest });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to update work request"
        },
        400
      );
    }
  });

  app.post("/api/work-requests/:requestId/convert", async (c) => {
    try {
      const result = await convertWorkRequestToProject(
        c.req.param("requestId")
      );
      return c.json(result);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to convert work request"
        },
        400
      );
    }
  });

  app.post("/api/work-requests/:requestId/append-to-delivery", async (c) => {
    try {
      const result = await appendApprovedChangeRequestToDelivery(
        c.req.param("requestId")
      );
      return c.json(result);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to append change request to delivery"
        },
        error instanceof Error &&
          [
            "Change request not found",
            "Change request is not linked to a project"
          ].includes(error.message)
          ? 404
          : 400
      );
    }
  });

  app.get("/api/hubspot/agent-capabilities", async (c) => {
    const portalRecordId = c.req.query("portalRecordId");
    const connection = await resolveHubSpotAgentConnection(portalRecordId);

    return c.json(buildHubSpotAgentCapabilitiesPayload(connection));
  });

  app.post("/api/hubspot/agent-execute", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      const result = await executeHubSpotAgentAction(body);
      return c.json(result);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to execute HubSpot agent action"
        },
        400
      );
    }
  });

  app.post("/api/hubspot/agent-request", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      const { run, result } = await runTrackedHubSpotAgentRequest(body);
      return c.json({ ...result, run });
    } catch (error) {
      return c.json(
        {
          run:
            error &&
            typeof error === "object" &&
            "workflowRun" in error
              ? (error as { workflowRun?: unknown }).workflowRun
              : null,
          error:
            error instanceof Error
              ? error.message
              : "Failed to run HubSpot agent request"
        },
        400
      );
    }
  });

  app.post("/api/hubspot/oauth/start", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      const result = await createHubSpotOAuthStart(body);
      return c.json(result);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to start HubSpot OAuth"
        },
        400
      );
    }
  });

  app.post("/api/hubspot/oauth/callback", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      const result = await completeHubSpotOAuthCallback(body);
      return c.json(result);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to complete HubSpot OAuth"
        },
        400
      );
    }
  });

  app.get("/api/portals", async (c) =>
    c.json({
      portals: await loadHubSpotPortals()
    })
  );

  app.get("/api/portals/:portalId/snapshot", async (c) => {
    const snapshot = await loadLatestPortalSnapshot(c.req.param("portalId"));

    if (!snapshot) {
      return c.json({ snapshot: null }, 404);
    }

    return c.json({ snapshot });
  });

  app.get("/api/portals/:portalId/workflow-runs", async (c) =>
    c.json({
      workflowRuns: await loadWorkflowRuns({
        portalId: c.req.param("portalId"),
        limit: 12
      })
    })
  );

  app.post("/api/portals/:portalId/snapshot", async (c) => {
    try {
      const snapshot = await createPortalSnapshotForPortal(
        c.req.param("portalId")
      );
      return c.json({ snapshot }, 201);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to refresh portal snapshot"
        },
        error instanceof Error &&
          (error.message === "HubSpot portal not found" ||
            error.message === "HubSpot portal is not connected")
          ? 404
          : 400
      );
    }
  });

  app.post("/api/portals", async (c) => {
    const body = (await readJsonBodyOrEmpty(c)) as {
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

      return c.json({ portal }, 201);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        return c.json(
          {
            error: "A portal with that ID already exists"
          },
          409
        );
      }

      throw error;
    }
  });

  app.get("/api/clients", async (c) =>
    c.json({
      clients: await loadClientsDirectory()
    })
  );

  app.get("/api/clients/:clientId/memory", async (c) => {
    try {
      const excludeProjectId = c.req.query("excludeProjectId");
      return c.json({
        memory: await loadClientMemory(
          c.req.param("clientId"),
          typeof excludeProjectId === "string" && excludeProjectId
            ? { excludeProjectId }
            : undefined
        )
      });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to load client memory"
        },
        error instanceof Error && error.message === "Client not found"
          ? 404
          : 400
      );
    }
  });

  app.post("/api/clients", async (c) => {
    const body = (await readJsonBodyOrEmpty(c)) as {
      name: string;
      website?: string;
      logoUrl?: string;
      industry?: string;
      region?: string;
      hubSpotPortalId?: string;
      gmailLabel?: string;
      additionalWebsites?: string[];
      linkedinUrl?: string;
      facebookUrl?: string;
      instagramUrl?: string;
      xUrl?: string;
      youtubeUrl?: string;
      clientRoles?: string[];
      parentClientId?: string;
      visibleToPartnerIds?: string[];
    };

    try {
      const client = await createClientDirectoryRecord(body);
      return c.json({ client }, 201);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        return c.json(
          {
            error: "A client with that name already exists"
          },
          409
        );
      }

      throw error;
    }
  });

  app.patch("/api/clients/:clientId", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as {
        name?: unknown;
        website?: unknown;
        logoUrl?: unknown;
        industry?: unknown;
        region?: unknown;
        hubSpotPortalId?: unknown;
        gmailLabel?: unknown;
        additionalWebsites?: unknown;
        linkedinUrl?: unknown;
        facebookUrl?: unknown;
        instagramUrl?: unknown;
        xUrl?: unknown;
        youtubeUrl?: unknown;
        clientRoles?: unknown;
        parentClientId?: unknown;
        visibleToPartnerIds?: unknown;
      };

      const client = await updateClientDirectoryRecord(
        c.req.param("clientId"),
        body
      );

      return c.json({ client });
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        return c.json(
          {
            error: "A client with that name already exists"
          },
          409
        );
      }

      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to update client"
        },
        error instanceof Error && error.message === "Client not found"
          ? 404
          : 400
      );
    }
  });

  app.delete("/api/clients/:clientId", async (c) => {
    try {
      await deleteClientDirectoryRecord(c.req.param("clientId"));
      return c.json({ success: true });
    } catch (error: unknown) {
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to delete client"
        },
        error instanceof Error && error.message === "Client not found"
          ? 404
          : 400
      );
    }
  });

  app.post("/api/clients/:clientId/enrich", async (c) => {
    try {
      const client = await refreshClientEnrichment(c.req.param("clientId"));
      return c.json({ client });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to refresh client enrichment"
        },
        error instanceof Error && error.message === "Client not found"
          ? 404
          : 400
      );
    }
  });

  app.post("/api/clients/:clientId/contacts", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as {
        firstName?: unknown;
        lastName?: unknown;
        email?: unknown;
        title?: unknown;
        canApproveQuotes?: unknown;
      };
      const contact = await createClientContact(c.req.param("clientId"), body);
      return c.json({ contact }, 201);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return c.json(
          {
            error: "A contact with that email already exists for this client"
          },
          409
        );
      }

      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to create client contact"
        },
        400
      );
    }
  });

  app.patch("/api/clients/:clientId/contacts/:contactId", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as {
        firstName?: unknown;
        lastName?: unknown;
        email?: unknown;
        title?: unknown;
        canApproveQuotes?: unknown;
      };
      const contact = await updateClientContact(
        c.req.param("clientId"),
        c.req.param("contactId"),
        body
      );
      return c.json({ contact });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return c.json(
          {
            error: "A contact with that email already exists for this client"
          },
          409
        );
      }

      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to update client contact"
        },
        error instanceof Error && error.message === "Client contact not found"
          ? 404
          : 400
      );
    }
  });

  app.post(
    "/api/clients/:clientId/contacts/:contactId/portal-access",
    async (c) => {
      try {
        const body = (await readJsonBodyOrEmpty(c)) as {
          projectIds?: unknown;
          questionnaireAccess?: unknown;
          sendEmail?: unknown;
        };
        const result = await inviteClientContactToProjects(
          c.req.param("clientId"),
          c.req.param("contactId"),
          body
        );

        return c.json(result);
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to update client portal access"
          },
          error instanceof Error &&
            ["Client not found", "Client contact not found"].includes(
              error.message
            )
            ? 404
            : 400
        );
      }
    }
  );

  app.post("/api/users", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      const user = await createWorkspaceUser(body);
      return c.json({ user }, 201);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to create workspace user"
        },
        400
      );
    }
  });

  app.patch("/api/users/:userId", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      const user = await updateWorkspaceUser(c.req.param("userId"), body);
      return c.json({ user });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to update workspace user"
        },
        400
      );
    }
  });

  app.patch("/api/provider-connections/:providerKey", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      const provider = await updateWorkspaceProviderConnection(
        c.req.param("providerKey"),
        body
      );
      return c.json({ provider });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to update provider connection"
        },
        400
      );
    }
  });

  app.patch("/api/ai-routing/:workflowKey", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      const route = await updateWorkspaceAiRouting(
        c.req.param("workflowKey"),
        body
      );
      return c.json({ route });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to update AI routing"
        },
        400
      );
    }
  });

  app.patch("/api/email-settings", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      const settings = await updateWorkspaceEmailSettings(body);
      return c.json({ settings });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to update email settings"
        },
        400
      );
    }
  });

  app.patch("/api/email-oauth/google", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      const connection = await updateWorkspaceEmailOAuthConnection(body);
      return c.json({ connection });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to update Google email OAuth settings"
        },
        400
      );
    }
  });

  app.delete("/api/email-oauth/google", async (c) => {
    try {
      const connection = await disconnectWorkspaceGoogleEmailOAuthConnection();
      return c.json({ connection });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to disconnect Google mailbox"
        },
        400
      );
    }
  });

  app.post("/api/email-oauth/google/start", async (c) => {
    try {
      const result = await createWorkspaceGoogleEmailOAuthStart();
      return c.json(result);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to start Google OAuth"
        },
        400
      );
    }
  });

  app.post("/api/email-oauth/google/callback", async (c) => {
    try {
      const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
      const connection = await completeWorkspaceGoogleEmailOAuthCallback(body);
      return c.json({ connection });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to complete Google OAuth"
        },
        400
      );
    }
  });

  app.all("/api/client/inbox/summary", async (c) => {
    if (c.req.method !== "GET") {
      return c.json({ error: "Method Not Allowed" }, 405);
    }

    return c.json({
      summary: await loadClientInboxSummary(c.get("clientUserId"))
    });
  });

  app.all("/api/client/inbox", async (c) => {
    if (c.req.method !== "GET") {
      return c.json({ error: "Method Not Allowed" }, 405);
    }

    const clientUserId = c.get("clientUserId");
    const projectIds = (
      await prisma.clientProjectAccess.findMany({
        where: { userId: clientUserId },
        select: { projectId: true }
      })
    ).map((record) => record.projectId);

    await markProjectMessagesSeenByClient(projectIds);

    return c.json(await loadClientInbox(clientUserId));
  });

  app.all("/api/client/work-requests", async (c) => {
    const clientUserId = c.get("clientUserId");
    const clientUser = await prisma.clientPortalUser.findUnique({
      where: { id: clientUserId }
    });

    if (!clientUser) {
      return c.json({ error: "Client unauthorized" }, 401);
    }

    if (c.req.method === "GET") {
      const accessRecords = await prisma.clientProjectAccess.findMany({
        where: { userId: clientUserId },
        select: { projectId: true }
      });

      return c.json({
        workRequests: await loadWorkRequests({
          projectIds: accessRecords.map((record) => record.projectId),
          contactEmail: clientUser.email
        })
      });
    }

    if (c.req.method === "POST") {
      try {
        const body = (await readJsonBodyOrEmpty(c)) as Record<string, unknown>;
        const workRequest = await createWorkRequest({
          ...body,
          contactName: `${clientUser.firstName} ${clientUser.lastName}`.trim(),
          contactEmail: clientUser.email
        });
        return c.json({ workRequest }, 201);
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to create work request"
          },
          400
        );
      }
    }

    return c.json({ error: "Method Not Allowed" }, 405);
  });

  app.all("/api/client/projects/:projectId/quote/approve", async (c) => {
    if (c.req.method !== "POST") {
      return c.json({ error: "Method Not Allowed" }, 405);
    }

    try {
      const result = await approveProjectQuote(
        c.req.param("projectId"),
        c.get("clientUserId")
      );

      return c.json({
        project: result.project,
        quote: result.quote,
        approved: true
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Project not found") {
        return c.json({ error: error.message }, 404);
      }

      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to approve quote"
        },
        400
      );
    }
  });

  app.all("/api/client/projects", async (c) => {
    if (c.req.method !== "GET") {
      return c.json({ error: "Method Not Allowed" }, 405);
    }

    return c.json({
      projects: await loadClientProjectsForUser(c.get("clientUserId"))
    });
  });

  app.all("/api/client/projects/:projectId", async (c) => {
    if (c.req.method !== "GET") {
      return c.json({ error: "Method Not Allowed" }, 405);
    }

    const detail = await loadClientProjectDetail(
      c.req.param("projectId"),
      c.get("clientUserId")
    );

    if (!detail) {
      return c.json({ error: "Project not found" }, 404);
    }

    return c.json(detail);
  });

  app.all(
    "/api/client/projects/:projectId/submissions/:sessionId",
    async (c) => {
      if (c.req.method !== "PATCH") {
        return c.json({ error: "Method Not Allowed" }, 405);
      }

      try {
        const body = (await readJsonBodyOrEmpty(c)) as {
          answers?: unknown;
        };
        const submission = await saveClientInputSubmission(
          c.req.param("projectId"),
          c.get("clientUserId"),
          Number(c.req.param("sessionId")),
          body.answers ?? {}
        );

        return c.json({ submission });
      } catch (error) {
        if (error instanceof Error) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    }
  );

  app.all("/api/client/projects/:projectId/tasks", async (c) => {
    if (c.req.method !== "GET") {
      return c.json({ error: "Method Not Allowed" }, 405);
    }

    const projectId = c.req.param("projectId");
    const access = await prisma.clientProjectAccess.findFirst({
      where: {
        projectId,
        userId: c.get("clientUserId")
      }
    });

    if (!access) {
      return c.json({ error: "Project not found" }, 404);
    }

    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: {
        assignedAgent: { select: { name: true } },
        executionJobs: {
          select: {
            id: true,
            status: true,
            resultStatus: true,
            createdAt: true,
            completedAt: true
          },
          orderBy: [{ createdAt: "desc" }],
          take: 1
        }
      },
      orderBy: [{ createdAt: "asc" }]
    });

    return c.json({
      tasks: tasks.map((task) => serializePortalTask(task))
    });
  });

  app.all("/api/client/projects/:projectId/quote", async (c) => {
    if (c.req.method !== "GET") {
      return c.json({ error: "Method Not Allowed" }, 405);
    }

    const document = await loadClientQuoteDocument(
      c.req.param("projectId"),
      c.get("clientUserId")
    );

    if (!document) {
      return c.json({ error: "Project not found" }, 404);
    }

    if (!document.quote) {
      return c.json(
        {
          error: "Quote has not yet been published to the client portal."
        },
        400
      );
    }

    const isStandaloneQuote = document.project.scopeType === "standalone_quote";

    if (!document.summary) {
      return c.json(
        {
          error: isStandaloneQuote
            ? "Generate the scoped summary before opening the commercial document."
            : "Generate the discovery summary before opening the quote."
        },
        400
      );
    }

    if (!isStandaloneQuote && !document.blueprint) {
      return c.json(
        {
          error:
            "Generate the discovery summary and blueprint before opening the quote."
        },
        400
      );
    }

    return c.json(document);
  });

  app.all("/api/client/projects/:projectId/messages", async (c) => {
    const projectId = c.req.param("projectId");
    const clientUserId = c.get("clientUserId");
    const access = await prisma.clientProjectAccess.findFirst({
      where: {
        projectId,
        userId: clientUserId
      }
    });

    if (!access) {
      return c.json({ error: "Project not found" }, 404);
    }

    if (c.req.method === "GET") {
      await markProjectMessagesSeenByClient(projectId);
      return c.json({
        messages: await loadProjectMessages(projectId)
      });
    }

    if (c.req.method === "POST") {
      const clientUser = await prisma.clientPortalUser.findUnique({
        where: { id: clientUserId }
      });

      if (!clientUser) {
        return c.json({ error: "Client unauthorized" }, 401);
      }

      try {
        const body = (await readJsonBodyOrEmpty(c)) as {
          body?: unknown;
        };
        const message = await createProjectMessage({
          projectId,
          senderType: "client",
          senderName: `${clientUser.firstName} ${clientUser.lastName}`.trim(),
          body: body.body
        });

        return c.json({ message }, 201);
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error ? error.message : "Failed to post message"
          },
          400
        );
      }
    }

    return c.json({ error: "Method Not Allowed" }, 405);
  });

  app.delete("/api/client/projects/:projectId/messages/:messageId", async (c) => {
    const { projectId, messageId } = c.req.param();
    const clientUserId = c.get("clientUserId");
    const access = await prisma.clientProjectAccess.findFirst({
      where: { projectId, userId: clientUserId }
    });
    if (!access) return c.json({ error: "Project not found" }, 404);
    const msg = await prisma.projectMessage.findFirst({
      where: { id: messageId, projectId, senderType: "client" }
    });
    if (!msg) return c.json({ error: "Message not found" }, 404);
    await prisma.projectMessage.delete({ where: { id: messageId } });
    return c.json({ deleted: true });
  });

  app.all("/api/client/*", (c) =>
    c.json({ error: "Client route not found" }, 404)
  );

  app.all("/api/projects/:projectId/client-users", async (c) => {
    if (c.req.method === "GET") {
      return c.json({
        clientUsers: await loadClientUsersForProject(c.req.param("projectId"))
      });
    }

    if (c.req.method === "POST") {
      try {
        const body = (await readJsonBodyOrEmpty(c)) as {
          firstName?: unknown;
          lastName?: unknown;
          email?: unknown;
          password?: unknown;
          role?: unknown;
          questionnaireAccess?: unknown;
          assignedInputSections?: unknown;
        };

        const clientUser = await createClientPortalUserForProject(
          c.req.param("projectId"),
          body
        );

        return c.json({ clientUser }, 201);
      } catch (error) {
        if (error instanceof Error) {
          return c.json({ error: error.message }, 400);
        }

        throw error;
      }
    }

    return c.json({ error: "Method Not Allowed" }, 405);
  });

  app.get("/api/projects/:projectId/partner-users", async (c) => {
    return c.json({
      partnerUsers: await loadPartnerUsersForProject(c.req.param("projectId"))
    });
  });

  app.all("/api/projects/:projectId/client-users/:userId", async (c) => {
    if (c.req.method !== "PATCH") {
      return c.json({ error: "Method Not Allowed" }, 405);
    }

    try {
      const body = (await readJsonBodyOrEmpty(c)) as {
        role?: unknown;
        questionnaireAccess?: unknown;
        assignedInputSections?: unknown;
      };
      const clientUser = await updateClientProjectAccess(
        c.req.param("projectId"),
        c.req.param("userId"),
        body
      );

      return c.json({ clientUser });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Client user not found for this project"
      ) {
        return c.json({ error: error.message }, 404);
      }

      if (error instanceof Error) {
        return c.json({ error: error.message }, 400);
      }

      throw error;
    }
  });

  app.all(
    "/api/projects/:projectId/client-users/:userId/invite-link",
    async (c) => {
      if (c.req.method !== "POST") {
        return c.json({ error: "Method Not Allowed" }, 405);
      }

      try {
        const result = await createClientInviteLink(
          c.req.param("userId"),
          c.req.param("projectId")
        );

        return c.json(result);
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to create invite link"
          },
          error instanceof Error &&
            error.message === "Client user not found for this project"
            ? 404
            : 400
        );
      }
    }
  );

  app.all(
    "/api/projects/:projectId/client-users/:userId/reset-link",
    async (c) => {
      if (c.req.method !== "POST") {
        return c.json({ error: "Method Not Allowed" }, 405);
      }

      try {
        const result = await createClientResetLink(
          c.req.param("userId"),
          c.req.param("projectId")
        );

        return c.json(result);
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to create reset link"
          },
          error instanceof Error &&
            error.message === "Client user not found for this project"
            ? 404
            : 400
        );
      }
    }
  );

  // Tier 2: Browser Session Executor endpoints
  app.post("/api/portal-session", async (c) => {
    try {
      const { portalId, csrfToken, baseUrl, capturedBy } = await c.req.json();

      // Validate inputs
      if (!portalId || !csrfToken || !baseUrl) {
        return c.json(
          { error: "Missing required fields: portalId, csrfToken, baseUrl" },
          400
        );
      }

      const existingSession = await (prisma as any).portalSession.findFirst({
        where: { portalId },
        orderBy: { capturedAt: "desc" }
      });

      // Create PortalSession record in database
      const session = await (prisma as any).portalSession.create({
        data: {
          portalId,
          csrfToken,
          baseUrl,
          capturedBy: capturedBy || "unknown",
          valid: true,
          privateAppToken: existingSession?.privateAppToken ?? null
        }
      });

      return c.json({ sessionId: session.id, valid: true });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to create portal session"
        },
        500
      );
    }
  });

  app.get("/api/portal-session/:portalId/valid", async (c) => {
    try {
      const { portalId } = c.req.param();

      if (!portalId) {
        return c.json({ error: "Missing portalId" }, 400);
      }

      // Check if a valid PortalSession exists for this portalId
      const session = await (prisma as any).portalSession.findFirst({
        where: {
          portalId,
          valid: true
        },
        orderBy: { capturedAt: "desc" }
      });

      if (!session) {
        return c.json({ sessionExists: false, sessionId: null }, 200);
      }

      return c.json({
        sessionExists: true,
        sessionId: session.id,
        capturedAt: session.capturedAt,
        capturedBy: session.capturedBy,
        privateAppTokenConfigured: Boolean(session.privateAppToken?.trim())
      });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to check portal session"
        },
        500
      );
    }
  });

  app.patch("/api/portal-sessions/:portalId/token", async (c) => {
    const parsed = portalPrivateAppTokenSchema.safeParse(
      await readJsonBodyOrEmpty(c)
    );

    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    try {
      const portalId = c.req.param("portalId")?.trim();

      if (!portalId) {
        return c.json({ error: "portalId is required" }, 400);
      }

      const existingSession = await prisma.portalSession.findFirst({
        where: { portalId },
        orderBy: { capturedAt: "desc" }
      });

      if (!existingSession) {
        return c.json(
          { error: "No PortalSession found for this portal. Capture a portal session first." },
          404
        );
      }

      await prisma.portalSession.update({
        where: { id: existingSession.id },
        data: { privateAppToken: parsed.data.privateAppToken.trim() }
      });

      return c.json({ success: true });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to update portal private app token"
        },
        500
      );
    }
  });

  // Report Templates endpoints
  app.get("/api/report-templates", async (c) => {
    try {
      const { TemplateEngine } = await import("@muloo/report-templates");
      const engine = new TemplateEngine();
      const templates = engine.getAllTemplateMetadata();
      return c.json({ templates });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to list report templates"
        },
        500
      );
    }
  });

  app.get("/api/report-templates/:templateId", async (c) => {
    try {
      const { TemplateEngine } = await import("@muloo/report-templates");
      const engine = new TemplateEngine();
      const templateId = c.req.param("templateId");
      const template = engine.getTemplate(templateId);

      if (!template) {
        return c.json({ error: "Template not found" }, 404);
      }

      return c.json({
        id: template.id,
        name: template.name,
        section: template.section,
        chartType: template.chartType,
        requiredProperties: template.requiredProperties,
        description: template.description,
        displayOrder: template.displayOrder
      });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to get report template"
        },
        500
      );
    }
  });

  // Marketing Dashboard Agent endpoint
  app.post("/api/agents/marketing-dashboard", async (c) => {
    try {
      const parsed = marketingDashboardSchema.safeParse(
        await readJsonBodyOrEmpty(c)
      );

      if (!parsed.success) {
        return c.json({ error: parsed.error.flatten() }, 400);
      }

      const body = parsed.data;

      // Create execution job
      const payload: Record<string, any> = {};
      Object.keys(body).forEach((key) => {
        payload[key] = body[key as keyof typeof body];
      });

      const job = await prisma.executionJob.create({
        data: {
          projectId: String(body.projectId),
          jobType: "marketing-dashboard",
          moduleKey: "dashboard_build",
          executionMethod: "agent",
          mode: body.dryRun ? "dry-run" : "apply",
          status: "queued",
          payload
        }
      });

      // Add to BullMQ queue — worker picks this up immediately
      await executionQueue.add(
        job.moduleKey,
        {
          executionJobId: job.id,
          moduleKey: job.moduleKey,
          projectId: job.projectId,
          portalId: String(body.portalId),
          sessionId: body.sessionId ? String(body.sessionId) : undefined,
          dryRun: job.mode === 'dry-run',
          payload: {
            dashboardName: body.dashboardName,
            primaryLeadSourceProperty: body.primaryLeadSourceProperty,
            lastKeyActionProperty: body.lastKeyActionProperty,
            sectionsToInclude: body.sectionsToInclude,
          },
        },
        { jobId: job.id } // use same ID for traceability
      );

      return c.json({ jobId: job.id, status: "queued" }, 202);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to start marketing dashboard agent"
        },
        500
      );
    }
  });

  app.post("/api/agents/research", async (c) => {
    const parsed = researchRequestSchema.safeParse(await readJsonBodyOrEmpty(c));

    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    try {
      const job = await prisma.executionJob.create({
        data: {
          projectId: parsed.data.projectId,
          jobType: "research",
          moduleKey: "research",
          executionMethod: "agent",
          mode: "apply",
          status: "queued",
          resultStatus: "pending",
          payload: {
            query: parsed.data.query,
            context: parsed.data.context ?? null
          }
        }
      });

      await executionQueue.add(
        job.moduleKey,
        {
          executionJobId: job.id,
          moduleKey: job.moduleKey,
          projectId: job.projectId,
          dryRun: false,
          payload: job.payload as Record<string, unknown>
        },
        { jobId: job.id }
      );

      return c.json({ jobId: job.id, status: "queued" }, 202);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to queue research agent"
        },
        500
      );
    }
  });

  // Execution Job Cowork Instruction endpoint
  app.get("/api/execution-jobs/:jobId/cowork-instruction", async (c) => {
    try {
      const jobId = c.req.param("jobId");

      if (!jobId) {
        return c.json({ error: "Missing jobId" }, 400);
      }

      const job = await prisma.executionJob.findUnique({
        where: { id: jobId }
      });

      if (!job) {
        return c.json({ error: "Job not found" }, 404);
      }

      const coworkInstruction = job.coworkInstruction ?? null;

      if (!coworkInstruction) {
        return c.json(
          { error: "No cowork instruction for this job" },
          404
        );
      }

      return c.json(coworkInstruction);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to get cowork instruction"
        },
        500
      );
    }
  });

  app.get("/api/cowork/pending-instructions", async (c) => {
    const sessionId = c.req.query("sessionId")?.trim() ?? "";
    const portalId = c.req.query("portalId")?.trim() ?? "";

    if (!sessionId) {
      return c.json({ error: "sessionId is required" }, 400);
    }

    try {
      const jobs = await prisma.$transaction(async (tx) => {
        const pendingJobs = await tx.executionJob.findMany({
          where: {
            status: "queued",
            executionTier: 3,
            coworkSessionId: null,
            ...(portalId
              ? {
                  OR: [
                    { payload: { path: ["portalId"], equals: portalId } },
                    { coworkInstruction: { path: ["portalId"], equals: portalId } }
                  ]
                }
              : {})
          },
          orderBy: [{ createdAt: "asc" }]
        });
        const claimableJobs = pendingJobs.filter(
          (job) => job.coworkInstruction !== null
        );

        if (claimableJobs.length === 0) {
          return [];
        }

        const jobIds = claimableJobs.map((job) => job.id);

        await tx.executionJob.updateMany({
          where: {
            id: { in: jobIds },
            coworkSessionId: null
          },
          data: {
            coworkSessionId: sessionId,
            coworkClaimedAt: new Date()
          }
        });

        return tx.executionJob.findMany({
          where: { id: { in: jobIds }, coworkSessionId: sessionId },
          orderBy: [{ createdAt: "asc" }]
        });
      });

      return c.json(
        jobs.map((job) => ({
          jobId: job.id,
          coworkInstruction: job.coworkInstruction,
          createdAt: job.createdAt
        }))
      );
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to claim cowork instructions"
        },
        500
      );
    }
  });

  app.post("/api/cowork/instructions/:jobId/start", async (c) => {
    const body = coworkStartSchema.safeParse(await readJsonBodyOrEmpty(c));

    if (!body.success) {
      return c.json({ error: body.error.flatten() }, 400);
    }

    await prisma.executionJob.update({
      where: { id: c.req.param("jobId") },
      data: {
        status: "running",
        startedAt: new Date()
      }
    });

    return c.json({ ok: true });
  });

  app.post("/api/cowork/instructions/:jobId/complete", async (c) => {
    const parsed = coworkCompleteSchema.safeParse(await readJsonBodyOrEmpty(c));

    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const currentJob = await prisma.executionJob.findUnique({
      where: { id: c.req.param("jobId") }
    });

    if (!currentJob) {
      return c.json({ error: "Job not found" }, 404);
    }

    await prisma.executionJob.update({
      where: { id: c.req.param("jobId") },
      data: {
        status: parsed.data.success ? "complete" : "failed",
        resultStatus: parsed.data.success ? "success" : "error",
        outputLog: parsed.data.output,
        errorLog: parsed.data.success ? null : parsed.data.output,
        completedAt: new Date()
      }
    });

    if (currentJob.taskId) {
      await prisma.task.update({
        where: { id: currentJob.taskId },
        data: {
          status: parsed.data.success ? "done" : "blocked"
        }
      });
    }

    return c.json({ ok: true });
  });

  app.notFound((c) => c.json({ error: "Not Found" }, 404));

  // Poll job status
  app.get('/api/execution-jobs/:id/status', async (c) => {
    const job = await prisma.executionJob.findUnique({
      where: { id: c.req.param('id') },
      select: {
        id: true,
        status: true,
        resultStatus: true,
        moduleKey: true,
        mode: true,
        startedAt: true,
        completedAt: true,
        outputLog: true,
        errorLog: true,
        executionTier: true,
        coworkInstruction: true,
      },
    });

    if (!job) return c.json({ error: 'Job not found' }, 404);
    return c.json(job);
  });

  // Start the background job worker
  if (process.env.NODE_ENV !== 'test') {
    startWorker();
    console.info('[worker] BullMQ execution worker started');
  }

  return app;
}

export function createAppServer(config: BaseConfig) {
  return createAdaptorServer({
    fetch: createApiApp(config).fetch
  }) as http.Server;
}
