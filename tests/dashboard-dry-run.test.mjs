import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";

const { runMarketingDashboardAgent } = await import(
  "../packages/executor/dist/index.js"
);

test("marketing dashboard dry-run plans reports without write calls", async () => {
  const fetchCalls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, init = {}) => {
    fetchCalls.push({
      url: String(url),
      method: init.method ?? "GET"
    });

    return new Response(
      JSON.stringify({
        id: "prop-ok",
        name: "stubbed_property"
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  };

  const prisma = {
    workspaceApiKey: {
      findUnique: async () => null
    },
    portalSession: {
      findUnique: async () => null,
      findFirst: async () => ({
        id: "session-1",
        portalId: "146339210",
        valid: true,
        csrfToken: "csrf-token",
        baseUrl: "https://app-eu1.hubspot.com"
      })
    },
    executionJob: {
      update: async () => null
    }
  };

  try {
    const result = await runMarketingDashboardAgent({
      jobId: "job-1",
      projectId: "project-1",
      portalId: "146339210",
      workspaceId: "default",
      prisma,
      dryRun: true
    });

    assert.equal(result.status, "plan_only");
    assert.ok(
      result.reportsCreated.filter((report) => report.status === "planned")
        .length >= 1
    );
    assert.ok(fetchCalls.length >= 1);
    assert.ok(fetchCalls.every((call) => call.method === "GET"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
