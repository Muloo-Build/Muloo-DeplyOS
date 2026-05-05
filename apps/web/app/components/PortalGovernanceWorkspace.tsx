"use client";

import { useEffect, useState } from "react";

import ClientShell from "./ClientShell";

interface Agreement {
  id: string;
  type: string;
  title: string;
  status: string;
  documentUrl: string | null;
  documentBody: string | null;
  effectiveDate: string | null;
  expiresAt: string | null;
  sentAt: string | null;
  signedAt: string | null;
  signerName: string | null;
  signerEmail: string | null;
  signerTitle: string | null;
  signerIp: string | null;
  acceptanceText: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  nda: "NDA",
  msa: "Master Services Agreement",
  dpa: "Data Processing Agreement",
  quote_signed: "Signed Quote",
  other: "Agreement"
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export default function PortalGovernanceWorkspace() {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAgreement, setActiveAgreement] = useState<Agreement | null>(
    null
  );
  const [signing, setSigning] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [agreed, setAgreed] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/me/agreements", {
        credentials: "include"
      });
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
    void load();
  }, []);

  async function signAgreement() {
    if (!activeAgreement) return;
    if (!agreed) {
      setError("Tick the acceptance box before signing.");
      return;
    }
    setSigning(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/portal/agreements/${activeAgreement.id}/sign`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signerName: signerName.trim(),
            signerEmail: signerEmail.trim(),
            signerTitle: signerTitle.trim() || null
          })
        }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Sign failed");
      setAgreements((current) =>
        current.map((a) => (a.id === body.agreement.id ? body.agreement : a))
      );
      setActiveAgreement(body.agreement);
      setAgreed(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign failed");
    } finally {
      setSigning(false);
    }
  }

  return (
    <ClientShell
      title="Governance"
      subtitle="Signed agreements, NDAs, and DPAs you've entered into with Muloo. Save copies for your offline records."
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
              Governance
            </p>
            <h1 className="mt-2 text-3xl font-bold font-heading text-white">
              Agreements &amp; signed documents
            </h1>
            <p className="mt-2 max-w-2xl text-text-secondary">
              View and sign documents Muloo has shared with you. Once signed,
              a copy is stored here permanently and can be saved as PDF for
              your records.
            </p>
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded-xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 lg:grid-cols-[0.4fr_0.6fr]">
          <aside className="space-y-3">
            {loading ? (
              <p className="text-sm text-text-muted">Loading...</p>
            ) : agreements.length === 0 ? (
              <p className="text-sm text-text-muted">
                No agreements have been shared with you yet.
              </p>
            ) : (
              agreements.map((agreement) => {
                const active = activeAgreement?.id === agreement.id;
                const signed = agreement.status === "signed";
                return (
                  <button
                    type="button"
                    key={agreement.id}
                    onClick={() => {
                      setActiveAgreement(agreement);
                      setAgreed(false);
                      setError(null);
                    }}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-[rgba(255,255,255,0.25)] bg-[#141d3d]"
                        : "border-[rgba(255,255,255,0.07)] bg-background-card hover:bg-[#141d3d]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                        {TYPE_LABELS[agreement.type] ?? agreement.type}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                          signed
                            ? "bg-[rgba(73,255,143,0.12)] text-[#7af0a8]"
                            : "bg-[rgba(73,205,225,0.12)] text-[#9be4f0]"
                        }`}
                      >
                        {agreement.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-white">
                      {agreement.title}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {signed
                        ? `Signed ${formatDate(agreement.signedAt)}`
                        : `Sent ${formatDate(agreement.sentAt)}`}
                    </p>
                  </button>
                );
              })
            )}
          </aside>

          <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
            {!activeAgreement ? (
              <p className="text-sm text-text-muted">
                Select an agreement on the left to read or sign.
              </p>
            ) : (
              <article>
                <header>
                  <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
                    {TYPE_LABELS[activeAgreement.type] ?? activeAgreement.type}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    {activeAgreement.title}
                  </h2>
                  <p className="mt-1 text-xs text-text-muted">
                    Effective {formatDate(activeAgreement.effectiveDate)} ·
                    Expires {formatDate(activeAgreement.expiresAt)}
                  </p>
                </header>

                {activeAgreement.documentUrl ? (
                  <a
                    href={activeAgreement.documentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-block rounded-xl border border-[rgba(73,205,225,0.4)] bg-[rgba(73,205,225,0.08)] px-4 py-3 text-sm font-medium text-white"
                  >
                    Open document →
                  </a>
                ) : null}

                {activeAgreement.documentBody ? (
                  <div className="mt-4 max-h-[500px] overflow-y-auto rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-text-secondary">
                      {activeAgreement.documentBody}
                    </pre>
                  </div>
                ) : null}

                {activeAgreement.status === "signed" ? (
                  <div className="mt-5 rounded-xl border border-[rgba(73,255,143,0.25)] bg-[rgba(20,46,32,0.4)] p-4 text-sm text-[#9ef0bd]">
                    <p className="font-semibold">
                      Signed on {formatDate(activeAgreement.signedAt)}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      By {activeAgreement.signerName}
                      {activeAgreement.signerTitle
                        ? ` (${activeAgreement.signerTitle})`
                        : ""}{" "}
                      · {activeAgreement.signerEmail} · IP{" "}
                      {activeAgreement.signerIp ?? "unknown"}
                    </p>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="mt-4 rounded-xl border border-[rgba(255,255,255,0.18)] px-4 py-2 text-xs font-medium text-white"
                    >
                      Save as PDF
                    </button>
                  </div>
                ) : (
                  <section className="mt-6 rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                    <h3 className="text-sm font-semibold text-white">
                      Sign this agreement
                    </h3>
                    {activeAgreement.acceptanceText ? (
                      <p className="mt-2 text-xs text-text-secondary">
                        {activeAgreement.acceptanceText}
                      </p>
                    ) : null}
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="block">
                        <span className="text-sm font-medium text-white">
                          Full name
                        </span>
                        <input
                          value={signerName}
                          onChange={(e) => setSignerName(e.target.value)}
                          className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-white">
                          Email
                        </span>
                        <input
                          type="email"
                          value={signerEmail}
                          onChange={(e) => setSignerEmail(e.target.value)}
                          className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                        />
                      </label>
                      <label className="block md:col-span-2">
                        <span className="text-sm font-medium text-white">
                          Title (optional)
                        </span>
                        <input
                          value={signerTitle}
                          onChange={(e) => setSignerTitle(e.target.value)}
                          placeholder="e.g. Director, Head of Marketing"
                          className="mt-2 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                        />
                      </label>
                    </div>
                    <label className="mt-4 flex items-start gap-2 text-sm text-white">
                      <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        className="mt-1"
                      />
                      <span>
                        I have read this agreement and have authority to bind
                        the named party. I understand my name, email, IP
                        address, and timestamp will be captured as proof of
                        signing.
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => void signAgreement()}
                      disabled={
                        signing ||
                        !agreed ||
                        !signerName.trim() ||
                        !signerEmail.trim()
                      }
                      className="mt-4 rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {signing ? "Signing..." : "Sign agreement"}
                    </button>
                  </section>
                )}
              </article>
            )}
          </div>
        </div>
      </div>
    </ClientShell>
  );
}
