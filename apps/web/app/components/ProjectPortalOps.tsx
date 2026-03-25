"use client";

import { useEffect, useMemo, useState } from "react";

interface HubSpotPortalOption {
  id: string;
  portalId: string;
  displayName: string;
  connected: boolean;
  connectedEmail?: string | null;
}

interface HubSpotCapabilitiesResponse {
  connection: {
    ready: boolean;
    source: string;
    baseUrl: string;
    portalId: string | null;
    portalRecordId: string | null;
    portalDisplayName: string | null;
    providerEnabled: boolean;
  };
  portals: HubSpotPortalOption[];
}

interface HubSpotAgentRequestPlan {
  mode: "execute_action" | "manual_plan";
  summary: string;
  capabilityKey?: string | null;
  action?: string | null;
  input?: Record<string, unknown> | null;
  manualPlan: string[];
  cautions: string[];
}

interface HubSpotAgentRequestExecution {
  dryRun: boolean;
  action: string;
  connection?: {
    portalDisplayName?: string | null;
    portalId?: string | null;
  };
  result?: unknown;
}

interface HubSpotAgentRequestResponse {
  request: string;
  dryRun: boolean;
  plan: HubSpotAgentRequestPlan;
  execution: HubSpotAgentRequestExecution | null;
}

const starterRequest = `I need you to help me execute a Marketing Dashboard setup inside HubSpot step by step.

Context:
We are building a practical first version of a marketing reporting structure using the fields already available in the portal where possible, rather than overengineering campaign attribution. The goal is to create the supporting properties, workflows, reports, and dashboards needed to track marketing performance from MQL through to revenue.

Important constraints:
- Do not assume Enterprise-only features unless specifically confirmed
- Work with standard HubSpot reporting and workflow functionality
- Keep the setup simple, scalable, and realistic for the current portal
- Prefer using existing fields where they already exist instead of creating duplicate fields
- Where a field is manual today, still include it in the reporting structure and flag it as manual
- Do not create giant dropdown lists that will be difficult to maintain
- Focus on what can be built cleanly now

Current field decisions:
1. Use the existing contact property called "Primary Lead Source" as the main source reporting field instead of creating a large "MQL Source Campaign" dropdown
2. Create a contact property called "Last Key Action" as a dropdown select
3. Use standard HubSpot Lifecycle Stage and Lead Status where possible

Your task:
Give me a practical implementation plan that I can follow inside HubSpot.

Output format:
1. Recommended final data model
2. Properties to create or validate
3. Workflows to build
4. Reports to create
5. Dashboard structure
6. Fastest Version 1 plan
7. Risks, dependencies, and manual limitations`;

function formatSupportMode(value: HubSpotAgentRequestPlan["mode"]) {
  return value === "execute_action" ? "Ready to execute" : "Manual plan";
}

function getPortalRequestErrorMessage(
  body: HubSpotAgentRequestResponse | { error?: string } | null
) {
  return body && "error" in body && typeof body.error === "string"
    ? body.error
    : "Failed to run portal request";
}

export default function ProjectPortalOps() {
  const [capabilities, setCapabilities] =
    useState<HubSpotCapabilitiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portalRecordId, setPortalRecordId] = useState("");
  const [requestText, setRequestText] = useState(starterRequest);
  const [submittingMode, setSubmittingMode] = useState<
    "plan" | "execute" | null
  >(null);
  const [responseBody, setResponseBody] =
    useState<HubSpotAgentRequestResponse | null>(null);

  useEffect(() => {
    async function loadCapabilities() {
      try {
        const response = await fetch("/api/hubspot/agent-capabilities");

        if (!response.ok) {
          throw new Error("Failed to load connected client portals");
        }

        const body = (await response.json()) as HubSpotCapabilitiesResponse;
        setCapabilities(body);

        const firstConnectedPortal = body.portals.find((portal) => portal.connected);
        if (firstConnectedPortal) {
          setPortalRecordId(firstConnectedPortal.id);
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load connected client portals"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadCapabilities();
  }, []);

  const connectedPortals = useMemo(
    () => capabilities?.portals.filter((portal) => portal.connected) ?? [],
    [capabilities]
  );

  const selectedPortal = useMemo(
    () => connectedPortals.find((portal) => portal.id === portalRecordId) ?? null,
    [connectedPortals, portalRecordId]
  );

  async function submitRequest(mode: "plan" | "execute") {
    if (!portalRecordId) {
      setError("Select a connected client portal before submitting the request.");
      return;
    }

    if (!requestText.trim()) {
      setError("Enter the execution request for this portal.");
      return;
    }

    setSubmittingMode(mode);
    setError(null);

    try {
      const response = await fetch("/api/hubspot/agent-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          request: requestText,
          dryRun: mode !== "execute",
          portalRecordId
        })
      });

      const body = (await response.json().catch(() => null)) as
        | HubSpotAgentRequestResponse
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(getPortalRequestErrorMessage(body));
      }

      setResponseBody(body as HubSpotAgentRequestResponse);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to run portal request"
      );
    } finally {
      setSubmittingMode(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8">
        <p className="text-sm uppercase tracking-[0.25em] text-text-muted">
          Projects Tool
        </p>
        <h1 className="mt-3 text-3xl font-bold font-heading text-white">
          Portal Ops
        </h1>
        <p className="mt-3 max-w-4xl text-text-secondary">
          Run natural-language portal requests without turning them into PMO
          tasks first. Pick the client portal, describe the outcome you want,
          and let DeployOS return either a safe direct execution path or a
          practical implementation plan.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-[rgba(224,80,96,0.4)] bg-background-card p-4 text-sm text-white">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 text-text-secondary">
          Loading connected client portals...
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                    Client Portal
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Choose the portal to work against
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-text-secondary">
                    This tool is scoped to connected client portals only, so
                    the request can execute against the right HubSpot account.
                  </p>
                </div>
                <div className="rounded-2xl border border-[rgba(123,226,239,0.2)] bg-[rgba(123,226,239,0.08)] px-4 py-3 text-sm text-[#b7f5ff]">
                  {connectedPortals.length} connected portal
                  {connectedPortals.length === 1 ? "" : "s"}
                </div>
              </div>

              <select
                value={portalRecordId}
                onChange={(event) => setPortalRecordId(event.target.value)}
                className="mt-5 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
              >
                <option value="">Select a connected client portal</option>
                {connectedPortals.map((portal) => (
                  <option key={portal.id} value={portal.id}>
                    {portal.displayName} · {portal.portalId}
                    {portal.connectedEmail ? ` · ${portal.connectedEmail}` : ""}
                  </option>
                ))}
              </select>

              {selectedPortal ? (
                <div className="mt-5 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                    Selected Portal
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {selectedPortal.displayName}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Portal ID {selectedPortal.portalId}
                    {selectedPortal.connectedEmail
                      ? ` · Connected as ${selectedPortal.connectedEmail}`
                      : ""}
                  </p>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-[rgba(255,255,255,0.12)] bg-[#0b1126] p-5 text-sm text-text-secondary">
                  Select a portal to start a direct execution request.
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                How It Runs
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Plan first, then execute if supported
              </h2>
              <div className="mt-4 space-y-3 text-sm text-text-secondary">
                <p>
                  Use <span className="text-white">Plan request</span> when you
                  want a detailed build order, dashboard recipe, or execution
                  guide.
                </p>
                <p>
                  Use <span className="text-white">Run if supported</span> when
                  the request might map cleanly to a direct HubSpot action such
                  as property creation or record updates.
                </p>
                <p>
                  Requests for dashboards, reports, and workflow design usually
                  return a detailed implementation plan rather than pretending
                  the platform can click through every UI step automatically.
                </p>
              </div>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                    Request
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Tell the portal operator exactly what to do
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setRequestText(starterRequest)}
                  className="rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm font-medium text-white"
                >
                  Load example brief
                </button>
              </div>

              <textarea
                value={requestText}
                onChange={(event) => setRequestText(event.target.value)}
                className="mt-5 min-h-[520px] w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-4 text-sm text-white outline-none"
              />

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void submitRequest("plan")}
                  disabled={submittingMode !== null}
                  className="rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {submittingMode === "plan" ? "Planning..." : "Plan request"}
                </button>
                <button
                  type="button"
                  onClick={() => void submitRequest("execute")}
                  disabled={submittingMode !== null}
                  className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {submittingMode === "execute"
                    ? "Executing..."
                    : "Run if supported"}
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                Outcome
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Execution path
              </h2>

              {responseBody ? (
                <div className="mt-5 space-y-5">
                  <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">
                        {responseBody.plan.summary}
                      </p>
                      <span className="rounded-full bg-[rgba(123,226,239,0.12)] px-3 py-1 text-xs font-semibold text-[#7be2ef]">
                        {formatSupportMode(responseBody.plan.mode)}
                      </span>
                    </div>
                    {responseBody.plan.action ? (
                      <p className="mt-3 text-sm text-text-secondary">
                        Direct action:{" "}
                        <span className="text-white">
                          {responseBody.plan.action}
                        </span>
                      </p>
                    ) : null}
                    {responseBody.plan.capabilityKey ? (
                      <p className="mt-2 text-sm text-text-secondary">
                        Capability:{" "}
                        <span className="text-white">
                          {responseBody.plan.capabilityKey}
                        </span>
                      </p>
                    ) : null}
                  </div>

                  {responseBody.plan.manualPlan.length > 0 ? (
                    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5">
                      <p className="text-sm font-semibold text-white">
                        Recommended steps
                      </p>
                      <ol className="mt-3 space-y-3 text-sm text-text-secondary">
                        {responseBody.plan.manualPlan.map((step, index) => (
                          <li key={`${index}-${step}`}>
                            <span className="mr-2 text-white">{index + 1}.</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}

                  {responseBody.plan.cautions.length > 0 ? (
                    <div className="rounded-2xl border border-[rgba(255,214,102,0.22)] bg-[rgba(255,214,102,0.07)] p-5">
                      <p className="text-sm font-semibold text-white">
                        Cautions
                      </p>
                      <ul className="mt-3 space-y-2 text-sm text-[#ffe7a4]">
                        {responseBody.plan.cautions.map((caution) => (
                          <li key={caution}>{caution}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {responseBody.execution ? (
                    <div className="rounded-2xl border border-[rgba(45,212,160,0.25)] bg-[rgba(45,212,160,0.07)] p-5">
                      <p className="text-sm font-semibold text-white">
                        Execution result
                      </p>
                      <p className="mt-2 text-sm text-text-secondary">
                        {responseBody.execution.dryRun
                          ? "Dry run preview returned."
                          : "Live execution completed."}
                      </p>
                      <pre className="mt-4 max-h-[280px] overflow-auto rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#08101f] p-4 text-xs text-[#d5ddff]">
                        {JSON.stringify(responseBody.execution, null, 2)}
                      </pre>
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5">
                    <p className="text-sm font-semibold text-white">
                      Raw response
                    </p>
                    <pre className="mt-4 max-h-[320px] overflow-auto text-xs text-[#d5ddff]">
                      {JSON.stringify(responseBody, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="mt-5 flex min-h-[520px] items-center justify-center rounded-2xl border border-dashed border-[rgba(255,255,255,0.12)] bg-[#0b1126] p-6 text-center text-sm text-text-secondary">
                  The operator response will appear here with the recommended
                  build path, cautions, and any direct execution output.
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
