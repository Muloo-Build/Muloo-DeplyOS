"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AppShell from "./AppShell";

interface ClientContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  canApproveQuotes: boolean;
  portalAssignments: Array<{
    projectId: string;
    projectName: string;
    role: string;
    questionnaireAccess: boolean;
    authStatus: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface ClientProjectSummary {
  id: string;
  name: string;
  status: string;
  quoteApprovalStatus: string;
  scopeType: string;
  updatedAt: string;
}

interface HubSpotPortalOption {
  id: string;
  portalId: string;
  displayName: string;
  region?: string | null;
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

interface ClientRecord {
  id: string;
  name: string;
  slug: string;
  clientRoles: string[];
  parentClientId?: string | null;
  parentClientName?: string | null;
  hubSpotPortalId?: string | null;
  hubSpotPortal?: HubSpotPortalOption | null;
  industry?: string | null;
  region?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  enrichedLogoUrl?: string | null;
  companyOverview?: string | null;
  additionalWebsites: string[];
  linkedinUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  xUrl?: string | null;
  youtubeUrl?: string | null;
  lastEnrichedAt?: string | null;
  childClients: Array<{
    id: string;
    name: string;
  }>;
  visibleToPartners: Array<{
    id: string;
    name: string;
  }>;
  visibleClients: Array<{
    id: string;
    name: string;
  }>;
  contacts: ClientContact[];
  projects: ClientProjectSummary[];
  createdAt: string;
  updatedAt: string;
}

interface ContactDraft {
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  canApproveQuotes: boolean;
}

interface ClientProfileDraft {
  name: string;
  website: string;
  logoUrl: string;
  additionalWebsitesText: string;
  industry: string;
  region: string;
  hubSpotPortalId: string;
  linkedinUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  xUrl: string;
  youtubeUrl: string;
  clientRoles: string[];
  parentClientId: string;
  visibleToPartnerIds: string[];
}

interface PortalInviteDraft {
  projectIds: string[];
  questionnaireAccess: boolean;
  sendEmail: boolean;
}

const alphabet = ["All", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];
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
const clientRegionOptions = [
  "Global",
  "UK",
  "ZA",
  "AUS",
  "USA West",
  "Brazil",
  "Spain",
  "DACH",
  "Europe",
  "North America",
  "LATAM",
  "Other"
];
const clientRoleOptions = [
  { value: "client", label: "Client" },
  { value: "partner", label: "Partner" },
  { value: "group", label: "Group" }
] as const;
const hubSpotInstallProfileOptions = [
  { value: "core_crm", label: "Core CRM install" },
  { value: "automation", label: "Automation add-on" },
  { value: "cms_content", label: "CMS / content add-on" },
  { value: "commercial_objects", label: "Commercial objects add-on" },
  { value: "advanced_admin", label: "Advanced admin add-on" }
] as const;

function createEmptyContactDraft(): ContactDraft {
  return {
    firstName: "",
    lastName: "",
    email: "",
    title: "",
    canApproveQuotes: false
  };
}

function createClientProfileDraft(client: ClientRecord): ClientProfileDraft {
  return {
    name: client.name,
    website: client.website ?? "",
    logoUrl: client.logoUrl ?? "",
    additionalWebsitesText: (client.additionalWebsites ?? []).join("\n"),
    industry: client.industry ?? "",
    region: client.region ?? "",
    hubSpotPortalId: client.hubSpotPortal?.id ?? "",
    linkedinUrl: client.linkedinUrl ?? "",
    facebookUrl: client.facebookUrl ?? "",
    instagramUrl: client.instagramUrl ?? "",
    xUrl: client.xUrl ?? "",
    youtubeUrl: client.youtubeUrl ?? "",
    clientRoles: client.clientRoles ?? ["client"],
    parentClientId: client.parentClientId ?? "",
    visibleToPartnerIds: client.visibleToPartners.map((partner) => partner.id)
  };
}

function createPortalInviteDraft(
  client: ClientRecord,
  contact: ClientContact
): PortalInviteDraft {
  return {
    projectIds:
      contact.portalAssignments.length > 0
        ? contact.portalAssignments.map((assignment) => assignment.projectId)
        : client.projects.map((project) => project.id),
    questionnaireAccess:
      contact.portalAssignments.length > 0
        ? contact.portalAssignments.every(
            (assignment) => assignment.questionnaireAccess
          )
        : true,
    sendEmail: true
  };
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function buildProjectLink(client: ClientRecord, contact?: ClientContact) {
  const params = new URLSearchParams({
    clientName: client.name
  });

  if (client.website) {
    params.set("portalOrWebsite", client.website);
  }

  if (contact) {
    params.set(
      "contactName",
      [contact.firstName, contact.lastName].filter(Boolean).join(" ")
    );
    params.set("contactEmail", contact.email);
  }

  return `/projects/new?${params.toString()}`;
}

function normalizeWebsiteUrl(value: string | null | undefined) {
  const website = value?.trim() ?? "";

  if (!website) {
    return "";
  }

  return website.startsWith("http") ? website : `https://${website}`;
}

function getWebsiteHost(value: string | null | undefined) {
  const normalizedWebsite = normalizeWebsiteUrl(value);

  if (!normalizedWebsite) {
    return "";
  }

  try {
    return new URL(normalizedWebsite).hostname.replace(/^www\./, "");
  } catch {
    return normalizedWebsite.replace(/^https?:\/\//, "").replace(/^www\./, "");
  }
}

function deriveClientLogoUrl(client: ClientRecord) {
  const manualLogoUrl = client.logoUrl?.trim() ?? "";

  if (manualLogoUrl) {
    return manualLogoUrl;
  }

  const enrichedLogoUrl = client.enrichedLogoUrl?.trim() ?? "";

  if (enrichedLogoUrl) {
    return enrichedLogoUrl;
  }

  const websiteHost = getWebsiteHost(client.website);

  if (websiteHost) {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(websiteHost)}&sz=128`;
  }

  const matchingEmailDomain = client.contacts.find((contact) =>
    contact.email.includes("@")
  )?.email;
  const emailDomain = matchingEmailDomain?.split("@")[1]?.trim() ?? "";

  if (emailDomain) {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(emailDomain)}&sz=128`;
  }

  return null;
}

function getClientInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "CL"
  );
}

function matchesClientSearch(client: ClientRecord, query: string) {
  if (!query.trim()) {
    return true;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const haystacks = [
    client.name,
    client.website ?? "",
    client.industry ?? "",
    client.region ?? "",
    client.companyOverview ?? "",
    client.parentClientName ?? "",
    ...(client.additionalWebsites ?? []),
    ...(client.visibleClients ?? []).map((item) => item.name),
    ...(client.visibleToPartners ?? []).map((item) => item.name),
    ...client.clientRoles,
    ...client.contacts.flatMap((contact) => [
      contact.firstName,
      contact.lastName,
      contact.email,
      contact.title
    ]),
    ...client.projects.map((project) => project.name)
  ];

  return haystacks.some((value) =>
    value.toLowerCase().includes(normalizedQuery)
  );
}

function matchesAlphabet(client: ClientRecord, filter: string) {
  if (filter === "All") {
    return true;
  }

  return client.name.trim().charAt(0).toUpperCase() === filter;
}

function getClientLastActivity(client: ClientRecord) {
  const timestamps = [
    new Date(client.updatedAt).getTime(),
    ...client.contacts.map((contact) => new Date(contact.updatedAt).getTime()),
    ...client.projects.map((project) => new Date(project.updatedAt).getTime())
  ];

  return new Date(Math.max(...timestamps)).toISOString();
}

function getPrimaryContact(client: ClientRecord) {
  return (
    client.contacts.find((contact) => contact.canApproveQuotes) ??
    client.contacts[0] ??
    null
  );
}

function groupClientsByInitial(clients: ClientRecord[]) {
  return clients.reduce<Record<string, ClientRecord[]>>((groups, client) => {
    const initial = client.name.trim().charAt(0).toUpperCase() || "#";

    if (!groups[initial]) {
      groups[initial] = [];
    }

    groups[initial].push(client);
    return groups;
  }, {});
}

function createFallbackClientProfileDraft(): ClientProfileDraft {
  return {
    name: "",
    website: "",
    logoUrl: "",
    additionalWebsitesText: "",
    industry: "",
    region: "",
    hubSpotPortalId: "",
    linkedinUrl: "",
    facebookUrl: "",
    instagramUrl: "",
    xUrl: "",
    youtubeUrl: "",
    clientRoles: ["client"],
    parentClientId: "",
    visibleToPartnerIds: []
  };
}

function buildClientPayload(
  draft:
    | ClientProfileDraft
    | {
        name: string;
        website: string;
        logoUrl: string;
        additionalWebsitesText: string;
        industry: string;
        region: string;
        hubSpotPortalId: string;
        linkedinUrl: string;
        facebookUrl: string;
        instagramUrl: string;
        xUrl: string;
        youtubeUrl: string;
        clientRoles: string[];
        parentClientId: string;
        visibleToPartnerIds: string[];
      }
) {
  return {
    name: draft.name,
    website: draft.website,
    logoUrl: draft.logoUrl,
    additionalWebsites: draft.additionalWebsitesText
      .split(/\r?\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean),
    industry: draft.industry,
    region: draft.region,
    hubSpotPortalId: draft.hubSpotPortalId,
    linkedinUrl: draft.linkedinUrl,
    facebookUrl: draft.facebookUrl,
    instagramUrl: draft.instagramUrl,
    xUrl: draft.xUrl,
    youtubeUrl: draft.youtubeUrl,
    clientRoles: draft.clientRoles,
    parentClientId: draft.parentClientId,
    visibleToPartnerIds: draft.visibleToPartnerIds
  };
}

export default function ClientsWorkspace() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [creatingClient, setCreatingClient] = useState(false);
  const [savingContactForClient, setSavingContactForClient] = useState<
    string | null
  >(null);
  const [savingProfileForClient, setSavingProfileForClient] = useState<
    string | null
  >(null);
  const [enrichingClientId, setEnrichingClientId] = useState<string | null>(
    null
  );
  const [updatingContactId, setUpdatingContactId] = useState<string | null>(
    null
  );
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);
  const [confirmingDeleteClientId, setConfirmingDeleteClientId] = useState<
    string | null
  >(null);
  const [expandedClientIds, setExpandedClientIds] = useState<string[]>([]);
  const [showingContactFormIds, setShowingContactFormIds] = useState<string[]>(
    []
  );
  const [showingPortalInviteIds, setShowingPortalInviteIds] = useState<
    string[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [alphabetFilter, setAlphabetFilter] = useState("All");
  const [portalOptions, setPortalOptions] = useState<HubSpotPortalOption[]>([]);
  const [connectingPortalForClientId, setConnectingPortalForClientId] =
    useState<string | null>(null);
  const [hubSpotInstallProfiles, setHubSpotInstallProfiles] = useState<
    Record<string, HubSpotInstallProfile>
  >({});
  const [clientDraft, setClientDraft] = useState({
    name: "",
    website: "",
    logoUrl: "",
    additionalWebsitesText: "",
    industry: "",
    region: "",
    hubSpotPortalId: "",
    linkedinUrl: "",
    facebookUrl: "",
    instagramUrl: "",
    xUrl: "",
    youtubeUrl: "",
    clientRoles: ["client"] as string[],
    parentClientId: "",
    visibleToPartnerIds: [] as string[]
  });
  const [contactDrafts, setContactDrafts] = useState<
    Record<string, ContactDraft>
  >({});
  const [profileDrafts, setProfileDrafts] = useState<
    Record<string, ClientProfileDraft>
  >({});
  const [portalInviteDrafts, setPortalInviteDrafts] = useState<
    Record<string, PortalInviteDraft>
  >({});
  const [invitingContactId, setInvitingContactId] = useState<string | null>(
    null
  );

  async function refreshClients(options?: { background?: boolean }) {
    if (options?.background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch("/api/clients");

      if (!response.ok) {
        throw new Error("Failed to load clients");
      }

      const body = await response.json();
      setClients(body.clients ?? []);
      setProfileDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };

        for (const client of body.clients ?? []) {
          if (!nextDrafts[client.id]) {
            nextDrafts[client.id] = createClientProfileDraft(client);
          }
        }

        return nextDrafts;
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load clients"
      );
    } finally {
      if (options?.background) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }

  async function refreshPortalOptions() {
    try {
      const response = await fetch("/api/portals");

      if (!response.ok) {
        throw new Error("Failed to load HubSpot portals");
      }

      const body = await response.json();
      setPortalOptions(body.portals ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load HubSpot portals"
      );
    }
  }

  useEffect(() => {
    void refreshClients();
    void refreshPortalOptions();
  }, []);

  const totalProjects = clients.reduce(
    (total, client) => total + client.projects.length,
    0
  );
  const totalContacts = clients.reduce(
    (total, client) => total + client.contacts.length,
    0
  );
  const activeClientCount = clients.filter(
    (client) => client.projects.length > 0
  ).length;

  const filteredClients = useMemo(
    () =>
      clients
        .filter((client) => matchesClientSearch(client, searchQuery))
        .filter((client) => matchesAlphabet(client, alphabetFilter))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [alphabetFilter, clients, searchQuery]
  );

  const activeClients = filteredClients
    .filter((client) => client.projects.length > 0)
    .sort(
      (left, right) =>
        new Date(getClientLastActivity(right)).getTime() -
        new Date(getClientLastActivity(left)).getTime()
    );
  const otherClients = filteredClients.filter(
    (client) => client.projects.length === 0
  );
  const groupedOtherClients = groupClientsByInitial(otherClients);
  const otherClientInitials = Object.keys(groupedOtherClients).sort();
  const groupClientOptions = clients
    .filter((client) => client.clientRoles.includes("group"))
    .sort((left, right) => left.name.localeCompare(right.name));
  const partnerClientOptions = clients
    .filter((client) => client.clientRoles.includes("partner"))
    .sort((left, right) => left.name.localeCompare(right.name));

  function getProfileDraftForClient(clientId: string) {
    const existingDraft = profileDrafts[clientId];

    if (existingDraft) {
      return existingDraft;
    }

    const client = clients.find((item) => item.id === clientId);
    return client
      ? createClientProfileDraft(client)
      : createFallbackClientProfileDraft();
  }

  function updateContactDraft(
    clientId: string,
    field: keyof ContactDraft,
    value: string | boolean
  ) {
    setContactDrafts((currentDrafts) => ({
      ...currentDrafts,
      [clientId]: {
        ...(currentDrafts[clientId] ?? createEmptyContactDraft()),
        [field]: value
      } as ContactDraft
    }));
  }

  function updateProfileDraft(
    clientId: string,
    field: keyof ClientProfileDraft,
    value: string | string[]
  ) {
    setProfileDrafts((currentDrafts) => ({
      ...currentDrafts,
      [clientId]: {
        ...(currentDrafts[clientId] ?? getProfileDraftForClient(clientId)),
        [field]: value
      }
    }));
  }

  function toggleClientDraftRole(role: string) {
    setClientDraft((currentDraft) => ({
      ...currentDraft,
      clientRoles: currentDraft.clientRoles.includes(role)
        ? currentDraft.clientRoles.filter((entry) => entry !== role)
        : [...currentDraft.clientRoles, role]
    }));
  }

  function toggleProfileDraftRole(clientId: string, role: string) {
    const currentDraft = getProfileDraftForClient(clientId);
    const nextRoles = currentDraft.clientRoles.includes(role)
      ? currentDraft.clientRoles.filter((entry) => entry !== role)
      : [...currentDraft.clientRoles, role];
    updateProfileDraft(
      clientId,
      "clientRoles",
      nextRoles.length > 0 ? nextRoles : ["client"]
    );
  }

  function toggleClientDraftVisiblePartner(partnerId: string) {
    setClientDraft((currentDraft) => ({
      ...currentDraft,
      visibleToPartnerIds: currentDraft.visibleToPartnerIds.includes(partnerId)
        ? currentDraft.visibleToPartnerIds.filter(
            (entry) => entry !== partnerId
          )
        : [...currentDraft.visibleToPartnerIds, partnerId]
    }));
  }

  function toggleProfileDraftVisiblePartner(
    clientId: string,
    partnerId: string
  ) {
    const currentDraft = getProfileDraftForClient(clientId);
    updateProfileDraft(
      clientId,
      "visibleToPartnerIds",
      currentDraft.visibleToPartnerIds.includes(partnerId)
        ? currentDraft.visibleToPartnerIds.filter(
            (entry) => entry !== partnerId
          )
        : [...currentDraft.visibleToPartnerIds, partnerId]
    );
  }

  function toggleExpanded(clientId: string) {
    setExpandedClientIds((currentIds) =>
      currentIds.includes(clientId)
        ? currentIds.filter((id) => id !== clientId)
        : [...currentIds, clientId]
    );
  }

  function toggleContactForm(clientId: string) {
    setShowingContactFormIds((currentIds) =>
      currentIds.includes(clientId)
        ? currentIds.filter((id) => id !== clientId)
        : [...currentIds, clientId]
    );
  }

  function getPortalInviteDraft(client: ClientRecord, contact: ClientContact) {
    return (
      portalInviteDrafts[contact.id] ?? createPortalInviteDraft(client, contact)
    );
  }

  function togglePortalInvite(client: ClientRecord, contact: ClientContact) {
    setShowingPortalInviteIds((currentIds) =>
      currentIds.includes(contact.id)
        ? currentIds.filter((id) => id !== contact.id)
        : [...currentIds, contact.id]
    );
    setPortalInviteDrafts((currentDrafts) => ({
      ...currentDrafts,
      [contact.id]:
        currentDrafts[contact.id] ?? createPortalInviteDraft(client, contact)
    }));
  }

  function updatePortalInviteDraft(
    contactId: string,
    updater: (draft: PortalInviteDraft) => PortalInviteDraft
  ) {
    setPortalInviteDrafts((currentDrafts) => {
      const currentDraft =
        currentDrafts[contactId] ??
        ({
          projectIds: [],
          questionnaireAccess: true,
          sendEmail: true
        } satisfies PortalInviteDraft);

      return {
        ...currentDrafts,
        [contactId]: updater(currentDraft)
      };
    });
  }

  async function createClient() {
    if (!clientDraft.name.trim()) {
      setError("Client name is required.");
      return;
    }

    setCreatingClient(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildClientPayload(clientDraft))
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to create client");
      }

      setClientDraft({
        name: "",
        website: "",
        logoUrl: "",
        additionalWebsitesText: "",
        industry: "",
        region: "",
        hubSpotPortalId: "",
        linkedinUrl: "",
        facebookUrl: "",
        instagramUrl: "",
        xUrl: "",
        youtubeUrl: "",
        clientRoles: ["client"],
        parentClientId: "",
        visibleToPartnerIds: []
      });
      setExpandedClientIds((currentIds) => [body.client.id, ...currentIds]);
      setFeedback("Client added to the workspace.");
      await refreshClients({ background: true });
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to create client"
      );
    } finally {
      setCreatingClient(false);
    }
  }

  async function saveClientProfile(clientId: string) {
    const draft = getProfileDraftForClient(clientId);

    if (!draft.name.trim()) {
      setError("Client name is required.");
      return;
    }

    setSavingProfileForClient(clientId);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/clients/${encodeURIComponent(clientId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildClientPayload(draft))
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to update client");
      }

      setClients((currentClients) =>
        currentClients.map((client) =>
          client.id === clientId ? { ...client, ...body.client } : client
        )
      );
      setFeedback("Client profile updated.");
      await refreshClients({ background: true });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to update client"
      );
    } finally {
      setSavingProfileForClient(null);
    }
  }

  async function refreshClientEnrichment(clientId: string) {
    setEnrichingClientId(clientId);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/clients/${encodeURIComponent(clientId)}/enrich`,
        {
          method: "POST"
        }
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to refresh enrichment");
      }

      setFeedback("Client enrichment refreshed.");
      await refreshClients({ background: true });
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Failed to refresh enrichment"
      );
    } finally {
      setEnrichingClientId(null);
    }
  }

  async function connectClientHubSpotPortal(client: ClientRecord) {
    const selectedPortalRecordId =
      getProfileDraftForClient(client.id).hubSpotPortalId.trim() ||
      client.hubSpotPortal?.id ||
      "";

    setConnectingPortalForClientId(client.id);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch("/api/hubspot/oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          portalRecordId: selectedPortalRecordId || undefined,
          installProfile: hubSpotInstallProfiles[client.id] ?? "core_crm"
        })
      });
      const body = await response.json().catch(() => null);

      if (!response.ok || !body?.authUrl) {
        throw new Error(
          body?.error ?? "Failed to start HubSpot portal connection"
        );
      }

      window.location.href = body.authUrl;
    } catch (connectError) {
      setError(
        connectError instanceof Error
          ? connectError.message
          : "Failed to start HubSpot portal connection"
      );
      setConnectingPortalForClientId(null);
    }
  }

  async function addContact(clientId: string) {
    const draft = contactDrafts[clientId] ?? createEmptyContactDraft();

    if (!draft.firstName.trim() || !draft.email.trim()) {
      setError("Contact first name and email are required.");
      return;
    }

    setSavingContactForClient(clientId);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/clients/${encodeURIComponent(clientId)}/contacts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft)
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to add contact");
      }

      setContactDrafts((currentDrafts) => ({
        ...currentDrafts,
        [clientId]: createEmptyContactDraft()
      }));
      setFeedback("Client contact added.");
      await refreshClients({ background: true });
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to add contact"
      );
    } finally {
      setSavingContactForClient(null);
    }
  }

  async function toggleApprover(clientId: string, contact: ClientContact) {
    setUpdatingContactId(contact.id);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/clients/${encodeURIComponent(clientId)}/contacts/${encodeURIComponent(contact.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            canApproveQuotes: !contact.canApproveQuotes
          })
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to update contact");
      }

      setClients((currentClients) =>
        currentClients.map((client) =>
          client.id === clientId
            ? {
                ...client,
                contacts: client.contacts.map((existingContact) =>
                  existingContact.id === contact.id
                    ? {
                        ...existingContact,
                        ...body.contact,
                        portalAssignments: existingContact.portalAssignments
                      }
                    : existingContact
                )
              }
            : client
        )
      );
      setFeedback("Contact approval authority updated.");
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update contact"
      );
    } finally {
      setUpdatingContactId(null);
    }
  }

  async function inviteContactToProjects(
    client: ClientRecord,
    contact: ClientContact
  ) {
    const draft = getPortalInviteDraft(client, contact);

    if (draft.projectIds.length === 0) {
      setError(
        "Select at least one linked project before sending portal access."
      );
      return;
    }

    setInvitingContactId(contact.id);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/clients/${encodeURIComponent(client.id)}/contacts/${encodeURIComponent(contact.id)}/portal-access`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft)
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to update portal access");
      }

      setFeedback(
        body?.emailSent
          ? `${contact.firstName || contact.email} now has project portal access and the onboarding email was sent.`
          : body?.emailError
            ? `${contact.firstName || contact.email} now has project portal access, but the onboarding email could not be sent: ${body.emailError}`
            : `${contact.firstName || contact.email} now has project portal access.`
      );
      await refreshClients({ background: true });
    } catch (inviteError) {
      setError(
        inviteError instanceof Error
          ? inviteError.message
          : "Failed to update portal access"
      );
    } finally {
      setInvitingContactId(null);
    }
  }

  async function deleteClient(client: ClientRecord) {
    if (client.projects.length > 0) {
      setError(
        "This client still has linked projects and cannot be deleted yet."
      );
      return;
    }

    setDeletingClientId(client.id);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/clients/${encodeURIComponent(client.id)}`,
        {
          method: "DELETE"
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to delete client");
      }

      setClients((currentClients) =>
        currentClients.filter(
          (existingClient) => existingClient.id !== client.id
        )
      );
      setExpandedClientIds((currentIds) =>
        currentIds.filter((existingId) => existingId !== client.id)
      );
      setShowingContactFormIds((currentIds) =>
        currentIds.filter((existingId) => existingId !== client.id)
      );
      setShowingPortalInviteIds((currentIds) =>
        currentIds.filter(
          (existingId) =>
            !client.contacts.some((contact) => contact.id === existingId)
        )
      );
      setProfileDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[client.id];
        return nextDrafts;
      });
      setContactDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[client.id];
        return nextDrafts;
      });
      setPortalInviteDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        for (const contact of client.contacts) {
          delete nextDrafts[contact.id];
        }
        return nextDrafts;
      });
      setConfirmingDeleteClientId(null);
      setFeedback("Client deleted from the workspace.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete client"
      );
    } finally {
      setDeletingClientId(null);
    }
  }

  function renderClientRow(client: ClientRecord) {
    const isExpanded = expandedClientIds.includes(client.id);
    const showContactForm = showingContactFormIds.includes(client.id);
    const recommendedContact = getPrimaryContact(client);
    const profileDraft =
      profileDrafts[client.id] ?? createClientProfileDraft(client);
    const contactDraft = contactDrafts[client.id] ?? createEmptyContactDraft();
    const logoUrl = deriveClientLogoUrl(client);
    const websiteHost = getWebsiteHost(client.website);
    const canDeleteClient = client.projects.length === 0;
    const isConfirmingDelete = confirmingDeleteClientId === client.id;
    const isDeleting = deletingClientId === client.id;
    const isEnriching = enrichingClientId === client.id;
    const isConnectingPortal = connectingPortalForClientId === client.id;
    const availableParentGroups = groupClientOptions.filter(
      (groupClient) => groupClient.id !== client.id
    );
    const availablePartnerOptions = partnerClientOptions.filter(
      (partnerClient) => partnerClient.id !== client.id
    );
    const selectedHubSpotPortal =
      portalOptions.find(
        (portalOption) => portalOption.id === profileDraft.hubSpotPortalId
      ) ??
      portalOptions.find(
        (portalOption) => portalOption.id === client.hubSpotPortal?.id
      ) ??
      client.hubSpotPortal ??
      null;
    const hubSpotInstallProfile =
      hubSpotInstallProfiles[client.id] ?? "core_crm";

    return (
      <div
        key={client.id}
        className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-background-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] text-sm font-semibold text-white">
              {logoUrl ? (
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white p-1.5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]">
                  <img
                    src={logoUrl}
                    alt={`${client.name} logo`}
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : (
                getClientInitials(client.name)
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-lg font-semibold text-white">
                  {client.name}
                </h3>
                {client.projects.length > 0 ? (
                  <span className="rounded-full bg-[rgba(81,208,176,0.14)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#51d0b0]">
                    Active
                  </span>
                ) : null}
                {client.industry ? (
                  <span className="rounded-full bg-[rgba(255,255,255,0.06)] px-3 py-1 text-[11px] font-medium text-text-secondary">
                    {client.industry}
                  </span>
                ) : null}
                {client.clientRoles.map((role) => (
                  <span
                    key={role}
                    className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-[11px] font-medium text-text-secondary"
                  >
                    {clientRoleOptions.find((option) => option.value === role)
                      ?.label ?? role}
                  </span>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                <span>{websiteHost || client.region || "No website yet"}</span>
                <span>{client.contacts.length} contacts</span>
                <span>{client.projects.length} linked projects</span>
                {client.parentClientName ? (
                  <span>Group: {client.parentClientName}</span>
                ) : null}
                {client.visibleClients.length > 0 ? (
                  <span>
                    {client.visibleClients.length} visible downstream clients
                  </span>
                ) : null}
                <span>Updated {formatDate(getClientLastActivity(client))}</span>
              </div>

              <div className="mt-2 flex flex-wrap gap-2 text-xs text-text-muted">
                {recommendedContact ? (
                  <span>
                    Primary:{" "}
                    {[recommendedContact.firstName, recommendedContact.lastName]
                      .filter(Boolean)
                      .join(" ")}{" "}
                    · {recommendedContact.email}
                  </span>
                ) : (
                  <span>No contacts linked yet</span>
                )}
                <span>
                  HubSpot:{" "}
                  {client.hubSpotPortal?.displayName
                    ? `${client.hubSpotPortal.displayName}${client.hubSpotPortal.connected ? " · connected" : " · needs reconnect"}`
                    : "Not connected yet"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={buildProjectLink(client, recommendedContact ?? undefined)}
              className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm font-medium text-white"
            >
              New Project
            </Link>
            <button
              type="button"
              onClick={() => toggleExpanded(client.id)}
              className="rounded-2xl border border-[rgba(255,255,255,0.08)] px-4 py-3 text-sm font-medium text-white"
            >
              {isExpanded ? "Collapse" : "Open client"}
            </button>
          </div>
        </div>

        {client.projects.length > 0 ? (
          <div className="border-t border-[rgba(255,255,255,0.06)] px-5 py-3 md:px-6">
            <div className="flex flex-wrap gap-2">
              {client.projects.slice(0, 4).map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-xs text-text-secondary transition hover:text-white"
                >
                  {project.name}
                </Link>
              ))}
              {client.projects.length > 4 ? (
                <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-xs text-text-muted">
                  +{client.projects.length - 4} more
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {isExpanded ? (
          <div className="border-t border-[rgba(255,255,255,0.06)] px-5 py-5 md:px-6">
            <div className="grid gap-5 xl:grid-cols-[0.95fr,1.05fr]">
              <div className="space-y-5">
                <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        Company Profile
                      </p>
                      <p className="mt-2 text-sm text-text-secondary">
                        Use role tags for partner/client/group behavior, keep
                        region controlled, and refresh enrichment from the
                        website when you want overview, socials, and a detected
                        logo candidate.
                      </p>
                      {!canDeleteClient ? (
                        <p className="mt-3 text-xs text-text-muted">
                          Delete is only available once this client has no
                          linked projects.
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => void refreshClientEnrichment(client.id)}
                      disabled={isEnriching || isDeleting}
                      className="rounded-2xl border border-[rgba(81,208,176,0.22)] bg-[rgba(81,208,176,0.08)] px-4 py-3 text-sm font-medium text-[#8de7d1] disabled:cursor-not-allowed disabled:text-text-muted"
                    >
                      {isEnriching ? "Refreshing..." : "Refresh enrichment"}
                    </button>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-medium text-white">
                        Client name
                      </span>
                      <input
                        value={profileDraft.name}
                        onChange={(event) =>
                          updateProfileDraft(
                            client.id,
                            "name",
                            event.target.value
                          )
                        }
                        className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-white">
                        Website
                      </span>
                      <input
                        value={profileDraft.website}
                        onChange={(event) =>
                          updateProfileDraft(
                            client.id,
                            "website",
                            event.target.value
                          )
                        }
                        placeholder="client.com"
                        className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="text-sm font-medium text-white">
                        Additional websites
                      </span>
                      <textarea
                        value={profileDraft.additionalWebsitesText}
                        onChange={(event) =>
                          updateProfileDraft(
                            client.id,
                            "additionalWebsitesText",
                            event.target.value
                          )
                        }
                        placeholder="One per line"
                        className="mt-3 min-h-[88px] w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="text-sm font-medium text-white">
                        Manual logo URL
                      </span>
                      <input
                        value={profileDraft.logoUrl}
                        onChange={(event) =>
                          updateProfileDraft(
                            client.id,
                            "logoUrl",
                            event.target.value
                          )
                        }
                        placeholder="https://..."
                        className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
                      />
                      <p className="mt-2 text-xs text-text-muted">
                        Manual logo always wins over the enriched logo.
                      </p>
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-white">
                        Industry
                      </span>
                      <select
                        value={profileDraft.industry}
                        onChange={(event) =>
                          updateProfileDraft(
                            client.id,
                            "industry",
                            event.target.value
                          )
                        }
                        className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
                      >
                        <option value="">Select industry</option>
                        {!industryOptions.includes(profileDraft.industry) &&
                        profileDraft.industry ? (
                          <option value={profileDraft.industry}>
                            {profileDraft.industry}
                          </option>
                        ) : null}
                        {industryOptions.map((industry) => (
                          <option key={industry} value={industry}>
                            {industry}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-white">
                        Region
                      </span>
                      <select
                        value={profileDraft.region}
                        onChange={(event) =>
                          updateProfileDraft(
                            client.id,
                            "region",
                            event.target.value
                          )
                        }
                        className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
                      >
                        <option value="">Select region</option>
                        {!clientRegionOptions.includes(profileDraft.region) &&
                        profileDraft.region ? (
                          <option value={profileDraft.region}>
                            {profileDraft.region}
                          </option>
                        ) : null}
                        {clientRegionOptions.map((region) => (
                          <option key={region} value={region}>
                            {region}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card p-4">
                      <p className="text-sm font-medium text-white">
                        Client roles
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        {clientRoleOptions.map((role) => (
                          <label
                            key={role.value}
                            className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-white"
                          >
                            <input
                              type="checkbox"
                              checked={profileDraft.clientRoles.includes(
                                role.value
                              )}
                              onChange={() =>
                                toggleProfileDraftRole(client.id, role.value)
                              }
                            />
                            {role.label}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card p-4">
                      <label className="block">
                        <span className="text-sm font-medium text-white">
                          Parent group
                        </span>
                        <select
                          value={profileDraft.parentClientId}
                          onChange={(event) =>
                            updateProfileDraft(
                              client.id,
                              "parentClientId",
                              event.target.value
                            )
                          }
                          className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                        >
                          <option value="">No parent group</option>
                          {availableParentGroups.map((groupClient) => (
                            <option key={groupClient.id} value={groupClient.id}>
                              {groupClient.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {client.childClients.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {client.childClients.map((childClient) => (
                            <span
                              key={childClient.id}
                              className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-xs text-text-secondary"
                            >
                              {childClient.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card p-4">
                    <p className="text-sm font-medium text-white">
                      Client HubSpot portal
                    </p>
                    <p className="mt-2 text-sm text-text-secondary">
                      Connect the client’s HubSpot portal once here. Every
                      project for this client will use the same canonical portal
                      automatically.
                    </p>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
                      <label className="block">
                        <span className="text-sm font-medium text-white">
                          Linked portal
                        </span>
                        <select
                          value={profileDraft.hubSpotPortalId}
                          onChange={(event) =>
                            updateProfileDraft(
                              client.id,
                              "hubSpotPortalId",
                              event.target.value
                            )
                          }
                          className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                        >
                          <option value="">Not linked yet</option>
                          {portalOptions.map((portalOption) => (
                            <option
                              key={portalOption.id}
                              value={portalOption.id}
                            >
                              {portalOption.displayName} ·{" "}
                              {portalOption.portalId}
                              {portalOption.connected
                                ? " · Connected"
                                : " · Needs reconnect"}
                            </option>
                          ))}
                        </select>
                        <p className="mt-2 text-xs text-text-muted">
                          Select an existing installed portal here, or run OAuth
                          below to connect a new one.
                        </p>
                      </label>

                      <label className="block">
                        <span className="text-sm font-medium text-white">
                          Install profile
                        </span>
                        <select
                          value={hubSpotInstallProfile}
                          onChange={(event) =>
                            setHubSpotInstallProfiles((currentProfiles) => ({
                              ...currentProfiles,
                              [client.id]: event.target
                                .value as HubSpotInstallProfile
                            }))
                          }
                          className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                        >
                          {hubSpotInstallProfileOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <p className="mt-2 text-xs text-text-muted">
                          Start with `Core CRM install` for most client portals.
                        </p>
                      </label>

                      <button
                        type="button"
                        onClick={() => void connectClientHubSpotPortal(client)}
                        disabled={isConnectingPortal || isDeleting}
                        className="w-full rounded-2xl border border-[rgba(81,208,176,0.22)] bg-[rgba(81,208,176,0.08)] px-5 py-3 text-sm font-medium text-[#8de7d1] disabled:cursor-not-allowed disabled:text-text-muted lg:w-auto"
                      >
                        {isConnectingPortal
                          ? "Connecting..."
                          : selectedHubSpotPortal?.connected
                            ? "Reconnect portal"
                            : "Connect portal"}
                      </button>
                    </div>

                    <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4 text-sm text-text-secondary">
                      {selectedHubSpotPortal ? (
                        <div className="space-y-2">
                          <p className="font-medium text-white">
                            {selectedHubSpotPortal.displayName}
                          </p>
                          <p>
                            {selectedHubSpotPortal.portalId}
                            {selectedHubSpotPortal.connected
                              ? " · Connected"
                              : " · Needs reconnect"}
                          </p>
                          {selectedHubSpotPortal.connectedEmail ? (
                            <p>
                              Connected as{" "}
                              {selectedHubSpotPortal.connectedEmail}
                            </p>
                          ) : null}
                          {selectedHubSpotPortal.hubDomain ? (
                            <p>{selectedHubSpotPortal.hubDomain}</p>
                          ) : null}
                        </div>
                      ) : (
                        <p>
                          No HubSpot portal linked yet. Once you connect it
                          here, all of this client’s projects will inherit that
                          portal automatically.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card p-4">
                    <p className="text-sm font-medium text-white">
                      Partner visibility
                    </p>
                    <p className="mt-2 text-sm text-text-secondary">
                      Choose which partner-tagged companies should be able to
                      see this client’s downstream work.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {availablePartnerOptions.length > 0 ? (
                        availablePartnerOptions.map((partnerClient) => (
                          <label
                            key={partnerClient.id}
                            className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-white"
                          >
                            <input
                              type="checkbox"
                              checked={profileDraft.visibleToPartnerIds.includes(
                                partnerClient.id
                              )}
                              onChange={() =>
                                toggleProfileDraftVisiblePartner(
                                  client.id,
                                  partnerClient.id
                                )
                              }
                            />
                            {partnerClient.name}
                          </label>
                        ))
                      ) : (
                        <p className="text-sm text-text-muted">
                          Tag another company as a partner first to enable
                          visibility links.
                        </p>
                      )}
                    </div>
                    {client.visibleToPartners.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {client.visibleToPartners.map((partnerClient) => (
                          <span
                            key={partnerClient.id}
                            className="rounded-full bg-[rgba(81,208,176,0.14)] px-3 py-1 text-xs text-[#8de7d1]"
                          >
                            Visible to {partnerClient.name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-5 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card p-4">
                    <p className="text-sm font-medium text-white">
                      Enrichment overview
                    </p>
                    <p className="mt-2 text-sm text-text-secondary">
                      {client.companyOverview ??
                        "No enriched company overview yet. Refresh enrichment after adding a website."}
                    </p>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="text-sm font-medium text-white">
                          LinkedIn
                        </span>
                        <input
                          value={profileDraft.linkedinUrl}
                          onChange={(event) =>
                            updateProfileDraft(
                              client.id,
                              "linkedinUrl",
                              event.target.value
                            )
                          }
                          placeholder="https://linkedin.com/..."
                          className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-white">
                          Facebook
                        </span>
                        <input
                          value={profileDraft.facebookUrl}
                          onChange={(event) =>
                            updateProfileDraft(
                              client.id,
                              "facebookUrl",
                              event.target.value
                            )
                          }
                          placeholder="https://facebook.com/..."
                          className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-white">
                          Instagram
                        </span>
                        <input
                          value={profileDraft.instagramUrl}
                          onChange={(event) =>
                            updateProfileDraft(
                              client.id,
                              "instagramUrl",
                              event.target.value
                            )
                          }
                          placeholder="https://instagram.com/..."
                          className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-white">
                          X
                        </span>
                        <input
                          value={profileDraft.xUrl}
                          onChange={(event) =>
                            updateProfileDraft(
                              client.id,
                              "xUrl",
                              event.target.value
                            )
                          }
                          placeholder="https://x.com/..."
                          className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                        />
                      </label>
                      <label className="block md:col-span-2">
                        <span className="text-sm font-medium text-white">
                          YouTube
                        </span>
                        <input
                          value={profileDraft.youtubeUrl}
                          onChange={(event) =>
                            updateProfileDraft(
                              client.id,
                              "youtubeUrl",
                              event.target.value
                            )
                          }
                          placeholder="https://youtube.com/..."
                          className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-text-muted">
                      {client.lastEnrichedAt ? (
                        <span>
                          Last enriched {formatDate(client.lastEnrichedAt)}
                        </span>
                      ) : (
                        <span>No enrichment run yet</span>
                      )}
                      {client.visibleClients.length > 0 ? (
                        <span>
                          This partner-linked record can see{" "}
                          {client.visibleClients.length} downstream client
                          {client.visibleClients.length === 1 ? "" : "s"}.
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-xs text-text-muted">
                        We’ll use the website or first contact domain for a logo
                        when no manual URL is set.
                      </p>
                      {canDeleteClient ? (
                        <p className="text-xs text-[#ff8f9c]">
                          This client has no linked projects, so it can be
                          removed if it is junk or old test data.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap justify-end gap-3">
                      {canDeleteClient ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (isConfirmingDelete) {
                              void deleteClient(client);
                              return;
                            }

                            setConfirmingDeleteClientId(client.id);
                            setFeedback(null);
                            setError(null);
                          }}
                          disabled={isDeleting}
                          className="rounded-2xl border border-[rgba(255,143,156,0.22)] bg-[rgba(255,143,156,0.08)] px-5 py-3 text-sm font-medium text-[#ffb1ba] disabled:cursor-not-allowed disabled:text-text-muted"
                        >
                          {isDeleting
                            ? "Deleting..."
                            : isConfirmingDelete
                              ? "Confirm delete"
                              : "Delete client"}
                        </button>
                      ) : null}
                      {isConfirmingDelete ? (
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteClientId(null)}
                          disabled={isDeleting}
                          className="rounded-2xl border border-[rgba(255,255,255,0.08)] px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                        >
                          Cancel
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void saveClientProfile(client.id)}
                        disabled={
                          savingProfileForClient === client.id || isDeleting
                        }
                        className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                      >
                        {savingProfileForClient === client.id
                          ? "Saving..."
                          : "Save client"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        Contacts
                      </p>
                      <p className="mt-2 text-sm text-text-secondary">
                        Keep the approver and key stakeholders here, then pull
                        them straight into projects and portal access.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleContactForm(client.id)}
                      className="rounded-2xl border border-[rgba(255,255,255,0.08)] px-4 py-3 text-sm font-medium text-white"
                    >
                      {showContactForm ? "Hide add contact" : "Add contact"}
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {client.contacts.length > 0 ? (
                      client.contacts.map((contact) => {
                        const showPortalInvite =
                          showingPortalInviteIds.includes(contact.id);
                        const portalInviteDraft = getPortalInviteDraft(
                          client,
                          contact
                        );

                        return (
                          <div
                            key={contact.id}
                            className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-white">
                                  {[contact.firstName, contact.lastName]
                                    .filter(Boolean)
                                    .join(" ")}
                                </p>
                                <p className="mt-1 text-xs text-text-secondary">
                                  {contact.email}
                                  {contact.title ? ` · ${contact.title}` : ""}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {contact.canApproveQuotes ? (
                                    <span className="rounded-full bg-[rgba(81,208,176,0.14)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#51d0b0]">
                                      Quote approver
                                    </span>
                                  ) : null}
                                  {contact.portalAssignments.length > 0 ? (
                                    <span className="rounded-full bg-[rgba(255,255,255,0.06)] px-3 py-2 text-[11px] font-medium text-text-secondary">
                                      {contact.portalAssignments.length} portal
                                      project
                                      {contact.portalAssignments.length === 1
                                        ? ""
                                        : "s"}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void toggleApprover(client.id, contact)
                                  }
                                  disabled={updatingContactId === contact.id}
                                  className="rounded-xl border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                                >
                                  {updatingContactId === contact.id
                                    ? "Saving..."
                                    : contact.canApproveQuotes
                                      ? "Remove approval"
                                      : "Make approver"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    togglePortalInvite(client, contact)
                                  }
                                  className="rounded-xl border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs font-medium text-white"
                                >
                                  {showPortalInvite
                                    ? "Hide portal access"
                                    : "Portal access"}
                                </button>
                                <Link
                                  href={buildProjectLink(client, contact)}
                                  className="rounded-xl border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs font-medium text-white"
                                >
                                  Use in project
                                </Link>
                              </div>
                            </div>

                            {showPortalInvite ? (
                              <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                  <div>
                                    <p className="text-sm font-semibold text-white">
                                      Portal access and onboarding
                                    </p>
                                    <p className="mt-2 max-w-2xl text-sm text-text-secondary">
                                      Choose which linked projects this contact
                                      should see, whether they need to complete
                                      the active project inputs, and send the
                                      onboarding email in one step.
                                    </p>
                                  </div>
                                  <div className="rounded-full bg-[rgba(255,255,255,0.06)] px-3 py-2 text-[11px] font-medium text-text-secondary">
                                    Role:{" "}
                                    {contact.canApproveQuotes
                                      ? "Approver"
                                      : "Contributor"}
                                  </div>
                                </div>

                                <div className="mt-4 space-y-3">
                                  {client.projects.length > 0 ? (
                                    client.projects.map((project) => {
                                      const existingAssignment =
                                        contact.portalAssignments.find(
                                          (assignment) =>
                                            assignment.projectId === project.id
                                        ) ?? null;
                                      const isSelected =
                                        portalInviteDraft.projectIds.includes(
                                          project.id
                                        );

                                      return (
                                        <label
                                          key={project.id}
                                          className="flex cursor-pointer flex-wrap items-start justify-between gap-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-4"
                                        >
                                          <div className="flex items-start gap-3">
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={(event) =>
                                                updatePortalInviteDraft(
                                                  contact.id,
                                                  (currentDraft) => ({
                                                    ...currentDraft,
                                                    projectIds: event.target
                                                      .checked
                                                      ? Array.from(
                                                          new Set([
                                                            ...currentDraft.projectIds,
                                                            project.id
                                                          ])
                                                        )
                                                      : currentDraft.projectIds.filter(
                                                          (projectId) =>
                                                            projectId !==
                                                            project.id
                                                        )
                                                  })
                                                )
                                              }
                                              className="mt-1"
                                            />
                                            <div>
                                              <p className="text-sm font-medium text-white">
                                                {project.name}
                                              </p>
                                              <p className="mt-1 text-xs text-text-secondary">
                                                {project.scopeType.replace(
                                                  /_/g,
                                                  " "
                                                )}{" "}
                                                · {project.quoteApprovalStatus}
                                              </p>
                                            </div>
                                          </div>
                                          {existingAssignment ? (
                                            <div className="text-right text-xs text-text-secondary">
                                              <p>
                                                {existingAssignment.authStatus ===
                                                "active"
                                                  ? "Portal active"
                                                  : "Invite pending"}
                                              </p>
                                              <p className="mt-1">
                                                {existingAssignment.questionnaireAccess
                                                  ? "Project inputs enabled"
                                                  : "Visibility only"}
                                              </p>
                                            </div>
                                          ) : (
                                            <span className="text-xs text-text-muted">
                                              Not yet assigned
                                            </span>
                                          )}
                                        </label>
                                      );
                                    })
                                  ) : (
                                    <div className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.12)] px-4 py-4 text-sm text-text-secondary">
                                      This client does not have any linked
                                      projects yet.
                                    </div>
                                  )}
                                </div>

                                <div className="mt-4 grid gap-3 md:grid-cols-2">
                                  <label className="flex items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-4 text-sm text-white">
                                    <input
                                      type="checkbox"
                                      checked={
                                        portalInviteDraft.questionnaireAccess
                                      }
                                      onChange={(event) =>
                                        updatePortalInviteDraft(
                                          contact.id,
                                          (currentDraft) => ({
                                            ...currentDraft,
                                            questionnaireAccess:
                                              event.target.checked
                                          })
                                        )
                                      }
                                    />
                                    This contact should complete project inputs
                                  </label>
                                  <label className="flex items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-4 text-sm text-white">
                                    <input
                                      type="checkbox"
                                      checked={portalInviteDraft.sendEmail}
                                      onChange={(event) =>
                                        updatePortalInviteDraft(
                                          contact.id,
                                          (currentDraft) => ({
                                            ...currentDraft,
                                            sendEmail: event.target.checked
                                          })
                                        )
                                      }
                                    />
                                    Send the Muloo onboarding email now
                                  </label>
                                </div>

                                <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-4 text-sm text-text-secondary">
                                  The onboarding email explains the portal,
                                  required next step, and that project inputs
                                  save automatically so the client can stop and
                                  resume later.
                                </div>

                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                  <p className="text-sm text-text-secondary">
                                    {portalInviteDraft.projectIds.length}{" "}
                                    project
                                    {portalInviteDraft.projectIds.length === 1
                                      ? ""
                                      : "s"}{" "}
                                    selected
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void inviteContactToProjects(
                                        client,
                                        contact
                                      )
                                    }
                                    disabled={
                                      invitingContactId === contact.id ||
                                      portalInviteDraft.projectIds.length === 0
                                    }
                                    className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                                  >
                                    {invitingContactId === contact.id
                                      ? "Updating access..."
                                      : portalInviteDraft.sendEmail
                                        ? "Save access and send invite"
                                        : "Save portal access"}
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.12)] px-4 py-4 text-sm text-text-secondary">
                        No contacts added yet for this client.
                      </div>
                    )}
                  </div>

                  {showContactForm ? (
                    <div className="mt-5 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card p-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block">
                          <span className="text-sm font-medium text-white">
                            First name
                          </span>
                          <input
                            value={contactDraft.firstName}
                            onChange={(event) =>
                              updateContactDraft(
                                client.id,
                                "firstName",
                                event.target.value
                              )
                            }
                            className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                          />
                        </label>
                        <label className="block">
                          <span className="text-sm font-medium text-white">
                            Last name
                          </span>
                          <input
                            value={contactDraft.lastName}
                            onChange={(event) =>
                              updateContactDraft(
                                client.id,
                                "lastName",
                                event.target.value
                              )
                            }
                            className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                          />
                        </label>
                        <label className="block">
                          <span className="text-sm font-medium text-white">
                            Email
                          </span>
                          <input
                            value={contactDraft.email}
                            onChange={(event) =>
                              updateContactDraft(
                                client.id,
                                "email",
                                event.target.value
                              )
                            }
                            className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                          />
                        </label>
                        <label className="block">
                          <span className="text-sm font-medium text-white">
                            Title / role
                          </span>
                          <input
                            value={contactDraft.title}
                            onChange={(event) =>
                              updateContactDraft(
                                client.id,
                                "title",
                                event.target.value
                              )
                            }
                            className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                          />
                        </label>
                      </div>
                      <label className="mt-4 flex items-center gap-3 text-sm text-white">
                        <input
                          type="checkbox"
                          checked={contactDraft.canApproveQuotes}
                          onChange={(event) =>
                            updateContactDraft(
                              client.id,
                              "canApproveQuotes",
                              event.target.checked
                            )
                          }
                        />
                        This contact can approve quotes
                      </label>
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => void addContact(client.id)}
                          disabled={savingContactForClient === client.id}
                          className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                        >
                          {savingContactForClient === client.id
                            ? "Saving..."
                            : "Add contact"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                      Linked Projects
                    </p>
                    <p className="mt-2 text-sm text-text-secondary">
                      We pull projects in from the direct client link plus any
                      matching contact emails already used in portal access or
                      client champion fields.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {client.projects.length > 0 ? (
                    client.projects.map((project) => (
                      <Link
                        key={project.id}
                        href={`/projects/${project.id}`}
                        className="block rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-4 transition hover:border-[rgba(255,255,255,0.16)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {project.name}
                            </p>
                            <p className="mt-1 text-xs text-text-secondary">
                              {project.scopeType.replace(/_/g, " ")} ·{" "}
                              {project.status}
                            </p>
                          </div>
                          <span className="rounded-full bg-[rgba(255,255,255,0.06)] px-3 py-1 text-[11px] font-medium text-text-secondary">
                            {project.quoteApprovalStatus}
                          </span>
                        </div>
                        <p className="mt-3 text-xs text-text-muted">
                          Updated {formatDate(project.updatedAt)}
                        </p>
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.12)] px-4 py-4 text-sm text-text-secondary">
                      No linked projects yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <AppShell>
      <div className="px-8 py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-background-card p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-text-muted">
                  Client Workspace
                </p>
                <h1 className="mt-3 text-3xl font-semibold text-white">
                  Clients and key contacts
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
                  A tighter CRM-lite directory: active clients first, fast
                  search, expandable company records, linked contacts, and
                  linked projects without turning this into a full CRM.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/projects/new"
                  className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-5 py-3 text-sm font-medium text-white"
                >
                  New Project
                </Link>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Clients", value: clients.length },
                { label: "Active Clients", value: activeClientCount },
                { label: "Contacts", value: totalContacts },
                { label: "Projects", value: totalProjects }
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl bg-[#0b1126] px-5 py-5"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                    {item.label}
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-white">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <section className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-background-card p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Add client company
                </h2>
                <p className="mt-2 text-sm text-text-secondary">
                  Add the company once, then keep everything else inside the
                  client record when you need it.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-white">
                  Client name
                </span>
                <input
                  value={clientDraft.name}
                  onChange={(event) =>
                    setClientDraft((currentDraft) => ({
                      ...currentDraft,
                      name: event.target.value
                    }))
                  }
                  className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-white">Website</span>
                <input
                  value={clientDraft.website}
                  onChange={(event) =>
                    setClientDraft((currentDraft) => ({
                      ...currentDraft,
                      website: event.target.value
                    }))
                  }
                  placeholder="client.com"
                  className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-white">Logo URL</span>
                <input
                  value={clientDraft.logoUrl}
                  onChange={(event) =>
                    setClientDraft((currentDraft) => ({
                      ...currentDraft,
                      logoUrl: event.target.value
                    }))
                  }
                  placeholder="https://..."
                  className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-white">Industry</span>
                <select
                  value={clientDraft.industry}
                  onChange={(event) =>
                    setClientDraft((currentDraft) => ({
                      ...currentDraft,
                      industry: event.target.value
                    }))
                  }
                  className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="">Select industry</option>
                  {industryOptions.map((industry) => (
                    <option key={industry} value={industry}>
                      {industry}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-white">Region</span>
                <select
                  value={clientDraft.region}
                  onChange={(event) =>
                    setClientDraft((currentDraft) => ({
                      ...currentDraft,
                      region: event.target.value
                    }))
                  }
                  className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="">Select region</option>
                  {clientRegionOptions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-white">
                  Additional websites
                </span>
                <textarea
                  value={clientDraft.additionalWebsitesText}
                  onChange={(event) =>
                    setClientDraft((currentDraft) => ({
                      ...currentDraft,
                      additionalWebsitesText: event.target.value
                    }))
                  }
                  placeholder="One per line"
                  className="mt-3 min-h-[88px] w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4">
                <p className="text-sm font-medium text-white">Client roles</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {clientRoleOptions.map((role) => (
                    <label
                      key={role.value}
                      className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-white"
                    >
                      <input
                        type="checkbox"
                        checked={clientDraft.clientRoles.includes(role.value)}
                        onChange={() => toggleClientDraftRole(role.value)}
                      />
                      {role.label}
                    </label>
                  ))}
                </div>
              </div>

              <label className="block rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4">
                <span className="text-sm font-medium text-white">
                  Parent group
                </span>
                <select
                  value={clientDraft.parentClientId}
                  onChange={(event) =>
                    setClientDraft((currentDraft) => ({
                      ...currentDraft,
                      parentClientId: event.target.value
                    }))
                  }
                  className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="">No parent group</option>
                  {groupClientOptions.map((groupClient) => (
                    <option key={groupClient.id} value={groupClient.id}>
                      {groupClient.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4">
              <p className="text-sm font-medium text-white">
                Visible to partners
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                {partnerClientOptions.length > 0 ? (
                  partnerClientOptions.map((partnerClient) => (
                    <label
                      key={partnerClient.id}
                      className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-white"
                    >
                      <input
                        type="checkbox"
                        checked={clientDraft.visibleToPartnerIds.includes(
                          partnerClient.id
                        )}
                        onChange={() =>
                          toggleClientDraftVisiblePartner(partnerClient.id)
                        }
                      />
                      {partnerClient.name}
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-text-muted">
                    No partner-tagged companies yet.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-white">LinkedIn</span>
                <input
                  value={clientDraft.linkedinUrl}
                  onChange={(event) =>
                    setClientDraft((currentDraft) => ({
                      ...currentDraft,
                      linkedinUrl: event.target.value
                    }))
                  }
                  placeholder="https://linkedin.com/..."
                  className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-white">Facebook</span>
                <input
                  value={clientDraft.facebookUrl}
                  onChange={(event) =>
                    setClientDraft((currentDraft) => ({
                      ...currentDraft,
                      facebookUrl: event.target.value
                    }))
                  }
                  placeholder="https://facebook.com/..."
                  className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-white">
                  Instagram
                </span>
                <input
                  value={clientDraft.instagramUrl}
                  onChange={(event) =>
                    setClientDraft((currentDraft) => ({
                      ...currentDraft,
                      instagramUrl: event.target.value
                    }))
                  }
                  placeholder="https://instagram.com/..."
                  className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-white">X</span>
                <input
                  value={clientDraft.xUrl}
                  onChange={(event) =>
                    setClientDraft((currentDraft) => ({
                      ...currentDraft,
                      xUrl: event.target.value
                    }))
                  }
                  placeholder="https://x.com/..."
                  className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-white">YouTube</span>
                <input
                  value={clientDraft.youtubeUrl}
                  onChange={(event) =>
                    setClientDraft((currentDraft) => ({
                      ...currentDraft,
                      youtubeUrl: event.target.value
                    }))
                  }
                  placeholder="https://youtube.com/..."
                  className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                {error ? (
                  <p className="text-sm text-[#ff8f9c]">{error}</p>
                ) : feedback ? (
                  <p className="text-sm text-status-success">{feedback}</p>
                ) : (
                  <p className="text-sm text-text-secondary">
                    Search keeps the directory clean, regions stay controlled,
                    and profiles can now model partner/group relationships
                    without flattening everything into one client type.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void createClient()}
                disabled={creatingClient}
                className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
              >
                {creatingClient ? "Saving..." : "Add client"}
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-background-card p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Directory</h2>
                <p className="mt-2 text-sm text-text-secondary">
                  Search by company, contact, email, or project. Use A-Z when
                  you need to jump fast through the longer tail of clients.
                </p>
              </div>
              {refreshing ? (
                <div className="rounded-full bg-[rgba(255,255,255,0.06)] px-4 py-2 text-xs font-medium text-text-secondary">
                  Refreshing...
                </div>
              ) : null}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr,1fr]">
              <label className="block">
                <span className="text-sm font-medium text-white">Search</span>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search client, contact, email, or project"
                  className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                />
              </label>
              <div>
                <span className="text-sm font-medium text-white">A-Z</span>
                <div className="mt-3 flex flex-wrap gap-2">
                  {alphabet.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setAlphabetFilter(item)}
                      className={`rounded-xl border px-3 py-2 text-xs font-medium ${
                        alphabetFilter === item
                          ? "border-[rgba(81,208,176,0.35)] bg-[rgba(81,208,176,0.14)] text-white"
                          : "border-[rgba(255,255,255,0.08)] bg-[#0b1126] text-text-secondary"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {loading ? (
            <div className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-background-card p-8 text-text-secondary">
              Loading clients...
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[rgba(255,255,255,0.12)] bg-background-card p-8 text-text-secondary">
              No clients match this search yet.
            </div>
          ) : (
            <>
              <section className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-background-card p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      Active Clients
                    </h2>
                    <p className="mt-2 text-sm text-text-secondary">
                      Clients with linked projects stay at the top so current
                      work is always easier to reach.
                    </p>
                  </div>
                  <div className="rounded-full bg-[rgba(255,255,255,0.06)] px-4 py-2 text-xs font-medium text-text-secondary">
                    {activeClients.length} active
                  </div>
                </div>

                {activeClients.length === 0 ? (
                  <div className="mt-5 rounded-2xl border border-dashed border-[rgba(255,255,255,0.12)] px-5 py-5 text-sm text-text-secondary">
                    No active clients match the current search or filter.
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {activeClients.map(renderClientRow)}
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-background-card p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      Other Clients
                    </h2>
                    <p className="mt-2 text-sm text-text-secondary">
                      The rest of the directory stays lighter and alphabetised
                      so it does not drown the active work.
                    </p>
                  </div>
                  <div className="rounded-full bg-[rgba(255,255,255,0.06)] px-4 py-2 text-xs font-medium text-text-secondary">
                    {otherClients.length} clients
                  </div>
                </div>

                {otherClients.length === 0 ? (
                  <div className="mt-5 rounded-2xl border border-dashed border-[rgba(255,255,255,0.12)] px-5 py-5 text-sm text-text-secondary">
                    No other clients match the current search or filter.
                  </div>
                ) : (
                  <div className="mt-6 space-y-8">
                    {otherClientInitials.map((initial) => (
                      <div key={initial}>
                        <div className="mb-3 flex items-center gap-3">
                          <div className="rounded-full bg-[rgba(255,255,255,0.06)] px-3 py-1 text-xs font-semibold text-white">
                            {initial}
                          </div>
                          <div className="h-px flex-1 bg-[rgba(255,255,255,0.08)]" />
                        </div>
                        <div className="space-y-4">
                          {groupedOtherClients[initial].map(renderClientRow)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
