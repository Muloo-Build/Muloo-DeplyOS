"use client";

import { useEffect, useMemo, useState } from "react";

interface HubSpotPortalOption {
  id: string;
  portalId: string;
  displayName: string;
  connected: boolean;
  connectedEmail?: string | null;
}

interface PortalSnapshot {
  capturedAt: string;
  hubTier?: string | null;
  activeHubs: string[];
  contactPropertyCount?: number | null;
  dealPropertyCount?: number | null;
  customObjectCount?: number | null;
}

interface PortalSessionValidityResponse {
  sessionExists: boolean;
  sessionId: string | null;
  capturedAt?: string;
  capturedBy?: string | null;
  privateAppTokenConfigured?: boolean;
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

interface WorkflowRun {
  id: string;
  workflowKey: string;
  title: string;
  status: string;
  resultStatus: string | null;
  summary: string | null;
  createdAt: string;
}

interface PortalExecutionRun {
  id: string;
  type: "agent" | "workflow";
  name: string;
  status: string;
  resultStatus: string | null;
  createdAt: string;
  summary?: string | null;
  executionTierLabel?: string | null;
}

interface HubSpotAgentRequestResponse {
  request: string;
  dryRun: boolean;
  plan: HubSpotAgentRequestPlan;
  execution: HubSpotAgentRequestExecution | null;
  run?: WorkflowRun;
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

const MASKED_PRIVATE_APP_TOKEN = "pat-••••••••••••••••••••••••";

function formatSupportMode(value: HubSpotAgentRequestPlan["mode"]) {
  return value === "execute_action" ? "Ready to execute" : "Manual plan";
}

function formatLabel(value: string | null | undefined) {
  if (!value) return "Not set";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPortalRequestErrorMessage(
  body: HubSpotAgentRequestResponse | { error?: string } | null
) {
  return body && "error" in body && typeof body.error === "string"
    ? body.error
    : "Failed to run portal request";
}

function getStatusTone(status: string | null | undefined) {
  switch (status) {
    case "completed":
    case "complete":
      return "brand-status-success";
    case "running":
    case "in_progress":
      return "brand-status-info";
    case "failed":
      return "brand-status-danger";
    default:
      return "brand-status-warning";
  }
}

function getPortalHealth(
  portal: HubSpotPortalOption | null,
  snapshot: PortalSnapshot | null
) {
  if (!portal || !portal.connected) {
    return {
      label: "Disconnected",
      dot: "bg-status-error",
      badge: "brand-status-danger"
    };
  }

  if (!snapshot) {
    return {
      label: "Snapshot needed",
      dot: "bg-status-warning",
      badge: "brand-status-warning"
    };
  }

  const snapshotAgeMs = Date.now() - new Date(snapshot.capturedAt).getTime();
  if (snapshotAgeMs > 24 * 60 * 60 * 1000) {
    return {
      label: "Snapshot stale",
      dot: "bg-status-warning",
      badge: "brand-status-warning"
    };
  }

  return {
    label: "Connected",
    dot: "bg-brand-teal",
    badge: "brand-status-success"
  };
}

function inferExecutionTier(
  responseBody: HubSpotAgentRequestResponse | null
): "API" | "Browser Session" | "Cowork" | "Manual" {
  if (!responseBody) {
    return "Manual";
  }

  if (responseBody.plan.mode === "manual_plan") {
    return "Manual";
  }

  const sourceText = [
    responseBody.plan.action,
    responseBody.plan.summary,
    responseBody.plan.capabilityKey
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (sourceText.includes("browser")) {
    return "Browser Session";
  }

  if (sourceText.includes("cowork")) {
    return "Cowork";
  }

  return "API";
}

function inferRunExecutionTier(
  run: PortalExecutionRun
): "API" | "Browser Session" | "Cowork" | "Manual" {
  const sourceText = [
    run.executionTierLabel,
    run.resultStatus,
    run.summary
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (sourceText.includes("manual")) {
    return "Manual";
  }

  if (sourceText.includes("browser")) {
    return "Browser Session";
  }

  if (sourceText.includes("cowork")) {
    return "Cowork";
  }

  return "API";
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
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [recentRuns, setRecentRuns] = useState<PortalExecutionRun[]>([]);
  const [snapshot, setSnapshot] = useState<PortalSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [privateAppToken, setPrivateAppToken] = useState("");
  const [privateAppTokenConfigured, setPrivateAppTokenConfigured] =
    useState(false);
  const [savingPrivateAppToken, setSavingPrivateAppToken] = useState(false);
  const [privateAppTokenSaved, setPrivateAppTokenSaved] = useState(false);

  useEffect(() => {
    async function loadCapabilities() {
      try {
        const response = await fetch("/api/hubspot/agent-capabilities");

        if (!response.ok) {
          throw new Error("Failed to load connected client portals");
        }

        const body = (await response.json()) as HubSpotCapabilitiesResponse;
        setCapabilities(body);

        const defaultPortal =
          body.portals.find(
            (portal) => portal.id === body.connection.portalRecordId
          ) ?? body.portals.find((portal) => portal.connected);

        if (defaultPortal) {
          setPortalRecordId(defaultPortal.id);
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

  const portalOptions = useMemo(
    () => capabilities?.portals ?? [],
    [capabilities]
  );

  const selectedPortal = useMemo(
    () => portalOptions.find((portal) => portal.id === portalRecordId) ?? null,
    [portalOptions, portalRecordId]
  );

  const portalHealth = useMemo(
    () => getPortalHealth(selectedPortal, snapshot),
    [selectedPortal, snapshot]
  );

  useEffect(() => {
    async function loadPortalMeta() {
      if (!portalRecordId) {
        setSnapshot(null);
        setWorkflowRuns([]);
        setRecentRuns([]);
        setPrivateAppToken("");
        setPrivateAppTokenConfigured(false);
        setPrivateAppTokenSaved(false);
        return;
      }

      setSnapshotLoading(true);

      try {
        const [
          snapshotResponse,
          workflowRunsResponse,
          executionRunsResponse,
          portalSessionResponse
        ] =
          await Promise.all([
            fetch(`/api/portals/${encodeURIComponent(portalRecordId)}/snapshot`),
            fetch(
              `/api/portals/${encodeURIComponent(portalRecordId)}/workflow-runs`
            ),
            fetch(
              `/api/execution-jobs?portalId=${encodeURIComponent(
                portalRecordId
              )}&limit=5`
            ),
            fetch(
              `/api/portal-session/${encodeURIComponent(portalRecordId)}/valid`
            )
          ]);

        const snapshotBody = await snapshotResponse.json().catch(() => null);
        const workflowRunsBody = await workflowRunsResponse
          .json()
          .catch(() => null);
        const executionRunsBody = await executionRunsResponse
          .json()
          .catch(() => null);
        const portalSessionBody = (await portalSessionResponse
          .json()
          .catch(() => null)) as PortalSessionValidityResponse | null;

        setSnapshot(snapshotResponse.ok ? snapshotBody?.snapshot ?? null : null);
        setWorkflowRuns(workflowRunsBody?.workflowRuns ?? []);
        setRecentRuns(executionRunsBody?.runs ?? []);
        const configured = Boolean(
          portalSessionBody?.privateAppTokenConfigured && portalSessionBody.sessionExists
        );
        setPrivateAppTokenConfigured(configured);
        setPrivateAppToken(configured ? MASKED_PRIVATE_APP_TOKEN : "");
        setPrivateAppTokenSaved(false);
      } catch {
        setSnapshot(null);
        setWorkflowRuns([]);
        setRecentRuns([]);
        setPrivateAppToken("");
        setPrivateAppTokenConfigured(false);
        setPrivateAppTokenSaved(false);
      } finally {
        setSnapshotLoading(false);
      }
    }

    void loadPortalMeta();
  }, [portalRecordId]);

  async function submitRequest(mode: "plan" | "execute") {
    if (!portalRecordId) {
      setError("Select a client portal before submitting the request.");
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
      if (body && typeof body === "object" && "run" in body && body.run) {
        const queuedRun: PortalExecutionRun = {
          id: (body.run as WorkflowRun).id,
          type: "workflow",
          name: (body.run as WorkflowRun).title,
          status: (body.run as WorkflowRun).status,
          resultStatus: (body.run as WorkflowRun).resultStatus,
          createdAt: (body.run as WorkflowRun).createdAt,
          summary: (body.run as WorkflowRun).summary,
          executionTierLabel:
            (body as HubSpotAgentRequestResponse).plan.mode === "manual_plan"
              ? "Manual"
              : "API"
        };

        setWorkflowRuns((currentRuns) => [
          body.run as WorkflowRun,
          ...currentRuns.filter((run) => run.id !== (body.run as WorkflowRun).id)
        ]);
        setRecentRuns((currentRuns) => [
          queuedRun,
          ...currentRuns.filter((run) => run.id !== (body.run as WorkflowRun).id)
        ].slice(0, 5));
      }
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

  async function savePrivateAppToken() {
    if (!portalRecordId) {
      setError("Select a client portal before saving the private app token.");
      return;
    }

    const trimmedToken = privateAppToken.trim();

    if (!trimmedToken || trimmedToken === MASKED_PRIVATE_APP_TOKEN) {
      setError("Paste a private app token before saving.");
      return;
    }

    setSavingPrivateAppToken(true);
    setPrivateAppTokenSaved(false);
    setError(null);

    try {
      const response = await fetch(
        `/api/portal-sessions/${encodeURIComponent(portalRecordId)}/token`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            privateAppToken: trimmedToken
          })
        }
      );

      const body = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(body?.error || "Failed to save private app token");
      }

      setPrivateAppTokenConfigured(true);
      setPrivateAppToken(MASKED_PRIVATE_APP_TOKEN);
      setPrivateAppTokenSaved(true);
    } catch (tokenError) {
      setError(
        tokenError instanceof Error
          ? tokenError.message
          : "Failed to save private app token"
      );
    } finally {
      setSavingPrivateAppToken(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="brand-surface rounded-3xl border p-6 sm:p-8">
        <p className="text-sm uppercase tracking-[0.25em] text-text-muted">
          Operations
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Portal Ops</h1>
        <p className="mt-3 max-w-4xl text-sm text-text-secondary sm:text-base">
          Run practical HubSpot requests against a specific client portal, check
          the connection health first, and keep recent execution history visible
          while you work.
        </p>
      </section>

      {error ? (
        <div className="rounded-2xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-white">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="brand-surface rounded-3xl border p-6 text-sm text-text-secondary">
          Loading connected client portals...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_22rem]">
          <div className="space-y-6">
            <section className="brand-surface rounded-3xl border p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                    Client Portal
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Choose the portal to work against
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-text-secondary">
                    This is still the same Portal Ops request flow, just with
                    stronger visibility into connection health and recent
                    execution history.
                  </p>
                </div>
                <div
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.18em] ${portalHealth.badge}`}
                >
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${portalHealth.dot}`} />
                  {portalHealth.label}
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                <select
                  value={portalRecordId}
                  onChange={(event) => setPortalRecordId(event.target.value)}
                  className="brand-input w-full rounded-2xl px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="">Select a client portal</option>
                  {portalOptions.map((portal) => (
                    <option key={portal.id} value={portal.id}>
                      {portal.displayName} · {portal.portalId} ·{" "}
                      {portal.connected ? "Connected" : "Disconnected"}
                    </option>
                  ))}
                </select>

                <div className="brand-surface-soft rounded-2xl border px-4 py-3 text-sm text-text-secondary">
                  {portalOptions.filter((portal) => portal.connected).length} connected
                </div>
              </div>

              {selectedPortal ? (
                <div className="brand-surface-soft mt-5 rounded-2xl border p-5">
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
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
                      <div
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.18em] ${portalHealth.badge}`}
                      >
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-full ${portalHealth.dot}`}
                        />
                        {portalHealth.label}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="mb-4 text-xs text-text-secondary">
                        <span className="font-semibold text-white">Optional.</span>{" "}
                        Your existing OAuth connection already supports property and workflow creation — you don't need to add anything here unless you want a long-lived token for automated runs that won't need re-authentication.
                      </p>
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                        <div className="min-w-0 flex-1">
                          <label
                            htmlFor="portal-private-app-token"
                            className="text-xs uppercase tracking-[0.18em] text-text-muted"
                          >
                            Private App Token{" "}
                            <span className="ml-1 normal-case tracking-normal text-text-muted">
                              — optional
                            </span>
                          </label>
                          <input
                            id="portal-private-app-token"
                            type="password"
                            value={privateAppToken}
                            onFocus={() => {
                              if (
                                privateAppToken === MASKED_PRIVATE_APP_TOKEN
                              ) {
                                setPrivateAppToken("");
                                setPrivateAppTokenSaved(false);
                              }
                            }}
                            onChange={(event) => {
                              setPrivateAppToken(event.target.value);
                              setPrivateAppTokenSaved(false);
                            }}
                            placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                            className="brand-input mt-3 w-full rounded-2xl px-4 py-3 text-sm text-white outline-none placeholder:text-text-muted"
                          />
                          <p className="mt-3 text-xs text-text-secondary">
                            To create one: in the client's HubSpot go to{" "}
                            <strong className="text-white">Settings → Integrations → Private Apps → Create app</strong>.
                            Name it "Muloo DeployOS", add scopes:{" "}
                            <code className="text-text-primary">crm.schemas.contacts.write</code>,{" "}
                            <code className="text-text-primary">crm.objects.contacts.write</code>,{" "}
                            <code className="text-text-primary">automation</code>,{" "}
                            <code className="text-text-primary">content</code>.
                            Then copy the token and paste above.
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 lg:items-end">
                          <button
                            type="button"
                            onClick={() => void savePrivateAppToken()}
                            disabled={
                              savingPrivateAppToken ||
                              !portalRecordId ||
                              !privateAppToken.trim() ||
                              privateAppToken.trim() ===
                                MASKED_PRIVATE_APP_TOKEN
                            }
                            className="rounded-xl bg-muloo-gradient px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                          >
                            {savingPrivateAppToken ? "Saving..." : "Save token"}
                          </button>
                          <div className="flex flex-wrap gap-2">
                            {privateAppTokenConfigured ? (
                              <span className="brand-status-success rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em]">
                                Configured
                              </span>
                            ) : (
                              <span className="brand-status-warning rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em]">
                                Not saved yet
                              </span>
                            )}
                            {privateAppTokenSaved ? (
                              <span className="rounded-full border border-status-success/30 bg-status-success/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white">
                                Saved
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-text-secondary">
                  Select a portal to start a direct execution request.
                </div>
              )}
            </section>

            <section className="brand-surface rounded-3xl border p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                    Request
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Tell the portal operator exactly what to do
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setRequestText(starterRequest)}
                  className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-white transition hover:border-brand-teal/60"
                >
                  Load example brief
                </button>
              </div>

              <textarea
                value={requestText}
                onChange={(event) => setRequestText(event.target.value)}
                className="brand-input mt-5 min-h-[360px] w-full rounded-2xl px-4 py-4 text-sm text-white outline-none placeholder:text-text-muted"
              />

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void submitRequest("plan")}
                  disabled={submittingMode !== null}
                  className="brand-input rounded-xl px-4 py-3 text-sm font-medium text-white transition hover:border-brand-teal/60 disabled:opacity-60"
                >
                  {submittingMode === "plan" ? "Planning..." : "Plan request"}
                </button>
                <button
                  type="button"
                  onClick={() => void submitRequest("execute")}
                  disabled={submittingMode !== null}
                  className="rounded-xl bg-muloo-gradient px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {submittingMode === "execute"
                    ? "Executing..."
                    : "Run if supported"}
                </button>
              </div>
            </section>

            <section className="brand-surface rounded-3xl border p-6">
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                Outcome
              </p>
              <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <h2 className="text-xl font-semibold text-white">Execution path</h2>
                {responseBody ? (
                  <div className="flex flex-wrap gap-2">
                    {responseBody.plan.capabilityKey ? (
                      <span className="rounded-full border border-brand-purple/30 bg-brand-purple/12 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white">
                        {responseBody.plan.capabilityKey}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-text-secondary">
                      {inferExecutionTier(responseBody)}
                    </span>
                  </div>
                ) : null}
              </div>

              {responseBody ? (
                <div className="mt-5 space-y-5">
                  <div className="brand-surface-soft rounded-2xl border p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-text-secondary">
                        {formatSupportMode(responseBody.plan.mode)}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-text-secondary">
                        {inferExecutionTier(responseBody)}
                      </span>
                    </div>
                    <p className="mt-4 text-sm font-medium text-white">
                      {responseBody.plan.summary}
                    </p>
                    {responseBody.plan.action ? (
                      <p className="mt-2 text-sm text-text-secondary">
                        Direct action:{" "}
                        <span className="text-white">{responseBody.plan.action}</span>
                      </p>
                    ) : null}
                  </div>

                  {responseBody.plan.manualPlan.length > 0 ? (
                    <div className="brand-surface-soft rounded-2xl border p-5">
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
                    <div className="rounded-2xl border border-status-warning/25 bg-status-warning/10 p-5">
                      <p className="text-sm font-semibold text-white">Cautions</p>
                      <ul className="mt-3 space-y-2 text-sm text-white">
                        {responseBody.plan.cautions.map((caution) => (
                          <li key={caution}>{caution}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {responseBody.execution ? (
                    <div className="rounded-2xl border border-status-success/25 bg-status-success/10 p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">
                          Execution result
                        </p>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-text-secondary">
                          {inferExecutionTier(responseBody)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-text-secondary">
                        {responseBody.execution.dryRun
                          ? "Dry run preview returned."
                          : "Live execution completed."}
                      </p>
                      <pre className="brand-surface mt-4 max-h-[280px] overflow-auto rounded-2xl border p-4 text-xs text-text-secondary">
                        {JSON.stringify(responseBody.execution, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-text-secondary">
                  Submit a plan or execution request to render the outcome path here.
                </div>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <section className="brand-surface rounded-3xl border p-6">
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                Portal Health
              </p>
              <div className="mt-3 flex items-center gap-3">
                <span
                  className={`inline-block h-3 w-3 rounded-full ${portalHealth.dot}`}
                />
                <p className="text-lg font-semibold text-white">
                  {portalHealth.label}
                </p>
              </div>

              <div className="mt-5 space-y-2 text-sm text-text-secondary">
                <p>
                  Provider:{" "}
                  {capabilities?.connection.providerEnabled ? "Enabled" : "Disabled"}
                </p>
                <p>Source: {capabilities?.connection.source ?? "Not set"}</p>
                <p>Base URL: {capabilities?.connection.baseUrl ?? "Not set"}</p>
                <p>
                  Snapshot:{" "}
                  {snapshot
                    ? new Date(snapshot.capturedAt).toLocaleString("en-ZA")
                    : "No snapshot captured yet"}
                </p>
                <p>Hub tier: {snapshot?.hubTier ?? "Not captured"}</p>
                <p>
                  Private app token:{" "}
                  {privateAppTokenConfigured ? "Saved" : "Not configured"}
                </p>
              </div>

              {snapshotLoading ? (
                <p className="mt-4 text-sm text-text-muted">Refreshing portal metadata...</p>
              ) : null}
            </section>

            <section className="brand-surface rounded-3xl border p-6">
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                Snapshot
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="brand-surface-soft rounded-2xl border p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                    Contacts
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {snapshot?.contactPropertyCount ?? "—"}
                  </p>
                </div>
                <div className="brand-surface-soft rounded-2xl border p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                    Deals
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {snapshot?.dealPropertyCount ?? "—"}
                  </p>
                </div>
                <div className="brand-surface-soft rounded-2xl border p-4 sm:col-span-2 xl:col-span-1">
                  <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                    Custom objects
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {snapshot?.customObjectCount ?? "—"}
                  </p>
                </div>
              </div>
            </section>

            <section className="brand-surface rounded-3xl border p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                    Recent Runs
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-white">
                    Latest portal activity
                  </h3>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-text-secondary">
                  {recentRuns.length} runs
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {recentRuns.length > 0 ? (
                  recentRuns.map((run) => (
                    <div
                      key={run.id}
                      className="brand-surface-soft rounded-2xl border p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">{run.name}</p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] ${getStatusTone(
                            run.status
                          )}`}
                        >
                          {formatLabel(run.status)}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-text-secondary">
                          {inferRunExecutionTier(run)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-text-secondary">
                        {new Date(run.createdAt).toLocaleString("en-ZA")}
                        {run.resultStatus ? ` · ${formatLabel(run.resultStatus)}` : ""}
                      </p>
                    </div>
                  ))
                ) : workflowRuns.length > 0 ? (
                  workflowRuns.slice(0, 5).map((run) => (
                    <div
                      key={run.id}
                      className="brand-surface-soft rounded-2xl border p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">
                          {run.summary || run.title}
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] ${getStatusTone(
                            run.status
                          )}`}
                        >
                          {formatLabel(run.status)}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-text-secondary">
                          {run.resultStatus === "manual_plan" ? "Manual" : "API"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-text-secondary">
                        {new Date(run.createdAt).toLocaleString("en-ZA")}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-text-secondary">
                    No portal runs recorded yet for this selection.
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
