"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type HubSpotAgentActionKey =
  | "create_property_group"
  | "create_property"
  | "create_custom_object"
  | "create_pipeline"
  | "upsert_record";

interface HubSpotCapability {
  key: string;
  label: string;
  support: "supported" | "beta" | "external_best_path" | "not_recommended";
  recommendedPath:
    | "direct_rest_api"
    | "custom_workflow_action"
    | "custom_code_action"
    | "app_home_or_ui_extension"
    | "developer_mcp_or_cli"
    | "manual_or_review";
  summary: string;
  notes: string[];
  docs: Array<{
    label: string;
    url: string;
  }>;
  directActions?: HubSpotAgentActionKey[];
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
  portals: Array<{
    id: string;
    portalId: string;
    displayName: string;
    connected: boolean;
    connectedEmail?: string | null;
  }>;
  capabilities: HubSpotCapability[];
  supportedActions: HubSpotAgentActionKey[];
}

const actionExamples: Record<HubSpotAgentActionKey, string> = {
  create_property_group: JSON.stringify(
    {
      objectType: "contacts",
      name: "muloo_delivery",
      label: "Muloo Delivery",
      displayOrder: 900
    },
    null,
    2
  ),
  create_property: JSON.stringify(
    {
      objectType: "contacts",
      name: "muloo_scope_status",
      label: "Muloo Scope Status",
      type: "enumeration",
      fieldType: "select",
      groupName: "muloo_delivery",
      formField: false,
      options: [
        { label: "Discovery", value: "discovery" },
        { label: "Quoted", value: "quoted" },
        { label: "Approved", value: "approved" }
      ]
    },
    null,
    2
  ),
  create_custom_object: JSON.stringify(
    {
      name: "muloo_projects",
      singularLabel: "Muloo Project",
      pluralLabel: "Muloo Projects",
      primaryDisplayProperty: "project_name",
      secondaryDisplayProperties: ["project_stage"],
      searchableProperties: ["project_name", "project_stage"],
      requiredProperties: ["project_name"],
      associatedObjects: ["CONTACT", "COMPANY", "DEAL"],
      properties: [
        {
          name: "project_name",
          label: "Project Name",
          type: "string",
          fieldType: "text",
          groupName: "muloo_project_information"
        },
        {
          name: "project_stage",
          label: "Project Stage",
          type: "enumeration",
          fieldType: "select",
          options: [
            { label: "Discovery", value: "discovery" },
            { label: "Quoted", value: "quoted" },
            { label: "Delivery", value: "delivery" }
          ]
        }
      ]
    },
    null,
    2
  ),
  create_pipeline: JSON.stringify(
    {
      objectType: "deals",
      label: "Muloo Delivery Pipeline",
      stages: [
        { label: "Discovery", displayOrder: 0, probability: 0.1 },
        { label: "Quoted", displayOrder: 1, probability: 0.4 },
        { label: "Approved", displayOrder: 2, probability: 0.8 }
      ]
    },
    null,
    2
  ),
  upsert_record: JSON.stringify(
    {
      objectType: "contacts",
      idProperty: "email",
      id: "jarrud@muloo.co",
      properties: {
        firstname: "Jarrud",
        lastname: "van der Merwe",
        muloo_scope_status: "approved"
      }
    },
    null,
    2
  )
};

function supportClass(value: HubSpotCapability["support"]) {
  switch (value) {
    case "supported":
      return "bg-[rgba(45,212,160,0.16)] text-[#78f0c8]";
    case "beta":
      return "bg-[rgba(255,214,102,0.16)] text-[#ffd666]";
    case "external_best_path":
      return "bg-[rgba(123,226,239,0.16)] text-[#7be2ef]";
    default:
      return "bg-[rgba(224,80,96,0.16)] text-[#ff98a7]";
  }
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function HubSpotAgentWorkbench() {
  const [capabilities, setCapabilities] =
    useState<HubSpotCapabilitiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] =
    useState<HubSpotAgentActionKey>("create_property");
  const [payloadText, setPayloadText] = useState<string>(
    actionExamples.create_property
  );
  const [dryRun, setDryRun] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [resultText, setResultText] = useState<string>("");
  const [portalRecordId, setPortalRecordId] = useState<string>("");

  useEffect(() => {
    async function loadCapabilities() {
      try {
        const params = new URLSearchParams();
        if (portalRecordId.trim()) {
          params.set("portalRecordId", portalRecordId.trim());
        }
        const response = await fetch(
          `/api/hubspot/agent-capabilities${params.toString() ? `?${params.toString()}` : ""}`
        );
        if (!response.ok) {
          throw new Error("Failed to load HubSpot agent capabilities");
        }

        const body = (await response.json()) as HubSpotCapabilitiesResponse;
        setCapabilities(body);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load HubSpot agent capabilities"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadCapabilities();
  }, [portalRecordId]);

  async function executeAction() {
    setExecuting(true);
    setError(null);

    try {
      const parsedPayload = JSON.parse(payloadText) as Record<string, unknown>;
      const response = await fetch("/api/hubspot/agent-execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action,
          input: parsedPayload,
          dryRun,
          portalRecordId: portalRecordId.trim() || undefined
        })
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to execute HubSpot action");
      }

      setResultText(JSON.stringify(body, null, 2));
    } catch (executionError) {
      setError(
        executionError instanceof Error
          ? executionError.message
          : "Failed to execute HubSpot action"
      );
    } finally {
      setExecuting(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
          HubSpot Execution
        </p>
        <h2 className="mt-3 text-2xl font-bold font-heading text-white">
          HubSpot Agent Workbench
        </h2>
        <p className="mt-3 max-w-4xl text-text-secondary">
          This maps the safest execution path for HubSpot work. Use direct REST
          APIs for CRM schema and record operations, prefer custom workflow or
          custom code actions when automation must live inside HubSpot, and use
          developer projects, UI extensions, and MCP for CMS or app-level build
          work.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-[rgba(224,80,96,0.4)] bg-background-card p-4 text-sm text-white">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 text-text-secondary">
          Loading HubSpot execution capabilities...
        </div>
      ) : capabilities ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                Connection
              </p>
              <p className="mt-2 text-xl font-semibold text-white">
                {capabilities.connection.ready ? "Ready" : "Not configured"}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                Source: {formatLabel(capabilities.connection.source)}
              </p>
            </div>
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                Direct Actions
              </p>
              <p className="mt-2 text-xl font-semibold text-white">
                {capabilities.supportedActions.length}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                Mature REST execution paths
              </p>
            </div>
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                Base URL
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {capabilities.connection.baseUrl}
              </p>
            </div>
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                Portal ID
              </p>
              <p className="mt-2 text-xl font-semibold text-white">
                {capabilities.connection.portalId ?? "Not set"}
              </p>
            </div>
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                Active target
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {capabilities.connection.portalDisplayName ??
                  "Global fallback token"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
            <p className="text-sm font-medium text-white">Execution target</p>
            <p className="mt-2 text-sm text-text-secondary">
              Pick a connected HubSpot portal for agent execution. Leave it on
              the fallback only if you still need the older single-token path.
            </p>
            <select
              value={portalRecordId}
              onChange={(event) => setPortalRecordId(event.target.value)}
              className="mt-4 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none md:max-w-xl"
            >
              <option value="">Global fallback token</option>
              {capabilities.portals.map((portal) => (
                <option key={portal.id} value={portal.id}>
                  {portal.displayName} · {portal.portalId}
                  {portal.connected ? " · Connected" : " · Needs reconnect"}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {capabilities.capabilities.map((capability) => (
              <div
                key={capability.key}
                className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {capability.label}
                    </p>
                    <p className="mt-2 text-sm text-text-secondary">
                      {capability.summary}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${supportClass(
                      capability.support
                    )}`}
                  >
                    {formatLabel(capability.support)}
                  </span>
                </div>
                <p className="mt-4 text-xs uppercase tracking-[0.18em] text-text-muted">
                  Best path
                </p>
                <p className="mt-2 text-sm text-white">
                  {formatLabel(capability.recommendedPath)}
                </p>
                {capability.directActions?.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {capability.directActions.map((directAction) => (
                      <span
                        key={directAction}
                        className="rounded-full bg-[rgba(123,226,239,0.12)] px-3 py-1 text-xs font-medium text-[#7be2ef]"
                      >
                        {formatLabel(directAction)}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mt-4 space-y-2 text-sm text-text-secondary">
                  {capability.notes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  {capability.docs.map((doc) => (
                    <a
                      key={doc.url}
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs font-medium text-white"
                    >
                      {doc.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
              Portal Ops
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white">
              Natural-language portal requests now live in Projects
            </h3>
            <p className="mt-3 max-w-3xl text-sm text-text-secondary">
              Use the dedicated Portal Ops tool when you want to select a
              client portal and ask for a dashboard build, workflow plan, or
              scoped execution request without creating a PMO task first.
            </p>
            <Link
              href="/projects/portal-ops"
              className="mt-5 inline-flex rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white"
            >
              Open Portal Ops
            </Link>
          </div>

          <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                  Execution Console
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  Dry-run or execute mature HubSpot API actions
                </h3>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-white">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(event) => setDryRun(event.target.checked)}
                />
                Dry run only
              </label>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
              <div className="space-y-3">
                <label className="block">
                  <span className="text-sm font-medium text-white">Action</span>
                  <select
                    value={action}
                    onChange={(event) => {
                      const nextAction = event.target
                        .value as HubSpotAgentActionKey;
                      setAction(nextAction);
                      setPayloadText(actionExamples[nextAction]);
                    }}
                    className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                  >
                    {capabilities.supportedActions.map((supportedAction) => (
                      <option key={supportedAction} value={supportedAction}>
                        {formatLabel(supportedAction)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => void executeAction()}
                  disabled={executing}
                  className="w-full rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {executing
                    ? "Running..."
                    : dryRun
                      ? "Run dry preview"
                      : "Execute action"}
                </button>
                <p className="text-xs text-text-muted">
                  Live execution now prefers the selected connected HubSpot
                  portal. If no portal is selected, it falls back to the legacy
                  global token path.
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-white">
                    Payload JSON
                  </span>
                  <textarea
                    value={payloadText}
                    onChange={(event) => setPayloadText(event.target.value)}
                    className="mt-3 min-h-[360px] w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 font-mono text-sm text-white outline-none"
                  />
                </label>
                <div className="block">
                  <span className="text-sm font-medium text-white">Result</span>
                  <pre className="mt-3 min-h-[360px] overflow-auto rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4 font-mono text-sm text-[#d5ddff]">
                    {resultText || "Execution output will appear here."}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
