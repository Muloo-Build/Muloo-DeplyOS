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
  defaultQuantity: string;
  unitLabel: string;
  isActive: boolean;
  sortOrder: string;
}

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
    defaultQuantity: String(product.defaultQuantity),
    unitLabel: product.unitLabel,
    isActive: product.isActive,
    sortOrder: String(product.sortOrder)
  };
}

function formatMoney(amount: number) {
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "ZAR",
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
            className="w-full max-w-sm rounded-xl border border-white/10 bg-background-card px-3 py-2.5 text-sm text-white placeholder:text-text-muted"
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
                      : "border-white/10 bg-background-card text-text-secondary hover:border-white/20 hover:text-white"
                  }`}
                >
                  {opt.label}
                  <span className="text-[10px] text-text-muted">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-white/10 bg-background-card p-1 text-xs">
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
                    : "text-text-secondary hover:text-white"
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
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
      {feedback ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
          {feedback}
        </div>
      ) : null}

      {/* List */}
      <section className="rounded-2xl border border-white/10 bg-background-card">
        {loading ? (
          <div className="px-5 py-8 text-sm text-text-secondary">
            Loading products...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <p className="text-sm text-text-secondary">
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
                    <p className="mt-1 truncate text-xs text-text-muted">
                      {product.description}
                    </p>
                  ) : null}
                </button>
                <div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                      categoryStyles[product.category] ??
                      "bg-white/5 text-text-secondary border border-white/10"
                    }`}
                  >
                    {formatLabel(product.category, categoryOptions)}
                  </span>
                </div>
                <div className="text-sm text-text-secondary">
                  {formatLabel(product.billingModel, billingOptions)}
                </div>
                <div className="text-sm text-white tabular-nums">
                  {formatMoney(product.unitPrice)}
                </div>
                <div className="text-xs text-text-muted">
                  {product.defaultQuantity} {product.unitLabel}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void quickToggleActive(product)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                      product.isActive
                        ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                        : "border border-white/10 bg-white/5 text-text-secondary hover:bg-white/10"
                    }`}
                  >
                    {product.isActive ? "Active" : "Inactive"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditDrawer(product)}
                    className="rounded-lg border border-white/10 bg-background-primary/60 px-2.5 py-1 text-[11px] font-medium text-text-secondary transition hover:bg-white/10 hover:text-white"
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
          <div className="relative h-full w-full max-w-xl overflow-y-auto bg-[#0b1126] shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.32em] text-[#49cde1]">
                  {drawerMode === "create" ? "New product" : "Edit product"}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  {drawerMode === "create" ? "Add to catalogue" : draft.name || "Edit product"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-lg border border-white/10 bg-background-card px-3 py-1.5 text-sm text-text-secondary hover:bg-white/5 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              <label className="block text-sm text-text-secondary">
                Name
                <input
                  type="text"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((d) => ({ ...d, name: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
                  placeholder="e.g. Monthly HubSpot retainer"
                />
              </label>

              <label className="block text-sm text-text-secondary">
                Description
                <textarea
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((d) => ({ ...d, description: event.target.value }))
                  }
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
                  placeholder="What's included?"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-text-secondary">
                  Category
                  <select
                    value={draft.category}
                    onChange={(event) =>
                      setDraft((d) => ({ ...d, category: event.target.value }))
                    }
                    className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
                  >
                    {categoryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm text-text-secondary">
                  Billing model
                  <select
                    value={draft.billingModel}
                    onChange={(event) =>
                      setDraft((d) => ({
                        ...d,
                        billingModel: event.target.value
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
                  >
                    {billingOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block text-sm text-text-secondary">
                Service family
                <select
                  value={draft.serviceFamily}
                  onChange={(event) =>
                    setDraft((d) => ({
                      ...d,
                      serviceFamily: event.target.value
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
                >
                  {serviceFamilies.map((family) => (
                    <option key={family.value} value={family.value}>
                      {family.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block text-sm text-text-secondary">
                  Unit price (ZAR)
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={draft.unitPrice}
                    onChange={(event) =>
                      setDraft((d) => ({ ...d, unitPrice: event.target.value }))
                    }
                    className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
                  />
                </label>
                <label className="block text-sm text-text-secondary">
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
                    className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
                  />
                </label>
                <label className="block text-sm text-text-secondary">
                  Unit label
                  <input
                    type="text"
                    value={draft.unitLabel}
                    onChange={(event) =>
                      setDraft((d) => ({ ...d, unitLabel: event.target.value }))
                    }
                    className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-text-secondary">
                  Sort order
                  <input
                    type="number"
                    step="1"
                    value={draft.sortOrder}
                    onChange={(event) =>
                      setDraft((d) => ({ ...d, sortOrder: event.target.value }))
                    }
                    className="mt-2 w-full rounded-xl border border-white/10 bg-background-primary px-3 py-2.5 text-white"
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    Lower numbers appear first.
                  </p>
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-background-primary/40 px-4 py-3 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(event) =>
                      setDraft((d) => ({ ...d, isActive: event.target.checked }))
                    }
                  />
                  <span>
                    <span className="block font-medium text-white">Active</span>
                    <span className="text-xs text-text-muted">
                      Active products are pickable from quotes.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-6 py-4">
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
                className="rounded-xl border border-white/10 bg-background-card px-5 py-2.5 text-sm text-text-secondary hover:bg-white/5 hover:text-white"
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
