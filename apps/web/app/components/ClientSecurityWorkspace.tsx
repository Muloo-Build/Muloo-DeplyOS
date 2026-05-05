"use client";

import { useEffect, useMemo, useState } from "react";

interface SecurityCheck {
  id: string;
  category: string;
  question: string;
  guidance: string;
  weight: "critical" | "high" | "medium" | "low";
}

type FindingValue = "pass" | "fail" | "na" | "unknown";

interface SecurityProfile {
  id: string;
  clientId: string;
  findings: Record<string, FindingValue>;
  notes: string | null;
  riskLevel: string | null;
  reviewedAt: string | null;
  nextReviewDue: string | null;
  counts: {
    pass: number;
    fail: number;
    na: number;
    unknown: number;
    total: number;
  };
}

const FINDING_OPTIONS: { value: FindingValue; label: string }[] = [
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
  { value: "na", label: "N/A" },
  { value: "unknown", label: "Unknown" }
];

function findingClass(value: FindingValue) {
  switch (value) {
    case "pass":
      return "bg-[rgba(73,255,143,0.12)] text-[#7af0a8] border-[rgba(73,255,143,0.3)]";
    case "fail":
      return "bg-[rgba(224,80,96,0.18)] text-[#ff9aa6] border-[rgba(224,80,96,0.4)]";
    case "na":
      return "bg-[rgba(255,255,255,0.06)] text-text-muted border-[rgba(255,255,255,0.12)]";
    default:
      return "bg-[rgba(255,200,80,0.14)] text-[#ffd28a] border-[rgba(255,200,80,0.35)]";
  }
}

function riskBadgeClass(risk: string | null) {
  switch (risk) {
    case "critical":
      return "bg-[rgba(224,80,96,0.18)] text-[#ff9aa6]";
    case "high":
      return "bg-[rgba(255,140,80,0.18)] text-[#ffb98a]";
    case "medium":
      return "bg-[rgba(255,200,80,0.14)] text-[#ffd28a]";
    case "low":
      return "bg-[rgba(73,255,143,0.12)] text-[#7af0a8]";
    case "unknown":
    default:
      return "bg-[rgba(255,255,255,0.06)] text-text-muted";
  }
}

export default function ClientSecurityWorkspace({
  clientId
}: {
  clientId: string;
}) {
  const [profile, setProfile] = useState<SecurityProfile | null>(null);
  const [checklist, setChecklist] = useState<SecurityCheck[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [draftFindings, setDraftFindings] = useState<
    Record<string, FindingValue>
  >({});
  const [dirtyChecks, setDirtyChecks] = useState<Set<string>>(new Set());

  async function loadProfile() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/security-profile`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Failed");
      setProfile(body.profile);
      setChecklist(body.checklist ?? []);
      setCategories(body.categories ?? []);
      setDraftFindings(body.profile?.findings ?? {});
      setNotes(body.profile?.notes ?? "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();
  }, [clientId]);

  function setFinding(checkId: string, value: FindingValue) {
    setDraftFindings((current) => ({ ...current, [checkId]: value }));
    setDirtyChecks((current) => {
      const next = new Set(current);
      next.add(checkId);
      return next;
    });
    setFeedback(null);
  }

  function isNotesDirty(): boolean {
    return notes !== (profile?.notes ?? "");
  }

  async function saveAll(opts: { markReviewed?: boolean } = {}) {
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const findingsPatch: Record<string, FindingValue> = {};
      for (const checkId of dirtyChecks) {
        findingsPatch[checkId] = draftFindings[checkId] ?? "unknown";
      }
      const res = await fetch(`/api/clients/${clientId}/security-profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findings:
            Object.keys(findingsPatch).length > 0 ? findingsPatch : undefined,
          notes,
          markReviewedNow: opts.markReviewed ?? false
        })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Save failed");
      setProfile(body.profile);
      setDraftFindings(body.profile?.findings ?? {});
      setNotes(body.profile?.notes ?? "");
      setDirtyChecks(new Set());
      setFeedback(
        opts.markReviewed
          ? "Saved + marked as reviewed."
          : `Saved ${dirtyChecks.size + (isNotesDirty() ? 1 : 0)} change(s).`
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const dirtyCount = useMemo(
    () => dirtyChecks.size + (isNotesDirty() ? 1 : 0),
    [dirtyChecks, notes, profile]
  );

  if (loading) {
    return (
      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 text-text-secondary">
        Loading security profile...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Sticky save bar */}
      <div className="sticky top-0 z-10 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126]/95 px-5 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${riskBadgeClass(profile?.riskLevel ?? null)}`}
            >
              Risk: {profile?.riskLevel ?? "unknown"}
            </span>
            <span className="text-xs text-text-muted">
              Pass {profile?.counts.pass ?? 0} · Fail{" "}
              {profile?.counts.fail ?? 0} · N/A{" "}
              {profile?.counts.na ?? 0} · Unknown{" "}
              {profile?.counts.unknown ?? 0} of {profile?.counts.total ?? 0}
            </span>
            {profile?.reviewedAt ? (
              <span className="text-xs text-text-muted">
                Last reviewed {new Date(profile.reviewedAt).toLocaleDateString()}
              </span>
            ) : (
              <span className="text-xs text-[#ffd28a]">Never reviewed</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void saveAll({ markReviewed: false })}
              disabled={saving || dirtyCount === 0}
              className="rounded-xl border border-[rgba(255,255,255,0.18)] px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : dirtyCount === 0
                  ? "All saved"
                  : `Save ${dirtyCount} change${dirtyCount === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              onClick={() => void saveAll({ markReviewed: true })}
              disabled={saving}
              className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save + mark reviewed
            </button>
          </div>
        </div>
      </div>

      {feedback ? (
        <div className="rounded-xl border border-[rgba(73,255,143,0.3)] bg-[rgba(20,46,32,0.5)] px-4 py-3 text-sm text-[#9ef0bd]">
          {feedback}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
          {error}
        </div>
      ) : null}

      {categories.map((category) => {
        const checks = checklist.filter((c) => c.category === category);
        return (
          <section
            key={category}
            className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6"
          >
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-muted">
              {category}
            </h3>
            <div className="mt-4 space-y-3">
              {checks.map((check) => {
                const value = draftFindings[check.id] ?? "unknown";
                const isDirty = dirtyChecks.has(check.id);
                return (
                  <div
                    key={check.id}
                    className={`rounded-xl border bg-[#0b1126] p-4 ${
                      isDirty
                        ? "border-[rgba(255,200,80,0.45)]"
                        : "border-[rgba(255,255,255,0.05)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-[260px]">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white">
                            {check.question}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                              check.weight === "critical"
                                ? "bg-[rgba(224,80,96,0.18)] text-[#ff9aa6]"
                                : check.weight === "high"
                                  ? "bg-[rgba(255,140,80,0.18)] text-[#ffb98a]"
                                  : check.weight === "medium"
                                    ? "bg-[rgba(255,200,80,0.14)] text-[#ffd28a]"
                                    : "bg-[rgba(255,255,255,0.06)] text-text-muted"
                            }`}
                          >
                            {check.weight}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-text-secondary">
                          {check.guidance}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {FINDING_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setFinding(check.id, opt.value)}
                            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                              value === opt.value
                                ? findingClass(opt.value)
                                : "border-[rgba(255,255,255,0.07)] text-text-muted"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-muted">
          Reviewer notes
        </h3>
        <textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setFeedback(null);
          }}
          rows={5}
          placeholder="Context for failed checks, follow-up actions, scope, exceptions, etc."
          className="mt-4 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
        />
      </section>
    </div>
  );
}
