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

interface ClientRecord {
  id: string;
  name: string;
  slug: string;
  industry?: string | null;
  region?: string | null;
  website?: string | null;
  logoUrl?: string | null;
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
  industry: string;
  region: string;
}

interface PortalInviteDraft {
  projectIds: string[];
  questionnaireAccess: boolean;
  sendEmail: boolean;
}

const alphabet = ["All", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];

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
    industry: client.industry ?? "",
    region: client.region ?? ""
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
        ? contact.portalAssignments.every((assignment) => assignment.questionnaireAccess)
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
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "CL";
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
    client.contacts.find((contact) => contact.canApproveQuotes) ?? client.contacts[0] ?? null
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
    industry: "",
    region: ""
  };
}

export default function ClientsWorkspace() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [creatingClient, setCreatingClient] = useState(false);
  const [savingContactForClient, setSavingContactForClient] = useState<string | null>(
    null
  );
  const [savingProfileForClient, setSavingProfileForClient] = useState<string | null>(
    null
  );
  const [updatingContactId, setUpdatingContactId] = useState<string | null>(null);
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);
  const [confirmingDeleteClientId, setConfirmingDeleteClientId] = useState<string | null>(
    null
  );
  const [expandedClientIds, setExpandedClientIds] = useState<string[]>([]);
  const [showingContactFormIds, setShowingContactFormIds] = useState<string[]>([]);
  const [showingPortalInviteIds, setShowingPortalInviteIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [alphabetFilter, setAlphabetFilter] = useState("All");
  const [clientDraft, setClientDraft] = useState({
    name: "",
    website: "",
    logoUrl: "",
    industry: "",
    region: ""
  });
  const [contactDrafts, setContactDrafts] = useState<Record<string, ContactDraft>>(
    {}
  );
  const [profileDrafts, setProfileDrafts] = useState<
    Record<string, ClientProfileDraft>
  >({});
  const [portalInviteDrafts, setPortalInviteDrafts] = useState<
    Record<string, PortalInviteDraft>
  >({});
  const [invitingContactId, setInvitingContactId] = useState<string | null>(null);

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
        loadError instanceof Error ? loadError.message : "Failed to load clients"
      );
    } finally {
      if (options?.background) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void refreshClients();
  }, []);

  const totalProjects = clients.reduce(
    (total, client) => total + client.projects.length,
    0
  );
  const totalContacts = clients.reduce(
    (total, client) => total + client.contacts.length,
    0
  );
  const activeClientCount = clients.filter((client) => client.projects.length > 0).length;

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
  const otherClients = filteredClients.filter((client) => client.projects.length === 0);
  const groupedOtherClients = groupClientsByInitial(otherClients);
  const otherClientInitials = Object.keys(groupedOtherClients).sort();

  function getProfileDraftForClient(clientId: string) {
    const existingDraft = profileDrafts[clientId];

    if (existingDraft) {
      return existingDraft;
    }

    const client = clients.find((item) => item.id === clientId);
    return client ? createClientProfileDraft(client) : createFallbackClientProfileDraft();
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
    value: string
  ) {
    setProfileDrafts((currentDrafts) => ({
      ...currentDrafts,
      [clientId]: {
        ...(currentDrafts[clientId] ?? getProfileDraftForClient(clientId)),
        [field]: value
      }
    }));
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
      [contact.id]: currentDrafts[contact.id] ?? createPortalInviteDraft(client, contact)
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
        body: JSON.stringify(clientDraft)
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to create client");
      }

      setClientDraft({
        name: "",
        website: "",
        logoUrl: "",
        industry: "",
        region: ""
      });
      setExpandedClientIds((currentIds) => [body.client.id, ...currentIds]);
      setFeedback("Client added to the workspace.");
      await refreshClients({ background: true });
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Failed to create client"
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
      const response = await fetch(`/api/clients/${encodeURIComponent(clientId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });

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
        saveError instanceof Error ? saveError.message : "Failed to update client"
      );
    } finally {
      setSavingProfileForClient(null);
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
        updateError instanceof Error ? updateError.message : "Failed to update contact"
      );
    } finally {
      setUpdatingContactId(null);
    }
  }

  async function inviteContactToProjects(client: ClientRecord, contact: ClientContact) {
    const draft = getPortalInviteDraft(client, contact);

    if (draft.projectIds.length === 0) {
      setError("Select at least one linked project before sending portal access.");
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
      setError("This client still has linked projects and cannot be deleted yet.");
      return;
    }

    setDeletingClientId(client.id);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`/api/clients/${encodeURIComponent(client.id)}`, {
        method: "DELETE"
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to delete client");
      }

      setClients((currentClients) =>
        currentClients.filter((existingClient) => existingClient.id !== client.id)
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
        deleteError instanceof Error ? deleteError.message : "Failed to delete client"
      );
    } finally {
      setDeletingClientId(null);
    }
  }

  function renderClientRow(client: ClientRecord) {
    const isExpanded = expandedClientIds.includes(client.id);
    const showContactForm = showingContactFormIds.includes(client.id);
    const recommendedContact = getPrimaryContact(client);
    const profileDraft = profileDrafts[client.id] ?? createClientProfileDraft(client);
    const contactDraft = contactDrafts[client.id] ?? createEmptyContactDraft();
    const logoUrl = deriveClientLogoUrl(client);
    const websiteHost = getWebsiteHost(client.website);
    const canDeleteClient = client.projects.length === 0;
    const isConfirmingDelete = confirmingDeleteClientId === client.id;
    const isDeleting = deletingClientId === client.id;

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
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                <span>{websiteHost || client.region || "No website yet"}</span>
                <span>{client.contacts.length} contacts</span>
                <span>{client.projects.length} linked projects</span>
                <span>Updated {formatDate(getClientLastActivity(client))}</span>
              </div>

              <div className="mt-2 flex flex-wrap gap-2 text-xs text-text-muted">
                {recommendedContact ? (
                  <span>
                    Primary: {[recommendedContact.firstName, recommendedContact.lastName]
                      .filter(Boolean)
                      .join(" ")}{" "}
                    · {recommendedContact.email}
                  </span>
                ) : (
                  <span>No contacts linked yet</span>
                )}
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
                      Manual logo URL overrides the domain-based icon. Projects
                      auto-link when client contacts match portal or champion emails.
                    </p>
                    {!canDeleteClient ? (
                      <p className="mt-3 text-xs text-text-muted">
                        Delete is only available once this client has no linked projects.
                      </p>
                    ) : null}
                  </div>
                </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-medium text-white">Client name</span>
                      <input
                        value={profileDraft.name}
                        onChange={(event) =>
                          updateProfileDraft(client.id, "name", event.target.value)
                        }
                        className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-white">Website</span>
                      <input
                        value={profileDraft.website}
                        onChange={(event) =>
                          updateProfileDraft(client.id, "website", event.target.value)
                        }
                        placeholder="client.com"
                        className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="text-sm font-medium text-white">Logo URL</span>
                      <input
                        value={profileDraft.logoUrl}
                        onChange={(event) =>
                          updateProfileDraft(client.id, "logoUrl", event.target.value)
                        }
                        placeholder="https://..."
                        className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-white">Industry</span>
                      <input
                        value={profileDraft.industry}
                        onChange={(event) =>
                          updateProfileDraft(client.id, "industry", event.target.value)
                        }
                        className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-white">Region</span>
                      <input
                        value={profileDraft.region}
                        onChange={(event) =>
                          updateProfileDraft(client.id, "region", event.target.value)
                        }
                        className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
                      />
                    </label>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-xs text-text-muted">
                        We’ll use the website or first contact domain for a logo when no
                        manual URL is set.
                      </p>
                      {canDeleteClient ? (
                        <p className="text-xs text-[#ff8f9c]">
                          This client has no linked projects, so it can be removed if it is junk or old test data.
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
                        disabled={savingProfileForClient === client.id || isDeleting}
                        className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                      >
                        {savingProfileForClient === client.id ? "Saving..." : "Save client"}
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
                        Keep the approver and key stakeholders here, then pull them
                        straight into projects and portal access.
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
                        const showPortalInvite = showingPortalInviteIds.includes(contact.id);
                        const portalInviteDraft = getPortalInviteDraft(client, contact);

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
                                      {contact.portalAssignments.length} portal project
                                      {contact.portalAssignments.length === 1 ? "" : "s"}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => void toggleApprover(client.id, contact)}
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
                                  onClick={() => togglePortalInvite(client, contact)}
                                  className="rounded-xl border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs font-medium text-white"
                                >
                                  {showPortalInvite ? "Hide portal access" : "Portal access"}
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
                                      Choose which linked projects this contact should see,
                                      whether they need to complete the active project
                                      inputs, and send the onboarding email in one step.
                                    </p>
                                  </div>
                                  <div className="rounded-full bg-[rgba(255,255,255,0.06)] px-3 py-2 text-[11px] font-medium text-text-secondary">
                                    Role: {contact.canApproveQuotes ? "Approver" : "Contributor"}
                                  </div>
                                </div>

                                <div className="mt-4 space-y-3">
                                  {client.projects.length > 0 ? (
                                    client.projects.map((project) => {
                                      const existingAssignment =
                                        contact.portalAssignments.find(
                                          (assignment) => assignment.projectId === project.id
                                        ) ?? null;
                                      const isSelected = portalInviteDraft.projectIds.includes(
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
                                                    projectIds: event.target.checked
                                                      ? Array.from(
                                                          new Set([
                                                            ...currentDraft.projectIds,
                                                            project.id
                                                          ])
                                                        )
                                                      : currentDraft.projectIds.filter(
                                                          (projectId) =>
                                                            projectId !== project.id
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
                                                {project.scopeType.replace(/_/g, " ")} ·{" "}
                                                {project.quoteApprovalStatus}
                                              </p>
                                            </div>
                                          </div>
                                          {existingAssignment ? (
                                            <div className="text-right text-xs text-text-secondary">
                                              <p>
                                                {existingAssignment.authStatus === "active"
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
                                      This client does not have any linked projects yet.
                                    </div>
                                  )}
                                </div>

                                <div className="mt-4 grid gap-3 md:grid-cols-2">
                                  <label className="flex items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-4 text-sm text-white">
                                    <input
                                      type="checkbox"
                                      checked={portalInviteDraft.questionnaireAccess}
                                      onChange={(event) =>
                                        updatePortalInviteDraft(contact.id, (currentDraft) => ({
                                          ...currentDraft,
                                          questionnaireAccess: event.target.checked
                                        }))
                                      }
                                    />
                                    This contact should complete project inputs
                                  </label>
                                  <label className="flex items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-4 text-sm text-white">
                                    <input
                                      type="checkbox"
                                      checked={portalInviteDraft.sendEmail}
                                      onChange={(event) =>
                                        updatePortalInviteDraft(contact.id, (currentDraft) => ({
                                          ...currentDraft,
                                          sendEmail: event.target.checked
                                        }))
                                      }
                                    />
                                    Send the Muloo onboarding email now
                                  </label>
                                </div>

                                <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-4 text-sm text-text-secondary">
                                  The onboarding email explains the portal, required next
                                  step, and that project inputs save automatically so the
                                  client can stop and resume later.
                                </div>

                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                  <p className="text-sm text-text-secondary">
                                    {portalInviteDraft.projectIds.length} project
                                    {portalInviteDraft.projectIds.length === 1 ? "" : "s"} selected
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => void inviteContactToProjects(client, contact)}
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
                          <span className="text-sm font-medium text-white">First name</span>
                          <input
                            value={contactDraft.firstName}
                            onChange={(event) =>
                              updateContactDraft(client.id, "firstName", event.target.value)
                            }
                            className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                          />
                        </label>
                        <label className="block">
                          <span className="text-sm font-medium text-white">Last name</span>
                          <input
                            value={contactDraft.lastName}
                            onChange={(event) =>
                              updateContactDraft(client.id, "lastName", event.target.value)
                            }
                            className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                          />
                        </label>
                        <label className="block">
                          <span className="text-sm font-medium text-white">Email</span>
                          <input
                            value={contactDraft.email}
                            onChange={(event) =>
                              updateContactDraft(client.id, "email", event.target.value)
                            }
                            className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                          />
                        </label>
                        <label className="block">
                          <span className="text-sm font-medium text-white">Title / role</span>
                          <input
                            value={contactDraft.title}
                            onChange={(event) =>
                              updateContactDraft(client.id, "title", event.target.value)
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
                          {savingContactForClient === client.id ? "Saving..." : "Add contact"}
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
                      We pull projects in from the direct client link plus any matching
                      contact emails already used in portal access or client champion fields.
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
                              {project.scopeType.replace(/_/g, " ")} · {project.status}
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
                  A tighter CRM-lite directory: active clients first, fast search,
                  expandable company records, linked contacts, and linked projects
                  without turning this into a full CRM.
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
                <h2 className="text-xl font-semibold text-white">Add client company</h2>
                <p className="mt-2 text-sm text-text-secondary">
                  Add the company once, then keep everything else inside the client
                  record when you need it.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <label className="block">
                <span className="text-sm font-medium text-white">Client name</span>
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
                <input
                  value={clientDraft.industry}
                  onChange={(event) =>
                    setClientDraft((currentDraft) => ({
                      ...currentDraft,
                      industry: event.target.value
                    }))
                  }
                  className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-white">Region</span>
                <input
                  value={clientDraft.region}
                  onChange={(event) =>
                    setClientDraft((currentDraft) => ({
                      ...currentDraft,
                      region: event.target.value
                    }))
                  }
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
                    Search keeps the directory clean, active clients stay pinned
                    to the top, and logos can come from website, email domain, or
                    a manual brand URL.
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
                  Search by company, contact, email, or project. Use A-Z when you
                  need to jump fast through the longer tail of clients.
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
                    <h2 className="text-xl font-semibold text-white">Active Clients</h2>
                    <p className="mt-2 text-sm text-text-secondary">
                      Clients with linked projects stay at the top so current work
                      is always easier to reach.
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
                  <div className="mt-5 space-y-4">{activeClients.map(renderClientRow)}</div>
                )}
              </section>

              <section className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-background-card p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Other Clients</h2>
                    <p className="mt-2 text-sm text-text-secondary">
                      The rest of the directory stays lighter and alphabetised so it
                      does not drown the active work.
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
