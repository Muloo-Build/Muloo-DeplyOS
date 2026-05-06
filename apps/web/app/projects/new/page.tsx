"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, RefObject } from "react";
import { useEffect, useRef, useState } from "react";

import AppShell from "../../components/AppShell";
import { PageHead } from "../../components/ui/PageHead";

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
  // T4.4 — auto-prefilled by the website-blur enrichment. Persisted on the
  // Client.enrichedLogoUrl field so we don't lose the result of the lookup.
  enrichedLogoUrl: string;
  clientChampionFirstName: string;
  clientChampionLastName: string;
  clientChampionEmail: string;
  engagementType: string;
  includesPortalAudit: boolean;
  hubsInScope: string[];
  useTemplate: boolean;
  templateId: string;
}

type WizardErrors = Partial<Record<keyof FormData | "step2", string>>;

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

const friendlyProjectCreateError =
  "Something went wrong creating this project. Our team has been notified. Please try again or contact support.";

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

// T4.1 — must mirror the server-side `createSlug` (apps/api/src/server.ts)
// EXACTLY so the wizard's existing-client prompt fires for the same name
// variants the server would later reject as duplicates. The server slug
// only collapses whitespace to "-" and strips non-alphanumerics; it does
// NOT collapse other punctuation to "-" or trim leading/trailing dashes.
// Diverging here meant punctuation-heavy names ("Acme, Inc." etc.) could
// slip past the wizard prompt and only fail at submit.
function createClientLookupKey(value: string) {
  // Server trims `clientName` before calling `createSlug`, so we mirror
  // the trim here too — otherwise inputs like "Magnisol " would slug to
  // "magnisol-" on the client and "magnisol" on the server, missing the
  // prompt and only failing at submit.
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
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
  const [fieldErrors, setFieldErrors] = useState<WizardErrors>({});
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
  // T4.1 — when the typed client name matches an existing client we surface
  // a prompt asking the operator to confirm "use existing client + add a new
  // project". Once confirmed we hide the Industry / Website / Social fields
  // because they live on the existing Client row already.
  const [existingClientMatch, setExistingClientMatch] =
    useState<ClientLookupRecord | null>(null);
  const [useExistingClient, setUseExistingClient] = useState(false);
  // T4.4 — primary-website blur runs the enrichment endpoint to auto-fill
  // industry / logo / socials. We keep loading + error state so the operator
  // sees what's happening.
  const [websiteEnrichmentLoading, setWebsiteEnrichmentLoading] =
    useState(false);
  const [websiteEnrichmentError, setWebsiteEnrichmentError] = useState<
    string | null
  >(null);
  const [websiteEnrichmentResult, setWebsiteEnrichmentResult] = useState<{
    industry: string | null;
    logoUrl: string | null;
  } | null>(null);
  const lastEnrichedWebsiteRef = useRef<string>("");
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
    enrichedLogoUrl: "",
    clientChampionFirstName: "",
    clientChampionLastName: "",
    clientChampionEmail: "",
    engagementType: "IMPLEMENTATION",
    includesPortalAudit: false,
    hubsInScope: [],
    useTemplate: false,
    templateId: ""
  });
  const projectNameRef = useRef<HTMLInputElement>(null);
  const clientNameRef = useRef<HTMLInputElement>(null);
  const championFirstNameRef = useRef<HTMLInputElement>(null);
  const championLastNameRef = useRef<HTMLInputElement>(null);
  const championEmailRef = useRef<HTMLInputElement>(null);
  const commercialBriefRef = useRef<HTMLTextAreaElement>(null);
  const problemStatementRef = useRef<HTMLTextAreaElement>(null);
  const firstHubButtonRef = useRef<HTMLButtonElement>(null);

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
      setExistingClientMatch(null);
      // The operator cleared the field — reset the "use existing" toggle so
      // they aren't silently locked into a stale match.
      setUseExistingClient(false);
      return;
    }

    const matchedClient =
      clients.find((client) => client.slug === lookupKey) ??
      clients.find(
        (client) => createClientLookupKey(client.name) === lookupKey
      );

    // T4.1 — record the matched existing client (if any) so we can render
    // the "X already exists, use it?" prompt regardless of whether they have
    // a HubSpot portal attached. We also reset the "use existing" toggle
    // whenever the matched client identity changes (including matched ->
    // different match). Otherwise an operator who confirmed "use Client A"
    // and then typed Client B would silently carry the prior confirmation
    // over and the project could attach to the wrong client.
    const previousMatchId = existingClientMatch?.id ?? null;
    const nextMatchId = matchedClient?.id ?? null;
    setExistingClientMatch(matchedClient ?? null);
    if (previousMatchId !== nextMatchId) {
      setUseExistingClient(false);
    }

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

  // T4.4 — primary-website blur runs the existing enrichment pipeline and
  // prefills industry / logo / socials inline. Skipped when the operator
  // confirmed "use existing client" because that data already lives on the
  // existing Client row.
  async function handleWebsiteBlur(rawValue: string) {
    const website = rawValue.trim();
    if (!website || useExistingClient) {
      return;
    }
    if (lastEnrichedWebsiteRef.current === website) {
      return;
    }
    setWebsiteEnrichmentLoading(true);
    setWebsiteEnrichmentError(null);
    try {
      const response = await fetch("/api/website-enrichment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website })
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(
          errorBody?.error ?? "We couldn't reach that website."
        );
      }
      // T4.4 — only mark this URL as "already enriched" once we have a
      // successful response. Setting it before the fetch trapped the
      // operator on transient failures (network blip, rate limit) until
      // they edited the field, defeating the blur-retry loop.
      lastEnrichedWebsiteRef.current = website;
      const body = await response.json();
      const enrichment = body.enrichment ?? {};
      setFormData((current) => ({
        ...current,
        industry: current.industry || enrichment.industry || "",
        linkedinUrl: current.linkedinUrl || enrichment.linkedinUrl || "",
        facebookUrl: current.facebookUrl || enrichment.facebookUrl || "",
        instagramUrl: current.instagramUrl || enrichment.instagramUrl || "",
        xUrl: current.xUrl || enrichment.xUrl || "",
        youtubeUrl: current.youtubeUrl || enrichment.youtubeUrl || "",
        // Persist the detected logo URL so the create payload can write it
        // through to Client.enrichedLogoUrl. Don't overwrite any value the
        // operator already typed (currently no manual input, but future-proof).
        enrichedLogoUrl:
          current.enrichedLogoUrl || enrichment.enrichedLogoUrl || ""
      }));
      setWebsiteEnrichmentResult({
        industry: enrichment.industry ?? null,
        logoUrl: enrichment.enrichedLogoUrl ?? null
      });
    } catch (caught) {
      setWebsiteEnrichmentError(
        caught instanceof Error
          ? caught.message
          : "We couldn't enrich that website."
      );
      setWebsiteEnrichmentResult(null);
    } finally {
      setWebsiteEnrichmentLoading(false);
    }
  }

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
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
      step2: undefined
    }));
  }

  function selectProjectContainer(scopeType: string) {
    const selectedOption = projectContainerOptions.find(
      (option) => option.value === scopeType
    );

    setFormData((current) => ({
      ...current,
      scopeType,
      engagementType: selectedOption?.engagementType ?? current.engagementType,
      ...(selectedOption?.engagementType === "OPTIMISATION" ||
      selectedOption?.engagementType === "AUDIT"
        ? { includesPortalAudit: true }
        : {}),
      ...(scopeType === "standalone_quote"
        ? { useTemplate: false, templateId: "" }
        : {})
    }));
    setFieldErrors((current) => ({ ...current, step2: undefined }));
  }

  function toggleHub(hubId: string) {
    setFormData((current) => ({
      ...current,
      hubsInScope: current.hubsInScope.includes(hubId)
        ? current.hubsInScope.filter((hub) => hub !== hubId)
        : [...current.hubsInScope, hubId]
    }));
    setFieldErrors((current) => ({ ...current, step2: undefined }));
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
      ...(option.recommendedEngagementType === "OPTIMISATION" ||
      option.recommendedEngagementType === "AUDIT"
        ? { includesPortalAudit: true }
        : {}),
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

  function validateStep1() {
    const checks: Array<{
      field: keyof FormData;
      message: string;
      ref: RefObject<HTMLInputElement>;
    }> = [
      {
        field: "projectName",
        message: "Project name is required",
        ref: projectNameRef
      },
      {
        field: "clientName",
        message: "Client name is required",
        ref: clientNameRef
      },
      {
        field: "clientChampionFirstName",
        message: "First name is required",
        ref: championFirstNameRef
      },
      {
        field: "clientChampionLastName",
        message: "Last name is required",
        ref: championLastNameRef
      },
      {
        field: "clientChampionEmail",
        message: "Email is required",
        ref: championEmailRef
      }
    ];
    const nextErrors: WizardErrors = {};
    const firstInvalid = checks.find(({ field, message }) => {
      const invalid = String(formData[field]).trim().length === 0;
      if (invalid) {
        nextErrors[field] = message;
      }
      return invalid;
    });

    setFieldErrors((current) => ({ ...current, ...nextErrors }));

    if (firstInvalid) {
      firstInvalid.ref.current?.focus();
      return false;
    }

    return true;
  }

  function validateStep2() {
    if (canContinueFromStep2) {
      setFieldErrors((current) => ({ ...current, step2: undefined }));
      return true;
    }

    const message =
      formData.scopeType === "standalone_quote"
        ? "Add a job brief, pain point, or executive summary before continuing"
        : "Select at least one hub or add a pain point before continuing";

    setFieldErrors((current) => ({ ...current, step2: message }));

    if (formData.scopeType === "standalone_quote") {
      commercialBriefRef.current?.focus();
    } else {
      firstHubButtonRef.current?.focus();
    }

    return false;
  }

  function handleNextStep() {
    setError(null);

    if (currentStep === 1 && !validateStep1()) {
      return;
    }

    if (currentStep === 2 && !validateStep2()) {
      return;
    }

    setCurrentStep((step) => Math.min(3, step + 1));
  }

  function handleWizardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (currentStep >= 3 || event.key !== "Enter" || event.shiftKey) {
      return;
    }

    const target = event.target as HTMLElement;

    if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") {
      return;
    }

    event.preventDefault();
    handleNextStep();
  }

  async function handleSubmit() {
    if (!canContinueFromStep1) {
      setCurrentStep(1);
      validateStep1();
      return;
    }

    if (!canContinueFromStep2) {
      setCurrentStep(2);
      validateStep2();
      return;
    }

    setSaving(true);
    setError(null);

    const moduleSelection = buildModuleSelection(formData.hubsInScope);
    const payload = {
      name: formData.projectName.trim(),
      clientName: formData.clientName.trim(),
      selectedHubs: formData.hubsInScope,
      engagementType: formData.engagementType,
      includesPortalAudit: formData.includesPortalAudit,
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
      // T4.4 — write the auto-detected logo through so it sticks on the
      // Client record instead of vanishing when the wizard closes.
      enrichedLogoUrl: formData.enrichedLogoUrl.trim(),
      clientChampionFirstName: formData.clientChampionFirstName.trim(),
      clientChampionLastName: formData.clientChampionLastName.trim(),
      clientChampionEmail: formData.clientChampionEmail.trim(),
      // T4.1 — let the API leave the existing Client row's profile fields
      // alone instead of clobbering them with the (likely empty) wizard
      // values.
      useExistingClient,
      moduleSelection
    };

    try {
      // T4 — every wizard submit (including template-backed projects) now
      // goes through /api/projects -> createProjectRecord, so the new
      // existing-client / portal-provision / onboarding-checklist /
      // website-enrichment behaviour applies uniformly. The legacy
      // /api/projects/from-template path bypassed all of that and is no
      // longer reachable from the wizard; templates are applied from the
      // project workspace (Standard Pack) after creation.
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          formData.useTemplate && formData.templateId
            ? { ...payload, templateId: formData.templateId }
            : payload
        )
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        // T4.1 — surface the duplicate-client and other validation errors
        // from the API so the operator sees the real reason rather than
        // a generic "Something went wrong".
        const apiMessage =
          typeof errBody?.error === "string" && errBody.error.trim()
            ? errBody.error
            : null;
        throw new Error(apiMessage ?? friendlyProjectCreateError);
      }

      const body = await response.json();

      // T4 — if the operator picked a Muloo template, apply it through
      // the existing seed-standard-pack endpoint after create. We surface
      // any failure as a non-fatal toast so the project still lands on
      // the onboarding checklist (operator can re-seed from there).
      let templateSeedWarning: string | null = null;
      if (formData.useTemplate && formData.templateId && body.project?.id) {
        // T4 — forward the operator's chosen foundation template so
        // the seed pack actually applies the Sales / RevOps / Service
        // template tasks (instead of the generic standard pack). We
        // surface seed failures as a non-fatal warning that travels
        // through the navigation to the onboarding page (via query
        // param) so the operator actually sees it after redirect.
        try {
          const seedResponse = await fetch(
            `/api/projects/${encodeURIComponent(body.project.id)}/seed-standard-pack`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ templateId: formData.templateId })
            }
          );
          if (!seedResponse.ok) {
            const seedBody = await seedResponse.json().catch(() => null);
            const seedMessage =
              typeof seedBody?.error === "string" && seedBody.error.trim()
                ? seedBody.error
                : `Template seeding failed (${seedResponse.status}).`;
            console.warn("[new project] template seed failed", seedMessage);
            templateSeedWarning = `Project created, but applying the selected template failed: ${seedMessage} You can re-seed it from the project workspace.`;
          }
        } catch (templateError) {
          console.error(
            "[new project] template seed failed",
            templateError
          );
          templateSeedWarning =
            "Project created, but applying the selected template failed. You can re-seed it from the project workspace.";
        }
      }
      // T4.3 — after step 3 every newly created project lands on the
      // onboarding checklist (5-item now-do-these-things list). Optimisation
      // projects can still reach the audit workspace from the checklist /
      // overview, but we never drop the operator into a cold workspace.
      const onboardingUrl = templateSeedWarning
        ? `/projects/${body.project.id}/onboarding?warning=${encodeURIComponent(templateSeedWarning)}`
        : `/projects/${body.project.id}/onboarding`;
      router.push(onboardingUrl);
    } catch (submitError) {
      // T4.1 — preserve the API's actionable error message (duplicate
      // client, validation hints, etc.) instead of swapping it for a
      // generic toast. Falls back to the friendly default only when the
      // thrown error doesn't carry a useful message.
      const message =
        submitError instanceof Error && submitError.message.trim()
          ? submitError.message
          : friendlyProjectCreateError;
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
        <PageHead
          eyebrow="Project setup"
          title="Create a new project"
          lede={
            <>
              Three steps. Set up the engagement, capture the brief, review and
              create. Required fields are marked with{" "}
              <span className="text-status-danger">*</span>.
            </>
          }
        />

        <div className="mb-8 flex max-w-3xl flex-wrap items-center gap-3">
          {[
            { step: 1, label: "Project + Client" },
            { step: 2, label: "Brief" },
            { step: 3, label: "Review" }
          ].map(({ step, label }, index, arr) => (
            <div key={step} className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition ${
                  step <= currentStep
                    ? "bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] text-white"
                    : "border border-ink-4 bg-ink-1 text-text-3"
                }`}
              >
                {step}
              </div>
              <span
                className={`text-sm font-medium ${step <= currentStep ? "text-white" : "text-text-3"}`}
              >
                {label}
              </span>
              {index < arr.length - 1 ? (
                <div
                  className={`mx-1 h-px w-10 ${
                    step < currentStep
                      ? "bg-accent-solid"
                      : "bg-[rgba(255,255,255,0.08)]"
                  }`}
                />
              ) : null}
            </div>
          ))}
        </div>

        <div
          onKeyDown={handleWizardKeyDown}
          className="max-w-3xl rounded-[14px] border border-ink-4 bg-ink-1 p-8"
        >
          {currentStep === 1 ? (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white">
                Project + Client
              </h2>

              {[
                fieldErrors.projectName,
                fieldErrors.clientName,
                fieldErrors.clientChampionFirstName,
                fieldErrors.clientChampionLastName,
                fieldErrors.clientChampionEmail
              ].some(Boolean) ? (
                <div
                  role="alert"
                  className="rounded-xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-rose-100"
                >
                  <p className="font-semibold">A few things to fix:</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    {fieldErrors.projectName ? (
                      <li>{fieldErrors.projectName}</li>
                    ) : null}
                    {fieldErrors.clientName ? (
                      <li>{fieldErrors.clientName}</li>
                    ) : null}
                    {fieldErrors.clientChampionFirstName ? (
                      <li>{fieldErrors.clientChampionFirstName}</li>
                    ) : null}
                    {fieldErrors.clientChampionLastName ? (
                      <li>{fieldErrors.clientChampionLastName}</li>
                    ) : null}
                    {fieldErrors.clientChampionEmail ? (
                      <li>{fieldErrors.clientChampionEmail}</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}

              <div className="grid gap-6 md:grid-cols-2">
                <div className="md:col-span-2">
                  <p className="mb-3 text-sm text-text-2">
                    Engagement container
                  </p>
                  <div className="grid gap-4 md:grid-cols-3">
                    {projectContainerOptions.map(
                      ({ value, label, description }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => selectProjectContainer(value)}
                          className={`rounded-[14px] border p-4 text-left transition-colors ${
                            formData.scopeType === value
                              ? "border-accent-solid bg-ink-2"
                              : "border-ink-4 bg-ink-2"
                          }`}
                        >
                          <p className="font-semibold text-white">{label}</p>
                          <p className="mt-1 text-sm text-text-2">
                            {description}
                          </p>
                        </button>
                      )
                    )}
                  </div>
                </div>

                <label className="block md:col-span-2">
                  <span
                    aria-required="true"
                    className="mb-2 flex items-center gap-1 text-sm text-text-2"
                  >
                    Project name <span className="text-[#ff8f9f]">*</span>
                  </span>
                  <input
                    ref={projectNameRef}
                    required
                    value={formData.projectName}
                    onChange={(event) =>
                      updateField("projectName", event.target.value)
                    }
                    aria-invalid={Boolean(fieldErrors.projectName)}
                    aria-describedby={
                      fieldErrors.projectName ? "project-name-error" : undefined
                    }
                    className={`w-full rounded-xl border bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid ${
                      fieldErrors.projectName
                        ? "border-[rgba(224,80,96,0.6)]"
                        : "border-ink-4"
                    }`}
                  />
                  {fieldErrors.projectName ? (
                    <p
                      id="project-name-error"
                      className="mt-2 text-sm text-[#ff8f9f]"
                    >
                      {fieldErrors.projectName}
                    </p>
                  ) : null}
                </label>

                <label className="block md:col-span-2">
                  <span
                    aria-required="true"
                    className="mb-2 flex items-center gap-1 text-sm text-text-2"
                  >
                    Client name <span className="text-[#ff8f9f]">*</span>
                  </span>
                  <input
                    ref={clientNameRef}
                    required
                    list="existing-clients-list"
                    value={formData.clientName}
                    onChange={(event) =>
                      updateField("clientName", event.target.value)
                    }
                    onBlur={(event) => {
                      // Auto-suggest a project name if none has been typed yet.
                      const clientValue = event.target.value.trim();
                      if (
                        clientValue &&
                        !formData.projectName.trim()
                      ) {
                        updateField(
                          "projectName",
                          `${clientValue} ${formData.scopeType === "standalone_quote" ? "Quote" : "Project"}`
                        );
                      }
                    }}
                    aria-invalid={Boolean(fieldErrors.clientName)}
                    aria-describedby={
                      fieldErrors.clientName ? "client-name-error" : undefined
                    }
                    className={`w-full rounded-xl border bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid ${
                      fieldErrors.clientName
                        ? "border-[rgba(224,80,96,0.6)]"
                        : "border-ink-4"
                    }`}
                  />
                  {fieldErrors.clientName ? (
                    <p
                      id="client-name-error"
                      className="mt-2 text-sm text-[#ff8f9f]"
                    >
                      {fieldErrors.clientName}
                    </p>
                  ) : null}
                  {clients.length > 0 ? (
                    <p className="mt-2 text-xs text-text-3">
                      Start typing to match an existing client and avoid
                      duplicates.
                    </p>
                  ) : null}
                  <datalist id="existing-clients-list">
                    {clients.map((client) => (
                      <option key={client.id} value={client.name} />
                    ))}
                  </datalist>
                  {existingClientMatch && !useExistingClient ? (
                    <div
                      role="alert"
                      className="mt-3 rounded-xl border border-[rgba(73,205,225,0.4)] bg-[rgba(11,26,52,0.7)] p-4 text-sm text-text-2"
                    >
                      <p className="font-semibold text-white">
                        {existingClientMatch.name} already exists.
                      </p>
                      <p className="mt-1 text-text-3">
                        Use the existing client and add a new project under it?
                        We&apos;ll keep the saved industry, website and socials
                        as-is.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setUseExistingClient(true)}
                          className="rounded-lg bg-accent-solid px-3 py-1.5 text-xs font-semibold text-[#03162a] hover:opacity-90"
                        >
                          Yes, use existing client
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            // T4.1 — picking "different client" must actually
                            // disambiguate; otherwise the slug-based upsert in
                            // createProjectRecord would re-attach to the same
                            // existing Client row. Clear the typed name and
                            // re-focus so the operator types a unique name
                            // (different slug) before continuing.
                            setExistingClientMatch(null);
                            setUseExistingClient(false);
                            updateField("clientName", "");
                          }}
                          className="rounded-lg border border-ink-5 px-3 py-1.5 text-xs text-text-2 hover:bg-ink-2"
                        >
                          No, this is a different client
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {useExistingClient && existingClientMatch ? (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[rgba(73,205,225,0.3)] bg-[rgba(11,26,52,0.5)] px-4 py-3 text-sm text-text-2">
                      <span>
                        Using existing client{" "}
                        <span className="font-semibold text-white">
                          {existingClientMatch.name}
                        </span>
                        . Industry, website and socials are managed on the
                        client record.
                      </span>
                      <button
                        type="button"
                        onClick={() => setUseExistingClient(false)}
                        className="rounded-lg border border-ink-5 px-2.5 py-1 text-xs text-text-3 hover:bg-ink-2"
                      >
                        Change
                      </button>
                    </div>
                  ) : null}
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm text-text-2">
                    Service family
                  </span>
                  <select
                    value={formData.serviceFamily}
                    onChange={(event) =>
                      updateField("serviceFamily", event.target.value)
                    }
                    className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
                  >
                    {serviceFamilies.map((family) => (
                      <option key={family.id} value={family.id}>
                        {family.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-text-3">
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
                      <span className="mb-2 block text-sm text-text-2">
                        Delivery template
                      </span>
                      <select
                        value={formData.deliveryTemplateId}
                        onChange={(event) =>
                          updateField("deliveryTemplateId", event.target.value)
                        }
                        className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
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
                      <span className="mb-2 block text-sm text-text-2">
                        Job / scope brief
                      </span>
                      <textarea
                        ref={commercialBriefRef}
                        value={formData.commercialBrief}
                        onChange={(event) =>
                          updateField("commercialBrief", event.target.value)
                        }
                        placeholder="Describe the standalone job, deliverables, desired outcomes, and any pricing context."
                        className="min-h-[140px] w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
                      />
                    </label>
                  </>
                ) : null}

                <label className="block">
                  <span className="mb-2 block text-sm text-text-2">
                    Project owner
                  </span>
                  <select
                    value={formData.owner}
                    onChange={(event) => selectOwner(event.target.value)}
                    className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
                  >
                    {teamUsers.map((user) => (
                      <option key={user.id} value={user.name}>
                        {user.name} - {user.role}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-text-2">
                    Owner email
                  </span>
                  <input
                    value={formData.ownerEmail}
                    readOnly
                    className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none"
                  />
                </label>

                {/* T4.1 — when an existing client is reused, hide Industry /
                    Website / Social fields. They live on the existing Client
                    row and we don't want to clobber them with empty inputs. */}
                {!useExistingClient ? (
                  <>
                    <label className="block md:col-span-2">
                      <span className="mb-2 block text-sm text-text-2">
                        Industry
                      </span>
                      <select
                        value={formData.industry}
                        onChange={(event) =>
                          updateField("industry", event.target.value)
                        }
                        className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
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
                      <span className="mb-2 block text-sm text-text-2">
                        Primary website
                      </span>
                      <input
                        value={formData.website}
                        onChange={(event) =>
                          updateField("website", event.target.value)
                        }
                        onBlur={(event) =>
                          void handleWebsiteBlur(event.target.value)
                        }
                        placeholder="https://example.com"
                        className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
                      />
                      {websiteEnrichmentLoading ? (
                        <p className="mt-2 text-xs text-text-3">
                          Enriching website…
                        </p>
                      ) : null}
                      {websiteEnrichmentError ? (
                        <p className="mt-2 text-xs text-[#ff8f9f]">
                          {websiteEnrichmentError}
                        </p>
                      ) : null}
                      {websiteEnrichmentResult &&
                      !websiteEnrichmentLoading &&
                      !websiteEnrichmentError ? (
                        <div className="mt-2 flex items-center gap-2 text-xs text-text-3">
                          {websiteEnrichmentResult.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={websiteEnrichmentResult.logoUrl}
                              alt="Detected logo"
                              className="h-6 w-6 rounded bg-white object-contain p-0.5"
                            />
                          ) : null}
                          <span>
                            Auto-filled
                            {websiteEnrichmentResult.industry
                              ? ` industry "${websiteEnrichmentResult.industry}" and`
                              : ""}{" "}
                            socials from this website. Edit any field below if
                            needed.
                          </span>
                        </div>
                      ) : null}
                    </label>

                    <label className="block md:col-span-2">
                      <span className="mb-2 block text-sm text-text-2">
                        Additional websites
                      </span>
                      <textarea
                        value={formData.additionalWebsitesText}
                        onChange={(event) =>
                          updateField(
                            "additionalWebsitesText",
                            event.target.value
                          )
                        }
                        placeholder={"One URL per line"}
                        className="min-h-[120px] w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm text-text-2">
                        LinkedIn
                      </span>
                      <input
                        value={formData.linkedinUrl}
                        onChange={(event) =>
                          updateField("linkedinUrl", event.target.value)
                        }
                        className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm text-text-2">
                        Facebook
                      </span>
                      <input
                        value={formData.facebookUrl}
                        onChange={(event) =>
                          updateField("facebookUrl", event.target.value)
                        }
                        className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm text-text-2">
                        Instagram
                      </span>
                      <input
                        value={formData.instagramUrl}
                        onChange={(event) =>
                          updateField("instagramUrl", event.target.value)
                        }
                        className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm text-text-2">
                        X / Twitter
                      </span>
                      <input
                        value={formData.xUrl}
                        onChange={(event) =>
                          updateField("xUrl", event.target.value)
                        }
                        className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
                      />
                    </label>

                    <label className="block md:col-span-2">
                      <span className="mb-2 block text-sm text-text-2">
                        YouTube
                      </span>
                      <input
                        value={formData.youtubeUrl}
                        onChange={(event) =>
                          updateField("youtubeUrl", event.target.value)
                        }
                        className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
                      />
                    </label>
                  </>
                ) : null}

                <label className="block">
                  <span
                    aria-required="true"
                    className="mb-2 flex items-center gap-1 text-sm text-text-2"
                  >
                    Client champion first name{" "}
                    <span className="text-[#ff8f9f]">*</span>
                  </span>
                  <input
                    ref={championFirstNameRef}
                    required
                    value={formData.clientChampionFirstName}
                    onChange={(event) =>
                      updateField("clientChampionFirstName", event.target.value)
                    }
                    aria-invalid={Boolean(fieldErrors.clientChampionFirstName)}
                    aria-describedby={
                      fieldErrors.clientChampionFirstName
                        ? "champion-first-name-error"
                        : undefined
                    }
                    className={`w-full rounded-xl border bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid ${
                      fieldErrors.clientChampionFirstName
                        ? "border-[rgba(224,80,96,0.6)]"
                        : "border-ink-4"
                    }`}
                  />
                  {fieldErrors.clientChampionFirstName ? (
                    <p
                      id="champion-first-name-error"
                      className="mt-2 text-sm text-[#ff8f9f]"
                    >
                      {fieldErrors.clientChampionFirstName}
                    </p>
                  ) : null}
                </label>

                <label className="block">
                  <span
                    aria-required="true"
                    className="mb-2 flex items-center gap-1 text-sm text-text-2"
                  >
                    Client champion last name{" "}
                    <span className="text-[#ff8f9f]">*</span>
                  </span>
                  <input
                    ref={championLastNameRef}
                    required
                    value={formData.clientChampionLastName}
                    onChange={(event) =>
                      updateField("clientChampionLastName", event.target.value)
                    }
                    aria-invalid={Boolean(fieldErrors.clientChampionLastName)}
                    aria-describedby={
                      fieldErrors.clientChampionLastName
                        ? "champion-last-name-error"
                        : undefined
                    }
                    className={`w-full rounded-xl border bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid ${
                      fieldErrors.clientChampionLastName
                        ? "border-[rgba(224,80,96,0.6)]"
                        : "border-ink-4"
                    }`}
                  />
                  {fieldErrors.clientChampionLastName ? (
                    <p
                      id="champion-last-name-error"
                      className="mt-2 text-sm text-[#ff8f9f]"
                    >
                      {fieldErrors.clientChampionLastName}
                    </p>
                  ) : null}
                </label>

                <label className="block md:col-span-2">
                  <span
                    aria-required="true"
                    className="mb-2 flex items-center gap-1 text-sm text-text-2"
                  >
                    Client champion email{" "}
                    <span className="text-[#ff8f9f]">*</span>
                  </span>
                  <input
                    ref={championEmailRef}
                    type="email"
                    required
                    value={formData.clientChampionEmail}
                    onChange={(event) =>
                      updateField("clientChampionEmail", event.target.value)
                    }
                    aria-invalid={Boolean(fieldErrors.clientChampionEmail)}
                    aria-describedby={
                      fieldErrors.clientChampionEmail
                        ? "champion-email-error"
                        : undefined
                    }
                    className={`w-full rounded-xl border bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid ${
                      fieldErrors.clientChampionEmail
                        ? "border-[rgba(224,80,96,0.6)]"
                        : "border-ink-4"
                    }`}
                  />
                  {fieldErrors.clientChampionEmail ? (
                    <p
                      id="champion-email-error"
                      className="mt-2 text-sm text-[#ff8f9f]"
                    >
                      {fieldErrors.clientChampionEmail}
                    </p>
                  ) : null}
                </label>
              </div>
            </div>
          ) : null}

          {currentStep === 2 ? (
            <div className="space-y-8">
              <h2 className="text-xl font-semibold text-white">
                Engagement + Scope
              </h2>

              {fieldErrors.step2 ? (
                <div className="rounded-xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
                  {fieldErrors.step2}
                </div>
              ) : null}

              <div className="rounded-[14px] border border-ink-4 bg-ink-2 p-5">
                <p className="text-sm font-semibold text-white">
                  Problem / pain point
                </p>
                <p className="mt-2 text-sm text-text-2">
                  Capture the challenge in plain language first. Deploy can
                  suggest three possible approaches, then push the selected path
                  into the job spec, executive summary, hubs, and platform
                  packaging.
                </p>
                <textarea
                  ref={problemStatementRef}
                  value={formData.problemStatement}
                  onChange={(event) =>
                    updateField("problemStatement", event.target.value)
                  }
                  placeholder="Example: We need a better way to consolidate event audience data across multiple brands into HubSpot without over-engineering the first phase."
                  className="mt-4 min-h-[160px] w-full rounded-xl border border-ink-4 bg-ink-1 px-4 py-3 text-white outline-none focus:border-accent-solid"
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
                  <p className="mb-3 text-sm text-text-2">
                    Suggested approaches
                  </p>
                  <div className="grid gap-4 xl:grid-cols-3">
                    {solutionOptions.map((option) => (
                      <button
                        key={option.title}
                        type="button"
                        onClick={() => applySolutionOption(option)}
                        className={`rounded-[14px] border p-5 text-left transition-colors ${
                          selectedSolutionTitle === option.title
                            ? "border-accent-solid bg-ink-2"
                            : "border-ink-4 bg-ink-2"
                        }`}
                      >
                        <p className="text-base font-semibold text-white">
                          {option.title}
                        </p>
                        <p className="mt-2 text-sm text-text-2">
                          {option.summary}
                        </p>
                        <div className="mt-4 space-y-2 text-xs text-text-3">
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
                <p className="mb-3 text-sm text-text-2">
                  Engagement type
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  {engagementTypes.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() =>
                        setFormData((current) => ({
                          ...current,
                          engagementType: type.id,
                          ...(type.id === "OPTIMISATION" || type.id === "AUDIT"
                            ? { includesPortalAudit: true }
                            : {})
                        }))
                      }
                      className={`rounded-[14px] border p-4 text-left transition-colors ${
                        formData.engagementType === type.id
                          ? "border-accent-solid bg-ink-2"
                          : "border-ink-4 bg-ink-2"
                      }`}
                    >
                      <p className="font-semibold text-white">{type.label}</p>
                      <p className="mt-1 text-sm text-text-2">
                        {type.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-[14px] border border-ink-4 bg-ink-2 px-4 py-4 text-sm text-white">
                <input
                  type="checkbox"
                  checked={formData.includesPortalAudit}
                  onChange={(event) =>
                    updateField("includesPortalAudit", event.target.checked)
                  }
                />
                Include portal audit
              </label>

              <div className="grid gap-6 lg:grid-cols-[0.42fr_0.58fr]">
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm text-text-2">
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
                          className={`rounded-[14px] border p-4 text-left transition-colors ${
                            formData.implementationApproach === option.value
                              ? "border-accent-solid bg-ink-2"
                              : "border-ink-4 bg-ink-2"
                          }`}
                        >
                          <p className="font-semibold text-white">
                            {option.label}
                          </p>
                          <p className="mt-1 text-sm text-text-2">
                            {option.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 flex items-center gap-2 text-sm text-text-2">
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
                      className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
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
                    <p className="mt-2 text-xs text-text-3">
                      Smart CRM is included with all HubSpot plans.
                      {detectedPortalTier && detectedPortalName
                        ? ` Detected ${formatTierLabel(detectedPortalTier)} from ${detectedPortalName}. You can override it here.`
                        : " Set the overall customer plan tier for the portal in scope."}
                    </p>
                  </label>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm text-text-2">
                    <span>Hubs in scope</span>
                    {detectedPortalHubs.length > 0 ? (
                      <span className="rounded-full bg-[rgba(73,205,225,0.12)] px-2 py-0.5 text-[11px] font-medium text-[#49cde1]">
                        Detected from portal
                      </span>
                    ) : null}
                  </div>
                  <p className="mb-3 text-sm text-text-3">
                    {detectedPortalHubs.length > 0 && detectedPortalName
                      ? `Pulled from ${detectedPortalName}. Adjust the hub selection if this job only covers part of the detected portal footprint.`
                      : "Select the core hubs this project covers, then add any purchased add-ons in scope."}
                  </p>
                  <p className="mb-3 text-xs uppercase tracking-[0.14em] text-text-3">
                    Core hubs
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {coreHubOptions.map((hub, index) => (
                      <button
                        key={hub.id}
                        ref={index === 0 ? firstHubButtonRef : undefined}
                        type="button"
                        onClick={() => toggleHub(hub.id)}
                        className={`rounded-[14px] border p-4 text-left transition-colors ${
                          formData.hubsInScope.includes(hub.id)
                            ? "border-accent-solid bg-ink-2"
                            : "border-ink-4 bg-ink-2"
                        }`}
                      >
                        <p className="font-semibold text-white">{hub.label}</p>
                        <p className="mt-1 text-sm text-text-2">
                          Included in the overall HubSpot plan selection.
                        </p>
                      </button>
                    ))}
                  </div>
                  <p className="mb-3 mt-5 text-xs uppercase tracking-[0.14em] text-text-3">
                    Add-ons in scope
                  </p>
                  <div className="grid gap-4 md:grid-cols-3">
                    {addOnHubOptions.map((hub) => (
                      <button
                        key={hub.id}
                        type="button"
                        onClick={() => toggleHub(hub.id)}
                        className={`rounded-[14px] border p-4 text-left transition-colors ${
                          formData.hubsInScope.includes(hub.id)
                            ? "border-accent-solid bg-ink-2"
                            : "border-ink-4 bg-ink-2"
                        }`}
                      >
                        <p className="font-semibold text-white">{hub.label}</p>
                        <p className="mt-1 text-sm text-text-2">
                          Mark this when the add-on itself is part of the scoped
                          delivery.
                        </p>
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-text-3">
                    {formData.scopeType === "standalone_quote"
                      ? "Optional for standalone quotes. Use plan and hub scope only when it helps frame the quoted work."
                      : "Select the hubs or add-ons expected in scope for this delivery."}
                  </p>
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm text-text-2">
                  Recommended way forward
                </span>
                <textarea
                  value={formData.solutionRecommendation}
                  onChange={(event) =>
                    updateField("solutionRecommendation", event.target.value)
                  }
                  placeholder="Capture the recommended approach, architecture, or rollout path chosen for this job."
                  className="min-h-[140px] w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-text-2">
                  Executive summary
                </span>
                <textarea
                  value={formData.scopeExecutiveSummary}
                  onChange={(event) =>
                    updateField("scopeExecutiveSummary", event.target.value)
                  }
                  placeholder="Short executive summary used on the project and in the quote context instead of dumping the raw spec."
                  className="min-h-[140px] w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
                />
              </label>

              {/*
                T4 — the wizard still offers "Start from a Muloo template",
                but now both branches POST to /api/projects -> createProjectRecord
                so portal/champion provisioning, onboarding checklist seeding,
                existing-client handling, and website-enrichment fields apply
                uniformly. The selected template is applied via the existing
                seed-standard-pack endpoint after the project row exists.
              */}
              {formData.scopeType !== "standalone_quote" ? (
                <>
                  <label className="flex items-center gap-3 rounded-[14px] border border-ink-4 bg-ink-2 p-4">
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
                      <span className="mb-2 block text-sm text-text-2">
                        Template
                      </span>
                      <select
                        value={formData.templateId}
                        onChange={(event) =>
                          updateField("templateId", event.target.value)
                        }
                        className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
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
                  // T4.1 — when reusing an existing client, the wizard
                  // does NOT overwrite the stored Industry/Website on
                  // that client (server-side guard). Showing the local
                  // form values here would misrepresent what will
                  // actually be used, so we mark them as "Kept from
                  // existing client".
                  [
                    "Industry",
                    useExistingClient
                      ? "Kept from existing client"
                      : formData.industry
                  ],
                  [
                    "Website",
                    useExistingClient
                      ? "Kept from existing client"
                      : formData.website
                  ],
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
                    className="rounded-[14px] border border-ink-4 bg-ink-2 p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                      {label}
                    </p>
                    <p className="mt-2 text-white">{value || "Not set"}</p>
                  </div>
                ))}
              </div>

              {formData.problemStatement ? (
                <div className="rounded-[14px] border border-ink-4 bg-ink-2 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                    Problem / pain point
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-white">
                    {formData.problemStatement}
                  </p>
                </div>
              ) : null}

              {formData.solutionRecommendation ? (
                <div className="rounded-[14px] border border-ink-4 bg-ink-2 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                    Recommended way forward
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-white">
                    {formData.solutionRecommendation}
                  </p>
                </div>
              ) : null}

              {formData.scopeExecutiveSummary ? (
                <div className="rounded-[14px] border border-ink-4 bg-ink-2 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                    Executive summary
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-white">
                    {formData.scopeExecutiveSummary}
                  </p>
                </div>
              ) : null}

              {formData.commercialBrief ? (
                <div className="rounded-[14px] border border-ink-4 bg-ink-2 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                    Job / scope brief
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-white">
                    {formData.commercialBrief}
                  </p>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[14px] border border-ink-4 bg-ink-2 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-text-3">
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
                <div className="rounded-[14px] border border-ink-4 bg-ink-2 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                    Platform note
                  </p>
                  <p className="mt-3 text-white">
                    Smart CRM is included with all HubSpot plans.
                  </p>
                </div>
              </div>

              <div className="rounded-[14px] border border-ink-4 bg-ink-2 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-text-3">
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
                    <span className="text-text-2">
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
            className="rounded-xl border border-ink-4 bg-ink-1 px-5 py-3 text-sm font-medium text-white"
          >
            Previous
          </button>

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
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
