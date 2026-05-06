"use client";

import { useState } from "react";
import { Sparkles, Copy } from "lucide-react";

type Intent = "summary" | "today" | "risks";

const INTENT_LABEL: Record<Intent, string> = {
  summary: "Where this stands",
  today: "What to do today",
  risks: "What's at risk"
};

export default function ProjectCopilotPanel({ projectId }: { projectId: string }) {
  const [intent, setIntent] = useState<Intent>("summary");
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [draftLoading, setDraftLoading] = useState(false);

  async function ask(next: Intent) {
    setIntent(next);
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/copilot?intent=${next}`,
        { credentials: "include" }
      );
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error ?? "Failed");
      setText(body.text ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function genDraft() {
    setDraftLoading(true);
    try {
      const r = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/weekly-status`,
        { credentials: "include" }
      );
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error ?? "Failed");
      setDraft(body.draft ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setDraftLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-300" />
          <p className="text-sm font-semibold text-white">Project copilot</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(INTENT_LABEL) as Intent[]).map((i) => (
            <button
              key={i}
              onClick={() => void ask(i)}
              className={`rounded-md border px-2.5 py-1 text-xs ${
                intent === i && text
                  ? "border-amber-400/40 bg-amber-400/10 text-amber-100"
                  : "border-ink-4 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              {INTENT_LABEL[i]}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="text-xs text-status-error">{error}</p> : null}

      <div className="rounded-[14px] border border-ink-4 bg-ink-2 p-4">
        {loading ? (
          <p className="text-xs text-text-2">Thinking…</p>
        ) : text ? (
          <pre className="whitespace-pre-wrap text-sm text-white">{text}</pre>
        ) : (
          <p className="text-xs text-text-2">
            Pick a question above to ask the copilot about this project.
          </p>
        )}
      </div>

      <div className="rounded-[14px] border border-ink-4 bg-ink-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-white">Weekly client status — draft</p>
          <div className="flex items-center gap-2">
            {draft ? (
              <button
                onClick={() => void navigator.clipboard?.writeText(draft).catch(() => {})}
                className="inline-flex items-center gap-1 rounded-md border border-ink-4 bg-white/5 px-2 py-1 text-xs text-white hover:bg-white/10"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            ) : null}
            <button
              onClick={() => void genDraft()}
              disabled={draftLoading}
              className="rounded-md bg-status-warning/90 px-3 py-1 text-xs font-semibold text-background-card hover:bg-status-warning disabled:opacity-60"
            >
              {draftLoading ? "Drafting…" : draft ? "Regenerate" : "Draft now"}
            </button>
          </div>
        </div>
        {draft ? (
          <pre className="mt-3 whitespace-pre-wrap text-sm text-white">{draft}</pre>
        ) : (
          <p className="mt-2 text-xs text-text-2">
            Draft a clean weekly client update from the live project state.
          </p>
        )}
      </div>
    </div>
  );
}
