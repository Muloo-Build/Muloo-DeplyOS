type PackagingAssessment = {
  fit: "good" | "attention" | "upgrade_needed";
  summary: string;
  warnings: string[];
  recommendedNextStep: string;
  reasoning: string[];
  workaroundPath?: string | null;
} | null | undefined;

type RecommendationProject = {
  selectedHubs?: string[] | null;
  implementationApproach?: string | null;
  customerPlatformTier?: string | null;
  packagingAssessment?: PackagingAssessment;
};

function unique(items: string[], maxItems = 5) {
  return Array.from(
    new Set(items.map((item) => item.trim()).filter(Boolean))
  ).slice(0, maxItems);
}

export function getDisplaySupportingTools(
  project: RecommendationProject | null | undefined,
  sourceItems: string[] | null | undefined
) {
  if (sourceItems && sourceItems.length > 0) {
    return sourceItems;
  }

  const selectedHubs = new Set(project?.selectedHubs ?? []);
  const fallback: string[] = [
    "Databox for executive and operational dashboards layered over HubSpot once the core CRM views are live."
  ];

  if (selectedHubs.has("data") || project?.packagingAssessment?.fit !== "good") {
    fallback.push(
      "A lightweight staging database such as Railway Postgres, Supabase, or Azure SQL to keep normalization and auditability outside HubSpot."
    );
  }

  fallback.push(
    "A small middleware or sync layer to control extraction, transformation, and CRM-safe data delivery into HubSpot."
  );

  fallback.push(
    "Documentation & SOP Pack as a paid add-on if the agreed model, handover process, or operating rules need to be captured formally."
  );

  return unique(fallback, 5);
}

export function getDisplayKeyRisks(
  project: RecommendationProject | null | undefined,
  sourceItems: string[] | null | undefined
) {
  if (sourceItems && sourceItems.length > 0) {
    return sourceItems;
  }

  const fallback: string[] = [
    "Source data quality and duplicate resolution may require more manual review than expected before the CRM view is trustworthy.",
    "A boxed Phase 1 can still drift into a larger transformation unless the team keeps the POC tightly tied to the agreed outcomes.",
    "Reporting credibility depends on agreeing metric definitions and sample validation early, otherwise stakeholders may not trust the outputs."
  ];

  if (project?.packagingAssessment?.fit !== "good") {
    fallback.push(
      "The chosen HubSpot packaging may only work if the team accepts a workaround architecture and keeps the heavier model outside HubSpot."
    );
  }

  return unique(fallback, 5);
}

export function getDisplayNextQuestions(
  project: RecommendationProject | null | undefined,
  sourceItems: string[] | null | undefined
) {
  if (sourceItems && sourceItems.length > 0) {
    return sourceItems;
  }

  const fallback: string[] = [
    "What is the minimum sample data set we can use to prove identity resolution, attendance history, and brand participation in Phase 1?",
    "Which dashboards or metrics must leadership see in the first release for the POC to be treated as successful?",
    "Which parts of the current process must stay manual in Phase 1, and which parts genuinely need to be automated now?"
  ];

  if (project?.packagingAssessment?.fit !== "good") {
    fallback.push(
      "Is the client comfortable with a workaround-led Phase 1, or do they want to approve a HubSpot packaging uplift before delivery starts?"
    );
  }

  return unique(fallback, 5);
}
