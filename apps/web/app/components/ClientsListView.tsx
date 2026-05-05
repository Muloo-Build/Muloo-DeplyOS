"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Download, Filter, Plus } from "lucide-react";

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
  const [active, setActive] = useState("all");
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);

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
              <Btn variant="ghost" size="md">
                <Download size={14} />
                Export
              </Btn>
              <Link href="/clients?new=1">
                <Btn variant="primary" size="md">
                  <Plus size={14} />
                  New client
                </Btn>
              </Link>
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
                <Btn variant="primary" size="sm">
                  <Plus size={14} />
                  New client
                </Btn>
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
    </AppShell>
  );
}
