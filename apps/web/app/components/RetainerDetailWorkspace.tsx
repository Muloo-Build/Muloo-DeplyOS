"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AppShell from "./AppShell";

interface InvoiceRecord {
  id: string;
  reference: string;
  retainerId: string;
  retainerPeriodId: string | null;
  invoiceType: "RETAINER_BLOCK" | "TOP_UP" | "OTHER";
  amount: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  xeroUrl: string | null;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "VOID";
  notes: string | null;
}

interface RetainerDetail {
  id: string;
  client: { id: string; name: string; slug: string } | null;
  billToEntity: { id: string; name: string; type: "CLIENT" | "PARTNER_AGENCY" } | null;
  serviceLine: "TECHNICAL_DELIVERY" | "CONSULTING";
  blockSize: number;
  rate: number;
  currency: string;
  startDate: string;
  status: string;
  scopeSummary?: string | null;
  deliverables?: Array<{ title: string; description?: string }> | null;
  approvalTerms?: string | null;
  requirements?: string | null;
  spawnedProjects?: Array<{
    id: string;
    name: string;
    status: string;
    createdAt: string;
  }>;
  periods: Array<{
    id: string;
    periodMonth: string;
    blockHours: number;
    rolledInHours: number;
    borrowedFromNext: number;
    consumedHours: number;
    approvedTopUpHours: number;
    overageHours: number;
    rolledOutHours: number;
    balance: number;
    status: string;
    topUps: Array<{
      id: string;
      hours: number;
      rate: number;
      status: string;
    }>;
    ledgerEntries: Array<{
      id: string;
      entryType: string;
      hoursDelta: number;
      createdAt: string;
      billedHours: number | null;
      overrideReason: string | null;
    }>;
  }>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatServiceLine(value: string) {
  return value === "TECHNICAL_DELIVERY" ? "Technical Delivery" : "Consulting";
}

function toDateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default function RetainerDetailWorkspace({
  retainerId
}: {
  retainerId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [retainer, setRetainer] = useState<RetainerDetail | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [lineage, setLineage] = useState<{
    bornFromProject: {
      id: string;
      name: string;
      status: string;
      completedAt: string | null;
    } | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [spawning, setSpawning] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    reference: "",
    invoiceType: "RETAINER_BLOCK" as "RETAINER_BLOCK" | "TOP_UP" | "OTHER",
    retainerPeriodId: "",
    issueDate: toDateInputValue(new Date()),
    dueDate: toDateInputValue(new Date(Date.now() + 14 * 86400000)),
    amount: "",
    xeroUrl: "",
    notes: "",
    status: "DRAFT" as "DRAFT" | "SENT"
  });
  const [hoursForm, setHoursForm] = useState({
    hours: "",
    occurredAt: toDateInputValue(new Date()),
    description: ""
  });
  const [loggingHours, setLoggingHours] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    serviceLine: "TECHNICAL_DELIVERY" as "TECHNICAL_DELIVERY" | "CONSULTING",
    blockSize: 20,
    status: "DRAFT",
    startDate: toDateInputValue(new Date()),
    scopeSummary: "",
    requirements: "",
    approvalTerms: ""
  });

  function openEdit() {
    if (!retainer) return;
    setEditForm({
      serviceLine: retainer.serviceLine,
      blockSize: retainer.blockSize,
      status: retainer.status,
      startDate: retainer.startDate.slice(0, 10),
      scopeSummary: retainer.scopeSummary ?? "",
      requirements: retainer.requirements ?? "",
      approvalTerms: retainer.approvalTerms ?? ""
    });
    setEditOpen(true);
  }

  async function handleSaveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!retainer) return;
    setSavingEdit(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/retainers/${encodeURIComponent(retainerId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            serviceLine: editForm.serviceLine,
            blockSize: Number(editForm.blockSize),
            status: editForm.status,
            startDate: editForm.startDate,
            scopeSummary: editForm.scopeSummary || null,
            requirements: editForm.requirements || null,
            approvalTerms: editForm.approvalTerms || null
          })
        }
      );
      const body = (await response.json().catch(() => null)) as
        | { retainer?: RetainerDetail; error?: string }
        | null;
      if (!response.ok || !body?.retainer) {
        throw new Error(body?.error ?? "Failed to update retainer");
      }
      setFeedback("Retainer updated.");
      setEditOpen(false);
      await loadDetail();
    } catch (editError) {
      setError(
        editError instanceof Error
          ? editError.message
          : "Failed to update retainer"
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function loadDetail() {
    setLoading(true);
    setError(null);
    try {
      const [retainerResponse, invoicesResponse] = await Promise.all([
        fetch(`/api/retainers/${encodeURIComponent(retainerId)}`, {
          credentials: "include"
        }),
        fetch(`/api/invoices?retainerId=${encodeURIComponent(retainerId)}`, {
          credentials: "include"
        })
      ]);

      const retainerBody = (await retainerResponse.json().catch(() => null)) as
        | { retainer?: RetainerDetail; error?: string }
        | null;
      const invoicesBody = (await invoicesResponse.json().catch(() => null)) as
        | { invoices?: InvoiceRecord[]; error?: string }
        | null;

      if (!retainerResponse.ok || !retainerBody?.retainer) {
        throw new Error(retainerBody?.error ?? "Failed to load retainer");
      }

      setRetainer(retainerBody.retainer);
      setInvoices(invoicesBody?.invoices ?? []);
      setInvoiceForm((current) => ({
        ...current,
        retainerPeriodId:
          current.retainerPeriodId ||
          retainerBody.retainer.periods[0]?.id ||
          ""
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load retainer");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
    void (async () => {
      try {
        const res = await fetch(
          `/api/retainers/${encodeURIComponent(retainerId)}/lineage`,
          { credentials: "include" }
        );
        const body = await res.json().catch(() => null);
        if (res.ok && body?.lineage) {
          setLineage(body.lineage);
        }
      } catch {
        // lineage is best-effort; ignore
      }
    })();
  }, [retainerId]);

  const selectedPeriod = useMemo(
    () =>
      retainer?.periods.find((period) => period.id === invoiceForm.retainerPeriodId) ??
      retainer?.periods[0] ??
      null,
    [invoiceForm.retainerPeriodId, retainer]
  );

  useEffect(() => {
    if (!retainer || !selectedPeriod) {
      return;
    }

    let nextAmount = "";
    if (invoiceForm.invoiceType === "RETAINER_BLOCK") {
      nextAmount = String(Number((selectedPeriod.blockHours * retainer.rate).toFixed(2)));
    } else if (invoiceForm.invoiceType === "TOP_UP") {
      const total = selectedPeriod.topUps
        .filter((topUp) => topUp.status === "APPROVED" || topUp.status === "INVOICED")
        .reduce((sum, topUp) => sum + topUp.hours * topUp.rate, 0);
      nextAmount = String(Number(total.toFixed(2)));
    }

    if (nextAmount) {
      setInvoiceForm((current) =>
        current.amount === nextAmount ? current : { ...current, amount: nextAmount }
      );
    }
  }, [invoiceForm.invoiceType, retainer, selectedPeriod]);

  async function handleLogHours(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!retainer) return;
    setLoggingHours(true);
    setFeedback(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/retainers/${encodeURIComponent(retainerId)}/log-hours`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            hours: Number(hoursForm.hours),
            occurredAt: hoursForm.occurredAt
              ? new Date(hoursForm.occurredAt).toISOString()
              : undefined,
            description: hoursForm.description || undefined
          })
        }
      );

      if (response.status === 402) {
        const overage = (await response.json().catch(() => null)) as
          | { shortfall?: number; suggestedTopUpHours?: number }
          | null;
        throw new Error(
          `Logging these hours would trigger an overage of ${overage?.shortfall ?? "?"}h. A top-up quote of ${overage?.suggestedTopUpHours ?? "?"}h has been generated — approve it before logging more hours.`
        );
      }

      const body = (await response.json().catch(() => null)) as
        | { ledgerEntry?: unknown; error?: string }
        | null;

      if (!response.ok || !body?.ledgerEntry) {
        throw new Error(body?.error ?? "Failed to log hours");
      }

      setFeedback(`Logged ${hoursForm.hours}h against retainer.`);
      setHoursForm({
        hours: "",
        occurredAt: toDateInputValue(new Date()),
        description: ""
      });
      await loadDetail();
    } catch (logError) {
      setError(
        logError instanceof Error ? logError.message : "Failed to log hours"
      );
    } finally {
      setLoggingHours(false);
    }
  }

  async function handleDeleteRetainer() {
    if (!retainer) return;
    const confirmed = window.confirm(
      `Delete this retainer for ${retainer.client?.name ?? "client"}?\n\nThis cascades and removes all associated periods, ledger entries, rollover buckets, and any DRAFT invoices. SENT or PAID invoices block deletion.\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/retainers/${encodeURIComponent(retainerId)}`,
        {
          method: "DELETE",
          credentials: "include"
        }
      );
      const body = (await response.json().catch(() => null)) as
        | { deleted?: boolean; error?: string }
        | null;
      if (!response.ok || !body?.deleted) {
        throw new Error(body?.error ?? "Failed to delete retainer");
      }
      router.push("/retainers");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete retainer"
      );
    }
  }

  async function handleCreateInvoice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!retainer) return;
    setSavingInvoice(true);
    setFeedback(null);
    setError(null);

    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reference: invoiceForm.reference,
          retainerId,
          retainerPeriodId: invoiceForm.retainerPeriodId || null,
          invoiceType: invoiceForm.invoiceType,
          amount: Number(invoiceForm.amount),
          issueDate: invoiceForm.issueDate,
          dueDate: invoiceForm.dueDate,
          xeroUrl: invoiceForm.xeroUrl || null,
          notes: invoiceForm.notes || null,
          status: invoiceForm.status
        })
      });
      const body = (await response.json().catch(() => null)) as
        | { invoice?: InvoiceRecord; error?: string }
        | null;

      if (!response.ok || !body?.invoice) {
        throw new Error(body?.error ?? "Failed to record invoice");
      }

      setFeedback("Invoice recorded.");
      await loadDetail();
      router.push(`/invoices/${body.invoice.id}`);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to record invoice"
      );
    } finally {
      setSavingInvoice(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link href="/retainers" className="text-sm font-medium text-[#51d0b0] hover:underline">
              ← Back to retainers
            </Link>
            <p className="mt-4 text-xs uppercase tracking-[0.14em] text-text-3">
              Retainer detail
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              {retainer?.client?.name ?? "Loading retainer"}
            </h1>
            <p className="mt-2 text-sm text-text-2">
              {retainer
                ? `${formatServiceLine(retainer.serviceLine)} · ${retainer.blockSize}h/month · ${formatMoney(retainer.rate, retainer.currency)}`
                : "Loading commercial detail..."}
            </p>
          </div>
          {retainer ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openEdit}
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Edit retainer
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteRetainer()}
                className="inline-flex items-center justify-center rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-100 transition hover:bg-rose-500/20"
              >
                Delete retainer
              </button>
            </div>
          ) : null}
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
        {lineage?.bornFromProject ? (
          <div className="rounded-[14px] border border-[rgba(73,205,225,0.3)] bg-[rgba(73,205,225,0.08)] px-4 py-3 text-sm text-[#7be2ef]">
            <span className="text-xs uppercase tracking-[0.14em] text-text-3">
              Born from project
            </span>
            <Link
              href={`/projects/${lineage.bornFromProject.id}`}
              className="ml-3 font-semibold text-white hover:underline"
            >
              {lineage.bornFromProject.name}
            </Link>
            <span className="ml-2 text-xs text-text-2">
              · {lineage.bornFromProject.status}
            </span>
          </div>
        ) : null}

        <div className="rounded-[14px] border border-ink-4 bg-ink-1 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                Follow-on project
              </p>
              <p className="mt-1 text-sm text-text-2">
                Spawn a new project from this retainer. Carries scope, hubs,
                and lineage forward from the source project.
              </p>
            </div>
            <button
              type="button"
              disabled={spawning}
              onClick={async () => {
                setSpawning(true);
                setError(null);
                setFeedback(null);
                try {
                  const res = await fetch(
                    `/api/retainers/${encodeURIComponent(retainerId)}/spawn-project`,
                    {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({})
                    }
                  );
                  const body = await res.json().catch(() => null);
                  if (!res.ok) {
                    throw new Error(
                      body?.error ?? "Failed to spawn project"
                    );
                  }
                  setFeedback(
                    `Spawned project ${body?.project?.name ?? ""}`.trim()
                  );
                  if (body?.project?.id) {
                    router.push(`/projects/${body.project.id}`);
                  }
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Failed to spawn project"
                  );
                } finally {
                  setSpawning(false);
                }
              }}
              className="rounded-lg border border-[rgba(81,208,176,0.4)] bg-[rgba(81,208,176,0.12)] px-3 py-1.5 text-xs font-medium text-[#9be8d2] transition hover:bg-[rgba(81,208,176,0.2)] disabled:opacity-50"
            >
              {spawning ? "Spawning…" : "Spawn follow-on project"}
            </button>
          </div>
          {retainer?.spawnedProjects && retainer.spawnedProjects.length > 0 ? (
            <div className="mt-3 border-t border-ink-4 pt-3">
              <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                Spawned projects
              </p>
              <ul className="mt-2 space-y-1.5">
                {retainer.spawnedProjects.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <Link
                      href={`/projects/${p.id}`}
                      className="font-medium text-white hover:underline"
                    >
                      {p.name}
                    </Link>
                    <span className="text-xs text-text-2">
                      · {p.status} · {formatDate(p.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-4">
              <div className="rounded-[14px] border border-ink-4 bg-ink-1 p-5">
                <p className="text-xs uppercase tracking-[0.14em] text-text-3">Status</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {retainer?.status ?? "—"}
                </p>
              </div>
              <div className="rounded-[14px] border border-ink-4 bg-ink-1 p-5">
                <p className="text-xs uppercase tracking-[0.14em] text-text-3">Bill to</p>
                <p className="mt-2 text-base font-semibold text-white">
                  {retainer?.billToEntity?.name ?? "—"}
                </p>
                {retainer?.billToEntity?.type === "PARTNER_AGENCY" ? (
                  <Link
                    href={`/agencies/${retainer.billToEntity.id}`}
                    className="mt-2 inline-flex text-sm font-medium text-[#51d0b0] hover:underline"
                  >
                    Open agency profile →
                  </Link>
                ) : null}
              </div>
              <div className="rounded-[14px] border border-ink-4 bg-ink-1 p-5">
                <p className="text-xs uppercase tracking-[0.14em] text-text-3">Start</p>
                <p className="mt-2 text-base font-semibold text-white">
                  {retainer ? formatDate(retainer.startDate) : "—"}
                </p>
              </div>
              <div className="rounded-[14px] border border-ink-4 bg-ink-1 p-5">
                <p className="text-xs uppercase tracking-[0.14em] text-text-3">Open invoices</p>
                <p className="mt-2 text-base font-semibold text-white">
                  {invoices.filter((invoice) => invoice.status === "SENT" || invoice.status === "OVERDUE").length}
                </p>
              </div>
            </section>

            <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                    Period history
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Usage and reconciliation
                  </h2>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {retainer?.periods.map((period) => (
                  <div
                    key={period.id}
                    className="rounded-[14px] border border-white/8 bg-white/[0.03] p-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-base font-semibold text-white">
                          {formatDate(period.periodMonth)}
                        </p>
                        <p className="mt-1 text-sm text-text-2">
                          {period.blockHours}h block · {period.rolledInHours}h rolled in ·{" "}
                          {period.approvedTopUpHours}h approved top-ups
                        </p>
                      </div>
                      <div className="text-sm text-text-2 md:text-right">
                        <p className="text-white">{period.consumedHours}h consumed</p>
                        <p>Balance {period.balance}h</p>
                        <p>{period.status}</p>
                      </div>
                    </div>

                    {period.topUps.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {period.topUps.map((topUp) => (
                          <span
                            key={topUp.id}
                            className="rounded-full border border-ink-4 px-3 py-1 text-xs text-text-2"
                          >
                            Top-up {topUp.hours}h · {topUp.status}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                    Scope & Terms
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Deliverables and approval conditions
                  </h2>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {retainer?.scopeSummary ? (
                  <div>
                    <p className="text-sm font-medium text-text-2">Scope Summary</p>
                    <p className="mt-2 text-sm text-white whitespace-pre-wrap">{retainer.scopeSummary}</p>
                  </div>
                ) : null}

                {retainer?.deliverables && Array.isArray(retainer.deliverables) && retainer.deliverables.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium text-text-2">Deliverables</p>
                    <ul className="mt-2 space-y-2">
                      {retainer.deliverables.map((deliverable: any, idx: number) => (
                        <li key={idx} className="text-sm text-white">
                          <span className="font-semibold">{deliverable.title}</span>
                          {deliverable.description ? (
                            <p className="mt-1 text-text-2">{deliverable.description}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {retainer?.requirements ? (
                  <div>
                    <p className="text-sm font-medium text-text-2">Requirements</p>
                    <p className="mt-2 text-sm text-white whitespace-pre-wrap">{retainer.requirements}</p>
                  </div>
                ) : null}

                {retainer?.approvalTerms ? (
                  <div>
                    <p className="text-sm font-medium text-text-2">Approval Terms</p>
                    <p className="mt-2 text-sm text-white whitespace-pre-wrap">{retainer.approvalTerms}</p>
                  </div>
                ) : null}

                {!retainer?.scopeSummary && !retainer?.deliverables && !retainer?.requirements && !retainer?.approvalTerms ? (
                  <p className="text-sm text-text-2">No scope or terms defined for this retainer.</p>
                ) : null}
              </div>
            </section>

            <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                    Invoice records
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Manual record-keeping linked to this retainer
                  </h2>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {invoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/invoices/${invoice.id}`}
                    className="flex flex-col gap-3 rounded-[14px] border border-white/8 bg-white/[0.03] p-4 transition hover:border-white/15 hover:bg-white/[0.05] md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="text-base font-semibold text-white">
                        {invoice.reference}
                      </p>
                      <p className="mt-1 text-sm text-text-2">
                        {invoice.invoiceType.replace(/_/g, " ")} · {formatDate(invoice.issueDate)}
                      </p>
                    </div>
                    <div className="text-sm text-text-2 md:text-right">
                      <p className="text-white">
                        {formatMoney(invoice.amount, invoice.currency)}
                      </p>
                      <p>{invoice.status}</p>
                    </div>
                  </Link>
                ))}

                {!loading && invoices.length === 0 ? (
                  <div className="rounded-[14px] border border-dashed border-white/12 p-4 text-sm text-text-2">
                    No invoice records yet for this retainer.
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <form
              onSubmit={handleLogHours}
              className="rounded-[14px] border border-ink-4 bg-ink-1 p-5"
            >
              <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                Log hours
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Deduct hours from this retainer
              </h2>
              <p className="mt-1 text-sm text-text-2">
                For ad-hoc work, calls or advisory time not tied to a delivery task. Hours land in the period that contains the work date.
              </p>

              <div className="mt-5 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm text-text-2">
                    Hours
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      max="1000"
                      value={hoursForm.hours}
                      onChange={(event) =>
                        setHoursForm((current) => ({
                          ...current,
                          hours: event.target.value
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                      required
                      placeholder="e.g. 1.5"
                    />
                  </label>
                  <label className="text-sm text-text-2">
                    Date worked
                    <input
                      type="date"
                      value={hoursForm.occurredAt}
                      onChange={(event) =>
                        setHoursForm((current) => ({
                          ...current,
                          occurredAt: event.target.value
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                      required
                    />
                  </label>
                </div>

                <label className="text-sm text-text-2">
                  Description (optional)
                  <textarea
                    value={hoursForm.description}
                    onChange={(event) =>
                      setHoursForm((current) => ({
                        ...current,
                        description: event.target.value
                      }))
                    }
                    rows={3}
                    placeholder="What did you work on?"
                    className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={
                  loggingHours ||
                  !retainer ||
                  retainer.status !== "ACTIVE" ||
                  !hoursForm.hours
                }
                className="mt-5 inline-flex items-center rounded-xl bg-[#51d0b0] px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-[#6be0c1] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loggingHours ? "Logging..." : "Log hours"}
              </button>

              {retainer && retainer.status !== "ACTIVE" ? (
                <p className="mt-3 text-xs text-amber-300">
                  Retainer is {retainer.status}. Activate it before logging hours.
                </p>
              ) : null}
            </form>

            <form
              onSubmit={handleCreateInvoice}
              className="rounded-[14px] border border-ink-4 bg-ink-1 p-5"
            >
              <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                Record invoice
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Capture the Xero draft here
              </h2>

            <div className="mt-5 grid gap-4">
              <label className="text-sm text-text-2">
                Reference
                <input
                  type="text"
                  value={invoiceForm.reference}
                  onChange={(event) =>
                    setInvoiceForm((current) => ({ ...current, reference: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                  required
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-text-2">
                  Invoice type
                  <select
                    value={invoiceForm.invoiceType}
                    onChange={(event) =>
                      setInvoiceForm((current) => ({
                        ...current,
                        invoiceType: event.target.value as typeof current.invoiceType
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                  >
                    <option value="RETAINER_BLOCK">Retainer block</option>
                    <option value="TOP_UP">Top-up</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>

                <label className="text-sm text-text-2">
                  Linked period
                  <select
                    value={invoiceForm.retainerPeriodId}
                    onChange={(event) =>
                      setInvoiceForm((current) => ({
                        ...current,
                        retainerPeriodId: event.target.value
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                  >
                    {retainer?.periods.map((period) => (
                      <option key={period.id} value={period.id}>
                        {formatDate(period.periodMonth)} · {period.status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-text-2">
                  Issue date
                  <input
                    type="date"
                    value={invoiceForm.issueDate}
                    onChange={(event) =>
                      setInvoiceForm((current) => ({ ...current, issueDate: event.target.value }))
                    }
                    className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                    required
                  />
                </label>
                <label className="text-sm text-text-2">
                  Due date
                  <input
                    type="date"
                    value={invoiceForm.dueDate}
                    onChange={(event) =>
                      setInvoiceForm((current) => ({ ...current, dueDate: event.target.value }))
                    }
                    className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                    required
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-text-2">
                  Amount
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={invoiceForm.amount}
                    onChange={(event) =>
                      setInvoiceForm((current) => ({ ...current, amount: event.target.value }))
                    }
                    className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                    required
                  />
                </label>
                <label className="text-sm text-text-2">
                  Status
                  <select
                    value={invoiceForm.status}
                    onChange={(event) =>
                      setInvoiceForm((current) => ({
                        ...current,
                        status: event.target.value as "DRAFT" | "SENT"
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="SENT">SENT</option>
                  </select>
                </label>
              </div>

              <label className="text-sm text-text-2">
                Currency
                <input
                  type="text"
                  value={retainer?.currency ?? ""}
                  readOnly
                  className="mt-2 w-full rounded-xl border border-ink-4 bg-white/[0.04] px-3 py-2.5 text-white"
                />
              </label>

              <label className="text-sm text-text-2">
                Xero URL
                <input
                  type="url"
                  value={invoiceForm.xeroUrl}
                  onChange={(event) =>
                    setInvoiceForm((current) => ({ ...current, xeroUrl: event.target.value }))
                  }
                  placeholder="https://go.xero.com/..."
                  className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                />
              </label>

              <label className="text-sm text-text-2">
                Notes
                <textarea
                  value={invoiceForm.notes}
                  onChange={(event) =>
                    setInvoiceForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  rows={4}
                  className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={savingInvoice || !retainer}
              className="mt-5 inline-flex items-center rounded-xl bg-[#51d0b0] px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-[#6be0c1] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingInvoice ? "Recording..." : "Record invoice"}
            </button>
          </form>
          </div>
        </div>
      </div>
      {editOpen && retainer ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-2xl rounded-[18px] border border-ink-4 bg-ink-1 p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                  Edit retainer
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  {retainer.client?.name ?? "Retainer"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-text-2 hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-text-2">
                Service line
                <select
                  value={editForm.serviceLine}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      serviceLine: e.target.value as
                        | "TECHNICAL_DELIVERY"
                        | "CONSULTING"
                    }))
                  }
                  className="rounded-lg border border-ink-4 bg-ink-2 px-3 py-2 text-white"
                >
                  <option value="TECHNICAL_DELIVERY">Technical Delivery</option>
                  <option value="CONSULTING">Consulting</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-text-2">
                Block size (hours / month)
                <input
                  type="number"
                  min={10}
                  value={editForm.blockSize}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      blockSize: Number(e.target.value)
                    }))
                  }
                  className="rounded-lg border border-ink-4 bg-ink-2 px-3 py-2 text-white"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-text-2">
                Status
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, status: e.target.value }))
                  }
                  className="rounded-lg border border-ink-4 bg-ink-2 px-3 py-2 text-white"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAUSED">PAUSED</option>
                  <option value="ENDED">ENDED</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-text-2">
                Start date
                <input
                  type="date"
                  value={editForm.startDate}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                  className="rounded-lg border border-ink-4 bg-ink-2 px-3 py-2 text-white"
                />
              </label>
            </div>
            <label className="mt-4 flex flex-col gap-1 text-sm text-text-2">
              Scope summary
              <textarea
                rows={4}
                value={editForm.scopeSummary}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, scopeSummary: e.target.value }))
                }
                className="rounded-lg border border-ink-4 bg-ink-2 px-3 py-2 text-white"
              />
            </label>
            <label className="mt-4 flex flex-col gap-1 text-sm text-text-2">
              Requirements
              <textarea
                rows={3}
                value={editForm.requirements}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, requirements: e.target.value }))
                }
                className="rounded-lg border border-ink-4 bg-ink-2 px-3 py-2 text-white"
              />
            </label>
            <label className="mt-4 flex flex-col gap-1 text-sm text-text-2">
              Approval terms
              <textarea
                rows={3}
                value={editForm.approvalTerms}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, approvalTerms: e.target.value }))
                }
                className="rounded-lg border border-ink-4 bg-ink-2 px-3 py-2 text-white"
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="rounded-xl bg-[#51d0b0] px-4 py-2 text-sm font-semibold text-[#0a1411] hover:bg-[#6fdcc0] disabled:opacity-50"
              >
                {savingEdit ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </AppShell>
  );
}
