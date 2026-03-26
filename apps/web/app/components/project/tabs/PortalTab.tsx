"use client";

import type { ReactNode } from "react";

export default function PortalTab(props: {
  userManagement: ReactNode;
  portalActions: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <section className="brand-surface rounded-3xl border p-6">
        <h3 className="text-lg font-semibold text-white">Client portal users</h3>
        <div className="mt-4">{props.userManagement}</div>
      </section>
      <section className="brand-surface rounded-3xl border p-6">
        <h3 className="text-lg font-semibold text-white">Portal Ops</h3>
        <div className="mt-4">{props.portalActions}</div>
      </section>
    </div>
  );
}
