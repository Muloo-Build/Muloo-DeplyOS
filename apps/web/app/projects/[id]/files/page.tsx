"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Folder,
  Layers,
  RefreshCw,
  Upload
} from "lucide-react";

import { SkeletonBlock } from "../../../components/LoadingSkeleton";
import ProjectWorkspaceView from "../../../components/ProjectWorkspaceView";
import { Btn } from "../../../components/ui/Btn";
import { Empty } from "../../../components/ui/Empty";
import { PageHead } from "../../../components/ui/PageHead";
import { Panel, PanelBody } from "../../../components/ui/Panel";
import { Pill } from "../../../components/ui/Pill";

interface ProjectSummary {
  id: string;
  name?: string;
  googleDriveFolderId?: string | null;
  googleDriveFolderUrl?: string | null;
  googleDriveLastSyncedAt?: string | null;
}

interface FileEvidence {
  id: string;
  evidenceType: string;
  sourceLabel: string;
  sourceUrl: string | null;
  resourceType?: string | null;
  status?: string | null;
  updatedAt: string;
}

const resourceIcon: Record<string, React.ReactNode> = {
  google_sheet: <FileSpreadsheet size={13} className="text-status-ok" />,
  google_doc: <FileText size={13} className="text-status-info" />,
  google_form: <FileText size={13} className="text-status-info" />,
  pdf: <FileText size={13} className="text-status-warn" />,
  drive_file: <FileText size={13} className="text-status-info" />,
  upload: <Upload size={13} className="text-status-info" />,
  miro_board: <Layers size={13} className="text-[#FFC766]" />,
  external_url: <ExternalLink size={13} className="text-text-2" />
};

function isUploadedFile(e: FileEvidence): boolean {
  return (
    e.resourceType === "upload" ||
    (e.sourceUrl?.startsWith("/api/files/") ?? false)
  );
}

const statusTone: Record<
  string,
  "ok" | "warn" | "danger" | "info" | "neutral"
> = {
  submitted: "ok",
  complete: "ok",
  approved: "ok",
  linked: "ok",
  in_progress: "info",
  invited: "warn",
  draft: "neutral",
  blocked: "danger"
};

function relTime(iso?: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

function statusLabel(s?: string | null): string {
  if (!s) return "Draft";
  return s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function isFileLike(e: FileEvidence): boolean {
  if (e.evidenceType === "workbook") return false;
  if (e.sourceUrl) return true;
  return ["pdf", "google_doc", "google_sheet", "drive_file"].includes(
    e.resourceType ?? ""
  );
}

export default function ProjectFilesPage({
  params
}: {
  params: { id: string };
}) {
  const projectId = params.id;
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [items, setItems] = useState<FileEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [skippedDetails, setSkippedDetails] = useState<
    Array<{ name: string; reason: string }>
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projRes, evRes] = await Promise.all([
        fetch(`/api/projects/${encodeURIComponent(projectId)}`).then((r) =>
          r.json().catch(() => null)
        ),
        fetch(
          `/api/projects/${encodeURIComponent(projectId)}/sessions/0/evidence`
        ).then((r) => r.json().catch(() => null))
      ]);

      setProject(projRes?.project ?? null);

      const raw = Array.isArray(evRes?.evidenceItems)
        ? evRes.evidenceItems
        : Array.isArray(evRes?.evidence)
          ? evRes.evidence
          : Array.isArray(evRes?.items)
            ? evRes.items
            : [];
      setItems((raw as FileEvidence[]).filter(isFileLike));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load files"
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    setSyncMessage(null);
    setSyncError(null);
    setSkippedDetails([]);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/drive-folder/sync`,
        { method: "POST" }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error ?? "Sync failed");
      }
      const r = body?.result ?? body;
      setSyncMessage(
        `Added ${r?.added ?? 0} · updated ${r?.updated ?? 0} · skipped ${
          r?.skipped ?? 0
        }`
      );
      setSkippedDetails(
        Array.isArray(r?.skippedDetails) ? r.skippedDetails : []
      );
      await load();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <ProjectWorkspaceView projectId={projectId} activeTab="files">
      <div className="space-y-6">
        <PageHead
          eyebrow={
            <Link
              href={`/projects/${projectId}`}
              className="hover:text-text-1 transition-colors"
            >
              ← Project workspace
            </Link>
          }
          title="Files"
          lede="Everything added to this project — linked Drive folder, uploaded docs, and external links pulled into discovery."
          actions={
            <Btn
              variant="ghost"
              size="md"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw
                size={13}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </Btn>
          }
        />

        {error && <p className="text-[12px] text-status-danger">{error}</p>}

        {/* DRIVE FOLDER */}
        <section>
          <h2 className="text-[16px] font-semibold m-0 -tracking-[0.01em] mb-2">
            Drive folder
          </h2>
          {project?.googleDriveFolderId ? (
            <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-ink-4 bg-ink-2/40 px-4 py-2.5 text-[12px] text-text-2">
              <Pill tone="info" dot>
                Linked
              </Pill>
              {project.googleDriveFolderUrl && (
                <a
                  href={project.googleDriveFolderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-text-1 underline-offset-2 hover:underline"
                >
                  Open in Drive
                </a>
              )}
              <span className="text-text-3">
                Last sync:{" "}
                {project.googleDriveLastSyncedAt
                  ? new Date(project.googleDriveLastSyncedAt).toLocaleString()
                  : "never"}
              </span>
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => void handleSync()}
                disabled={syncing}
              >
                <RefreshCw
                  size={12}
                  className={syncing ? "animate-spin" : ""}
                />
                {syncing ? "Syncing…" : "Sync now"}
              </Btn>
              {syncMessage && (
                <span className="text-status-ok">{syncMessage}</span>
              )}
              {syncError && (
                <span className="text-status-danger">{syncError}</span>
              )}
            </div>
          ) : null}
          {skippedDetails.length > 0 && (
            <div className="mt-2 rounded-[12px] border border-ink-4 bg-ink-2/30 px-4 py-2.5 text-[12px]">
              <div className="text-text-3 mb-1">
                Skipped {skippedDetails.length} file
                {skippedDetails.length === 1 ? "" : "s"}:
              </div>
              <ul className="m-0 pl-4 space-y-0.5">
                {skippedDetails.map((d, i) => (
                  <li key={i} className="text-text-2">
                    <span className="font-medium">{d.name}</span>
                    <span className="text-text-3"> — {d.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!project?.googleDriveFolderId && (
            <Empty
              icon={<Folder size={20} />}
              title="No folder linked"
              sub="Link a Google Drive folder so its docs sync into this project automatically."
              action={
                <Link href={`/projects/${projectId}/edit`}>
                  <Btn variant="ghost" size="sm">
                    Link in Settings
                  </Btn>
                </Link>
              }
            />
          )}
        </section>

        {/* FILE LIST */}
        <section>
          <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
            <div>
              <h2 className="text-[16px] font-semibold m-0 -tracking-[0.01em]">
                Added files
              </h2>
              <p className="text-[12.5px] text-text-3 m-0 mt-0.5">
                PDFs, Google Docs, Miro boards, and links pulled into this
                project.
              </p>
            </div>
            <Link href={`/projects/${projectId}/discovery`}>
              <Btn variant="ghost" size="sm">
                Add in Discovery
              </Btn>
            </Link>
          </div>
          {loading ? (
            <SkeletonBlock height="h-32" />
          ) : items.length === 0 ? (
            <Empty
              icon={<FileText size={20} />}
              title="No files yet"
              sub="Sync a Drive folder or add a context source from Discovery."
            />
          ) : (
            <Panel>
              <PanelBody flush>
                {items.map((c, i) => (
                  <div
                    key={c.id}
                    className={`grid grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-3 items-center px-[18px] py-2.5 ${
                      i < items.length - 1 ? "border-b border-ink-4" : ""
                    }`}
                  >
                    {resourceIcon[c.resourceType ?? ""] ?? (
                      <FileText size={13} className="text-text-3" />
                    )}
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium truncate">
                        {c.sourceLabel}
                      </div>
                      <div className="text-[11px] text-text-3 mt-0.5 truncate">
                        {c.resourceType?.replace(/_/g, " ") ?? c.evidenceType}
                        {" · "}
                        {relTime(c.updatedAt)}
                      </div>
                    </div>
                    <Pill
                      tone={statusTone[c.status ?? "draft"] ?? "neutral"}
                      dot
                    >
                      {statusLabel(c.status)}
                    </Pill>
                    {c.sourceUrl ? (
                      <a href={c.sourceUrl} target="_blank" rel="noreferrer">
                        <Btn variant="ghost" size="sm">
                          {isUploadedFile(c) ? (
                            <>
                              <Upload size={11} />
                              Download
                            </>
                          ) : (
                            <ExternalLink size={11} />
                          )}
                        </Btn>
                      </a>
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
              </PanelBody>
            </Panel>
          )}
        </section>
      </div>
    </ProjectWorkspaceView>
  );
}
