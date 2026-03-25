"use client";

import { useEffect, useState } from "react";

interface GmailConnectionState {
  connected: boolean;
  connectedEmail?: string | null;
  gmailFilterLabel?: string | null;
}

interface CalendarStatusState {
  configured: boolean;
  connected: boolean;
  connectedEmail?: string | null;
}

interface XeroStatusState {
  configured: boolean;
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

interface GmailConnectionResponse {
  connection?: {
    isConnected?: boolean;
    connectedEmail?: string | null;
    gmailFilterLabel?: string | null;
  } | null;
}

interface ProvidersResponse {
  providers?: ProviderConnection[];
}

interface SaveGmailFilterResponse {
  success: boolean;
  gmailFilterLabel: string | null;
}

function InlineWarning({ message }: { message: string }) {
  return (
    <div className="mt-3 rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
      {message}
    </div>
  );
}

async function fetchJson<T>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fallbackMessage: string
) {
  try {
    const response = await fetch(input, init);
    const body = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;

    if (!response.ok) {
      throw new Error(
        typeof body?.message === "string"
          ? body.message
          : typeof body?.error === "string"
            ? body.error
            : fallbackMessage
      );
    }

    return body as T;
  } catch (error) {
    throw error instanceof Error ? error : new Error(fallbackMessage);
  }
}

export default function WorkspaceSettings() {
  const [gmail, setGmail] = useState<GmailConnectionState | null>(null);
  const [gmailFilterLabel, setGmailFilterLabel] = useState("");
  const [savedGmailFilterLabel, setSavedGmailFilterLabel] = useState("");
  const [calendarStatus, setCalendarStatus] =
    useState<CalendarStatusState | null>(null);
  const [xeroStatus, setXeroStatus] = useState<XeroStatusState | null>(null);
  const [providers, setProviders] = useState<ProviderConnection[]>([]);
  const [route, setRoute] = useState<WorkspaceRoute>({
    providerKey: "",
    model: ""
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [savingRoute, setSavingRoute] = useState(false);
  const [saveRouteSuccess, setSaveRouteSuccess] = useState(false);
  const [saveRouteError, setSaveRouteError] = useState(false);
  const [savingGmailFilter, setSavingGmailFilter] = useState(false);
  const [gmailFilterError, setGmailFilterError] = useState<string | null>(null);
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [disconnectingGmail, setDisconnectingGmail] = useState(false);
  const [gmailConnectError, setGmailConnectError] = useState(false);
  const [connectingXero, setConnectingXero] = useState(false);
  const [connectingCalendar, setConnectingCalendar] = useState(false);
  const [disconnectingCalendar, setDisconnectingCalendar] = useState(false);
  const [disconnectingXero, setDisconnectingXero] = useState(false);
  const [xeroConnectError, setXeroConnectError] = useState(false);
  const [calendarConnectError, setCalendarConnectError] = useState(false);

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);

    try {
      const [
        gmailBody,
        nextCalendarStatus,
        nextXeroStatus,
        routeBody,
        providersBody
      ] = await Promise.all([
        fetchJson<GmailConnectionResponse>(
          "/api/email-oauth/google",
          undefined,
          "Failed to load Gmail settings"
        ),
        fetchJson<CalendarStatusState>(
          "/api/workspace/calendar/status",
          undefined,
          "Failed to load Google Calendar status"
        ),
        fetchJson<XeroStatusState>(
          "/api/workspace/xero/status",
          undefined,
          "Failed to load Xero status"
        ),
        fetchJson<WorkspaceRoute>(
          "/api/workspace/ai-routing/daily_summary",
          undefined,
          "Failed to load daily summary routing"
        ),
        fetchJson<ProvidersResponse>(
          "/api/provider-connections",
          undefined,
          "Failed to load AI providers"
        )
      ]);

      const nextGmailFilterLabel =
        gmailBody.connection?.gmailFilterLabel?.trim() ?? "";

      setGmail({
        connected: gmailBody.connection?.isConnected === true,
        connectedEmail: gmailBody.connection?.connectedEmail ?? null,
        gmailFilterLabel: gmailBody.connection?.gmailFilterLabel ?? null
      });
      setGmailFilterLabel(nextGmailFilterLabel);
      setSavedGmailFilterLabel(nextGmailFilterLabel);
      setCalendarStatus(nextCalendarStatus);
      setXeroStatus(nextXeroStatus);
      setProviders(
        Array.isArray(providersBody.providers) ? providersBody.providers : []
      );
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

  async function saveGmailFilter() {
    const normalizedLabel = gmailFilterLabel.trim();

    if (normalizedLabel === savedGmailFilterLabel) {
      return;
    }

    setSavingGmailFilter(true);
    setGmailFilterError(null);
    setError(null);
    setFeedback(null);

    try {
      const body = await fetchJson<SaveGmailFilterResponse>(
        "/api/workspace/email-filter",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gmailFilterLabel: normalizedLabel })
        },
        "Failed to save Gmail filter"
      );
      const nextLabel = body.gmailFilterLabel?.trim() ?? "";
      setGmailFilterLabel(nextLabel);
      setSavedGmailFilterLabel(nextLabel);
      setGmail((current) =>
        current
          ? {
              ...current,
              gmailFilterLabel: body.gmailFilterLabel
            }
          : current
      );
      setFeedback("Gmail filter saved.");
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Failed to save Gmail filter";
      setGmailFilterError(message);
      setError(message);
    } finally {
      setSavingGmailFilter(false);
    }
  }

  async function connectGmail() {
    setConnectingGmail(true);
    setGmailConnectError(false);
    setError(null);
    setFeedback(null);

    try {
      const body = await fetchJson<{ authUrl?: string }>(
        "/api/email-oauth/google/start",
        {
          method: "POST"
        },
        "Failed to start Gmail connection"
      );

      if (!body.authUrl) {
        throw new Error("Failed to start Gmail connection");
      }

      window.location.assign(body.authUrl);
    } catch {
      setGmailConnectError(true);
    } finally {
      setConnectingGmail(false);
    }
  }

  async function disconnectGmail() {
    setDisconnectingGmail(true);
    setError(null);
    setFeedback(null);
    setGmailConnectError(false);

    try {
      await fetchJson(
        "/api/email-oauth/google",
        {
          method: "DELETE"
        },
        "Failed to disconnect Gmail"
      );
      setFeedback("Gmail disconnected.");
      await loadAll();
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Failed to disconnect Gmail"
      );
    } finally {
      setDisconnectingGmail(false);
    }
  }

  async function connectCalendar() {
    setConnectingCalendar(true);
    setCalendarConnectError(false);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch("/api/workspace/calendar/auth", {
        redirect: "manual"
      });

      if (
        response.type === "opaqueredirect" ||
        (response.status >= 300 && response.status < 400)
      ) {
        window.location.assign("/api/workspace/calendar/auth");
        return;
      }

      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok || body?.error === "not_configured") {
        setCalendarConnectError(true);
        return;
      }

      window.location.assign("/api/workspace/calendar/auth");
    } catch {
      setCalendarConnectError(true);
    } finally {
      setConnectingCalendar(false);
    }
  }

  async function disconnectCalendar() {
    setDisconnectingCalendar(true);
    setError(null);
    setFeedback(null);
    setCalendarConnectError(false);

    try {
      await fetchJson(
        "/api/workspace/calendar/connection",
        {
          method: "DELETE"
        },
        "Failed to disconnect Google Calendar"
      );
      setFeedback("Google Calendar disconnected.");
      await loadAll();
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Failed to disconnect Google Calendar"
      );
    } finally {
      setDisconnectingCalendar(false);
    }
  }

  async function connectXero() {
    setConnectingXero(true);
    setXeroConnectError(false);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch("/api/workspace/xero/auth", {
        redirect: "manual"
      });

      if (
        response.type === "opaqueredirect" ||
        (response.status >= 300 && response.status < 400)
      ) {
        window.location.assign("/api/workspace/xero/auth");
        return;
      }

      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok || body?.error === "not_configured") {
        setXeroConnectError(true);
        return;
      }

      window.location.assign("/api/workspace/xero/auth");
    } catch {
      setXeroConnectError(true);
    } finally {
      setConnectingXero(false);
    }
  }

  async function disconnectXero() {
    setDisconnectingXero(true);
    setError(null);
    setFeedback(null);
    setXeroConnectError(false);

    try {
      await fetchJson(
        "/api/workspace/xero/connection",
        {
          method: "DELETE"
        },
        "Failed to disconnect Xero"
      );
      setFeedback("Xero disconnected.");
      await loadAll();
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Failed to disconnect Xero"
      );
    } finally {
      setDisconnectingXero(false);
    }
  }

  async function saveDailySummaryRoute() {
    if (!route.providerKey || !route.model) {
      setSaveRouteError(true);
      setError("Choose a provider and model for the daily summary.");
      return;
    }

    setSavingRoute(true);
    setSaveRouteSuccess(false);
    setSaveRouteError(false);
    setError(null);
    setFeedback(null);

    try {
      const body = await fetchJson<WorkspaceRoute>(
        "/api/workspace/ai-routing/daily_summary",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(route)
        },
        "Failed to save daily summary routing"
      );
      setRoute({
        providerKey: body.providerKey ?? route.providerKey,
        model: body.model ?? route.model
      });
      setSaveRouteSuccess(true);
      window.setTimeout(() => {
        setSaveRouteSuccess(false);
      }, 3000);
    } catch {
      setSaveRouteError(true);
    } finally {
      setSavingRoute(false);
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
            <h2 className="text-xl font-semibold text-white">Gmail</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Connect the mailbox used for action-required email triage.
            </p>
          </div>
          {gmail?.connected ? (
            <span className="rounded-full bg-[rgba(45,212,160,0.18)] px-3 py-1 text-xs font-medium text-[#54e1b1]">
              Connected
            </span>
          ) : null}
        </div>

        <p className="mt-5 text-sm text-text-secondary">
          {gmail?.connected
            ? `Connected as ${gmail.connectedEmail ?? "your Google account"}.`
            : "No Gmail connection configured yet."}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          {gmail?.connected ? (
            <button
              type="button"
              onClick={() => void disconnectGmail()}
              disabled={disconnectingGmail}
              className="rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
            >
              {disconnectingGmail ? "Disconnecting..." : "Disconnect"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void connectGmail()}
              disabled={connectingGmail}
              className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {connectingGmail ? "Redirecting..." : "Connect Gmail"}
            </button>
          )}
        </div>

        {gmailConnectError ? (
          <InlineWarning message="We could not start the Gmail connection flow. Check the mailbox OAuth settings and try again." />
        ) : null}

        <div className="mt-5">
          <label className="text-sm font-medium text-white">
            Filter by Gmail label (optional)
          </label>
          <input
            type="text"
            value={gmailFilterLabel}
            onChange={(event) => setGmailFilterLabel(event.target.value)}
            onBlur={() => void saveGmailFilter()}
            placeholder="e.g. action-required"
            className="mt-3 block w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
          />
          <p className="mt-2 text-xs text-text-secondary">
            Create a label in Gmail, drag emails there, and we&apos;ll only show
            those. Leave blank to show unread Primary emails from the last 14
            days.
          </p>
          {savingGmailFilter ? (
            <p className="mt-2 text-xs text-text-secondary">Saving filter...</p>
          ) : null}
          {gmailFilterError ? (
            <p className="mt-2 text-xs text-[#ff9aa7]">{gmailFilterError}</p>
          ) : null}
        </div>
      </section>

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
          {calendarStatus?.connected ? (
            <span className="rounded-full bg-[rgba(45,212,160,0.18)] px-3 py-1 text-xs font-medium text-[#54e1b1]">
              Connected
            </span>
          ) : null}
        </div>

        <p className="mt-5 text-sm text-text-secondary">
          {calendarStatus?.connected
            ? `Connected as ${calendarStatus.connectedEmail ?? "your Google account"}.`
            : "No Google Calendar connection configured yet."}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          {!calendarStatus?.configured ? (
            <span className="text-sm text-text-secondary">Not set up</span>
          ) : calendarStatus.connected ? (
            <button
              type="button"
              onClick={() => void disconnectCalendar()}
              disabled={disconnectingCalendar}
              className="rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
            >
              {disconnectingCalendar ? "Disconnecting..." : "Disconnect"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void connectCalendar()}
              disabled={connectingCalendar}
              className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {connectingCalendar
                ? "Redirecting..."
                : "Connect Google Calendar"}
            </button>
          )}
        </div>

        {calendarConnectError ? (
          <InlineWarning message="Connection not configured. Ask your admin to add the required credentials to the deployment environment." />
        ) : null}
      </section>

      <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Xero</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Manage the tenant used for invoice visibility in the Command
              Centre.
            </p>
          </div>
          {xeroStatus?.connected ? (
            <span className="rounded-full bg-[rgba(45,212,160,0.18)] px-3 py-1 text-xs font-medium text-[#54e1b1]">
              Connected
            </span>
          ) : null}
        </div>

        <p className="mt-5 text-sm text-text-secondary">
          {xeroStatus?.connected
            ? `Connected to ${xeroStatus.tenantName ?? "your Xero tenant"}.`
            : "No Xero connection configured yet."}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          {!xeroStatus?.configured ? (
            <span className="text-sm text-text-secondary">Not set up</span>
          ) : xeroStatus.connected ? (
            <button
              type="button"
              onClick={() => void disconnectXero()}
              disabled={disconnectingXero}
              className="rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
            >
              {disconnectingXero ? "Disconnecting..." : "Disconnect"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void connectXero()}
              disabled={connectingXero}
              className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {connectingXero ? "Redirecting..." : "Connect Xero"}
            </button>
          )}
        </div>

        {xeroConnectError ? (
          <InlineWarning message="Connection not configured. Ask your admin to add the required credentials to the deployment environment." />
        ) : null}
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

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void saveDailySummaryRoute()}
            disabled={savingRoute}
            className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingRoute ? "Saving..." : "Save"}
          </button>
          {saveRouteSuccess ? (
            <span className="text-sm text-[#54e1b1]">Saved</span>
          ) : null}
          {saveRouteError ? (
            <span className="text-sm text-[#ff9aa7]">Save failed</span>
          ) : null}
        </div>
      </section>
    </div>
  );
}
