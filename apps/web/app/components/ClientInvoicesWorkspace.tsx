"use client";

import { useEffect, useMemo, useState } from "react";

import ClientShell from "./ClientShell";
import { type PortalExperience } from "./portalExperience";

type InvoiceWorkspaceState =
  | {
      connected: false;
      matchingStrategy: string;
      accessibleClients: Array<{ id: string; name: string }>;
      accessibleProjects: Array<{
        id: string;
        name: string;
        clientName: string;
        role: string;
      }>;
    }
  | {
      connected: true;
      tenantName?: string | null;
      matchingStrategy: string;
      accessibleClients: Array<{ id: string; name: string }>;
      accessibleProjects: Array<{
        id: string;
        name: string;
        clientName: string;
        role: string;
      }>;
      summary: {
        currency: string;
        totalOutstanding: number;
        totalOverdue: number;
        invoices: Array<{
          invoiceNumber: string;
          contact: string;
          dueDate: string;
          amountDue: number;
          status: string;
          isOverdue: boolean;
        }>;
      };
    };

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
    return value || "Not set";
  }

  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export default function ClientInvoicesWorkspace({
  portalExperience = "client"
}: {
  portalExperience?: PortalExperience;
}) {
  const [state, setState] = useState<InvoiceWorkspaceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvoices() {
      try {
        const response = await fetch("/api/client/invoices", {
          credentials: "include"
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error ?? "Failed to load invoices");
        }

        setState((await response.json()) as InvoiceWorkspaceState);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load invoices"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadInvoices();
  }, []);

  const invoiceCount = useMemo(
    () => (state?.connected ? state.summary.invoices.length : 0),
    [state]
  );

  return (
    <ClientShell
      portalExperience={portalExperience}
      title="Invoices"
      subtitle="Review open invoices and due dates for the projects your team can access."
    >
      <section className="rounded-3xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
          Finance
        </p>
        <h1 className="mt-3 text-3xl font-bold font-heading text-white">
          Invoice review and payment tracking
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-text-secondary">
          This area is designed for accountants and client admins to keep an eye
          on open invoices alongside project approvals. Invoice matching is
          currently based on the Xero contact name for the clients attached to
          your accessible projects.
        </p>
      </section>

      {error ? (
        <div className="mt-6 rounded-2xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5 text-sm text-text-secondary">
          Loading invoices...
        </div>
      ) : null}

      {!loading && state ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                Accessible clients
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {state.accessibleClients.length}
              </p>
            </div>
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                Open invoices
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {invoiceCount}
              </p>
            </div>
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                Outstanding
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {state.connected
                  ? formatMoney(
                      state.summary.totalOutstanding,
                      state.summary.currency
                    )
                  : "Connect Xero"}
              </p>
            </div>
          </div>

          {!state.connected ? (
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-6">
              <h2 className="text-xl font-semibold text-white">
                Finance connection needed
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-text-secondary">
                Muloo hasn&apos;t connected Xero for this workspace yet, so there
                are no live invoices to review here. Once the finance connection
                is active, accountants will be able to track due dates and
                outstanding balances from the portal.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Open invoices
                  </h2>
                  <p className="mt-2 text-sm text-text-secondary">
                    Connected to {state.tenantName ?? "your Xero tenant"}.
                  </p>
                </div>
                <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-white">
                  Overdue:{" "}
                  <span className="font-semibold">
                    {formatMoney(
                      state.summary.totalOverdue,
                      state.summary.currency
                    )}
                  </span>
                </div>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-left text-sm text-text-secondary">
                  <thead>
                    <tr className="border-b border-[rgba(255,255,255,0.08)] text-xs uppercase tracking-[0.18em] text-text-muted">
                      <th className="pb-3 pr-4 font-medium">Invoice</th>
                      <th className="pb-3 pr-4 font-medium">Billing contact</th>
                      <th className="pb-3 pr-4 font-medium">Due date</th>
                      <th className="pb-3 pr-4 font-medium">Status</th>
                      <th className="pb-3 font-medium">Amount due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.summary.invoices.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-6 text-sm text-text-secondary"
                        >
                          No open invoices matched the clients linked to your
                          portal access.
                        </td>
                      </tr>
                    ) : (
                      state.summary.invoices.map((invoice) => (
                        <tr
                          key={`${invoice.invoiceNumber}-${invoice.contact}`}
                          className="border-b border-[rgba(255,255,255,0.05)]"
                        >
                          <td className="py-4 pr-4 font-medium text-white">
                            {invoice.invoiceNumber || "Pending number"}
                          </td>
                          <td className="py-4 pr-4">{invoice.contact}</td>
                          <td className="py-4 pr-4">
                            {formatDate(invoice.dueDate)}
                          </td>
                          <td className="py-4 pr-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                invoice.isOverdue
                                  ? "bg-[rgba(224,80,96,0.16)] text-[#ff9aa8]"
                                  : "bg-[rgba(123,226,239,0.16)] text-[#7be2ef]"
                              }`}
                            >
                              {invoice.isOverdue ? "Overdue" : invoice.status}
                            </span>
                          </td>
                          <td className="py-4 font-medium text-white">
                            {formatMoney(
                              invoice.amountDue,
                              state.summary.currency
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </ClientShell>
  );
}
