"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

function SidebarSection(props: { label: string; children: ReactNode }) {
  return (
    <section>
      <p className="mb-1 text-xs uppercase tracking-wider text-text-3">
        {props.label}
      </p>
      <div className="text-sm text-text-2">{props.children}</div>
    </section>
  );
}

function PartnerInviteAction({
  connected,
  portalRecordId
}: {
  connected: boolean;
  portalRecordId: string | null;
}) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [marking, setMarking] = useState(false);
  const [markFeedback, setMarkFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (connected) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/workspace/hubspot-settings", {
          credentials: "include"
        });
        if (!response.ok) return;
        const body = await response.json();
        if (!cancelled) {
          setInviteUrl(body?.settings?.partnerInviteUrl ?? null);
        }
      } catch {
        // Silent — graceful degrade.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected]);

  async function markAsConnected() {
    if (!portalRecordId) return;
    const note = window.prompt(
      "Optional note (e.g. 'Magnisol accepted partner invite 29 April')"
    );
    if (note === null) return;
    setMarking(true);
    setMarkFeedback(null);
    try {
      const response = await fetch(
        `/api/portals/${encodeURIComponent(portalRecordId)}/mark-connected`,
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

  if (connected) return null;
  if (!loaded) return null;

  return (
    <div className="mt-3 space-y-2">
      {!inviteUrl ? (
        <Link
          href="/settings#hubspot"
          className="inline-flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-100 transition hover:bg-amber-500/20"
        >
          Configure partner invite link →
        </Link>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (typeof window === "undefined") return;
              navigator.clipboard.writeText(inviteUrl).then(
                () => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2500);
                },
                () => {
                  setCopied(false);
                }
              );
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-[#49cde1]/30 bg-[#49cde1]/10 px-3 py-2 text-xs font-medium text-[#9be4f0] transition hover:bg-[#49cde1]/20"
          >
            {copied ? "Copied ✓" : "Copy partner invite link"}
          </button>
          <a
            href={inviteUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-ink-4 bg-ink-1 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/5"
          >
            Open in HubSpot →
          </a>
        </div>
      )}

      {portalRecordId ? (
        <div>
          <button
            type="button"
            onClick={() => void markAsConnected()}
            disabled={marking}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/5 px-3 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {marking ? "Marking..." : "Mark as connected"}
          </button>
          <p className="mt-1 text-[11px] text-text-3">
            Use after the client accepts your partner invite.
          </p>
          {markFeedback ? (
            <p className="mt-1 text-[11px] text-emerald-200/80">
              {markFeedback}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function ProjectContextSidebar(props: {
  clientName: string;
  clientContactEmail?: string | null;
  portalUrl?: string | null;
  hubTier?: string | null;
  connectionReady: boolean;
  portalRecordId?: string | null;
  contactsCount?: number | null;
  companiesCount?: number | null;
  dealsCount?: number | null;
  ticketsCount?: number | null;
  contactPropertyCount?: number | null;
  companyPropertyCount?: number | null;
  dealPropertyCount?: number | null;
  ticketPropertyCount?: number | null;
  customObjectsCount?: number | null;
  ownerName: string;
  ownerEmail: string;
  hubsInScope: string[];
  platformName?: string | null;
  platformDescription?: string | null;
  quickWins: {
    total: number;
    open: number;
    resolved: number;
  };
  onRefreshSnapshot: () => void;
  refreshingSnapshot?: boolean;
}) {
  return (
    <aside className="brand-surface sticky top-0 max-h-screen space-y-4 overflow-y-auto rounded-[14px] border p-4">
      <SidebarSection label="CLIENT">
        <p className="font-medium text-white">{props.clientName}</p>
        <p className="mt-1 text-text-2">
          {props.clientContactEmail ?? "No contact email linked"}
        </p>
      </SidebarSection>

      <SidebarSection label="PORTAL">
        <p className="font-medium text-white">
          {props.portalUrl ? (
            <a href={props.portalUrl} target="_blank" rel="noreferrer" className="hover:text-white">
              {props.portalUrl}
            </a>
          ) : (
            "No portal linked"
          )}
        </p>
        <p className="mt-1 flex items-center gap-2 text-text-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              props.connectionReady ? "bg-brand-teal" : "bg-status-error"
            }`}
          />
          {props.connectionReady ? "Connected" : "Disconnected"}
          {props.hubTier ? ` · ${props.hubTier}` : ""}
        </p>
        <PartnerInviteAction
          connected={props.connectionReady}
          portalRecordId={props.portalRecordId ?? null}
        />
      </SidebarSection>

      <SidebarSection label="RECORDS">
        <div className="grid gap-2 text-text-2">
          <p>Contacts: {props.contactsCount ?? "—"}</p>
          <p>Companies: {props.companiesCount ?? "—"}</p>
          <p>Deals: {props.dealsCount ?? "—"}</p>
          <p>Tickets: {props.ticketsCount ?? "—"}</p>
        </div>
      </SidebarSection>

      <SidebarSection label="SCHEMA BREADTH">
        <div className="grid gap-2 text-text-2">
          <p>Contact properties: {props.contactPropertyCount ?? "—"}</p>
          <p>Company properties: {props.companyPropertyCount ?? "—"}</p>
          <p>Deal properties: {props.dealPropertyCount ?? "—"}</p>
          <p>Ticket properties: {props.ticketPropertyCount ?? "—"}</p>
          <p>Custom objects: {props.customObjectsCount ?? "—"}</p>
        </div>
      </SidebarSection>

      <SidebarSection label="OWNER">
        <p className="font-medium text-white">{props.ownerName}</p>
        <p className="mt-1 text-text-2">{props.ownerEmail}</p>
      </SidebarSection>

      <SidebarSection label="HUBS IN SCOPE">
        <div className="flex flex-wrap gap-2">
          {props.hubsInScope.length > 0 ? (
            props.hubsInScope.map((hub) => (
              <span
                key={hub}
                className="rounded-full border border-ink-4 bg-ink-2 px-2.5 py-1 text-xs uppercase tracking-[0.14em] text-white"
              >
                {hub}
              </span>
            ))
          ) : (
            <p className="text-text-2">No hubs selected</p>
          )}
        </div>
      </SidebarSection>

      <SidebarSection label="PLATFORM">
        <p className="font-medium text-white">
          {props.platformName ?? "No platform selected"}
        </p>
        {props.platformDescription ? (
          <p className="mt-1 text-text-2">{props.platformDescription}</p>
        ) : null}
      </SidebarSection>

      <SidebarSection label="QUICK WINS">
        <p className="text-text-2">
          {props.quickWins.total} total · {props.quickWins.open} open ·{" "}
          {props.quickWins.resolved} resolved
        </p>
      </SidebarSection>

      <button
        type="button"
        onClick={props.onRefreshSnapshot}
        disabled={props.refreshingSnapshot}
        className="rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-sm font-medium text-white transition hover:border-[rgba(0,196,204,0.45)] disabled:cursor-not-allowed disabled:text-text-3"
      >
        {props.refreshingSnapshot ? "Refreshing..." : "Refresh Snapshot"}
      </button>
    </aside>
  );
}
