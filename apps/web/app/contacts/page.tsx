"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { SkeletonRows } from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import ContactDetailPanel from "../components/ContactDetailPanel";

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

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

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

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [selectedContact, setSelectedContact] = useState<ContactListItem | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/contacts");
        if (res.ok) {
          const body = await res.json();
          setContacts(body.contacts ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  function refreshContact(updated: ContactListItem) {
    setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setSelectedContact(updated);
  }

  function removeContact(id: string) {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setSelectedContact(null);
  }

  const clientOptions = useMemo(() => {
    const seen = new Map<string, string>();
    contacts.forEach((c) => seen.set(c.clientId, c.clientName));
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contacts.filter((c) => {
      const matchesSearch =
        !q ||
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.clientName.toLowerCase().includes(q);
      const matchesClient = filterClient === "all" || c.clientId === filterClient;
      return matchesSearch && matchesClient;
    });
  }, [contacts, search, filterClient]);

  const approvers = filtered.filter((c) => c.canApproveQuotes);
  const others = filtered.filter((c) => !c.canApproveQuotes);

  return (
    <AppShell>
      <div className="p-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#49cde1]">
              Delivery
            </p>
            <h1 className="mt-2 font-heading text-3xl font-bold text-white">
              Contacts
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              All key contacts across every client — stakeholders, approvers, and portal users in one place.
            </p>
          </div>
          <Link
            href="/clients"
            className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white transition hover:border-[rgba(255,255,255,0.16)]"
          >
            Go to Clients
          </Link>
        </div>

        {/* Stats */}
        {!loading && contacts.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Total contacts", value: contacts.length },
              { label: "Quote approvers", value: contacts.filter((c) => c.canApproveQuotes).length },
              { label: "Clients covered", value: new Set(contacts.map((c) => c.clientId)).size },
              { label: "With portal access", value: contacts.filter((c) => c.lastNoteAt).length }
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card px-5 py-4"
              >
                <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">
                  {stat.label}
                </p>
                <p className="mt-2 text-2xl font-bold text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="mt-6 flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by name, email, title, or company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm rounded-xl border border-white/10 bg-background-card px-3 py-2.5 text-sm text-white placeholder:text-text-muted outline-none focus:border-white/20"
          />
          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className="rounded-xl border border-white/10 bg-background-card px-3 py-2.5 text-sm text-white outline-none focus:border-white/20"
          >
            <option value="all">All clients</option>
            {clientOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>

        {/* Content */}
        <div className="mt-6">
          {loading ? (
            <SkeletonRows count={6} height="h-20" gap="gap-3" rounded="rounded-2xl" />
          ) : filtered.length === 0 ? (
            <EmptyState
              title={search || filterClient !== "all" ? "No contacts match your filters" : "No contacts yet"}
              description={
                search || filterClient !== "all"
                  ? "Try adjusting your search or filter."
                  : "Add contacts to your clients first and they will appear here."
              }
              primaryCta={search || filterClient !== "all" ? undefined : { label: "Go to Clients", href: "/clients" }}
            />
          ) : (
            <div className="space-y-8">
              {approvers.length > 0 && (
                <section>
                  <p className="mb-3 text-xs uppercase tracking-[0.22em] text-[#49cde1]">
                    Quote approvers · {approvers.length}
                  </p>
                  <div className="space-y-2">
                    {approvers.map((contact) => (
                      <ContactRow
                        key={contact.id}
                        contact={contact}
                        onOpen={() => setSelectedContact(contact)}
                      />
                    ))}
                  </div>
                </section>
              )}
              {others.length > 0 && (
                <section>
                  {approvers.length > 0 && (
                    <p className="mb-3 text-xs uppercase tracking-[0.22em] text-text-muted">
                      All contacts · {others.length}
                    </p>
                  )}
                  <div className="space-y-2">
                    {others.map((contact) => (
                      <ContactRow
                        key={contact.id}
                        contact={contact}
                        onOpen={() => setSelectedContact(contact)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedContact && (
        <ContactDetailPanel
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onUpdated={refreshContact}
          onDeleted={() => removeContact(selectedContact.id)}
        />
      )}
    </AppShell>
  );
}

function ContactRow({
  contact,
  onOpen
}: {
  contact: ContactListItem;
  onOpen: () => void;
}) {
  const initials = getInitials(contact.firstName, contact.lastName);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card px-5 py-4 text-left transition hover:border-[rgba(255,255,255,0.14)] hover:bg-background-elevated"
    >
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[rgba(255,255,255,0.10)] bg-[rgba(73,205,225,0.10)] text-sm font-semibold text-[#49cde1]">
          {initials || "?"}
        </div>

        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-white">
              {contact.firstName} {contact.lastName}
            </p>
            {contact.canApproveQuotes && (
              <span className="rounded-full bg-[rgba(81,208,176,0.14)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#51d0b0]">
                Approver
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-text-secondary">
            {contact.title ? `${contact.title} · ` : ""}
            {contact.email}
            {contact.phone ? ` · ${contact.phone}` : ""}
          </p>
        </div>

        {/* Client badge */}
        <div className="hidden shrink-0 sm:block">
          <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-xs text-text-secondary">
            {contact.clientName}
          </span>
        </div>

        {/* Last activity */}
        {contact.lastNoteAt && (
          <p className="hidden shrink-0 text-xs text-text-muted md:block">
            Note {timeAgo(contact.lastNoteAt)}
          </p>
        )}

        {/* Chevron */}
        <svg
          className="ml-2 shrink-0 text-text-muted"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </button>
  );
}
