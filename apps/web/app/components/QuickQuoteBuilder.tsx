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

// T6.1 — Product catalog item shape used by the per-line product picker.
// Picking a catalog item pre-fills description, rate (unitPrice), cost and
// unitLabel so operators don't re-enter cost data already in the catalog.
interface ProductOption {
  id: string;
  name: string;
  category: string;
  unitPrice: number;
  cost: number | null;
  currency: string;
  unitLabel: string;
  defaultQuantity: number;
  isActive: boolean;
  // T6.1 — Target gross margin % from the catalog. When a line is linked to
  // this product, the line margin badge flips to "below target" if the
  // computed margin falls under this threshold.
  marginTarget?: number | null;
}

interface SourceQuoteSnapshot {
  status: string;
  version: number;
  template: string;
  currency: string;
  defaultRate: number | null;
  productLines: Array<{
    name: string;
    description?: string | null;
    quantity: number;
    unitLabel: string;
    unitPrice: number;
    metadata?: {
      discount?: number;
      discountType?: DiscountType;
      // T6.1 — per-line cost persisted on metadata for live margin display.
      cost?: number | null;
    } | null;
    billingModel?: string;
  }>;
  paymentSchedule: string[];
  context: {
    quoteTitle?: string | null;
    quoteContextSummary: string | null;
    contentOverrides?: {
      termsAndWorkingScope?: string | null;
      approvalSummary?: string | null;
    } | null;
  } | null;
}

type DiscountType = "percent" | "fixed";

interface LineItemDraft {
  description: string;
  quantity: string;
  unitLabel: string;
  rate: string;
  // T6.1 — Optional per-unit cost. Empty string = unknown cost = no margin.
  cost: string;
  discount: string;
  discountType: DiscountType;
  // T6.1 — Catalog product this line was pre-filled from (if any). Used to
  // compare the live margin against the product's marginTarget so we can
  // flag lines that are priced below the operator's target. Client-only;
  // not persisted to the backend.
  productId?: string;
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
    cost: "",
    discount: "",
    discountType: "percent"
  };
}

// T6.1 — Per-line gross margin: revenue (after discount) minus cost*quantity.
// Returned as null when cost is unknown so the UI can render a neutral state
// instead of a misleading "100% margin".
function calcLineMargin(item: LineItemDraft, lineRevenue: number) {
  if (item.cost.trim() === "") return null;
  const cost = Number(item.cost);
  const qty = Number(item.quantity);
  if (!Number.isFinite(cost) || cost < 0) return null;
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const totalCost = cost * qty;
  const absolute = lineRevenue - totalCost;
  if (lineRevenue <= 0) return { absolute, pct: 0 };
  return { absolute, pct: (absolute / lineRevenue) * 100 };
}

function calcLineTotal(item: LineItemDraft) {
  const hours = Number(item.quantity);
  const rate = Number(item.rate);
  const discountValue = Number(item.discount) || 0;
  if (!Number.isFinite(hours) || !Number.isFinite(rate)) return 0;
  if (item.discountType === "fixed") {
    const effectiveRate = Math.max(0, rate - discountValue);
    return hours * effectiveRate;
  }
  // percent
  const effectiveRate = rate * (1 - Math.min(100, Math.max(0, discountValue)) / 100);
  return hours * effectiveRate;
}

function formatCurrency(amount: number, currency: Currency) {
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}

interface QuickQuoteBuilderProps {
  sourceId?: string;
}

export default function QuickQuoteBuilder({
  sourceId
}: QuickQuoteBuilderProps = {}) {
  const router = useRouter();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loadingSource, setLoadingSource] = useState(Boolean(sourceId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceMeta, setSourceMeta] = useState<{
    status: string;
    version: number;
  } | null>(null);

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

  // T6.1 — Load active product catalog items so each quote line can be
  // pre-filled from a catalog product (rate + cost + unitLabel) instead of
  // re-entering cost manually. Failures are non-fatal: the picker just
  // doesn't appear and the manual fields still work.
  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch("/api/products", {
          credentials: "include"
        });
        if (!response.ok) return;
        const body = (await response.json()) as {
          products?: ProductOption[];
        };
        setProducts((body.products ?? []).filter((p) => p.isActive));
      } catch {
        // ignore: picker is optional
      }
    }
    void loadProducts();
  }, []);

  function applyProductToLine(index: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    // T6.1 — Guard against mixed-currency lines. Margin and totals are
    // computed in the quote currency without any FX, so applying a non-
    // matching-currency product would silently misstate margin. Block it
    // and surface the mismatch instead.
    if (
      product.currency &&
      product.currency.toUpperCase() !== currency.toUpperCase()
    ) {
      setError(
        `"${product.name}" is priced in ${product.currency} but this quote is in ${currency}. Change the quote currency or pick a ${currency} product.`
      );
      return;
    }
    setError(null);
    setLineItems((current) =>
      current.map((item, i) =>
        i === index
          ? {
              ...item,
              description: product.name,
              rate: String(product.unitPrice ?? ""),
              cost:
                product.cost === null || product.cost === undefined
                  ? ""
                  : String(product.cost),
              unitLabel: product.unitLabel || item.unitLabel,
              quantity:
                item.quantity ||
                (product.defaultQuantity
                  ? String(product.defaultQuantity)
                  : item.quantity),
              productId: product.id
            }
          : item
      )
    );
  }

  useEffect(() => {
    if (!sourceId) return;

    async function loadSource() {
      setLoadingSource(true);
      try {
        const response = await fetch(
          `/api/quotes/${encodeURIComponent(sourceId!)}`,
          {
            credentials: "include"
          }
        );
        if (!response.ok) throw new Error("Failed to load source quote");
        const body = (await response.json()) as {
          quote: SourceQuoteSnapshot;
          project: { client: { id: string } | null };
        };

        const q = body.quote;
        setSourceMeta({ status: q.status, version: q.version });

        setTitle(q.context?.quoteTitle ?? "");
        setClientId(body.project.client?.id ?? "");
        setTemplate(q.template === "full" ? "full" : "one_pager");
        setCurrency((q.currency as Currency) ?? "ZAR");
        setDefaultRate(q.defaultRate != null ? String(q.defaultRate) : "");

        // Derive deal type from first line item's billingModel
        const firstBilling = q.productLines[0]?.billingModel;
        setDealType(
          firstBilling === "monthly_retainer"
            ? "retainer"
            : firstBilling === "one_time"
              ? "fixed"
              : "fixed"
        );

        // Map line items
        if (q.productLines.length > 0) {
          setLineItems(
            q.productLines.map((line) => {
              const meta = (line.metadata ?? {}) as {
                discount?: number;
                discountType?: DiscountType;
                cost?: number | null;
              };
              return {
                description: line.description ?? line.name ?? "",
                quantity: String(line.quantity ?? ""),
                unitLabel: line.unitLabel ?? "hours",
                rate: String(line.unitPrice ?? ""),
                cost:
                  meta.cost === null || meta.cost === undefined
                    ? ""
                    : String(meta.cost),
                discount: meta.discount ? String(meta.discount) : "",
                discountType:
                  meta.discountType === "fixed" ? "fixed" : "percent"
              };
            })
          );
        }

        // Content blocks
        setIncludeMulooIntro(
          Boolean(q.context?.contentOverrides?.approvalSummary)
        );
        setExecutiveSummary(q.context?.quoteContextSummary ?? "");
        setTerms(q.context?.contentOverrides?.termsAndWorkingScope ?? "");
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load source quote"
        );
      } finally {
        setLoadingSource(false);
      }
    }

    void loadSource();
  }, [sourceId]);

  const subtotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + calcLineTotal(item), 0),
    [lineItems]
  );

  // T6.1 — Quote-total margin. Sums known costs across lines; if any line has
  // no cost we surface that as "partial coverage" rather than pretending to
  // know the true margin.
  const totalMargin = useMemo(() => {
    let revenueWithCost = 0;
    let totalCost = 0;
    let linesWithCost = 0;
    let linesWithoutCost = 0;
    for (const item of lineItems) {
      const lineRevenue = calcLineTotal(item);
      const qty = Number(item.quantity);
      if (item.cost.trim() === "" || !Number.isFinite(qty) || qty <= 0) {
        if (lineRevenue > 0) linesWithoutCost += 1;
        continue;
      }
      const cost = Number(item.cost);
      if (!Number.isFinite(cost) || cost < 0) continue;
      revenueWithCost += lineRevenue;
      totalCost += cost * qty;
      linesWithCost += 1;
    }
    if (linesWithCost === 0) return null;
    const absolute = revenueWithCost - totalCost;
    const pct = revenueWithCost > 0 ? (absolute / revenueWithCost) * 100 : 0;
    return { absolute, pct, linesWithCost, linesWithoutCost };
  }, [lineItems]);

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
        cost: item.cost.trim() === "" ? null : Number(item.cost),
        discount: Number(item.discount) || 0,
        discountType: item.discountType
      }))
      .filter((item) => item.quantity > 0 && item.rate >= 0);

    if (validLineItems.length === 0) {
      setError("Each line item needs a quantity and a rate.");
      return;
    }

    setSaving(true);
    try {
      const url = sourceId
        ? `/api/quotes/${encodeURIComponent(sourceId)}/edit`
        : "/api/quotes/quick";

      const response = await fetch(url, {
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
        | { quote?: { id: string }; mode?: string; error?: string }
        | null;

      if (!response.ok || !body?.quote) {
        throw new Error(body?.error ?? "Failed to save quote");
      }

      router.push(`/quotes/${body.quote.id}`);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save quote"
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
          <p className="text-xs uppercase tracking-[0.14em] text-[#49cde1]">
            {sourceId
              ? sourceMeta?.status === "draft"
                ? "Edit quote"
                : "Revise quote"
              : "New quote"}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            {sourceId
              ? sourceMeta?.status === "draft"
                ? "Edit draft"
                : `Create v${(sourceMeta?.version ?? 1) + 1}`
              : "Build a quote"}
          </h1>
          <p className="text-sm text-text-2">
            {sourceId
              ? sourceMeta?.status === "draft"
                ? "Updating this draft in place. No new version created."
                : `The current v${sourceMeta?.version ?? 1} (${sourceMeta?.status ?? "shared"}) will be marked superseded and a fresh draft created.`
              : "Quick standalone quote. Skips Discovery and Blueprint. For project-led commercial proposals, use the existing Project flow."}
          </p>
        </header>

        {loadingSource ? (
          <div className="rounded-[14px] border border-ink-4 bg-ink-1 px-4 py-3 text-sm text-text-2">
            Loading source quote...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[14px] border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {/* Context */}
        <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-text-3">
            Context
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Who and what
          </h2>

          <div className="mt-5 grid gap-4">
            <label className="text-sm text-text-2">
              Quote title
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. The Collaborative — CRM clean-up"
                className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                required
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-text-2">
                Client
                <select
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
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

              <label className="text-sm text-text-2">
                Currency
                <select
                  value={currency}
                  onChange={(event) =>
                    setCurrency(event.target.value as Currency)
                  }
                  className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
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
        <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-text-3">
            Type and template
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            How is the work being sold
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-text-2">
                Deal type
              </p>
              <div className="mt-3 grid gap-2">
                {dealTypeOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${
                      dealType === option.value
                        ? "border-[#51d0b0]/50 bg-[#51d0b0]/10"
                        : "border-ink-4 bg-ink-0 hover:border-ink-5"
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
                      <span className="text-xs text-text-3">
                        {option.hint}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-text-2">Template</p>
              <div className="mt-3 grid gap-2">
                {templateOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${
                      template === option.value
                        ? "border-[#49cde1]/50 bg-[#49cde1]/10"
                        : "border-ink-4 bg-ink-0 hover:border-ink-5"
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
                      <span className="text-xs text-text-3">
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
        <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-text-3">
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
                className="w-32 rounded-xl border border-ink-4 bg-ink-0 px-3 py-2 text-sm text-white"
              />
              <button
                type="button"
                onClick={applyDefaultRateToAll}
                disabled={!defaultRate}
                className="rounded-xl border border-ink-4 bg-ink-0 px-3 py-2 text-sm text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply to all
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {lineItems.map((item, index) => {
              const lineTotal = calcLineTotal(item);
              const grossLineTotal =
                (Number(item.quantity) || 0) * (Number(item.rate) || 0);
              const hasDiscount =
                Number(item.discount) > 0 && grossLineTotal > 0;
              const lineMargin = calcLineMargin(item, lineTotal);
              // T6.1 — Look up the catalog product this line was pre-filled
              // from so we can compare the live margin against the product's
              // marginTarget (if any).
              const linkedProduct = item.productId
                ? products.find((p) => p.id === item.productId) ?? null
                : null;
              const marginTarget =
                linkedProduct &&
                linkedProduct.marginTarget !== null &&
                linkedProduct.marginTarget !== undefined &&
                Number.isFinite(linkedProduct.marginTarget)
                  ? linkedProduct.marginTarget
                  : null;
              const belowTarget =
                lineMargin !== null &&
                marginTarget !== null &&
                lineMargin.pct < marginTarget;
              return (
                <div
                  key={index}
                  className="rounded-xl border border-ink-4 bg-ink-0/40 p-4"
                >
                  {products.length > 0 ? (
                    <label className="mb-3 block text-xs text-text-3">
                      Pre-fill from catalog (optional)
                      <select
                        value={item.productId ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (value) {
                            applyProductToLine(index, value);
                          } else {
                            // T6.1 — Picking the empty option unlinks the
                            // line from the catalog so the marginTarget
                            // comparison stops applying. We keep the
                            // operator's edited description / rate / cost
                            // intact — only the link is cleared.
                            updateLineItem(index, "productId", undefined);
                          }
                        }}
                        className="mt-1 w-full rounded-lg border border-ink-4 bg-ink-0 px-3 py-2 text-sm text-white"
                        aria-label="Pick product from catalog"
                      >
                        <option value="">— Pick a product —</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                            {product.cost !== null && product.cost !== undefined
                              ? ` · cost ${product.currency} ${product.cost}`
                              : ""}
                            {product.marginTarget !== null &&
                            product.marginTarget !== undefined
                              ? ` · target ${Number(product.marginTarget).toFixed(0)}%`
                              : ""}
                          </option>
                        ))}
                      </select>
                      {linkedProduct && marginTarget !== null ? (
                        <span className="mt-1 block text-[11px] text-text-3">
                          Linked to{" "}
                          <span className="text-text-2">
                            {linkedProduct.name}
                          </span>{" "}
                          · target margin {marginTarget.toFixed(0)}%
                        </span>
                      ) : null}
                    </label>
                  ) : null}
                  <div className="grid gap-3 md:grid-cols-[1.4fr_0.6fr_0.7fr_0.9fr_auto]">
                    <label className="text-xs text-text-3">
                      Term / description
                      <input
                        type="text"
                        value={item.description}
                        onChange={(event) =>
                          updateLineItem(
                            index,
                            "description",
                            event.target.value
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-ink-4 bg-ink-0 px-3 py-2 text-sm text-white"
                        placeholder="e.g. CRM workflow audit"
                      />
                    </label>
                    <label className="text-xs text-text-3">
                      Hours
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        value={item.quantity}
                        onChange={(event) =>
                          updateLineItem(index, "quantity", event.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-ink-4 bg-ink-0 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="text-xs text-text-3">
                      Rate / hr
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.rate}
                        onChange={(event) =>
                          updateLineItem(index, "rate", event.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-ink-4 bg-ink-0 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <div className="text-xs text-text-3">
                      Discount on rate
                      <div className="mt-1 flex gap-2">
                        <input
                          type="number"
                          step={item.discountType === "percent" ? "1" : "0.01"}
                          min="0"
                          max={
                            item.discountType === "percent" ? "100" : undefined
                          }
                          value={item.discount}
                          onChange={(event) =>
                            updateLineItem(index, "discount", event.target.value)
                          }
                          className="w-full rounded-lg border border-ink-4 bg-ink-0 px-3 py-2 text-sm text-white"
                          placeholder="0"
                        />
                        <select
                          value={item.discountType}
                          onChange={(event) =>
                            updateLineItem(
                              index,
                              "discountType",
                              event.target.value as DiscountType
                            )
                          }
                          className="rounded-lg border border-ink-4 bg-ink-0 px-2 py-2 text-sm text-white"
                          aria-label="Discount type"
                        >
                          <option value="percent">%</option>
                          <option value="fixed">{currency}</option>
                        </select>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLineItem(index)}
                      disabled={lineItems.length === 1}
                      className="self-end rounded-lg border border-ink-4 bg-white/5 px-3 py-2 text-xs text-text-2 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Remove line item"
                    >
                      Remove
                    </button>
                  </div>
                  {/* T6.1 — per-unit cost input. Optional: leave blank if
                      delivery cost isn't known and we'll skip the margin. */}
                  <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                    <label className="text-xs text-text-3">
                      Cost / unit (optional, for margin)
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.cost}
                        onChange={(event) =>
                          updateLineItem(index, "cost", event.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-ink-4 bg-ink-0 px-3 py-2 text-sm text-white"
                        placeholder="0.00"
                      />
                    </label>
                    {lineMargin ? (
                      <div
                        className={`rounded-lg border px-3 py-2 text-xs ${
                          // T6.1 — When the line is linked to a catalog
                          // product with a marginTarget, that target wins
                          // over the generic 50/25 thresholds: amber means
                          // "below the target you set in the catalog".
                          marginTarget !== null
                            ? belowTarget
                              ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
                              : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                            : lineMargin.pct >= 50
                              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                              : lineMargin.pct >= 25
                                ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
                                : "border-rose-400/30 bg-rose-500/10 text-rose-100"
                        }`}
                      >
                        <p className="text-[10px] uppercase tracking-[0.14em] opacity-80">
                          Gross margin
                          {marginTarget !== null
                            ? ` · target ${marginTarget.toFixed(0)}%`
                            : ""}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold tabular-nums">
                          {lineMargin.pct.toFixed(1)}%{" "}
                          <span className="text-[11px] font-normal opacity-80">
                            ({formatCurrency(lineMargin.absolute, currency)})
                          </span>
                        </p>
                        {belowTarget && marginTarget !== null ? (
                          <p className="mt-1 text-[11px] font-medium">
                            Below catalog target by{" "}
                            {(marginTarget - lineMargin.pct).toFixed(1)} pts
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-[11px] text-text-3 md:self-end">
                        Add a cost to see live margin
                      </p>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <p className="text-text-3">
                      {hasDiscount ? (
                        <>
                          Was{" "}
                          <span className="line-through">
                            {formatCurrency(grossLineTotal, currency)}
                          </span>{" "}
                          ·{" "}
                        </>
                      ) : null}
                      <span className="text-text-2">
                        Line total: {formatCurrency(lineTotal, currency)}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addLineItem}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-white/15 px-4 py-2.5 text-sm font-medium text-text-2 transition hover:border-ink-5 hover:text-white"
          >
            + Add line item
          </button>

          <div className="mt-5 flex items-center justify-between border-t border-ink-4 pt-4">
            <p className="text-sm text-text-2">
              Subtotal{" "}
              <span className="text-xs text-text-3">
                (in {currency} — all lines are priced in this currency)
              </span>
            </p>
            <p className="text-xl font-semibold text-white">
              {formatCurrency(subtotal, currency)}
            </p>
          </div>
          {/* T6.1 — Quote-total margin readout. Hides when no line has a cost. */}
          {totalMargin ? (
            <div
              className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm ${
                totalMargin.pct >= 50
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                  : totalMargin.pct >= 25
                    ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
                    : "border-rose-400/30 bg-rose-500/10 text-rose-100"
              }`}
            >
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] opacity-80">
                  Gross margin (quote)
                </p>
                <p className="mt-0.5 text-base font-semibold tabular-nums">
                  {totalMargin.pct.toFixed(1)}%{" "}
                  <span className="text-xs font-normal opacity-80">
                    ({formatCurrency(totalMargin.absolute, currency)} across{" "}
                    {totalMargin.linesWithCost} line
                    {totalMargin.linesWithCost === 1 ? "" : "s"})
                  </span>
                </p>
              </div>
              {totalMargin.linesWithoutCost > 0 ? (
                <p className="text-[11px] opacity-80">
                  {totalMargin.linesWithoutCost} line
                  {totalMargin.linesWithoutCost === 1 ? "" : "s"} missing cost —
                  margin shown is partial.
                </p>
              ) : null}
            </div>
          ) : null}
          <p className="mt-2 text-right text-xs text-text-3">
            All amounts shown exclude VAT.
          </p>
        </section>

        {/* Content blocks */}
        <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-text-3">
            Content
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Optional content blocks
          </h2>
          <p className="mt-1 text-sm text-text-2">
            Toggle in only what's relevant for this quote. Less is usually more.
          </p>

          <div className="mt-5 space-y-4">
            <label className="flex items-start gap-3 rounded-xl border border-ink-4 bg-ink-0/40 p-4">
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
                <span className="text-xs text-text-3">
                  Short paragraph about who Muloo is. Useful for new clients.
                </span>
              </span>
            </label>

            <label className="text-sm text-text-2">
              Executive summary (optional)
              <textarea
                value={executiveSummary}
                onChange={(event) => setExecutiveSummary(event.target.value)}
                rows={4}
                placeholder="One paragraph. What problem are we solving and how."
                className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
              />
            </label>

            <label className="text-sm text-text-2">
              Terms (optional)
              <textarea
                value={terms}
                onChange={(event) => setTerms(event.target.value)}
                rows={4}
                placeholder="Payment terms, validity, scope notes."
                className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
              />
            </label>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving || loadingClients || loadingSource}
            className="inline-flex items-center rounded-xl bg-[#51d0b0] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#6be0c1] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? "Saving..."
              : sourceId
                ? sourceMeta?.status === "draft"
                  ? "Save changes"
                  : `Create v${(sourceMeta?.version ?? 1) + 1} draft`
                : "Create draft quote"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/quotes")}
            className="rounded-xl border border-ink-4 bg-ink-1 px-5 py-3 text-sm font-medium text-text-2 transition hover:bg-white/5 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </form>
    </AppShell>
  );
}
