"use client";

import { useEffect, useState } from "react";

type HandoverSection = {
  key: string;
  title: string;
  body?: string;
  bullets?: string[];
};

type HandoverDoc = {
  id: string;
  projectId: string;
  content: { title?: string; sections?: HandoverSection[] } | null;
  generatedAt: string;
  sharedToPortalAt: string | null;
  updatedAt: string;
};

export default function ClientPortalHandoverCard({
  projectId
}: {
  projectId: string;
}) {
  const [doc, setDoc] = useState<HandoverDoc | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/client/projects/${encodeURIComponent(projectId)}/handover`,
          { credentials: "include" }
        );
        const body = await res.json().catch(() => null);
        if (!cancelled && res.ok) {
          setDoc(body?.doc ?? null);
        }
      } catch {
        // best-effort; silent
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!loaded || !doc || !doc.sharedToPortalAt) return null;
  const sections = doc.content?.sections ?? [];

  return (
    <div className="rounded-2xl border border-[rgba(81,208,176,0.4)] bg-[rgba(81,208,176,0.08)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#7be2ef]">
            Project handover
          </p>
          <p className="mt-1 text-lg font-semibold text-white">
            {doc.content?.title ?? "Project Handover"}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Shared {new Date(doc.sharedToPortalAt).toLocaleDateString()}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
        >
          {expanded ? "Hide" : "View"}
        </button>
      </div>
      {expanded ? (
        <div className="mt-4 space-y-4">
          {sections.map((section) => (
            <div key={section.key}>
              <p className="text-sm font-semibold text-white">
                {section.title}
              </p>
              {section.body ? (
                <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">
                  {section.body}
                </p>
              ) : null}
              {section.bullets && section.bullets.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
                  {section.bullets.map((b, idx) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
          {sections.length === 0 ? (
            <p className="text-sm text-text-secondary">
              Handover content is empty.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
