"use client";

import type { ReactNode } from "react";

export default function PortalTab(props: {
  userManagement: ReactNode;
  partnerManagement: ReactNode;
  portalActions: ReactNode;
  handover?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <section className="brand-surface rounded-3xl border p-6">
        <h3 className="text-lg font-semibold text-white">Client portal users</h3>
        <div className="mt-4">{props.userManagement}</div>
      </section>
      <section className="brand-surface rounded-3xl border p-6">
        <h3 className="text-lg font-semibold text-white">Partner portal users</h3>
        <div className="mt-4">{props.partnerManagement}</div>
      </section>
      <section className="brand-surface rounded-3xl border p-6">
        <h3 className="text-lg font-semibold text-white">Portal Ops</h3>
        <div className="mt-4">{props.portalActions}</div>
      </section>
      {props.handover ? (
        <section className="brand-surface rounded-3xl border p-6">
          <h3 className="text-lg font-semibold text-white">Handover</h3>
          <p className="mt-1 text-xs text-text-secondary">
            Structured handover doc auto-generated from scope, blueprint,
            decisions log, and workbook outputs. Share to portal when ready.
          </p>
          <div className="mt-4">{props.handover}</div>
        </section>
      ) : null}
    </div>
  );
}
