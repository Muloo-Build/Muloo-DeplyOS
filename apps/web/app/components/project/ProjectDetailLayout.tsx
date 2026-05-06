"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type ProjectDetailTabKey =
  | "overview"
  | "meetings"
  | "access"
  | "discovery"
  | "plan"
  | "delivery"
  | "change"
  | "comms"
  | "portal";

// Visible tabs in lifecycle order. Meetings is absorbed into Comms (kept as a
// programmatic key so existing CTAs that set activeTab="meetings" still work).
const tabs: Array<{ key: ProjectDetailTabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "discovery", label: "Discovery" },
  { key: "plan", label: "Plan" },
  { key: "delivery", label: "Delivery" },
  { key: "change", label: "Change" },
  { key: "comms", label: "Comms" },
  { key: "portal", label: "Portal" },
  { key: "access", label: "Settings" }
];

const tabHelperText: Record<ProjectDetailTabKey, string> = {
  overview:
    "Snapshot of this project: status, owners, and the next best action.",
  meetings:
    "Meeting notes and follow-ups. Add latest meetings here to capture decisions, risks, and tasks.",
  access:
    "Project settings: who has access, contributors, HubSpot, Miro and shared resources.",
  discovery:
    "Workbooks and discovery evidence used to scope this engagement.",
  plan: "Workstreams and the delivery plan for this project.",
  delivery:
    "Live delivery view: tasks, hours, and progress against the plan.",
  change:
    "Scope-change requests, pricing decisions, and the audit trail of approved or rejected changes.",
  comms:
    "Messages, meetings, and comms log shared with the client and partner team.",
  portal:
    "Client portal user management and discovery submissions."
};

export default function ProjectDetailLayout(props: {
  backHref: string;
  title: string;
  statusLabel: string;
  clientName: string;
  projectType: string;
  hubsInScope: string[];
  activeTab: ProjectDetailTabKey;
  onTabChange: (tab: ProjectDetailTabKey) => void;
  sidebar: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  primaryActions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <section className="brand-surface rounded-[14px] border p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {props.breadcrumb ? (
              <div className="mb-2">{props.breadcrumb}</div>
            ) : (
              <Link href={props.backHref} className="text-sm text-text-2 hover:text-white">
                ← Back to projects
              </Link>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-white">{props.title}</h1>
              <button
                type="button"
                className="brand-surface-soft rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-white"
              >
                {props.statusLabel}
              </button>
            </div>
            <p className="mt-3 text-sm text-text-2">
              {props.clientName} · {props.projectType} ·{" "}
              {props.hubsInScope.length > 0
                ? props.hubsInScope.join(", ")
                : "No hubs in scope"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">{props.actions}</div>
        </div>

        <div className="mt-6 border-b border-ink-4">
          <nav className="flex flex-wrap gap-4">
            {tabs.map((tab) => {
              const active = tab.key === props.activeTab;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => props.onTabChange(tab.key)}
                  className={`border-b-2 px-1 pb-3 text-sm font-medium transition ${
                    active
                      ? "border-b-2 border-brand-teal text-white"
                      : "border-transparent text-text-2 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <p className="mt-3 text-xs text-text-2">
          {tabHelperText[props.activeTab]}
        </p>

        {props.primaryActions ? (
          <div className="mt-4">{props.primaryActions}</div>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">{props.children}</div>
        <div>{props.sidebar}</div>
      </div>
    </div>
  );
}
