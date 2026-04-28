"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AppShell from "./AppShell";
import ClientShell from "./ClientShell";
import ProjectWorkflowNav from "./ProjectWorkflowNav";
import {
  type PortalExperience,
  getPortalProjectPath,
  getPortalQuotePath
} from "./portalExperience";
import {
  getDisplayKeyRisks,
  getDisplayNextQuestions,
  getDisplaySupportingTools
} from "./scopedRecommendationFallbacks";

type CurrencyCode = "ZAR" | "GBP" | "EUR" | "USD" | "AUD";

interface Project {
  id: string;
  name: string;
  status: string;
  quoteApprovalStatus?: string | null;
  quoteSharedAt?: string | null;
  quoteApprovedAt?: string | null;
  quoteApprovedByName?: string | null;
  quoteApprovedByEmail?: string | null;
  scopeLockedAt?: string | null;
  owner: string;
  ownerEmail: string;
  scopeType?: string | null;
  implementationApproach?: string | null;
  commercialBrief?: string | null;
  problemStatement?: string | null;
  solutionRecommendation?: string | null;
  scopeExecutiveSummary?: string | null;
  customerPlatformTier?: string | null;
  retainer?: {
    id: string;
    serviceLine: string;
    blockSize: number;
    rate: number;
    currency: string;
    startDate: string;
    endDate: string | null;
    status: string;
  } | null;
  platformTierSelections?: Record<string, string> | null;
  packagingAssessment?: {
    fit: "good" | "attention" | "upgrade_needed";
    summary: string;
    warnings: string[];
    recommendedNextStep: string;
    reasoning: string[];
    workaroundPath?: string | null;
    requiredProductTiers: Record<string, string>;
    selectedProductTiers: Record<string, string>;
  } | null;
  engagementType: string;
  clientChampionFirstName?: string | null;
  clientChampionLastName?: string | null;
  clientChampionEmail?: string | null;
  client: {
    name: string;
    industry?: string | null;
    website?: string | null;
  };
}

interface SessionDetail {
  session: number;
  title: string;
  status: "draft" | "in_progress" | "complete";
  fields: Record<string, string>;
}

interface BlueprintTask {
  id: string;
  phase: number;
  phaseName: string;
  name: string;
  type: "Agent" | "Human" | "Client";
  effortHours: number;
  order: number;
}

interface Blueprint {
  id: string;
  generatedAt: string;
  tasks: BlueprintTask[];
}

interface DiscoverySummary {
  executiveSummary: string;
  recommendedApproach: string;
  whyThisApproach: string;
  phaseOneFocus: string;
  futureUpgradePath: string;
  inScopeItems?: string[];
  outOfScopeItems?: string[];
  supportingTools?: string[];
  engagementTrack: string;
  platformFit: string;
  changeManagementRating: string;
  dataReadinessRating: string;
  scopeVolatilityRating: string;
  missingInformation: string[];
  keyRisks?: string[];
  recommendedNextQuestions?: string[];
}

interface PhaseCommercialDraft {
  included: boolean;
  humanHours: string;
  rate: string;
}

interface ProductCatalogItem {
  id: string;
  slug: string;
  name: string;
  category: string;
  billingModel: string;
  description?: string | null;
  unitPrice: number;
  defaultQuantity: number;
  unitLabel: string;
  isActive: boolean;
  sortOrder: number;
  kind?: string | null;
}

interface QuoteProductLineMetadata {
  monthlyHours?: number | null;
  hourlyRate?: number | null;
  optionGroup?: string | null;
  paymentTerms?: string | null;
  carryOverTerms?: string | null;
}

interface QuoteContentOverrides {
  primaryChallenge?: string | null;
  successOutcomes?: string | null;
  engagementTrack?: string | null;
  platformFit?: string | null;
  changeManagement?: string | null;
  dataReadiness?: string | null;
  currentStack?: string | null;
  hubspotToday?: string | null;
  dataLandscape?: string | null;
  currentProcesses?: string | null;
  hubsAndFeatures?: string | null;
  pipelineAndProcess?: string | null;
  automation?: string | null;
  reporting?: string | null;
  howWeWillWork?: string | null;
  howScopeIsControlled?: string | null;
  howClientParticipates?: string | null;
  packagingFitLabel?: string | null;
  packagingFitSummary?: string | null;
  whyPackagingRecommendation?: string | null;
  workaroundPath?: string | null;
  recommendedNextStep?: string | null;
  approvalSummary?: string | null;
  termsAndWorkingScope?: string | null;
}

interface ManualProductLineDraft {
  id: string;
  name: string;
  description: string;
  quantity: string;
  unitPrice: string;
  unitLabel: string;
  category: string;
  billingModel: string;
  included: boolean;
  monthlyHours: string;
  hourlyRate: string;
  optionGroup: string;
}

interface QuoteSnapshot {
  id: string;
  projectId: string;
  version: number;
  status: string;
  currency: CurrencyCode;
  defaultRate: number | null;
  phaseLines: Array<{
    phase: number;
    phaseName: string;
    included: boolean;
    humanHours: number;
    rate: number;
    feeZar: number;
    tasks: BlueprintTask[];
  }>;
  productLines: Array<{
    id: string;
    slug: string;
    name: string;
    category: string;
    billingModel: string;
    description?: string | null;
    unitLabel: string;
    quantity: number;
    unitPrice: number;
    lineTotalZar: number;
    kind?: string | null;
    metadata?: QuoteProductLineMetadata | null;
  }>;
  totals: {
    totalHumanHours: number;
    totalFeeZar: number;
    additionalProductsTotalZar: number;
    grandTotalZar: number;
    paymentAmountZar: number;
  };
  paymentSchedule: string[];
  context: {
    quoteTitle?: string | null;
    quoteContextSummary: string | null;
    inScopeItems: string[];
    outOfScopeItems: string[];
    supportingTools: string[];
    keyRisks: string[];
    nextQuestions: string[];
    clientResponsibilities: string[];
    isStandaloneQuote: boolean;
    retainerScope?: {
      summary?: string | null;
      requirements?: string | null;
      deliverables?: Array<{ title: string; description?: string | null }> | null;
      approvalTerms?: string | null;
    } | null;
    contentOverrides?: QuoteContentOverrides | null;
    blueprintGeneratedAt: string | null;
  } | null;
}

const exchangeRatesToZar: Record<CurrencyCode, number> = {
  ZAR: 1,
  GBP: 23,
  EUR: 19,
  USD: 18.5,
  AUD: 12
};

const currencySymbols: Record<CurrencyCode, string> = {
  ZAR: "ZAR",
  GBP: "GBP",
  EUR: "EUR",
  USD: "USD",
  AUD: "AUD"
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatCurrency(amountInZar: number, currency: CurrencyCode) {
  const convertedAmount = amountInZar / exchangeRatesToZar[currency];

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "ZAR" ? 0 : 2
  }).format(convertedAmount);
}

function formatEngagementType(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function splitIntoLines(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitIntoList(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(/\n|•|;(?=\s*[A-Za-z])/)
    .map((item) => item.trim().replace(/^-+/, "").trim())
    .filter(Boolean);
}

function parseNumber(value: string, fallbackValue: number) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallbackValue;
}

function emptyQuoteContentOverrides(): QuoteContentOverrides {
  return {
    primaryChallenge: "",
    successOutcomes: "",
    engagementTrack: "",
    platformFit: "",
    changeManagement: "",
    dataReadiness: "",
    currentStack: "",
    hubspotToday: "",
    dataLandscape: "",
    currentProcesses: "",
    hubsAndFeatures: "",
    pipelineAndProcess: "",
    automation: "",
    reporting: "",
    howWeWillWork: "",
    howScopeIsControlled: "",
    howClientParticipates: "",
    packagingFitLabel: "",
    packagingFitSummary: "",
    whyPackagingRecommendation: "",
    workaroundPath: "",
    recommendedNextStep: "",
    approvalSummary: "",
    termsAndWorkingScope: ""
  };
}

function createManualProductLineDraft(): ManualProductLineDraft {
  return {
    id: `manual-${Math.random().toString(36).slice(2, 10)}`,
    name: "",
    description: "",
    quantity: "1",
    unitPrice: "0",
    unitLabel: "item",
    category: "add_on",
    billingModel: "fixed",
    included: true,
    monthlyHours: "",
    hourlyRate: "",
    optionGroup: ""
  };
}

function createRetainerOptionLineDraft(
  name = "Retainer option",
  defaultHourlyRate = "1750"
): ManualProductLineDraft {
  return {
    id: `manual-${Math.random().toString(36).slice(2, 10)}`,
    name,
    description:
      "Monthly hour allocation, carry-over, and payment terms.",
    quantity: "3",
    unitPrice: "35000",
    unitLabel: "month",
    category: "retainer",
    billingModel: "monthly",
    included: true,
    monthlyHours: "20",
    hourlyRate: defaultHourlyRate,
    optionGroup: "retainer-options"
  };
}

function getManualLineMetadata(line: ManualProductLineDraft): QuoteProductLineMetadata | null {
  const monthlyHours = Number(line.monthlyHours);
  const hourlyRate = Number(line.hourlyRate);
  const metadata: QuoteProductLineMetadata = {};

  if (Number.isFinite(monthlyHours) && monthlyHours > 0) {
    metadata.monthlyHours = monthlyHours;
  }

  if (Number.isFinite(hourlyRate) && hourlyRate > 0) {
    metadata.hourlyRate = hourlyRate;
  }

  if (line.optionGroup.trim()) {
    metadata.optionGroup = line.optionGroup.trim();
  }

  return Object.keys(metadata).length > 0 ? metadata : null;
}

function resolveOptionProductLines<T extends { id: string; metadata?: QuoteProductLineMetadata | null }>(
  productLines: T[],
  selectedOptionIds?: Record<string, string>
) {
  const directLines: T[] = [];
  const groupedLines = new Map<string, T[]>();

  for (const line of productLines) {
    const optionGroup = line.metadata?.optionGroup?.trim();
    if (!optionGroup) {
      directLines.push(line);
      continue;
    }

    const existingLines = groupedLines.get(optionGroup) ?? [];
    existingLines.push(line);
    groupedLines.set(optionGroup, existingLines);
  }

  const resolvedLines = [...directLines];

  for (const [group, lines] of groupedLines.entries()) {
    const selectedId = selectedOptionIds?.[group];
    resolvedLines.push(
      lines.find((line) => line.id === selectedId) ?? lines[0]
    );
  }

  return resolvedLines;
}

function getProductLineHours(productLine: {
  quantity: number;
  metadata?: QuoteProductLineMetadata | null;
}) {
  if (!productLine.metadata?.monthlyHours) {
    return 0;
  }

  return productLine.metadata.monthlyHours * productLine.quantity;
}

function composeLinkedRetainerLine(retainer: NonNullable<Project["retainer"]>) {
  const startDate = new Date(retainer.startDate);
  const endDate = retainer.endDate
    ? new Date(retainer.endDate)
    : new Date(startDate.getTime() + 90.99 * 24 * 60 * 60 * 1000);
  const termMonths = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000)
  );
  const serviceLineLabel =
    retainer.serviceLine === "CONSULTING" ? "Consulting" : "Technical Delivery";

  return {
    id: `retainer-${retainer.id}`,
    slug: `retainer-${retainer.id}`,
    name: `${serviceLineLabel} retainer — ${retainer.blockSize}h/month × ${termMonths} months`,
    category: "Ongoing Commitment",
    billingModel: "retainer",
    description: `${serviceLineLabel} retainer: ${retainer.blockSize} hours per month for ${termMonths} months at ${retainer.currency} ${retainer.rate}/hour`,
    unitLabel: "months",
    quantity: termMonths,
    unitPrice: retainer.blockSize * retainer.rate,
    lineTotalZar: retainer.blockSize * retainer.rate * termMonths,
    kind: "retainer" as const,
    metadata: null as QuoteProductLineMetadata | null
  };
}

function formatDiscoveryOutcome(
  label:
    | "engagementTrack"
    | "platformFit"
    | "changeManagementRating"
    | "dataReadinessRating",
  value: string | undefined
) {
  if (!value) {
    return "Not yet assessed";
  }

  if (label === "engagementTrack") {
    const engagementTrackLabels: Record<string, string> = {
      "new-crm-greenfield": "New CRM / greenfield implementation",
      "hubspot-onboarding-new-build": "HubSpot onboarding / new build",
      "hubspot-optimisation-revamp": "HubSpot optimisation / revamp",
      "migration-to-hubspot": "Migration to HubSpot"
    };

    return engagementTrackLabels[value] ?? value;
  }

  if (label === "platformFit") {
    const platformFitLabels: Record<string, string> = {
      "fit-confirmed": "HubSpot is the recommended fit",
      "fit-possible-with-caveats": "HubSpot could fit with caveats",
      "fit-not-recommended": "HubSpot is not the recommended fit"
    };

    return platformFitLabels[value] ?? value;
  }

  return { low: "Low", medium: "Medium", high: "High" }[value] ?? value;
}

function formatProductCategory(value: string) {
  return (
    {
      one_time: "One-time",
      retainer: "Retainer",
      add_on: "Add-on"
    }[value] ?? value
  );
}

function formatBillingModel(value: string) {
  return (
    {
      fixed: "Fixed fee",
      monthly: "Monthly recurring",
      hourly: "Hourly",
      retainer: "Retainer"
    }[value] ?? value
  );
}

function SectionEyebrow({ children }: { children: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#49cde1]">
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mt-3 text-2xl font-semibold text-white">{children}</h2>;
}

function buildDefaultQuoteContentOverrides({
  project,
  summary,
  sessions,
  isStandaloneQuote
}: {
  project: Project | null;
  summary: DiscoverySummary | null;
  sessions: SessionDetail[];
  isStandaloneQuote: boolean;
}): QuoteContentOverrides {
  const session1 =
    sessions.find((session) => session.session === 1)?.fields ?? {};
  const session2 =
    sessions.find((session) => session.session === 2)?.fields ?? {};
  const session3 =
    sessions.find((session) => session.session === 3)?.fields ?? {};

  return {
    primaryChallenge:
      session1.primary_pain_challenge || "To be confirmed",
    successOutcomes: session1.goals_and_success_metrics || "",
    engagementTrack: isStandaloneQuote
      ? "Standalone scoped quote"
      : formatDiscoveryOutcome(
          "engagementTrack",
          summary?.engagementTrack ?? undefined
        ),
    platformFit: isStandaloneQuote
      ? project?.customerPlatformTier || "To be confirmed"
      : formatDiscoveryOutcome("platformFit", summary?.platformFit ?? undefined),
    changeManagement: isStandaloneQuote
      ? "To be confirmed"
      : formatDiscoveryOutcome(
          "changeManagementRating",
          summary?.changeManagementRating ?? undefined
        ),
    dataReadiness: isStandaloneQuote
      ? "To be confirmed"
      : formatDiscoveryOutcome(
          "dataReadinessRating",
          summary?.dataReadinessRating ?? undefined
        ),
    currentStack: session2.current_tech_stack || "",
    hubspotToday: session2.current_hubspot_state || "",
    dataLandscape: session2.data_landscape || "",
    currentProcesses: session2.current_processes || "",
    hubsAndFeatures: session3.hubs_and_features_required || "",
    pipelineAndProcess: session3.pipeline_and_process_design || "",
    automation: session3.automation_requirements || "",
    reporting: session3.reporting_requirements || "",
    howWeWillWork:
      "We will deliver the implementation in phased onboarding blocks, each with a clear output, review point, and commercial boundary.",
    howScopeIsControlled:
      "The approved phases below become the working implementation scope. Any material changes after approval should move through change control.",
    howClientParticipates:
      "The client team provides access, confirms process decisions, reviews milestones, and signs off the agreed outputs.",
    packagingFitLabel:
      project?.implementationApproach === "best_practice"
        ? "Best-practice / scalable approach"
        : "Pragmatic / POC approach",
    packagingFitSummary: project?.packagingAssessment?.summary || "",
    whyPackagingRecommendation:
      project?.packagingAssessment?.reasoning?.join("\n") || "",
    workaroundPath: project?.packagingAssessment?.workaroundPath || "",
    recommendedNextStep:
      project?.packagingAssessment?.recommendedNextStep || "",
    approvalSummary: isStandaloneQuote
      ? "This quote is intended to approve the scoped line items below. Once approved, the accepted products and commercial split should become the delivery baseline."
      : "This quote is intended to act as the commercial approval pack for the recommended implementation scope. Once approved, the accepted phases and commercial split should become the contractual baseline for planning and delivery.",
    termsAndWorkingScope: isStandaloneQuote
      ? "This quote covers the scoped job and any accepted add-ons. Future work outside the approved line items should be treated as a separate scope or revised quote."
      : "This document is the commercial quote generated from the discovery process. Once approved, it becomes the working commercial scope baseline for planning and delivery. Future work outside the approved phases should be treated as a separate scope or formal change request."
  };
}

export default function QuoteDocument({
  projectId,
  mode = "internal"
}: {
  projectId: string;
  mode?: "internal" | "client" | "partner";
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [sessions, setSessions] = useState<SessionDetail[]>([]);
  const [summary, setSummary] = useState<DiscoverySummary | null>(null);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>("ZAR");
  const [defaultRate, setDefaultRate] = useState("1500");
  const [phaseDrafts, setPhaseDrafts] = useState<
    Record<number, PhaseCommercialDraft>
  >({});
  const [products, setProducts] = useState<ProductCatalogItem[]>([]);
  const [savedQuote, setSavedQuote] = useState<QuoteSnapshot | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<
    Record<string, { included: boolean; quantity: string; unitPrice: string }>
  >({});
  const [quoteTitle, setQuoteTitle] = useState("");
  const [quoteContextSummaryDraft, setQuoteContextSummaryDraft] = useState("");
  const [inScopeDraft, setInScopeDraft] = useState("");
  const [outOfScopeDraft, setOutOfScopeDraft] = useState("");
  const [supportingToolsDraft, setSupportingToolsDraft] = useState("");
  const [keyRisksDraft, setKeyRisksDraft] = useState("");
  const [nextQuestionsDraft, setNextQuestionsDraft] = useState("");
  const [clientResponsibilitiesDraft, setClientResponsibilitiesDraft] =
    useState("");
  const [paymentScheduleDraft, setPaymentScheduleDraft] = useState("");
  const [quoteContentDraft, setQuoteContentDraft] = useState<QuoteContentOverrides>(
    emptyQuoteContentOverrides()
  );
  const [manualProductLines, setManualProductLines] = useState<
    ManualProductLineDraft[]
  >([]);
  const [selectedPortalOptionIds, setSelectedPortalOptionIds] = useState<
    Record<string, string>
  >({});
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [approveBusy, setApproveBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isPortalMode = mode !== "internal";
  const portalExperience: PortalExperience =
    mode === "partner" ? "partner" : "client";

  useEffect(() => {
    async function loadDocument() {
      setLoading(true);
      setError(null);

      try {
        if (isPortalMode) {
          const response = await fetch(
            `/api/client/projects/${encodeURIComponent(projectId)}/quote`,
            {
              credentials: "include"
            }
          );
          const body = await response.json().catch(() => null);

          if (!response.ok) {
            throw new Error(body?.error ?? "Failed to load quote document");
          }

          setProject(body?.project ?? null);
          setSessions(body?.sessions ?? []);
          setSummary(body?.summary ?? null);
          setBlueprint(body?.blueprint ?? null);
          setProducts(body?.products ?? []);
          setSavedQuote(body?.quote ?? null);
          return;
        }

        const quoteDocumentResponse = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/quote`
        );

        if (!quoteDocumentResponse.ok) {
          throw new Error("Failed to load quote document");
        }

        const quoteDocumentBody = await quoteDocumentResponse.json();
        const nextProject = quoteDocumentBody.project;
        if (!nextProject) {
          throw new Error("Failed to load project context for this quote.");
        }
        const requiresBlueprint =
          nextProject?.engagementType !== "AUDIT" &&
          nextProject?.engagementType !== "OPTIMISATION" &&
          (nextProject?.scopeType ?? "discovery") === "discovery";

        if (
          !quoteDocumentBody?.summary ||
          (requiresBlueprint && !quoteDocumentBody?.blueprint)
        ) {
          throw new Error(
            requiresBlueprint
              ? "Generate the discovery summary and blueprint before opening the quote."
              : "Generate the scoped summary before opening the quote."
          );
        }

        setProject(nextProject);
        setSessions(quoteDocumentBody?.sessions ?? []);
        setSummary(quoteDocumentBody?.summary ?? null);
        setBlueprint(quoteDocumentBody?.blueprint ?? null);
        setProducts(quoteDocumentBody?.products ?? []);
        setSavedQuote(quoteDocumentBody?.quote ?? null);
        setQuoteTitle(`${nextProject.name} Quote`);
        setQuoteContextSummaryDraft(
          quoteDocumentBody?.summary?.executiveSummary ??
            nextProject?.scopeExecutiveSummary ??
            nextProject?.solutionRecommendation ??
            nextProject?.problemStatement ??
            nextProject?.commercialBrief ??
            ""
        );
        const nextSessions = quoteDocumentBody?.sessions ?? [];
        const nextSession4 =
          nextSessions.find((session: SessionDetail) => session.session === 4)
            ?.fields ?? {};
        setInScopeDraft(
          ((quoteDocumentBody?.summary?.inScopeItems as string[] | undefined) ??
            splitIntoList(nextSession4.confirmed_scope)).join("\n")
        );
        setOutOfScopeDraft(
          ((quoteDocumentBody?.summary?.outOfScopeItems as string[] | undefined) ??
            splitIntoList(nextSession4.out_of_scope)).join("\n")
        );
        setSupportingToolsDraft(
          (quoteDocumentBody?.summary?.supportingTools ?? []).join("\n")
        );
        setKeyRisksDraft(
          (
            quoteDocumentBody?.summary?.keyRisks ??
            splitIntoList(nextSession4.risks_and_blockers)
          ).join("\n")
        );
        setNextQuestionsDraft(
          (quoteDocumentBody?.summary?.recommendedNextQuestions ?? []).join("\n")
        );
        setClientResponsibilitiesDraft(
          splitIntoList(nextSession4.client_responsibilities).join("\n")
        );
        setPaymentScheduleDraft(
          [
            "Upon scope approval",
            "At start of Phase 2",
            "At start of Phase 4",
            "Before final handover"
          ].join("\n")
        );
        setQuoteContentDraft(
          buildDefaultQuoteContentOverrides({
            project: nextProject,
            summary: quoteDocumentBody?.summary ?? null,
            sessions: nextSessions,
            isStandaloneQuote:
              (nextProject?.scopeType ?? "discovery") === "standalone_quote"
          })
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load quote document"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadDocument();
  }, [isPortalMode, projectId]);

  useEffect(() => {
    if (products.length === 0) {
      return;
    }

    setSelectedProducts((currentProducts) => {
      const nextProducts = { ...currentProducts };

      for (const product of products.filter((item) => item.isActive)) {
        if (!nextProducts[product.id]) {
          nextProducts[product.id] = {
            included: false,
            quantity: String(product.defaultQuantity),
            unitPrice: String(product.unitPrice)
          };
        }
      }

      return nextProducts;
    });
  }, [products]);

  const groupedPhases = useMemo(() => {
    return (blueprint?.tasks ?? []).reduce<
      Array<{ phase: number; phaseName: string; tasks: BlueprintTask[] }>
    >((groups, task) => {
      const existingGroup = groups.find((group) => group.phase === task.phase);

      if (existingGroup) {
        existingGroup.tasks.push(task);
        return groups;
      }

      groups.push({
        phase: task.phase,
        phaseName: task.phaseName,
        tasks: [task]
      });
      return groups;
    }, []);
  }, [blueprint]);

  useEffect(() => {
    if (groupedPhases.length === 0) {
      return;
    }

    setPhaseDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };

      for (const phase of groupedPhases) {
        if (!nextDrafts[phase.phase]) {
          const phaseHumanHours = phase.tasks
            .filter((task) => task.type === "Human")
            .reduce((total, task) => total + task.effortHours, 0);

          nextDrafts[phase.phase] = {
            included: true,
            humanHours: String(phaseHumanHours),
            rate: defaultRate
          };
        }
      }

      return nextDrafts;
    });
  }, [defaultRate, groupedPhases]);

  useEffect(() => {
    if (!savedQuote) {
      return;
    }

    if (savedQuote.context?.quoteTitle?.trim()) {
      setQuoteTitle(savedQuote.context.quoteTitle);
    }
    if (savedQuote.context?.quoteContextSummary) {
      setQuoteContextSummaryDraft(savedQuote.context.quoteContextSummary);
    }
    setInScopeDraft(savedQuote.context?.inScopeItems?.join("\n") ?? "");
    setOutOfScopeDraft(savedQuote.context?.outOfScopeItems?.join("\n") ?? "");
    setSupportingToolsDraft(savedQuote.context?.supportingTools?.join("\n") ?? "");
    setKeyRisksDraft(savedQuote.context?.keyRisks?.join("\n") ?? "");
    setNextQuestionsDraft(savedQuote.context?.nextQuestions?.join("\n") ?? "");
    setClientResponsibilitiesDraft(
      savedQuote.context?.clientResponsibilities?.join("\n") ?? ""
    );
    setPaymentScheduleDraft(savedQuote.paymentSchedule.join("\n"));
    setQuoteContentDraft({
      ...emptyQuoteContentOverrides(),
      ...(savedQuote.context?.contentOverrides ?? {})
    });
        setManualProductLines(
          savedQuote.productLines
        .filter((productLine) => productLine.kind === "manual")
        .map((productLine) => ({
          id: productLine.id,
          name: productLine.name,
          description: productLine.description ?? "",
          quantity: String(productLine.quantity),
          unitPrice: String(productLine.unitPrice),
          unitLabel: productLine.unitLabel,
          category: productLine.category,
          billingModel: productLine.billingModel,
          included: true,
          monthlyHours: productLine.metadata?.monthlyHours
            ? String(productLine.metadata.monthlyHours)
            : "",
          hourlyRate: productLine.metadata?.hourlyRate
            ? String(productLine.metadata.hourlyRate)
            : "",
          optionGroup: productLine.metadata?.optionGroup ?? ""
        }))
    );

    setCurrency(savedQuote.currency);

    if (savedQuote.defaultRate) {
      setDefaultRate(String(savedQuote.defaultRate));
    }

    setPhaseDrafts(
      Object.fromEntries(
        savedQuote.phaseLines.map((phase) => [
          phase.phase,
          {
            included: phase.included,
            humanHours: String(phase.humanHours),
            rate: String(phase.rate)
          }
        ])
      )
    );

    setSelectedProducts((currentProducts) => {
      const nextProducts = { ...currentProducts };

      for (const productLine of savedQuote.productLines) {
        nextProducts[productLine.id] = {
          included: true,
          quantity: String(productLine.quantity),
          unitPrice: String(productLine.unitPrice)
        };
      }

      return nextProducts;
    });
  }, [savedQuote]);

  useEffect(() => {
    const sourceLines = isPortalMode
      ? (savedQuote?.productLines ?? [])
      : manualProductLines
          .filter((line) => line.included && line.name.trim())
          .map((line) => ({
            id: line.id,
            metadata: getManualLineMetadata(line)
          }));

    const nextSelections: Record<string, string> = {};

    for (const line of sourceLines) {
      const optionGroup = line.metadata?.optionGroup?.trim();
      if (optionGroup && !nextSelections[optionGroup]) {
        nextSelections[optionGroup] = line.id;
      }
    }

    setSelectedPortalOptionIds((currentSelections) => ({
      ...nextSelections,
      ...currentSelections
    }));
  }, [isPortalMode, manualProductLines, savedQuote]);

  const session1 =
    sessions.find((session) => session.session === 1)?.fields ?? {};
  const session2 =
    sessions.find((session) => session.session === 2)?.fields ?? {};
  const session3 =
    sessions.find((session) => session.session === 3)?.fields ?? {};
  const session4 =
    sessions.find((session) => session.session === 4)?.fields ?? {};

  const phaseCommercials = groupedPhases.map((phase) => {
    const phaseHumanHoursFromBlueprint = phase.tasks
      .filter((task) => task.type === "Human")
      .reduce((total, task) => total + task.effortHours, 0);
    const draft = phaseDrafts[phase.phase];
    const included = draft?.included ?? true;
    const humanHours = parseNumber(
      draft?.humanHours ?? String(phaseHumanHoursFromBlueprint),
      phaseHumanHoursFromBlueprint
    );
    const rate = parseNumber(
      draft?.rate ?? defaultRate,
      parseNumber(defaultRate, 1500)
    );
    const feeZar = humanHours * rate;

    return {
      phase: phase.phase,
      phaseName: phase.phaseName,
      included,
      humanHours,
      rate,
      feeZar,
      tasks: phase.tasks
    };
  });

  const selectedPhaseCommercials = phaseCommercials.filter(
    (phase) => phase.included
  );
  const totalHumanHours = selectedPhaseCommercials.reduce(
    (total, phase) => total + phase.humanHours,
    0
  );
  const totalFeeZar = selectedPhaseCommercials.reduce(
    (total, phase) => total + phase.feeZar,
    0
  );
  const selectedCatalogProductLines = products
    .filter((product) => selectedProducts[product.id]?.included)
    .map((product) => {
      const selection = selectedProducts[product.id];
      const quantity = parseNumber(
        selection?.quantity ?? String(product.defaultQuantity),
        product.defaultQuantity
      );
      const unitPrice = parseNumber(
        selection?.unitPrice ?? String(product.unitPrice),
        product.unitPrice
      );

      return {
        ...product,
        quantity,
        unitPrice,
        lineTotalZar: quantity * unitPrice
      };
    });
  const linkedRetainerLine =
    project?.retainer && project.retainer.status !== "ENDED"
      ? composeLinkedRetainerLine(project.retainer)
      : null;
  const selectedProductLines = linkedRetainerLine
    ? [
        ...selectedCatalogProductLines.filter(
          (product) => product.kind !== "retainer"
        ),
        linkedRetainerLine
      ]
    : selectedCatalogProductLines;
  const additionalProductsTotalZar = selectedProductLines.reduce(
    (total, product) => total + product.lineTotalZar,
    0
  );
  const grandTotalZar = totalFeeZar + additionalProductsTotalZar;
  const paymentAmountZar = grandTotalZar / 4;
  const paymentSchedule = [
    "Upon scope approval",
    "At start of Phase 2",
    "At start of Phase 4",
    "Before final handover"
  ];
  const clientResponsibilities = splitIntoList(
    session4.client_responsibilities
  );
  const isStandaloneQuote = project?.scopeType === "standalone_quote";
  const defaultQuoteContent = buildDefaultQuoteContentOverrides({
    project,
    summary,
    sessions,
    isStandaloneQuote
  });
  const quoteApprovalStatus = project?.quoteApprovalStatus ?? "draft";
  const isApprovedQuote = quoteApprovalStatus === "approved";
  const inScopeItems =
    isStandaloneQuote && summary?.inScopeItems?.length
      ? summary.inScopeItems
      : splitIntoList(session4.confirmed_scope);
  const outOfScopeItems =
    isStandaloneQuote && summary?.outOfScopeItems?.length
      ? summary.outOfScopeItems
      : splitIntoList(session4.out_of_scope);
  const supportingTools = isStandaloneQuote
    ? getDisplaySupportingTools(project, summary?.supportingTools)
    : (summary?.supportingTools ?? []);
  const keyRisks = isStandaloneQuote
    ? getDisplayKeyRisks(project, summary?.keyRisks)
    : summary?.keyRisks?.length && summary.keyRisks.length > 0
      ? summary.keyRisks
      : splitIntoList(session4.risks_and_blockers);
  const nextQuestions = isStandaloneQuote
    ? getDisplayNextQuestions(project, summary?.recommendedNextQuestions)
    : (summary?.recommendedNextQuestions ?? []);
  const effectivePaymentSchedule = splitIntoLines(paymentScheduleDraft);
  const quoteContext = savedQuote?.context;
  const displayQuoteContent = {
    ...defaultQuoteContent,
    ...(isPortalMode ? quoteContext?.contentOverrides : quoteContentDraft)
  };
  const selectedManualProductLines = manualProductLines
    .filter((line) => line.included && line.name.trim())
    .map((line) => {
      const quantity = parseNumber(line.quantity, 1);
      const unitPrice = parseNumber(line.unitPrice, 0);
      return {
        id: line.id,
        slug: line.id,
        name: line.name.trim(),
        category: line.category || "add_on",
        billingModel: line.billingModel || "fixed",
        description: line.description.trim() || null,
        unitLabel: line.unitLabel.trim() || "item",
        quantity,
        unitPrice,
        lineTotalZar: quantity * unitPrice,
        kind: "manual" as const,
        metadata: getManualLineMetadata(line)
      };
    });
  const allDisplayProductLines =
    isPortalMode && savedQuote
      ? savedQuote.productLines
      : [...selectedProductLines, ...selectedManualProductLines];
  const activeDisplayProductLines = resolveOptionProductLines(
    allDisplayProductLines,
    selectedPortalOptionIds
  );
  const activeProductLineIds = new Set(
    activeDisplayProductLines.map((productLine) => productLine.id)
  );
  const manualHoursTotal = activeDisplayProductLines.reduce(
    (total, productLine) => total + getProductLineHours(productLine),
    0
  );
  const displayPhaseCommercials =
    isPortalMode && savedQuote ? savedQuote.phaseLines : phaseCommercials;
  const phaseFeeTotal = displayPhaseCommercials
    .filter((phase) => phase.included)
    .reduce((total, phase) => total + phase.feeZar, 0);
  const activeProductsTotalZar = activeDisplayProductLines.reduce(
    (total, productLine) => total + productLine.lineTotalZar,
    0
  );
  const displayTotals =
    {
      totalHumanHours: totalHumanHours + manualHoursTotal,
      totalFeeZar: phaseFeeTotal,
      additionalProductsTotalZar: activeProductsTotalZar,
      grandTotalZar: phaseFeeTotal + activeProductsTotalZar,
      paymentAmountZar:
        effectivePaymentSchedule.length > 0
          ? (phaseFeeTotal + activeProductsTotalZar) /
            effectivePaymentSchedule.length
          : 0
    };
  const displayPaymentSchedule =
    isPortalMode && savedQuote ? savedQuote.paymentSchedule : effectivePaymentSchedule;
  const displayInScopeItems =
    isPortalMode && quoteContext
      ? quoteContext.inScopeItems
      : splitIntoList(inScopeDraft);
  const displayOutOfScopeItems =
    isPortalMode && quoteContext
      ? quoteContext.outOfScopeItems
      : splitIntoList(outOfScopeDraft);
  const displaySupportingTools =
    isPortalMode && quoteContext
      ? quoteContext.supportingTools
      : splitIntoList(supportingToolsDraft || supportingTools.join("\n"));
  const displayKeyRisks =
    isPortalMode && quoteContext
      ? quoteContext.keyRisks
      : splitIntoList(keyRisksDraft || keyRisks.join("\n"));
  const displayNextQuestions =
    isPortalMode && quoteContext
      ? quoteContext.nextQuestions
      : splitIntoList(nextQuestionsDraft || nextQuestions.join("\n"));
  const displayClientResponsibilities =
    isPortalMode && quoteContext
      ? quoteContext.clientResponsibilities
      : splitIntoList(
          clientResponsibilitiesDraft || clientResponsibilities.join("\n")
        );
  const displayQuoteContextSummary =
    isPortalMode && quoteContext
      ? quoteContext.quoteContextSummary
      : quoteContextSummaryDraft.trim() ||
        (isStandaloneQuote
          ? (summary?.executiveSummary ??
            project?.scopeExecutiveSummary ??
            project?.solutionRecommendation ??
            project?.problemStatement ??
            project?.commercialBrief ??
            "This standalone quote is based on the scoped job brief captured for the client.")
          : (summary?.executiveSummary ??
            session1.business_overview ??
            "No executive summary generated yet."));
  const displayQuoteTitle =
    isPortalMode && quoteContext?.quoteTitle?.trim()
      ? quoteContext.quoteTitle
      : quoteTitle.trim() || `${project?.name ?? project?.client.name ?? "Project"} Quote`;
  const displayBlueprintGeneratedAt =
    isPortalMode && quoteContext?.blueprintGeneratedAt
      ? quoteContext.blueprintGeneratedAt
      : (blueprint?.generatedAt ?? null);
  const documentationProduct = products.find(
    (product) => product.slug === "documentation-sop-pack"
  );
  const activeHourlyRates = [
    ...displayPhaseCommercials
      .filter((phase) => phase.included)
      .map((phase) => phase.rate),
    ...activeDisplayProductLines
      .map((productLine) => productLine.metadata?.hourlyRate ?? null)
      .filter((rate): rate is number => Boolean(rate))
  ];
  const displayRateSummary =
    activeHourlyRates.length > 0
      ? activeHourlyRates.every((rate) => rate === activeHourlyRates[0])
        ? `${currencySymbols[currency]} ${activeHourlyRates[0]}/hr`
        : `${currencySymbols[currency]} ${Math.min(...activeHourlyRates)}-${Math.max(
            ...activeHourlyRates
          )}/hr`
      : `${currencySymbols[currency]} ${parseNumber(defaultRate, 1500)}/hr`;
  const recommendDocumentationPack =
    Boolean(documentationProduct?.isActive) &&
    (displayTotals.totalHumanHours >= 40 ||
      displaySupportingTools.some(
        (item) =>
          item.toLowerCase().includes("documentation") ||
          item.toLowerCase().includes("sop")
      ) ||
      displayInScopeItems.some(
        (item) =>
          item.toLowerCase().includes("documentation") ||
          item.toLowerCase().includes("handover") ||
          item.toLowerCase().includes("process")
      ) ||
      displayOutOfScopeItems.some(
        (item) =>
          item.toLowerCase().includes("documentation") ||
          item.toLowerCase().includes("sop")
      ));

  const clientChampionName = [
    project?.clientChampionFirstName,
    project?.clientChampionLastName
  ]
    .filter(Boolean)
    .join(" ");

  async function copyShareLink() {
    try {
      if (typeof window === "undefined") {
        throw new Error("Window is not available");
      }

      const shareUrl = isPortalMode
        ? window.location.href
        : `${window.location.origin}${getPortalQuotePath(
            portalExperience,
            projectId
          )}`;
      await navigator.clipboard.writeText(shareUrl);
      setShareMessage(isPortalMode ? "Quote link copied" : "Portal quote link copied");
      window.setTimeout(() => setShareMessage(null), 2500);
    } catch {
      setShareMessage("Unable to copy link");
      window.setTimeout(() => setShareMessage(null), 2500);
    }
  }

  async function pushToClientPortal() {
    if (isPortalMode) {
      return;
    }
    setPushBusy(true);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/quote/share`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(buildQuotePayload())
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to push quote to client portal");
      }

      if (body?.project) {
        setProject(body.project);
      }

      if (body?.quote) {
        setSavedQuote(body.quote);
      }

      setShareMessage("Quote pushed to the client portal inbox");
      window.setTimeout(() => setShareMessage(null), 2500);
    } catch {
      setShareMessage("Unable to push quote to client portal");
      window.setTimeout(() => setShareMessage(null), 2500);
    } finally {
      setPushBusy(false);
    }
  }

  function buildQuotePayload() {
    return {
      currency,
      defaultRate: parseNumber(defaultRate, 1500),
      phaseLines: phaseCommercials.map((phase) => ({
        phase: phase.phase,
        phaseName: phase.phaseName,
        included: phase.included,
        humanHours: phase.humanHours,
        rate: phase.rate,
        feeZar: phase.feeZar,
        tasks: phase.tasks.map((task) => ({
          id: task.id,
          name: task.name,
          type: task.type,
          effortHours: task.effortHours
        }))
      })),
      productLines: [...selectedProductLines, ...selectedManualProductLines].map(
        (product) => ({
          id: product.id,
          slug: product.slug,
          name: product.name,
          category: product.category,
          billingModel: product.billingModel,
          description: product.description ?? null,
          unitLabel: product.unitLabel,
          quantity: product.quantity,
          unitPrice: product.unitPrice,
          lineTotalZar: product.lineTotalZar,
          kind: product.kind ?? "product",
          metadata: product.metadata ?? null
        })
      ),
      totals: {
        totalHumanHours: displayTotals.totalHumanHours,
        totalFeeZar: displayTotals.totalFeeZar,
        additionalProductsTotalZar: displayTotals.additionalProductsTotalZar,
        grandTotalZar: displayTotals.grandTotalZar,
        paymentAmountZar: displayTotals.paymentAmountZar
      },
      paymentSchedule: effectivePaymentSchedule,
      context: {
        quoteTitle: quoteTitle.trim() || `${project?.name ?? "Project"} Quote`,
        quoteContextSummary: quoteContextSummaryDraft.trim() || null,
        inScopeItems: splitIntoList(inScopeDraft),
        outOfScopeItems: splitIntoList(outOfScopeDraft),
        supportingTools: splitIntoList(
          supportingToolsDraft || supportingTools.join("\n")
        ),
        keyRisks: splitIntoList(keyRisksDraft || keyRisks.join("\n")),
        nextQuestions: splitIntoList(
          nextQuestionsDraft || nextQuestions.join("\n")
        ),
        clientResponsibilities: splitIntoList(
          clientResponsibilitiesDraft || clientResponsibilities.join("\n")
        ),
        isStandaloneQuote,
        contentOverrides: quoteContentDraft,
        blueprintGeneratedAt: blueprint?.generatedAt ?? null
      }
    };
  }

  async function saveDraftQuote() {
    if (isPortalMode) {
      return;
    }

    setSaveBusy(true);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/quote/save`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(buildQuotePayload())
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save quote draft");
      }

      if (body?.project) {
        setProject(body.project);
      }

      if (body?.quote) {
        setSavedQuote(body.quote);
      }

      setShareMessage("Quote draft saved");
      window.setTimeout(() => setShareMessage(null), 2500);
    } catch {
      setShareMessage("Unable to save quote draft");
      window.setTimeout(() => setShareMessage(null), 2500);
    } finally {
      setSaveBusy(false);
    }
  }

  async function approveQuote() {
    if (!isPortalMode) {
      return;
    }

    setApproveBusy(true);

    try {
      const response = await fetch(
        `/api/client/projects/${encodeURIComponent(projectId)}/quote/approve`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            selectedProductLineIds: Object.values(selectedPortalOptionIds)
          })
        }
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to approve quote");
      }

      if (body?.project) {
        setProject(body.project);
      }

      if (body?.quote) {
        setSavedQuote(body.quote);
      }

      setShareMessage("Quote approved and scope locked");
      window.setTimeout(() => setShareMessage(null), 2500);
    } catch {
      setShareMessage("Unable to approve quote");
      window.setTimeout(() => setShareMessage(null), 2500);
    } finally {
      setApproveBusy(false);
    }
  }

  function saveAsPdf() {
    window.print();
  }

  const documentContent = (
    <>
      <div className="document-shell p-8">
        {loading ? (
          <div className="grid gap-4">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="h-28 animate-pulse rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card"
              />
            ))}
          </div>
        ) : error || !project ? (
          <div className="rounded-2xl border border-[rgba(224,80,96,0.4)] bg-background-card p-8 text-white">
            {error ?? "Document unavailable"}
          </div>
        ) : (
          <div className="document-content space-y-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Link
                  href={
                    isPortalMode
                      ? getPortalProjectPath(portalExperience, project.id)
                      : `/projects/${project.id}`
                  }
                  className="text-sm text-text-muted"
                >
                  {isPortalMode ? "Back to project" : "Back to overview"}
                </Link>
                <h1 className="mt-3 text-3xl font-bold font-heading text-white">
                  {isStandaloneQuote
                    ? "Standalone Quote & Approval"
                    : "Implementation Quote & Approval"}
                </h1>
                <p className="mt-2 text-text-secondary">
                  {isStandaloneQuote
                    ? "Commercial proposal generated from a scoped standalone brief and selected products."
                    : "Commercial proposal generated from the approved discovery scope and phased implementation estimate."}
                </p>
              </div>
              <div className="document-toolbar flex flex-wrap items-center gap-3">
                {!isPortalMode ? (
                  <button
                    type="button"
                    onClick={saveDraftQuote}
                    disabled={saveBusy || isApprovedQuote}
                    className="rounded-xl border border-[rgba(73,205,225,0.18)] bg-[rgba(73,205,225,0.08)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                  >
                    {saveBusy ? "Saving..." : "Save Draft"}
                  </button>
                ) : null}
                {!isPortalMode ? (
                  <button
                    type="button"
                    onClick={pushToClientPortal}
                    disabled={pushBusy || isApprovedQuote}
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:text-text-muted"
                  >
                    {pushBusy
                      ? "Pushing..."
                      : isApprovedQuote
                        ? "Quote Approved"
                        : "Push to Client Portal"}
                  </button>
                ) : null}
                {isPortalMode && quoteApprovalStatus === "shared" ? (
                  <button
                    type="button"
                    onClick={approveQuote}
                    disabled={approveBusy}
                    className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {approveBusy ? "Approving..." : "Approve Quote"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={copyShareLink}
                  className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
                >
                  {isPortalMode ? "Copy Quote Link" : "Copy Portal Quote Link"}
                </button>
                <button
                  type="button"
                  onClick={saveAsPdf}
                  className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white"
                >
                  Save PDF
                </button>
                {shareMessage ? (
                  <p className="text-sm text-text-secondary">{shareMessage}</p>
                ) : null}
              </div>
            </div>

            <section className="document-card overflow-hidden rounded-[32px] border border-[rgba(255,255,255,0.07)] bg-background-card">
              <div className="grid gap-0 lg:grid-cols-[0.72fr_0.28fr]">
                <div className="bg-[#0c1329] p-10">
                  <div className="flex items-center gap-4">
                    <img
                      src="/muloo-logo.svg"
                      alt="Muloo"
                      className="h-8 w-auto"
                    />
                    <p className="text-xs uppercase tracking-[0.35em] text-text-muted">
                      Quote & Approval
                    </p>
                  </div>
                  {isPortalMode ? (
                    <h2 className="mt-10 max-w-3xl text-5xl font-bold font-heading leading-tight text-white">
                      {displayQuoteTitle}
                    </h2>
                  ) : (
                    <div className="mt-10 max-w-3xl">
                      <label className="block">
                        <span className="mb-3 block text-xs uppercase tracking-[0.25em] text-text-muted">
                          Quote title
                        </span>
                        <input
                          value={quoteTitle}
                          onChange={(event) => setQuoteTitle(event.target.value)}
                          className="w-full bg-transparent text-5xl font-bold font-heading leading-tight text-white outline-none"
                          placeholder={`${project.name} Quote`}
                        />
                      </label>
                    </div>
                  )}
                  <p className="mt-6 text-lg text-text-secondary">
                    {isStandaloneQuote
                      ? "Commercial quote generated from a standalone scoped brief and optional service products."
                      : `${formatEngagementType(
                          project.engagementType
                        )} phased quote generated from structured discovery and blueprinted scope.`}
                  </p>

                  <div className="mt-10 grid gap-8 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
                        Prepared For
                      </p>
                      <div className="mt-4 space-y-2 text-sm text-white">
                        <p className="font-semibold">{project.client.name}</p>
                        {clientChampionName ? (
                          <p>{clientChampionName}</p>
                        ) : null}
                        {project.clientChampionEmail ? (
                          <p>{project.clientChampionEmail}</p>
                        ) : null}
                        {project.client.website ? (
                          <p>{project.client.website}</p>
                        ) : null}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
                        Prepared By
                      </p>
                      <div className="mt-4 space-y-2 text-sm text-white">
                        <p className="font-semibold">{project.owner}</p>
                        <p>{project.ownerEmail}</p>
                        <p>Muloo</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-l border-[rgba(255,255,255,0.07)] bg-[#10172f] p-8">
                  <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
                    {isPortalMode
                      ? "Commercial Snapshot"
                      : "Commercial Controls"}
                  </p>

                  {isPortalMode ? (
                    <p className="mt-6 text-sm leading-7 text-text-secondary">
                      This client portal view is read-only. Currency, hours, and
                      commercial shaping are controlled by the Muloo team before
                      the quote is shared here.
                    </p>
                  ) : (
                    <div className="mt-6 grid gap-4">
                      <label className="block">
                        <span className="mb-2 block text-sm text-text-secondary">
                          Currency
                        </span>
                        <select
                          value={currency}
                          onChange={(event) =>
                            setCurrency(event.target.value as CurrencyCode)
                          }
                          className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                        >
                          {Object.keys(exchangeRatesToZar).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm text-text-secondary">
                          Default Hourly Rate
                        </span>
                        <div className="flex items-center rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3">
                          <span className="mr-3 text-sm text-text-secondary">
                            {currencySymbols[currency]}
                          </span>
                          <input
                            value={defaultRate}
                            onChange={(event) =>
                              setDefaultRate(event.target.value)
                            }
                            className="w-full bg-transparent text-white outline-none"
                          />
                        </div>
                      </label>
                    </div>
                  )}

                  <div className="mt-8 grid gap-4">
                    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                      <p className="text-sm text-text-secondary">
                        Quoted Hours
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {displayTotals.totalHumanHours} hrs
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                      <p className="text-sm text-text-secondary">
                        Estimated Investment
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {formatCurrency(displayTotals.grandTotalZar, currency)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                      <p className="text-sm text-text-secondary">
                        Commercial Rate
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {displayRateSummary}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="document-card rounded-2xl border border-[rgba(73,205,225,0.18)] bg-[linear-gradient(135deg,rgba(73,205,225,0.08)_0%,rgba(224,82,156,0.06)_100%)] p-6">
              <SectionEyebrow>Commercial Purpose</SectionEyebrow>
              <SectionTitle>Quoted scope and approval pack</SectionTitle>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {[
                  isStandaloneQuote
                    ? "This document turns a scoped standalone job brief into a commercial quote with optional products, retainers, and add-on services."
                    : "This document turns the approved discovery recommendation into a commercial quote with phase-level pricing.",
                  "It is designed to support review, approval, and selective commercial sign-off if the client wants to proceed with only part of the recommended scope.",
                  isStandaloneQuote
                    ? "Once approved, the accepted line items become the commercial baseline for delivery or a separate implementation plan."
                    : "Once approved, the accepted phases become the commercial baseline for planning and delivery."
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(11,17,38,0.65)] p-4 text-sm leading-7 text-text-secondary"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </section>

            {!isPortalMode ? (
              <section className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <SectionEyebrow>Editable Fields</SectionEyebrow>
                <SectionTitle>Core commercial copy</SectionTitle>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-text-secondary">
                  Edit the full quote content here before you push the quote to
                  the client portal.
                </p>
                <div className="mt-6 grid gap-4">
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-text-muted">
                      Quote context summary
                    </span>
                    <textarea
                      value={quoteContextSummaryDraft}
                      onChange={(event) =>
                        setQuoteContextSummaryDraft(event.target.value)
                      }
                      className="min-h-[140px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                    />
                  </label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-text-muted">
                        In scope
                      </span>
                      <textarea
                        value={inScopeDraft}
                        onChange={(event) => setInScopeDraft(event.target.value)}
                        className="min-h-[180px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-text-muted">
                        Out of scope
                      </span>
                      <textarea
                        value={outOfScopeDraft}
                        onChange={(event) => setOutOfScopeDraft(event.target.value)}
                        className="min-h-[180px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                      />
                    </label>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-text-muted">
                        Primary challenge
                      </span>
                      <textarea
                        value={quoteContentDraft.primaryChallenge ?? ""}
                        onChange={(event) =>
                          setQuoteContentDraft((currentDraft) => ({
                            ...currentDraft,
                            primaryChallenge: event.target.value
                          }))
                        }
                        className="min-h-[120px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-text-muted">
                        Success outcomes
                      </span>
                      <textarea
                        value={quoteContentDraft.successOutcomes ?? ""}
                        onChange={(event) =>
                          setQuoteContentDraft((currentDraft) => ({
                            ...currentDraft,
                            successOutcomes: event.target.value
                          }))
                        }
                        className="min-h-[120px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                      />
                    </label>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      ["engagementTrack", "Engagement track"],
                      ["platformFit", "Platform fit"],
                      ["changeManagement", "Change management"],
                      ["dataReadiness", "Data readiness"],
                      ["currentStack", "Current stack"],
                      ["hubspotToday", "HubSpot today"],
                      ["dataLandscape", "Data landscape"],
                      ["currentProcesses", "Current processes"],
                      ["hubsAndFeatures", "Hubs and features"],
                      ["pipelineAndProcess", "Pipeline and process"],
                      ["automation", "Automation"],
                      ["reporting", "Reporting"],
                      ["howWeWillWork", "How we will work"],
                      ["howScopeIsControlled", "How scope is controlled"],
                      ["howClientParticipates", "How the client participates"],
                      ["packagingFitLabel", "Packaging fit"],
                      ["packagingFitSummary", "Packaging summary"],
                      ["whyPackagingRecommendation", "Why this recommendation was made"],
                      ["workaroundPath", "Lower-tier workaround path"],
                      ["recommendedNextStep", "Recommended next step"],
                      ["approvalSummary", "Approval copy"],
                      ["termsAndWorkingScope", "Terms and working scope"]
                    ].map(([field, label]) => (
                      <label key={field} className="block">
                        <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-text-muted">
                          {label}
                        </span>
                        <textarea
                          value={
                            (quoteContentDraft[
                              field as keyof QuoteContentOverrides
                            ] as string | null | undefined) ?? ""
                          }
                          onChange={(event) =>
                            setQuoteContentDraft((currentDraft) => ({
                              ...currentDraft,
                              [field]: event.target.value
                            }))
                          }
                          className="min-h-[120px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-text-muted">
                        Supporting tools
                      </span>
                      <textarea
                        value={supportingToolsDraft}
                        onChange={(event) =>
                          setSupportingToolsDraft(event.target.value)
                        }
                        className="min-h-[120px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-text-muted">
                        Key risks
                      </span>
                      <textarea
                        value={keyRisksDraft}
                        onChange={(event) => setKeyRisksDraft(event.target.value)}
                        className="min-h-[120px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-text-muted">
                        Client responsibilities
                      </span>
                      <textarea
                        value={clientResponsibilitiesDraft}
                        onChange={(event) =>
                          setClientResponsibilitiesDraft(event.target.value)
                        }
                        className="min-h-[120px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-text-muted">
                        Open questions
                      </span>
                      <textarea
                        value={nextQuestionsDraft}
                        onChange={(event) =>
                          setNextQuestionsDraft(event.target.value)
                        }
                        className="min-h-[120px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-text-muted">
                      Payment schedule
                    </span>
                    <textarea
                      value={paymentScheduleDraft}
                      onChange={(event) =>
                        setPaymentScheduleDraft(event.target.value)
                      }
                      className="min-h-[100px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-sm text-white outline-none"
                    />
                  </label>
                </div>
              </section>
            ) : null}

            {!isPortalMode && phaseCommercials.length > 0 ? (
              <section className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <SectionEyebrow>Commercial Composition</SectionEyebrow>
                <SectionTitle>
                  Select the phases to include in this quote
                </SectionTitle>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-text-secondary">
                  Use this to shape the commercial offer from the available
                  implementation phases. This lets you quote the full plan or
                  only the parts the client wants to proceed with now.
                </p>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  {phaseCommercials.map((phase) => (
                    <label
                      key={`compose-${phase.phase}`}
                      className="flex items-start gap-4 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                    >
                      <input
                        type="checkbox"
                        checked={phase.included}
                        onChange={(event) =>
                          setPhaseDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [phase.phase]: {
                              included: event.target.checked,
                              humanHours:
                                currentDrafts[phase.phase]?.humanHours ??
                                String(phase.humanHours),
                              rate:
                                currentDrafts[phase.phase]?.rate ?? defaultRate
                            }
                          }))
                        }
                        className="mt-1"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">
                          Phase {phase.phase} - {phase.phaseName}
                        </p>
                        <p className="mt-2 text-sm text-text-secondary">
                          {
                            phase.tasks.filter((task) => task.type !== "Client")
                              .length
                          }{" "}
                          implementation tasks · {phase.humanHours} hrs ·{" "}
                          {formatCurrency(phase.feeZar, currency)}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-6">
                <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <SectionEyebrow>Quote Context</SectionEyebrow>
                  <SectionTitle>What this quote is based on</SectionTitle>
                  <p className="mt-4 text-sm leading-7 text-text-secondary">
                    {displayQuoteContextSummary}
                  </p>
                </div>

                {!isStandaloneQuote ? (
                  <>
                    <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                      <SectionEyebrow>Commercial Framing</SectionEyebrow>
                      <SectionTitle>
                        Why this implementation is being quoted
                      </SectionTitle>
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            Primary challenge
                          </p>
                          <p className="mt-3 text-sm leading-7 text-text-secondary">
                            {displayQuoteContent.primaryChallenge}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            Success outcomes
                          </p>
                          <div className="mt-3 space-y-2 text-sm text-text-secondary">
                            {splitIntoLines(
                              displayQuoteContent.successOutcomes ?? ""
                            ).map((line) => (
                              <p key={line}>{line}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                      <SectionEyebrow>Discovery Outcomes</SectionEyebrow>
                      <SectionTitle>
                        Commercial assumptions from discovery
                      </SectionTitle>
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        {[
                          [
                            "Engagement track",
                            displayQuoteContent.engagementTrack ?? "Not set"
                          ],
                          ["Platform fit", displayQuoteContent.platformFit ?? "Not set"],
                          [
                            "Change management",
                            displayQuoteContent.changeManagement ?? "Not set"
                          ],
                          [
                            "Data readiness",
                            displayQuoteContent.dataReadiness ?? "Not set"
                          ]
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                          >
                            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                              {label}
                            </p>
                            <p className="mt-2 text-sm font-medium text-white">
                              {value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                      <SectionEyebrow>Current State</SectionEyebrow>
                      <SectionTitle>
                        Commercially relevant current-state notes
                      </SectionTitle>
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        {[
                          ["Current stack", displayQuoteContent.currentStack],
                          ["HubSpot today", displayQuoteContent.hubspotToday],
                          ["Data landscape", displayQuoteContent.dataLandscape],
                          ["Current processes", displayQuoteContent.currentProcesses]
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                          >
                            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                              {label}
                            </p>
                            <div className="mt-3 space-y-2 text-sm text-text-secondary">
                              {splitIntoLines(value).map((line) => (
                                <p key={line}>{line}</p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                      <SectionEyebrow>Recommended Future State</SectionEyebrow>
                      <SectionTitle>
                        What this quote is intended to deliver
                      </SectionTitle>
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        {[
                          [
                            "Hubs & features",
                            displayQuoteContent.hubsAndFeatures
                          ],
                          [
                            "Pipeline & process",
                            displayQuoteContent.pipelineAndProcess
                          ],
                          ["Automation", displayQuoteContent.automation],
                          ["Reporting", displayQuoteContent.reporting]
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                          >
                            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                              {label}
                            </p>
                            <div className="mt-3 space-y-2 text-sm text-text-secondary">
                              {splitIntoLines(value).map((line) => (
                                <p key={line}>{line}</p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                      <SectionEyebrow>Delivery Approach</SectionEyebrow>
                      <SectionTitle>
                        How the quoted work is expected to run
                      </SectionTitle>
                      <div className="mt-5 grid gap-4 md:grid-cols-3">
                        {[
                          [
                            "How we will work",
                            displayQuoteContent.howWeWillWork
                          ],
                          [
                            "How scope is controlled",
                            displayQuoteContent.howScopeIsControlled
                          ],
                          [
                            "How the client participates",
                            displayQuoteContent.howClientParticipates
                          ]
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                          >
                            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                              {label}
                            </p>
                            <p className="mt-3 text-sm leading-7 text-text-secondary">
                              {value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                    <SectionEyebrow>Commercial Framing</SectionEyebrow>
                    <SectionTitle>
                      How this standalone quote should be used
                    </SectionTitle>
                    <div className="mt-5 grid gap-4 md:grid-cols-3">
                      {[
                        [
                          "What is being quoted",
                          "The line items and optional products below describe the commercial offer for this standalone job."
                        ],
                        [
                          "How scope is controlled",
                          "The accepted products and any agreed notes become the commercial baseline. Changes should be added as new line items or a revised quote."
                        ],
                        [
                          "What happens next",
                          "If approved, this quote can move straight into delivery or be converted into a more detailed implementation plan."
                        ]
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
                        >
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            {label}
                          </p>
                          <p className="mt-3 text-sm leading-7 text-text-secondary">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <SectionEyebrow>Scope</SectionEyebrow>
                  <SectionTitle>Quoted inclusions and exclusions</SectionTitle>
                  <div className="mt-5 grid gap-4">
                    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        In Scope
                      </p>
                      <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                        {displayInScopeItems.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                        Out of Scope
                      </p>
                      <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                        {displayOutOfScopeItems.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {quoteContext?.retainerScope &&
                (quoteContext.retainerScope.summary ||
                  quoteContext.retainerScope.requirements ||
                  (quoteContext.retainerScope.deliverables?.length ?? 0) > 0 ||
                  quoteContext.retainerScope.approvalTerms) ? (
                  <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                    <SectionEyebrow>Retainer</SectionEyebrow>
                    <SectionTitle>Scope &amp; Terms</SectionTitle>
                    <div className="mt-5 space-y-4">
                      {quoteContext.retainerScope.summary ? (
                        <p className="text-sm leading-7 text-text-secondary">
                          {quoteContext.retainerScope.summary}
                        </p>
                      ) : null}
                      {quoteContext.retainerScope.requirements ? (
                        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            Requirements
                          </p>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-text-secondary">
                            {quoteContext.retainerScope.requirements}
                          </p>
                        </div>
                      ) : null}
                      {quoteContext.retainerScope.deliverables &&
                      quoteContext.retainerScope.deliverables.length > 0 ? (
                        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            Deliverables
                          </p>
                          <ul className="mt-3 space-y-3 text-sm text-text-secondary">
                            {quoteContext.retainerScope.deliverables.map(
                              (deliverable, index) => (
                                <li
                                  key={`${deliverable.title}-${index}`}
                                  className="leading-6"
                                >
                                  <p className="font-semibold text-white">
                                    {deliverable.title}
                                  </p>
                                  {deliverable.description ? (
                                    <p className="mt-1 text-text-muted">
                                      {deliverable.description}
                                    </p>
                                  ) : null}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      ) : null}
                      {quoteContext.retainerScope.approvalTerms ? (
                        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            Approval Terms
                          </p>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-text-secondary">
                            {quoteContext.retainerScope.approvalTerms}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {isStandaloneQuote ? (
                  <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                    <SectionEyebrow>Delivery Watch-Outs</SectionEyebrow>
                    <SectionTitle>
                      Tools, risks, and open questions
                    </SectionTitle>
                    <div className="mt-4 space-y-4">
                      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Supporting tools
                        </p>
                        <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                          {(displaySupportingTools.length
                            ? displaySupportingTools
                            : [
                                "No supporting tools recommended yet. Refresh the scoped summary after adding more source material."
                              ]
                          ).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Key risks
                        </p>
                        <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                          {(displayKeyRisks.length
                            ? displayKeyRisks
                            : [
                                "No key risks surfaced yet. Refresh the scoped summary after adding more context."
                              ]
                          ).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Recommended next questions
                        </p>
                        <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                          {(displayNextQuestions.length
                            ? displayNextQuestions
                            : [
                                "No next questions generated yet. Refresh the scoped summary after adding more source material."
                              ]
                          ).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : null}

                {isStandaloneQuote &&
                recommendDocumentationPack &&
                documentationProduct ? (
                  <div className="document-card rounded-2xl border border-[rgba(73,205,225,0.16)] bg-[rgba(73,205,225,0.08)] p-6">
                    <SectionEyebrow>Recommended Add-On</SectionEyebrow>
                    <SectionTitle>Documentation & SOP Pack</SectionTitle>
                    <p className="mt-4 text-sm leading-7 text-text-secondary">
                      This scoped job would benefit from a formal SOP and
                      documentation layer so the agreed data model, process
                      flow, handover notes, and operating guidance do not stay
                      trapped in delivery conversations.
                    </p>
                    <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                      <p className="text-sm font-medium text-white">
                        {documentationProduct.name}
                      </p>
                      {documentationProduct.description ? (
                        <p className="mt-2 text-sm text-text-secondary">
                          {documentationProduct.description}
                        </p>
                      ) : null}
                      <p className="mt-3 text-sm text-white">
                        Recommended commercial add-on:{" "}
                        {formatCurrency(
                          documentationProduct.unitPrice,
                          currency
                        )}
                      </p>
                    </div>
                  </div>
                ) : null}

                {project.packagingAssessment ||
                displayQuoteContent.packagingFitSummary ||
                displayQuoteContent.whyPackagingRecommendation ||
                displayQuoteContent.workaroundPath ||
                displayQuoteContent.recommendedNextStep ? (
                  <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                    <SectionEyebrow>Platform Packaging</SectionEyebrow>
                    <SectionTitle>
                      HubSpot package fit for this scope
                    </SectionTitle>
                    <div className="mt-4 space-y-4">
                      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Packaging fit
                        </p>
                        <p className="mt-2 text-sm text-white">
                          {displayQuoteContent.packagingFitLabel}
                        </p>
                        <p
                          className={`mt-2 text-sm font-medium ${
                            project?.packagingAssessment?.fit === "good"
                              ? "text-[#51d0b0]"
                              : project?.packagingAssessment?.fit === "attention"
                                ? "text-[#f8c16c]"
                                : "text-[#ff8a8a]"
                          }`}
                        >
                          {(project?.packagingAssessment?.fit ?? "good").replace(
                            /_/g,
                            " "
                          )}
                        </p>
                        <p className="mt-2 text-sm text-text-secondary">
                          {displayQuoteContent.packagingFitSummary}
                        </p>
                      </div>
                      {splitIntoLines(
                        displayQuoteContent.whyPackagingRecommendation ?? ""
                      ).length > 0 ? (
                        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            Why this recommendation was made
                          </p>
                          <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                            {splitIntoLines(
                              displayQuoteContent.whyPackagingRecommendation ??
                                ""
                            ).map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {project?.packagingAssessment?.warnings?.length ? (
                        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            Packaging watch-outs
                          </p>
                          <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                            {project.packagingAssessment.warnings.map(
                              (warning) => (
                                <li key={warning}>{warning}</li>
                              )
                            )}
                          </ul>
                        </div>
                      ) : null}
                      {displayQuoteContent.workaroundPath ? (
                        <div className="rounded-2xl border border-[rgba(73,205,225,0.16)] bg-[rgba(73,205,225,0.08)] p-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#49cde1]">
                            Lower-tier workaround path
                          </p>
                          <p className="mt-2 text-sm text-white">
                            {displayQuoteContent.workaroundPath}
                          </p>
                        </div>
                      ) : null}
                      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Recommended next step
                        </p>
                        <p className="mt-2 text-sm text-text-secondary">
                          {displayQuoteContent.recommendedNextStep}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {!isStandaloneQuote ? (
                  <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                    <SectionEyebrow>Risks & Dependencies</SectionEyebrow>
                    <SectionTitle>
                      What could affect commercials or timing
                    </SectionTitle>
                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="text-sm font-medium text-white">
                          Key risks
                        </p>
                        <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                          {displayKeyRisks.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          Client responsibilities
                        </p>
                        <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                          {displayClientResponsibilities.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      {displayNextQuestions.length > 0 ? (
                        <div>
                          <p className="text-sm font-medium text-white">
                            Open questions to resolve during approval
                          </p>
                          <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                            {displayNextQuestions.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            {displayPhaseCommercials.length > 0 ? (
              <section className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <SectionEyebrow>Phased Implementation Scope</SectionEyebrow>
                    <SectionTitle>
                      Proposed onboarding phases and commercial split
                    </SectionTitle>
                  </div>
                  {displayBlueprintGeneratedAt ? (
                    <p className="text-sm text-text-secondary">
                      Generated {formatDate(displayBlueprintGeneratedAt)}
                    </p>
                  ) : null}
                </div>

                <div className="mt-6 space-y-5">
                  {displayPhaseCommercials.map((phase) => (
                    <div
                      key={phase.phase}
                      className={`rounded-2xl border p-5 ${
                        phase.included
                          ? "border-[rgba(255,255,255,0.07)] bg-[#0b1126]"
                          : "border-[rgba(255,255,255,0.05)] bg-[rgba(11,17,38,0.55)] opacity-60"
                      }`}
                    >
                      <div className="grid gap-4 lg:grid-cols-[1fr_140px_160px_180px]">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                              Phase {phase.phase}
                            </p>
                            <span
                              className={`rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${
                                phase.included
                                  ? "border border-[rgba(73,205,225,0.22)] bg-[rgba(73,205,225,0.12)] text-[#7be2ef]"
                                  : "border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.04)] text-text-muted"
                              }`}
                            >
                              {phase.included
                                ? "Included in quote"
                                : "Not included"}
                            </span>
                          </div>
                          <h3 className="mt-2 text-lg font-semibold text-white">
                            {phase.phaseName}
                          </h3>
                          <ul className="mt-4 space-y-2 text-sm text-text-secondary">
                            {phase.tasks
                              .filter((task) => task.type !== "Client")
                              .map((task) => (
                                <li key={task.id}>{task.name}</li>
                              ))}
                          </ul>
                        </div>

                        <label className="block">
                          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-text-muted">
                            Human Hours
                          </span>
                          <input
                            value={
                              phaseDrafts[phase.phase]?.humanHours ??
                              String(phase.humanHours)
                            }
                            disabled={isPortalMode}
                            onChange={(event) =>
                              setPhaseDrafts((currentDrafts) => ({
                                ...currentDrafts,
                                [phase.phase]: {
                                  included:
                                    currentDrafts[phase.phase]?.included ??
                                    true,
                                  humanHours: event.target.value,
                                  rate:
                                    currentDrafts[phase.phase]?.rate ??
                                    defaultRate
                                }
                              }))
                            }
                            className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none focus:border-accent-solid"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-text-muted">
                            Hourly Rate
                          </span>
                          <div className="flex items-center rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2">
                            <span className="mr-2 text-xs text-text-secondary">
                              {currencySymbols[currency]}
                            </span>
                            <input
                              value={
                                phaseDrafts[phase.phase]?.rate ?? defaultRate
                              }
                              disabled={isPortalMode}
                              onChange={(event) =>
                                setPhaseDrafts((currentDrafts) => ({
                                  ...currentDrafts,
                                  [phase.phase]: {
                                    included:
                                      currentDrafts[phase.phase]?.included ??
                                      true,
                                    humanHours:
                                      currentDrafts[phase.phase]?.humanHours ??
                                      String(phase.humanHours),
                                    rate: event.target.value
                                  }
                                }))
                              }
                              className="w-full bg-transparent text-sm text-white outline-none"
                            />
                          </div>
                        </label>

                        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            Phase Fee
                          </p>
                          <p className="mt-2 text-xl font-semibold text-white">
                            {formatCurrency(phase.feeZar, currency)}
                          </p>
                          <p className="mt-2 text-xs text-text-secondary">
                            Client dependencies:{" "}
                            {
                              phase.tasks.filter(
                                (task) => task.type === "Client"
                              ).length
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

                {!isPortalMode ? (
                  <section className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <SectionEyebrow>Additional Products</SectionEyebrow>
                <SectionTitle>Retainers and add-on services</SectionTitle>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-text-secondary">
                  Optional products can be added to the commercial quote without
                  changing the discovery document, which keeps the
                  implementation recommendation separate from the buying
                  decision.
                </p>

                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Manual line items
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        Add custom quote items directly here when the standard
                        product list does not match the deal. For retainers, use
                        quantity as months, unit price as the monthly fee, and
                        capture hours, rate, carry-over, and payment terms in
                        the description.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setManualProductLines((currentLines) => [
                            ...currentLines,
                            createRetainerOptionLineDraft(
                              `Retainer option ${currentLines.filter((line) =>
                                line.name.toLowerCase().includes("retainer option")
                              ).length + 1}`,
                              defaultRate
                            )
                          ])
                        }
                        className="rounded-full border border-[rgba(73,205,225,0.18)] px-4 py-2 text-sm text-white"
                      >
                        Add retainer option
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setManualProductLines((currentLines) => [
                            ...currentLines,
                            createManualProductLineDraft()
                          ])
                        }
                        className="rounded-full border border-[rgba(255,255,255,0.1)] px-4 py-2 text-sm text-white"
                      >
                        Add line item
                      </button>
                    </div>
                  </div>
                  {manualProductLines.map((line) => (
                    <div
                      key={line.id}
                      className="grid gap-4 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5 lg:grid-cols-[1fr_110px_120px_140px_120px_140px_180px]"
                    >
                      <div className="space-y-3">
                        <input
                          value={line.name}
                          onChange={(event) =>
                            setManualProductLines((currentLines) =>
                              currentLines.map((currentLine) =>
                                currentLine.id === line.id
                                  ? { ...currentLine, name: event.target.value }
                                  : currentLine
                              )
                            )
                          }
                          placeholder="Line item name"
                          className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
                        />
                        <textarea
                          value={line.description}
                          onChange={(event) =>
                            setManualProductLines((currentLines) =>
                              currentLines.map((currentLine) =>
                                currentLine.id === line.id
                                  ? {
                                      ...currentLine,
                                      description: event.target.value
                                    }
                                  : currentLine
                              )
                            )
                          }
                          placeholder="Description"
                          className="min-h-[90px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
                        />
                        {line.monthlyHours && line.hourlyRate ? (
                          <p className="text-xs text-text-muted">
                            {line.monthlyHours} hrs/month at{" "}
                            {currencySymbols[currency]} {line.hourlyRate}/hr
                          </p>
                        ) : null}
                      </div>
                      <input
                        value={line.quantity}
                        onChange={(event) =>
                          setManualProductLines((currentLines) =>
                            currentLines.map((currentLine) =>
                              currentLine.id === line.id
                                ? { ...currentLine, quantity: event.target.value }
                                : currentLine
                            )
                          )
                        }
                        placeholder="Qty"
                        className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
                      />
                      <input
                        value={line.monthlyHours}
                        onChange={(event) =>
                          setManualProductLines((currentLines) =>
                            currentLines.map((currentLine) =>
                              currentLine.id === line.id
                                ? {
                                    ...currentLine,
                                    monthlyHours: event.target.value
                                  }
                                : currentLine
                            )
                          )
                        }
                        placeholder="Hours / month"
                        className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
                      />
                      <select
                        value={line.category}
                        onChange={(event) =>
                          setManualProductLines((currentLines) =>
                            currentLines.map((currentLine) =>
                              currentLine.id === line.id
                                ? { ...currentLine, category: event.target.value }
                                : currentLine
                            )
                          )
                        }
                        className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
                      >
                        <option value="retainer">Retainer</option>
                        <option value="add_on">Add-on</option>
                        <option value="one_time">One-time</option>
                      </select>
                      <input
                        value={line.unitLabel}
                        onChange={(event) =>
                          setManualProductLines((currentLines) =>
                            currentLines.map((currentLine) =>
                              currentLine.id === line.id
                                ? { ...currentLine, unitLabel: event.target.value }
                                : currentLine
                            )
                          )
                        }
                        placeholder="Unit label"
                        className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
                      />
                      <input
                        value={line.hourlyRate}
                        onChange={(event) =>
                          setManualProductLines((currentLines) =>
                            currentLines.map((currentLine) =>
                              currentLine.id === line.id
                                ? {
                                    ...currentLine,
                                    hourlyRate: event.target.value
                                  }
                                : currentLine
                            )
                          )
                        }
                        placeholder="Hourly rate"
                        className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
                      />
                      <input
                        value={line.unitPrice}
                        onChange={(event) =>
                          setManualProductLines((currentLines) =>
                            currentLines.map((currentLine) =>
                              currentLine.id === line.id
                                ? { ...currentLine, unitPrice: event.target.value }
                                : currentLine
                            )
                          )
                        }
                        placeholder="Unit price"
                        className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
                      />
                      <div className="flex flex-col justify-between rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
                        <select
                          value={line.billingModel}
                          onChange={(event) =>
                            setManualProductLines((currentLines) =>
                              currentLines.map((currentLine) =>
                                currentLine.id === line.id
                                  ? {
                                      ...currentLine,
                                      billingModel: event.target.value
                                    }
                                  : currentLine
                              )
                            )
                          }
                          className="mb-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-3 py-2 text-sm text-white outline-none"
                        >
                          <option value="monthly">Monthly recurring</option>
                          <option value="retainer">Retainer</option>
                          <option value="fixed">Fixed fee</option>
                          <option value="hourly">Hourly</option>
                        </select>
                        <label className="flex items-center gap-3 text-sm text-white">
                          <input
                            type="checkbox"
                            checked={line.included}
                            onChange={(event) =>
                              setManualProductLines((currentLines) =>
                                currentLines.map((currentLine) =>
                                  currentLine.id === line.id
                                    ? {
                                        ...currentLine,
                                        included: event.target.checked
                                      }
                                    : currentLine
                                )
                              )
                            }
                          />
                          Include in quote
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setManualProductLines((currentLines) =>
                              currentLines.filter(
                                (currentLine) => currentLine.id !== line.id
                              )
                            )
                          }
                          className="mt-4 rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-text-muted"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  {linkedRetainerLine ? (
                    <div className="rounded-2xl border border-[rgba(73,205,225,0.18)] bg-[rgba(73,205,225,0.08)] p-5">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-lg font-semibold text-white">
                          {linkedRetainerLine.name}
                        </p>
                        <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-text-muted">
                          Linked retainer
                        </span>
                        <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-text-muted">
                          Auto included
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-text-secondary">
                        {linkedRetainerLine.description}
                      </p>
                      <p className="mt-4 text-sm text-white">
                        {formatCurrency(linkedRetainerLine.lineTotalZar, currency)}
                      </p>
                    </div>
                  ) : null}
                  {products
                    .filter((product) => product.isActive)
                    .map((product) => {
                      const selection = selectedProducts[product.id] ?? {
                        included: false,
                        quantity: String(product.defaultQuantity),
                        unitPrice: String(product.unitPrice)
                      };

                      return (
                        <div
                          key={product.id}
                          className="grid gap-4 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-5 lg:grid-cols-[1fr_140px_140px_180px]"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-3">
                              <p className="text-lg font-semibold text-white">
                                {product.name}
                              </p>
                              <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-text-muted">
                                {formatProductCategory(product.category)}
                              </span>
                              <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-text-muted">
                                {formatBillingModel(product.billingModel)}
                              </span>
                            </div>
                            {product.description ? (
                              <p className="mt-3 text-sm leading-7 text-text-secondary">
                                {product.description}
                              </p>
                            ) : null}
                          </div>

                          <label className="block">
                            <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-text-muted">
                              Quantity
                            </span>
                            <input
                              value={selection.quantity}
                              disabled={isPortalMode}
                              onChange={(event) =>
                                setSelectedProducts((currentProducts) => ({
                                  ...currentProducts,
                                  [product.id]: {
                                    ...selection,
                                    quantity: event.target.value
                                  }
                                }))
                              }
                              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-text-muted">
                              Unit Price
                            </span>
                            <input
                              value={selection.unitPrice}
                              disabled={isPortalMode}
                              onChange={(event) =>
                                setSelectedProducts((currentProducts) => ({
                                  ...currentProducts,
                                  [product.id]: {
                                    ...selection,
                                    unitPrice: event.target.value
                                  }
                                }))
                              }
                              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-3 py-2 text-sm text-white outline-none"
                            />
                          </label>

                          <div className="flex flex-col justify-between rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
                            <label className="flex items-center gap-3 text-sm text-white">
                              <input
                                type="checkbox"
                                checked={selection.included}
                                disabled={isPortalMode}
                                onChange={(event) =>
                                  setSelectedProducts((currentProducts) => ({
                                    ...currentProducts,
                                    [product.id]: {
                                      ...selection,
                                      included: event.target.checked
                                    }
                                  }))
                                }
                              />
                              Include in quote
                            </label>
                            <p className="mt-4 text-sm text-text-secondary">
                              {formatCurrency(
                                parseNumber(
                                  selection.quantity,
                                  product.defaultQuantity
                                ) *
                                  parseNumber(
                                    selection.unitPrice,
                                    product.unitPrice
                                  ),
                                currency
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </section>
            ) : null}

            {isPortalMode && allDisplayProductLines.length > 0 ? (
              <section className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <SectionEyebrow>Commercial Options</SectionEyebrow>
                <SectionTitle>Retainer options and add-on services</SectionTitle>
                <p className="mt-4 text-sm leading-7 text-text-secondary">
                  If more than one retainer option is shown below, select the
                  preferred option before approving the quote. The approved
                  total, hours, and rate will follow the selected option.
                </p>
                <div className="mt-6 space-y-4">
                  {allDisplayProductLines.map((product) => {
                    const optionGroup = product.metadata?.optionGroup?.trim();
                    const isSelectedOption = optionGroup
                      ? selectedPortalOptionIds[optionGroup] === product.id
                      : true;

                    return (
                      <label
                        key={product.id}
                        className={`block rounded-2xl border p-5 ${
                          isSelectedOption
                            ? "border-[rgba(73,205,225,0.22)] bg-[rgba(73,205,225,0.08)]"
                            : "border-[rgba(255,255,255,0.07)] bg-[#0b1126]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-3">
                              <p className="text-lg font-semibold text-white">
                                {product.name}
                              </p>
                              {optionGroup ? (
                                <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-text-muted">
                                  Option
                                </span>
                              ) : null}
                            </div>
                            {product.description ? (
                              <p className="mt-3 text-sm leading-7 text-text-secondary">
                                {product.description}
                              </p>
                            ) : null}
                            <div className="mt-4 flex flex-wrap gap-3 text-sm text-text-secondary">
                              {product.metadata?.monthlyHours ? (
                                <span>
                                  {product.metadata.monthlyHours} hrs/month
                                </span>
                              ) : null}
                              {product.metadata?.hourlyRate ? (
                                <span>
                                  {currencySymbols[currency]}{" "}
                                  {product.metadata.hourlyRate}/hr
                                </span>
                              ) : null}
                              <span>
                                {product.quantity} {product.unitLabel}
                                {product.quantity > 1 ? "s" : ""}
                              </span>
                              <span>{formatCurrency(product.lineTotalZar, currency)}</span>
                            </div>
                          </div>
                          {optionGroup ? (
                            <input
                              type="radio"
                              name={`option-group-${optionGroup}`}
                              checked={isSelectedOption}
                              onChange={() =>
                                setSelectedPortalOptionIds((currentSelections) => ({
                                  ...currentSelections,
                                  [optionGroup]: product.id
                                }))
                              }
                              className="mt-1"
                            />
                          ) : null}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className="grid gap-6 xl:grid-cols-[0.72fr_0.28fr]">
              <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <SectionEyebrow>Commercial Summary</SectionEyebrow>
                <SectionTitle>Phase-by-phase investment</SectionTitle>
                <div className="mt-5 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.07)]">
                  <div className="grid grid-cols-[1.4fr_120px_140px_160px] gap-4 border-b border-[rgba(255,255,255,0.07)] bg-[#10172f] px-5 py-3 text-xs uppercase tracking-[0.2em] text-text-muted">
                    <span>Phase</span>
                    <span>Hours</span>
                    <span>Rate</span>
                    <span className="text-right">Fee</span>
                  </div>
                  {displayPhaseCommercials.map((phase) =>
                    phase.included ? (
                      <div
                        key={phase.phase}
                        className="grid grid-cols-[1.4fr_120px_140px_160px] gap-4 border-b border-[rgba(255,255,255,0.05)] px-5 py-4 text-sm text-white last:border-b-0"
                      >
                        <span>
                          Phase {phase.phase} - {phase.phaseName}
                        </span>
                        <span>{phase.humanHours} hrs</span>
                        <span>
                          {currencySymbols[currency]} {phase.rate}
                        </span>
                        <span className="text-right">
                          {formatCurrency(phase.feeZar, currency)}
                        </span>
                      </div>
                    ) : null
                  )}
                  {allDisplayProductLines.map((product) => (
                    <div
                      key={product.id}
                      className="grid grid-cols-[1.4fr_120px_140px_160px] gap-4 border-b border-[rgba(255,255,255,0.05)] px-5 py-4 text-sm text-white last:border-b-0"
                    >
                      <span>
                        {product.name}
                        {product.metadata?.optionGroup ? (
                          <span className="ml-2 text-xs text-text-muted">
                            {activeProductLineIds.has(product.id)
                              ? "(active option)"
                              : "(alternative option)"}
                          </span>
                        ) : null}
                      </span>
                      <span>
                        {product.metadata?.monthlyHours
                          ? `${product.metadata.monthlyHours * product.quantity} hrs`
                          : `${product.quantity} ${product.unitLabel}${product.quantity > 1 ? "s" : ""}`}
                      </span>
                      <span>
                        {product.metadata?.hourlyRate
                          ? `${currencySymbols[currency]} ${product.metadata.hourlyRate}/hr`
                          : `${currencySymbols[currency]} ${product.unitPrice}`}
                      </span>
                      <span className="text-right">
                        {formatCurrency(product.lineTotalZar, currency)}
                      </span>
                    </div>
                  ))}
                  <div className="grid grid-cols-[1.4fr_120px_140px_160px] gap-4 border-t border-[rgba(255,255,255,0.07)] bg-[#10172f] px-5 py-4 text-sm font-semibold text-white">
                    <span>Total</span>
                    <span>{displayTotals.totalHumanHours} hrs + extras</span>
                    <span />
                    <span className="text-right">
                      {formatCurrency(displayTotals.grandTotalZar, currency)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <SectionEyebrow>Approval</SectionEyebrow>
                <SectionTitle>Client review and sign-off</SectionTitle>
                <p className="mt-4 text-sm leading-7 text-text-secondary">
                  {isApprovedQuote
                    ? "This quote has been approved in the client portal. The approved commercial scope is now the delivery baseline and scope-driving changes should move through change management."
                    : quoteApprovalStatus === "shared"
                      ? "This quote has been shared to the client portal and is waiting for client approval."
                      : displayQuoteContent.approvalSummary}
                </p>
                <div className="mt-6 space-y-4 text-sm text-text-secondary">
                  <p>
                    Approval status:{" "}
                    {isApprovedQuote
                      ? "Approved"
                      : quoteApprovalStatus === "shared"
                        ? "Shared with client"
                        : "Draft"}
                  </p>
                  <p>
                    {isApprovedQuote
                      ? `Approved by ${project.quoteApprovedByName || project.quoteApprovedByEmail || "client"}${project.quoteApprovedAt ? ` on ${formatDate(project.quoteApprovedAt)}` : ""}`
                      : "Prepared from structured discovery, blueprint, and phased estimate"}
                  </p>
                  <p>
                    {isApprovedQuote
                      ? "Scope changes now need to be handled as formal change requests."
                      : "Scope changes after approval should be captured as formal change requests"}
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.58fr_0.42fr]">
              {displayPaymentSchedule.length > 0 ? (
                <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <SectionEyebrow>Payment Schedule</SectionEyebrow>
                  <SectionTitle>Suggested payment milestones</SectionTitle>
                  <div className="mt-5 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.07)]">
                    <div className="grid grid-cols-[120px_1fr_160px] gap-4 border-b border-[rgba(255,255,255,0.07)] bg-[#10172f] px-5 py-3 text-xs uppercase tracking-[0.2em] text-text-muted">
                      <span>Payment</span>
                      <span>Due</span>
                      <span className="text-right">Amount</span>
                    </div>
                    {displayPaymentSchedule.map((due, index) => (
                      <div
                        key={due}
                        className="grid grid-cols-[120px_1fr_160px] gap-4 border-b border-[rgba(255,255,255,0.05)] px-5 py-4 text-sm text-white last:border-b-0"
                      >
                        <span>Payment {index + 1}</span>
                        <span>{due}</span>
                        <span className="text-right">
                          {formatCurrency(
                            displayTotals.paymentAmountZar,
                            currency
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                  <SectionEyebrow>Payment Schedule</SectionEyebrow>
                  <SectionTitle>Optional payment milestones</SectionTitle>
                  <p className="mt-4 text-sm leading-7 text-text-secondary">
                    No payment schedule has been included in this quote.
                  </p>
                </div>
              )}

              <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <SectionEyebrow>Terms & Working Scope</SectionEyebrow>
                <SectionTitle>How this quote should be used</SectionTitle>
                <div className="mt-4 space-y-4 text-sm leading-7 text-text-secondary">
                  {splitIntoLines(
                    displayQuoteContent.termsAndWorkingScope ?? ""
                  ).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
      <style jsx global>{`
        @media print {
          .document-shell {
            padding: 0 !important;
          }

          .document-toolbar,
          .sidebar,
          nav,
          aside,
          button,
          a[href^="/projects/"],
          a[href^="/client/projects/"],
          a[href^="/partner/projects/"] {
            display: none !important;
          }

          main {
            padding-left: 0 !important;
          }

          body,
          html {
            background: #ffffff !important;
          }

          .document-content {
            color: #111827 !important;
          }

          .document-card {
            break-inside: avoid;
            border-color: #d1d5db !important;
            background: #ffffff !important;
            box-shadow: none !important;
          }

          .document-card *,
          .document-content h1,
          .document-content h2,
          .document-content h3,
          .document-content p,
          .document-content li,
          .document-content span {
            color: #111827 !important;
          }
        }
      `}</style>
    </>
  );

  if (isPortalMode) {
    return (
      <ClientShell
        portalExperience={portalExperience}
        title={project?.name ? `${project.name} Quote` : "Quote"}
        subtitle="Shared quote, commercial scope, and approval reference"
      >
        {documentContent}
      </ClientShell>
    );
  }

  return (
    <AppShell>
      {project ? (
        <div className="px-8 pt-8">
          <ProjectWorkflowNav
            projectId={project.id}
            showDiscovery={project.scopeType !== "standalone_quote"}
          />
        </div>
      ) : null}
      {documentContent}
    </AppShell>
  );
}
