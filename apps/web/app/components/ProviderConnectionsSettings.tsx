"use client";

import { useEffect, useState } from "react";

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

export default function ProviderConnectionsSettings() {
  const [providers, setProviders] = useState<ProviderConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProviders() {
      try {
        const response = await fetch("/api/provider-connections");

        if (!response.ok) {
          throw new Error("Failed to load provider connections");
        }

        const body = await response.json();
        setProviders(body.providers ?? []);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load provider connections"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadProviders();
  }, []);

  function updateProvider(
    providerKey: string,
    field: keyof ProviderConnection,
    value: string | boolean
  ) {
    setProviders((current) =>
      current.map((provider) =>
        provider.providerKey === providerKey
          ? { ...provider, [field]: value }
          : provider
      )
    );
  }

  async function saveProvider(providerKey: string) {
    const provider = providers.find((item) => item.providerKey === providerKey);
    if (!provider) {
      return;
    }

    setSaving(providerKey);
    setError(null);

    try {
      const response = await fetch(
        `/api/provider-connections/${encodeURIComponent(providerKey)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
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

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save provider");
      }

      setProviders((current) =>
        current.map((item) =>
          item.providerKey === providerKey ? body.provider : item
        )
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save provider"
      );
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 text-text-secondary">
        Loading provider connections...
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

      {providers.map((provider) => (
        <div
          key={provider.id}
          className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
                {provider.connectionType === "oauth" ? "OAuth" : "API Key"}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                {provider.label}
              </h2>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-white">
              <input
                type="checkbox"
                checked={provider.isEnabled}
                onChange={(event) =>
                  updateProvider(provider.providerKey, "isEnabled", event.target.checked)
                }
              />
              Enabled
            </label>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-white">Default model</span>
              <input
                value={provider.defaultModel ?? ""}
                onChange={(event) =>
                  updateProvider(provider.providerKey, "defaultModel", event.target.value)
                }
                placeholder="e.g. gpt-5.4 or claude-sonnet"
                className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-white">Endpoint URL</span>
              <input
                value={provider.endpointUrl ?? ""}
                onChange={(event) =>
                  updateProvider(provider.providerKey, "endpointUrl", event.target.value)
                }
                placeholder="Optional custom endpoint"
                className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
              />
              {provider.providerKey === "hubspot_oauth" ? (
                <p className="mt-2 text-xs text-text-muted">
                  Leave blank for HubSpot&apos;s default API base URL. Only set this when routing through a specific HubSpot-compatible gateway.
                </p>
              ) : null}
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-white">
                {provider.connectionType === "oauth" ? "Connection token / notes" : "API key"}
              </span>
              <input
                type="password"
                value={provider.apiKey ?? ""}
                onChange={(event) =>
                  updateProvider(provider.providerKey, "apiKey", event.target.value)
                }
                placeholder={
                  provider.providerKey === "hubspot_oauth"
                    ? "Paste a HubSpot private app token or OAuth access token"
                    : provider.connectionType === "oauth"
                      ? "Store a token or integration reference"
                    : "Paste provider API key"
                }
                className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
              />
              {provider.hasApiKey ? (
                <p className="mt-2 text-xs text-text-muted">
                  A value is already stored for this provider.
                </p>
              ) : null}
              {provider.providerKey === "hubspot_oauth" ? (
                <p className="mt-2 text-xs text-text-muted">
                  Best first path for agent execution: use a HubSpot token for direct CRM schema and record APIs. Keep workflow, dashboard, and CMS work on the reviewed paths surfaced in Agent Studio.
                </p>
              ) : null}
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-white">Notes</span>
              <textarea
                value={provider.notes ?? ""}
                onChange={(event) =>
                  updateProvider(provider.providerKey, "notes", event.target.value)
                }
                className="mt-3 min-h-[100px] w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => void saveProvider(provider.providerKey)}
            disabled={saving === provider.providerKey}
            className="mt-5 rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed"
          >
            {saving === provider.providerKey ? "Saving..." : "Save provider"}
          </button>
        </div>
      ))}
    </div>
  );
}
