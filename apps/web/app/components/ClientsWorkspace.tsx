"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AppShell from "./AppShell";

interface ClientContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  canApproveQuotes: boolean;
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

function createEmptyContactDraft(): ContactDraft {
  return {
    firstName: "",
    lastName: "",
    email: "",
    title: "",
    canApproveQuotes: false
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

export default function ClientsWorkspace() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [creatingClient, setCreatingClient] = useState(false);
  const [savingContactForClient, setSavingContactForClient] = useState<string | null>(
    null
  );
  const [updatingContactId, setUpdatingContactId] = useState<string | null>(null);
  const [clientDraft, setClientDraft] = useState({
    name: "",
    website: "",
    industry: "",
    region: ""
  });
  const [contactDrafts, setContactDrafts] = useState<Record<string, ContactDraft>>(
    {}
  );

  useEffect(() => {
    async function loadClients() {
      try {
        const response = await fetch("/api/clients");

        if (!response.ok) {
          throw new Error("Failed to load clients");
        }

        const body = await response.json();
        setClients(body.clients ?? []);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load clients"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadClients();
  }, []);

  const totalProjects = clients.reduce(
    (total, client) => total + client.projects.length,
    0
  );
  const totalContacts = clients.reduce(
    (total, client) => total + client.contacts.length,
    0
  );

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

      setClients((currentClients) => [body.client, ...currentClients]);
      setClientDraft({
        name: "",
        website: "",
        industry: "",
        region: ""
      });
      setFeedback("Client added to the workspace.");
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Failed to create client"
      );
    } finally {
      setCreatingClient(false);
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

      setClients((currentClients) =>
        currentClients.map((client) =>
          client.id === clientId
            ? { ...client, contacts: [...client.contacts, body.contact] }
            : client
        )
      );
      setContactDrafts((currentDrafts) => ({
        ...currentDrafts,
        [clientId]: createEmptyContactDraft()
      }));
      setFeedback("Client contact added.");
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
                  existingContact.id === contact.id ? body.contact : existingContact
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
                  Keep companies, approvers, and project history in one place so
                  new work starts from context instead of repeated data entry.
                </p>
              </div>
              <Link
                href="/projects/new"
                className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-5 py-3 text-sm font-medium text-white"
              >
                New Project
              </Link>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                { label: "Clients", value: clients.length },
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
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Add client company
                </h2>
                <p className="mt-2 text-sm text-text-secondary">
                  Keep this lean: company details plus the people who matter for
                  visibility and approval.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                    Add the company once, then reuse it whenever a new project starts.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void createClient()}
                disabled={creatingClient}
                className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
              >
                {creatingClient ? "Saving..." : "Add Client"}
              </button>
            </div>
          </section>

          <section className="space-y-5">
            {loading ? (
              <div className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-background-card p-8 text-text-secondary">
                Loading clients...
              </div>
            ) : clients.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[rgba(255,255,255,0.12)] bg-background-card p-8 text-text-secondary">
                No clients added yet. Create your first company above.
              </div>
            ) : (
              clients.map((client) => {
                const recommendedContact =
                  client.contacts.find((contact) => contact.canApproveQuotes) ??
                  client.contacts[0];
                const contactDraft =
                  contactDrafts[client.id] ?? createEmptyContactDraft();

                return (
                  <div
                    key={client.id}
                    className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-background-card p-8"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h2 className="text-2xl font-semibold text-white">
                            {client.name}
                          </h2>
                          {client.industry ? (
                            <span className="rounded-full bg-[rgba(255,255,255,0.06)] px-3 py-1 text-xs font-medium text-text-secondary">
                              {client.industry}
                            </span>
                          ) : null}
                          {client.region ? (
                            <span className="rounded-full bg-[rgba(255,255,255,0.06)] px-3 py-1 text-xs font-medium text-text-secondary">
                              {client.region}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-3 text-sm text-text-secondary">
                          {client.website || "No website stored yet"}
                        </p>
                        <p className="mt-2 text-xs text-text-muted">
                          Updated {formatDate(client.updatedAt)}
                        </p>
                      </div>
                      <Link
                        href={buildProjectLink(client, recommendedContact)}
                        className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-5 py-3 text-sm font-medium text-white"
                      >
                        Start Project
                      </Link>
                    </div>

                    <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
                      <div className="rounded-2xl bg-[#0b1126] p-5">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                              Contacts
                            </p>
                            <p className="mt-2 text-sm text-text-secondary">
                              Keep approval contacts and observers handy for new projects.
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          {client.contacts.length > 0 ? (
                            client.contacts.map((contact) => (
                              <div
                                key={contact.id}
                                className="rounded-2xl border border-[rgba(255,255,255,0.08)] px-4 py-4"
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
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {contact.canApproveQuotes ? (
                                      <span className="rounded-full bg-[rgba(81,208,176,0.14)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#51d0b0]">
                                        Quote approver
                                      </span>
                                    ) : null}
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
                                    <Link
                                      href={buildProjectLink(client, contact)}
                                      className="rounded-xl border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs font-medium text-white"
                                    >
                                      Use in new project
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.12)] px-4 py-4 text-sm text-text-secondary">
                              No contacts added yet for this client.
                            </div>
                          )}
                        </div>

                        <div className="mt-5 grid gap-4 md:grid-cols-2">
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
                              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
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
                              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
                            />
                          </label>
                          <label className="block">
                            <span className="text-sm font-medium text-white">
                              Email
                            </span>
                            <input
                              value={contactDraft.email}
                              onChange={(event) =>
                                updateContactDraft(client.id, "email", event.target.value)
                              }
                              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
                            />
                          </label>
                          <label className="block">
                            <span className="text-sm font-medium text-white">
                              Title / role
                            </span>
                            <input
                              value={contactDraft.title}
                              onChange={(event) =>
                                updateContactDraft(client.id, "title", event.target.value)
                              }
                              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
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
                            className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                          >
                            {savingContactForClient === client.id
                              ? "Saving..."
                              : "Add Contact"}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-[#0b1126] p-5">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Projects
                        </p>
                        <p className="mt-2 text-sm text-text-secondary">
                          Current and historical work linked to this client.
                        </p>
                        <div className="mt-4 space-y-3">
                          {client.projects.length > 0 ? (
                            client.projects.map((project) => (
                              <Link
                                key={project.id}
                                href={`/projects/${project.id}`}
                                className="block rounded-2xl border border-[rgba(255,255,255,0.08)] px-4 py-4 transition hover:border-[rgba(255,255,255,0.16)]"
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
                              No projects linked yet.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
