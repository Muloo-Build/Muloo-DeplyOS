"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import ReportPackInstaller from "../components/ReportPackInstaller";
import { Empty } from "../components/ui/Empty";
import { PageHead } from "../components/ui/PageHead";
import { Panel, PanelBody } from "../components/ui/Panel";

interface ProjectSummary {
  id: string;
  name: string;
  portalId?: string | null;
  status?: string;
}

export default function ReportsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/projects", { credentials: "include" });
        // Match the rest of the workspace — when the session has expired
        // the operator should land on /login, not see a raw "HTTP 401"
        // error string.
        if (res.status === 401) {
          if (!cancelled) router.replace("/login");
          return;
        }
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
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
        <PageHead
          eyebrow="Library"
          title="Reports"
          lede="Pick a project, choose templates from the catalogue, and push them into the linked HubSpot portal. Status, errors, and last installed timestamps are tracked per portal."
        />
        <div className="space-y-6">
          <Panel>
            <PanelBody>
              {loading ? (
                <p className="text-text-2 text-[13px]">Loading projects…</p>
              ) : error ? (
                <p className="text-status-danger text-[13px]">{error}</p>
              ) : projects.length === 0 ? (
                <Empty
                  title="No portal-linked projects"
                  sub="Connect a HubSpot portal to a project to install report packs."
                />
              ) : (
                <label className="flex flex-wrap items-center gap-3 text-[13px]">
                  <span className="text-text-3">Project</span>
                  <select
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="bg-ink-2 border border-ink-4 rounded-[10px] px-2.5 py-1.5 text-text-1 outline-none focus:border-[rgba(74,219,192,0.35)]"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.portalId})
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </PanelBody>
          </Panel>

          {selectedId && <ReportPackInstaller projectId={selectedId} />}
        </div>
      </div>
    </AppShell>
  );
}
