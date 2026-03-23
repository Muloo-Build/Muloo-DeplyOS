"use client";

import { useEffect, useState } from "react";

interface EmailSettingsRecord {
  id: string;
  providerLabel: string;
  host: string | null;
  port: number | null;
  secure: boolean;
  username: string | null;
  hasPassword: boolean;
  fromName: string | null;
  fromEmail: string | null;
  replyToEmail: string | null;
  enabled: boolean;
}

interface GoogleEmailOAuthConnectionRecord {
  id: string;
  providerKey: string;
  label: string;
  clientId: string | null;
  hasClientSecret: boolean;
  redirectUri: string | null;
  scopes: string[];
  connectedEmail: string | null;
  connectedName: string | null;
  tokenExpiresAt: string | null;
  isConnected: boolean;
  enabled: boolean;
}

export default function EmailSettings() {
  const [settings, setSettings] = useState<EmailSettingsRecord | null>(null);
  const [googleConnection, setGoogleConnection] =
    useState<GoogleEmailOAuthConnectionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingGoogle, setSavingGoogle] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [googleClientSecretDraft, setGoogleClientSecretDraft] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [emailResponse, googleResponse] = await Promise.all([
          fetch("/api/email-settings"),
          fetch("/api/email-oauth/google")
        ]);

        if (!emailResponse.ok || !googleResponse.ok) {
          throw new Error("Failed to load email settings");
        }

        const emailBody = await emailResponse.json();
        const googleBody = await googleResponse.json();
        setSettings(emailBody.settings ?? null);
        setGoogleConnection(googleBody.connection ?? null);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load email settings"
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  function updateField(
    field: keyof EmailSettingsRecord,
    value: string | boolean | number | null
  ) {
    setSettings((current) =>
      current ? { ...current, [field]: value } : current
    );
  }

  function updateGoogleField(
    field: keyof GoogleEmailOAuthConnectionRecord,
    value: string | boolean | string[] | null
  ) {
    setGoogleConnection((current) =>
      current ? { ...current, [field]: value } : current
    );
  }

  function applyGoogleRelayPreset() {
    setSettings((current) =>
      current
        ? {
            ...current,
            providerLabel: "Google Workspace SMTP Relay",
            host: "smtp-relay.gmail.com",
            port: 587,
            secure: false
          }
        : current
    );
    setFeedback("Google Workspace relay preset applied.");
    setError(null);
  }

  async function saveSettings() {
    if (!settings) {
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch("/api/email-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerLabel: settings.providerLabel,
          host: settings.host ?? "",
          port: settings.port ?? "",
          secure: settings.secure,
          username: settings.username ?? "",
          password: passwordDraft,
          fromName: settings.fromName ?? "",
          fromEmail: settings.fromEmail ?? "",
          replyToEmail: settings.replyToEmail ?? "",
          enabled: settings.enabled
        })
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save email settings");
      }

      setSettings(body.settings);
      setPasswordDraft("");
      setFeedback("SMTP email settings saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save email settings"
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveGoogleSettings() {
    if (!googleConnection) {
      return;
    }

    setSavingGoogle(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch("/api/email-oauth/google", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: googleConnection.clientId ?? "",
          clientSecret: googleClientSecretDraft,
          redirectUri: googleConnection.redirectUri ?? "",
          scopes: googleConnection.scopes,
          enabled: googleConnection.enabled
        })
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save Google OAuth settings");
      }

      setGoogleConnection(body.connection ?? null);
      setGoogleClientSecretDraft("");
      setFeedback("Google mailbox settings saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save Google OAuth settings"
      );
    } finally {
      setSavingGoogle(false);
    }
  }

  async function startGoogleConnect() {
    setConnectingGoogle(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch("/api/email-oauth/google/start", {
        method: "POST"
      });
      const body = await response.json().catch(() => null);

      if (!response.ok || !body?.authUrl) {
        throw new Error(body?.error ?? "Failed to start Google OAuth");
      }

      window.location.href = body.authUrl;
    } catch (connectError) {
      setError(
        connectError instanceof Error
          ? connectError.message
          : "Failed to start Google OAuth"
      );
      setConnectingGoogle(false);
    }
  }

  async function disconnectGoogleMailbox() {
    setDisconnectingGoogle(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch("/api/email-oauth/google", {
        method: "DELETE"
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to disconnect Google mailbox");
      }

      setGoogleConnection(body.connection ?? null);
      setFeedback("Google mailbox disconnected.");
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Failed to disconnect Google mailbox"
      );
    } finally {
      setDisconnectingGoogle(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 text-text-secondary">
        Loading email settings...
      </div>
    );
  }

  if (!settings || !googleConnection) {
    return (
      <div className="rounded-2xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] p-6 text-white">
        Email settings could not be loaded.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
        <h2 className="text-xl font-semibold text-white">SMTP connection</h2>
        <p className="mt-2 text-sm text-text-secondary">
          This stays the clean path for system notifications and workflow mail
          from your domain through Google Workspace relay.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={applyGoogleRelayPreset}
            className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm font-medium text-white"
          >
            Use Google Workspace relay preset
          </button>
          <div className="rounded-xl border border-[rgba(255,255,255,0.07)] px-4 py-3 text-xs leading-5 text-text-secondary">
            Recommended values: `smtp-relay.gmail.com`, port `587`, secure off.
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-white">Provider label</span>
            <input
              value={settings.providerLabel ?? ""}
              onChange={(event) =>
                updateField("providerLabel", event.target.value)
              }
              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-white">SMTP host</span>
            <input
              value={settings.host ?? ""}
              onChange={(event) => updateField("host", event.target.value)}
              placeholder="smtp-relay.gmail.com"
              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-white">Port</span>
            <input
              value={settings.port ?? ""}
              onChange={(event) =>
                updateField(
                  "port",
                  event.target.value ? Number(event.target.value) : null
                )
              }
              placeholder="587"
              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
            />
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] px-4 py-4 text-sm text-white">
            <input
              type="checkbox"
              checked={settings.secure}
              onChange={(event) => updateField("secure", event.target.checked)}
            />
            Use secure SMTP
          </label>
          <label className="block">
            <span className="text-sm font-medium text-white">Username</span>
            <input
              value={settings.username ?? ""}
              onChange={(event) => updateField("username", event.target.value)}
              placeholder="Optional if relay auth is required"
              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-white">Password</span>
            <input
              type="password"
              value={passwordDraft}
              onChange={(event) => setPasswordDraft(event.target.value)}
              placeholder={
                settings.hasPassword
                  ? "Leave blank to keep stored password"
                  : "Optional if your relay requires SMTP auth"
              }
              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
        <h2 className="text-xl font-semibold text-white">Sender identity</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-white">From name</span>
            <input
              value={settings.fromName ?? ""}
              onChange={(event) => updateField("fromName", event.target.value)}
              placeholder="Muloo"
              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-white">From email</span>
            <input
              value={settings.fromEmail ?? ""}
              onChange={(event) => updateField("fromEmail", event.target.value)}
              placeholder="hello@yourdomain.com"
              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-white">Reply-to email</span>
            <input
              value={settings.replyToEmail ?? ""}
              onChange={(event) =>
                updateField("replyToEmail", event.target.value)
              }
              placeholder="Optional reply-to mailbox"
              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
            />
          </label>
        </div>

        <label className="mt-5 flex items-center gap-3 text-sm text-white">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) => updateField("enabled", event.target.checked)}
          />
          Enable outbound SMTP email from the app
        </label>

        <button
          type="button"
          onClick={() => void saveSettings()}
          disabled={saving}
          className="mt-5 rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save SMTP settings"}
        </button>
      </section>

      <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
        <h2 className="text-xl font-semibold text-white">Google mailbox connect</h2>
        <p className="mt-2 text-sm text-text-secondary">
          This is the OAuth setup for connecting a real Google Workspace mailbox.
          It is separate from SMTP relay, so we can support mailbox-level sending
          and future inbox history without disturbing the system mail path.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-white">Google OAuth client ID</span>
            <input
              value={googleConnection.clientId ?? ""}
              onChange={(event) =>
                updateGoogleField("clientId", event.target.value)
              }
              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-white">Google OAuth client secret</span>
            <input
              type="password"
              value={googleClientSecretDraft}
              onChange={(event) => setGoogleClientSecretDraft(event.target.value)}
              placeholder={
                googleConnection.hasClientSecret
                  ? "Leave blank to keep stored secret"
                  : "Paste the client secret"
              }
              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-white">Redirect URI</span>
            <input
              value={googleConnection.redirectUri ?? ""}
              onChange={(event) =>
                updateGoogleField("redirectUri", event.target.value)
              }
              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-white">Scopes</span>
            <textarea
              value={googleConnection.scopes.join("\n")}
              onChange={(event) =>
                updateGoogleField(
                  "scopes",
                  event.target.value
                    .split(/\n+/)
                    .map((scope) => scope.trim())
                    .filter(Boolean)
                )
              }
              className="mt-3 min-h-[120px] w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
            />
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] px-4 py-4 text-sm text-white md:col-span-2">
            <input
              type="checkbox"
              checked={googleConnection.enabled}
              onChange={(event) =>
                updateGoogleField("enabled", event.target.checked)
              }
            />
            Enable Google mailbox connection for this workspace
          </label>
        </div>

        <div className="mt-5 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] px-4 py-4">
          <p className="text-sm font-medium text-white">Connection status</p>
          <p className="mt-2 text-sm text-text-secondary">
            {googleConnection.isConnected
              ? `Connected as ${googleConnection.connectedName || googleConnection.connectedEmail || "your Google account"}.`
              : "No Google mailbox connected yet."}
          </p>
          <p className="mt-2 text-xs text-text-muted">
            Add this redirect URI in Google Cloud: {googleConnection.redirectUri}
          </p>
          {googleConnection.tokenExpiresAt ? (
            <p className="mt-2 text-xs text-text-muted">
              Current token expiry:{" "}
              {new Date(googleConnection.tokenExpiresAt).toLocaleString("en-ZA", {
                dateStyle: "medium",
                timeStyle: "short"
              })}
            </p>
          ) : null}
        </div>

        {error ? (
          <p className="mt-4 text-sm text-[#ff8f9c]">{error}</p>
        ) : feedback ? (
          <p className="mt-4 text-sm text-status-success">{feedback}</p>
        ) : (
          <p className="mt-4 text-sm text-text-secondary">
            Save the Google client values first, then connect the mailbox when the
            Google Cloud OAuth app is ready.
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void saveGoogleSettings()}
            disabled={savingGoogle}
            className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
          >
            {savingGoogle ? "Saving..." : "Save Google settings"}
          </button>
          <button
            type="button"
            onClick={() => void startGoogleConnect()}
            disabled={
              connectingGoogle ||
              !googleConnection.clientId?.trim() ||
              !(googleClientSecretDraft.trim() || googleConnection.hasClientSecret)
            }
            className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {connectingGoogle
              ? "Redirecting..."
              : googleConnection.isConnected
                ? "Reconnect Google mailbox"
                : "Connect Google mailbox"}
          </button>
          <button
            type="button"
            onClick={() => void disconnectGoogleMailbox()}
            disabled={disconnectingGoogle || !googleConnection.isConnected}
            className="rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
          >
            {disconnectingGoogle ? "Disconnecting..." : "Disconnect"}
          </button>
        </div>
      </section>
    </div>
  );
}
