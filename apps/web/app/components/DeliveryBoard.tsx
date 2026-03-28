"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  category: string | null;
  executionType: string;
  executionLaneRationale: string | null;
  hubspotTierRequired: string | null;
  coworkBrief: string | null;
  manualInstructions: string | null;
  apiPayload: Record<string, unknown> | null;
  agentModuleKey: string | null;
  executionPayload: Record<string, unknown> | null;
  validationStatus: string;
  validationEvidence: string | null;
  findingId: string | null;
  recommendationId: string | null;
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
  latestApproval?: {
    id: string;
    status: string;
    requestedAt: string;
    approvedAt: string | null;
    rejectedAt: string | null;
    approvedBy: string | null;
    rejectedBy: string | null;
    notes: string | null;
  } | null;
  latestExecutionJob?: {
    id: string;
    status: string;
    resultStatus: string | null;
    outputSummary: string | null;
    createdAt: string;
    completedAt: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

const boardColumns = [
  { key: "backlog", label: "Backlog" },
  { key: "todo", label: "To Do" },
  { key: "waiting_on_client", label: "Waiting on Client" },
  { key: "waiting_on_partner", label: "Waiting on Partner" },
  { key: "in_progress", label: "In Progress" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" }
] as const;

interface FindingRecord {
  id: string;
  projectId: string;
  area: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  quickWin: boolean;
  phaseRecommendation: string;
  evidence: string | null;
  status: "open" | "in_progress" | "resolved";
}

const LANE_BADGE: Record<string, { label: string; className: string }> = {
  api: {
    label: "API",
    className: "bg-[rgba(45,212,160,0.18)] text-[#2dd4a0]"
  },
  cowork: {
    label: "Cowork",
    className: "bg-[rgba(79,142,247,0.18)] text-[#8fb4ff]"
  },
  manual: {
    label: "Manual",
    className: "bg-[rgba(255,214,102,0.16)] text-[#ffd666]"
  },
  blocked_by_tier: {
    label: "Blocked by Tier",
    className: "bg-[rgba(255,154,165,0.18)] text-[#ff9aa5]"
  }
};

const QUICK_WIN_SEVERITY_CLASS: Record<FindingRecord["severity"], string> = {
  low: "bg-[rgba(255,255,255,0.08)] text-text-secondary",
  medium: "bg-[rgba(255,214,102,0.16)] text-[#ffd666]",
  high: "bg-[rgba(240,160,80,0.18)] text-[#f0a050]",
  critical: "bg-[rgba(255,154,165,0.18)] text-[#ff9aa5]"
};

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
    case "partner":
      return "Partner";
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
    case "partner":
      return "bg-[rgba(190,120,255,0.18)] text-[#d2a8ff]";
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

function taskLaneBadge(value: string) {
  const badge = LANE_BADGE[value];

  if (badge) {
    return badge;
  }

  return {
    label: formatLabel(value),
    className: "bg-[rgba(255,255,255,0.08)] text-text-secondary"
  };
}

interface AgentOption {
  id: string;
  name: string;
  isActive: boolean;
  serviceFamily?: string;
}

interface DeliveryTemplateOption {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  serviceFamily: string;
  category: string;
  scopeType: string;
  recommendedHubs: string[];
  defaultPlannedHours: number | null;
  tasks: Array<{
    id: string;
    title: string;
  }>;
}

function deriveRecommendedTemplateIds(
  project: {
    scopeType?: string | null;
    selectedHubs?: string[];
  },
  templates: DeliveryTemplateOption[]
) {
  const selectedHubs = new Set(project.selectedHubs ?? []);
  const scopeType = project.scopeType?.toLowerCase() ?? "";

  return Array.from(
    new Set(
      templates
        .filter((template) => {
          const matchesScope =
            scopeType.length > 0 &&
            template.scopeType.toLowerCase() === scopeType;
          const matchesHub = template.recommendedHubs.some((hub) =>
            selectedHubs.has(hub)
          );
          const matchesCmsTheme =
            selectedHubs.has("cms") &&
            (template.slug.includes("theme") ||
              template.name.toLowerCase().includes("theme") ||
              template.description?.toLowerCase().includes("theme"));

          return matchesScope || matchesHub || Boolean(matchesCmsTheme);
        })
        .map((template) => template.id)
    )
  );
}

export default function DeliveryBoard({
  projectId,
  mode = "internal"
}: {
  projectId: string;
  mode?: "internal" | "client" | "partner";
}) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [findings, setFindings] = useState<FindingRecord[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [templates, setTemplates] = useState<DeliveryTemplateOption[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [projectServiceFamily, setProjectServiceFamily] = useState<
    string | null
  >(null);
  const [projectScopeType, setProjectScopeType] = useState<string | null>(null);
  const [projectSelectedHubs, setProjectSelectedHubs] = useState<string[]>([]);
  const [scopeLocked, setScopeLocked] = useState(false);
  const [quoteApproved, setQuoteApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [creatingQuickWinTaskId, setCreatingQuickWinTaskId] = useState<
    string | null
  >(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [queueingTaskId, setQueueingTaskId] = useState<string | null>(null);
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null);
  const [approvalTaskId, setApprovalTaskId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"board" | "quick_wins">(
    "board"
  );
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

  const isPortalMode = mode !== "internal";
  const baseUrl =
    isPortalMode
      ? `/api/client/projects/${encodeURIComponent(projectId)}/tasks`
      : `/api/projects/${encodeURIComponent(projectId)}/tasks`;
  const boardUrl = `/api/projects/${encodeURIComponent(projectId)}/tasks/board`;

  async function loadTasks() {
    setLoading(true);
    setError(null);

    try {
      let internalProject:
        | {
            serviceFamily?: string | null;
            quoteApprovalStatus?: string | null;
            scopeLockedAt?: string | null;
            scopeType?: string | null;
            selectedHubs?: string[];
          }
        | null = null;
      const [tasksResponse, agentsResponse, projectResponse] =
        await Promise.all([
          fetch(isPortalMode ? baseUrl : boardUrl, {
            ...(isPortalMode ? { credentials: "include" } : {})
          }),
          mode === "internal" ? fetch("/api/agents") : Promise.resolve(null),
          mode === "internal"
            ? fetch(`/api/projects/${encodeURIComponent(projectId)}`)
            : Promise.resolve(null)
        ]);
      const templatesResponse =
        mode === "internal" ? await fetch("/api/delivery-templates") : null;
      const findingsResponse =
        mode === "internal"
          ? await fetch(
              `/api/projects/${encodeURIComponent(projectId)}/findings`
            )
          : null;

      const body = await tasksResponse.json().catch(() => null);

      if (!tasksResponse.ok) {
        throw new Error(body?.error ?? "Failed to load delivery board");
      }

      if (mode === "internal") {
        const flattenedTasks = Object.values(body?.columns ?? {}).flat() as ProjectTask[];
        setTasks(flattenedTasks);
      } else {
        setTasks(body?.tasks ?? []);
      }
      if (findingsResponse?.ok) {
        const findingsBody = await findingsResponse.json().catch(() => null);
        setFindings(findingsBody?.findings ?? []);
      } else if (mode === "internal") {
        setFindings([]);
      }

      if (mode === "internal" && agentsResponse) {
        const agentsBody = await agentsResponse.json().catch(() => null);
        let currentServiceFamily: string | null = null;

        if (projectResponse?.ok) {
          const projectBody = await projectResponse.json().catch(() => null);
          internalProject = projectBody?.project ?? null;
          currentServiceFamily = internalProject?.serviceFamily ?? null;
          setQuoteApproved(
            internalProject?.quoteApprovalStatus === "approved"
          );
          setScopeLocked(
            Boolean(
              internalProject?.scopeLockedAt ||
              internalProject?.quoteApprovalStatus === "approved"
            )
          );
          setProjectServiceFamily(currentServiceFamily);
          setProjectScopeType(internalProject?.scopeType ?? null);
          setProjectSelectedHubs(internalProject?.selectedHubs ?? []);
        }

        if (agentsResponse.ok) {
          const loadedAgents = (agentsBody?.agents ?? []).filter(
            (agent: AgentOption & { serviceFamily?: string }) => agent.isActive
          );
          setAgents(
            currentServiceFamily
              ? loadedAgents.filter(
                  (agent: AgentOption & { serviceFamily?: string }) =>
                    !agent.serviceFamily ||
                    agent.serviceFamily === currentServiceFamily
                )
              : loadedAgents
          );
        }

        if (templatesResponse?.ok) {
          const templatesBody = await templatesResponse.json().catch(() => null);
          const loadedTemplates = (templatesBody?.templates ??
            []) as DeliveryTemplateOption[];
          const recommendedTemplateIds = deriveRecommendedTemplateIds(
            {
              scopeType: internalProject?.scopeType ?? null,
              selectedHubs: internalProject?.selectedHubs ?? []
            },
            loadedTemplates
          );

          setTemplates(loadedTemplates);
          setSelectedTemplateIds((currentIds) =>
            currentIds.length > 0 ? currentIds : recommendedTemplateIds
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

  useEffect(() => {
    if (mode !== "internal") {
      return;
    }

    const activeJobs = tasks
      .filter((task) =>
        task.latestExecutionJob &&
        ["queued", "running"].includes(task.latestExecutionJob.status)
      )
      .map((task) => ({
        taskId: task.id,
        jobId: task.latestExecutionJob?.id ?? ""
      }))
      .filter((item) => item.jobId);

    if (activeJobs.length === 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void Promise.all(
        activeJobs.map(async ({ taskId, jobId }) => {
          const response = await fetch(
            `/api/execution-jobs/${encodeURIComponent(jobId)}/status`
          );
          const body = await response.json().catch(() => null);

          if (!response.ok) {
            return;
          }

          setTasks((currentTasks) =>
            currentTasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    latestExecutionJob: task.latestExecutionJob
                      ? {
                          ...task.latestExecutionJob,
                          status: body.status,
                          resultStatus: body.resultStatus ?? null,
                          completedAt: body.completedAt ?? null
                        }
                      : task.latestExecutionJob
                  }
                : task
            )
          );
        })
      );
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [mode, tasks]);

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
              value === "Client" || value === "Partner"
                ? "not_ready"
                : "assisted";
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
    if (selectedTemplateIds.length === 0) {
      setError("Select at least one delivery template to load.");
      return;
    }

    if (
      totalCount > 0 &&
      !window.confirm(
        "Replace the current delivery board with the selected delivery templates?"
      )
    ) {
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/tasks/load-templates`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            templateIds: selectedTemplateIds
          })
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to load delivery templates");
      }

      setTasks(body?.tasks ?? []);
      setShowTemplatePicker(false);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Failed to load delivery templates"
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
        `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/status`,
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
      setError(
        queueError instanceof Error
          ? queueError.message
          : "Failed to queue agent run"
      );
    } finally {
      setQueueingTaskId(null);
    }
  }

  async function executeTask(taskId: string) {
    setExecutingTaskId(taskId);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/execute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ dryRun: false })
        }
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to execute task");
      }

      await loadTasks();
    } catch (executionError) {
      setError(
        executionError instanceof Error
          ? executionError.message
          : "Failed to execute task"
      );
    } finally {
      setExecutingTaskId(null);
    }
  }

  async function requestApproval(taskId: string) {
    setApprovalTaskId(taskId);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/request-approval`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        }
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to request approval");
      }

      await loadTasks();
    } catch (approvalError) {
      setError(
        approvalError instanceof Error
          ? approvalError.message
          : "Failed to request approval"
      );
    } finally {
      setApprovalTaskId(null);
    }
  }

  async function approveTask(taskId: string) {
    setApprovalTaskId(taskId);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        }
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to approve task");
      }

      await loadTasks();
    } catch (approvalError) {
      setError(
        approvalError instanceof Error
          ? approvalError.message
          : "Failed to approve task"
      );
    } finally {
      setApprovalTaskId(null);
    }
  }

  async function deleteTask(taskId: string) {
    const confirmed = window.confirm(
      "Delete this task from the delivery board?"
    );

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

  async function createTaskFromQuickWin(finding: FindingRecord) {
    setCreatingQuickWinTaskId(finding.id);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/tasks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title: finding.title,
            description: `Auto-created from quick win finding: ${finding.title}`,
            category: formatLabel(finding.area),
            findingId: finding.id,
            executionType: "manual",
            status: "backlog"
          })
        }
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to create quick win task");
      }

      setTasks((currentTasks) => [...currentTasks, body.task]);
      setActivePanel("board");
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to create quick win task"
      );
    } finally {
      setCreatingQuickWinTaskId(null);
    }
  }

  const totalCount = useMemo(() => tasks.length, [tasks]);
  const quickWins = useMemo(
    () => findings.filter((finding) => finding.quickWin),
    [findings]
  );
  const quickWinsByArea = useMemo(() => {
    return quickWins.reduce<Record<string, FindingRecord[]>>(
      (groups, finding) => {
        const area = finding.area || "other";
        groups[area] = [...(groups[area] ?? []), finding];
        return groups;
      },
      {}
    );
  }, [quickWins]);
  const canGenerateLockedApprovedPlan =
    mode === "internal" && scopeLocked && quoteApproved && totalCount === 0;
  const selectedTemplateSummaries = useMemo(
    () =>
      templates.filter((template) => selectedTemplateIds.includes(template.id)),
    [selectedTemplateIds, templates]
  );
  const boardMetrics = useMemo(() => {
    const humanTasks = tasks.filter(
      (task) =>
        task.assigneeType?.toLowerCase() !== "agent" &&
        task.assigneeType?.toLowerCase() !== "client" &&
        task.assigneeType?.toLowerCase() !== "partner"
    );
    const plannedHours = humanTasks.reduce(
      (sum, task) =>
        sum + (typeof task.plannedHours === "number" ? task.plannedHours : 0),
      0
    );
    const actualHours = humanTasks.reduce(
      (sum, task) =>
        sum + (typeof task.actualHours === "number" ? task.actualHours : 0),
      0
    );
    const readyAgentTasks = tasks.filter(
      (task) =>
        task.assigneeType?.toLowerCase() === "agent" &&
        ["ready_with_review", "ready"].includes(task.executionReadiness)
    ).length;
    const apiEligibleTasks = tasks.filter(
      (task) => task.executionPath.apiEligible
    ).length;
    const reviewFirstTasks = tasks.filter(
      (task) =>
        task.executionPath.lane === "workflow_bridge" ||
        task.executionPath.lane === "manual_review"
    ).length;
    const completedTasks = tasks.filter(
      (task) => task.status === "done"
    ).length;
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
            {isPortalMode
              ? "Track the delivery plan and current progress for this project."
              : "Load prescribed delivery templates or use the board as your repeatable working workspace for this project."}
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
              <Link
                href="/templates"
                className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm font-medium text-text-secondary transition hover:border-[rgba(123,226,239,0.4)] hover:text-white"
              >
                Edit Templates
              </Link>
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
                onClick={() => setShowTemplatePicker((current) => !current)}
                disabled={
                  generating || (scopeLocked && !canGenerateLockedApprovedPlan)
                }
                className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
              >
                {showTemplatePicker ? "Hide Templates" : "Load Templates"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-[#ff8f9c]">{error}</p> : null}

      {mode === "internal" && showTemplatePicker ? (
        <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">
                Load prescribed delivery templates
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Build the delivery board from checked scope tracks instead of
                generating a generic plan.
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-text-muted">
                Scope type: {formatLabel(projectScopeType ?? "not_set")} · Hubs:{" "}
                {projectSelectedHubs.length > 0
                  ? projectSelectedHubs.join(", ")
                  : "none set"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void generatePlan()}
              disabled={
                generating ||
                selectedTemplateIds.length === 0 ||
                (scopeLocked && !canGenerateLockedApprovedPlan)
              }
              className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-white px-4 py-3 text-sm font-medium text-[#081120] disabled:cursor-not-allowed disabled:bg-[rgba(255,255,255,0.08)] disabled:text-text-muted"
            >
              {generating
                ? "Loading Templates..."
                : totalCount > 0
                  ? "Replace Board with Templates"
                  : "Load Selected Templates"}
            </button>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {templates.map((template) => {
              const active = selectedTemplateIds.includes(template.id);

              return (
                <label
                  key={template.id}
                  className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors ${
                    active
                      ? "border-[rgba(81,208,176,0.55)] bg-[rgba(81,208,176,0.08)]"
                      : "border-[rgba(255,255,255,0.07)] bg-background-card"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(event) => {
                      setSelectedTemplateIds((currentIds) =>
                        event.target.checked
                          ? [...currentIds, template.id]
                          : currentIds.filter((templateId) => templateId !== template.id)
                      );
                    }}
                    className="mt-1 h-4 w-4 rounded border-[rgba(255,255,255,0.18)] bg-[#081120] text-[#51d0b0]"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">
                        {template.name}
                      </p>
                      <span className="rounded-full bg-[rgba(255,255,255,0.08)] px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                        {formatLabel(template.scopeType)}
                      </span>
                      {template.recommendedHubs.map((hub) => (
                        <span
                          key={`${template.id}-${hub}`}
                          className="rounded-full bg-[rgba(79,142,247,0.16)] px-2 py-0.5 text-[11px] font-medium text-[#8fb4ff]"
                        >
                          {hub}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-text-secondary">
                      {template.description ?? "No template description yet."}
                    </p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-text-muted">
                      {template.tasks.length} tasks
                      {template.defaultPlannedHours
                        ? ` · ${template.defaultPlannedHours}h default`
                        : ""}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

          {selectedTemplateSummaries.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-text-muted">
                Selected template stack
              </p>
              <p className="mt-2 text-sm text-white">
                {selectedTemplateSummaries.map((template) => template.name).join(" + ")}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {selectedTemplateSummaries.reduce(
                  (sum, template) => sum + template.tasks.length,
                  0
                )}{" "}
                templated tasks will be loaded onto this board.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === "internal" && quickWins.length > 0 ? (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setActivePanel("board")}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              activePanel === "board"
                ? "bg-white text-[#081120]"
                : "border border-[rgba(255,255,255,0.08)] bg-[#0b1126] text-white"
            }`}
          >
            Delivery Board
          </button>
          <button
            type="button"
            onClick={() => setActivePanel("quick_wins")}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              activePanel === "quick_wins"
                ? "bg-white text-[#081120]"
                : "border border-[rgba(255,255,255,0.08)] bg-[#0b1126] text-white"
            }`}
          >
            Quick Wins ({quickWins.length})
          </button>
        </div>
      ) : null}

      {activePanel === "quick_wins" &&
      mode === "internal" &&
      quickWins.length > 0 ? (
        <div className="mt-6 space-y-4">
          {Object.entries(quickWinsByArea).map(([area, areaFindings]) => (
            <div
              key={area}
              className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {formatLabel(area)}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {areaFindings.length} quick win
                    {areaFindings.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {areaFindings.map((finding) => {
                  const linkedTask = tasks.find(
                    (task) => task.findingId === finding.id
                  );

                  return (
                    <div
                      key={finding.id}
                      className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${QUICK_WIN_SEVERITY_CLASS[finding.severity]}`}
                        >
                          {formatLabel(finding.severity)}
                        </span>
                        <span className="rounded-full bg-[rgba(81,208,176,0.12)] px-2 py-0.5 text-[11px] font-medium text-[#51d0b0]">
                          {formatLabel(finding.phaseRecommendation)}
                        </span>
                        {linkedTask ? (
                          <span className="rounded-full bg-[rgba(255,255,255,0.08)] px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                            Task linked
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm font-medium text-white">
                        {finding.title}
                      </p>
                      <p className="mt-2 text-sm text-text-secondary">
                        {finding.description}
                      </p>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="text-xs uppercase tracking-[0.16em] text-text-muted">
                          {formatLabel(finding.area)}
                        </span>
                        <button
                          type="button"
                          onClick={() => void createTaskFromQuickWin(finding)}
                          disabled={
                            creatingQuickWinTaskId === finding.id ||
                            Boolean(linkedTask)
                          }
                          className="rounded-xl border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                        >
                          {linkedTask
                            ? "Task created"
                            : creatingQuickWinTaskId === finding.id
                              ? "Creating..."
                              : "Create Task"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className={`mt-4 grid gap-3 md:grid-cols-2 ${isPortalMode ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>
            <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                {isPortalMode ? "Planned Time" : "Planned Human Hours"}
              </p>
              <p className="mt-2 text-xl font-semibold text-white">
                {boardMetrics.plannedHours}h
              </p>
            </div>
            <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                {isPortalMode ? "Time Logged" : "Actual Human Hours"}
              </p>
              <p className="mt-2 text-xl font-semibold text-white">
                {boardMetrics.actualHours}h
              </p>
            </div>
            <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                Variance
              </p>
              <p
                className={`mt-2 text-xl font-semibold ${boardMetrics.variance > 0 ? "text-[#ff9aa5]" : boardMetrics.variance < 0 ? "text-[#2dd4a0]" : "text-white"}`}
              >
                {boardMetrics.variance > 0 ? "+" : ""}
                {boardMetrics.variance}h
              </p>
            </div>
            {mode === "internal" ? (
              <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                  Ready Agent Tasks
                </p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {boardMetrics.readyAgentTasks}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {boardMetrics.apiEligibleTasks} API-ready ·{" "}
                  {boardMetrics.reviewFirstTasks} review-first
                </p>
              </div>
            ) : null}
          </div>

          {mode === "internal" && projectServiceFamily ? (
            <p className="mt-3 text-sm text-text-secondary">
              Agent suggestions are filtered to the project service family:{" "}
              {formatLabel(projectServiceFamily)}.
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
                      setTaskDraft((current) => ({
                        ...current,
                        title: event.target.value
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-white">Category</span>
                  <input
                    value={taskDraft.category}
                    onChange={(event) =>
                      setTaskDraft((current) => ({
                        ...current,
                        category: event.target.value
                      }))
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
                    onChange={(event) =>
                      updateTaskDraft("assigneeType", event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="Human">Human</option>
                    <option value="Agent">Agent</option>
                    <option value="Client">Client</option>
                    <option value="Partner">Partner</option>
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
                      setTaskDraft((current) => ({
                        ...current,
                        status: event.target.value
                      }))
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
                  <span className="text-sm text-white">
                    Execution readiness
                  </span>
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
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:min-w-[2100px] xl:grid-cols-7">
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
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:min-w-[2100px] xl:grid-cols-7">
                {boardColumns.map((column) => {
                  const columnTasks = tasks.filter(
                    (task) => task.status === column.key
                  );

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
                              {(() => {
                                const badge = taskLaneBadge(task.executionType);

                                return (
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
                                      className={`rounded px-2 py-1 text-xs font-medium ${badge.className}`}
                                    >
                                      {badge.label}
                                    </span>
                                    <span
                                      className={`rounded px-2 py-1 text-xs font-medium ${
                                        task.scopeOrigin?.toLowerCase() ===
                                        "change_request"
                                          ? "bg-[rgba(123,226,239,0.14)] text-[#7be2ef]"
                                          : "bg-[rgba(255,255,255,0.08)] text-text-secondary"
                                      }`}
                                    >
                                      {task.scopeOrigin?.toLowerCase() ===
                                      "change_request"
                                        ? "Approved Change"
                                        : "Baseline"}
                                    </span>
                                    {task.category ? (
                                      <span className="text-xs text-text-muted">
                                        {task.category}
                                      </span>
                                    ) : null}
                                  </div>
                                );
                              })()}
                              <p className="mt-3 text-sm font-medium text-white">
                                {task.title}
                              </p>
                              {task.description ? (
                                <p className="mt-2 text-sm text-text-secondary">
                                  {task.description}
                                </p>
                              ) : null}
                              {mode === "internal" ? (
                                <div className="mt-3 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0b1126] px-3 py-3">
                                  <p className="text-xs uppercase tracking-[0.16em] text-text-muted">
                                    Best execution path
                                  </p>
                                  <p className="mt-2 text-sm text-white">
                                    {task.executionPath.summary}
                                  </p>
                                  {task.executionPath.directActions.length > 0 ? (
                                    <p className="mt-2 text-xs text-text-secondary">
                                      API actions:{" "}
                                      {task.executionPath.directActions.join(
                                        ", "
                                      )}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}
                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-muted">
                                {mode === "internal" ? (
                                  <span>
                                    Execution: {formatLabel(task.executionType)}
                                  </span>
                                ) : null}
                                <span>
                                  Priority: {formatLabel(task.priority)}
                                </span>
                                {task.plannedHours !== null ? (
                                  <span>Planned: {task.plannedHours}h</span>
                                ) : null}
                                {task.actualHours !== null ? (
                                  <span>Actual: {task.actualHours}h</span>
                                ) : null}
                                {mode === "internal" ? (
                                  <>
                                    <span>
                                      Readiness:{" "}
                                      {formatLabel(task.executionReadiness)}
                                    </span>
                                    <span>
                                      Validation:{" "}
                                      {formatLabel(task.validationStatus)}
                                    </span>
                                    {task.qaRequired ? (
                                      <span>QA required</span>
                                    ) : null}
                                    {task.approvalRequired ? (
                                      <span>Approval required</span>
                                    ) : null}
                                    {task.hubspotTierRequired ? (
                                      <span>
                                        Hub tier: {task.hubspotTierRequired}
                                      </span>
                                    ) : null}
                                    {task.changeRequestId ? (
                                      <span>Change linked</span>
                                    ) : null}
                                    {task.findingId ? (
                                      <span>Linked finding</span>
                                    ) : null}
                                    {task.assignedAgentName ? (
                                      <span>Assignee: {task.assignedAgentName}</span>
                                    ) : null}
                                    {task.latestExecutionJob ? (
                                      <span>
                                        Latest run:{" "}
                                        {formatLabel(
                                          task.latestExecutionJob.status
                                        )}
                                        {task.latestExecutionJob.resultStatus
                                          ? ` (${formatLabel(task.latestExecutionJob.resultStatus)})`
                                          : ""}
                                      </span>
                                    ) : null}
                                    {task.latestApproval ? (
                                      <span>
                                        Approval: {formatLabel(task.latestApproval.status)}
                                      </span>
                                    ) : null}
                                  </>
                                ) : null}
                              </div>
                              {mode === "internal" && task.executionLaneRationale ? (
                                <p className="mt-3 text-xs text-text-secondary">
                                  Lane rationale: {task.executionLaneRationale}
                                </p>
                              ) : null}
                              {mode === "internal" && task.coworkBrief ? (
                                <p className="mt-2 text-xs text-text-secondary">
                                  Cowork brief: {task.coworkBrief}
                                </p>
                              ) : null}
                              {mode === "internal" && task.manualInstructions ? (
                                <p className="mt-2 text-xs text-text-secondary">
                                  Manual instructions: {task.manualInstructions}
                                </p>
                              ) : null}
                              {mode === "internal" && task.validationEvidence ? (
                                <p className="mt-2 text-xs text-text-secondary">
                                  Validation evidence: {task.validationEvidence}
                                </p>
                              ) : null}
                              {mode === "internal" &&
                              task.qaRequired &&
                              task.status !== "done" &&
                              (task.latestExecutionJob?.status === "complete" || task.latestExecutionJob?.status === "completed") ? (
                                <div className="mt-4 rounded-2xl border border-[rgba(123,226,239,0.25)] bg-[#0b1733] p-4 space-y-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7be2ef]">
                                      QA Review Required
                                    </span>
                                    <span className="rounded-full bg-[rgba(123,226,239,0.15)] px-2 py-0.5 text-xs text-[#7be2ef]">
                                      Agent completed
                                    </span>
                                  </div>
                                  {task.latestExecutionJob.outputSummary ? (
                                    <div className="rounded-xl bg-[#0b1126] px-4 py-3">
                                      <p className="text-xs uppercase tracking-[0.15em] text-text-muted mb-2">Agent output summary</p>
                                      <p className="text-sm text-text-secondary whitespace-pre-wrap">{task.latestExecutionJob.outputSummary}</p>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-text-muted">No output summary available. Check the Runs log for full details.</p>
                                  )}
                                  <div className="flex flex-wrap gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => void updateTaskStatus(task.id, "done")}
                                      disabled={updatingTaskId === task.id}
                                      className="rounded-xl border border-[rgba(45,212,160,0.4)] px-4 py-2 text-xs font-medium text-[#2dd4a0] disabled:opacity-60"
                                    >
                                      {updatingTaskId === task.id ? "Updating..." : "Mark QA Passed — Move to Done"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void updateTaskStatus(task.id, "todo")}
                                      disabled={updatingTaskId === task.id}
                                      className="rounded-xl border border-[rgba(255,154,165,0.35)] px-4 py-2 text-xs font-medium text-[#ff9aa5] disabled:opacity-60"
                                    >
                                      Send Back for Rework
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                              {mode === "internal" ? (
                                <>
                                  {editingTaskId === task.id ? (
                                    <div className="mt-4 space-y-3">
                                      {scopeLocked ? (
                                        <p className="text-xs text-[#7be2ef]">
                                          Approved scope fields are locked. You
                                          can still update ownership, readiness,
                                          status, and actual hours here.
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
                                            updateTaskDraft(
                                              "assigneeType",
                                              event.target.value
                                            )
                                          }
                                          className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                                        >
                                          <option value="Human">Human</option>
                                          <option value="Agent">Agent</option>
                                          <option value="Client">Client</option>
                                          <option value="Partner">Partner</option>
                                        </select>
                                        {taskDraft.assigneeType === "Agent" ? (
                                          <select
                                            value={taskDraft.assignedAgentId}
                                            onChange={(event) =>
                                              updateTaskDraft(
                                                "assignedAgentId",
                                                event.target.value
                                              )
                                            }
                                            className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                                          >
                                            <option value="">
                                              Select agent
                                            </option>
                                            {agents.map((agent) => (
                                              <option
                                                key={agent.id}
                                                value={agent.id}
                                              >
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
                                            <option
                                              key={statusOption.key}
                                              value={statusOption.key}
                                            >
                                              {statusOption.label}
                                            </option>
                                          ))}
                                        </select>
                                        <select
                                          value={taskDraft.executionReadiness}
                                          onChange={(event) =>
                                            setTaskDraft((current) => ({
                                              ...current,
                                              executionReadiness:
                                                event.target.value
                                            }))
                                          }
                                          className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                                        >
                                          <option value="not_ready">
                                            Not ready
                                          </option>
                                          <option value="assisted">
                                            Agent assisted
                                          </option>
                                          <option value="ready_with_review">
                                            Ready with review
                                          </option>
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
                                                approvalRequired:
                                                  event.target.checked
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
                                        {["api", "cowork"].includes(
                                          task.executionType.toLowerCase()
                                        ) &&
                                        ["ready", "ready_with_review"].includes(
                                          task.executionReadiness
                                        ) ? (
                                          <button
                                            type="button"
                                            onClick={() => void executeTask(task.id)}
                                            disabled={executingTaskId === task.id}
                                            className="rounded-xl border border-[rgba(45,212,160,0.35)] px-3 py-2 text-xs font-medium text-[#2dd4a0] disabled:opacity-60"
                                          >
                                            {executingTaskId === task.id
                                              ? "Running..."
                                              : "Run"}
                                          </button>
                                        ) : null}
                                        {task.assigneeType?.toLowerCase() ===
                                          "agent" &&
                                        task.assignedAgentId &&
                                        ["ready_with_review", "ready"].includes(
                                          task.executionReadiness
                                        ) &&
                                        !task.approvalRequired ? (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              void queueAgentRun(task.id)
                                            }
                                            disabled={
                                              queueingTaskId === task.id
                                            }
                                            className="rounded-xl border border-[rgba(79,142,247,0.35)] px-3 py-2 text-xs font-medium text-[#8fb4ff] disabled:opacity-60"
                                          >
                                            {queueingTaskId === task.id
                                              ? "Queueing..."
                                              : task.executionPath.apiEligible
                                                ? "Queue API Agent Run"
                                                : "Queue Review Run"}
                                          </button>
                                        ) : null}
                                        {task.approvalRequired &&
                                        !task.latestApproval ? (
                                          <button
                                            type="button"
                                            onClick={() => void requestApproval(task.id)}
                                            disabled={approvalTaskId === task.id}
                                            className="rounded-xl border border-[rgba(255,214,102,0.35)] px-3 py-2 text-xs font-medium text-[#ffd666] disabled:opacity-60"
                                          >
                                            {approvalTaskId === task.id
                                              ? "Requesting..."
                                              : "Request Approval"}
                                          </button>
                                        ) : null}
                                        {task.approvalRequired &&
                                        task.latestApproval?.status === "pending" ? (
                                          <button
                                            type="button"
                                            onClick={() => void approveTask(task.id)}
                                            disabled={approvalTaskId === task.id}
                                            className="rounded-xl border border-[rgba(123,226,239,0.35)] px-3 py-2 text-xs font-medium text-[#7be2ef] disabled:opacity-60"
                                          >
                                            {approvalTaskId === task.id
                                              ? "Approving..."
                                              : "Approve"}
                                          </button>
                                        ) : null}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void deleteTask(task.id)
                                          }
                                          disabled={
                                            deletingTaskId === task.id ||
                                            scopeLocked
                                          }
                                          className="rounded-xl border border-[rgba(224,80,96,0.35)] px-3 py-2 text-xs font-medium text-[#ff8f9c] disabled:opacity-60"
                                        >
                                          {deletingTaskId === task.id
                                            ? "Deleting..."
                                            : "Delete"}
                                        </button>
                                      </div>
                                      <label className="mt-4 block">
                                        <span className="text-xs uppercase tracking-[0.18em] text-text-muted">
                                          Move task
                                        </span>
                                        <select
                                          value={task.status}
                                          onChange={(event) =>
                                            void updateTaskStatus(
                                              task.id,
                                              event.target.value
                                            )
                                          }
                                          disabled={updatingTaskId === task.id}
                                          className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none disabled:cursor-not-allowed"
                                        >
                                          {boardColumns.map((statusOption) => (
                                            <option
                                              key={statusOption.key}
                                              value={statusOption.key}
                                            >
                                              {statusOption.label}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                      {task.assigneeType?.toLowerCase() ===
                                        "agent" &&
                                      (!task.assignedAgentId ||
                                        task.approvalRequired ||
                                        ![
                                          "ready_with_review",
                                          "ready"
                                        ].includes(task.executionReadiness)) ? (
                                        <p className="mt-3 text-xs text-text-secondary">
                                          {task.approvalRequired
                                            ? "Approval is still required before this agent task can be queued."
                                            : !task.assignedAgentId
                                              ? "Assign an agent before queueing execution."
                                              : "Move readiness to Ready with review or Ready before queueing execution."}
                                        </p>
                                      ) : null}
                                      {["api", "cowork"].includes(
                                        task.executionType.toLowerCase()
                                      ) &&
                                      !["ready", "ready_with_review"].includes(
                                        task.executionReadiness
                                      ) ? (
                                        <p className="mt-3 text-xs text-text-secondary">
                                          API and cowork runs unlock when readiness is set
                                          to Ready or Ready with review.
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
                ? "Load the prescribed delivery templates to create the working delivery board for this project."
                : "No delivery board has been published for this project yet."}
            </div>
          )}
        </>
      )}
    </section>
  );
}
