"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AppShell from "./AppShell";

type CurrencyCode = "ZAR" | "GBP" | "EUR" | "USD" | "AUD";

interface Project {
  id: string;
  name: string;
  owner: string;
  ownerEmail: string;
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
  engagementTrack: string;
  platformFit: string;
  changeManagementRating: string;
  dataReadinessRating: string;
  scopeVolatilityRating: string;
  missingInformation: string[];
  keyRisks: string[];
  recommendedNextQuestions: string[];
}

interface PhaseCommercialDraft {
  humanHours: string;
  rate: string;
}

const exchangeRatesToZar: Record<CurrencyCode, number> = {
  ZAR: 1,
  GBP: 23,
  EUR: 19,
  USD: 18.5,
  AUD: 12
};

const currencySymbols: Record<CurrencyCode, string> = {
  ZAR: "ZAR",
  GBP: "GBP",
  EUR: "EUR",
  USD: "USD",
  AUD: "AUD"
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatCurrency(amountInZar: number, currency: CurrencyCode) {
  const convertedAmount = amountInZar / exchangeRatesToZar[currency];

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "ZAR" ? 0 : 2
  }).format(convertedAmount);
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

function parseNumber(value: string, fallbackValue: number) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallbackValue;
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
  const [currency, setCurrency] = useState<CurrencyCode>("ZAR");
  const [defaultRate, setDefaultRate] = useState("1500");
  const [phaseDrafts, setPhaseDrafts] = useState<
    Record<number, PhaseCommercialDraft>
  >({});
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

  const groupedPhases = useMemo(() => {
    return (blueprint?.tasks ?? []).reduce<
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
  }, [blueprint]);

  useEffect(() => {
    if (groupedPhases.length === 0) {
      return;
    }

    setPhaseDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };

      for (const phase of groupedPhases) {
        if (!nextDrafts[phase.phase]) {
          const phaseHumanHours = phase.tasks
            .filter((task) => task.type === "Human")
            .reduce((total, task) => total + task.effortHours, 0);

          nextDrafts[phase.phase] = {
            humanHours: String(phaseHumanHours),
            rate: defaultRate
          };
        }
      }

      return nextDrafts;
    });
  }, [defaultRate, groupedPhases]);

  const session1 = sessions.find((session) => session.session === 1)?.fields ?? {};
  const session2 = sessions.find((session) => session.session === 2)?.fields ?? {};
  const session3 = sessions.find((session) => session.session === 3)?.fields ?? {};
  const session4 = sessions.find((session) => session.session === 4)?.fields ?? {};

  const phaseCommercials = groupedPhases.map((phase) => {
    const phaseHumanHoursFromBlueprint = phase.tasks
      .filter((task) => task.type === "Human")
      .reduce((total, task) => total + task.effortHours, 0);
    const draft = phaseDrafts[phase.phase];
    const humanHours = parseNumber(
      draft?.humanHours ?? String(phaseHumanHoursFromBlueprint),
      phaseHumanHoursFromBlueprint
    );
    const rate = parseNumber(draft?.rate ?? defaultRate, parseNumber(defaultRate, 1500));
    const feeZar = humanHours * rate;

    return {
      phase: phase.phase,
      phaseName: phase.phaseName,
      humanHours,
      rate,
      feeZar,
      tasks: phase.tasks
    };
  });

  const totalHumanHours = phaseCommercials.reduce(
    (total, phase) => total + phase.humanHours,
    0
  );
  const totalFeeZar = phaseCommercials.reduce(
    (total, phase) => total + phase.feeZar,
    0
  );
  const paymentAmountZar = totalFeeZar / 4;
  const paymentSchedule = [
    "Upon scope approval",
    "At start of Phase 2",
    "At start of Phase 4",
    "Before final handover"
  ];
  const clientResponsibilities = splitIntoList(session4.client_responsibilities);
  const inScopeItems = splitIntoList(session4.confirmed_scope);
  const outOfScopeItems = splitIntoList(session4.out_of_scope);
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
                  Discovery Review & Implementation Scope
                </h1>
                <p className="mt-2 text-text-secondary">
                  Client-facing review document generated from the approved
                  discovery record and phased implementation estimate.
                </p>
              </div>
              <div className="document-toolbar flex flex-wrap items-center gap-3">
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
              <div className="grid gap-0 lg:grid-cols-[0.72fr_0.28fr]">
                <div className="bg-[#0c1329] p-10">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-[rgba(73,205,225,0.12)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#49cde1]">
                      Muloo
                    </div>
                    <p className="text-xs uppercase tracking-[0.35em] text-text-muted">
                      Discovery Review
                    </p>
                  </div>
                  <h2 className="mt-10 max-w-3xl text-5xl font-bold font-heading leading-tight text-white">
                    {project.client.name.toUpperCase()} - Discovery Review &
                    Implementation Scope
                  </h2>
                  <p className="mt-6 text-lg text-text-secondary">
                    {formatEngagementType(project.engagementType)} proposal
                    generated from structured discovery.
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

                <div className="border-l border-[rgba(255,255,255,0.07)] bg-[#10172f] p-8">
                  <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
                    Commercial Controls
                  </p>

                  <div className="mt-6 grid gap-4">
                    <label className="block">
                      <span className="mb-2 block text-sm text-text-secondary">
                        Currency
                      </span>
                      <select
                        value={currency}
                        onChange={(event) =>
                          setCurrency(event.target.value as CurrencyCode)
                        }
                        className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                      >
                        {Object.keys(exchangeRatesToZar).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm text-text-secondary">
                        Default Hourly Rate
                      </span>
                      <div className="flex items-center rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3">
                        <span className="mr-3 text-sm text-text-secondary">
                          {currencySymbols[currency]}
                        </span>
                        <input
                          value={defaultRate}
                          onChange={(event) => setDefaultRate(event.target.value)}
                          className="w-full bg-transparent text-white outline-none"
                        />
                      </div>
                    </label>
                  </div>

                  <div className="mt-8 grid gap-4">
                    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                      <p className="text-sm text-text-secondary">
                        Total Human Hours
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {totalHumanHours} hrs
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                      <p className="text-sm text-text-secondary">
                        Estimated Investment
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {formatCurrency(totalFeeZar, currency)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-6">
                <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
                    Executive Summary
                  </p>
                  <p className="mt-4 text-sm leading-7 text-text-secondary">
                    {summary?.executiveSummary ??
                      session1.business_overview ??
                      "No executive summary generated yet."}
                  </p>
                </div>

                <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
                    Why This Project Matters
                  </p>
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
                  <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
                    Discovery Outcomes
                  </p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {[
                      ["Engagement track", summary?.engagementTrack ?? "Not set"],
                      ["Platform fit", summary?.platformFit ?? "Not set"],
                      [
                        "Change management",
                        summary?.changeManagementRating ?? "Not set"
                      ],
                      [
                        "Data readiness",
                        summary?.dataReadinessRating ?? "Not set"
                      ]
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                      >
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          {label}
                        </p>
                        <p className="mt-2 text-sm font-medium text-white">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
                    Current State
                  </p>
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
                  <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
                    Recommended Future State
                  </p>
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
                  <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
                    Delivery Approach
                  </p>
                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    {[
                      [
                        "How we will work",
                        "We will deliver the implementation in phased onboarding blocks, each with a clear output, review point, and commercial boundary."
                      ],
                      [
                        "How scope is controlled",
                        "The approved phases below become the working implementation scope. Any material changes after approval should move through change control."
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
                  <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
                    Scope
                  </p>
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
                  <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
                    Risks & Dependencies
                  </p>
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
                  <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
                    Phased Implementation Scope
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Proposed onboarding phases and commercial split
                  </h2>
                </div>
                <p className="text-sm text-text-secondary">
                  Generated {formatDate(blueprint.generatedAt)}
                </p>
              </div>

              <div className="mt-6 space-y-5">
                {phaseCommercials.map((phase) => (
                  <div
                    key={phase.phase}
                    className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5"
                  >
                    <div className="grid gap-4 lg:grid-cols-[1fr_140px_160px_180px]">
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

                      <label className="block">
                        <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-text-muted">
                          Human Hours
                        </span>
                        <input
                          value={phaseDrafts[phase.phase]?.humanHours ?? String(phase.humanHours)}
                          onChange={(event) =>
                            setPhaseDrafts((currentDrafts) => ({
                              ...currentDrafts,
                              [phase.phase]: {
                                humanHours: event.target.value,
                                rate:
                                  currentDrafts[phase.phase]?.rate ?? defaultRate
                              }
                            }))
                          }
                          className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none focus:border-accent-solid"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-text-muted">
                          Hourly Rate
                        </span>
                        <div className="flex items-center rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2">
                          <span className="mr-2 text-xs text-text-secondary">
                            {currencySymbols[currency]}
                          </span>
                          <input
                            value={phaseDrafts[phase.phase]?.rate ?? defaultRate}
                            onChange={(event) =>
                              setPhaseDrafts((currentDrafts) => ({
                                ...currentDrafts,
                                [phase.phase]: {
                                  humanHours:
                                    currentDrafts[phase.phase]?.humanHours ??
                                    String(phase.humanHours),
                                  rate: event.target.value
                                }
                              }))
                            }
                            className="w-full bg-transparent text-sm text-white outline-none"
                          />
                        </div>
                      </label>

                      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Phase Fee
                        </p>
                        <p className="mt-2 text-xl font-semibold text-white">
                          {formatCurrency(phase.feeZar, currency)}
                        </p>
                        <p className="mt-2 text-xs text-text-secondary">
                          Client dependencies:{" "}
                          {phase.tasks.filter((task) => task.type === "Client").length}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.72fr_0.28fr]">
              <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
                  Commercial Summary
                </p>
                <div className="mt-5 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.07)]">
                  <div className="grid grid-cols-[1.4fr_120px_140px_160px] gap-4 border-b border-[rgba(255,255,255,0.07)] bg-[#10172f] px-5 py-3 text-xs uppercase tracking-[0.2em] text-text-muted">
                    <span>Phase</span>
                    <span>Hours</span>
                    <span>Rate</span>
                    <span className="text-right">Fee</span>
                  </div>
                  {phaseCommercials.map((phase) => (
                    <div
                      key={phase.phase}
                      className="grid grid-cols-[1.4fr_120px_140px_160px] gap-4 border-b border-[rgba(255,255,255,0.05)] px-5 py-4 text-sm text-white last:border-b-0"
                    >
                      <span>
                        Phase {phase.phase} - {phase.phaseName}
                      </span>
                      <span>{phase.humanHours} hrs</span>
                      <span>
                        {currencySymbols[currency]} {phase.rate}
                      </span>
                      <span className="text-right">
                        {formatCurrency(phase.feeZar, currency)}
                      </span>
                    </div>
                  ))}
                  <div className="grid grid-cols-[1.4fr_120px_140px_160px] gap-4 border-t border-[rgba(255,255,255,0.07)] bg-[#10172f] px-5 py-4 text-sm font-semibold text-white">
                    <span>Total</span>
                    <span>{totalHumanHours} hrs</span>
                    <span />
                    <span className="text-right">
                      {formatCurrency(totalFeeZar, currency)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
                  Approval
                </p>
                <p className="mt-4 text-sm leading-7 text-text-secondary">
                  This document is intended to act as the working discovery
                  recommendation and implementation scope reference for client
                  review. Once approved, the phased scope and commercial split
                  will move into planning and deployment inside DeployOS.
                </p>
                <div className="mt-6 space-y-4 text-sm text-text-secondary">
                  <p>Approval status: Pending client review</p>
                  <p>Prepared from structured discovery and phased estimate</p>
                  <p>
                    Scope changes after approval should be captured as formal
                    change requests
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.58fr_0.42fr]">
              <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
                  Payment Schedule
                </p>
                <div className="mt-5 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.07)]">
                  <div className="grid grid-cols-[120px_1fr_160px] gap-4 border-b border-[rgba(255,255,255,0.07)] bg-[#10172f] px-5 py-3 text-xs uppercase tracking-[0.2em] text-text-muted">
                    <span>Payment</span>
                    <span>Due</span>
                    <span className="text-right">Amount</span>
                  </div>
                  {paymentSchedule.map((due, index) => (
                    <div
                      key={due}
                      className="grid grid-cols-[120px_1fr_160px] gap-4 border-b border-[rgba(255,255,255,0.05)] px-5 py-4 text-sm text-white last:border-b-0"
                    >
                      <span>Payment {index + 1}</span>
                      <span>{due}</span>
                      <span className="text-right">
                        {formatCurrency(paymentAmountZar, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
                  Terms & Working Scope
                </p>
                <div className="mt-4 space-y-4 text-sm leading-7 text-text-secondary">
                  <p>
                    This document is intended to replace the traditional
                    discovery handover document and commercial quote by combining
                    the recommended scope, phased delivery plan, and commercial
                    breakdown in one reviewable package.
                  </p>
                  <p>
                    Once approved, this becomes the working implementation scope
                    baseline for planning and delivery. Future work outside the
                    approved phases should be treated as a separate scope or
                    formal change request.
                  </p>
                  <p>
                    Delivery sequencing, detailed task allocation, and agent or
                    human execution routing are finalized during planning after
                    client approval.
                  </p>
                </div>
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
