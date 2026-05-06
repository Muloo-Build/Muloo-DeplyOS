"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

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

interface FlatQuestion {
  question: PublicQuestion;
  sectionId: string;
  sectionTitle: string;
  sectionDescription: string | null;
}

type Step =
  | { kind: "intro"; sectionId: string; sectionTitle: string; description: string | null }
  | { kind: "question"; q: FlatQuestion }
  | { kind: "contact" }
  | { kind: "review" }
  | { kind: "thanks" };

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
  const [stepIdx, setStepIdx] = useState(0);

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

  // Build the page-by-page flow:
  // contact → (section intro → each question one per page) per section → review
  const steps: Step[] = useMemo(() => {
    if (!data) return [];
    const out: Step[] = [{ kind: "contact" }];
    for (const section of data.workbook.sections) {
      if (section.questions.length === 0) continue;
      out.push({
        kind: "intro",
        sectionId: section.id,
        sectionTitle: section.title,
        description: section.description
      });
      for (const q of section.questions) {
        out.push({
          kind: "question",
          q: {
            question: q,
            sectionId: section.id,
            sectionTitle: section.title,
            sectionDescription: section.description
          }
        });
      }
    }
    out.push({ kind: "review" });
    return out;
  }, [data]);

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
        if (
          Array.isArray(v)
            ? v.length > 0
            : typeof v === "string" && v.trim().length > 0
        ) {
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
      const current = Array.isArray(prev[questionId])
        ? (prev[questionId] as string[])
        : [];
      const next = current.includes(option)
        ? current.filter((v) => v !== option)
        : [...current, option];
      return { ...prev, [questionId]: next };
    });
  }

  const currentStep: Step | undefined = steps[stepIdx];
  const total = steps.length;

  const canAdvance = (() => {
    if (!currentStep) return false;
    if (currentStep.kind === "contact") {
      return (
        contact.firstName.trim().length > 0 &&
        contact.lastName.trim().length > 0 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())
      );
    }
    if (currentStep.kind === "question" && currentStep.q.question.required) {
      const v = responses[currentStep.q.question.id];
      return Array.isArray(v)
        ? v.length > 0
        : typeof v === "string" && v.trim().length > 0;
    }
    return true;
  })();

  function next() {
    if (stepIdx < total - 1) setStepIdx(stepIdx + 1);
  }
  function back() {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
  }

  // Keyboard nav: Enter advances on simple inputs (when canAdvance); Shift+Tab handled natively
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA") return;
      if (e.key === "Enter" && canAdvance) {
        e.preventDefault();
        next();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, canAdvance, total]);

  async function submit() {
    setSubmitError(null);
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
      setStepIdx(total); // sentinel past last to render thanks
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
      <div className="min-h-screen bg-ink-0 text-text-1">
        <div className="mx-auto max-w-xl px-6 py-24 text-center">
          <h1 className="text-2xl font-semibold">{headline}</h1>
          <p className="mt-3 text-sm text-text-3">{hint}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-ink-0 text-text-1">
        <div className="mx-auto max-w-xl px-6 py-24 text-center text-sm text-text-3">
          Loading…
        </div>
      </div>
    );
  }

  if (stepIdx >= total) {
    return (
      <div className="min-h-screen bg-ink-0 text-text-1">
        <div className="mx-auto max-w-xl px-6 py-24 text-center">
          <div className="inline-flex w-14 h-14 rounded-full bg-[rgba(74,219,192,0.12)] items-center justify-center mb-5">
            <Check size={28} className="text-status-ok" />
          </div>
          <h1 className="text-[26px] font-semibold -tracking-[0.02em]">
            Thanks, {contact.firstName}!
          </h1>
          <p className="mt-3 text-[14px] text-text-2">
            Your responses to <strong className="text-text-1">{data.workbook.title}</strong>{" "}
            are with the {data.project.name} team. They'll come back if they need anything else.
          </p>
        </div>
      </div>
    );
  }

  const progressPct = Math.round(((stepIdx + 1) / total) * 100);

  return (
    <div className="min-h-screen bg-ink-0 text-text-1 flex flex-col">
      {/* Top bar with progress */}
      <div className="sticky top-0 z-10 border-b border-ink-4 bg-ink-0/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-6 py-3 flex items-center gap-4">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold">
              {data.project.name}
            </span>
            <span className="text-[13px] font-medium truncate">
              {data.workbook.title}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="font-mono text-[11px] text-text-3">
              {stepIdx + 1} / {total}
            </span>
            <div className="w-32 h-1.5 bg-ink-3 rounded">
              <div
                className="h-full bg-status-ok rounded transition-[width] duration-200"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Step body */}
      <div className="flex-1 mx-auto max-w-2xl w-full px-6 py-12 flex flex-col">
        {currentStep?.kind === "contact" && (
          <ContactStep
            contact={contact}
            setContact={setContact}
            workbookTitle={data.workbook.title}
            projectName={data.project.name}
          />
        )}

        {currentStep?.kind === "intro" && (
          <IntroStep
            title={currentStep.sectionTitle}
            description={currentStep.description}
          />
        )}

        {currentStep?.kind === "question" && (
          <QuestionStep
            q={currentStep.q}
            value={responses[currentStep.q.question.id]}
            onChange={(v) => setResponse(currentStep.q.question.id, v)}
            onToggleMulti={(opt) =>
              toggleMulti(currentStep.q.question.id, opt)
            }
          />
        )}

        {currentStep?.kind === "review" && (
          <ReviewStep
            data={data}
            responses={responses}
            contact={contact}
            answeredRequired={answeredRequired}
            totalRequired={totalRequired}
          />
        )}

        {submitError && (
          <div className="mt-4 rounded-[10px] border border-[rgba(255,107,122,0.4)] bg-[rgba(255,107,122,0.08)] p-3 text-[12.5px] text-status-danger">
            {submitError}
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="sticky bottom-0 border-t border-ink-4 bg-ink-0/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-6 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={back}
            disabled={stepIdx === 0 || submitting}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[13px] text-text-2 border border-ink-4 hover:border-ink-5 hover:bg-ink-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={13} />
            Back
          </button>
          <span className="ml-auto text-[11.5px] text-text-3 hidden sm:block">
            Press Enter to continue
          </span>
          {currentStep?.kind === "review" ? (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || answeredRequired < totalRequired}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-[13px] font-semibold bg-status-ok text-[#042822] hover:bg-[#5fe7cd] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={13} />
              {submitting ? "Submitting…" : "Submit responses"}
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              disabled={!canAdvance}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-[13px] font-semibold bg-status-ok text-[#042822] hover:bg-[#5fe7cd] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ContactStep({
  contact,
  setContact,
  workbookTitle,
  projectName
}: {
  contact: { firstName: string; lastName: string; email: string; organisation: string };
  setContact: React.Dispatch<
    React.SetStateAction<{
      firstName: string;
      lastName: string;
      email: string;
      organisation: string;
    }>
  >;
  workbookTitle: string;
  projectName: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold mb-2">
        Hi 👋
      </p>
      <h2 className="text-[28px] font-semibold -tracking-[0.02em] leading-[1.2]">
        Before we start, who are you?
      </h2>
      <p className="mt-3 text-[14px] text-text-2 leading-[1.6]">
        You're filling in <strong className="text-text-1">{workbookTitle}</strong>{" "}
        for the {projectName} team. Quick contact details so they know who
        responded — then we'll go question by question.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Field
          label="First name"
          required
          value={contact.firstName}
          onChange={(v) => setContact((c) => ({ ...c, firstName: v }))}
          autoFocus
        />
        <Field
          label="Last name"
          required
          value={contact.lastName}
          onChange={(v) => setContact((c) => ({ ...c, lastName: v }))}
        />
        <Field
          label="Email"
          type="email"
          required
          value={contact.email}
          onChange={(v) => setContact((c) => ({ ...c, email: v }))}
          className="sm:col-span-2"
        />
        <Field
          label="Organisation"
          value={contact.organisation}
          onChange={(v) => setContact((c) => ({ ...c, organisation: v }))}
          className="sm:col-span-2"
        />
      </div>
    </div>
  );
}

function IntroStep({
  title,
  description
}: {
  title: string;
  description: string | null;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold mb-2">
        Section
      </p>
      <h2 className="text-[28px] font-semibold -tracking-[0.02em] leading-[1.2]">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-[14px] text-text-2 leading-[1.7] max-w-[560px]">
          {description}
        </p>
      )}
      <p className="mt-8 text-[12.5px] text-text-3">
        We'll go through this section one question at a time. Press{" "}
        <kbd className="font-mono text-[10.5px] bg-ink-3 border border-ink-4 rounded px-1.5 py-0.5 text-text-2">
          Enter
        </kbd>{" "}
        or click Next to continue.
      </p>
    </div>
  );
}

function QuestionStep({
  q,
  value,
  onChange,
  onToggleMulti
}: {
  q: FlatQuestion;
  value: ResponseValue | undefined;
  onChange: (v: ResponseValue) => void;
  onToggleMulti: (opt: string) => void;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold mb-2">
        {q.sectionTitle}
      </p>
      <h2 className="text-[24px] font-semibold -tracking-[0.02em] leading-[1.3]">
        {q.question.questionText}
        {q.question.required && (
          <span className="ml-2 text-status-danger text-[18px]">*</span>
        )}
      </h2>
      {q.question.helpText && (
        <p className="mt-3 text-[13.5px] text-text-3 leading-[1.6] max-w-[560px]">
          {q.question.helpText}
        </p>
      )}
      <div className="mt-8">
        <AnswerInput
          question={q.question}
          value={value}
          onChange={onChange}
          onToggleMulti={onToggleMulti}
        />
      </div>
    </div>
  );
}

function AnswerInput({
  question,
  value,
  onChange,
  onToggleMulti
}: {
  question: PublicQuestion;
  value: ResponseValue | undefined;
  onChange: (v: ResponseValue) => void;
  onToggleMulti: (opt: string) => void;
}) {
  const inputBase =
    "w-full bg-ink-2 border border-ink-4 rounded-[10px] px-4 py-3 text-[15px] text-text-1 outline-none transition-colors focus:border-[rgba(74,219,192,0.5)] placeholder:text-text-4";

  if (question.answerType === "long_text") {
    return (
      <textarea
        autoFocus
        rows={6}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Take as much space as you need…"
        className={`${inputBase} min-h-[160px] resize-y`}
      />
    );
  }

  if (question.answerType === "number") {
    return (
      <input
        autoFocus
        type="number"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className={inputBase}
      />
    );
  }

  if (question.answerType === "single_select" && question.options.length > 0) {
    return (
      <div className="space-y-2">
        {question.options.map((opt, i) => {
          const selected = value === opt;
          const key = String.fromCharCode(65 + i);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`w-full text-left px-4 py-3 rounded-[10px] border transition-colors flex items-center gap-3 ${
                selected
                  ? "border-status-ok bg-[rgba(74,219,192,0.08)]"
                  : "border-ink-4 bg-ink-2 hover:border-ink-5"
              }`}
            >
              <span
                className={`inline-flex w-7 h-7 rounded-md items-center justify-center font-mono text-[12px] font-semibold ${
                  selected
                    ? "bg-status-ok text-[#042822]"
                    : "bg-ink-3 text-text-3 border border-ink-4"
                }`}
              >
                {key}
              </span>
              <span className="text-[14px]">{opt}</span>
              {selected && (
                <Check size={14} className="ml-auto text-status-ok" />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  if (question.answerType === "multi_select" && question.options.length > 0) {
    const arr = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2">
        <p className="text-[11px] text-text-3 mb-1">Pick all that apply</p>
        {question.options.map((opt, i) => {
          const selected = arr.includes(opt);
          const key = String.fromCharCode(65 + i);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggleMulti(opt)}
              className={`w-full text-left px-4 py-3 rounded-[10px] border transition-colors flex items-center gap-3 ${
                selected
                  ? "border-status-ok bg-[rgba(74,219,192,0.08)]"
                  : "border-ink-4 bg-ink-2 hover:border-ink-5"
              }`}
            >
              <span
                className={`inline-flex w-7 h-7 rounded-md items-center justify-center font-mono text-[12px] font-semibold ${
                  selected
                    ? "bg-status-ok text-[#042822]"
                    : "bg-ink-3 text-text-3 border border-ink-4"
                }`}
              >
                {key}
              </span>
              <span className="text-[14px]">{opt}</span>
              {selected && (
                <Check size={14} className="ml-auto text-status-ok" />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <input
      autoFocus
      type="text"
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Type your answer…"
      className={inputBase}
    />
  );
}

function ReviewStep({
  data,
  responses,
  contact,
  answeredRequired,
  totalRequired
}: {
  data: PublicWorkbookData;
  responses: Record<string, ResponseValue>;
  contact: { firstName: string; lastName: string; email: string; organisation: string };
  answeredRequired: number;
  totalRequired: number;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold mb-2">
        Almost there
      </p>
      <h2 className="text-[28px] font-semibold -tracking-[0.02em] leading-[1.2]">
        Review your answers
      </h2>
      <p className="mt-3 text-[14px] text-text-2 leading-[1.6]">
        {answeredRequired} of {totalRequired} required questions answered. You
        can still go back and edit. When you submit, the {data.project.name}{" "}
        team gets notified.
      </p>

      <div className="mt-6 rounded-[14px] border border-ink-4 bg-ink-1 p-5">
        <p className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold mb-2">
          You
        </p>
        <p className="text-[14px] font-medium">
          {contact.firstName} {contact.lastName}
        </p>
        <p className="text-[12.5px] text-text-3 font-mono">{contact.email}</p>
        {contact.organisation && (
          <p className="text-[12.5px] text-text-3">{contact.organisation}</p>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {data.workbook.sections.map((section) => {
          const sectionAnswered = section.questions.filter((q) => {
            const v = responses[q.id];
            return Array.isArray(v)
              ? v.length > 0
              : typeof v === "string" && v.trim().length > 0;
          });
          if (sectionAnswered.length === 0) return null;
          return (
            <div
              key={section.id}
              className="rounded-[14px] border border-ink-4 bg-ink-1 p-5"
            >
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold mb-3">
                {section.title}
              </p>
              <div className="space-y-3">
                {sectionAnswered.map((q) => {
                  const v = responses[q.id];
                  const display = Array.isArray(v) ? v.join(", ") : v;
                  return (
                    <div key={q.id}>
                      <p className="text-[12.5px] text-text-3 m-0">
                        {q.questionText}
                      </p>
                      <p className="text-[13.5px] text-text-1 m-0 mt-0.5 whitespace-pre-wrap">
                        {display}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  autoFocus = false,
  className = ""
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold">
        {label}
        {required && <span className="ml-1 text-status-danger">*</span>}
      </span>
      <input
        type={type}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2.5 text-[14px] text-text-1 outline-none transition-colors focus:border-[rgba(74,219,192,0.5)]"
      />
    </label>
  );
}
