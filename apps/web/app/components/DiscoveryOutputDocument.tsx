"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AppShell from "./AppShell";

interface Project {
  id: string;
  name: string;
  owner: string;
  ownerEmail: string;
  scopeType?: string | null;
  engagementType: string;
  clientChampionFirstName?: string | null;
  clientChampionLastName?: string | null;
  clientChampionEmail?: string | null;
  client: {
    name: string;
    industry?: string | null;
    website?: string | null;
  };
}

interface SessionDetail {
  session: number;
  title: string;
  status: "draft" | "in_progress" | "complete";
  fields: Record<string, string>;
}

interface BlueprintTask {
  id: string;
  phase: number;
  phaseName: string;
  name: string;
  type: "Agent" | "Human" | "Client";
  effortHours: number;
  order: number;
}

interface Blueprint {
  id: string;
  generatedAt: string;
  tasks: BlueprintTask[];
}

interface DiscoverySummary {
  executiveSummary: string;
  recommendedApproach: string;
  whyThisApproach: string;
  phaseOneFocus: string;
  futureUpgradePath: string;
  inScopeItems: string[];
  outOfScopeItems: string[];
  engagementTrack: string;
  platformFit: string;
  changeManagementRating: string;
  dataReadinessRating: string;
  scopeVolatilityRating: string;
  missingInformation: string[];
  keyRisks: string[];
  recommendedNextQuestions: string[];
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatEngagementType(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function splitIntoLines(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitIntoList(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(/\n|•|;(?=\s*[A-Za-z])/)
    .map((item) => item.trim().replace(/^-+/, "").trim())
    .filter(Boolean);
}

function formatDiscoveryOutcome(
  label: "engagementTrack" | "platformFit" | "changeManagementRating" | "dataReadinessRating",
  value: string | undefined
) {
  if (!value) {
    return "Not yet assessed";
  }

  if (label === "engagementTrack") {
    const engagementTrackLabels: Record<string, string> = {
      "new-crm-greenfield": "New CRM implementation",
      "hubspot-onboarding-new-build": "HubSpot onboarding",
      "hubspot-optimisation-revamp": "HubSpot optimisation",
      "migration-to-hubspot": "Migration to HubSpot"
    };

    return engagementTrackLabels[value] ?? value;
  }

  if (label === "platformFit") {
    const platformFitLabels: Record<string, string> = {
      "fit-confirmed": "HubSpot is the recommended fit",
      "fit-possible-with-caveats": "HubSpot could fit with caveats",
      "fit-not-recommended": "HubSpot is not the recommended fit"
    };

    return platformFitLabels[value] ?? value;
  }

  const simpleLabels: Record<string, string> = {
    low: "Low",
    medium: "Medium",
    high: "High"
  };

  return simpleLabels[value] ?? value;
}

function SectionEyebrow({ children }: { children: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#49cde1]">
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mt-3 text-2xl font-semibold text-white">{children}</h2>;
}

export default function DiscoveryOutputDocument({
  projectId
}: {
  projectId: string;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [sessions, setSessions] = useState<SessionDetail[]>([]);
  const [summary, setSummary] = useState<DiscoverySummary | null>(null);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDocument() {
      setLoading(true);
      setError(null);

      try {
        const [
          projectResponse,
          sessionsResponse,
          summaryResponse,
          blueprintResponse
        ] = await Promise.all([
          fetch(`/api/projects/${encodeURIComponent(projectId)}`),
          fetch(`/api/discovery/${encodeURIComponent(projectId)}/sessions`),
          fetch(
            `/api/projects/${encodeURIComponent(projectId)}/discovery-summary`
          ),
          fetch(`/api/projects/${encodeURIComponent(projectId)}/blueprint`)
        ]);

        if (
          !projectResponse.ok ||
          !sessionsResponse.ok ||
          !summaryResponse.ok ||
          !blueprintResponse.ok
        ) {
          throw new Error(
            "Generate the discovery summary and blueprint before opening the client document."
          );
        }

        const projectBody = await projectResponse.json();
        const sessionsBody = await sessionsResponse.json();
        const summaryBody = await summaryResponse.json();
        const blueprintBody = await blueprintResponse.json();

        setProject(projectBody.project);
        setSessions(sessionsBody.sessionDetails ?? []);
        setSummary(summaryBody.summary ?? null);
        setBlueprint(blueprintBody.blueprint ?? null);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load discovery output document"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadDocument();
  }, [projectId]);

  const groupedPhases = (blueprint?.tasks ?? []).reduce<
      Array<{ phase: number; phaseName: string; tasks: BlueprintTask[] }>
    >((groups, task) => {
      const existingGroup = groups.find((group) => group.phase === task.phase);

      if (existingGroup) {
        existingGroup.tasks.push(task);
        return groups;
      }

      groups.push({
        phase: task.phase,
        phaseName: task.phaseName,
        tasks: [task]
      });
      return groups;
    }, []);

  const session1 = sessions.find((session) => session.session === 1)?.fields ?? {};
  const session2 = sessions.find((session) => session.session === 2)?.fields ?? {};
  const session3 = sessions.find((session) => session.session === 3)?.fields ?? {};
  const session4 = sessions.find((session) => session.session === 4)?.fields ?? {};
  const clientResponsibilities = splitIntoList(session4.client_responsibilities);
  const inScopeItems =
    project?.scopeType === "standalone_quote" && summary?.inScopeItems.length
      ? summary.inScopeItems
      : splitIntoList(session4.confirmed_scope);
  const outOfScopeItems =
    project?.scopeType === "standalone_quote" && summary?.outOfScopeItems.length
      ? summary.outOfScopeItems
      : splitIntoList(session4.out_of_scope);
  const keyRisks =
    summary?.keyRisks.length && summary.keyRisks.length > 0
      ? summary.keyRisks
      : splitIntoList(session4.risks_and_blockers);
  const nextQuestions = summary?.recommendedNextQuestions ?? [];

  const clientChampionName = [
    project?.clientChampionFirstName,
    project?.clientChampionLastName
  ]
    .filter(Boolean)
    .join(" ");

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareMessage("Client link copied");
      window.setTimeout(() => setShareMessage(null), 2500);
    } catch {
      setShareMessage("Unable to copy link");
      window.setTimeout(() => setShareMessage(null), 2500);
    }
  }

  function saveAsPdf() {
    window.print();
  }

  return (
    <AppShell>
      <div className="document-shell p-8">
        {loading ? (
          <div className="grid gap-4">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="h-28 animate-pulse rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card"
              />
            ))}
          </div>
        ) : error || !project || !blueprint ? (
          <div className="rounded-2xl border border-[rgba(224,80,96,0.4)] bg-background-card p-8 text-white">
            {error ?? "Document unavailable"}
          </div>
        ) : (
          <div className="document-content space-y-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Link
                  href={`/projects/${project.id}`}
                  className="text-sm text-text-muted"
                >
                  Back to overview
                </Link>
                <h1 className="mt-3 text-3xl font-bold font-heading text-white">
                  Discovery Document & Implementation Plan
                </h1>
                <p className="mt-2 text-text-secondary">
                  Client-facing discovery document that explains the
                  recommendation, scope, and phased implementation approach in a
                  portable format the client can deliver with Muloo or another
                  partner.
                </p>
              </div>
              <div className="document-toolbar flex flex-wrap items-center gap-3">
                <Link
                  href={`/projects/${project.id}/quote`}
                  className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
                >
                  Open Quote
                </Link>
                <button
                  type="button"
                  onClick={copyShareLink}
                  className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
                >
                  Copy Share Link
                </button>
                <button
                  type="button"
                  onClick={saveAsPdf}
                  className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white"
                >
                  Save PDF
                </button>
                {shareMessage ? (
                  <p className="text-sm text-text-secondary">{shareMessage}</p>
                ) : null}
              </div>
            </div>

            <section className="document-card overflow-hidden rounded-[32px] border border-[rgba(255,255,255,0.07)] bg-background-card">
              <div className="bg-[#0c1329] p-10">
                  <div className="flex items-center gap-4">
                    <img
                      src="/muloo-logo.svg"
                      alt="Muloo"
                      className="h-8 w-auto"
                    />
                    <p className="text-xs uppercase tracking-[0.35em] text-text-muted">
                      Discovery Document
                    </p>
                  </div>
                  <h2 className="mt-10 max-w-3xl text-5xl font-bold font-heading leading-tight text-white">
                    {project.client.name.toUpperCase()} - Discovery Document &
                    Implementation Plan
                  </h2>
                  <p className="mt-6 text-lg text-text-secondary">
                    {formatEngagementType(project.engagementType)} discovery-led
                    implementation plan generated from structured discovery.
                  </p>

                  <div className="mt-10 grid gap-8 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
                        Prepared For
                      </p>
                      <div className="mt-4 space-y-2 text-sm text-white">
                        <p className="font-semibold">{project.client.name}</p>
                        {clientChampionName ? <p>{clientChampionName}</p> : null}
                        {project.clientChampionEmail ? (
                          <p>{project.clientChampionEmail}</p>
                        ) : null}
                        {project.client.website ? (
                          <p>{project.client.website}</p>
                        ) : null}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
                        Prepared By
                      </p>
                      <div className="mt-4 space-y-2 text-sm text-white">
                        <p className="font-semibold">{project.owner}</p>
                        <p>{project.ownerEmail}</p>
                        <p>Muloo</p>
                      </div>
                    </div>
                  </div>
              </div>
            </section>

            <section className="document-card rounded-2xl border border-[rgba(73,205,225,0.18)] bg-[linear-gradient(135deg,rgba(73,205,225,0.08)_0%,rgba(224,82,156,0.06)_100%)] p-6">
              <SectionEyebrow>Document Purpose</SectionEyebrow>
              <SectionTitle>Portable implementation plan</SectionTitle>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {[
                  "This document is designed to give the client a clear take-away plan they can understand, review, and act on after discovery.",
                  "It translates discovery into recommended scope, phased delivery, dependencies, and an implementation approach in one structured pack.",
                  "Commercial pricing and approval are managed separately in the quote so the client can approve all or only part of the recommended scope."
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(11,17,38,0.65)] p-4 text-sm leading-7 text-text-secondary"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-6">
                <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <SectionEyebrow>Executive Summary</SectionEyebrow>
                  <SectionTitle>What discovery confirmed</SectionTitle>
                  <p className="mt-4 text-sm leading-7 text-text-secondary">
                    {summary?.executiveSummary ??
                      session1.business_overview ??
                      "No executive summary generated yet."}
                  </p>
                </div>

                <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <SectionEyebrow>Why This Project Matters</SectionEyebrow>
                  <SectionTitle>Why action is needed now</SectionTitle>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        Primary challenge
                      </p>
                      <p className="mt-3 text-sm leading-7 text-text-secondary">
                        {session1.primary_pain_challenge || "To be confirmed"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        Success outcomes
                      </p>
                      <div className="mt-3 space-y-2 text-sm text-text-secondary">
                        {splitIntoLines(
                          session1.goals_and_success_metrics
                        ).map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <SectionEyebrow>Recommended Path</SectionEyebrow>
                  <SectionTitle>What Muloo recommends</SectionTitle>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {[
                      [
                        "Recommended engagement model",
                        summary?.engagementTrack ?? "Not set"
                      ],
                      ["Platform recommendation", summary?.platformFit ?? "Not set"],
                      ["Change readiness", summary?.changeManagementRating ?? "Not set"],
                      ["Data readiness", summary?.dataReadinessRating ?? "Not set"]
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                      >
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          {label}
                        </p>
                        <p className="mt-2 text-sm font-medium text-white">
                          {formatDiscoveryOutcome(
                            label === "Recommended engagement model"
                              ? "engagementTrack"
                              : label === "Platform recommendation"
                                ? "platformFit"
                                : label === "Change readiness"
                                  ? "changeManagementRating"
                                  : "dataReadinessRating",
                            value
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <SectionEyebrow>Current State</SectionEyebrow>
                  <SectionTitle>How the business operates today</SectionTitle>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {[
                      ["Current stack", session2.current_tech_stack],
                      ["HubSpot today", session2.current_hubspot_state],
                      ["Data landscape", session2.data_landscape],
                      ["Current processes", session2.current_processes]
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                      >
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          {label}
                        </p>
                        <div className="mt-3 space-y-2 text-sm text-text-secondary">
                          {splitIntoLines(value).map((line) => (
                            <p key={line}>{line}</p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <SectionEyebrow>Recommended Future State</SectionEyebrow>
                  <SectionTitle>What the target solution should look like</SectionTitle>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {[
                      ["Hubs & features", session3.hubs_and_features_required],
                      ["Pipeline & process", session3.pipeline_and_process_design],
                      ["Automation", session3.automation_requirements],
                      ["Reporting", session3.reporting_requirements]
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                      >
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          {label}
                        </p>
                        <div className="mt-3 space-y-2 text-sm text-text-secondary">
                          {splitIntoLines(value).map((line) => (
                            <p key={line}>{line}</p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <SectionEyebrow>Delivery Approach</SectionEyebrow>
                  <SectionTitle>How this should be delivered</SectionTitle>
                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    {[
                      [
                        "How we will work",
                        "We will deliver the implementation in phased onboarding blocks, each with a clear output, review point, and delivery boundary."
                      ],
                      [
                        "How scope is controlled",
                        "The agreed phases below become the working implementation scope. Any material changes should move through change control."
                      ],
                      [
                        "How the client participates",
                        "The client team provides access, confirms process decisions, reviews milestones, and signs off the agreed outputs."
                      ]
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                      >
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          {label}
                        </p>
                        <p className="mt-3 text-sm leading-7 text-text-secondary">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <SectionEyebrow>Scope</SectionEyebrow>
                  <SectionTitle>What is included and excluded</SectionTitle>
                  <div className="mt-5 grid gap-4">
                    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        In Scope
                      </p>
                      <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                        {inScopeItems.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        Out of Scope
                      </p>
                      <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                        {outOfScopeItems.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <SectionEyebrow>Risks & Dependencies</SectionEyebrow>
                  <SectionTitle>What could affect delivery</SectionTitle>
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-sm font-medium text-white">Key risks</p>
                      <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                        {keyRisks.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        Client responsibilities
                      </p>
                      <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                        {clientResponsibilities.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    {nextQuestions.length > 0 ? (
                      <div>
                        <p className="text-sm font-medium text-white">
                          Open questions to resolve during approval
                        </p>
                        <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                          {nextQuestions.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <section className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <SectionEyebrow>Phased Implementation Scope</SectionEyebrow>
                  <SectionTitle>
                    Proposed onboarding phases and delivery plan
                  </SectionTitle>
                </div>
                <p className="text-sm text-text-secondary">
                  Generated {formatDate(blueprint.generatedAt)}
                </p>
              </div>

              <div className="mt-6 space-y-5">
                {groupedPhases.map((phase) => {
                  const clientDependencies = phase.tasks
                    .filter((task) => task.type === "Client")
                    .map((task) => task.name);

                  return (
                  <div
                    key={phase.phase}
                    className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5"
                  >
                    <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Phase {phase.phase}
                        </p>
                        <h3 className="mt-2 text-lg font-semibold text-white">
                          {phase.phaseName}
                        </h3>
                        <ul className="mt-4 space-y-2 text-sm text-text-secondary">
                          {phase.tasks
                            .filter((task) => task.type !== "Client")
                            .map((task) => (
                              <li key={task.id}>{task.name}</li>
                            ))}
                        </ul>
                      </div>
                      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
                        <div className="grid gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                              Phase purpose
                            </p>
                            <p className="mt-2 text-sm text-white">
                              {phase.tasks[0]?.name ?? "Implementation phase"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                              Client inputs needed
                            </p>
                            {clientDependencies.length > 0 ? (
                              <ul className="mt-2 space-y-2 text-sm text-white">
                                {clientDependencies.map((dependency) => (
                                  <li key={dependency}>{dependency}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-2 text-sm text-white">
                                No major client dependencies flagged for this phase.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </section>

            <section className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
              <SectionEyebrow>How To Use This Document</SectionEyebrow>
              <SectionTitle>Working implementation reference</SectionTitle>
              <div className="mt-4 space-y-4 text-sm leading-7 text-text-secondary">
                <p>
                  This document is intended to act as the working discovery
                  recommendation and implementation plan for client review.
                </p>
                <p>
                  It explains what was learned, what is recommended, what is in
                  scope, what is out of scope, and how the work can be phased in
                  a practical way.
                </p>
                <p>
                  Commercial pricing, approvals, and payment structure are
                  intentionally handled in the separate quote so the client can
                  review the plan on its own merits first.
                </p>
                <p>
                  If the client decides to implement only part of the
                  recommendation, this document still remains the planning
                  reference, while the quote can be narrowed to the approved
                  phases.
                </p>
              </div>
            </section>
          </div>
        )}
      </div>
      <style jsx global>{`
        @media print {
          .document-shell {
            padding: 0 !important;
          }

          .document-toolbar,
          .sidebar,
          nav,
          aside,
          button,
          a[href^="/projects/"] {
            display: none !important;
          }

          main {
            padding-left: 0 !important;
          }

          body,
          html {
            background: #ffffff !important;
          }

          .document-content {
            color: #111827 !important;
          }

          .document-card {
            break-inside: avoid;
            border-color: #d1d5db !important;
            background: #ffffff !important;
            box-shadow: none !important;
          }

          .document-card *,
          .document-content h1,
          .document-content h2,
          .document-content h3,
          .document-content p,
          .document-content li,
          .document-content span {
            color: #111827 !important;
          }
        }
      `}</style>
    </AppShell>
  );
}
