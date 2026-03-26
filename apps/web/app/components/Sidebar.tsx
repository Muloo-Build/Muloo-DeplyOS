"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Bot,
  Building2,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  PlaySquare,
  ScrollText,
  Settings
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  compact?: boolean;
  isActive: (pathname: string) => boolean;
  badge?: "inbox";
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

function isProjectsRoute(pathname: string): boolean {
  if (
    pathname.startsWith("/projects/portal-ops") ||
    pathname.startsWith("/operations")
  ) {
    return false;
  }

  return (
    pathname.startsWith("/blueprint") ||
    pathname === "/projects" ||
    pathname.startsWith("/projects/") ||
    pathname.startsWith("/project")
  );
}

const navGroups: NavGroup[] = [
  {
    label: "",
    items: [
      {
        href: "/",
        label: "Command Centre",
        icon: <LayoutDashboard size={18} />,
        isActive: (pathname) =>
          pathname === "/" ||
          pathname === "/workspace" ||
          pathname.startsWith("/workspace/")
      },
      {
        href: "/inbox",
        label: "Inbox",
        icon: <Inbox size={18} />,
        isActive: (pathname) =>
          pathname === "/inbox" || pathname.startsWith("/inbox/"),
        badge: "inbox"
      }
    ]
  },
  {
    label: "DELIVERY",
    items: [
      {
        href: "/projects",
        label: "Projects",
        icon: <FolderKanban size={18} />,
        isActive: isProjectsRoute
      },
      {
        href: "/clients",
        label: "Clients",
        icon: <Building2 size={18} />,
        isActive: (pathname) =>
          pathname === "/clients" || pathname.startsWith("/clients/")
      }
    ]
  },
  {
    label: "OPERATIONS",
    items: [
      {
        href: "/projects/portal-ops",
        label: "Portal Ops",
        icon: <LayoutDashboard size={16} />,
        compact: true,
        isActive: (pathname) =>
          pathname === "/projects/portal-ops" ||
          pathname.startsWith("/projects/portal-ops/")
      },
      {
        href: "/runs",
        label: "Runs",
        icon: <PlaySquare size={16} />,
        compact: true,
        isActive: (pathname) => pathname === "/runs" || pathname.startsWith("/runs/")
      },
      {
        href: "/agents",
        label: "Agents",
        icon: <Bot size={16} />,
        compact: true,
        isActive: (pathname) =>
          pathname === "/agents" || pathname.startsWith("/agents/")
      }
    ]
  },
  {
    label: "ADMIN",
    items: [
      {
        href: "/templates",
        label: "Templates",
        icon: <ScrollText size={18} />,
        isActive: (pathname) =>
          pathname === "/templates" || pathname.startsWith("/templates/")
      },
      {
        href: "/settings",
        label: "Settings",
        icon: <Settings size={18} />,
        isActive: (pathname) =>
          pathname === "/settings" || pathname.startsWith("/settings/")
      }
    ]
  }
];

export default function Sidebar() {
  const pathname = usePathname();
  const [inboxCount, setInboxCount] = useState(0);

  useEffect(() => {
    async function loadSummary() {
      try {
        const response = await fetch("/api/inbox/summary");

        if (!response.ok) {
          return;
        }

        const body = await response.json();
        setInboxCount(body.summary?.total ?? 0);
      } catch {
        // Ignore nav badge failures.
      }
    }

    void loadSummary();
  }, [pathname]);

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-sidebar flex-col border-r border-[rgba(255,255,255,0.07)] bg-[#0a0f24]">
      <div className="border-b border-[rgba(255,255,255,0.07)] px-6 py-5">
        <img src="/muloo-logo.svg" alt="Muloo" className="h-10 w-auto" />
        <p className="mt-3 text-sm font-medium text-text-secondary">
          Deploy OS
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-6">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-6">
            {group.label ? (
              <p className="mt-4 px-3 py-2 text-xs uppercase tracking-wider text-zinc-500">
                {group.label}
              </p>
            ) : null}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = item.isActive(pathname);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative flex items-center gap-3 rounded-xl px-3 transition-colors ${
                      item.compact ? "h-10 ml-3" : "h-12"
                    } ${
                      active
                        ? "bg-[#141d3d] text-white"
                        : "text-text-secondary hover:bg-[#141d3d] hover:text-white"
                    }`}
                  >
                    {active ? (
                      <span className="absolute left-0 top-2 h-6 w-1 rounded-r bg-[linear-gradient(180deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)]" />
                    ) : null}
                    <span
                      className={`flex items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-white ${
                        item.compact ? "h-6 w-6" : "h-7 w-7"
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className={item.compact ? "text-sm font-medium" : "font-medium"}>
                      {item.label}
                    </span>
                    {item.badge === "inbox" && inboxCount > 0 ? (
                      <span className="ml-auto flex min-w-6 items-center justify-center rounded-full bg-[rgba(224,80,96,0.9)] px-2 py-1 text-[10px] font-semibold text-white">
                        {inboxCount}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-[rgba(255,255,255,0.07)] px-6 py-4">
        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
          Internal delivery workspace
        </p>
      </div>
    </aside>
  );
}
