"use client";

import { useEffect, useState } from "react";

type HandoverItem = { label: string; value: string; url?: string | null };
type HandoverSection = {
  key: string;
  title: string;
  body: string;
  items?: HandoverItem[];
};
type HandoverContent = {
  generatedAt: string;
  sections: HandoverSection[];
  trainingLinks: Array<{ label: string; url: string }>;
};
type HandoverDoc = {
  id: string;
  projectId: string;
  content: HandoverContent;
  generatedAt: string;
  sharedToPortalAt: string | null;
};

export default function HandoverPanel({ projectId }: { projectId: string }) {
  const [doc, setDoc] = useState<HandoverDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"regen" | "share" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/handover`
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Failed to load handover");
      setDoc(body?.doc ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load handover");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function regenerate() {
    setBusy("regen");
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/handover`,
        { method: "POST" }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Failed to regenerate");
      setDoc(body?.doc ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate");
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    setBusy("share");
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/handover/share`,
        { method: "POST" }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Failed to share");
      setDoc(body?.doc ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to share");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-text-2">Loading handover…</p>;
  }
  if (error) {
    return (
      <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
        {error}
      </div>
    );
  }
  if (!doc) {
    return <p className="text-sm text-text-2">No handover doc.</p>;
  }

  const content = doc.content;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-text-2">
          Generated {new Date(doc.generatedAt).toLocaleString()}
          {doc.sharedToPortalAt ? (
            <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
              Shared to portal {new Date(doc.sharedToPortalAt).toLocaleDateString()}
            </span>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={regenerate}
            disabled={busy !== null}
            className="rounded-lg border border-ink-4 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            {busy === "regen" ? "Regenerating…" : "Regenerate"}
          </button>
          <button
            type="button"
            onClick={share}
            disabled={busy !== null}
            className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {busy === "share"
              ? "Sharing…"
              : doc.sharedToPortalAt
                ? "Re-share to portal"
                : "Share to portal"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {(content?.sections ?? []).map((section) => (
          <details
            key={section.key}
            className="rounded-xl border border-ink-4 bg-ink-2 px-3 py-2"
            open
          >
            <summary className="cursor-pointer text-sm font-semibold text-white">
              {section.title}
            </summary>
            {section.body ? (
              <p className="mt-2 whitespace-pre-line text-xs text-text-2">
                {section.body}
              </p>
            ) : null}
            {section.items && section.items.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {section.items.map((item, idx) => (
                  <li
                    key={`${section.key}-${idx}`}
                    className="rounded-lg bg-white/5 px-2 py-1.5 text-xs"
                  >
                    <div className="font-medium text-white">{item.label}</div>
                    <div className="mt-0.5 whitespace-pre-line text-text-2">
                      {item.value}
                    </div>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-[11px] text-[#51d0b0] hover:underline"
                      >
                        Open link →
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </details>
        ))}
      </div>
    </div>
  );
}
