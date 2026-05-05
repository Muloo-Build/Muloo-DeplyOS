"use client";

import { useEffect, useMemo, useState } from "react";

interface ProviderConnection {
  providerKey: string;
  label: string;
  defaultModel: string | null;
  isEnabled: boolean;
  hasApiKey: boolean;
}

interface AiRoute {
  id: string;
  workflowKey: string;
  label: string;
  providerKey: string;
  modelOverride: string | null;
  notes: string | null;
}

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

export default function AiRoutingSettings() {
  const [providers, setProviders] = useState<ProviderConnection[]>([]);
  const [routes, setRoutes] = useState<AiRoute[]>([]);
  const [catalog, setCatalog] = useState<Record<string, CatalogProvider>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [providersResponse, routesResponse, catalogResponse] =
          await Promise.all([
            fetch("/api/provider-connections"),
            fetch("/api/ai-routing"),
            fetch("/api/ai-integrations/catalog")
          ]);

        if (!providersResponse.ok) {
          throw new Error("Failed to load providers");
        }

        if (!routesResponse.ok) {
          throw new Error("Failed to load AI routing");
        }

        if (!catalogResponse.ok) {
          throw new Error("Failed to load model catalog");
        }

        const providersBody = await providersResponse.json();
        const routesBody = await routesResponse.json();
        const catalogBody = await catalogResponse.json();
        setProviders(providersBody.providers ?? []);
        setRoutes(routesBody.routes ?? []);
        setCatalog(catalogBody.catalog ?? {});
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load AI routing"
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  // Show every AI provider so routing is selectable even before keys are
  // configured. Mark un-enabled providers in the dropdown so it's clear
  // they need an API key before the workflow can actually run.
  const aiProviders = useMemo(
    () =>
      providers
        .filter((provider) => AI_PROVIDER_KEYS.has(provider.providerKey))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [providers]
  );

  function updateRoute(routeKey: string, field: keyof AiRoute, value: string) {
    setRoutes((current) =>
      current.map((route) => {
        if (route.workflowKey !== routeKey) return route;
        const next = { ...route, [field]: value };
        // When the provider changes, blank the model override so the
        // dropdown drops back to "use provider default" instead of
        // showing a stale model from the previous provider.
        if (field === "providerKey" && route.providerKey !== value) {
          next.modelOverride = "";
        }
        return next;
      })
    );
  }

  async function saveRoute(routeKey: string) {
    const route = routes.find((item) => item.workflowKey === routeKey);
    if (!route) return;

    setSaving(routeKey);
    setError(null);

    try {
      const response = await fetch(
        `/api/ai-routing/${encodeURIComponent(routeKey)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerKey: route.providerKey,
            modelOverride: route.modelOverride ?? "",
            notes: route.notes ?? ""
          })
        }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save AI route");
      }
      setRoutes((current) =>
        current.map((item) =>
          item.workflowKey === routeKey ? body.route : item
        )
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save AI route"
      );
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 text-text-secondary">
        Loading AI routing...
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

      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
        <p className="text-sm text-text-secondary">
          Each workflow can run on a different provider and model. Provider
          dropdowns include every AI provider; ones without an enabled API key
          are marked so you can see what still needs configuring under{" "}
          <span className="text-white">Providers</span>.
        </p>
      </div>

      {routes.map((route) => {
        const provider =
          providers.find((item) => item.providerKey === route.providerKey) ??
          null;
        const catalogEntry = catalog[route.providerKey];
        const catalogModels = catalogEntry?.models ?? [];
        const knownIds = new Set(catalogModels.map((m) => m.id));
        const overrideId = route.modelOverride ?? "";
        const overrideMissingFromCatalog =
          overrideId.length > 0 && !knownIds.has(overrideId);
        return (
          <section
            key={route.id}
            className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                  Workflow
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  {route.label}
                </h2>
                <p className="mt-2 text-sm text-text-secondary">
                  Route this workflow to the model/provider that performs best
                  for it.
                </p>
              </div>
              <div className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-xs text-text-secondary">
                {provider
                  ? `${provider.label}${
                      route.modelOverride
                        ? ` • ${route.modelOverride}`
                        : provider.defaultModel
                          ? ` • ${provider.defaultModel}`
                          : ""
                    }`
                  : "Unassigned"}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-white">Provider</span>
                <select
                  value={route.providerKey}
                  onChange={(event) =>
                    updateRoute(
                      route.workflowKey,
                      "providerKey",
                      event.target.value
                    )
                  }
                  className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                >
                  {/* Always include the currently-saved provider so the
                      select shows a sensible label even if the catalog has
                      shifted underneath it. */}
                  {provider &&
                  !aiProviders.some(
                    (p) => p.providerKey === route.providerKey
                  ) ? (
                    <option value={route.providerKey}>
                      {provider.label} (current)
                    </option>
                  ) : null}
                  {aiProviders.map((item) => {
                    const ready = item.isEnabled && item.hasApiKey;
                    return (
                      <option
                        key={item.providerKey}
                        value={item.providerKey}
                      >
                        {item.label}
                        {ready ? "" : " — needs API key"}
                      </option>
                    );
                  })}
                </select>
                {provider && !(provider.isEnabled && provider.hasApiKey) ? (
                  <p className="mt-2 text-xs text-[#ffd28a]">
                    This provider is missing an API key. Add one under
                    Providers before this route runs in production.
                  </p>
                ) : null}
              </label>

              <label className="block">
                <span className="text-sm font-medium text-white">
                  Model override
                </span>
                <select
                  value={route.modelOverride ?? ""}
                  onChange={(event) =>
                    updateRoute(
                      route.workflowKey,
                      "modelOverride",
                      event.target.value
                    )
                  }
                  className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="">
                    Use provider default
                    {provider?.defaultModel
                      ? ` (${provider.defaultModel})`
                      : ""}
                  </option>
                  {overrideMissingFromCatalog ? (
                    <option value={overrideId}>
                      {overrideId} (legacy — not in catalog)
                    </option>
                  ) : null}
                  {catalogModels.map((model) => (
                    <option
                      key={model.id}
                      value={model.id}
                      disabled={model.deprecated}
                    >
                      {model.label}
                      {model.deprecated ? " (deprecated)" : ""}
                      {" — in "}
                      {formatCost(model.inputCostPer1M)}/1M, out{" "}
                      {formatCost(model.outputCostPer1M)}/1M
                    </option>
                  ))}
                </select>
                {catalogEntry === undefined ? (
                  <p className="mt-2 text-xs text-text-muted">
                    No catalog entry for this provider — falls back to its
                    default model.
                  </p>
                ) : null}
              </label>

              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-white">Notes</span>
                <textarea
                  value={route.notes ?? ""}
                  onChange={(event) =>
                    updateRoute(route.workflowKey, "notes", event.target.value)
                  }
                  className="mt-3 min-h-[96px] w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                  placeholder="Why this workflow uses this provider/model, testing notes, or known strengths."
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => void saveRoute(route.workflowKey)}
              disabled={saving === route.workflowKey}
              className="mt-5 rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving === route.workflowKey ? "Saving..." : "Save routing"}
            </button>
          </section>
        );
      })}
    </div>
  );
}
