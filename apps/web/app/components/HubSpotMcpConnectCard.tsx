"use client";

import { useCallback, useEffect, useState } from "react";

interface Status {
  portalId: string;
  connected: boolean;
  hubDomain?: string | null;
  connectedEmail?: string | null;
  lastError?: string | null;
}

export default function HubSpotMcpConnectCard({
  portalId,
  projectId,
}: {
  portalId: string;
  projectId?: string;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/hubspot/mcp/connection/${portalId}`);
    setStatus(await r.json().catch(() => null));
  }, [portalId]);

  useEffect(() => {
    void load();
  }, [load]);

  const connect = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/hubspot/mcp/oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portalId, projectId }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error ?? "Failed to start");
      window.location.href = body.authUrl;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to connect");
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    await fetch(`/api/hubspot/mcp/connection/${portalId}`, { method: "DELETE" });
    await load();
    setBusy(false);
  };

  return (
    <div className="rounded-[14px] border border-ink-4 bg-ink-1 p-4">
      <h3 className="text-sm font-semibold text-white">HubSpot Agentic (MCP)</h3>
      <p className="mt-1 text-xs text-text-2">
        Authorize Muloo agents to deliver work in this HubSpot portal.
      </p>
      {status?.connected ? (
        <div className="mt-3 text-xs text-[#7af0a8]">
          Connected{status.hubDomain ? ` — ${status.hubDomain}` : ""}
          <button
            onClick={() => void disconnect()}
            disabled={busy}
            className="ml-3 text-text-2 underline transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={() => void connect()}
          disabled={busy}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-ink-4 bg-ink-1 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Connecting…" : "Connect AI agent"}
        </button>
      )}
      {status?.lastError ? (
        <p className="mt-2 text-xs text-status-error">{status.lastError}</p>
      ) : null}
    </div>
  );
}
