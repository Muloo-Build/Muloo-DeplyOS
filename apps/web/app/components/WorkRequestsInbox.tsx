"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  details?: string | null;
  portalOrWebsite?: string | null;
  urgency: string | null;
  status: string;
  createdAt: string;
  project: {
    id: string;
    name: string;
  } | null;
}

const serviceFamilies = [
  { value: "hubspot_architecture", label: "HubSpot Architecture" },
  { value: "custom_engineering", label: "Custom Engineering" },
  { value: "ai_automation", label: "AI Automation" }
];
const generalStatuses = ["new", "triaging", "quoted", "converted", "closed"];
const changeRequestStatuses = [
  "new",
  "under_review",
  "priced",
  "approved",
  "rejected",
  "appended_to_delivery",
  "closed"
];

export default function WorkRequestsInbox() {
  const router = useRouter();
  const [requests, setRequests] = useState<WorkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadRequests() {
      try {
        const response = await fetch("/api/work-requests");
        if (!response.ok) {
          throw new Error("Failed to load work requests");
        }

        const body = await response.json();
        setRequests(body.workRequests ?? []);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load work requests"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadRequests();
  }, []);

  async function updateStatus(id: string, status: string) {
    setSavingId(id);
    setError(null);

    try {
      const response = await fetch(
        `/api/work-requests/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ status })
        }
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to update request");
      }

      setRequests((current) =>
        current.map((request) =>
          request.id === id ? body.workRequest : request
        )
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update request"
      );
    } finally {
      setSavingId(null);
    }
  }

  async function convertToProject(id: string) {
    setSavingId(id);
    setError(null);

    try {
      const response = await fetch(
        `/api/work-requests/${encodeURIComponent(id)}/convert`,
        {
          method: "POST"
        }
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to convert request");
      }

      setRequests((current) =>
        current.map((request) =>
          request.id === id ? body.workRequest : request
        )
      );

      router.push(`/projects/${body.project.id}`);
    } catch (convertError) {
      setError(
        convertError instanceof Error
          ? convertError.message
          : "Failed to convert request"
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4 text-sm text-text-secondary">
          Loading work requests...
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4 text-sm text-text-secondary">
          No work requests yet.
        </div>
      ) : (
        requests.map((request) => (
          <div
            key={request.id}
            className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                  {serviceFamilies.find(
                    (family) => family.value === request.serviceFamily
                  )?.label ?? request.serviceFamily}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-text-muted">
                  {request.requestType.replace(/_/g, " ")}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-white">
                  {request.title}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {request.requestType !== "change_request" ? (
                  <Link
                    href={`/projects/new?title=${encodeURIComponent(
                      request.title
                    )}&clientName=${encodeURIComponent(
                      request.companyName ?? request.project?.name ?? ""
                    )}&contactName=${encodeURIComponent(
                      request.contactName
                    )}&contactEmail=${encodeURIComponent(
                      request.contactEmail
                    )}&portalOrWebsite=${encodeURIComponent(
                      request.portalOrWebsite ?? ""
                    )}&summary=${encodeURIComponent(
                      request.summary
                    )}&details=${encodeURIComponent(
                      request.details ?? ""
                    )}&serviceFamily=${encodeURIComponent(
                      request.serviceFamily
                    )}&requestType=${encodeURIComponent(request.requestType)}`}
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm font-medium text-white"
                  >
                    Prefill project
                  </Link>
                ) : null}
                {request.requestType === "change_request" && request.project ? (
                  <Link
                    href={`/projects/${request.project.id}/changes`}
                    className="rounded-xl border border-[rgba(123,226,239,0.25)] bg-background-card px-3 py-2 text-sm font-medium text-[#7be2ef]"
                  >
                    Open change mgmt
                  </Link>
                ) : null}
                {request.requestType !== "change_request" ? (
                  <button
                    type="button"
                    onClick={() => void convertToProject(request.id)}
                    disabled={savingId === request.id}
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm font-medium text-white"
                  >
                    {savingId === request.id ? "Converting..." : "Convert now"}
                  </button>
                ) : null}
                <select
                  value={request.status}
                  onChange={(event) =>
                    void updateStatus(request.id, event.target.value)
                  }
                  disabled={savingId === request.id}
                  className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
                >
                  {(request.requestType === "change_request"
                    ? changeRequestStatuses
                    : generalStatuses
                  ).map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="mt-3 text-sm text-text-secondary">
              {request.summary}
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-text-muted">
              <span>{request.contactName}</span>
              <span>{request.contactEmail}</span>
              {request.companyName ? <span>{request.companyName}</span> : null}
              {request.project ? (
                <span>Project: {request.project.name}</span>
              ) : null}
              {request.urgency ? <span>Urgency: {request.urgency}</span> : null}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
