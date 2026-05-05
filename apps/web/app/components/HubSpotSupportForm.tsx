"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";

interface ClientProject {
  role: string;
  project: {
    id: string;
    name: string;
    status: string;
    client: {
      name: string;
    };
  };
}

type SupportDraft = {
  subject: string;
  projectId: string;
  urgency: string;
  description: string;
};

type SupportErrors = Partial<Record<keyof SupportDraft | "submit", string>>;

const urgencyOptions = ["Low", "Medium", "High", "Urgent"];

const initialDraft: SupportDraft = {
  subject: "",
  projectId: "",
  urgency: "Medium",
  description: ""
};

function validateDraft(draft: SupportDraft) {
  const errors: SupportErrors = {};

  if (!draft.subject.trim()) {
    errors.subject = "Subject is required";
  }

  if (!urgencyOptions.includes(draft.urgency)) {
    errors.urgency = "Choose an urgency";
  }

  if (!draft.description.trim()) {
    errors.description = "Description is required";
  } else if (draft.description.trim().length < 10) {
    errors.description = "Description must be at least 10 characters";
  }

  return errors;
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-[#ff8f9f]">
      *
    </span>
  );
}

export default function HubSpotSupportForm() {
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [draft, setDraft] = useState<SupportDraft>(initialDraft);
  const [errors, setErrors] = useState<SupportErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadProjects() {
      try {
        const response = await fetch("/api/client/projects", {
          credentials: "include"
        });

        if (!response.ok) {
          throw new Error("Failed to load projects");
        }

        const body = await response.json();
        setProjects(body.projects ?? []);
      } catch {
        setProjects([]);
      } finally {
        setProjectsLoading(false);
      }
    }

    void loadProjects();
  }, []);

  function updateField(field: keyof SupportDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({
      ...current,
      [field]: undefined,
      submit: undefined
    }));
    setSuccess(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateDraft(draft);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});
    setSuccess(false);

    try {
      const response = await fetch("/api/client/support/tickets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: draft.subject.trim(),
          projectId: draft.projectId || undefined,
          urgency: draft.urgency,
          description: draft.description.trim()
        })
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to create support ticket");
      }

      setDraft(initialDraft);
      setSuccess(true);
    } catch (error) {
      setErrors({
        submit:
          error instanceof Error
            ? error.message
            : "Failed to create support ticket"
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => void handleSubmit(event)}
      className="rounded-lg border border-ink-4 bg-ink-2 p-6"
    >
      {success ? (
        <div className="mb-5 rounded-lg border border-[rgba(81,208,176,0.3)] bg-[rgba(81,208,176,0.1)] px-4 py-3 text-sm text-white">
          Ticket received. We&apos;ll reply in your inbox.
        </div>
      ) : null}

      {errors.submit ? (
        <div className="mb-5 rounded-lg border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
          {errors.submit}
        </div>
      ) : null}

      <div className="grid gap-5">
        <label className="block">
          <span
            aria-required="true"
            className="mb-2 flex items-center gap-1 text-sm text-text-2"
          >
            Subject <RequiredMark />
          </span>
          <input
            required
            value={draft.subject}
            onChange={(event) => updateField("subject", event.target.value)}
            aria-invalid={Boolean(errors.subject)}
            aria-describedby={
              errors.subject ? "support-subject-error" : undefined
            }
            className={`w-full rounded-lg border bg-ink-1 px-4 py-3 text-white outline-none focus:border-accent-solid ${
              errors.subject
                ? "border-[rgba(224,80,96,0.6)]"
                : "border-ink-4"
            }`}
          />
          {errors.subject ? (
            <p
              id="support-subject-error"
              className="mt-2 text-sm text-[#ff8f9f]"
            >
              {errors.subject}
            </p>
          ) : null}
        </label>

        <label className="block">
          <span className="mb-2 block text-sm text-text-2">
            Related project
          </span>
          <select
            value={draft.projectId}
            onChange={(event) => updateField("projectId", event.target.value)}
            disabled={projectsLoading}
            className="w-full rounded-lg border border-ink-4 bg-ink-1 px-4 py-3 text-white outline-none focus:border-accent-solid disabled:opacity-60"
          >
            <option value="">
              {projectsLoading ? "Loading projects..." : "No related project"}
            </option>
            {projects.map(({ project }) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span
            aria-required="true"
            className="mb-2 flex items-center gap-1 text-sm text-text-2"
          >
            Urgency <RequiredMark />
          </span>
          <select
            required
            value={draft.urgency}
            onChange={(event) => updateField("urgency", event.target.value)}
            aria-invalid={Boolean(errors.urgency)}
            aria-describedby={
              errors.urgency ? "support-urgency-error" : undefined
            }
            className={`w-full rounded-lg border bg-ink-1 px-4 py-3 text-white outline-none focus:border-accent-solid ${
              errors.urgency
                ? "border-[rgba(224,80,96,0.6)]"
                : "border-ink-4"
            }`}
          >
            {urgencyOptions.map((urgency) => (
              <option key={urgency} value={urgency}>
                {urgency}
              </option>
            ))}
          </select>
          {errors.urgency ? (
            <p
              id="support-urgency-error"
              className="mt-2 text-sm text-[#ff8f9f]"
            >
              {errors.urgency}
            </p>
          ) : null}
        </label>

        <label className="block">
          <span
            aria-required="true"
            className="mb-2 flex items-center gap-1 text-sm text-text-2"
          >
            Description <RequiredMark />
          </span>
          <textarea
            required
            minLength={10}
            value={draft.description}
            onChange={(event) => updateField("description", event.target.value)}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={
              errors.description ? "support-description-error" : undefined
            }
            className={`min-h-[160px] w-full rounded-lg border bg-ink-1 px-4 py-3 text-white outline-none focus:border-accent-solid ${
              errors.description
                ? "border-[rgba(224,80,96,0.6)]"
                : "border-ink-4"
            }`}
          />
          {errors.description ? (
            <p
              id="support-description-error"
              className="mt-2 text-sm text-[#ff8f9f]"
            >
              {errors.description}
            </p>
          ) : null}
        </label>

        <div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-accent-solid px-5 py-3 text-sm font-semibold text-[#03111f] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </form>
  );
}
