"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { KeyRound, Search, ExternalLink, Loader2 } from "lucide-react";

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
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-amber-600">
          <KeyRound size={20} />
          <span className="text-sm font-semibold uppercase tracking-wide">
            Internal operator tool
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">Skeleton key</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Open any client project portal as the {""}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
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
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          placeholder="Filter by project, client, or status"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading projects…
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Project</th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-sm text-slate-500"
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
                    <tr key={project.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-slate-900">
                          {project.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {project.id}
                        </div>
                        {rowErr ? (
                          <div className="mt-1 text-xs text-red-600">
                            {rowErr}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top text-slate-700">
                        {project.clientName ?? "—"}
                      </td>
                      <td className="px-4 py-3 align-top text-slate-700">
                        {project.status ?? "—"}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/projects/${project.id}`}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Operator view
                          </Link>
                          <button
                            type="button"
                            onClick={() => openClientPortal(project.id)}
                            disabled={busy}
                            className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
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
