"use client";

import type { ReactNode } from "react";

function SidebarSection(props: { label: string; children: ReactNode }) {
  return (
    <section>
      <p className="mb-1 text-xs uppercase tracking-wider text-text-muted">
        {props.label}
      </p>
      <div className="text-sm text-text-secondary">{props.children}</div>
    </section>
  );
}

export default function ProjectContextSidebar(props: {
  clientName: string;
  clientContactEmail?: string | null;
  portalUrl?: string | null;
  hubTier?: string | null;
  connectionReady: boolean;
  contactsCount?: number | null;
  dealsCount?: number | null;
  propertiesCount?: number | null;
  customObjectsCount?: number | null;
  ownerName: string;
  ownerEmail: string;
  hubsInScope: string[];
  platformName?: string | null;
  platformDescription?: string | null;
  quickWins: {
    total: number;
    open: number;
    resolved: number;
  };
  onRefreshSnapshot: () => void;
  refreshingSnapshot?: boolean;
}) {
  return (
    <aside className="brand-surface sticky top-0 max-h-screen space-y-4 overflow-y-auto rounded-3xl border p-4">
      <SidebarSection label="CLIENT">
        <p className="font-medium text-white">{props.clientName}</p>
        <p className="mt-1 text-text-secondary">
          {props.clientContactEmail ?? "No contact email linked"}
        </p>
      </SidebarSection>

      <SidebarSection label="PORTAL">
        <p className="font-medium text-white">
          {props.portalUrl ? (
            <a href={props.portalUrl} target="_blank" rel="noreferrer" className="hover:text-white">
              {props.portalUrl}
            </a>
          ) : (
            "No portal linked"
          )}
        </p>
        <p className="mt-1 flex items-center gap-2 text-text-secondary">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              props.connectionReady ? "bg-brand-teal" : "bg-status-error"
            }`}
          />
          {props.connectionReady ? "Connected" : "Disconnected"}
          {props.hubTier ? ` · ${props.hubTier}` : ""}
        </p>
      </SidebarSection>

      <SidebarSection label="SNAPSHOT">
        <div className="grid gap-2 text-text-secondary">
          <p>Contacts: {props.contactsCount ?? "—"}</p>
          <p>Deals: {props.dealsCount ?? "—"}</p>
          <p>Properties: {props.propertiesCount ?? "—"}</p>
          <p>Custom objects: {props.customObjectsCount ?? "—"}</p>
        </div>
      </SidebarSection>

      <SidebarSection label="OWNER">
        <p className="font-medium text-white">{props.ownerName}</p>
        <p className="mt-1 text-text-secondary">{props.ownerEmail}</p>
      </SidebarSection>

      <SidebarSection label="HUBS IN SCOPE">
        <div className="flex flex-wrap gap-2">
          {props.hubsInScope.length > 0 ? (
            props.hubsInScope.map((hub) => (
              <span
                key={hub}
                className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-xs uppercase tracking-[0.18em] text-white"
              >
                {hub}
              </span>
            ))
          ) : (
            <p className="text-text-secondary">No hubs selected</p>
          )}
        </div>
      </SidebarSection>

      <SidebarSection label="PLATFORM">
        <p className="font-medium text-white">
          {props.platformName ?? "No platform selected"}
        </p>
        {props.platformDescription ? (
          <p className="mt-1 text-text-secondary">{props.platformDescription}</p>
        ) : null}
      </SidebarSection>

      <SidebarSection label="QUICK WINS">
        <p className="text-text-secondary">
          {props.quickWins.total} total · {props.quickWins.open} open ·{" "}
          {props.quickWins.resolved} resolved
        </p>
      </SidebarSection>

      <button
        type="button"
        onClick={props.onRefreshSnapshot}
        disabled={props.refreshingSnapshot}
        className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm font-medium text-white transition hover:border-[rgba(0,196,204,0.45)] disabled:cursor-not-allowed disabled:text-text-muted"
      >
        {props.refreshingSnapshot ? "Refreshing..." : "Refresh Snapshot"}
      </button>
    </aside>
  );
}
