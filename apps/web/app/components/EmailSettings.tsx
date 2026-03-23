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

export default function EmailSettings() {
  const [settings, setSettings] = useState<EmailSettingsRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [passwordDraft, setPasswordDraft] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/email-settings");
        if (!response.ok) {
          throw new Error("Failed to load email settings");
        }
        const body = await response.json();
        setSettings(body.settings ?? null);
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
      setFeedback("Email settings saved.");
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

  if (loading) {
    return (
      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 text-text-secondary">
        Loading email settings...
      </div>
    );
  }

  if (!settings) {
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
          This works well with Google Workspace SMTP relay, Gmail SMTP, or any
          standard SMTP service. It keeps sending on your own domain instead of
          tying the app to one mail vendor.
        </p>

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
              placeholder="smtp.gmail.com or your relay host"
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
              placeholder="Usually your mailbox or relay user"
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
                  : "SMTP password or app password"
              }
              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
            />
            {settings.hasPassword ? (
              <p className="mt-2 text-xs text-text-muted">
                A password is already stored.
              </p>
            ) : null}
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
          Enable outbound email from the app
        </label>

        {error ? (
          <p className="mt-4 text-sm text-[#ff8f9c]">{error}</p>
        ) : feedback ? (
          <p className="mt-4 text-sm text-status-success">{feedback}</p>
        ) : (
          <p className="mt-4 text-sm text-text-secondary">
            Recommended starting point: Google Workspace SMTP relay or Gmail SMTP
            with an app password, using your normal domain mailbox.
          </p>
        )}

        <button
          type="button"
          onClick={() => void saveSettings()}
          disabled={saving}
          className="mt-5 rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save email settings"}
        </button>
      </section>
    </div>
  );
}
