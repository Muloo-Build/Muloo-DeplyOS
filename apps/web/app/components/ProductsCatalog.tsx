"use client";

import { useEffect, useState } from "react";

import AppShell from "./AppShell";

interface ProductCatalogItem {
  id: string;
  slug: string;
  name: string;
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
  category: string;
  billingModel: string;
  description: string;
  unitPrice: string;
  defaultQuantity: string;
  unitLabel: string;
  isActive: boolean;
  sortOrder: string;
}

function createEmptyDraft(): ProductDraft {
  return {
    name: "",
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

function ProductsCatalogContent() {
  const [products, setProducts] = useState<ProductCatalogItem[]>([]);
  const [newDraft, setNewDraft] = useState<ProductDraft>(createEmptyDraft());
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch("/api/products");

        if (!response.ok) {
          throw new Error("Failed to load product catalog");
        }

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

    void loadProducts();
  }, []);

  function updateProduct(
    productId: string,
    field: keyof ProductCatalogItem,
    value: string | boolean
  ) {
    setProducts((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId ? { ...product, [field]: value } : product
      )
    );
  }

  async function saveProduct(productId: string) {
    const product = products.find((candidate) => candidate.id === productId);

    if (!product) {
      return;
    }

    setSaving(productId);
    setError(null);

    try {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: product.name,
          category: product.category,
          billingModel: product.billingModel,
          description: product.description ?? "",
          unitPrice: Number(product.unitPrice),
          defaultQuantity: Number(product.defaultQuantity),
          unitLabel: product.unitLabel,
          isActive: product.isActive,
          sortOrder: Number(product.sortOrder)
        })
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save product");
      }

      setProducts((currentProducts) =>
        currentProducts.map((candidate) =>
          candidate.id === productId ? body.product : candidate
        )
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save product"
      );
    } finally {
      setSaving(null);
    }
  }

  async function createProduct() {
    setSaving("new");
    setError(null);

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...newDraft,
          unitPrice: Number(newDraft.unitPrice),
          defaultQuantity: Number(newDraft.defaultQuantity),
          sortOrder: Number(newDraft.sortOrder)
        })
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to create product");
      }

      setProducts((currentProducts) =>
        [...currentProducts, body.product].sort(
          (left, right) => left.sortOrder - right.sortOrder
        )
      );
      setNewDraft(createEmptyDraft());
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to create product"
      );
    } finally {
      setSaving(null);
    }
  }

  return (
      <div className="p-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
              Commercial Catalog
            </p>
            <h1 className="mt-3 text-3xl font-bold font-heading text-white">
              Products
            </h1>
            <p className="mt-2 max-w-3xl text-text-secondary">
              Manage one-off services, retainers, and add-ons that can be pulled
              into quotes alongside discovery-led implementation scope.
            </p>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-[rgba(224,80,96,0.4)] bg-background-card p-4 text-sm text-white">
            {error}
          </div>
        ) : null}

        <div className="mb-6 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
            New Product
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["Name", "name"],
              ["Description", "description"],
              ["Unit Price", "unitPrice"],
              ["Default Quantity", "defaultQuantity"],
              ["Unit Label", "unitLabel"],
              ["Sort Order", "sortOrder"]
            ].map(([label, key]) => (
              <label key={key} className="block">
                <span className="text-sm font-medium text-white">{label}</span>
                <input
                  value={newDraft[key as keyof ProductDraft] as string}
                  onChange={(event) =>
                    setNewDraft((currentDraft) => ({
                      ...currentDraft,
                      [key]: event.target.value
                    }))
                  }
                  className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                />
              </label>
            ))}

            <label className="block">
              <span className="text-sm font-medium text-white">Category</span>
              <select
                value={newDraft.category}
                onChange={(event) =>
                  setNewDraft((currentDraft) => ({
                    ...currentDraft,
                    category: event.target.value
                  }))
                }
                className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
              >
                <option value="one_time">One-time</option>
                <option value="retainer">Retainer</option>
                <option value="add_on">Add-on</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-white">Billing Model</span>
              <select
                value={newDraft.billingModel}
                onChange={(event) =>
                  setNewDraft((currentDraft) => ({
                    ...currentDraft,
                    billingModel: event.target.value
                  }))
                }
                className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
              >
                <option value="fixed">Fixed</option>
                <option value="monthly">Monthly</option>
                <option value="hourly">Hourly</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={() => void createProduct()}
            disabled={saving === "new"}
            className="mt-5 rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed"
          >
            {saving === "new" ? "Creating..." : "Add Product"}
          </button>
        </div>

        <div className="grid gap-4">
          {loading ? (
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 text-text-secondary">
              Loading products...
            </div>
          ) : (
            products.map((product) => (
              <div
                key={product.id}
                className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6"
              >
                <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr_1fr_1fr_160px]">
                  <label className="block">
                    <span className="text-sm font-medium text-white">Name</span>
                    <input
                      value={product.name}
                      onChange={(event) =>
                        updateProduct(product.id, "name", event.target.value)
                      }
                      className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-white">Category</span>
                    <select
                      value={product.category}
                      onChange={(event) =>
                        updateProduct(product.id, "category", event.target.value)
                      }
                      className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                    >
                      <option value="one_time">One-time</option>
                      <option value="retainer">Retainer</option>
                      <option value="add_on">Add-on</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-white">Billing</span>
                    <select
                      value={product.billingModel}
                      onChange={(event) =>
                        updateProduct(product.id, "billingModel", event.target.value)
                      }
                      className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                    >
                      <option value="fixed">Fixed</option>
                      <option value="monthly">Monthly</option>
                      <option value="hourly">Hourly</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-white">Unit Price</span>
                    <input
                      value={String(product.unitPrice)}
                      onChange={(event) =>
                        updateProduct(product.id, "unitPrice", event.target.value)
                      }
                      className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => void saveProduct(product.id)}
                      disabled={saving === product.id}
                      className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed"
                    >
                      {saving === product.id ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
                <label className="mt-4 block">
                  <span className="text-sm font-medium text-white">Description</span>
                  <textarea
                    value={product.description ?? ""}
                    onChange={(event) =>
                      updateProduct(product.id, "description", event.target.value)
                    }
                    className="mt-3 min-h-[100px] w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                  />
                </label>
              </div>
            ))
          )}
        </div>
      </div>
  );
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
