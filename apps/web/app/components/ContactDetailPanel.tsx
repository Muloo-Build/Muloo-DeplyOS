"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useToast } from "./Toast";

interface ContactListItem {
  id: string;
  clientId: string;
  clientName: string;
  clientLogoUrl: string | null;
  clientIndustry: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  canApproveQuotes: boolean;
  lastNoteAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ContactNote {
  id: string;
  body: string;
  authorId: string | null;
  createdAt: string;
}

interface PortalProject {
  id: string;
  name: string;
  status: string;
  scopeType: string;
  updatedAt: string;
  portalAccess: {
    role: string;
    questionnaireAccess: boolean;
    authStatus: string;
  } | null;
}

interface ContactDetail extends ContactListItem {
  notes: ContactNote[];
  portalProjects: PortalProject[];
}

type Tab = "overview" | "notes" | "projects";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}yr ago`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

export default function ContactDetailPanel({
  contact,
  onClose,
  onUpdated,
  onDeleted
}: {
  contact: ContactListItem;
  onClose: () => void;
  onUpdated: (updated: ContactListItem) => void;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<ContactDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState({
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    title: contact.title,
    canApproveQuotes: contact.canApproveQuotes
  });
  const [saving, setSaving] = useState(false);

  // Note state
  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  // Delete contact
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setDetail(null);
    setLoadingDetail(true);
    setTab("overview");
    setEditing(false);
    setEditDraft({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      title: contact.title,
      canApproveQuotes: contact.canApproveQuotes
    });

    async function load() {
      try {
        const res = await fetch(`/api/clients/${contact.clientId}/contacts/${contact.id}`);
        if (res.ok) {
          const body = await res.json();
          setDetail(body.contact);
        }
      } finally {
        setLoadingDetail(false);
      }
    }
    void load();
  }, [contact.id, contact.clientId]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${contact.clientId}/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editDraft)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to save");
      }
      const body = await res.json();
      const updated: ContactListItem = {
        ...contact,
        ...body.contact,
        clientId: contact.clientId,
        clientName: contact.clientName,
        clientLogoUrl: contact.clientLogoUrl,
        clientIndustry: contact.clientIndustry,
        lastNoteAt: contact.lastNoteAt
      };
      onUpdated(updated);
      setDetail((prev) => prev ? { ...prev, ...body.contact } : prev);
      setEditing(false);
      toast.success("Contact saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save contact");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddNote() {
    if (!noteBody.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/clients/${contact.clientId}/contacts/${contact.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody.trim() })
      });
      if (!res.ok) throw new Error("Failed to save note");
      const body = await res.json();
      setDetail((prev) =>
        prev ? { ...prev, notes: [body.note, ...prev.notes] } : prev
      );
      setNoteBody("");
      toast.success("Note added");
    } catch {
      toast.error("Failed to add note");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    setDeletingNoteId(noteId);
    try {
      await fetch(`/api/clients/${contact.clientId}/contacts/${contact.id}/notes/${noteId}`, {
        method: "DELETE"
      });
      setDetail((prev) =>
        prev ? { ...prev, notes: prev.notes.filter((n) => n.id !== noteId) } : prev
      );
      toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete note");
    } finally {
      setDeletingNoteId(null);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${contact.clientId}/contacts/${contact.id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Failed to delete contact");
      toast.success("Contact deleted");
      onDeleted();
    } catch {
      toast.error("Failed to delete contact");
      setDeleting(false);
    }
  }

  const initials = getInitials(contact.firstName, contact.lastName);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close panel"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-ink-4 bg-ink-1 shadow-2xl"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-ink-4 px-6 py-4">
          <p className="text-xs uppercase tracking-[0.14em] text-text-3">Contact</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-4 text-text-3 hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Identity */}
        <div className="border-b border-ink-4 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-ink-4 bg-[rgba(74,219,192,0.12)] text-lg font-bold text-status-ok">
              {initials || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold text-white">
                {contact.firstName} {contact.lastName}
              </h2>
              {contact.title && (
                <p className="mt-0.5 text-sm text-text-2">{contact.title}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Link
                  href={`/clients`}
                  className="rounded-full border border-ink-4 bg-ink-2 px-3 py-1 text-xs text-text-2 hover:text-white"
                >
                  {contact.clientName}
                </Link>
                {contact.canApproveQuotes && (
                  <span className="rounded-full bg-[rgba(74,219,192,0.12)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-status-ok">
                    Quote approver
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-ink-4 px-6">
          {(["overview", "notes", "projects"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`mr-6 py-3 text-sm font-medium capitalize transition ${
                tab === t
                  ? "border-b-2 border-status-ok text-white"
                  : "text-text-2 hover:text-white"
              }`}
            >
              {t}
              {t === "notes" && detail && detail.notes.length > 0
                ? ` (${detail.notes.length})`
                : ""}
              {t === "projects" && detail
                ? ` (${detail.portalProjects.length})`
                : ""}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* OVERVIEW TAB */}
          {tab === "overview" && (
            <div>
              {editing ? (
                <div className="space-y-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-text-3">Edit contact</p>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                      <span className="text-xs text-text-3">First name</span>
                      <input
                        value={editDraft.firstName}
                        onChange={(e) => setEditDraft((d) => ({ ...d, firstName: e.target.value }))}
                        className="mt-1.5 w-full rounded-[10px] border border-ink-4 bg-ink-1 px-3 py-2.5 text-sm text-white outline-none focus:border-ink-5"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-text-3">Last name</span>
                      <input
                        value={editDraft.lastName}
                        onChange={(e) => setEditDraft((d) => ({ ...d, lastName: e.target.value }))}
                        className="mt-1.5 w-full rounded-[10px] border border-ink-4 bg-ink-1 px-3 py-2.5 text-sm text-white outline-none focus:border-ink-5"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs text-text-3">Email</span>
                    <input
                      value={editDraft.email}
                      onChange={(e) => setEditDraft((d) => ({ ...d, email: e.target.value }))}
                      className="mt-1.5 w-full rounded-[10px] border border-ink-4 bg-ink-1 px-3 py-2.5 text-sm text-white outline-none focus:border-ink-5"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-text-3">Phone</span>
                    <input
                      value={editDraft.phone}
                      onChange={(e) => setEditDraft((d) => ({ ...d, phone: e.target.value }))}
                      placeholder="+44 7700 900000"
                      className="mt-1.5 w-full rounded-[10px] border border-ink-4 bg-ink-1 px-3 py-2.5 text-sm text-white outline-none focus:border-ink-5 placeholder:text-text-3"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-text-3">Title / role</span>
                    <input
                      value={editDraft.title}
                      onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                      className="mt-1.5 w-full rounded-[10px] border border-ink-4 bg-ink-1 px-3 py-2.5 text-sm text-white outline-none focus:border-ink-5"
                    />
                  </label>
                  <label className="flex items-center gap-3 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={editDraft.canApproveQuotes}
                      onChange={(e) => setEditDraft((d) => ({ ...d, canApproveQuotes: e.target.checked }))}
                    />
                    Can approve quotes
                  </label>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={saving}
                      className="flex-1 rounded-[10px] bg-[rgba(73,205,225,0.12)] px-4 py-2.5 text-sm font-medium text-status-ok transition hover:bg-[rgba(73,205,225,0.20)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="rounded-[10px] border border-ink-4 px-4 py-2.5 text-sm font-medium text-text-2 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="rounded-[10px] border border-ink-4 px-4 py-2 text-sm font-medium text-text-2 hover:text-white"
                    >
                      Edit
                    </button>
                  </div>

                  {/* Contact fields */}
                  <div className="rounded-[14px] border border-ink-4 bg-ink-1 p-5 space-y-4">
                    <Field label="Email">
                      <a href={`mailto:${contact.email}`} className="text-status-ok hover:underline">
                        {contact.email}
                      </a>
                    </Field>
                    {contact.phone && (
                      <Field label="Phone">
                        <a href={`tel:${contact.phone}`} className="text-white hover:text-status-ok">
                          {contact.phone}
                        </a>
                      </Field>
                    )}
                    {contact.title && <Field label="Title">{contact.title}</Field>}
                    <Field label="Company">
                      <Link href="/clients" className="text-white hover:text-status-ok">
                        {contact.clientName}
                      </Link>
                    </Field>
                    {contact.clientIndustry && (
                      <Field label="Industry">{contact.clientIndustry}</Field>
                    )}
                    <Field label="Added">{formatDate(contact.createdAt)}</Field>
                  </div>

                  {/* Danger zone */}
                  <div className="rounded-[14px] border border-[rgba(255,80,80,0.15)] bg-[rgba(255,80,80,0.04)] p-5">
                    <p className="text-xs uppercase tracking-[0.14em] text-status-danger">Danger zone</p>
                    <p className="mt-2 text-sm text-text-2">
                      Removing this contact will also revoke any portal access they have.
                    </p>
                    {confirmDelete ? (
                      <div className="mt-3 flex gap-3">
                        <button
                          type="button"
                          onClick={() => void handleDelete()}
                          disabled={deleting}
                          className="rounded-[10px] bg-[rgba(255,107,122,0.16)] px-4 py-2 text-sm font-medium text-status-danger hover:bg-[rgba(255,107,122,0.24)] disabled:cursor-not-allowed"
                        >
                          {deleting ? "Deleting…" : "Yes, delete"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="rounded-[10px] border border-ink-4 px-4 py-2 text-sm text-text-2 hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="mt-3 rounded-[10px] border border-[rgba(255,107,122,0.2)] px-4 py-2 text-sm text-status-danger hover:border-[rgba(255,107,122,0.4)]"
                      >
                        Remove contact
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NOTES TAB */}
          {tab === "notes" && (
            <div className="space-y-4">
              {/* Add note */}
              <div className="rounded-[14px] border border-ink-4 bg-ink-1 p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.14em] text-text-3">Add a note</p>
                <textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="Log a call, meeting, decision, or anything worth tracking…"
                  rows={3}
                  className="w-full resize-none rounded-[10px] border border-ink-4 bg-ink-2 px-3 py-3 text-sm text-white outline-none focus:border-ink-5 placeholder:text-text-3"
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleAddNote()}
                    disabled={savingNote || !noteBody.trim()}
                    className="rounded-[10px] bg-[rgba(73,205,225,0.12)] px-4 py-2 text-sm font-medium text-status-ok transition hover:bg-[rgba(73,205,225,0.20)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {savingNote ? "Saving…" : "Add note"}
                  </button>
                </div>
              </div>

              {/* Notes list */}
              {loadingDetail ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-20 animate-pulse rounded-[14px] border border-ink-4 bg-ink-1" />
                  ))}
                </div>
              ) : detail && detail.notes.length > 0 ? (
                <div className="space-y-3">
                  {detail.notes.map((note) => (
                    <div
                      key={note.id}
                      className="group rounded-[14px] border border-ink-4 bg-ink-1 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="flex-1 text-sm leading-6 text-text-2">{note.body}</p>
                        <button
                          type="button"
                          onClick={() => void handleDeleteNote(note.id)}
                          disabled={deletingNoteId === note.id}
                          className="shrink-0 rounded-lg border border-ink-4 px-2 py-1 text-xs text-text-3 opacity-0 transition group-hover:opacity-100 hover:border-[rgba(255,107,122,0.2)] hover:text-status-danger disabled:cursor-not-allowed"
                        >
                          {deletingNoteId === note.id ? "…" : "Delete"}
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-text-3">{formatDate(note.createdAt)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-text-3 py-8">
                  No notes yet. Log a call, meeting, or anything relevant above.
                </p>
              )}
            </div>
          )}

          {/* PROJECTS TAB */}
          {tab === "projects" && (
            <div className="space-y-3">
              {loadingDetail ? (
                <div className="space-y-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="h-20 animate-pulse rounded-[14px] border border-ink-4 bg-ink-1" />
                  ))}
                </div>
              ) : detail && detail.portalProjects.length > 0 ? (
                detail.portalProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="block rounded-[14px] border border-ink-4 bg-ink-1 p-4 transition hover:border-ink-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{project.name}</p>
                        <p className="mt-1 text-xs text-text-2">
                          {project.scopeType.replace(/_/g, " ")} · {project.status}
                        </p>
                      </div>
                      {project.portalAccess ? (
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                            project.portalAccess.authStatus === "active"
                              ? "bg-[rgba(74,219,192,0.12)] text-status-ok"
                              : "bg-white/5 text-text-3"
                          }`}
                        >
                          {project.portalAccess.authStatus === "active" ? "Portal active" : "Invite pending"}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full border border-ink-4 px-2.5 py-1 text-[10px] text-text-3">
                          No portal access
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-text-3">
                      Updated {timeAgo(project.updatedAt)}
                    </p>
                  </Link>
                ))
              ) : (
                <p className="text-center text-sm text-text-3 py-8">
                  No projects linked to this client yet.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.14em] text-text-3">{label}</p>
      <div className="mt-1 text-sm text-white">{children}</div>
    </div>
  );
}
