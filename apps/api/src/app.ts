import type * as http from "node:http";
import { createAdaptorServer, type HttpBindings } from "@hono/node-server";
import { RESPONSE_ALREADY_SENT } from "@hono/node-server/utils/response";
import { type BaseConfig, getIntegrationStatus } from "@muloo/config";
import {
  loadAllExecutionRecords,
  loadAllTemplates,
  loadTemplateById,
  validateAllProjects
} from "@muloo/file-system";
import { moduleCatalog } from "@muloo/shared";
import { type Context, Hono, type Next } from "hono";
import { ZodError } from "zod";
import { prisma } from "./prisma";
import {
  clientAuthCookieName,
  createAgentDefinition,
  createClientContact,
  createClientDirectoryRecord,
  createClientInviteLink,
  createClientPortalUserForProject,
  createClientResetLink,
  createDeliveryTemplate,
  createProductCatalogItem,
  createWorkRequest,
  createWorkspaceUser,
  createClientAuthToken,
  createCookieHeader,
  createWorkspaceGoogleEmailOAuthStart,
  createSimpleAuthToken,
  completeWorkspaceGoogleEmailOAuthCallback,
  completeHubSpotOAuthCallback,
  disconnectWorkspaceGoogleEmailOAuthConnection,
  executeHubSpotAgentAction,
  getAuthenticatedClientUserId,
  handleLegacyRequest,
  industryOptions,
  isAuthenticated,
  isUniqueConstraintError,
  loadAgentRuns,
  loadAgentCatalog,
  loadAiRouting,
  loadDeliveryTemplates,
  loadHubSpotPortals,
  loadInboxSummary,
  loadInternalInbox,
  loadClientsDirectory,
  loadProductCatalog,
  loadProviderConnections,
  loadWorkRequests,
  loadWorkspaceEmailOAuthConnection,
  loadWorkspaceEmailSettings,
  loadWorkspaceUsers,
  markAllProjectMessagesSeenByInternal,
  createHubSpotOAuthStart,
  buildHubSpotAgentCapabilitiesPayload,
  inviteClientContactToProjects,
  resolveHubSpotAgentConnection,
  resolveSimpleAuthCredentials,
  serializeWorkspaceUser,
  serializeClientPortalUser,
  convertWorkRequestToProject,
  appendApprovedChangeRequestToDelivery,
  updateAgentDefinition,
  updateWorkspaceAiRouting,
  approveProjectQuote,
  createProjectMessage,
  updateClientContact,
  updateClientDirectoryRecord,
  updateDeliveryTemplate,
  updateWorkspaceEmailOAuthConnection,
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
  refreshClientEnrichment,
  loadProjectMessages,
  markProjectMessagesSeenByClient,
  saveClientInputSubmission,
  serializeTask,
  updateClientProjectAccess,
  updateWorkRequest,
  updateWorkspaceUser
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

export function createApiApp(config: BaseConfig) {
  const app = new Hono<HonoBindings>();
  const internalAuth = async (c: Context<HonoBindings>, next: Next) => {
    if (!isAuthenticated(c.env.incoming)) {
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

  app.use("/api/modules", internalAuth);
  app.use("/api/settings", internalAuth);
  app.use("/api/industries", internalAuth);
  app.use("/api/templates", internalAuth);
  app.use("/api/templates/*", internalAuth);
  app.use("/api/projects/validation-summary", internalAuth);
  app.use("/api/inbox", internalAuth);
  app.use("/api/inbox/*", internalAuth);
  app.use("/api/runs", internalAuth);
  app.use("/api/users", internalAuth);
  app.use("/api/users/*", internalAuth);
  app.use("/api/provider-connections", internalAuth);
  app.use("/api/provider-connections/*", internalAuth);
  app.use("/api/ai-routing", internalAuth);
  app.use("/api/ai-routing/*", internalAuth);
  app.use("/api/products", internalAuth);
  app.use("/api/products/*", internalAuth);
  app.use("/api/agents", internalAuth);
  app.use("/api/agents/*", internalAuth);
  app.use("/api/delivery-templates", internalAuth);
  app.use("/api/delivery-templates/*", internalAuth);
  app.use("/api/work-requests", internalAuth);
  app.use("/api/work-requests/*", internalAuth);
  app.use("/api/projects", internalAuth);
  app.use("/api/projects/*", internalAuth);
  app.use("/api/hubspot", internalAuth);
  app.use("/api/hubspot/*", internalAuth);
  app.use("/api/portals", internalAuth);
  app.use("/api/clients", internalAuth);
  app.use("/api/clients/*", internalAuth);
  app.use("/api/email-settings", internalAuth);
  app.use("/api/email-oauth/google", internalAuth);
  app.use("/api/email-oauth/google/*", internalAuth);
  app.use("/api/client", clientAuth);
  app.use("/api/client/*", clientAuth);

  app.all("/api/auth/session", (c) =>
    c.json({
      authenticated: isAuthenticated(c.env.incoming)
    })
  );

  app.post("/api/auth/login", async (c) => {
    const body = (await readJsonBodyOrEmpty(c)) as {
      password?: string;
      username?: string;
    };
    const credentials = resolveSimpleAuthCredentials();

    if (
      body.username?.trim() !== credentials.username ||
      body.password !== credentials.password
    ) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    c.header(
      "Set-Cookie",
      createCookieHeader(createSimpleAuthToken(credentials.username), {
        maxAge: 60 * 60 * 12
      })
    );

    return c.json({ authenticated: true });
  });

  app.post("/api/auth/logout", (c) => {
    c.header(
      "Set-Cookie",
      createCookieHeader("", {
        maxAge: 0
      })
    );

    return c.json({ authenticated: false });
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
    const body = (await readJsonBodyOrEmpty(c)) as {
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
      return c.json({ error: "Invalid client credentials" }, 401);
    }

    c.header(
      "Set-Cookie",
      createCookieHeader(createClientAuthToken(user.id), {
        name: clientAuthCookieName,
        maxAge: 60 * 60 * 24 * 14
      })
    );

    return c.json({
      authenticated: true,
      user: serializeClientPortalUser(user)
    });
  });

  app.post("/api/client-auth/set-password", async (c) => {
    const body = (await readJsonBodyOrEmpty(c)) as {
      password?: string;
      token?: string;
    };
    const token = body.token?.trim() ?? "";
    const password = body.password?.trim() ?? "";

    if (!token || password.length < 8) {
      return c.json(
        {
          error:
            "A valid token and password of at least 8 characters are required"
        },
        400
      );
    }

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
        password,
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

    return c.json({
      authenticated: true,
      user: serializeClientPortalUser(updatedUser)
    });
  });

  app.post("/api/client-auth/logout", (c) => {
    c.header(
      "Set-Cookie",
      createCookieHeader("", {
        name: clientAuthCookieName,
        maxAge: 0
      })
    );

    return c.json({ authenticated: false });
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
      agentRuns: await loadAgentRuns()
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

  app.post("/api/clients", async (c) => {
    const body = (await readJsonBodyOrEmpty(c)) as {
      name: string;
      website?: string;
      logoUrl?: string;
      industry?: string;
      region?: string;
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
      tasks: tasks.map((task) => serializeTask(task))
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

  app.all("*", async (c) => {
    await handleLegacyRequest(config, c.env.incoming, c.env.outgoing);
    return RESPONSE_ALREADY_SENT;
  });

  return app;
}

export function createAppServer(config: BaseConfig) {
  return createAdaptorServer({
    fetch: createApiApp(config).fetch
  }) as http.Server;
}
