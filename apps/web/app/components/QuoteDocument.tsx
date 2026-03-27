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
    quoteContextSummary: string | null;
    inScopeItems: string[];
    outOfScopeItems: string[];
    supportingTools: string[];
    keyRisks: string[];
    nextQuestions: string[];
    clientResponsibilities: string[];
    isStandaloneQuote: boolean;
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
      hourly: "Hourly"
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
  const [shareMessage, setShareMessage] = useState<string | null>(null);
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

        const projectResponse = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}`
        );

        if (!projectResponse.ok) {
          throw new Error("Failed to load quote document");
        }

        const projectBody = await projectResponse.json();
        const nextProject = projectBody.project;
        if (!nextProject) {
          throw new Error("Failed to load project context for this quote.");
        }
        const isStandaloneQuote = nextProject?.scopeType === "standalone_quote";

        const [
          sessionsResponse,
          summaryResponse,
          blueprintResponse,
          productsResponse
        ] = await Promise.all([
          fetch(`/api/discovery/${encodeURIComponent(projectId)}/sessions`),
          fetch(
            `/api/projects/${encodeURIComponent(projectId)}/discovery-summary`
          ),
          fetch(`/api/projects/${encodeURIComponent(projectId)}/blueprint`),
          fetch("/api/products")
        ]);

        if (
          !sessionsResponse.ok ||
          !productsResponse.ok ||
          !summaryResponse?.ok ||
          (!isStandaloneQuote && !blueprintResponse?.ok)
        ) {
          throw new Error(
            isStandaloneQuote
              ? "Generate the scoped summary before opening the commercial document."
              : "Generate the discovery summary and blueprint before opening the quote."
          );
        }

        const sessionsBody = await sessionsResponse.json();
        const summaryBody = summaryResponse
          ? await summaryResponse.json()
          : null;
        const blueprintBody = blueprintResponse?.ok
          ? await blueprintResponse.json()
          : null;
        const productsBody = await productsResponse.json();

        setProject(nextProject);
        setSessions(sessionsBody.sessionDetails ?? []);
        setSummary(summaryBody?.summary ?? null);
        setBlueprint(blueprintBody?.blueprint ?? null);
        setProducts(productsBody.products ?? []);
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
  const selectedProductLines = products
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
  const quoteContext = savedQuote?.context;
  const displayPhaseCommercials =
    isPortalMode && savedQuote ? savedQuote.phaseLines : phaseCommercials;
  const displaySelectedProductLines =
    isPortalMode && savedQuote ? savedQuote.productLines : selectedProductLines;
  const displayTotals =
    isPortalMode && savedQuote
      ? savedQuote.totals
      : {
          totalHumanHours,
          totalFeeZar,
          additionalProductsTotalZar,
          grandTotalZar,
          paymentAmountZar
        };
  const displayPaymentSchedule =
    isPortalMode && savedQuote ? savedQuote.paymentSchedule : paymentSchedule;
  const displayInScopeItems =
    isPortalMode && quoteContext ? quoteContext.inScopeItems : inScopeItems;
  const displayOutOfScopeItems =
    isPortalMode && quoteContext
      ? quoteContext.outOfScopeItems
      : outOfScopeItems;
  const displaySupportingTools =
    isPortalMode && quoteContext
      ? quoteContext.supportingTools
      : supportingTools;
  const displayKeyRisks =
    isPortalMode && quoteContext ? quoteContext.keyRisks : keyRisks;
  const displayNextQuestions =
    isPortalMode && quoteContext ? quoteContext.nextQuestions : nextQuestions;
  const displayClientResponsibilities =
    isPortalMode && quoteContext
      ? quoteContext.clientResponsibilities
      : clientResponsibilities;
  const displayQuoteContextSummary =
    isPortalMode && quoteContext
      ? quoteContext.quoteContextSummary
      : isStandaloneQuote
        ? (summary?.executiveSummary ??
          project?.scopeExecutiveSummary ??
          project?.solutionRecommendation ??
          project?.problemStatement ??
          project?.commercialBrief ??
          "This standalone quote is based on the scoped job brief captured for the client.")
        : (summary?.executiveSummary ??
          session1.business_overview ??
          "No executive summary generated yet.");
  const displayBlueprintGeneratedAt =
    isPortalMode && quoteContext?.blueprintGeneratedAt
      ? quoteContext.blueprintGeneratedAt
      : (blueprint?.generatedAt ?? null);
  const documentationProduct = products.find(
    (product) => product.slug === "documentation-sop-pack"
  );
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
          body: JSON.stringify({
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
            productLines: selectedProductLines.map((product) => ({
              id: product.id,
              slug: product.slug,
              name: product.name,
              category: product.category,
              billingModel: product.billingModel,
              description: product.description ?? null,
              unitLabel: product.unitLabel,
              quantity: product.quantity,
              unitPrice: product.unitPrice,
              lineTotalZar: product.lineTotalZar
            })),
            totals: {
              totalHumanHours,
              totalFeeZar,
              additionalProductsTotalZar,
              grandTotalZar,
              paymentAmountZar
            },
            paymentSchedule,
            context: {
              quoteContextSummary:
                summary?.executiveSummary ??
                project?.scopeExecutiveSummary ??
                project?.solutionRecommendation ??
                project?.problemStatement ??
                project?.commercialBrief ??
                null,
              inScopeItems,
              outOfScopeItems,
              supportingTools,
              keyRisks,
              nextQuestions,
              clientResponsibilities,
              isStandaloneQuote,
              blueprintGeneratedAt: blueprint?.generatedAt ?? null
            }
          })
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
          credentials: "include"
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
                  <h2 className="mt-10 max-w-3xl text-5xl font-bold font-heading leading-tight text-white">
                    {project.client.name.toUpperCase()} -{" "}
                    {isStandaloneQuote
                      ? "Standalone Quote"
                      : "Implementation Quote"}
                  </h2>
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
                            {session1.primary_pain_challenge ||
                              "To be confirmed"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            Success outcomes
                          </p>
                          <div className="mt-3 space-y-2 text-sm text-text-secondary">
                            {splitIntoLines(
                              session1.goals_and_success_metrics
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
                            summary?.engagementTrack ?? "Not set"
                          ],
                          ["Platform fit", summary?.platformFit ?? "Not set"],
                          [
                            "Change management",
                            summary?.changeManagementRating ?? "Not set"
                          ],
                          [
                            "Data readiness",
                            summary?.dataReadinessRating ?? "Not set"
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
                              {formatDiscoveryOutcome(
                                label === "Engagement track"
                                  ? "engagementTrack"
                                  : label === "Platform fit"
                                    ? "platformFit"
                                    : label === "Change management"
                                      ? "changeManagementRating"
                                      : "dataReadinessRating",
                                value
                              )}
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
                          ["Current stack", session2.current_tech_stack],
                          ["HubSpot today", session2.current_hubspot_state],
                          ["Data landscape", session2.data_landscape],
                          ["Current processes", session2.current_processes]
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
                            session3.hubs_and_features_required
                          ],
                          [
                            "Pipeline & process",
                            session3.pipeline_and_process_design
                          ],
                          ["Automation", session3.automation_requirements],
                          ["Reporting", session3.reporting_requirements]
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
                            "We will deliver the implementation in phased onboarding blocks, each with a clear output, review point, and commercial boundary."
                          ],
                          [
                            "How scope is controlled",
                            "The approved phases below become the working implementation scope. Any material changes after approval should move through change control."
                          ],
                          [
                            "How the client participates",
                            "The client team provides access, confirms process decisions, reviews milestones, and signs off the agreed outputs."
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

                {project.packagingAssessment ? (
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
                          {project.implementationApproach === "best_practice"
                            ? "Best-practice / scalable approach"
                            : "Pragmatic / POC approach"}
                        </p>
                        <p
                          className={`mt-2 text-sm font-medium ${
                            project.packagingAssessment.fit === "good"
                              ? "text-[#51d0b0]"
                              : project.packagingAssessment.fit === "attention"
                                ? "text-[#f8c16c]"
                                : "text-[#ff8a8a]"
                          }`}
                        >
                          {project.packagingAssessment.fit.replace(/_/g, " ")}
                        </p>
                        <p className="mt-2 text-sm text-text-secondary">
                          {project.packagingAssessment.summary}
                        </p>
                      </div>
                      {project.packagingAssessment.reasoning.length > 0 ? (
                        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            Why this recommendation was made
                          </p>
                          <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                            {project.packagingAssessment.reasoning.map(
                              (item) => (
                                <li key={item}>{item}</li>
                              )
                            )}
                          </ul>
                        </div>
                      ) : null}
                      {project.packagingAssessment.warnings.length > 0 ? (
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
                      {project.packagingAssessment.workaroundPath ? (
                        <div className="rounded-2xl border border-[rgba(73,205,225,0.16)] bg-[rgba(73,205,225,0.08)] p-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#49cde1]">
                            Lower-tier workaround path
                          </p>
                          <p className="mt-2 text-sm text-white">
                            {project.packagingAssessment.workaroundPath}
                          </p>
                        </div>
                      ) : null}
                      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                          Recommended next step
                        </p>
                        <p className="mt-2 text-sm text-text-secondary">
                          {project.packagingAssessment.recommendedNextStep}
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
                  {displaySelectedProductLines.map((product) => (
                    <div
                      key={product.id}
                      className="grid grid-cols-[1.4fr_120px_140px_160px] gap-4 border-b border-[rgba(255,255,255,0.05)] px-5 py-4 text-sm text-white last:border-b-0"
                    >
                      <span>{product.name}</span>
                      <span>
                        {product.quantity} {product.unitLabel}
                        {product.quantity > 1 ? "s" : ""}
                      </span>
                      <span>
                        {currencySymbols[currency]} {product.unitPrice}
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
                      : "This quote is intended to act as the commercial approval pack for the recommended implementation scope. Once approved, the accepted phases and commercial split should become the contractual baseline for planning and delivery."}
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

              <div className="document-card rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <SectionEyebrow>Terms & Working Scope</SectionEyebrow>
                <SectionTitle>How this quote should be used</SectionTitle>
                <div className="mt-4 space-y-4 text-sm leading-7 text-text-secondary">
                  <p>
                    This document is the commercial quote generated from the
                    discovery process. The separate discovery document remains
                    the narrative recommendation and project planning reference.
                  </p>
                  <p>
                    Once approved, this quote becomes the working commercial
                    scope baseline for planning and delivery. Future work
                    outside the approved phases should be treated as a separate
                    scope or formal change request.
                  </p>
                  <p>
                    Delivery sequencing, detailed task allocation, and execution
                    routing are finalized during planning after client approval.
                  </p>
                  <p>
                    {isPortalMode
                      ? "The discovery document and quote remain separate so the client can review the recommended scope alongside the commercial offer."
                      : "Commercials can be refined before approval, including currency, hours, and per-phase rates. The discovery document and quote intentionally remain separate so the client can approve all or only part of the recommended scope."}
                  </p>
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
