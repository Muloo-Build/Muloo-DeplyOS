"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Slice 5: contributor token surface. The /contributors/[token] URL is
// the bearer credential — there is no portal sign-in here. The server
// resolves the token, enforces expiry/approval, and returns ONLY the
// workbooks/sections/questions assigned to this contributor.

interface WorkbookQuestion {
  id: string;
  questionText: string;
  helpText?: string | null;
  answerType?: string;
  options?: string[];
  isRequired?: boolean;
  response?: string | null;
  status?: string;
  assignedContributorIds?: string[];
  // Slice 5 (new plan): review feedback the operator/champion has
  // attached to this answer. Surfaced inline so the contributor sees
  // exactly what to fix without having to email back and forth.
  reviewerName?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
}

const REVIEW_BADGE: Record<string, { label: string; className: string }> = {
  approved: {
    label: "Approved",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
  },
  needs_clarification: {
    label: "Please clarify",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300"
  },
  rejected: {
    label: "Please redo",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-300"
  }
};

interface WorkbookSection {
  id: string;
  title: string;
  description?: string | null;
  questions: WorkbookQuestion[];
}

interface Workbook {
  id: string;
  title: string;
  status: string;
  workbookContent: { version: number; sections: WorkbookSection[] };
}

interface Workspace {
  contributor: {
    id: string;
    role: string;
    organisation: string | null;
    notes: string | null;
    accessTokenExpiresAt: string | null;
    contact: {
      firstName: string;
      lastName: string;
      email: string;
      title: string;
    };
  };
  project: { id: string; name: string };
  workbooks: Workbook[];
}

export default function ContributorWorkbookClient({
  token
}: {
  token: string;
}) {
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState<{
    message: string;
    kind: "expired" | "invalid" | "pending" | "generic";
  } | null>(null);
  const [activeWorkbookId, setActiveWorkbookId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/contributors/access/${encodeURIComponent(token)}`,
        { credentials: "omit" }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.error) {
        const message = body.error ?? `Request failed (${res.status})`;
        // The server returns 401 with one of three specific messages
        // when the token resolution itself fails — surface a tailored
        // hint for each so the contributor knows whether to ask for a
        // new link, wait for approval, or report a typo.
        let kind: "expired" | "invalid" | "pending" | "generic" = "generic";
        if (res.status === 401) {
          if (message === "This access link has expired") kind = "expired";
          else if (message === "This access link is not yet approved")
            kind = "pending";
          else kind = "invalid";
        }
        setError({ message, kind });
        return;
      }
      setData(body as Workspace);
      setError(null);
      if (!activeWorkbookId && body.workbooks?.length === 1) {
        setActiveWorkbookId(body.workbooks[0].id);
      }
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : "Failed",
        kind: "generic"
      });
    }
  }, [token, activeWorkbookId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    const heading =
      error.kind === "expired"
        ? "This link has expired"
        : error.kind === "pending"
          ? "This link isn't ready yet"
          : error.kind === "invalid"
            ? "We couldn't find this link"
            : "We couldn't open this link";
    const hint =
      error.kind === "expired"
        ? "Ask the person who shared this link to regenerate it for you, then open the new link."
        : error.kind === "pending"
          ? "The delivery team still needs to approve your access. Try again later or contact them if it's urgent."
          : error.kind === "invalid"
            ? "Double-check that you copied the full link. If it still doesn't work, ask the sender to send a fresh one."
            : "If you were expecting to fill something in today, please contact the person who shared this link with you.";
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-12">
        <div className="brand-surface w-full rounded-3xl border border-rose-500/30 bg-rose-500/5 p-8 text-center">
          <h1 className="text-xl font-semibold text-white">{heading}</h1>
          <p className="mt-2 text-sm text-rose-200">{error.message}</p>
          <p className="mt-6 text-xs text-text-secondary">{hint}</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6 py-12">
        <p className="text-sm text-text-secondary">Loading your workbook…</p>
      </main>
    );
  }

  const active = data.workbooks.find((w) => w.id === activeWorkbookId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6 space-y-1">
        <p className="text-[11px] uppercase tracking-wide text-text-secondary">
          {data.project.name}
        </p>
        <h1 className="text-2xl font-semibold text-white">
          Hi {data.contributor.contact.firstName} — here&apos;s what we need
          your help with
        </h1>
        <p className="text-sm text-text-secondary">
          You&apos;re only seeing the questions that have been assigned to
          you. Your answers save when you click <em>Save</em> on each
          workbook.
          {data.contributor.accessTokenExpiresAt
            ? ` This link expires ${new Date(data.contributor.accessTokenExpiresAt).toLocaleDateString()}.`
            : ""}
        </p>
      </header>

      {data.workbooks.length === 0 ? (
        <div className="brand-surface rounded-2xl border border-dashed border-white/10 p-6 text-center">
          <p className="text-sm font-medium text-white">
            Nothing to fill in right now
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            The delivery team hasn&apos;t assigned you any workbook
            questions yet. You can come back to this link later.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[200px,1fr]">
          <nav className="space-y-1">
            {data.workbooks.map((wb) => (
              <button
                type="button"
                key={wb.id}
                onClick={() => setActiveWorkbookId(wb.id)}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                  wb.id === activeWorkbookId
                    ? "border border-brand-teal/40 bg-brand-teal/10 text-white"
                    : "border border-transparent text-text-secondary hover:border-white/10 hover:text-white"
                }`}
              >
                <p className="font-medium">{wb.title}</p>
                <p className="text-[10px] uppercase tracking-wide text-text-secondary">
                  {wb.status}
                </p>
              </button>
            ))}
          </nav>
          <div>
            {active ? (
              <WorkbookView token={token} workbook={active} onSaved={load} />
            ) : (
              <p className="text-sm text-text-secondary">
                Select a workbook on the left to start.
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function WorkbookView({
  token,
  workbook,
  onSaved
}: {
  token: string;
  workbook: Workbook;
  onSaved: () => Promise<void> | void;
}) {
  // Local draft state — keyed by `${sectionId}::${questionId}`.
  // Initialized from server-provided responses so the contributor
  // sees their previous answers when they reopen the link.
  const initial = useMemo(() => {
    const map: Record<string, string> = {};
    for (const section of workbook.workbookContent.sections) {
      for (const question of section.questions) {
        map[`${section.id}::${question.id}`] =
          typeof question.response === "string" ? question.response : "";
      }
    }
    return map;
  }, [workbook]);

  const [drafts, setDrafts] = useState<Record<string, string>>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    setDrafts(initial);
  }, [initial]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const responses: Array<{
        sectionId: string;
        questionId: string;
        response: string;
      }> = [];
      for (const section of workbook.workbookContent.sections) {
        for (const question of section.questions) {
          const key = `${section.id}::${question.id}`;
          const value = drafts[key] ?? "";
          if (value !== (question.response ?? "")) {
            responses.push({
              sectionId: section.id,
              questionId: question.id,
              response: value
            });
          }
        }
      }
      if (responses.length === 0) {
        setSavedAt(new Date());
        return;
      }
      const res = await fetch(
        `/api/contributors/access/${encodeURIComponent(token)}/workbooks/${encodeURIComponent(workbook.id)}/responses`,
        {
          method: "PATCH",
          credentials: "omit",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responses })
        }
      );
      const body = await res.json();
      if (!res.ok || body.error) throw new Error(body.error ?? "Failed");
      setSavedAt(new Date());
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="brand-surface space-y-4 rounded-2xl border border-white/10 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {workbook.title}
          </h2>
          <p className="text-xs text-text-secondary">
            Status: {workbook.status}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {savedAt ? (
            <span className="text-[11px] text-emerald-300">
              Saved {savedAt.toLocaleTimeString()}
            </span>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="brand-primary rounded-full px-4 py-1.5 text-sm disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      {error ? (
        <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-2 text-xs text-rose-200">
          {error}
        </p>
      ) : null}

      {workbook.workbookContent.sections.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No questions assigned to you in this workbook yet.
        </p>
      ) : (
        workbook.workbookContent.sections.map((section) => (
          <section
            key={section.id}
            className="space-y-2 border-t border-white/5 pt-3 first:border-t-0 first:pt-0"
          >
            <div>
              <h3 className="text-sm font-semibold text-white">
                {section.title}
              </h3>
              {section.description ? (
                <p className="text-xs text-text-secondary">
                  {section.description}
                </p>
              ) : null}
            </div>
            <div className="space-y-3">
              {section.questions.map((question) => {
                const key = `${section.id}::${question.id}`;
                const status = question.status ?? "";
                const badge = REVIEW_BADGE[status] ?? null;
                return (
                  <div key={question.id} className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="block text-xs font-medium text-white">
                        {question.questionText}
                        {question.isRequired ? (
                          <span className="ml-1 text-rose-300">*</span>
                        ) : null}
                      </label>
                      {badge ? (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      ) : null}
                    </div>
                    {question.helpText ? (
                      <p className="text-[11px] text-text-secondary">
                        {question.helpText}
                      </p>
                    ) : null}
                    {/* Slice 5 (new plan): show reviewer notes inline
                        so the contributor knows exactly what to revise. */}
                    {question.reviewNotes &&
                    (status === "needs_clarification" || status === "rejected") ? (
                      <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100">
                        <span className="font-semibold">Reviewer note:</span>{" "}
                        {question.reviewNotes}
                      </p>
                    ) : null}
                    <textarea
                      value={drafts[key] ?? ""}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [key]: e.target.value
                        }))
                      }
                      rows={3}
                      placeholder="Type your answer…"
                      className="brand-input w-full rounded-lg border px-3 py-2 text-sm"
                    />
                    {status === "approved" && question.reviewedAt ? (
                      <p className="text-[10px] text-emerald-300/80">
                        Approved
                        {question.reviewerName
                          ? ` by ${question.reviewerName}`
                          : ""}{" "}
                        on {question.reviewedAt.slice(0, 10)} — no further
                        action needed.
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
