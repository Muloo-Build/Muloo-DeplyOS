"use client";

import { useEffect, useMemo, useState } from "react";

interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  category: string | null;
  executionType: string;
  priority: string;
  status: string;
  qaRequired: boolean;
  approvalRequired: boolean;
  dependencyIds: string[];
  assigneeType: string | null;
  createdAt: string;
  updatedAt: string;
}

const boardColumns = [
  { key: "todo", label: "To Do" },
  { key: "waiting_on_client", label: "Waiting on Client" },
  { key: "in_progress", label: "In Progress" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" }
] as const;

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function formatAssigneeType(value: string | null) {
  if (!value) {
    return "Unassigned";
  }

  switch (value.toLowerCase()) {
    case "agent":
      return "Agent";
    case "client":
      return "Client";
    default:
      return "Human";
  }
}

function assigneeTypeClass(value: string | null) {
  switch (value?.toLowerCase()) {
    case "agent":
      return "bg-[rgba(79,142,247,0.18)] text-[#4f8ef7]";
    case "client":
      return "bg-[rgba(45,212,160,0.18)] text-[#2dd4a0]";
    default:
      return "bg-[rgba(240,160,80,0.18)] text-[#f0a050]";
  }
}

export default function DeliveryBoard({
  projectId,
  mode = "internal"
}: {
  projectId: string;
  mode?: "internal" | "client";
}) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const baseUrl =
    mode === "client"
      ? `/api/client/projects/${encodeURIComponent(projectId)}/tasks`
      : `/api/projects/${encodeURIComponent(projectId)}/tasks`;

  async function loadTasks() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(baseUrl, {
        ...(mode === "client" ? { credentials: "include" } : {})
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to load delivery board");
      }

      setTasks(body?.tasks ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load delivery board"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTasks();
  }, [projectId, mode]);

  async function generatePlan() {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/tasks/generate-plan`,
        {
          method: "POST"
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to generate project plan");
      }

      setTasks(body?.tasks ?? []);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Failed to generate project plan"
      );
    } finally {
      setGenerating(false);
    }
  }

  async function updateTaskStatus(taskId: string, status: string) {
    setUpdatingTaskId(taskId);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ status })
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to update task");
      }

      setTasks((currentTasks) =>
        currentTasks.map((task) => (task.id === taskId ? body.task : task))
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update task"
      );
    } finally {
      setUpdatingTaskId(null);
    }
  }

  const totalCount = useMemo(() => tasks.length, [tasks]);

  return (
    <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Delivery Board</h2>
          <p className="mt-2 text-sm text-text-secondary">
            {mode === "client"
              ? "Track the delivery plan and current progress for this project."
              : "Use the generated delivery plan as your repeatable working board for this project."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#0b1126] px-4 py-3 text-sm text-text-secondary">
            {totalCount > 0 ? `${totalCount} planned items` : "No plan yet"}
          </div>
          {mode === "internal" ? (
            <button
              type="button"
              onClick={() => void generatePlan()}
              disabled={generating}
              className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
            >
              {generating
                ? "Generating Plan..."
                : totalCount > 0
                  ? "Refresh Project Plan"
                  : "Generate Project Plan"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-[#ff8f9c]">{error}</p> : null}

      {loading ? (
        <div className="mt-6 grid gap-4 xl:grid-cols-5">
          {boardColumns.map((column) => (
            <div
              key={column.key}
              className="h-40 animate-pulse rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126]"
            />
          ))}
        </div>
      ) : totalCount > 0 ? (
        <div className="mt-6 grid gap-4 xl:grid-cols-5">
          {boardColumns.map((column) => {
            const columnTasks = tasks.filter((task) => task.status === column.key);

            return (
              <div
                key={column.key}
                className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">
                    {column.label}
                  </p>
                  <span className="rounded bg-[rgba(255,255,255,0.06)] px-2 py-1 text-xs font-medium text-text-secondary">
                    {columnTasks.length}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {columnTasks.length > 0 ? (
                    columnTasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded px-2 py-1 text-xs font-medium ${assigneeTypeClass(
                              task.assigneeType
                            )}`}
                          >
                            {formatAssigneeType(task.assigneeType)}
                          </span>
                          {task.category ? (
                            <span className="text-xs text-text-muted">
                              {task.category}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-3 text-sm font-medium text-white">
                          {task.title}
                        </p>
                        {task.description ? (
                          <p className="mt-2 text-sm text-text-secondary">
                            {task.description}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-muted">
                          <span>Execution: {formatLabel(task.executionType)}</span>
                          <span>Priority: {formatLabel(task.priority)}</span>
                          {task.qaRequired ? <span>QA required</span> : null}
                          {task.approvalRequired ? (
                            <span>Approval required</span>
                          ) : null}
                        </div>
                        {mode === "internal" ? (
                          <label className="mt-4 block">
                            <span className="text-xs uppercase tracking-[0.18em] text-text-muted">
                              Move task
                            </span>
                            <select
                              value={task.status}
                              onChange={(event) =>
                                void updateTaskStatus(task.id, event.target.value)
                              }
                              disabled={updatingTaskId === task.id}
                              className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none disabled:cursor-not-allowed"
                            >
                              {boardColumns.map((statusOption) => (
                                <option key={statusOption.key} value={statusOption.key}>
                                  {statusOption.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <div className="mt-4 rounded-lg bg-[#0b1126] px-3 py-2 text-xs text-text-secondary">
                            Current status: {column.label}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-[rgba(255,255,255,0.1)] px-4 py-4 text-sm text-text-secondary">
                      No tasks in this column yet.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-[rgba(255,255,255,0.1)] bg-[#0b1126] px-5 py-5 text-sm text-text-secondary">
          {mode === "internal"
            ? "Generate the project plan to create a repeatable delivery board for this project."
            : "No delivery board has been published for this project yet."}
        </div>
      )}
    </section>
  );
}
