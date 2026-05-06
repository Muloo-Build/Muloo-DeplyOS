"use client";

import { useEffect, useMemo, useState } from "react";

import AppShell from "./AppShell";

interface ProductCatalogItem {
  id: string;
  slug: string;
  name: string;
  serviceFamily: string;
  category: string;
  billingModel: string;
  description?: string | null;
  unitPrice: number;
  // T6.1 — cost / currency / marginTarget added so operators can track
  // gross margin against each catalogue item. cost / marginTarget are
  // nullable: existing rows with no cost just don't show a margin badge.
  cost?: number | null;
  currency?: string;
  marginTarget?: number | null;
  defaultQuantity: number;
  unitLabel: string;
  isActive: boolean;
  sortOrder: number;
}

interface ProductDraft {
  name: string;
  serviceFamily: string;
  category: string;
  billingModel: string;
  description: string;
  unitPrice: string;
  cost: string;
  currency: string;
  marginTarget: string;
  defaultQuantity: string;
  unitLabel: string;
  isActive: boolean;
  sortOrder: string;
}

const currencyOptions = ["ZAR", "USD", "EUR", "GBP", "AUD"];

const serviceFamilies = [
  { value: "hubspot_architecture", label: "HubSpot Architecture" },
  { value: "custom_engineering", label: "Custom Engineering" },
  { value: "ai_automation", label: "AI Automation" }
];

const categoryOptions = [
  { value: "one_time", label: "One-time" },
  { value: "retainer", label: "Retainer" },
  { value: "add_on", label: "Add-on" }
];

const billingOptions = [
  { value: "fixed", label: "Fixed" },
  { value: "monthly", label: "Monthly" },
  { value: "hourly", label: "Hourly" }
];

const categoryStyles: Record<string, string> = {
  one_time: "bg-[#49cde1]/15 text-[#9be4f0] border border-[#49cde1]/30",
  retainer: "bg-emerald-500/15 text-emerald-200 border border-emerald-400/30",
  add_on: "bg-violet-500/15 text-violet-200 border border-violet-400/30"
};

function emptyDraft(): ProductDraft {
  return {
    name: "",
    serviceFamily: "hubspot_architecture",
    category: "one_time",
    billingModel: "fixed",
    description: "",
    unitPrice: "",
    cost: "",
    currency: "ZAR",
    marginTarget: "",
    defaultQuantity: "1",
    unitLabel: "item",
    isActive: true,
    sortOrder: "999"
  };
}

function productToDraft(product: ProductCatalogItem): ProductDraft {
  return {
    name: product.name,
    serviceFamily: product.serviceFamily,
    category: product.category,
    billingModel: product.billingModel,
    description: product.description ?? "",
    unitPrice: String(product.unitPrice),
    cost:
      product.cost === null || product.cost === undefined
        ? ""
        : String(product.cost),
    currency: product.currency ?? "ZAR",
    marginTarget:
      product.marginTarget === null || product.marginTarget === undefined
        ? ""
        : String(product.marginTarget),
    defaultQuantity: String(product.defaultQuantity),
    unitLabel: product.unitLabel,
    isActive: product.isActive,
    sortOrder: String(product.sortOrder)
  };
}

// Live margin computation for the catalogue list + drawer preview.
function computeMargin(
  unitPrice: number,
  cost: number | null | undefined
): { absolute: number; pct: number } | null {
  if (
    cost === null ||
    cost === undefined ||
    !Number.isFinite(cost) ||
    !Number.isFinite(unitPrice) ||
    unitPrice <= 0
  ) {
    return null;
  }
  const absolute = unitPrice - cost;
  const pct = (absolute / unitPrice) * 100;
  return { absolute, pct };
}

function formatMoney(amount: number, currency: string = "ZAR") {
  if (!Number.isFinite(amount)) return "—";
  const safe =
    typeof currency === "string" && currency.trim().length === 3
      ? currency.toUpperCase()
      : "ZAR";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: safe,
    maximumFractionDigits: 0
  }).format(amount);
}

function formatLabel(value: string, options: typeof categoryOptions) {
  return options.find((opt) => opt.value === value)?.label ?? value;
}

function ProductsCatalogContent() {
  const [products, setProducts] = useState<ProductCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    "active"
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    try {
      const response = await fetch("/api/products");
      if (!response.ok) throw new Error("Failed to load product catalog");
      const body = await response.json();
      setProducts(body.products ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load product catalog"
      );
    } finally {
      setLoading(false);
    }
  }

  function openCreateDrawer() {
    setDrawerMode("create");
    setEditingId(null);
    setDraft(emptyDraft());
    setDrawerOpen(true);
  }

  function openEditDrawer(product: ProductCatalogItem) {
    setDrawerMode("edit");
    setEditingId(product.id);
    setDraft(productToDraft(product));
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setDraft(emptyDraft());
    setEditingId(null);
  }

  async function quickToggleActive(product: ProductCatalogItem) {
    setError(null);
    try {
      const response = await fetch(
        `/api/products/${encodeURIComponent(product.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...product,
            isActive: !product.isActive,
            unitPrice: Number(product.unitPrice),
            defaultQuantity: Number(product.defaultQuantity),
            sortOrder: Number(product.sortOrder)
          })
        }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to update product");
      }
      setProducts((current) =>
        current.map((p) => (p.id === product.id ? body.product : p))
      );
      setFeedback(`${product.name} ${product.isActive ? "deactivated" : "activated"}.`);
      window.setTimeout(() => setFeedback(null), 2000);
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Failed to update product"
      );
    }
  }

  async function saveDraft() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...draft,
        unitPrice: Number(draft.unitPrice) || 0,
        // Empty cost / marginTarget submit as null so the column clears out
        // rather than coercing 0 (a legitimate cost) by accident.
        cost: draft.cost.trim() === "" ? null : Number(draft.cost),
        currency: draft.currency || "ZAR",
        marginTarget:
          draft.marginTarget.trim() === ""
            ? null
            : Number(draft.marginTarget),
        defaultQuantity: Number(draft.defaultQuantity) || 1,
        sortOrder: Number(draft.sortOrder) || 999
      };

      const url =
        drawerMode === "edit" && editingId
          ? `/api/products/${encodeURIComponent(editingId)}`
          : "/api/products";
      const method = drawerMode === "edit" ? "PATCH" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.product) {
        throw new Error(body?.error ?? "Failed to save product");
      }

      setProducts((current) => {
        if (drawerMode === "edit") {
          return current.map((p) => (p.id === body.product.id ? body.product : p));
        }
        return [...current, body.product].sort((a, b) => a.sortOrder - b.sortOrder);
      });
      setFeedback(drawerMode === "edit" ? "Product saved." : "Product added.");
      window.setTimeout(() => setFeedback(null), 2500);
      closeDrawer();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save product"
      );
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    let list = products;
    if (statusFilter === "active") list = list.filter((p) => p.isActive);
    if (statusFilter === "inactive") list = list.filter((p) => !p.isActive);
    if (categoryFilter !== "all") {
      list = list.filter((p) => p.category === categoryFilter);
    }
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          (p.description ?? "").toLowerCase().includes(term)
      );
    }
    return list;
  }, [products, search, categoryFilter, statusFilter]);

  const counts = useMemo(() => {
    const cats: Record<string, number> = { all: products.length };
    let active = 0;
    let inactive = 0;
    for (const p of products) {
      cats[p.category] = (cats[p.category] ?? 0) + 1;
      if (p.isActive) active++;
      else inactive++;
    }
    return { cats, active, inactive };
  }, [products]);

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products..."
            className="w-full max-w-sm rounded-xl border border-ink-4 bg-ink-1 px-3 py-2.5 text-sm text-white placeholder:text-text-3"
          />
          <div className="flex flex-wrap gap-2">
            {[
              { value: "all", label: "All categories" },
              ...categoryOptions
            ].map((opt) => {
              const count =
                opt.value === "all"
                  ? counts.cats.all
                  : counts.cats[opt.value] ?? 0;
              const active = categoryFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCategoryFilter(opt.value)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "border-[#51d0b0]/50 bg-[#51d0b0]/10 text-[#9be4d2]"
                      : "border-ink-4 bg-ink-1 text-text-2 hover:border-ink-5 hover:text-white"
                  }`}
                >
                  {opt.label}
                  <span className="text-[10px] text-text-3">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-ink-4 bg-ink-1 p-1 text-xs">
            {(
              [
                { value: "active", label: `Active · ${counts.active}` },
                { value: "inactive", label: `Inactive · ${counts.inactive}` },
                { value: "all", label: `All · ${products.length}` }
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`rounded-full px-3 py-1.5 transition ${
                  statusFilter === opt.value
                    ? "bg-white/10 text-white"
                    : "text-text-2 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={openCreateDrawer}
            className="inline-flex items-center rounded-xl bg-[#51d0b0] px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-[#6be0c1]"
          >
            + Add product
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-[14px] border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
      {feedback ? (
        <div className="rounded-[14px] border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
          {feedback}
        </div>
      ) : null}

      {/* List */}
      <section className="rounded-[14px] border border-ink-4 bg-ink-1">
        {loading ? (
          <div className="px-5 py-8 text-sm text-text-2">
            Loading products...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <p className="text-sm text-text-2">
              {products.length === 0
                ? "No products yet. Add your first."
                : "No products match the current filters."}
            </p>
            {products.length === 0 ? (
              <button
                type="button"
                onClick={openCreateDrawer}
                className="rounded-xl bg-[#51d0b0] px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-[#6be0c1]"
              >
                Add product
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {filtered.map((product) => (
              <li
                key={product.id}
                className={`grid gap-3 px-5 py-4 transition hover:bg-white/[0.03] sm:grid-cols-[2fr_1fr_0.8fr_0.7fr_0.6fr_auto] sm:items-center ${
                  product.isActive ? "" : "opacity-60"
                }`}
              >
                <button
                  type="button"
                  onClick={() => openEditDrawer(product)}
                  className="text-left"
                >
                  <p className="truncate text-base font-semibold text-white">
                    {product.name}
                  </p>
                  {product.description ? (
                    <p className="mt-1 truncate text-xs text-text-3">
                      {product.description}
                    </p>
                  ) : null}
                </button>
                <div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                      categoryStyles[product.category] ??
                      "bg-white/5 text-text-2 border border-ink-4"
                    }`}
                  >
                    {formatLabel(product.category, categoryOptions)}
                  </span>
                </div>
                <div className="text-sm text-text-2">
                  {formatLabel(product.billingModel, billingOptions)}
                </div>
                <div className="text-sm text-white tabular-nums">
                  {formatMoney(product.unitPrice, product.currency)}
                  {(() => {
                    const margin = computeMargin(
                      product.unitPrice,
                      product.cost ?? null
                    );
                    if (!margin) {
                      return (
                        <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-text-3">
                          No cost set
                        </p>
                      );
                    }
                    const target = product.marginTarget ?? null;
                    const meetsTarget =
                      target === null || margin.pct >= target;
                    return (
                      <p
                        className={`mt-0.5 text-[10px] uppercase tracking-[0.14em] ${
                          meetsTarget
                            ? "text-emerald-300"
                            : "text-amber-300"
                        }`}
                      >
                        Margin {margin.pct.toFixed(0)}%
                        {target !== null
                          ? ` · target ${target.toFixed(0)}%`
                          : ""}
                      </p>
                    );
                  })()}
                </div>
                <div className="text-xs text-text-3">
                  {product.defaultQuantity} {product.unitLabel}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void quickToggleActive(product)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                      product.isActive
                        ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                        : "border border-ink-4 bg-white/5 text-text-2 hover:bg-white/10"
                    }`}
                  >
                    {product.isActive ? "Active" : "Inactive"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditDrawer(product)}
                    className="rounded-lg border border-ink-4 bg-ink-0/60 px-2.5 py-1 text-[11px] font-medium text-text-2 transition hover:bg-white/10 hover:text-white"
                  >
                    Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Drawer */}
      {drawerOpen ? (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDrawer();
          }}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative h-full w-full max-w-xl overflow-y-auto bg-ink-2 shadow-2xl">
            <div className="flex items-start justify-between border-b border-ink-4 px-6 py-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#49cde1]">
                  {drawerMode === "create" ? "New product" : "Edit product"}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  {drawerMode === "create" ? "Add to catalogue" : draft.name || "Edit product"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-lg border border-ink-4 bg-ink-1 px-3 py-1.5 text-sm text-text-2 hover:bg-white/5 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              <label className="block text-sm text-text-2">
                Name
                <input
                  type="text"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((d) => ({ ...d, name: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                  placeholder="e.g. Monthly HubSpot retainer"
                />
              </label>

              <label className="block text-sm text-text-2">
                Description
                <textarea
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((d) => ({ ...d, description: event.target.value }))
                  }
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                  placeholder="What's included?"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-text-2">
                  Category
                  <select
                    value={draft.category}
                    onChange={(event) =>
                      setDraft((d) => ({ ...d, category: event.target.value }))
                    }
                    className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                  >
                    {categoryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm text-text-2">
                  Billing model
                  <select
                    value={draft.billingModel}
                    onChange={(event) =>
                      setDraft((d) => ({
                        ...d,
                        billingModel: event.target.value
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                  >
                    {billingOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block text-sm text-text-2">
                Service family
                <select
                  value={draft.serviceFamily}
                  onChange={(event) =>
                    setDraft((d) => ({
                      ...d,
                      serviceFamily: event.target.value
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                >
                  {serviceFamilies.map((family) => (
                    <option key={family.value} value={family.value}>
                      {family.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block text-sm text-text-2">
                  Unit price
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={draft.unitPrice}
                    onChange={(event) =>
                      setDraft((d) => ({ ...d, unitPrice: event.target.value }))
                    }
                    className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                  />
                </label>
                <label className="block text-sm text-text-2">
                  Default qty
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={draft.defaultQuantity}
                    onChange={(event) =>
                      setDraft((d) => ({
                        ...d,
                        defaultQuantity: event.target.value
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                  />
                </label>
                <label className="block text-sm text-text-2">
                  Unit label
                  <input
                    type="text"
                    value={draft.unitLabel}
                    onChange={(event) =>
                      setDraft((d) => ({ ...d, unitLabel: event.target.value }))
                    }
                    className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                  />
                </label>
              </div>

              {/* T6.1 — cost / currency / margin target row. Cost is the
                  internal delivery cost per unit; the drawer shows the live
                  gross margin so operators see margin slip in real time. */}
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block text-sm text-text-2">
                  Unit cost
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={draft.cost}
                    onChange={(event) =>
                      setDraft((d) => ({ ...d, cost: event.target.value }))
                    }
                    placeholder="Leave blank if unknown"
                    className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                  />
                </label>
                <label className="block text-sm text-text-2">
                  Currency
                  <select
                    value={draft.currency}
                    onChange={(event) =>
                      setDraft((d) => ({ ...d, currency: event.target.value }))
                    }
                    className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                  >
                    {currencyOptions.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm text-text-2">
                  Margin target (%)
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={draft.marginTarget}
                    onChange={(event) =>
                      setDraft((d) => ({
                        ...d,
                        marginTarget: event.target.value
                      }))
                    }
                    placeholder="e.g. 60"
                    className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                  />
                </label>
              </div>

              {(() => {
                const unitPrice = Number(draft.unitPrice);
                const cost =
                  draft.cost.trim() === "" ? null : Number(draft.cost);
                const margin = computeMargin(unitPrice, cost);
                const target =
                  draft.marginTarget.trim() === ""
                    ? null
                    : Number(draft.marginTarget);
                if (!margin) {
                  return (
                    <p className="text-xs text-text-3">
                      Add a unit price and a cost to see live gross margin.
                    </p>
                  );
                }
                const meetsTarget =
                  target === null ||
                  !Number.isFinite(target) ||
                  margin.pct >= target;
                return (
                  <div
                    className={`rounded-xl border px-4 py-3 text-sm ${
                      meetsTarget
                        ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                        : "border-amber-400/30 bg-amber-500/10 text-amber-100"
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-[0.14em] opacity-80">
                      Live gross margin
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {margin.pct.toFixed(1)}%{" "}
                      <span className="text-xs font-normal opacity-80">
                        ({margin.absolute.toFixed(2)} {draft.currency || "ZAR"}{" "}
                        / unit)
                      </span>
                    </p>
                    {target !== null && Number.isFinite(target) ? (
                      <p className="mt-1 text-xs opacity-80">
                        {meetsTarget
                          ? `Meets ${target.toFixed(0)}% target`
                          : `Below ${target.toFixed(0)}% target`}
                      </p>
                    ) : null}
                  </div>
                );
              })()}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-text-2">
                  Sort order
                  <input
                    type="number"
                    step="1"
                    value={draft.sortOrder}
                    onChange={(event) =>
                      setDraft((d) => ({ ...d, sortOrder: event.target.value }))
                    }
                    className="mt-2 w-full rounded-xl border border-ink-4 bg-ink-0 px-3 py-2.5 text-white"
                  />
                  <p className="mt-1 text-xs text-text-3">
                    Lower numbers appear first.
                  </p>
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-ink-4 bg-ink-0/40 px-4 py-3 text-sm text-text-2">
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(event) =>
                      setDraft((d) => ({ ...d, isActive: event.target.checked }))
                    }
                  />
                  <span>
                    <span className="block font-medium text-white">Active</span>
                    <span className="text-xs text-text-3">
                      Active products are pickable from quotes.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-ink-4 px-6 py-4">
              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={saving || !draft.name.trim()}
                className="inline-flex items-center rounded-xl bg-[#51d0b0] px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-[#6be0c1] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : drawerMode === "edit"
                    ? "Save changes"
                    : "Add product"}
              </button>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-xl border border-ink-4 bg-ink-1 px-5 py-2.5 text-sm text-text-2 hover:bg-white/5 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function StandaloneProductsCatalog() {
  return <ProductsCatalogContent />;
}

export function EmbeddedProductsCatalog() {
  return <ProductsCatalogContent />;
}

export default function ProductsCatalog() {
  return (
    <AppShell>
      <ProductsCatalogContent />
    </AppShell>
  );
}
