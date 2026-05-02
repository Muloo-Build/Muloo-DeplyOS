"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { KeyRound, Search, ExternalLink, Loader2 } from "lucide-react";

import Breadcrumb from "../components/Breadcrumb";

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
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <Breadcrumb
        items={[
          { label: "Admin", href: "/settings" },
          { label: "Skeleton Key" }
        ]}
      />

      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
          <KeyRound size={14} />
          Internal operator tool
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          Skeleton Key
        </h1>
        <p className="max-w-2xl text-sm text-text-secondary">
          Open any client project portal as the{" "}
          <code className="rounded bg-background-elevated px-1.5 py-0.5 text-xs text-text-secondary">
            skeleton@muloo.internal
          </code>{" "}
          operator. The skeleton account is auto-granted champion-level access so
          you can review workbooks, contributors, and the full client experience
          without inviting yourself as a real client. Sessions expire after 60
          minutes.
        </p>
      </header>

      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          type="search"
          placeholder="Filter by project, client, or status"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-text-muted focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10"
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Loader2 size={16} className="animate-spin" />
          Loading projects…
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card">
          <table className="w-full text-sm">
            <thead className="bg-background-elevated text-xs uppercase tracking-[0.2em] text-text-muted">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Project</th>
                <th className="px-4 py-3 text-left font-medium">Client</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.05)]">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-sm text-text-muted"
                  >
                    {projects.length === 0
                      ? "No projects found."
                      : "No projects match your filter."}
                  </td>
                </tr>
              ) : (
                filtered.map((project) => {
                  const busy = pendingId === project.id;
                  const rowErr = rowError[project.id];
                  return (
                    <tr
                      key={project.id}
                      className="transition-colors hover:bg-background-elevated"
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-white">
                          {project.name}
                        </div>
                        <div className="text-xs text-text-muted">
                          {project.id}
                        </div>
                        {rowErr ? (
                          <div className="mt-1 text-xs text-rose-300">
                            {rowErr}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top text-text-secondary">
                        {project.clientName ?? "—"}
                      </td>
                      <td className="px-4 py-3 align-top text-text-secondary">
                        {project.status ?? "—"}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/projects/${project.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-[rgba(255,255,255,0.08)] bg-background-elevated px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-white/20 hover:text-white"
                          >
                            Operator view
                          </Link>
                          <button
                            type="button"
                            onClick={() => openClientPortal(project.id)}
                            disabled={busy}
                            className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busy ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <ExternalLink size={12} />
                            )}
                            {busy ? "Opening…" : "Open client portal"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
