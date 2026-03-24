import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://smoke:smoke@127.0.0.1:5432/muloo_smoke";
process.env.SIMPLE_AUTH_USERNAME = "smoke-user";
process.env.SIMPLE_AUTH_PASSWORD = "smoke-pass";

const { createAppServer } = await import("../apps/api/dist/server.js");

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
