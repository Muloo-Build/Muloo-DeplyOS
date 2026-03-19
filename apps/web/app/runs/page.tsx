"use client";

import { useEffect, useState } from "react";

import AppShell from "../components/AppShell";

interface AgentRun {
  id: string;
  projectName: string | null;
  taskTitle: string | null;
  executionMethod: string;
  mode: string;
  status: string;
  createdAt: string;
  payload: {
    agentName?: string;
    agentModel?: string;
  } | null;
}

export default function RunsPage() {
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/runs");
      const body = await response.json().catch(() => null);
      setAgentRuns(body?.agentRuns ?? []);
      setLoading(false);
    }

    void load();
  }, []);

  return (
    <AppShell>
      <div className="p-8">
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8">
          <p className="text-sm uppercase tracking-[0.25em] text-text-muted">Runs</p>
          <h1 className="mt-3 text-3xl font-bold font-heading text-white">Execution History</h1>
          <p className="mt-3 max-w-2xl text-text-secondary">Review queued and completed agent delivery runs as the platform moves from planning into execution.</p>
        </div>

        <div className="mt-6 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-white">Agent runs</h2>
            <div className="rounded-xl bg-[#0b1126] px-4 py-3 text-sm text-text-secondary">
              {loading ? "Loading..." : `${agentRuns.length} runs`}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {!loading && agentRuns.length === 0 ? (
              <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5 text-sm text-text-secondary">
                No agent runs queued yet. Assign an agent to a delivery task and queue a run from the delivery board.
              </div>
            ) : null}

            {agentRuns.map((run) => (
              <div key={run.id} className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                      {run.payload?.agentName ?? "Agent run"}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-white">
                      {run.taskTitle ?? "Untitled task"}
                    </h3>
                    <p className="mt-2 text-sm text-text-secondary">
                      {run.projectName ?? "Unknown project"}
                    </p>
                  </div>
                  <div className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-xs text-text-secondary">
                    {run.status}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-sm text-text-secondary">
                  <span>Provider: {run.executionMethod}</span>
                  {run.payload?.agentModel ? <span>Model: {run.payload.agentModel}</span> : null}
                  <span>Mode: {run.mode}</span>
                  <span>Queued: {new Date(run.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
