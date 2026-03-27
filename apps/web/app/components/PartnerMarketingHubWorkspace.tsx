"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import ClientShell from "./ClientShell";
import { getPortalProjectPath } from "./portalExperience";

interface MarketingHubProjectDetail {
  project: {
    id: string;
    name: string;
    selectedHubs: string[];
    client: {
      name: string;
    };
  };
}

const lockedModules = [
  {
    title: "SEO Workbench",
    summary: "Run SEO audits, content gap reviews, and optimization queues inside approved portals."
  },
  {
    title: "Content Studio",
    summary: "Generate blog outlines, campaign drafts, and partner-ready content packs."
  },
  {
    title: "Publishing Queue",
    summary: "Prepare monthly publishing plans, handoff approvals, and portal execution checklists."
  },
  {
    title: "Reporting Layer",
    summary: "Track partner marketing delivery, outcomes, and recurring retainers in one workspace."
  }
] as const;

export default function PartnerMarketingHubWorkspace({
  projectId
}: {
  projectId: string;
}) {
  const [detail, setDetail] = useState<MarketingHubProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProject() {
      try {
        const response = await fetch(
          `/api/client/projects/${encodeURIComponent(projectId)}`,
          {
            credentials: "include"
          }
        );
        if (!response.ok) {
          throw new Error("Failed to load project");
        }
        const body = await response.json();
        setDetail(body);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load project"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadProject();
  }, [projectId]);

  return (
    <ClientShell portalExperience="partner" title="Marketing Hub Delivery">
      <div className="space-y-6">
        <div>
          <Link
            href={getPortalProjectPath("partner", projectId)}
            className="text-sm text-text-muted transition hover:text-white"
          >
            Back to project
          </Link>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-background-card p-8 text-text-secondary">
            Loading marketing hub workspace...
          </div>
        ) : error || !detail ? (
          <div className="rounded-3xl border border-[rgba(224,80,96,0.35)] bg-background-card p-6 text-white">
            {error ?? "Marketing hub unavailable"}
          </div>
        ) : (
          <>
            <section className="rounded-[28px] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(17,23,43,0.98)_0%,rgba(11,17,38,0.98)_100%)] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                    {detail.project.client.name}
                  </p>
                  <h1 className="mt-3 text-3xl font-semibold text-white">
                    Marketing Hub Delivery
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm text-text-secondary">
                    This is the partner-facing marketing execution layer for portal work:
                    SEO actions, content creation, campaign support, and recurring
                    marketing operations inside the HubSpot environments you already
                    have access to.
                  </p>
                </div>
                <div className="rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#c3cad9]">
                  Subscription required
                </div>
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-background-card p-6">
                <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                  What unlocks on subscription
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {lockedModules.map((module) => (
                    <div
                      key={module.title}
                      className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.03)] p-5 opacity-70 grayscale-[0.25]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">
                          {module.title}
                        </p>
                        <span className="rounded-full border border-[rgba(255,255,255,0.12)] px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                          Locked
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-text-secondary">
                        {module.summary}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-background-card p-6">
                <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                  Phase 1 model
                </p>
                <div className="mt-4 space-y-4 text-sm text-text-secondary">
                  <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
                    Partners will use this area in the same project context as technical
                    delivery, but for marketing execution across the portals they can already access.
                  </div>
                  <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
                    Access is intended to sit behind a monthly subscription so agencies
                    can unlock recurring SEO, blogs, content operations, and campaign work.
                  </div>
                  <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
                    Current project: <span className="text-white">{detail.project.name}</span>
                    {detail.project.selectedHubs.length > 0 ? (
                      <>
                        {" "}· Hubs in scope:{" "}
                        <span className="text-white">
                          {detail.project.selectedHubs.join(", ")}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  disabled
                  className="mt-5 w-full cursor-not-allowed rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] px-4 py-3 text-sm font-medium text-text-muted opacity-80"
                >
                  Monthly subscription setup required
                </button>
              </section>
            </div>
          </>
        )}
      </div>
    </ClientShell>
  );
}
