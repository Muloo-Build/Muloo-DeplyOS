"use client";

import { useState } from "react";

type Props = {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onCompleted: (result: {
    project: { status: string; completedAt: string | null } | null;
    retainerId: string | null;
  }) => void;
};

export default function CloseProjectWizard({
  projectId,
  open,
  onClose,
  onCompleted
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [handoverConfirmed, setHandoverConfirmed] = useState(false);
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [npsNote, setNpsNote] = useState("");
  const [convertToRetainer, setConvertToRetainer] = useState(false);
  const [retainerBlockSize, setRetainerBlockSize] = useState<string>("10");
  const [retainerStartDate, setRetainerStartDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );
  const [retainerServiceLine, setRetainerServiceLine] =
    useState<"TECHNICAL_DELIVERY" | "CONSULTING">("TECHNICAL_DELIVERY");
  const [retainerCurrency, setRetainerCurrency] = useState<
    "ZAR" | "USD" | "GBP" | "EUR"
  >("ZAR");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        archiveWorkbooks: true
      };
      if (npsScore !== null) {
        payload.npsScore = npsScore;
        if (npsNote.trim()) payload.npsNote = npsNote.trim();
      }
      if (convertToRetainer) {
        payload.convertToRetainer = true;
        payload.retainer = {
          serviceLine: retainerServiceLine,
          blockSize: Number(retainerBlockSize) || 10,
          currency: retainerCurrency,
          startDate: retainerStartDate,
          status: "DRAFT"
        };
      }
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/close`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Failed to close project");
      onCompleted({
        project: body?.project ?? null,
        retainerId: body?.retainer?.id ?? null
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close project");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="brand-surface w-full max-w-lg rounded-[14px] border p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Close project</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-sm text-text-2 hover:text-white"
          >
            Cancel
          </button>
        </div>
        <p className="mt-1 text-xs text-text-3">Step {step} of 3</p>

        {error ? (
          <div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="mt-4 space-y-3 text-sm text-text-2">
            <p>
              Confirm the handover doc has been generated and shared with the
              client (under the Portal tab).
            </p>
            <label className="flex items-center gap-2 text-white">
              <input
                type="checkbox"
                checked={handoverConfirmed}
                onChange={(e) => setHandoverConfirmed(e.target.checked)}
              />
              Handover doc generated & shared
            </label>
            <div className="flex justify-end">
              <button
                type="button"
                disabled={!handoverConfirmed}
                onClick={() => setStep(2)}
                className="rounded-xl bg-[#51d0b0] px-4 py-2 text-sm font-semibold text-[#0b1126] disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-text-2">
              Capture client NPS (0–10). Required to close the project.
            </p>
            <div className="grid grid-cols-11 gap-1">
              {Array.from({ length: 11 }).map((_, n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNpsScore(n)}
                  className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                    npsScore === n
                      ? "border-[#51d0b0] bg-[#51d0b0]/20 text-white"
                      : "border-ink-4 bg-white/5 text-text-2 hover:bg-white/10"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <textarea
              value={npsNote}
              onChange={(e) => setNpsNote(e.target.value)}
              placeholder="Note (optional)"
              rows={3}
              className="brand-input w-full rounded-xl px-3 py-2 text-sm text-white"
            />
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm text-text-2 hover:text-white"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={npsScore === null}
                className="rounded-xl bg-[#51d0b0] px-4 py-2 text-sm font-semibold text-[#0b1126] disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-text-2">
              Closing will archive workbooks and mark this project complete.
              Optionally convert into an ongoing retainer.
            </p>
            <label className="flex items-center gap-2 text-white">
              <input
                type="checkbox"
                checked={convertToRetainer}
                onChange={(e) => setConvertToRetainer(e.target.checked)}
              />
              Convert into a retainer
            </label>
            {convertToRetainer ? (
              <div className="space-y-2 rounded-xl border border-ink-4 bg-white/5 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={retainerServiceLine}
                    onChange={(e) =>
                      setRetainerServiceLine(
                        e.target.value as
                          | "TECHNICAL_DELIVERY"
                          | "CONSULTING"
                      )
                    }
                    className="brand-input rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="TECHNICAL_DELIVERY">Technical delivery</option>
                    <option value="CONSULTING">Consulting</option>
                  </select>
                  <select
                    value={retainerCurrency}
                    onChange={(e) =>
                      setRetainerCurrency(
                        e.target.value as "ZAR" | "USD" | "GBP" | "EUR"
                      )
                    }
                    className="brand-input rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="ZAR">ZAR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={10}
                    value={retainerBlockSize}
                    onChange={(e) => setRetainerBlockSize(e.target.value)}
                    placeholder="Block size (hours, min 10)"
                    className="brand-input rounded-lg px-3 py-2 text-sm text-white"
                  />
                  <input
                    type="date"
                    value={retainerStartDate}
                    onChange={(e) => setRetainerStartDate(e.target.value)}
                    className="brand-input rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
            ) : null}
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={busy}
                className="text-sm text-text-2 hover:text-white"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="rounded-xl bg-[#51d0b0] px-4 py-2 text-sm font-semibold text-[#0b1126] disabled:opacity-50"
              >
                {busy ? "Closing…" : "Close project"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
