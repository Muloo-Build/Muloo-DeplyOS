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
  platformConfiguration?: Array<{
    productKey: string;
    label: string;
    tier: string;
    quantity?: number | null;
    unitLabel?: string | null;
    notes?: string | null;
  }> | null;
  includesPortalAudit?: boolean;
  selectedHubs: string[];
  deliveryWorkstreams?: Array<{
    id: string;
    name: string;
    category: string;
    status: string;
    owner: string;
    summary: string;
    portalSummary?: string | null;
  }> | null;
  internalCommercials?: {
    billingRoute: string;
    partnerName?: string | null;
    notes?: string | null;
    lines: Array<{
      id: string;
      workstreamId?: string | null;
      label: string;
      pricingModel: string;
      currency: string;
      mulooBaseAmount?: number | null;
      partnerSellAmount?: number | null;
      billingOwner: string;
      notes?: string | null;
    }>;
  } | null;
  status: string;
  scopeLockedAt?: string | null;
}

interface PlatformPackageDraft {
  productKey: string;
  label: string;
  tier: string;
  quantity: string;
  unitLabel: string;
  notes: string;
}

interface WorkstreamDraft {
  id: string;
  name: string;
  category: string;
  status: string;
  owner: string;
  summary: string;
  portalSummary: string;
}

interface CommercialLineDraft {
  id: string;
  workstreamId: string;
  label: string;
  pricingModel: string;
  currency: string;
  mulooBaseAmount: string;
  partnerSellAmount: string;
  billingOwner: string;
  notes: string;
}

interface InternalCommercialsDraft {
  billingRoute: string;
  partnerName: string;
  notes: string;
  lines: CommercialLineDraft[];
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
  platformConfiguration: PlatformPackageDraft[];
  deliveryWorkstreams: WorkstreamDraft[];
  internalCommercials: InternalCommercialsDraft;
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

const hubTierOptions = [
  { value: "", label: "Not set" },
  { value: "starter", label: "Starter" },
  { value: "professional", label: "Professional" },
  { value: "enterprise", label: "Enterprise" },
  { value: "included", label: "Included" }
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

const hubProductKeyMap: Record<string, string> = {
  sales: "sales_hub",
  marketing: "marketing_hub",
  service: "service_hub",
  cms: "content_hub",
  ops: "operations_hub",
  commerce: "commerce_hub",
  data: "data_hub",
  breeze: "breeze"
};

const workstreamCategoryOptions = [
  { value: "discovery", label: "Discovery" },
  { value: "website", label: "Website" },
  { value: "hubspot_implementation", label: "HubSpot implementation" },
  { value: "other", label: "Other" }
];

const workstreamStatusOptions = [
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "complete", label: "Complete" }
];

const workstreamOwnerOptions = [
  { value: "muloo", label: "Muloo" },
  { value: "partner", label: "Partner" },
  { value: "shared", label: "Shared" }
];

const billingRouteOptions = [
  { value: "direct", label: "Direct billing" },
  { value: "partner_markup", label: "Partner markup" },
  { value: "mixed", label: "Mixed" }
];

const commercialPricingModelOptions = [
  { value: "fixed_fee", label: "Fixed fee" },
  { value: "monthly_rollout", label: "Monthly rollout" },
  { value: "license", label: "License" },
  { value: "pass_through", label: "Pass through" },
  { value: "markup", label: "Markup" },
  { value: "other", label: "Other" }
];

const commercialOwnerOptions = [
  { value: "muloo", label: "Muloo" },
  { value: "partner", label: "Partner" },
  { value: "shared", label: "Shared" }
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

function buildPackageDraft(
  productKey: string,
  label: string,
  tier = "",
  quantity?: number | null,
  unitLabel?: string | null,
  notes?: string | null
): PlatformPackageDraft {
  return {
    productKey,
    label,
    tier,
    quantity: quantity == null ? "" : String(quantity),
    unitLabel: unitLabel ?? "",
    notes: notes ?? ""
  };
}

function syncPlatformConfiguration(
  selectedHubs: string[],
  customerPlatformTier: string,
  currentPackages: PlatformPackageDraft[]
) {
  const currentByProduct = new Map(
    currentPackages.map((item) => [item.productKey, item])
  );

  return selectedHubs
    .map((hubId) => {
      const productKey = hubProductKeyMap[hubId];
      if (!productKey) {
        return null;
      }

      const existing = currentByProduct.get(productKey);
      return (
        existing ??
        buildPackageDraft(
          productKey,
          formatTokenLabel(productKey),
          productKey === "breeze" ? "included" : customerPlatformTier
        )
      );
    })
    .filter((item): item is PlatformPackageDraft => item !== null);
}

function createWorkstreamDraft(index: number): WorkstreamDraft {
  return {
    id: `workstream_${index + 1}`,
    name: "",
    category: "other",
    status: "planned",
    owner: "muloo",
    summary: "",
    portalSummary: ""
  };
}

function createCommercialLineDraft(index: number): CommercialLineDraft {
  return {
    id: `commercial_line_${index + 1}`,
    workstreamId: "",
    label: "",
    pricingModel: "fixed_fee",
    currency: "AUD",
    mulooBaseAmount: "",
    partnerSellAmount: "",
    billingOwner: "muloo",
    notes: ""
  };
}

function buildInitialForm(project: ProjectDetail): FormState {
  const platformConfiguration = syncPlatformConfiguration(
    project.selectedHubs ?? [],
    project.customerPlatformTier ?? "",
    (project.platformConfiguration ?? []).map((item) =>
      buildPackageDraft(
        item.productKey,
        item.label,
        item.tier,
        item.quantity,
        item.unitLabel,
        item.notes
      )
    )
  );

  return {
    name: project.name,
    clientName: project.clientName,
    engagementType: project.engagementType,
    scopeType: project.scopeType ?? "discovery",
    serviceFamily: project.serviceFamily,
    implementationApproach: project.implementationApproach ?? "pragmatic_poc",
    customerPlatformTier: project.customerPlatformTier ?? "",
    includesPortalAudit: Boolean(project.includesPortalAudit),
    selectedHubs: project.selectedHubs ?? [],
    platformConfiguration,
    deliveryWorkstreams:
      project.deliveryWorkstreams?.map((workstream) => ({
        id: workstream.id,
        name: workstream.name,
        category: workstream.category,
        status: workstream.status,
        owner: workstream.owner,
        summary: workstream.summary,
        portalSummary: workstream.portalSummary ?? ""
      })) ?? [],
    internalCommercials: {
      billingRoute: project.internalCommercials?.billingRoute ?? "direct",
      partnerName: project.internalCommercials?.partnerName ?? "",
      notes: project.internalCommercials?.notes ?? "",
      lines:
        project.internalCommercials?.lines.map((line) => ({
          id: line.id,
          workstreamId: line.workstreamId ?? "",
          label: line.label,
          pricingModel: line.pricingModel,
          currency: line.currency,
          mulooBaseAmount:
            line.mulooBaseAmount == null ? "" : String(line.mulooBaseAmount),
          partnerSellAmount:
            line.partnerSellAmount == null
              ? ""
              : String(line.partnerSellAmount),
          billingOwner: line.billingOwner,
          notes: line.notes ?? ""
        })) ?? []
    }
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

  useEffect(() => {
    setForm((current) => {
      if (!current) {
        return current;
      }

      const nextPackages = syncPlatformConfiguration(
        current.selectedHubs,
        current.customerPlatformTier,
        current.platformConfiguration
      );

      return JSON.stringify(nextPackages) ===
        JSON.stringify(current.platformConfiguration)
        ? current
        : {
            ...current,
            platformConfiguration: nextPackages
          };
    });
  }, [form?.selectedHubs, form?.customerPlatformTier]);

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

  function updatePackageField(
    productKey: string,
    field: keyof PlatformPackageDraft,
    value: string
  ) {
    setForm((current) =>
      current
        ? {
            ...current,
            platformConfiguration: current.platformConfiguration.map((item) =>
              item.productKey === productKey
                ? { ...item, [field]: value }
                : item
            )
          }
        : current
    );
    setValidationError(null);
    setError(null);
  }

  function updateWorkstreamField(
    workstreamId: string,
    field: keyof WorkstreamDraft,
    value: string
  ) {
    setForm((current) =>
      current
        ? {
            ...current,
            deliveryWorkstreams: current.deliveryWorkstreams.map((workstream) =>
              workstream.id === workstreamId
                ? { ...workstream, [field]: value }
                : workstream
            )
          }
        : current
    );
    setValidationError(null);
    setError(null);
  }

  function addWorkstream() {
    setForm((current) =>
      current
        ? {
            ...current,
            deliveryWorkstreams: [
              ...current.deliveryWorkstreams,
              createWorkstreamDraft(current.deliveryWorkstreams.length)
            ]
          }
        : current
    );
  }

  function removeWorkstream(workstreamId: string) {
    setForm((current) =>
      current
        ? {
            ...current,
            deliveryWorkstreams: current.deliveryWorkstreams.filter(
              (workstream) => workstream.id !== workstreamId
            ),
            internalCommercials: {
              ...current.internalCommercials,
              lines: current.internalCommercials.lines.map((line) =>
                line.workstreamId === workstreamId
                  ? { ...line, workstreamId: "" }
                  : line
              )
            }
          }
        : current
    );
  }

  function updateCommercialsField(
    field: keyof Omit<InternalCommercialsDraft, "lines">,
    value: string
  ) {
    setForm((current) =>
      current
        ? {
            ...current,
            internalCommercials: {
              ...current.internalCommercials,
              [field]: value
            }
          }
        : current
    );
  }

  function updateCommercialLineField(
    lineId: string,
    field: keyof CommercialLineDraft,
    value: string
  ) {
    setForm((current) =>
      current
        ? {
            ...current,
            internalCommercials: {
              ...current.internalCommercials,
              lines: current.internalCommercials.lines.map((line) =>
                line.id === lineId ? { ...line, [field]: value } : line
              )
            }
          }
        : current
    );
  }

  function addCommercialLine() {
    setForm((current) =>
      current
        ? {
            ...current,
            internalCommercials: {
              ...current.internalCommercials,
              lines: [
                ...current.internalCommercials.lines,
                createCommercialLineDraft(current.internalCommercials.lines.length)
              ]
            }
          }
        : current
    );
  }

  function removeCommercialLine(lineId: string) {
    setForm((current) =>
      current
        ? {
            ...current,
            internalCommercials: {
              ...current.internalCommercials,
              lines: current.internalCommercials.lines.filter(
                (line) => line.id !== lineId
              )
            }
          }
        : current
    );
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
          platformConfiguration: form.platformConfiguration.map((item) => ({
            productKey: item.productKey,
            label: item.label,
            tier: item.tier,
            quantity:
              item.quantity.trim().length > 0
                ? Number(item.quantity)
                : null,
            unitLabel: item.unitLabel,
            notes: item.notes
          })),
          platformTierSelections: Object.fromEntries(
            form.platformConfiguration
              .filter((item) => item.tier.trim().length > 0)
              .map((item) => [item.productKey, item.tier])
          ),
          includesPortalAudit: form.includesPortalAudit,
          hubs: form.selectedHubs,
          deliveryWorkstreams: form.deliveryWorkstreams,
          internalCommercials: {
            billingRoute: form.internalCommercials.billingRoute,
            partnerName: form.internalCommercials.partnerName,
            notes: form.internalCommercials.notes,
            lines: form.internalCommercials.lines.map((line) => ({
              ...line,
              workstreamId: line.workstreamId || null,
              mulooBaseAmount:
                line.mulooBaseAmount.trim().length > 0
                  ? Number(line.mulooBaseAmount)
                  : null,
              partnerSellAmount:
                line.partnerSellAmount.trim().length > 0
                  ? Number(line.partnerSellAmount)
                  : null
            }))
          }
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

                {form.platformConfiguration.length > 0 ? (
                  <div className="mt-6 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-white">
                          Hub package detail
                        </p>
                        <p className="mt-1 text-sm text-text-secondary">
                          Set the actual package per product. This is where a
                          build like Magnisol can mix Content Pro, Marketing
                          Starter, and Sales Pro with license counts.
                        </p>
                      </div>
                      <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-text-muted">
                        Operator only
                      </span>
                    </div>
                    <div className="mt-4 space-y-4">
                      {form.platformConfiguration.map((item) => (
                        <div
                          key={item.productKey}
                          className="grid gap-4 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-elevated p-4 lg:grid-cols-[minmax(0,1.1fr)_repeat(3,minmax(0,0.6fr))]"
                        >
                          <div>
                            <p className="font-medium text-white">{item.label}</p>
                            <p className="mt-1 text-xs text-text-muted">
                              {formatTokenLabel(item.productKey)}
                            </p>
                            <textarea
                              value={item.notes}
                              onChange={(event) =>
                                updatePackageField(
                                  item.productKey,
                                  "notes",
                                  event.target.value
                                )
                              }
                              placeholder="Notes, constraints, or packaging context"
                              className="mt-3 min-h-[90px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2.5 text-sm text-white outline-none"
                            />
                          </div>
                          <label className="block">
                            <span className="mb-2 block text-sm text-text-secondary">
                              Tier
                            </span>
                            <select
                              value={item.tier}
                              onChange={(event) =>
                                updatePackageField(
                                  item.productKey,
                                  "tier",
                                  event.target.value
                                )
                              }
                              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2.5 text-white outline-none"
                            >
                              {hubTierOptions.map((option) => (
                                <option
                                  key={`${item.productKey}-${option.value || "blank"}`}
                                  value={option.value}
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-sm text-text-secondary">
                              Quantity
                            </span>
                            <input
                              value={item.quantity}
                              onChange={(event) =>
                                updatePackageField(
                                  item.productKey,
                                  "quantity",
                                  event.target.value
                                )
                              }
                              placeholder="1"
                              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2.5 text-white outline-none"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-sm text-text-secondary">
                              Unit label
                            </span>
                            <input
                              value={item.unitLabel}
                              onChange={(event) =>
                                updatePackageField(
                                  item.productKey,
                                  "unitLabel",
                                  event.target.value
                                )
                              }
                              placeholder="licenses"
                              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2.5 text-white outline-none"
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="brand-surface rounded-3xl border p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      Delivery workstreams
                    </h2>
                    <p className="mt-2 text-sm text-text-secondary">
                      Model one project as multiple overlapping streams so
                      discovery, website, and HubSpot implementation can stay
                      together without flattening the delivery shape.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addWorkstream}
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-2 text-sm font-medium text-white"
                  >
                    Add workstream
                  </button>
                </div>
                <div className="mt-6 space-y-4">
                  {form.deliveryWorkstreams.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.12)] bg-[#0b1126] p-5 text-sm text-text-secondary">
                      No workstreams yet. For Magnisol you’d typically break
                      this into Discovery, Website, and HubSpot implementation.
                    </div>
                  ) : (
                    form.deliveryWorkstreams.map((workstream) => (
                      <div
                        key={workstream.id}
                        className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="grid flex-1 gap-4 lg:grid-cols-2">
                            <label className="block">
                              <span className="mb-2 block text-sm text-text-secondary">
                                Workstream name
                              </span>
                              <input
                                value={workstream.name}
                                onChange={(event) =>
                                  updateWorkstreamField(
                                    workstream.id,
                                    "name",
                                    event.target.value
                                  )
                                }
                                placeholder="Discovery"
                                className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-elevated px-4 py-3 text-white outline-none"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-2 block text-sm text-text-secondary">
                                Category
                              </span>
                              <select
                                value={workstream.category}
                                onChange={(event) =>
                                  updateWorkstreamField(
                                    workstream.id,
                                    "category",
                                    event.target.value
                                  )
                                }
                                className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-elevated px-4 py-3 text-white outline-none"
                              >
                                {workstreamCategoryOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="mb-2 block text-sm text-text-secondary">
                                Status
                              </span>
                              <select
                                value={workstream.status}
                                onChange={(event) =>
                                  updateWorkstreamField(
                                    workstream.id,
                                    "status",
                                    event.target.value
                                  )
                                }
                                className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-elevated px-4 py-3 text-white outline-none"
                              >
                                {workstreamStatusOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="mb-2 block text-sm text-text-secondary">
                                Delivery owner
                              </span>
                              <select
                                value={workstream.owner}
                                onChange={(event) =>
                                  updateWorkstreamField(
                                    workstream.id,
                                    "owner",
                                    event.target.value
                                  )
                                }
                                className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-elevated px-4 py-3 text-white outline-none"
                              >
                                {workstreamOwnerOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeWorkstream(workstream.id)}
                            className="rounded-xl border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-text-secondary hover:text-white"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          <label className="block">
                            <span className="mb-2 block text-sm text-text-secondary">
                              Internal summary
                            </span>
                            <textarea
                              value={workstream.summary}
                              onChange={(event) =>
                                updateWorkstreamField(
                                  workstream.id,
                                  "summary",
                                  event.target.value
                                )
                              }
                              placeholder="What this stream covers internally"
                              className="min-h-[120px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-elevated px-4 py-3 text-white outline-none"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-sm text-text-secondary">
                              Portal summary
                            </span>
                            <textarea
                              value={workstream.portalSummary}
                              onChange={(event) =>
                                updateWorkstreamField(
                                  workstream.id,
                                  "portalSummary",
                                  event.target.value
                                )
                              }
                              placeholder="What client and partner portal users should see"
                              className="min-h-[120px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-elevated px-4 py-3 text-white outline-none"
                            />
                          </label>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="brand-surface rounded-3xl border p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold text-white">
                        Internal commercials
                      </h2>
                      <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-text-muted">
                        Internal only
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-text-secondary">
                      Track Muloo base numbers and partner-marked-up numbers here.
                      These figures stay on the operator side and never show in
                      the client or partner portals.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addCommercialLine}
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-2 text-sm font-medium text-white"
                  >
                    Add commercial line
                  </button>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                  <label className="block">
                    <span className="mb-2 block text-sm text-text-secondary">
                      Billing route
                    </span>
                    <select
                      value={form.internalCommercials.billingRoute}
                      onChange={(event) =>
                        updateCommercialsField("billingRoute", event.target.value)
                      }
                      className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none"
                    >
                      {billingRouteOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm text-text-secondary">
                      Partner name
                    </span>
                    <input
                      value={form.internalCommercials.partnerName}
                      onChange={(event) =>
                        updateCommercialsField("partnerName", event.target.value)
                      }
                      placeholder="Tusk"
                      className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm text-text-secondary">
                      Notes
                    </span>
                    <input
                      value={form.internalCommercials.notes}
                      onChange={(event) =>
                        updateCommercialsField("notes", event.target.value)
                      }
                      placeholder="Markup handled through partner"
                      className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none"
                    />
                  </label>
                </div>

                <div className="mt-6 space-y-4">
                  {form.internalCommercials.lines.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.12)] bg-[#0b1126] p-5 text-sm text-text-secondary">
                      No commercial lines yet. Add the streams you want to track,
                      like Discovery fixed fee, Website build, HubSpot rollout,
                      pass-through theme cost, or partner markup lines.
                    </div>
                  ) : (
                    form.internalCommercials.lines.map((line) => (
                      <div
                        key={line.id}
                        className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="grid flex-1 gap-4 lg:grid-cols-3">
                            <label className="block lg:col-span-2">
                              <span className="mb-2 block text-sm text-text-secondary">
                                Line item
                              </span>
                              <input
                                value={line.label}
                                onChange={(event) =>
                                  updateCommercialLineField(
                                    line.id,
                                    "label",
                                    event.target.value
                                  )
                                }
                                placeholder="HubSpot rollout"
                                className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-elevated px-4 py-3 text-white outline-none"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-2 block text-sm text-text-secondary">
                                Workstream
                              </span>
                              <select
                                value={line.workstreamId}
                                onChange={(event) =>
                                  updateCommercialLineField(
                                    line.id,
                                    "workstreamId",
                                    event.target.value
                                  )
                                }
                                className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-elevated px-4 py-3 text-white outline-none"
                              >
                                <option value="">Unlinked</option>
                                {form.deliveryWorkstreams.map((workstream) => (
                                  <option
                                    key={workstream.id}
                                    value={workstream.id}
                                  >
                                    {workstream.name || workstream.id}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="mb-2 block text-sm text-text-secondary">
                                Pricing model
                              </span>
                              <select
                                value={line.pricingModel}
                                onChange={(event) =>
                                  updateCommercialLineField(
                                    line.id,
                                    "pricingModel",
                                    event.target.value
                                  )
                                }
                                className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-elevated px-4 py-3 text-white outline-none"
                              >
                                {commercialPricingModelOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="mb-2 block text-sm text-text-secondary">
                                Currency
                              </span>
                              <input
                                value={line.currency}
                                onChange={(event) =>
                                  updateCommercialLineField(
                                    line.id,
                                    "currency",
                                    event.target.value.toUpperCase()
                                  )
                                }
                                className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-elevated px-4 py-3 text-white outline-none"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-2 block text-sm text-text-secondary">
                                Muloo base
                              </span>
                              <input
                                value={line.mulooBaseAmount}
                                onChange={(event) =>
                                  updateCommercialLineField(
                                    line.id,
                                    "mulooBaseAmount",
                                    event.target.value
                                  )
                                }
                                placeholder="12000"
                                className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-elevated px-4 py-3 text-white outline-none"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-2 block text-sm text-text-secondary">
                                Partner sell / markup
                              </span>
                              <input
                                value={line.partnerSellAmount}
                                onChange={(event) =>
                                  updateCommercialLineField(
                                    line.id,
                                    "partnerSellAmount",
                                    event.target.value
                                  )
                                }
                                placeholder="15000"
                                className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-elevated px-4 py-3 text-white outline-none"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-2 block text-sm text-text-secondary">
                                Billing owner
                              </span>
                              <select
                                value={line.billingOwner}
                                onChange={(event) =>
                                  updateCommercialLineField(
                                    line.id,
                                    "billingOwner",
                                    event.target.value
                                  )
                                }
                                className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-elevated px-4 py-3 text-white outline-none"
                              >
                                {commercialOwnerOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCommercialLine(line.id)}
                            className="rounded-xl border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-text-secondary hover:text-white"
                          >
                            Remove
                          </button>
                        </div>
                        <label className="mt-4 block">
                          <span className="mb-2 block text-sm text-text-secondary">
                            Notes
                          </span>
                          <textarea
                            value={line.notes}
                            onChange={(event) =>
                              updateCommercialLineField(
                                line.id,
                                "notes",
                                event.target.value
                              )
                            }
                            placeholder="Internal-only context for billing, pass-throughs, or partner handling"
                            className="min-h-[100px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-elevated px-4 py-3 text-white outline-none"
                          />
                        </label>
                      </div>
                    ))
                  )}
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
