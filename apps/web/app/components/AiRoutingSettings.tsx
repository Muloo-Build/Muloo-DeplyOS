"use client";

import { useEffect, useMemo, useState } from "react";

interface ProviderConnection {
  providerKey: string;
  label: string;
  defaultModel: string | null;
  isEnabled: boolean;
  hasApiKey: boolean;
}

interface AiRoute {
  id: string;
  workflowKey: string;
  label: string;
  providerKey: string;
  modelOverride: string | null;
  notes: string | null;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastTestError: string | null;
  lastTestSampleOutput: string | null;
  lastTestLatencyMs: number | null;
  lastTestCostUsd: number | null;
  lastTestModel: string | null;
}

interface CatalogModel {
  id: string;
  label: string;
  contextK: number;
  inputCostPer1M: number;
  outputCostPer1M: number;
  tier: string;
  releasedAt: string;
  deprecated?: boolean;
}

interface CatalogProvider {
  key: string;
  label: string;
  description: string;
  apiBase: string;
  models: CatalogModel[];
}

interface RecommendationPick {
  providerKey: string;
  model: string;
  reason: string;
}

interface WorkflowRecommendation {
  primary: RecommendationPick;
  alternates: RecommendationPick[];
}

interface PromptTemplate {
  systemPrompt: string;
  samplePrompt: string;
}

const AI_PROVIDER_KEYS = new Set([
  "anthropic",
  "openai",
  "perplexity",
  "gemini",
  "grok",
  "deepseek",
  "mistral",
  "openrouter"
]);

function formatCost(perMillion: number): string {
  if (perMillion >= 1) return `$${perMillion.toFixed(2)}`;
  return `$${perMillion.toFixed(3)}`;
}

function formatUsd(value: number | null): string {
  if (value === null || value === undefined) return "—";
  if (value === 0) return "$0.00";
  if (value < 0.01) return "<$0.01";
  return `$${value.toFixed(4)}`;
}

export default function AiRoutingSettings() {
  const [providers, setProviders] = useState<ProviderConnection[]>([]);
  const [routes, setRoutes] = useState<AiRoute[]>([]);
  const [catalog, setCatalog] = useState<Record<string, CatalogProvider>>({});
  const [recommendations, setRecommendations] = useState<
    Record<string, WorkflowRecommendation>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [openPromptKey, setOpenPromptKey] = useState<string | null>(null);
  const [promptTemplates, setPromptTemplates] = useState<
    Record<string, PromptTemplate>
  >({});

  useEffect(() => {
    async function load() {
      try {
        const [
          providersResponse,
          routesResponse,
          catalogResponse,
          recommendationsResponse
        ] = await Promise.all([
          fetch("/api/provider-connections"),
          fetch("/api/ai-routing"),
          fetch("/api/ai-integrations/catalog"),
          fetch("/api/ai-routing/recommendations")
        ]);

        if (!providersResponse.ok) throw new Error("Failed to load providers");
        if (!routesResponse.ok) throw new Error("Failed to load AI routing");
        if (!catalogResponse.ok)
          throw new Error("Failed to load model catalog");
        if (!recommendationsResponse.ok)
          throw new Error("Failed to load recommendations");

        setProviders((await providersResponse.json()).providers ?? []);
        setRoutes((await routesResponse.json()).routes ?? []);
        setCatalog((await catalogResponse.json()).catalog ?? {});
        setRecommendations(
          (await recommendationsResponse.json()).recommendations ?? {}
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load AI routing"
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const aiProviders = useMemo(
    () =>
      providers
        .filter((p) => AI_PROVIDER_KEYS.has(p.providerKey))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [providers]
  );

  function markDirty(workflowKey: string) {
    setDirtyKeys((current) => {
      const next = new Set(current);
      next.add(workflowKey);
      return next;
    });
    setFeedback(null);
  }

  function updateRoute(routeKey: string, field: keyof AiRoute, value: string) {
    setRoutes((current) =>
      current.map((route) => {
        if (route.workflowKey !== routeKey) return route;
        const next = { ...route, [field]: value };
        if (field === "providerKey" && route.providerKey !== value) {
          next.modelOverride = "";
        }
        return next;
      })
    );
    markDirty(routeKey);
  }

  function applyRecommendation(routeKey: string, pick: RecommendationPick) {
    setRoutes((current) =>
      current.map((route) =>
        route.workflowKey === routeKey
          ? {
              ...route,
              providerKey: pick.providerKey,
              modelOverride: pick.model
            }
          : route
      )
    );
    markDirty(routeKey);
  }

  async function saveAll() {
    if (dirtyKeys.size === 0) return;
    setSavingAll(true);
    setError(null);
    setFeedback(null);
    try {
      const items = routes
        .filter((route) => dirtyKeys.has(route.workflowKey))
        .map((route) => ({
          workflowKey: route.workflowKey,
          providerKey: route.providerKey,
          modelOverride: route.modelOverride ?? "",
          notes: route.notes ?? ""
        }));
      const response = await fetch("/api/ai-routing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? "Bulk save failed");
      setRoutes(body.routes ?? []);
      setDirtyKeys(new Set());
      setFeedback(`Saved ${items.length} workflow${items.length === 1 ? "" : "s"}.`);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save"
      );
    } finally {
      setSavingAll(false);
    }
  }

  async function testRoute(routeKey: string) {
    setTestingKey(routeKey);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/ai-routing/${encodeURIComponent(routeKey)}/test`,
        { method: "POST" }
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? "Test failed");
      setRoutes((current) =>
        current.map((route) =>
          route.workflowKey === routeKey ? body.route : route
        )
      );
      if (body.template) {
        setPromptTemplates((current) => ({
          ...current,
          [routeKey]: body.template
        }));
      }
    } catch (testError) {
      setError(
        testError instanceof Error ? testError.message : "Test failed"
      );
    } finally {
      setTestingKey(null);
    }
  }

  async function loadPromptTemplate(routeKey: string) {
    if (promptTemplates[routeKey]) return;
    try {
      const response = await fetch(
        `/api/ai-routing/${encodeURIComponent(routeKey)}/prompt`
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? "Prompt load failed");
      setPromptTemplates((current) => ({
        ...current,
        [routeKey]: body.template
      }));
    } catch {
      // silent — prompt panel will show "no template available"
    }
  }

  function togglePromptPanel(routeKey: string) {
    if (openPromptKey === routeKey) {
      setOpenPromptKey(null);
      return;
    }
    setOpenPromptKey(routeKey);
    void loadPromptTemplate(routeKey);
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 text-text-secondary">
        Loading AI routing...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Sticky save bar */}
      <div className="sticky top-0 z-10 -mx-1 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126]/95 px-5 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">
              {dirtyKeys.size === 0
                ? "No unsaved changes"
                : `${dirtyKeys.size} unsaved change${dirtyKeys.size === 1 ? "" : "s"}`}
            </p>
            <p className="text-xs text-text-muted">
              Edits stay local until you save. Tests, prompt previews, and
              recommendations can be used at any time.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void saveAll()}
            disabled={savingAll || dirtyKeys.size === 0}
            className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingAll
              ? "Saving..."
              : dirtyKeys.size === 0
                ? "All saved"
                : `Save ${dirtyKeys.size} change${dirtyKeys.size === 1 ? "" : "s"}`}
          </button>
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

      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
        <p className="text-sm text-text-secondary">
          Each workflow can run on a different provider and model. Use the
          recommendation panel for sensible defaults, click <span className="text-white">Test</span> to verify the model is reachable, and use <span className="text-white">Show prompt</span> to inspect what gets sent.
        </p>
      </div>

      {routes.map((route) => {
        const isDirty = dirtyKeys.has(route.workflowKey);
        const provider =
          providers.find((p) => p.providerKey === route.providerKey) ?? null;
        const catalogEntry = catalog[route.providerKey];
        const catalogModels = catalogEntry?.models ?? [];
        const knownIds = new Set(catalogModels.map((m) => m.id));
        const overrideId = route.modelOverride ?? "";
        const overrideMissingFromCatalog =
          overrideId.length > 0 && !knownIds.has(overrideId);
        const recommendation = recommendations[route.workflowKey];
        const status = route.lastTestStatus;

        return (
          <section
            key={route.id}
            className={`rounded-2xl border bg-background-card p-6 ${
              isDirty
                ? "border-[rgba(255,200,80,0.45)]"
                : "border-[rgba(255,255,255,0.07)]"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1 min-w-[260px]">
                <div className="flex items-center gap-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                    Workflow
                  </p>
                  {isDirty ? (
                    <span className="rounded-full bg-[rgba(255,200,80,0.14)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ffd28a]">
                      Unsaved
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  {route.label}
                </h2>
                <p className="mt-1 font-mono text-xs text-text-muted">
                  {route.workflowKey}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-xs text-text-secondary">
                  {provider
                    ? `${provider.label}${
                        route.modelOverride
                          ? ` • ${route.modelOverride}`
                          : provider.defaultModel
                            ? ` • ${provider.defaultModel}`
                            : ""
                      }`
                    : "Unassigned"}
                </div>
                {status ? (
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                      status === "ok"
                        ? "bg-[rgba(73,255,143,0.12)] text-[#7af0a8]"
                        : "bg-[rgba(224,80,96,0.18)] text-[#ff9aa6]"
                    }`}
                  >
                    {status === "ok" ? "Tested OK" : "Test failed"}
                  </span>
                ) : (
                  <span className="rounded-full bg-[rgba(255,255,255,0.06)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    Untested
                  </span>
                )}
                {route.lastTestedAt ? (
                  <span className="text-[10px] text-text-muted">
                    {new Date(route.lastTestedAt).toLocaleString()} ·{" "}
                    {route.lastTestLatencyMs ? `${route.lastTestLatencyMs}ms · ` : ""}
                    {formatUsd(route.lastTestCostUsd)}
                  </span>
                ) : null}
              </div>
            </div>

            {recommendation ? (
              <div className="mt-5 rounded-2xl border border-[rgba(124,92,191,0.28)] bg-[rgba(124,92,191,0.08)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[#cdb6f5]">
                      Recommended for this workflow
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {recommendation.primary.providerKey} ·{" "}
                      {recommendation.primary.model}
                    </p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {recommendation.primary.reason}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      applyRecommendation(
                        route.workflowKey,
                        recommendation.primary
                      )
                    }
                    disabled={
                      route.providerKey ===
                        recommendation.primary.providerKey &&
                      route.modelOverride === recommendation.primary.model
                    }
                    className="rounded-xl border border-[rgba(255,255,255,0.18)] bg-[rgba(124,92,191,0.18)] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Use this
                  </button>
                </div>
                {recommendation.alternates.length > 0 ? (
                  <div className="mt-3 space-y-2 border-t border-[rgba(255,255,255,0.07)] pt-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
                      Alternates
                    </p>
                    {recommendation.alternates.map((alt) => (
                      <div
                        key={`${alt.providerKey}-${alt.model}`}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[rgba(255,255,255,0.05)] bg-[#0b1126] px-3 py-2"
                      >
                        <div>
                          <p className="text-xs font-semibold text-white">
                            {alt.providerKey} · {alt.model}
                          </p>
                          <p className="text-[11px] text-text-secondary">
                            {alt.reason}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            applyRecommendation(route.workflowKey, alt)
                          }
                          className="rounded-lg border border-[rgba(255,255,255,0.12)] px-2 py-1 text-[10px] font-medium text-white"
                        >
                          Use
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-white">Provider</span>
                <select
                  value={route.providerKey}
                  onChange={(event) =>
                    updateRoute(
                      route.workflowKey,
                      "providerKey",
                      event.target.value
                    )
                  }
                  className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                >
                  {provider &&
                  !aiProviders.some(
                    (p) => p.providerKey === route.providerKey
                  ) ? (
                    <option value={route.providerKey}>
                      {provider.label} (current)
                    </option>
                  ) : null}
                  {aiProviders.map((item) => {
                    const ready = item.isEnabled && item.hasApiKey;
                    return (
                      <option key={item.providerKey} value={item.providerKey}>
                        {item.label}
                        {ready ? "" : " — needs API key"}
                      </option>
                    );
                  })}
                </select>
                {provider && !(provider.isEnabled && provider.hasApiKey) ? (
                  <p className="mt-2 text-xs text-[#ffd28a]">
                    No API key for this provider yet. Add one under Providers.
                  </p>
                ) : null}
              </label>

              <label className="block">
                <span className="text-sm font-medium text-white">
                  Model override
                </span>
                <select
                  value={route.modelOverride ?? ""}
                  onChange={(event) =>
                    updateRoute(
                      route.workflowKey,
                      "modelOverride",
                      event.target.value
                    )
                  }
                  className="mt-3 w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="">
                    Use provider default
                    {provider?.defaultModel ? ` (${provider.defaultModel})` : ""}
                  </option>
                  {overrideMissingFromCatalog ? (
                    <option value={overrideId}>
                      {overrideId} (legacy — not in catalog)
                    </option>
                  ) : null}
                  {catalogModels.map((model) => (
                    <option
                      key={model.id}
                      value={model.id}
                      disabled={model.deprecated}
                    >
                      {model.label}
                      {model.deprecated ? " (deprecated)" : ""}
                      {" — in "}
                      {formatCost(model.inputCostPer1M)}/1M, out{" "}
                      {formatCost(model.outputCostPer1M)}/1M
                    </option>
                  ))}
                </select>
              </label>

              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-white">Notes</span>
                <textarea
                  value={route.notes ?? ""}
                  onChange={(event) =>
                    updateRoute(route.workflowKey, "notes", event.target.value)
                  }
                  className="mt-3 min-h-[96px] w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                  placeholder="Why this workflow uses this provider/model, testing notes, or known strengths."
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void testRoute(route.workflowKey)}
                disabled={testingKey === route.workflowKey}
                className="rounded-xl border border-[rgba(73,205,225,0.4)] bg-[rgba(73,205,225,0.08)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {testingKey === route.workflowKey
                  ? "Testing..."
                  : "Test this workflow"}
              </button>
              <button
                type="button"
                onClick={() => togglePromptPanel(route.workflowKey)}
                className="rounded-xl border border-[rgba(255,255,255,0.18)] px-4 py-3 text-sm font-medium text-white"
              >
                {openPromptKey === route.workflowKey
                  ? "Hide prompt"
                  : "Show prompt"}
              </button>
            </div>

            {openPromptKey === route.workflowKey ? (
              <div className="mt-4 space-y-3 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                {promptTemplates[route.workflowKey] ? (
                  <>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
                        System prompt (sample)
                      </p>
                      <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-[rgba(255,255,255,0.05)] bg-[#040518] p-3 font-mono text-xs text-white">
                        {promptTemplates[route.workflowKey].systemPrompt}
                      </pre>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
                        Sample user prompt
                      </p>
                      <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-[rgba(255,255,255,0.05)] bg-[#040518] p-3 font-mono text-xs text-white">
                        {promptTemplates[route.workflowKey].samplePrompt}
                      </pre>
                    </div>
                    <p className="text-[11px] text-text-muted">
                      These are the prompts used by the Test button. Real
                      production prompts are richer and live in the workflow
                      handler.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-text-muted">Loading prompt...</p>
                )}
              </div>
            ) : null}

            {route.lastTestError ? (
              <div className="mt-4 rounded-xl border border-[rgba(224,80,96,0.35)] bg-[rgba(58,21,32,0.5)] px-3 py-2 text-xs text-[#ffb1bb]">
                {route.lastTestError}
              </div>
            ) : null}
            {route.lastTestSampleOutput ? (
              <div className="mt-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
                  Last test output
                </p>
                <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-3 font-mono text-xs text-white">
                  {route.lastTestSampleOutput}
                </pre>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
