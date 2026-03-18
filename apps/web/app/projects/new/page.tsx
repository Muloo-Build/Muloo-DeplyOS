"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import AppShell from "../../components/AppShell";

interface FormData {
  projectName: string;
  clientName: string;
  owner: string;
  ownerEmail: string;
  scopeType: string;
  commercialBrief: string;
  industry: string;
  website: string;
  additionalWebsitesText: string;
  linkedinUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  xUrl: string;
  youtubeUrl: string;
  clientChampionFirstName: string;
  clientChampionLastName: string;
  clientChampionEmail: string;
  engagementType: string;
  hubsInScope: string[];
  useTemplate: boolean;
  templateId: string;
}

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

const engagementTypes = [
  {
    id: "IMPLEMENTATION",
    label: "Implementation",
    description: "New HubSpot build or onboarding delivery"
  },
  {
    id: "MIGRATION",
    label: "Migration",
    description: "Move from another CRM into HubSpot"
  },
  {
    id: "OPTIMISATION",
    label: "Optimisation",
    description: "Improve an existing HubSpot setup"
  },
  {
    id: "AUDIT",
    label: "Audit",
    description: "Assess current setup and recommend next steps"
  },
  {
    id: "GUIDED_DEPLOYMENT",
    label: "Guided Deployment",
    description: "Partnered rollout with close client involvement"
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

const industryOptions = [
  "Accounting & Advisory",
  "Agency & Professional Services",
  "Construction & Property",
  "Education & Training",
  "Financial Services",
  "Healthcare",
  "Legal",
  "Manufacturing",
  "Nonprofit",
  "Retail & Ecommerce",
  "SaaS & Technology",
  "Travel & Hospitality",
  "Other"
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
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [formData, setFormData] = useState<FormData>({
    projectName: "",
    clientName: "",
    owner: "",
    ownerEmail: "",
    scopeType: "discovery",
    commercialBrief: "",
    industry: "",
    website: "",
    additionalWebsitesText: "",
    linkedinUrl: "",
    facebookUrl: "",
    instagramUrl: "",
    xUrl: "",
    youtubeUrl: "",
    clientChampionFirstName: "",
    clientChampionLastName: "",
    clientChampionEmail: "",
    engagementType: "IMPLEMENTATION",
    hubsInScope: [],
    useTemplate: false,
    templateId: ""
  });

  useEffect(() => {
    async function loadUsers() {
      try {
        const response = await fetch("/api/users");

        if (!response.ok) {
          throw new Error("Failed to load users");
        }

        const body = await response.json();
        const users = body.users ?? [];

        setTeamUsers(users);
        setFormData((current) => ({
          ...current,
          owner: current.owner || users[0]?.name || "",
          ownerEmail: current.ownerEmail || users[0]?.email || ""
        }));
      } catch {
        // Keep project creation usable even if the team list is unavailable.
      }
    }

    void loadUsers();
  }, []);

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

  function selectOwner(ownerName: string) {
    const selectedOwner = teamUsers.find((user) => user.name === ownerName);

    setFormData((current) => ({
      ...current,
      owner: ownerName,
      ownerEmail: selectedOwner?.email ?? current.ownerEmail
    }));
  }

  const canContinueFromStep1 =
    formData.projectName.trim().length > 0 &&
    formData.clientName.trim().length > 0 &&
    formData.clientChampionFirstName.trim().length > 0 &&
    formData.clientChampionLastName.trim().length > 0 &&
    formData.clientChampionEmail.trim().length > 0;
  const canContinueFromStep2 =
    formData.scopeType === "standalone_quote"
      ? formData.commercialBrief.trim().length > 0
      : formData.hubsInScope.length > 0;

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    const moduleSelection = buildModuleSelection(formData.hubsInScope);
    const payload = {
      name: formData.projectName.trim(),
      clientName: formData.clientName.trim(),
      selectedHubs: formData.hubsInScope,
      engagementType: formData.engagementType,
      owner: formData.owner,
      ownerEmail: formData.ownerEmail,
      scopeType: formData.scopeType,
      commercialBrief: formData.commercialBrief.trim(),
      industry: formData.industry,
      website: formData.website.trim(),
      additionalWebsites: formData.additionalWebsitesText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      linkedinUrl: formData.linkedinUrl.trim(),
      facebookUrl: formData.facebookUrl.trim(),
      instagramUrl: formData.instagramUrl.trim(),
      xUrl: formData.xUrl.trim(),
      youtubeUrl: formData.youtubeUrl.trim(),
      clientChampionFirstName: formData.clientChampionFirstName.trim(),
      clientChampionLastName: formData.clientChampionLastName.trim(),
      clientChampionEmail: formData.clientChampionEmail.trim(),
      moduleSelection
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
                Project + Client
              </h2>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="md:col-span-2">
                  <p className="mb-3 text-sm text-text-secondary">
                    Engagement container
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      [
                        "discovery",
                        "Discovery-led implementation",
                        "Use Muloo discovery, scoped recommendations, and a phased quote."
                      ],
                      [
                        "standalone_quote",
                        "Standalone quote job",
                        "Capture a specific job brief and quote it without a full discovery cycle."
                      ]
                    ].map(([value, label, description]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updateField("scopeType", value)}
                        className={`rounded-2xl border p-4 text-left transition-colors ${
                          formData.scopeType === value
                            ? "border-accent-solid bg-background-elevated"
                            : "border-[rgba(255,255,255,0.08)] bg-[#0b1126]"
                        }`}
                      >
                        <p className="font-semibold text-white">{label}</p>
                        <p className="mt-1 text-sm text-text-secondary">
                          {description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm text-text-secondary">
                    Project name
                  </span>
                  <input
                    value={formData.projectName}
                    onChange={(event) =>
                      updateField("projectName", event.target.value)
                    }
                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                  />
                </label>

                <label className="block md:col-span-2">
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

                {formData.scopeType === "standalone_quote" ? (
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm text-text-secondary">
                      Job / scope brief
                    </span>
                    <textarea
                      value={formData.commercialBrief}
                      onChange={(event) =>
                        updateField("commercialBrief", event.target.value)
                      }
                      placeholder="Describe the standalone job, deliverables, desired outcomes, and any pricing context."
                      className="min-h-[140px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                    />
                  </label>
                ) : null}

                <label className="block">
                  <span className="mb-2 block text-sm text-text-secondary">
                    Project owner
                  </span>
                  <select
                    value={formData.owner}
                    onChange={(event) => selectOwner(event.target.value)}
                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                  >
                    {teamUsers.map((user) => (
                      <option key={user.id} value={user.name}>
                        {user.name} - {user.role}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-text-secondary">
                    Owner email
                  </span>
                  <input
                    value={formData.ownerEmail}
                    readOnly
                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-white outline-none"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm text-text-secondary">
                    Industry
                  </span>
                  <select
                    value={formData.industry}
                    onChange={(event) =>
                      updateField("industry", event.target.value)
                    }
                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                  >
                    <option value="">Select industry</option>
                    {industryOptions.map((industry) => (
                      <option key={industry} value={industry}>
                        {industry}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm text-text-secondary">
                    Primary website
                  </span>
                  <input
                    value={formData.website}
                    onChange={(event) =>
                      updateField("website", event.target.value)
                    }
                    placeholder="https://example.com"
                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm text-text-secondary">
                    Additional websites
                  </span>
                  <textarea
                    value={formData.additionalWebsitesText}
                    onChange={(event) =>
                      updateField("additionalWebsitesText", event.target.value)
                    }
                    placeholder={"One URL per line"}
                    className="min-h-[120px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-text-secondary">
                    LinkedIn
                  </span>
                  <input
                    value={formData.linkedinUrl}
                    onChange={(event) =>
                      updateField("linkedinUrl", event.target.value)
                    }
                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-text-secondary">
                    Facebook
                  </span>
                  <input
                    value={formData.facebookUrl}
                    onChange={(event) =>
                      updateField("facebookUrl", event.target.value)
                    }
                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-text-secondary">
                    Instagram
                  </span>
                  <input
                    value={formData.instagramUrl}
                    onChange={(event) =>
                      updateField("instagramUrl", event.target.value)
                    }
                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-text-secondary">
                    X / Twitter
                  </span>
                  <input
                    value={formData.xUrl}
                    onChange={(event) => updateField("xUrl", event.target.value)}
                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm text-text-secondary">
                    YouTube
                  </span>
                  <input
                    value={formData.youtubeUrl}
                    onChange={(event) =>
                      updateField("youtubeUrl", event.target.value)
                    }
                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-text-secondary">
                    Client champion first name
                  </span>
                  <input
                    value={formData.clientChampionFirstName}
                    onChange={(event) =>
                      updateField("clientChampionFirstName", event.target.value)
                    }
                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-text-secondary">
                    Client champion last name
                  </span>
                  <input
                    value={formData.clientChampionLastName}
                    onChange={(event) =>
                      updateField("clientChampionLastName", event.target.value)
                    }
                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm text-text-secondary">
                    Client champion email
                  </span>
                  <input
                    type="email"
                    value={formData.clientChampionEmail}
                    onChange={(event) =>
                      updateField("clientChampionEmail", event.target.value)
                    }
                    className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                  />
                </label>
              </div>
            </div>
          ) : null}

          {currentStep === 2 ? (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white">
                Engagement + Scope
              </h2>

              <div>
                <p className="mb-3 text-sm text-text-secondary">
                  Engagement type
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  {engagementTypes.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => updateField("engagementType", type.id)}
                      className={`rounded-2xl border p-4 text-left transition-colors ${
                        formData.engagementType === type.id
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
                <p className="mb-3 text-sm text-text-secondary">Hubs in scope</p>
                <p className="mb-3 text-sm text-text-muted">
                  {formData.scopeType === "standalone_quote"
                    ? "Optional for standalone quotes. Use hubs only if they help frame the quoted work."
                    : "Select the hubs or work areas expected in scope."}
                </p>
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
              </div>

              {formData.scopeType !== "standalone_quote" ? (
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
              ) : null}

              {formData.useTemplate && formData.scopeType !== "standalone_quote" ? (
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
                  ["Project", formData.projectName],
                  ["Client", formData.clientName],
                  [
                    "Container",
                    formData.scopeType === "standalone_quote"
                      ? "Standalone quote"
                      : "Discovery-led implementation"
                  ],
                  ["Industry", formData.industry],
                  ["Website", formData.website],
                  ["Champion first name", formData.clientChampionFirstName],
                  ["Champion last name", formData.clientChampionLastName],
                  ["Champion email", formData.clientChampionEmail],
                  [
                    "Engagement type",
                    engagementTypes.find(
                      (item) => item.id === formData.engagementType
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

              {formData.commercialBrief ? (
                <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                    Job / scope brief
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-white">
                    {formData.commercialBrief}
                  </p>
                </div>
              ) : null}

              <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                  Hubs in scope
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {formData.hubsInScope.length > 0 ? formData.hubsInScope.map((hub) => (
                    <span
                      key={hub}
                      className="rounded bg-[rgba(224,82,156,0.15)] px-2 py-1 text-xs font-medium text-accent-solid"
                    >
                      {hub}
                    </span>
                  )) : <span className="text-text-secondary">No hubs selected</span>}
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
              disabled={
                (currentStep === 1 && !canContinueFromStep1) ||
                (currentStep === 2 && !canContinueFromStep2)
              }
              className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
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
