"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Bell, ChevronRight, Command } from "lucide-react";

interface Crumb {
  label: ReactNode;
  href?: string;
}

interface TopbarProps {
  crumbs?: Crumb[];
  actions?: ReactNode;
}

const segmentLabels: Record<string, string> = {
  today: "Today",
  inbox: "Inbox",
  projects: "Projects",
  clients: "Clients",
  contacts: "Contacts",
  calendar: "Calendar",
  quotes: "Quotes",
  retainers: "Retainers",
  invoices: "Invoices",
  financials: "Financials",
  capacity: "Capacity",
  workbooks: "Workbooks",
  "question-library": "Question library",
  templates: "Templates",
  agents: "Agents",
  runs: "Runs",
  settings: "Settings",
  workspace: "Workspace",
  team: "Team",
  email: "Email",
  integrations: "Integrations",
  "ai-integrations": "AI Integrations",
  "skeleton-key": "Skeleton Key",
  partners: "Partners",
  reports: "Reports",
  blueprint: "Blueprint",
  discovery: "Discovery",
  delivery: "Delivery",
  governance: "Governance",
  security: "Security",
  proposal: "Proposal",
  prepare: "Prepare",
  audit: "Audit",
  changes: "Changes",
  edit: "Edit",
  inputs: "Inputs",
  onboarding: "Onboarding",
  hubspot: "HubSpot",
  google: "Google Workspace",
  xero: "Xero",
  routing: "Routing",
  spend: "Spend",
  budgets: "Budgets",
  providers: "Providers",
  "command-centre": "Command Centre",
  products: "Products"
};

function humanize(seg: string): string {
  if (segmentLabels[seg]) return segmentLabels[seg];
  // IDs / slugs: keep first 8 chars + …
  if (/^[a-f0-9-]{12,}$/i.test(seg) || seg.length > 24) {
    return `${seg.slice(0, 8)}…`;
  }
  return seg
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export default function Topbar({ crumbs, actions }: TopbarProps) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const r = await fetch("/api/inbox/summary");
        if (!r.ok) return;
        const body = await r.json();
        if (!cancelled) setUnread(Number(body.summary?.total ?? 0));
      } catch {
        // ignore
      }
    }
    void poll();
    const id = setInterval(() => void poll(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pathname]);

  // Auto-derive crumbs from pathname when not provided
  const derived: Crumb[] = (() => {
    if (crumbs) return crumbs;
    if (pathname === "/" || pathname === "/today") {
      return [{ label: "Today" }];
    }
    const segments = pathname.split("/").filter(Boolean);
    const acc: Crumb[] = [];
    let path = "";
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i] ?? "";
      path += `/${seg}`;
      const isLast = i === segments.length - 1;
      acc.push({
        label: humanize(seg),
        href: isLast ? undefined : path
      });
    }
    return acc;
  })();

  return (
    <div className="h-[56px] border-b border-ink-4 bg-ink-0 flex items-center px-6 gap-4 sticky top-0 z-10">
      <nav className="flex items-center gap-2 text-[12.5px] text-text-3 flex-1 min-w-0 overflow-hidden">
        {derived.map((c, i) => (
          <span key={i} className="flex items-center gap-2 min-w-0">
            {i > 0 && (
              <ChevronRight size={12} className="text-text-4 flex-shrink-0" />
            )}
            {c.href ? (
              <Link
                href={c.href}
                className="hover:text-text-1 transition-colors truncate"
              >
                {c.label}
              </Link>
            ) : (
              <span
                className={`truncate ${
                  i === derived.length - 1 ? "text-text-1 font-medium" : ""
                }`}
              >
                {c.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <Link
          href="/inbox"
          className="relative p-1.5 rounded-md text-text-2 hover:text-text-1 hover:bg-ink-2 transition-colors"
          aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
          title={unread > 0 ? `${unread} unread` : "No new notifications"}
        >
          <Bell size={14} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-status-warn text-[#2a1a05] font-mono text-[9px] font-semibold leading-[14px] text-center">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>
        <button
          type="button"
          className="px-2 py-1 rounded-md text-text-2 border border-ink-4 hover:text-text-1 hover:bg-ink-2 hover:border-ink-5 transition-colors flex items-center gap-1.5 text-[12px]"
          aria-label="Command palette"
          title="Open command palette"
        >
          <Command size={13} />
          <span className="text-text-4">⌘K</span>
        </button>
        {actions}
      </div>
    </div>
  );
}
