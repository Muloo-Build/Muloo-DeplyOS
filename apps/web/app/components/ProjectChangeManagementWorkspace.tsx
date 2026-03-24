"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AppShell from "./AppShell";
import ProjectWorkflowNav from "./ProjectWorkflowNav";

type ChangeRequestStatus =
  | "new"
  | "under_review"
  | "priced"
  | "approved"
  | "rejected"
  | "appended_to_delivery"
  | "closed";

interface ProjectDetail {
  id: string;
  name: string;
  quoteApprovalStatus?: string | null;
  scopeLockedAt?: string | null;
  owner?: string | null;
  ownerEmail?: string | null;
  clientChampionFirstName?: string | null;
  clientChampionEmail?: string | null;
  client: {
    name: string;
  };
}

interface ChangeDeliveryTaskPlan {
  title: string;
  description: string;
  category: string;
  plannedHours: number;
  assigneeType: "Human" | "Agent" | "Client";
  executionType: string;
  priority: string;
  qaRequired: boolean;
  approvalRequired: boolean;
}

interface WorkRequest {
  id: string;
  projectId: string | null;
  title: string;
  serviceFamily: string;
  requestType: string;
  companyName: string | null;
  contactName: string;
  contactEmail: string;
  summary: string;
  details?: string | null;
  internalNotes?: string | null;
  commercialImpactHours?: number | null;
  commercialImpactFeeZar?: number | null;
  deliveryTasks?: ChangeDeliveryTaskPlan[];
  urgency?: string | null;
  status: string;
  approvedAt?: string | null;
  approvedByName?: string | null;
  rejectedAt?: string | null;
  deliveryAppendedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ChangeRequestDraft {
  title: string;
  summary: string;
  details: string;
  internalNotes: string;
  commercialImpactHours: string;
  commercialImpactFeeZar: string;
  approvedByName: string;
  status: ChangeRequestStatus;
  deliveryTasks: ChangeDeliveryTaskPlan[];
}

const changeStatuses: Array<{ value: ChangeRequestStatus; label: string }> = [
  { value: "new", label: "New" },
  { value: "under_review", label: "Under Review" },
  { value: "priced", label: "Priced" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "appended_to_delivery", label: "Appended to Delivery" },
  { value: "closed", label: "Closed" }
];

function formatStatusLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusPillClass(status: string) {
  switch (status) {
    case "approved":
    case "appended_to_delivery":
      return "bg-[rgba(45,212,160,0.16)] text-[#78f0c8]";
    case "rejected":
      return "bg-[rgba(224,80,96,0.16)] text-[#ff98a7]";
    case "priced":
      return "bg-[rgba(255,214,102,0.16)] text-[#ffd666]";
    default:
      return "bg-[rgba(123,226,239,0.12)] text-[#7be2ef]";
  }
}

function createEmptyTask(): ChangeDeliveryTaskPlan {
  return {
    title: "",
    description: "",
    category: "",
    plannedHours: 0,
    assigneeType: "Human",
    executionType: "manual",
    priority: "medium",
    qaRequired: false,
    approvalRequired: false
  };
}

function createNewRequestDraft(
  project: ProjectDetail | null
): ChangeRequestDraft {
  return {
    title: "",
    summary: "",
    details: "",
    internalNotes: "",
    commercialImpactHours: "",
    commercialImpactFeeZar: "",
    approvedByName: project?.owner?.trim() || "Muloo",
    status: "new",
    deliveryTasks: [createEmptyTask()]
  };
}

function createDraftFromRequest(request: WorkRequest): ChangeRequestDraft {
  return {
    title: request.title,
    summary: request.summary,
    details: request.details ?? "",
    internalNotes: request.internalNotes ?? "",
    commercialImpactHours:
      typeof request.commercialImpactHours === "number"
        ? request.commercialImpactHours.toString()
        : "",
    commercialImpactFeeZar:
      typeof request.commercialImpactFeeZar === "number"
        ? request.commercialImpactFeeZar.toString()
        : "",
    approvedByName: request.approvedByName ?? "Muloo",
    status: (request.status as ChangeRequestStatus) ?? "new",
    deliveryTasks:
      request.deliveryTasks && request.deliveryTasks.length > 0
        ? request.deliveryTasks
        : [createEmptyTask()]
  };
}

export default function ProjectChangeManagementWorkspace({
  projectId
}: {
  projectId: string;
}) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [requests, setRequests] = useState<WorkRequest[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ChangeRequestDraft>>({});
  const [newDraft, setNewDraft] = useState<ChangeRequestDraft>(
    createNewRequestDraft(null)
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [appendingId, setAppendingId] = useState<string | null>(null);

  const isScopeLocked = Boolean(project?.scopeLockedAt);
  const isApproved = project?.quoteApprovalStatus === "approved";

  async function loadWorkspace() {
    setLoading(true);
    setError(null);

    try {
      const [projectResponse, changesResponse] = await Promise.all([
        fetch(`/api/projects/${encodeURIComponent(projectId)}`),
        fetch(`/api/projects/${encodeURIComponent(projectId)}/changes`)
      ]);

      if (!projectResponse.ok) {
        throw new Error("Failed to load project");
      }

      if (!changesResponse.ok) {
        throw new Error("Failed to load change requests");
      }

      const projectBody = await projectResponse.json();
      const changesBody = await changesResponse.json();
      const loadedProject = projectBody.project as ProjectDetail;
      const loadedRequests = (changesBody.workRequests ?? []) as WorkRequest[];

      setProject(loadedProject);
      setRequests(loadedRequests);
      setDrafts(
        Object.fromEntries(
          loadedRequests.map((request) => [
            request.id,
            createDraftFromRequest(request)
          ])
        )
      );
      setNewDraft(createNewRequestDraft(loadedProject));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load change management workspace"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, [projectId]);

  const metrics = useMemo(() => {
    const approvedCount = requests.filter((request) =>
      ["approved", "appended_to_delivery"].includes(request.status)
    ).length;
    const appendedCount = requests.filter(
      (request) => request.status === "appended_to_delivery"
    ).length;
    const pricedHours = requests.reduce(
      (sum, request) =>
        sum +
        (typeof request.commercialImpactHours === "number"
          ? request.commercialImpactHours
          : 0),
      0
    );
    const pricedFee = requests.reduce(
      (sum, request) =>
        sum +
        (typeof request.commercialImpactFeeZar === "number"
          ? request.commercialImpactFeeZar
          : 0),
      0
    );

    return { approvedCount, appendedCount, pricedHours, pricedFee };
  }, [requests]);

  function updateDraft(
    requestId: string,
    field: keyof Omit<ChangeRequestDraft, "deliveryTasks">,
    value: string
  ) {
    setDrafts((current) => ({
      ...current,
      [requestId]: {
        ...current[requestId],
        [field]: value
      }
    }));
  }

  function updateDraftTask(
    requestId: string,
    index: number,
    field: keyof ChangeDeliveryTaskPlan,
    value: string | boolean
  ) {
    setDrafts((current) => ({
      ...current,
      [requestId]: {
        ...current[requestId],
        deliveryTasks: current[requestId].deliveryTasks.map(
          (task, taskIndex) =>
            taskIndex === index
              ? {
                  ...task,
                  [field]: field === "plannedHours" ? Number(value) || 0 : value
                }
              : task
        )
      }
    }));
  }

  function addDraftTask(requestId: string) {
    setDrafts((current) => ({
      ...current,
      [requestId]: {
        ...current[requestId],
        deliveryTasks: [...current[requestId].deliveryTasks, createEmptyTask()]
      }
    }));
  }

  function removeDraftTask(requestId: string, index: number) {
    setDrafts((current) => {
      const nextTasks = current[requestId].deliveryTasks.filter(
        (_task, taskIndex) => taskIndex !== index
      );

      return {
        ...current,
        [requestId]: {
          ...current[requestId],
          deliveryTasks: nextTasks.length > 0 ? nextTasks : [createEmptyTask()]
        }
      };
    });
  }

  function updateNewDraft(
    field: keyof Omit<ChangeRequestDraft, "deliveryTasks">,
    value: string
  ) {
    setNewDraft((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateNewDraftTask(
    index: number,
    field: keyof ChangeDeliveryTaskPlan,
    value: string | boolean
  ) {
    setNewDraft((current) => ({
      ...current,
      deliveryTasks: current.deliveryTasks.map((task, taskIndex) =>
        taskIndex === index
          ? {
              ...task,
              [field]: field === "plannedHours" ? Number(value) || 0 : value
            }
          : task
      )
    }));
  }

  function addNewDraftTask() {
    setNewDraft((current) => ({
      ...current,
      deliveryTasks: [...current.deliveryTasks, createEmptyTask()]
    }));
  }

  function removeNewDraftTask(index: number) {
    setNewDraft((current) => {
      const nextTasks = current.deliveryTasks.filter(
        (_task, taskIndex) => taskIndex !== index
      );

      return {
        ...current,
        deliveryTasks: nextTasks.length > 0 ? nextTasks : [createEmptyTask()]
      };
    });
  }

  function cleanDeliveryTasks(tasks: ChangeDeliveryTaskPlan[]) {
    return tasks.filter(
      (task) =>
        task.title.trim().length > 0 ||
        task.description.trim().length > 0 ||
        task.category.trim().length > 0 ||
        task.plannedHours > 0
    );
  }

  async function createRequest() {
    setCreating(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/changes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title: newDraft.title,
            summary: newDraft.summary,
            details: newDraft.details,
            internalNotes: newDraft.internalNotes,
            commercialImpactHours:
              newDraft.commercialImpactHours.trim().length > 0
                ? Number(newDraft.commercialImpactHours)
                : undefined,
            commercialImpactFeeZar:
              newDraft.commercialImpactFeeZar.trim().length > 0
                ? Number(newDraft.commercialImpactFeeZar)
                : undefined,
            approvedByName: newDraft.approvedByName,
            status: newDraft.status,
            deliveryTasks: cleanDeliveryTasks(newDraft.deliveryTasks)
          })
        }
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to create change request");
      }

      const nextRequest = body.workRequest as WorkRequest;
      setRequests((current) => [nextRequest, ...current]);
      setDrafts((current) => ({
        ...current,
        [nextRequest.id]: createDraftFromRequest(nextRequest)
      }));
      setNewDraft(createNewRequestDraft(project));
      setFeedback("Change request created.");
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to create change request"
      );
    } finally {
      setCreating(false);
    }
  }

  async function saveRequest(
    requestId: string,
    overrides?: Partial<ChangeRequestDraft>
  ) {
    const draft = {
      ...drafts[requestId],
      ...overrides
    };

    if (!draft) {
      return;
    }

    setSavingId(requestId);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/work-requests/${encodeURIComponent(requestId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title: draft.title,
            summary: draft.summary,
            details: draft.details,
            internalNotes: draft.internalNotes,
            commercialImpactHours:
              draft.commercialImpactHours.trim().length > 0
                ? Number(draft.commercialImpactHours)
                : null,
            commercialImpactFeeZar:
              draft.commercialImpactFeeZar.trim().length > 0
                ? Number(draft.commercialImpactFeeZar)
                : null,
            approvedByName: draft.approvedByName,
            status: draft.status,
            deliveryTasks: cleanDeliveryTasks(draft.deliveryTasks)
          })
        }
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save change request");
      }

      const nextRequest = body.workRequest as WorkRequest;
      setRequests((current) =>
        current.map((request) =>
          request.id === requestId ? nextRequest : request
        )
      );
      setDrafts((current) => ({
        ...current,
        [requestId]: createDraftFromRequest(nextRequest)
      }));
      setFeedback("Change request saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save change request"
      );
    } finally {
      setSavingId(null);
    }
  }

  async function appendToDelivery(requestId: string) {
    setAppendingId(requestId);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/work-requests/${encodeURIComponent(requestId)}/append-to-delivery`,
        {
          method: "POST"
        }
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to append change to delivery");
      }

      const nextRequest = body.workRequest as WorkRequest;
      setRequests((current) =>
        current.map((request) =>
          request.id === requestId ? nextRequest : request
        )
      );
      setDrafts((current) => ({
        ...current,
        [requestId]: createDraftFromRequest(nextRequest)
      }));
      setFeedback("Approved change appended to the delivery board.");
    } catch (appendError) {
      setError(
        appendError instanceof Error
          ? appendError.message
          : "Failed to append change to delivery"
      );
    } finally {
      setAppendingId(null);
    }
  }

  return (
    <AppShell>
      <div className="p-8">
        <ProjectWorkflowNav projectId={projectId} />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href={`/projects/${projectId}`}
              className="text-sm text-text-muted"
            >
              Back to project overview
            </Link>
            <h1 className="mt-3 text-3xl font-bold font-heading text-white">
              Change Management
            </h1>
            <p className="mt-2 max-w-3xl text-text-secondary">
              Keep the approved baseline intact, price scope changes cleanly,
              and only push approved additions into delivery when they are
              ready.
            </p>
          </div>
          <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-5 py-4 text-sm text-text-secondary">
            {project?.client?.name ?? "Client"} · {project?.name ?? "Project"}
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
            {error}
          </div>
        ) : null}

        {feedback ? (
          <div className="mb-4 rounded-2xl border border-[rgba(73,205,225,0.28)] bg-[rgba(73,205,225,0.12)] px-4 py-3 text-sm text-white">
            {feedback}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
              Change Requests
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {requests.length}
            </p>
          </div>
          <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
              Approved
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {metrics.approvedCount}
            </p>
          </div>
          <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
              Added Hours
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {metrics.pricedHours}h
            </p>
          </div>
          <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
              Added Fee
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              R {metrics.pricedFee.toLocaleString("en-ZA")}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {metrics.appendedCount} appended to delivery
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-5 text-sm">
          <p className="font-medium text-white">How this works</p>
          <p className="mt-2 text-text-secondary">
            {isScopeLocked
              ? "The approved baseline is locked. Any extra work should be captured here, reviewed commercially, then appended into delivery only when approved."
              : "You can prepare change requests here early, but they become operational once the quote is approved and the baseline is locked."}
          </p>
          {isApproved ? null : (
            <p className="mt-2 text-[#7be2ef]">
              Quote approval is not locked yet, so this is currently a staging
              area for future scope changes.
            </p>
          )}
        </div>

        <div className="mt-6 rounded-3xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                New Change Request
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Capture added scope cleanly
              </h2>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm text-white">Title</span>
              <input
                value={newDraft.title}
                onChange={(event) =>
                  updateNewDraft("title", event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm text-white">Status</span>
              <select
                value={newDraft.status}
                onChange={(event) =>
                  updateNewDraft(
                    "status",
                    event.target.value as ChangeRequestStatus
                  )
                }
                className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
              >
                {changeStatuses.map((statusOption) => (
                  <option key={statusOption.value} value={statusOption.value}>
                    {statusOption.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm text-white">Client-facing summary</span>
              <textarea
                value={newDraft.summary}
                onChange={(event) =>
                  updateNewDraft("summary", event.target.value)
                }
                className="mt-2 min-h-[96px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm text-white">Delivery detail</span>
              <textarea
                value={newDraft.details}
                onChange={(event) =>
                  updateNewDraft("details", event.target.value)
                }
                className="mt-2 min-h-[120px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm text-white">Internal notes</span>
              <textarea
                value={newDraft.internalNotes}
                onChange={(event) =>
                  updateNewDraft("internalNotes", event.target.value)
                }
                className="mt-2 min-h-[100px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm text-white">Added hours</span>
              <input
                type="number"
                value={newDraft.commercialImpactHours}
                onChange={(event) =>
                  updateNewDraft("commercialImpactHours", event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm text-white">Added fee (ZAR)</span>
              <input
                type="number"
                value={newDraft.commercialImpactFeeZar}
                onChange={(event) =>
                  updateNewDraft("commercialImpactFeeZar", event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm text-white">Approved by</span>
              <input
                value={newDraft.approvedByName}
                onChange={(event) =>
                  updateNewDraft("approvedByName", event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
              />
            </label>
          </div>

          <div className="mt-6 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  Delivery additions
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  Define the extra delivery tasks this change would add once
                  approved.
                </p>
              </div>
              <button
                type="button"
                onClick={addNewDraftTask}
                className="rounded-xl border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm font-medium text-white"
              >
                Add delivery task
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {newDraft.deliveryTasks.map((task, index) => (
                <div
                  key={`new-task-${index}`}
                  className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4"
                >
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <input
                      value={task.title}
                      onChange={(event) =>
                        updateNewDraftTask(index, "title", event.target.value)
                      }
                      placeholder="Task title"
                      className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none xl:col-span-2"
                    />
                    <input
                      value={task.category}
                      onChange={(event) =>
                        updateNewDraftTask(
                          index,
                          "category",
                          event.target.value
                        )
                      }
                      placeholder="Category"
                      className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                    />
                    <input
                      type="number"
                      value={task.plannedHours}
                      onChange={(event) =>
                        updateNewDraftTask(
                          index,
                          "plannedHours",
                          event.target.value
                        )
                      }
                      placeholder="Hours"
                      className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                    />
                    <textarea
                      value={task.description}
                      onChange={(event) =>
                        updateNewDraftTask(
                          index,
                          "description",
                          event.target.value
                        )
                      }
                      placeholder="Task description"
                      className="min-h-[90px] rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none md:col-span-2"
                    />
                    <input
                      value={task.executionType}
                      onChange={(event) =>
                        updateNewDraftTask(
                          index,
                          "executionType",
                          event.target.value
                        )
                      }
                      placeholder="Execution type"
                      className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                    />
                    <select
                      value={task.assigneeType}
                      onChange={(event) =>
                        updateNewDraftTask(
                          index,
                          "assigneeType",
                          event.target.value
                        )
                      }
                      className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                    >
                      <option value="Human">Human</option>
                      <option value="Agent">Agent</option>
                      <option value="Client">Client</option>
                    </select>
                    <select
                      value={task.priority}
                      onChange={(event) =>
                        updateNewDraftTask(
                          index,
                          "priority",
                          event.target.value
                        )
                      }
                      className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm text-white">
                        <input
                          type="checkbox"
                          checked={task.qaRequired}
                          onChange={(event) =>
                            updateNewDraftTask(
                              index,
                              "qaRequired",
                              event.target.checked
                            )
                          }
                        />
                        QA required
                      </label>
                      <label className="flex items-center gap-2 text-sm text-white">
                        <input
                          type="checkbox"
                          checked={task.approvalRequired}
                          onChange={(event) =>
                            updateNewDraftTask(
                              index,
                              "approvalRequired",
                              event.target.checked
                            )
                          }
                        />
                        Approval required
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeNewDraftTask(index)}
                      className="rounded-xl border border-[rgba(224,80,96,0.28)] px-3 py-2 text-sm font-medium text-[#ff98a7]"
                    >
                      Remove task
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void createRequest()}
              disabled={creating}
              className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#081120] disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create change request"}
            </button>
            <button
              type="button"
              onClick={() => setNewDraft(createNewRequestDraft(project))}
              className="rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-3 text-sm font-medium text-white"
            >
              Reset draft
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="rounded-3xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 text-text-secondary">
              Loading change requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-3xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 text-text-secondary">
              No change requests yet. Capture any post-approval additions here
              instead of editing the approved baseline.
            </div>
          ) : (
            requests.map((request) => {
              const draft = drafts[request.id];

              if (!draft) {
                return null;
              }

              return (
                <div
                  key={request.id}
                  className="rounded-3xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusPillClass(
                            request.status
                          )}`}
                        >
                          {formatStatusLabel(request.status)}
                        </span>
                        {request.deliveryAppendedAt ? (
                          <span className="text-xs text-text-muted">
                            Added to delivery{" "}
                            {new Date(
                              request.deliveryAppendedAt
                            ).toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-xl font-semibold text-white">
                        {request.title}
                      </p>
                      <p className="mt-2 text-sm text-text-secondary">
                        {request.summary}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] px-4 py-3 text-sm text-text-secondary">
                      <p>{request.contactName}</p>
                      <p className="mt-1">{request.contactEmail}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="text-sm text-white">Title</span>
                      <input
                        value={draft.title}
                        onChange={(event) =>
                          updateDraft(request.id, "title", event.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm text-white">Status</span>
                      <select
                        value={draft.status}
                        onChange={(event) =>
                          updateDraft(
                            request.id,
                            "status",
                            event.target.value as ChangeRequestStatus
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                      >
                        {changeStatuses.map((statusOption) => (
                          <option
                            key={statusOption.value}
                            value={statusOption.value}
                          >
                            {statusOption.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block md:col-span-2">
                      <span className="text-sm text-white">
                        Client-facing summary
                      </span>
                      <textarea
                        value={draft.summary}
                        onChange={(event) =>
                          updateDraft(request.id, "summary", event.target.value)
                        }
                        className="mt-2 min-h-[90px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="text-sm text-white">
                        Delivery detail
                      </span>
                      <textarea
                        value={draft.details}
                        onChange={(event) =>
                          updateDraft(request.id, "details", event.target.value)
                        }
                        className="mt-2 min-h-[110px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="text-sm text-white">Internal notes</span>
                      <textarea
                        value={draft.internalNotes}
                        onChange={(event) =>
                          updateDraft(
                            request.id,
                            "internalNotes",
                            event.target.value
                          )
                        }
                        className="mt-2 min-h-[90px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm text-white">Added hours</span>
                      <input
                        type="number"
                        value={draft.commercialImpactHours}
                        onChange={(event) =>
                          updateDraft(
                            request.id,
                            "commercialImpactHours",
                            event.target.value
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm text-white">
                        Added fee (ZAR)
                      </span>
                      <input
                        type="number"
                        value={draft.commercialImpactFeeZar}
                        onChange={(event) =>
                          updateDraft(
                            request.id,
                            "commercialImpactFeeZar",
                            event.target.value
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="text-sm text-white">Approved by</span>
                      <input
                        value={draft.approvedByName}
                        onChange={(event) =>
                          updateDraft(
                            request.id,
                            "approvedByName",
                            event.target.value
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                      />
                    </label>
                  </div>

                  <div className="mt-5 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Delivery additions
                        </p>
                        <p className="mt-1 text-sm text-text-secondary">
                          These tasks only land on the delivery board once the
                          change is approved and pushed through.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addDraftTask(request.id)}
                        className="rounded-xl border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm font-medium text-white"
                      >
                        Add delivery task
                      </button>
                    </div>
                    <div className="mt-4 space-y-4">
                      {draft.deliveryTasks.map((task, index) => (
                        <div
                          key={`${request.id}-task-${index}`}
                          className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4"
                        >
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <input
                              value={task.title}
                              onChange={(event) =>
                                updateDraftTask(
                                  request.id,
                                  index,
                                  "title",
                                  event.target.value
                                )
                              }
                              placeholder="Task title"
                              className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none xl:col-span-2"
                            />
                            <input
                              value={task.category}
                              onChange={(event) =>
                                updateDraftTask(
                                  request.id,
                                  index,
                                  "category",
                                  event.target.value
                                )
                              }
                              placeholder="Category"
                              className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                            />
                            <input
                              type="number"
                              value={task.plannedHours}
                              onChange={(event) =>
                                updateDraftTask(
                                  request.id,
                                  index,
                                  "plannedHours",
                                  event.target.value
                                )
                              }
                              placeholder="Hours"
                              className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                            />
                            <textarea
                              value={task.description}
                              onChange={(event) =>
                                updateDraftTask(
                                  request.id,
                                  index,
                                  "description",
                                  event.target.value
                                )
                              }
                              placeholder="Task description"
                              className="min-h-[90px] rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none md:col-span-2"
                            />
                            <input
                              value={task.executionType}
                              onChange={(event) =>
                                updateDraftTask(
                                  request.id,
                                  index,
                                  "executionType",
                                  event.target.value
                                )
                              }
                              placeholder="Execution type"
                              className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                            />
                            <select
                              value={task.assigneeType}
                              onChange={(event) =>
                                updateDraftTask(
                                  request.id,
                                  index,
                                  "assigneeType",
                                  event.target.value
                                )
                              }
                              className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                            >
                              <option value="Human">Human</option>
                              <option value="Agent">Agent</option>
                              <option value="Client">Client</option>
                            </select>
                            <select
                              value={task.priority}
                              onChange={(event) =>
                                updateDraftTask(
                                  request.id,
                                  index,
                                  "priority",
                                  event.target.value
                                )
                              }
                              className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap gap-4">
                              <label className="flex items-center gap-2 text-sm text-white">
                                <input
                                  type="checkbox"
                                  checked={task.qaRequired}
                                  onChange={(event) =>
                                    updateDraftTask(
                                      request.id,
                                      index,
                                      "qaRequired",
                                      event.target.checked
                                    )
                                  }
                                />
                                QA required
                              </label>
                              <label className="flex items-center gap-2 text-sm text-white">
                                <input
                                  type="checkbox"
                                  checked={task.approvalRequired}
                                  onChange={(event) =>
                                    updateDraftTask(
                                      request.id,
                                      index,
                                      "approvalRequired",
                                      event.target.checked
                                    )
                                  }
                                />
                                Approval required
                              </label>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeDraftTask(request.id, index)}
                              className="rounded-xl border border-[rgba(224,80,96,0.28)] px-3 py-2 text-sm font-medium text-[#ff98a7]"
                            >
                              Remove task
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void saveRequest(request.id)}
                      disabled={savingId === request.id}
                      className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#081120] disabled:opacity-60"
                    >
                      {savingId === request.id ? "Saving..." : "Save change"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void saveRequest(request.id, { status: "approved" })
                      }
                      disabled={savingId === request.id}
                      className="rounded-xl border border-[rgba(45,212,160,0.35)] px-4 py-3 text-sm font-medium text-[#78f0c8] disabled:opacity-60"
                    >
                      Mark approved
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void saveRequest(request.id, { status: "rejected" })
                      }
                      disabled={savingId === request.id}
                      className="rounded-xl border border-[rgba(224,80,96,0.35)] px-4 py-3 text-sm font-medium text-[#ff98a7] disabled:opacity-60"
                    >
                      Mark rejected
                    </button>
                    <button
                      type="button"
                      onClick={() => void appendToDelivery(request.id)}
                      disabled={
                        appendingId === request.id ||
                        !isScopeLocked ||
                        !["approved", "appended_to_delivery"].includes(
                          drafts[request.id].status
                        )
                      }
                      className="rounded-xl border border-[rgba(123,226,239,0.35)] px-4 py-3 text-sm font-medium text-[#7be2ef] disabled:opacity-60"
                    >
                      {appendingId === request.id
                        ? "Pushing..."
                        : request.deliveryAppendedAt
                          ? "Already in delivery"
                          : "Push to delivery"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
