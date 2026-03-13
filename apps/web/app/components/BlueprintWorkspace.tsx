"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import AppShell from "./AppShell";

type CurrencyCode = "ZAR" | "GBP" | "EUR" | "USD" | "AUD";
type RateTierKey = "implementation" | "consulting";
type BlueprintTaskType = "Agent" | "Human" | "Client";

interface Project {
  id: string;
  name: string;
  status: string;
  engagementType: string;
  client: {
    name: string;
  };
  selectedHubs: string[];
}

interface BlueprintTask {
  id: string;
  phase: number;
  phaseName: string;
  name: string;
  type: BlueprintTaskType;
  effortHours: number;
  order: number;
}

interface Blueprint {
  id: string;
  projectId: string;
  generatedAt: string;
  tasks: BlueprintTask[];
}

const exchangeRatesToZar: Record<CurrencyCode, number> = {
  ZAR: 1,
  GBP: 23,
  EUR: 19,
  USD: 18.5,
  AUD: 12
};

const rateTiers: Record<RateTierKey, { label: string; hourlyRateZar: number }> =
  {
    implementation: {
      label: "Implementation",
      hourlyRateZar: 1500
    },
    consulting: {
      label: "Consulting",
      hourlyRateZar: 2200
    }
  };

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatHours(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatCurrency(amountInZar: number, currency: CurrencyCode) {
  const convertedAmount = amountInZar / exchangeRatesToZar[currency];

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "ZAR" ? 0 : 2
  }).format(convertedAmount);
}

function typeBadgeClass(type: BlueprintTaskType) {
  switch (type) {
    case "Agent":
      return "bg-[rgba(79,142,247,0.18)] text-[#4f8ef7]";
    case "Human":
      return "bg-[rgba(240,160,80,0.18)] text-[#f0a050]";
    case "Client":
      return "bg-[rgba(45,212,160,0.18)] text-[#2dd4a0]";
  }
}

export default function BlueprintWorkspace({
  projectId
}: {
  projectId: string;
}) {
  const searchParams = useSearchParams();
  const autoGenerateRequested = searchParams.get("generate") === "1";
  const autoGenerateStarted = useRef(false);
  const [project, setProject] = useState<Project | null>(null);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [missingBlueprint, setMissingBlueprint] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>("ZAR");
  const [rateTier, setRateTier] = useState<RateTierKey>("implementation");

  async function loadWorkspace() {
    setLoading(true);
    setError(null);

    try {
      const [projectResponse, blueprintResponse] = await Promise.all([
        fetch(`/api/projects/${encodeURIComponent(projectId)}`),
        fetch(`/api/projects/${encodeURIComponent(projectId)}/blueprint`)
      ]);

      if (!projectResponse.ok) {
        const body = await projectResponse.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to load project");
      }

      const projectBody = await projectResponse.json();
      setProject(projectBody.project);

      if (blueprintResponse.status === 404) {
        setBlueprint(null);
        setMissingBlueprint(true);
        return;
      }

      if (!blueprintResponse.ok) {
        const body = await blueprintResponse.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to load blueprint");
      }

      const blueprintBody = await blueprintResponse.json();
      setBlueprint(blueprintBody.blueprint);
      setMissingBlueprint(false);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load blueprint workspace"
      );
    } finally {
      setLoading(false);
    }
  }

  async function generateBlueprint() {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/blueprint/generate`,
        {
          method: "POST"
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to generate blueprint");
      }

      const body = await response.json();
      setBlueprint(body.blueprint);
      setMissingBlueprint(false);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Failed to generate blueprint"
      );
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    loadWorkspace();
  }, [projectId]);

  useEffect(() => {
    if (
      !loading &&
      !generating &&
      missingBlueprint &&
      autoGenerateRequested &&
      !autoGenerateStarted.current
    ) {
      autoGenerateStarted.current = true;
      void generateBlueprint();
    }
  }, [autoGenerateRequested, generating, loading, missingBlueprint]);

  const groupedPhases = (blueprint?.tasks ?? []).reduce<
    Array<{
      phase: number;
      phaseName: string;
      tasks: BlueprintTask[];
    }>
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

  const humanTasks = (blueprint?.tasks ?? []).filter(
    (task) => task.type === "Human"
  );
  const totalHumanHours = humanTasks.reduce(
    (total, task) => total + task.effortHours,
    0
  );
  const totalFeeZar = totalHumanHours * rateTiers[rateTier].hourlyRateZar;

  return (
    <AppShell>
      <div className="p-8">
        {loading ? (
          <div className="grid gap-4">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="h-28 animate-pulse rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card"
              />
            ))}
          </div>
        ) : error && !project ? (
          <div className="rounded-2xl border border-[rgba(224,80,96,0.4)] bg-background-card p-8 text-white">
            {error}
          </div>
        ) : (
          <>
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <Link
                  href={`/projects/${projectId}`}
                  className="text-sm text-text-muted"
                >
                  Back to overview
                </Link>
                <h1 className="mt-3 text-3xl font-bold font-heading text-white">
                  Blueprint - {project?.name}
                </h1>
                <p className="mt-2 text-text-secondary">
                  {blueprint
                    ? `Generated ${formatDate(blueprint.generatedAt)}`
                    : "No blueprint generated yet"}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => void generateBlueprint()}
                  disabled={generating}
                  className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {generating
                    ? "Generating..."
                    : blueprint
                      ? "Regenerate"
                      : "Generate Blueprint"}
                </button>
              </div>
            </div>

            {error ? (
              <div className="mb-6 rounded-xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
                {error}
              </div>
            ) : null}

            {missingBlueprint && !blueprint ? (
              <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-10 text-center">
                <h2 className="text-2xl font-semibold text-white">
                  No blueprint yet
                </h2>
                <p className="mt-3 text-text-secondary">
                  Generate a phased implementation plan from the completed
                  discovery sessions.
                </p>
                <button
                  type="button"
                  onClick={() => void generateBlueprint()}
                  disabled={generating}
                  className="mt-6 rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {generating ? "Generating..." : "Generate Blueprint"}
                </button>
              </div>
            ) : blueprint ? (
              <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
                <section className="space-y-6">
                  {groupedPhases.map((phaseGroup) => {
                    const phaseTotalHours = phaseGroup.tasks.reduce(
                      (total, task) => total + task.effortHours,
                      0
                    );
                    const phaseHumanHours = phaseGroup.tasks
                      .filter((task) => task.type === "Human")
                      .reduce((total, task) => total + task.effortHours, 0);

                    return (
                      <div
                        key={phaseGroup.phase}
                        className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card"
                      >
                        <div className="border-b border-[rgba(255,255,255,0.07)] px-6 py-5">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            Phase {phaseGroup.phase}
                          </p>
                          <h2 className="mt-2 text-xl font-semibold text-white">
                            {phaseGroup.phaseName}
                          </h2>
                        </div>

                        <div className="grid grid-cols-[1.6fr_120px_120px] gap-4 border-b border-[rgba(255,255,255,0.05)] px-6 py-3 text-xs uppercase tracking-[0.2em] text-text-muted">
                          <span>Task Name</span>
                          <span>Type</span>
                          <span className="text-right">Effort</span>
                        </div>

                        {phaseGroup.tasks.map((task) => (
                          <div
                            key={task.id}
                            className="grid grid-cols-[1.6fr_120px_120px] gap-4 border-b border-[rgba(255,255,255,0.05)] px-6 py-4 last:border-b-0"
                          >
                            <span className="text-sm text-white">
                              {task.name}
                            </span>
                            <span
                              className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-medium ${typeBadgeClass(
                                task.type
                              )}`}
                            >
                              {task.type}
                            </span>
                            <span className="text-right text-sm text-white">
                              {formatHours(task.effortHours)} hrs
                            </span>
                          </div>
                        ))}

                        <div className="grid grid-cols-[1.6fr_120px_120px] gap-4 border-t border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] px-6 py-4 text-sm">
                          <span className="font-medium text-white">
                            Phase total
                          </span>
                          <span className="text-text-secondary">
                            {formatHours(phaseHumanHours)} human hrs
                          </span>
                          <span className="text-right font-medium text-white">
                            {formatHours(phaseTotalHours)} hrs
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card px-6 py-5">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm uppercase tracking-[0.2em] text-text-muted">
                        Grand total human hours
                      </span>
                      <span className="text-2xl font-semibold text-white">
                        {formatHours(totalHumanHours)} hrs
                      </span>
                    </div>
                  </div>
                </section>

                <aside className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                        Fee Calculator
                      </p>
                      <h2 className="mt-2 text-xl font-semibold text-white">
                        Internal estimate
                      </h2>
                    </div>
                  </div>

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
                        Rate tier
                      </span>
                      <select
                        value={rateTier}
                        onChange={(event) =>
                          setRateTier(event.target.value as RateTierKey)
                        }
                        className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                      >
                        {Object.entries(rateTiers).map(([key, tier]) => (
                          <option key={key} value={key}>
                            {tier.label} (ZAR {tier.hourlyRateZar}/hr)
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-6 grid gap-4">
                    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                      <p className="text-sm text-text-secondary">
                        Total Human Hours
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {formatHours(totalHumanHours)} hrs
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                      <p className="text-sm text-text-secondary">
                        Estimated Fee
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {formatCurrency(totalFeeZar, currency)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                      Breakdown by phase
                    </p>
                    <div className="mt-4 space-y-3">
                      {groupedPhases.map((phaseGroup) => {
                        const phaseHumanHours = phaseGroup.tasks
                          .filter((task) => task.type === "Human")
                          .reduce((total, task) => total + task.effortHours, 0);
                        const phaseFeeZar =
                          phaseHumanHours * rateTiers[rateTier].hourlyRateZar;

                        return (
                          <div
                            key={phaseGroup.phase}
                            className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] px-4 py-3"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-sm text-white">
                                Phase {phaseGroup.phase} - {phaseGroup.phaseName}
                              </span>
                              <span className="text-sm text-text-secondary">
                                {formatHours(phaseHumanHours)} hrs
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-medium text-white">
                              {formatCurrency(phaseFeeZar, currency)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </aside>
              </div>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
