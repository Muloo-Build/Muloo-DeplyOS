"use client";

import { useEffect, useState } from "react";

interface AgentDescriptor {
  key: string;
  label: string;
  description: string;
  defaultProviderKey: string;
  defaultModel: string;
  workflowKey?: string;
  fileRef: string;
}

interface SpendBucket {
  key: string;
  label: string;
  totalCostUsd: number;
  totalTokens: number;
  callCount: number;
  erroredCount: number;
}

function fmtUsd(value: number): string {
  if (value === 0) return "$0.00";
  if (value < 0.01) return "<$0.01";
  return `$${value.toFixed(2)}`;
}

export default function AIAgentsLens() {
  const [agents, setAgents] = useState<AgentDescriptor[]>([]);
  const [byAgent, setByAgent] = useState<Record<string, SpendBucket>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [agentsRes, spendRes] = await Promise.all([
          fetch("/api/ai-integrations/agents"),
          fetch("/api/ai-integrations/spend?days=7")
        ]);
        const agentsBody = await agentsRes.json();
        const spendBody = await spendRes.json();
        if (!agentsRes.ok)
          throw new Error(agentsBody?.error ?? "Failed to load agents");
        if (!spendRes.ok)
          throw new Error(spendBody?.error ?? "Failed to load spend");
        if (cancelled) return;
        setAgents(agentsBody.agents ?? []);
        const map: Record<string, SpendBucket> = {};
        for (const bucket of spendBody.summary?.byAgent ?? []) {
          map[bucket.key] = bucket;
        }
        setByAgent(map);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed");
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

  if (loading) {
    return (
      <div className="rounded-[14px] border border-ink-4 bg-ink-1 p-6 text-text-2">
        Loading agents...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
          {error}
        </div>
      ) : null}

      {agents.map((agent) => {
        const spend = byAgent[agent.key];
        return (
          <div
            key={agent.key}
            className="rounded-[14px] border border-ink-4 bg-ink-1 p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-white">
                  {agent.label}
                </h2>
                <p className="mt-2 text-sm text-text-2">
                  {agent.description}
                </p>
                <p className="mt-3 text-xs text-text-3">
                  Default: <span className="text-white">{agent.defaultProviderKey}</span>
                  {" · "}
                  <span className="text-white">{agent.defaultModel}</span>
                  {agent.workflowKey
                    ? ` · routes via workflow ${agent.workflowKey}`
                    : ""}
                </p>
                <p className="mt-1 text-xs text-text-3">{agent.fileRef}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                  7-day spend
                </p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {fmtUsd(spend?.totalCostUsd ?? 0)}
                </p>
                <p className="text-xs text-text-3">
                  {spend?.callCount ?? 0} call(s)
                  {spend?.erroredCount
                    ? ` · ${spend.erroredCount} errored`
                    : ""}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
