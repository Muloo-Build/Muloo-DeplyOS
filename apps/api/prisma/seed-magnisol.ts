import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const CLIENT_SLUG = "magnisol";
const CLIENT_NAME = "Magnisol";
const PROJECT_NAME = "Magnisol HubSpot and Website Delivery";
const PROJECT_OWNER = "Jarrud van der Merwe";
const PROJECT_OWNER_EMAIL = "jarrud@muloo.com";
const PORTAL_DISPLAY = "Magnisol HubSpot Portal";
const PORTAL_PLACEHOLDER_ID = "magnisol-portal-placeholder";

const TARA_FIRST = "Tara";
const TARA_LAST = "De Marzo";
const TARA_EMAIL = "tara.de.marzo@magnisol.com";
const TARA_TITLE = "Client Champion";

interface MagnisolContact {
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  role: string;
  stakeholderType: string;
  organisation: string | null;
  notes: string;
}

const EXTRA_CONTACTS: MagnisolContact[] = [
  {
    firstName: "Grant",
    lastName: "Watt",
    email: "grant@tusk.studio",
    title: "Partner Lead, Tusk",
    role: "stakeholder",
    stakeholderType: "partner",
    organisation: "Tusk",
    notes:
      "Tusk owns website design + brand. Joins discovery to align HubSpot CMS with the new website system."
  },
  {
    firstName: "Devan",
    lastName: "Smit",
    email: "devan.smit@magnisol.com",
    title: "Head of Technology",
    role: "subject_matter_expert",
    stakeholderType: "technical",
    organisation: "Magnisol",
    notes:
      "Tech lead. Owns integrations, data migration, and tooling consolidation answers."
  }
];

const WORKSTREAMS: Array<{
  id: string;
  name: string;
  category:
    | "discovery"
    | "website"
    | "hubspot_implementation"
    | "marketing"
    | "service"
    | "integration"
    | "partner_delivery"
    | "other";
  status:
    | "planned"
    | "active"
    | "paused"
    | "complete"
    | "waiting_on_client"
    | "blocked";
  owner: "muloo" | "partner" | "shared";
  summary: string;
  portalSummary: string | null;
  estimatedHours: number | null;
  hourCap: number | null;
  billingOwner: string | null;
  deliveryOwner: string | null;
  linkedWorkbookIds: string[];
  linkedDiscoverySectionIds: string[];
  scopeRisk: "low" | "medium" | "high" | null;
  notes: string | null;
}> = [
  {
    id: "ws_magnisol_discovery",
    name: "HubSpot and Website Discovery",
    category: "discovery",
    status: "active",
    owner: "muloo",
    summary:
      "Combined discovery covering HubSpot requirements, website goals, sales process, technology stack, integrations, reporting, content, and operational pain points.",
    portalSummary:
      "Combined HubSpot + website discovery — questionnaires shared with stakeholders, sessions scheduled.",
    estimatedHours: null,
    hourCap: null,
    billingOwner: "tusk",
    deliveryOwner: "muloo",
    linkedWorkbookIds: [],
    linkedDiscoverySectionIds: [],
    scopeRisk: "low",
    notes:
      "Discovery questionnaire-led to limit portal user noise; Tara is the single client champion."
  },
  {
    id: "ws_magnisol_hubspot_setup",
    name: "Basic HubSpot Setup",
    category: "hubspot_implementation",
    status: "planned",
    owner: "muloo",
    summary:
      "Initial setup of the brand-new HubSpot platform. Not a full implementation — focused on the agreed first phase.",
    portalSummary:
      "Initial HubSpot platform setup. Capped at 20 hours.",
    estimatedHours: 20,
    hourCap: 20,
    billingOwner: "tusk",
    deliveryOwner: "muloo",
    linkedWorkbookIds: [],
    linkedDiscoverySectionIds: [],
    scopeRisk: "low",
    notes: "Hard cap at 20 hours. Scope changes go through change requests."
  },
  {
    id: "ws_magnisol_website_setup",
    name: "Website Setup",
    category: "website",
    status: "planned",
    owner: "shared",
    summary:
      "Website setup based on discovery outcomes. May include theme setup, HubSpot CMS, structure, page planning, content, regionalisation, smart content, HubDB, and Tusk design input.",
    portalSummary:
      "Website setup — driven by discovery outcomes. Tusk leads design, Muloo leads HubSpot CMS implementation.",
    estimatedHours: null,
    hourCap: null,
    billingOwner: "tusk",
    deliveryOwner: "shared",
    linkedWorkbookIds: [],
    linkedDiscoverySectionIds: [],
    scopeRisk: "medium",
    notes: "Tracked separately from HubSpot setup but tied to same discovery foundation."
  }
];

interface SeedWorkbook {
  sourceLabel: string;
  evidenceType: string;
  resourceType: string;
  workstreamId: string;
  status: string;
  ownerName: string;
  notes: string;
  sourceUrl?: string;
  libraryCategories: string[];
  sectionTitle: string;
}

const WORKBOOKS: SeedWorkbook[] = [
  {
    sourceLabel: "Magnisol HubSpot and Website Discovery Workbook",
    evidenceType: "operator-note",
    resourceType: "internal_workbook",
    workstreamId: "ws_magnisol_discovery",
    status: "shared",
    ownerName: "Tara De Marzo",
    notes:
      "Combined discovery workbook covering HubSpot + website requirements. Questionnaire-led; populated by stakeholders before Wednesday session.",
    libraryCategories: ["brand_positioning", "goals_success", "operational_pain"],
    sectionTitle: "Brand, goals & operational pain"
  },
  {
    sourceLabel: "Magnisol Sales & Marketing Workbook",
    evidenceType: "operator-note",
    resourceType: "internal_workbook",
    workstreamId: "ws_magnisol_discovery",
    status: "shared",
    ownerName: "Tara De Marzo",
    notes: "HubSpot Sales + Marketing discovery. Owned by Tara, contributed to by Magnisol commercial team.",
    libraryCategories: ["sales_process", "marketing_content"],
    sectionTitle: "Sales & marketing process"
  },
  {
    sourceLabel: "Magnisol Service & Reporting Workbook",
    evidenceType: "operator-note",
    resourceType: "internal_workbook",
    workstreamId: "ws_magnisol_discovery",
    status: "shared",
    ownerName: "Tara De Marzo",
    notes: "Service desk, customer experience and leadership reporting expectations.",
    libraryCategories: ["service_support", "reporting_analytics"],
    sectionTitle: "Service & reporting"
  },
  {
    sourceLabel: "Magnisol Technology Stack and Cost Workbook",
    evidenceType: "operator-note",
    resourceType: "internal_workbook",
    workstreamId: "ws_magnisol_discovery",
    status: "shared",
    ownerName: "Devan Smit",
    notes:
      "Inventory of all current technologies across Magnisol with associated costs. Source for HubSpot consolidation analysis.",
    libraryCategories: ["tech_stack", "integrations", "data_migration", "compliance_governance"],
    sectionTitle: "Tech stack, integrations & compliance"
  },
  {
    sourceLabel: "Magnisol Website Content and Journey Workbook",
    evidenceType: "operator-note",
    resourceType: "internal_workbook",
    workstreamId: "ws_magnisol_website_setup",
    status: "shared",
    ownerName: "Grant Watt",
    notes:
      "Captures website structure, client journey, pillar pages, case studies, and integration showcase requirements.",
    libraryCategories: ["website_architecture", "website_content"],
    sectionTitle: "Website architecture & content"
  },
  {
    sourceLabel: "Magnisol Discovery Process Map (Miro)",
    evidenceType: "miro-note",
    resourceType: "miro_board",
    workstreamId: "ws_magnisol_discovery",
    status: "shared",
    ownerName: "Jarrud van der Merwe",
    notes:
      "Live Miro board for visual SOPs, current-state process maps and the future-state architecture sketch.",
    sourceUrl: "https://miro.com/app/board/magnisol-discovery-placeholder/",
    libraryCategories: [],
    sectionTitle: ""
  }
];

async function ensureHubSpotPortal() {
  return prisma.hubSpotPortal.upsert({
    where: { portalId: PORTAL_PLACEHOLDER_ID },
    update: {},
    create: {
      portalId: PORTAL_PLACEHOLDER_ID,
      displayName: PORTAL_DISPLAY,
      region: "EU",
      connected: false
    }
  });
}

async function ensureClient(portalId: string) {
  return prisma.client.upsert({
    where: { slug: CLIENT_SLUG },
    update: {
      hubSpotPortalId: portalId
    },
    create: {
      name: CLIENT_NAME,
      slug: CLIENT_SLUG,
      hubSpotPortalId: portalId,
      industry: "Software",
      website: "https://magnisol.com"
    }
  });
}

async function ensureProject(clientId: string, portalId: string) {
  const existing = await prisma.project.findFirst({
    where: { clientId, name: PROJECT_NAME }
  });

  const data = {
    name: PROJECT_NAME,
    status: "active" as const,
    owner: PROJECT_OWNER,
    ownerEmail: PROJECT_OWNER_EMAIL,
    clientId,
    portalId,
    engagementType: "IMPLEMENTATION" as const,
    serviceFamily: "hubspot_architecture",
    scopeType: "implementation",
    selectedHubs: ["sales", "marketing", "cms"],
    currentPhase: "discovery",
    clientChampionFirstName: TARA_FIRST,
    clientChampionLastName: TARA_LAST,
    clientChampionEmail: TARA_EMAIL,
    deliveryWorkstreams: WORKSTREAMS as Prisma.InputJsonValue,
    billingOwner: "tusk",
    deliveryOwner: "muloo",
    partnerName: "Tusk",
    problemStatement:
      "Magnisol needs a combined HubSpot + website discovery that produces a basic HubSpot setup (capped at 20h) and a separate website setup workstream. Stakeholders should not all be added to the portal — discovery is questionnaire-led.",
    solutionRecommendation:
      "Run questionnaire-led discovery, produce visual SOPs and process maps, deliver a 20-hour HubSpot setup phase, then run website setup as a separate workstream coordinated with Tusk."
  };

  if (existing) {
    return prisma.project.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.project.create({ data });
}

async function ensureContact(clientId: string) {
  return prisma.clientContact.upsert({
    where: {
      clientId_email: { clientId, email: TARA_EMAIL }
    },
    update: {
      firstName: TARA_FIRST,
      lastName: TARA_LAST,
      title: TARA_TITLE
    },
    create: {
      clientId,
      firstName: TARA_FIRST,
      lastName: TARA_LAST,
      email: TARA_EMAIL,
      title: TARA_TITLE,
      canApproveQuotes: false
    }
  });
}

async function ensureContributor(projectId: string, contactId: string) {
  return prisma.projectContributor.upsert({
    where: { projectId_contactId: { projectId, contactId } },
    update: {
      role: "client_champion",
      notes:
        "Tara is the single client champion for Magnisol. Other stakeholders complete discovery via shared workbooks rather than portal accounts."
    },
    create: {
      projectId,
      contactId,
      role: "client_champion",
      notes:
        "Tara is the single client champion for Magnisol. Other stakeholders complete discovery via shared workbooks rather than portal accounts."
    }
  });
}

async function buildWorkbookContent(
  workbook: SeedWorkbook
): Promise<Prisma.InputJsonValue | null> {
  if (workbook.resourceType !== "internal_workbook") return null;
  if (workbook.libraryCategories.length === 0) {
    return { version: 1, sections: [] } as unknown as Prisma.InputJsonValue;
  }
  const items = await prisma.discoveryQuestionLibraryItem.findMany({
    where: { category: { in: workbook.libraryCategories } },
    orderBy: [{ category: "asc" }, { createdAt: "asc" }]
  });
  const section = {
    id: `section_${workbook.libraryCategories.join("_")}`,
    title: workbook.sectionTitle || "Discovery questions",
    description: null,
    category: workbook.libraryCategories.join(","),
    linkedWorkstreamId: workbook.workstreamId,
    assignedContributorIds: [] as string[],
    status: "draft",
    questions: items.map((item) => ({
      id: `q_${item.id}`,
      questionText: item.questionText,
      helpText: item.helpText,
      answerType: item.answerType,
      required: item.defaultRequired,
      options: item.options ?? [],
      tags: item.tags ?? [],
      assignedContributorIds: [] as string[],
      status: "unanswered",
      response: null,
      responseFiles: [] as unknown[],
      responseLinks: [] as unknown[],
      internalNotes: null,
      sourceLibraryItemId: item.id
    }))
  };
  return { version: 1, sections: [section] } as unknown as Prisma.InputJsonValue;
}

async function ensureWorkbooks(projectId: string) {
  for (const workbook of WORKBOOKS) {
    const workbookContent = await buildWorkbookContent(workbook);
    const existing = await prisma.discoveryEvidence.findFirst({
      where: {
        projectId,
        kind: "workbook",
        sourceLabel: workbook.sourceLabel
      }
    });
    const baseData = {
      evidenceType: workbook.evidenceType,
      resourceType: workbook.resourceType,
      workstreamId: workbook.workstreamId,
      status: workbook.status,
      ownerName: workbook.ownerName,
      content: workbook.notes,
      sourceUrl: workbook.sourceUrl ?? null
    };
    if (existing) {
      await prisma.discoveryEvidence.update({
        where: { id: existing.id },
        data: {
          ...baseData,
          ...(workbookContent !== null
            ? { workbookContent }
            : { workbookContent: Prisma.DbNull })
        }
      });
    } else {
      await prisma.discoveryEvidence.create({
        data: {
          projectId,
          sessionNumber: 0,
          sourceLabel: workbook.sourceLabel,
          kind: "workbook",
          ...baseData,
          ...(workbookContent !== null
            ? { workbookContent }
            : { workbookContent: Prisma.DbNull })
        }
      });
    }
  }
}

async function ensureExtraContributors(
  projectId: string,
  clientId: string
) {
  for (const contact of EXTRA_CONTACTS) {
    const c = await prisma.clientContact.upsert({
      where: { clientId_email: { clientId, email: contact.email } },
      update: {
        firstName: contact.firstName,
        lastName: contact.lastName,
        title: contact.title
      },
      create: {
        clientId,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        title: contact.title
      }
    });
    await prisma.projectContributor.upsert({
      where: { projectId_contactId: { projectId, contactId: c.id } },
      update: {
        role: contact.role,
        stakeholderType: contact.stakeholderType,
        organisation: contact.organisation,
        notes: contact.notes,
        createdByType: "internal",
        approvalStatus: "approved"
      },
      create: {
        projectId,
        contactId: c.id,
        role: contact.role,
        stakeholderType: contact.stakeholderType,
        organisation: contact.organisation,
        notes: contact.notes,
        createdByType: "internal",
        approvalStatus: "approved"
      }
    });
  }
}

async function ensureChangeLogEntry(projectId: string) {
  const title = "Project changed to combined HubSpot and website discovery";
  const existing = await prisma.workRequest.findFirst({
    where: { projectId, title }
  });

  const data = {
    projectId,
    title,
    requestType: "change_request",
    serviceFamily: "hubspot_architecture",
    contactName: `${TARA_FIRST} ${TARA_LAST}`,
    contactEmail: TARA_EMAIL,
    summary:
      "Discovery now covers both HubSpot and website requirements as one combined discovery process. Implementation is split into Basic HubSpot Setup (20-hour cap) and Website Setup as a separate workstream.",
    details:
      "Outcome of the Apr 30 discovery planning meeting with Tara De Marzo (Magnisol) and Grant Watt (Tusk). Discovery is questionnaire-led with limited portal access. Visual SOPs to be created before any new system architecture is built.",
    reason:
      "Magnisol scope evolved during planning to include website discovery alongside HubSpot. Combining discovery avoids duplicating stakeholder time and aligns the website redesign with the new CRM foundation.",
    impactedWorkstreamIds: WORKSTREAMS.map((w) => w.id),
    commercialImpactHours: null,
    commercialImpactFeeZar: null,
    internalNotes: "Billing managed through Tusk. Muloo owns discovery and HubSpot delivery; Tusk owns website design.",
    status: "approved",
    approvedAt: new Date(),
    approvedByName: PROJECT_OWNER,
    reviewedAt: new Date(),
    links: [] as string[]
  };

  if (existing) {
    return prisma.workRequest.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.workRequest.create({ data });
}

async function main() {
  console.log("Seeding Magnisol project...");

  const portal = await ensureHubSpotPortal();
  const client = await ensureClient(portal.id);
  const project = await ensureProject(client.id, portal.id);
  const contact = await ensureContact(client.id);
  await ensureContributor(project.id, contact.id);
  await ensureExtraContributors(project.id, client.id);
  await ensureWorkbooks(project.id);
  await ensureChangeLogEntry(project.id);

  console.log(
    `OK. Magnisol project ${project.id} ready with ${WORKSTREAMS.length} workstreams + ${WORKBOOKS.length} workbooks/resources + ${1 + EXTRA_CONTACTS.length} contributors + 1 change log entry.`
  );
}

main()
  .catch((error) => {
    console.error("seed-magnisol failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
