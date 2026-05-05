"use client";

import { useEffect, useMemo, useState } from "react";

interface CatalogModel {
  id: string;
  label: string;
  contextK: number;
  inputCostPer1M: number;
  outputCostPer1M: number;
  tier: string;
  releasedAt: string;
  deprecated?: boolean;
}

interface CatalogProvider {
  key: string;
  label: string;
  description: string;
  apiBase: string;
  models: CatalogModel[];
}

interface ProviderConnection {
  id: string;
  providerKey: string;
  label: string;
  connectionType: string;
  apiKey: string | null;
  hasApiKey: boolean;
  defaultModel: string | null;
  endpointUrl: string | null;
  notes: string | null;
  isEnabled: boolean;
}

const AI_PROVIDER_KEYS = new Set([
  "anthropic",
  "openai",
  "perplexity",
  "gemini",
  "grok",
  "deepseek",
  "mistral",
  "openrouter"
]);

function formatCost(perMillion: number): string {
  if (perMillion >= 1) return `$${perMillion.toFixed(2)}`;
  return `$${perMillion.toFixed(3)}`;
}

export default function AIProvidersSettings() {
  const [providers, setProviders] = useState<ProviderConnection[]>([]);
  const [catalog, setCatalog] = useState<Record<string, CatalogProvider>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [providerRes, catalogRes] = await Promise.all([
          fetch("/api/provider-connections"),
          fetch("/api/ai-integrations/catalog")
        ]);
        if (!providerRes.ok) throw new Error("Failed to load providers");
        if (!catalogRes.ok) throw new Error("Failed to load model catalog");
        const providerBody = await providerRes.json();
        const catalogBody = await catalogRes.json();
        if (cancelled) return;
        setProviders(
          (providerBody.providers ?? []).filter((p: ProviderConnection) =>
            AI_PROVIDER_KEYS.has(p.providerKey)
          )
        );
        setCatalog(catalogBody.catalog ?? {});
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Failed to load"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateProvider(
    providerKey: string,
    field: keyof ProviderConnection,
    value: string | boolean
  ) {
    setProviders((current) =>
      current.map((p) =>
        p.providerKey === providerKey ? { ...p, [field]: value } : p
      )
    );
  }

  async function saveProvider(providerKey: string) {
    const provider = providers.find((p) => p.providerKey === providerKey);
    if (!provider) return;
    setSaving(providerKey);
    setError(null);
    try {
      const res = await fetch(
        `/api/provider-connections/${encodeURIComponent(providerKey)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: provider.label,
            connectionType: provider.connectionType,
            apiKey: provider.apiKey ?? "",
            defaultModel: provider.defaultModel ?? "",
            endpointUrl: provider.endpointUrl ?? "",
            notes: provider.notes ?? "",
            isEnabled: provider.isEnabled
          })
        }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Save failed");
      setProviders((current) =>
        current.map((p) =>
          p.providerKey === providerKey ? body.provider : p
        )
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed");
    } finally {
      setSaving(null);
    }
  }

  const orderedProviders = useMemo(
    () =>
      [...providers].sort((a, b) => a.label.localeCompare(b.label)),
    [providers]
  );

  if (loading) {
    return (
      <div className="rounded-[14px] border border-ink-4 bg-ink-1 p-6 text-text-2">
        Loading providers + catalog...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
          {error}
        </div>
      ) : null}

      {orderedProviders.map((provider) => {
        const catalogEntry = catalog[provider.providerKey];
        const models = catalogEntry?.models ?? [];
        const selectedModel = models.find(
          (m) => m.id === provider.defaultModel
        );
        return (
          <div
            key={provider.id}
            className="rounded-[14px] border border-ink-4 bg-ink-1 p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                  AI provider
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  {provider.label}
                </h2>
                {catalogEntry ? (
                  <p className="mt-2 text-sm text-text-2">
                    {catalogEntry.description}
                  </p>
                ) : null}
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-white">
                <input
                  type="checkbox"
                  checked={provider.isEnabled}
                  onChange={(e) =>
                    updateProvider(
                      provider.providerKey,
                      "isEnabled",
                      e.target.checked
                    )
                  }
                />
                Enabled
              </label>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-white">
                  Default model
                </span>
                <select
                  value={provider.defaultModel ?? ""}
                  onChange={(e) =>
                    updateProvider(
                      provider.providerKey,
                      "defaultModel",
                      e.target.value
                    )
                  }
                  className="mt-3 w-full rounded-[14px] border border-ink-4 bg-ink-2 px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="">Select a model…</option>
                  {models.map((model) => (
                    <option
                      key={model.id}
                      value={model.id}
                      disabled={model.deprecated}
                    >
                      {model.label}
                      {model.deprecated ? " (deprecated)" : ""} — in {formatCost(model.inputCostPer1M)}/1M, out {formatCost(model.outputCostPer1M)}/1M
                    </option>
                  ))}
                </select>
                {selectedModel ? (
                  <p className="mt-2 text-xs text-text-3">
                    {selectedModel.contextK.toLocaleString()}k context · {selectedModel.tier} tier · released {selectedModel.releasedAt}
                  </p>
                ) : models.length === 0 ? (
                  <p className="mt-2 text-xs text-text-3">
                    No catalog entry for this provider yet.
                  </p>
                ) : null}
              </label>

              <label className="block">
                <span className="text-sm font-medium text-white">
                  Endpoint URL
                </span>
                <input
                  value={provider.endpointUrl ?? ""}
                  onChange={(e) =>
                    updateProvider(
                      provider.providerKey,
                      "endpointUrl",
                      e.target.value
                    )
                  }
                  placeholder={catalogEntry?.apiBase ?? "Optional custom endpoint"}
                  className="mt-3 w-full rounded-[14px] border border-ink-4 bg-ink-2 px-4 py-3 text-sm text-white outline-none"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-white">API key</span>
                <input
                  type="password"
                  value={provider.apiKey ?? ""}
                  onChange={(e) =>
                    updateProvider(
                      provider.providerKey,
                      "apiKey",
                      e.target.value
                    )
                  }
                  placeholder={
                    provider.hasApiKey
                      ? "A value is already stored — paste again to replace"
                      : "Paste provider API key"
                  }
                  autoComplete="off"
                  className="mt-3 w-full rounded-[14px] border border-ink-4 bg-ink-2 px-4 py-3 text-sm text-white outline-none"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-white">Notes</span>
                <textarea
                  value={provider.notes ?? ""}
                  onChange={(e) =>
                    updateProvider(
                      provider.providerKey,
                      "notes",
                      e.target.value
                    )
                  }
                  className="mt-3 min-h-[100px] w-full rounded-[14px] border border-ink-4 bg-ink-2 px-4 py-3 text-sm text-white outline-none"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => void saveProvider(provider.providerKey)}
              disabled={saving === provider.providerKey}
              className="mt-5 rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving === provider.providerKey ? "Saving..." : "Save provider"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
