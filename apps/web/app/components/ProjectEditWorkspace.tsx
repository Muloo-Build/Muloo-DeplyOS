"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { SkeletonRows } from "./LoadingSkeleton";
import ProjectWorkspaceView from "./ProjectWorkspaceView";
import { PageHead } from "./ui/PageHead";
import { Pill } from "./ui/Pill";

type RetainerServiceLine = "TECHNICAL_DELIVERY" | "CONSULTING";
type RetainerStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ENDED";
type RetainerCurrency = "ZAR" | "USD" | "GBP" | "EUR" | "AUD" | "CAD";

interface ProjectDetail {
  id: string;
  name: string;
  clientName: string;
  clientId: string;
  retainerId?: string | null;
  engagementType: string;
  scopeType?: string | null;
  serviceFamily: string;
  implementationApproach?: string | null;
  customerPlatformTier?: string | null;
  platformConfiguration?: Array<{
    productKey: string;
    label: string;
    tier: string;
    quantity?: number | null;
    unitLabel?: string | null;
    notes?: string | null;
  }> | null;
  includesPortalAudit?: boolean;
  selectedHubs: string[];
  deliveryWorkstreams?: Array<{
    id: string;
    name: string;
    category: string;
    status: string;
    owner: string;
    summary: string;
    portalSummary?: string | null;
    estimatedHours?: number | null;
    hourCap?: number | null;
    billingOwner?: string | null;
    deliveryOwner?: string | null;
    scopeRisk?: string | null;
    notes?: string | null;
  }> | null;
  billingOwner?: string | null;
  deliveryOwner?: string | null;
  partnerName?: string | null;
  internalCommercials?: {
    billingRoute: string;
    partnerName?: string | null;
    notes?: string | null;
    lines: Array<{
      id: string;
      workstreamId?: string | null;
      label: string;
      pricingModel: string;
      currency: string;
      mulooBaseAmount?: number | null;
      partnerSellAmount?: number | null;
      billingOwner: string;
      notes?: string | null;
    }>;
  } | null;
  status: string;
  scopeLockedAt?: string | null;
  quoteApprovalStatus?: string | null;
  googleDriveFolderId?: string | null;
  googleDriveFolderUrl?: string | null;
  googleDriveLastSyncedAt?: string | null;
  externalApproval?: ExternalApproval | null;
}

interface ExternalApproval {
  value: number;
  currency: string;
  approvedAt: string | null;
  approvedByName: string | null;
  approvedByEmail: string | null;
  docUrl: string | null;
  source: string | null;
  notes: string | null;
}

interface RetainerOption {
  id: string;
  serviceLine: RetainerServiceLine;
  blockSize: number;
  rate: number;
  currency: RetainerCurrency;
  startDate: string;
  endDate?: string | null;
  status: RetainerStatus;
}

interface PlatformPackageDraft {
  productKey: string;
  label: string;
  tier: string;
  quantity: string;
  unitLabel: string;
  notes: string;
}

interface WorkstreamDraft {
  id: string;
  name: string;
  category: string;
  status: string;
  owner: string;
  summary: string;
  portalSummary: string;
  estimatedHours: string;
  hourCap: string;
  billingOwner: string;
  deliveryOwner: string;
  scopeRisk: string;
  notes: string;
}

interface CommercialLineDraft {
  id: string;
  workstreamId: string;
  label: string;
  pricingModel: string;
  currency: string;
  mulooBaseAmount: string;
  partnerSellAmount: string;
  billingOwner: string;
  notes: string;
}

interface InternalCommercialsDraft {
  billingRoute: string;
  partnerName: string;
  notes: string;
  lines: CommercialLineDraft[];
}

interface FormState {
  name: string;
  clientName: string;
  retainerId: string | null;
  engagementType: string;
  scopeType: string;
  serviceFamily: string;
  implementationApproach: string;
  customerPlatformTier: string;
  includesPortalAudit: boolean;
  selectedHubs: string[];
  platformConfiguration: PlatformPackageDraft[];
  deliveryWorkstreams: WorkstreamDraft[];
  internalCommercials: InternalCommercialsDraft;
  billingOwner: string;
  deliveryOwner: string;
  partnerName: string;
}

const serviceFamilies = [
  {
    id: "hubspot_architecture",
    label: "HubSpot Architecture",
    description: "Portal design, implementation, optimisation, and delivery."
  },
  {
    id: "custom_engineering",
    label: "Custom Engineering",
    description:
      "CMS, integrations, websites, and technical implementation work."
  },
  {
    id: "ai_automation",
    label: "AI Automation",
    description: "Agent flows, AI operations, and automation-led delivery."
  }
];

const engagementTypes = [
  {
    id: "IMPLEMENTATION",
    label: "Implementation",
    description: "New HubSpot build or onboarding delivery."
  },
  {
    id: "MIGRATION",
    label: "Migration",
    description: "Move from another CRM or stack into HubSpot."
  },
  {
    id: "OPTIMISATION",
    label: "Optimisation",
    description: "Improve an existing setup and structure the next phase."
  },
  {
    id: "AUDIT",
    label: "Audit",
    description: "Assess the current setup and recommend the next move."
  },
  {
    id: "GUIDED_DEPLOYMENT",
    label: "Guided Deployment",
    description: "Partnered rollout with close client involvement."
  }
];

const scopeTypes = [
  {
    id: "discovery",
    label: "Discovery-led implementation",
    description: "Use discovery, scoped recommendations, and a phased quote."
  },
  {
    id: "standalone_quote",
    label: "Standalone quote job",
    description:
      "Capture a specific job brief without a full discovery process."
  },
  {
    id: "optimisation",
    label: "Optimisation / revamp",
    description: "Audit an existing portal and deliver structured improvements."
  }
];

const implementationApproachOptions = [
  {
    value: "pragmatic_poc",
    label: "Pragmatic / POC",
    description:
      "Use a lean Phase 1 path and allow workaround architecture where sensible."
  },
  {
    value: "best_practice",
    label: "Best-practice / scalable",
    description:
      "Prefer the cleaner long-term architecture even if it needs more packaging or effort."
  }
];

const customerPlatformTierOptions = [
  { value: "", label: "Not set" },
  { value: "free", label: "Free" },
  { value: "starter", label: "Starter" },
  { value: "professional", label: "Professional" },
  { value: "enterprise", label: "Enterprise" }
];

const hubTierOptions = [
  { value: "", label: "Not set" },
  { value: "starter", label: "Starter" },
  { value: "professional", label: "Professional" },
  { value: "enterprise", label: "Enterprise" },
  { value: "included", label: "Included" }
];

const coreHubOptions = [
  { id: "sales", label: "Sales Hub" },
  { id: "marketing", label: "Marketing Hub" },
  { id: "service", label: "Service Hub" },
  { id: "cms", label: "Content Hub" },
  { id: "ops", label: "Operations Hub" }
];

const addOnHubOptions = [
  { id: "commerce", label: "Commerce Hub" },
  { id: "data", label: "Data Hub" },
  { id: "breeze", label: "Breeze AI" }
];

const hubProductKeyMap: Record<string, string> = {
  sales: "sales_hub",
  marketing: "marketing_hub",
  service: "service_hub",
  cms: "content_hub",
  ops: "operations_hub",
  commerce: "commerce_hub",
  data: "data_hub",
  breeze: "breeze"
};

const workstreamCategoryOptions = [
  { value: "discovery", label: "Discovery" },
  { value: "website", label: "Website" },
  { value: "hubspot_implementation", label: "HubSpot implementation" },
  { value: "other", label: "Other" }
];

const workstreamStatusOptions = [
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "complete", label: "Complete" }
];

const workstreamOwnerOptions = [
  { value: "muloo", label: "Muloo" },
  { value: "partner", label: "Partner" },
  { value: "shared", label: "Shared" }
];

const billingRouteOptions = [
  { value: "direct", label: "Direct billing" },
  { value: "partner_markup", label: "Partner markup" },
  { value: "mixed", label: "Mixed" }
];

const commercialPricingModelOptions = [
  { value: "fixed_fee", label: "Fixed fee" },
  { value: "monthly_rollout", label: "Monthly rollout" },
  { value: "license", label: "License" },
  { value: "pass_through", label: "Pass through" },
  { value: "markup", label: "Markup" },
  { value: "other", label: "Other" }
];

const commercialOwnerOptions = [
  { value: "muloo", label: "Muloo" },
  { value: "partner", label: "Partner" },
  { value: "shared", label: "Shared" }
];

function formatTokenLabel(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return value
    .split(/[_-]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildPackageDraft(
  productKey: string,
  label: string,
  tier = "",
  quantity?: number | null,
  unitLabel?: string | null,
  notes?: string | null
): PlatformPackageDraft {
  return {
    productKey,
    label,
    tier,
    quantity: quantity == null ? "" : String(quantity),
    unitLabel: unitLabel ?? "",
    notes: notes ?? ""
  };
}

function syncPlatformConfiguration(
  selectedHubs: string[],
  customerPlatformTier: string,
  currentPackages: PlatformPackageDraft[]
) {
  const currentByProduct = new Map(
    currentPackages.map((item) => [item.productKey, item])
  );

  return selectedHubs
    .map((hubId) => {
      const productKey = hubProductKeyMap[hubId];
      if (!productKey) {
        return null;
      }

      const existing = currentByProduct.get(productKey);
      return (
        existing ??
        buildPackageDraft(
          productKey,
          formatTokenLabel(productKey),
          productKey === "breeze" ? "included" : customerPlatformTier
        )
      );
    })
    .filter((item): item is PlatformPackageDraft => item !== null);
}

function createWorkstreamDraft(index: number): WorkstreamDraft {
  return {
    id: `workstream_${index + 1}`,
    name: "",
    category: "other",
    status: "planned",
    owner: "muloo",
    summary: "",
    portalSummary: "",
    estimatedHours: "",
    hourCap: "",
    billingOwner: "",
    deliveryOwner: "",
    scopeRisk: "",
    notes: ""
  };
}

function createCommercialLineDraft(index: number): CommercialLineDraft {
  return {
    id: `commercial_line_${index + 1}`,
    workstreamId: "",
    label: "",
    pricingModel: "fixed_fee",
    currency: "AUD",
    mulooBaseAmount: "",
    partnerSellAmount: "",
    billingOwner: "muloo",
    notes: ""
  };
}

function buildInitialForm(project: ProjectDetail): FormState {
  const platformConfiguration = syncPlatformConfiguration(
    project.selectedHubs ?? [],
    project.customerPlatformTier ?? "",
    (project.platformConfiguration ?? []).map((item) =>
      buildPackageDraft(
        item.productKey,
        item.label,
        item.tier,
        item.quantity,
        item.unitLabel,
        item.notes
      )
    )
  );

  return {
    name: project.name,
    clientName: project.clientName,
    retainerId: project.retainerId ?? null,
    engagementType: project.engagementType,
    scopeType: project.scopeType ?? "discovery",
    serviceFamily: project.serviceFamily,
    implementationApproach: project.implementationApproach ?? "pragmatic_poc",
    customerPlatformTier: project.customerPlatformTier ?? "",
    includesPortalAudit: Boolean(project.includesPortalAudit),
    selectedHubs: project.selectedHubs ?? [],
    platformConfiguration,
    deliveryWorkstreams:
      project.deliveryWorkstreams?.map((workstream) => {
        const ws = workstream as ProjectDetail["deliveryWorkstreams"] extends
          | (infer Item)[]
          | null
          | undefined
          ? Item
          : never;
        const extended = ws as typeof ws & {
          estimatedHours?: number | null;
          hourCap?: number | null;
          billingOwner?: string | null;
          deliveryOwner?: string | null;
          scopeRisk?: string | null;
          notes?: string | null;
        };
        return {
          id: workstream.id,
          name: workstream.name,
          category: workstream.category,
          status: workstream.status,
          owner: workstream.owner,
          summary: workstream.summary,
          portalSummary: workstream.portalSummary ?? "",
          estimatedHours:
            extended.estimatedHours == null
              ? ""
              : String(extended.estimatedHours),
          hourCap: extended.hourCap == null ? "" : String(extended.hourCap),
          billingOwner: extended.billingOwner ?? "",
          deliveryOwner: extended.deliveryOwner ?? "",
          scopeRisk: extended.scopeRisk ?? "",
          notes: extended.notes ?? ""
        };
      }) ?? [],
    internalCommercials: {
      billingRoute: project.internalCommercials?.billingRoute ?? "direct",
      partnerName: project.internalCommercials?.partnerName ?? "",
      notes: project.internalCommercials?.notes ?? "",
      lines:
        project.internalCommercials?.lines.map((line) => ({
          id: line.id,
          workstreamId: line.workstreamId ?? "",
          label: line.label,
          pricingModel: line.pricingModel,
          currency: line.currency,
          mulooBaseAmount:
            line.mulooBaseAmount == null ? "" : String(line.mulooBaseAmount),
          partnerSellAmount:
            line.partnerSellAmount == null
              ? ""
              : String(line.partnerSellAmount),
          billingOwner: line.billingOwner,
          notes: line.notes ?? ""
        })) ?? []
    },
    billingOwner: project.billingOwner ?? "",
    deliveryOwner: project.deliveryOwner ?? "",
    partnerName: project.partnerName ?? ""
  };
}

function DriveFolderSection({
  projectId,
  initialFolderUrl,
  initialFolderId,
  initialLastSyncedAt,
  onChange
}: {
  projectId: string;
  initialFolderUrl: string;
  initialFolderId: string | null;
  initialLastSyncedAt: string | null;
  onChange: (next: {
    googleDriveFolderId: string | null;
    googleDriveFolderUrl: string | null;
    googleDriveLastSyncedAt: string | null;
  }) => void;
}) {
  const [folderUrl, setFolderUrl] = useState(initialFolderUrl);
  const [folderId, setFolderId] = useState<string | null>(initialFolderId);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    initialLastSyncedAt
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncSummary, setSyncSummary] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setError(null);
    setSyncSummary(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/drive-folder`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderUrl })
        }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to link Drive folder");
      }
      setFolderId(body?.project?.googleDriveFolderId ?? null);
      setFolderUrl(body?.project?.googleDriveFolderUrl ?? folderUrl);
      setLastSyncedAt(body?.project?.googleDriveLastSyncedAt ?? null);
      onChange({
        googleDriveFolderId: body?.project?.googleDriveFolderId ?? null,
        googleDriveFolderUrl: body?.project?.googleDriveFolderUrl ?? null,
        googleDriveLastSyncedAt:
          body?.project?.googleDriveLastSyncedAt ?? null
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link folder");
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    setBusy(true);
    setError(null);
    setSyncSummary(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/drive-folder`,
        { method: "DELETE" }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to clear Drive folder");
      }
      setFolderId(null);
      setFolderUrl("");
      setLastSyncedAt(null);
      onChange({
        googleDriveFolderId: null,
        googleDriveFolderUrl: null,
        googleDriveLastSyncedAt: null
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear folder");
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncNow() {
    setBusy(true);
    setError(null);
    setSyncSummary(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/drive-folder/sync`,
        { method: "POST" }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Sync failed");
      }
      const r = body?.result ?? {};
      setSyncSummary(
        `Added ${r.added ?? 0} · updated ${r.updated ?? 0} · skipped ${r.skipped ?? 0}` +
          (Array.isArray(r.errors) && r.errors.length
            ? ` · ${r.errors.length} error${r.errors.length === 1 ? "" : "s"}`
            : "")
      );
      setLastSyncedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="brand-surface rounded-[14px] border p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">
            Discovery context: Google Drive folder
          </h2>
          <p className="mt-2 text-sm text-text-2">
            Link a Drive folder so PDFs, Docs, Sheets, Slides, and DOCX files
            inside it auto-sync into the Discovery context every 5 minutes. The
            workspace Google connection must have drive.readonly granted —
            reconnect Google in Settings if this is the first project to use it.
          </p>
        </div>
        <Pill tone={folderId ? "ok" : "neutral"} dot>
          {folderId ? "Linked" : "Not linked"}
        </Pill>
      </div>

      <label className="mt-5 block">
        <span className="mb-2 block text-sm text-text-2">
          Folder URL or ID
        </span>
        <input
          value={folderUrl}
          onChange={(event) => setFolderUrl(event.target.value)}
          placeholder="https://drive.google.com/drive/folders/..."
          className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
        />
      </label>

      {lastSyncedAt ? (
        <p className="mt-2 text-xs text-text-3">
          Last synced: {new Date(lastSyncedAt).toLocaleString()}
        </p>
      ) : null}

      {syncSummary ? (
        <p className="mt-2 text-xs text-status-ok">{syncSummary}</p>
      ) : null}

      {error ? (
        <p className="mt-2 text-xs text-status-error">{error}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={busy || !folderUrl.trim()}
          className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Working..." : folderId ? "Update link" : "Link folder"}
        </button>
        {folderId ? (
          <button
            type="button"
            onClick={() => void handleSyncNow()}
            disabled={busy}
            className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-text-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Sync now
          </button>
        ) : null}
        {folderId ? (
          <button
            type="button"
            onClick={() => void handleClear()}
            disabled={busy}
            className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-text-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Clear
          </button>
        ) : null}
      </div>
    </section>
  );
}

const EXTERNAL_APPROVAL_CURRENCIES: RetainerCurrency[] = [
  "ZAR",
  "USD",
  "GBP",
  "EUR",
  "AUD",
  "CAD"
];

function formatExternalApprovalAmount(value: number, currency: string) {
  if (!Number.isFinite(value) || value === 0) return `${currency} 0`;
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-GB")}`;
  }
}

function ExternalApprovalSection({
  projectId,
  initial,
  hasInPlatformApprovedQuote,
  onChange
}: {
  projectId: string;
  initial: ExternalApproval | null;
  hasInPlatformApprovedQuote: boolean;
  onChange: (next: ExternalApproval | null) => void;
}) {
  const [current, setCurrent] = useState<ExternalApproval | null>(initial);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayIso = new Date().toISOString().slice(0, 10);
  const [valueInput, setValueInput] = useState<string>(
    current?.value ? String(current.value) : ""
  );
  const [currency, setCurrency] = useState<string>(current?.currency ?? "ZAR");
  const [approvedAt, setApprovedAt] = useState<string>(
    current?.approvedAt ? current.approvedAt.slice(0, 10) : todayIso
  );
  const [approvedByName, setApprovedByName] = useState<string>(
    current?.approvedByName ?? ""
  );
  const [approvedByEmail, setApprovedByEmail] = useState<string>(
    current?.approvedByEmail ?? ""
  );
  const [docUrl, setDocUrl] = useState<string>(current?.docUrl ?? "");
  const [source, setSource] = useState<string>(current?.source ?? "");
  const [notes, setNotes] = useState<string>(current?.notes ?? "");

  function resetFormFromCurrent(next: ExternalApproval | null) {
    setValueInput(next?.value ? String(next.value) : "");
    setCurrency(next?.currency ?? "ZAR");
    setApprovedAt(
      next?.approvedAt ? next.approvedAt.slice(0, 10) : todayIso
    );
    setApprovedByName(next?.approvedByName ?? "");
    setApprovedByEmail(next?.approvedByEmail ?? "");
    setDocUrl(next?.docUrl ?? "");
    setSource(next?.source ?? "");
    setNotes(next?.notes ?? "");
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const parsedValue = Number(valueInput);
      if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        throw new Error("Amount must be greater than zero.");
      }
      if (!approvedByName.trim()) {
        throw new Error("Approver name is required.");
      }
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/external-approval`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            value: parsedValue,
            currency,
            approvedAt,
            approvedByName: approvedByName.trim(),
            approvedByEmail: approvedByEmail.trim() || null,
            docUrl: docUrl.trim() || null,
            source: source.trim() || null,
            notes: notes.trim() || null
          })
        }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save external approval");
      }
      const nextApproval: ExternalApproval | null =
        body?.project?.externalApproval ?? null;
      setCurrent(nextApproval);
      resetFormFromCurrent(nextApproval);
      onChange(nextApproval);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Clear external approval? Project will revert to draft unless an in-platform quote is also approved."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/external-approval`,
        { method: "DELETE" }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to clear external approval");
      }
      setCurrent(null);
      resetFormFromCurrent(null);
      onChange(null);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear");
    } finally {
      setBusy(false);
    }
  }

  if (!editing && current) {
    return (
      <section className="brand-surface rounded-[14px] border p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-text-3">
              External approval
            </p>
            <h3 className="mt-1 text-lg font-semibold text-white">
              {formatExternalApprovalAmount(current.value, current.currency)}
            </h3>
          </div>
          <Pill tone="ok" dot>
            Approved
          </Pill>
        </div>
        <dl className="mt-4 space-y-2 text-sm text-text-2">
          <div>
            <dt className="text-text-3">Approved by</dt>
            <dd className="text-white">
              {current.approvedByName ?? "—"}
              {current.approvedByEmail ? (
                <span className="ml-2 text-text-3">
                  &lt;{current.approvedByEmail}&gt;
                </span>
              ) : null}
            </dd>
          </div>
          {current.approvedAt ? (
            <div>
              <dt className="text-text-3">Approved on</dt>
              <dd className="text-white">
                {new Date(current.approvedAt).toLocaleDateString("en-GB")}
              </dd>
            </div>
          ) : null}
          {current.source ? (
            <div>
              <dt className="text-text-3">Source</dt>
              <dd className="text-white">{current.source}</dd>
            </div>
          ) : null}
          {current.docUrl ? (
            <div>
              <dt className="text-text-3">Document</dt>
              <dd>
                <a
                  href={current.docUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-solid underline"
                >
                  Open
                </a>
              </dd>
            </div>
          ) : null}
          {current.notes ? (
            <div>
              <dt className="text-text-3">Notes</dt>
              <dd className="whitespace-pre-wrap text-white">
                {current.notes}
              </dd>
            </div>
          ) : null}
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={busy}
            className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-text-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => void handleClear()}
            disabled={busy}
            className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-status-error disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Clearing..." : "Clear"}
          </button>
        </div>
      </section>
    );
  }

  if (!editing) {
    return (
      <section className="brand-surface rounded-[14px] border p-6">
        <p className="text-xs uppercase tracking-[0.14em] text-text-3">
          External approval
        </p>
        <p className="mt-3 text-sm text-text-2">
          Use this when a quote was approved outside the platform (signed PDF,
          email, etc.). Marks the project as approved, locks scope, and feeds
          the value into Financials.
        </p>
        {hasInPlatformApprovedQuote ? (
          <p className="mt-3 text-xs text-text-3">
            This project already has an approved in-platform quote, so external
            approval is disabled to avoid double-counting.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={hasInPlatformApprovedQuote}
          className="mt-5 w-full rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
        >
          Mark externally approved
        </button>
      </section>
    );
  }

  return (
    <section className="brand-surface rounded-[14px] border p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-text-3">
            External approval
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white">
            {current ? "Edit approval" : "Mark externally approved"}
          </h3>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        <label className="block">
          <span className="mb-2 block text-sm text-text-2">
            Approved amount
          </span>
          <div className="flex gap-2">
            <input
              value={valueInput}
              onChange={(event) => setValueInput(event.target.value)}
              inputMode="decimal"
              placeholder="120000"
              className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
            />
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="rounded-xl border border-ink-4 bg-ink-2 px-3 py-3 text-white outline-none focus:border-accent-solid"
            >
              {EXTERNAL_APPROVAL_CURRENCIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm text-text-2">Approved on</span>
          <input
            type="date"
            value={approvedAt}
            max={todayIso}
            onChange={(event) => setApprovedAt(event.target.value)}
            className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm text-text-2">Approver name</span>
          <input
            value={approvedByName}
            onChange={(event) => setApprovedByName(event.target.value)}
            placeholder="Khanyisile Mathebula"
            className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm text-text-2">
            Approver email (optional)
          </span>
          <input
            type="email"
            value={approvedByEmail}
            onChange={(event) => setApprovedByEmail(event.target.value)}
            placeholder="name@client.com"
            className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm text-text-2">
            Document URL (PDF, Drive link)
          </span>
          <input
            value={docUrl}
            onChange={(event) => setDocUrl(event.target.value)}
            placeholder="https://drive.google.com/file/d/..."
            className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm text-text-2">Source label</span>
          <input
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="Email reply 12 May 2026"
            className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm text-text-2">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional context — discovery workstream approved, payment terms, etc."
            className="min-h-[80px] w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
          />
        </label>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-status-error">{error}</p>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={busy}
          className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Saving..." : current ? "Save changes" : "Mark approved"}
        </button>
        <button
          type="button"
          onClick={() => {
            resetFormFromCurrent(current);
            setEditing(false);
            setError(null);
          }}
          disabled={busy}
          className="brand-input rounded-xl px-4 py-3 text-sm font-medium text-text-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}

export default function ProjectEditWorkspace({
  projectId
}: {
  projectId: string;
}) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [retainers, setRetainers] = useState<RetainerOption[]>([]);
  const [loadingRetainers, setLoadingRetainers] = useState(false);

  useEffect(() => {
    async function loadProject() {
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}`
        );
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(body?.error ?? "Failed to load project");
        }

        const nextProject = body?.project as ProjectDetail;
        setProject(nextProject);
        setForm(buildInitialForm(nextProject));
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load project"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadProject();
  }, [projectId]);

  useEffect(() => {
    async function loadRetainers() {
      if (!project?.clientId) {
        return;
      }

      setLoadingRetainers(true);
      try {
        const response = await fetch(
          `/api/clients/${encodeURIComponent(project.clientId)}/retainers`
        );
        const body = await response.json().catch(() => null);

        if (response.ok && Array.isArray(body?.retainers)) {
          setRetainers(body.retainers);
        }
      } catch {
        // Silently fail, retainers are optional
      } finally {
        setLoadingRetainers(false);
      }
    }

    void loadRetainers();
  }, [project?.clientId]);

  useEffect(() => {
    setForm((current) => {
      if (!current) {
        return current;
      }

      const nextPackages = syncPlatformConfiguration(
        current.selectedHubs,
        current.customerPlatformTier,
        current.platformConfiguration
      );

      return JSON.stringify(nextPackages) ===
        JSON.stringify(current.platformConfiguration)
        ? current
        : {
            ...current,
            platformConfiguration: nextPackages
          };
    });
  }, [form?.selectedHubs, form?.customerPlatformTier]);

  const dirty = useMemo(() => {
    if (!project || !form) {
      return false;
    }

    const baseline = buildInitialForm(project);
    return JSON.stringify(form) !== JSON.stringify(baseline);
  }, [form, project]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setValidationError(null);
    setError(null);
  }

  function toggleHub(hubId: string) {
    setForm((current) => {
      if (!current) {
        return current;
      }

      const selectedHubs = current.selectedHubs.includes(hubId)
        ? current.selectedHubs.filter((hub) => hub !== hubId)
        : [...current.selectedHubs, hubId];

      return { ...current, selectedHubs };
    });
    setValidationError(null);
    setError(null);
  }

  function updatePackageField(
    productKey: string,
    field: keyof PlatformPackageDraft,
    value: string
  ) {
    setForm((current) =>
      current
        ? {
            ...current,
            platformConfiguration: current.platformConfiguration.map((item) =>
              item.productKey === productKey
                ? { ...item, [field]: value }
                : item
            )
          }
        : current
    );
    setValidationError(null);
    setError(null);
  }

  function updateWorkstreamField(
    workstreamId: string,
    field: keyof WorkstreamDraft,
    value: string
  ) {
    setForm((current) =>
      current
        ? {
            ...current,
            deliveryWorkstreams: current.deliveryWorkstreams.map(
              (workstream) =>
                workstream.id === workstreamId
                  ? { ...workstream, [field]: value }
                  : workstream
            )
          }
        : current
    );
    setValidationError(null);
    setError(null);
  }

  function addWorkstream() {
    setForm((current) =>
      current
        ? {
            ...current,
            deliveryWorkstreams: [
              ...current.deliveryWorkstreams,
              createWorkstreamDraft(current.deliveryWorkstreams.length)
            ]
          }
        : current
    );
  }

  function removeWorkstream(workstreamId: string) {
    setForm((current) =>
      current
        ? {
            ...current,
            deliveryWorkstreams: current.deliveryWorkstreams.filter(
              (workstream) => workstream.id !== workstreamId
            ),
            internalCommercials: {
              ...current.internalCommercials,
              lines: current.internalCommercials.lines.map((line) =>
                line.workstreamId === workstreamId
                  ? { ...line, workstreamId: "" }
                  : line
              )
            }
          }
        : current
    );
  }

  function updateCommercialsField(
    field: keyof Omit<InternalCommercialsDraft, "lines">,
    value: string
  ) {
    setForm((current) =>
      current
        ? {
            ...current,
            internalCommercials: {
              ...current.internalCommercials,
              [field]: value
            }
          }
        : current
    );
  }

  function updateCommercialLineField(
    lineId: string,
    field: keyof CommercialLineDraft,
    value: string
  ) {
    setForm((current) =>
      current
        ? {
            ...current,
            internalCommercials: {
              ...current.internalCommercials,
              lines: current.internalCommercials.lines.map((line) =>
                line.id === lineId ? { ...line, [field]: value } : line
              )
            }
          }
        : current
    );
  }

  function addCommercialLine() {
    setForm((current) =>
      current
        ? {
            ...current,
            internalCommercials: {
              ...current.internalCommercials,
              lines: [
                ...current.internalCommercials.lines,
                createCommercialLineDraft(
                  current.internalCommercials.lines.length
                )
              ]
            }
          }
        : current
    );
  }

  function removeCommercialLine(lineId: string) {
    setForm((current) =>
      current
        ? {
            ...current,
            internalCommercials: {
              ...current.internalCommercials,
              lines: current.internalCommercials.lines.filter(
                (line) => line.id !== lineId
              )
            }
          }
        : current
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form) {
      return;
    }

    if (!form.name.trim() || !form.clientName.trim()) {
      setValidationError("Project name and client name are required.");
      return;
    }

    if (
      form.scopeType !== "standalone_quote" &&
      form.selectedHubs.length === 0
    ) {
      setValidationError(
        "Pick at least one hub unless this is a standalone quote."
      );
      return;
    }

    setSaving(true);
    setValidationError(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: form.name,
            clientName: form.clientName,
            retainerId: form.retainerId,
            type: form.engagementType,
            scopeType: form.scopeType,
            serviceFamily: form.serviceFamily,
            implementationApproach: form.implementationApproach,
            customerPlatformTier: form.customerPlatformTier,
            platformConfiguration: form.platformConfiguration.map((item) => ({
              productKey: item.productKey,
              label: item.label,
              tier: item.tier,
              quantity:
                item.quantity.trim().length > 0 ? Number(item.quantity) : null,
              unitLabel: item.unitLabel,
              notes: item.notes
            })),
            platformTierSelections: Object.fromEntries(
              form.platformConfiguration
                .filter((item) => item.tier.trim().length > 0)
                .map((item) => [item.productKey, item.tier])
            ),
            includesPortalAudit: form.includesPortalAudit,
            hubs: form.selectedHubs,
            billingOwner: form.billingOwner.trim() || null,
            deliveryOwner: form.deliveryOwner.trim() || null,
            partnerName: form.partnerName.trim() || null,
            deliveryWorkstreams: form.deliveryWorkstreams.map((ws) => ({
              ...ws,
              estimatedHours:
                ws.estimatedHours.trim().length > 0
                  ? Number(ws.estimatedHours)
                  : null,
              hourCap: ws.hourCap.trim().length > 0 ? Number(ws.hourCap) : null,
              billingOwner: ws.billingOwner.trim() || null,
              deliveryOwner: ws.deliveryOwner.trim() || null,
              scopeRisk: ws.scopeRisk.trim() || null,
              notes: ws.notes.trim() || null
            })),
            internalCommercials: {
              billingRoute: form.internalCommercials.billingRoute,
              partnerName: form.internalCommercials.partnerName,
              notes: form.internalCommercials.notes,
              lines: form.internalCommercials.lines.map((line) => ({
                ...line,
                workstreamId: line.workstreamId || null,
                mulooBaseAmount:
                  line.mulooBaseAmount.trim().length > 0
                    ? Number(line.mulooBaseAmount)
                    : null,
                partnerSellAmount:
                  line.partnerSellAmount.trim().length > 0
                    ? Number(line.partnerSellAmount)
                    : null
              }))
            }
          })
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to update project");
      }

      // updateProjectRecord ignores retainerId; route it through the
      // dedicated PATCH /retainer endpoint so the link actually persists.
      const retainerResponse = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/retainer`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ retainerId: form.retainerId ?? null })
        }
      );
      const retainerBody = await retainerResponse.json().catch(() => null);
      if (!retainerResponse.ok) {
        throw new Error(
          retainerBody?.error ?? "Failed to link retainer to project"
        );
      }

      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to update project"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <ProjectWorkspaceView projectId={projectId} activeTab="settings">
        <SkeletonRows
          count={3}
          height="h-28"
          gap="gap-4"
          rounded="rounded-[14px]"
        />
      </ProjectWorkspaceView>
    );
  }

  if (!project || !form) {
    return (
      <ProjectWorkspaceView projectId={projectId} activeTab="settings">
        <div className="rounded-[14px] border border-status-error/30 bg-status-error/10 p-8 text-white">
          {error ?? "Project not found"}
        </div>
      </ProjectWorkspaceView>
    );
  }

  return (
    <ProjectWorkspaceView projectId={projectId} activeTab="settings">
      <div className="space-y-6">
        <PageHead
          eyebrow={
            <Link
              href={`/projects/${project.id}`}
              className="hover:text-text-1 transition-colors"
            >
              ← Project workspace
            </Link>
          }
          title="Edit project"
          lede="Update this project in place when the work changes shape. No more cloning the whole thing just to move it into the right project type."
          actions={
            <>
              <Pill tone="info" dot>
                {formatTokenLabel(project.status)}
              </Pill>
              <Link
                href={`/projects/${project.id}`}
                className="brand-input rounded-xl px-4 py-2 text-sm font-medium text-text-2"
              >
                Cancel
              </Link>
            </>
          }
        />

        <form
          onSubmit={handleSubmit}
          className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]"
        >
          <div className="space-y-6">
            <section className="brand-surface rounded-[14px] border p-6">
              <h2 className="text-xl font-semibold text-white">Core details</h2>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-text-2">
                    Project name
                  </span>
                  <input
                    value={form.name}
                    onChange={(event) =>
                      updateField("name", event.target.value)
                    }
                    className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-text-2">
                    Client name
                  </span>
                  <input
                    value={form.clientName}
                    onChange={(event) =>
                      updateField("clientName", event.target.value)
                    }
                    className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm text-text-2">
                    Service family
                  </span>
                  <select
                    value={form.serviceFamily}
                    onChange={(event) =>
                      updateField("serviceFamily", event.target.value)
                    }
                    className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
                  >
                    {serviceFamilies.map((family) => (
                      <option key={family.id} value={family.id}>
                        {family.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-text-3">
                    {
                      serviceFamilies.find(
                        (family) => family.id === form.serviceFamily
                      )?.description
                    }
                  </p>
                </label>
              </div>
            </section>

            <DriveFolderSection
              projectId={project.id}
              initialFolderUrl={project.googleDriveFolderUrl ?? ""}
              initialFolderId={project.googleDriveFolderId ?? null}
              initialLastSyncedAt={project.googleDriveLastSyncedAt ?? null}
              onChange={(next) => {
                setProject((current) =>
                  current
                    ? {
                        ...current,
                        googleDriveFolderId: next.googleDriveFolderId,
                        googleDriveFolderUrl: next.googleDriveFolderUrl,
                        googleDriveLastSyncedAt: next.googleDriveLastSyncedAt
                      }
                    : current
                );
              }}
            />

            <section className="brand-surface rounded-[14px] border p-6">
              <h2 className="text-xl font-semibold text-white">
                Engagement shape
              </h2>
              <div className="mt-6 space-y-6">
                <div>
                  <p className="mb-3 text-sm text-text-2">Project type</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    {engagementTypes.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() =>
                          setForm((current) =>
                            current
                              ? {
                                  ...current,
                                  engagementType: type.id,
                                  includesPortalAudit:
                                    type.id === "OPTIMISATION" ||
                                    type.id === "AUDIT"
                                      ? true
                                      : current.includesPortalAudit
                                }
                              : current
                          )
                        }
                        className={`rounded-[14px] border p-4 text-left transition-colors ${
                          form.engagementType === type.id
                            ? "border-accent-solid bg-ink-2"
                            : "border-ink-4 bg-ink-2"
                        }`}
                      >
                        <p className="font-semibold text-white">{type.label}</p>
                        <p className="mt-1 text-sm text-text-2">
                          {type.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-sm text-text-2">Project container</p>
                  <div className="grid gap-4 md:grid-cols-3">
                    {scopeTypes.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() =>
                          setForm((current) =>
                            current
                              ? {
                                  ...current,
                                  scopeType: type.id,
                                  selectedHubs:
                                    type.id === "standalone_quote"
                                      ? current.selectedHubs
                                      : current.selectedHubs
                                }
                              : current
                          )
                        }
                        className={`rounded-[14px] border p-4 text-left transition-colors ${
                          form.scopeType === type.id
                            ? "border-accent-solid bg-ink-2"
                            : "border-ink-4 bg-ink-2"
                        }`}
                      >
                        <p className="font-semibold text-white">{type.label}</p>
                        <p className="mt-1 text-sm text-text-2">
                          {type.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-3 rounded-[14px] border border-ink-4 bg-ink-2 px-4 py-4 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={form.includesPortalAudit}
                    onChange={(event) =>
                      updateField("includesPortalAudit", event.target.checked)
                    }
                  />
                  Include portal audit
                </label>
              </div>
            </section>

            <section className="brand-surface rounded-[14px] border p-6">
              <h2 className="text-xl font-semibold text-white">
                Linked retainer
              </h2>
              <p className="mt-2 text-sm text-text-2">
                Link this project to an existing retainer for the client, or
                leave unlinked.
              </p>
              <div className="mt-6 space-y-6">
                <label className="block">
                  <span className="mb-2 block text-sm text-text-2">
                    Select retainer
                  </span>
                  <select
                    value={form.retainerId ?? ""}
                    onChange={(event) =>
                      updateField(
                        "retainerId",
                        event.target.value ? event.target.value : null
                      )
                    }
                    disabled={loadingRetainers}
                    className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid disabled:opacity-60"
                  >
                    <option value="">No retainer linked</option>
                    {retainers.map((retainer) => {
                      const label = `${
                        retainer.serviceLine === "TECHNICAL_DELIVERY"
                          ? "Technical Delivery"
                          : "Consulting"
                      } · ${retainer.blockSize}h/month · R${retainer.rate}/hr · ${retainer.status}`;
                      return (
                        <option key={retainer.id} value={retainer.id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </label>

                {form.retainerId &&
                  (() => {
                    const selectedRetainer = retainers.find(
                      (r) => r.id === form.retainerId
                    );
                    if (!selectedRetainer) return null;

                    return (
                      <div className="rounded-[14px] border border-ink-4 bg-ink-2 p-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs text-text-3">Service line</p>
                            <p className="mt-1 text-sm text-white">
                              {selectedRetainer.serviceLine ===
                              "TECHNICAL_DELIVERY"
                                ? "Technical Delivery"
                                : "Consulting"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-text-3">Block size</p>
                            <p className="mt-1 text-sm text-white">
                              {selectedRetainer.blockSize}h/month
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-text-3">Rate</p>
                            <p className="mt-1 text-sm text-white">
                              {selectedRetainer.currency}{" "}
                              {selectedRetainer.rate}/hr
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-text-3">Currency</p>
                            <p className="mt-1 text-sm text-white">
                              {selectedRetainer.currency}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-text-3">Start date</p>
                            <p className="mt-1 text-sm text-white">
                              {new Date(
                                selectedRetainer.startDate
                              ).toLocaleDateString("en-ZA", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric"
                              })}
                            </p>
                          </div>
                          {selectedRetainer.endDate ? (
                            <div>
                              <p className="text-xs text-text-3">End date</p>
                              <p className="mt-1 text-sm text-white">
                                {new Date(
                                  selectedRetainer.endDate
                                ).toLocaleDateString("en-ZA", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric"
                                })}
                              </p>
                            </div>
                          ) : null}
                          <div>
                            <p className="text-xs text-text-3">Status</p>
                            <p className="mt-1 text-sm text-white">
                              {selectedRetainer.status}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                <Link
                  href={`/retainers?clientId=${encodeURIComponent(
                    project?.clientId ?? ""
                  )}`}
                  className="inline-flex items-center gap-2 text-sm text-accent-solid hover:text-accent-solid/80"
                >
                  Create new retainer →
                </Link>
              </div>
            </section>

            <section className="brand-surface rounded-[14px] border p-6">
              <h2 className="text-xl font-semibold text-white">
                Delivery settings
              </h2>
              <div className="mt-6 grid gap-6 lg:grid-cols-[0.42fr_0.58fr]">
                <div className="space-y-5">
                  <div>
                    <span className="mb-2 block text-sm text-text-2">
                      Delivery approach
                    </span>
                    <div className="grid gap-3">
                      {implementationApproachOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            updateField("implementationApproach", option.value)
                          }
                          className={`rounded-[14px] border p-4 text-left transition-colors ${
                            form.implementationApproach === option.value
                              ? "border-accent-solid bg-ink-2"
                              : "border-ink-4 bg-ink-2"
                          }`}
                        >
                          <p className="font-semibold text-white">
                            {option.label}
                          </p>
                          <p className="mt-1 text-sm text-text-2">
                            {option.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm text-text-2">
                      Overall HubSpot plan tier
                    </span>
                    <select
                      value={form.customerPlatformTier}
                      onChange={(event) =>
                        updateField("customerPlatformTier", event.target.value)
                      }
                      className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none focus:border-accent-solid"
                    >
                      {customerPlatformTierOptions.map((option) => (
                        <option
                          key={option.value || "blank"}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm text-text-2">
                    <span>Hubs in scope</span>
                  </div>
                  <p className="mb-3 text-sm text-text-3">
                    {form.scopeType === "standalone_quote"
                      ? "Optional for standalone quotes."
                      : "Pick the hubs this project actually covers now."}
                  </p>
                  <p className="mb-3 text-xs uppercase tracking-[0.14em] text-text-3">
                    Core hubs
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {coreHubOptions.map((hub) => (
                      <button
                        key={hub.id}
                        type="button"
                        onClick={() => toggleHub(hub.id)}
                        className={`rounded-[14px] border p-4 text-left transition-colors ${
                          form.selectedHubs.includes(hub.id)
                            ? "border-accent-solid bg-ink-2"
                            : "border-ink-4 bg-ink-2"
                        }`}
                      >
                        <p className="font-semibold text-white">{hub.label}</p>
                      </button>
                    ))}
                  </div>
                  <p className="mb-3 mt-5 text-xs uppercase tracking-[0.14em] text-text-3">
                    Add-ons in scope
                  </p>
                  <div className="grid gap-3 md:grid-cols-3">
                    {addOnHubOptions.map((hub) => (
                      <button
                        key={hub.id}
                        type="button"
                        onClick={() => toggleHub(hub.id)}
                        className={`rounded-[14px] border p-4 text-left transition-colors ${
                          form.selectedHubs.includes(hub.id)
                            ? "border-accent-solid bg-ink-2"
                            : "border-ink-4 bg-ink-2"
                        }`}
                      >
                        <p className="font-semibold text-white">{hub.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {form.platformConfiguration.length > 0 ? (
                <div className="mt-6 rounded-[14px] border border-ink-4 bg-ink-2 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-white">
                        Hub package detail
                      </p>
                      <p className="mt-1 text-sm text-text-2">
                        Set the actual package per product. This is where a
                        build like Magnisol can mix Content Pro, Marketing
                        Starter, and Sales Pro with license counts.
                      </p>
                    </div>
                    <span className="rounded-full border border-ink-4 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-text-3">
                      Operator only
                    </span>
                  </div>
                  <div className="mt-4 space-y-4">
                    {form.platformConfiguration.map((item) => (
                      <div
                        key={item.productKey}
                        className="grid gap-4 rounded-[14px] border border-ink-4 bg-ink-2 p-4 lg:grid-cols-[minmax(0,1.1fr)_repeat(3,minmax(0,0.6fr))]"
                      >
                        <div>
                          <p className="font-medium text-white">{item.label}</p>
                          <p className="mt-1 text-xs text-text-3">
                            {formatTokenLabel(item.productKey)}
                          </p>
                          <textarea
                            value={item.notes}
                            onChange={(event) =>
                              updatePackageField(
                                item.productKey,
                                "notes",
                                event.target.value
                              )
                            }
                            placeholder="Notes, constraints, or packaging context"
                            className="mt-3 min-h-[90px] w-full rounded-xl border border-ink-4 bg-ink-2 px-3 py-2.5 text-sm text-white outline-none"
                          />
                        </div>
                        <label className="block">
                          <span className="mb-2 block text-sm text-text-2">
                            Tier
                          </span>
                          <select
                            value={item.tier}
                            onChange={(event) =>
                              updatePackageField(
                                item.productKey,
                                "tier",
                                event.target.value
                              )
                            }
                            className="w-full rounded-xl border border-ink-4 bg-ink-2 px-3 py-2.5 text-white outline-none"
                          >
                            {hubTierOptions.map((option) => (
                              <option
                                key={`${item.productKey}-${option.value || "blank"}`}
                                value={option.value}
                              >
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm text-text-2">
                            Quantity
                          </span>
                          <input
                            value={item.quantity}
                            onChange={(event) =>
                              updatePackageField(
                                item.productKey,
                                "quantity",
                                event.target.value
                              )
                            }
                            placeholder="1"
                            className="w-full rounded-xl border border-ink-4 bg-ink-2 px-3 py-2.5 text-white outline-none"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm text-text-2">
                            Unit label
                          </span>
                          <input
                            value={item.unitLabel}
                            onChange={(event) =>
                              updatePackageField(
                                item.productKey,
                                "unitLabel",
                                event.target.value
                              )
                            }
                            placeholder="licenses"
                            className="w-full rounded-xl border border-ink-4 bg-ink-2 px-3 py-2.5 text-white outline-none"
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="brand-surface rounded-[14px] border p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Delivery workstreams
                  </h2>
                  <p className="mt-2 text-sm text-text-2">
                    Model one project as multiple overlapping streams so
                    discovery, website, and HubSpot implementation can stay
                    together without flattening the delivery shape.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addWorkstream}
                  className="rounded-xl border border-ink-4 bg-ink-2 px-4 py-2 text-sm font-medium text-white"
                >
                  Add workstream
                </button>
              </div>
              <div className="mt-6 space-y-4">
                {form.deliveryWorkstreams.length === 0 ? (
                  <div className="rounded-[14px] border border-dashed border-ink-4 bg-ink-2 p-5 text-sm text-text-2">
                    No workstreams yet. For Magnisol you’d typically break this
                    into Discovery, Website, and HubSpot implementation.
                  </div>
                ) : (
                  form.deliveryWorkstreams.map((workstream) => (
                    <div
                      key={workstream.id}
                      className="rounded-[14px] border border-ink-4 bg-ink-2 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="grid flex-1 gap-4 lg:grid-cols-2">
                          <label className="block">
                            <span className="mb-2 block text-sm text-text-2">
                              Workstream name
                            </span>
                            <input
                              value={workstream.name}
                              onChange={(event) =>
                                updateWorkstreamField(
                                  workstream.id,
                                  "name",
                                  event.target.value
                                )
                              }
                              placeholder="Discovery"
                              className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-sm text-text-2">
                              Category
                            </span>
                            <select
                              value={workstream.category}
                              onChange={(event) =>
                                updateWorkstreamField(
                                  workstream.id,
                                  "category",
                                  event.target.value
                                )
                              }
                              className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none"
                            >
                              {workstreamCategoryOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-sm text-text-2">
                              Status
                            </span>
                            <select
                              value={workstream.status}
                              onChange={(event) =>
                                updateWorkstreamField(
                                  workstream.id,
                                  "status",
                                  event.target.value
                                )
                              }
                              className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none"
                            >
                              {workstreamStatusOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-sm text-text-2">
                              Delivery owner
                            </span>
                            <select
                              value={workstream.owner}
                              onChange={(event) =>
                                updateWorkstreamField(
                                  workstream.id,
                                  "owner",
                                  event.target.value
                                )
                              }
                              className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none"
                            >
                              {workstreamOwnerOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeWorkstream(workstream.id)}
                          className="rounded-xl border border-ink-4 px-3 py-2 text-sm text-text-2 hover:text-white"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <label className="block">
                          <span className="mb-2 block text-sm text-text-2">
                            Internal summary
                          </span>
                          <textarea
                            value={workstream.summary}
                            onChange={(event) =>
                              updateWorkstreamField(
                                workstream.id,
                                "summary",
                                event.target.value
                              )
                            }
                            placeholder="What this stream covers internally"
                            className="min-h-[120px] w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm text-text-2">
                            Portal summary
                          </span>
                          <textarea
                            value={workstream.portalSummary}
                            onChange={(event) =>
                              updateWorkstreamField(
                                workstream.id,
                                "portalSummary",
                                event.target.value
                              )
                            }
                            placeholder="What client and partner portal users should see"
                            className="min-h-[120px] w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none"
                          />
                        </label>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="brand-surface rounded-[14px] border p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-white">
                      Internal commercials
                    </h2>
                    <span className="rounded-full border border-ink-4 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-text-3">
                      Internal only
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-text-2">
                    Track Muloo base numbers and partner-marked-up numbers here.
                    These figures stay on the operator side and never show in
                    the client or partner portals.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addCommercialLine}
                  className="rounded-xl border border-ink-4 bg-ink-2 px-4 py-2 text-sm font-medium text-white"
                >
                  Add commercial line
                </button>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                <label className="block">
                  <span className="mb-2 block text-sm text-text-2">
                    Billing route
                  </span>
                  <select
                    value={form.internalCommercials.billingRoute}
                    onChange={(event) =>
                      updateCommercialsField("billingRoute", event.target.value)
                    }
                    className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none"
                  >
                    {billingRouteOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-text-2">
                    Partner name
                  </span>
                  <input
                    value={form.internalCommercials.partnerName}
                    onChange={(event) =>
                      updateCommercialsField("partnerName", event.target.value)
                    }
                    placeholder="Tusk"
                    className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-text-2">Notes</span>
                  <input
                    value={form.internalCommercials.notes}
                    onChange={(event) =>
                      updateCommercialsField("notes", event.target.value)
                    }
                    placeholder="Markup handled through partner"
                    className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none"
                  />
                </label>
              </div>

              <div className="mt-6 space-y-4">
                {form.internalCommercials.lines.length === 0 ? (
                  <div className="rounded-[14px] border border-dashed border-ink-4 bg-ink-2 p-5 text-sm text-text-2">
                    No commercial lines yet. Add the streams you want to track,
                    like Discovery fixed fee, Website build, HubSpot rollout,
                    pass-through theme cost, or partner markup lines.
                  </div>
                ) : (
                  form.internalCommercials.lines.map((line) => (
                    <div
                      key={line.id}
                      className="rounded-[14px] border border-ink-4 bg-ink-2 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="grid flex-1 gap-4 lg:grid-cols-3">
                          <label className="block lg:col-span-2">
                            <span className="mb-2 block text-sm text-text-2">
                              Line item
                            </span>
                            <input
                              value={line.label}
                              onChange={(event) =>
                                updateCommercialLineField(
                                  line.id,
                                  "label",
                                  event.target.value
                                )
                              }
                              placeholder="HubSpot rollout"
                              className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-sm text-text-2">
                              Workstream
                            </span>
                            <select
                              value={line.workstreamId}
                              onChange={(event) =>
                                updateCommercialLineField(
                                  line.id,
                                  "workstreamId",
                                  event.target.value
                                )
                              }
                              className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none"
                            >
                              <option value="">Unlinked</option>
                              {form.deliveryWorkstreams.map((workstream) => (
                                <option
                                  key={workstream.id}
                                  value={workstream.id}
                                >
                                  {workstream.name || workstream.id}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-sm text-text-2">
                              Pricing model
                            </span>
                            <select
                              value={line.pricingModel}
                              onChange={(event) =>
                                updateCommercialLineField(
                                  line.id,
                                  "pricingModel",
                                  event.target.value
                                )
                              }
                              className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none"
                            >
                              {commercialPricingModelOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-sm text-text-2">
                              Currency
                            </span>
                            <input
                              value={line.currency}
                              onChange={(event) =>
                                updateCommercialLineField(
                                  line.id,
                                  "currency",
                                  event.target.value.toUpperCase()
                                )
                              }
                              className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-sm text-text-2">
                              Muloo base
                            </span>
                            <input
                              value={line.mulooBaseAmount}
                              onChange={(event) =>
                                updateCommercialLineField(
                                  line.id,
                                  "mulooBaseAmount",
                                  event.target.value
                                )
                              }
                              placeholder="12000"
                              className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-sm text-text-2">
                              Partner sell / markup
                            </span>
                            <input
                              value={line.partnerSellAmount}
                              onChange={(event) =>
                                updateCommercialLineField(
                                  line.id,
                                  "partnerSellAmount",
                                  event.target.value
                                )
                              }
                              placeholder="15000"
                              className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-sm text-text-2">
                              Billing owner
                            </span>
                            <select
                              value={line.billingOwner}
                              onChange={(event) =>
                                updateCommercialLineField(
                                  line.id,
                                  "billingOwner",
                                  event.target.value
                                )
                              }
                              className="w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none"
                            >
                              {commercialOwnerOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCommercialLine(line.id)}
                          className="rounded-xl border border-ink-4 px-3 py-2 text-sm text-text-2 hover:text-white"
                        >
                          Remove
                        </button>
                      </div>
                      <label className="mt-4 block">
                        <span className="mb-2 block text-sm text-text-2">
                          Notes
                        </span>
                        <textarea
                          value={line.notes}
                          onChange={(event) =>
                            updateCommercialLineField(
                              line.id,
                              "notes",
                              event.target.value
                            )
                          }
                          placeholder="Internal-only context for billing, pass-throughs, or partner handling"
                          className="min-h-[100px] w-full rounded-xl border border-ink-4 bg-ink-2 px-4 py-3 text-white outline-none"
                        />
                      </label>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <ExternalApprovalSection
              projectId={project.id}
              initial={project.externalApproval ?? null}
              hasInPlatformApprovedQuote={
                project.quoteApprovalStatus === "approved" &&
                !project.externalApproval
              }
              onChange={(next) =>
                setProject((current) =>
                  current ? { ...current, externalApproval: next } : current
                )
              }
            />
            <section className="brand-surface rounded-[14px] border p-6">
              <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                Current shape
              </p>
              <div className="mt-4 space-y-3 text-sm text-text-2">
                <p>
                  <span className="font-medium text-white">Type:</span>{" "}
                  {formatTokenLabel(project.engagementType)}
                </p>
                <p>
                  <span className="font-medium text-white">Container:</span>{" "}
                  {formatTokenLabel(project.scopeType)}
                </p>
                <p>
                  <span className="font-medium text-white">
                    Service family:
                  </span>{" "}
                  {formatTokenLabel(project.serviceFamily)}
                </p>
                <p>
                  <span className="font-medium text-white">Hubs:</span>{" "}
                  {project.selectedHubs.length > 0
                    ? project.selectedHubs
                        .map((hub) => formatTokenLabel(hub))
                        .join(", ")
                    : "None"}
                </p>
              </div>
            </section>

            <section className="brand-surface rounded-[14px] border p-6">
              <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                Save changes
              </p>
              <p className="mt-3 text-sm text-text-2">
                This updates the existing project record in place.
              </p>
              {project.scopeLockedAt ? (
                <div className="mt-4 rounded-[14px] border border-[rgba(255,211,139,0.25)] bg-[rgba(255,211,139,0.08)] px-4 py-3 text-sm text-[#ffd38b]">
                  This project has a locked approved scope. If the save is
                  blocked, switch to change management for formal revisions.
                </div>
              ) : null}
              {validationError ? (
                <div className="mt-4 rounded-[14px] border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-white">
                  {validationError}
                </div>
              ) : null}
              {error ? (
                <div className="mt-4 rounded-[14px] border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-white">
                  {error}
                </div>
              ) : null}
              <div className="mt-5 flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={saving || !dirty}
                  className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : dirty
                      ? "Save changes"
                      : "No changes yet"}
                </button>
                <Link
                  href={`/projects/${project.id}`}
                  className="brand-input rounded-xl px-4 py-3 text-center text-sm font-medium text-text-2"
                >
                  Back without saving
                </Link>
              </div>
            </section>
          </aside>
        </form>
      </div>
    </ProjectWorkspaceView>
  );
}
