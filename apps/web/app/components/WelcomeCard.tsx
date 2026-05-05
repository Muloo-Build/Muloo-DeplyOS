"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface PortalUser {
  id: string;
  firstName: string;
  firstLoginAt: string | null;
  welcomeDismissedAt: string | null;
  createdAt: string | null;
}

interface PortalProjectStep {
  projectId: string;
  projectName: string;
}

interface WelcomeStep {
  key: "hubspot" | "inputs" | "approve";
  label: string;
  description: string;
  href: string | null;
  done: boolean;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function withinFirstWeek(user: PortalUser): boolean {
  if (user.welcomeDismissedAt) return false;
  const reference = user.firstLoginAt ?? user.createdAt;
  if (!reference) return true;
  const stamp = new Date(reference).getTime();
  if (!Number.isFinite(stamp)) return true;
  return Date.now() - stamp <= SEVEN_DAYS_MS;
}

interface WelcomeCardProps {
  hubspotConnect?: PortalProjectStep | null;
  pendingInputs?: PortalProjectStep | null;
  pendingApproval?: PortalProjectStep | null;
}

export default function WelcomeCard(props: WelcomeCardProps) {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [hidden, setHidden] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/client-auth/session", {
          credentials: "include"
        });
        if (!response.ok) return;
        const body = (await response.json().catch(() => null)) as
          | { authenticated?: boolean; user?: PortalUser | null }
          | null;
        if (!cancelled && body?.user) {
          setUser(body.user);
        }
      } catch {
        // ignore — welcome card is non-blocking
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDismiss() {
    setDismissing(true);
    try {
      await fetch("/api/client-auth/welcome/dismiss", {
        method: "POST",
        credentials: "include"
      });
    } catch {
      // ignore — local hide is enough
    } finally {
      setHidden(true);
      setDismissing(false);
    }
  }

  if (!user || hidden || !withinFirstWeek(user)) {
    return null;
  }

  const steps: WelcomeStep[] = [
    {
      key: "hubspot",
      label: "Connect your HubSpot",
      description: props.hubspotConnect
        ? `Authorise Muloo against ${props.hubspotConnect.projectName}.`
        : "We'll surface this on each project's overview when it's ready.",
      href: props.hubspotConnect
        ? `/client/projects/${encodeURIComponent(props.hubspotConnect.projectId)}`
        : null,
      done: !props.hubspotConnect
    },
    {
      key: "inputs",
      label: "Complete project inputs",
      description: props.pendingInputs
        ? `Tell us about ${props.pendingInputs.projectName}.`
        : "All your input forms are up to date.",
      href: props.pendingInputs
        ? `/client/projects/${encodeURIComponent(props.pendingInputs.projectId)}#inputs`
        : null,
      done: !props.pendingInputs
    },
    {
      key: "approve",
      label: "Approve shared quote",
      description: props.pendingApproval
        ? `Review the latest quote on ${props.pendingApproval.projectName}.`
        : "No quotes waiting on your approval.",
      href: props.pendingApproval
        ? `/client/projects/${encodeURIComponent(props.pendingApproval.projectId)}`
        : null,
      done: !props.pendingApproval
    }
  ];

  return (
    <div className="rounded-[14px] border border-[rgba(81,208,176,0.25)] bg-[rgba(81,208,176,0.07)] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[#9be4d2]">
            Welcome
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Hi {user.firstName}, here's how to get started
          </h2>
          <p className="mt-1 text-sm text-text-2">
            Three quick wins to make your Muloo portal useful from day one.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={dismissing}
          className="text-xs text-text-3 hover:text-white disabled:opacity-50"
          aria-label="Dismiss welcome"
        >
          ×
        </button>
      </div>
      <ol className="mt-4 space-y-2">
        {steps.map((step, index) => (
          <li
            key={step.key}
            className="flex items-start justify-between gap-3 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(0,0,0,0.15)] px-4 py-3"
          >
            <div className="flex flex-1 items-start gap-3">
              <span
                className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                  step.done
                    ? "bg-emerald-500/20 text-emerald-200"
                    : "bg-[#49cde1]/15 text-[#9be4f0]"
                }`}
              >
                {step.done ? "✓" : index + 1}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{step.label}</p>
                <p className="text-xs text-text-3">{step.description}</p>
              </div>
            </div>
            {step.href && !step.done ? (
              <Link
                href={step.href}
                className="rounded-xl border border-ink-4 px-3 py-1.5 text-xs font-medium text-text-2 transition hover:bg-white/5 hover:text-white"
              >
                Open
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
