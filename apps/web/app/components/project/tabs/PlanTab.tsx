"use client";

import type { ReactNode } from "react";

export default function PlanTab(props: {
  blueprintPanel: ReactNode;
  scopePanel: ReactNode;
  workingDocPanel: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <section className="brand-surface rounded-3xl border p-6">
        <h3 className="text-lg font-semibold text-white">Blueprint</h3>
        <div className="mt-4">{props.blueprintPanel}</div>
      </section>
      <section className="brand-surface rounded-3xl border p-6">
        <h3 className="text-lg font-semibold text-white">Scope and approval</h3>
        <div className="mt-4">{props.scopePanel}</div>
      </section>
      <section className="brand-surface rounded-3xl border p-6">
        <h3 className="text-lg font-semibold text-white">Working docs</h3>
        <div className="mt-4">{props.workingDocPanel}</div>
      </section>
    </div>
  );
}
