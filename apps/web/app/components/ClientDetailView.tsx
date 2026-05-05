"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Building2,
  Calendar,
  ChevronRight,
  ExternalLink,
  Folder,
  Globe,
  Home,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  Receipt,
  User,
  Users
} from "lucide-react";

import AppShell from "./AppShell";
import { Avatar } from "./ui/Avatar";
import { Btn } from "./ui/Btn";
import { Empty } from "./ui/Empty";
import { HealthCell, HealthStrip } from "./ui/HealthStrip";
import { KeyValue } from "./ui/KeyValue";
import { Panel, PanelBody, PanelHead } from "./ui/Panel";
import { Pill } from "./ui/Pill";
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
  website?: string | null;
  championName?: string | null;
  championEmail?: string | null;
  activeProjects?: number;
  contactsCount?: number;
  contacts?: number;
  mrr?: number | null;
  currency?: string;
  lastTouch?: string | null;
  createdAt?: string;
  updatedAt?: string;
  isPartner?: boolean;
  tags?: string[];
  hubSpotPortal?: {
    portalId?: string;
    displayName?: string;
    connected?: boolean;
    hubDomain?: string | null;
  } | null;
  portal?: { connected?: boolean; hub?: string };
  summary?: string | null;
}

interface ContactRecord {
  id: string;
  firstName: string;
  lastName: string;
  title?: string | null;
  email: string;
  phone?: string | null;
  canApproveQuotes?: boolean;
  lastNoteAt?: string | null;
  isChampion?: boolean;
}

interface ProjectRecord {
  id: string;
  name: string;
  clientId?: string | null;
  status?: string;
  stage?: string | null;
  stageLabel?: string | null;
  health?: "ok" | "warn" | "danger";
  nextAction?: string | null;
  hours?: { used?: number; allocated?: number };
  progress?: number;
  hubs?: string[];
  selectedHubs?: string[];
  hubsInScope?: string[];
  defaultWorkspacePath?: string | null;
  updatedAt?: string;
}

interface QuoteRecord {
  id: string;
  reference?: string;
  status?: string;
  totals?: { grandTotalZar?: number };
  currency?: string;
  projectId?: string;
  projectName?: string;
  updatedAt?: string;
}

interface ActivityEntry {
  id: string;
  who: string;
  action: string;
  target: string;
  when: string;
  icon?: React.ReactNode;
}

const tabs = [
  { id: "overview", label: "Overview", icon: <Home size={13} /> },
  { id: "contacts", label: "Contacts", icon: <Users size={13} /> },
  { id: "projects", label: "Projects", icon: <Folder size={13} /> },
  { id: "activity", label: "Activity", icon: <Activity size={13} /> },
  { id: "commercials", label: "Commercials", icon: <Receipt size={13} /> }
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

function statusLabel(status?: string): string {
  if (!status) return "Active";
  const map: Record<string, string> = {
    in_delivery: "In delivery",
    "in-flight": "In flight",
    awaiting_approval: "Awaiting approval",
    blocked_external: "Blocked",
    shared: "Shared",
    live: "Live",
    completed: "Completed",
    archived: "Archived",
    discovery: "Discovery"
  };
  return map[status] ?? status.replace(/_/g, " ");
}

function fmtMoney(n: number | null | undefined, currency = "ZAR"): string {
  if (n === null || n === undefined || n === 0) return "—";
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(n);
}

function isPartner(c: ClientRecord | null): boolean {
  if (!c) return false;
  return Boolean(c.isPartner) || (c.tags ?? []).includes("partner");
}

interface ClientDetailViewProps {
  clientId: string;
}

export default function ClientDetailView({ clientId }: ClientDetailViewProps) {
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const [clientsRes, contactsRes, projectsRes, quotesRes] = await Promise.all([
          fetch("/api/clients").then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch(`/api/clients/${encodeURIComponent(clientId)}/contacts`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch("/api/projects").then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch("/api/quotes").then((r) => (r.ok ? r.json() : null)).catch(() => null)
        ]);

        if (cancelled) return;

        const clients: ClientRecord[] = Array.isArray(clientsRes?.clients)
          ? clientsRes.clients
          : Array.isArray(clientsRes)
            ? clientsRes
            : [];
        const found = clients.find((c) => c.id === clientId) ?? null;
        setClient(found);

        const contactsList: ContactRecord[] = Array.isArray(contactsRes?.contacts)
          ? contactsRes.contacts
          : Array.isArray(contactsRes)
            ? contactsRes
            : [];
        setContacts(contactsList);

        const allProjects: ProjectRecord[] = Array.isArray(projectsRes?.projects)
          ? projectsRes.projects
          : Array.isArray(projectsRes)
            ? projectsRes
            : [];
        setProjects(allProjects.filter((p) => p.clientId === clientId));

        const allQuotes: QuoteRecord[] = Array.isArray(quotesRes?.quotes)
          ? quotesRes.quotes
          : Array.isArray(quotesRes)
            ? quotesRes
            : [];
        setQuotes(
          allQuotes.filter((q) =>
            allProjects.some((p) => p.id === q.projectId && p.clientId === clientId)
          )
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const champion = useMemo(() => {
    if (!client) return null;
    const explicit = contacts.find(
      (c) =>
        c.email === client.championEmail ||
        `${c.firstName} ${c.lastName}`.trim() === client.championName
    );
    if (explicit) return explicit;
    if (client.championName) {
      const [firstName, ...rest] = client.championName.split(" ");
      return {
        id: "champion",
        firstName: firstName ?? "",
        lastName: rest.join(" "),
        title: "Champion",
        email: client.championEmail ?? "",
        phone: null
      } as ContactRecord;
    }
    return null;
  }, [client, contacts]);

  const portalConnected =
    Boolean(client?.hubSpotPortal?.portalId) ||
    Boolean(client?.portal?.connected);

  const activity = useMemo<ActivityEntry[]>(() => {
    const out: ActivityEntry[] = [];
    if (client?.updatedAt) {
      out.push({
        id: "updated",
        who: "System",
        action: "updated client",
        target: client.name,
        when: relativeDate(client.updatedAt),
        icon: <Activity size={12} />
      });
    }
    projects.slice(0, 3).forEach((p) => {
      out.push({
        id: `proj_${p.id}`,
        who: "Operator",
        action: "touched project",
        target: p.name,
        when: relativeDate(p.updatedAt),
        icon: <Folder size={12} />
      });
    });
    quotes.slice(0, 3).forEach((q) => {
      out.push({
        id: `q_${q.id}`,
        who: "Operator",
        action: `quote ${q.status ?? ""}`.trim(),
        target: `${q.reference ?? q.id}`,
        when: relativeDate(q.updatedAt),
        icon: <Receipt size={12} />
      });
    });
    if (client?.createdAt) {
      out.push({
        id: "created",
        who: "Operator",
        action: "created client",
        target: client.name,
        when: relativeDate(client.createdAt),
        icon: <Plus size={12} />
      });
    }
    return out;
  }, [client, projects, quotes]);

  if (loading && !client) {
    return (
      <AppShell>
        <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
          <Empty title="Loading client…" sub="One moment." />
        </div>
      </AppShell>
    );
  }

  if (!client) {
    return (
      <AppShell>
        <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
          <Empty
            title="Client not found"
            sub="No client matches this id."
            action={
              <Link href="/clients">
                <Btn variant="ghost" size="sm">
                  Back to clients
                </Btn>
              </Link>
            }
          />
        </div>
      </AppShell>
    );
  }

  const championName = champion
    ? `${champion.firstName} ${champion.lastName}`.trim()
    : null;
  const partner = isPartner(client);

  return (
    <AppShell>
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
        {/* HEADER */}
        <header className="flex items-start justify-between gap-6 mb-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[12px] text-text-3 mb-2">
              <Link
                href="/clients"
                className="hover:text-text-1 transition-colors"
              >
                Clients
              </Link>
              {client.industry && (
                <>
                  <ChevronRight size={11} className="text-text-4" />
                  <span className="truncate">{client.industry}</span>
                </>
              )}
            </div>
            <div className="flex items-start gap-3.5 mb-2">
              <Avatar
                size="lg"
                initials={client.name.slice(0, 2)}
                className="!w-12 !h-12 !text-[16px]"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                  <h1 className="text-[24px] font-semibold m-0 -tracking-[0.02em] text-text-1">
                    {client.name}
                  </h1>
                  <Pill tone={partner ? "info" : "ok"} dot>
                    {partner ? "Partner" : "Active client"}
                  </Pill>
                </div>
                <div className="flex items-center gap-4 flex-wrap text-[12.5px] text-text-3">
                  {client.website && (
                    <a
                      href={client.website}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 hover:text-text-1 transition-colors"
                    >
                      <Globe size={12} />
                      {client.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                  {client.region && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={12} />
                      {client.region}
                    </span>
                  )}
                  {championName && (
                    <span className="inline-flex items-center gap-1.5">
                      <User size={12} />
                      Champion: {championName}
                    </span>
                  )}
                  {client.createdAt && (
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar size={12} />
                      Since {new Date(client.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Btn variant="ghost" size="md">
              <MessageSquare size={13} />
              Message
            </Btn>
            {portalConnected && (
              <a
                href={`https://app.hubspot.com/contacts/${client.hubSpotPortal?.portalId ?? ""}`}
                target="_blank"
                rel="noreferrer"
              >
                <Btn variant="ghost" size="md">
                  <ExternalLink size={13} />
                  Open in HubSpot
                </Btn>
              </a>
            )}
            <Link href={`/projects/new?clientId=${clientId}`}>
              <Btn variant="primary" size="md">
                <Plus size={13} />
                New project
              </Btn>
            </Link>
          </div>
        </header>

        {/* HEALTH STRIP */}
        <HealthStrip className="mb-6">
          <HealthCell
            label="Active projects"
            value={String(projects.length)}
            sub={
              projects.filter((p) => p.health === "warn").length > 0
                ? `${projects.filter((p) => p.health === "warn").length} flagged`
                : "all on track"
            }
            tone={
              projects.some((p) => p.health === "danger")
                ? "danger"
                : projects.some((p) => p.health === "warn")
                  ? "warn"
                  : "ok"
            }
          />
          <HealthCell
            label="Contacts"
            value={String(contacts.length)}
            sub={`${contacts.filter((c) => c.canApproveQuotes).length} approvers`}
          />
          <HealthCell
            label="Open quotes"
            value={String(quotes.filter((q) => q.status === "shared" || q.status === "draft").length)}
            sub={`${quotes.length} total in history`}
          />
          <HealthCell
            label="MRR"
            value={fmtMoney(client.mrr, client.currency ?? "ZAR")}
            sub={client.mrr ? "active retainer" : "no retainer"}
            tone={client.mrr ? "ok" : "muted"}
          />
          <HealthCell
            label="HubSpot portal"
            value={portalConnected ? "Connected" : "Disconnected"}
            sub={
              portalConnected
                ? client.hubSpotPortal?.displayName ??
                  `Portal ${client.hubSpotPortal?.portalId ?? ""}`
                : "not yet linked"
            }
            tone={portalConnected ? "ok" : "muted"}
          />
        </HealthStrip>

        {/* BODY 2-col */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
          {/* CENTER */}
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
                  t.id === "contacts"
                    ? contacts.length
                    : t.id === "projects"
                      ? projects.length
                      : t.id === "commercials"
                        ? quotes.length
                        : undefined
              }))}
              active={tab}
              onChange={setTab}
            />

            {tab === "overview" && (
              <div className="flex flex-col gap-5">
                <Panel>
                  <PanelHead title="Company profile" />
                  <PanelBody>
                    <p className="m-0 text-[13.5px] text-text-2 leading-[1.6]">
                      {client.summary ??
                        `${client.name}${client.industry ? ` · ${client.industry}` : ""}${client.region ? ` · ${client.region}` : ""}.`}
                    </p>
                  </PanelBody>
                </Panel>

                <Panel>
                  <PanelHead title="Recent activity" />
                  <PanelBody>
                    {activity.length === 0 ? (
                      <div className="text-text-3 text-[12.5px] text-center py-2">
                        No activity yet.
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        {activity.slice(0, 5).map((a, i) => (
                          <div
                            key={a.id}
                            className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 relative pb-4 last:pb-0"
                          >
                            {i < Math.min(activity.length, 5) - 1 && (
                              <span className="absolute left-[13px] top-[22px] bottom-0 w-px bg-ink-4" />
                            )}
                            <div className="w-7 h-7 rounded-full bg-ink-2 border border-ink-4 grid place-items-center text-text-3 z-[1]">
                              {a.icon ?? <Activity size={12} />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-[12.5px] flex-wrap">
                                <span className="text-text-1 font-medium">
                                  {a.who}
                                </span>
                                <span className="text-text-3 text-[11.5px]">
                                  {a.action}
                                </span>
                                <span className="text-text-3 text-[11.5px] ml-auto font-mono">
                                  {a.when}
                                </span>
                              </div>
                              <div className="text-[12.5px] text-text-2 mt-1 truncate">
                                {a.target}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </PanelBody>
                </Panel>

                <Panel>
                  <PanelHead
                    title="Active projects"
                    right={
                      <Link href={`/projects?clientId=${clientId}`}>
                        <Btn variant="ghost" size="sm">
                          View all <ArrowRight size={11} />
                        </Btn>
                      </Link>
                    }
                  />
                  <PanelBody flush>
                    {projects.length === 0 ? (
                      <Empty
                        icon={<Folder size={20} />}
                        title="No projects yet"
                        sub={`Create one to start scoping work for ${client.name}.`}
                      />
                    ) : (
                      <div>
                        {projects.slice(0, 5).map((p, i) => (
                          <Link
                            key={p.id}
                            href={p.defaultWorkspacePath ?? `/projects/${p.id}`}
                            className={`grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3.5 items-center px-[18px] py-3 cursor-pointer hover:bg-ink-2 transition-colors ${
                              i < projects.slice(0, 5).length - 1
                                ? "border-b border-ink-4"
                                : ""
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-[13px] font-medium truncate">
                                {p.name}
                              </div>
                              <div className="text-[11.5px] text-text-3 mt-0.5 truncate">
                                Next: {p.nextAction ?? "—"}
                              </div>
                            </div>
                            <Pill
                              tone={
                                p.health === "danger"
                                  ? "danger"
                                  : p.health === "warn"
                                    ? "warn"
                                    : "ok"
                              }
                              dot
                            >
                              {p.stageLabel ?? statusLabel(p.status)}
                            </Pill>
                            <ChevronRight size={14} className="text-text-3" />
                          </Link>
                        ))}
                      </div>
                    )}
                  </PanelBody>
                </Panel>
              </div>
            )}

            {tab === "contacts" && (
              <ContactsTab clientId={clientId} contacts={contacts} />
            )}

            {tab === "projects" && (
              <ProjectsTab clientId={clientId} projects={projects} />
            )}

            {tab === "activity" && <ActivityTab activity={activity} />}

            {tab === "commercials" && <CommercialsTab quotes={quotes} />}
          </div>

          {/* RIGHT RAIL */}
          <aside className="flex flex-col gap-3.5 xl:sticky xl:top-[80px] self-start">
            <Panel>
              <PanelHead title="Champion" />
              <PanelBody className="grid gap-3">
                {champion ? (
                  <>
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        size="lg"
                        initials={`${champion.firstName[0] ?? ""}${champion.lastName[0] ?? ""}`}
                      />
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold truncate">
                          {`${champion.firstName} ${champion.lastName}`.trim()}
                        </div>
                        {champion.title && (
                          <div className="text-[11.5px] text-text-3 truncate">
                            {champion.title}
                          </div>
                        )}
                      </div>
                    </div>
                    {champion.email && (
                      <a
                        href={`mailto:${champion.email}`}
                        className="flex items-center gap-2 text-[12px] text-text-2 hover:text-text-1 transition-colors"
                      >
                        <Mail size={12} />
                        <span className="font-mono break-all">
                          {champion.email}
                        </span>
                      </a>
                    )}
                    {champion.phone && (
                      <a
                        href={`tel:${champion.phone}`}
                        className="flex items-center gap-2 text-[12px] text-text-2 hover:text-text-1 transition-colors"
                      >
                        <Phone size={12} />
                        <span className="font-mono">{champion.phone}</span>
                      </a>
                    )}
                  </>
                ) : (
                  <div className="text-text-3 text-[12.5px]">
                    No champion set.
                  </div>
                )}
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHead title="HubSpot portal" />
              <PanelBody className="grid gap-3">
                <div className="flex items-center justify-between bg-ink-2 border border-ink-4 rounded-[10px] px-2.5 py-2">
                  <span
                    className={`text-[12px] flex items-center gap-1.5 ${
                      portalConnected ? "text-status-ok" : "text-status-danger"
                    }`}
                  >
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ${
                        portalConnected ? "bg-status-ok" : "bg-status-danger"
                      }`}
                    />
                    {portalConnected ? "Connected" : "Disconnected"}
                  </span>
                  <Btn variant="ghost" size="sm">
                    {portalConnected ? "Manage" : "Connect"}
                  </Btn>
                </div>
                {portalConnected && client.hubSpotPortal?.portalId && (
                  <KeyValue
                    label="Portal ID"
                    value={client.hubSpotPortal.portalId}
                    mono
                  />
                )}
                {portalConnected && client.hubSpotPortal?.hubDomain && (
                  <KeyValue
                    label="Hub domain"
                    value={client.hubSpotPortal.hubDomain}
                    mono
                  />
                )}
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHead title="Quick stats" />
              <PanelBody className="grid gap-2.5">
                <RowStat
                  label="Active projects"
                  value={`${projects.length}`}
                />
                <RowStat
                  label="Contacts"
                  value={`${contacts.length}`}
                />
                <RowStat
                  label="Quotes in history"
                  value={`${quotes.length}`}
                />
                <RowStat
                  label="MRR"
                  value={fmtMoney(client.mrr, client.currency ?? "ZAR")}
                  tone={client.mrr ? "ok" : "neutral"}
                />
                <RowStat
                  label="Last touch"
                  value={relativeDate(client.lastTouch ?? client.updatedAt)}
                />
              </PanelBody>
            </Panel>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function ContactsTab({
  clientId,
  contacts
}: {
  clientId: string;
  contacts: ContactRecord[];
}) {
  if (contacts.length === 0) {
    return (
      <Empty
        icon={<Users size={20} />}
        title="No contacts yet"
        sub="Add stakeholders, approvers, and contributors here."
        action={
          <Link href={`/clients/${clientId}?addContact=1`}>
            <Btn variant="primary" size="sm">
              <Plus size={12} />
              Add contact
            </Btn>
          </Link>
        }
      />
    );
  }
  return (
    <Tbl>
      <THead>
        <Tr>
          <Th>Name</Th>
          <Th>Role</Th>
          <Th>Email</Th>
          <Th>Phone</Th>
          <Th>Status</Th>
          <Th>Last activity</Th>
        </Tr>
      </THead>
      <TBody>
        {contacts.map((c) => {
          const initials = `${c.firstName[0] ?? ""}${c.lastName[0] ?? ""}`.toUpperCase() || "?";
          return (
            <Tr key={c.id}>
              <Td>
                <div className="flex items-center gap-2.5">
                  <Avatar size="sm" initials={initials} />
                  <CellPrimary>
                    {`${c.firstName} ${c.lastName}`.trim() || "—"}
                  </CellPrimary>
                </div>
              </Td>
              <Td muted>{c.title ?? "—"}</Td>
              <Td>
                <span className="font-mono text-[12px]">{c.email}</span>
              </Td>
              <Td muted>
                <span className="font-mono text-[12px]">{c.phone ?? "—"}</span>
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
                  {relativeDate(c.lastNoteAt)}
                </span>
              </Td>
            </Tr>
          );
        })}
      </TBody>
    </Tbl>
  );
}

function ProjectsTab({
  clientId,
  projects
}: {
  clientId: string;
  projects: ProjectRecord[];
}) {
  if (projects.length === 0) {
    return (
      <Empty
        icon={<Folder size={20} />}
        title="No projects yet"
        sub="Spin one up to start scoping work for this client."
        action={
          <Link href={`/projects/new?clientId=${clientId}`}>
            <Btn variant="primary" size="sm">
              <Plus size={12} />
              New project
            </Btn>
          </Link>
        }
      />
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      {projects.map((p) => {
        const tone =
          p.health === "danger"
            ? "danger"
            : p.health === "warn"
              ? "warn"
              : "ok";
        const hubs = p.hubsInScope ?? p.selectedHubs ?? p.hubs ?? [];
        return (
          <Link
            key={p.id}
            href={p.defaultWorkspacePath ?? `/projects/${p.id}`}
            className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3.5 items-center px-[18px] py-3.5 bg-ink-1 border border-ink-4 rounded-[14px] hover:border-ink-5 transition-colors"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[14px] font-semibold truncate">
                  {p.name}
                </span>
                <Pill tone={tone} dot>
                  {p.stageLabel ?? statusLabel(p.status)}
                </Pill>
              </div>
              <div className="text-[12px] text-text-3 truncate">
                {hubs.length > 0 ? hubs.join(" + ") : "—"}
                {p.nextAction && (
                  <>
                    {" "}
                    · Next: <span className="text-text-2">{p.nextAction}</span>
                  </>
                )}
              </div>
            </div>
            <span className="font-mono text-[12px] text-text-3">
              {p.hours?.used ?? 0}/{p.hours?.allocated ?? "—"}
              {p.hours?.allocated ? "h" : ""}
            </span>
            <ChevronRight size={14} className="text-text-3" />
          </Link>
        );
      })}
    </div>
  );
}

function ActivityTab({ activity }: { activity: ActivityEntry[] }) {
  if (activity.length === 0) {
    return (
      <Empty
        icon={<Activity size={20} />}
        title="No activity yet"
        sub="Activity from projects, quotes, and messages will surface here."
      />
    );
  }
  return (
    <Panel>
      <PanelBody>
        <div className="flex flex-col">
          {activity.map((a, i) => (
            <div
              key={a.id}
              className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 relative pb-4 last:pb-0"
            >
              {i < activity.length - 1 && (
                <span className="absolute left-[13px] top-[22px] bottom-0 w-px bg-ink-4" />
              )}
              <div className="w-7 h-7 rounded-full bg-ink-2 border border-ink-4 grid place-items-center text-text-3 z-[1]">
                {a.icon ?? <Activity size={12} />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[12.5px] flex-wrap">
                  <span className="text-text-1 font-medium">{a.who}</span>
                  <span className="text-text-3 text-[11.5px]">{a.action}</span>
                  <span className="text-text-3 text-[11.5px] ml-auto font-mono">
                    {a.when}
                  </span>
                </div>
                <div className="text-[12.5px] text-text-2 mt-1 truncate">
                  {a.target}
                </div>
              </div>
            </div>
          ))}
        </div>
      </PanelBody>
    </Panel>
  );
}

function CommercialsTab({ quotes }: { quotes: QuoteRecord[] }) {
  if (quotes.length === 0) {
    return (
      <Empty
        icon={<Receipt size={20} />}
        title="No quotes yet"
        sub="Quotes for this client will appear here once you create one."
      />
    );
  }
  return (
    <Panel>
      <PanelHead title="Quotes" />
      <PanelBody flush>
        {quotes.map((q, i) => (
          <Link
            key={q.id}
            href={`/quotes/${q.id}`}
            className={`grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-3.5 items-center px-[18px] py-3 hover:bg-ink-2 transition-colors ${
              i < quotes.length - 1 ? "border-b border-ink-4" : ""
            }`}
          >
            <div className="min-w-0">
              <div className="text-[13px] font-medium truncate">
                {q.reference ?? q.id}
              </div>
              {q.projectName && (
                <div className="text-[11.5px] text-text-3 truncate">
                  {q.projectName}
                </div>
              )}
            </div>
            <span className="font-mono text-[12.5px]">
              {fmtMoney(q.totals?.grandTotalZar ?? null, q.currency ?? "ZAR")}
            </span>
            <Pill
              tone={
                q.status === "approved" || q.status === "won"
                  ? "ok"
                  : q.status === "lost"
                    ? "danger"
                    : "info"
              }
              dot
            >
              {q.status ?? "draft"}
            </Pill>
            <ChevronRight size={14} className="text-text-3" />
          </Link>
        ))}
      </PanelBody>
    </Panel>
  );
}

function RowStat({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "warn" | "danger";
}) {
  const valueColor =
    tone === "ok"
      ? "text-status-ok"
      : tone === "warn"
        ? "text-status-warn"
        : tone === "danger"
          ? "text-status-danger"
          : "text-text-1";
  return (
    <div className="flex items-center justify-between text-[12.5px]">
      <span className="text-text-3">{label}</span>
      <span className={`font-mono ${valueColor}`}>{value}</span>
    </div>
  );
}
