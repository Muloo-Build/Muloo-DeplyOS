"use client";

import type { ReactNode } from "react";

export default function DiscoveryTab(props: {
  sessionsTracker: ReactNode;
  progressSummary: ReactNode;
  notesPreview: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-800/70 p-6">
        <h3 className="text-lg font-semibold text-white">Q&A sessions</h3>
        <div className="mt-4">{props.sessionsTracker}</div>
      </section>
      <section className="rounded-3xl border border-zinc-800 bg-zinc-800/70 p-6">
        <h3 className="text-lg font-semibold text-white">Discovery progress</h3>
        <div className="mt-4">{props.progressSummary}</div>
      </section>
      <section className="rounded-3xl border border-zinc-800 bg-zinc-800/70 p-6">
        <h3 className="text-lg font-semibold text-white">Prepare notes preview</h3>
        <div className="mt-4">{props.notesPreview}</div>
      </section>
    </div>
  );
}
