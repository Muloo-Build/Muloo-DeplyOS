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
  createWorkspaceUser,
  createClientAuthToken,
  createCookieHeader,
  createWorkspaceGoogleEmailOAuthStart,
  createSimpleAuthToken,
  completeWorkspaceGoogleEmailOAuthCallback,
  disconnectWorkspaceGoogleEmailOAuthConnection,
  getAuthenticatedClientUserId,
  handleLegacyRequest,
  industryOptions,
  isAuthenticated,
  loadAgentRuns,
  loadAiRouting,
  loadInboxSummary,
  loadInternalInbox,
  loadProviderConnections,
  loadWorkspaceEmailOAuthConnection,
  loadWorkspaceEmailSettings,
  loadWorkspaceUsers,
  markAllProjectMessagesSeenByInternal,
  resolveSimpleAuthCredentials,
  serializeWorkspaceUser,
  serializeClientPortalUser,
  updateWorkspaceAiRouting,
  updateWorkspaceEmailOAuthConnection,
  updateWorkspaceEmailSettings,
  updateWorkspaceProviderConnection,
  updateWorkspaceUser
} from "./server";

type HonoBindings = { Bindings: HttpBindings };

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
  app.use("/api/email-settings", internalAuth);
  app.use("/api/email-oauth/google", internalAuth);
  app.use("/api/email-oauth/google/*", internalAuth);

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
