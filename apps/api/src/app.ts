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
  createClientAuthToken,
  createCookieHeader,
  createSimpleAuthToken,
  getAuthenticatedClientUserId,
  handleLegacyRequest,
  industryOptions,
  isAuthenticated,
  loadAgentRuns,
  loadInboxSummary,
  loadInternalInbox,
  markAllProjectMessagesSeenByInternal,
  resolveSimpleAuthCredentials,
  serializeClientPortalUser
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
