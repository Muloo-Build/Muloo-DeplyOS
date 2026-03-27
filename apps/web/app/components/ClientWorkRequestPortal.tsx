"use client";

import { useEffect, useState } from "react";

import ClientShell from "./ClientShell";
import { type PortalExperience } from "./portalExperience";

interface ClientProjectOption {
  role: string;
  project: {
    id: string;
    name: string;
    client: {
      name: string;
    };
  };
}

interface ClientSessionUser {
  firstName: string;
  lastName: string;
  email: string;
}

interface WorkRequest {
  id: string;
  projectId: string | null;
  title: string;
  serviceFamily: string;
  requestType: string;
  companyName: string | null;
  contactName: string;
  contactEmail: string;
  summary: string;
  details: string | null;
  urgency: string | null;
  budgetRange: string | null;
  portalOrWebsite: string | null;
  links: string[];
  status: string;
  createdAt: string;
  project: {
    id: string;
    name: string;
  } | null;
}

const requestTypes = [
  { value: "quote_request", label: "Quote Request" },
  { value: "job_spec", label: "Job Spec" },
  { value: "project_brief", label: "Project Brief" },
  { value: "change_request", label: "Change Request" }
];
const serviceFamilies = [
  { value: "hubspot_architecture", label: "HubSpot Architecture" },
  { value: "custom_engineering", label: "Custom Engineering" },
  { value: "ai_automation", label: "AI Automation" }
];

export default function ClientWorkRequestPortal({
  portalExperience = "client"
}: {
  portalExperience?: PortalExperience;
}) {
  const [sessionUser, setSessionUser] = useState<ClientSessionUser | null>(
    null
  );
  const [projects, setProjects] = useState<ClientProjectOption[]>([]);
  const [requests, setRequests] = useState<WorkRequest[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    serviceFamily: "hubspot_architecture",
    requestType: "job_spec",
    projectId: "",
    companyName: "",
    summary: "",
    details: "",
    urgency: "",
    budgetRange: "",
    portalOrWebsite: "",
    linksText: ""
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [projectsResponse, sessionResponse, requestsResponse] =
          await Promise.all([
            fetch("/api/client/projects", { credentials: "include" }),
            fetch("/api/client-auth/session", { credentials: "include" }),
            fetch("/api/client/work-requests", { credentials: "include" })
          ]);

        if (
          !projectsResponse.ok ||
          !sessionResponse.ok ||
          !requestsResponse.ok
        ) {
          throw new Error("Failed to load work request workspace");
        }

        const [projectsBody, sessionBody, requestsBody] = await Promise.all([
          projectsResponse.json(),
          sessionResponse.json(),
          requestsResponse.json()
        ]);

        setProjects(projectsBody.projects ?? []);
        setSessionUser(sessionBody.user ?? null);
        setRequests(requestsBody.workRequests ?? []);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load work request workspace"
        );
      }
    }

    void loadData();
  }, []);

  async function submitRequest() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/client/work-requests", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: form.title,
          serviceFamily: form.serviceFamily,
          requestType: form.requestType,
          projectId: form.projectId || undefined,
          companyName: form.companyName,
          summary: form.summary,
          details: form.details,
          urgency: form.urgency,
          budgetRange: form.budgetRange,
          portalOrWebsite: form.portalOrWebsite,
          links: form.linksText
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean)
        })
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to submit request");
      }

      setRequests((current) => [body.workRequest, ...current]);
      setForm({
        title: "",
        serviceFamily: "hubspot_architecture",
        requestType: "job_spec",
        projectId: "",
        companyName: "",
        summary: "",
        details: "",
        urgency: "",
        budgetRange: "",
        portalOrWebsite: "",
        linksText: ""
      });
      setSuccess("Request submitted to Muloo.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit request"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ClientShell
      portalExperience={portalExperience}
      title="Request Work"
      subtitle="Submit a quote request, job spec, project brief, or change request for Muloo to review."
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
            Intake Form
          </p>
          <h3 className="mt-3 text-2xl font-bold font-heading text-white">
            Request new work
          </h3>
          <p className="mt-3 max-w-2xl text-sm text-text-secondary">
            Use this form when you need Muloo to quote, scope, or review a new
            piece of work. Support issues should still go through the support
            page so they land in the right workflow.
          </p>

          {error ? (
            <div className="mt-5 rounded-xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mt-5 rounded-xl border border-[rgba(45,212,160,0.35)] bg-[rgba(14,44,36,0.7)] px-4 py-3 text-sm text-white">
              {success}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="text-sm text-text-secondary">Request title</span>
              <input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value
                  }))
                }
                className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none"
              />
            </label>

            <label className="block">
              <span className="text-sm text-text-secondary">
                Service family
              </span>
              <select
                value={form.serviceFamily}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    serviceFamily: event.target.value
                  }))
                }
                className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none"
              >
                {serviceFamilies.map((family) => (
                  <option key={family.value} value={family.value}>
                    {family.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-text-secondary">Request type</span>
              <select
                value={form.requestType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    requestType: event.target.value
                  }))
                }
                className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none"
              >
                {requestTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-text-secondary">
                Related project
              </span>
              <select
                value={form.projectId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    projectId: event.target.value
                  }))
                }
                className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none"
              >
                <option value="">Not linked yet</option>
                {projects.map(({ project }) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-4 md:col-span-2">
              <p className="text-sm text-text-secondary">Submitting as</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {sessionUser
                  ? `${sessionUser.firstName} ${sessionUser.lastName}`
                  : "Signed-in client"}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {sessionUser?.email ?? "Loading..."}
              </p>
            </div>

            <label className="block">
              <span className="text-sm text-text-secondary">Company</span>
              <input
                value={form.companyName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    companyName: event.target.value
                  }))
                }
                className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none"
              />
            </label>

            <label className="block">
              <span className="text-sm text-text-secondary">Urgency</span>
              <input
                value={form.urgency}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    urgency: event.target.value
                  }))
                }
                placeholder="e.g. this week, this month, no rush"
                className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm text-text-secondary">
                Summary of the request
              </span>
              <textarea
                value={form.summary}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    summary: event.target.value
                  }))
                }
                className="mt-3 min-h-[120px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm text-text-secondary">
                Detail / specification
              </span>
              <textarea
                value={form.details}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    details: event.target.value
                  }))
                }
                className="mt-3 min-h-[150px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none"
              />
            </label>

            <label className="block">
              <span className="text-sm text-text-secondary">Budget range</span>
              <input
                value={form.budgetRange}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    budgetRange: event.target.value
                  }))
                }
                className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none"
              />
            </label>

            <label className="block">
              <span className="text-sm text-text-secondary">
                Portal or website
              </span>
              <input
                value={form.portalOrWebsite}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    portalOrWebsite: event.target.value
                  }))
                }
                className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm text-text-secondary">
                Links / references
              </span>
              <textarea
                value={form.linksText}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    linksText: event.target.value
                  }))
                }
                placeholder="One URL per line"
                className="mt-3 min-h-[120px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => void submitRequest()}
            disabled={saving}
            className="mt-6 rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Submitting..." : "Submit Request"}
          </button>
        </section>

        <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-text-muted">
            Submitted Requests
          </p>
          <h3 className="mt-3 text-2xl font-bold font-heading text-white">
            Intake history
          </h3>

          <div className="mt-6 space-y-4">
            {requests.length === 0 ? (
              <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4 text-sm text-text-secondary">
                No work requests submitted yet.
              </div>
            ) : (
              requests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        {serviceFamilies.find(
                          (family) => family.value === request.serviceFamily
                        )?.label ?? request.serviceFamily}
                      </p>
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        {request.requestType.replace(/_/g, " ")}
                      </p>
                      <h4 className="mt-2 text-lg font-semibold text-white">
                        {request.title}
                      </h4>
                    </div>
                    <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-xs font-medium text-text-secondary">
                      {request.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-text-secondary">
                    {request.summary}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs text-text-muted">
                    <span>
                      {new Date(request.createdAt).toLocaleString("en-ZA")}
                    </span>
                    {request.project ? (
                      <span>Project: {request.project.name}</span>
                    ) : null}
                    {request.urgency ? (
                      <span>Urgency: {request.urgency}</span>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </ClientShell>
  );
}
