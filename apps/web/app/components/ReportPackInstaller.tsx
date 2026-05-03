"use client";

import { useEffect, useMemo, useState } from "react";

interface TemplateMeta {
  id: string;
  slug: string;
  name: string;
  hub: string;
  section: string;
  chartType: string;
  description: string;
  displayOrder: number;
}

interface InstallationMeta {
  id: string;
  status: string;
  hubspotReportId: string | null;
  hubspotReportUrl: string | null;
  errorMessage: string | null;
  lastInstalledAt: string | null;
  lastAttemptAt: string | null;
  attemptCount: number;
  executionJobId: string | null;
}

interface ReportPackItem {
  template: TemplateMeta;
  installation: InstallationMeta | null;
}

interface ReportPackResponse {
  project: {
    id: string;
    name: string;
    portalId: string;
    hubspotPortalId?: string | null;
    portalName?: string | null;
  };
  items: ReportPackItem[];
}

const HUB_LABEL: Record<string, string> = {
  marketing: "Marketing",
  sales: "Sales",
  service: "Service",
  ops: "Ops",
  commerce: "Commerce"
};

const HUB_ORDER = ["sales", "marketing", "service", "ops", "commerce"];

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "installed"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : status === "failed"
        ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
        : status === "running"
          ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
          : status === "cowork_pending"
            ? "bg-violet-500/15 text-violet-300 border-violet-500/30"
            : "bg-slate-500/15 text-slate-300 border-slate-500/30";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${tone}`}
    >
      {status}
    </span>
  );
}

export default function ReportPackInstaller({
  projectId
}: {
  projectId: string;
}) {
  const [data, setData] = useState<ReportPackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hubFilter, setHubFilter] = useState<string>("all");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/report-pack`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as ReportPackResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Lightweight polling — while any installation on this project is in
  // `pending` or `running`, refresh every 4s so operators see installs
  // move to installed/failed without a manual reload. Stops automatically
  // once the queue drains so we don't poll for nothing.
  const hasInflight = useMemo(
    () =>
      data?.items.some(
        (i) =>
          i.installation?.status === "pending" ||
          i.installation?.status === "running"
      ) ?? false,
    [data]
  );

  useEffect(() => {
    if (!hasInflight) return;
    const handle = window.setInterval(() => {
      load();
    }, 4000);
    return () => window.clearInterval(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInflight, projectId]);

  const itemsByHub = useMemo(() => {
    const out: Record<string, ReportPackItem[]> = {};
    if (!data) return out;
    for (const item of data.items) {
      const hub = item.template.hub ?? "marketing";
      if (!out[hub]) out[hub] = [];
      out[hub].push(item);
    }
    return out;
  }, [data]);

  const visibleHubs = useMemo(() => {
    const present = HUB_ORDER.filter((h) => itemsByHub[h]?.length);
    return hubFilter === "all"
      ? present
      : present.filter((h) => h === hubFilter);
  }, [itemsByHub, hubFilter]);

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function installSelected() {
    if (selected.size === 0) return;
    setBusy(true);
    setFlash(null);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/report-pack/install`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateSlugs: Array.from(selected) })
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { queued: unknown[] };
      setFlash(`Queued ${body.queued.length} report install job(s).`);
      setSelected(new Set());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function retry(installationId: string) {
    setBusy(true);
    setError(null);
    setFlash(null);
    try {
      const res = await fetch(
        `/api/report-installations/${installationId}/retry`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Tag the retry with the current project so the resulting
          // ExecutionJob is attributed here rather than to whatever
          // project first installed the report on this portal (which may
          // since have been archived).
          body: JSON.stringify({ requestingProjectId: projectId })
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setFlash("Retry queued.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/5 bg-background-card p-6 text-text-secondary">
        Loading report pack…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
        {error}
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-white/5 bg-background-card p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
            Report Pack — {data.project.name}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Push standard reports into HubSpot portal{" "}
            <span className="font-mono text-white">
              {data.project.hubspotPortalId ?? data.project.portalId}
              {data.project.portalName ? ` · ${data.project.portalName}` : ""}
            </span>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-text-muted">Hub</label>
          <select
            value={hubFilter}
            onChange={(e) => setHubFilter(e.target.value)}
            className="rounded-md border border-white/10 bg-background-primary px-2 py-1 text-sm text-white"
          >
            <option value="all">All hubs</option>
            {HUB_ORDER.filter((h) => itemsByHub[h]?.length).map((h) => (
              <option key={h} value={h}>
                {HUB_LABEL[h] ?? h}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => load()}
            disabled={busy}
            className="rounded-md border border-white/10 bg-background-primary px-3 py-1.5 text-sm text-text-secondary hover:text-white disabled:opacity-50"
            title={
              hasInflight
                ? "Auto-refreshing while installs are in flight"
                : "Refresh installation status"
            }
          >
            {hasInflight ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={installSelected}
            disabled={selected.size === 0 || busy}
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
          >
            Install selected ({selected.size})
          </button>
        </div>
      </div>

      {flash && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
          {flash}
        </div>
      )}

      {visibleHubs.map((hub) => (
        <section
          key={hub}
          className="rounded-2xl border border-white/5 bg-background-card p-5"
        >
          <h3 className="mb-3 text-base font-semibold text-white">
            {HUB_LABEL[hub] ?? hub}{" "}
            <span className="text-sm font-normal text-text-muted">
              ({itemsByHub[hub].length})
            </span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-text-muted">
                  <th className="w-8 px-2 py-2"></th>
                  <th className="px-2 py-2">Template</th>
                  <th className="px-2 py-2">Chart</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Last installed</th>
                  <th className="px-2 py-2">Attempts</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {itemsByHub[hub].map((item) => {
                  const inst = item.installation;
                  const status = inst?.status ?? "not_installed";
                  return (
                    <tr
                      key={item.template.slug}
                      className="border-t border-white/5 align-top"
                    >
                      <td className="px-2 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(item.template.slug)}
                          onChange={() => toggle(item.template.slug)}
                          aria-label={`Select ${item.template.name}`}
                        />
                      </td>
                      <td className="px-2 py-3">
                        <div className="font-medium text-white">
                          {item.template.name}
                        </div>
                        <div className="text-xs text-text-muted">
                          {item.template.description}
                        </div>
                        {inst?.errorMessage && (
                          <div className="mt-1 text-xs text-rose-300">
                            {inst.errorMessage}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-3 text-text-secondary">
                        {item.template.chartType}
                      </td>
                      <td className="px-2 py-3">
                        <StatusPill status={status} />
                      </td>
                      <td className="px-2 py-3 text-text-secondary">
                        {formatTimestamp(inst?.lastInstalledAt ?? null)}
                      </td>
                      <td className="px-2 py-3 text-text-secondary">
                        {inst?.attemptCount ?? 0}
                      </td>
                      <td className="px-2 py-3 text-right">
                        {inst && (
                          <div className="flex items-center justify-end gap-2">
                            {inst.hubspotReportUrl && (
                              <a
                                href={inst.hubspotReportUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-sky-300 hover:underline"
                              >
                                View
                              </a>
                            )}
                            {(inst.status === "failed" ||
                              inst.status === "installed" ||
                              inst.status === "cowork_pending") && (
                              <button
                                type="button"
                                onClick={() => retry(inst.id)}
                                disabled={busy}
                                className="rounded-md border border-white/15 px-2 py-1 text-xs text-white hover:bg-white/5 disabled:opacity-50"
                              >
                                {inst.status === "installed"
                                  ? "Re-install"
                                  : "Retry"}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
