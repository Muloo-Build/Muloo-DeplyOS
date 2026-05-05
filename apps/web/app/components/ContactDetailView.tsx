"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Building2,
  Calendar,
  ChevronRight,
  Edit3,
  ExternalLink,
  FileText,
  Home,
  Mail,
  Phone,
  Plus,
  StickyNote,
  Trash2,
  Users,
  X
} from "lucide-react";

import AppShell from "./AppShell";
import { useToast } from "./Toast";
import { Avatar } from "./ui/Avatar";
import { Btn } from "./ui/Btn";
import { Empty } from "./ui/Empty";
import { HealthCell, HealthStrip } from "./ui/HealthStrip";
import { KeyValue } from "./ui/KeyValue";
import { Panel, PanelBody, PanelHead } from "./ui/Panel";
import { Pill } from "./ui/Pill";
import { Tabs } from "./ui/Tabs";

interface ContactRecord {
  id: string;
  clientId: string;
  clientName?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  title?: string | null;
  canApproveQuotes?: boolean;
  lastNoteAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
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

interface ContactDetail extends ContactRecord {
  notes?: ContactNote[];
  portalProjects?: PortalProject[];
}

const tabs = [
  { id: "overview", label: "Overview", icon: <Home size={13} /> },
  { id: "notes", label: "Notes", icon: <StickyNote size={13} /> },
  { id: "projects", label: "Projects", icon: <FileText size={13} /> }
];

function relativeDate(iso?: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface ContactDetailViewProps {
  contactId: string;
}

export default function ContactDetailView({ contactId }: ContactDetailViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    title: "",
    canApproveQuotes: false
  });
  const [saving, setSaving] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        // /api/contacts (global) returns clientId per row; we need that to
        // hit the per-client contact detail endpoint.
        const list = await fetch("/api/contacts").then((r) =>
          r.ok ? r.json() : null
        );
        const all: ContactRecord[] = Array.isArray(list?.contacts)
          ? list.contacts
          : [];
        const found = all.find((c) => c.id === contactId);
        if (!found) {
          if (!cancelled) {
            setContact(null);
            setLoading(false);
          }
          return;
        }

        const detail = await fetch(
          `/api/clients/${encodeURIComponent(found.clientId)}/contacts/${encodeURIComponent(contactId)}`
        ).then((r) => (r.ok ? r.json() : null));

        if (cancelled) return;
        const merged: ContactDetail = {
          ...found,
          ...(detail?.contact ?? {}),
          notes: Array.isArray(detail?.contact?.notes)
            ? detail.contact.notes
            : [],
          portalProjects: Array.isArray(detail?.contact?.portalProjects)
            ? detail.contact.portalProjects
            : []
        };
        setContact(merged);
        setEditDraft({
          firstName: merged.firstName,
          lastName: merged.lastName,
          email: merged.email,
          phone: merged.phone ?? "",
          title: merged.title ?? "",
          canApproveQuotes: Boolean(merged.canApproveQuotes)
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  async function handleSave() {
    if (!contact) return;
    setSaving(true);
    try {
      const r = await fetch(
        `/api/clients/${encodeURIComponent(contact.clientId)}/contacts/${encodeURIComponent(contact.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editDraft)
        }
      );
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        throw new Error(body?.error ?? "Save failed");
      }
      const body = await r.json();
      setContact((prev) =>
        prev ? { ...prev, ...body.contact } : prev
      );
      setEditing(false);
      toast.success("Contact saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddNote() {
    if (!contact || !noteBody.trim()) return;
    setSavingNote(true);
    try {
      const r = await fetch(
        `/api/clients/${encodeURIComponent(contact.clientId)}/contacts/${encodeURIComponent(contact.id)}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: noteBody.trim() })
        }
      );
      if (!r.ok) throw new Error("Note save failed");
      const body = await r.json();
      setContact((prev) =>
        prev ? { ...prev, notes: [body.note, ...(prev.notes ?? [])] } : prev
      );
      setNoteBody("");
      toast.success("Note added");
    } catch {
      toast.error("Note save failed");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleDelete() {
    if (!contact) return;
    setDeleting(true);
    try {
      const r = await fetch(
        `/api/clients/${encodeURIComponent(contact.clientId)}/contacts/${encodeURIComponent(contact.id)}`,
        { method: "DELETE" }
      );
      if (!r.ok) throw new Error("Delete failed");
      toast.success("Contact deleted");
      router.replace("/contacts");
    } catch {
      toast.error("Delete failed");
      setDeleting(false);
    }
  }

  const initials = useMemo(() => {
    if (!contact) return "?";
    return `${contact.firstName[0] ?? ""}${contact.lastName[0] ?? ""}`.toUpperCase() || "?";
  }, [contact]);

  if (loading && !contact) {
    return (
      <AppShell>
        <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
          <Empty title="Loading contact…" sub="One moment." />
        </div>
      </AppShell>
    );
  }

  if (!contact) {
    return (
      <AppShell>
        <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
          <Empty
            title="Contact not found"
            sub="No contact matches this id."
            action={
              <Link href="/contacts">
                <Btn variant="ghost" size="sm">
                  Back to contacts
                </Btn>
              </Link>
            }
          />
        </div>
      </AppShell>
    );
  }

  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
  const notesList = contact.notes ?? [];
  const projectsList = contact.portalProjects ?? [];

  return (
    <AppShell>
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
        <header className="flex items-start justify-between gap-6 mb-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[12px] text-text-3 mb-2">
              <Link
                href="/contacts"
                className="hover:text-text-1 transition-colors"
              >
                Contacts
              </Link>
              {contact.clientName && (
                <>
                  <ChevronRight size={11} className="text-text-4" />
                  <Link
                    href={`/clients/${contact.clientId}`}
                    className="hover:text-text-1 transition-colors truncate"
                  >
                    {contact.clientName}
                  </Link>
                </>
              )}
            </div>
            <div className="flex items-start gap-3.5 mb-2">
              <Avatar
                size="lg"
                initials={initials}
                className="!w-12 !h-12 !text-[16px]"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                  <h1 className="text-[24px] font-semibold m-0 -tracking-[0.02em] text-text-1">
                    {fullName}
                  </h1>
                  {contact.canApproveQuotes && (
                    <Pill tone="ok" dot>
                      Quote approver
                    </Pill>
                  )}
                </div>
                <div className="flex items-center gap-4 flex-wrap text-[12.5px] text-text-3">
                  {contact.title && (
                    <span className="inline-flex items-center gap-1.5">
                      <Users size={12} />
                      {contact.title}
                    </span>
                  )}
                  {contact.clientName && (
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 size={12} />
                      {contact.clientName}
                    </span>
                  )}
                  {contact.createdAt && (
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar size={12} />
                      Added {new Date(contact.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <a href={`mailto:${contact.email}`}>
              <Btn variant="ghost" size="md">
                <Mail size={13} />
                Email
              </Btn>
            </a>
            {contact.phone && (
              <a href={`tel:${contact.phone}`}>
                <Btn variant="ghost" size="md">
                  <Phone size={13} />
                  Call
                </Btn>
              </a>
            )}
            <Btn
              variant={editing ? "ghost" : "primary"}
              size="md"
              onClick={() => setEditing((v) => !v)}
            >
              <Edit3 size={13} />
              {editing ? "Cancel" : "Edit"}
            </Btn>
            <Btn
              variant="danger"
              size="md"
              onClick={() => setDeleteOpen(true)}
              aria-label="Delete contact"
              title="Delete contact"
            >
              <Trash2 size={13} />
            </Btn>
          </div>
        </header>

        <HealthStrip className="mb-6">
          <HealthCell
            label="Client"
            value={contact.clientName ?? "—"}
            sub="company"
            tone="ok"
          />
          <HealthCell
            label="Title"
            value={contact.title ?? "—"}
            sub="role"
          />
          <HealthCell
            label="Status"
            value={contact.canApproveQuotes ? "Approver" : "Contact"}
            sub={contact.canApproveQuotes ? "can sign-off quotes" : "stakeholder"}
            tone={contact.canApproveQuotes ? "ok" : "muted"}
          />
          <HealthCell
            label="Projects"
            value={String(projectsList.length)}
            sub={
              projectsList.length > 0
                ? "linked via portal"
                : "no portal access"
            }
          />
          <HealthCell
            label="Last activity"
            value={relativeDate(contact.lastNoteAt ?? contact.updatedAt)}
            sub="last note or update"
          />
        </HealthStrip>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
          <div className="min-w-0">
            <Tabs
              items={tabs.map((t) => ({
                id: t.id,
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    {t.icon}
                    <span>{t.label}</span>
                  </span>
                ),
                count:
                  t.id === "notes"
                    ? notesList.length
                    : t.id === "projects"
                      ? projectsList.length
                      : undefined
              }))}
              active={tab}
              onChange={setTab}
            />

            {tab === "overview" && (
              <Panel>
                <PanelHead title="Contact details" />
                <PanelBody>
                  {editing ? (
                    <div className="grid gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold">
                            First name
                          </span>
                          <input
                            value={editDraft.firstName}
                            onChange={(e) =>
                              setEditDraft((d) => ({
                                ...d,
                                firstName: e.target.value
                              }))
                            }
                            className="mt-1.5 w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[13px] text-text-1 outline-none focus:border-[rgba(74,219,192,0.35)]"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold">
                            Last name
                          </span>
                          <input
                            value={editDraft.lastName}
                            onChange={(e) =>
                              setEditDraft((d) => ({
                                ...d,
                                lastName: e.target.value
                              }))
                            }
                            className="mt-1.5 w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[13px] text-text-1 outline-none focus:border-[rgba(74,219,192,0.35)]"
                          />
                        </label>
                      </div>
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold">
                          Email
                        </span>
                        <input
                          value={editDraft.email}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, email: e.target.value }))
                          }
                          className="mt-1.5 w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[13px] text-text-1 outline-none focus:border-[rgba(74,219,192,0.35)]"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold">
                          Phone
                        </span>
                        <input
                          value={editDraft.phone}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, phone: e.target.value }))
                          }
                          className="mt-1.5 w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[13px] text-text-1 outline-none focus:border-[rgba(74,219,192,0.35)]"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold">
                          Title / role
                        </span>
                        <input
                          value={editDraft.title}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, title: e.target.value }))
                          }
                          className="mt-1.5 w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[13px] text-text-1 outline-none focus:border-[rgba(74,219,192,0.35)]"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-[13px] text-text-1">
                        <input
                          type="checkbox"
                          checked={editDraft.canApproveQuotes}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              canApproveQuotes: e.target.checked
                            }))
                          }
                        />
                        Can approve quotes
                      </label>
                      <div className="flex justify-end gap-2 pt-1">
                        <Btn
                          variant="ghost"
                          size="md"
                          onClick={() => setEditing(false)}
                          disabled={saving}
                        >
                          Cancel
                        </Btn>
                        <Btn
                          variant="primary"
                          size="md"
                          onClick={() => void handleSave()}
                          disabled={saving}
                        >
                          {saving ? "Saving…" : "Save changes"}
                        </Btn>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <KeyValue
                        label="Email"
                        value={
                          <a
                            href={`mailto:${contact.email}`}
                            className="font-mono break-all hover:text-status-ok"
                          >
                            {contact.email}
                          </a>
                        }
                      />
                      {contact.phone && (
                        <KeyValue
                          label="Phone"
                          value={
                            <a
                              href={`tel:${contact.phone}`}
                              className="font-mono hover:text-status-ok"
                            >
                              {contact.phone}
                            </a>
                          }
                        />
                      )}
                      {contact.title && (
                        <KeyValue label="Title" value={contact.title} />
                      )}
                      {contact.clientName && (
                        <KeyValue label="Company" value={contact.clientName} />
                      )}
                      {contact.createdAt && (
                        <KeyValue
                          label="Added"
                          value={new Date(
                            contact.createdAt
                          ).toLocaleDateString()}
                        />
                      )}
                    </div>
                  )}
                </PanelBody>
              </Panel>
            )}

            {tab === "notes" && (
              <div className="flex flex-col gap-4">
                <Panel>
                  <PanelHead title="Add a note" />
                  <PanelBody className="grid gap-2">
                    <textarea
                      value={noteBody}
                      onChange={(e) => setNoteBody(e.target.value)}
                      placeholder="Capture context, action items, or summary…"
                      className="min-h-[100px] w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[13px] text-text-1 outline-none focus:border-[rgba(74,219,192,0.35)] placeholder:text-text-4"
                    />
                    <div className="flex justify-end">
                      <Btn
                        variant="primary"
                        size="sm"
                        onClick={() => void handleAddNote()}
                        disabled={savingNote || !noteBody.trim()}
                      >
                        <Plus size={12} />
                        {savingNote ? "Saving…" : "Add note"}
                      </Btn>
                    </div>
                  </PanelBody>
                </Panel>
                {notesList.length === 0 ? (
                  <Empty
                    icon={<StickyNote size={20} />}
                    title="No notes yet"
                    sub="Capture context, action items, or summaries here."
                  />
                ) : (
                  <Panel>
                    <PanelBody flush>
                      {notesList.map((n, i) => (
                        <div
                          key={n.id}
                          className={`px-[18px] py-3 ${
                            i < notesList.length - 1 ? "border-b border-ink-4" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <span className="text-[11.5px] text-text-3 font-mono">
                              {new Date(n.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-[13px] text-text-2 m-0 whitespace-pre-wrap">
                            {n.body}
                          </p>
                        </div>
                      ))}
                    </PanelBody>
                  </Panel>
                )}
              </div>
            )}

            {tab === "projects" && (
              <>
                {projectsList.length === 0 ? (
                  <Empty
                    icon={<FileText size={20} />}
                    title="No portal access"
                    sub="This contact hasn't been invited to any project portals."
                  />
                ) : (
                  <Panel>
                    <PanelBody flush>
                      {projectsList.map((p, i) => (
                        <Link
                          key={p.id}
                          href={`/projects/${p.id}`}
                          className={`grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3.5 items-center px-[18px] py-3 cursor-pointer hover:bg-ink-2 transition-colors ${
                            i < projectsList.length - 1
                              ? "border-b border-ink-4"
                              : ""
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-[13px] font-medium truncate">
                              {p.name}
                            </div>
                            <div className="text-[11.5px] text-text-3 mt-0.5 truncate">
                              {p.scopeType} · updated{" "}
                              {relativeDate(p.updatedAt)}
                            </div>
                          </div>
                          {p.portalAccess && (
                            <Pill
                              tone={
                                p.portalAccess.authStatus === "active"
                                  ? "ok"
                                  : "warn"
                              }
                              dot
                            >
                              {p.portalAccess.authStatus}
                            </Pill>
                          )}
                          <ChevronRight size={14} className="text-text-3" />
                        </Link>
                      ))}
                    </PanelBody>
                  </Panel>
                )}
              </>
            )}
          </div>

          <aside className="flex flex-col gap-3.5 xl:sticky xl:top-[80px] self-start">
            <Panel>
              <PanelHead
                title="Company"
                right={
                  contact.clientId ? (
                    <Link href={`/clients/${contact.clientId}`}>
                      <Btn variant="ghost" size="icon" aria-label="Open client">
                        <ExternalLink size={12} />
                      </Btn>
                    </Link>
                  ) : null
                }
              />
              <PanelBody className="grid gap-2.5">
                <div className="flex items-center gap-2.5">
                  <Avatar
                    size="md"
                    initials={(contact.clientName ?? "?").slice(0, 2)}
                  />
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold truncate">
                      {contact.clientName ?? "—"}
                    </div>
                  </div>
                </div>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHead title="Quick info" />
              <PanelBody className="grid gap-2.5">
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-text-3">Notes</span>
                  <span className="font-mono">{notesList.length}</span>
                </div>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-text-3">Project portals</span>
                  <span className="font-mono">{projectsList.length}</span>
                </div>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-text-3">Approver</span>
                  <span
                    className={`font-mono ${
                      contact.canApproveQuotes
                        ? "text-status-ok"
                        : "text-text-3"
                    }`}
                  >
                    {contact.canApproveQuotes ? "Yes" : "No"}
                  </span>
                </div>
                {contact.lastNoteAt && (
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="text-text-3">Last note</span>
                    <span className="font-mono">
                      {relativeDate(contact.lastNoteAt)}
                    </span>
                  </div>
                )}
              </PanelBody>
            </Panel>
          </aside>
        </div>
      </div>

      {deleteOpen && (
        <>
          <button
            type="button"
            aria-label="Close delete dialog"
            onClick={() => !deleting && setDeleteOpen(false)}
            className="fixed inset-0 z-40 bg-black/70"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(440px,92vw)] bg-ink-1 border border-ink-4 rounded-[14px] p-6 shadow-elev-pop"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-[10px] tracking-[0.14em] uppercase text-status-danger font-semibold">
                  Danger zone
                </p>
                <h3 className="text-[16px] font-semibold mt-1 -tracking-[0.01em]">
                  Delete this contact?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !deleting && setDeleteOpen(false)}
                className="text-text-3 hover:text-text-1 p-1 rounded-md transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-[13px] text-text-2 m-0 mb-4">
              This will revoke any portal access {fullName} has. Notes are
              removed. The action is permanent.
            </p>
            <div className="flex justify-end gap-2">
              <Btn
                variant="ghost"
                size="md"
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
              >
                Cancel
              </Btn>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12.5px] font-semibold bg-status-danger text-[#2a0810] hover:bg-[#ff8090] border border-transparent transition-colors disabled:opacity-50"
              >
                <Trash2 size={13} />
                {deleting ? "Deleting…" : "Delete contact"}
              </button>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
