"use client";

import { useEffect, useState } from "react";

import ClientShell from "./ClientShell";

interface SecurityCheck {
  id: string;
  category: string;
  question: string;
  guidance: string;
  weight: "critical" | "high" | "medium" | "low";
}

type FindingValue = "pass" | "fail" | "na" | "unknown";

interface SecurityProfile {
  findings: Record<string, FindingValue>;
  notes: string | null;
  riskLevel: string | null;
  reviewedAt: string | null;
  counts: {
    pass: number;
    fail: number;
    na: number;
    unknown: number;
    total: number;
  };
}

function findingClass(value: FindingValue) {
  switch (value) {
    case "pass":
      return "bg-[rgba(73,255,143,0.12)] text-[#7af0a8]";
    case "fail":
      return "bg-[rgba(224,80,96,0.18)] text-[#ff9aa6]";
    case "na":
      return "bg-[rgba(255,255,255,0.06)] text-text-muted";
    default:
      return "bg-[rgba(255,200,80,0.14)] text-[#ffd28a]";
  }
}

function findingLabel(value: FindingValue) {
  switch (value) {
    case "pass":
      return "OK";
    case "fail":
      return "Action needed";
    case "na":
      return "N/A";
    default:
      return "Pending review";
  }
}

export default function PortalSecurityWorkspace() {
  const [profile, setProfile] = useState<SecurityProfile | null>(null);
  const [checklist, setChecklist] = useState<SecurityCheck[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/portal/me/security-profile", {
          credentials: "include"
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "Failed");
        setProfile(body.profile);
        setChecklist(body.checklist ?? []);
        setCategories(body.categories ?? []);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Failed");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <ClientShell
      title="Security &amp; InfoSec"
      subtitle="Read-only view of your security posture across HubSpot, Google Workspace, DNS, and compliance."
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
              Security
            </p>
            <h1 className="mt-2 text-3xl font-bold font-heading text-white">
              Your security posture
            </h1>
            <p className="mt-2 max-w-2xl text-text-secondary">
              Muloo audits the security of your HubSpot, Google Workspace, and
              compliance setup. Use this view to track gaps and drive
              remediation. Findings update as we complete reviews.
            </p>
          </div>
          {profile ? (
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                Risk level
              </p>
              <p className="mt-1 text-2xl font-bold text-white capitalize">
                {profile.riskLevel ?? "unknown"}
              </p>
              {profile.reviewedAt ? (
                <p className="text-xs text-text-muted">
                  Reviewed{" "}
                  {new Date(profile.reviewedAt).toLocaleDateString()}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="mt-5 rounded-xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
            {error}
          </div>
        ) : null}

        {profile ? (
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                Pass
              </p>
              <p className="mt-2 text-2xl font-bold text-[#7af0a8]">
                {profile.counts.pass}
              </p>
            </div>
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                Action needed
              </p>
              <p className="mt-2 text-2xl font-bold text-[#ff9aa6]">
                {profile.counts.fail}
              </p>
            </div>
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                Pending
              </p>
              <p className="mt-2 text-2xl font-bold text-[#ffd28a]">
                {profile.counts.unknown}
              </p>
            </div>
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                N/A
              </p>
              <p className="mt-2 text-2xl font-bold text-text-secondary">
                {profile.counts.na}
              </p>
            </div>
          </div>
        ) : null}

        {loading ? (
          <p className="mt-6 text-sm text-text-muted">Loading...</p>
        ) : (
          categories.map((category) => {
            const checks = checklist.filter((c) => c.category === category);
            return (
              <section
                key={category}
                className="mt-6 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6"
              >
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-muted">
                  {category}
                </h3>
                <ul className="mt-4 space-y-2">
                  {checks.map((check) => {
                    const value =
                      profile?.findings[check.id] ?? ("unknown" as FindingValue);
                    return (
                      <li
                        key={check.id}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[rgba(255,255,255,0.05)] bg-[#0b1126] px-4 py-3"
                      >
                        <div className="flex-1 min-w-[200px]">
                          <p className="text-sm font-medium text-white">
                            {check.question}
                          </p>
                          <p className="mt-1 text-xs text-text-secondary">
                            {check.guidance}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${findingClass(value)}`}
                        >
                          {findingLabel(value)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}

        {profile?.notes ? (
          <section className="mt-6 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-muted">
              Reviewer notes
            </h3>
            <p className="mt-3 whitespace-pre-wrap text-sm text-text-secondary">
              {profile.notes}
            </p>
          </section>
        ) : null}
      </div>
    </ClientShell>
  );
}
