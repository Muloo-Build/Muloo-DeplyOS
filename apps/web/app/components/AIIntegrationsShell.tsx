"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import SettingsShell from "./SettingsShell";

const subNav = [
  { href: "/settings/ai-integrations", label: "Overview" },
  { href: "/settings/ai-integrations/providers", label: "Providers" },
  { href: "/settings/ai-integrations/spend", label: "Spend" },
  { href: "/settings/ai-integrations/agents", label: "Agents" },
  { href: "/settings/ai-integrations/routing", label: "Routing" },
  { href: "/settings/ai-integrations/budgets", label: "Budgets" }
];

export default function AIIntegrationsShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <SettingsShell title={title} subtitle={subtitle}>
      <div className="flex gap-0.5 border-b border-ink-4 mb-5 overflow-x-auto">
        {subNav.map((item) => {
          const active =
            item.href === "/settings/ai-integrations"
              ? pathname === item.href
              : pathname === item.href ||
                pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3.5 py-2.5 text-[13px] cursor-pointer border-b-2 -mb-px transition-colors whitespace-nowrap ${
                active
                  ? "text-text-1 border-status-ok"
                  : "text-text-3 border-transparent hover:text-text-2"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
      <div>{children}</div>
    </SettingsShell>
  );
}
