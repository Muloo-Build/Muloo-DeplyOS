"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import AppShell from "../../components/AppShell";

interface FormData {
  clientName: string;
  industry: string;
  region: string;
  portalId: string;
  environment: string;
  implementationType: string;
  hubsInScope: string[];
  useTemplate: boolean;
  templateId: string;
}

const implementationTypes = [
  {
    id: "sales-hub-foundation",
    label: "Sales Hub Foundation",
    description: "Core sales CRM setup"
  },
  {
    id: "marketing-ops-rollout",
    label: "Marketing Ops Rollout",
    description: "Campaign and lifecycle operations setup"
  },
  {
    id: "service-hub-enablement",
    label: "Service Hub Enablement",
    description: "Customer support setup"
  },
  {
    id: "multi-hub-implementation",
    label: "Multi-Hub Implementation",
    description: "Cross-hub implementation"
  }
];

const hubOptions = [
  { id: "sales", label: "Sales Hub" },
  { id: "marketing", label: "Marketing Hub" },
  { id: "service", label: "Service Hub" },
  { id: "cms", label: "CMS / Website" },
  { id: "ops", label: "Operations Hub" }
];

const templates = [
  { id: "muloo-sales-foundation", label: "Sales Foundation" },
  { id: "muloo-revops-foundation", label: "RevOps Foundation" },
  { id: "muloo-service-foundation", label: "Service Foundation" }
];

function buildModuleSelection(hubsInScope: string[]) {
  const modules = ["crm-setup", "qa"];

  if (hubsInScope.length > 0) {
    modules.push("properties");
  }

  if (hubsInScope.includes("sales") || hubsInScope.includes("service")) {
    modules.push("pipelines");
  }

  if (hubsInScope.includes("marketing") || hubsInScope.includes("ops")) {
    modules.push("automation", "reporting");
  }

  return Array.from(new Set(modules)).map((moduleId, index) => ({
    moduleId,
    status: index === 0 ? "ready" : "planned",
    dependencies:
      moduleId === "qa" ? modules.filter((item) => item !== "qa") : []
  }));
}

export default function NewProjectPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    clientName: "",
    industry: "",
    region: "",
    portalId: "",
    environment: "sandbox",
    implementationType: "multi-hub-implementation",
    hubsInScope: [],
    useTemplate: false,
    templateId: ""
  });

  function updateField(
    field: keyof FormData,
    value: string | boolean | string[]
  ) {
    setFormData((current) => ({ ...current, [field]: value }));
  }

  function toggleHub(hubId: string) {
    setFormData((current) => ({
      ...current,
      hubsInScope: current.hubsInScope.includes(hubId)
        ? current.hubsInScope.filter((hub) => hub !== hubId)
        : [...current.hubsInScope, hubId]
    }));
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    const projectId = `project-${Date.now()}`;
    const clientId = `client-${Date.now()}`;
    const moduleSelection = buildModuleSelection(formData.hubsInScope);
    const payload = {
      id: projectId,
      name: `${formData.clientName} Implementation`,
      clientId,
      portalId: formData.portalId,
      owner: {
        name: "Muloo Operator",
        email: "operator@muloo.com"
      },
      clientContext: {
        clientName: formData.clientName,
        primaryRegion: formData.region,
        implementationType: formData.implementationType,
        notes: `${formData.industry || "General"} implementation`
      },
      hubspotScope: {
        hubsInScope: formData.hubsInScope,
        environment: formData.environment
      },
      moduleSelection,
      status: "draft"
    };

    try {
      const response = await fetch(
        formData.useTemplate && formData.templateId
          ? "/api/projects/from-template"
          : "/api/projects",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            formData.useTemplate && formData.templateId
              ? { ...payload, templateId: formData.templateId }
              : payload
          )
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to create project");
      }

      const body = await response.json();
      router.push(`/projects/${body.project.id}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create project"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-8 max-w-4xl">
          <p className="text-sm uppercase tracking-[0.25em] text-text-muted">
            Project setup
          </p>
          <h1 className="mt-3 text-3xl font-bold font-heading text-white">
            New Project
          </h1>
          <p className="mt-2 text-text-secondary">
            Create the delivery container first, then capture discovery and
            shape the implementation plan.
          </p>
        </div>

        <div className="mb-8 flex max-w-3xl items-center gap-4">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center gap-4">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                  step <= currentStep
                    ? "bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] text-white"
                    : "border border-[rgba(255,255,255,0.08)] bg-background-card text-text-muted"
                }`}
              >
                {step}
              </div>
              {step < 3 ? (
                <div
                  className={`h-px w-16 ${
                    step < currentStep
                      ? "bg-accent-solid"
                      : "bg-[rgba(255,255,255,0.08)]"
                  }`}
                />
              ) : null}
            </div>
          ))}
        </div>

        <div className="max-w-3xl rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-8">
          {currentStep === 1 ? (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white">
                Client + Portal
              </h2>

              <div className="grid gap-6 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-text-secondary">
                    Client name
                  </span>
                  <input
                    value={formData.clientName}
                    onChange={(event) =>
                      updateField("clientName", event.target.value)
                    }
                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-text-secondary">
                    Region
                  </span>
                  <input
                    value={formData.region}
                    onChange={(event) =>
                      updateField("region", event.target.value)
                    }
                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-text-secondary">
                    Industry
                  </span>
                  <input
                    value={formData.industry}
                    onChange={(event) =>
                      updateField("industry", event.target.value)
                    }
                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-text-secondary">
                    HubSpot portal ID
                  </span>
                  <input
                    value={formData.portalId}
                    onChange={(event) =>
                      updateField("portalId", event.target.value)
                    }
                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                  />
                </label>
              </div>

              <div>
                <p className="mb-3 text-sm text-text-secondary">Environment</p>
                <div className="flex gap-3">
                  {["sandbox", "production"].map((environment) => (
                    <button
                      key={environment}
                      type="button"
                      onClick={() => updateField("environment", environment)}
                      className={`rounded-xl px-4 py-3 text-sm font-medium capitalize ${
                        formData.environment === environment
                          ? "bg-background-elevated text-white"
                          : "border border-[rgba(255,255,255,0.08)] bg-[#0b1126] text-text-secondary"
                      }`}
                    >
                      {environment}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm text-text-secondary">
                  Implementation type
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  {implementationTypes.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => updateField("implementationType", type.id)}
                      className={`rounded-2xl border p-4 text-left transition-colors ${
                        formData.implementationType === type.id
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
            </div>
          ) : null}

          {currentStep === 2 ? (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white">Scope</h2>

              <div className="grid gap-4 md:grid-cols-2">
                {hubOptions.map((hub) => (
                  <button
                    key={hub.id}
                    type="button"
                    onClick={() => toggleHub(hub.id)}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      formData.hubsInScope.includes(hub.id)
                        ? "border-accent-solid bg-background-elevated"
                        : "border-[rgba(255,255,255,0.08)] bg-[#0b1126]"
                    }`}
                  >
                    <p className="font-semibold text-white">{hub.label}</p>
                    <p className="mt-1 text-sm text-text-secondary">{hub.id}</p>
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4">
                <input
                  type="checkbox"
                  checked={formData.useTemplate}
                  onChange={(event) =>
                    updateField("useTemplate", event.target.checked)
                  }
                />
                <span className="text-white">Start from a Muloo template</span>
              </label>

              {formData.useTemplate ? (
                <label className="block">
                  <span className="mb-2 block text-sm text-text-secondary">
                    Template
                  </span>
                  <select
                    value={formData.templateId}
                    onChange={(event) =>
                      updateField("templateId", event.target.value)
                    }
                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                  >
                    <option value="">Select template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}

          {currentStep === 3 ? (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white">Review</h2>

              <div className="grid gap-4 md:grid-cols-2">
                {[
                  ["Client", formData.clientName],
                  ["Region", formData.region],
                  ["Industry", formData.industry],
                  ["Portal ID", formData.portalId],
                  ["Environment", formData.environment],
                  [
                    "Implementation type",
                    implementationTypes.find(
                      (item) => item.id === formData.implementationType
                    )?.label ?? ""
                  ]
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                      {label}
                    </p>
                    <p className="mt-2 text-white">{value || "Not set"}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                  Hubs in scope
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {formData.hubsInScope.map((hub) => (
                    <span
                      key={hub}
                      className="rounded bg-[rgba(224,82,156,0.15)] px-2 py-1 text-xs font-medium text-accent-solid"
                    >
                      {hub}
                    </span>
                  ))}
                </div>
              </div>

              {error ? (
                <div className="rounded-xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
                  {error}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex max-w-3xl justify-between">
          <button
            type="button"
            onClick={() => setCurrentStep((step) => Math.max(1, step - 1))}
            className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-5 py-3 text-sm font-medium text-white"
          >
            Previous
          </button>

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((step) => Math.min(3, step + 1))}
              className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-semibold text-white"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Creating..." : "Create Project"}
            </button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
