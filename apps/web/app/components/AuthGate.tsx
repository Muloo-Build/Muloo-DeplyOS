"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

const protectedWorkspaceRoutePrefixes = [
  "/agents",
  "/blueprint",
  "/clients",
  "/command-centre",
  "/discovery",
  "/inbox",
  "/operations",
  "/partners",
  "/products",
  "/project",
  "/projects",
  "/runs",
  "/settings",
  "/skeleton-key",
  "/templates",
  "/workspace"
];

function isProtectedWorkspaceRoute(pathname: string) {
  return (
    pathname === "/" ||
    protectedWorkspaceRoutePrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )
  );
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const protectedWorkspaceRoute = isProtectedWorkspaceRoute(pathname);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      if (
        pathname === "/login" ||
        pathname.startsWith("/client") ||
        pathname.startsWith("/partner")
      ) {
        if (!cancelled) {
          setAuthenticated(true);
          setChecked(true);
        }
        return;
      }

      try {
        const response = await fetch("/api/auth/session", {
          credentials: "include"
        });

        if (!response.ok) {
          throw new Error("Failed to verify session");
        }

        const body = await response.json();
        const nextAuthenticated = Boolean(body?.authenticated);

        if (cancelled) {
          return;
        }

        setAuthenticated(nextAuthenticated);
        setChecked(true);

        if (!nextAuthenticated && protectedWorkspaceRoute) {
          router.replace("/login");
        }
      } catch {
        if (cancelled) {
          return;
        }

        setAuthenticated(false);
        setChecked(true);
        if (protectedWorkspaceRoute) {
          router.replace("/login");
        }
      }
    }

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, [pathname, protectedWorkspaceRoute, router]);

  if (
    pathname === "/login" ||
    pathname.startsWith("/client") ||
    pathname.startsWith("/partner")
  ) {
    return <>{children}</>;
  }

  if (!protectedWorkspaceRoute) {
    return <>{children}</>;
  }

  if (!checked || !authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-0 text-white">
        <div className="rounded-[14px] border border-ink-4 bg-ink-1 px-6 py-5 text-sm text-text-2">
          Checking workspace access...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
