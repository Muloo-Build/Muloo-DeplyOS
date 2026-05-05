"use client";

import { useEffect, useMemo, useState } from "react";

interface Agreement {
  id: string;
  clientId: string;
  type: string;
  title: string;
  status: string;
  documentUrl: string | null;
  documentBody: string | null;
  effectiveDate: string | null;
  expiresAt: string | null;
  notes: string | null;
  sentAt: string | null;
  signedAt: string | null;
  signerName: string | null;
  signerEmail: string | null;
  signerTitle: string | null;
  signerIp: string | null;
  acceptanceText: string | null;
  withdrawnAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const AGREEMENT_TYPES = [
  { value: "nda", label: "NDA" },
  { value: "msa", label: "Master Services Agreement" },
  { value: "dpa", label: "Data Processing Agreement" },
  { value: "quote_signed", label: "Signed Quote (snapshot)" },
  { value: "other", label: "Other" }
];

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "signed":
      return "bg-[rgba(73,255,143,0.12)] text-[#7af0a8]";
    case "sent":
      return "bg-[rgba(73,205,225,0.12)] text-[#9be4f0]";
    case "withdrawn":
    case "expired":
      return "bg-[rgba(224,80,96,0.18)] text-[#ff9aa6]";
    case "draft":
    default:
      return "bg-[rgba(255,255,255,0.06)] text-text-muted";
  }
}

export default function ClientGovernanceWorkspace({
  clientId
}: {
  clientId: string;
}) {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // New agreement form state
  const [showNew, setShowNew] = useState(false);
  const [newType, setNewType] = useState("nda");
  const [newTitle, setNewTitle] = useState("");
  const [newDocumentUrl, setNewDocumentUrl] = useState("");
  const [newDocumentBody, setNewDocumentBody] = useState("");
  const [newEffectiveDate, setNewEffectiveDate] = useState("");
  const [newExpiresAt, setNewExpiresAt] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadAgreements() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/agreements`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Failed");
      setAgreements(body.agreements ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAgreements();
  }, [clientId]);

  async function createAgreement() {
    if (!newTitle.trim()) {
      setError("Title is required");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/agreements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newType,
          title: newTitle.trim(),
          documentUrl: newDocumentUrl.trim() || null,
          documentBody: newDocumentBody.trim() || null,
          effectiveDate: newEffectiveDate || null,
          expiresAt: newExpiresAt || null,
          notes: newNotes.trim() || null
        })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Create failed");
      setAgreements((current) => [body.agreement, ...current]);
      setShowNew(false);
      setNewTitle("");
      setNewDocumentUrl("");
      setNewDocumentBody("");
      setNewEffectiveDate("");
      setNewExpiresAt("");
      setNewNotes("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function actOnAgreement(
    id: string,
    action: "send" | "withdraw" | "delete"
  ) {
    setBusyId(id);
    setError(null);
    try {
      let res: Response;
      if (action === "delete") {
        if (!confirm("Delete this agreement? This is permanent.")) {
          setBusyId(null);
          return;
        }
        res = await fetch(`/api/agreements/${id}`, { method: "DELETE" });
      } else {
        res = await fetch(`/api/agreements/${id}/${action}`, {
          method: "POST"
        });
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `${action} failed`);
      if (action === "delete") {
        setAgreements((current) => current.filter((a) => a.id !== id));
      } else {
        setAgreements((current) =>
          current.map((a) => (a.id === id ? body.agreement : a))
        );
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  const grouped = useMemo(() => {
    const map: Record<string, Agreement[]> = {};
    for (const agreement of agreements) {
      const key = agreement.status;
      if (!map[key]) map[key] = [];
      map[key].push(agreement);
    }
    return map;
  }, [agreements]);

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Agreements</h2>
          <p className="text-sm text-text-secondary">
            NDAs, MSAs, DPAs, and signed quote snapshots tied to this client.
            Click-wrap signature is captured (name, email, IP, timestamp).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white"
        >
          {showNew ? "Cancel" : "+ New agreement"}
        </button>
      </div>

      {showNew ? (
        <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
          <h3 className="text-lg font-semibold text-white">New agreement</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-white">Type</span>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
              >
                {AGREEMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-white">Title</span>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Mutual NDA — Acme x Muloo"
                className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-white">
                Effective date
              </span>
              <input
                type="date"
                value={newEffectiveDate}
                onChange={(e) => setNewEffectiveDate(e.target.value)}
                className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-white">Expires at</span>
              <input
                type="date"
                value={newExpiresAt}
                onChange={(e) => setNewExpiresAt(e.target.value)}
                className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-white">
                Document URL (uploaded PDF)
              </span>
              <input
                value={newDocumentUrl}
                onChange={(e) => setNewDocumentUrl(e.target.value)}
                placeholder="https://..."
                className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
              />
              <p className="mt-2 text-xs text-text-muted">
                Optional. Either upload to your storage and paste the URL, or
                fill the body below for click-wrap text.
              </p>
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-white">
                Document body (click-wrap)
              </span>
              <textarea
                value={newDocumentBody}
                onChange={(e) => setNewDocumentBody(e.target.value)}
                rows={8}
                placeholder="Full text of the agreement. Plain text or markdown."
                className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 font-mono text-xs text-white outline-none"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-white">
                Internal notes (not shown to client)
              </span>
              <textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                rows={3}
                className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void createAgreement()}
            disabled={creating}
            className="mt-5 rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create as draft"}
          </button>
        </section>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 text-text-secondary">
          Loading agreements...
        </div>
      ) : agreements.length === 0 ? (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 text-text-secondary">
          No agreements yet. Create one above to get started.
        </div>
      ) : (
        <>
          {["sent", "draft", "signed", "withdrawn", "expired"].map((status) => {
            const items = grouped[status] ?? [];
            if (items.length === 0) return null;
            return (
              <section key={status} className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-muted">
                  {status} ({items.length})
                </h3>
                {items.map((agreement) => (
                  <article
                    key={agreement.id}
                    className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-[260px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            {AGREEMENT_TYPES.find(
                              (t) => t.value === agreement.type
                            )?.label ?? agreement.type}
                          </p>
                          <span
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusBadgeClass(agreement.status)}`}
                          >
                            {agreement.status}
                          </span>
                        </div>
                        <h2 className="mt-2 text-xl font-semibold text-white">
                          {agreement.title}
                        </h2>
                        <p className="mt-2 text-xs text-text-muted">
                          Effective {formatDate(agreement.effectiveDate)} ·
                          Expires {formatDate(agreement.expiresAt)} · Created{" "}
                          {formatDate(agreement.createdAt)}
                        </p>
                        {agreement.documentUrl ? (
                          <a
                            href={agreement.documentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block text-xs text-[#49cde1] underline"
                          >
                            View document →
                          </a>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {agreement.status === "draft" ? (
                          <button
                            type="button"
                            onClick={() =>
                              void actOnAgreement(agreement.id, "send")
                            }
                            disabled={busyId === agreement.id}
                            className="rounded-xl border border-[rgba(73,205,225,0.4)] bg-[rgba(73,205,225,0.08)] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                          >
                            Send to client
                          </button>
                        ) : null}
                        {agreement.status === "sent" ||
                        agreement.status === "draft" ? (
                          <button
                            type="button"
                            onClick={() =>
                              void actOnAgreement(agreement.id, "withdraw")
                            }
                            disabled={busyId === agreement.id}
                            className="rounded-xl border border-[rgba(255,200,80,0.45)] bg-[rgba(48,38,12,0.5)] px-3 py-2 text-xs font-medium text-[#ffd28a] disabled:opacity-50"
                          >
                            Withdraw
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() =>
                            void actOnAgreement(agreement.id, "delete")
                          }
                          disabled={busyId === agreement.id}
                          className="rounded-xl border border-[rgba(224,80,96,0.45)] px-3 py-2 text-xs font-medium text-[#ff9aa6] disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {agreement.signedAt ? (
                      <div className="mt-4 grid gap-2 rounded-xl border border-[rgba(73,255,143,0.18)] bg-[rgba(20,46,32,0.4)] p-4 text-xs md:grid-cols-2">
                        <div>
                          <p className="uppercase tracking-[0.18em] text-[#9ef0bd]">
                            Signed by
                          </p>
                          <p className="mt-1 text-sm text-white">
                            {agreement.signerName}
                            {agreement.signerTitle
                              ? ` · ${agreement.signerTitle}`
                              : ""}
                          </p>
                          <p className="text-xs text-text-muted">
                            {agreement.signerEmail}
                          </p>
                        </div>
                        <div>
                          <p className="uppercase tracking-[0.18em] text-[#9ef0bd]">
                            Captured
                          </p>
                          <p className="mt-1 text-sm text-white">
                            {formatDate(agreement.signedAt)}{" "}
                            {new Date(agreement.signedAt).toLocaleTimeString()}
                          </p>
                          <p className="text-xs text-text-muted">
                            IP {agreement.signerIp ?? "unknown"}
                          </p>
                        </div>
                      </div>
                    ) : null}
                    {agreement.notes ? (
                      <p className="mt-3 text-xs text-text-muted">
                        Notes: {agreement.notes}
                      </p>
                    ) : null}
                  </article>
                ))}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
