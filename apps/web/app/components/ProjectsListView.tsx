"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Filter, Plus } from "lucide-react";

import AppShell from "./AppShell";
import { Avatar } from "./ui/Avatar";
import { Bar } from "./ui/Bar";
import { Btn } from "./ui/Btn";
import { Empty } from "./ui/Empty";
import { PageHead } from "./ui/PageHead";
import { Pill } from "./ui/Pill";
import { Stat, StatsGrid } from "./ui/Stat";
import { Tabs } from "./ui/Tabs";
import { Tag } from "./ui/Tag";
import {
  CellPrimary,
  TBody,
  Tbl,
  Td,
  Th,
  THead,
  Tr
} from "./ui/Tbl";

interface ProjectRecord {
  id: string;
  name: string;
  clientName?: string | null;
  status?: string;
  stage?: string | null;
  stageLabel?: string | null;
  hubs?: string[];
  progress?: number;
  hours?: { used?: number; allocated?: number; period?: string };
  nextAction?: string | null;
  health?: "ok" | "warn" | "danger";
  updatedAt?: string;
  defaultWorkspacePath?: string | null;
  href?: string | null;
}

const tabDefs = [
  {
    id: "active",
    label: "Active",
    statuses: [
      "draft",
      "active",
      "scoping",
      "designed",
      "ready-for-execution",
      "in-flight"
    ]
  },
  {
    id: "awaiting",
    label: "Awaiting client",
    statuses: ["awaiting_approval", "blocked_external", "shared", "designed"]
  },
  { id: "completed", label: "Completed", statuses: ["completed", "live"] },
  { id: "archived", label: "Archived", statuses: ["archived"] }
];

interface ProjectsListViewProps {
  initialStatus?: string | null;
}

export default function ProjectsListView({ initialStatus }: ProjectsListViewProps) {
  const [active, setActive] = useState(() => {
    if (!initialStatus) return "active";
    const found = tabDefs.find((t) => t.statuses.includes(initialStatus));
    return found?.id ?? "active";
  });
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const response = await fetch("/api/projects");
        if (!response.ok) {
          if (!cancelled) setProjects([]);
          return;
        }
        const body = await response.json();
        const items: ProjectRecord[] = Array.isArray(body?.projects)
          ? body.projects
          : Array.isArray(body)
            ? body
            : [];
        if (!cancelled) setProjects(items);
      } catch {
        if (!cancelled) setProjects([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const tab of tabDefs) {
      out[tab.id] = projects.filter((p) => projectInTab(p, tab)).length;
    }
    return out;
  }, [projects]);

  const filtered = useMemo(() => {
    const tab = tabDefs.find((t) => t.id === active);
    if (!tab) return projects;
    return projects.filter((p) => projectInTab(p, tab));
  }, [projects, active]);

  const stats = useMemo(() => {
    const activeCount = counts["active"] ?? 0;
    const awaiting = counts["awaiting"] ?? 0;
    let usedHours = 0;
    let allocatedHours = 0;
    for (const p of projects) {
      usedHours += p.hours?.used ?? 0;
      allocatedHours += p.hours?.allocated ?? 0;
    }
    const flagged = projects.filter(
      (p) => p.health === "warn" || p.health === "danger"
    ).length;
    return { activeCount, awaiting, usedHours, allocatedHours, flagged };
  }, [projects, counts]);

  return (
    <AppShell>
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
        <PageHead
          eyebrow="Delivery"
          title="Projects"
          lede="HubSpot implementation, optimisation and integration projects across all clients."
          actions={
            <>
              <Btn variant="ghost" size="md">
                <Filter size={14} />
                Filter
              </Btn>
              <Link href="/projects/new">
                <Btn variant="primary" size="md">
                  <Plus size={14} />
                  New project
                </Btn>
              </Link>
            </>
          }
        />

        <StatsGrid cols={4} className="mb-6">
          <Stat
            label="Active"
            value={String(stats.activeCount)}
            delta={
              stats.flagged > 0 ? `${stats.flagged} flagged` : "all on track"
            }
            deltaTone={stats.flagged > 0 ? "down" : "up"}
          />
          <Stat
            label="Awaiting decisions"
            value={String(stats.awaiting)}
            delta={
              stats.awaiting > 0 ? "needs follow-up" : "all responded"
            }
            deltaTone={stats.awaiting > 0 ? "down" : "up"}
          />
          <Stat
            label="Hours this month"
            value={
              stats.allocatedHours > 0
                ? `${stats.usedHours} / ${stats.allocatedHours}`
                : `${stats.usedHours}`
            }
            delta={
              stats.allocatedHours > 0
                ? `${Math.round((stats.usedHours / stats.allocatedHours) * 100)}% of allocated`
                : "no allocation set"
            }
          />
          <Stat
            label="Total projects"
            value={String(projects.length)}
            delta={`${counts["completed"] ?? 0} completed`}
          />
        </StatsGrid>

        <Tabs
          items={tabDefs.map((t) => ({
            id: t.id,
            label: t.label,
            count: counts[t.id]
          }))}
          active={active}
          onChange={setActive}
        />

        {loading ? (
          <Empty title="Loading projects…" sub="One moment." />
        ) : filtered.length === 0 ? (
          <Empty
            title="No projects in this view"
            sub={
              active === "active"
                ? "Spin one up from a quote or a template."
                : "Switch tabs above to see other projects."
            }
            action={
              active === "active" ? (
                <Link href="/projects/new">
                  <Btn variant="primary" size="sm">
                    <Plus size={14} />
                    New project
                  </Btn>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <Tbl>
            <THead>
              <Tr>
                <Th style={{ width: "30%" }}>Project</Th>
                <Th>Client</Th>
                <Th>Stage</Th>
                <Th>Hubs</Th>
                <Th>Progress</Th>
                <Th>Hours</Th>
                <Th>Next action</Th>
                <Th style={{ width: 40 }}></Th>
              </Tr>
            </THead>
            <TBody>
              {filtered.map((p) => {
                const href = p.defaultWorkspacePath ?? p.href ?? `/projects/${p.id}`;
                const tone =
                  p.health === "danger"
                    ? "danger"
                    : p.health === "warn"
                      ? "warn"
                      : "ok";
                return (
                  <Tr
                    key={p.id}
                    onClick={() => {
                      window.location.assign(href);
                    }}
                  >
                    <Td>
                      <CellPrimary
                        sub={
                          p.updatedAt
                            ? `Updated ${new Date(p.updatedAt).toLocaleDateString()}`
                            : null
                        }
                      >
                        {p.name}
                      </CellPrimary>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Avatar
                          size="sm"
                          initials={(p.clientName ?? "?").slice(0, 2)}
                        />
                        <span className="truncate">{p.clientName ?? "—"}</span>
                      </div>
                    </Td>
                    <Td>
                      <Pill tone={tone} dot>
                        {p.stageLabel ?? p.stage ?? statusLabel(p.status)}
                      </Pill>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1 flex-wrap">
                        {(p.hubs ?? []).slice(0, 3).map((h) => (
                          <Tag key={h}>{h}</Tag>
                        ))}
                      </div>
                    </Td>
                    <Td>
                      <div className="min-w-[120px]">
                        <div className="flex justify-end mb-1">
                          <span className="font-mono text-[11px] text-text-3">
                            {p.progress ?? 0}%
                          </span>
                        </div>
                        <Bar
                          value={p.progress ?? 0}
                          tone={tone === "ok" ? "ok" : tone === "warn" ? "warn" : "danger"}
                        />
                      </div>
                    </Td>
                    <Td>
                      <span className="font-mono">
                        {p.hours?.used ?? 0}/
                        {p.hours?.allocated ?? "—"}
                        {p.hours?.allocated ? "h" : ""}
                      </span>
                    </Td>
                    <Td muted className="max-w-[240px]">
                      <span className="text-[12.5px] truncate block">
                        {p.nextAction ?? "—"}
                      </span>
                    </Td>
                    <Td>
                      <ChevronRight size={14} className="text-text-3" />
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Tbl>
        )}
      </div>
    </AppShell>
  );
}

function projectInTab(
  project: ProjectRecord,
  tab: { id: string; statuses: string[] }
): boolean {
  const status = project.status;
  if (status && tab.statuses.includes(status)) return true;
  // Fallback: derive bucket from quoteApprovalStatus / scopeLockedAt when
  // raw status sits in the active set but the operator is really "awaiting client"
  if (tab.id === "active") {
    return Boolean(
      status && ["draft", "active", "scoping", "designed", "ready-for-execution", "in-flight"].includes(status)
    );
  }
  return false;
}

// statusLabel(status?) remains the centralized status copy map for this view.
function statusLabel(status?: string): string {
  if (!status) return "Active";
  const labels: Record<string, string> = {
    draft: "Draft",
    active: "Active",
    scoping: "Scoping",
    designed: "Designed",
    "ready-for-execution": "Ready for execution",
    "in-flight": "In flight",
    in_delivery: "In delivery",
    awaiting_approval: "Awaiting approval",
    blocked_external: "Blocked",
    shared: "Shared",
    live: "Live",
    completed: "Completed",
    archived: "Archived"
  };
  return labels[status] ?? status.replace(/_/g, " ").replace(/-/g, " ");
}
