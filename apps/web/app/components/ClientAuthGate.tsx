"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import {
  getPortalLabel,
  getPortalLoginPath,
  isPublicPortalRoute,
  resolvePortalExperienceFromPathname
} from "./portalExperience";

export default function ClientAuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const portalExperience = resolvePortalExperienceFromPathname(pathname);
  const loginPath = getPortalLoginPath(portalExperience);
  const isPublicClientRoute = isPublicPortalRoute(pathname, portalExperience);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      if (isPublicClientRoute) {
        if (!cancelled) {
          setAuthenticated(true);
          setChecked(true);
        }
        return;
      }

      try {
        const response = await fetch("/api/client-auth/session", {
          credentials: "include"
        });

        if (!response.ok) {
          throw new Error("Failed to verify client session");
        }

        const body = await response.json();
        const nextAuthenticated = Boolean(body?.authenticated);

        if (cancelled) {
          return;
        }

        setAuthenticated(nextAuthenticated);
        setChecked(true);

        if (!nextAuthenticated) {
          router.replace(loginPath);
        }
      } catch {
        if (cancelled) {
          return;
        }

        setAuthenticated(false);
        setChecked(true);
        router.replace(loginPath);
      }
    }

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, [isPublicClientRoute, loginPath, pathname, router]);

  if (isPublicClientRoute) {
    return <>{children}</>;
  }

  if (!checked || !authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-primary text-white">
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card px-6 py-5 text-sm text-text-secondary">
          Checking {getPortalLabel(portalExperience).toLowerCase()} access...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
