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
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  accessTokenLastUsedAt: string | null;
  accessLinkPath: string | null;
  portalAccessEnabled: boolean;
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
  const [justAdded, setJustAdded] = useState<Contributor | null>(null);
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
      // Surface the contributor link banner immediately after add so
      // the champion can copy it before the page is reloaded.
      if (data.contributor) {
        setJustAdded(data.contributor as Contributor);
      }
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
        <p className="text-sm text-text-2">
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
        <p className="rounded-[14px] border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {justAdded ? (
        <JustAddedBanner
          contributor={justAdded}
          onDismiss={() => setJustAdded(null)}
        />
      ) : null}

      {showForm ? (
        <div className="space-y-3 rounded-[14px] border border-ink-4 bg-ink-1 p-4">
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
          <p className="text-[11px] leading-relaxed text-text-2">
            We&apos;ll generate a private link for this person so they can
            answer their assigned questions without needing a portal account.
            You&apos;ll see the link right after you add them.
          </p>
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
        <p className="text-sm text-text-2">Loading…</p>
      ) : contributors.length === 0 ? (
        <p className="text-sm text-text-2">
          No contributors yet. Add the first one above.
        </p>
      ) : (
        <ul className="space-y-2">
          {contributors.map((contrib) => (
            <li
              key={contrib.id}
              className="rounded-[14px] border border-ink-4 bg-ink-1 p-3"
            >
              <p className="text-sm font-semibold text-white">
                {contrib.contact?.firstName} {contrib.contact?.lastName}
              </p>
              <p className="text-xs text-text-2">
                {contrib.role.replace(/_/g, " ")}
                {contrib.contact?.email ? ` · ${contrib.contact.email}` : ""}
                {contrib.contact?.title ? ` · ${contrib.contact.title}` : ""}
                {contrib.organisation ? ` · ${contrib.organisation}` : ""}
              </p>
              {contrib.notes ? (
                <p className="mt-1 text-xs text-text-2">
                  {contrib.notes}
                </p>
              ) : null}
              <p className="mt-1 text-[11px] text-text-2">
                {contrib.createdByType === "client_champion"
                  ? "Added by you"
                  : "Added by delivery team"}
                {contrib.approvalStatus === "pending_review"
                  ? " · pending review"
                  : ""}
              </p>
              {!contrib.portalAccessEnabled ? (
                <ContributorLinkRow
                  projectId={projectId}
                  contributor={contrib}
                  onUpdated={(next) => {
                    setContributors((prev) =>
                      prev
                        ? prev.map((c) => (c.id === next.id ? next : c))
                        : prev
                    );
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChampionExpiryRow({
  contributor,
  busy,
  patch
}: {
  contributor: Contributor;
  busy: boolean;
  patch: (body: Record<string, unknown>) => Promise<void>;
}) {
  const expiryDateValue = contributor.accessTokenExpiresAt
    ? new Date(contributor.accessTokenExpiresAt).toISOString().slice(0, 10)
    : "";
  const lastUsed = contributor.accessTokenLastUsedAt
    ? new Date(contributor.accessTokenLastUsedAt)
    : null;
  const isExpired =
    contributor.accessTokenExpiresAt &&
    new Date(contributor.accessTokenExpiresAt).getTime() < Date.now();

  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px] text-text-2">
      <label className="flex items-center gap-1.5">
        <span className="uppercase tracking-wide">Expires</span>
        <input
          type="date"
          value={expiryDateValue}
          disabled={busy}
          onChange={(e) =>
            void patch({ accessTokenExpiresAt: e.target.value || null })
          }
          className="brand-input rounded-md border px-1.5 py-0.5 text-[10px]"
        />
      </label>
      {expiryDateValue ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void patch({ accessTokenExpiresAt: null })}
          className="hover:text-white disabled:opacity-50"
        >
          Clear
        </button>
      ) : (
        <span>Never expires</span>
      )}
      {isExpired ? (
        <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-1.5 py-0.5 text-rose-300">
          Expired
        </span>
      ) : null}
      <span className="ml-auto">
        {lastUsed
          ? `Last opened ${lastUsed.toLocaleDateString()}`
          : "Never opened"}
      </span>
    </div>
  );
}

function ContributorLinkRow({
  projectId,
  contributor,
  onUpdated
}: {
  projectId: string;
  contributor: Contributor;
  onUpdated: (next: Contributor) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const path = contributor.accessLinkPath;
  const absolute =
    path && typeof window !== "undefined"
      ? `${window.location.origin}${path}`
      : path;

  async function copy() {
    if (!absolute) return;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard may be denied — user can copy the visible text manually.
    }
  }

  // Slice 3: champion-side regen / revoke. Goes through the dedicated
  // PATCH /api/client/projects/:projectId/contributors/:contributorId
  // route which whitelists only the token flags.
  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/client/projects/${encodeURIComponent(projectId)}/contributors/${encodeURIComponent(contributor.id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      if (data.contributor) {
        onUpdated(data.contributor as Contributor);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (!absolute) {
    return (
      <div className="mt-2 space-y-1.5 rounded-lg border border-white/5 bg-black/20 px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-text-2">
            Private link
          </span>
          <span className="text-[10px] text-text-2">Not issued</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void patch({ regenerateAccessToken: true })}
            className="ml-auto brand-primary rounded-full px-2 py-0.5 text-[10px] disabled:opacity-50"
          >
            Generate
          </button>
        </div>
        {error ? <p className="text-[10px] text-rose-300">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-1.5 rounded-lg border border-white/5 bg-black/20 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-text-2">
          Private link
        </span>
        <code className="min-w-0 flex-1 truncate text-[11px] text-white">
          {absolute}
        </code>
        <button
          type="button"
          onClick={copy}
          className="rounded-full border border-ink-4 px-2 py-0.5 text-[10px] text-white hover:border-ink-5"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {/* Slice 6 + 7: champions get the same expiry / lastUsed view
          their delivery counterpart sees, so they can self-serve link
          rotation without operator intervention. */}
      <ChampionExpiryRow
        contributor={contributor}
        busy={busy}
        patch={patch}
      />
      <div className="flex flex-wrap items-center gap-3 text-[10px]">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (
              !confirm(
                "Generate a new link? The old link will stop working immediately."
              )
            ) {
              return;
            }
            void patch({ regenerateAccessToken: true });
          }}
          className="text-text-2 hover:text-white disabled:opacity-50"
        >
          Regenerate
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (
              !confirm(
                "Revoke this link? The contributor will lose access immediately."
              )
            ) {
              return;
            }
            void patch({ revokeAccessToken: true });
          }}
          className="text-text-2 hover:text-rose-400 disabled:opacity-50"
        >
          Revoke
        </button>
        {error ? <span className="text-rose-300">{error}</span> : null}
      </div>
    </div>
  );
}

function JustAddedBanner({
  contributor,
  onDismiss
}: {
  contributor: Contributor;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const absolute =
    contributor.accessLinkPath && typeof window !== "undefined"
      ? `${window.location.origin}${contributor.accessLinkPath}`
      : contributor.accessLinkPath;

  async function copy() {
    if (!absolute) return;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard denial
    }
  }

  if (!absolute) {
    return null;
  }

  return (
    <div className="rounded-[14px] border border-emerald-500/30 bg-emerald-500/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            ✓ {contributor.contact?.firstName} added
          </p>
          <p className="mt-0.5 text-xs text-emerald-200">
            Share this private link with them — they can answer their
            assigned questions without needing a portal account.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-ink-4 bg-black/30 px-2 py-1.5 text-[11px] text-white">
              {absolute}
            </code>
            <button
              type="button"
              onClick={copy}
              className="brand-primary rounded-full px-3 py-1 text-[11px]"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-text-2 hover:text-white"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
