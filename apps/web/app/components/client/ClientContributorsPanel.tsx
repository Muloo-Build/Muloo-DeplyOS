"use client";

import { useCallback, useEffect, useState } from "react";

interface Contributor {
  id: string;
  role: string;
  stakeholderType: string | null;
  organisation: string | null;
  notes: string | null;
  approvalStatus: string;
  createdByType: string;
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    title: string;
  } | null;
}

const ROLE_OPTIONS = [
  "contributor",
  "subject_matter_expert",
  "stakeholder",
  "decision_maker",
  "approver"
];

export default function ClientContributorsPanel({
  projectId
}: {
  projectId: string;
}) {
  const [contributors, setContributors] = useState<Contributor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({
    firstName: "",
    lastName: "",
    email: "",
    title: "",
    organisation: "",
    role: "contributor",
    notes: ""
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/client/projects/${encodeURIComponent(projectId)}/contributors`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      setContributors(data.contributors ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!draft.firstName.trim() || !draft.email.trim()) {
      setError("First name and email are required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/client/projects/${encodeURIComponent(projectId)}/contributors`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: draft.firstName.trim(),
            lastName: draft.lastName.trim() || null,
            email: draft.email.trim().toLowerCase(),
            title: draft.title.trim() || null,
            organisation: draft.organisation.trim() || null,
            role: draft.role,
            notes: draft.notes.trim() || null
          })
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      setDraft({
        firstName: "",
        lastName: "",
        email: "",
        title: "",
        organisation: "",
        role: "contributor",
        notes: ""
      });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Add colleagues who should help complete the workbooks. They will
          appear here for the delivery team to confirm.
        </p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="brand-surface-soft rounded-full border px-3 py-1.5 text-xs uppercase tracking-wide text-white"
        >
          {showForm ? "Cancel" : "Add contributor"}
        </button>
      </div>

      {error ? (
        <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {showForm ? (
        <div className="space-y-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={draft.firstName}
              onChange={(e) =>
                setDraft({ ...draft, firstName: e.target.value })
              }
              placeholder="First name *"
              className="brand-input rounded-lg border px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={draft.lastName}
              onChange={(e) =>
                setDraft({ ...draft, lastName: e.target.value })
              }
              placeholder="Last name"
              className="brand-input rounded-lg border px-3 py-2 text-sm"
            />
            <input
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              placeholder="Email *"
              className="brand-input rounded-lg border px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Job title"
              className="brand-input rounded-lg border px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={draft.organisation}
              onChange={(e) =>
                setDraft({ ...draft, organisation: e.target.value })
              }
              placeholder="Organisation (optional)"
              className="brand-input rounded-lg border px-3 py-2 text-sm"
            />
            <select
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value })}
              className="brand-input rounded-lg border px-3 py-2 text-sm"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            placeholder="What will this person help with?"
            rows={2}
            className="brand-input w-full rounded-lg border px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={add}
            className="brand-primary rounded-full px-4 py-2 text-sm disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add contributor"}
          </button>
        </div>
      ) : null}

      {!contributors ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : contributors.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No contributors yet. Add the first one above.
        </p>
      ) : (
        <ul className="space-y-2">
          {contributors.map((contrib) => (
            <li
              key={contrib.id}
              className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-background-card p-3"
            >
              <p className="text-sm font-semibold text-white">
                {contrib.contact?.firstName} {contrib.contact?.lastName}
              </p>
              <p className="text-xs text-text-secondary">
                {contrib.role.replace(/_/g, " ")}
                {contrib.contact?.email ? ` · ${contrib.contact.email}` : ""}
                {contrib.contact?.title ? ` · ${contrib.contact.title}` : ""}
                {contrib.organisation ? ` · ${contrib.organisation}` : ""}
              </p>
              {contrib.notes ? (
                <p className="mt-1 text-xs text-text-secondary">
                  {contrib.notes}
                </p>
              ) : null}
              <p className="mt-1 text-[11px] text-text-secondary">
                {contrib.createdByType === "client_champion"
                  ? "Added by you"
                  : "Added by delivery team"}
                {contrib.approvalStatus === "pending_review"
                  ? " · pending review"
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
