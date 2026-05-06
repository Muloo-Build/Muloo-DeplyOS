"use client";

import { useCallback, useEffect, useState } from "react";

interface PublicSubmission {
  id: string;
  workbookId: string;
  projectId: string;
  firstName: string;
  lastName: string;
  email: string;
  organisation: string | null;
  responses: Array<{
    sectionId: string;
    questionId: string;
    questionText: string;
    response: string | string[] | null;
  }>;
  status: string;
  reviewerNotes: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending_review: {
    label: "Pending review",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300"
  },
  approved: {
    label: "Approved",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
  },
  archived: {
    label: "Archived",
    className: "border-ink-4 bg-white/5 text-text-2"
  }
};

export default function WorkbookPublicSharePanel(props: {
  projectId: string;
  workbookId: string;
  publicShareToken: string | null;
  publicShareEnabled: boolean;
  publicShareExpiresAt: string | null;
  onUpdated: () => void;
  onSessionExpired: (res: Response) => boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [expiresDraft, setExpiresDraft] = useState<string>(() =>
    props.publicShareExpiresAt
      ? props.publicShareExpiresAt.slice(0, 16)
      : ""
  );
  const [submissions, setSubmissions] = useState<PublicSubmission[] | null>(
    null
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    setExpiresDraft(
      props.publicShareExpiresAt ? props.publicShareExpiresAt.slice(0, 16) : ""
    );
  }, [props.publicShareExpiresAt]);

  const shareUrl =
    props.publicShareToken && typeof window !== "undefined"
      ? `${window.location.origin}/w/${props.publicShareToken}`
      : null;

  const loadSubmissions = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/projects/${props.projectId}/workbooks/${props.workbookId}/public-submissions`,
        { credentials: "include" }
      );
      if (props.onSessionExpired(res)) return;
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to load submissions");
      }
      setSubmissions((data.submissions ?? []) as PublicSubmission[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load submissions");
    }
  }, [props]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  async function patchShare(payload: {
    enabled?: boolean;
    expiresAt?: string | null;
    regenerate?: boolean;
  }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${props.projectId}/workbooks/${props.workbookId}/public-share`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      if (props.onSessionExpired(res)) return;
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to update share link");
      }
      props.onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyShareLink() {
    if (!shareUrl) return;
    setCopyHint(null);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setCopyHint("Copied!");
        return;
      }
      throw new Error("clipboard unavailable");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = shareUrl;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (ok) {
          setCopyHint("Copied!");
          return;
        }
        throw new Error("execCommand copy failed");
      } catch {
        const isMac =
          typeof navigator !== "undefined" &&
          /Mac|iPhone|iPod|iPad/.test(navigator.platform);
        setCopyHint(
          `Couldn't copy automatically — select the link and press ${
            isMac ? "⌘C" : "Ctrl+C"
          }.`
        );
      }
    }
  }

  async function patchSubmission(
    sub: PublicSubmission,
    payload: { status?: string; reviewerNotes?: string | null }
  ) {
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${props.projectId}/workbooks/${props.workbookId}/public-submissions/${sub.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      if (props.onSessionExpired(res)) return;
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to update submission");
      }
      await loadSubmissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  const pendingCount = (submissions ?? []).filter(
    (s) => s.status === "pending_review"
  ).length;

  return (
    <div className="mt-3 rounded-lg border border-ink-4 bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-white">Public share link</p>
          <p className="mt-0.5 text-[11px] text-text-2">
            Anyone with the link can fill in their name, email and answers.
            Submissions land here for review.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[11px]">
          <input
            type="checkbox"
            disabled={busy}
            checked={props.publicShareEnabled}
            onChange={(e) => patchShare({ enabled: e.target.checked })}
            className="accent-brand-teal"
          />
          <span className="text-text-2">
            {props.publicShareEnabled ? "Enabled" : "Disabled"}
          </span>
        </label>
      </div>

      {props.publicShareEnabled && shareUrl ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-ink-4 bg-bg-primary px-2 py-1 text-[11px] text-text-primary"
            />
            <button
              type="button"
              onClick={copyShareLink}
              className="rounded-md border border-ink-4 px-2 py-1 text-[11px] text-text-primary hover:border-brand-teal/40 hover:text-brand-teal"
            >
              Copy
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    "Regenerate the link? The old URL will stop working immediately."
                  )
                ) {
                  void patchShare({ regenerate: true });
                }
              }}
              className="rounded-md border border-ink-4 px-2 py-1 text-[11px] text-text-2 hover:border-rose-500/40 hover:text-rose-300"
            >
              Regenerate
            </button>
          </div>
          {copyHint ? (
            <p className="text-[11px] text-text-2">{copyHint}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px] text-text-2">Expires:</label>
            <input
              type="datetime-local"
              value={expiresDraft}
              onChange={(e) => setExpiresDraft(e.target.value)}
              className="rounded-md border border-ink-4 bg-bg-primary px-2 py-1 text-[11px] text-text-primary"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                patchShare({
                  expiresAt: expiresDraft
                    ? new Date(expiresDraft).toISOString()
                    : null
                })
              }
              className="rounded-md border border-ink-4 px-2 py-1 text-[11px] text-text-primary hover:border-brand-teal/40 hover:text-brand-teal"
            >
              Save
            </button>
            {props.publicShareExpiresAt ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setExpiresDraft("");
                  void patchShare({ expiresAt: null });
                }}
                className="rounded-md border border-ink-4 px-2 py-1 text-[11px] text-text-2 hover:text-white"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-[11px] text-rose-300">{error}</p>
      ) : null}

      <div className="mt-4 border-t border-white/5 pt-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-white">
            Submissions
            {pendingCount > 0 ? (
              <span className="ml-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
                {pendingCount} pending
              </span>
            ) : null}
          </p>
        </div>
        {submissions === null ? (
          <p className="mt-2 text-[11px] text-text-2">Loading…</p>
        ) : submissions.length === 0 ? (
          <p className="mt-2 text-[11px] text-text-2">
            No submissions yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {submissions.map((sub) => {
              const isOpen = openId === sub.id;
              const badge = STATUS_LABEL[sub.status] ?? STATUS_LABEL.pending_review;
              return (
                <li
                  key={sub.id}
                  className="rounded-md border border-ink-4 bg-white/[0.02] p-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-white">
                        {sub.firstName} {sub.lastName}{" "}
                        <span className="text-text-2">
                          · {sub.email}
                        </span>
                      </p>
                      <p className="text-[10px] text-text-2">
                        {sub.organisation ? `${sub.organisation} · ` : ""}
                        {new Date(sub.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpenId(isOpen ? null : sub.id)}
                        className="text-[11px] text-brand-teal hover:underline"
                      >
                        {isOpen ? "Close" : "View"}
                      </button>
                    </div>
                  </div>
                  {isOpen ? (
                    <div className="mt-2 space-y-2 border-t border-white/5 pt-2">
                      <ul className="space-y-2">
                        {sub.responses.map((r) => (
                          <li key={r.questionId} className="text-[11px]">
                            <p className="text-text-2">
                              {r.questionText}
                            </p>
                            <p className="mt-0.5 whitespace-pre-wrap text-white">
                              {Array.isArray(r.response)
                                ? r.response.join(", ")
                                : (r.response ?? "—")}
                            </p>
                          </li>
                        ))}
                      </ul>
                      <textarea
                        rows={2}
                        placeholder="Reviewer notes (optional)"
                        value={
                          notesDraft[sub.id] ?? sub.reviewerNotes ?? ""
                        }
                        onChange={(e) =>
                          setNotesDraft((d) => ({
                            ...d,
                            [sub.id]: e.target.value
                          }))
                        }
                        className="w-full rounded-md border border-ink-4 bg-bg-primary px-2 py-1 text-[11px] text-text-primary"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            patchSubmission(sub, {
                              status: "approved",
                              reviewerNotes:
                                notesDraft[sub.id] ?? sub.reviewerNotes
                            })
                          }
                          className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/20"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            patchSubmission(sub, {
                              status: "archived",
                              reviewerNotes:
                                notesDraft[sub.id] ?? sub.reviewerNotes
                            })
                          }
                          className="rounded-md border border-ink-4 px-2 py-1 text-[11px] text-text-2 hover:text-white"
                        >
                          Archive
                        </button>
                        {sub.status !== "pending_review" ? (
                          <button
                            type="button"
                            onClick={() =>
                              patchSubmission(sub, {
                                status: "pending_review",
                                reviewerNotes:
                                  notesDraft[sub.id] ?? sub.reviewerNotes
                              })
                            }
                            className="rounded-md border border-ink-4 px-2 py-1 text-[11px] text-text-2 hover:text-white"
                          >
                            Reset to pending
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
