"use client";

import type { ReactNode } from "react";

export default function CommsTab(props: {
  emailComposer: ReactNode;
  agendaBuilder: ReactNode;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="brand-surface rounded-3xl border p-6">
        <h3 className="text-lg font-semibold text-white">Email composer</h3>
        <div className="mt-4">{props.emailComposer}</div>
      </section>
      <section className="brand-surface rounded-3xl border p-6">
        <h3 className="text-lg font-semibold text-white">Agenda builder</h3>
        <div className="mt-4">{props.agendaBuilder}</div>
      </section>
    </div>
  );
}
