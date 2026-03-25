"use client";

import { useEffect, useState } from "react";

interface CalendarState {
  connected: boolean;
  connectedEmail?: string | null;
}

interface XeroInvoiceState {
  connected: boolean;
  tenantName?: string | null;
}

interface ProviderConnection {
  id: string;
  providerKey: string;
  label: string;
  defaultModel: string | null;
  isEnabled: boolean;
}

interface WorkspaceRoute {
  providerKey: string;
  model: string | null;
}

export default function WorkspaceSettings() {
  const [calendar, setCalendar] = useState<CalendarState | null>(null);
  const [xero, setXero] = useState<XeroInvoiceState | null>(null);
  const [providers, setProviders] = useState<ProviderConnection[]>([]);
  const [route, setRoute] = useState<WorkspaceRoute>({
    providerKey: "",
    model: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);

    try {
      const [calendarResponse, xeroResponse, routeResponse, providersResponse] =
        await Promise.all([
          fetch("/api/workspace/calendar/events"),
          fetch("/api/workspace/xero/invoices"),
          fetch("/api/workspace/ai-routing/daily_summary"),
          fetch("/api/provider-connections")
        ]);

      if (
        !calendarResponse.ok ||
        !xeroResponse.ok ||
        !routeResponse.ok ||
        !providersResponse.ok
      ) {
        throw new Error("Failed to load workspace settings");
      }

      const calendarBody = await calendarResponse.json();
      const xeroBody = await xeroResponse.json();
      const routeBody = await routeResponse.json();
      const providersBody = await providersResponse.json();

      setCalendar({
        connected: Boolean(calendarBody.connected),
        connectedEmail: calendarBody.connectedEmail ?? null
      });
      setXero({
        connected: Boolean(xeroBody.connected),
        tenantName: xeroBody.tenantName ?? null
      });

      const nextProviders = Array.isArray(providersBody.providers)
        ? providersBody.providers
        : [];
      setProviders(nextProviders);
      setRoute({
        providerKey: routeBody?.providerKey ?? "",
        model: routeBody?.model ?? ""
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load workspace settings"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function disconnectCalendar() {
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch("/api/workspace/calendar/connection", {
        method: "DELETE"
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to disconnect Google Calendar");
      }

      setFeedback("Google Calendar disconnected.");
      await loadAll();
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Failed to disconnect Google Calendar"
      );
    }
  }

  async function disconnectXero() {
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch("/api/workspace/xero/connection", {
        method: "DELETE"
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to disconnect Xero");
      }

      setFeedback("Xero disconnected.");
      await loadAll();
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Failed to disconnect Xero"
      );
    }
  }

  async function saveRoute() {
    if (!route.providerKey || !route.model) {
      setError("Choose a provider and model for the daily summary.");
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch("/api/workspace/ai-routing/daily_summary", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(route)
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save daily summary routing");
      }

      setRoute({
        providerKey: body.providerKey ?? route.providerKey,
        model: body.model ?? route.model
      });
      setFeedback("Daily summary routing updated.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save daily summary routing"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 text-text-secondary">
        Loading workspace settings...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-2xl border border-[rgba(224,80,96,0.35)] bg-[rgba(58,21,32,0.72)] px-5 py-4 text-sm text-white">
          {error}
        </div>
      ) : null}

      {feedback ? (
        <div className="rounded-2xl border border-[rgba(45,212,160,0.28)] bg-[rgba(13,48,40,0.65)] px-5 py-4 text-sm text-white">
          {feedback}
        </div>
      ) : null}

      <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Google Calendar
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              Connect the shared calendar feed used by the Command Centre.
            </p>
          </div>
          {calendar?.connected ? (
            <span className="rounded-full bg-[rgba(45,212,160,0.18)] px-3 py-1 text-xs font-medium text-[#54e1b1]">
              Connected
            </span>
          ) : null}
        </div>

        <p className="mt-5 text-sm text-text-secondary">
          {calendar?.connected
            ? `Connected as ${calendar.connectedEmail ?? "your Google account"}.`
            : "No Google Calendar connection configured yet."}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          {calendar?.connected ? (
            <button
              type="button"
              onClick={() => void disconnectCalendar()}
              className="rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-3 text-sm font-medium text-white"
            >
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                window.location.href = "/api/workspace/calendar/auth";
              }}
              className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white"
            >
              Connect Google Calendar
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Xero</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Manage the tenant used for invoice visibility in the Command Centre.
            </p>
          </div>
          {xero?.connected ? (
            <span className="rounded-full bg-[rgba(45,212,160,0.18)] px-3 py-1 text-xs font-medium text-[#54e1b1]">
              Connected
            </span>
          ) : null}
        </div>

        <p className="mt-5 text-sm text-text-secondary">
          {xero?.connected
            ? `Connected to ${xero.tenantName ?? "your Xero tenant"}.`
            : "No Xero connection configured yet."}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          {xero?.connected ? (
            <button
              type="button"
              onClick={() => void disconnectXero()}
              className="rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-3 text-sm font-medium text-white"
            >
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                window.location.href = "/api/workspace/xero/auth";
              }}
              className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white"
            >
              Connect Xero
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
        <h2 className="text-xl font-semibold text-white">
          Daily Summary AI routing
        </h2>
        <p className="mt-2 text-sm text-text-secondary">
          Choose which provider and model generate the Command Centre briefing.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-white">Provider</span>
            <select
              value={route.providerKey}
              onChange={(event) => {
                const provider = providers.find(
                  (entry) => entry.providerKey === event.target.value
                );
                setRoute({
                  providerKey: event.target.value,
                  model: provider?.defaultModel ?? route.model ?? ""
                });
              }}
              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
            >
              <option value="">Select a provider</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.providerKey}>
                  {provider.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-white">Model</span>
            <input
              value={route.model ?? ""}
              onChange={(event) =>
                setRoute((current) => ({
                  ...current,
                  model: event.target.value
                }))
              }
              placeholder="e.g. gpt-5.4 or claude-sonnet-4-20250514"
              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => void saveRoute()}
          disabled={saving}
          className="mt-5 rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save daily summary routing"}
        </button>
      </section>
    </div>
  );
}
