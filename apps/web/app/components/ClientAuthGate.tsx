"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export default function ClientAuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      if (pathname === "/client/login") {
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
          router.replace("/client/login");
        }
      } catch {
        if (cancelled) {
          return;
        }

        setAuthenticated(false);
        setChecked(true);
        router.replace("/client/login");
      }
    }

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (pathname === "/client/login") {
    return <>{children}</>;
  }

  if (!checked || !authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-primary text-white">
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card px-6 py-5 text-sm text-text-secondary">
          Checking client access...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
