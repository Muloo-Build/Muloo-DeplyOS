"use client";

import { useEffect, useState } from "react";

interface AgentDefinition {
  id: string;
  slug: string;
  name: string;
  purpose: string;
  provider: string;
  model: string;
  triggerType: string;
  approvalMode: string;
  allowedActions: string[];
  systemPrompt?: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface ProviderConnection {
  providerKey: string;
  label: string;
  defaultModel: string | null;
  isEnabled: boolean;
  hasApiKey: boolean;
}

interface AgentDraft {
  name: string;
  purpose: string;
  provider: string;
  model: string;
  triggerType: string;
  approvalMode: string;
  allowedActionsText: string;
  systemPrompt: string;
  isActive: boolean;
  sortOrder: string;
}

function createEmptyDraft(): AgentDraft {
  return {
    name: "",
    purpose: "",
    provider: "anthropic",
    model: "claude-sonnet",
    triggerType: "manual",
    approvalMode: "review_required",
    allowedActionsText: "",
    systemPrompt: "",
    isActive: true,
    sortOrder: "999"
  };
}

export default function AgentStudio() {
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [providers, setProviders] = useState<ProviderConnection[]>([]);
  const [newDraft, setNewDraft] = useState<AgentDraft>(createEmptyDraft());
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAgents() {
      try {
        const [agentsResponse, providersResponse] = await Promise.all([
          fetch("/api/agents"),
          fetch("/api/provider-connections")
        ]);
        if (!agentsResponse.ok) {
          throw new Error("Failed to load agents");
        }
        if (!providersResponse.ok) {
          throw new Error("Failed to load providers");
        }

        const body = await agentsResponse.json();
        const providersBody = await providersResponse.json();
        setAgents(body.agents ?? []);
        setProviders((providersBody.providers ?? []).filter((provider: ProviderConnection) => provider.isEnabled && provider.hasApiKey));
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load agents"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadAgents();
  }, []);

  function updateAgent(
    agentId: string,
    field: keyof AgentDefinition,
    value: string | boolean | string[]
  ) {
    setAgents((currentAgents) =>
      currentAgents.map((agent) =>
        agent.id === agentId ? { ...agent, [field]: value } : agent
      )
    );
  }

  async function saveAgent(agentId: string) {
    const agent = agents.find((candidate) => candidate.id === agentId);
    if (!agent) {
      return;
    }

    setSaving(agentId);
    setError(null);

    try {
      const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: agent.name,
          purpose: agent.purpose,
          provider: agent.provider,
          model: agent.model,
          triggerType: agent.triggerType,
          approvalMode: agent.approvalMode,
          allowedActions: agent.allowedActions,
          systemPrompt: agent.systemPrompt ?? "",
          isActive: agent.isActive,
          sortOrder: Number(agent.sortOrder)
        })
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save agent");
      }

      setAgents((currentAgents) =>
        currentAgents.map((candidate) =>
          candidate.id === agentId ? body.agent : candidate
        )
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save agent"
      );
    } finally {
      setSaving(null);
    }
  }

  async function createAgent() {
    setSaving("new");
    setError(null);

    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...newDraft,
          allowedActions: newDraft.allowedActionsText
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          sortOrder: Number(newDraft.sortOrder)
        })
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to create agent");
      }

      setAgents((currentAgents) =>
        [...currentAgents, body.agent].sort(
          (left, right) => left.sortOrder - right.sortOrder
        )
      );
      setNewDraft(createEmptyDraft());
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to create agent"
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-[rgba(224,80,96,0.4)] bg-background-card p-4 text-sm text-white">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
          Create Agent
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Name", "name"],
            ["Purpose", "purpose"],
            ["Model", "model"],
            ["Allowed actions (comma separated)", "allowedActionsText"],
            ["System prompt", "systemPrompt"],
            ["Sort Order", "sortOrder"]
          ].map(([label, key]) => (
            <label key={key} className="block">
              <span className="text-sm font-medium text-white">{label}</span>
              <input
                value={newDraft[key as keyof AgentDraft] as string}
                onChange={(event) =>
                  setNewDraft((currentDraft) => ({
                    ...currentDraft,
                    [key]: event.target.value
                  }))
                }
                className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
              />
            </label>
          ))}

          <label className="block">
            <span className="text-sm font-medium text-white">Provider</span>
            <select
              value={newDraft.provider}
              onChange={(event) =>
                setNewDraft((currentDraft) => ({
                  ...currentDraft,
                  provider: event.target.value
                }))
              }
              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
            >
              {providers.map((provider) => (
                <option key={provider.providerKey} value={provider.providerKey}>
                  {provider.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-white">Trigger</span>
            <select
              value={newDraft.triggerType}
              onChange={(event) =>
                setNewDraft((currentDraft) => ({
                  ...currentDraft,
                  triggerType: event.target.value
                }))
              }
              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
            >
              <option value="manual">Manual</option>
              <option value="assisted">Assisted</option>
              <option value="workflow">Workflow</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-white">Approval</span>
            <select
              value={newDraft.approvalMode}
              onChange={(event) =>
                setNewDraft((currentDraft) => ({
                  ...currentDraft,
                  approvalMode: event.target.value
                }))
              }
              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
            >
              <option value="review_required">Review required</option>
              <option value="client_approval">Client approval</option>
              <option value="auto_allowed">Auto allowed</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={newDraft.isActive}
              onChange={(event) =>
                setNewDraft((currentDraft) => ({
                  ...currentDraft,
                  isActive: event.target.checked
                }))
              }
            />
            Active
          </label>
          <button
            type="button"
            onClick={() => void createAgent()}
            disabled={saving === "new"}
            className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving === "new" ? "Creating..." : "Create Agent"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
          Agent Catalog
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          Operational agents
        </h2>
        <p className="mt-2 text-text-secondary">
          Define which agents exist, which model each one uses, and what it is
          allowed to do inside DeployOS.
        </p>

        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="text-sm text-text-secondary">Loading agents...</div>
          ) : (
            agents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5"
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="block">
                    <span className="text-sm font-medium text-white">Name</span>
                    <input
                      value={agent.name}
                      onChange={(event) =>
                        updateAgent(agent.id, "name", event.target.value)
                      }
                      className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#121a36] px-4 py-3 text-sm text-white outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-white">Purpose</span>
                    <input
                      value={agent.purpose}
                      onChange={(event) =>
                        updateAgent(agent.id, "purpose", event.target.value)
                      }
                      className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#121a36] px-4 py-3 text-sm text-white outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-white">Provider</span>
                    <select
                      value={agent.provider}
                      onChange={(event) =>
                        updateAgent(agent.id, "provider", event.target.value)
                      }
                      className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#121a36] px-4 py-3 text-sm text-white outline-none"
                    >
                      {providers.map((provider) => (
                        <option key={provider.providerKey} value={provider.providerKey}>
                          {provider.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-white">Model</span>
                    <input
                      value={agent.model}
                      onChange={(event) =>
                        updateAgent(agent.id, "model", event.target.value)
                      }
                      placeholder={providers.find((provider) => provider.providerKey === agent.provider)?.defaultModel ?? "Use provider default model"}
                      className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#121a36] px-4 py-3 text-sm text-white outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-white">Trigger</span>
                    <input
                      value={agent.triggerType}
                      onChange={(event) =>
                        updateAgent(agent.id, "triggerType", event.target.value)
                      }
                      className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#121a36] px-4 py-3 text-sm text-white outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-white">Approval</span>
                    <input
                      value={agent.approvalMode}
                      onChange={(event) =>
                        updateAgent(agent.id, "approvalMode", event.target.value)
                      }
                      className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#121a36] px-4 py-3 text-sm text-white outline-none"
                    />
                  </label>

                  <label className="block xl:col-span-2">
                    <span className="text-sm font-medium text-white">
                      Allowed actions
                    </span>
                    <input
                      value={agent.allowedActions.join(", ")}
                      onChange={(event) =>
                        updateAgent(
                          agent.id,
                          "allowedActions",
                          event.target.value
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean)
                        )
                      }
                      className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#121a36] px-4 py-3 text-sm text-white outline-none"
                    />
                  </label>

                  <label className="block xl:col-span-4">
                    <span className="text-sm font-medium text-white">
                      System prompt
                    </span>
                    <textarea
                      value={agent.systemPrompt ?? ""}
                      onChange={(event) =>
                        updateAgent(agent.id, "systemPrompt", event.target.value)
                      }
                      rows={3}
                      className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#121a36] px-4 py-3 text-sm text-white outline-none"
                    />
                  </label>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={agent.isActive}
                      onChange={(event) =>
                        updateAgent(agent.id, "isActive", event.target.checked)
                      }
                    />
                    Active
                  </label>

                  <button
                    type="button"
                    onClick={() => void saveAgent(agent.id)}
                    disabled={saving === agent.id}
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {saving === agent.id ? "Saving..." : "Save Agent"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
