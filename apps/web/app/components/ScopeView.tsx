"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Plus,
  RefreshCw,
  Send,
  X
} from "lucide-react";

import AppShell from "./AppShell";
import { Btn } from "./ui/Btn";
import { Empty } from "./ui/Empty";
import { PageHead } from "./ui/PageHead";
import { Panel, PanelBody, PanelHead } from "./ui/Panel";
import { Pill } from "./ui/Pill";
import { Stat, StatsGrid } from "./ui/Stat";
import {
  CellPrimary,
  TBody,
  Tbl,
  Td,
  Th,
  THead,
  Tr
} from "./ui/Tbl";

interface Workstream {
  id: string;
  name: string;
  category?: string | null;
  status?: string;
  owner?: string;
  summary?: string;
  estimatedHours?: number | null;
  hourCap?: number | null;
  scopeRisk?: string | null;
}

interface ProjectRecord {
  id: string;
  name: string;
  status?: string;
  quoteApprovalStatus?: string | null;
  scopeLockedAt?: string | null;
  scopeType?: string | null;
  engagementType?: string | null;
  problemStatement?: string | null;
  solutionRecommendation?: string | null;
  scopeExecutiveSummary?: string | null;
  deliveryWorkstreams?: Workstream[];
  client: { id: string; name: string };
}

interface QuoteLine {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  lineTotalZar: number;
  metadata?: Record<string, unknown> | null;
}

interface QuoteRecord {
  id: string;
  reference?: string;
  version?: number;
  status?: string;
  projectId?: string;
  totals?: { grandTotalZar?: number };
  currency?: string;
  productLines?: QuoteLine[];
  phaseLines?: Array<{
    phase: number;
    phaseName: string;
    humanHours: number;
    feeZar: number;
    tasks?: Array<{ name: string; effortHours: number; type: string }>;
  }>;
}

const categoryLabels: Record<string, string> = {
  discovery: "Discovery",
  hubspot_implementation: "HubSpot CRM",
  website: "Website",
  marketing: "Marketing",
  service: "Service",
  integration: "Integration",
  partner_delivery: "Partner",
  other: "Other"
};

function categoryLabel(category?: string | null): string {
  if (!category) return "—";
  return categoryLabels[category] ?? category.replace(/_/g, " ");
}

function workstreamStatus(w: Workstream): "approved" | "variance" | "blocked" {
  if (w.status === "blocked") return "blocked";
  if (
    w.scopeRisk === "high" ||
    w.scopeRisk === "medium" ||
    w.status === "planned"
  ) {
    return "variance";
  }
  return "approved";
}

function fmtMoney(n: number | undefined | null, currency = "ZAR"): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(n);
}

interface ScopeViewProps {
  projectId: string;
}

export default function ScopeView({ projectId }: ScopeViewProps) {
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    category: "hubspot_implementation",
    estimatedHours: ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    setRefreshing(true);
    try {
      const [projRes, quotesRes] = await Promise.all([
        fetch(`/api/projects/${encodeURIComponent(projectId)}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch("/api/quotes")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      ]);

      const proj: ProjectRecord | null = projRes?.project ?? projRes ?? null;
      setProject(proj);

      const allQuotes: QuoteRecord[] = Array.isArray(quotesRes?.quotes)
        ? quotesRes.quotes
        : [];
      setQuotes(allQuotes.filter((q) => q.projectId === projectId));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [projectId]);

  const workstreams = project?.deliveryWorkstreams ?? [];

  const scopeItems = useMemo(() => {
    return workstreams.map((w, idx) => ({
      id: w.id,
      name: w.name,
      category: categoryLabel(w.category),
      workstream: `WS-${String(idx + 1).padStart(2, "0")}`,
      hours: w.estimatedHours ?? w.hourCap ?? 0,
      status: workstreamStatus(w),
      summary: w.summary
    }));
  }, [workstreams]);

  const totalHours = scopeItems.reduce((sum, item) => sum + item.hours, 0);
  const inScope = scopeItems.filter((i) => i.status === "approved").length;
  const varianceItems = scopeItems.filter((i) => i.status === "variance");
  const blockedItems = scopeItems.filter((i) => i.status === "blocked");

  const latestQuote = quotes[0];
  const quoteApprovalStatus = project?.quoteApprovalStatus ?? "draft";
  const approvalLabel = (() => {
    if (project?.scopeLockedAt) return "Locked";
    if (quoteApprovalStatus === "approved") return "Approved";
    if (quoteApprovalStatus === "shared") return "Sent";
    return "Draft";
  })();

  // Estimated variance value: hours of variance items × rough rate
  const varianceHours = varianceItems.reduce((sum, i) => sum + i.hours, 0);
  const fallbackRate = 1750; // ZAR/hr default — unused if quote has rate

  async function handleAdd() {
    if (!project) return;
    if (!draft.name.trim()) {
      setError("Name required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next: Workstream = {
        id: `workstream_${Date.now()}_${draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
        name: draft.name.trim(),
        category: draft.category,
        status: "planned",
        owner: "muloo",
        scopeRisk: "low",
        estimatedHours: draft.estimatedHours
          ? Number(draft.estimatedHours)
          : null
      };
      const r = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            deliveryWorkstreams: [...(project.deliveryWorkstreams ?? []), next]
          })
        }
      );
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        throw new Error(body?.error ?? "Add failed");
      }
      const body = await r.json();
      setProject((body?.project ?? body) as ProjectRecord);
      setAddOpen(false);
      setDraft({
        name: "",
        category: "hubspot_implementation",
        estimatedHours: ""
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add failed");
    } finally {
      setSaving(false);
    }
  }

  const isPaidDiscovery =
    project?.scopeType === "paid_discovery" ||
    project?.engagementType === "PAID_DISCOVERY" ||
    project?.engagementType === "DISCOVERY_ONLY";
  const skipsDiscovery =
    project?.scopeType === "standalone_quote" ||
    project?.engagementType === "AUDIT" ||
    project?.engagementType === "OPTIMISATION" ||
    project?.engagementType === "GUIDED_DEPLOYMENT";

  return (
    <AppShell>
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
        <PageHead
          eyebrow={
            <Link
              href={`/projects/${projectId}`}
              className="hover:text-text-1 transition-colors"
            >
              ← {project?.name ?? "Project workspace"}
            </Link>
          }
          title="Scope"
          lede={
            isPaidDiscovery
              ? "Paid discovery engagement — scope is the discovery deliverable. Use this surface to track what's been scoped vs delivered, and to flag any expansion that turns into implementation."
              : skipsDiscovery
                ? "Direct-to-scope engagement (no discovery). Add scope items here as workstreams; quote-driven items appear once a quote is created."
                : "Scope items populated from discovery, quote line items, and direct workstream additions. Track variance against the original quote and approval status."
          }
          actions={
            <>
              <Btn
                variant="ghost"
                size="md"
                onClick={() => void loadAll()}
                disabled={refreshing}
              >
                <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
                Refresh
              </Btn>
              {latestQuote && (
                <Link href={`/quotes/${latestQuote.id}`}>
                  <Btn variant="ghost" size="md">
                    <ExternalLink size={13} />
                    Open quote
                  </Btn>
                </Link>
              )}
              <Btn
                variant="primary"
                size="md"
                onClick={() => {
                  setError(null);
                  setAddOpen(true);
                }}
              >
                <Plus size={13} />
                Add scope item
              </Btn>
            </>
          }
        />

        <StatsGrid cols={3} className="mb-6">
          <Stat
            label="In scope"
            value={`${scopeItems.length} items`}
            delta={`${totalHours}h across ${workstreams.length} workstream${workstreams.length === 1 ? "" : "s"}`}
            deltaTone={scopeItems.length > 0 ? "up" : "neutral"}
          />
          <Stat
            label="Variance pending"
            value={
              varianceItems.length > 0
                ? `${varianceItems.length} items`
                : "0 items"
            }
            delta={
              varianceItems.length > 0
                ? `~${varianceHours}h · ${fmtMoney(varianceHours * fallbackRate)}`
                : "no scope drift"
            }
            deltaTone={varianceItems.length > 0 ? "down" : "up"}
          />
          <Stat
            label="Approval status"
            value={approvalLabel}
            delta={
              latestQuote
                ? `${latestQuote.reference ?? latestQuote.id.slice(0, 8)}${
                    latestQuote.totals?.grandTotalZar
                      ? ` · ${fmtMoney(latestQuote.totals.grandTotalZar, latestQuote.currency)}`
                      : ""
                  }`
                : "no quote yet"
            }
            deltaTone={
              quoteApprovalStatus === "approved"
                ? "up"
                : quoteApprovalStatus === "shared"
                  ? "neutral"
                  : "down"
            }
          />
        </StatsGrid>

        {(blockedItems.length > 0 || varianceItems.length > 0) && (
          <Panel className="mb-6">
            <PanelHead
              title={
                blockedItems.length > 0
                  ? "Decisions blocking scope"
                  : "Variance awaiting decision"
              }
              right={
                <Pill tone={blockedItems.length > 0 ? "danger" : "warn"} dot>
                  {blockedItems.length + varianceItems.length}
                </Pill>
              }
            />
            <PanelBody>
              <div className="text-[12.5px] text-text-2">
                {[...blockedItems, ...varianceItems].slice(0, 4).map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center gap-2 py-1.5 border-b border-ink-4 last:border-b-0"
                  >
                    <AlertTriangle
                      size={12}
                      className={
                        i.status === "blocked"
                          ? "text-status-danger"
                          : "text-status-warn"
                      }
                    />
                    <span className="font-mono text-[10.5px] text-text-3">
                      {i.workstream}
                    </span>
                    <span className="flex-1 truncate">{i.name}</span>
                    <span className="font-mono text-text-3">{i.hours}h</span>
                  </div>
                ))}
              </div>
            </PanelBody>
          </Panel>
        )}

        <section>
          <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
            <div>
              <h2 className="text-[16px] font-semibold m-0 -tracking-[0.01em]">
                Scope items
              </h2>
              <p className="text-[12.5px] text-text-3 m-0 mt-0.5">
                One row per workstream. Quote lines reconcile against these.
              </p>
            </div>
            {!latestQuote && scopeItems.length > 0 && (
              <Link href={`/quotes/new?projectId=${projectId}`}>
                <Btn variant="ghost" size="sm">
                  <Send size={11} />
                  Build quote from scope
                </Btn>
              </Link>
            )}
          </div>

          {loading ? (
            <Empty title="Loading scope…" sub="One moment." />
          ) : scopeItems.length === 0 ? (
            <Empty
              title="No scope items yet"
              sub={
                isPaidDiscovery
                  ? "Add scope items as the paid discovery uncovers what needs to be built."
                  : "Add a scope item to start tracking what's being delivered against this project."
              }
              action={
                <Btn
                  variant="primary"
                  size="sm"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus size={12} />
                  Add scope item
                </Btn>
              }
            />
          ) : (
            <Tbl>
              <THead>
                <Tr>
                  <Th>Item</Th>
                  <Th>Category</Th>
                  <Th>Workstream</Th>
                  <Th>Hours</Th>
                  <Th>Status</Th>
                  <Th style={{ width: 40 }}></Th>
                </Tr>
              </THead>
              <TBody>
                {scopeItems.map((i) => {
                  const tone =
                    i.status === "blocked"
                      ? "danger"
                      : i.status === "variance"
                        ? "warn"
                        : "ok";
                  const statusText =
                    i.status === "blocked"
                      ? "Blocked"
                      : i.status === "variance"
                        ? "Variance"
                        : "Approved";
                  return (
                    <Tr key={i.id}>
                      <Td>
                        <CellPrimary sub={i.summary ?? null}>
                          {i.name}
                        </CellPrimary>
                      </Td>
                      <Td muted>{i.category}</Td>
                      <Td>
                        <span className="font-mono text-[11.5px]">
                          {i.workstream}
                        </span>
                      </Td>
                      <Td>
                        <span className="font-mono">{i.hours}h</span>
                      </Td>
                      <Td>
                        <Pill tone={tone} dot>
                          {statusText}
                        </Pill>
                      </Td>
                      <Td>
                        <ChevronRight size={14} className="text-text-3" />
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Tbl>
          )}
        </section>

        {latestQuote && Array.isArray(latestQuote.productLines) && latestQuote.productLines.length > 0 && (
          <section className="mt-6">
            <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
              <div>
                <h2 className="text-[16px] font-semibold m-0 -tracking-[0.01em]">
                  Quote line items
                </h2>
                <p className="text-[12.5px] text-text-3 m-0 mt-0.5">
                  From {latestQuote.reference ?? latestQuote.id.slice(0, 8)}.
                  These reconcile against the scope items above.
                </p>
              </div>
              <Link href={`/quotes/${latestQuote.id}`}>
                <Btn variant="ghost" size="sm">
                  Open quote
                  <ExternalLink size={11} />
                </Btn>
              </Link>
            </div>
            <Tbl>
              <THead>
                <Tr>
                  <Th>Item</Th>
                  <Th>Category</Th>
                  <Th>Quantity</Th>
                  <Th>Total</Th>
                </Tr>
              </THead>
              <TBody>
                {latestQuote.productLines.map((line) => (
                  <Tr key={line.id}>
                    <Td>
                      <CellPrimary>{line.name}</CellPrimary>
                    </Td>
                    <Td muted>{line.category}</Td>
                    <Td>
                      <span className="font-mono">{line.quantity}</span>
                    </Td>
                    <Td>
                      <span className="font-mono">
                        {fmtMoney(line.lineTotalZar, latestQuote.currency)}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Tbl>
          </section>
        )}
      </div>

      {addOpen && project && (
        <>
          <button
            type="button"
            aria-label="Close add scope"
            onClick={() => !saving && setAddOpen(false)}
            className="fixed inset-0 z-40 bg-black/70"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(480px,92vw)] bg-ink-1 border border-ink-4 rounded-[14px] p-6 shadow-elev-pop"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-[10px] tracking-[0.14em] uppercase text-text-3 font-semibold">
                  Scope
                </p>
                <h3 className="text-[16px] font-semibold mt-1 -tracking-[0.01em]">
                  Add scope item
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !saving && setAddOpen(false)}
                className="text-text-3 hover:text-text-1 p-1 rounded-md transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-[12.5px] text-text-2 m-0 mb-3">
              Adds a new workstream-level item. Submit a quote to bind these to
              billable lines.
            </p>
            <div className="grid gap-3">
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold">
                  Item <span className="text-status-danger">*</span>
                </span>
                <input
                  autoFocus
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  placeholder="e.g. Pipeline rebuild — sales"
                  className="mt-1.5 w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[13px] text-text-1 outline-none focus:border-[rgba(74,219,192,0.35)]"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold">
                    Category
                  </span>
                  <select
                    value={draft.category}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, category: e.target.value }))
                    }
                    className="mt-1.5 w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[13px] text-text-1 outline-none focus:border-[rgba(74,219,192,0.35)]"
                  >
                    <option value="discovery">Discovery</option>
                    <option value="hubspot_implementation">HubSpot CRM</option>
                    <option value="website">Website</option>
                    <option value="marketing">Marketing</option>
                    <option value="service">Service</option>
                    <option value="integration">Integration</option>
                    <option value="partner_delivery">Partner</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-text-3 font-semibold">
                    Hours
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={draft.estimatedHours}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        estimatedHours: e.target.value
                      }))
                    }
                    placeholder="e.g. 6"
                    className="mt-1.5 w-full bg-ink-2 border border-ink-4 rounded-[10px] px-3 py-2 text-[13px] text-text-1 outline-none focus:border-[rgba(74,219,192,0.35)]"
                  />
                </label>
              </div>
              {error && (
                <p className="text-[12px] text-status-danger m-0">{error}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Btn
                variant="ghost"
                size="md"
                onClick={() => setAddOpen(false)}
                disabled={saving}
              >
                Cancel
              </Btn>
              <Btn
                variant="primary"
                size="md"
                onClick={() => void handleAdd()}
                disabled={saving || !draft.name.trim()}
              >
                <Plus size={12} />
                {saving ? "Adding…" : "Add scope item"}
              </Btn>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
