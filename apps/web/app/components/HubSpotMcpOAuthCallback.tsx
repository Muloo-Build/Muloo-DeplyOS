"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function HubSpotMcpOAuthCallback({
  code,
  state,
  error
}: {
  code?: string;
  state?: string;
  error?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("Connecting HubSpot MCP…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function complete() {
      if (error) {
        setFailed(true);
        setMessage(`HubSpot returned an error: ${error}`);
        return;
      }

      if (!code || !state) {
        setFailed(true);
        setMessage("The HubSpot MCP callback is missing code or state.");
        return;
      }

      try {
        const response = await fetch("/api/hubspot/mcp/oauth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, state })
        });
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(body?.error ?? "Failed to complete HubSpot MCP OAuth");
        }

        if (cancelled) {
          return;
        }

        router.replace(body.returnTo ?? "/settings/integrations/hubspot-mcp");
        router.refresh();
      } catch (callbackError) {
        if (cancelled) {
          return;
        }

        setFailed(true);
        setMessage(
          callbackError instanceof Error
            ? callbackError.message
            : "Failed"
        );
      }
    }

    void complete();

    return () => {
      cancelled = true;
    };
  }, [code, error, router, state]);

  return (
    <div className="min-h-screen bg-ink-0 px-6 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center py-10">
        <div className="w-full rounded-[32px] border border-ink-4 bg-ink-1 p-8">
          <img src="/muloo-logo.svg" alt="Muloo" className="h-10 w-auto" />
          <p className="mt-6 text-sm uppercase tracking-[0.3em] text-text-3">
            HubSpot MCP connect
          </p>
          <h1 className="mt-3 text-3xl font-bold font-heading text-white">
            {failed ? "Connection failed" : "Finishing connection"}
          </h1>
          <p className="mt-4 text-text-2">{message}</p>
          <div className="mt-8">
            <Link
              href="/settings/integrations/hubspot-mcp"
              className="text-white underline"
            >
              Back to HubSpot MCP settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
