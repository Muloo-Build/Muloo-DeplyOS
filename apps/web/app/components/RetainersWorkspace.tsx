"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AppShell from "./AppShell";
import EmptyState from "./EmptyState";

type RetainerStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ENDED";
type RetainerServiceLine = "TECHNICAL_DELIVERY" | "CONSULTING";
type RetainerCurrency = "ZAR" | "USD" | "GBP" | "EUR" | "AUD" | "CAD";

interface RetainerListItem {
  id: string;
  clientId: string;
  billToEntityId: string;
  serviceLine: RetainerServiceLine;
  blockSize: number;
  rate: number;
  currency: RetainerCurrency;
  startDate: string;
  status: RetainerStatus;
  client: { id: string; name: string; slug: string } | null;
  billToEntity: { id: string; name: string; type: "CLIENT" | "PARTNER_AGENCY" } | null;
  currentPeriod: {
    balance: number;
    consumedHours: number;
    blockHours: number;
    rolledInHours: number;
    approvedTopUpHours: number;
    status: string;
  } | null;
}

interface ClientOption {
  id: string;
  name: string;
}

interface AgencyOption {
  id: string;
  name: string;
  vatNumber?: string | null;
}

type BillToMode = "client" | "agency" | "new-agency";

const serviceLineOptions: Array<{
  value: RetainerServiceLine;
  label: string;
}> = [
  { value: "TECHNICAL_DELIVERY", label: "Technical Delivery" },
  { value: "CONSULTING", label: "Consulting" }
];

const currencyOptions: RetainerCurrency[] = ["ZAR", "USD", "GBP", "EUR", "AUD", "CAD"];
const statusOptions: RetainerStatus[] = ["DRAFT", "ACTIVE", "PAUSED", "ENDED"];

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

function formatServiceLine(value: RetainerServiceLine) {
  return value === "TECHNICAL_DELIVERY" ? "Technical Delivery" : "Consulting";
}

function createMonthStartIso() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  return monthStart.toISOString().slice(0, 10);
}

export default function RetainersWorkspace() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [retainers, setRetainers] = useState<RetainerListItem[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [agencies, setAgencies] = useState<AgencyOption[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [form, setForm] = useState({
    clientId: "",
    serviceLine: "TECHNICAL_DELIVERY" as RetainerServiceLine,
    blockSize: 40,
    currency: "ZAR" as RetainerCurrency,
    startDate: createMonthStartIso(),
    status: "DRAFT" as RetainerStatus,
    billToMode: "client" as BillToMode,
    agencyId: "",
    agencyName: "",
    agencyVatNumber: "",
    agencyAddress: "",
    agencyPrimaryContactEmail: "",
    agencyPrimaryContactName: "",
    scopeSummary: "",
    deliverables: [] as Array<{ title: string; description: string }>,
    approvalTerms: "",
    requirements: ""
  });

  async function loadWorkspace() {
    setLoading(true);
    setError(null);
    try {
      const [retainersResponse, clientsResponse, agenciesResponse] = await Promise.all([
        fetch("/api/retainers", { credentials: "include" }),
        fetch("/api/clients", { credentials: "include" }),
        fetch("/api/agencies", { credentials: "include" })
      ]);

      const retainersBody = (await retainersResponse.json().catch(() => null)) as
        | { retainers?: RetainerListItem[]; error?: string }
        | null;
      const clientsBody = (await clientsResponse.json().catch(() => null)) as
        | { clients?: Array<{ id: string; name: string }> }
        | null;
      const agenciesBody = (await agenciesResponse.json().catch(() => null)) as
        | { agencies?: AgencyOption[] }
        | null;

      if (!retainersResponse.ok) {
        throw new Error(retainersBody?.error ?? "Failed to load retainers");
      }

      setRetainers(retainersBody?.retainers ?? []);
      setClients((clientsBody?.clients ?? []).map((client) => ({ id: client.id, name: client.name })));
      setAgencies(agenciesBody?.agencies ?? []);
      setForm((current) => ({
        ...current,
        clientId: current.clientId || clientsBody?.clients?.[0]?.id || ""
      }));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load retainers"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const visibleRetainers = useMemo(() => {
    return retainers.filter((retainer) =>
      statusFilter === "ALL" ? true : retainer.status === statusFilter
    );
  }, [retainers, statusFilter]);

  async function handleCreateRetainer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    setError(null);

    const payload: Record<string, unknown> = {
      clientId: form.clientId,
      serviceLine: form.serviceLine,
      blockSize: Number(form.blockSize),
      currency: form.currency,
      startDate: form.startDate,
      status: form.status,
      scopeSummary: form.scopeSummary || null,
      deliverables: form.deliverables.filter((d) => d.title.trim()).length > 0 ? form.deliverables : null,
      approvalTerms: form.approvalTerms || null,
      requirements: form.requirements || null
    };

    if (form.billToMode === "agency" && form.agencyId) {
      payload.billToEntityId = form.agencyId;
    }

    if (form.billToMode === "new-agency") {
      payload.newBillToAgency = {
        name: form.agencyName,
        vatNumber: form.agencyVatNumber || null,
        address: form.agencyAddress || null,
        primaryContactEmail: form.agencyPrimaryContactEmail || null,
        primaryContactName: form.agencyPrimaryContactName || null
      };
    }

    try {
      const response = await fetch("/api/retainers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
      });
      const body = (await response.json().catch(() => null)) as
        | { retainer?: RetainerListItem; error?: string }
        | null;

      if (!response.ok || !body?.retainer) {
        throw new Error(body?.error ?? "Failed to create retainer");
      }

      setFeedback("Retainer created.");
      await loadWorkspace();
      router.push(`/retainers/${body.retainer.id}`);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to create retainer"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
              Retainers
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              Retainers
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              Ongoing commercial agreements — monthly support, managed delivery, or fixed-scope commitments. Create retainers, lock the billing entity, and feed invoices from here.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm text-text-secondary">
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="ml-3 rounded-xl border border-white/10 bg-background-card px-3 py-2 text-sm text-white"
              >
                <option value="ALL">All</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}
        {feedback ? (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {feedback}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-white/10 bg-background-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                  Existing retainers
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  {loading ? "Loading..." : `${visibleRetainers.length} retainers`}
                </h2>
              </div>
              <Link
                href="/command-centre"
                className="text-sm font-medium text-[#51d0b0] hover:underline"
              >
                Back to Command Centre
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {visibleRetainers.map((retainer) => {
                const includedHours =
                  (retainer.currentPeriod?.blockHours ?? retainer.blockSize) +
                  (retainer.currentPeriod?.rolledInHours ?? 0) +
                  (retainer.currentPeriod?.approvedTopUpHours ?? 0);
                return (
                  <Link
                    key={retainer.id}
                    href={`/retainers/${retainer.id}`}
                    className="block rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition hover:border-white/15 hover:bg-white/[0.05]"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-white">
                            {retainer.client?.name ?? "Unknown client"}
                          </p>
                          <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                            {retainer.status}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-text-secondary">
                          {formatServiceLine(retainer.serviceLine)} · {retainer.blockSize}h/month ·{" "}
                          {formatMoney(retainer.rate, retainer.currency)}
                        </p>
                        <p className="mt-1 text-sm text-text-secondary">
                          Bill to {retainer.billToEntity?.name ?? "Unknown bill-to"}
                        </p>
                      </div>

                      <div className="text-sm text-text-secondary md:text-right">
                        <p>
                          Start {formatDate(retainer.startDate)}
                        </p>
                        <p className="mt-1 text-white">
                          {retainer.currentPeriod
                            ? `${retainer.currentPeriod.consumedHours}h used of ${includedHours}h`
                            : "Awaiting first period"}
                        </p>
                        <p className="mt-1">
                          Balance {retainer.currentPeriod?.balance ?? retainer.blockSize}h
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}

              {!loading && visibleRetainers.length === 0 ? (
                <EmptyState
                  className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 p-5 text-center"
                  title="No retainers match this filter"
                  description="Try a different status or service-line filter, or create a new retainer below."
                />
              ) : null}
            </div>
          </div>

          <form
            onSubmit={handleCreateRetainer}
            className="rounded-2xl border border-white/10 bg-background-card p-5"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
              New retainer
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Create and lock the bill-to party
            </h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-text-secondary">
                Client
                <select
                  value={form.clientId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, clientId: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
                  required
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-text-secondary">
                Bill to
                <select
                  value={form.billToMode === "agency" ? form.agencyId : form.billToMode}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "client") {
                      setForm((current) => ({
                        ...current,
                        billToMode: "client",
                        agencyId: ""
                      }));
                      return;
                    }

                    if (value === "new-agency") {
                      setForm((current) => ({
                        ...current,
                        billToMode: "new-agency",
                        agencyId: ""
                      }));
                      return;
                    }

                    setForm((current) => ({
                      ...current,
                      billToMode: "agency",
                      agencyId: value
                    }));
                  }}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
                >
                  <option value="client">Selected client (direct)</option>
                  {agencies.map((agency) => (
                    <option key={agency.id} value={agency.id}>
                      {agency.name}
                    </option>
                  ))}
                  <option value="new-agency">Create partner agency inline</option>
                </select>
              </label>

              <label className="text-sm text-text-secondary">
                Service line
                <select
                  value={form.serviceLine}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      serviceLine: event.target.value as RetainerServiceLine
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
                >
                  {serviceLineOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-text-secondary">
                Block size
                <input
                  type="number"
                  min={10}
                  step={1}
                  value={form.blockSize}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      blockSize: Number(event.target.value)
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
                  required
                />
              </label>

              <label className="text-sm text-text-secondary">
                Currency
                <select
                  value={form.currency}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      currency: event.target.value as RetainerCurrency
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
                >
                  {currencyOptions.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-text-secondary">
                Start date
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, startDate: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
                  required
                />
              </label>

              <label className="text-sm text-text-secondary">
                Status
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as RetainerStatus
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="mb-4 text-sm font-medium text-white">Scope & Terms</p>
              
              <label className="text-sm text-text-secondary">
                Scope summary
                <textarea
                  value={form.scopeSummary}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      scopeSummary: event.target.value
                    }))
                  }
                  placeholder="High-level overview of what will be delivered..."
                  className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white placeholder-text-muted"
                  rows={3}
                />
              </label>

              <div className="mt-4">
                <p className="mb-2 text-sm text-text-secondary">Deliverables</p>
                <div className="space-y-3">
                  {form.deliverables.map((deliverable, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={deliverable.title}
                        onChange={(event) => {
                          const newDeliverables = [...form.deliverables];
                          newDeliverables[idx].title = event.target.value;
                          setForm((current) => ({
                            ...current,
                            deliverables: newDeliverables
                          }));
                        }}
                        placeholder="Deliverable title (required)"
                        className="flex-1 rounded-xl border border-white/10 bg-background-primary px-3 py-2 text-white placeholder-text-muted text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setForm((current) => ({
                            ...current,
                            deliverables: current.deliverables.filter((_, i) => i !== idx)
                          }));
                        }}
                        className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-100 hover:border-rose-400/50 hover:bg-rose-500/20"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setForm((current) => ({
                      ...current,
                      deliverables: [...current.deliverables, { title: "", description: "" }]
                    }));
                  }}
                  className="mt-3 inline-flex text-sm font-medium text-[#51d0b0] hover:underline"
                >
                  + Add deliverable
                </button>
              </div>

              <label className="mt-4 text-sm text-text-secondary">
                Requirements
                <textarea
                  value={form.requirements}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      requirements: event.target.value
                    }))
                  }
                  placeholder="Specific requirements or constraints..."
                  className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white placeholder-text-muted"
                  rows={3}
                />
              </label>

              <label className="mt-4 text-sm text-text-secondary">
                Approval terms
                <textarea
                  value={form.approvalTerms}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      approvalTerms: event.target.value
                    }))
                  }
                  placeholder="Terms for approval and sign-off..."
                  className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white placeholder-text-muted"
                  rows={3}
                />
              </label>
            </section>

            {form.billToMode === "new-agency" ? (
              <div className="mt-4 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">New partner agency</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm text-text-secondary">
                    Agency name
                    <input
                      type="text"
                      value={form.agencyName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          agencyName: event.target.value
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
                      required
                    />
                  </label>
                  <label className="text-sm text-text-secondary">
                    VAT number
                    <input
                      type="text"
                      value={form.agencyVatNumber}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          agencyVatNumber: event.target.value
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
                    />
                  </label>
                  <label className="text-sm text-text-secondary sm:col-span-2">
                    Address
                    <input
                      type="text"
                      value={form.agencyAddress}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          agencyAddress: event.target.value
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
                    />
                  </label>
                  <label className="text-sm text-text-secondary">
                    Primary contact email
                    <input
                      type="email"
                      value={form.agencyPrimaryContactEmail}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          agencyPrimaryContactEmail: event.target.value
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
                    />
                  </label>
                  <label className="text-sm text-text-secondary">
                    Primary contact name
                    <input
                      type="text"
                      value={form.agencyPrimaryContactName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          agencyPrimaryContactName: event.target.value
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
                    />
                  </label>
                </div>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className="mt-5 inline-flex items-center rounded-xl bg-[#51d0b0] px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-[#6be0c1] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Creating..." : "Create retainer"}
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
