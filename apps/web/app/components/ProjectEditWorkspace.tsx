"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AppShell from "./AppShell";

interface ProjectDetail {
  id: string;
  name: string;
  clientName: string;
  engagementType: string;
  scopeType?: string | null;
  serviceFamily: string;
  implementationApproach?: string | null;
  customerPlatformTier?: string | null;
  includesPortalAudit?: boolean;
  selectedHubs: string[];
  status: string;
  scopeLockedAt?: string | null;
}

interface FormState {
  name: string;
  clientName: string;
  engagementType: string;
  scopeType: string;
  serviceFamily: string;
  implementationApproach: string;
  customerPlatformTier: string;
  includesPortalAudit: boolean;
  selectedHubs: string[];
}

const serviceFamilies = [
  {
    id: "hubspot_architecture",
    label: "HubSpot Architecture",
    description: "Portal design, implementation, optimisation, and delivery."
  },
  {
    id: "custom_engineering",
    label: "Custom Engineering",
    description: "CMS, integrations, websites, and technical implementation work."
  },
  {
    id: "ai_automation",
    label: "AI Automation",
    description: "Agent flows, AI operations, and automation-led delivery."
  }
];

const engagementTypes = [
  {
    id: "IMPLEMENTATION",
    label: "Implementation",
    description: "New HubSpot build or onboarding delivery."
  },
  {
    id: "MIGRATION",
    label: "Migration",
    description: "Move from another CRM or stack into HubSpot."
  },
  {
    id: "OPTIMISATION",
    label: "Optimisation",
    description: "Improve an existing setup and structure the next phase."
  },
  {
    id: "AUDIT",
    label: "Audit",
    description: "Assess the current setup and recommend the next move."
  },
  {
    id: "GUIDED_DEPLOYMENT",
    label: "Guided Deployment",
    description: "Partnered rollout with close client involvement."
  }
];

const scopeTypes = [
  {
    id: "discovery",
    label: "Discovery-led implementation",
    description: "Use discovery, scoped recommendations, and a phased quote."
  },
  {
    id: "standalone_quote",
    label: "Standalone quote job",
    description: "Capture a specific job brief without a full discovery cycle."
  },
  {
    id: "optimisation",
    label: "Optimisation / revamp",
    description: "Audit an existing portal and deliver structured improvements."
  }
];

const implementationApproachOptions = [
  {
    value: "pragmatic_poc",
    label: "Pragmatic / POC",
    description:
      "Use a lean Phase 1 path and allow workaround architecture where sensible."
  },
  {
    value: "best_practice",
    label: "Best-practice / scalable",
    description:
      "Prefer the cleaner long-term architecture even if it needs more packaging or effort."
  }
];

const customerPlatformTierOptions = [
  { value: "", label: "Not set" },
  { value: "free", label: "Free" },
  { value: "starter", label: "Starter" },
  { value: "professional", label: "Professional" },
  { value: "enterprise", label: "Enterprise" }
];

const coreHubOptions = [
  { id: "sales", label: "Sales Hub" },
  { id: "marketing", label: "Marketing Hub" },
  { id: "service", label: "Service Hub" },
  { id: "cms", label: "Content Hub" },
  { id: "ops", label: "Operations Hub" }
];

const addOnHubOptions = [
  { id: "commerce", label: "Commerce Hub" },
  { id: "data", label: "Data Hub" },
  { id: "breeze", label: "Breeze AI" }
];

function formatTokenLabel(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return value
    .split(/[_-]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildInitialForm(project: ProjectDetail): FormState {
  return {
    name: project.name,
    clientName: project.clientName,
    engagementType: project.engagementType,
    scopeType: project.scopeType ?? "discovery",
    serviceFamily: project.serviceFamily,
    implementationApproach: project.implementationApproach ?? "pragmatic_poc",
    customerPlatformTier: project.customerPlatformTier ?? "",
    includesPortalAudit: Boolean(project.includesPortalAudit),
    selectedHubs: project.selectedHubs ?? []
  };
}

export default function ProjectEditWorkspace({
  projectId
}: {
  projectId: string;
}) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProject() {
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`);
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(body?.error ?? "Failed to load project");
        }

        const nextProject = body?.project as ProjectDetail;
        setProject(nextProject);
        setForm(buildInitialForm(nextProject));
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

  const dirty = useMemo(() => {
    if (!project || !form) {
      return false;
    }

    const baseline = buildInitialForm(project);
    return JSON.stringify(form) !== JSON.stringify(baseline);
  }, [form, project]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setValidationError(null);
    setError(null);
  }

  function toggleHub(hubId: string) {
    setForm((current) => {
      if (!current) {
        return current;
      }

      const selectedHubs = current.selectedHubs.includes(hubId)
        ? current.selectedHubs.filter((hub) => hub !== hubId)
        : [...current.selectedHubs, hubId];

      return { ...current, selectedHubs };
    });
    setValidationError(null);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form) {
      return;
    }

    if (!form.name.trim() || !form.clientName.trim()) {
      setValidationError("Project name and client name are required.");
      return;
    }

    if (form.scopeType !== "standalone_quote" && form.selectedHubs.length === 0) {
      setValidationError(
        "Pick at least one hub unless this is a standalone quote."
      );
      return;
    }

    setSaving(true);
    setValidationError(null);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: form.name,
          clientName: form.clientName,
          type: form.engagementType,
          scopeType: form.scopeType,
          serviceFamily: form.serviceFamily,
          implementationApproach: form.implementationApproach,
          customerPlatformTier: form.customerPlatformTier,
          includesPortalAudit: form.includesPortalAudit,
          hubs: form.selectedHubs
        })
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to update project");
      }

      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to update project"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="brand-page p-4 sm:p-6 xl:p-8">
          <div className="grid gap-4">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/5"
              />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  if (!project || !form) {
    return (
      <AppShell>
        <div className="brand-page p-4 sm:p-6 xl:p-8">
          <div className="rounded-2xl border border-status-error/30 bg-status-error/10 p-8 text-white">
            {error ?? "Project not found"}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="brand-page p-4 sm:p-6 xl:p-8">
        <div className="space-y-6">
          <section className="brand-surface rounded-3xl border p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Link
                  href={`/projects/${project.id}`}
                  className="text-sm text-text-secondary hover:text-white"
                >
                  ← Back to project
                </Link>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold text-white">
                    Edit project
                  </h1>
                  <span className="brand-surface-soft rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-white">
                    {formatTokenLabel(project.status)}
                  </span>
                </div>
                <p className="mt-3 max-w-3xl text-sm text-text-secondary">
                  Update this project in place when the work changes shape. No
                  more cloning the whole thing just to move Magnisol or Collaborative
                  into the right project type.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/projects/${project.id}`}
                  className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-text-secondary"
                >
                  Cancel
                </Link>
              </div>
            </div>
          </section>

          <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="space-y-6">
              <section className="brand-surface rounded-3xl border p-6">
                <h2 className="text-xl font-semibold text-white">
                  Core details
                </h2>
                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm text-text-secondary">
                      Project name
                    </span>
                    <input
                      value={form.name}
                      onChange={(event) => updateField("name", event.target.value)}
                      className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm text-text-secondary">
                      Client name
                    </span>
                    <input
                      value={form.clientName}
                      onChange={(event) =>
                        updateField("clientName", event.target.value)
                      }
                      className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                    />
                  </label>

                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm text-text-secondary">
                      Service family
                    </span>
                    <select
                      value={form.serviceFamily}
                      onChange={(event) =>
                        updateField("serviceFamily", event.target.value)
                      }
                      className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                    >
                      {serviceFamilies.map((family) => (
                        <option key={family.id} value={family.id}>
                          {family.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-text-muted">
                      {
                        serviceFamilies.find(
                          (family) => family.id === form.serviceFamily
                        )?.description
                      }
                    </p>
                  </label>
                </div>
              </section>

              <section className="brand-surface rounded-3xl border p-6">
                <h2 className="text-xl font-semibold text-white">
                  Engagement shape
                </h2>
                <div className="mt-6 space-y-6">
                  <div>
                    <p className="mb-3 text-sm text-text-secondary">
                      Project type
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      {engagementTypes.map((type) => (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() =>
                            setForm((current) =>
                              current
                                ? {
                                    ...current,
                                    engagementType: type.id,
                                    includesPortalAudit:
                                      type.id === "OPTIMISATION" ||
                                      type.id === "AUDIT"
                                        ? true
                                        : current.includesPortalAudit
                                  }
                                : current
                            )
                          }
                          className={`rounded-2xl border p-4 text-left transition-colors ${
                            form.engagementType === type.id
                              ? "border-accent-solid bg-background-elevated"
                              : "border-[rgba(255,255,255,0.08)] bg-[#0b1126]"
                          }`}
                        >
                          <p className="font-semibold text-white">{type.label}</p>
                          <p className="mt-1 text-sm text-text-secondary">
                            {type.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-sm text-text-secondary">
                      Project container
                    </p>
                    <div className="grid gap-4 md:grid-cols-3">
                      {scopeTypes.map((type) => (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() =>
                            setForm((current) =>
                              current
                                ? {
                                    ...current,
                                    scopeType: type.id,
                                    selectedHubs:
                                      type.id === "standalone_quote"
                                        ? current.selectedHubs
                                        : current.selectedHubs
                                  }
                                : current
                            )
                          }
                          className={`rounded-2xl border p-4 text-left transition-colors ${
                            form.scopeType === type.id
                              ? "border-accent-solid bg-background-elevated"
                              : "border-[rgba(255,255,255,0.08)] bg-[#0b1126]"
                          }`}
                        >
                          <p className="font-semibold text-white">{type.label}</p>
                          <p className="mt-1 text-sm text-text-secondary">
                            {type.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-4 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={form.includesPortalAudit}
                      onChange={(event) =>
                        updateField("includesPortalAudit", event.target.checked)
                      }
                    />
                    Include portal audit
                  </label>
                </div>
              </section>

              <section className="brand-surface rounded-3xl border p-6">
                <h2 className="text-xl font-semibold text-white">
                  Delivery settings
                </h2>
                <div className="mt-6 grid gap-6 lg:grid-cols-[0.42fr_0.58fr]">
                  <div className="space-y-5">
                    <div>
                      <span className="mb-2 block text-sm text-text-secondary">
                        Delivery approach
                      </span>
                      <div className="grid gap-3">
                        {implementationApproachOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() =>
                              updateField("implementationApproach", option.value)
                            }
                            className={`rounded-2xl border p-4 text-left transition-colors ${
                              form.implementationApproach === option.value
                                ? "border-accent-solid bg-background-elevated"
                                : "border-[rgba(255,255,255,0.08)] bg-[#0b1126]"
                            }`}
                          >
                            <p className="font-semibold text-white">
                              {option.label}
                            </p>
                            <p className="mt-1 text-sm text-text-secondary">
                              {option.description}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-sm text-text-secondary">
                        Overall HubSpot plan tier
                      </span>
                      <select
                        value={form.customerPlatformTier}
                        onChange={(event) =>
                          updateField("customerPlatformTier", event.target.value)
                        }
                        className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                      >
                        {customerPlatformTierOptions.map((option) => (
                          <option key={option.value || "blank"} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm text-text-secondary">
                      <span>Hubs in scope</span>
                    </div>
                    <p className="mb-3 text-sm text-text-muted">
                      {form.scopeType === "standalone_quote"
                        ? "Optional for standalone quotes."
                        : "Pick the hubs this project actually covers now."}
                    </p>
                    <p className="mb-3 text-xs uppercase tracking-[0.18em] text-text-muted">
                      Core hubs
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {coreHubOptions.map((hub) => (
                        <button
                          key={hub.id}
                          type="button"
                          onClick={() => toggleHub(hub.id)}
                          className={`rounded-2xl border p-4 text-left transition-colors ${
                            form.selectedHubs.includes(hub.id)
                              ? "border-accent-solid bg-background-elevated"
                              : "border-[rgba(255,255,255,0.08)] bg-[#0b1126]"
                          }`}
                        >
                          <p className="font-semibold text-white">{hub.label}</p>
                        </button>
                      ))}
                    </div>
                    <p className="mb-3 mt-5 text-xs uppercase tracking-[0.18em] text-text-muted">
                      Add-ons in scope
                    </p>
                    <div className="grid gap-3 md:grid-cols-3">
                      {addOnHubOptions.map((hub) => (
                        <button
                          key={hub.id}
                          type="button"
                          onClick={() => toggleHub(hub.id)}
                          className={`rounded-2xl border p-4 text-left transition-colors ${
                            form.selectedHubs.includes(hub.id)
                              ? "border-accent-solid bg-background-elevated"
                              : "border-[rgba(255,255,255,0.08)] bg-[#0b1126]"
                          }`}
                        >
                          <p className="font-semibold text-white">{hub.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <aside className="space-y-6">
              <section className="brand-surface rounded-3xl border p-6">
                <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                  Current shape
                </p>
                <div className="mt-4 space-y-3 text-sm text-text-secondary">
                  <p>
                    <span className="font-medium text-white">Type:</span>{" "}
                    {formatTokenLabel(project.engagementType)}
                  </p>
                  <p>
                    <span className="font-medium text-white">Container:</span>{" "}
                    {formatTokenLabel(project.scopeType)}
                  </p>
                  <p>
                    <span className="font-medium text-white">Service family:</span>{" "}
                    {formatTokenLabel(project.serviceFamily)}
                  </p>
                  <p>
                    <span className="font-medium text-white">Hubs:</span>{" "}
                    {project.selectedHubs.length > 0
                      ? project.selectedHubs.map((hub) => formatTokenLabel(hub)).join(", ")
                      : "None"}
                  </p>
                </div>
              </section>

              <section className="brand-surface rounded-3xl border p-6">
                <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                  Save changes
                </p>
                <p className="mt-3 text-sm text-text-secondary">
                  This updates the existing project record in place.
                </p>
                {project.scopeLockedAt ? (
                  <div className="mt-4 rounded-2xl border border-[rgba(255,211,139,0.25)] bg-[rgba(255,211,139,0.08)] px-4 py-3 text-sm text-[#ffd38b]">
                    This project has a locked approved scope. If the save is blocked,
                    switch to change management for formal revisions.
                  </div>
                ) : null}
                {validationError ? (
                  <div className="mt-4 rounded-2xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-white">
                    {validationError}
                  </div>
                ) : null}
                {error ? (
                  <div className="mt-4 rounded-2xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-white">
                    {error}
                  </div>
                ) : null}
                <div className="mt-5 flex flex-col gap-3">
                  <button
                    type="submit"
                    disabled={saving || !dirty}
                    className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving..." : dirty ? "Save changes" : "No changes yet"}
                  </button>
                  <Link
                    href={`/projects/${project.id}`}
                    className="brand-input rounded-xl px-4 py-3 text-center text-sm font-medium text-text-secondary"
                  >
                    Back without saving
                  </Link>
                </div>
              </section>
            </aside>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
