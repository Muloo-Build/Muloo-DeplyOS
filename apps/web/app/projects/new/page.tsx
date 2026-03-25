"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import AppShell from "../../components/AppShell";

interface FormData {
  projectName: string;
  clientName: string;
  owner: string;
  ownerEmail: string;
  serviceFamily: string;
  implementationApproach: string;
  scopeType: string;
  deliveryTemplateId: string;
  commercialBrief: string;
  problemStatement: string;
  solutionRecommendation: string;
  scopeExecutiveSummary: string;
  customerPlatformTier: string;
  platformTierSelections: Record<string, string>;
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

interface DeliveryTemplateSummary {
  id: string;
  name: string;
  description?: string | null;
  serviceFamily: string;
  scopeType: string;
  category: string;
  defaultPlannedHours?: number | null;
}

interface ClientLookupRecord {
  id: string;
  name: string;
  slug: string;
  hubSpotPortal?: {
    id: string;
    portalId: string;
    displayName: string;
    connected: boolean;
  } | null;
}

interface PortalSnapshot {
  hubTier: string | null;
  activeHubs: string[];
}

interface SolutionOption {
  title: string;
  summary: string;
  rationale: string;
  recommendedScopeType: string;
  recommendedEngagementType: string;
  recommendedServiceFamily: string;
  recommendedHubs: string[];
  recommendedCustomerPlatformTier: string;
  recommendedPlatformTierSelections: Record<string, string>;
  jobSpecSeed: string;
  executiveSummary: string;
}

const serviceFamilies = [
  {
    id: "hubspot_architecture",
    label: "HubSpot Architecture",
    description: "Portal design, implementation, optimization, and delivery."
  },
  {
    id: "custom_engineering",
    label: "Custom Engineering",
    description: "CMS, integration, website, and technical implementation work."
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

const allHubOptions = [...coreHubOptions, ...addOnHubOptions];

const customerPlatformTierOptions = [
  { value: "", label: "Select plan tier" },
  { value: "free", label: "Free" },
  { value: "starter", label: "Starter" },
  { value: "professional", label: "Professional" },
  { value: "enterprise", label: "Enterprise" }
];

const implementationApproachOptions = [
  {
    value: "pragmatic_poc",
    label: "Pragmatic / POC",
    description:
      "Use a lean Phase 1 path and allow external workaround architecture where sensible."
  },
  {
    value: "best_practice",
    label: "Best-practice / scalable",
    description:
      "Prefer the cleaner long-term architecture even if it needs more packaging or effort."
  }
];

const templates = [
  { id: "muloo-sales-foundation", label: "Sales Foundation" },
  { id: "muloo-revops-foundation", label: "RevOps Foundation" },
  { id: "muloo-service-foundation", label: "Service Foundation" }
];

const projectContainerOptions = [
  {
    value: "discovery",
    label: "Discovery-led implementation",
    description:
      "Use Muloo discovery, scoped recommendations, and a phased quote.",
    engagementType: "IMPLEMENTATION"
  },
  {
    value: "standalone_quote",
    label: "Standalone quote job",
    description:
      "Capture a specific job brief and quote it without a full discovery cycle.",
    engagementType: null
  },
  {
    value: "optimisation",
    label: "HubSpot Optimisation / Revamp",
    description:
      "Audit an existing portal, identify quick wins, and deliver structured improvements.",
    engagementType: "OPTIMISATION"
  }
] as const;

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

  if (hubsInScope.includes("data")) {
    modules.push("reporting", "qa");
  }

  if (hubsInScope.includes("commerce")) {
    modules.push("properties", "qa");
  }

  return Array.from(new Set(modules)).map((moduleId, index) => ({
    moduleId,
    status: index === 0 ? "ready" : "planned",
    dependencies:
      moduleId === "qa" ? modules.filter((item) => item !== "qa") : []
  }));
}

function formatEngagementType(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function formatTierLabel(value: string) {
  if (!value) {
    return "Not set";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatContainerLabel(value: string) {
  return (
    projectContainerOptions.find((option) => option.value === value)?.label ??
    value
  );
}

function createClientLookupKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeDetectedTier(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (["free", "starter", "professional", "enterprise"].includes(normalized)) {
    return normalized;
  }

  if (normalized.includes("enterprise")) {
    return "enterprise";
  }

  if (normalized.includes("professional") || normalized.includes("pro")) {
    return "professional";
  }

  if (normalized.includes("starter")) {
    return "starter";
  }

  if (normalized.includes("free")) {
    return "free";
  }

  return "";
}

function normalizeDetectedHubs(activeHubs: string[]) {
  return Array.from(
    new Set(
      activeHubs.flatMap((hub) => {
        const normalized = hub
          .trim()
          .toLowerCase()
          .replace(/[\s/]+/g, "_");

        if (normalized.includes("sales")) {
          return ["sales"];
        }

        if (normalized.includes("marketing")) {
          return ["marketing"];
        }

        if (normalized.includes("service")) {
          return ["service"];
        }

        if (normalized.includes("content") || normalized.includes("cms")) {
          return ["cms"];
        }

        if (normalized.includes("operations") || normalized === "ops") {
          return ["ops"];
        }

        if (normalized.includes("commerce")) {
          return ["commerce"];
        }

        if (normalized.includes("data")) {
          return ["data"];
        }

        if (normalized.includes("breeze")) {
          return ["breeze"];
        }

        return [];
      })
    )
  );
}

function buildCompatibilityPlatformTierSelections(
  hubsInScope: string[],
  customerPlatformTier: string
) {
  const selections: Record<string, string> = {};
  const normalizedTier = customerPlatformTier.trim().toLowerCase();
  const hubProductMap: Record<string, string> = {
    sales: "sales_hub",
    marketing: "marketing_hub",
    service: "service_hub",
    cms: "content_hub",
    ops: "operations_hub",
    commerce: "commerce_hub",
    data: "data_hub"
  };

  for (const hub of hubsInScope) {
    if (hub === "breeze") {
      selections.breeze = "included";
      continue;
    }

    const productKey = hubProductMap[hub];
    if (productKey && normalizedTier) {
      selections[productKey] = normalizedTier;
    }
  }

  return selections;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [clients, setClients] = useState<ClientLookupRecord[]>([]);
  const [deliveryTemplates, setDeliveryTemplates] = useState<
    DeliveryTemplateSummary[]
  >([]);
  const [solutionOptions, setSolutionOptions] = useState<SolutionOption[]>([]);
  const [solutionBusy, setSolutionBusy] = useState(false);
  const [solutionError, setSolutionError] = useState<string | null>(null);
  const [detectedPortalName, setDetectedPortalName] = useState<string | null>(
    null
  );
  const [detectedPortalTier, setDetectedPortalTier] = useState("");
  const [detectedPortalHubs, setDetectedPortalHubs] = useState<string[]>([]);
  const [selectedSolutionTitle, setSelectedSolutionTitle] = useState<
    string | null
  >(null);
  const [formData, setFormData] = useState<FormData>({
    projectName: "",
    clientName: "",
    owner: "",
    ownerEmail: "",
    serviceFamily: "hubspot_architecture",
    implementationApproach: "pragmatic_poc",
    scopeType: "discovery",
    deliveryTemplateId: "",
    commercialBrief: "",
    problemStatement: "",
    solutionRecommendation: "",
    scopeExecutiveSummary: "",
    customerPlatformTier: "",
    platformTierSelections: {},
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

  useEffect(() => {
    async function loadClients() {
      try {
        const response = await fetch("/api/clients");

        if (!response.ok) {
          throw new Error("Failed to load clients");
        }

        const body = await response.json();
        setClients(body.clients ?? []);
      } catch {
        // Keep project creation usable even if the client directory is unavailable.
      }
    }

    void loadClients();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestType = params.get("requestType");
    const title = params.get("title");
    const clientName = params.get("clientName");
    const contactName = params.get("contactName");
    const contactEmail = params.get("contactEmail");
    const portalOrWebsite = params.get("portalOrWebsite");
    const summary = params.get("summary");
    const details = params.get("details");
    const serviceFamily = params.get("serviceFamily");

    if (
      !title &&
      !clientName &&
      !contactName &&
      !contactEmail &&
      !portalOrWebsite &&
      !summary &&
      !details &&
      !serviceFamily &&
      !requestType
    ) {
      return;
    }

    const fullName = (contactName ?? "").trim();
    const [firstName = "", ...lastNameParts] = fullName
      .split(/\s+/)
      .filter(Boolean);
    const inferredScopeType =
      requestType === "project_brief" ? "discovery" : "standalone_quote";

    setFormData((current) => ({
      ...current,
      projectName: title ?? current.projectName,
      clientName: clientName ?? current.clientName,
      clientChampionFirstName: firstName || current.clientChampionFirstName,
      clientChampionLastName:
        lastNameParts.join(" ") || current.clientChampionLastName,
      clientChampionEmail: contactEmail ?? current.clientChampionEmail,
      website: portalOrWebsite ?? current.website,
      commercialBrief:
        [summary, details].filter(Boolean).join("\n\n") ||
        current.commercialBrief,
      problemStatement: summary ?? current.problemStatement,
      serviceFamily: serviceFamilies.some(
        (family) => family.id === serviceFamily
      )
        ? (serviceFamily as string)
        : current.serviceFamily,
      scopeType: inferredScopeType
    }));
  }, []);

  useEffect(() => {
    const nextSelections = buildCompatibilityPlatformTierSelections(
      formData.hubsInScope,
      formData.customerPlatformTier
    );

    setFormData((current) => {
      const currentEntries = Object.entries(
        current.platformTierSelections
      ).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
      const nextEntries = Object.entries(nextSelections).sort(
        ([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)
      );

      if (JSON.stringify(currentEntries) === JSON.stringify(nextEntries)) {
        return current;
      }

      return {
        ...current,
        platformTierSelections: nextSelections
      };
    });
  }, [formData.customerPlatformTier, formData.hubsInScope]);

  useEffect(() => {
    const lookupKey = createClientLookupKey(formData.clientName);

    if (!lookupKey) {
      setDetectedPortalName(null);
      setDetectedPortalTier("");
      setDetectedPortalHubs([]);
      return;
    }

    const matchedClient =
      clients.find((client) => client.slug === lookupKey) ??
      clients.find(
        (client) => createClientLookupKey(client.name) === lookupKey
      );

    if (!matchedClient?.hubSpotPortal?.id) {
      setDetectedPortalName(null);
      setDetectedPortalTier("");
      setDetectedPortalHubs([]);
      return;
    }

    const portalId = matchedClient.hubSpotPortal.id;
    const portalName =
      matchedClient.hubSpotPortal.displayName || matchedClient.name;
    let cancelled = false;

    async function loadPortalSnapshot() {
      try {
        const response = await fetch(`/api/portals/${portalId}/snapshot`);

        if (!response.ok) {
          throw new Error("No portal snapshot");
        }

        const body = await response.json();
        const snapshot = (body.snapshot ?? null) as PortalSnapshot | null;

        if (!snapshot || cancelled) {
          return;
        }

        const nextTier = normalizeDetectedTier(snapshot.hubTier);
        const nextHubs = normalizeDetectedHubs(snapshot.activeHubs ?? []);

        setDetectedPortalName(portalName);
        setDetectedPortalTier(nextTier);
        setDetectedPortalHubs(nextHubs);
        setFormData((current) => ({
          ...current,
          customerPlatformTier: nextTier || current.customerPlatformTier,
          hubsInScope: nextHubs.length > 0 ? nextHubs : current.hubsInScope
        }));
      } catch {
        if (!cancelled) {
          setDetectedPortalName(null);
          setDetectedPortalTier("");
          setDetectedPortalHubs([]);
        }
      }
    }

    void loadPortalSnapshot();

    return () => {
      cancelled = true;
    };
  }, [clients, formData.clientName]);

  useEffect(() => {
    const matchingTemplates = deliveryTemplates.filter(
      (template) =>
        template.scopeType === formData.scopeType &&
        template.serviceFamily === formData.serviceFamily
    );

    if (matchingTemplates.length === 0) {
      if (formData.deliveryTemplateId) {
        setFormData((current) => ({
          ...current,
          deliveryTemplateId: ""
        }));
      }
      return;
    }

    const hasCurrentMatch = matchingTemplates.some(
      (template) => template.id === formData.deliveryTemplateId
    );

    if (!hasCurrentMatch) {
      setFormData((current) => ({
        ...current,
        deliveryTemplateId: matchingTemplates[0]?.id ?? ""
      }));
    }
  }, [
    deliveryTemplates,
    formData.scopeType,
    formData.serviceFamily,
    formData.deliveryTemplateId
  ]);

  useEffect(() => {
    async function loadDeliveryTemplates() {
      try {
        const response = await fetch("/api/delivery-templates");

        if (!response.ok) {
          throw new Error("Failed to load delivery templates");
        }

        const body = await response.json();
        setDeliveryTemplates(body.templates ?? []);
      } catch {
        // Keep project creation usable if the template library is unavailable.
      }
    }

    void loadDeliveryTemplates();
  }, []);

  function updateField(
    field: keyof FormData,
    value: string | boolean | string[]
  ) {
    setFormData((current) => ({ ...current, [field]: value }));
  }

  function selectProjectContainer(scopeType: string) {
    const selectedOption = projectContainerOptions.find(
      (option) => option.value === scopeType
    );

    setFormData((current) => ({
      ...current,
      scopeType,
      engagementType: selectedOption?.engagementType ?? current.engagementType,
      ...(scopeType === "standalone_quote"
        ? { useTemplate: false, templateId: "" }
        : {})
    }));
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

  async function handleSuggestSolutions() {
    if (formData.problemStatement.trim().length < 20) {
      setSolutionError(
        "Add a more detailed pain point first so Deploy can suggest useful paths."
      );
      return;
    }

    setSolutionBusy(true);
    setSolutionError(null);
    setSelectedSolutionTitle(null);

    try {
      const response = await fetch("/api/solution-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: formData.clientName.trim(),
          website: formData.website.trim(),
          serviceFamily: formData.serviceFamily,
          problemStatement: formData.problemStatement.trim()
        })
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to generate solution options");
      }

      setSolutionOptions(body.options ?? []);
    } catch (suggestionError) {
      setSolutionError(
        suggestionError instanceof Error
          ? suggestionError.message
          : "Failed to generate solution options"
      );
    } finally {
      setSolutionBusy(false);
    }
  }

  function applySolutionOption(option: SolutionOption) {
    setSelectedSolutionTitle(option.title);
    setFormData((current) => ({
      ...current,
      serviceFamily: option.recommendedServiceFamily || current.serviceFamily,
      implementationApproach: current.implementationApproach,
      engagementType:
        option.recommendedEngagementType || current.engagementType,
      hubsInScope:
        option.recommendedHubs?.length > 0
          ? option.recommendedHubs
          : current.hubsInScope,
      customerPlatformTier:
        option.recommendedCustomerPlatformTier || current.customerPlatformTier,
      solutionRecommendation: option.summary,
      scopeExecutiveSummary: option.executiveSummary,
      commercialBrief:
        option.jobSpecSeed?.trim().length > 0
          ? option.jobSpecSeed
          : current.commercialBrief
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
      ? formData.commercialBrief.trim().length > 0 ||
        formData.problemStatement.trim().length > 0 ||
        formData.scopeExecutiveSummary.trim().length > 0
      : formData.hubsInScope.length > 0 ||
        formData.problemStatement.trim().length > 0;

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
      serviceFamily: formData.serviceFamily,
      implementationApproach: formData.implementationApproach,
      scopeType: formData.scopeType,
      deliveryTemplateId: formData.deliveryTemplateId || undefined,
      commercialBrief: formData.commercialBrief.trim(),
      problemStatement: formData.problemStatement.trim(),
      solutionRecommendation: formData.solutionRecommendation.trim(),
      scopeExecutiveSummary: formData.scopeExecutiveSummary.trim(),
      customerPlatformTier: formData.customerPlatformTier,
      platformTierSelections: buildCompatibilityPlatformTierSelections(
        formData.hubsInScope,
        formData.customerPlatformTier
      ),
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
      const destination =
        formData.scopeType === "optimisation"
          ? `/projects/${body.project.id}/audit`
          : `/projects/${body.project.id}`;
      router.push(destination);
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
                  <div className="grid gap-4 md:grid-cols-3">
                    {projectContainerOptions.map(
                      ({ value, label, description }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => selectProjectContainer(value)}
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
                      )
                    )}
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

                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm text-text-secondary">
                    Service family
                  </span>
                  <select
                    value={formData.serviceFamily}
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
                        (family) => family.id === formData.serviceFamily
                      )?.description
                    }
                  </p>
                </label>

                {formData.scopeType === "standalone_quote" ? (
                  <>
                    <label className="block md:col-span-2">
                      <span className="mb-2 block text-sm text-text-secondary">
                        Delivery template
                      </span>
                      <select
                        value={formData.deliveryTemplateId}
                        onChange={(event) =>
                          updateField("deliveryTemplateId", event.target.value)
                        }
                        className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                      >
                        <option value="">No template yet</option>
                        {deliveryTemplates
                          .filter(
                            (template) =>
                              template.scopeType === "standalone_quote" &&
                              template.serviceFamily === formData.serviceFamily
                          )
                          .map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                              {template.defaultPlannedHours
                                ? ` · ${template.defaultPlannedHours}h`
                                : ""}
                            </option>
                          ))}
                      </select>
                    </label>

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
                  </>
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
                    onChange={(event) =>
                      updateField("xUrl", event.target.value)
                    }
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
            <div className="space-y-8">
              <h2 className="text-xl font-semibold text-white">
                Engagement + Scope
              </h2>

              <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-5">
                <p className="text-sm font-semibold text-white">
                  Problem / pain point
                </p>
                <p className="mt-2 text-sm text-text-secondary">
                  Capture the challenge in plain language first. Deploy can
                  suggest three possible approaches, then push the selected path
                  into the job spec, executive summary, hubs, and platform
                  packaging.
                </p>
                <textarea
                  value={formData.problemStatement}
                  onChange={(event) =>
                    updateField("problemStatement", event.target.value)
                  }
                  placeholder="Example: We need a better way to consolidate event audience data across multiple brands into HubSpot without over-engineering the first phase."
                  className="mt-4 min-h-[160px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-white outline-none focus:border-accent-solid"
                />
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSuggestSolutions}
                    disabled={solutionBusy}
                    className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {solutionBusy ? "Suggesting..." : "Suggest 3 ways forward"}
                  </button>
                  {selectedSolutionTitle ? (
                    <p className="text-sm text-[#49cde1]">
                      Selected approach: {selectedSolutionTitle}
                    </p>
                  ) : null}
                </div>
                {solutionError ? (
                  <p className="mt-3 text-sm text-[#ff8f9f]">{solutionError}</p>
                ) : null}
              </div>

              {solutionOptions.length > 0 ? (
                <div>
                  <p className="mb-3 text-sm text-text-secondary">
                    Suggested approaches
                  </p>
                  <div className="grid gap-4 xl:grid-cols-3">
                    {solutionOptions.map((option) => (
                      <button
                        key={option.title}
                        type="button"
                        onClick={() => applySolutionOption(option)}
                        className={`rounded-2xl border p-5 text-left transition-colors ${
                          selectedSolutionTitle === option.title
                            ? "border-accent-solid bg-background-elevated"
                            : "border-[rgba(255,255,255,0.08)] bg-[#0b1126]"
                        }`}
                      >
                        <p className="text-base font-semibold text-white">
                          {option.title}
                        </p>
                        <p className="mt-2 text-sm text-text-secondary">
                          {option.summary}
                        </p>
                        <div className="mt-4 space-y-2 text-xs text-text-muted">
                          <p>
                            <span className="text-white">Why:</span>{" "}
                            {option.rationale}
                          </p>
                          <p>
                            <span className="text-white">Engagement:</span>{" "}
                            {formatEngagementType(
                              option.recommendedEngagementType
                            )}
                          </p>
                          <p>
                            <span className="text-white">Platform tier:</span>{" "}
                            {option.recommendedCustomerPlatformTier ||
                              "Not set"}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

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

              <div className="grid gap-6 lg:grid-cols-[0.42fr_0.58fr]">
                <div className="space-y-4">
                  <label className="block">
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
                            formData.implementationApproach === option.value
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
                  </label>

                  <label className="block">
                    <span className="mb-2 flex items-center gap-2 text-sm text-text-secondary">
                      <span>Overall HubSpot plan tier</span>
                      {detectedPortalTier ? (
                        <span className="rounded-full bg-[rgba(73,205,225,0.12)] px-2 py-0.5 text-[11px] font-medium text-[#49cde1]">
                          Detected from portal
                        </span>
                      ) : null}
                    </span>
                    <select
                      value={formData.customerPlatformTier}
                      onChange={(event) =>
                        updateField("customerPlatformTier", event.target.value)
                      }
                      className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                    >
                      {customerPlatformTierOptions.map((option) => (
                        <option
                          key={option.value || "blank"}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-text-muted">
                      Smart CRM is included with all HubSpot plans.
                      {detectedPortalTier && detectedPortalName
                        ? ` Detected ${formatTierLabel(detectedPortalTier)} from ${detectedPortalName}. You can override it here.`
                        : " Set the overall customer plan tier for the portal in scope."}
                    </p>
                  </label>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm text-text-secondary">
                    <span>Hubs in scope</span>
                    {detectedPortalHubs.length > 0 ? (
                      <span className="rounded-full bg-[rgba(73,205,225,0.12)] px-2 py-0.5 text-[11px] font-medium text-[#49cde1]">
                        Detected from portal
                      </span>
                    ) : null}
                  </div>
                  <p className="mb-3 text-sm text-text-muted">
                    {detectedPortalHubs.length > 0 && detectedPortalName
                      ? `Pulled from ${detectedPortalName}. Adjust the hub selection if this job only covers part of the detected portal footprint.`
                      : "Select the core hubs this project covers, then add any purchased add-ons in scope."}
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
                          formData.hubsInScope.includes(hub.id)
                            ? "border-accent-solid bg-background-elevated"
                            : "border-[rgba(255,255,255,0.08)] bg-[#0b1126]"
                        }`}
                      >
                        <p className="font-semibold text-white">{hub.label}</p>
                        <p className="mt-1 text-sm text-text-secondary">
                          Included in the overall HubSpot plan selection.
                        </p>
                      </button>
                    ))}
                  </div>
                  <p className="mb-3 mt-5 text-xs uppercase tracking-[0.18em] text-text-muted">
                    Add-ons in scope
                  </p>
                  <div className="grid gap-4 md:grid-cols-3">
                    {addOnHubOptions.map((hub) => (
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
                        <p className="mt-1 text-sm text-text-secondary">
                          Mark this when the add-on itself is part of the scoped
                          delivery.
                        </p>
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-text-muted">
                    {formData.scopeType === "standalone_quote"
                      ? "Optional for standalone quotes. Use plan and hub scope only when it helps frame the quoted work."
                      : "Select the hubs or add-ons expected in scope for this delivery."}
                  </p>
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm text-text-secondary">
                  Recommended way forward
                </span>
                <textarea
                  value={formData.solutionRecommendation}
                  onChange={(event) =>
                    updateField("solutionRecommendation", event.target.value)
                  }
                  placeholder="Capture the recommended approach, architecture, or rollout path chosen for this job."
                  className="min-h-[140px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-text-secondary">
                  Executive summary
                </span>
                <textarea
                  value={formData.scopeExecutiveSummary}
                  onChange={(event) =>
                    updateField("scopeExecutiveSummary", event.target.value)
                  }
                  placeholder="Short executive summary used on the project and in the quote context instead of dumping the raw spec."
                  className="min-h-[140px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                />
              </label>

              {formData.scopeType !== "standalone_quote" ? (
                <>
                  <label className="flex items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4">
                    <input
                      type="checkbox"
                      checked={formData.useTemplate}
                      onChange={(event) =>
                        updateField("useTemplate", event.target.checked)
                      }
                    />
                    <span className="text-white">
                      Start from a Muloo template
                    </span>
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
                </>
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
                    "Service family",
                    serviceFamilies.find(
                      (family) => family.id === formData.serviceFamily
                    )?.label ?? ""
                  ],
                  ["Container", formatContainerLabel(formData.scopeType)],
                  ["Industry", formData.industry],
                  ["Website", formData.website],
                  [
                    "Delivery template",
                    deliveryTemplates.find(
                      (template) => template.id === formData.deliveryTemplateId
                    )?.name ?? ""
                  ],
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

              {formData.problemStatement ? (
                <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                    Problem / pain point
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-white">
                    {formData.problemStatement}
                  </p>
                </div>
              ) : null}

              {formData.solutionRecommendation ? (
                <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                    Recommended way forward
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-white">
                    {formData.solutionRecommendation}
                  </p>
                </div>
              ) : null}

              {formData.scopeExecutiveSummary ? (
                <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                    Executive summary
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-white">
                    {formData.scopeExecutiveSummary}
                  </p>
                </div>
              ) : null}

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

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                    Overall HubSpot plan tier
                  </p>
                  <p className="mt-3 text-white">
                    {formatTierLabel(formData.customerPlatformTier)}
                  </p>
                  {detectedPortalTier ? (
                    <p className="mt-2 text-xs text-[#49cde1]">
                      Detected from portal
                      {detectedPortalName ? ` · ${detectedPortalName}` : ""}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                    Platform note
                  </p>
                  <p className="mt-3 text-white">
                    Smart CRM is included with all HubSpot plans.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                  Hubs in scope
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {formData.hubsInScope.length > 0 ? (
                    formData.hubsInScope.map((hub) => (
                      <span
                        key={hub}
                        className="rounded bg-[rgba(224,82,156,0.15)] px-2 py-1 text-xs font-medium text-accent-solid"
                      >
                        {allHubOptions.find((option) => option.id === hub)
                          ?.label ?? hub}
                      </span>
                    ))
                  ) : (
                    <span className="text-text-secondary">
                      No hubs selected
                    </span>
                  )}
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
