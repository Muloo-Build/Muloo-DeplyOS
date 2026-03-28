"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Bot,
  Building2,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  PlaySquare,
  ScrollText,
  Settings,
  X
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
        href: "/command-centre",
        label: "Command Centre",
        icon: <LayoutDashboard size={18} />,
        isActive: (pathname) =>
          pathname === "/" ||
          pathname === "/command-centre" ||
          pathname.startsWith("/command-centre/") ||
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
      },
      {
        href: "/partners",
        label: "Partners",
        icon: <Building2 size={16} />,
        compact: true,
        isActive: (pathname) =>
          pathname === "/partners" || pathname.startsWith("/partners/")
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
  const router = useRouter();
  const [inboxCount, setInboxCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-[rgba(255,255,255,0.07)] bg-[#060e2b]/95 px-4 backdrop-blur lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/muloo-logo.svg" alt="Muloo" className="h-8 w-auto" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">Deploy OS</p>
            <p className="truncate text-xs text-text-muted">Internal workspace</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-white transition-colors hover:bg-background-elevated"
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <button
        type="button"
        aria-label="Close navigation menu"
        onClick={() => setMobileOpen(false)}
        className={`fixed inset-0 z-40 bg-[rgba(2,6,23,0.72)] transition-opacity lg:hidden ${
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-[min(18rem,86vw)] flex-col border-r border-[rgba(255,255,255,0.07)] bg-[#060e2b] transition-transform duration-200 lg:z-30 lg:w-sidebar ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex items-start justify-between border-b border-[rgba(255,255,255,0.07)] px-6 py-5">
          <div>
            <img src="/muloo-logo.svg" alt="Muloo" className="h-10 w-auto" />
            <p className="mt-3 text-sm font-medium text-text-secondary">
              Deploy OS
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-white transition-colors hover:bg-background-elevated lg:hidden"
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-6">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-6">
              {group.label ? (
                <p className="mt-4 px-3 py-2 text-xs uppercase tracking-wider text-text-muted">
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
                        item.compact ? "ml-3 h-10" : "h-12"
                      } ${
                        active
                          ? "bg-background-elevated text-white"
                          : "text-text-secondary hover:bg-background-elevated hover:text-white"
                      }`}
                    >
                      {active ? (
                        <span className="absolute left-0 top-2 h-6 w-1 rounded-r bg-muloo-gradient" />
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

        <div className="border-t border-[rgba(255,255,255,0.07)] px-4 py-4">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-text-secondary transition-colors hover:bg-background-elevated hover:text-white"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-white">
              <LogOut size={18} />
            </span>
            <span className="font-medium">Sign out</span>
          </button>
          <p className="mt-4 px-2 text-xs uppercase tracking-[0.2em] text-text-muted">
            Internal delivery workspace
          </p>
        </div>
      </aside>
    </>
  );
}
