"use client";

import type { ReactNode } from "react";

export default function DeliveryTab(props: {
  taskSummary: ReactNode;
  changeManagement: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <section className="brand-surface rounded-3xl border p-6">
        <h3 className="text-lg font-semibold text-white">Delivery board</h3>
        <div className="mt-4">{props.taskSummary}</div>
      </section>
      <section className="brand-surface rounded-3xl border p-6">
        <h3 className="text-lg font-semibold text-white">Change management</h3>
        <div className="mt-4">{props.changeManagement}</div>
      </section>
    </div>
  );
}
