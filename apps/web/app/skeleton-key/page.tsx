"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, KeyRound, Loader2 } from "lucide-react";

import AppShell from "../components/AppShell";
import { Btn } from "../components/ui/Btn";
import { Empty } from "../components/ui/Empty";
import { PageHead } from "../components/ui/PageHead";
import { SearchInput } from "../components/ui/SearchInput";
import {
  CellPrimary,
  TBody,
  Tbl,
  Td,
  Th,
  THead,
  Tr
} from "../components/ui/Tbl";

type ProjectRow = {
  id: string;
  name: string;
  status?: string | null;
  clientId?: string | null;
  clientName?: string | null;
};

type ProjectsResponse = {
  projects?: ProjectRow[];
};

export default function SkeletonKeyPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/projects", {
          credentials: "include"
        });
        if (response.status === 401) {
          throw new Error(
            "You must be signed in as an internal operator to use the skeleton key."
          );
        }
        if (!response.ok) {
          throw new Error(`Failed to load projects (${response.status})`);
        }
        const data = (await response.json()) as ProjectsResponse;
        if (!cancelled) {
          setProjects(Array.isArray(data.projects) ? data.projects : []);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Failed to load projects"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const trimmed = filter.trim().toLowerCase();
    if (!trimmed) return projects;
    return projects.filter((p) => {
      const haystack = [p.name, p.clientName, p.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [filter, projects]);

  async function openClientPortal(projectId: string) {
    setPendingId(projectId);
    setRowError((prev) => {
      const next = { ...prev };
      delete next[projectId];
      return next;
    });
    try {
      const response = await fetch(
        `/api/admin/skeleton-key/${encodeURIComponent(projectId)}`,
        { method: "POST", credentials: "include" }
      );
      const body = (await response.json().catch(() => ({}))) as {
        previewUrl?: string;
        error?: string;
      };
      if (!response.ok || !body.previewUrl) {
        throw new Error(body.error ?? `Request failed (${response.status})`);
      }
      window.open(body.previewUrl, "_blank", "noopener");
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Failed to open portal";
      setRowError((prev) => ({ ...prev, [projectId]: message }));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <AppShell>
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
        <PageHead
          eyebrow={
            <span className="inline-flex items-center gap-1.5">
              <KeyRound size={11} />
              Internal operator tool
            </span>
          }
          title="Skeleton Key"
          lede="Open any client project portal as the skeleton@muloo.internal operator. Auto-granted champion-level access for reviewing workbooks, contributors, and the full client experience. Sessions expire after 60 minutes."
        />

        <div className="mb-4 max-w-md">
          <SearchInput
            placeholder="Filter by project, client, or status"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>

        {error ? (
          <Empty title="Skeleton key error" sub={error} />
        ) : loading ? (
          <Empty title="Loading projects…" sub="One moment." />
        ) : filtered.length === 0 ? (
          <Empty
            title={
              projects.length === 0
                ? "No projects found"
                : "No matches"
            }
            sub={
              projects.length === 0
                ? "Create a project to use skeleton key."
                : "Try a different filter."
            }
          />
        ) : (
          <Tbl>
            <THead>
              <Tr>
                <Th>Project</Th>
                <Th>Client</Th>
                <Th>Status</Th>
                <Th style={{ textAlign: "right" }}>Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filtered.map((project) => {
                const busy = pendingId === project.id;
                const rowErr = rowError[project.id];
                return (
                  <Tr key={project.id}>
                    <Td>
                      <CellPrimary
                        sub={
                          <>
                            <span className="font-mono">{project.id}</span>
                            {rowErr && (
                              <div className="mt-1 text-status-danger">
                                {rowErr}
                              </div>
                            )}
                          </>
                        }
                      >
                        {project.name}
                      </CellPrimary>
                    </Td>
                    <Td muted>{project.clientName ?? "—"}</Td>
                    <Td muted>{project.status ?? "—"}</Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/projects/${project.id}`}>
                          <Btn variant="ghost" size="sm">
                            Operator view
                          </Btn>
                        </Link>
                        <Btn
                          variant="primary"
                          size="sm"
                          onClick={() => openClientPortal(project.id)}
                          disabled={busy}
                        >
                          {busy ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <ExternalLink size={12} />
                          )}
                          {busy ? "Opening…" : "Open client portal"}
                        </Btn>
                      </div>
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
