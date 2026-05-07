"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Download, ExternalLink, Filter, Plus, X } from "lucide-react";

import AppShell from "./AppShell";
import { Avatar } from "./ui/Avatar";
import { Btn } from "./ui/Btn";
import { Empty } from "./ui/Empty";
import { PageHead } from "./ui/PageHead";
import { Pill } from "./ui/Pill";
import { Stat, StatsGrid } from "./ui/Stat";
import { Tabs } from "./ui/Tabs";
import {
  CellPrimary,
  TBody,
  Tbl,
  Td,
  Th,
  THead,
  Tr
} from "./ui/Tbl";

interface ClientRecord {
  id: string;
  name: string;
  industry?: string | null;
  region?: string | null;
  championName?: string | null;
  championEmail?: string | null;
  // From the API these can come back as arrays of full objects OR as numeric counts
  activeProjects?: unknown;
  contactsCount?: number;
  contacts?: unknown;
  mrr?: number | null;
  currency?: string;
  lastTouch?: string | null;
  updatedAt?: string;
  website?: string | null;
  hubSpotPortal?: { portalId?: string; hub?: string; connected?: boolean } | null;
  portal?: { connected?: boolean; hub?: string };
  tags?: string[];
  isPartner?: boolean;
}

function countOf(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "number") return value;
  return 0;
}

const tabDefs = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "partner", label: "Partners" },
  { id: "lead", label: "Leads" }
];

function isPartner(c: ClientRecord): boolean {
  return Boolean(c.isPartner) || (c.tags ?? []).includes("partner");
}

function isLead(c: ClientRecord): boolean {
  return countOf(c.activeProjects) === 0 && !isPartner(c);
}

function isActive(c: ClientRecord): boolean {
  return countOf(c.activeProjects) > 0 && !isPartner(c);
}

function clientPortalConnected(c: ClientRecord): boolean {
  return Boolean(c.portal?.connected || c.hubSpotPortal?.portalId);
}

function clientPortalLabel(c: ClientRecord): string {
  if (c.hubSpotPortal?.portalId) return `Portal ${c.hubSpotPortal.portalId}`;
  if (c.portal?.hub) return c.portal.hub;
  return "Not linked";
}

function formatMRR(mrr?: number | null, currency?: string): string {
  if (mrr === null || mrr === undefined || mrr === 0) return "—";
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: currency ?? "ZAR",
    maximumFractionDigits: 0
  }).format(mrr);
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

export default function ClientsListView() {
  const router = useRouter();
  const [active, setActive] = useState("all");
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [newDraft, setNewDraft] = useState({
    name: "",
    website: "",
    industry: "",
    region: ""
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate() {
    if (!newDraft.name.trim()) {
      setCreateError("Client name required");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const r = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newDraft.name.trim(),
          website: newDraft.website.trim() || undefined,
          industry: newDraft.industry.trim() || undefined,
          region: newDraft.region.trim() || undefined
        })
      });
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        throw new Error(body?.error ?? `Create failed (${r.status})`);
      }
      const body = await r.json();
      const clientId: string | undefined = body?.client?.id;
      if (clientId) {
        router.push(`/clients/${clientId}`);
      } else {
        setNewOpen(false);
        setNewDraft({ name: "", website: "", industry: "", region: "" });
        // re-fetch the list
        const list = await fetch("/api/clients").then((res) => res.json());
        setClients(Array.isArray(list?.clients) ? list.clients : []);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const r = await fetch("/api/clients");
        if (!r.ok) {
          if (!cancelled) setClients([]);
          return;
        }
        const body = await r.json();
        const items: ClientRecord[] = Array.isArray(body?.clients)
          ? body.clients
          : Array.isArray(body)
            ? body
            : [];
        if (!cancelled) setClients(items);
      } catch {
        if (!cancelled) setClients([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    return {
      all: clients.length,
      active: clients.filter(isActive).length,
      partner: clients.filter(isPartner).length,
      lead: clients.filter(isLead).length
    };
  }, [clients]);

  const filtered = useMemo(() => {
    switch (active) {
      case "active":
        return clients.filter(isActive);
      case "partner":
        return clients.filter(isPartner);
      case "lead":
        return clients.filter(isLead);
      default:
        return clients;
    }
  }, [clients, active]);

  const stats = useMemo(() => {
    const totalProjects = clients.reduce(
      (sum, c) => sum + countOf(c.activeProjects),
      0
    );
    const totalContacts = clients.reduce(
      (sum, c) => sum + (c.contactsCount ?? countOf(c.contacts)),
      0
    );
    const totalMRR = clients.reduce((sum, c) => sum + (c.mrr ?? 0), 0);
    return { totalProjects, totalContacts, totalMRR };
  }, [clients]);

  return (
    <AppShell>
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
        <PageHead
          eyebrow="Clients"
          title="Companies"
          lede="All client and partner accounts. Open one to see contacts, projects, history and HubSpot connection."
          actions={
            <>
              <Btn variant="ghost" size="md">
                <Filter size={14} />
                Filter
              </Btn>
              <Link href="/settings/integrations/hubspot/import">
                <Btn variant="ghost" size="md">
                  <Download size={14} />
                  Import from HubSpot
                </Btn>
              </Link>
              <Btn
                variant="primary"
                size="md"
                onClick={() => {
                  setCreateError(null);
                  setNewOpen(true);
                }}
              >
                <Plus size={14} />
                New client
              </Btn>
            </>
          }
        />

        <StatsGrid cols={4} className="mb-6">
          <Stat
            label="Total clients"
            value={String(clients.length)}
            delta={`${counts.active} active, ${counts.partner} partner`}
          />
          <Stat
            label="Active engagements"
            value={`${stats.totalProjects} ${stats.totalProjects === 1 ? "project" : "projects"}`}
            delta={`across ${counts.active} client${counts.active === 1 ? "" : "s"}`}
            deltaTone={stats.totalProjects > 0 ? "up" : "neutral"}
          />
          <Stat
            label="Contacts"
            value={String(stats.totalContacts)}
            delta="combined across clients"
          />
          <Stat
            label="Open MRR"
            value={formatMRR(stats.totalMRR, "ZAR")}
            delta={
              stats.totalMRR > 0
                ? "active retainer revenue"
                : "no retainers active"
            }
          />
        </StatsGrid>

        <Tabs
          items={tabDefs.map((t) => ({
            id: t.id,
            label: t.label,
            count: counts[t.id as keyof typeof counts]
          }))}
          active={active}
          onChange={setActive}
        />

        {loading ? (
          <Empty title="Loading clients…" sub="One moment." />
        ) : filtered.length === 0 ? (
          <Empty
            title="No clients in this view"
            sub={
              active === "all"
                ? "Add one to start scoping work."
                : "Try a different tab above."
            }
            action={
              active === "all" ? (
                <div className="flex items-center gap-2 justify-center">
                  <Link href="/settings/integrations/hubspot/import">
                    <Btn variant="ghost" size="sm">
                      <Download size={12} />
                      Import from HubSpot
                    </Btn>
                  </Link>
                  <Btn
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setCreateError(null);
                      setNewOpen(true);
                    }}
                  >
                    <Plus size={14} />
                    New client
                  </Btn>
                </div>
              ) : undefined
            }
          />
        ) : (
          <Tbl>
            <THead>
              <Tr>
                <Th style={{ width: "30%" }}>Client</Th>
                <Th>Industry</Th>
                <Th>Champion</Th>
                <Th>Projects</Th>
                <Th>Contacts</Th>
                <Th>HubSpot</Th>
                <Th>MRR</Th>
                <Th>Last touch</Th>
                <Th style={{ width: 40 }}></Th>
              </Tr>
            </THead>
            <TBody>
              {filtered.map((c) => {
                const portalConnected = clientPortalConnected(c);
                return (
                  <Tr
                    key={c.id}
                    onClick={() => {
                      window.location.assign(`/clients/${c.id}`);
                    }}
                  >
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar size="lg" initials={c.name.slice(0, 2)} />
                        <CellPrimary sub={c.website ?? null}>
                          {c.name}
                        </CellPrimary>
                      </div>
                    </Td>
                    <Td muted>{c.industry ?? "—"}</Td>
                    <Td>{c.championName ?? "—"}</Td>
                    <Td>
                      <span className="font-mono">{countOf(c.activeProjects)}</span>
                    </Td>
                    <Td>
                      <span className="font-mono">
                        {c.contactsCount ?? countOf(c.contacts)}
                      </span>
                    </Td>
                    <Td>
                      {portalConnected ? (
                        <Pill tone="ok" dot>
                          {clientPortalLabel(c)}
                        </Pill>
                      ) : (
                        <Pill dot>Not linked</Pill>
                      )}
                    </Td>
                    <Td>
                      <span className="font-mono">
                        {formatMRR(c.mrr, c.currency)}
                      </span>
                    </Td>
                    <Td muted>
                      <span className="font-mono text-[12px]">
                        {formatDate(c.lastTouch ?? c.updatedAt)}
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

      {newOpen && (
        <>
          <button
            type="button"
            aria-label="Close new client"
            onClick={() => !creating && setNewOpen(false)}
            className="fixed inset-0 z-40 bg-black/70"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(520px,92vw)] bg-ink-1 border border-ink-4 rounded-[14px] p-6 shadow-elev-pop"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-[10px] tracking-[0.14em] uppercase text-text-3 font-semibold">
                  Clients
                </p>
                <h3 className="text-[16px] font-semibold mt-1 -tracking-[0.01em]">
                  New client
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !creating && setNewOpen(false)}
                className="text-text-3 hover:text-text-1 p-1 rounded-md transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-[12.5px] text-text-2 m-0 mb-3">
              Add a client manually. Already in HubSpot?{" "}
              <Link
                href="/settings/integrations/hubspot/import"
                className="text-status-ok hover:underline inline-flex items-center gap-1"
              >
                Import from HubSpot
                <ExternalLink size={11} />
              </Link>{" "}
              to pull companies + contacts in one shot.
            </p>
            <div className="grid gap-3">
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold">
                  Client name <span className="text-status-danger">*</span>
                </span>
                <input
                  autoFocus
                  value={newDraft.name}
                  onChange={(e) =>
                    setNewDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  placeholder="e.g. Magnisol"
                  className="mt-1.5 w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[13px] text-text-1 outline-none focus:border-[rgba(74,219,192,0.35)]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold">
                  Website
                </span>
                <input
                  type="url"
                  value={newDraft.website}
                  onChange={(e) =>
                    setNewDraft((d) => ({ ...d, website: e.target.value }))
                  }
                  placeholder="https://"
                  className="mt-1.5 w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[13px] text-text-1 outline-none focus:border-[rgba(74,219,192,0.35)] font-mono"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold">
                    Industry
                  </span>
                  <input
                    value={newDraft.industry}
                    onChange={(e) =>
                      setNewDraft((d) => ({ ...d, industry: e.target.value }))
                    }
                    placeholder="e.g. Logistics"
                    className="mt-1.5 w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[13px] text-text-1 outline-none focus:border-[rgba(74,219,192,0.35)]"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold">
                    Region
                  </span>
                  <input
                    value={newDraft.region}
                    onChange={(e) =>
                      setNewDraft((d) => ({ ...d, region: e.target.value }))
                    }
                    placeholder="e.g. ZA"
                    className="mt-1.5 w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[13px] text-text-1 outline-none focus:border-[rgba(74,219,192,0.35)]"
                  />
                </label>
              </div>
              {createError && (
                <p className="text-[12px] text-status-danger m-0">
                  {createError}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Btn
                variant="ghost"
                size="md"
                onClick={() => setNewOpen(false)}
                disabled={creating}
              >
                Cancel
              </Btn>
              <Btn
                variant="primary"
                size="md"
                onClick={() => void handleCreate()}
                disabled={creating || !newDraft.name.trim()}
              >
                <Plus size={12} />
                {creating ? "Creating…" : "Create client"}
              </Btn>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
