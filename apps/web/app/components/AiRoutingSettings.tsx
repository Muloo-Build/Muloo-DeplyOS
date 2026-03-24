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

export default function AiRoutingSettings() {
  const [providers, setProviders] = useState<ProviderConnection[]>([]);
  const [routes, setRoutes] = useState<AiRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [providersResponse, routesResponse] = await Promise.all([
          fetch("/api/provider-connections"),
          fetch("/api/ai-routing")
        ]);

        if (!providersResponse.ok) {
          throw new Error("Failed to load providers");
        }

        if (!routesResponse.ok) {
          throw new Error("Failed to load AI routing");
        }

        const providersBody = await providersResponse.json();
        const routesBody = await routesResponse.json();
        setProviders(providersBody.providers ?? []);
        setRoutes(routesBody.routes ?? []);
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

  const enabledProviders = useMemo(
    () =>
      providers.filter((provider) => provider.isEnabled && provider.hasApiKey),
    [providers]
  );

  function updateRoute(routeKey: string, field: keyof AiRoute, value: string) {
    setRoutes((current) =>
      current.map((route) =>
        route.workflowKey === routeKey ? { ...route, [field]: value } : route
      )
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
          Each workflow can run on a different provider/model. This gives you
          room to test Claude, GPT, Gemini, and Perplexity against the kinds of
          jobs they handle best.
        </p>
      </div>

      {routes.map((route) => {
        const provider =
          providers.find((item) => item.providerKey === route.providerKey) ??
          null;
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
                  ? `${provider.label}${provider.defaultModel ? ` • ${provider.defaultModel}` : ""}`
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
                  {enabledProviders.map((item) => (
                    <option key={item.providerKey} value={item.providerKey}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-white">
                  Model override
                </span>
                <input
                  value={route.modelOverride ?? ""}
                  onChange={(event) =>
                    updateRoute(
                      route.workflowKey,
                      "modelOverride",
                      event.target.value
                    )
                  }
                  placeholder={
                    provider?.defaultModel ?? "Use provider default model"
                  }
                  className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                />
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
