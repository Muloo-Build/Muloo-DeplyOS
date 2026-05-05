"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";

import AppShell from "./AppShell";
import { Avatar } from "./ui/Avatar";
import { Btn } from "./ui/Btn";
import { Empty } from "./ui/Empty";
import { PageHead } from "./ui/PageHead";
import { Pill } from "./ui/Pill";
import { SearchInput } from "./ui/SearchInput";
import { Stat, StatsGrid } from "./ui/Stat";
import { Toolbar } from "./ui/Toolbar";
import {
  CellPrimary,
  TBody,
  Tbl,
  Td,
  Th,
  THead,
  Tr
} from "./ui/Tbl";

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

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}yr ago`;
}

export default function ContactsView() {
  const router = useRouter();
  const [contacts, setContacts] = useState<ContactListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("all");

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
        (c.title ?? "").toLowerCase().includes(q) ||
        c.clientName.toLowerCase().includes(q);
      const matchesClient =
        filterClient === "all" || c.clientId === filterClient;
      return matchesSearch && matchesClient;
    });
  }, [contacts, search, filterClient]);

  const stats = useMemo(() => {
    return {
      total: contacts.length,
      approvers: contacts.filter((c) => c.canApproveQuotes).length,
      clients: new Set(contacts.map((c) => c.clientId)).size,
      withActivity: contacts.filter((c) => c.lastNoteAt).length
    };
  }, [contacts]);

  return (
    <AppShell>
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
        <PageHead
          eyebrow="Delivery"
          title="Contacts"
          lede="All key contacts across every client — stakeholders, approvers, and portal users in one place."
          actions={
            <Btn variant="primary" size="md">
              <Plus size={14} />
              Add contact
            </Btn>
          }
        />

        {!loading && contacts.length > 0 && (
          <StatsGrid cols={4} className="mb-6">
            <Stat label="Total contacts" value={String(stats.total)} />
            <Stat
              label="Quote approvers"
              value={String(stats.approvers)}
              delta={
                stats.approvers > 0
                  ? "can sign-off quotes"
                  : "no approvers set"
              }
              deltaTone={stats.approvers > 0 ? "up" : "neutral"}
            />
            <Stat
              label="Clients covered"
              value={String(stats.clients)}
              delta={`${contacts.length - stats.clients} duplicate companies removed`}
            />
            <Stat
              label="With activity"
              value={String(stats.withActivity)}
              delta={
                stats.withActivity > 0
                  ? "have logged notes"
                  : "no activity yet"
              }
            />
          </StatsGrid>
        )}

        <Toolbar
          left={
            <>
              <SearchInput
                placeholder="Search by name, email, title, or company…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full max-w-sm"
              />
              <select
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                className="bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[13px] text-text-1 outline-none focus:border-[rgba(74,219,192,0.35)]"
              >
                <option value="all">All clients</option>
                {clientOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </>
          }
        />

        {loading ? (
          <Empty title="Loading contacts…" sub="One moment." />
        ) : filtered.length === 0 ? (
          <Empty
            title={
              search || filterClient !== "all"
                ? "No contacts match"
                : "No contacts yet"
            }
            sub={
              search || filterClient !== "all"
                ? "Adjust search or filter."
                : "Add contacts to your clients first and they'll appear here."
            }
          />
        ) : (
          <Tbl>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Client</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>Status</Th>
                <Th>Last activity</Th>
                <Th style={{ width: 40 }}></Th>
              </Tr>
            </THead>
            <TBody>
              {filtered.map((c) => {
                const initials = `${c.firstName[0] ?? ""}${c.lastName[0] ?? ""}`.toUpperCase() || "?";
                const fullName = `${c.firstName} ${c.lastName}`.trim();
                return (
                  <Tr key={c.id} onClick={() => router.push(`/contacts/${c.id}`)}>
                    <Td>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar size="sm" initials={initials} />
                        <CellPrimary>{fullName || "—"}</CellPrimary>
                      </div>
                    </Td>
                    <Td muted>{c.title || "—"}</Td>
                    <Td>{c.clientName}</Td>
                    <Td>
                      <span className="font-mono text-[12px]">{c.email}</span>
                    </Td>
                    <Td muted>
                      <span className="font-mono text-[12px]">
                        {c.phone || "—"}
                      </span>
                    </Td>
                    <Td>
                      {c.canApproveQuotes ? (
                        <Pill tone="ok" dot>
                          Approver
                        </Pill>
                      ) : (
                        <Pill dot>Contact</Pill>
                      )}
                    </Td>
                    <Td muted>
                      <span className="font-mono text-[12px]">
                        {timeAgo(c.lastNoteAt)}
                      </span>
                    </Td>
                    <Td>
                      <ChevronRight size={14} className="text-text-3" />
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Tbl>
        )}
      </div>

    </AppShell>
  );
}
