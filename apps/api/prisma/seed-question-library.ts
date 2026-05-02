import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedItem {
  category: string;
  subcategory?: string;
  questionText: string;
  helpText?: string;
  answerType: string;
  options?: string[];
  tags?: string[];
  recommendedStakeholderType?: string;
  defaultRequired?: boolean;
  linkedHubSpotArea?: string;
  linkedWebsiteArea?: string;
  complexityLevel?: string;
}

const ITEMS: SeedItem[] = [
  // ───────── Brand & Positioning ─────────
  {
    category: "brand_positioning",
    questionText: "How would you describe your company in one sentence to a new prospect?",
    answerType: "long_text",
    recommendedStakeholderType: "executive",
    defaultRequired: true,
    linkedWebsiteArea: "homepage"
  },
  {
    category: "brand_positioning",
    questionText: "Who are your three most direct competitors and how are you different?",
    answerType: "long_text",
    recommendedStakeholderType: "marketing",
    defaultRequired: true,
    linkedWebsiteArea: "positioning"
  },
  {
    category: "brand_positioning",
    questionText: "What are your top 3 brand values?",
    answerType: "long_text",
    recommendedStakeholderType: "marketing"
  },
  {
    category: "brand_positioning",
    questionText: "Do you have a brand guidelines document we can use?",
    answerType: "file_request",
    recommendedStakeholderType: "marketing"
  },
  {
    category: "brand_positioning",
    questionText: "What primary tone of voice should the website use?",
    answerType: "single_select",
    options: ["professional", "warm", "expert", "playful", "challenger", "luxury"],
    recommendedStakeholderType: "marketing"
  },
  {
    category: "brand_positioning",
    questionText: "Are there any words or phrases we should never use?",
    answerType: "long_text",
    recommendedStakeholderType: "marketing"
  },

  // ───────── Sales Process ─────────
  {
    category: "sales_process",
    questionText: "Walk us through your current sales process from first contact to closed-won.",
    answerType: "long_text",
    recommendedStakeholderType: "sales",
    defaultRequired: true,
    linkedHubSpotArea: "sales"
  },
  {
    category: "sales_process",
    subcategory: "deal_stages",
    questionText: "What are the deal stages you use today (and the rough conversion between them)?",
    answerType: "long_text",
    recommendedStakeholderType: "sales",
    defaultRequired: true,
    linkedHubSpotArea: "sales"
  },
  {
    category: "sales_process",
    questionText: "What deal properties do you track on every deal?",
    answerType: "long_text",
    recommendedStakeholderType: "sales",
    linkedHubSpotArea: "sales"
  },
  {
    category: "sales_process",
    questionText: "What is your average sales cycle length?",
    answerType: "short_text",
    recommendedStakeholderType: "sales",
    linkedHubSpotArea: "sales"
  },
  {
    category: "sales_process",
    questionText: "Who has access to which deal information today?",
    answerType: "long_text",
    recommendedStakeholderType: "sales",
    linkedHubSpotArea: "permissions"
  },
  {
    category: "sales_process",
    questionText: "Where do leads come from today (paid, organic, partners, referral)?",
    answerType: "long_text",
    recommendedStakeholderType: "marketing",
    linkedHubSpotArea: "marketing"
  },
  {
    category: "sales_process",
    questionText: "Do you have a documented qualification framework (BANT, MEDDIC, etc.)?",
    answerType: "single_select",
    options: ["yes", "informal", "no"],
    recommendedStakeholderType: "sales"
  },
  {
    category: "sales_process",
    questionText: "What sales-related reports do you currently rely on?",
    answerType: "long_text",
    recommendedStakeholderType: "sales",
    linkedHubSpotArea: "reporting"
  },

  // ───────── Marketing & Content ─────────
  {
    category: "marketing_content",
    questionText: "What marketing channels actively drive pipeline today?",
    answerType: "multi_select",
    options: ["seo", "paid_search", "paid_social", "events", "partners", "outbound", "referral", "pr"],
    recommendedStakeholderType: "marketing",
    defaultRequired: true,
    linkedHubSpotArea: "marketing"
  },
  {
    category: "marketing_content",
    questionText: "Where does your content currently live (blog, knowledge base, gated assets)?",
    answerType: "long_text",
    recommendedStakeholderType: "marketing",
    linkedHubSpotArea: "marketing"
  },
  {
    category: "marketing_content",
    questionText: "What is your monthly publishing cadence for new content?",
    answerType: "short_text",
    recommendedStakeholderType: "marketing"
  },
  {
    category: "marketing_content",
    questionText: "What lead magnets / gated assets do you use today?",
    answerType: "long_text",
    recommendedStakeholderType: "marketing",
    linkedHubSpotArea: "marketing"
  },
  {
    category: "marketing_content",
    questionText: "Do you have personas documented? If so, please share or summarise.",
    answerType: "long_text",
    recommendedStakeholderType: "marketing"
  },
  {
    category: "marketing_content",
    questionText: "What email nurture sequences are you running, if any?",
    answerType: "long_text",
    recommendedStakeholderType: "marketing",
    linkedHubSpotArea: "marketing"
  },
  {
    category: "marketing_content",
    questionText: "Which marketing automations would have the biggest impact if built first?",
    answerType: "long_text",
    recommendedStakeholderType: "marketing",
    linkedHubSpotArea: "marketing"
  },

  // ───────── Service & Support ─────────
  {
    category: "service_support",
    questionText: "How do customers currently reach you for support?",
    answerType: "long_text",
    recommendedStakeholderType: "service",
    linkedHubSpotArea: "service"
  },
  {
    category: "service_support",
    questionText: "What is your typical first response time goal?",
    answerType: "short_text",
    recommendedStakeholderType: "service",
    linkedHubSpotArea: "service"
  },
  {
    category: "service_support",
    questionText: "Do you have an SLA you commit to for customers?",
    answerType: "long_text",
    recommendedStakeholderType: "service"
  },
  {
    category: "service_support",
    questionText: "What ticket categories or types do you track today?",
    answerType: "long_text",
    recommendedStakeholderType: "service",
    linkedHubSpotArea: "service"
  },
  {
    category: "service_support",
    questionText: "Is there a knowledge base today? Where is it hosted?",
    answerType: "long_text",
    recommendedStakeholderType: "service"
  },
  {
    category: "service_support",
    questionText: "What customer health signals matter most to your team?",
    answerType: "long_text",
    recommendedStakeholderType: "service"
  },

  // ───────── Reporting & Analytics ─────────
  {
    category: "reporting_analytics",
    questionText: "What 5 metrics does the leadership team review weekly?",
    answerType: "long_text",
    recommendedStakeholderType: "executive",
    defaultRequired: true,
    linkedHubSpotArea: "reporting"
  },
  {
    category: "reporting_analytics",
    questionText: "Which reports take the longest to put together each month?",
    answerType: "long_text",
    recommendedStakeholderType: "operations",
    linkedHubSpotArea: "reporting"
  },
  {
    category: "reporting_analytics",
    questionText: "Where does the source data for these reports live today?",
    answerType: "long_text",
    recommendedStakeholderType: "operations"
  },
  {
    category: "reporting_analytics",
    questionText: "What dashboards should the new system surface by default?",
    answerType: "long_text",
    recommendedStakeholderType: "executive",
    linkedHubSpotArea: "reporting"
  },
  {
    category: "reporting_analytics",
    questionText: "What is broken or missing in your current reporting?",
    answerType: "long_text",
    recommendedStakeholderType: "operations"
  },
  {
    category: "reporting_analytics",
    questionText: "Who owns reporting accuracy today?",
    answerType: "short_text",
    recommendedStakeholderType: "operations"
  },

  // ───────── Data & Migration ─────────
  {
    category: "data_migration",
    questionText: "What CRM and database systems are you migrating from?",
    answerType: "long_text",
    recommendedStakeholderType: "technical",
    defaultRequired: true,
    linkedHubSpotArea: "migration"
  },
  {
    category: "data_migration",
    questionText: "Roughly how many contacts, companies, deals, and tickets need migrating?",
    answerType: "long_text",
    recommendedStakeholderType: "technical",
    linkedHubSpotArea: "migration"
  },
  {
    category: "data_migration",
    questionText: "What custom fields are critical to bring across?",
    answerType: "long_text",
    recommendedStakeholderType: "technical",
    linkedHubSpotArea: "migration",
    complexityLevel: "advanced"
  },
  {
    category: "data_migration",
    questionText: "Are there records you would prefer to leave behind / archive?",
    answerType: "long_text",
    recommendedStakeholderType: "operations"
  },
  {
    category: "data_migration",
    questionText: "What identifier should we use for deduplication (email, account number)?",
    answerType: "short_text",
    recommendedStakeholderType: "technical",
    linkedHubSpotArea: "migration"
  },
  {
    category: "data_migration",
    questionText: "Do you have a data dictionary or field mapping doc?",
    answerType: "file_request",
    recommendedStakeholderType: "technical"
  },
  {
    category: "data_migration",
    questionText: "What date should the historical data freeze on for migration?",
    answerType: "short_text",
    recommendedStakeholderType: "technical"
  },

  // ───────── Integrations ─────────
  {
    category: "integrations",
    questionText: "List every system that needs to talk to HubSpot (incl. spreadsheets and manual handoffs).",
    answerType: "long_text",
    recommendedStakeholderType: "technical",
    defaultRequired: true,
    linkedHubSpotArea: "integrations"
  },
  {
    category: "integrations",
    questionText: "Which integrations are blocking value if not in place at launch?",
    answerType: "long_text",
    recommendedStakeholderType: "operations",
    linkedHubSpotArea: "integrations"
  },
  {
    category: "integrations",
    questionText: "Which systems have APIs or webhooks we can build against?",
    answerType: "long_text",
    recommendedStakeholderType: "technical",
    linkedHubSpotArea: "integrations",
    complexityLevel: "advanced"
  },
  {
    category: "integrations",
    questionText: "Are there any iPaaS/middleware tools in place (Zapier, Make, Workato)?",
    answerType: "long_text",
    recommendedStakeholderType: "technical"
  },
  {
    category: "integrations",
    questionText: "What is the source of truth for customer data today?",
    answerType: "short_text",
    recommendedStakeholderType: "operations"
  },
  {
    category: "integrations",
    questionText: "Are there security or compliance constraints on integrations we should know about?",
    answerType: "long_text",
    recommendedStakeholderType: "executive"
  },

  // ───────── Website Architecture ─────────
  {
    category: "website_architecture",
    questionText: "What are the goals of the new website (qualified leads, brand, support, demos)?",
    answerType: "long_text",
    recommendedStakeholderType: "marketing",
    defaultRequired: true,
    linkedWebsiteArea: "strategy"
  },
  {
    category: "website_architecture",
    questionText: "What pages / sections must exist on launch?",
    answerType: "long_text",
    recommendedStakeholderType: "marketing",
    linkedWebsiteArea: "ia"
  },
  {
    category: "website_architecture",
    questionText: "Do you need multi-language or multi-region content?",
    answerType: "long_text",
    recommendedStakeholderType: "marketing",
    linkedWebsiteArea: "regionalisation",
    complexityLevel: "advanced"
  },
  {
    category: "website_architecture",
    questionText: "What CMS modules do you need (blog, case studies, careers, pricing tables)?",
    answerType: "multi_select",
    options: ["blog", "case_studies", "careers", "pricing", "events", "podcast", "team", "products", "resources_library"],
    recommendedStakeholderType: "marketing",
    linkedWebsiteArea: "modules"
  },
  {
    category: "website_architecture",
    questionText: "Do you need gated content + form personalisation on the site?",
    answerType: "yes_no",
    recommendedStakeholderType: "marketing",
    linkedWebsiteArea: "modules"
  },
  {
    category: "website_architecture",
    questionText: "Are there third-party widgets to embed (chat, scheduler, calculators)?",
    answerType: "long_text",
    recommendedStakeholderType: "marketing"
  },
  {
    category: "website_architecture",
    questionText: "Where does your domain currently sit (registrar + DNS)?",
    answerType: "short_text",
    recommendedStakeholderType: "technical",
    linkedWebsiteArea: "infra"
  },

  // ───────── Website Content ─────────
  {
    category: "website_content",
    questionText: "Which existing pages must transfer to the new site?",
    answerType: "long_text",
    recommendedStakeholderType: "marketing",
    linkedWebsiteArea: "content"
  },
  {
    category: "website_content",
    questionText: "Who will write new copy for the new site?",
    answerType: "single_select",
    options: ["client_team", "agency", "freelancer", "shared", "to_decide"],
    recommendedStakeholderType: "marketing"
  },
  {
    category: "website_content",
    questionText: "List 3-5 customer case studies you want to feature.",
    answerType: "long_text",
    recommendedStakeholderType: "marketing",
    linkedWebsiteArea: "content"
  },
  {
    category: "website_content",
    questionText: "What evidence (logos, awards, ratings) should appear on the homepage?",
    answerType: "long_text",
    recommendedStakeholderType: "marketing",
    linkedWebsiteArea: "homepage"
  },
  {
    category: "website_content",
    questionText: "Which calls-to-action drive the most pipeline today?",
    answerType: "long_text",
    recommendedStakeholderType: "marketing"
  },
  {
    category: "website_content",
    questionText: "Are there video assets we should plan for (testimonials, product, founder)?",
    answerType: "long_text",
    recommendedStakeholderType: "marketing"
  },
  {
    category: "website_content",
    questionText: "Where do photos / brand imagery live today?",
    answerType: "long_text",
    recommendedStakeholderType: "marketing"
  },

  // ───────── Tech Stack ─────────
  {
    category: "tech_stack",
    questionText: "List every SaaS tool currently used by sales, marketing, service, and ops.",
    answerType: "long_text",
    recommendedStakeholderType: "operations",
    defaultRequired: true,
    linkedHubSpotArea: "audit"
  },
  {
    category: "tech_stack",
    questionText: "What does each tool cost per month?",
    answerType: "long_text",
    recommendedStakeholderType: "operations",
    linkedHubSpotArea: "audit"
  },
  {
    category: "tech_stack",
    questionText: "Which tools are candidates for consolidation into HubSpot?",
    answerType: "long_text",
    recommendedStakeholderType: "operations",
    linkedHubSpotArea: "audit"
  },
  {
    category: "tech_stack",
    questionText: "Which tools are non-negotiable to keep?",
    answerType: "long_text",
    recommendedStakeholderType: "operations"
  },
  {
    category: "tech_stack",
    questionText: "Are any contracts ending soon that affect the consolidation timeline?",
    answerType: "long_text",
    recommendedStakeholderType: "operations"
  },
  {
    category: "tech_stack",
    questionText: "Who owns admin / billing for each system?",
    answerType: "long_text",
    recommendedStakeholderType: "operations"
  },

  // ───────── Compliance & Governance ─────────
  {
    category: "compliance_governance",
    questionText: "What data residency or sovereignty requirements apply?",
    answerType: "long_text",
    recommendedStakeholderType: "executive",
    complexityLevel: "advanced"
  },
  {
    category: "compliance_governance",
    questionText: "Do you have specific privacy / compliance needs (POPIA, GDPR, HIPAA, etc.)?",
    answerType: "multi_select",
    options: ["popia", "gdpr", "ccpa", "hipaa", "soc2", "iso27001", "none"],
    recommendedStakeholderType: "executive"
  },
  {
    category: "compliance_governance",
    questionText: "Who must approve new automations before they go live?",
    answerType: "short_text",
    recommendedStakeholderType: "executive"
  },
  {
    category: "compliance_governance",
    questionText: "What naming / tagging conventions should be enforced?",
    answerType: "long_text",
    recommendedStakeholderType: "operations"
  },
  {
    category: "compliance_governance",
    questionText: "Who has admin / super-admin access today?",
    answerType: "long_text",
    recommendedStakeholderType: "executive",
    linkedHubSpotArea: "permissions"
  },

  // ───────── Operational Pain Points ─────────
  {
    category: "operational_pain",
    questionText: "What is the single most painful manual process the team faces each week?",
    answerType: "long_text",
    recommendedStakeholderType: "operations",
    defaultRequired: true
  },
  {
    category: "operational_pain",
    questionText: "Where is double-entry happening today?",
    answerType: "long_text",
    recommendedStakeholderType: "operations"
  },
  {
    category: "operational_pain",
    questionText: "What handoffs between teams break or get lost most often?",
    answerType: "long_text",
    recommendedStakeholderType: "operations"
  },
  {
    category: "operational_pain",
    questionText: "Where do customers tell you the experience falls down?",
    answerType: "long_text",
    recommendedStakeholderType: "service"
  },
  {
    category: "operational_pain",
    questionText: "What would 'good' look like in 12 months if we got this right?",
    answerType: "long_text",
    recommendedStakeholderType: "executive",
    defaultRequired: true
  },

  // ───────── Goals & Success Metrics ─────────
  {
    category: "goals_success",
    questionText: "What are the top 3 business outcomes this project must deliver?",
    answerType: "long_text",
    recommendedStakeholderType: "executive",
    defaultRequired: true
  },
  {
    category: "goals_success",
    questionText: "What metric will we use to declare the discovery a success?",
    answerType: "long_text",
    recommendedStakeholderType: "executive"
  },
  {
    category: "goals_success",
    questionText: "What revenue or pipeline target does this engagement support?",
    answerType: "short_text",
    recommendedStakeholderType: "executive"
  },
  {
    category: "goals_success",
    questionText: "What is the timeline pressure (launch dates, board reviews, fiscal years)?",
    answerType: "long_text",
    recommendedStakeholderType: "executive"
  },
  {
    category: "goals_success",
    questionText: "Who needs to sign off the final discovery deliverable?",
    answerType: "long_text",
    recommendedStakeholderType: "executive"
  },
  {
    category: "goals_success",
    questionText: "What would cause this project to be considered a failure?",
    answerType: "long_text",
    recommendedStakeholderType: "executive"
  }
];

async function main() {
  console.log(`Seeding ${ITEMS.length} library items...`);
  let created = 0;
  let updated = 0;
  for (const item of ITEMS) {
    const existing = await prisma.discoveryQuestionLibraryItem.findFirst({
      where: { category: item.category, questionText: item.questionText }
    });
    const data = {
      category: item.category,
      subcategory: item.subcategory ?? null,
      questionText: item.questionText,
      helpText: item.helpText ?? null,
      answerType: item.answerType,
      options: item.options ?? [],
      tags: item.tags ?? [],
      recommendedStakeholderType: item.recommendedStakeholderType ?? null,
      defaultRequired: item.defaultRequired ?? false,
      linkedHubSpotArea: item.linkedHubSpotArea ?? null,
      linkedWebsiteArea: item.linkedWebsiteArea ?? null,
      complexityLevel: item.complexityLevel ?? "standard"
    };
    if (existing) {
      await prisma.discoveryQuestionLibraryItem.update({
        where: { id: existing.id },
        data
      });
      updated += 1;
    } else {
      await prisma.discoveryQuestionLibraryItem.create({ data });
      created += 1;
    }
  }
  console.log(`OK. Library: ${created} created, ${updated} updated.`);
}

main()
  .catch((error) => {
    console.error("seed-question-library failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    void prisma.$disconnect();
  });
