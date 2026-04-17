"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type HomeTarget = {
  href: string;
  supportHref: string;
};

export default function NotFound() {
  const [target, setTarget] = useState<HomeTarget>({
    href: "/",
    supportHref: "mailto:support@muloo.io"
  });

  useEffect(() => {
    let cancelled = false;

    async function resolveTarget() {
      const [workspaceSession, clientSession] = await Promise.all([
        fetch("/api/auth/session", { credentials: "include" })
          .then((response) => response.json())
          .catch(() => null),
        fetch("/api/client-auth/session", { credentials: "include" })
          .then((response) => response.json())
          .catch(() => null)
      ]);

      if (cancelled) {
        return;
      }

      if (clientSession?.authenticated) {
        setTarget({ href: "/client", supportHref: "/client/support" });
        return;
      }

      if (workspaceSession?.authenticated) {
        setTarget({ href: "/", supportHref: "mailto:support@muloo.io" });
      }
    }

    void resolveTarget();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background-primary px-6 py-12 text-white">
      <section className="w-full max-w-2xl text-center">
        <img
          src="/muloo-logo.svg"
          alt="Muloo"
          className="mx-auto h-10 w-auto"
        />
        <p className="mt-10 text-sm uppercase tracking-[0.22em] text-text-muted">
          404
        </p>
        <h1 className="mt-3 font-heading text-4xl font-bold text-white">
          Page not found
        </h1>
        <p className="mx-auto mt-4 max-w-md text-text-secondary">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href={target.href}
            className="rounded-lg bg-accent-solid px-5 py-3 text-sm font-semibold text-[#03111f] transition hover:brightness-110"
          >
            Back to home
          </Link>
          <Link
            href={target.supportHref}
            className="rounded-lg border border-[rgba(255,255,255,0.12)] bg-background-card px-5 py-3 text-sm font-semibold text-white transition hover:border-accent-solid"
          >
            Contact support
          </Link>
        </div>
      </section>
    </main>
  );
}
