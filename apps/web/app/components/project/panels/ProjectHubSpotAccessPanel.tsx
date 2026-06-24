"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import HubSpotMcpConnectCard from "../../HubSpotMcpConnectCard";

interface HubSpotAccessPanelProps {
  projectId: string;
  connectionReady: boolean;
  portalRecordId: string | null;
  hubDomain: string | null;
  hubTier: string | null;
}

export default function ProjectHubSpotAccessPanel(
  props: HubSpotAccessPanelProps
) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [marking, setMarking] = useState(false);
  const [markFeedback, setMarkFeedback] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/workspace/hubspot-settings", {
          credentials: "include"
        });
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled) {
          setInviteUrl(body?.settings?.partnerInviteUrl ?? null);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function copyInviteLink() {
    if (!inviteUrl || typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  async function markAsConnected() {
    if (!props.portalRecordId) return;
    const note = window.prompt(
      "Optional note (e.g. 'Client accepted partner invite 29 April')"
    );
    if (note === null) return;
    setMarking(true);
    setMarkFeedback(null);
    try {
      const response = await fetch(
        `/api/portals/${encodeURIComponent(props.portalRecordId)}/mark-connected`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: note || undefined })
        }
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to mark as connected");
      }
      setMarkFeedback("Marked as connected. Refresh to see updated state.");
    } catch (error) {
      setMarkFeedback(
        error instanceof Error ? error.message : "Failed to mark as connected"
      );
    } finally {
      setMarking(false);
    }
  }

  return (
    <>
    <div className="grid gap-4 md:grid-cols-2">
      {/* Client-facing action */}
      <div className="brand-surface-soft flex flex-col rounded-[14px] border p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300">
            Client action
          </span>
        </div>
        <h4 className="text-sm font-semibold text-white">
          Invite Muloo to HubSpot
        </h4>
        <p className="mt-1 flex-1 text-xs leading-relaxed text-text-2">
          The client uses this link to invite Muloo as a partner/admin in their
          HubSpot portal. This gives us the access needed to complete the
          approved setup work.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {!loaded ? (
            <p className="text-xs text-text-2">Loading…</p>
          ) : !inviteUrl ? (
            <Link
              href="/settings#hubspot"
              className="inline-flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-100 transition hover:bg-amber-500/20"
            >
              Configure partner invite link →
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={copyInviteLink}
                className="inline-flex items-center gap-2 rounded-lg border border-[#49cde1]/30 bg-[#49cde1]/10 px-3 py-2 text-xs font-medium text-[#9be4f0] transition hover:bg-[#49cde1]/20"
              >
                {copied ? "Copied ✓" : "Copy invite link to share"}
              </button>
              <a
                href={inviteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-ink-4 bg-ink-1 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/5"
              >
                Open in HubSpot ↗
              </a>
            </>
          )}
        </div>
        {props.portalRecordId ? (
          <div className="mt-3 border-t border-white/5 pt-3">
            <button
              type="button"
              onClick={() => void markAsConnected()}
              disabled={marking}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/5 px-3 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {marking ? "Marking…" : "Mark partner invite as accepted"}
            </button>
            <p className="mt-1 text-[11px] text-text-3">
              Use after the client has accepted your partner/admin invite.
            </p>
            {markFeedback ? (
              <p className="mt-1 text-[11px] text-emerald-200/80">
                {markFeedback}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Operator/internal action */}
      <div className="brand-surface-soft flex flex-col rounded-[14px] border p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full border border-ink-4 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-2">
            Internal Muloo action
          </span>
        </div>
        <h4 className="text-sm font-semibold text-white">
          Connect HubSpot portal to Deploy OS
        </h4>
        <p className="mt-1 flex-1 text-xs leading-relaxed text-text-2">
          Internal Muloo action. Connects this client portal to Deploy OS for
          audits, setup tracking, validation and future automation. The client
          does not see this option.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex h-2.5 w-2.5 rounded-full ${
              props.connectionReady ? "bg-brand-teal" : "bg-status-error"
            }`}
          />
          <span className="text-xs text-text-2">
            {props.connectionReady ? "Connected" : "Not connected"}
            {props.hubDomain ? ` · ${props.hubDomain}` : ""}
            {props.hubTier ? ` · ${props.hubTier}` : ""}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {props.portalRecordId ? (
            <Link
              href={`/portals/${encodeURIComponent(props.portalRecordId)}`}
              className="inline-flex items-center gap-2 rounded-lg border border-ink-4 bg-ink-1 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/5"
            >
              Open portal record →
            </Link>
          ) : null}
          <Link
            href="/settings#hubspot"
            className="inline-flex items-center gap-2 rounded-lg border border-ink-4 bg-ink-1 px-3 py-2 text-xs font-medium text-text-2 transition hover:text-white"
          >
            HubSpot integration settings →
          </Link>
        </div>
      </div>
    </div>
    {props.portalRecordId ? (
      <div className="mt-4">
        <HubSpotMcpConnectCard
          portalId={props.portalRecordId}
          projectId={props.projectId}
        />
      </div>
    ) : null}
    </>
  );
}
