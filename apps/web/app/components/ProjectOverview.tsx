"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AppShell from "./AppShell";
import ProjectContextSidebar from "./project/ProjectContextSidebar";
import ProjectDetailLayout, {
  type ProjectDetailTabKey
} from "./project/ProjectDetailLayout";
import CommsTab from "./project/tabs/CommsTab";
import DeliveryTab from "./project/tabs/DeliveryTab";
import DiscoveryTab from "./project/tabs/DiscoveryTab";
import OverviewTab from "./project/tabs/OverviewTab";
import PlanTab from "./project/tabs/PlanTab";
import PortalTab from "./project/tabs/PortalTab";

interface Project {
  id: string;
  name: string;
  status: string;
  quoteApprovalStatus?: string | null;
  scopeLockedAt?: string | null;
  owner: string;
  ownerEmail: string;
  customerPlatformTier?: string | null;
  implementationApproach?: string | null;
  commercialBrief?: string | null;
  clientChampionEmail?: string | null;
  selectedHubs: string[];
  scopeType?: string | null;
  engagementType: string;
  updatedAt: string;
  portalQuoteEnabled?: boolean;
  lastAgenda?: ProjectAgenda | null;
  packagingAssessment?: {
    fit: "good" | "attention" | "upgrade_needed";
    summary: string;
    recommendedNextStep: string;
  } | null;
  client: {
    id: string;
    name: string;
    website?: string | null;
  };
  portal: {
    id: string;
    portalId: string;
    displayName: string;
    connected: boolean;
    connectedEmail?: string | null;
    hubDomain?: string | null;
  } | null;
  defaultWorkspacePath?: string;
}

interface SessionDetail {
  session: number;
  title: string;
  status: "draft" | "in_progress" | "complete";
  fields: Record<string, string>;
}

interface Blueprint {
  id: string;
  generatedAt: string;
  tasks: Array<{
    type: "Agent" | "Human" | "Client";
    effortHours: number;
  }>;
}

interface DiscoverySummary {
  executiveSummary: string;
  mainPainPoints: string[];
  recommendedApproach: string;
  phaseOneFocus: string;
  futureUpgradePath: string;
  inScopeItems: string[];
  outOfScopeItems: string[];
  supportingTools: string[];
  missingInformation: string[];
  keyRisks: string[];
  recommendedNextQuestions: string[];
}

interface ClientPortalUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  questionnaireAccess?: boolean;
  authStatus?: "active" | "invite_pending";
}

interface EvidenceItem {
  id: string;
  sourceLabel: string;
  sourceUrl: string | null;
  content: string | null;
  createdAt: string;
}

interface FindingRecord {
  id: string;
  title: string;
  description: string;
  quickWin: boolean;
  status: "open" | "in_progress" | "resolved";
}

interface PortalSnapshot {
  capturedAt: string;
  hubTier?: string | null;
  activeHubs: string[];
  contactPropertyCount?: number | null;
  dealPropertyCount?: number | null;
  customObjectCount?: number | null;
}

interface ProjectAgenda {
  sessionType: string;
  date?: string | null;
  duration?: string | null;
  notes?: string | null;
  content: string;
  generatedAt: string;
}

interface TaskCard {
  id: string;
  title: string;
  status: string;
}

interface TaskBoardResponse {
  columns: Record<string, TaskCard[]>;
}

const agendaSessionTypeOptions = [
  "Kick-off",
  "Discovery",
  "Workshop",
  "Check-in",
  "Review"
] as const;

const smartDurationMap: Record<(typeof agendaSessionTypeOptions)[number], string> = {
  "Kick-off": "1hr",
  Discovery: "2hrs",
  Workshop: "Full day",
  "Check-in": "30min",
  Review: "1hr"
};

function formatLabel(value: string | null | undefined) {
  if (!value) return "Not set";
  return value.replace(/[_-]/g, " ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function isSessionComplete(session: SessionDetail | undefined) {
  if (!session) {
    return false;
  }

  return Object.values(session.fields).some((value) => value.trim().length > 0);
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "completed":
    case "done":
      return "brand-status-success";
    case "ready-for-execution":
    case "waiting_on_client":
      return "brand-status-warning";
    case "blocked":
    case "failed":
      return "brand-status-danger";
    default:
      return "brand-status-neutral";
  }
}

function InfoGrid(props: { items: Array<{ label: string; value: string | number }> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {props.items.map((item) => (
        <div key={item.label} className="brand-surface-soft rounded-2xl border p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
            {item.label}
          </p>
          <p className="mt-2 text-sm text-white">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export default function ProjectOverview({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [sessions, setSessions] = useState<SessionDetail[]>([]);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [discoverySummary, setDiscoverySummary] =
    useState<DiscoverySummary | null>(null);
  const [clientUsers, setClientUsers] = useState<ClientPortalUser[]>([]);
  const [supportingContext, setSupportingContext] = useState<EvidenceItem[]>([]);
  const [findings, setFindings] = useState<FindingRecord[]>([]);
  const [portalSnapshot, setPortalSnapshot] = useState<PortalSnapshot | null>(null);
  const [taskBoard, setTaskBoard] = useState<TaskBoardResponse | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectDetailTabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryFeedback, setSummaryFeedback] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [blueprintBusy, setBlueprintBusy] = useState(false);
  const [blueprintError, setBlueprintError] = useState<string | null>(null);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [emailNotes, setEmailNotes] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [agendaSessionType, setAgendaSessionType] = useState<
    (typeof agendaSessionTypeOptions)[number]
  >("Kick-off");
  const [agendaDate, setAgendaDate] = useState("");
  const [agendaDuration, setAgendaDuration] = useState("1hr");
  const [agendaNotes, setAgendaNotes] = useState("");
  const [agendaBusy, setAgendaBusy] = useState(false);
  const [agendaFeedback, setAgendaFeedback] = useState<string | null>(null);
  const [agendaError, setAgendaError] = useState<string | null>(null);
  const [agendaResult, setAgendaResult] = useState<ProjectAgenda | null>(null);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarFeedback, setCalendarFeedback] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [clientUserDraft, setClientUserDraft] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "contributor",
    questionnaireAccess: true
  });
  const [clientUserBusy, setClientUserBusy] = useState(false);
  const [clientUserFeedback, setClientUserFeedback] = useState<string | null>(null);
  const [clientUserError, setClientUserError] = useState<string | null>(null);
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
  const [portalPreviewBusy, setPortalPreviewBusy] = useState(false);
  const [portalPreviewError, setPortalPreviewError] = useState<string | null>(null);
  const [quickWinBusyId, setQuickWinBusyId] = useState<string | null>(null);
  const [portalQuoteEnabled, setPortalQuoteEnabled] = useState<boolean>(true);
  const [portalQuoteToggleBusy, setPortalQuoteToggleBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  async function loadProjectData() {
    const [
      projectResponse,
      sessionsResponse,
      summaryResponse,
      blueprintResponse,
      clientUsersResponse,
      contextResponse,
      findingsResponse,
      taskBoardResponse
    ] = await Promise.all([
      fetch(`/api/projects/${encodeURIComponent(projectId)}`),
      fetch(`/api/discovery/${encodeURIComponent(projectId)}/sessions`),
      fetch(`/api/projects/${encodeURIComponent(projectId)}/discovery-summary`),
      fetch(`/api/projects/${encodeURIComponent(projectId)}/blueprint`),
      fetch(`/api/projects/${encodeURIComponent(projectId)}/client-users`),
      fetch(`/api/projects/${encodeURIComponent(projectId)}/sessions/0/evidence`),
      fetch(`/api/projects/${encodeURIComponent(projectId)}/findings`),
      fetch(`/api/projects/${encodeURIComponent(projectId)}/tasks/board`)
    ]);

    if (!projectResponse.ok || !sessionsResponse.ok || !summaryResponse.ok) {
      throw new Error("Failed to load project workspace");
    }

    const projectBody = await projectResponse.json();
    const sessionsBody = await sessionsResponse.json();
    const summaryBody = await summaryResponse.json();
    const clientUsersBody = await clientUsersResponse.json().catch(() => null);
    const contextBody = await contextResponse.json().catch(() => null);
    const findingsBody = await findingsResponse.json().catch(() => null);
    const taskBoardBody = await taskBoardResponse.json().catch(() => null);

    setProject(projectBody.project ?? null);
    setPortalQuoteEnabled(projectBody.project?.portalQuoteEnabled !== false);
    setSessions(sessionsBody.sessionDetails ?? []);
    setDiscoverySummary(summaryBody.summary ?? null);
    setClientUsers(clientUsersBody?.clientUsers ?? []);
    setSupportingContext(contextBody?.evidenceItems ?? []);
    setFindings(findingsBody?.findings ?? []);
    setTaskBoard(taskBoardBody ?? null);
    setAgendaResult(projectBody.project?.lastAgenda ?? null);

    if (blueprintResponse.ok) {
      const blueprintBody = await blueprintResponse.json().catch(() => null);
      setBlueprint(blueprintBody?.blueprint ?? null);
    } else {
      setBlueprint(null);
    }

    if (projectBody.project?.portal?.id) {
      const snapshotResponse = await fetch(
        `/api/portals/${encodeURIComponent(projectBody.project.portal.id)}/snapshot`
      );
      const snapshotBody = await snapshotResponse.json().catch(() => null);
      setPortalSnapshot(snapshotBody?.snapshot ?? null);
    } else {
      setPortalSnapshot(null);
    }
  }

  useEffect(() => {
    async function load() {
      try {
        await loadProjectData();
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load project workspace"
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [projectId]);

  useEffect(() => {
    if (project?.lastAgenda) {
      setAgendaSessionType(
        agendaSessionTypeOptions.includes(
          project.lastAgenda.sessionType as (typeof agendaSessionTypeOptions)[number]
        )
          ? (project.lastAgenda.sessionType as (typeof agendaSessionTypeOptions)[number])
          : "Kick-off"
      );
      setAgendaDate(project.lastAgenda.date ?? "");
      setAgendaDuration(project.lastAgenda.duration ?? "1hr");
      setAgendaNotes(project.lastAgenda.notes ?? "");
    }
  }, [project?.lastAgenda]);

  function handleSessionTypeChange(
    nextValue: (typeof agendaSessionTypeOptions)[number]
  ) {
    setAgendaSessionType(nextValue);
    setAgendaDuration(smartDurationMap[nextValue]);
  }

  async function refreshSnapshot() {
    if (!project?.portal?.id) {
      return;
    }

    setSnapshotBusy(true);
    try {
      const response = await fetch(
        `/api/portals/${encodeURIComponent(project.portal.id)}/snapshot`,
        { method: "POST" }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to refresh snapshot");
      }
      setPortalSnapshot(body?.snapshot ?? null);
    } catch (snapshotError) {
      setError(
        snapshotError instanceof Error
          ? snapshotError.message
          : "Failed to refresh snapshot"
      );
    } finally {
      setSnapshotBusy(false);
    }
  }

  async function generateSummary() {
    setSummaryBusy(true);
    setSummaryError(null);
    setSummaryFeedback(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/discovery-summary`,
        { method: "POST" }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to generate discovery summary");
      }
      setDiscoverySummary(body?.summary ?? null);
      setSummaryFeedback(body?.recovered ? "Recovered saved summary." : "Summary refreshed.");
    } catch (summaryLoadError) {
      setSummaryError(
        summaryLoadError instanceof Error
          ? summaryLoadError.message
          : "Failed to generate discovery summary"
      );
    } finally {
      setSummaryBusy(false);
    }
  }

  async function resetSummary() {
    setSummaryBusy(true);
    setSummaryError(null);
    setSummaryFeedback(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/discovery-summary`,
        { method: "DELETE" }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to reset discovery summary");
      }
      setDiscoverySummary(null);
      setSummaryFeedback("Summary reset.");
    } catch (summaryResetError) {
      setSummaryError(
        summaryResetError instanceof Error
          ? summaryResetError.message
          : "Failed to reset discovery summary"
      );
    } finally {
      setSummaryBusy(false);
    }
  }

  async function generateBlueprint() {
    setBlueprintBusy(true);
    setBlueprintError(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/blueprint/generate`,
        { method: "POST" }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to generate blueprint");
      }
      setBlueprint(body?.blueprint ?? null);
    } catch (nextBlueprintError) {
      setBlueprintError(
        nextBlueprintError instanceof Error
          ? nextBlueprintError.message
          : "Failed to generate blueprint"
      );
    } finally {
      setBlueprintBusy(false);
    }
  }

  async function generateEmailDraft() {
    setEmailBusy(true);
    setEmailError(null);
    setEmailFeedback(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/email/draft`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: emailNotes })
        }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to generate email draft");
      }
      setEmailDraft(body?.draft ?? "");
      setEmailFeedback("Email draft generated.");
    } catch (draftError) {
      setEmailError(
        draftError instanceof Error
          ? draftError.message
          : "Failed to generate email draft"
      );
    } finally {
      setEmailBusy(false);
    }
  }

  async function copyText(value: string, feedback: (value: string) => void) {
    if (typeof navigator === "undefined" || !value.trim()) {
      return;
    }

    await navigator.clipboard.writeText(value);
    feedback("Copied to clipboard.");
  }

  async function generateAgenda() {
    setAgendaBusy(true);
    setAgendaError(null);
    setAgendaFeedback(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/agenda/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionType: agendaSessionType,
            date: agendaDate || null,
            duration: agendaDuration || null,
            notes: agendaNotes || null
          })
        }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to generate agenda");
      }
      setAgendaResult(body?.lastAgenda ?? null);
      setAgendaFeedback("Agenda generated.");
      setProject((currentProject) =>
        currentProject
          ? {
              ...currentProject,
              lastAgenda: body?.lastAgenda ?? currentProject.lastAgenda
            }
          : currentProject
      );
    } catch (nextAgendaError) {
      setAgendaError(
        nextAgendaError instanceof Error
          ? nextAgendaError.message
          : "Failed to generate agenda"
      );
    } finally {
      setAgendaBusy(false);
    }
  }

  async function createCalendarEvent() {
    if (!agendaDate || !agendaResult?.content.trim() || !project) {
      return;
    }

    setCalendarBusy(true);
    setCalendarError(null);
    setCalendarFeedback(null);

    try {
      const response = await fetch("/api/workspace/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: `${agendaSessionType} — ${project.client.name}`,
          description: agendaResult.content,
          date: agendaDate
        })
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to create calendar event");
      }
      setCalendarFeedback("Event created ✓");
    } catch (eventError) {
      setCalendarError(
        eventError instanceof Error
          ? eventError.message
          : "Failed to create calendar event"
      );
    } finally {
      setCalendarBusy(false);
    }
  }

  async function addClientUser() {
    setClientUserBusy(true);
    setClientUserError(null);
    setClientUserFeedback(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/client-users`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(clientUserDraft)
        }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to add client user");
      }
      setClientUsers((currentUsers) => [...currentUsers, body.clientUser]);
      setClientUserDraft({
        firstName: "",
        lastName: "",
        email: "",
        role: "contributor",
        questionnaireAccess: true
      });
      setClientUserFeedback("Client user added.");
    } catch (nextClientUserError) {
      setClientUserError(
        nextClientUserError instanceof Error
          ? nextClientUserError.message
          : "Failed to add client user"
      );
    } finally {
      setClientUserBusy(false);
    }
  }

  async function copyClientAccessLink(userId: string, action: "invite-link" | "reset-link") {
    setLinkBusyId(userId);
    setClientUserError(null);
    setClientUserFeedback(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/client-users/${encodeURIComponent(userId)}/${action}`,
        { method: "POST" }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to create access link");
      }
      const link = action === "invite-link" ? body?.inviteLink : body?.resetLink;
      if (typeof navigator !== "undefined" && typeof link === "string") {
        await navigator.clipboard.writeText(link);
      }
      setClientUserFeedback(action === "invite-link" ? "Invite link copied." : "Reset link copied.");
    } catch (linkError) {
      setClientUserError(
        linkError instanceof Error
          ? linkError.message
          : "Failed to create access link"
      );
    } finally {
      setLinkBusyId(null);
    }
  }

  async function openClientPortalPreview() {
    setPortalPreviewBusy(true);
    setPortalPreviewError(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/client-portal-preview-token`,
        { method: "POST" }
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to generate preview link");
      }

      if (body?.previewUrl) {
        window.open(body.previewUrl, "_blank", "noopener");
      }
    } catch (previewError) {
      setPortalPreviewError(
        previewError instanceof Error
          ? previewError.message
          : "Failed to open portal preview"
      );
    } finally {
      setPortalPreviewBusy(false);
    }
  }

  async function togglePortalQuote() {
    const next = !portalQuoteEnabled;
    setPortalQuoteToggleBusy(true);
    setPortalQuoteEnabled(next);
    try {
      await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/portal-settings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ portalQuoteEnabled: next })
        }
      );
    } catch {
      setPortalQuoteEnabled(!next);
    } finally {
      setPortalQuoteToggleBusy(false);
    }
  }

  async function changeProjectStatus(newStatus: string) {
    if (!project || statusBusy) return;
    setStatusBusy(true);
    setStatusFeedback(null);
    const prevStatus = project.status;
    setProject((p) => p ? { ...p, status: newStatus } : p);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus })
        }
      );
      if (!res.ok) throw new Error("Failed to update status");
      setStatusFeedback("Status updated");
      setTimeout(() => setStatusFeedback(null), 3000);
    } catch {
      setProject((p) => p ? { ...p, status: prevStatus } : p);
      setStatusFeedback("Failed to update status");
    } finally {
      setStatusBusy(false);
    }
  }

  async function updateQuickWinStatus(
    findingId: string,
    status: FindingRecord["status"]
  ) {
    setQuickWinBusyId(findingId);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/findings/${encodeURIComponent(findingId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status })
        }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to update quick win");
      }
      setFindings((currentFindings) =>
        currentFindings.map((finding) =>
          finding.id === findingId ? { ...finding, status } : finding
        )
      );
    } finally {
      setQuickWinBusyId(null);
    }
  }

  const completedSessions = sessions.filter((session) =>
    isSessionComplete(session)
  ).length;
  const summaryInScopeItems = discoverySummary?.inScopeItems ?? [];
  const totalQuestions = sessions.reduce(
    (total, session) => total + Object.keys(session.fields).length,
    0
  );
  const answeredQuestions = sessions.reduce(
    (total, session) =>
      total +
      Object.values(session.fields).filter((value) => value.trim().length > 0).length,
    0
  );
  const quickWins = findings.filter((finding) => finding.quickWin);
  const quickWinStats = {
    total: quickWins.length,
    open: quickWins.filter((finding) => finding.status === "open").length,
    resolved: quickWins.filter((finding) => finding.status === "resolved").length
  };

  const taskCounts = useMemo(() => {
    const columns = taskBoard?.columns ?? {};
    return {
      backlog: columns.backlog?.length ?? 0,
      todo: columns.todo?.length ?? 0,
      inProgress: columns.in_progress?.length ?? 0,
      waitingOnClient: columns.waiting_on_client?.length ?? 0,
      blocked: columns.blocked?.length ?? 0,
      done: columns.done?.length ?? 0
    };
  }, [taskBoard]);

  const agendaHistory = useMemo(
    () => (agendaResult ? [agendaResult].slice(0, 3) : []),
    [agendaResult]
  );

  if (loading) {
    return (
      <AppShell>
        <div className="p-8">
          <div className="grid gap-4">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/5"
              />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !project) {
    return (
      <AppShell>
        <div className="p-8">
          <div className="rounded-2xl border border-status-error/30 bg-status-error/10 p-8 text-white">
            {error ?? "Project not found"}
          </div>
        </div>
      </AppShell>
    );
  }

  const activeTabContent = (() => {
    switch (activeTab) {
      case "overview":
        return (
          <OverviewTab
            statusCard={
              <div className="space-y-4">
                <InfoGrid
                  items={[
                    { label: "Project status", value: formatLabel(project.status) },
                    {
                      label: "Quote status",
                      value: formatLabel(project.quoteApprovalStatus ?? "draft")
                    },
                    {
                      label: "Last updated",
                      value: formatDate(project.updatedAt)
                    },
                    {
                      label: "Summary state",
                      value: discoverySummary ? "Saved summary available" : "No saved summary"
                    }
                  ]}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Set status:</p>
                  {(["draft", "active", "complete", "archived"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={statusBusy || project.status === s}
                      onClick={() => void changeProjectStatus(s)}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                        project.status === s
                          ? "border-[rgba(73,205,225,0.28)] bg-[rgba(73,205,225,0.12)] text-[#7be2ef]"
                          : "border-[rgba(255,255,255,0.1)] bg-white/5 text-white hover:border-[rgba(255,255,255,0.2)]"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {formatLabel(s)}
                    </button>
                  ))}
                  {statusFeedback ? (
                    <span className="text-xs text-status-success">{statusFeedback}</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={portalQuoteEnabled}
                    onClick={() => void togglePortalQuote()}
                    disabled={portalQuoteToggleBusy}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                      portalQuoteEnabled ? "bg-brand-teal/70" : "bg-white/20"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                        portalQuoteEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <span className="text-sm text-text-secondary">
                    {portalQuoteEnabled ? "Quote visible in client portal" : "Quote hidden from client portal"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void generateSummary()}
                    disabled={summaryBusy}
                    className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-white"
                  >
                    {summaryBusy ? "Refreshing..." : "Refresh summary"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void resetSummary()}
                    disabled={summaryBusy}
                    className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-text-secondary"
                  >
                    Reset summary
                  </button>
                </div>
                {summaryError ? <p className="text-sm text-status-error">{summaryError}</p> : null}
                {summaryFeedback ? <p className="text-sm text-status-success">{summaryFeedback}</p> : null}
              </div>
            }
            inputsSummary={
              <div className="space-y-3">
                <div className="brand-surface-soft rounded-2xl border p-4">
                  <p className="text-2xl font-semibold text-white">
                    {answeredQuestions}/{Math.max(totalQuestions, 1)}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">Answered discovery fields</p>
                </div>
                <p className="text-sm text-text-secondary">
                  {completedSessions} of {sessions.length || 4} discovery sessions have
                  meaningful input captured.
                </p>
              </div>
            }
            blueprintStatus={
              <div className="space-y-3">
                <p className="text-sm text-text-secondary">
                  {blueprint
                    ? `Blueprint generated ${formatDate(blueprint.generatedAt)} with ${blueprint.tasks.length} tasks.`
                    : "No blueprint generated yet."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/projects/${project.id}/quote`}
                    className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-white"
                  >
                    Open Quote →
                  </Link>
                  <Link
                    href={`/projects/${project.id}/proposal`}
                    className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-text-secondary"
                  >
                    Open Proposal →
                  </Link>
                  <button
                    type="button"
                    onClick={() => void generateBlueprint()}
                    disabled={blueprintBusy}
                    className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-text-secondary"
                  >
                    {blueprintBusy
                      ? "Generating..."
                      : blueprint
                        ? "Regenerate blueprint"
                        : "Generate blueprint"}
                  </button>
                </div>
                {blueprintError ? <p className="text-sm text-status-error">{blueprintError}</p> : null}
              </div>
            }
            agentSummary={
              <div className="space-y-4">
                <p className="text-sm text-text-secondary">
                  {discoverySummary?.executiveSummary ?? "No executive summary saved yet."}
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="brand-surface-soft rounded-2xl border p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Risks</p>
                    <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                      {(discoverySummary?.keyRisks ?? ["No risks captured yet."]).slice(0, 3).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="brand-surface-soft rounded-2xl border p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Tools</p>
                    <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                      {(discoverySummary?.supportingTools ?? ["No tools recommended yet."]).slice(0, 3).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="brand-surface-soft rounded-2xl border p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Next questions</p>
                    <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                      {(discoverySummary?.recommendedNextQuestions ?? [
                        "No follow-up questions suggested yet."
                      ]).slice(0, 3).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            }
            clientAccess={
              <div className="space-y-3">
                <p className="text-sm text-text-secondary">
                  {clientUsers.length > 0
                    ? `${clientUsers.length} client user${clientUsers.length === 1 ? "" : "s"} invited — ${clientUsers.map((u) => u.firstName + " " + u.lastName).join(", ")}`
                    : "No client users have been invited yet."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("portal")}
                    className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-white/5 px-4 py-2 text-sm font-medium text-white"
                  >
                    {clientUsers.length === 0 ? "Invite client user →" : "Manage client access →"}
                  </button>
                  {clientUsers.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => void openClientPortalPreview()}
                      disabled={portalPreviewBusy}
                      className="rounded-xl border border-[rgba(81,208,176,0.25)] bg-[rgba(81,208,176,0.12)] px-4 py-2 text-sm font-medium text-[#51d0b0] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {portalPreviewBusy ? "Opening..." : "Preview client portal →"}
                    </button>
                  ) : null}
                </div>
                {portalPreviewError ? (
                  <p className="text-sm text-status-error">{portalPreviewError}</p>
                ) : null}
              </div>
            }
            quickWins={
              quickWins.length > 0 ? (
                <div className="space-y-3">
                  {quickWins.map((quickWin) => (
                    <div
                      key={quickWin.id}
                      className="brand-surface-soft rounded-2xl border p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-white">{quickWin.title}</p>
                          <p className="mt-2 text-sm text-text-secondary">
                            {quickWin.description}
                          </p>
                        </div>
                        <div className="space-y-2 text-right">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs uppercase tracking-[0.18em] ${getStatusBadgeClass(
                              quickWin.status
                            )}`}
                          >
                            {formatLabel(quickWin.status)}
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void updateQuickWinStatus(
                                  quickWin.id,
                                  quickWin.status === "resolved" ? "open" : "resolved"
                                )
                              }
                              disabled={quickWinBusyId === quickWin.id}
                              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-text-secondary"
                            >
                              {quickWinBusyId === quickWin.id
                                ? "Saving..."
                                : quickWin.status === "resolved"
                                  ? "Re-open"
                                  : "Resolve"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-secondary">No quick wins captured yet.</p>
              )
            }
          />
        );
      case "discovery":
        return (
          <DiscoveryTab
            sessionsTracker={
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div
                    key={session.session}
                    className="flex items-center justify-between brand-surface-soft rounded-2xl border p-4"
                  >
                    <div>
                      <p className="font-medium text-white">
                        Session {session.session} — {session.title}
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {Object.values(session.fields).filter((value) => value.trim().length > 0)
                          .length}
                        /{Object.keys(session.fields).length} fields answered
                      </p>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs uppercase tracking-[0.18em] ${getStatusBadgeClass(
                        isSessionComplete(session) ? "completed" : session.status
                      )}`}
                    >
                      {isSessionComplete(session) ? "Complete" : formatLabel(session.status)}
                    </span>
                  </div>
                ))}
              </div>
            }
            progressSummary={
              <div className="space-y-4">
                <div className="h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-muloo-gradient"
                    style={{
                      width: `${sessions.length > 0 ? (completedSessions / sessions.length) * 100 : 0}%`
                    }}
                  />
                </div>
                <p className="text-sm text-text-secondary">
                  {completedSessions}/{sessions.length || 4} sessions complete.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/projects/${project.id}/discovery`}
                    className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-white"
                  >
                    Open Discovery →
                  </Link>
                  <Link
                    href={`/projects/${project.id}/prepare`}
                    className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-text-secondary"
                  >
                    Open Prepare →
                  </Link>
                </div>
              </div>
            }
            notesPreview={
              <div className="space-y-3">
                {supportingContext.length > 0 ? (
                  supportingContext.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="brand-surface-soft rounded-2xl border p-4"
                    >
                      <p className="text-sm font-medium text-white">{item.sourceLabel}</p>
                      <p className="mt-2 text-sm text-text-secondary">
                        {(item.content ?? "No preview available").slice(0, 220)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-text-secondary">
                    No prepare notes or supporting context saved yet.
                  </p>
                )}
              </div>
            }
          />
        );
      case "plan":
        return (
          <PlanTab
            blueprintPanel={
              <div className="space-y-3">
                <p className="text-sm text-text-secondary">
                  {blueprint
                    ? `${blueprint.tasks.length} blueprint tasks generated on ${formatDate(
                        blueprint.generatedAt
                      )}.`
                    : "No blueprint generated yet."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void generateBlueprint()}
                    disabled={blueprintBusy}
                    className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-white"
                  >
                    {blueprintBusy ? "Generating..." : blueprint ? "Regenerate Blueprint" : "Generate Blueprint"}
                  </button>
                  <Link
                    href={`/projects/${project.id}/proposal`}
                    className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-text-secondary"
                  >
                    View Proposal →
                  </Link>
                </div>
              </div>
            }
            scopePanel={
              <div className="space-y-3 text-sm text-text-secondary">
                <p>Project status: {formatLabel(project.status)}</p>
                <p>Quote approval: {formatLabel(project.quoteApprovalStatus ?? "draft")}</p>
                <p>
                  In scope now:{" "}
                  {summaryInScopeItems.length > 0
                    ? summaryInScopeItems.slice(0, 3).join(", ")
                    : "No scoped items summarised yet."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/projects/${project.id}/quote`}
                    className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-white"
                  >
                    Open Quote →
                  </Link>
                  <Link
                    href={`/projects/${project.id}/proposal`}
                    className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-text-secondary"
                  >
                    Open Proposal →
                  </Link>
                </div>
              </div>
            }
            workingDocPanel={
              <div className="space-y-3 text-sm text-text-secondary">
                <p>Use the prepare workspace as the living working doc for discovery context and prep notes.</p>
                <Link
                  href={`/projects/${project.id}/prepare`}
                  className="inline-flex brand-input rounded-xl px-4 py-2 text-sm font-medium text-white"
                >
                  Open Prepare Workspace →
                </Link>
              </div>
            }
          />
        );
      case "delivery":
        return (
          <DeliveryTab
            taskSummary={
              <div className="space-y-4">
                <InfoGrid
                  items={[
                    { label: "Backlog", value: taskCounts.backlog },
                    { label: "Todo", value: taskCounts.todo },
                    { label: "In progress", value: taskCounts.inProgress },
                    { label: "Waiting on client", value: taskCounts.waitingOnClient },
                    { label: "Blocked", value: taskCounts.blocked },
                    { label: "Done", value: taskCounts.done }
                  ]}
                />
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/projects/${project.id}/delivery`}
                    className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-white"
                  >
                    Open Delivery Board →
                  </Link>
                </div>
              </div>
            }
            changeManagement={
              <div className="space-y-3 text-sm text-text-secondary">
                <p>
                  Use the change-management workspace to review scope changes once the approved plan starts moving.
                </p>
                <Link
                  href={`/projects/${project.id}/changes`}
                  className="inline-flex brand-input rounded-xl px-4 py-2 text-sm font-medium text-text-secondary"
                >
                  View Changes →
                </Link>
              </div>
            }
          />
        );
      case "comms":
        return (
          <CommsTab
            projectId={projectId}
            emailComposer={
              <div className="space-y-4">
                <textarea
                  value={emailNotes}
                  onChange={(event) => setEmailNotes(event.target.value)}
                  className="brand-input min-h-[220px] w-full rounded-2xl px-4 py-3 text-sm text-white outline-none"
                  placeholder="Add context for the message you want to draft."
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void generateEmailDraft()}
                    disabled={emailBusy}
                    className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-white"
                  >
                    {emailBusy ? "Generating..." : "Generate email"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void copyText(emailDraft, (value) => setEmailFeedback(value))
                    }
                    className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-text-secondary"
                  >
                    Copy draft
                  </button>
                </div>
                {emailError ? <p className="text-sm text-status-error">{emailError}</p> : null}
                {emailFeedback ? <p className="text-sm text-status-success">{emailFeedback}</p> : null}
                <pre className="min-h-[220px] whitespace-pre-wrap brand-surface-soft rounded-2xl border p-4 text-sm text-text-secondary">
                  {emailDraft || "Generate a draft to see it here."}
                </pre>
              </div>
            }
            agendaBuilder={
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-text-secondary">
                    <span>Session type</span>
                    <select
                      value={agendaSessionType}
                      onChange={(event) =>
                        handleSessionTypeChange(
                          event.target.value as (typeof agendaSessionTypeOptions)[number]
                        )
                      }
                      className="brand-input w-full rounded-xl px-3 py-2 text-white"
                    >
                      {agendaSessionTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2 text-sm text-text-secondary">
                    <span>Date</span>
                    <input
                      type="date"
                      value={agendaDate}
                      onChange={(event) => setAgendaDate(event.target.value)}
                      className="brand-input w-full rounded-xl px-3 py-2 text-white"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-text-secondary">
                    <span>Duration</span>
                    <input
                      value={agendaDuration}
                      onChange={(event) => setAgendaDuration(event.target.value)}
                      className="brand-input w-full rounded-xl px-3 py-2 text-white"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-text-secondary md:col-span-2">
                    <span>Notes</span>
                    <textarea
                      value={agendaNotes}
                      onChange={(event) => setAgendaNotes(event.target.value)}
                      className="brand-input min-h-[120px] w-full rounded-2xl px-4 py-3 text-white"
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void generateAgenda()}
                    disabled={agendaBusy}
                    className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-white"
                  >
                    {agendaBusy ? "Generating..." : "Generate agenda"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void copyText(agendaResult?.content ?? "", (value) =>
                        setAgendaFeedback(value)
                      )
                    }
                    className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-text-secondary"
                  >
                    Copy agenda
                  </button>
                  <button
                    type="button"
                    onClick={() => void createCalendarEvent()}
                    disabled={!agendaDate || calendarBusy}
                    className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-text-secondary disabled:cursor-not-allowed disabled:text-text-muted"
                  >
                    {calendarBusy ? "Creating..." : "+ Add to Google Calendar"}
                  </button>
                </div>
                {agendaError ? <p className="text-sm text-status-error">{agendaError}</p> : null}
                {agendaFeedback ? <p className="text-sm text-status-success">{agendaFeedback}</p> : null}
                {calendarError ? <p className="text-sm text-status-error">{calendarError}</p> : null}
                {calendarFeedback ? <p className="text-sm text-status-success">{calendarFeedback}</p> : null}
                <pre className="min-h-[220px] whitespace-pre-wrap brand-surface-soft rounded-2xl border p-4 text-sm text-text-secondary">
                  {agendaResult?.content || "Generate an agenda to see it here."}
                </pre>
                {agendaHistory.length > 0 ? (
                  <div className="space-y-2">
                    {agendaHistory.map((historyItem, index) => (
                      <details
                        key={`${historyItem.generatedAt}-${index}`}
                        className="brand-surface-soft rounded-2xl border p-4"
                      >
                        <summary className="cursor-pointer text-sm text-text-secondary">
                          {historyItem.sessionType} · {formatDate(historyItem.generatedAt)}
                        </summary>
                        <pre className="mt-3 whitespace-pre-wrap text-sm text-text-secondary">
                          {historyItem.content}
                        </pre>
                      </details>
                    ))}
                  </div>
                ) : null}
              </div>
            }
          />
        );
      case "portal":
        return (
          <PortalTab
            userManagement={
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={clientUserDraft.firstName}
                    onChange={(event) =>
                      setClientUserDraft((currentDraft) => ({
                        ...currentDraft,
                        firstName: event.target.value
                      }))
                    }
                    placeholder="First name"
                    className="brand-input rounded-xl px-3 py-2 text-white"
                  />
                  <input
                    value={clientUserDraft.lastName}
                    onChange={(event) =>
                      setClientUserDraft((currentDraft) => ({
                        ...currentDraft,
                        lastName: event.target.value
                      }))
                    }
                    placeholder="Last name"
                    className="brand-input rounded-xl px-3 py-2 text-white"
                  />
                  <input
                    value={clientUserDraft.email}
                    onChange={(event) =>
                      setClientUserDraft((currentDraft) => ({
                        ...currentDraft,
                        email: event.target.value
                      }))
                    }
                    placeholder="Email"
                    className="brand-input rounded-xl px-3 py-2 text-white md:col-span-2"
                  />
                  <select
                    value={clientUserDraft.role}
                    onChange={(event) =>
                      setClientUserDraft((currentDraft) => ({
                        ...currentDraft,
                        role: event.target.value
                      }))
                    }
                    className="brand-input rounded-xl px-3 py-2 text-white"
                  >
                    <option value="contributor">Contributor</option>
                    <option value="approver">Approver</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <label className="flex items-center gap-2 brand-input rounded-xl px-3 py-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={clientUserDraft.questionnaireAccess}
                      onChange={(event) =>
                        setClientUserDraft((currentDraft) => ({
                          ...currentDraft,
                          questionnaireAccess: event.target.checked
                        }))
                      }
                    />
                    Questionnaire access
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => void addClientUser()}
                  disabled={clientUserBusy}
                  className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-white"
                >
                  {clientUserBusy ? "Saving..." : "Invite client user"}
                </button>
                {clientUserError ? <p className="text-sm text-status-error">{clientUserError}</p> : null}
                {clientUserFeedback ? <p className="text-sm text-status-success">{clientUserFeedback}</p> : null}
                <div className="space-y-3">
                  {clientUsers.map((user) => (
                    <div
                      key={user.id}
                      className="brand-surface-soft rounded-2xl border p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-white">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="mt-1 text-sm text-text-secondary">{user.email}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-text-muted">
                            {user.role} · {user.authStatus ?? "invite_pending"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void copyClientAccessLink(user.id, "invite-link")}
                            disabled={linkBusyId === user.id}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-text-secondary"
                          >
                            Invite link
                          </button>
                          <button
                            type="button"
                            onClick={() => void copyClientAccessLink(user.id, "reset-link")}
                            disabled={linkBusyId === user.id}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-text-secondary"
                          >
                            Reset link
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            }
            portalActions={
              <div className="space-y-4 text-sm text-text-secondary">
                <div className="brand-surface-soft rounded-2xl border p-4">
                  <p className="font-medium text-white">Preview client portal</p>
                  <p className="mt-1 text-xs text-text-muted">Opens the portal as your client sees it (requires at least one invited client user).</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void openClientPortalPreview()}
                      disabled={portalPreviewBusy}
                      className="rounded-xl border border-[rgba(81,208,176,0.25)] bg-[rgba(81,208,176,0.12)] px-4 py-2 text-sm font-medium text-[#51d0b0] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {portalPreviewBusy ? "Opening..." : "Preview client portal →"}
                    </button>
                  </div>
                  {portalPreviewError ? (
                    <p className="mt-2 text-xs text-status-error">{portalPreviewError}</p>
                  ) : null}
                </div>
                <div className="brand-surface-soft rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-white">Show quote to client</p>
                      <p className="mt-1 text-xs text-text-muted">When enabled, the quote section is visible in the client portal for this project.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void togglePortalQuote()}
                      disabled={portalQuoteToggleBusy}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-60 ${portalQuoteEnabled ? "bg-[#51d0b0]" : "bg-white/20"}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${portalQuoteEnabled ? "translate-x-5" : "translate-x-0"}`}
                      />
                    </button>
                  </div>
                </div>
                <div className="brand-surface-soft rounded-2xl border p-4">
                  <p className="font-medium text-white">HubSpot portal connection</p>
                  <p className="mt-2">
                    {project.portal?.connected
                      ? `${project.portal.displayName} is connected.`
                      : "No connected HubSpot portal detected."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/projects/portal-ops"
                    className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-white"
                  >
                    Open Portal Ops →
                  </Link>
                  <Link
                    href={`/projects/${project.id}/quote`}
                    className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-text-secondary"
                  >
                    Open client quote →
                  </Link>
                </div>
              </div>
            }
          />
        );
    }
  })();

  return (
    <AppShell>
      <div className="brand-page p-4 sm:p-6 xl:p-8">
        <ProjectDetailLayout
          backHref="/projects"
          title={project.name}
          statusLabel={formatLabel(project.status)}
          clientName={project.client.name}
          projectType={formatLabel(project.engagementType)}
          hubsInScope={project.selectedHubs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          actions={
            <>
              <Link
                href={`/projects/${project.id}/discovery`}
                className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-white"
              >
                Discovery
              </Link>
              <Link
                href={`/projects/${project.id}/delivery`}
                className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-white"
              >
                Delivery Board
              </Link>
              <Link
                href={`/projects/${project.id}/quote`}
                className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-text-secondary"
              >
                Quote
              </Link>
            </>
          }
          sidebar={
            <ProjectContextSidebar
              clientName={project.client.name}
              clientContactEmail={project.clientChampionEmail ?? project.portal?.connectedEmail ?? null}
              portalUrl={
                project.portal?.hubDomain
                  ? `https://${project.portal.hubDomain}`
                  : project.portal?.portalId
                    ? `Portal ${project.portal.portalId}`
                    : null
              }
              hubTier={portalSnapshot?.hubTier ?? null}
              connectionReady={Boolean(project.portal?.connected)}
              contactsCount={portalSnapshot?.contactPropertyCount ?? null}
              dealsCount={portalSnapshot?.dealPropertyCount ?? null}
              propertiesCount={portalSnapshot?.contactPropertyCount ?? null}
              customObjectsCount={portalSnapshot?.customObjectCount ?? null}
              ownerName={project.owner}
              ownerEmail={project.ownerEmail}
              hubsInScope={project.selectedHubs}
              platformName={project.customerPlatformTier ?? null}
              platformDescription={project.packagingAssessment?.summary ?? null}
              quickWins={quickWinStats}
              onRefreshSnapshot={() => void refreshSnapshot()}
              refreshingSnapshot={snapshotBusy}
            />
          }
        >
          {activeTabContent}
        </ProjectDetailLayout>
      </div>
    </AppShell>
  );
}
