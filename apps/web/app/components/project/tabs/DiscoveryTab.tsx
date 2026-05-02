"use client";

import type { ReactNode } from "react";

export default function DiscoveryTab(props: {
  sessionsTracker: ReactNode;
  progressSummary: ReactNode;
  notesPreview: ReactNode;
  workbooksPanel?: ReactNode;
  onOpenAccessSharing: () => void;
}) {
  return (
    <div className="space-y-6">
      <section className="brand-surface-soft rounded-2xl border border-white/10 p-4">
        <p className="text-xs leading-relaxed text-text-secondary">
          Discovery is for sessions, workbooks and notes that scope this
          engagement. Contributors, HubSpot, Miro boards and shared resources
          have moved to{" "}
          <button
            type="button"
            onClick={props.onOpenAccessSharing}
            className="font-medium text-brand-teal hover:underline"
          >
            Access &amp; Sharing
          </button>
          . Reusable workbook templates and the global question library are
          managed under{" "}
          <a
            href="/workbooks"
            className="font-medium text-brand-teal hover:underline"
          >
            Operations → Workbooks
          </a>{" "}
          and{" "}
          <a
            href="/question-library"
            className="font-medium text-brand-teal hover:underline"
          >
            Operations → Question library
          </a>
          .
        </p>
      </section>
      <section className="brand-surface rounded-3xl border p-6">
        <h3 className="text-lg font-semibold text-white">Q&A sessions</h3>
        <div className="mt-4">{props.sessionsTracker}</div>
      </section>
      {props.workbooksPanel ? (
        <section className="brand-surface rounded-3xl border p-6">
          <h3 className="text-lg font-semibold text-white">
            Discovery workbooks
          </h3>
          <div className="mt-4">{props.workbooksPanel}</div>
        </section>
      ) : null}
      <section className="brand-surface rounded-3xl border p-6">
        <h3 className="text-lg font-semibold text-white">Discovery progress</h3>
        <div className="mt-4">{props.progressSummary}</div>
      </section>
      <section className="brand-surface rounded-3xl border p-6">
        <h3 className="text-lg font-semibold text-white">Prepare notes preview</h3>
        <div className="mt-4">{props.notesPreview}</div>
      </section>
    </div>
  );
}
