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
  resultStatus: string | null;
  outputLog: string | null;
  errorLog: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  payload: {
    agentName?: string;
    agentModel?: string;
    routedProvider?: string;
    routedModel?: string;
    projectServiceFamily?: string;
    approvalMode?: string;
    allowedActions?: string[];
  } | null;
}

function formatLabel(value: string | null) {
  if (!value) return "Not set";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function RunsPage() {
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingRunId, setUpdatingRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadRuns() {
    const response = await fetch("/api/runs");
    const body = await response.json().catch(() => null);
    setAgentRuns(body?.agentRuns ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadRuns();
  }, []);

  async function updateRun(
    runId: string,
    patch: { status?: string; resultStatus?: string; errorLog?: string | null }
  ) {
    setUpdatingRunId(runId);
    setError(null);

    try {
      const response = await fetch(`/api/runs/${encodeURIComponent(runId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to update run");
      }
      setAgentRuns((current) =>
        current.map((run) => (run.id === runId ? body.run : run))
      );
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update run");
    } finally {
      setUpdatingRunId(null);
    }
  }

  return (
    <AppShell>
      <div className="p-8">
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8">
          <p className="text-sm uppercase tracking-[0.25em] text-text-muted">Runs</p>
          <h1 className="mt-3 text-3xl font-bold font-heading text-white">Agent Execution Review</h1>
          <p className="mt-3 max-w-3xl text-text-secondary">
            Review queued agent work, inspect the generated execution brief, and advance runs through dry-run, review, and completion.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-white">Agent runs</h2>
            <div className="rounded-xl bg-[#0b1126] px-4 py-3 text-sm text-text-secondary">
              {loading ? "Loading..." : `${agentRuns.length} runs`}
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
              {error}
            </div>
          ) : null}

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
                  <div className="flex flex-wrap gap-2">
                    <div className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-xs text-text-secondary">
                      {formatLabel(run.status)}
                    </div>
                    <div className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-xs text-text-secondary">
                      {formatLabel(run.resultStatus)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-sm text-text-secondary">
                  <span>Execution: {run.executionMethod}</span>
                  <span>Routed provider: {run.payload?.routedProvider ?? run.executionMethod}</span>
                  {run.payload?.routedModel || run.payload?.agentModel ? (
                    <span>Model: {run.payload?.routedModel ?? run.payload?.agentModel}</span>
                  ) : null}
                  {run.payload?.projectServiceFamily ? (
                    <span>Service family: {formatLabel(run.payload.projectServiceFamily)}</span>
                  ) : null}
                  <span>Mode: {formatLabel(run.mode)}</span>
                  <span>Queued: {new Date(run.createdAt).toLocaleString()}</span>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,2fr)_320px]">
                  <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
                    <p className="text-sm uppercase tracking-[0.2em] text-text-muted">Execution brief</p>
                    <pre className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-text-secondary font-sans">
                      {run.outputLog ?? "No execution brief captured yet."}
                    </pre>
                    {run.errorLog ? (
                      <div className="mt-4 rounded-xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
                        {run.errorLog}
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
                      <p className="text-sm uppercase tracking-[0.2em] text-text-muted">Run controls</p>
                      <div className="mt-4 grid gap-2">
                        <button
                          type="button"
                          onClick={() => void updateRun(run.id, { status: "in_progress", resultStatus: "executing" })}
                          disabled={updatingRunId === run.id}
                          className="rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-3 text-left text-sm text-white disabled:opacity-60"
                        >
                          Start run
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateRun(run.id, { status: "review_ready", resultStatus: "awaiting_review" })}
                          disabled={updatingRunId === run.id}
                          className="rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-3 text-left text-sm text-white disabled:opacity-60"
                        >
                          Mark ready for review
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateRun(run.id, { status: "completed", resultStatus: "approved" })}
                          disabled={updatingRunId === run.id}
                          className="rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-3 text-left text-sm text-white disabled:opacity-60"
                        >
                          Mark complete
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateRun(run.id, { status: "failed", resultStatus: "blocked", errorLog: "Marked failed during operator review." })}
                          disabled={updatingRunId === run.id}
                          className="rounded-xl border border-[rgba(224,80,96,0.4)] px-4 py-3 text-left text-sm text-[#ff9aa5] disabled:opacity-60"
                        >
                          Mark failed
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
                      <p className="text-sm uppercase tracking-[0.2em] text-text-muted">Execution profile</p>
                      <div className="mt-3 space-y-2 text-sm text-text-secondary">
                        <p>Approval mode: {formatLabel(run.payload?.approvalMode ?? null)}</p>
                        <p>
                          Allowed actions: {(run.payload?.allowedActions ?? []).length > 0
                            ? (run.payload?.allowedActions ?? []).join(", ")
                            : "Not set"}
                        </p>
                        <p>Started: {run.startedAt ? new Date(run.startedAt).toLocaleString() : "Not started"}</p>
                        <p>Completed: {run.completedAt ? new Date(run.completedAt).toLocaleString() : "Not completed"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
