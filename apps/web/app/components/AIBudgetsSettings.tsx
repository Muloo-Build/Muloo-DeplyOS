"use client";

import { useEffect, useState } from "react";

interface BudgetState {
  scope: string;
  monthlyCapUsd: number;
  spentUsd: number;
  percent: number;
  alertAt50: boolean;
  alertAt80: boolean;
  alertAt100: boolean;
  alertedThresholds: number[];
  notes: string | null;
}

const PRESET_SCOPES = [
  { value: "*", label: "Workspace total" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
  { value: "perplexity", label: "Perplexity" },
  { value: "grok", label: "Grok (xAI)" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "mistral", label: "Mistral" },
  { value: "openrouter", label: "OpenRouter" }
];

function fmtUsd(value: number): string {
  if (value === 0) return "$0.00";
  if (value < 0.01) return "<$0.01";
  return `$${value.toFixed(2)}`;
}

export default function AIBudgetsSettings() {
  const [budgets, setBudgets] = useState<BudgetState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [scopeInput, setScopeInput] = useState("*");
  const [capInput, setCapInput] = useState("100");
  const [notesInput, setNotesInput] = useState("");

  async function loadBudgets() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-integrations/budgets");
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Failed");
      setBudgets(body.budgets ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBudgets();
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-integrations/budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: scopeInput.trim(),
          monthlyCapUsd: Number.parseFloat(capInput),
          notes: notesInput.trim() || null
        })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Save failed");
      setNotesInput("");
      setCapInput("100");
      await loadBudgets();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(scope: string) {
    if (!confirm(`Remove budget for "${scope}"?`)) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/ai-integrations/budgets/${encodeURIComponent(scope)}`,
        { method: "DELETE" }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Delete failed");
      await loadBudgets();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
          {error}
        </div>
      ) : null}

      <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-6">
        <h2 className="text-lg font-semibold text-white">Add or update a budget</h2>
        <p className="mt-2 text-sm text-text-2">
          Soft caps only — calls are not blocked. Alerts surface in this UI when 50/80/100% of the monthly cap is reached.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium text-white">Scope</span>
            <select
              value={scopeInput}
              onChange={(e) => setScopeInput(e.target.value)}
              className="mt-3 w-full rounded-[14px] border border-ink-4 bg-ink-2 px-4 py-3 text-sm text-white outline-none"
            >
              {PRESET_SCOPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-white">Monthly cap (USD)</span>
            <input
              value={capInput}
              onChange={(e) => setCapInput(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              className="mt-3 w-full rounded-[14px] border border-ink-4 bg-ink-2 px-4 py-3 text-sm text-white outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-white">Notes</span>
            <input
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              placeholder="Optional"
              className="mt-3 w-full rounded-[14px] border border-ink-4 bg-ink-2 px-4 py-3 text-sm text-white outline-none"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="mt-5 rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save budget"}
        </button>
      </section>

      <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-6">
        <h2 className="text-lg font-semibold text-white">Active budgets</h2>
        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-text-3">Loading...</p>
          ) : budgets.length === 0 ? (
            <p className="text-sm text-text-3">
              No budgets configured. Add one above to start tracking.
            </p>
          ) : (
            budgets.map((budget) => (
              <div
                key={budget.scope}
                className="rounded-xl border border-ink-4 bg-ink-2 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {PRESET_SCOPES.find((s) => s.value === budget.scope)
                        ?.label ?? budget.scope}
                    </p>
                    <p className="text-xs text-text-3">
                      {fmtUsd(budget.spentUsd)} of {fmtUsd(budget.monthlyCapUsd)} this month
                    </p>
                    {budget.notes ? (
                      <p className="mt-1 text-xs text-text-3">
                        {budget.notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {budget.alertedThresholds.length > 0 ? (
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          budget.percent >= 100
                            ? "bg-[rgba(224,80,96,0.18)] text-[#ff9aa6]"
                            : "bg-[rgba(255,200,80,0.14)] text-[#ffd28a]"
                        }`}
                      >
                        {Math.max(...budget.alertedThresholds)}% reached
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleDelete(budget.scope)}
                      className="rounded-xl border border-[rgba(224,80,96,0.45)] px-3 py-1.5 text-xs text-[#ff9aa6]"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-3">
                  <div
                    className={`h-full ${
                      budget.percent >= 100
                        ? "bg-[#e05060]"
                        : budget.percent >= 80
                          ? "bg-[#f0a83a]"
                          : "bg-[#7c5cbf]"
                    }`}
                    style={{ width: `${Math.min(100, budget.percent)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
