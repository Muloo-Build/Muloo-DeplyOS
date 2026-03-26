"use client";

import { useEffect, useMemo, useState } from "react";

import AppShell from "../components/AppShell";

type RunStatusFilter = "all" | "queued" | "running" | "complete" | "failed";

interface ExecutionRun {
  id: string;
  type: "agent" | "workflow";
  name: string;
  projectName: string | null;
  status: string;
  resultStatus: string | null;
  outputLog: string | null;
  errorLog: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  workflowKey?: string | null;
  taskTitle?: string | null;
  summary?: string | null;
  requestText?: string | null;
  executionMethod?: string | null;
  executionTierLabel?: string | null;
  payload?: {
    agentName?: string;
    agentModel?: string;
    routedProvider?: string;
    routedModel?: string;
    routeSource?: string;
    projectServiceFamily?: string;
    approvalMode?: string;
    allowedActions?: string[];
  } | null;
}

const statusTabs: Array<{ key: RunStatusFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "queued", label: "Queued" },
  { key: "running", label: "Running" },
  { key: "complete", label: "Complete" },
  { key: "failed", label: "Failed" }
];

const runsPerPage = 20;

function formatLabel(value: string | null | undefined) {
  if (!value) return "Not set";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getRunStatusTone(status: string | null | undefined) {
  switch (status) {
    case "completed":
    case "complete":
      return {
        badge: "brand-status-success",
        dot: "bg-status-success"
      };
    case "running":
    case "in_progress":
    case "review_ready":
      return {
        badge: "brand-status-info",
        dot: "bg-status-info"
      };
    case "failed":
      return {
        badge: "brand-status-danger",
        dot: "bg-status-error"
      };
    case "queued":
    default:
      return {
        badge: "brand-status-warning",
        dot: "bg-status-warning"
      };
  }
}

function getTypeBadgeClass(type: ExecutionRun["type"]) {
  return type === "agent"
    ? "border border-brand-purple/30 bg-brand-purple/12 text-white"
    : "border border-white/10 bg-white/5 text-text-secondary";
}

function getRunTimeLabel(value: string) {
  const date = new Date(value);
  return date.toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getRunDateLabel(value: string) {
  const date = new Date(value);
  return date.toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getRelativeDayGroup(value: string) {
  const now = new Date();
  const date = new Date(value);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfEntry = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const diffDays = Math.floor(
    (startOfToday.getTime() - startOfEntry.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays <= 0) return "TODAY";
  if (diffDays === 1) return "YESTERDAY";
  if (diffDays < 7) return "THIS WEEK";
  return "EARLIER";
}

function getSearchText(run: ExecutionRun) {
  return [
    run.name,
    run.projectName,
    run.workflowKey,
    run.executionMethod,
    run.summary,
    run.taskTitle
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function RunsPage() {
  const [runs, setRuns] = useState<ExecutionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<RunStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [updatingRunId, setUpdatingRunId] = useState<string | null>(null);
  const [coworkInstructions, setCoworkInstructions] = useState<
    Record<string, string>
  >({});
  const [coworkErrors, setCoworkErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadRuns() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/execution-jobs?limit=200");
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(body?.error ?? "Failed to load execution jobs");
        }

        setRuns(body?.runs ?? []);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load execution jobs"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadRuns();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const filteredRuns = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return runs.filter((run) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        getSearchText(run).includes(normalizedQuery);

      if (!matchesQuery) {
        return false;
      }

      if (statusFilter === "all") {
        return true;
      }

      if (statusFilter === "complete") {
        return run.status === "completed" || run.status === "complete";
      }

      if (statusFilter === "running") {
        return run.status === "running" || run.status === "in_progress";
      }

      return run.status === statusFilter;
    });
  }, [runs, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRuns.length / runsPerPage));
  const paginatedRuns = useMemo(() => {
    const startIndex = (currentPage - 1) * runsPerPage;
    return filteredRuns.slice(startIndex, startIndex + runsPerPage);
  }, [currentPage, filteredRuns]);

  const groupedRuns = useMemo(() => {
    const groups: Record<string, ExecutionRun[]> = {
      TODAY: [],
      YESTERDAY: [],
      "THIS WEEK": [],
      EARLIER: []
    };

    for (const run of paginatedRuns) {
      groups[getRelativeDayGroup(run.createdAt)].push(run);
    }

    return groups;
  }, [paginatedRuns]);

  async function loadCoworkInstruction(runId: string) {
    try {
      const response = await fetch(
        `/api/execution-jobs/${encodeURIComponent(runId)}/cowork-instruction`
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "No cowork instruction available");
      }

      const nextValue =
        typeof body === "string"
          ? body
          : JSON.stringify(body, null, 2);

      setCoworkInstructions((current) => ({
        ...current,
        [runId]: nextValue
      }));
      setCoworkErrors((current) => {
        const next = { ...current };
        delete next[runId];
        return next;
      });
    } catch (instructionError) {
      setCoworkErrors((current) => ({
        ...current,
        [runId]:
          instructionError instanceof Error
            ? instructionError.message
            : "No cowork instruction available"
      }));
    }
  }

  function toggleRunExpansion(run: ExecutionRun) {
    const nextExpandedRunId = expandedRunId === run.id ? null : run.id;
    setExpandedRunId(nextExpandedRunId);

    if (
      nextExpandedRunId === run.id &&
      run.type === "agent" &&
      !coworkInstructions[run.id] &&
      !coworkErrors[run.id]
    ) {
      void loadCoworkInstruction(run.id);
    }
  }

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

      setRuns((current) =>
        current.map((run) => (run.id === runId ? { ...run, ...body.run } : run))
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update run"
      );
    } finally {
      setUpdatingRunId(null);
    }
  }

  return (
    <AppShell>
      <div className="brand-page min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="brand-surface rounded-3xl border p-6 sm:p-8">
            <p className="text-sm uppercase tracking-[0.25em] text-text-muted">
              Runs
            </p>
            <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-3xl font-semibold text-white">
                  Unified execution feed
                </h1>
                <p className="mt-3 max-w-3xl text-sm text-text-secondary sm:text-base">
                  Review workflow and agent activity in one place, filter by
                  status, and expand any row to inspect logs, operator context,
                  and delivery controls.
                </p>
              </div>
              <div className="brand-surface-soft rounded-2xl border px-4 py-3 text-sm text-text-secondary">
                {loading ? "Loading runs..." : `${filteredRuns.length} matching runs`}
              </div>
            </div>
          </section>

          <section className="brand-surface rounded-3xl border p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {statusTabs.map((tab) => {
                  const active = tab.key === statusFilter;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setStatusFilter(tab.key)}
                      className={`rounded-full border px-4 py-2 text-sm transition ${
                        active
                          ? "border-brand-teal bg-brand-teal/12 text-white"
                          : "brand-surface-soft text-text-secondary hover:border-brand-teal/55 hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <label className="w-full lg:max-w-sm">
                <span className="sr-only">Search runs</span>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by project or module key"
                  className="brand-input w-full rounded-2xl px-4 py-3 text-sm text-white outline-none placeholder:text-text-muted focus:border-brand-teal/60"
                />
              </label>
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-white">
                {error}
              </div>
            ) : null}

            <div className="mt-6 space-y-6">
              {!loading && filteredRuns.length === 0 ? (
                <div className="brand-surface-soft rounded-2xl border p-6 text-sm text-text-secondary">
                  No runs match the current filters yet.
                </div>
              ) : null}

              {Object.entries(groupedRuns).map(([groupLabel, groupRuns]) =>
                groupRuns.length > 0 ? (
                  <section key={groupLabel} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <p className="text-xs uppercase tracking-[0.22em] text-text-muted">
                        {groupLabel}
                      </p>
                      <div className="h-px flex-1 bg-white/10" />
                    </div>

                    <div className="space-y-3">
                      {groupRuns.map((run) => {
                        const expanded = expandedRunId === run.id;
                        const statusTone = getRunStatusTone(run.status);

                        return (
                          <div
                            key={run.id}
                            className="brand-surface-soft overflow-hidden rounded-2xl border"
                          >
                            <button
                              type="button"
                              onClick={() => toggleRunExpansion(run)}
                              className="flex w-full flex-col gap-4 px-4 py-4 text-left transition hover:bg-white/5 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`inline-block h-2.5 w-2.5 rounded-full ${statusTone.dot}`}
                                  />
                                  <p className="truncate font-medium text-white">
                                    {run.name}
                                  </p>
                                  <span
                                    className={`rounded-full px-2 py-1 text-[11px] uppercase tracking-[0.18em] ${getTypeBadgeClass(
                                      run.type
                                    )}`}
                                  >
                                    {run.type}
                                  </span>
                                </div>
                                <p className="mt-2 truncate text-sm text-text-secondary">
                                  {run.projectName ?? "Workspace run"}
                                  {run.workflowKey ? ` · ${run.workflowKey}` : ""}
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs uppercase tracking-[0.18em] ${statusTone.badge}`}
                                >
                                  {formatLabel(run.status)}
                                </span>
                                {run.resultStatus ? (
                                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs uppercase tracking-[0.18em] text-text-secondary">
                                    {formatLabel(run.resultStatus)}
                                  </span>
                                ) : null}
                                <span className="text-xs uppercase tracking-[0.18em] text-text-muted">
                                  {getRunTimeLabel(run.createdAt)}
                                </span>
                              </div>
                            </button>

                            {expanded ? (
                              <div className="border-t border-white/10 px-4 py-4">
                                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
                                  <div className="space-y-4">
                                    {run.summary ? (
                                      <div className="brand-surface rounded-2xl border p-4">
                                        <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                                          Summary
                                        </p>
                                        <p className="mt-3 text-sm text-text-secondary">
                                          {run.summary}
                                        </p>
                                      </div>
                                    ) : null}

                                    {run.requestText ? (
                                      <div className="brand-surface rounded-2xl border p-4">
                                        <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                                          Request
                                        </p>
                                        <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-text-secondary">
                                          {run.requestText}
                                        </pre>
                                      </div>
                                    ) : null}

                                    <div className="brand-surface rounded-2xl border p-4">
                                      <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                                        Output Log
                                      </p>
                                      <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-text-secondary">
                                        {run.outputLog ?? "No output log captured yet."}
                                      </pre>
                                    </div>

                                    {run.errorLog ? (
                                      <div className="rounded-2xl border border-status-error/30 bg-status-error/10 p-4">
                                        <p className="text-xs uppercase tracking-[0.18em] text-white/80">
                                          Error Log
                                        </p>
                                        <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-white">
                                          {run.errorLog}
                                        </pre>
                                      </div>
                                    ) : null}

                                    {run.type === "agent" ? (
                                      <div className="brand-surface rounded-2xl border p-4">
                                        <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                                          Cowork Instruction
                                        </p>
                                        <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-text-secondary">
                                          {coworkInstructions[run.id] ??
                                            coworkErrors[run.id] ??
                                            "Loading cowork instruction..."}
                                        </pre>
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="space-y-4">
                                    <div className="brand-surface rounded-2xl border p-4">
                                      <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                                        Run Meta
                                      </p>
                                      <div className="mt-3 space-y-2 text-sm text-text-secondary">
                                        <p>Queued: {getRunDateLabel(run.createdAt)}</p>
                                        <p>
                                          Started:{" "}
                                          {run.startedAt
                                            ? getRunDateLabel(run.startedAt)
                                            : "Not started"}
                                        </p>
                                        <p>
                                          Completed:{" "}
                                          {run.completedAt
                                            ? getRunDateLabel(run.completedAt)
                                            : "Not completed"}
                                        </p>
                                        <p>
                                          Tier:{" "}
                                          {run.executionTierLabel
                                            ? formatLabel(run.executionTierLabel)
                                            : "Not set"}
                                        </p>
                                      </div>
                                    </div>

                                    {run.type === "agent" ? (
                                      <>
                                        <div className="brand-surface rounded-2xl border p-4">
                                          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                                            Execution Profile
                                          </p>
                                          <div className="mt-3 space-y-2 text-sm text-text-secondary">
                                            <p>
                                              Execution:{" "}
                                              {formatLabel(run.executionMethod)}
                                            </p>
                                            <p>
                                              Provider:{" "}
                                              {run.payload?.routedProvider ??
                                                run.executionMethod ??
                                                "Not set"}
                                            </p>
                                            <p>
                                              Model:{" "}
                                              {run.payload?.routedModel ??
                                                run.payload?.agentModel ??
                                                "Not set"}
                                            </p>
                                            <p>
                                              Route source:{" "}
                                              {formatLabel(run.payload?.routeSource)}
                                            </p>
                                            <p>
                                              Approval mode:{" "}
                                              {formatLabel(run.payload?.approvalMode)}
                                            </p>
                                            <p>
                                              Allowed actions:{" "}
                                              {(run.payload?.allowedActions ?? []).length >
                                              0
                                                ? (run.payload?.allowedActions ?? []).join(
                                                    ", "
                                                  )
                                                : "Not set"}
                                            </p>
                                          </div>
                                        </div>

                                        <div className="brand-surface rounded-2xl border p-4">
                                          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                                            Run Controls
                                          </p>
                                          <div className="mt-4 grid gap-2">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                void updateRun(run.id, {
                                                  status: "in_progress",
                                                  resultStatus: "executing"
                                                })
                                              }
                                              disabled={updatingRunId === run.id}
                                              className="brand-input rounded-xl px-4 py-3 text-left text-sm text-white transition hover:border-brand-teal/60 disabled:opacity-60"
                                            >
                                              Start run
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                void updateRun(run.id, {
                                                  status: "review_ready",
                                                  resultStatus: "awaiting_review"
                                                })
                                              }
                                              disabled={updatingRunId === run.id}
                                              className="brand-input rounded-xl px-4 py-3 text-left text-sm text-white transition hover:border-brand-teal/60 disabled:opacity-60"
                                            >
                                              Mark ready for review
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                void updateRun(run.id, {
                                                  status: "completed",
                                                  resultStatus: "approved"
                                                })
                                              }
                                              disabled={updatingRunId === run.id}
                                              className="brand-input rounded-xl px-4 py-3 text-left text-sm text-white transition hover:border-brand-teal/60 disabled:opacity-60"
                                            >
                                              Mark complete
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                void updateRun(run.id, {
                                                  status: "failed",
                                                  resultStatus: "blocked",
                                                  errorLog:
                                                    "Marked failed during operator review."
                                                })
                                              }
                                              disabled={updatingRunId === run.id}
                                              className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-left text-sm text-white transition hover:border-status-error/60 disabled:opacity-60"
                                            >
                                              Mark failed
                                            </button>
                                          </div>
                                        </div>
                                      </>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null
              )}
            </div>

            {filteredRuns.length > runsPerPage ? (
              <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-text-secondary">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    className="brand-input rounded-xl px-4 py-2 text-sm text-white transition hover:border-brand-teal/60 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                    disabled={currentPage >= totalPages}
                    className="brand-input rounded-xl px-4 py-2 text-sm text-white transition hover:border-brand-teal/60 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
