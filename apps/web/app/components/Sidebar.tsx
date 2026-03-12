"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Projects", shortLabel: "P" },
  { href: "/templates", label: "Templates", shortLabel: "T" },
  { href: "/runs", label: "Runs", shortLabel: "R" },
  { href: "/settings", label: "Settings", shortLabel: "S" }
];

function isProjectsRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/project")
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-sidebar flex-col border-r border-[rgba(255,255,255,0.07)] bg-[#0a0f24]">
      <div className="border-b border-[rgba(255,255,255,0.07)] px-6 py-5">
        <p className="text-xs uppercase tracking-[0.35em] text-text-muted">
          Muloo
        </p>
        <h1 className="mt-2 text-2xl font-bold font-heading gradient-text">
          Deploy OS
        </h1>
      </div>

      <nav className="flex-1 px-3 py-6">
        {navItems.map((item) => {
          const active =
            item.href === "/"
              ? isProjectsRoute(pathname)
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative mb-2 flex h-12 items-center gap-3 rounded-xl px-3 transition-colors ${
                active
                  ? "bg-[#141d3d] text-white"
                  : "text-text-secondary hover:bg-[#141d3d] hover:text-white"
              }`}
            >
              {active ? (
                <span className="absolute left-0 top-2 h-8 w-1 rounded-r bg-[linear-gradient(180deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)]" />
              ) : null}
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-xs font-semibold text-white">
                {item.shortLabel}
              </span>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[rgba(255,255,255,0.07)] px-6 py-4">
        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
          Internal delivery workspace
        </p>
      </div>
    </aside>
  );
}
