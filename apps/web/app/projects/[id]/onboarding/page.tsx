"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import Breadcrumb from "../../../components/Breadcrumb";
import { SkeletonBlock } from "../../../components/LoadingSkeleton";

// T4.3 — landing page shown immediately after the wizard. Five-item
// "now do these things" checklist with persisted tick state. Tick state
// is stored as JSON on the Project record (see
// `apps/api/prisma/schema.prisma` `onboardingChecklist`).
type OnboardingChecklistItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  completedAt: string | null;
};

type ChampionInvitePreview = {
  champion: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  projectName: string;
  subject: string;
  body: string;
  accessUrl: string | null;
  authStatus: "invite_pending" | "active";
  emailSentAt: string | null;
  hasInviteToken: boolean;
  // T4.2 — set when the champion was auto-provisioned to the portal during
  // project create. Null once the champion has accepted the invite.
  inviteQueuedAt: string | null;
  message: string | null;
};

type ProjectSummary = {
  id: string;
  name: string;
  clientName: string | null;
};

export default function ProjectOnboardingPage({
  params
}: {
  params: { id: string };
}) {
  const projectId = params.id;
  // T4 — surface the non-fatal "template seeding failed" warning that
  // the wizard passes through the redirect when post-create template
  // application fails. Without this the operator never saw the warning.
  const searchParams = useSearchParams();
  const incomingWarning = searchParams?.get("warning") ?? null;
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [items, setItems] = useState<OnboardingChecklistItem[]>([]);
  const [invite, setInvite] = useState<ChampionInvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  // T4.3 — keep inline checklist toggle failures separate from the
  // page-level load error so a transient PATCH failure doesn't blank
  // the whole checklist with an error panel until reload.
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const loadChecklist = useCallback(async () => {
    const response = await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/onboarding-checklist`
    );
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(body?.error ?? "Failed to load onboarding checklist");
    }
    return (body?.items ?? []) as OnboardingChecklistItem[];
  }, [projectId]);

  const loadInvitePreview = useCallback(async () => {
    const response = await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/champion-invite`
    );
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(body?.error ?? "Failed to load champion invite preview");
    }
    return (body?.preview ?? null) as ChampionInvitePreview | null;
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const [projectResponse, checklist, invitePreview] = await Promise.all([
          fetch(`/api/projects/${encodeURIComponent(projectId)}`),
          loadChecklist(),
          loadInvitePreview()
        ]);
        const projectBody = await projectResponse.json().catch(() => null);
        if (!projectResponse.ok) {
          throw new Error(projectBody?.error ?? "Failed to load project");
        }
        if (!cancelled) {
          setProject({
            id: projectBody?.project?.id ?? projectId,
            name: projectBody?.project?.name ?? "Project",
            clientName: projectBody?.project?.clientName ?? null
          });
          setItems(checklist);
          setInvite(invitePreview);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "We couldn't load the onboarding checklist."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void loadAll();
    return () => {
      cancelled = true;
    };
  }, [projectId, loadChecklist, loadInvitePreview]);

  async function toggleItem(item: OnboardingChecklistItem) {
    setSavingItemId(item.id);
    setToggleError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/onboarding-checklist/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: !item.completedAt })
        }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to update checklist item");
      }
      setItems((body?.items ?? []) as OnboardingChecklistItem[]);
    } catch (caught) {
      // T4.3 — surface as inline toggle error, NOT the page-level
      // `error` state, so the checklist stays rendered and the
      // operator can retry the toggle without reloading.
      setToggleError(
        caught instanceof Error
          ? caught.message
          : "We couldn't save that change."
      );
    } finally {
      setSavingItemId(null);
    }
  }

  async function reprovisionChampion() {
    setSendingInvite(true);
    setInviteError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/champion-invite/reprovision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}"
        }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to re-provision champion");
      }
      setInvite((body?.preview ?? null) as ChampionInvitePreview | null);
    } catch (caught) {
      setInviteError(
        caught instanceof Error
          ? caught.message
          : "We couldn't re-provision the champion."
      );
    } finally {
      setSendingInvite(false);
    }
  }

  async function sendChampionInvite() {
    setSendingInvite(true);
    setInviteError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/champion-invite/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}"
        }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to send champion invite");
      }
      setInvite((body?.preview ?? null) as ChampionInvitePreview | null);
      // Sending the invite also ticks the corresponding checklist item
      // server-side — refetch so the UI reflects it.
      const refreshed = await loadChecklist();
      setItems(refreshed);
    } catch (caught) {
      setInviteError(
        caught instanceof Error
          ? caught.message
          : "We couldn't send the invite."
      );
    } finally {
      setSendingInvite(false);
    }
  }

  const completed = items.filter((item) => item.completedAt !== null).length;

  return (
    <AppShell>
      <div className="p-8">
        <Breadcrumb
          items={[
            { label: "Projects", href: "/projects" },
            {
              label: project?.name ?? "Project",
              href: `/projects/${projectId}`
            },
            { label: "Onboarding" }
          ]}
        />

        <div className="mt-6 max-w-4xl">
          <p className="text-xs uppercase tracking-[0.14em] text-[#49cde1]">
            Project setup · Step 4
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Onboarding checklist
          </h1>
          <p className="mt-3 text-sm text-text-2">
            Five things to do now to get this project moving. Tick them off as
            you complete them — your progress is saved automatically.
          </p>

          {incomingWarning ? (
            <div
              className="mt-6 rounded-[14px] border border-[rgba(245,158,11,0.4)] bg-[rgba(245,158,11,0.08)] p-4 text-sm text-amber-100"
              role="status"
            >
              {incomingWarning}
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="mt-8 max-w-4xl">
            <SkeletonBlock height="h-64" />
          </div>
        ) : error ? (
          <div className="mt-8 max-w-4xl rounded-[14px] border border-[rgba(224,80,96,0.4)] bg-ink-1 p-6 text-rose-100">
            {error}
          </div>
        ) : (
          <div className="mt-8 max-w-4xl space-y-6">
            {toggleError ? (
              <div
                className="rounded-[14px] border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-rose-100"
                role="alert"
              >
                {toggleError}
              </div>
            ) : null}
            <div className="flex items-center justify-between rounded-[14px] border border-ink-4 bg-ink-1 px-6 py-4 text-sm text-text-2">
              <span>
                <span className="font-semibold text-white">
                  {completed}/{items.length}
                </span>{" "}
                completed
              </span>
              <Link
                href={`/projects/${projectId}`}
                className="rounded-lg border border-ink-5 px-3 py-1.5 text-xs text-text-2 hover:bg-ink-2"
              >
                Skip to project workspace
              </Link>
            </div>

            <ul className="space-y-3">
              {items.map((item) => {
                const isComplete = Boolean(item.completedAt);
                const isSaving = savingItemId === item.id;
                return (
                  <li
                    key={item.id}
                    className={`rounded-[14px] border p-5 transition-colors ${
                      isComplete
                        ? "border-[rgba(73,205,225,0.35)] bg-[rgba(11,26,52,0.55)]"
                        : "border-ink-4 bg-ink-1"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <button
                        type="button"
                        onClick={() => void toggleItem(item)}
                        // T4.2 — `send_champion_welcome` reflects whether the
                        // invite email was actually sent. It can only be
                        // toggled by the Send button below, never by clicking
                        // the checkbox, otherwise the UI could falsely claim
                        // an email was sent.
                        disabled={
                          isSaving || item.id === "send_champion_welcome"
                        }
                        aria-pressed={isComplete}
                        aria-label={
                          item.id === "send_champion_welcome"
                            ? "Marked complete automatically when the invite is sent"
                            : isComplete
                              ? `Mark "${item.label}" as not done`
                              : `Mark "${item.label}" as done`
                        }
                        title={
                          item.id === "send_champion_welcome"
                            ? "This ticks automatically when the invite email is sent."
                            : undefined
                        }
                        className={`mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border transition-colors ${
                          isComplete
                            ? "border-accent-solid bg-accent-solid text-[#03162a]"
                            : "border-ink-5 bg-transparent hover:border-[rgba(255,255,255,0.32)]"
                        } ${
                          isSaving || item.id === "send_champion_welcome"
                            ? "opacity-60 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        {isComplete ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="h-4 w-4"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.704 5.296a1 1 0 010 1.408l-7.5 7.5a1 1 0 01-1.408 0l-3.5-3.5a1 1 0 011.408-1.408L8.5 12.092l6.796-6.796a1 1 0 011.408 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : null}
                      </button>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p
                            className={`text-base font-semibold ${
                              isComplete
                                ? "text-text-2 line-through"
                                : "text-white"
                            }`}
                          >
                            {item.label}
                          </p>
                          {item.completedAt ? (
                            <p className="text-xs text-text-3">
                              Done{" "}
                              {new Date(item.completedAt).toLocaleString()}
                            </p>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-text-2">
                          {item.description}
                        </p>
                        <div className="mt-3">
                          {item.id === "send_champion_welcome" ? (
                            <a
                              href="#champion-invite"
                              className="inline-flex rounded-lg border border-ink-5 px-3 py-1.5 text-xs font-medium text-white hover:bg-ink-2"
                            >
                              Preview invite below
                            </a>
                          ) : (
                            <Link
                              href={item.href}
                              className="inline-flex rounded-lg border border-ink-5 px-3 py-1.5 text-xs font-medium text-white hover:bg-ink-2"
                            >
                              Open
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <section
              id="champion-invite"
              className="rounded-[14px] border border-ink-4 bg-ink-1 p-6"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-white">
                  Champion welcome email
                </h2>
                {invite?.emailSentAt ? (
                  <p className="text-xs text-[#49cde1]">
                    Sent {new Date(invite.emailSentAt).toLocaleString()}
                  </p>
                ) : invite?.inviteQueuedAt ? (
                  <p className="text-xs text-amber-300">
                    Queued{" "}
                    {new Date(invite.inviteQueuedAt).toLocaleString()} — not
                    yet sent
                  </p>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-text-2">
                The champion has been added to the client portal automatically.
                Review the rendered email below and press send when you&apos;re
                ready — nothing has been sent yet.
              </p>

              {invite?.message ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-rose-100">
                    {invite.message}
                  </div>
                  {invite.champion === null || !invite.hasInviteToken ? (
                    <button
                      type="button"
                      onClick={() => void reprovisionChampion()}
                      disabled={sendingInvite}
                      className="rounded-xl border border-ink-5 px-4 py-2 text-sm text-white hover:bg-ink-2 disabled:opacity-60"
                    >
                      {sendingInvite ? "Re-provisioning…" : "Re-provision champion"}
                    </button>
                  ) : null}
                </div>
              ) : invite?.champion ? (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-2 rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-sm text-text-2">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span>To</span>
                      <span className="text-white">
                        {invite.champion.firstName}
                        {invite.champion.lastName
                          ? ` ${invite.champion.lastName}`
                          : ""}{" "}
                        &lt;{invite.champion.email}&gt;
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <span>Subject</span>
                      <span className="text-white">{invite.subject}</span>
                    </div>
                    {invite.accessUrl ? (
                      <div className="flex flex-wrap justify-between gap-2">
                        <span>Portal access link</span>
                        <span className="break-all text-text-3">
                          {invite.accessUrl}
                        </span>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap justify-between gap-2">
                      <span>Status</span>
                      <span className="text-white">
                        {invite.authStatus === "active"
                          ? "Active portal account"
                          : "Pending invite"}
                      </span>
                    </div>
                  </div>
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-sm text-text-2">
                    {invite.body}
                  </pre>
                  {inviteError ? (
                    <div className="rounded-xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-rose-100">
                      {inviteError}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void sendChampionInvite()}
                      disabled={sendingInvite}
                      className="rounded-xl bg-accent-solid px-4 py-2 text-sm font-semibold text-[#03162a] hover:opacity-90 disabled:opacity-60"
                    >
                      {sendingInvite
                        ? "Sending…"
                        : invite.emailSentAt
                          ? "Resend invite"
                          : "Send invite to champion"}
                    </button>
                    <span className="text-xs text-text-3">
                      Sending also ticks the checklist item.
                    </span>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
