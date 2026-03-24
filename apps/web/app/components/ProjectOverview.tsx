"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import AppShell from "./AppShell";
import ProjectWorkflowNav from "./ProjectWorkflowNav";
import {
  createDefaultClientQuestionnaireDefinitionMap,
  type ClientQuestionDefinition,
  type ClientQuestionnaireDefinitionMap
} from "./clientQuestionnaire";
import {
  getDisplayKeyRisks,
  getDisplayNextQuestions,
  getDisplaySupportingTools
} from "./scopedRecommendationFallbacks";

interface Project {
  id: string;
  name: string;
  status: string;
  quoteApprovalStatus?: string | null;
  quoteSharedAt?: string | null;
  quoteApprovedAt?: string | null;
  quoteApprovedByName?: string | null;
  quoteApprovedByEmail?: string | null;
  scopeLockedAt?: string | null;
  owner: string;
  ownerEmail: string;
  scopeType?: string | null;
  implementationApproach?: string | null;
  commercialBrief?: string | null;
  problemStatement?: string | null;
  solutionRecommendation?: string | null;
  scopeExecutiveSummary?: string | null;
  clientQuestionnaireConfig?: ClientQuestionnaireDefinitionMap | null;
  customerPlatformTier?: string | null;
  platformTierSelections?: Record<string, string> | null;
  packagingAssessment?: {
    fit: "good" | "attention" | "upgrade_needed";
    summary: string;
    warnings: string[];
    recommendedNextStep: string;
    reasoning: string[];
    workaroundPath?: string | null;
    requiredProductTiers: Record<string, string>;
    selectedProductTiers: Record<string, string>;
  } | null;
  clientChampionFirstName?: string | null;
  clientChampionLastName?: string | null;
  clientChampionEmail?: string | null;
  engagementType: string;
  selectedHubs: string[];
  updatedAt: string;
  client: {
    name: string;
    industry?: string | null;
    region?: string | null;
    website?: string | null;
    additionalWebsites?: string[];
    linkedinUrl?: string | null;
    facebookUrl?: string | null;
    instagramUrl?: string | null;
    xUrl?: string | null;
    youtubeUrl?: string | null;
  };
  portal: {
    portalId: string;
    displayName: string;
    region?: string | null;
    connected: boolean;
    connectedEmail?: string | null;
    connectedName?: string | null;
    hubDomain?: string | null;
    installedAt?: string | null;
  } | null;
}

interface HubSpotPortalOption {
  id: string;
  portalId: string;
  displayName: string;
  connected: boolean;
  connectedEmail?: string | null;
  connectedName?: string | null;
  hubDomain?: string | null;
  installedAt?: string | null;
}

type HubSpotInstallProfile =
  | "core_crm"
  | "automation"
  | "cms_content"
  | "commercial_objects"
  | "advanced_admin";

interface EvidenceItem {
  id: string;
  projectId: string;
  sessionNumber: number;
  evidenceType:
    | "transcript"
    | "summary"
    | "uploaded-doc"
    | "website-link"
    | "screen-grab"
    | "miro-note"
    | "operator-note"
    | "client-input";
  sourceLabel: string;
  sourceUrl: string | null;
  content: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SessionDetail {
  session: number;
  title: string;
  status: "draft" | "in_progress" | "complete";
  fields: Record<string, string>;
}

interface Blueprint {
  id: string;
  generatedAt: string;
  tasks: Array<{
    type: "Agent" | "Human" | "Client";
    effortHours: number;
  }>;
}

interface DiscoverySummary {
  executiveSummary: string;
  mainPainPoints: string[];
  recommendedApproach: string;
  whyThisApproach: string;
  phaseOneFocus: string;
  futureUpgradePath: string;
  inScopeItems: string[];
  outOfScopeItems: string[];
  supportingTools: string[];
  engagementTrack: string;
  platformFit: string;
  changeManagementRating: string;
  dataReadinessRating: string;
  scopeVolatilityRating: string;
  missingInformation: string[];
  keyRisks: string[];
  recommendedNextQuestions: string[];
}

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ClientPortalUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  canApproveQuotes?: boolean;
  questionnaireAccess?: boolean;
  authStatus?: "active" | "invite_pending";
}

interface SavedClientContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  title?: string;
  canApproveQuotes?: boolean;
}

interface ProviderConnectionSummary {
  providerKey: string;
  label: string;
  defaultModel?: string | null;
  isEnabled: boolean;
  hasApiKey: boolean;
}

interface EmailSettingsSummary {
  enabled: boolean;
  fromEmail?: string | null;
}

function isSessionComplete(session: SessionDetail | undefined) {
  if (!session) {
    return false;
  }

  const fieldValues = Object.values(session.fields);

  if (fieldValues.length === 0) {
    return false;
  }

  return fieldValues.every((value) => value.trim().length > 0);
}

function waitForDelay(delayMs: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

function appendRecipientList(currentValue: string, nextEmail: string) {
  const normalizedEmail = nextEmail.trim();
  if (!normalizedEmail) {
    return currentValue;
  }

  const recipients = currentValue
    .split(/[,\n;]/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (recipients.includes(normalizedEmail)) {
    return recipients.join(", ");
  }

  return [...recipients, normalizedEmail].join(", ");
}

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

type EditableField =
  | "clientName"
  | "type"
  | "brief"
  | "portalId"
  | "owner"
  | "clientProfile"
  | "hubs"
  | "platformPackaging"
  | "clientChampion"
  | null;

const engagementOptions = [
  { value: "IMPLEMENTATION", label: "Implementation" },
  { value: "MIGRATION", label: "Migration" },
  { value: "AUDIT", label: "Audit" },
  { value: "OPTIMISATION", label: "Optimisation" },
  { value: "GUIDED_DEPLOYMENT", label: "Guided Deployment" }
] as const;

const hubOptions = [
  { value: "sales", label: "Sales" },
  { value: "marketing", label: "Marketing" },
  { value: "service", label: "Service" },
  { value: "ops", label: "Operations" },
  { value: "cms", label: "CMS/Content" },
  { value: "data", label: "Data" },
  { value: "commerce", label: "Commerce" }
] as const;

const customerPlatformTierOptions = [
  { value: "", label: "Not set yet" },
  { value: "starter", label: "Starter" },
  { value: "professional", label: "Professional" },
  { value: "enterprise", label: "Enterprise" }
] as const;

const implementationApproachOptions = [
  { value: "pragmatic_poc", label: "Pragmatic / POC" },
  { value: "best_practice", label: "Best-practice / scalable" }
] as const;

const hubSpotInstallProfileOptions = [
  { value: "core_crm", label: "Core CRM install" },
  { value: "automation", label: "Automation add-on" },
  { value: "cms_content", label: "CMS / content add-on" },
  { value: "commercial_objects", label: "Commercial objects add-on" },
  { value: "advanced_admin", label: "Advanced admin add-on" }
] as const;

const hubTierOptions = [
  { value: "", label: "Not in use" },
  { value: "free", label: "Free" },
  { value: "starter", label: "Starter" },
  { value: "professional", label: "Professional" },
  { value: "enterprise", label: "Enterprise" },
  { value: "included", label: "Included / bundled" }
] as const;

const platformProductOptions = [
  { key: "smart_crm", label: "Smart CRM" },
  { key: "marketing_hub", label: "Marketing Hub" },
  { key: "sales_hub", label: "Sales Hub" },
  { key: "service_hub", label: "Service Hub" },
  { key: "content_hub", label: "Content Hub" },
  { key: "operations_hub", label: "Operations Hub" },
  { key: "data_hub", label: "Data Hub" },
  { key: "commerce_hub", label: "Commerce Hub" },
  { key: "breeze", label: "Breeze / AI" },
  { key: "small_business_bundle", label: "Small Business Bundle" },
  { key: "free_tools", label: "Free Tools" }
] as const;

const productKeyByHub: Record<string, string> = {
  sales: "sales_hub",
  marketing: "marketing_hub",
  service: "service_hub",
  cms: "content_hub",
  ops: "operations_hub",
  data: "data_hub",
  commerce: "commerce_hub"
};

function createProjectDraft(project: Project) {
  return {
    clientName: project.client.name,
    type: project.engagementType,
    scopeType: project.scopeType ?? "discovery",
    commercialBrief: project.commercialBrief ?? "",
    implementationApproach: project.implementationApproach ?? "pragmatic_poc",
    problemStatement: project.problemStatement ?? "",
    solutionRecommendation: project.solutionRecommendation ?? "",
    scopeExecutiveSummary: project.scopeExecutiveSummary ?? "",
    customerPlatformTier: project.customerPlatformTier ?? "",
    platformTierSelections: project.platformTierSelections ?? {},
    portalId: project.portal?.portalId ?? "",
    hubs: project.selectedHubs,
    owner: project.owner,
    ownerEmail: project.ownerEmail,
    clientIndustry: project.client.industry ?? "",
    clientWebsite: project.client.website ?? "",
    clientAdditionalWebsitesText: (project.client.additionalWebsites ?? []).join(
      "\n"
    ),
    clientLinkedinUrl: project.client.linkedinUrl ?? "",
    clientFacebookUrl: project.client.facebookUrl ?? "",
    clientInstagramUrl: project.client.instagramUrl ?? "",
    clientXUrl: project.client.xUrl ?? "",
    clientYoutubeUrl: project.client.youtubeUrl ?? "",
    clientChampionFirstName: project.clientChampionFirstName ?? "",
    clientChampionLastName: project.clientChampionLastName ?? "",
    clientChampionEmail: project.clientChampionEmail ?? ""
  };
}

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function getPreviewText(value: string | null | undefined, maxLength = 420) {
  const normalized = (value ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trim()}...`;
}

function getPackagingOutcome(
  fit: "good" | "attention" | "upgrade_needed" | undefined
) {
  if (fit === "good") {
    return {
      label: "Works as selected",
      className: "text-[#51d0b0]"
    };
  }

  if (fit === "attention") {
    return {
      label: "Works with workaround",
      className: "text-[#f8c16c]"
    };
  }

  return {
    label: "Needs upgrade",
    className: "text-[#ff8a8a]"
  };
}

function formatEngagementType(value: string) {
  return (
    engagementOptions.find((option) => option.value === value)?.label ??
    formatLabel(value)
  );
}

function formatHubLabel(value: string) {
  return hubOptions.find((option) => option.value === value)?.label ?? value;
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

function formatPlatformProductLabel(value: string) {
  return (
    platformProductOptions.find((option) => option.key === value)?.label ??
    value.replace(/_/g, " ")
  );
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function statusClass(status: string) {
  switch (status) {
    case "complete":
    case "completed":
      return "status-ready";
    case "in_progress":
    case "active":
      return "status-in-progress";
    default:
      return "status-draft";
  }
}

function formatEvidenceTypeLabel(type: EvidenceItem["evidenceType"]) {
  switch (type) {
    case "uploaded-doc":
      return "Document";
    case "website-link":
      return "Website";
    case "screen-grab":
      return "Screen grab";
    case "miro-note":
      return "Miro note";
    case "operator-note":
      return "Operator note";
    case "client-input":
      return "Client input";
    case "transcript":
      return "Transcript";
    default:
      return "Summary";
  }
}

function cloneQuestionnaireDefinitions(
  value?: ClientQuestionnaireDefinitionMap | null
): ClientQuestionnaireDefinitionMap {
  return JSON.parse(
    JSON.stringify(value ?? createDefaultClientQuestionnaireDefinitionMap())
  ) as ClientQuestionnaireDefinitionMap;
}

function createQuestionKey(label: string, fallbackIndex: number) {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || `custom_question_${fallbackIndex}`;
}

function EditButton({
  onClick,
  label
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rounded-full border border-[rgba(255,255,255,0.08)] p-2 text-text-muted opacity-0 transition hover:text-white group-hover:opacity-100"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-4 w-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.862 4.487a2.1 2.1 0 1 1 2.97 2.97L8.5 18.79 4 20l1.21-4.5 11.652-11.013Z"
        />
      </svg>
    </button>
  );
}

export default function ProjectOverview({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [sessions, setSessions] = useState<SessionDetail[]>([]);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [discoverySummary, setDiscoverySummary] =
    useState<DiscoverySummary | null>(null);
  const [projectDraft, setProjectDraft] = useState({
    clientName: "",
    type: "IMPLEMENTATION",
    scopeType: "discovery",
    commercialBrief: "",
    implementationApproach: "pragmatic_poc",
    problemStatement: "",
    solutionRecommendation: "",
    scopeExecutiveSummary: "",
    customerPlatformTier: "",
    platformTierSelections: {} as Record<string, string>,
    portalId: "",
    owner: "",
    ownerEmail: "",
    clientIndustry: "",
    clientWebsite: "",
    clientAdditionalWebsitesText: "",
    clientLinkedinUrl: "",
    clientFacebookUrl: "",
    clientInstagramUrl: "",
    clientXUrl: "",
    clientYoutubeUrl: "",
    hubs: [] as string[],
    clientChampionFirstName: "",
    clientChampionLastName: "",
    clientChampionEmail: ""
  });
  const [questionnaireDraft, setQuestionnaireDraft] =
    useState<ClientQuestionnaireDefinitionMap>(
      createDefaultClientQuestionnaireDefinitionMap()
    );
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [aiProviders, setAiProviders] = useState<ProviderConnectionSummary[]>([]);
  const [emailSettings, setEmailSettings] = useState<EmailSettingsSummary | null>(
    null
  );
  const [clientUsers, setClientUsers] = useState<ClientPortalUser[]>([]);
  const [savedClientContacts, setSavedClientContacts] = useState<SavedClientContact[]>(
    []
  );
  const [portalOptions, setPortalOptions] = useState<HubSpotPortalOption[]>([]);
  const [hubSpotInstallProfile, setHubSpotInstallProfile] =
    useState<HubSpotInstallProfile>("core_crm");
  const [supportingContext, setSupportingContext] = useState<EvidenceItem[]>([]);
  const [contextDraft, setContextDraft] = useState({
    evidenceType: "uploaded-doc" as EvidenceItem["evidenceType"],
    sourceLabel: "",
    sourceUrl: "",
    content: ""
  });
  const [savingContext, setSavingContext] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [clientAccessDraft, setClientAccessDraft] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "contributor",
    questionnaireAccess: true
  });
  const [clientAccessSaving, setClientAccessSaving] = useState(false);
  const [clientAccessUpdatingId, setClientAccessUpdatingId] = useState<string | null>(
    null
  );
  const [clientPortalPushBusy, setClientPortalPushBusy] = useState(false);
  const [clientAccessFeedback, setClientAccessFeedback] = useState<string | null>(
    null
  );
  const [editingField, setEditingField] = useState<EditableField>(null);
  const [savingField, setSavingField] = useState<EditableField>(null);
  const [projectEditError, setProjectEditError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalConnectBusy, setPortalConnectBusy] = useState(false);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryFeedback, setSummaryFeedback] = useState<string | null>(null);
  const [blueprintBusy, setBlueprintBusy] = useState(false);
  const [blueprintError, setBlueprintError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFullBrief, setShowFullBrief] = useState(false);
  const [showSupportingContext, setShowSupportingContext] = useState(false);
  const [questionnaireSaving, setQuestionnaireSaving] = useState(false);
  const [questionnaireError, setQuestionnaireError] = useState<string | null>(null);
  const [questionnaireFeedback, setQuestionnaireFeedback] = useState<string | null>(
    null
  );
  const [emailIntent, setEmailIntent] = useState("next_steps");
  const [emailProviderKey, setEmailProviderKey] = useState("openai");
  const [emailModelOverride, setEmailModelOverride] = useState("");
  const [emailInstructions, setEmailInstructions] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);
  const [dictationActive, setDictationActive] = useState(false);
  const speechRecognitionRef = useRef<any>(null);

  async function loadProjectData() {
    const [
      projectResponse,
      sessionsResponse,
      blueprintResponse,
      summaryResponse,
      usersResponse,
      providersResponse,
      emailSettingsResponse,
      clientUsersResponse,
      supportingContextResponse,
      clientsResponse,
      portalsResponse
    ] = await Promise.all([
      fetch(`/api/projects/${encodeURIComponent(projectId)}`),
      fetch(`/api/discovery/${encodeURIComponent(projectId)}/sessions`),
      fetch(`/api/projects/${encodeURIComponent(projectId)}/blueprint`),
      fetch(`/api/projects/${encodeURIComponent(projectId)}/discovery-summary`),
      fetch("/api/users"),
      fetch("/api/provider-connections"),
      fetch("/api/email-settings"),
      fetch(`/api/projects/${encodeURIComponent(projectId)}/client-users`),
      fetch(`/api/projects/${encodeURIComponent(projectId)}/sessions/0/evidence`),
      fetch("/api/clients"),
      fetch("/api/portals")
    ]);

    if (
      !projectResponse.ok ||
      !sessionsResponse.ok ||
      !summaryResponse.ok ||
      !usersResponse.ok ||
      !providersResponse.ok
    ) {
      throw new Error("Failed to load project");
    }

    const projectBody = await projectResponse.json();
    const sessionsBody = await sessionsResponse.json();
    const summaryBody = await summaryResponse.json();
    const usersBody = await usersResponse.json();
    const providersBody = await providersResponse.json();
    const emailSettingsBody = emailSettingsResponse.ok
      ? await emailSettingsResponse.json().catch(() => null)
      : null;
    const clientUsersBody = await clientUsersResponse.json();
    const supportingContextBody = await supportingContextResponse.json();
    const clientsBody = clientsResponse.ok
      ? await clientsResponse.json().catch(() => null)
      : null;
    const portalsBody = portalsResponse.ok
      ? await portalsResponse.json().catch(() => null)
      : null;

    setProject(projectBody.project);
    setProjectDraft(createProjectDraft(projectBody.project));
    setQuestionnaireDraft(
      cloneQuestionnaireDefinitions(projectBody.project.clientQuestionnaireConfig)
    );
    setSessions(sessionsBody.sessionDetails ?? []);
    setDiscoverySummary(summaryBody.summary ?? null);
    setTeamUsers(usersBody.users ?? []);
    const enabledDraftProviders = (providersBody.providers ?? []).filter(
      (provider: ProviderConnectionSummary) =>
        provider.isEnabled &&
        provider.hasApiKey &&
        (provider.providerKey === "openai" || provider.providerKey === "anthropic")
    );
    setAiProviders(enabledDraftProviders);
    setEmailSettings(emailSettingsBody?.settings ?? null);
    setClientUsers(clientUsersBody.clientUsers ?? []);
    setSupportingContext(supportingContextBody.evidenceItems ?? []);
    const matchingClient =
      (clientsBody?.clients ?? []).find(
        (client: { name?: string; contacts?: SavedClientContact[] }) =>
          client.name === projectBody.project?.client?.name
      ) ?? null;
    setSavedClientContacts(matchingClient?.contacts ?? []);
    setPortalOptions(portalsBody?.portals ?? []);
    if (enabledDraftProviders.length > 0) {
      setEmailProviderKey((currentKey) =>
        enabledDraftProviders.some((provider) => provider.providerKey === currentKey)
          ? currentKey
          : enabledDraftProviders[0].providerKey
      );
      setEmailModelOverride((currentModel) => {
        if (currentModel.trim()) {
          return currentModel;
        }

        return (
          enabledDraftProviders.find(
            (provider) => provider.providerKey === emailProviderKey
          )?.defaultModel ?? enabledDraftProviders[0].defaultModel ?? ""
        );
      });
    }

    if (blueprintResponse.ok) {
      const blueprintBody = await blueprintResponse.json();
      setBlueprint(blueprintBody.blueprint);
    } else if (blueprintResponse.status === 404) {
      setBlueprint(null);
    } else {
      throw new Error("Failed to load blueprint status");
    }
  }

  useEffect(() => {
    async function loadProject() {
      try {
        await loadProjectData();
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
    if (aiProviders.length === 0) {
      return;
    }

    const selectedProvider =
      aiProviders.find((provider) => provider.providerKey === emailProviderKey) ??
      aiProviders[0];

    if (selectedProvider && selectedProvider.providerKey !== emailProviderKey) {
      setEmailProviderKey(selectedProvider.providerKey);
    }

    if (!emailModelOverride.trim() && selectedProvider?.defaultModel) {
      setEmailModelOverride(selectedProvider.defaultModel);
    }
  }, [aiProviders, emailModelOverride, emailProviderKey]);

  useEffect(() => {
    if (!project) {
      return;
    }

    const defaultRecipients = Array.from(
      new Set(
        [
          project.clientChampionEmail ?? "",
          ...clientUsers.map((clientUser) => clientUser.email)
        ].filter(Boolean)
      )
    ).join(", ");

    if (!emailTo.trim() && defaultRecipients) {
      setEmailTo(defaultRecipients);
    }

    if (!emailSubject.trim()) {
      setEmailSubject(`${project.client.name} | ${project.name}`);
    }
  }, [clientUsers, emailSubject, emailTo, project]);

  useEffect(() => {
    return () => {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
    };
  }, []);

  const completedSessions = sessions.filter((session) =>
    isSessionComplete(session)
  ).length;
  const isStandaloneQuote = project?.scopeType === "standalone_quote";
  const isScopeLocked = Boolean(
    project?.scopeLockedAt || project?.quoteApprovalStatus === "approved"
  );
  const session1Complete = isSessionComplete(
    sessions.find((session) => session.session === 1)
  );
  const session3Complete = isSessionComplete(
    sessions.find((session) => session.session === 3)
  );
  const canGenerateBlueprint = isStandaloneQuote
    ? Boolean(
        project?.commercialBrief?.trim().length ||
          supportingContext.length ||
          discoverySummary
      )
    : session1Complete && session3Complete;
  const totalHumanHours =
    blueprint?.tasks
      .filter((task) => task.type === "Human")
      .reduce((total, task) => total + task.effortHours, 0) ?? 0;
  const scopedSupportingTools = getDisplaySupportingTools(
    project,
    discoverySummary?.supportingTools
  );
  const scopedKeyRisks = getDisplayKeyRisks(project, discoverySummary?.keyRisks);
  const scopedNextQuestions = getDisplayNextQuestions(
    project,
    discoverySummary?.recommendedNextQuestions
  );

  function startEditing(field: Exclude<EditableField, null>) {
    if (!project) {
      return;
    }

    setProjectDraft(createProjectDraft(project));
    setProjectEditError(null);
    setEditingField(field);
  }

  function cancelEditing() {
    if (!project) {
      return;
    }

    setProjectDraft(createProjectDraft(project));
    setProjectEditError(null);
    setEditingField(null);
  }

  function toggleHubSelection(hub: string) {
    setProjectDraft((currentDraft) => ({
      ...currentDraft,
      hubs: currentDraft.hubs.includes(hub)
        ? currentDraft.hubs.filter((currentHub) => currentHub !== hub)
        : [...currentDraft.hubs, hub]
    }));
  }

  function updatePlatformTierSelection(productKey: string, tier: string) {
    setProjectDraft((currentDraft) => ({
      ...currentDraft,
      platformTierSelections: {
        ...(currentDraft.platformTierSelections ?? {}),
        [productKey]: tier
      }
    }));
  }

  const visiblePlatformProducts = Array.from(
    new Set([
      "smart_crm",
      ...projectDraft.hubs.map((hub) => productKeyByHub[hub]).filter(Boolean),
      "breeze",
      "small_business_bundle",
      "free_tools"
    ])
  );

  function selectOwner(ownerName: string) {
    const selectedOwner = teamUsers.find((user) => user.name === ownerName);

    setProjectDraft((currentDraft) => ({
      ...currentDraft,
      owner: ownerName,
      ownerEmail: selectedOwner?.email ?? currentDraft.ownerEmail
    }));
  }

  async function connectHubSpotPortal() {
    setPortalConnectBusy(true);
    setProjectEditError(null);

    try {
      const response = await fetch("/api/hubspot/oauth/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          projectId,
          installProfile: hubSpotInstallProfile
        })
      });
      const body = await response.json().catch(() => null);

      if (!response.ok || !body?.authUrl) {
        throw new Error(body?.error ?? "Failed to start HubSpot portal connection");
      }

      window.location.href = body.authUrl;
    } catch (connectError) {
      setProjectEditError(
        connectError instanceof Error
          ? connectError.message
          : "Failed to start HubSpot portal connection"
      );
      setPortalConnectBusy(false);
    }
  }

  async function saveField(field: Exclude<EditableField, null>) {
    if (!project) {
      return;
    }

    let payload: Record<string, unknown>;

    switch (field) {
      case "clientName":
        payload = { clientName: projectDraft.clientName };
        break;
      case "type":
        payload = { type: projectDraft.type };
        break;
      case "brief":
        payload = {
          scopeType: projectDraft.scopeType,
          commercialBrief: projectDraft.commercialBrief
        };
        break;
      case "portalId":
        payload = { portalId: projectDraft.portalId };
        break;
      case "owner":
        payload = {
          owner: projectDraft.owner,
          ownerEmail: projectDraft.ownerEmail
        };
        break;
      case "clientProfile":
        payload = {
          clientIndustry: projectDraft.clientIndustry,
          clientWebsite: projectDraft.clientWebsite,
          clientAdditionalWebsites: projectDraft.clientAdditionalWebsitesText
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          clientLinkedinUrl: projectDraft.clientLinkedinUrl,
          clientFacebookUrl: projectDraft.clientFacebookUrl,
          clientInstagramUrl: projectDraft.clientInstagramUrl,
          clientXUrl: projectDraft.clientXUrl,
          clientYoutubeUrl: projectDraft.clientYoutubeUrl
        };
        break;
      case "platformPackaging":
        payload = {
          implementationApproach: projectDraft.implementationApproach,
          customerPlatformTier: projectDraft.customerPlatformTier,
          platformTierSelections: Object.fromEntries(
            Object.entries(projectDraft.platformTierSelections ?? {}).filter(
              ([, tier]) => Boolean(tier)
            )
          )
        };
        break;
      case "clientChampion":
        payload = {
          clientChampionFirstName: projectDraft.clientChampionFirstName,
          clientChampionLastName: projectDraft.clientChampionLastName,
          clientChampionEmail: projectDraft.clientChampionEmail
        };
        break;
      case "hubs":
      default:
        payload = { hubs: projectDraft.hubs };
        break;
    }

    setSavingField(field);
    setProjectEditError(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to update project");
      }

      const body = await response.json();
      setProject(body.project);
      setProjectDraft(createProjectDraft(body.project));
      setEditingField(null);
    } catch (saveError) {
      setProjectEditError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to update project"
      );
    } finally {
      setSavingField(null);
    }
  }

  async function generateDiscoverySummary() {
    if (!project) {
      return;
    }

    async function recoverSavedSummary(projectId: string) {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const rescueResponse = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/discovery-summary`
        ).catch(() => null);
        const rescueBody =
          rescueResponse && rescueResponse.ok
            ? await rescueResponse.json().catch(() => null)
            : null;

        if (rescueBody?.summary) {
          return rescueBody.summary as DiscoverySummary;
        }

        if (attempt < 3) {
          await waitForDelay(450 * (attempt + 1));
        }
      }

      return null;
    }

    function applySummaryResult(nextSummary: DiscoverySummary) {
      setDiscoverySummary(nextSummary);
      if (nextSummary.executiveSummary) {
        setProject((currentProject) =>
          currentProject
            ? {
                ...currentProject,
                scopeExecutiveSummary: nextSummary.executiveSummary
              }
            : currentProject
        );
        setProjectDraft((currentDraft) => ({
          ...currentDraft,
          scopeExecutiveSummary: nextSummary.executiveSummary
        }));
      }
    }

    setSummaryBusy(true);
    setSummaryError(null);
    setSummaryFeedback(null);

    try {
      if (isStandaloneQuote) {
        const resetResponse = await fetch(
          `/api/projects/${encodeURIComponent(project.id)}/discovery-summary`,
          {
            method: "DELETE"
          }
        );

        const resetText = await resetResponse.text();
        let resetBody: { error?: string } | null = null;
        try {
          resetBody = resetText ? JSON.parse(resetText) : null;
        } catch {
          resetBody = null;
        }

        if (!resetResponse.ok) {
          throw new Error(
            resetBody?.error ||
              `Failed to reset generated outputs (${resetResponse.status} ${resetResponse.statusText})`
          );
        }

        setDiscoverySummary(null);
        setBlueprint(null);
        setProject((currentProject) =>
          currentProject
            ? {
                ...currentProject,
                scopeExecutiveSummary: null
              }
            : currentProject
        );
        setProjectDraft((currentDraft) => ({
          ...currentDraft,
          scopeExecutiveSummary: null
        }));
      }

      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/discovery-summary`,
        {
          method: "POST"
        }
      );

      const responseText = await response.text();
      let body: { summary?: DiscoverySummary; error?: string } | null = null;

      try {
        body = responseText ? JSON.parse(responseText) : null;
      } catch {
        body = null;
      }

      if (!response.ok) {
        const recoveredSummary = await recoverSavedSummary(project.id);

        if (recoveredSummary) {
          applySummaryResult(recoveredSummary);
          await loadProjectData();
          setSummaryFeedback("Summary refreshed from the saved result.");
          return;
        }

        throw new Error(
          body?.error ||
            `Failed to generate discovery summary (${response.status} ${response.statusText})`
        );
      }

      const nextSummary =
        body?.summary ?? (await recoverSavedSummary(project.id));

      if (nextSummary) {
        applySummaryResult(nextSummary);
      }
      try {
        await loadProjectData();
        setSummaryFeedback(
          `Summary refreshed at ${new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
          })}.`
        );
      } catch (reloadError) {
        console.error("Summary refreshed but project reload failed", reloadError);
        setSummaryFeedback(
          `Summary refreshed, but the page could not fully reload. Please refresh the browser.`
        );
      }
    } catch (generationError) {
      setSummaryError(
        generationError instanceof Error
          ? generationError.message
          : "Failed to generate discovery summary"
      );
    } finally {
      setSummaryBusy(false);
    }
  }

  async function resetDiscoverySummaryState() {
    if (!project) {
      return;
    }

    setSummaryBusy(true);
    setSummaryError(null);
    setSummaryFeedback(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/discovery-summary`,
        {
          method: "DELETE"
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to reset discovery summary");
      }

      setDiscoverySummary(null);
      setProject((currentProject) =>
        currentProject
          ? {
              ...currentProject,
              scopeExecutiveSummary: null
            }
          : currentProject
      );
      setProjectDraft((currentDraft) => ({
        ...currentDraft,
        scopeExecutiveSummary: null
      }));
      await loadProjectData();
      setSummaryFeedback("Summary reset. You can now generate a clean overview.");
    } catch (resetError) {
      setSummaryError(
        resetError instanceof Error
          ? resetError.message
          : "Failed to reset discovery summary"
      );
    } finally {
      setSummaryBusy(false);
    }
  }

  async function addClientPortalUser() {
    if (!project) {
      return;
    }

    setClientAccessSaving(true);
    setProjectEditError(null);
    setClientAccessFeedback(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/client-users`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(clientAccessDraft)
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to add client user");
      }

      const nextClientUser = body.clientUser;
      setClientUsers((currentUsers) => {
        const existingIndex = currentUsers.findIndex(
          (clientUser) => clientUser.id === nextClientUser.id
        );

        if (existingIndex >= 0) {
          return currentUsers.map((clientUser) =>
            clientUser.id === nextClientUser.id ? nextClientUser : clientUser
          );
        }

        return [...currentUsers, nextClientUser];
      });
      if (nextClientUser?.inviteLink && typeof navigator !== "undefined") {
        await navigator.clipboard.writeText(nextClientUser.inviteLink);
        setClientAccessFeedback("Invite link copied to clipboard.");
      } else if (nextClientUser?.authStatus === "active") {
        setClientAccessFeedback("Client user linked to this project. Access is already active.");
      } else {
        setClientAccessFeedback("Client user created.");
      }
      setClientAccessDraft({
        firstName: "",
        lastName: "",
        email: "",
        role: "contributor",
        questionnaireAccess: true
      });
    } catch (saveError) {
      setProjectEditError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to add client user"
      );
    } finally {
      setClientAccessSaving(false);
    }
  }

  async function inviteSavedClientContact(contact: SavedClientContact) {
    setClientAccessDraft((currentDraft) => ({
      ...currentDraft,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      role: contact.canApproveQuotes ? "approver" : "contributor"
    }));

    if (!project) {
      return;
    }

    setClientAccessSaving(true);
    setProjectEditError(null);
    setClientAccessFeedback(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/client-users`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            role: contact.canApproveQuotes ? "approver" : "contributor",
            questionnaireAccess: true
          })
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to invite saved contact");
      }

      const nextClientUser = body.clientUser;
      setClientUsers((currentUsers) => {
        const existingIndex = currentUsers.findIndex(
          (clientUser) => clientUser.id === nextClientUser.id
        );

        if (existingIndex >= 0) {
          return currentUsers.map((clientUser) =>
            clientUser.id === nextClientUser.id ? nextClientUser : clientUser
          );
        }

        return [...currentUsers, nextClientUser];
      });

      const contactName = [contact.firstName, contact.lastName]
        .filter(Boolean)
        .join(" ");

      if (nextClientUser?.inviteLink && typeof navigator !== "undefined") {
        await navigator.clipboard.writeText(nextClientUser.inviteLink);
        setClientAccessFeedback(
          `${contactName || contact.email} invited to the portal and the invite link was copied.`
        );
      } else {
        setClientAccessFeedback(
          `${contactName || contact.email} already had active portal access and is now linked to this project.`
        );
      }
    } catch (inviteError) {
      setProjectEditError(
        inviteError instanceof Error
          ? inviteError.message
          : "Failed to invite saved contact"
      );
    } finally {
      setClientAccessSaving(false);
    }
  }

  async function copyClientAccessLink(
    userId: string,
    action: "invite-link" | "reset-link"
  ) {
    if (!project) {
      return;
    }

    setProjectEditError(null);
    setClientAccessFeedback(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/client-users/${encodeURIComponent(userId)}/${action}`,
        {
          method: "POST"
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to generate access link");
      }

      const copiedValue = body.inviteLink ?? body.resetLink;
      if (copiedValue && typeof navigator !== "undefined") {
        await navigator.clipboard.writeText(copiedValue);
        setClientAccessFeedback(
          action === "invite-link"
            ? "Invite link copied to clipboard."
            : "Reset link copied to clipboard."
        );
      }
    } catch (linkError) {
      setProjectEditError(
        linkError instanceof Error
          ? linkError.message
          : "Failed to generate access link"
      );
    }
  }

  async function updateClientPortalUser(
    userId: string,
    updates: { role?: string; questionnaireAccess?: boolean }
  ) {
    if (!project) {
      return;
    }

    setClientAccessUpdatingId(userId);
    setProjectEditError(null);
    setClientAccessFeedback(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/client-users/${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(updates)
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to update client access");
      }

      setClientUsers((currentUsers) =>
        currentUsers.map((clientUser) =>
          clientUser.id === userId ? body.clientUser : clientUser
        )
      );
      setClientAccessFeedback("Client portal access updated.");
    } catch (updateError) {
      setProjectEditError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update client access"
      );
    } finally {
      setClientAccessUpdatingId(null);
    }
  }

  function useSavedClientContact(contact: SavedClientContact) {
    const contactName = `${contact.firstName} ${contact.lastName}`.trim();
    setClientAccessDraft((currentDraft) => ({
      ...currentDraft,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      role: contact.canApproveQuotes ? "approver" : currentDraft.role
    }));
    setClientAccessFeedback(
      contactName
        ? `${contactName} loaded into the portal access form.`
        : "Saved contact loaded into the portal access form."
    );
  }

  function addRecipient(
    target: "to" | "cc",
    email: string,
    label?: string
  ) {
    if (target === "to") {
      setEmailTo((currentValue) => appendRecipientList(currentValue, email));
    } else {
      setEmailCc((currentValue) => appendRecipientList(currentValue, email));
    }

    setEmailFeedback(
      `${label || email} added to ${target.toUpperCase()}.`
    );
    setEmailError(null);
  }

  async function copyClientQuoteLink() {
    if (!project) {
      return;
    }

    setProjectEditError(null);
    setClientAccessFeedback(null);

    try {
      if (typeof navigator === "undefined" || typeof window === "undefined") {
        throw new Error("Clipboard is not available in this browser");
      }

      const clientQuoteUrl = `${window.location.origin}/client/projects/${encodeURIComponent(project.id)}/quote`;
      await navigator.clipboard.writeText(clientQuoteUrl);
      setClientAccessFeedback("Client portal quote link copied to clipboard.");
    } catch (copyError) {
      setProjectEditError(
        copyError instanceof Error
          ? copyError.message
          : "Failed to copy client quote link"
      );
    }
  }

  async function pushQuoteToClientPortal() {
    if (!project) {
      return;
    }

    setClientPortalPushBusy(true);
    setProjectEditError(null);
    setClientAccessFeedback(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/quote/share`,
        {
          method: "POST",
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to push quote to client portal");
      }

      if (body?.project) {
        setProject(body.project);
        setProjectDraft(createProjectDraft(body.project));
      }

      setClientAccessFeedback(
        "Quote pushed to the client portal and posted to the client inbox."
      );
    } catch (pushError) {
      setProjectEditError(
        pushError instanceof Error
          ? pushError.message
          : "Failed to push quote to client portal"
      );
    } finally {
      setClientPortalPushBusy(false);
    }
  }

  async function addSupportingContext() {
    if (!project) {
      return;
    }

    setSavingContext(true);
    setContextError(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/sessions/0/evidence`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(contextDraft)
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to add supporting context");
      }

      setSupportingContext((currentItems) => [
        body.evidenceItem,
        ...currentItems
      ]);
      setContextDraft({
        evidenceType: "uploaded-doc",
        sourceLabel: "",
        sourceUrl: "",
        content: ""
      });
    } catch (saveError) {
      setContextError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to add supporting context"
      );
    } finally {
      setSavingContext(false);
    }
  }

  function updateQuestionnaireSession(
    sessionNumber: number,
    field: "title" | "description",
    value: string
  ) {
    setQuestionnaireDraft((currentDraft) => ({
      ...currentDraft,
      [sessionNumber]: {
        ...currentDraft[sessionNumber],
        [field]: value
      }
    }));
  }

  function updateQuestionnaireQuestion(
    sessionNumber: number,
    questionIndex: number,
    field: keyof ClientQuestionDefinition,
    value: string
  ) {
    setQuestionnaireDraft((currentDraft) => ({
      ...currentDraft,
      [sessionNumber]: {
        ...currentDraft[sessionNumber],
        questions: currentDraft[sessionNumber].questions.map((question, index) =>
          index === questionIndex
            ? {
                ...question,
                [field]: value,
                ...(field === "label" && !question.key.trim()
                  ? {
                      key: createQuestionKey(value, questionIndex + 1)
                    }
                  : {})
              }
            : question
        )
      }
    }));
  }

  function addQuestionnaireQuestion(sessionNumber: number) {
    setQuestionnaireDraft((currentDraft) => {
      const questions = currentDraft[sessionNumber].questions;
      const nextIndex = questions.length + 1;
      return {
        ...currentDraft,
        [sessionNumber]: {
          ...currentDraft[sessionNumber],
          questions: [
            ...questions,
            {
              key: `custom_question_${nextIndex}`,
              label: `New question ${nextIndex}`,
              hint: ""
            }
          ]
        }
      };
    });
  }

  function removeQuestionnaireQuestion(sessionNumber: number, questionIndex: number) {
    setQuestionnaireDraft((currentDraft) => ({
      ...currentDraft,
      [sessionNumber]: {
        ...currentDraft[sessionNumber],
        questions: currentDraft[sessionNumber].questions.filter(
          (_, index) => index !== questionIndex
        )
      }
    }));
  }

  function resetQuestionnaireDefaults() {
    setQuestionnaireDraft(createDefaultClientQuestionnaireDefinitionMap());
    setQuestionnaireError(null);
    setQuestionnaireFeedback("Project inputs reset to the default Muloo structure.");
  }

  async function saveQuestionnaireConfig() {
    if (!project) {
      return;
    }

    setQuestionnaireSaving(true);
    setQuestionnaireError(null);
    setQuestionnaireFeedback(null);

    try {
      const payload = cloneQuestionnaireDefinitions(questionnaireDraft);

      Object.entries(payload).forEach(([sessionNumberText, session]) => {
        session.questions = session.questions.map((question, index) => ({
          ...question,
          key:
            question.key.trim() ||
            createQuestionKey(question.label, index + 1)
        }));
        payload[Number(sessionNumberText)] = session;
      });

      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientQuestionnaireConfig: payload
          })
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save project inputs");
      }

      setProject(body.project);
      setQuestionnaireDraft(
        cloneQuestionnaireDefinitions(body.project.clientQuestionnaireConfig)
      );
      setQuestionnaireFeedback("Project inputs saved for this project.");
    } catch (saveError) {
      setQuestionnaireError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save project inputs"
      );
    } finally {
      setQuestionnaireSaving(false);
    }
  }

  async function generateEmailDraft(mode: "generate" | "cleanup" = "generate") {
    if (!project) {
      return;
    }

    setEmailBusy(true);
    setEmailError(null);
    setEmailFeedback(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/email-draft`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intent: emailIntent,
            mode,
            providerKey: emailProviderKey,
            modelOverride: emailModelOverride,
            sourceSubject: emailSubject,
            sourceBody: emailBody,
            customInstructions: emailInstructions
          })
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to draft email");
      }

      setEmailSubject(body.draft?.subject ?? emailSubject);
      setEmailBody(body.draft?.body ?? emailBody);
      setEmailFeedback(
        mode === "cleanup"
          ? "Email cleaned up with AI."
          : "Email draft generated from the current project context."
      );
    } catch (draftError) {
      setEmailError(
        draftError instanceof Error ? draftError.message : "Failed to draft email"
      );
    } finally {
      setEmailBusy(false);
    }
  }

  async function copyEmailDraft() {
    if (typeof navigator === "undefined") {
      return;
    }

    await navigator.clipboard.writeText(
      `Subject: ${emailSubject}\n\n${emailBody}`
    );
    setEmailFeedback("Email draft copied to clipboard.");
  }

  function toggleVoiceDictation() {
    const recognitionApi =
      (window as typeof window & {
        SpeechRecognition?: new () => any;
        webkitSpeechRecognition?: new () => any;
      }).SpeechRecognition ??
      (window as typeof window & {
        SpeechRecognition?: new () => any;
        webkitSpeechRecognition?: new () => any;
      }).webkitSpeechRecognition;

    if (!recognitionApi) {
      setEmailError("Voice dictation is not available in this browser.");
      return;
    }

    if (speechRecognitionRef.current && dictationActive) {
      speechRecognitionRef.current.stop();
      return;
    }

    const recognition = new recognitionApi();
    recognition.lang = "en-ZA";
    recognition.interimResults = true;
    recognition.continuous = true;

    const startingBody = emailBody;

    recognition.onstart = () => {
      setDictationActive(true);
      setEmailError(null);
      setEmailFeedback("Voice dictation started.");
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();

      setEmailBody(
        [startingBody.trim(), transcript].filter(Boolean).join(
          startingBody.trim() ? "\n\n" : ""
        )
      );
    };

    recognition.onerror = () => {
      setEmailError("Voice dictation could not complete cleanly.");
      setDictationActive(false);
      speechRecognitionRef.current = null;
    };

    recognition.onend = () => {
      setDictationActive(false);
      speechRecognitionRef.current = null;
    };

    speechRecognitionRef.current = recognition;
    recognition.start();
  }

  async function sendProjectEmail() {
    if (!project) {
      return;
    }

    setEmailSending(true);
    setEmailError(null);
    setEmailFeedback(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/send-email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: emailTo,
            cc: emailCc,
            subject: emailSubject,
            body: emailBody
          })
        }
      );

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to send email");
      }

      setEmailFeedback(
        body?.result?.transport === "google_mailbox"
          ? "Project email sent via the connected Google mailbox."
          : "Project email sent via SMTP relay."
      );
    } catch (sendError) {
      setEmailError(
        sendError instanceof Error ? sendError.message : "Failed to send email"
      );
    } finally {
      setEmailSending(false);
    }
  }

  async function handleBlueprintAction() {
    if (!project) {
      return;
    }

    if (blueprint) {
      router.push(`/blueprint/${project.id}`);
      return;
    }

    setBlueprintBusy(true);
    setBlueprintError(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/blueprint/generate`,
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
      router.push(`/blueprint/${project.id}`);
    } catch (generationError) {
      setBlueprintError(
        generationError instanceof Error
          ? generationError.message
          : "Failed to generate blueprint"
      );
    } finally {
      setBlueprintBusy(false);
    }
  }

  function renderActions(field: Exclude<EditableField, null>) {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => saveField(field)}
          disabled={savingField === field}
          className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#081120] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savingField === field ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={cancelEditing}
          className="rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs font-semibold text-white"
        >
          Cancel
        </button>
      </div>
    );
  }

  function renderError(field: Exclude<EditableField, null>) {
    return editingField === field && projectEditError ? (
      <p className="mt-3 text-sm text-[#ff8f9c]">{projectEditError}</p>
    ) : null;
  }

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
        ) : error || !project ? (
          <div className="rounded-2xl border border-[rgba(224,80,96,0.4)] bg-background-card p-8 text-white">
            {error ?? "Project not found"}
          </div>
        ) : (
          <>
            {isScopeLocked ? (
              <div className="mb-6 rounded-2xl border border-[rgba(45,212,160,0.35)] bg-[rgba(14,44,36,0.7)] p-5 text-sm text-white">
                Quote approved by{" "}
                {project.quoteApprovedByName ||
                  project.quoteApprovedByEmail ||
                  "the client"}
                . Scope-driving edits are now locked. Use change management for
                any additional scoped work.
              </div>
            ) : null}
            <ProjectWorkflowNav
              projectId={project.id}
              showDiscovery={!isStandaloneQuote}
            />
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <Link href="/" className="text-sm text-text-muted">
                  Back to projects
                </Link>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-bold font-heading text-white">
                    {project.name}
                  </h1>
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${statusClass(
                      project.status
                    )}`}
                  >
                    {formatLabel(project.status)}
                  </span>
                </div>
                <p className="mt-3 text-text-secondary">
                  {project.client.name}
                  {project.client.region ? ` - ${project.client.region}` : ""}
                </p>
              </div>

              <div className="flex flex-col items-end gap-3">
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={generateDiscoverySummary}
                    disabled={summaryBusy || isScopeLocked}
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                  >
                    {summaryBusy
                      ? "Generating Summary..."
                      : discoverySummary
                        ? isStandaloneQuote
                          ? "Refresh Job Summary"
                          : "Refresh Agent Summary"
                        : isStandaloneQuote
                          ? "Generate Job Summary"
                          : "Generate Agent Summary"}
                  </button>
                  <button
                    type="button"
                    onClick={resetDiscoverySummaryState}
                    disabled={summaryBusy || isScopeLocked}
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-text-secondary disabled:cursor-not-allowed disabled:text-text-muted"
                  >
                    Reset Summary
                  </button>
                  <Link
                    href={`/projects/${project.id}/delivery`}
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
                  >
                    Open Delivery Board
                  </Link>
                  {!isStandaloneQuote ? (
                    <>
                      <Link
                        href={`/projects/${project.id}/inputs`}
                        className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
                      >
                        Open Project Inputs
                      </Link>
                      <Link
                        href={`/projects/${project.id}/discovery`}
                        className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
                      >
                        Open Discovery
                      </Link>
                      <Link
                        href={`/projects/${project.id}/proposal`}
                        className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
                      >
                        Open Discovery Doc
                      </Link>
                    </>
                  ) : null}
                  <Link
                    href={`/projects/${project.id}/quote`}
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
                  >
                    Open Quote
                  </Link>
                  <button
                    type="button"
                    onClick={() => void pushQuoteToClientPortal()}
                    disabled={
                      clientUsers.length === 0 ||
                      clientPortalPushBusy ||
                      project.quoteApprovalStatus === "approved"
                    }
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                  >
                    {clientPortalPushBusy
                      ? "Pushing..."
                      : project.quoteApprovalStatus === "approved"
                        ? "Quote Approved"
                        : "Push to Client Portal"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyClientQuoteLink()}
                    disabled={clientUsers.length === 0}
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                  >
                    Copy Client Quote Link
                  </button>
                  <button
                    type="button"
                    onClick={handleBlueprintAction}
                    disabled={
                      blueprintBusy ||
                      (!blueprint && !canGenerateBlueprint) ||
                      isScopeLocked
                    }
                    className={`rounded-xl px-4 py-3 text-sm font-medium text-white ${
                      blueprint
                        ? "border border-[rgba(255,255,255,0.08)] bg-background-card"
                        : canGenerateBlueprint && !blueprintBusy
                          ? "bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)]"
                          : "cursor-not-allowed border border-[rgba(255,255,255,0.08)] bg-background-card text-text-muted"
                    }`}
                  >
                    {blueprintBusy
                      ? "Generating..."
                      : blueprint
                        ? "Open Blueprint"
                        : isStandaloneQuote
                          ? "Generate Technical Blueprint"
                          : "Generate Blueprint"}
                  </button>
                </div>
                {blueprintError ? (
                  <p className="max-w-sm text-right text-sm text-[#ff8f9c]">
                    {blueprintError}
                  </p>
                ) : null}
                {summaryError ? (
                  <p className="max-w-sm text-right text-sm text-[#ff8f9c]">
                    {summaryError}
                  </p>
                ) : null}
                {summaryFeedback ? (
                  <p className="max-w-sm text-right text-sm text-emerald-300">
                    {summaryFeedback}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                [
                  isStandaloneQuote ? "Scope Mode" : "Discovery",
                  isStandaloneQuote
                    ? "Standalone quote"
                    : `${completedSessions}/4 sessions`,
                  "text-white"
                ],
                [
                  isStandaloneQuote ? "Technical Blueprint" : "Blueprint",
                  blueprint ? "Generated" : "Not generated",
                  blueprint ? "text-status-success" : "text-text-secondary"
                ],
                [
                  isStandaloneQuote ? "Planned Hours" : "Human Hours",
                  blueprint ? `${totalHumanHours} hrs` : "-",
                  "text-status-warning"
                ],
                [
                  "Last Updated",
                  formatDate(project.updatedAt),
                  "text-status-info"
                ]
              ].map(([label, value, valueClass]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6"
                >
                  <p className="text-sm text-text-muted">{label}</p>
                  <p className={`mt-3 text-2xl font-semibold ${valueClass}`}>
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
              <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <h2 className="text-lg font-semibold text-white">
                  Project Context
                </h2>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="group rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Client Name
                        </p>
                        {editingField === "clientName" ? (
                          <>
                            <input
                              value={projectDraft.clientName}
                              onChange={(event) =>
                                setProjectDraft((currentDraft) => ({
                                  ...currentDraft,
                                  clientName: event.target.value
                                }))
                              }
                              className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            />
                            {renderActions("clientName")}
                          </>
                        ) : (
                          <p className="mt-2 text-sm text-white">
                            {project.client.name}
                          </p>
                        )}
                      </div>
                      {editingField !== "clientName" ? (
                        <EditButton
                          label="Edit client name"
                          onClick={() => startEditing("clientName")}
                        />
                      ) : null}
                    </div>
                    {renderError("clientName")}
                  </div>

                  <div className="group rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Project Type
                        </p>
                        {editingField === "type" ? (
                          <>
                            <select
                              value={projectDraft.type}
                              onChange={(event) =>
                                setProjectDraft((currentDraft) => ({
                                  ...currentDraft,
                                  type: event.target.value
                                }))
                              }
                              className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            >
                              {engagementOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {renderActions("type")}
                          </>
                        ) : (
                          <>
                            <p className="mt-2 text-sm text-white">
                              {formatEngagementType(project.engagementType)}
                            </p>
                            <p className="mt-1 text-xs text-text-secondary">
                              {isStandaloneQuote
                                ? "Standalone quote workflow"
                                : "Discovery-led implementation workflow"}
                            </p>
                          </>
                        )}
                      </div>
                      {editingField !== "type" ? (
                        <EditButton
                          label="Edit project type"
                          onClick={() => startEditing("type")}
                        />
                      ) : null}
                    </div>
                    {renderError("type")}
                  </div>

                  <div className="group rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            HubSpot Portal
                          </p>
                          {editingField === "portalId" ? (
                            <>
                              <select
                                value={projectDraft.portalId}
                                onChange={(event) =>
                                  setProjectDraft((currentDraft) => ({
                                    ...currentDraft,
                                    portalId: event.target.value
                                  }))
                                }
                                className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                              >
                                <option value="">Not linked yet</option>
                                {portalOptions.map((portalOption) => (
                                  <option
                                    key={portalOption.id}
                                    value={portalOption.portalId}
                                  >
                                    {portalOption.displayName} · {portalOption.portalId}
                                    {portalOption.connected
                                      ? " · Connected"
                                      : " · Needs reconnect"}
                                  </option>
                                ))}
                              </select>
                              <p className="mt-3 text-xs text-text-secondary">
                                Pick an installed HubSpot portal or connect a new one for this project.
                              </p>
                              {renderActions("portalId")}
                            </>
                          ) : (
                            <>
                              <p className="mt-2 text-sm text-white">
                                {project.portal?.displayName ?? "Not linked yet"}
                              </p>
                              <p className="mt-1 text-xs leading-5 text-text-secondary">
                                {project.portal?.portalId
                                  ? `${project.portal.portalId}${project.portal.connected ? " · Connected" : " · Needs reconnect"}`
                                  : "Connect the client’s HubSpot portal before running live agent work."}
                              </p>
                              {project.portal?.connectedEmail ? (
                                <p className="mt-1 text-xs text-text-secondary">
                                  Connected as {project.portal.connectedEmail}
                                </p>
                              ) : null}
                            </>
                          )}
                        </div>
                        {editingField !== "portalId" ? (
                          <EditButton
                            label="Select linked HubSpot portal"
                            onClick={() => startEditing("portalId")}
                          />
                        ) : null}
                      </div>

                      <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-background-card/60 p-3">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                          <label className="block">
                            <span className="text-[11px] uppercase tracking-[0.2em] text-text-muted">
                              Install profile
                            </span>
                            <select
                              value={hubSpotInstallProfile}
                              onChange={(event) =>
                                setHubSpotInstallProfile(
                                  event.target.value as HubSpotInstallProfile
                                )
                              }
                              className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(81,208,176,0.45)]"
                            >
                              {hubSpotInstallProfileOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          <button
                            type="button"
                            onClick={() => void connectHubSpotPortal()}
                            disabled={portalConnectBusy}
                            className="w-full rounded-xl border border-[rgba(81,208,176,0.2)] bg-[rgba(81,208,176,0.12)] px-4 py-2.5 text-sm font-medium text-[#51d0b0] disabled:cursor-not-allowed lg:w-auto"
                          >
                            {portalConnectBusy ? "Connecting..." : "Connect portal"}
                          </button>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-text-secondary">
                          Start with `Core CRM install` for most client portals. Use the add-on profiles only when that project genuinely needs those HubSpot products.
                        </p>
                      </div>
                    </div>
                    {renderError("portalId")}
                  </div>
                  <div className="group rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Owner
                        </p>
                        {editingField === "owner" ? (
                          <>
                            <select
                              value={projectDraft.owner}
                              onChange={(event) => selectOwner(event.target.value)}
                              className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            >
                              {teamUsers.map((user) => (
                                <option key={user.id} value={user.name}>
                                  {user.name} - {user.role}
                                </option>
                              ))}
                            </select>
                            <p className="mt-3 text-sm text-text-secondary">
                              {projectDraft.ownerEmail}
                            </p>
                            {renderActions("owner")}
                          </>
                        ) : (
                          <>
                            <p className="mt-2 text-sm text-white">
                              {project.owner}
                            </p>
                            <p className="mt-1 text-sm text-text-secondary">
                              {project.ownerEmail}
                            </p>
                          </>
                        )}
                      </div>
                      {editingField !== "owner" ? (
                        <EditButton
                          label="Edit owner"
                          onClick={() => startEditing("owner")}
                        />
                      ) : null}
                    </div>
                    {renderError("owner")}
                  </div>
                  {[
                    ["Portal", project.portal?.displayName ?? "Pending"],
                    [
                      isStandaloneQuote
                        ? "Technical Blueprint Generated"
                        : "Blueprint Generated",
                      blueprint ? "Yes" : "No"
                    ]
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                    >
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        {label}
                      </p>
                      <p className="mt-2 text-sm text-white">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="group mt-5 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        Client Profile
                      </p>
                      {editingField === "clientProfile" ? (
                        <>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <select
                              value={projectDraft.clientIndustry}
                              onChange={(event) =>
                                setProjectDraft((currentDraft) => ({
                                  ...currentDraft,
                                  clientIndustry: event.target.value
                                }))
                              }
                              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            >
                              <option value="">Select industry</option>
                              {industryOptions.map((industry) => (
                                <option key={industry} value={industry}>
                                  {industry}
                                </option>
                              ))}
                            </select>
                            <input
                              value={projectDraft.clientWebsite}
                              onChange={(event) =>
                                setProjectDraft((currentDraft) => ({
                                  ...currentDraft,
                                  clientWebsite: event.target.value
                                }))
                              }
                              placeholder="Primary website"
                              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            />
                          </div>
                          <textarea
                            value={projectDraft.clientAdditionalWebsitesText}
                            onChange={(event) =>
                              setProjectDraft((currentDraft) => ({
                                ...currentDraft,
                                clientAdditionalWebsitesText: event.target.value
                              }))
                            }
                            placeholder="Additional websites, one per line"
                            className="mt-3 min-h-[110px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                          />
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <input
                              value={projectDraft.clientLinkedinUrl}
                              onChange={(event) =>
                                setProjectDraft((currentDraft) => ({
                                  ...currentDraft,
                                  clientLinkedinUrl: event.target.value
                                }))
                              }
                              placeholder="LinkedIn URL"
                              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            />
                            <input
                              value={projectDraft.clientFacebookUrl}
                              onChange={(event) =>
                                setProjectDraft((currentDraft) => ({
                                  ...currentDraft,
                                  clientFacebookUrl: event.target.value
                                }))
                              }
                              placeholder="Facebook URL"
                              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            />
                            <input
                              value={projectDraft.clientInstagramUrl}
                              onChange={(event) =>
                                setProjectDraft((currentDraft) => ({
                                  ...currentDraft,
                                  clientInstagramUrl: event.target.value
                                }))
                              }
                              placeholder="Instagram URL"
                              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            />
                            <input
                              value={projectDraft.clientXUrl}
                              onChange={(event) =>
                                setProjectDraft((currentDraft) => ({
                                  ...currentDraft,
                                  clientXUrl: event.target.value
                                }))
                              }
                              placeholder="X / Twitter URL"
                              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            />
                            <input
                              value={projectDraft.clientYoutubeUrl}
                              onChange={(event) =>
                                setProjectDraft((currentDraft) => ({
                                  ...currentDraft,
                                  clientYoutubeUrl: event.target.value
                                }))
                              }
                              placeholder="YouTube URL"
                              className="md:col-span-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            />
                          </div>
                          {renderActions("clientProfile")}
                        </>
                      ) : (
                        <>
                          <div className="mt-2 grid gap-3 md:grid-cols-2">
                            <div>
                              <p className="text-sm text-white">
                                {project.client.industry ?? "Industry not set"}
                              </p>
                              <p className="mt-1 text-sm text-text-secondary">
                                {project.client.website ?? "No primary website"}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-text-secondary">
                                {(project.client.additionalWebsites ?? []).length > 0
                                  ? `${project.client.additionalWebsites?.length} additional website(s)`
                                  : "No additional websites"}
                              </p>
                              <p className="mt-1 text-sm text-text-secondary">
                                {[
                                  project.client.linkedinUrl && "LinkedIn",
                                  project.client.facebookUrl && "Facebook",
                                  project.client.instagramUrl && "Instagram",
                                  project.client.xUrl && "X",
                                  project.client.youtubeUrl && "YouTube"
                                ]
                                  .filter(Boolean)
                                  .join(", ") || "No social profiles"}
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    {editingField !== "clientProfile" ? (
                      <EditButton
                        label="Edit client profile"
                        onClick={() => startEditing("clientProfile")}
                      />
                    ) : null}
                  </div>
                  {renderError("clientProfile")}
                </div>

                <div className="group mt-5 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        Client Champion
                      </p>
                      {editingField === "clientChampion" ? (
                        <>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <input
                              value={projectDraft.clientChampionFirstName}
                              onChange={(event) =>
                                setProjectDraft((currentDraft) => ({
                                  ...currentDraft,
                                  clientChampionFirstName: event.target.value
                                }))
                              }
                              placeholder="First name"
                              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            />
                            <input
                              value={projectDraft.clientChampionLastName}
                              onChange={(event) =>
                                setProjectDraft((currentDraft) => ({
                                  ...currentDraft,
                                  clientChampionLastName: event.target.value
                                }))
                              }
                              placeholder="Last name"
                              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            />
                          </div>
                          <input
                            value={projectDraft.clientChampionEmail}
                            onChange={(event) =>
                              setProjectDraft((currentDraft) => ({
                                ...currentDraft,
                                clientChampionEmail: event.target.value
                              }))
                            }
                            placeholder="Email"
                            className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                          />
                          {renderActions("clientChampion")}
                        </>
                      ) : (
                        <>
                          <p className="mt-2 text-sm text-white">
                            {[
                              project.clientChampionFirstName,
                              project.clientChampionLastName
                            ]
                              .filter(Boolean)
                              .join(" ") || "Not set"}
                          </p>
                          <p className="mt-1 text-sm text-text-secondary">
                            {project.clientChampionEmail ?? "No email recorded"}
                          </p>
                        </>
                      )}
                    </div>
                    {editingField !== "clientChampion" ? (
                      <EditButton
                        label="Edit client champion"
                        onClick={() => startEditing("clientChampion")}
                      />
                    ) : null}
                  </div>
                  {renderError("clientChampion")}
                </div>

                <div className="group mt-5 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        Hubs In Scope
                      </p>
                      {editingField === "hubs" ? (
                        <>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {hubOptions.map((hub) => {
                              const selected = projectDraft.hubs.includes(
                                hub.value
                              );

                              return (
                                <button
                                  key={hub.value}
                                  type="button"
                                  onClick={() => toggleHubSelection(hub.value)}
                                  className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                                    selected
                                      ? "border-[rgba(240,130,74,0.55)] bg-[rgba(240,130,74,0.18)] text-white"
                                      : "border-[rgba(255,255,255,0.08)] text-text-secondary hover:text-white"
                                  }`}
                                >
                                  {hub.label}
                                </button>
                              );
                            })}
                          </div>
                          {renderActions("hubs")}
                        </>
                      ) : (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {project.selectedHubs.map((hub) => (
                            <span
                              key={hub}
                              className="rounded bg-[rgba(255,255,255,0.06)] px-2 py-1 text-xs font-medium text-white"
                            >
                              {formatHubLabel(hub)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {editingField !== "hubs" ? (
                      <EditButton
                        label="Edit hubs in scope"
                        onClick={() => startEditing("hubs")}
                      />
                    ) : null}
                  </div>
                  {renderError("hubs")}
                </div>

                <div className="group mt-5 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        Platform Packaging
                      </p>
                      {editingField === "platformPackaging" ? (
                        <>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background px-3 py-3">
                              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                                Delivery approach
                              </p>
                              <div className="mt-3 grid gap-2">
                                {implementationApproachOptions.map((option) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() =>
                                      setProjectDraft((currentDraft) => ({
                                        ...currentDraft,
                                        implementationApproach: option.value
                                      }))
                                    }
                                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                                      projectDraft.implementationApproach ===
                                      option.value
                                        ? "border-[rgba(240,130,74,0.55)] bg-[rgba(240,130,74,0.14)] text-white"
                                        : "border-[rgba(255,255,255,0.08)] text-text-secondary hover:text-white"
                                    }`}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                              <p className="mt-2 text-xs text-text-secondary">
                                Choose whether the plan should favor a lean
                                workaround-led Phase 1 or a cleaner long-term
                                architecture.
                              </p>
                            </div>

                            <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background px-3 py-3">
                              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                                Customer platform
                              </p>
                              <select
                                value={projectDraft.customerPlatformTier}
                                onChange={(event) =>
                                  setProjectDraft((currentDraft) => ({
                                    ...currentDraft,
                                    customerPlatformTier: event.target.value
                                  }))
                                }
                                className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                              >
                                {customerPlatformTierOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <p className="mt-2 text-xs text-text-secondary">
                                Set the overall customer platform level first, then
                                tune the individual Hub products below.
                              </p>
                            </div>
                            <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background px-3 py-3 md:col-span-2">
                              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                                Hubs in scope
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {projectDraft.hubs.map((hub) => (
                                  <span
                                    key={hub}
                                    className="rounded bg-[rgba(73,205,225,0.12)] px-2 py-1 text-xs font-medium text-[#49cde1]"
                                  >
                                    {formatHubLabel(hub)}
                                  </span>
                                ))}
                              </div>
                              <p className="mt-2 text-xs text-text-secondary">
                                Edit the hub list above, then set the matching HubSpot
                                product tiers here.
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {visiblePlatformProducts.map((productKey) => (
                              <div
                                key={productKey}
                                className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background px-3 py-3"
                              >
                                <p className="text-sm font-medium text-white">
                                  {formatPlatformProductLabel(productKey)}
                                </p>
                                <select
                                  value={
                                    projectDraft.platformTierSelections?.[
                                      productKey
                                    ] ?? ""
                                  }
                                  onChange={(event) =>
                                    updatePlatformTierSelection(
                                      productKey,
                                      event.target.value
                                    )
                                  }
                                  className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                                >
                                  {hubTierOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                          {renderActions("platformPackaging")}
                        </>
                      ) : (
                        <>
                          <p className="mt-2 text-sm text-white">
                            {project.implementationApproach === "best_practice"
                              ? "Best-practice / scalable approach"
                              : "Pragmatic / POC approach"}
                          </p>
                          <p className="mt-2 text-sm text-white">
                            {project.customerPlatformTier
                              ? `${formatTierLabel(project.customerPlatformTier)} customer platform`
                              : "No customer platform tier recorded yet."}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {project.platformTierSelections &&
                            Object.entries(project.platformTierSelections).filter(
                              ([, tier]) => Boolean(tier)
                            ).length > 0 ? (
                              Object.entries(project.platformTierSelections)
                                .filter(([, tier]) => Boolean(tier))
                                .map(([key, tier]) => (
                                  <span
                                    key={key}
                                    className="rounded bg-[rgba(73,205,225,0.12)] px-2 py-1 text-xs font-medium text-[#49cde1]"
                                  >
                                    {formatPlatformProductLabel(key)}:{" "}
                                    {formatTierLabel(tier)}
                                  </span>
                                ))
                            ) : (
                              <span className="text-sm text-text-secondary">
                                No product tiers selected yet.
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    {editingField !== "platformPackaging" ? (
                      <EditButton
                        label="Edit platform packaging"
                        onClick={() => startEditing("platformPackaging")}
                      />
                    ) : null}
                  </div>
                  {renderError("platformPackaging")}
                </div>

                {isStandaloneQuote ? (
                  <div className="group mt-5 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Job Brief
                        </p>
                        {editingField === "brief" ? (
                          <>
                            <textarea
                              value={projectDraft.commercialBrief}
                              onChange={(event) =>
                                setProjectDraft((currentDraft) => ({
                                  ...currentDraft,
                                  commercialBrief: event.target.value
                                }))
                              }
                              placeholder="Describe the scoped technical work, requirements, complexity, and any supporting context."
                              className="mt-3 min-h-[160px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none transition focus:border-[rgba(240,130,74,0.55)]"
                            />
                            {renderActions("brief")}
                          </>
                        ) : (
                          <>
                            <p className="mt-2 text-sm text-text-secondary">
                              Raw source brief retained for reference. Use the
                              scoped summary and recommendation as the working
                              interpretation.
                            </p>
                            <p className="mt-3 whitespace-pre-wrap text-sm text-white">
                              {showFullBrief
                                ? project.commercialBrief ||
                                  "No scoped brief captured yet."
                                : getPreviewText(project.commercialBrief, 700) ||
                                  "No scoped brief captured yet."}
                            </p>
                            {project.commercialBrief &&
                            project.commercialBrief.trim().length > 700 ? (
                              <button
                                type="button"
                                onClick={() => setShowFullBrief((current) => !current)}
                                className="mt-3 text-sm font-medium text-[#49cde1]"
                              >
                                {showFullBrief ? "Collapse full brief" : "Show full brief"}
                              </button>
                            ) : null}
                          </>
                        )}
                      </div>
                      {editingField !== "brief" ? (
                        <EditButton
                          label="Edit job brief"
                          onClick={() => startEditing("brief")}
                        />
                      ) : null}
                    </div>
                    {renderError("brief")}
                  </div>
                ) : null}

                {isStandaloneQuote ? (
                  <div className="mt-5 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Supporting Context
                        </p>
                        <p className="mt-2 text-sm text-text-secondary">
                          Add Google Meet notes, PDF references, screenshots,
                          website links, and technical notes that should inform
                          the scoped summary and quote.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setShowSupportingContext((current) => !current)
                        }
                        className="rounded-xl border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm font-medium text-white"
                      >
                        {showSupportingContext ? "Hide source material" : "Show source material"}
                      </button>
                    </div>

                    {showSupportingContext ? (
                      <>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="text-sm font-medium text-white">
                          Context type
                        </span>
                        <select
                          value={contextDraft.evidenceType}
                          onChange={(event) =>
                            setContextDraft((currentDraft) => ({
                              ...currentDraft,
                              evidenceType:
                                event.target.value as EvidenceItem["evidenceType"]
                            }))
                          }
                          className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
                        >
                          <option value="uploaded-doc">Document / PDF</option>
                          <option value="website-link">Website link</option>
                          <option value="screen-grab">Screen grab reference</option>
                          <option value="transcript">Meeting transcript</option>
                          <option value="summary">Meeting summary</option>
                          <option value="operator-note">Operator note</option>
                          <option value="miro-note">Miro note</option>
                        </select>
                      </label>

                      <label className="block">
                        <span className="text-sm font-medium text-white">
                          Label
                        </span>
                        <input
                          value={contextDraft.sourceLabel}
                          onChange={(event) =>
                            setContextDraft((currentDraft) => ({
                              ...currentDraft,
                              sourceLabel: event.target.value
                            }))
                          }
                          placeholder="Example: Google Meet summary 18 Mar"
                          className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
                        />
                      </label>

                      <label className="block md:col-span-2">
                        <span className="text-sm font-medium text-white">
                          Link or file reference
                        </span>
                        <input
                          value={contextDraft.sourceUrl}
                          onChange={(event) =>
                            setContextDraft((currentDraft) => ({
                              ...currentDraft,
                              sourceUrl: event.target.value
                            }))
                          }
                          placeholder="Paste a URL, Google Doc link, Drive file link, or file reference"
                          className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
                        />
                      </label>

                      <label className="block md:col-span-2">
                        <span className="text-sm font-medium text-white">
                          Notes or extracted content
                        </span>
                        <textarea
                          value={contextDraft.content}
                          onChange={(event) =>
                            setContextDraft((currentDraft) => ({
                              ...currentDraft,
                              content: event.target.value
                            }))
                          }
                          placeholder="Paste notes, transcript excerpts, PDF takeaways, technical requirements, or implementation constraints here."
                          className="mt-3 min-h-[140px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
                        />
                      </label>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-4">
                      {contextError ? (
                        <p className="text-sm text-[#ff8f9c]">{contextError}</p>
                      ) : (
                        <p className="text-sm text-text-secondary">
                          Tip: use the link field for websites, Google Docs, Drive
                          files, or screenshot references, and the notes field for
                          pasted content.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => void addSupportingContext()}
                        disabled={savingContext}
                        className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                      >
                        {savingContext ? "Adding..." : "Add Context"}
                      </button>
                    </div>

                    <div className="mt-5 space-y-3">
                      {supportingContext.length > 0 ? (
                        supportingContext.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-background-card px-4 py-4"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-white">
                                  {item.sourceLabel}
                                </p>
                                <p className="mt-1 text-xs text-text-secondary">
                                  {formatEvidenceTypeLabel(item.evidenceType)} ·{" "}
                                  {new Intl.DateTimeFormat("en-ZA", {
                                    dateStyle: "medium",
                                    timeStyle: "short"
                                  }).format(new Date(item.createdAt))}
                                </p>
                                {item.sourceUrl ? (
                                  <p className="mt-3 break-all text-sm text-[#49cde1]">
                                    {item.sourceUrl}
                                  </p>
                                ) : null}
                                {item.content ? (
                                  <p className="mt-3 whitespace-pre-wrap text-sm text-text-secondary">
                                    {item.content}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-[rgba(255,255,255,0.1)] bg-background-card px-4 py-4 text-sm text-text-secondary">
                          No supporting context added yet. Add links, notes, or
                          references so the summary and quote can work from better
                          source material.
                        </div>
                      )}
                    </div>
                      </>
                    ) : (
                      <div className="mt-5 rounded-xl border border-dashed border-[rgba(255,255,255,0.1)] bg-background-card px-4 py-4 text-sm text-text-secondary">
                        {supportingContext.length > 0
                          ? `${supportingContext.length} source item${supportingContext.length === 1 ? "" : "s"} attached. Expand this section to review links, notes, transcripts, and documents.`
                          : "No source material added yet. Expand this section to add links, notes, transcripts, or documents."}
                      </div>
                    )}
                  </div>
                ) : null}
              </section>

              <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Project Email Composer
                    </h2>
                    <p className="mt-2 text-sm text-text-secondary">
                      Plain-text project emails with dictation, AI cleanup, and
                      AI drafting. Use this as a copy-first drafting space, then
                      paste into your own email tool when that suits your
                      workflow better.
                    </p>
                  </div>
                  <div className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs text-text-secondary">
                    {emailSettings?.enabled && emailSettings.fromEmail
                      ? `Sending from ${emailSettings.fromEmail}`
                      : "Outbound email not connected yet"}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="block">
                    <span className="text-sm font-medium text-white">
                      Email intent
                    </span>
                    <select
                      value={emailIntent}
                      onChange={(event) => setEmailIntent(event.target.value)}
                      className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                    >
                      <option value="next_steps">Next steps</option>
                      <option value="questionnaire_invite">
                        Project inputs invite
                      </option>
                      <option value="quote_ready">Quote ready for review</option>
                      <option value="approval_follow_up">
                        Approval follow-up
                      </option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-white">
                      AI provider
                    </span>
                    <select
                      value={emailProviderKey}
                      onChange={(event) => {
                        const nextProviderKey = event.target.value;
                        setEmailProviderKey(nextProviderKey);
                        const nextProvider = aiProviders.find(
                          (provider) => provider.providerKey === nextProviderKey
                        );
                        setEmailModelOverride(nextProvider?.defaultModel ?? "");
                      }}
                      className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                    >
                      {aiProviders.length > 0 ? (
                        aiProviders.map((provider) => (
                          <option
                            key={provider.providerKey}
                            value={provider.providerKey}
                          >
                            {provider.label}
                          </option>
                        ))
                      ) : (
                        <option value="">No enabled AI providers</option>
                      )}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-white">
                      Model
                    </span>
                    <input
                      value={emailModelOverride}
                      onChange={(event) =>
                        setEmailModelOverride(event.target.value)
                      }
                      placeholder="Use provider default model"
                      className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-white">
                      Extra instruction
                    </span>
                    <textarea
                      value={emailInstructions}
                      onChange={(event) =>
                        setEmailInstructions(event.target.value)
                      }
                      placeholder="Example: mention that Magnusol should nominate one operations lead and one sales owner for discovery."
                      className="mt-3 min-h-[88px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                    />
                  </label>
                </div>

                {(savedClientContacts.length > 0 || clientUsers.length > 0) ? (
                  <div className="mt-5 rounded-2xl bg-[#0b1126] p-4">
                    <p className="text-sm font-medium text-white">
                      Quick recipients
                    </p>
                    <p className="mt-2 text-sm text-text-secondary">
                      Pull people into the email without typing addresses again.
                    </p>

                    {savedClientContacts.length > 0 ? (
                      <div className="mt-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-text-muted">
                          Saved client contacts
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3">
                          {savedClientContacts.map((contact) => {
                            const contactLabel = [
                              contact.firstName,
                              contact.lastName
                            ]
                              .filter(Boolean)
                              .join(" ");

                            return (
                              <div
                                key={`email-contact-${contact.id}`}
                                className="rounded-xl border border-[rgba(255,255,255,0.08)] px-3 py-3"
                              >
                                <p className="text-sm font-medium text-white">
                                  {contactLabel || contact.email}
                                </p>
                                <p className="mt-1 text-xs text-text-secondary">
                                  {contact.email}
                                  {contact.canApproveQuotes
                                    ? " · Quote approver"
                                    : ""}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      addRecipient("to", contact.email, contactLabel)
                                    }
                                    className="rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs font-medium text-white"
                                  >
                                    Add to To
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      addRecipient("cc", contact.email, contactLabel)
                                    }
                                    className="rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs font-medium text-white"
                                  >
                                    Add to Cc
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {clientUsers.length > 0 ? (
                      <div className="mt-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-text-muted">
                          Portal users
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3">
                          {clientUsers.map((clientUser) => {
                            const contactLabel = [
                              clientUser.firstName,
                              clientUser.lastName
                            ]
                              .filter(Boolean)
                              .join(" ");

                            return (
                              <div
                                key={`email-client-user-${clientUser.id}`}
                                className="rounded-xl border border-[rgba(255,255,255,0.08)] px-3 py-3"
                              >
                                <p className="text-sm font-medium text-white">
                                  {contactLabel || clientUser.email}
                                </p>
                                <p className="mt-1 text-xs text-text-secondary">
                                  {clientUser.email} · {clientUser.role}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      addRecipient("to", clientUser.email, contactLabel)
                                    }
                                    className="rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs font-medium text-white"
                                  >
                                    Add to To
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      addRecipient("cc", clientUser.email, contactLabel)
                                    }
                                    className="rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs font-medium text-white"
                                  >
                                    Add to Cc
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-white">To</span>
                    <input
                      value={emailTo}
                      onChange={(event) => setEmailTo(event.target.value)}
                      placeholder="Comma-separated recipients"
                      className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-white">Cc</span>
                    <input
                      value={emailCc}
                      onChange={(event) => setEmailCc(event.target.value)}
                      placeholder="Optional comma-separated recipients"
                      className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                    />
                  </label>
                </div>

                <label className="mt-5 block">
                  <span className="text-sm font-medium text-white">Subject</span>
                  <input
                    value={emailSubject}
                    onChange={(event) => setEmailSubject(event.target.value)}
                    className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                  />
                </label>

                <label className="mt-5 block">
                  <span className="text-sm font-medium text-white">
                    Plain-text body
                  </span>
                  <textarea
                    value={emailBody}
                    onChange={(event) => setEmailBody(event.target.value)}
                    placeholder="Write freely here like a project note. Keep it plain text. Use dictation, then clean it up with AI if needed."
                    className="mt-3 min-h-[320px] w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#09111f] px-4 py-4 font-mono text-sm leading-6 text-white outline-none"
                  />
                </label>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    {emailError ? (
                      <p className="text-sm text-[#ff8f9c]">{emailError}</p>
                    ) : emailFeedback ? (
                      <p className="text-sm text-status-success">
                        {emailFeedback}
                      </p>
                    ) : (
                      <p className="text-sm text-text-secondary">
                        This editor stays plain text on purpose, closer to a
                        fast note tool than a formatted email builder.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={toggleVoiceDictation}
                      className="rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-3 text-sm font-medium text-white"
                    >
                      {dictationActive ? "Stop dictation" : "Voice dictation"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void generateEmailDraft("cleanup")}
                      disabled={emailBusy || !emailBody.trim()}
                      className="rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                    >
                      {emailBusy ? "Working..." : "Clean up with AI"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void generateEmailDraft("generate")}
                      disabled={emailBusy || aiProviders.length === 0}
                      className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                    >
                      {emailBusy ? "Drafting..." : "AI generate email"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyEmailDraft()}
                      disabled={!emailSubject.trim() && !emailBody.trim()}
                      className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Copy email
                    </button>
                    <button
                      type="button"
                      onClick={() => void sendProjectEmail()}
                      disabled={
                        emailSending ||
                        !emailSettings?.enabled ||
                        !emailTo.trim() ||
                        !emailSubject.trim() ||
                        !emailBody.trim()
                      }
                      className="rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                    >
                      {emailSending ? "Sending..." : "Send email"}
                    </button>
                  </div>
                </div>
              </section>

              <div className="grid gap-6">
                {isStandaloneQuote ? (
                  <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-white">
                          Solution Snapshot
                        </h2>
                        <p className="mt-2 text-sm text-text-secondary">
                          The most important recommendation, packaging position,
                          and next-step view for this scoped job.
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4">
                      <div className="rounded-xl bg-[#0b1126] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Executive summary
                        </p>
                        <p className="mt-2 text-sm text-white">
                          {discoverySummary?.executiveSummary ||
                            project.scopeExecutiveSummary ||
                            "Refresh the job summary to generate the recommended path."}
                        </p>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl bg-[#0b1126] px-4 py-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            Best starting path
                          </p>
                          <p className="mt-2 text-sm text-white">
                            {discoverySummary?.recommendedApproach ||
                              project.solutionRecommendation ||
                              "No recommendation generated yet."}
                          </p>
                        </div>
                        <div className="rounded-xl bg-[#0b1126] px-4 py-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            Why this makes sense
                          </p>
                          <p className="mt-2 text-sm text-text-secondary">
                            {discoverySummary?.whyThisApproach ||
                              "The system should explain why this path is sensible and where pragmatic shortcuts are acceptable."}
                          </p>
                        </div>
                      </div>

                      {discoverySummary?.mainPainPoints.length ? (
                        <div className="rounded-xl bg-[#0b1126] px-4 py-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            Main pain points
                          </p>
                          <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                            {discoverySummary.mainPainPoints.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl bg-[#0b1126] px-4 py-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            In scope now
                          </p>
                          <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                            {(discoverySummary?.inScopeItems?.length
                              ? discoverySummary.inScopeItems
                              : ["The recommended Phase 1 / POC items will appear here after the summary is refreshed."]).map(
                              (item) => (
                                <li key={item}>{item}</li>
                              )
                            )}
                          </ul>
                        </div>
                        <div className="rounded-xl bg-[#0b1126] px-4 py-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            Out of scope for now
                          </p>
                          <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                            {(discoverySummary?.outOfScopeItems?.length
                              ? discoverySummary.outOfScopeItems
                              : ["Future-state expansion, broader transformation, or optional extras will appear here once the summary is refreshed."]).map(
                              (item) => (
                                <li key={item}>{item}</li>
                              )
                            )}
                          </ul>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-xl bg-[#0b1126] px-4 py-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            Supporting tools
                          </p>
                          <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                            {scopedSupportingTools.slice(
                              0,
                              3
                            ).map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-xl bg-[#0b1126] px-4 py-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            Key risks
                          </p>
                          <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                            {scopedKeyRisks.slice(
                              0,
                              3
                            ).map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-xl bg-[#0b1126] px-4 py-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            Next questions
                          </p>
                          <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                            {scopedNextQuestions.slice(
                              0,
                              3
                            ).map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </section>
                ) : null}

                <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        Client Portal Access
                      </h2>
                      <p className="mt-2 text-sm text-text-secondary">
                        Create client logins for project inputs, document
                        review, and later approvals.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {savedClientContacts.length > 0 ? (
                      <div className="md:col-span-2 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                        <p className="text-sm font-medium text-white">
                          Saved client contacts
                        </p>
                        <p className="mt-2 text-sm text-text-secondary">
                          Pull approvers and stakeholders in from the client
                          workspace instead of typing them again.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          {savedClientContacts.map((contact) => (
                            <div
                              key={contact.id}
                              className="rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-3 text-left text-sm text-white"
                            >
                              <span className="block font-medium">
                                {[contact.firstName, contact.lastName]
                                  .filter(Boolean)
                                  .join(" ")}
                              </span>
                              <span className="mt-1 block text-xs text-text-secondary">
                                {contact.email}
                                {contact.canApproveQuotes ? " · Quote approver" : ""}
                              </span>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => useSavedClientContact(contact)}
                                  className="rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs font-medium text-white"
                                >
                                  Load into form
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg border border-[rgba(81,208,176,0.18)] bg-[rgba(81,208,176,0.12)] px-3 py-2 text-xs font-medium text-[#51d0b0]"
                                  onClick={() => void inviteSavedClientContact(contact)}
                                  disabled={clientAccessSaving}
                                >
                                  Invite now
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <label className="block">
                      <span className="text-sm font-medium text-white">
                        First name
                      </span>
                      <input
                        value={clientAccessDraft.firstName}
                        onChange={(event) =>
                          setClientAccessDraft((currentDraft) => ({
                            ...currentDraft,
                            firstName: event.target.value
                          }))
                        }
                        className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-white">
                        Last name
                      </span>
                      <input
                        value={clientAccessDraft.lastName}
                        onChange={(event) =>
                          setClientAccessDraft((currentDraft) => ({
                            ...currentDraft,
                            lastName: event.target.value
                          }))
                        }
                        className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-white">
                        Email
                      </span>
                      <input
                        value={clientAccessDraft.email}
                        onChange={(event) =>
                          setClientAccessDraft((currentDraft) => ({
                            ...currentDraft,
                            email: event.target.value
                          }))
                        }
                        className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                      />
                    </label>
                    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] px-4 py-4">
                      <p className="text-sm font-medium text-white">
                        Access setup
                      </p>
                      <p className="mt-2 text-sm leading-6 text-text-secondary">
                        Muloo will create an invite link so the client can set
                        their own password securely.
                      </p>
                      <label className="mt-4 flex items-center gap-3 text-sm text-white">
                        <input
                          type="checkbox"
                          checked={clientAccessDraft.questionnaireAccess}
                          onChange={(event) =>
                            setClientAccessDraft((currentDraft) => ({
                              ...currentDraft,
                              questionnaireAccess: event.target.checked
                            }))
                          }
                        />
                        This client contact receives the active project inputs
                      </label>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-4">
                    <p className="text-sm text-text-secondary">
                      Client portal login route: `/client/login`
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void pushQuoteToClientPortal()}
                        disabled={
                          clientUsers.length === 0 ||
                          clientPortalPushBusy ||
                          project.quoteApprovalStatus === "approved"
                        }
                        className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                      >
                        {clientPortalPushBusy
                          ? "Pushing..."
                          : project.quoteApprovalStatus === "approved"
                            ? "Quote approved"
                            : "Push to client portal"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyClientQuoteLink()}
                        disabled={clientUsers.length === 0}
                        className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                      >
                        Copy client quote link
                      </button>
                      <button
                        type="button"
                        onClick={() => void addClientPortalUser()}
                        disabled={clientAccessSaving}
                        className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                      >
                        {clientAccessSaving ? "Creating..." : "Add Client User"}
                      </button>
                    </div>
                  </div>

                  {clientAccessFeedback ? (
                    <p className="mt-4 text-sm text-status-success">
                      {clientAccessFeedback}
                    </p>
                  ) : null}

                  <div className="mt-5 space-y-3">
                    {clientUsers.length > 0 ? (
                      clientUsers.map((clientUser) => (
                        <div
                          key={clientUser.id}
                          className="rounded-xl bg-[#0b1126] px-4 py-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-white">
                                {clientUser.firstName} {clientUser.lastName}
                              </p>
                              <p className="mt-1 text-xs text-text-secondary">
                                {clientUser.email} · {clientUser.role} ·{" "}
                                {clientUser.authStatus === "active"
                                  ? "Access active"
                                  : "Invite pending"}
                              </p>
                              <p className="mt-2 text-xs text-text-secondary">
                                Project inputs:{" "}
                                {clientUser.questionnaireAccess === false
                                  ? "Visibility only"
                                  : "Assigned"}
                                {clientUser.canApproveQuotes
                                  ? " · Quote approver"
                                  : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={clientAccessUpdatingId === clientUser.id}
                                onClick={() =>
                                  void updateClientPortalUser(clientUser.id, {
                                    role: clientUser.role === "approver"
                                      ? "contributor"
                                      : "approver"
                                  })
                                }
                                className="rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                              >
                                {clientUser.role === "approver"
                                  ? "Make contributor"
                                  : "Make approver"}
                              </button>
                              <label className="flex items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs font-medium text-white">
                                <input
                                  type="checkbox"
                                  checked={clientUser.questionnaireAccess !== false}
                                  disabled={clientAccessUpdatingId === clientUser.id}
                                  onChange={(event) =>
                                    void updateClientPortalUser(clientUser.id, {
                                      questionnaireAccess: event.target.checked
                                    })
                                  }
                                />
                                Project inputs
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  void copyClientAccessLink(
                                    clientUser.id,
                                    "invite-link"
                                  )
                                }
                                className="rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs font-medium text-white"
                              >
                                Copy invite link
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void copyClientAccessLink(
                                    clientUser.id,
                                    "reset-link"
                                  )
                                }
                                className="rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs font-medium text-white"
                              >
                                Copy reset link
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-[rgba(255,255,255,0.1)] bg-[#0b1126] px-4 py-4 text-sm text-text-secondary">
                        No client users added yet for this project.
                      </div>
                    )}
                  </div>
                </section>

                {!isStandaloneQuote ? (
                  <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-white">
                          Project Inputs
                        </h2>
                        <p className="mt-2 text-sm text-text-secondary">
                          Build the client input pack and assign sections to the
                          right portal users in the dedicated builder.
                        </p>
                      </div>
                      <Link
                        href={`/projects/${project.id}/inputs`}
                        className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm font-medium text-white"
                      >
                        Open builder
                      </Link>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl bg-[#0b1126] p-5">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Why use the builder
                        </p>
                        <p className="mt-3 text-sm text-text-secondary">
                          Choose which sections are active, add ad hoc questions,
                          and stop generic defaults leaking into the client
                          experience.
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[#0b1126] p-5">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Per-contact assignment
                        </p>
                        <p className="mt-3 text-sm text-text-secondary">
                          Assign specific sections to specific client users so
                          operations, leadership, and stakeholders only see the
                          inputs relevant to them.
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[#0b1126] p-5">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Client experience
                        </p>
                        <p className="mt-3 text-sm text-text-secondary">
                          Clients now autosave as they work and only see the
                          sections they have been assigned, making it much
                          easier to resume later.
                        </p>
                      </div>
                    </div>
                  </section>
                ) : null}

                {!isStandaloneQuote ? (
                  <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                    <div className="flex items-center justify-between gap-4">
                      <h2 className="text-lg font-semibold text-white">
                        Discovery Progress
                      </h2>
                      <Link
                        href={`/projects/${project.id}/discovery`}
                        className="text-sm font-medium text-white"
                      >
                        Review
                      </Link>
                    </div>

                    <div className="mt-5 space-y-3">
                      {sessions.map((session) => (
                        <div
                          key={session.session}
                          className="rounded-xl bg-[#0b1126] px-4 py-4"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm font-medium text-white">
                                Session {session.session} - {session.title}
                              </p>
                              <p className="mt-1 text-xs text-text-secondary">
                                {
                                  Object.values(session.fields).filter(
                                    (value) => value.trim().length > 0
                                  ).length
                                }
                                /
                                {Object.keys(session.fields).length} fields completed
                              </p>
                            </div>
                            <span
                              className={`rounded px-2 py-1 text-xs font-medium ${statusClass(
                                isSessionComplete(session)
                                  ? "complete"
                                  : session.status
                              )}`}
                            >
                              {formatLabel(
                                isSessionComplete(session)
                                  ? "complete"
                                  : session.status
                              )}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        Blueprint gate
                      </p>
                      <p className="mt-2 text-sm text-white">
                        {canGenerateBlueprint
                          ? "Session 1 and Session 3 are complete. Blueprint generation is unlocked."
                          : "Finish Session 1 and Session 3 to unlock blueprint generation."}
                      </p>
                    </div>
                  </section>
                ) : (
                  <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-white">
                          Scoped Job Summary
                        </h2>
                        <p className="mt-2 text-sm text-text-secondary">
                          Standalone jobs skip the four-session discovery flow and
                          rely on the captured brief, supporting documentation,
                          and commercial shaping.
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 space-y-4">
                      <details
                        className="rounded-xl bg-[#0b1126] px-4 py-4"
                        open
                      >
                        <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.2em] text-text-muted">
                          Delivery recommendation
                        </summary>
                        <p className="mt-3 text-sm text-white">
                          {discoverySummary?.recommendedApproach ||
                            project.scopeExecutiveSummary ||
                            project.solutionRecommendation ||
                            "Refresh the job summary to generate a clearer recommendation."}
                        </p>
                        <p className="mt-3 text-sm text-text-secondary">
                          {discoverySummary?.whyThisApproach ||
                            "The system will summarize the best path forward, explain why it makes sense, and keep the recommendation boxed to the scoped outcome."}
                        </p>
                        <div className="mt-4 rounded-xl border border-[rgba(255,255,255,0.07)] bg-background px-4 py-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            Phase 1 focus
                          </p>
                          <p className="mt-2 text-sm text-white">
                            {discoverySummary?.phaseOneFocus ||
                              "Use the initial phase to solve the core pain point in a pragmatic way before loading extra packaging or architecture."}
                          </p>
                          {discoverySummary?.futureUpgradePath ? (
                            <p className="mt-3 text-sm text-text-secondary">
                              Later path: {discoverySummary.futureUpgradePath}
                            </p>
                          ) : null}
                        </div>
                      </details>

                      <details className="rounded-xl bg-[#0b1126] px-4 py-4">
                        <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.2em] text-text-muted">
                          Scope and delivery boundaries
                        </summary>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-background px-4 py-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                              In scope now
                            </p>
                            <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                              {(discoverySummary?.inScopeItems?.length
                                ? discoverySummary.inScopeItems
                                : ["The summary should define the boxed scope for this phase here."]).map(
                                (item) => (
                                  <li key={item}>{item}</li>
                                )
                              )}
                            </ul>
                          </div>
                          <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-background px-4 py-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                              Out of scope for now
                            </p>
                            <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                              {(discoverySummary?.outOfScopeItems?.length
                                ? discoverySummary.outOfScopeItems
                                : ["The summary should call out what stays outside this phase so the work remains controlled."]).map(
                                (item) => (
                                  <li key={item}>{item}</li>
                                )
                              )}
                            </ul>
                          </div>
                        </div>
                        {discoverySummary?.futureUpgradePath ? (
                          <div className="mt-4 rounded-xl border border-[rgba(255,255,255,0.07)] bg-background px-4 py-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                              Not in Phase 1 yet
                            </p>
                            <p className="mt-2 text-sm text-text-secondary">
                              {discoverySummary.futureUpgradePath}
                            </p>
                          </div>
                        ) : null}
                      </details>

                      <details className="rounded-xl bg-[#0b1126] px-4 py-4">
                        <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.2em] text-text-muted">
                          Tools, risks, and open questions
                        </summary>
                        <div className="mt-4 space-y-4">
                          <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-background px-4 py-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                              Supporting tools
                            </p>
                            {scopedSupportingTools.length ? (
                              <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                                {scopedSupportingTools.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-2 text-sm text-text-secondary">
                                No supporting tools recommended yet. Refresh the job
                                summary to generate architecture-aware tool
                                suggestions around HubSpot.
                              </p>
                            )}
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-background px-4 py-4">
                              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                                Key risks
                              </p>
                              <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                                {scopedKeyRisks.map(
                                  (item) => (
                                    <li key={item}>{item}</li>
                                  )
                                )}
                              </ul>
                            </div>
                            <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-background px-4 py-4">
                              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                                Recommended next questions
                              </p>
                              <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                                {scopedNextQuestions.map(
                                  (item) => (
                                    <li key={item}>{item}</li>
                                  )
                                )}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </details>

                      <details className="rounded-xl bg-[#0b1126] px-4 py-4">
                        <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.2em] text-text-muted">
                          Problem and packaging context
                        </summary>
                        <div className="mt-4 rounded-xl border border-[rgba(255,255,255,0.07)] bg-background px-4 py-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            Main pain points
                          </p>
                          {discoverySummary?.mainPainPoints.length ? (
                            <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                              {discoverySummary.mainPainPoints.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-2 text-sm text-text-secondary">
                              {getPreviewText(
                                project.problemStatement ||
                                  project.commercialBrief ||
                                  "No pain-point summary captured yet.",
                                220
                              )}
                            </p>
                          )}
                        </div>
                        <div className="mt-4 rounded-xl bg-background px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Platform packaging
                        </p>
                        <p className="mt-2 text-sm text-white">
                          {project.customerPlatformTier
                            ? `${project.customerPlatformTier.charAt(0).toUpperCase()}${project.customerPlatformTier.slice(1)} customer platform`
                            : "No customer platform tier recorded yet."}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {project.platformTierSelections &&
                          Object.entries(project.platformTierSelections).length > 0 ? (
                            Object.entries(project.platformTierSelections).map(([key, tier]) => (
                              <span
                                key={key}
                                className="rounded bg-[rgba(73,205,225,0.12)] px-2 py-1 text-xs font-medium text-[#49cde1]"
                              >
                                {key.replace(/_/g, " ")}: {tier}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-text-secondary">
                              No product tiers selected yet.
                            </span>
                          )}
                        </div>
                        {project.packagingAssessment ? (
                          <div className="mt-4 rounded-xl border border-[rgba(255,255,255,0.07)] bg-background px-3 py-3">
                            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                              Packaging decision
                            </p>
                            <p
                              className={`mt-2 text-sm font-medium ${
                                getPackagingOutcome(project.packagingAssessment.fit)
                                  .className
                              }`}
                            >
                              {
                                getPackagingOutcome(project.packagingAssessment.fit)
                                  .label
                              }
                            </p>
                            <p className="mt-2 text-sm text-text-secondary">
                              {project.packagingAssessment.summary}
                            </p>
                            {project.packagingAssessment.reasoning.length > 0 ? (
                              <div className="mt-3">
                                <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                                  Why
                                </p>
                                <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                                  {project.packagingAssessment.reasoning
                                    .slice(0, 3)
                                    .map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                            {project.packagingAssessment.warnings.length > 0 ? (
                              <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                                {project.packagingAssessment.warnings.map((warning) => (
                                  <li key={warning}>{warning}</li>
                                ))}
                              </ul>
                            ) : null}
                            {project.packagingAssessment.workaroundPath ? (
                              <div className="mt-3 rounded-xl border border-[rgba(73,205,225,0.16)] bg-[rgba(73,205,225,0.08)] px-3 py-3">
                                <p className="text-xs uppercase tracking-[0.18em] text-[#49cde1]">
                                  Pragmatic workaround path
                                </p>
                                <p className="mt-2 text-sm text-white">
                                  {project.packagingAssessment.workaroundPath}
                                </p>
                              </div>
                            ) : null}
                            <p className="mt-3 text-sm text-white">
                              {project.packagingAssessment.recommendedNextStep}
                            </p>
                          </div>
                        ) : null}
                        </div>
                      </details>
                    </div>
                  </section>
                )}

                <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        {isStandaloneQuote
                          ? "Supporting Analysis"
                          : "Agent Handoff Summary"}
                      </h2>
                      <p className="mt-2 text-sm text-text-secondary">
                        {isStandaloneQuote
                          ? "The recommendation sits above. This section holds the supporting ratings, risks, open questions, and delivery watch-outs."
                          : "Project-level discovery output for scoping, delivery planning, and future agent delegation."}
                      </p>
                    </div>
                  </div>

                  {discoverySummary ? (
                    <>
                      {!isStandaloneQuote ? (
                        <p className="mt-5 text-sm text-text-secondary">
                          {discoverySummary.executiveSummary}
                        </p>
                      ) : null}

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        {[
                          ["Engagement Track", discoverySummary.engagementTrack],
                          ["Platform Fit", discoverySummary.platformFit],
                          [
                            "Change Management",
                            discoverySummary.changeManagementRating
                          ],
                          [
                            "Data Readiness",
                            discoverySummary.dataReadinessRating
                          ],
                          [
                            "Scope Volatility",
                            discoverySummary.scopeVolatilityRating
                          ]
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                          >
                            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                              {label}
                            </p>
                            <p className="mt-2 text-sm text-white">{value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5 space-y-4">
                        <details
                          className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5"
                          open
                        >
                          <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.2em] text-text-muted">
                            Missing Information
                          </summary>
                          <ul className="mt-4 space-y-3 text-sm text-text-secondary">
                            {discoverySummary.missingInformation.length > 0 ? (
                              discoverySummary.missingInformation.map((item) => (
                                <li key={item}>{item}</li>
                              ))
                            ) : (
                              <li>No major gaps flagged.</li>
                            )}
                          </ul>
                        </details>

                        <details className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5">
                          <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.2em] text-text-muted">
                            Key Risks
                          </summary>
                          <ul className="mt-4 space-y-3 text-sm text-text-secondary">
                            {scopedKeyRisks.length > 0 ? (
                              scopedKeyRisks.map((item) => (
                                <li key={item}>{item}</li>
                              ))
                            ) : (
                              <li>No major risks flagged.</li>
                            )}
                          </ul>
                        </details>

                        <details className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5">
                          <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.2em] text-text-muted">
                            Recommended Next Questions
                          </summary>
                          <ul className="mt-4 space-y-3 text-sm text-text-secondary">
                            {scopedNextQuestions.length > 0 ? (
                              scopedNextQuestions.map(
                                (item) => <li key={item}>{item}</li>
                              )
                            ) : (
                              <li>No follow-up questions suggested yet.</li>
                            )}
                          </ul>
                        </details>
                      </div>
                    </>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5">
                      <p className="text-sm text-text-secondary">
                        No saved handoff summary yet. Generate the agent summary
                        once there is enough discovery captured to produce a
                        useful project-level view.
                      </p>
                    </div>
                  )}
                </section>
              </div>
            </div>

          </>
        )}
      </div>
    </AppShell>
  );
}
