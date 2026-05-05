"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface PrivateAppState {
  id: string;
  label: string;
  portalId: string | null;
  hubDomain: string | null;
  scopes: string[];
  isEnabled: boolean;
  hasToken: boolean;
  tokenMask: string | null;
  connectedEmail: string | null;
  connectedName: string | null;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastTestError: string | null;
  envFallbackAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_SCOPES = [
  "crm.objects.companies.read",
  "crm.objects.companies.write",
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.deals.read",
  "crm.objects.deals.write",
  "crm.schemas.companies.read",
  "crm.schemas.contacts.read",
  "crm.schemas.deals.read"
];

export default function HubSpotIntegrationSettings() {
  const [state, setState] = useState<PrivateAppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [tokenInput, setTokenInput] = useState("");
  const [portalIdInput, setPortalIdInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [scopesInput, setScopesInput] = useState(
    DEFAULT_SCOPES.join("\n")
  );
  const [isEnabled, setIsEnabled] = useState(true);

  async function loadState() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/hubspot/private-app");
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error ?? "Failed to load HubSpot integration");
      }
      const next: PrivateAppState = body.privateApp;
      setState(next);
      setLabelInput(next.label);
      setPortalIdInput(next.portalId ?? "");
      setIsEnabled(next.isEnabled);
      if (next.scopes.length > 0) {
        setScopesInput(next.scopes.join("\n"));
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Failed to load integration"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadState();
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const scopes = scopesInput
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);

      const payload: Record<string, unknown> = {
        label: labelInput,
        portalId: portalIdInput,
        scopes,
        isEnabled
      };
      if (tokenInput.trim()) {
        payload.token = tokenInput.trim();
      }

      const res = await fetch("/api/integrations/hubspot/private-app", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Failed to save");
      setState(body.privateApp);
      setTokenInput("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/hubspot/private-app/test", {
        method: "POST"
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Test failed");
      setState(body.privateApp);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect HubSpot private app? Token will be deleted.")) {
      return;
    }
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/hubspot/private-app", {
        method: "DELETE"
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Disconnect failed");
      setState(body.privateApp);
      setTokenInput("");
      setPortalIdInput("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Disconnect failed");
    } finally {
      setDisconnecting(false);
    }
  }

  const statusBadge = useMemo(() => {
    if (!state) return null;
    if (state.lastTestStatus === "ok") {
      return (
        <span className="rounded-full bg-[rgba(73,255,143,0.12)] px-3 py-1 text-xs font-medium text-[#7af0a8]">
          Connected
        </span>
      );
    }
    if (state.lastTestStatus === "error") {
      return (
        <span className="rounded-full bg-[rgba(224,80,96,0.18)] px-3 py-1 text-xs font-medium text-[#ff9aa6]">
          Last test failed
        </span>
      );
    }
    if (state.hasToken || state.envFallbackAvailable) {
      return (
        <span className="rounded-full bg-[rgba(255,200,80,0.14)] px-3 py-1 text-xs font-medium text-[#ffd28a]">
          Untested
        </span>
      );
    }
    return (
      <span className="rounded-full bg-[rgba(255,255,255,0.06)] px-3 py-1 text-xs font-medium text-text-muted">
        Not connected
      </span>
    );
  }, [state]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 text-text-secondary">
        Loading HubSpot integration...
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

      <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
              Internal portal
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Muloo HubSpot — Private App
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              Use this to connect to your own HubSpot portal. The token is
              AES-256-GCM encrypted at rest and only ever decrypted in memory
              for HubSpot API calls.
            </p>
          </div>
          {statusBadge}
        </div>

        {state?.envFallbackAvailable && !state.hasToken ? (
          <div className="mt-4 rounded-xl border border-[rgba(255,200,80,0.3)] bg-[rgba(48,38,12,0.5)] px-4 py-3 text-sm text-[#ffd28a]">
            Environment variable HUBSPOT_ACCESS_TOKEN is detected. Saving a
            token here will take precedence — clear the env var once you have
            confirmed the UI-stored token works.
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-white">
              Connection label
            </span>
            <input
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="Muloo HubSpot"
              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-white">Hub ID</span>
            <input
              value={portalIdInput}
              onChange={(e) => setPortalIdInput(e.target.value)}
              placeholder="e.g. 12345678"
              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
            />
            <p className="mt-2 text-xs text-text-muted">
              Find under your HubSpot account name. Auto-fills after a
              successful test.
            </p>
          </label>

          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-white">
              Private app access token
            </span>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder={
                state?.hasToken
                  ? `Stored: ${state.tokenMask ?? "••••"} — paste again only to replace`
                  : "Paste pat-na1-…"
              }
              autoComplete="off"
              className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
            />
            <p className="mt-2 text-xs text-text-muted">
              Generate in HubSpot → Settings → Integrations → Private apps.
              Required scopes are listed below.
            </p>
          </label>

          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-white">
              Scopes (one per line — informational, must match the token)
            </span>
            <textarea
              value={scopesInput}
              onChange={(e) => setScopesInput(e.target.value)}
              className="mt-3 min-h-[140px] w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 font-mono text-xs text-white outline-none"
            />
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-white md:col-span-2">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
            />
            Enabled
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save settings"}
          </button>
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={testing || !(state?.hasToken || state?.envFallbackAvailable)}
            className="rounded-xl border border-[rgba(255,255,255,0.18)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testing ? "Testing..." : "Test connection"}
          </button>
          {state?.hasToken ? (
            <button
              type="button"
              onClick={() => void handleDisconnect()}
              disabled={disconnecting}
              className="rounded-xl border border-[rgba(224,80,96,0.45)] px-4 py-3 text-sm font-medium text-[#ff9aa6] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {disconnecting ? "Disconnecting..." : "Disconnect"}
            </button>
          ) : null}
        </div>

        {state?.lastTestedAt ? (
          <div className="mt-5 grid gap-2 text-xs text-text-muted md:grid-cols-3">
            <div>
              <span className="block uppercase tracking-[0.18em]">
                Last tested
              </span>
              <span className="text-white">
                {new Date(state.lastTestedAt).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="block uppercase tracking-[0.18em]">Status</span>
              <span className="text-white">
                {state.lastTestStatus ?? "unknown"}
              </span>
            </div>
            <div>
              <span className="block uppercase tracking-[0.18em]">Hub</span>
              <span className="text-white">
                {state.hubDomain ?? state.portalId ?? "—"}
              </span>
            </div>
            {state.lastTestError ? (
              <div className="md:col-span-3 rounded-xl border border-[rgba(224,80,96,0.35)] bg-[rgba(58,21,32,0.5)] px-3 py-2 text-[#ffb1bb]">
                {state.lastTestError}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
              Selective import
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Browse + cherry-pick HubSpot companies
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              Search your portal, preview related contacts and deals, and
              import only the companies you want as Clients in DeployOS.
            </p>
          </div>
          <Link
            href="/settings/integrations/hubspot/import"
            className={`rounded-xl px-4 py-3 text-sm font-medium ${
              state?.hasToken || state?.envFallbackAvailable
                ? "bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] text-white"
                : "pointer-events-none border border-[rgba(255,255,255,0.18)] text-text-muted"
            }`}
          >
            Open import →
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
        <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
          Client portals (Public OAuth)
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          Connect your clients&apos; HubSpot portals
        </h2>
        <p className="mt-2 text-sm text-text-secondary">
          Used when delivering work inside a client portal. Each client
          installs your public HubSpot app from their own account; tokens are
          stored per portal in HubSpotPortal.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/settings/providers"
            className="rounded-xl border border-[rgba(255,255,255,0.18)] px-4 py-3 text-sm font-medium text-white"
          >
            Public app credentials →
          </Link>
        </div>
      </section>
    </div>
  );
}
