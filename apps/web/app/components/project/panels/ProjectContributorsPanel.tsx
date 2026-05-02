"use client";

import { useCallback, useEffect, useState } from "react";

interface Contributor {
  id: string;
  projectId: string;
  contactId: string;
  role: string;
  portalUserId: string | null;
  relatedWorkbookIds: string[];
  relatedQuestionIds: string[];
  notes: string | null;
  portalAccess: boolean;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    title: string;
    clientId: string;
  } | null;
}

interface ContactOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  title: string | null;
}

const ROLE_OPTIONS = [
  "client_champion",
  "stakeholder",
  "decision_maker",
  "subject_matter_expert",
  "approver",
  "contributor"
];

export default function ProjectContributorsPanel(props: {
  projectId: string;
  contacts: ContactOption[];
}) {
  const [contributors, setContributors] = useState<Contributor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({
    contactId: "",
    role: "contributor",
    notes: ""
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/projects/${props.projectId}/contributors`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setContributors(data.contributors ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [props.projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addContributor() {
    if (!draft.contactId) {
      setError("Pick a contact");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${props.projectId}/contributors`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId: draft.contactId,
            role: draft.role,
            notes: draft.notes.trim() || null
          })
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed");
      }
      setDraft({ contactId: "", role: "contributor", notes: "" });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeContributor(id: string) {
    if (!confirm("Remove this contributor from the project?")) return;
    try {
      const res = await fetch(
        `/api/projects/${props.projectId}/contributors/${id}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  const usedContactIds = new Set(
    contributors?.map((contrib) => contrib.contactId) ?? []
  );
  const availableContacts = props.contacts.filter(
    (contact) => !usedContactIds.has(contact.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          External stakeholders linked to this project. Workbook completion
          flows here without portal accounts.
        </p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="brand-surface-soft rounded-full border px-3 py-1.5 text-xs uppercase tracking-wide text-white"
        >
          {showForm ? "Cancel" : "Add contributor"}
        </button>
      </div>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      {showForm ? (
        <div className="brand-surface-soft space-y-3 rounded-2xl border p-4">
          {availableContacts.length === 0 ? (
            <p className="text-xs text-text-secondary">
              All client contacts are already added. Add a new ClientContact via
              the client directory first.
            </p>
          ) : (
            <select
              value={draft.contactId}
              onChange={(e) =>
                setDraft({ ...draft, contactId: e.target.value })
              }
              className="brand-input w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">Select contact…</option>
              {availableContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.firstName} {contact.lastName} · {contact.email}
                </option>
              ))}
            </select>
          )}
          <select
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            className="brand-input w-full rounded-lg border px-3 py-2 text-sm"
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            placeholder="Notes (e.g. main client champion, owns workbook X)"
            className="brand-input w-full rounded-lg border px-3 py-2 text-sm"
            rows={2}
          />
          <button
            type="button"
            disabled={busy || !draft.contactId}
            onClick={addContributor}
            className="brand-primary rounded-full px-4 py-2 text-sm"
          >
            {busy ? "Saving…" : "Save contributor"}
          </button>
        </div>
      ) : null}

      {!contributors ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : contributors.length === 0 ? (
        <p className="text-sm text-text-secondary">No contributors yet.</p>
      ) : (
        <ul className="space-y-2">
          {contributors.map((contrib) => (
            <li
              key={contrib.id}
              className="brand-surface-soft flex flex-wrap items-baseline justify-between gap-2 rounded-2xl border p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {contrib.contact?.firstName} {contrib.contact?.lastName}
                </p>
                <p className="text-xs text-text-secondary">
                  {contrib.role.replace(/_/g, " ")}
                  {contrib.contact?.email ? ` · ${contrib.contact.email}` : ""}
                  {contrib.contact?.title ? ` · ${contrib.contact.title}` : ""}
                  {contrib.portalAccess ? " · portal access" : " · no portal"}
                </p>
                {contrib.notes ? (
                  <p className="mt-1 text-xs text-text-secondary">
                    {contrib.notes}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => removeContributor(contrib.id)}
                className="text-xs text-text-secondary hover:text-rose-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
