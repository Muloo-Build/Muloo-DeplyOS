"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AppShell from "./AppShell";

type DealType = "fixed" | "retainer" | "hybrid";
type Template = "full" | "one_pager";
type Currency = "ZAR" | "GBP" | "EUR" | "USD" | "AUD";

interface ClientOption {
  id: string;
  name: string;
}

interface LineItemDraft {
  description: string;
  quantity: string;
  unitLabel: string;
  rate: string;
  discount: string;
}

const currencyOptions: Currency[] = ["ZAR", "GBP", "EUR", "USD", "AUD"];

const dealTypeOptions: Array<{ value: DealType; label: string; hint: string }> = [
  {
    value: "fixed",
    label: "Fixed-fee project",
    hint: "One-off scope, single price"
  },
  {
    value: "retainer",
    label: "Retainer",
    hint: "Recurring monthly hours"
  },
  {
    value: "hybrid",
    label: "Hybrid",
    hint: "Project + ongoing retainer"
  }
];

const templateOptions: Array<{ value: Template; label: string; hint: string }> = [
  {
    value: "one_pager",
    label: "One-pager",
    hint: "Crisp single-page quote, recommended for most"
  },
  {
    value: "full",
    label: "Full theme",
    hint: "Multi-section narrative with project context"
  }
];

const defaultUnitLabelForDealType: Record<DealType, string> = {
  fixed: "hours",
  retainer: "months",
  hybrid: "units"
};

function blankLineItem(unitLabel: string): LineItemDraft {
  return {
    description: "",
    quantity: "",
    unitLabel,
    rate: "",
    discount: ""
  };
}

function formatCurrency(amount: number, currency: Currency) {
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}

export default function QuickQuoteBuilder() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [dealType, setDealType] = useState<DealType>("fixed");
  const [template, setTemplate] = useState<Template>("one_pager");
  const [currency, setCurrency] = useState<Currency>("ZAR");
  const [defaultRate, setDefaultRate] = useState("");
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([
    blankLineItem("hours")
  ]);
  const [includeMulooIntro, setIncludeMulooIntro] = useState(true);
  const [executiveSummary, setExecutiveSummary] = useState("");
  const [terms, setTerms] = useState("");

  useEffect(() => {
    async function loadClients() {
      try {
        const response = await fetch("/api/clients", { credentials: "include" });
        if (!response.ok) throw new Error("Failed to load clients");
        const body = (await response.json()) as { clients?: ClientOption[] };
        setClients(body.clients ?? []);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load clients"
        );
      } finally {
        setLoadingClients(false);
      }
    }
    void loadClients();
  }, []);

  const subtotal = useMemo(
    () =>
      lineItems.reduce((sum, item) => {
        const qty = Number(item.quantity);
        const rate = Number(item.rate);
        const discount = Number(item.discount) || 0;
        if (!Number.isFinite(qty) || !Number.isFinite(rate)) return sum;
        return sum + qty * rate * (1 - discount / 100);
      }, 0),
    [lineItems]
  );

  function updateLineItem<K extends keyof LineItemDraft>(
    index: number,
    field: K,
    value: LineItemDraft[K]
  ) {
    setLineItems((current) =>
      current.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function addLineItem() {
    setLineItems((current) => [
      ...current,
      blankLineItem(defaultUnitLabelForDealType[dealType])
    ]);
  }

  function removeLineItem(index: number) {
    setLineItems((current) =>
      current.length === 1 ? current : current.filter((_, i) => i !== index)
    );
  }

  function applyDefaultRateToAll() {
    if (!defaultRate) return;
    setLineItems((current) =>
      current.map((item) => ({ ...item, rate: item.rate || defaultRate }))
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!clientId) {
      setError("Pick a client first.");
      return;
    }
    if (!title.trim()) {
      setError("Quote title is required.");
      return;
    }
    if (lineItems.length === 0 || !lineItems[0].description.trim()) {
      setError("Add at least one line item.");
      return;
    }

    const validLineItems = lineItems
      .filter((item) => item.description.trim())
      .map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity) || 0,
        unitLabel: item.unitLabel || "hours",
        rate: Number(item.rate) || 0,
        discount: Number(item.discount) || 0
      }))
      .filter((item) => item.quantity > 0 && item.rate >= 0);

    if (validLineItems.length === 0) {
      setError("Each line item needs a quantity and a rate.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/quotes/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          clientId,
          title: title.trim(),
          dealType,
          template,
          currency,
          defaultRate: defaultRate ? Number(defaultRate) : null,
          lineItems: validLineItems,
          contentBlocks: {
            includeMulooIntro,
            executiveSummary: executiveSummary.trim() || undefined,
            terms: terms.trim() || undefined
          }
        })
      });

      const body = (await response.json().catch(() => null)) as
        | { quote?: { id: string }; error?: string }
        | null;

      if (!response.ok || !body?.quote) {
        throw new Error(body?.error ?? "Failed to create quote");
      }

      router.push(`/quotes/${body.quote.id}`);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to create quote"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10"
      >
        <header className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.32em] text-[#49cde1]">
            New quote
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Build a quote
          </h1>
          <p className="text-sm text-text-secondary">
            Quick standalone quote. Skips Discovery and Blueprint. For
            project-led commercial proposals, use the existing Project flow.
          </p>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {/* Context */}
        <section className="rounded-2xl border border-white/10 bg-background-card p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
            Context
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Who and what
          </h2>

          <div className="mt-5 grid gap-4">
            <label className="text-sm text-text-secondary">
              Quote title
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. The Collaborative — CRM clean-up"
                className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
                required
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-text-secondary">
                Client
                <select
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
                  required
                  disabled={loadingClients}
                >
                  <option value="">
                    {loadingClients ? "Loading..." : "Select client"}
                  </option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-text-secondary">
                Currency
                <select
                  value={currency}
                  onChange={(event) =>
                    setCurrency(event.target.value as Currency)
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
                >
                  {currencyOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </section>

        {/* Type & template */}
        <section className="rounded-2xl border border-white/10 bg-background-card p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
            Type and template
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            How is the work being sold
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-text-secondary">
                Deal type
              </p>
              <div className="mt-3 grid gap-2">
                {dealTypeOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${
                      dealType === option.value
                        ? "border-[#51d0b0]/50 bg-[#51d0b0]/10"
                        : "border-white/10 bg-background-primary hover:border-white/20"
                    }`}
                  >
                    <input
                      type="radio"
                      name="dealType"
                      value={option.value}
                      checked={dealType === option.value}
                      onChange={() => {
                        setDealType(option.value);
                        const newUnit = defaultUnitLabelForDealType[option.value];
                        setLineItems((current) =>
                          current.map((item) => ({
                            ...item,
                            unitLabel:
                              item.unitLabel === "hours" ||
                              item.unitLabel === "months" ||
                              item.unitLabel === "units"
                                ? newUnit
                                : item.unitLabel
                          }))
                        );
                      }}
                      className="mt-1"
                    />
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold text-white">
                        {option.label}
                      </span>
                      <span className="text-xs text-text-muted">
                        {option.hint}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-text-secondary">Template</p>
              <div className="mt-3 grid gap-2">
                {templateOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${
                      template === option.value
                        ? "border-[#49cde1]/50 bg-[#49cde1]/10"
                        : "border-white/10 bg-background-primary hover:border-white/20"
                    }`}
                  >
                    <input
                      type="radio"
                      name="template"
                      value={option.value}
                      checked={template === option.value}
                      onChange={() => setTemplate(option.value)}
                      className="mt-1"
                    />
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold text-white">
                        {option.label}
                      </span>
                      <span className="text-xs text-text-muted">
                        {option.hint}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Line items */}
        <section className="rounded-2xl border border-white/10 bg-background-card p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                Line items
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                What you're charging for
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={defaultRate}
                onChange={(event) => setDefaultRate(event.target.value)}
                placeholder="Default rate"
                className="w-32 rounded-xl border border-white/10 bg-background-primary px-3 py-2 text-sm text-white"
              />
              <button
                type="button"
                onClick={applyDefaultRateToAll}
                disabled={!defaultRate}
                className="rounded-xl border border-white/10 bg-background-primary px-3 py-2 text-sm text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply to all
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {lineItems.map((item, index) => (
              <div
                key={index}
                className="rounded-xl border border-white/10 bg-background-primary/40 p-4"
              >
                <div className="grid gap-3 md:grid-cols-[1fr_repeat(4,minmax(0,0.5fr))_auto]">
                  <label className="text-xs text-text-muted md:col-span-1">
                    Description
                    <input
                      type="text"
                      value={item.description}
                      onChange={(event) =>
                        updateLineItem(index, "description", event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-white/10 bg-background-primary px-3 py-2 text-sm text-white"
                      placeholder="e.g. CRM workflow audit"
                    />
                  </label>
                  <label className="text-xs text-text-muted">
                    Qty
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={item.quantity}
                      onChange={(event) =>
                        updateLineItem(index, "quantity", event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-white/10 bg-background-primary px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs text-text-muted">
                    Unit
                    <input
                      type="text"
                      value={item.unitLabel}
                      onChange={(event) =>
                        updateLineItem(index, "unitLabel", event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-white/10 bg-background-primary px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs text-text-muted">
                    Rate
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.rate}
                      onChange={(event) =>
                        updateLineItem(index, "rate", event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-white/10 bg-background-primary px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs text-text-muted">
                    Disc %
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={item.discount}
                      onChange={(event) =>
                        updateLineItem(index, "discount", event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-white/10 bg-background-primary px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeLineItem(index)}
                    disabled={lineItems.length === 1}
                    className="self-end rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-text-secondary transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Remove line item"
                  >
                    Remove
                  </button>
                </div>
                <p className="mt-3 text-xs text-text-muted">
                  Line total{": "}
                  <span className="text-text-secondary">
                    {formatCurrency(
                      (Number(item.quantity) || 0) *
                        (Number(item.rate) || 0) *
                        (1 - (Number(item.discount) || 0) / 100),
                      currency
                    )}
                  </span>
                </p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addLineItem}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-white/15 px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:border-white/30 hover:text-white"
          >
            + Add line item
          </button>

          <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
            <p className="text-sm text-text-secondary">Subtotal</p>
            <p className="text-xl font-semibold text-white">
              {formatCurrency(subtotal, currency)}
            </p>
          </div>
        </section>

        {/* Content blocks */}
        <section className="rounded-2xl border border-white/10 bg-background-card p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
            Content
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Optional content blocks
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Toggle in only what's relevant for this quote. Less is usually more.
          </p>

          <div className="mt-5 space-y-4">
            <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-background-primary/40 p-4">
              <input
                type="checkbox"
                checked={includeMulooIntro}
                onChange={(event) => setIncludeMulooIntro(event.target.checked)}
                className="mt-1"
              />
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-white">
                  Include Muloo intro
                </span>
                <span className="text-xs text-text-muted">
                  Short paragraph about who Muloo is. Useful for new clients.
                </span>
              </span>
            </label>

            <label className="text-sm text-text-secondary">
              Executive summary (optional)
              <textarea
                value={executiveSummary}
                onChange={(event) => setExecutiveSummary(event.target.value)}
                rows={4}
                placeholder="One paragraph. What problem are we solving and how."
                className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
              />
            </label>

            <label className="text-sm text-text-secondary">
              Terms (optional)
              <textarea
                value={terms}
                onChange={(event) => setTerms(event.target.value)}
                rows={4}
                placeholder="Payment terms, validity, scope notes."
                className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
              />
            </label>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving || loadingClients}
            className="inline-flex items-center rounded-xl bg-[#51d0b0] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#6be0c1] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create draft quote"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/quotes")}
            className="rounded-xl border border-white/10 bg-background-card px-5 py-3 text-sm font-medium text-text-secondary transition hover:bg-white/5 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </form>
    </AppShell>
  );
}
