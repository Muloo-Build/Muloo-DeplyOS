"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AppShell from "./AppShell";

interface BusinessClient {
  id: string;
  name: string;
  clientRoles: string[];
  contacts: Array<{ id: string }>;
  projects: Array<{ id: string }>;
}

interface BusinessProject {
  id: string;
  name: string;
  status: string;
  quoteApprovalStatus?: string | null;
  updatedAt: string;
  client: {
    name: string;
  };
}

interface BusinessUser {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
}

interface BusinessPortal {
  id: string;
  portalId: string;
  displayName: string;
  connected: boolean;
  connectedEmail?: string | null;
  hubDomain?: string | null;
}

interface XeroInvoiceState {
  connected: boolean;
  tenantName?: string | null;
  summary?: {
    currency: string;
    totalOutstanding: number;
    totalOverdue: number;
    invoices: Array<{
      invoiceNumber: string;
      contact: string;
      dueDate: string;
      amountDue: number;
      isOverdue: boolean;
      status: string;
    }>;
  };
}

function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amount);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export default function BusinessWorkspace() {
  const [clients, setClients] = useState<BusinessClient[]>([]);
  const [projects, setProjects] = useState<BusinessProject[]>([]);
  const [users, setUsers] = useState<BusinessUser[]>([]);
  const [portals, setPortals] = useState<BusinessPortal[]>([]);
  const [xero, setXero] = useState<XeroInvoiceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadWorkspace() {
      try {
        const [
          clientsResponse,
          projectsResponse,
          usersResponse,
          portalsResponse,
          xeroResponse
        ] = await Promise.all([
          fetch("/api/clients"),
          fetch("/api/projects?limit=100"),
          fetch("/api/users"),
          fetch("/api/portals"),
          fetch("/api/workspace/xero/invoices")
        ]);

        if (
          !clientsResponse.ok ||
          !projectsResponse.ok ||
          !usersResponse.ok ||
          !portalsResponse.ok ||
          !xeroResponse.ok
        ) {
          throw new Error("Failed to load business workspace");
        }

        const [clientsBody, projectsBody, usersBody, portalsBody, xeroBody] =
          await Promise.all([
            clientsResponse.json(),
            projectsResponse.json(),
            usersResponse.json(),
            portalsResponse.json(),
            xeroResponse.json()
          ]);

        setClients(clientsBody.clients ?? []);
        setProjects(projectsBody.projects ?? []);
        setUsers(usersBody.users ?? []);
        setPortals(portalsBody.portals ?? []);
        setXero(xeroBody as XeroInvoiceState);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load business workspace"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadWorkspace();
  }, []);

  const clientCount = clients.filter((client) =>
    client.clientRoles.includes("client")
  ).length;
  const pendingApprovals = useMemo(
    () =>
      projects.filter(
        (project) => (project.quoteApprovalStatus ?? "draft") === "shared"
      ),
    [projects]
  );
  const connectedPortals = portals.filter((portal) => portal.connected);
  const activeUsers = users.filter((user) => user.isActive);
  const outstandingInvoices = xero?.connected
    ? xero.summary?.totalOutstanding ?? 0
    : 0;
  const overdueInvoices = xero?.connected
    ? xero.summary?.totalOverdue ?? 0
    : 0;
  const invoiceCurrency = xero?.summary?.currency ?? "USD";

  return (
    <AppShell>
      <div className="min-h-screen px-4 py-6 sm:px-6 sm:py-8">
        <section className="rounded-[32px] border border-[rgba(255,255,255,0.07)] bg-[radial-gradient(circle_at_top_left,rgba(124,92,191,0.22),transparent_34%),linear-gradient(180deg,#0f1735_0%,#0a0f24_100%)] p-6 sm:p-8">
          <p className="text-sm uppercase tracking-[0.28em] text-text-muted">
            Business Admin
          </p>
          <h1 className="mt-4 max-w-4xl text-3xl font-bold font-heading text-white sm:text-4xl">
            Run the NextTrip business portal from one operational surface.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-text-secondary sm:text-base">
            This workspace is tuned for the business side of the product: manage
            client accounts, control portal users, review quote approvals, and
            give finance a clear invoice and payment view while CRM integrations
            mature.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Clients",
                value: String(clientCount),
                detail: "Accounts in the directory"
              },
              {
                label: "Pending approvals",
                value: String(pendingApprovals.length),
                detail: "Quotes waiting on client sign-off"
              },
              {
                label: "Outstanding invoices",
                value: xero?.connected
                  ? formatMoney(outstandingInvoices, invoiceCurrency)
                  : "Connect Xero",
                detail: xero?.connected
                  ? `${formatMoney(overdueInvoices, invoiceCurrency)} overdue`
                  : "Finance connection pending"
              },
              {
                label: "Business users",
                value: String(activeUsers.length),
                detail: "Active admin and operations logins"
              }
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-5"
              >
                <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                  {item.label}
                </p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {item.value}
                </p>
                <p className="mt-2 text-sm text-text-secondary">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-2xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-5 text-sm text-text-secondary">
            Loading business workspace...
          </div>
        ) : (
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <section className="rounded-3xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                      Core lanes
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">
                      The five flows this business view should own
                    </h2>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {[
                    {
                      title: "Client directory",
                      body: "Create client records, upload contacts, and assign access before projects go live.",
                      href: "/clients",
                      cta: "Open clients"
                    },
                    {
                      title: "CRM sync",
                      body: `${connectedPortals.length} HubSpot portal${connectedPortals.length === 1 ? "" : "s"} connected. Agency CMS/quoting can land as the next provider once its API details are known.`,
                      href: "/settings/providers",
                      cta: "Manage integrations"
                    },
                    {
                      title: "Approvals",
                      body: `${pendingApprovals.length} quote${pendingApprovals.length === 1 ? "" : "s"} currently waiting for client approval or follow-up.`,
                      href: "/projects",
                      cta: "Review quotes"
                    },
                    {
                      title: "Finance",
                      body: xero?.connected
                        ? `Live Xero feed connected for ${xero.tenantName ?? "your finance tenant"}.`
                        : "Connect Xero to unlock the accountant-facing invoice area.",
                      href: "/settings/workspace",
                      cta: "Open workspace settings"
                    },
                    {
                      title: "User access",
                      body: "Create business logins for ops and finance, then invite client users into the client portal with role-based approval rights.",
                      href: "/settings/team",
                      cta: "Manage users"
                    }
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5"
                    >
                      <h3 className="text-lg font-semibold text-white">
                        {item.title}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-text-secondary">
                        {item.body}
                      </p>
                      <Link
                        href={item.href}
                        className="mt-4 inline-flex rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[rgba(255,255,255,0.08)]"
                      >
                        {item.cta}
                      </Link>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                      Approvals
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">
                      Client admin approval queue
                    </h2>
                  </div>
                  <Link
                    href="/projects"
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-2 text-sm font-medium text-white"
                  >
                    Open projects
                  </Link>
                </div>

                <div className="mt-6 space-y-3">
                  {pendingApprovals.length === 0 ? (
                    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4 text-sm text-text-secondary">
                      No quote approvals are waiting right now.
                    </div>
                  ) : (
                    pendingApprovals.slice(0, 6).map((project) => (
                      <div
                        key={project.id}
                        className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-white">
                              {project.name}
                            </p>
                            <p className="mt-1 text-sm text-text-secondary">
                              {project.client.name} · Updated {formatDate(project.updatedAt)}
                            </p>
                          </div>
                          <Link
                            href={`/projects/${encodeURIComponent(project.id)}/quote`}
                            className="rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm font-medium text-white"
                          >
                            Review quote
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-3xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                      Finance
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">
                      Invoice visibility
                    </h2>
                  </div>
                  <Link
                    href="/settings/workspace"
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-2 text-sm font-medium text-white"
                  >
                    Finance settings
                  </Link>
                </div>

                <div className="mt-6 space-y-3">
                  {!xero?.connected ? (
                    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4 text-sm leading-7 text-text-secondary">
                      Connect Xero to surface accountant-friendly invoice review
                      and payment tracking in both the business workspace and the
                      client portal.
                    </div>
                  ) : (
                    <>
                      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                        <p className="text-sm text-text-secondary">
                          Tenant
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {xero.tenantName ?? "Connected Xero tenant"}
                        </p>
                      </div>
                      {(xero.summary?.invoices ?? []).slice(0, 5).map((invoice) => (
                        <div
                          key={`${invoice.invoiceNumber}-${invoice.contact}`}
                          className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold text-white">
                                {invoice.invoiceNumber || "Pending number"}
                              </p>
                              <p className="mt-1 text-sm text-text-secondary">
                                {invoice.contact}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                invoice.isOverdue
                                  ? "bg-[rgba(224,80,96,0.16)] text-[#ff9aa8]"
                                  : "bg-[rgba(123,226,239,0.16)] text-[#7be2ef]"
                              }`}
                            >
                              {invoice.isOverdue ? "Overdue" : invoice.status}
                            </span>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-sm">
                            <span className="text-text-secondary">
                              Due {formatDate(invoice.dueDate)}
                            </span>
                            <span className="font-semibold text-white">
                              {formatMoney(
                                invoice.amountDue,
                                xero.summary?.currency ?? "USD"
                              )}
                            </span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                      CRM
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">
                      Connected portals
                    </h2>
                  </div>
                  <Link
                    href="/settings/providers"
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-2 text-sm font-medium text-white"
                  >
                    Provider settings
                  </Link>
                </div>

                <div className="mt-6 space-y-3">
                  {portals.slice(0, 6).map((portal) => (
                    <div
                      key={portal.id}
                      className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-white">
                            {portal.displayName}
                          </p>
                          <p className="mt-1 text-sm text-text-secondary">
                            Portal {portal.portalId}
                            {portal.hubDomain ? ` · ${portal.hubDomain}` : ""}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            portal.connected
                              ? "bg-[rgba(45,212,160,0.16)] text-[#51d0b0]"
                              : "bg-[rgba(255,255,255,0.08)] text-text-secondary"
                          }`}
                        >
                          {portal.connected ? "Connected" : "Pending"}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.02)] p-4 text-sm leading-7 text-text-secondary">
                    Agency CMS / quoting integration placeholder: once the API
                    details land, this is the right surface for direct quote sync
                    and client ingestion alongside HubSpot.
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
