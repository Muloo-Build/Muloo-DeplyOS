"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function HubSpotOAuthCallback({
  code,
  state,
  error
}: {
  code?: string;
  state?: string;
  error?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("Completing HubSpot portal connection...");
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
        setMessage("The HubSpot OAuth callback is missing code or state.");
        return;
      }

      try {
        const response = await fetch("/api/hubspot/oauth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, state })
        });
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(body?.error ?? "Failed to complete HubSpot OAuth");
        }

        if (cancelled) {
          return;
        }

        setMessage(
          `HubSpot portal ${body.portal?.displayName ?? body.portal?.portalId ?? "connected"} is ready. Redirecting back...`
        );
        window.setTimeout(() => {
          router.replace(body.returnTo ?? "/settings/providers");
          router.refresh();
        }, 1200);
      } catch (callbackError) {
        if (cancelled) {
          return;
        }

        setFailed(true);
        setMessage(
          callbackError instanceof Error
            ? callbackError.message
            : "Failed to complete HubSpot OAuth"
        );
      }
    }

    void complete();

    return () => {
      cancelled = true;
    };
  }, [code, error, router, state]);

  return (
    <div className="min-h-screen bg-background-primary px-6 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center py-10">
        <div className="w-full rounded-[32px] border border-[rgba(255,255,255,0.07)] bg-background-card p-8">
          <img src="/muloo-logo.svg" alt="Muloo" className="h-10 w-auto" />
          <p className="mt-6 text-sm uppercase tracking-[0.3em] text-text-muted">
            HubSpot portal connect
          </p>
          <h1 className="mt-3 text-3xl font-bold font-heading text-white">
            {failed ? "Connection failed" : "Finishing connection"}
          </h1>
          <p className="mt-4 text-text-secondary">{message}</p>
          <div className="mt-8">
            <Link href="/settings/providers" className="text-white underline">
              Back to Provider settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
