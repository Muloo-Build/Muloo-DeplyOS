"use client";

import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import ReportPackInstaller from "../components/ReportPackInstaller";

interface ProjectSummary {
  id: string;
  name: string;
  portalId?: string | null;
  status?: string;
}

export default function ReportsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as
          | { projects?: ProjectSummary[] }
          | ProjectSummary[];
        const list = Array.isArray(json)
          ? json
          : Array.isArray(json.projects)
            ? json.projects
            : [];
        if (cancelled) return;
        const eligible = list.filter((p) => p.portalId && p.portalId.trim());
        setProjects(eligible);
        if (eligible.length > 0) setSelectedId(eligible[0].id);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell>
      <div className="p-8">
        <div className="space-y-6">
          <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8">
            <p className="text-sm uppercase tracking-[0.25em] text-text-muted">
              Reports
            </p>
            <h1 className="mt-3 text-3xl font-bold font-heading text-white">
              HubSpot Standard Report Pack
            </h1>
            <p className="mt-3 max-w-3xl text-text-secondary">
              Pick a project, choose templates from the catalogue, and push
              them into the linked HubSpot portal. Status, errors, and last
              installed timestamps are tracked per portal.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-background-card p-5">
            {loading ? (
              <p className="text-text-secondary">Loading projects…</p>
            ) : error ? (
              <p className="text-rose-300">{error}</p>
            ) : projects.length === 0 ? (
              <p className="text-text-secondary">
                No projects with a linked HubSpot portal were found.
              </p>
            ) : (
              <label className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-text-muted">Project</span>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="rounded-md border border-white/10 bg-background-primary px-2 py-1 text-white"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.portalId})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {selectedId && <ReportPackInstaller projectId={selectedId} />}
        </div>
      </div>
    </AppShell>
  );
}
