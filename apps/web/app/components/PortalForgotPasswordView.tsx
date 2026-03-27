"use client";

import Link from "next/link";

import {
  type PortalExperience,
  getPortalLabel,
  getPortalLoginPath,
  getPortalSupportPath
} from "./portalExperience";

export default function PortalForgotPasswordView({
  portalExperience
}: {
  portalExperience: PortalExperience;
}) {
  const portalLabel = getPortalLabel(portalExperience);
  const lowerPortalLabel = portalLabel.toLowerCase();

  return (
    <div className="min-h-screen bg-background-primary px-6 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center py-10">
        <div className="w-full rounded-[32px] border border-[rgba(255,255,255,0.07)] bg-background-card p-8">
          <img src="/muloo-logo.svg" alt="Muloo" className="h-10 w-auto" />
          <p className="mt-6 text-sm uppercase tracking-[0.3em] text-text-muted">
            {portalLabel} access
          </p>
          <h1 className="mt-3 text-3xl font-bold font-heading text-white">
            Need a reset link?
          </h1>
          <p className="mt-3 text-text-secondary">
            We are using secure access links for {lowerPortalLabel} portal
            activation and password resets. If you need access again, ask Muloo
            to send you a fresh reset link.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={getPortalSupportPath(portalExperience)}
              className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm font-medium text-white"
            >
              Contact support
            </Link>
            <Link
              href={getPortalLoginPath(portalExperience)}
              className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
