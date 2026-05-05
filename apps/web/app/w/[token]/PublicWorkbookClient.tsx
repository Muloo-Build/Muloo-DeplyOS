"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Public Typeform-style workbook share page.
// The URL token is the only credential. The server resolves
// validity (enabled/expiry) and returns a sanitised workbook.
// Anyone with the link fills in name/email + answers and submits;
// the submission lands in the project for operator review.

interface PublicQuestion {
  id: string;
  questionText: string;
  helpText: string | null;
  answerType: string;
  options: string[];
  required: boolean;
}

interface PublicSection {
  id: string;
  title: string;
  description: string | null;
  questions: PublicQuestion[];
}

interface PublicWorkbookData {
  project: { id: string; name: string };
  workbook: {
    id: string;
    title: string;
    sections: PublicSection[];
  };
}

type ResponseValue = string | string[];

export default function PublicWorkbookClient({ token }: { token: string }) {
  const [data, setData] = useState<PublicWorkbookData | null>(null);
  const [error, setError] = useState<{
    message: string;
    kind: "expired" | "invalid" | "generic";
  } | null>(null);
  const [contact, setContact] = useState({
    firstName: "",
    lastName: "",
    email: "",
    organisation: ""
  });
  const [responses, setResponses] = useState<Record<string, ResponseValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/workbooks/public/${encodeURIComponent(token)}`,
        { credentials: "omit" }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.error) {
        const message = body.error ?? `Request failed (${res.status})`;
        let kind: "expired" | "invalid" | "generic" = "generic";
        if (message === "This share link has expired") kind = "expired";
        else if (
          message === "Invalid share link" ||
          message === "This share link is no longer active"
        ) {
          kind = "invalid";
        }
        setError({ message, kind });
        return;
      }
      setData(body as PublicWorkbookData);
      setError(null);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : "Failed to load",
        kind: "generic"
      });
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalRequired = useMemo(() => {
    if (!data) return 0;
    return data.workbook.sections.reduce(
      (n, s) => n + s.questions.filter((q) => q.required).length,
      0
    );
  }, [data]);

  const answeredRequired = useMemo(() => {
    if (!data) return 0;
    let n = 0;
    for (const s of data.workbook.sections) {
      for (const q of s.questions) {
        if (!q.required) continue;
        const v = responses[q.id];
        if (Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.trim().length > 0) {
          n += 1;
        }
      }
    }
    return n;
  }, [data, responses]);

  function setResponse(questionId: string, value: ResponseValue) {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  }

  function toggleMulti(questionId: string, option: string) {
    setResponses((prev) => {
      const current = Array.isArray(prev[questionId]) ? (prev[questionId] as string[]) : [];
      const next = current.includes(option)
        ? current.filter((v) => v !== option)
        : [...current, option];
      return { ...prev, [questionId]: next };
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!contact.firstName.trim() || !contact.lastName.trim()) {
      setSubmitError("Please enter your first and last name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) {
      setSubmitError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        firstName: contact.firstName.trim(),
        lastName: contact.lastName.trim(),
        email: contact.email.trim(),
        organisation: contact.organisation.trim() || null,
        responses: Object.entries(responses).map(([questionId, response]) => ({
          questionId,
          response
        }))
      };
      const res = await fetch(
        `/api/workbooks/public/${encodeURIComponent(token)}/submissions`,
        {
          method: "POST",
          credentials: "omit",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.error) {
        throw new Error(body.error ?? `Submit failed (${res.status})`);
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    const headline =
      error.kind === "expired"
        ? "This link has expired"
        : error.kind === "invalid"
          ? "We couldn't open this link"
          : "Something went wrong";
    const hint =
      error.kind === "expired"
        ? "Please ask the person who shared it for a fresh link."
        : error.kind === "invalid"
          ? "Double-check you copied the full link, or ask the sender to confirm it's still active."
          : error.message;
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary">
        <div className="mx-auto max-w-xl px-6 py-24 text-center">
          <h1 className="text-2xl font-semibold">{headline}</h1>
          <p className="mt-3 text-sm text-text-2">{hint}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary">
        <div className="mx-auto max-w-xl px-6 py-24 text-center text-sm text-text-2">
          Loading…
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary">
        <div className="mx-auto max-w-xl px-6 py-24 text-center">
          <h1 className="text-2xl font-semibold">Thanks, {contact.firstName}!</h1>
          <p className="mt-3 text-sm text-text-2">
            Your responses to <strong>{data.workbook.title}</strong> have been
            sent to the {data.project.name} team. They'll be in touch if they
            need anything else.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-wider text-text-2">
            {data.project.name}
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{data.workbook.title}</h1>
          {totalRequired > 0 ? (
            <p className="mt-3 text-xs text-text-2">
              {answeredRequired} of {totalRequired} required questions answered
            </p>
          ) : null}
        </div>

        <form onSubmit={submit} className="space-y-10">
          <section className="rounded-xl border border-ink-4 bg-bg-elevated p-6">
            <h2 className="text-base font-semibold">About you</h2>
            <p className="mt-1 text-xs text-text-2">
              We'll use these details so the team knows who responded.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-xs">
                <span className="text-text-2">First name *</span>
                <input
                  type="text"
                  required
                  value={contact.firstName}
                  onChange={(e) =>
                    setContact((c) => ({ ...c, firstName: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-ink-4 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-brand-teal/60 focus:outline-none"
                />
              </label>
              <label className="block text-xs">
                <span className="text-text-2">Last name *</span>
                <input
                  type="text"
                  required
                  value={contact.lastName}
                  onChange={(e) =>
                    setContact((c) => ({ ...c, lastName: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-ink-4 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-brand-teal/60 focus:outline-none"
                />
              </label>
              <label className="block text-xs sm:col-span-2">
                <span className="text-text-2">Email *</span>
                <input
                  type="email"
                  required
                  value={contact.email}
                  onChange={(e) =>
                    setContact((c) => ({ ...c, email: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-ink-4 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-brand-teal/60 focus:outline-none"
                />
              </label>
              <label className="block text-xs sm:col-span-2">
                <span className="text-text-2">Organisation</span>
                <input
                  type="text"
                  value={contact.organisation}
                  onChange={(e) =>
                    setContact((c) => ({ ...c, organisation: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-ink-4 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-brand-teal/60 focus:outline-none"
                />
              </label>
            </div>
          </section>

          {data.workbook.sections.map((section) => (
            <section
              key={section.id}
              className="rounded-xl border border-ink-4 bg-bg-elevated p-6"
            >
              <h2 className="text-base font-semibold">{section.title}</h2>
              {section.description ? (
                <p className="mt-1 text-xs text-text-2">
                  {section.description}
                </p>
              ) : null}
              <div className="mt-5 space-y-6">
                {section.questions.map((q) => (
                  <QuestionField
                    key={q.id}
                    question={q}
                    value={responses[q.id]}
                    onChange={(v) => setResponse(q.id, v)}
                    onToggleMulti={(opt) => toggleMulti(q.id, opt)}
                  />
                ))}
                {section.questions.length === 0 ? (
                  <p className="text-xs text-text-2">
                    No questions in this section yet.
                  </p>
                ) : null}
              </div>
            </section>
          ))}

          {submitError ? (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {submitError}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-brand-teal px-5 py-2 text-sm font-medium text-bg-primary transition disabled:cursor-not-allowed disabled:opacity-50 hover:opacity-90"
            >
              {submitting ? "Submitting…" : "Submit responses"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuestionField({
  question,
  value,
  onChange,
  onToggleMulti
}: {
  question: PublicQuestion;
  value: ResponseValue | undefined;
  onChange: (value: ResponseValue) => void;
  onToggleMulti: (option: string) => void;
}) {
  const label = (
    <div>
      <p className="text-sm">
        {question.questionText}
        {question.required ? (
          <span className="ml-1 text-rose-400">*</span>
        ) : null}
      </p>
      {question.helpText ? (
        <p className="mt-1 text-xs text-text-2">{question.helpText}</p>
      ) : null}
    </div>
  );

  const inputBase =
    "mt-2 w-full rounded-md border border-ink-4 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-brand-teal/60 focus:outline-none";

  if (question.answerType === "long_text") {
    return (
      <div>
        {label}
        <textarea
          rows={4}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputBase}
        />
      </div>
    );
  }

  if (question.answerType === "number") {
    return (
      <div>
        {label}
        <input
          type="number"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputBase}
        />
      </div>
    );
  }

  if (question.answerType === "single_select" && question.options.length > 0) {
    return (
      <div>
        {label}
        <div className="mt-2 space-y-2">
          {question.options.map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="radio"
                name={`q_${question.id}`}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="accent-brand-teal"
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (question.answerType === "multi_select" && question.options.length > 0) {
    const arr = Array.isArray(value) ? value : [];
    return (
      <div>
        {label}
        <div className="mt-2 space-y-2">
          {question.options.map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                checked={arr.includes(opt)}
                onChange={() => onToggleMulti(opt)}
                className="accent-brand-teal"
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {label}
      <input
        type="text"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className={inputBase}
      />
    </div>
  );
}
