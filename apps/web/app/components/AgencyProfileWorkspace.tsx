"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AppShell from "./AppShell";

interface AgencyDetail {
  id: string;
  name: string;
  type: "PARTNER_AGENCY";
  vatNumber: string | null;
  address: string | null;
  primaryContactEmail: string | null;
  primaryContactName: string | null;
  outstanding: number;
  ytdInvoiced: number;
  billedClients: Array<{
    id: string;
    name: string;
    slug: string;
    retainerIds: string[];
  }>;
  invoices: Array<{
    id: string;
    reference: string;
    amount: number;
    currency: string;
    issueDate: string;
    dueDate: string;
    status: string;
    retainer: {
      id: string;
      client: { id: string; name: string } | null;
    } | null;
  }>;
}

function formatMoney(amount: number, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export default function AgencyProfileWorkspace({
  agencyId
}: {
  agencyId: string;
}) {
  const [agency, setAgency] = useState<AgencyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAgency() {
      try {
        const response = await fetch(`/api/agencies/${encodeURIComponent(agencyId)}`, {
          credentials: "include"
        });
        const body = (await response.json().catch(() => null)) as
          | { agency?: AgencyDetail; error?: string }
          | null;

        if (!response.ok || !body?.agency) {
          throw new Error(body?.error ?? "Failed to load agency");
        }

        setAgency(body.agency);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load agency");
      } finally {
        setLoading(false);
      }
    }

    void loadAgency();
  }, [agencyId]);

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
        <header>
          <Link href="/retainers" className="text-sm font-medium text-[#51d0b0] hover:underline">
            ← Back to retainers
          </Link>
          <p className="mt-4 text-xs uppercase tracking-[0.18em] text-text-muted">
            Agency profile
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            {agency?.name ?? "Loading agency"}
          </h1>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-2xl border border-white/10 bg-background-card p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
              Commercial identity
            </p>
            <div className="mt-4 space-y-3 text-sm text-text-secondary">
              <p>
                <span className="text-text-muted">VAT:</span> {agency?.vatNumber ?? "Not set"}
              </p>
              <p>
                <span className="text-text-muted">Primary contact:</span>{" "}
                {agency?.primaryContactName ?? "Not set"}
              </p>
              <p>
                <span className="text-text-muted">Email:</span>{" "}
                {agency?.primaryContactEmail ?? "Not set"}
              </p>
              <p>
                <span className="text-text-muted">Address:</span> {agency?.address ?? "Not set"}
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                  Outstanding
                </p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {formatMoney(agency?.outstanding ?? 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                  YTD invoiced
                </p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {formatMoney(agency?.ytdInvoiced ?? 0)}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-background-card p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
              End clients billed through this agency
            </p>
            <div className="mt-4 space-y-3">
              {agency?.billedClients.map((client) => (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="block rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition hover:border-white/15 hover:bg-white/[0.05]"
                >
                  <p className="font-semibold text-white">{client.name}</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {client.retainerIds.length} linked retainers
                  </p>
                </Link>
              ))}
              {!loading && agency && agency.billedClients.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/12 p-4 text-sm text-text-secondary">
                  No end clients are currently billed through this agency.
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-white/10 bg-background-card p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
            Invoice records
          </p>
          <div className="mt-4 space-y-3">
            {agency?.invoices.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/invoices/${invoice.id}`}
                className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition hover:border-white/15 hover:bg-white/[0.05] md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-white">{invoice.reference}</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {invoice.retainer?.client?.name ?? "Unknown client"} · issued {formatDate(invoice.issueDate)}
                  </p>
                </div>
                <div className="text-sm text-text-secondary md:text-right">
                  <p className="text-white">{formatMoney(invoice.amount, invoice.currency)}</p>
                  <p>{invoice.status}</p>
                  <p>Due {formatDate(invoice.dueDate)}</p>
                </div>
              </Link>
            ))}
            {!loading && agency && agency.invoices.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/12 p-4 text-sm text-text-secondary">
                No invoices have been recorded for this agency yet.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
