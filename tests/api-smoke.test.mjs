import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://smoke:smoke@127.0.0.1:5432/muloo_smoke";
process.env.SIMPLE_AUTH_USERNAME = "smoke-user";
process.env.SIMPLE_AUTH_PASSWORD = "smoke-pass";

// These smoke tests intentionally stay on routes that do not execute Prisma queries.
// The server instantiates Prisma at module load, but CI does not provision Postgres yet.
// When we add DB-dependent smoke coverage, we should add a Postgres service container first.
const { createAppServer } = await import("../apps/api/dist/app.js");

const defaultConfig = {
  nodeEnv: "test",
  port: 0,
  appBaseUrl: "http://127.0.0.1",
  artifactDir: "artifacts",
  executionMode: "dry-run",
  allowDestructiveActions: false,
  applyEnabled: false,
  integrations: {}
};

async function startServer() {
  const server = createAppServer(defaultConfig);

  await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve smoke test server address");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

async function stopServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function requestJson(baseUrl, path, options = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers ?? {})
  };
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();

  return {
    response,
    body: text.length > 0 ? JSON.parse(text) : null
  };
}

function readCookie(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie()[0] ?? "";
  }

  return response.headers.get("set-cookie") ?? "";
}

async function loginAndGetCookie(baseUrl) {
  const loginResult = await requestJson(baseUrl, "/api/auth/login", {
    method: "POST",
    body: {
      username: process.env.SIMPLE_AUTH_USERNAME,
      password: process.env.SIMPLE_AUTH_PASSWORD
    }
  });

  assert.equal(loginResult.response.status, 200);
  assert.deepEqual(loginResult.body, { authenticated: true });

  const authCookie = readCookie(loginResult.response);
  assert.match(authCookie, /^muloo_deploy_os_auth=/);

  return authCookie;
}

async function expectUnauthorized(baseUrl, path, options = {}) {
  const { response, body } = await requestJson(baseUrl, path, options);

  assert.equal(response.status, 401);
  assert.deepEqual(body, { error: "Unauthorized" });
}

async function expectClientUnauthorized(baseUrl, path, options = {}) {
  const { response, body } = await requestJson(baseUrl, path, options);

  assert.equal(response.status, 401);
  assert.deepEqual(body, { error: "Client unauthorized" });
}

test("returns an unauthenticated internal session by default", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const { response, body } = await requestJson(baseUrl, "/api/auth/session");

    assert.equal(response.status, 200);
    assert.deepEqual(body, { authenticated: false });
  } finally {
    await stopServer(server);
  }
});

test("rejects invalid internal credentials", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const { response, body } = await requestJson(baseUrl, "/api/auth/login", {
      method: "POST",
      body: {
        username: "wrong-user",
        password: "wrong-pass"
      }
    });

    assert.equal(response.status, 401);
    assert.deepEqual(body, { error: "Invalid credentials" });
  } finally {
    await stopServer(server);
  }
});

test("supports internal login, session lookup, and logout", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const authCookie = await loginAndGetCookie(baseUrl);

    const sessionResult = await requestJson(baseUrl, "/api/auth/session", {
      headers: {
        Cookie: authCookie
      }
    });

    assert.equal(sessionResult.response.status, 200);
    assert.deepEqual(sessionResult.body, { authenticated: true });

    const logoutResult = await requestJson(baseUrl, "/api/auth/logout", {
      method: "POST",
      headers: {
        Cookie: authCookie
      }
    });

    assert.equal(logoutResult.response.status, 200);
    assert.deepEqual(logoutResult.body, { authenticated: false });
  } finally {
    await stopServer(server);
  }
});

test("guards internal project routes when no auth cookie is present", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const { response, body } = await requestJson(baseUrl, "/api/projects");

    assert.equal(response.status, 401);
    assert.deepEqual(body, { error: "Unauthorized" });
  } finally {
    await stopServer(server);
  }
});

test("returns an unauthenticated client portal session by default", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const { response, body } = await requestJson(
      baseUrl,
      "/api/client-auth/session"
    );

    assert.equal(response.status, 200);
    assert.deepEqual(body, { authenticated: false });
  } finally {
    await stopServer(server);
  }
});

test("returns module catalog metadata from the Hono system routes", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const authCookie = await loginAndGetCookie(baseUrl);
    const { response, body } = await requestJson(baseUrl, "/api/modules", {
      headers: {
        Cookie: authCookie
      }
    });

    assert.equal(response.status, 200);
    assert.equal(Array.isArray(body.modules), true);
  } finally {
    await stopServer(server);
  }
});

test("returns workspace settings from the Hono system routes", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const authCookie = await loginAndGetCookie(baseUrl);
    const { response, body } = await requestJson(baseUrl, "/api/settings", {
      headers: {
        Cookie: authCookie
      }
    });

    assert.equal(response.status, 200);
    assert.equal(body.environment, "test");
    assert.equal(body.executionMode, "dry-run");
    assert.equal(body.applyEnabled, false);
  } finally {
    await stopServer(server);
  }
});

test("guards internal Hono system routes without an auth cookie", async () => {
  const { server, baseUrl } = await startServer();

  try {
    await expectUnauthorized(baseUrl, "/api/settings");
    await expectUnauthorized(baseUrl, "/api/industries");
    await expectUnauthorized(baseUrl, "/api/templates");
    await expectUnauthorized(baseUrl, "/api/projects/validation-summary");
    await expectUnauthorized(baseUrl, "/api/inbox");
    await expectUnauthorized(baseUrl, "/api/inbox/summary");
    await expectUnauthorized(baseUrl, "/api/runs");
    await expectUnauthorized(baseUrl, "/api/users");
    await expectUnauthorized(baseUrl, "/api/users", {
      method: "POST",
      body: {}
    });
    await expectUnauthorized(baseUrl, "/api/users/test-user", {
      method: "PATCH",
      body: {}
    });
    await expectUnauthorized(baseUrl, "/api/provider-connections");
    await expectUnauthorized(baseUrl, "/api/provider-connections/openai", {
      method: "PATCH",
      body: {}
    });
    await expectUnauthorized(baseUrl, "/api/ai-routing");
    await expectUnauthorized(baseUrl, "/api/ai-routing/discovery-summary", {
      method: "PATCH",
      body: {}
    });
    await expectUnauthorized(baseUrl, "/api/email-settings");
    await expectUnauthorized(baseUrl, "/api/email-settings", {
      method: "PATCH",
      body: {}
    });
    await expectUnauthorized(baseUrl, "/api/email-oauth/google");
    await expectUnauthorized(baseUrl, "/api/email-oauth/google", {
      method: "PATCH",
      body: {}
    });
    await expectUnauthorized(baseUrl, "/api/email-oauth/google", {
      method: "DELETE"
    });
    await expectUnauthorized(baseUrl, "/api/email-oauth/google/start", {
      method: "POST",
      body: {}
    });
    await expectUnauthorized(baseUrl, "/api/email-oauth/google/callback", {
      method: "POST",
      body: {}
    });
    await expectUnauthorized(baseUrl, "/api/products");
    await expectUnauthorized(baseUrl, "/api/products", {
      method: "POST",
      body: {}
    });
    await expectUnauthorized(baseUrl, "/api/products/test-product", {
      method: "PATCH",
      body: {}
    });
    await expectUnauthorized(baseUrl, "/api/agents");
    await expectUnauthorized(baseUrl, "/api/agents", {
      method: "POST",
      body: {}
    });
    await expectUnauthorized(baseUrl, "/api/agents/test-agent", {
      method: "PATCH",
      body: {}
    });
    await expectUnauthorized(baseUrl, "/api/delivery-templates");
    await expectUnauthorized(baseUrl, "/api/delivery-templates", {
      method: "POST",
      body: {}
    });
    await expectUnauthorized(baseUrl, "/api/delivery-templates/test-template", {
      method: "PATCH",
      body: {}
    });
    await expectUnauthorized(baseUrl, "/api/work-requests");
    await expectUnauthorized(baseUrl, "/api/work-requests", {
      method: "POST",
      body: {}
    });
    await expectUnauthorized(baseUrl, "/api/work-requests/test-request", {
      method: "PATCH",
      body: {}
    });
    await expectUnauthorized(
      baseUrl,
      "/api/work-requests/test-request/convert",
      {
        method: "POST",
        body: {}
      }
    );
    await expectUnauthorized(
      baseUrl,
      "/api/work-requests/test-request/append-to-delivery",
      {
        method: "POST",
        body: {}
      }
    );
    await expectUnauthorized(baseUrl, "/api/hubspot/agent-capabilities");
    await expectUnauthorized(baseUrl, "/api/hubspot/agent-execute", {
      method: "POST",
      body: {}
    });
    await expectUnauthorized(baseUrl, "/api/hubspot/oauth/start", {
      method: "POST",
      body: {}
    });
    await expectUnauthorized(baseUrl, "/api/hubspot/oauth/callback", {
      method: "POST",
      body: {}
    });
    await expectUnauthorized(baseUrl, "/api/portals");
    await expectUnauthorized(baseUrl, "/api/portals", {
      method: "POST",
      body: {}
    });
    await expectUnauthorized(baseUrl, "/api/clients");
    await expectUnauthorized(baseUrl, "/api/clients", {
      method: "POST",
      body: {}
    });
    await expectUnauthorized(baseUrl, "/api/clients/test-client", {
      method: "PATCH",
      body: {}
    });
    await expectUnauthorized(baseUrl, "/api/clients/test-client", {
      method: "DELETE"
    });
    await expectUnauthorized(baseUrl, "/api/clients/test-client/enrich", {
      method: "POST",
      body: {}
    });
    await expectUnauthorized(baseUrl, "/api/clients/test-client/contacts", {
      method: "POST",
      body: {}
    });
    await expectUnauthorized(
      baseUrl,
      "/api/clients/test-client/contacts/test-contact",
      {
        method: "PATCH",
        body: {}
      }
    );
    await expectUnauthorized(
      baseUrl,
      "/api/clients/test-client/contacts/test-contact/portal-access",
      {
        method: "POST",
        body: {}
      }
    );
    await expectUnauthorized(
      baseUrl,
      "/api/projects/test-project/client-users"
    );
    await expectUnauthorized(
      baseUrl,
      "/api/projects/test-project/client-users",
      {
        method: "POST",
        body: {}
      }
    );
    await expectUnauthorized(
      baseUrl,
      "/api/projects/test-project/client-users/test-user",
      {
        method: "PATCH",
        body: {}
      }
    );
    await expectUnauthorized(
      baseUrl,
      "/api/projects/test-project/client-users/test-user/invite-link",
      {
        method: "POST",
        body: {}
      }
    );
    await expectUnauthorized(
      baseUrl,
      "/api/projects/test-project/client-users/test-user/reset-link",
      {
        method: "POST",
        body: {}
      }
    );
  } finally {
    await stopServer(server);
  }
});

test("guards client Hono routes without a client auth cookie", async () => {
  const { server, baseUrl } = await startServer();

  try {
    await expectClientUnauthorized(baseUrl, "/api/client/inbox");
    await expectClientUnauthorized(baseUrl, "/api/client/inbox/summary");
    await expectClientUnauthorized(baseUrl, "/api/client/projects");
    await expectClientUnauthorized(
      baseUrl,
      "/api/client/projects/test-project"
    );
    await expectClientUnauthorized(
      baseUrl,
      "/api/client/projects/test-project/submissions/1",
      {
        method: "PATCH",
        body: {}
      }
    );
    await expectClientUnauthorized(
      baseUrl,
      "/api/client/projects/test-project/tasks"
    );
    await expectClientUnauthorized(
      baseUrl,
      "/api/client/projects/test-project/quote"
    );
    await expectClientUnauthorized(
      baseUrl,
      "/api/client/projects/test-project/quote/approve",
      {
        method: "POST",
        body: {}
      }
    );
    await expectClientUnauthorized(
      baseUrl,
      "/api/client/projects/test-project/messages"
    );
    await expectClientUnauthorized(
      baseUrl,
      "/api/client/projects/test-project/messages",
      {
        method: "POST",
        body: {}
      }
    );
    await expectClientUnauthorized(baseUrl, "/api/client/work-requests");
    await expectClientUnauthorized(baseUrl, "/api/client/work-requests", {
      method: "POST",
      body: {}
    });
  } finally {
    await stopServer(server);
  }
});

test("returns industry options from the Hono system routes", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const authCookie = await loginAndGetCookie(baseUrl);
    const { response, body } = await requestJson(baseUrl, "/api/industries", {
      headers: {
        Cookie: authCookie
      }
    });

    assert.equal(response.status, 200);
    assert.equal(Array.isArray(body.industries), true);
    assert.equal(body.industries.includes("SaaS & Technology"), true);
  } finally {
    await stopServer(server);
  }
});

test("returns template list and detail from the Hono metadata routes", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const authCookie = await loginAndGetCookie(baseUrl);
    const listResult = await requestJson(baseUrl, "/api/templates", {
      headers: {
        Cookie: authCookie
      }
    });

    assert.equal(listResult.response.status, 200);
    assert.equal(Array.isArray(listResult.body.templates), true);
    assert.equal(listResult.body.templates.length > 0, true);

    const firstTemplate = listResult.body.templates[0];
    const detailResult = await requestJson(
      baseUrl,
      `/api/templates/${firstTemplate.id}`,
      {
        headers: {
          Cookie: authCookie
        }
      }
    );

    assert.equal(detailResult.response.status, 200);
    assert.equal(detailResult.body.template.id, firstTemplate.id);
  } finally {
    await stopServer(server);
  }
});

test("returns validation summary from the Hono metadata routes", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const authCookie = await loginAndGetCookie(baseUrl);
    const { response, body } = await requestJson(
      baseUrl,
      "/api/projects/validation-summary",
      {
        headers: {
          Cookie: authCookie
        }
      }
    );

    assert.equal(response.status, 200);
    assert.equal(Array.isArray(body.validations), true);
  } finally {
    await stopServer(server);
  }
});
