"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
        <button
          type="button"
          className="p-1.5 rounded-md text-text-2 hover:text-text-1 hover:bg-ink-2 transition-colors"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell size={14} />
        </button>
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
