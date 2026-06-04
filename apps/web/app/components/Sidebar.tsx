"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Bot,
  BookOpen,
  Building2,
  Calendar,
  FileText,
  FolderKanban,
  HelpCircle,
  Home,
  Inbox,
  Layers,
  LineChart,
  LogOut,
  Menu,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  Users,
  X
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  isActive: (pathname: string) => boolean;
  badge?: "inbox";
  count?: number;
};

type NavGroup = {
  label: string | null;
  items: NavItem[];
};

function isProjectsRoute(pathname: string): boolean {
  if (pathname.startsWith("/operations")) return false;
  return (
    pathname.startsWith("/blueprint") ||
    pathname === "/projects" ||
    pathname.startsWith("/projects/") ||
    pathname.startsWith("/project")
  );
}

function isTodayRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/today" ||
    pathname.startsWith("/today/") ||
    pathname === "/command-centre" ||
    pathname.startsWith("/command-centre/") ||
    pathname === "/workspace" ||
    pathname.startsWith("/workspace/")
  );
}

const navGroups: NavGroup[] = [
  {
    label: null,
    items: [
      {
        href: "/today",
        label: "Today",
        icon: <Home size={15} />,
        isActive: isTodayRoute
      }
    ]
  },
  {
    label: "Work",
    items: [
      {
        href: "/inbox",
        label: "Inbox",
        icon: <Inbox size={15} />,
        isActive: (p) => p === "/inbox" || p.startsWith("/inbox/"),
        badge: "inbox"
      },
      {
        href: "/projects",
        label: "Projects",
        icon: <FolderKanban size={15} />,
        isActive: isProjectsRoute
      },
      {
        href: "/clients",
        label: "Clients",
        icon: <Building2 size={15} />,
        isActive: (p) => p === "/clients" || p.startsWith("/clients/")
      },
      {
        href: "/contacts",
        label: "Contacts",
        icon: <Users size={15} />,
        isActive: (p) => p === "/contacts" || p.startsWith("/contacts/")
      },
      {
        href: "/calendar",
        label: "Calendar",
        icon: <Calendar size={15} />,
        isActive: (p) => p === "/calendar" || p.startsWith("/calendar/")
      }
    ]
  },
  {
    label: "Commercials",
    items: [
      {
        href: "/quotes",
        label: "Quotes",
        icon: <FileText size={15} />,
        isActive: (p) => p === "/quotes" || p.startsWith("/quotes/")
      },
      {
        href: "/retainers",
        label: "Retainers",
        icon: <RefreshCw size={15} />,
        isActive: (p) => p === "/retainers" || p.startsWith("/retainers/")
      },
      {
        href: "/invoices",
        label: "Invoices",
        icon: <Receipt size={15} />,
        isActive: (p) => p === "/invoices" || p.startsWith("/invoices/")
      },
      {
        href: "/financials",
        label: "Financials",
        icon: <LineChart size={15} />,
        isActive: (p) =>
          p === "/financials" ||
          p.startsWith("/financials/") ||
          p === "/capacity" ||
          p.startsWith("/capacity/")
      }
    ]
  },
  {
    label: "Operations",
    items: [
      {
        href: "/operations",
        label: "Operations overview",
        icon: <Layers size={15} />,
        isActive: (p) => p === "/operations" || p.startsWith("/operations/")
      },
      {
        href: "/workbooks",
        label: "Workbooks",
        icon: <BookOpen size={15} />,
        isActive: (p) => p === "/workbooks" || p.startsWith("/workbooks/")
      },
      {
        href: "/question-library",
        label: "Question library",
        icon: <HelpCircle size={15} />,
        isActive: (p) =>
          p === "/question-library" || p.startsWith("/question-library/")
      },
      {
        href: "/templates",
        label: "Implementation templates",
        icon: <Layers size={15} />,
        isActive: (p) => p === "/templates" || p.startsWith("/templates/")
      },
      {
        href: "/agents",
        label: "Agents",
        icon: <Bot size={15} />,
        isActive: (p) =>
          p === "/agents" ||
          p.startsWith("/agents/") ||
          p === "/runs" ||
          p.startsWith("/runs/")
      }
    ]
  }
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [inboxCount, setInboxCount] = useState(0);
  const [userInitials, setUserInitials] = useState("MU");
  const [userName, setUserName] = useState("Muloo");
  const [userOrg, setUserOrg] = useState("muloo.co");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Launch Muloo Hub Command (reporting) with the current workspace identity.
  // No payload → lands on the Hub Command company mirror list.
  async function launchReporting() {
    try {
      const res = await fetch("/api/auth/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        alert("Reporting unavailable");
        return;
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch {
      alert("Reporting unavailable");
    }
  }

  useEffect(() => {
    async function loadSummary() {
      try {
        const response = await fetch("/api/inbox/summary");
        if (!response.ok) return;
        const body = await response.json();
        setInboxCount(body.summary?.total ?? 0);
      } catch {
        // ignore
      }
    }
    void loadSummary();
  }, [pathname]);

  useEffect(() => {
    async function loadMe() {
      try {
        const response = await fetch("/api/auth/session");
        if (!response.ok) return;
        const body = await response.json();
        const name: string | undefined = body?.user?.name ?? body?.name;
        const email: string | undefined = body?.user?.email ?? body?.email;
        if (name) {
          setUserName(name.split(" ")[0] ?? name);
          const initials = name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((p: string) => p[0]?.toUpperCase() ?? "")
            .join("");
          if (initials) setUserInitials(initials);
        }
        if (email) {
          const org = email.split("@")[1] ?? "";
          if (org) setUserOrg(org);
        }
      } catch {
        // ignore
      }
    }
    void loadMe();
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
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
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-ink-4 bg-ink-0/95 px-4 backdrop-blur lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <span className="brand-wordmark text-[20px] font-bold -tracking-[0.02em]">
            muloo
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold">
            Deploy OS
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-ink-4 bg-ink-2 text-text-1 transition-colors hover:bg-ink-3"
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <button
        type="button"
        aria-label="Close navigation menu"
        onClick={() => setMobileOpen(false)}
        className={`fixed inset-0 z-40 bg-black/72 transition-opacity lg:hidden ${
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-[min(18rem,86vw)] flex-col bg-ink-1 border-r border-ink-4 transition-transform duration-200 overflow-y-auto lg:z-30 lg:w-nav-w ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 pt-6 pb-4 border-b border-ink-4">
          <div className="flex flex-col">
            <span className="brand-wordmark text-[22px] font-bold leading-none -tracking-[0.02em]">
              muloo
            </span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold mt-1">
              Deploy OS
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-md border border-ink-4 bg-ink-2 text-text-1 transition-colors hover:bg-ink-3 lg:hidden"
            aria-label="Close navigation menu"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="mx-3 mt-3.5 mb-1.5 relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Jump to…"
            aria-label="Jump to"
            className="w-full bg-ink-2 border border-ink-4 rounded-[10px] pl-8 pr-10 py-2 text-[12.5px] text-text-1 outline-none transition-colors focus:border-[rgba(74,219,192,0.35)] placeholder:text-text-4"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-text-4 bg-ink-3 border border-ink-4 rounded px-1.5 py-px">
            ⌘K
          </kbd>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 px-3 pb-3 pt-1.5 overflow-y-auto">
          {navGroups.map((group, idx) => (
            <div key={`${group.label ?? "_"}-${idx}`} className="pt-3.5 pb-1.5">
              {group.label && (
                <div className="px-2 pb-1.5 text-[10px] tracking-[0.14em] uppercase text-text-4 font-semibold">
                  {group.label}
                </div>
              )}
              <div className="space-y-px">
                {group.items.map((item) => {
                  const active = item.isActive(pathname);
                  const showInboxBadge = item.badge === "inbox" && inboxCount > 0;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
                        active
                          ? "bg-ink-3 text-text-1"
                          : "text-text-2 hover:bg-ink-2 hover:text-text-1"
                      }`}
                    >
                      {active && (
                        <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-status-ok rounded-r" />
                      )}
                      <span className="opacity-85 flex-shrink-0">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                      {showInboxBadge && (
                        <span
                          className={`ml-auto font-mono text-[11px] px-1.5 py-px rounded-[10px] min-w-5 text-center ${
                            active
                              ? "bg-[rgba(74,219,192,0.12)] text-status-ok"
                              : "bg-ink-3 text-text-3"
                          }`}
                        >
                          {inboxCount}
                        </span>
                      )}
                      {typeof item.count === "number" && (
                        <span
                          className={`ml-auto font-mono text-[11px] px-1.5 py-px rounded-[10px] min-w-5 text-center ${
                            active
                              ? "bg-[rgba(74,219,192,0.12)] text-status-ok"
                              : "bg-ink-3 text-text-3"
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Reporting — launches Muloo Hub Command via signed SSO (POST then redirect). */}
          <div className="pt-3.5 pb-1.5">
            <div className="px-2 pb-1.5 text-[10px] tracking-[0.14em] uppercase text-text-4 font-semibold">
              Reporting
            </div>
            <div className="space-y-px">
              <button
                type="button"
                onClick={launchReporting}
                className="relative flex w-full items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] text-text-2 transition-colors hover:bg-ink-2 hover:text-text-1"
              >
                <span className="opacity-85 flex-shrink-0">
                  <LineChart size={15} />
                </span>
                <span className="truncate">Reporting</span>
              </button>
            </div>
          </div>
        </nav>

        {/* Footer: user + settings */}
        <div className="mt-auto relative border-t border-ink-4 p-3 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-from to-brand-to grid place-items-center font-bold text-[11px] text-white">
            {userInitials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-medium text-text-1 truncate">
              {userName}
            </div>
            <div className="text-[11px] text-text-3 truncate">{userOrg}</div>
          </div>
          <button
            type="button"
            onClick={() => setUserMenuOpen((v) => !v)}
            className="text-text-3 p-1 rounded-md hover:bg-ink-2 hover:text-text-1 transition-colors"
            aria-label="User menu"
            aria-expanded={userMenuOpen}
          >
            <Settings size={15} />
          </button>

          {userMenuOpen && (
            <>
              <button
                type="button"
                aria-label="Close user menu"
                onClick={() => setUserMenuOpen(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div className="absolute bottom-14 right-3 z-50 min-w-[180px] bg-ink-2 border border-ink-4 rounded-[10px] shadow-elev-md py-1">
                <Link
                  href="/settings"
                  className="flex items-center gap-2 px-3 py-2 text-[12.5px] text-text-2 hover:bg-ink-3 hover:text-text-1 transition-colors"
                >
                  <Settings size={14} />
                  Settings
                </Link>
                <Link
                  href="/skeleton-key"
                  className="flex items-center gap-2 px-3 py-2 text-[12.5px] text-text-2 hover:bg-ink-3 hover:text-text-1 transition-colors"
                >
                  <Bot size={14} />
                  Skeleton Key
                </Link>
                <div className="border-t border-ink-4 my-1" />
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-text-2 hover:bg-ink-3 hover:text-text-1 transition-colors"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
