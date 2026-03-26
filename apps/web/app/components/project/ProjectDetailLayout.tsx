"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type ProjectDetailTabKey =
  | "overview"
  | "discovery"
  | "plan"
  | "delivery"
  | "comms"
  | "portal";

const tabs: Array<{ key: ProjectDetailTabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "discovery", label: "Discovery" },
  { key: "plan", label: "Plan" },
  { key: "delivery", label: "Delivery" },
  { key: "comms", label: "Comms" },
  { key: "portal", label: "Portal" }
];

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
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-800/80 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href={props.backHref} className="text-sm text-zinc-400 hover:text-white">
              ← Back to projects
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-white">{props.title}</h1>
              <button
                type="button"
                className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-zinc-200"
              >
                {props.statusLabel}
              </button>
            </div>
            <p className="mt-3 text-sm text-zinc-300">
              {props.clientName} · {props.projectType} ·{" "}
              {props.hubsInScope.length > 0
                ? props.hubsInScope.join(", ")
                : "No hubs in scope"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">{props.actions}</div>
        </div>

        <div className="mt-6 border-b border-zinc-800">
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
                      ? "border-b-2 border-violet-500 text-white"
                      : "border-transparent text-zinc-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">{props.children}</div>
        <div>{props.sidebar}</div>
      </div>
    </div>
  );
}
