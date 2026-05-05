"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface Contributor {
  id: string;
  projectId: string;
  contactId: string;
  role: string;
  portalUserId: string | null;
  portalAccessEnabled: boolean;
  canSubmitWorkbookResponses: boolean;
  relatedWorkbookIds: string[];
  relatedQuestionIds: string[];
  notes: string | null;
  approvalStatus: string;
  portalAccess: boolean;
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  accessTokenLastUsedAt: string | null;
  accessLinkPath: string | null;
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

interface WorkbookOption {
  id: string;
  sourceLabel: string;
  resourceType: string | null;
}

const ROLE_OPTIONS = [
  "client_champion",
  "stakeholder",
  "decision_maker",
  "subject_matter_expert",
  "approver",
  "contributor"
];

const ROLE_LABEL: Record<string, string> = {
  client_champion: "Client champion",
  stakeholder: "Stakeholder",
  decision_maker: "Decision maker",
  subject_matter_expert: "Subject matter expert",
  approver: "Approver",
  contributor: "Contributor"
};

const APPROVAL_BADGE: Record<string, { label: string; className: string }> = {
  approved: {
    label: "Active",
    className: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
  },
  pending_review: {
    label: "Pending review",
    className: "border-amber-400/30 bg-amber-500/10 text-amber-300"
  },
  rejected: {
    label: "Rejected",
    className: "border-rose-400/30 bg-rose-500/10 text-rose-300"
  }
};

export default function ProjectContributorsPanel(props: {
  projectId: string;
  contacts: ContactOption[];
}) {
  const [contributors, setContributors] = useState<Contributor[] | null>(null);
  const [workbooks, setWorkbooks] = useState<WorkbookOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const router = useRouter();
  const [draft, setDraft] = useState({
    contactId: "",
    role: "contributor",
    notes: ""
  });

  // Mirror the /reports + ReportPackInstaller pattern: a 401 from any
  // operator-side fetch means the session cookie has expired, so route
  // back to /login rather than rendering a misleading "Failed" banner.
  const handleSessionExpiry = useCallback(
    (res: Response): boolean => {
      if (res.status === 401) {
        router.replace("/login");
        return true;
      }
      return false;
    },
    [router]
  );

  const load = useCallback(async () => {
    try {
      const [contribRes, wbRes] = await Promise.all([
        fetch(`/api/projects/${props.projectId}/contributors`, {
          credentials: "include"
        }),
        fetch(`/api/projects/${props.projectId}/workbooks`, {
          credentials: "include"
        })
      ]);
      if (handleSessionExpiry(contribRes) || handleSessionExpiry(wbRes)) return;
      const contribData = await contribRes.json();
      const wbData = await wbRes.json();
      if (contribData.error) {
        setError(contribData.error);
      } else {
        setContributors(contribData.contributors ?? []);
      }
      const allWorkbooks = (wbData.workbooks ?? []) as WorkbookOption[];
      setWorkbooks(
        allWorkbooks.filter(
          (wb) => wb.resourceType === "internal_workbook" || wb.resourceType === null
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [props.projectId, handleSessionExpiry]);

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
      if (handleSessionExpiry(res)) return;
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

  async function patchContributor(
    id: string,
    body: Record<string, unknown>
  ) {
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${props.projectId}/contributors/${id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }
      );
      if (handleSessionExpiry(res)) return;
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSavingId(null);
    }
  }

  // Slice 4: dedicated promote action so the previous champion (if any)
  // is demoted in the same transaction. Uses the explicit promote
  // sub-route, not a role-edit, so the single-champion invariant holds.
  async function promoteToChampion(id: string) {
    const current = contributors?.find(
      (c) => c.role === "client_champion" && c.approvalStatus === "approved"
    );
    const message = current
      ? `Promote this contributor to champion? ${current.contact?.firstName ?? "The current champion"} will be demoted to plain contributor.`
      : "Promote this contributor to project champion?";
    if (!confirm(message)) return;
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${props.projectId}/contributors/${id}/promote-champion`,
        { method: "POST", credentials: "include" }
      );
      if (handleSessionExpiry(res)) return;
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSavingId(null);
    }
  }

  async function removeContributor(id: string) {
    if (!confirm("Remove this contributor from the project?")) return;
    try {
      const res = await fetch(
        `/api/projects/${props.projectId}/contributors/${id}`,
        { method: "DELETE", credentials: "include" }
      );
      if (handleSessionExpiry(res)) return;
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  function toggleAssignedWorkbook(contrib: Contributor, workbookId: string) {
    const set = new Set(contrib.relatedWorkbookIds);
    if (set.has(workbookId)) set.delete(workbookId);
    else set.add(workbookId);
    void patchContributor(contrib.id, {
      relatedWorkbookIds: Array.from(set)
    });
  }

  const usedContactIds = useMemo(
    () => new Set(contributors?.map((c) => c.contactId) ?? []),
    [contributors]
  );
  const availableContacts = props.contacts.filter(
    (contact) => !usedContactIds.has(contact.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-2">
          External stakeholders linked to this project. Assign workbooks below
          so each person sees only what they need to fill in.
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

      {contributors && contributors.length > 0 && !contributors.some(
        (c) => c.role === "client_champion" && c.approvalStatus === "approved"
      ) ? (
        <div className="rounded-[14px] border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-sm font-medium text-amber-200">
            No project champion designated
          </p>
          <p className="mt-0.5 text-xs text-amber-200/80">
            Promote one approved contributor to champion so they can manage
            other contributors and approve workbook submissions on the
            client side.
          </p>
        </div>
      ) : null}

      {showForm ? (
        <div className="brand-surface-soft space-y-3 rounded-[14px] border p-4">
          {availableContacts.length === 0 ? (
            <p className="text-xs text-text-2">
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
                {ROLE_LABEL[role] ?? role.replace(/_/g, " ")}
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
        <p className="text-sm text-text-2">Loading…</p>
      ) : contributors.length === 0 ? (
        <div className="brand-surface rounded-[14px] border border-dashed border-ink-4 p-6 text-center">
          <p className="text-sm font-medium text-white">No contributors yet</p>
          <p className="mt-1 text-xs text-text-2">
            Add project contributors who can answer specific workbook questions
            without needing full client portal access.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {contributors.map((contrib) => {
            const isExpanded = editingId === contrib.id;
            const approval =
              APPROVAL_BADGE[contrib.approvalStatus] ?? APPROVAL_BADGE.approved;
            const isChampion = contrib.role === "client_champion";
            return (
              <li
                key={contrib.id}
                className="brand-surface-soft rounded-[14px] border p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-white">
                        {contrib.contact?.firstName} {contrib.contact?.lastName}
                      </p>
                      {isChampion ? (
                        <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-300">
                          Champion
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${approval.className}`}
                      >
                        {approval.label}
                      </span>
                      {contrib.portalAccessEnabled ? (
                        <span className="rounded-full border border-brand-teal/30 bg-brand-teal/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-teal">
                          Portal access
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-text-2">
                      {ROLE_LABEL[contrib.role] ??
                        contrib.role.replace(/_/g, " ")}
                      {contrib.contact?.email
                        ? ` · ${contrib.contact.email}`
                        : ""}
                      {contrib.contact?.title
                        ? ` · ${contrib.contact.title}`
                        : ""}
                    </p>
                    {contrib.relatedWorkbookIds.length > 0 ? (
                      <p className="mt-1 text-xs text-text-2">
                        Assigned to {contrib.relatedWorkbookIds.length} workbook
                        {contrib.relatedWorkbookIds.length === 1 ? "" : "s"}
                      </p>
                    ) : null}
                    {contrib.notes ? (
                      <p className="mt-1 text-xs text-text-2">
                        {contrib.notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!isChampion ? (
                      <button
                        type="button"
                        disabled={savingId === contrib.id}
                        onClick={() => promoteToChampion(contrib.id)}
                        className="text-xs text-blue-300 hover:text-blue-200 disabled:opacity-50"
                      >
                        Make champion
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        setEditingId(isExpanded ? null : contrib.id)
                      }
                      className="text-xs text-text-2 hover:text-white"
                    >
                      {isExpanded ? "Close" : "Manage"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeContributor(contrib.id)}
                      className="text-xs text-text-2 hover:text-rose-400"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {isExpanded ? (
                  <div className="mt-3 space-y-3 border-t border-white/5 pt-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs text-text-2">
                        <span className="mb-1 block">Role</span>
                        <select
                          value={contrib.role}
                          disabled={savingId === contrib.id}
                          onChange={(e) =>
                            void patchContributor(contrib.id, {
                              role: e.target.value
                            })
                          }
                          className="brand-input w-full rounded-lg border px-2 py-1.5 text-sm"
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABEL[role] ?? role.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs text-text-2">
                        <span className="mb-1 block">Status</span>
                        <select
                          value={contrib.approvalStatus}
                          disabled={savingId === contrib.id}
                          onChange={(e) =>
                            void patchContributor(contrib.id, {
                              approvalStatus: e.target.value
                            })
                          }
                          className="brand-input w-full rounded-lg border px-2 py-1.5 text-sm"
                        >
                          <option value="approved">Active</option>
                          <option value="pending_review">Pending review</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </label>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <label className="flex items-center gap-2 text-xs text-text-2">
                        <input
                          type="checkbox"
                          checked={contrib.portalAccessEnabled}
                          disabled={savingId === contrib.id}
                          onChange={(e) =>
                            void patchContributor(contrib.id, {
                              portalAccessEnabled: e.target.checked
                            })
                          }
                          className="accent-brand-teal"
                        />
                        Portal access enabled
                      </label>
                      <label className="flex items-center gap-2 text-xs text-text-2">
                        <input
                          type="checkbox"
                          checked={contrib.canSubmitWorkbookResponses}
                          disabled={savingId === contrib.id}
                          onChange={(e) =>
                            void patchContributor(contrib.id, {
                              canSubmitWorkbookResponses: e.target.checked
                            })
                          }
                          className="accent-brand-teal"
                        />
                        Can submit workbook responses
                      </label>
                    </div>

                    <ContributorAccessLink
                      contributor={contrib}
                      busy={savingId === contrib.id}
                      onPatch={(body) => patchContributor(contrib.id, body)}
                    />

                    <div>
                      <p className="mb-1.5 text-xs font-medium text-text-2">
                        Assigned workbooks
                      </p>
                      {workbooks.length === 0 ? (
                        <p className="text-xs text-text-3">
                          No workbooks yet — create one on the Discovery tab.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {workbooks.map((wb) => {
                            const assigned =
                              contrib.relatedWorkbookIds.includes(wb.id);
                            return (
                              <button
                                key={wb.id}
                                type="button"
                                disabled={savingId === contrib.id}
                                onClick={() =>
                                  toggleAssignedWorkbook(contrib, wb.id)
                                }
                                className={`rounded-full border px-2.5 py-1 text-[11px] transition disabled:opacity-50 ${
                                  assigned
                                    ? "border-brand-teal/50 bg-brand-teal/10 text-brand-teal"
                                    : "border-ink-4 text-text-2 hover:border-ink-5 hover:text-white"
                                }`}
                              >
                                {assigned ? "✓ " : "+ "}
                                {wb.sourceLabel}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs text-text-2">
                        <span className="mb-1 block">Notes</span>
                        <textarea
                          defaultValue={contrib.notes ?? ""}
                          disabled={savingId === contrib.id}
                          onBlur={(e) => {
                            const next = e.target.value.trim() || null;
                            if (next !== contrib.notes) {
                              void patchContributor(contrib.id, {
                                notes: next
                              });
                            }
                          }}
                          rows={2}
                          placeholder="Notes about this contributor"
                          className="brand-input w-full rounded-lg border px-2 py-1.5 text-sm"
                        />
                      </label>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ContributorAccessLink({
  contributor,
  busy,
  onPatch
}: {
  contributor: Contributor;
  busy: boolean;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle"
  );

  const absoluteLink =
    contributor.accessLinkPath && typeof window !== "undefined"
      ? `${window.location.origin}${contributor.accessLinkPath}`
      : contributor.accessLinkPath;

  async function copyLink() {
    if (!absoluteLink) return;
    // Prefer the async Clipboard API; fall back to a hidden textarea
    // + execCommand("copy") which still works in non-secure or
    // permission-restricted contexts. If both fail, surface a clear
    // hint so the operator knows to select the link text manually.
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absoluteLink);
        setCopyState("copied");
        setTimeout(() => setCopyState("idle"), 1800);
        return;
      }
      throw new Error("Clipboard API unavailable");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = absoluteLink;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("execCommand copy failed");
        setCopyState("copied");
        setTimeout(() => setCopyState("idle"), 1800);
      } catch {
        setCopyState("failed");
        setTimeout(() => setCopyState("idle"), 4000);
      }
    }
  }

  if (contributor.portalAccessEnabled) {
    return (
      <div className="rounded-xl border border-white/5 bg-black/20 p-3 text-xs text-text-2">
        This contributor signs in via the client portal — no link required.
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-white/5 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-text-2">
          Contributor link
        </p>
        {contributor.accessToken ? (
          <span className="text-[10px] text-emerald-300">Active</span>
        ) : (
          <span className="text-[10px] text-text-2">Not issued</span>
        )}
      </div>

      {contributor.accessToken && absoluteLink ? (
        <>
          <p className="text-[11px] leading-relaxed text-text-2">
            Share this link directly with{" "}
            <span className="text-white">
              {contributor.contact?.firstName ?? "the contributor"}
            </span>
            . They can open it and answer their assigned questions without
            logging in.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code
              onClick={(e) => {
                // Make the link easy to grab manually if copy is blocked.
                const range = document.createRange();
                range.selectNodeContents(e.currentTarget);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
              }}
              className="min-w-0 flex-1 cursor-text truncate rounded-lg border border-ink-4 bg-black/40 px-2 py-1.5 text-[11px] text-white"
            >
              {absoluteLink}
            </code>
            <button
              type="button"
              onClick={copyLink}
              className="brand-surface-soft rounded-full border px-3 py-1 text-[11px] text-white"
            >
              {copyState === "copied"
                ? "Copied"
                : copyState === "failed"
                  ? "Select & copy"
                  : "Copy"}
            </button>
          </div>
          {copyState === "failed" ? (
            <p className="text-[10px] text-amber-300">
              Couldn&apos;t copy automatically — click the link above to
              highlight it, then press {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+C.
            </p>
          ) : null}
          {/* Slice 6 + 7: expiry control + audit row. Expiry is sent
              as a YYYY-MM-DD string and parsed server-side. lastUsedAt
              gives the operator a cheap sanity check that the link
              actually reached its recipient. */}
          <ContributorAccessExpiryRow
            contributor={contributor}
            busy={busy}
            onPatch={onPatch}
          />
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
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
                void onPatch({ regenerateAccessToken: true });
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
                void onPatch({ revokeAccessToken: true });
              }}
              className="text-text-2 hover:text-rose-400 disabled:opacity-50"
            >
              Revoke
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[11px] leading-relaxed text-text-2">
            No access link is currently issued. Generate one so this
            contributor can answer their assigned questions without portal
            access.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onPatch({ regenerateAccessToken: true })}
            className="brand-primary rounded-full px-3 py-1 text-[11px] disabled:opacity-50"
          >
            Generate link
          </button>
        </>
      )}
    </div>
  );
}

// Slice 6 + 7: expiry editor + last-used display, kept as a small
// sub-component so the same shape can be lifted into the champion
// panel later if needed. The expiry input uses an HTML date picker;
// blur/onChange both commit so a date pick saves immediately, and
// "Clear" re-sends an empty string which the server treats as null.
function ContributorAccessExpiryRow({
  contributor,
  busy,
  onPatch
}: {
  contributor: Contributor;
  busy: boolean;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
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
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-2">
      <label className="flex items-center gap-2">
        <span className="uppercase tracking-wide">Expires</span>
        <input
          type="date"
          value={expiryDateValue}
          disabled={busy}
          onChange={(e) =>
            void onPatch({ accessTokenExpiresAt: e.target.value || null })
          }
          className="brand-input rounded-md border px-2 py-0.5 text-[11px]"
        />
      </label>
      {expiryDateValue ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onPatch({ accessTokenExpiresAt: null })}
          className="hover:text-white disabled:opacity-50"
        >
          Clear
        </button>
      ) : (
        <span className="text-text-3">Never expires</span>
      )}
      {isExpired ? (
        <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-300">
          Expired
        </span>
      ) : null}
      <span className="ml-auto text-[10px]">
        {lastUsed
          ? `Last opened ${lastUsed.toLocaleDateString()}`
          : "Never opened"}
      </span>
    </div>
  );
}
