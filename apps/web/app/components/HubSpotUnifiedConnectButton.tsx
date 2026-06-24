"use client";

import { useState } from "react";

export default function HubSpotUnifiedConnectButton({
  projectId,
  clientId,
  label = "Connect HubSpot",
}: {
  projectId: string;
  clientId?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    setBusy(true);
    try {
      try {
        window.sessionStorage.setItem(
          "hubspot-chain-mcp",
          JSON.stringify({ projectId }),
        );
      } catch {
        // sessionStorage unavailable — REST still connects; MCP can be added from its card
      }
      const r = await fetch("/api/hubspot/oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          clientId,
          installProfile: "core_crm",
          returnTo: `/projects/${projectId}`,
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error ?? "Failed to start HubSpot connect");
      window.location.href = body.authUrl;
    } catch (e) {
      try {
        window.sessionStorage.removeItem("hubspot-chain-mcp");
      } catch {
        // ignore
      }
      alert(e instanceof Error ? e.message : "Failed to connect HubSpot");
      setBusy(false);
    }
  };

  return (
    <button
      onClick={() => void connect()}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg border border-ink-4 bg-ink-1 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? "Connecting…" : label}
    </button>
  );
}
