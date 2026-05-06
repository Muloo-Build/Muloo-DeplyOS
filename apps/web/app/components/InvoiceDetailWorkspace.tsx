"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AppShell from "./AppShell";

interface InvoiceDetail {
  id: string;
  reference: string;
  invoiceType: string;
  amount: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  xeroUrl: string | null;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "VOID";
  notes: string | null;
  sentAt: string | null;
  paidAt: string | null;
  billToEntity: {
    id: string;
    name: string;
    type: "CLIENT" | "PARTNER_AGENCY";
  } | null;
  retainer: {
    id: string;
    client: { id: string; name: string } | null;
  } | null;
  retainerPeriod: {
    id: string;
    periodMonth: string;
    blockHours: number;
  } | null;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}

export default function InvoiceDetailWorkspace({
  invoiceId
}: {
  invoiceId: string;
}) {
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [form, setForm] = useState({
    status: "DRAFT" as InvoiceDetail["status"],
    xeroUrl: "",
    notes: ""
  });

  async function loadInvoice() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}`, {
        credentials: "include"
      });
      const body = (await response.json().catch(() => null)) as
        | { invoice?: InvoiceDetail; error?: string }
        | null;
      if (!response.ok || !body?.invoice) {
        throw new Error(body?.error ?? "Failed to load invoice");
      }

      setInvoice(body.invoice);
      setForm({
        status: body.invoice.status,
        xeroUrl: body.invoice.xeroUrl ?? "",
        notes: body.invoice.notes ?? ""
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInvoice();
  }, [invoiceId]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    setError(null);
    try {
      const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: form.status,
          xeroUrl: form.xeroUrl || null,
          notes: form.notes || null
        })
      });
      const body = (await response.json().catch(() => null)) as
        | { invoice?: InvoiceDetail; error?: string }
        | null;
      if (!response.ok || !body?.invoice) {
        throw new Error(body?.error ?? "Failed to update invoice");
      }

      setFeedback("Invoice updated.");
      await loadInvoice();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update invoice");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
        <header>
          <Link
            href={invoice?.retainer ? `/retainers/${invoice.retainer.id}` : "/retainers"}
            className="text-sm font-medium text-[#51d0b0] hover:underline"
          >
            ← Back
          </Link>
          <p className="mt-4 text-xs uppercase tracking-[0.14em] text-text-3">
            Invoice detail
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            {invoice?.reference ?? "Loading invoice"}
          </h1>
        </header>

        {error ? (
          <div className="rounded-[14px] border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}
        {feedback ? (
          <div className="rounded-[14px] border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {feedback}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-text-3">
              Invoice record
            </p>
            <div className="mt-4 space-y-3 text-sm text-text-2">
              <p>
                <span className="text-text-3">Type:</span>{" "}
                {invoice?.invoiceType.replace(/_/g, " ") ?? "—"}
              </p>
              <p>
                <span className="text-text-3">Bill to:</span>{" "}
                {invoice?.billToEntity?.name ?? "—"}
              </p>
              <p>
                <span className="text-text-3">Retainer client:</span>{" "}
                {invoice?.retainer?.client?.name ?? "—"}
              </p>
              <p>
                <span className="text-text-3">Issue date:</span>{" "}
                {invoice ? formatDate(invoice.issueDate) : "—"}
              </p>
              <p>
                <span className="text-text-3">Due date:</span>{" "}
                {invoice ? formatDate(invoice.dueDate) : "—"}
              </p>
              <p>
                <span className="text-text-3">Amount:</span>{" "}
                {invoice ? formatMoney(invoice.amount, invoice.currency) : "—"}
              </p>
              <p>
                <span className="text-text-3">Sent at:</span>{" "}
                {formatDateTime(invoice?.sentAt ?? null)}
              </p>
              <p>
                <span className="text-text-3">Paid at:</span>{" "}
                {formatDateTime(invoice?.paidAt ?? null)}
              </p>
              {invoice?.retainerPeriod ? (
                <p>
                  <span className="text-text-3">Linked period:</span>{" "}
                  {formatDate(invoice.retainerPeriod.periodMonth)} · {invoice.retainerPeriod.blockHours}h
                </p>
              ) : null}
            </div>

            {invoice?.billToEntity?.type === "PARTNER_AGENCY" ? (
              <Link
                href={`/agencies/${invoice.billToEntity.id}`}
                className="mt-4 inline-flex text-sm font-medium text-[#51d0b0] hover:underline"
              >
                Open agency profile →
              </Link>
            ) : null}
          </section>

          <form
            onSubmit={handleSave}
            className="rounded-[14px] border border-ink-4 bg-ink-1 p-5"
          >
            <p className="text-xs uppercase tracking-[0.14em] text-text-3">
              Update record
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Keep DeployOS aligned with Xero
            </h2>

            <div className="mt-5 grid gap-4">
              <label className="text-sm text-text-2">
                Status
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as InvoiceDetail["status"]
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="SENT">SENT</option>
                  <option value="PAID">PAID</option>
                  <option value="OVERDUE">OVERDUE</option>
                  <option value="VOID">VOID</option>
                </select>
              </label>

              <label className="text-sm text-text-2">
                Xero URL
                <input
                  type="url"
                  value={form.xeroUrl}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, xeroUrl: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                  placeholder="https://go.xero.com/..."
                />
              </label>

              <label className="text-sm text-text-2">
                Notes
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  rows={6}
                  className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={saving || loading}
              className="mt-5 inline-flex items-center rounded-xl bg-[#51d0b0] px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-[#6be0c1] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save invoice record"}
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
