"use client";

import type { ReactNode } from "react";

export default function PlanTab(props: {
  blueprintPanel: ReactNode;
  scopePanel: ReactNode;
  workingDocPanel: ReactNode;
  workstreamsHoursPanel?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      {props.workstreamsHoursPanel ? (
        <section className="brand-surface rounded-[14px] border p-6">
          <h3 className="text-lg font-semibold text-white">
            Workstreams &amp; hours
          </h3>
          <div className="mt-4">{props.workstreamsHoursPanel}</div>
        </section>
      ) : null}
      <section className="brand-surface rounded-[14px] border p-6">
        <h3 className="text-lg font-semibold text-white">Blueprint</h3>
        <div className="mt-4">{props.blueprintPanel}</div>
      </section>
      <section className="brand-surface rounded-[14px] border p-6">
        <h3 className="text-lg font-semibold text-white">Scope and approval</h3>
        <div className="mt-4">{props.scopePanel}</div>
      </section>
      <section className="brand-surface rounded-[14px] border p-6">
        <h3 className="text-lg font-semibold text-white">Working docs</h3>
        <div className="mt-4">{props.workingDocPanel}</div>
      </section>
    </div>
  );
}
