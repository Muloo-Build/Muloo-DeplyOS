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
  plannedHours: number | null;
  actualHours: number | null;
  qaRequired: boolean;
  executionReadiness: string;
  approvalRequired: boolean;
  dependencyIds: string[];
  assigneeType: string | null;
  executionPath: {
    lane: string;
    label: string;
    summary: string;
    apiEligible: boolean;
    directActions: string[];
    notes: string[];
  };
  scopeOrigin?: string | null;
  changeRequestId?: string | null;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  latestExecutionJob?: {
    id: string;
    status: string;
    resultStatus: string | null;
    createdAt: string;
    completedAt: string | null;
  } | null;
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

function executionLaneClass(value: string) {
  switch (value) {
    case "direct_api":
      return "bg-[rgba(79,142,247,0.18)] text-[#8fb4ff]";
    case "workflow_bridge":
      return "bg-[rgba(123,226,239,0.16)] text-[#7be2ef]";
    case "developer_tooling":
      return "bg-[rgba(255,214,102,0.16)] text-[#ffd666]";
    case "manual_review":
      return "bg-[rgba(255,154,165,0.16)] text-[#ff9aa5]";
    case "client_input":
      return "bg-[rgba(45,212,160,0.18)] text-[#2dd4a0]";
    default:
      return "bg-[rgba(255,255,255,0.08)] text-text-secondary";
  }
}

interface AgentOption {
  id: string;
  name: string;
  isActive: boolean;
  serviceFamily?: string;
}

export default function DeliveryBoard({
  projectId,
  mode = "internal"
}: {
  projectId: string;
  mode?: "internal" | "client";
}) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [projectServiceFamily, setProjectServiceFamily] = useState<string | null>(null);
  const [scopeLocked, setScopeLocked] = useState(false);
  const [quoteApproved, setQuoteApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [queueingTaskId, setQueueingTaskId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState({
    title: "",
    description: "",
    category: "",
    executionType: "manual",
    priority: "medium",
    status: "todo",
    plannedHours: "",
    actualHours: "",
    qaRequired: false,
    executionReadiness: "not_ready",
    approvalRequired: false,
    assigneeType: "Human",
    assignedAgentId: ""
  });
  const [error, setError] = useState<string | null>(null);

  const baseUrl =
    mode === "client"
      ? `/api/client/projects/${encodeURIComponent(projectId)}/tasks`
      : `/api/projects/${encodeURIComponent(projectId)}/tasks`;

  async function loadTasks() {
    setLoading(true);
    setError(null);

    try {
      const [tasksResponse, agentsResponse, projectResponse] = await Promise.all([
        fetch(baseUrl, {
          ...(mode === "client" ? { credentials: "include" } : {})
        }),
        mode === "internal" ? fetch("/api/agents") : Promise.resolve(null),
        mode === "internal" ? fetch(`/api/projects/${encodeURIComponent(projectId)}`) : Promise.resolve(null)
      ]);

      const body = await tasksResponse.json().catch(() => null);

      if (!tasksResponse.ok) {
        throw new Error(body?.error ?? "Failed to load delivery board");
      }

      setTasks(body?.tasks ?? []);

      if (mode === "internal" && agentsResponse) {
        const agentsBody = await agentsResponse.json().catch(() => null);
        let currentServiceFamily: string | null = null;

        if (projectResponse?.ok) {
          const projectBody = await projectResponse.json().catch(() => null);
          currentServiceFamily = projectBody?.project?.serviceFamily ?? null;
          setQuoteApproved(projectBody?.project?.quoteApprovalStatus === "approved");
          setScopeLocked(
            Boolean(
              projectBody?.project?.scopeLockedAt ||
                projectBody?.project?.quoteApprovalStatus === "approved"
            )
          );
          setProjectServiceFamily(currentServiceFamily);
        }

        if (agentsResponse.ok) {
          const loadedAgents = (agentsBody?.agents ?? []).filter((agent: AgentOption & { serviceFamily?: string }) => agent.isActive);
          setAgents(
            currentServiceFamily
              ? loadedAgents.filter((agent: AgentOption & { serviceFamily?: string }) => !agent.serviceFamily || agent.serviceFamily === currentServiceFamily)
              : loadedAgents
          );
        }
      }
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

  function resetTaskDraft() {
    setTaskDraft({
      title: "",
      description: "",
      category: "",
      executionType: "manual",
      priority: "medium",
      status: "todo",
      plannedHours: "",
      actualHours: "",
      qaRequired: false,
      executionReadiness: "not_ready",
      approvalRequired: false,
      assigneeType: "Human",
      assignedAgentId: ""
    });
  }

  function updateTaskDraft(
    field: keyof typeof taskDraft,
    value: string | boolean
  ) {
    setTaskDraft((current) => {
      const nextDraft = { ...current, [field]: value };

      if (field === "assigneeType") {
        if (value !== "Agent") {
          nextDraft.assignedAgentId = "";
          if (
            current.executionReadiness === "ready" ||
            current.executionReadiness === "ready_with_review"
          ) {
            nextDraft.executionReadiness =
              value === "Client" ? "not_ready" : "assisted";
          }
        } else if (
          current.executionReadiness === "not_ready" ||
          current.executionReadiness === "assisted"
        ) {
          nextDraft.executionReadiness = "ready_with_review";
        }
      }

      return nextDraft;
    });
  }

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

  function startEditingTask(task: ProjectTask) {
    setEditingTaskId(task.id);
    setTaskDraft({
      title: task.title,
      description: task.description ?? "",
      category: task.category ?? "",
      executionType: task.executionType,
      priority: task.priority,
      status: task.status,
      plannedHours: task.plannedHours?.toString() ?? "",
      actualHours: task.actualHours?.toString() ?? "",
      qaRequired: task.qaRequired,
      executionReadiness: task.executionReadiness,
      approvalRequired: task.approvalRequired,
      assigneeType: task.assigneeType ?? "Human",
      assignedAgentId: task.assignedAgentId ?? ""
    });
  }

  function cancelEditingTask() {
    setEditingTaskId(null);
    resetTaskDraft();
  }

  async function saveTask(taskId?: string) {
    setSavingTask(true);
    setError(null);

    try {
      const response = await fetch(
        taskId
          ? `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`
          : `/api/projects/${encodeURIComponent(projectId)}/tasks`,
        {
          method: taskId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(taskDraft)
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save task");
      }

      if (taskId) {
        setTasks((currentTasks) =>
          currentTasks.map((task) => (task.id === taskId ? body.task : task))
        );
      } else {
        setTasks((currentTasks) => [...currentTasks, body.task]);
      }

      cancelEditingTask();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save task"
      );
    } finally {
      setSavingTask(false);
    }
  }

  async function queueAgentRun(taskId: string) {
    setQueueingTaskId(taskId);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/queue-agent-run`,
        { method: "POST" }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to queue agent run");
      }

      await loadTasks();
    } catch (queueError) {
      setError(queueError instanceof Error ? queueError.message : "Failed to queue agent run");
    } finally {
      setQueueingTaskId(null);
    }
  }

  async function deleteTask(taskId: string) {
    const confirmed = window.confirm("Delete this task from the delivery board?");

    if (!confirmed) {
      return;
    }

    setDeletingTaskId(taskId);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`,
        {
          method: "DELETE"
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to delete task");
      }

      setTasks((currentTasks) =>
        currentTasks.filter((task) => task.id !== taskId)
      );

      if (editingTaskId === taskId) {
        cancelEditingTask();
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete task"
      );
    } finally {
      setDeletingTaskId(null);
    }
  }

  const totalCount = useMemo(() => tasks.length, [tasks]);
  const canGenerateLockedApprovedPlan =
    mode === "internal" && scopeLocked && quoteApproved && totalCount === 0;
  const boardMetrics = useMemo(() => {
    const humanTasks = tasks.filter(
      (task) =>
        task.assigneeType?.toLowerCase() !== "agent" &&
        task.assigneeType?.toLowerCase() !== "client"
    );
    const plannedHours = humanTasks.reduce(
      (sum, task) => sum + (typeof task.plannedHours === "number" ? task.plannedHours : 0),
      0
    );
    const actualHours = humanTasks.reduce(
      (sum, task) => sum + (typeof task.actualHours === "number" ? task.actualHours : 0),
      0
    );
    const readyAgentTasks = tasks.filter(
      (task) => task.assigneeType?.toLowerCase() === "agent" && ["ready_with_review", "ready"].includes(task.executionReadiness)
    ).length;
    const apiEligibleTasks = tasks.filter((task) => task.executionPath.apiEligible).length;
    const reviewFirstTasks = tasks.filter(
      (task) =>
        task.executionPath.lane === "workflow_bridge" ||
        task.executionPath.lane === "manual_review"
    ).length;
    const completedTasks = tasks.filter((task) => task.status === "done").length;
    const changeTasks = tasks.filter(
      (task) => task.scopeOrigin?.toLowerCase() === "change_request"
    ).length;

    return {
      plannedHours,
      actualHours,
      variance: actualHours - plannedHours,
      readyAgentTasks,
      apiEligibleTasks,
      reviewFirstTasks,
      completedTasks,
      changeTasks
    };
  }, [tasks]);

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
            {totalCount > 0
              ? `${totalCount} planned items${
                  boardMetrics.changeTasks > 0
                    ? ` · ${boardMetrics.changeTasks} approved changes`
                    : ""
                }`
              : "No plan yet"}
          </div>
          {mode === "internal" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditingTaskId("new");
                  resetTaskDraft();
                }}
                disabled={scopeLocked}
                className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm font-medium text-white"
              >
                Add Task
              </button>
              <button
                type="button"
                onClick={() => void generatePlan()}
                disabled={generating || (scopeLocked && !canGenerateLockedApprovedPlan)}
                className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
              >
                {generating
                  ? "Generating Plan..."
                  : canGenerateLockedApprovedPlan
                    ? "Push Approved Scope to Delivery"
                    : totalCount > 0
                    ? "Refresh Project Plan"
                    : "Generate Project Plan"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-[#ff8f9c]">{error}</p> : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] px-4 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Planned Human Hours</p>
          <p className="mt-2 text-xl font-semibold text-white">{boardMetrics.plannedHours}h</p>
        </div>
        <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] px-4 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Actual Human Hours</p>
          <p className="mt-2 text-xl font-semibold text-white">{boardMetrics.actualHours}h</p>
        </div>
        <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] px-4 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Human Variance</p>
          <p className={`mt-2 text-xl font-semibold ${boardMetrics.variance > 0 ? "text-[#ff9aa5]" : boardMetrics.variance < 0 ? "text-[#2dd4a0]" : "text-white"}`}>
            {boardMetrics.variance > 0 ? "+" : ""}{boardMetrics.variance}h
          </p>
        </div>
        <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] px-4 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Ready Agent Tasks</p>
          <p className="mt-2 text-xl font-semibold text-white">{boardMetrics.readyAgentTasks}</p>
          <p className="mt-1 text-xs text-text-secondary">
            {boardMetrics.apiEligibleTasks} API-ready · {boardMetrics.reviewFirstTasks} review-first
          </p>
        </div>
      </div>

      {mode === "internal" && projectServiceFamily ? (
        <p className="mt-3 text-sm text-text-secondary">
          Agent suggestions are filtered to the project service family: {formatLabel(projectServiceFamily)}.
        </p>
      ) : null}

      {mode === "internal" && scopeLocked ? (
        <p className="mt-3 text-sm text-[#7be2ef]">
          {canGenerateLockedApprovedPlan
            ? "Approved scope is locked. You can push the approved quote into delivery once, then ownership, status, and tracking stay live while new scoped steps move through change management."
            : "Approved scope is locked. You can still assign ownership, move status, and track delivery, but new scoped steps should come through change management."}
        </p>
      ) : null}

      {mode === "internal" && editingTaskId === "new" ? (
        <div className="mt-6 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5">
          <p className="text-sm font-semibold text-white">Add task</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm text-white">Title</span>
              <input
                value={taskDraft.title}
                onChange={(event) =>
                  setTaskDraft((current) => ({ ...current, title: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm text-white">Category</span>
              <input
                value={taskDraft.category}
                onChange={(event) =>
                  setTaskDraft((current) => ({ ...current, category: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm text-white">Description</span>
              <textarea
                value={taskDraft.description}
                onChange={(event) =>
                  setTaskDraft((current) => ({
                    ...current,
                    description: event.target.value
                  }))
                }
                className="mt-2 min-h-[120px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm text-white">Assignee</span>
              <select
                value={taskDraft.assigneeType}
                onChange={(event) => updateTaskDraft("assigneeType", event.target.value)}
                className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
              >
                <option value="Human">Human</option>
                <option value="Agent">Agent</option>
                <option value="Client">Client</option>
              </select>
            </label>
            {taskDraft.assigneeType === "Agent" ? (
              <label className="block">
                <span className="text-sm text-white">Assigned agent</span>
                <select
                  value={taskDraft.assignedAgentId}
                  onChange={(event) =>
                    updateTaskDraft("assignedAgentId", event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="">Select agent</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="block">
              <span className="text-sm text-white">Status</span>
              <select
                value={taskDraft.status}
                onChange={(event) =>
                  setTaskDraft((current) => ({ ...current, status: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
              >
                {boardColumns.map((statusOption) => (
                  <option key={statusOption.key} value={statusOption.key}>
                    {statusOption.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-white">Execution readiness</span>
              <select
                value={taskDraft.executionReadiness}
                onChange={(event) =>
                  setTaskDraft((current) => ({
                    ...current,
                    executionReadiness: event.target.value
                  }))
                }
                className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
              >
                <option value="not_ready">Not ready</option>
                <option value="assisted">Agent assisted</option>
                <option value="ready_with_review">Ready with review</option>
                <option value="ready">Ready</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-white">Execution Type</span>
              <input
                value={taskDraft.executionType}
                onChange={(event) =>
                  setTaskDraft((current) => ({
                    ...current,
                    executionType: event.target.value
                  }))
                }
                className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm text-white">Priority</span>
              <select
                value={taskDraft.priority}
                onChange={(event) =>
                  setTaskDraft((current) => ({
                    ...current,
                    priority: event.target.value
                  }))
                }
                className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-white">Planned hours</span>
              <input
                type="number"
                value={taskDraft.plannedHours}
                onChange={(event) =>
                  setTaskDraft((current) => ({
                    ...current,
                    plannedHours: event.target.value
                  }))
                }
                className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm text-white">Actual hours</span>
              <input
                type="number"
                value={taskDraft.actualHours}
                onChange={(event) =>
                  setTaskDraft((current) => ({
                    ...current,
                    actualHours: event.target.value
                  }))
                }
                className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-white">
              <input
                type="checkbox"
                checked={taskDraft.qaRequired}
                onChange={(event) =>
                  setTaskDraft((current) => ({
                    ...current,
                    qaRequired: event.target.checked
                  }))
                }
              />
              QA required
            </label>
            <label className="flex items-center gap-2 text-sm text-white">
              <input
                type="checkbox"
                checked={taskDraft.approvalRequired}
                onChange={(event) =>
                  setTaskDraft((current) => ({
                    ...current,
                    approvalRequired: event.target.checked
                  }))
                }
              />
              Approval required
            </label>
          </div>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => void saveTask()}
              disabled={savingTask}
              className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#081120] disabled:opacity-60"
            >
              {savingTask ? "Saving..." : "Save Task"}
            </button>
            <button
              type="button"
              onClick={cancelEditingTask}
              className="rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-3 text-sm font-medium text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 overflow-x-auto">
          <div className="grid min-w-[1500px] gap-4 xl:grid-cols-5">
            {boardColumns.map((column) => (
              <div
                key={column.key}
                className="h-40 animate-pulse rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126]"
              />
            ))}
          </div>
        </div>
      ) : totalCount > 0 ? (
        <div className="mt-6 overflow-x-auto">
          <div className="grid min-w-[1500px] gap-4 xl:grid-cols-5">
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
                          <span
                            className={`rounded px-2 py-1 text-xs font-medium ${executionLaneClass(
                              task.executionPath.lane
                            )}`}
                          >
                            {task.executionPath.label}
                          </span>
                          <span
                            className={`rounded px-2 py-1 text-xs font-medium ${
                              task.scopeOrigin?.toLowerCase() === "change_request"
                                ? "bg-[rgba(123,226,239,0.14)] text-[#7be2ef]"
                                : "bg-[rgba(255,255,255,0.08)] text-text-secondary"
                            }`}
                          >
                            {task.scopeOrigin?.toLowerCase() === "change_request"
                              ? "Approved Change"
                              : "Baseline"}
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
                        <div className="mt-3 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0b1126] px-3 py-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-text-muted">
                            Best execution path
                          </p>
                          <p className="mt-2 text-sm text-white">
                            {task.executionPath.summary}
                          </p>
                          {task.executionPath.directActions.length > 0 ? (
                            <p className="mt-2 text-xs text-text-secondary">
                              API actions: {task.executionPath.directActions.join(", ")}
                            </p>
                          ) : null}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-muted">
                          <span>Execution: {formatLabel(task.executionType)}</span>
                          <span>Priority: {formatLabel(task.priority)}</span>
                          {task.plannedHours !== null ? (
                            <span>Planned: {task.plannedHours}h</span>
                          ) : null}
                          {task.actualHours !== null ? (
                            <span>Actual: {task.actualHours}h</span>
                          ) : null}
                          <span>Readiness: {formatLabel(task.executionReadiness)}</span>
                          {task.qaRequired ? <span>QA required</span> : null}
                          {task.approvalRequired ? (
                            <span>Approval required</span>
                          ) : null}
                          {task.changeRequestId ? (
                            <span>Change linked</span>
                          ) : null}
                          {task.assignedAgentName ? (
                            <span>Agent: {task.assignedAgentName}</span>
                          ) : null}
                          {task.latestExecutionJob ? (
                            <span>
                              Latest run: {formatLabel(task.latestExecutionJob.status)}
                              {task.latestExecutionJob.resultStatus
                                ? ` (${formatLabel(task.latestExecutionJob.resultStatus)})`
                                : ""}
                            </span>
                          ) : null}
                        </div>
                        {mode === "internal" ? (
                          <>
                            {editingTaskId === task.id ? (
                              <div className="mt-4 space-y-3">
                                {scopeLocked ? (
                                  <p className="text-xs text-[#7be2ef]">
                                    Approved scope fields are locked. You can still update
                                    ownership, readiness, status, and actual hours here.
                                  </p>
                                ) : null}
                                <input
                                  value={taskDraft.title}
                                  onChange={(event) =>
                                    setTaskDraft((current) => ({
                                      ...current,
                                      title: event.target.value
                                    }))
                                  }
                                  disabled={scopeLocked}
                                  className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                />
                                <textarea
                                  value={taskDraft.description}
                                  onChange={(event) =>
                                    setTaskDraft((current) => ({
                                      ...current,
                                      description: event.target.value
                                    }))
                                  }
                                  disabled={scopeLocked}
                                  className="min-h-[100px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                />
                                <div className="grid gap-3 md:grid-cols-2">
                                  <input
                                    value={taskDraft.category}
                                    onChange={(event) =>
                                      setTaskDraft((current) => ({
                                        ...current,
                                        category: event.target.value
                                      }))
                                    }
                                    placeholder="Category"
                                    disabled={scopeLocked}
                                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                  />
                                  <input
                                    value={taskDraft.executionType}
                                    onChange={(event) =>
                                      setTaskDraft((current) => ({
                                        ...current,
                                        executionType: event.target.value
                                      }))
                                    }
                                    placeholder="Execution type"
                                    disabled={scopeLocked}
                                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                  />
                                  <select
                                    value={taskDraft.assigneeType}
                                    onChange={(event) =>
                                      updateTaskDraft("assigneeType", event.target.value)
                                    }
                                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                                  >
                                    <option value="Human">Human</option>
                                    <option value="Agent">Agent</option>
                                    <option value="Client">Client</option>
                                  </select>
                                  {taskDraft.assigneeType === "Agent" ? (
                                    <select
                                      value={taskDraft.assignedAgentId}
                                      onChange={(event) =>
                                        updateTaskDraft("assignedAgentId", event.target.value)
                                      }
                                      className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                                    >
                                      <option value="">Select agent</option>
                                      {agents.map((agent) => (
                                        <option key={agent.id} value={agent.id}>
                                          {agent.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : null}
                                  <select
                                    value={taskDraft.priority}
                                    onChange={(event) =>
                                      setTaskDraft((current) => ({
                                        ...current,
                                        priority: event.target.value
                                      }))
                                    }
                                    disabled={scopeLocked}
                                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                  </select>
                                  <select
                                    value={taskDraft.status}
                                    onChange={(event) =>
                                      setTaskDraft((current) => ({
                                        ...current,
                                        status: event.target.value
                                      }))
                                    }
                                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                                  >
                                    {boardColumns.map((statusOption) => (
                                      <option key={statusOption.key} value={statusOption.key}>
                                        {statusOption.label}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    value={taskDraft.executionReadiness}
                                    onChange={(event) =>
                                      setTaskDraft((current) => ({
                                        ...current,
                                        executionReadiness: event.target.value
                                      }))
                                    }
                                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                                  >
                                    <option value="not_ready">Not ready</option>
                                    <option value="assisted">Agent assisted</option>
                                    <option value="ready_with_review">Ready with review</option>
                                    <option value="ready">Ready</option>
                                  </select>
                                  <input
                                    type="number"
                                    value={taskDraft.plannedHours}
                                    onChange={(event) =>
                                      setTaskDraft((current) => ({
                                        ...current,
                                        plannedHours: event.target.value
                                      }))
                                    }
                                    placeholder="Planned hours"
                                    disabled={scopeLocked}
                                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                  />
                                  <input
                                    type="number"
                                    value={taskDraft.actualHours}
                                    onChange={(event) =>
                                      setTaskDraft((current) => ({
                                        ...current,
                                        actualHours: event.target.value
                                      }))
                                    }
                                    placeholder="Actual hours"
                                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                                  />
                                </div>
                                <div className="flex flex-wrap gap-4">
                                  <label className="flex items-center gap-2 text-sm text-white">
                                    <input
                                      type="checkbox"
                                      checked={taskDraft.qaRequired}
                                      onChange={(event) =>
                                        setTaskDraft((current) => ({
                                          ...current,
                                          qaRequired: event.target.checked
                                        }))
                                      }
                                      disabled={scopeLocked}
                                    />
                                    QA required
                                  </label>
                                  <label className="flex items-center gap-2 text-sm text-white">
                                    <input
                                      type="checkbox"
                                      checked={taskDraft.approvalRequired}
                                      onChange={(event) =>
                                        setTaskDraft((current) => ({
                                          ...current,
                                          approvalRequired: event.target.checked
                                        }))
                                      }
                                      disabled={scopeLocked}
                                    />
                                    Approval required
                                  </label>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                  <button
                                    type="button"
                                    onClick={() => void saveTask(task.id)}
                                    disabled={savingTask}
                                    className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#081120] disabled:opacity-60"
                                  >
                                    {savingTask ? "Saving..." : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEditingTask}
                                    className="rounded-xl border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm font-medium text-white"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => startEditingTask(task)}
                                    className="rounded-xl border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs font-medium text-white"
                                  >
                                    Edit
                                  </button>
                                  {task.assigneeType?.toLowerCase() === "agent" && task.assignedAgentId && ["ready_with_review", "ready"].includes(task.executionReadiness) && !task.approvalRequired ? (
                                    <button
                                      type="button"
                                      onClick={() => void queueAgentRun(task.id)}
                                      disabled={queueingTaskId === task.id}
                                      className="rounded-xl border border-[rgba(79,142,247,0.35)] px-3 py-2 text-xs font-medium text-[#8fb4ff] disabled:opacity-60"
                                    >
                                      {queueingTaskId === task.id
                                        ? "Queueing..."
                                        : task.executionPath.apiEligible
                                          ? "Queue API Agent Run"
                                          : "Queue Review Run"}
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => void deleteTask(task.id)}
                                    disabled={deletingTaskId === task.id || scopeLocked}
                                    className="rounded-xl border border-[rgba(224,80,96,0.35)] px-3 py-2 text-xs font-medium text-[#ff8f9c] disabled:opacity-60"
                                  >
                                    {deletingTaskId === task.id ? "Deleting..." : "Delete"}
                                  </button>
                                </div>
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
                                {task.assigneeType?.toLowerCase() === "agent" &&
                                (!task.assignedAgentId ||
                                  task.approvalRequired ||
                                  !["ready_with_review", "ready"].includes(task.executionReadiness)) ? (
                                  <p className="mt-3 text-xs text-text-secondary">
                                    {task.approvalRequired
                                      ? "Approval is still required before this agent task can be queued."
                                      : !task.assignedAgentId
                                        ? "Assign an agent before queueing execution."
                                        : "Move readiness to Ready with review or Ready before queueing execution."}
                                  </p>
                                ) : null}
                              </>
                            )}
                          </>
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
