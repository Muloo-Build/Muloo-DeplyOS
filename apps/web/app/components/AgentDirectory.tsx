"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface AgentDefinition {
  id: string;
  slug: string;
  name: string;
  purpose: string;
  serviceFamily: string;
  provider: string;
  model: string;
  triggerType: string;
  approvalMode: string;
  allowedActions: string[];
  systemPrompt?: string | null;
  isActive: boolean;
  sortOrder: number;
  updatedAt?: string;
}

interface ProviderConnection {
  providerKey: string;
  label: string;
  defaultModel: string | null;
  isEnabled: boolean;
  hasApiKey: boolean;
}

interface AgentRunSummary {
  agentId: string;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  recentFailureCount: number;
}

interface AgentDraft {
  name: string;
  purpose: string;
  serviceFamily: string;
  provider: string;
  model: string;
  triggerType: string;
  approvalMode: string;
  allowedActionsText: string;
  systemPrompt: string;
  isActive: boolean;
  sortOrder: string;
}

const SERVICE_FAMILY_OPTIONS = [
  { value: "hubspot_architecture", label: "HubSpot Architecture" },
  { value: "custom_engineering", label: "Custom Engineering" },
  { value: "ai_automation", label: "AI Automation" }
];

const TRIGGER_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "assisted", label: "Assisted" },
  { value: "workflow", label: "Workflow" }
];

const APPROVAL_OPTIONS = [
  { value: "review_required", label: "Review required" },
  { value: "client_approval", label: "Client approval" },
  { value: "auto_allowed", label: "Auto allowed" }
];

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "failed_recently", label: "Failed in last 24h" }
];

type SortKey = "name" | "serviceFamily" | "lastRun" | "status" | "sortOrder";
type SortDir = "asc" | "desc";

function serviceFamilyLabel(value: string) {
  return (
    SERVICE_FAMILY_OPTIONS.find((option) => option.value === value)?.label ??
    value
  );
}

function formatRelative(value: string | null) {
  if (!value) return "—";
  const diffMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "—";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function emptyDraftFromAgent(agent: AgentDefinition): AgentDraft {
  return {
    name: agent.name,
    purpose: agent.purpose,
    serviceFamily: agent.serviceFamily,
    provider: agent.provider,
    model: agent.model,
    triggerType: agent.triggerType,
    approvalMode: agent.approvalMode,
    allowedActionsText: agent.allowedActions.join(", "),
    systemPrompt: agent.systemPrompt ?? "",
    isActive: agent.isActive,
    sortOrder: String(agent.sortOrder)
  };
}

function blankDraft(): AgentDraft {
  return {
    name: "",
    purpose: "",
    serviceFamily: "hubspot_architecture",
    provider: "anthropic",
    model: "",
    triggerType: "manual",
    approvalMode: "review_required",
    allowedActionsText: "",
    systemPrompt: "",
    isActive: true,
    sortOrder: "999"
  };
}

function sortIndicator(active: boolean, dir: SortDir) {
  if (!active) return " ↕";
  return dir === "asc" ? " ▲" : " ▼";
}

export default function AgentDirectory() {
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [providers, setProviders] = useState<ProviderConnection[]>([]);
  const [runSummaries, setRunSummaries] = useState<
    Record<string, AgentRunSummary>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<"closed" | "edit" | "create">(
    "closed"
  );
  const [draft, setDraft] = useState<AgentDraft>(blankDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("sortOrder");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const tableRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [agentsRes, providersRes, runsRes] = await Promise.allSettled([
          fetch("/api/agents"),
          fetch("/api/provider-connections"),
          fetch("/api/agents/run-summaries")
        ]);
        if (agentsRes.status === "rejected" || !agentsRes.value.ok) {
          throw new Error("Failed to load agents");
        }
        const body = (await agentsRes.value.json()) as {
          agents?: AgentDefinition[];
        };
        let providerList: ProviderConnection[] = [];
        if (providersRes.status === "fulfilled" && providersRes.value.ok) {
          const providersBody = (await providersRes.value.json()) as {
            providers?: ProviderConnection[];
          };
          providerList = (providersBody.providers ?? []).filter(
            (provider) => provider.isEnabled && provider.hasApiKey
          );
        }
        let runMap: Record<string, AgentRunSummary> = {};
        if (runsRes.status === "fulfilled" && runsRes.value.ok) {
          try {
            const runsBody = (await runsRes.value.json()) as {
              summaries?: AgentRunSummary[];
            };
            runMap = Object.fromEntries(
              (runsBody.summaries ?? []).map((entry) => [entry.agentId, entry])
            );
          } catch {
            runMap = {};
          }
        }
        if (!cancelled) {
          setAgents(body.agents ?? []);
          setProviders(providerList);
          setRunSummaries(runMap);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load agents"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        openMenuId &&
        tableRef.current &&
        !tableRef.current.contains(event.target as Node)
      ) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  // Side-panel a11y: Escape closes (when not saving), focus the close button on open.
  useEffect(() => {
    if (panelMode === "closed") return;
    closeButtonRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) {
        closePanel();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelMode, saving]);

  const displayed = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = agents.filter((agent) => {
      if (familyFilter !== "all" && agent.serviceFamily !== familyFilter) {
        return false;
      }
      if (statusFilter === "active" && !agent.isActive) return false;
      if (statusFilter === "inactive" && agent.isActive) return false;
      if (statusFilter === "failed_recently") {
        const summary = runSummaries[agent.id];
        if (!summary || summary.recentFailureCount <= 0) return false;
      }
      if (!query) return true;
      const haystack = [
        agent.name,
        agent.purpose,
        agent.provider,
        agent.model,
        agent.triggerType,
        agent.allowedActions.join(" ")
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });

    const directionFactor = sortDir === "asc" ? 1 : -1;
    const sorted = [...filtered].sort((left, right) => {
      switch (sortKey) {
        case "name":
          return left.name.localeCompare(right.name) * directionFactor;
        case "serviceFamily":
          return (
            serviceFamilyLabel(left.serviceFamily).localeCompare(
              serviceFamilyLabel(right.serviceFamily)
            ) * directionFactor
          );
        case "lastRun": {
          const leftAt = runSummaries[left.id]?.lastRunAt;
          const rightAt = runSummaries[right.id]?.lastRunAt;
          const leftMs = leftAt ? new Date(leftAt).getTime() : 0;
          const rightMs = rightAt ? new Date(rightAt).getTime() : 0;
          return (leftMs - rightMs) * directionFactor;
        }
        case "status": {
          const leftFailed = (runSummaries[left.id]?.recentFailureCount ?? 0) > 0;
          const rightFailed =
            (runSummaries[right.id]?.recentFailureCount ?? 0) > 0;
          if (leftFailed === rightFailed) {
            return (
              (runSummaries[left.id]?.lastRunStatus ?? "").localeCompare(
                runSummaries[right.id]?.lastRunStatus ?? ""
              ) * directionFactor
            );
          }
          return (leftFailed ? -1 : 1) * directionFactor;
        }
        case "sortOrder":
        default:
          if (left.sortOrder === right.sortOrder) {
            return left.name.localeCompare(right.name) * directionFactor;
          }
          return (left.sortOrder - right.sortOrder) * directionFactor;
      }
    });
    return sorted;
  }, [agents, search, familyFilter, statusFilter, runSummaries, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function openEditPanel(agent: AgentDefinition) {
    setEditingId(agent.id);
    setDraft(emptyDraftFromAgent(agent));
    setPanelMode("edit");
    setOpenMenuId(null);
  }

  function openCreatePanel() {
    setEditingId(null);
    const initialProvider = providers[0]?.providerKey ?? "anthropic";
    const initialModel = providers[0]?.defaultModel ?? "";
    setDraft({
      ...blankDraft(),
      provider: initialProvider,
      model: initialModel
    });
    setPanelMode("create");
  }

  function closePanel() {
    if (saving) return;
    setPanelMode("closed");
    setEditingId(null);
    setDraft(blankDraft());
  }

  async function toggleActive(agent: AgentDefinition) {
    setOpenMenuId(null);
    try {
      const response = await fetch(
        `/api/agents/${encodeURIComponent(agent.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !agent.isActive })
        }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to update agent");
      }
      setAgents((current) =>
        current.map((entry) => (entry.id === agent.id ? body.agent : entry))
      );
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Failed to update agent"
      );
    }
  }

  async function saveDraft() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: draft.name.trim(),
        purpose: draft.purpose.trim(),
        serviceFamily: draft.serviceFamily,
        provider: draft.provider,
        model: draft.model.trim(),
        triggerType: draft.triggerType,
        approvalMode: draft.approvalMode,
        allowedActions: draft.allowedActionsText
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
        systemPrompt: draft.systemPrompt.trim(),
        isActive: draft.isActive,
        sortOrder: Number(draft.sortOrder) || 999
      };

      if (panelMode === "create") {
        const response = await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.error ?? "Failed to create agent");
        }
        setAgents((current) =>
          [...current, body.agent].sort(
            (left, right) => left.sortOrder - right.sortOrder
          )
        );
      } else if (editingId) {
        const response = await fetch(
          `/api/agents/${encodeURIComponent(editingId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          }
        );
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.error ?? "Failed to update agent");
        }
        setAgents((current) =>
          current.map((entry) => (entry.id === editingId ? body.agent : entry))
        );
      }
      setSaving(false);
      setPanelMode("closed");
      setEditingId(null);
      setDraft(blankDraft());
      return;
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save agent"
      );
      setSaving(false);
    }
  }

  function renderSortableHeader(label: string, key: SortKey) {
    const active = sortKey === key;
    return (
      <th className="px-3 py-3" aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className="text-left uppercase tracking-[0.16em] text-text-muted hover:text-white"
        >
          {label}
          <span aria-hidden>{sortIndicator(active, sortDir)}</span>
        </button>
      </th>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-2xl border border-[rgba(224,80,96,0.4)] bg-background-card p-4 text-sm text-white">
          {error}
        </div>
      ) : null}

      <div className="brand-surface rounded-3xl border p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
              Agent Directory
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Operational agents
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {loading
                ? "Loading…"
                : `${displayed.length} of ${agents.length} agents`}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreatePanel}
            className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-2 text-sm font-medium text-white"
          >
            + New agent
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr,200px,200px]">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, purpose, provider, model, action…"
            className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none placeholder:text-text-muted"
          />
          <select
            value={familyFilter}
            onChange={(event) => setFamilyFilter(event.target.value)}
            className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
          >
            <option value="all">All service families</option>
            {SERVICE_FAMILY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
          >
            {STATUS_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div ref={tableRef} className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[960px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[18%]" />
              <col className="w-[26%]" />
              <col className="w-[14%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[6%]" />
              <col className="w-[4%]" />
            </colgroup>
            <thead>
              <tr className="text-xs">
                {renderSortableHeader("Name", "name")}
                <th className="px-3 py-3 uppercase tracking-[0.16em] text-text-muted">
                  Purpose
                </th>
                {renderSortableHeader("Service family", "serviceFamily")}
                <th className="px-3 py-3 uppercase tracking-[0.16em] text-text-muted">
                  Trigger
                </th>
                {renderSortableHeader("Last run", "lastRun")}
                {renderSortableHeader("Status", "status")}
                <th className="px-3 py-3 uppercase tracking-[0.16em] text-text-muted">
                  Active
                </th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-text-muted">
                    Loading agents…
                  </td>
                </tr>
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-text-muted">
                    No agents match these filters.
                  </td>
                </tr>
              ) : (
                displayed.map((agent) => {
                  const summary = runSummaries[agent.id];
                  const lastRun = summary?.lastRunAt ?? null;
                  const lastStatus = summary?.lastRunStatus ?? null;
                  const failed = (summary?.recentFailureCount ?? 0) > 0;
                  return (
                    <tr
                      key={agent.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Edit ${agent.name}`}
                      className="cursor-pointer border-t border-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.02)] focus:bg-[rgba(255,255,255,0.04)] focus:outline-none"
                      onClick={() => openEditPanel(agent)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openEditPanel(agent);
                        }
                      }}
                    >
                      <td className="px-3 py-3 align-top text-white">
                        <div className="font-medium">{agent.name}</div>
                        <div className="mt-1 text-xs text-text-muted">
                          {agent.provider} · {agent.model || "—"}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top text-text-secondary">
                        <div className="line-clamp-2">{agent.purpose}</div>
                      </td>
                      <td className="px-3 py-3 align-top text-text-secondary">
                        {serviceFamilyLabel(agent.serviceFamily)}
                      </td>
                      <td className="px-3 py-3 align-top text-text-secondary capitalize">
                        {agent.triggerType}
                      </td>
                      <td className="px-3 py-3 align-top text-text-secondary">
                        {formatRelative(lastRun)}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {failed ? (
                          <span className="inline-flex items-center rounded-full bg-[rgba(224,80,96,0.16)] px-2 py-0.5 text-xs font-medium text-[#ff98a7]">
                            Failed recently
                          </span>
                        ) : lastStatus ? (
                          <span className="inline-flex items-center rounded-full bg-[rgba(123,226,239,0.12)] px-2 py-0.5 text-xs font-medium text-[#7be2ef] capitalize">
                            {lastStatus.replace(/_/g, " ")}
                          </span>
                        ) : (
                          <span className="text-xs text-text-muted">
                            Never run
                          </span>
                        )}
                      </td>
                      <td
                        className="px-3 py-3 align-top"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <label
                          className="inline-flex cursor-pointer items-center"
                          aria-label={`Toggle active for ${agent.name}`}
                        >
                          <input
                            type="checkbox"
                            checked={agent.isActive}
                            onChange={() => void toggleActive(agent)}
                          />
                        </label>
                      </td>
                      <td
                        className="relative px-3 py-3 align-top text-right"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          aria-label={`Row actions for ${agent.name}`}
                          aria-haspopup="menu"
                          aria-expanded={openMenuId === agent.id}
                          onClick={() =>
                            setOpenMenuId(
                              openMenuId === agent.id ? null : agent.id
                            )
                          }
                          className="rounded-lg px-2 py-1 text-text-muted hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
                        >
                          ⋯
                        </button>
                        {openMenuId === agent.id ? (
                          <div
                            role="menu"
                            className="absolute right-3 top-10 z-10 w-44 overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] shadow-lg"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => openEditPanel(agent)}
                              className="block w-full px-4 py-2 text-left text-sm text-white hover:bg-[rgba(255,255,255,0.06)]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => void toggleActive(agent)}
                              className="block w-full px-4 py-2 text-left text-sm text-white hover:bg-[rgba(255,255,255,0.06)]"
                            >
                              {agent.isActive ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {panelMode !== "closed" ? (
        <div
          className="fixed inset-0 z-30 flex justify-end bg-black/40"
          onClick={closePanel}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={
              panelMode === "create" ? "New agent" : "Edit agent"
            }
            className="h-full w-full max-w-xl overflow-y-auto border-l border-[rgba(255,255,255,0.08)] bg-[#060e2b] p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-baseline justify-between">
              <h3 className="text-lg font-semibold text-white">
                {panelMode === "create" ? "New agent" : "Edit agent"}
              </h3>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closePanel}
                disabled={saving}
                className="text-sm text-text-muted hover:text-white disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.16em] text-text-muted">
                  Name
                </span>
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                />
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-[0.16em] text-text-muted">
                  Purpose
                </span>
                <textarea
                  value={draft.purpose}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      purpose: event.target.value
                    }))
                  }
                  rows={3}
                  className="mt-2 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.16em] text-text-muted">
                    Service family
                  </span>
                  <select
                    value={draft.serviceFamily}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        serviceFamily: event.target.value
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                  >
                    {SERVICE_FAMILY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs uppercase tracking-[0.16em] text-text-muted">
                    Provider
                  </span>
                  <select
                    value={draft.provider}
                    onChange={(event) => {
                      const nextProvider = providers.find(
                        (provider) =>
                          provider.providerKey === event.target.value
                      );
                      setDraft((current) => ({
                        ...current,
                        provider: event.target.value,
                        model: nextProvider?.defaultModel || current.model
                      }));
                    }}
                    className="mt-2 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                  >
                    {providers.length === 0 ? (
                      <option value={draft.provider}>{draft.provider}</option>
                    ) : (
                      providers.map((provider) => (
                        <option
                          key={provider.providerKey}
                          value={provider.providerKey}
                        >
                          {provider.label}
                        </option>
                      ))
                    )}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs uppercase tracking-[0.16em] text-text-muted">
                    Model
                  </span>
                  <input
                    value={draft.model}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        model: event.target.value
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-xs uppercase tracking-[0.16em] text-text-muted">
                    Trigger
                  </span>
                  <select
                    value={draft.triggerType}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        triggerType: event.target.value
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                  >
                    {TRIGGER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs uppercase tracking-[0.16em] text-text-muted">
                    Approval
                  </span>
                  <select
                    value={draft.approvalMode}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        approvalMode: event.target.value
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                  >
                    {APPROVAL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs uppercase tracking-[0.16em] text-text-muted">
                    Sort order
                  </span>
                  <input
                    value={draft.sortOrder}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        sortOrder: event.target.value
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs uppercase tracking-[0.16em] text-text-muted">
                  Allowed actions (comma separated)
                </span>
                <input
                  value={draft.allowedActionsText}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      allowedActionsText: event.target.value
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                />
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-[0.16em] text-text-muted">
                  System prompt
                </span>
                <textarea
                  value={draft.systemPrompt}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      systemPrompt: event.target.value
                    }))
                  }
                  rows={5}
                  className="mt-2 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      isActive: event.target.checked
                    }))
                  }
                />
                Active
              </label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closePanel}
                disabled={saving}
                className="rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm text-text-secondary hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveDraft()}
                className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving
                  ? "Saving…"
                  : panelMode === "create"
                    ? "Create agent"
                    : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
