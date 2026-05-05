"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  Inbox as InboxIcon,
  Mail,
  RefreshCw
} from "lucide-react";

import AppShell from "./AppShell";
import { Avatar } from "./ui/Avatar";
import { Btn } from "./ui/Btn";
import { Empty } from "./ui/Empty";
import { FilterChip } from "./ui/FilterChip";
import { PageHead } from "./ui/PageHead";
import { Panel, PanelBody, PanelHead } from "./ui/Panel";
import { Pill } from "./ui/Pill";
import { SearchInput } from "./ui/SearchInput";

interface InboxProject {
  id: string;
  name: string;
}

interface InboxMessage {
  id: string;
  projectId: string;
  senderType: string;
  senderName: string;
  body: string;
  createdAt: string;
  project: InboxProject;
}

interface SubmissionAlert {
  project: InboxProject;
  updatedAt: string | null;
  sessionNumber: number | null;
  submittedByName: string | null;
}

interface WorkRequestRow {
  id: string;
  kind: string;
  subject: string;
  fromName: string | null;
  clientName: string | null;
  status: string;
  createdAt: string;
}

type RowKind = "work_request" | "submission" | "message";

interface UnifiedRow {
  id: string;
  kind: RowKind;
  kindLabel: string;
  subject: string;
  from: string;
  projectName: string | null;
  projectId: string | null;
  when: string;
  whenIso: string;
  priority?: "info" | "warn" | "danger";
  href: string;
  raw?: WorkRequestRow | InboxMessage | SubmissionAlert;
}

const filterDefs: Array<{ id: string; label: string; matches: (r: UnifiedRow) => boolean }> = [
  { id: "all", label: "All", matches: () => true },
  {
    id: "quote",
    label: "Quote requests",
    matches: (r) => r.kindLabel.toLowerCase().includes("quote")
  },
  {
    id: "change",
    label: "Change requests",
    matches: (r) => r.kindLabel.toLowerCase().includes("change")
  },
  {
    id: "submission",
    label: "Client submissions",
    matches: (r) => r.kind === "submission"
  },
  {
    id: "messages",
    label: "Messages",
    matches: (r) => r.kind === "message"
  }
];

function relativeTime(iso?: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function InboxView() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [projects, setProjects] = useState<InboxProject[]>([]);
  const [composeProjectId, setComposeProjectId] = useState("");
  const [draft, setDraft] = useState("");
  const [composeError, setComposeError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function loadAll() {
    setRefreshing(true);
    try {
      const [inboxRes, projectsRes, workRes] = await Promise.all([
        fetch("/api/inbox").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/projects").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/work-requests")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      ]);

      const messages: InboxMessage[] = Array.isArray(inboxRes?.messages)
        ? inboxRes.messages
        : [];
      const submissions: SubmissionAlert[] = Array.isArray(inboxRes?.submissionAlerts)
        ? inboxRes.submissionAlerts
        : [];
      const workRequests: WorkRequestRow[] = Array.isArray(workRes?.workRequests)
        ? workRes.workRequests
        : Array.isArray(workRes?.items)
          ? workRes.items
          : [];

      const unified: UnifiedRow[] = [
        ...workRequests.map((w) => ({
          id: `wr_${w.id}`,
          kind: "work_request" as RowKind,
          kindLabel: w.kind ?? "Work request",
          subject: w.subject ?? "Untitled",
          from: w.fromName ?? w.clientName ?? "—",
          projectName: w.clientName ?? null,
          projectId: null,
          when: relativeTime(w.createdAt),
          whenIso: w.createdAt,
          priority: (w.status === "new" ? "warn" : "info") as "warn" | "info",
          href: `/inbox?wr=${w.id}`,
          raw: w
        })),
        ...submissions.map((s) => ({
          id: `sub_${s.project.id}_${s.sessionNumber ?? "x"}`,
          kind: "submission" as RowKind,
          kindLabel: "Client submission",
          subject: `${s.submittedByName ?? "Client contact"} updated ${
            s.sessionNumber ? `section ${s.sessionNumber}` : "their inputs"
          }`,
          from: s.submittedByName ?? "Client",
          projectName: s.project.name,
          projectId: s.project.id,
          when: relativeTime(s.updatedAt ?? undefined),
          whenIso: s.updatedAt ?? "",
          priority: "info" as const,
          href: `/projects/${s.project.id}/inputs`,
          raw: s
        })),
        ...messages.map((m) => ({
          id: `msg_${m.id}`,
          kind: "message" as RowKind,
          kindLabel: "Message",
          subject: m.body.length > 80 ? `${m.body.slice(0, 80)}…` : m.body,
          from: m.senderName,
          projectName: m.project?.name ?? null,
          projectId: m.projectId,
          when: relativeTime(m.createdAt),
          whenIso: m.createdAt,
          priority:
            m.senderType === "client" ? ("warn" as const) : ("info" as const),
          href: `/projects/${m.projectId}`,
          raw: m
        }))
      ].sort((a, b) => (a.whenIso < b.whenIso ? 1 : -1));

      setRows(unified);

      const projItems: InboxProject[] = Array.isArray(projectsRes?.projects)
        ? projectsRes.projects.map((p: { id: string; name: string }) => ({
            id: p.id,
            name: p.name
          }))
        : [];
      setProjects(projItems);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const filterDef = filterDefs.find((f) => f.id === filter) ?? filterDefs[0];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!filterDef!.matches(r)) return false;
      if (!q) return true;
      return (
        r.subject.toLowerCase().includes(q) ||
        r.from.toLowerCase().includes(q) ||
        (r.projectName ?? "").toLowerCase().includes(q) ||
        r.kindLabel.toLowerCase().includes(q)
      );
    });
  }, [rows, filterDef, search]);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const f of filterDefs) {
      out[f.id] = rows.filter(f.matches).length;
    }
    return out;
  }, [rows]);

  async function sendMessage() {
    if (!composeProjectId || !draft.trim()) {
      setComposeError("Choose project + write a message");
      return;
    }
    setSending(true);
    setComposeError(null);
    try {
      const r = await fetch(
        `/api/projects/${encodeURIComponent(composeProjectId)}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: draft, senderName: "Muloo" })
        }
      );
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        throw new Error(body?.error ?? "Send failed");
      }
      setDraft("");
      await loadAll();
    } catch (e) {
      setComposeError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell>
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
        <PageHead
          eyebrow="Triage"
          title="Inbox"
          lede="Quote requests, change requests, client submissions, and project messages — triage and route here."
          actions={
            <Btn
              variant="ghost"
              size="md"
              onClick={() => void loadAll()}
              disabled={refreshing}
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </Btn>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6 items-start">
          {/* Filter rail */}
          <aside className="flex flex-col gap-2 lg:sticky lg:top-[80px] self-start">
            <SearchInput
              placeholder="Search inbox…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex flex-col gap-1 mt-2">
              {filterDefs.map((f) => {
                const isActive = f.id === filter;
                const c = counts[f.id] ?? 0;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors ${
                      isActive
                        ? "bg-ink-3 text-text-1"
                        : "text-text-2 hover:bg-ink-2 hover:text-text-1"
                    }`}
                  >
                    <span className="flex-1 text-left">{f.label}</span>
                    {c > 0 && (
                      <span
                        className={`font-mono text-[11px] px-1.5 py-px rounded-[10px] min-w-5 text-center ${
                          isActive
                            ? "bg-[rgba(74,219,192,0.12)] text-status-ok"
                            : "bg-ink-3 text-text-3"
                        }`}
                      >
                        {c}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Compose */}
            <Panel className="mt-4">
              <PanelHead title="Quick message" />
              <PanelBody className="grid gap-2">
                <select
                  value={composeProjectId}
                  onChange={(e) => setComposeProjectId(e.target.value)}
                  className="bg-ink-2 border border-ink-4 rounded-[10px] px-2.5 py-2 text-[12.5px] text-text-1 outline-none focus:border-[rgba(74,219,192,0.35)]"
                >
                  <option value="">Choose project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a quick update…"
                  className="bg-ink-2 border border-ink-4 rounded-[10px] px-2.5 py-2 text-[12.5px] text-text-1 outline-none focus:border-[rgba(74,219,192,0.35)] placeholder:text-text-4 min-h-[80px] resize-y"
                />
                {composeError && (
                  <div className="text-[11.5px] text-status-danger">{composeError}</div>
                )}
                <Btn
                  variant="primary"
                  size="sm"
                  onClick={() => void sendMessage()}
                  disabled={sending}
                >
                  <Mail size={12} />
                  {sending ? "Sending…" : "Send"}
                </Btn>
              </PanelBody>
            </Panel>
          </aside>

          {/* List */}
          <div className="min-w-0">
            {loading ? (
              <Empty title="Loading inbox…" sub="One moment." />
            ) : filtered.length === 0 ? (
              <Empty
                icon={<InboxIcon size={20} />}
                title={search ? "No matches" : "Inbox is clear"}
                sub={
                  search
                    ? "Try a different search or clear filters."
                    : "Nothing waiting on you right now."
                }
              />
            ) : (
              <Panel>
                {filtered.map((r, i) => (
                  <Link
                    key={r.id}
                    href={r.href}
                    className={`grid grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] gap-3.5 items-center px-[18px] py-3 cursor-pointer hover:bg-ink-2 transition-colors ${
                      i < filtered.length - 1 ? "border-b border-ink-4" : ""
                    }`}
                  >
                    <Pill tone={r.priority ?? "neutral"} dot>
                      {r.kindLabel}
                    </Pill>
                    <Avatar size="sm" initials={r.from.slice(0, 2)} />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium truncate">
                        {r.subject}
                      </div>
                      <div className="text-[11.5px] text-text-3 mt-0.5 truncate">
                        {r.from}
                        {r.projectName ? ` · ${r.projectName}` : ""}
                      </div>
                    </div>
                    <span className="text-text-3 font-mono text-[11px] whitespace-nowrap">
                      {r.when}
                    </span>
                    {r.kind === "work_request" ? (
                      <Btn variant="ghost" size="sm">
                        Convert <ArrowRight size={11} />
                      </Btn>
                    ) : (
                      <ChevronRight size={14} className="text-text-3" />
                    )}
                  </Link>
                ))}
              </Panel>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
