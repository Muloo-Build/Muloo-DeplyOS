"use client";

import type { ReactNode } from "react";

function OverviewCard(props: { title: string; children: ReactNode }) {
  return (
    <section className="brand-surface rounded-3xl border p-6">
      <h3 className="text-lg font-semibold text-white">{props.title}</h3>
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

export default function OverviewTab(props: {
  statusCard: ReactNode;
  inputsSummary: ReactNode;
  blueprintStatus: ReactNode;
  agentSummary: ReactNode;
  quickWins: ReactNode;
  clientAccess: ReactNode;
  partnerAccess: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <OverviewCard title="Client access">{props.clientAccess}</OverviewCard>
        <OverviewCard title="Partner access">{props.partnerAccess}</OverviewCard>
      </div>
      <OverviewCard title="Project status">{props.statusCard}</OverviewCard>
      <div className="grid gap-6 xl:grid-cols-2">
        <OverviewCard title="Human inputs">{props.inputsSummary}</OverviewCard>
        <OverviewCard title="Blueprint status">{props.blueprintStatus}</OverviewCard>
      </div>
      <OverviewCard title="Agent summary">{props.agentSummary}</OverviewCard>
      <OverviewCard title="Quick wins">{props.quickWins}</OverviewCard>
    </div>
  );
}
