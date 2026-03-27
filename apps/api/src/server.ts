import type * as http from "node:http";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import { getIntegrationStatus } from "@muloo/config";
import { runPortalAuditAgent } from "@muloo/executor";
import { HubSpotClient } from "@muloo/hubspot-client";
import {
  loadProjectById,
  loadProjectExecutions,
  loadProjectModuleDetail,
  loadProjectSummaryById,
  summarizeProjectModules,
  summarizeProject,
  validateProjectById
} from "@muloo/file-system";
import Prisma from "@prisma/client";
import { DEFAULT_WORKSPACE_ID, getApiKey, moduleCatalog } from "@muloo/shared";
import { z, ZodError } from "zod";
import { prisma } from "./prisma";
import { executionQueue } from "./queue/index";

type PrismaTransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

const pendingPortalPrefix = "pending-portal-";
export const authCookieName = "muloo_deploy_os_auth";
export const clientAuthCookieName = "muloo_deploy_os_client_auth";
const defaultSimpleAuthUsername =
  process.env.MULOO_DEV_BYPASS === "true" ? "jarrud" : "";
const defaultSimpleAuthPassword =
  process.env.MULOO_DEV_BYPASS === "true" ? "deployos" : "";
const validEngagementTypes = [
  "AUDIT",
  "IMPLEMENTATION",
  "MIGRATION",
  "OPTIMISATION",
  "GUIDED_DEPLOYMENT"
] as const;
const validProjectHubValues = [
  "sales",
  "marketing",
  "service",
  "ops",
  "cms",
  "data",
  "commerce",
  "breeze"
] as const;
const validCustomerPlatformTierValues = [
  "free",
  "starter",
  "professional",
  "enterprise"
] as const;
const validImplementationApproachValues = [
  "pragmatic_poc",
  "best_practice"
] as const;
const validTaskStatusValues = [
  "backlog",
  "todo",
  "waiting_on_client",
  "in_progress",
  "blocked",
  "done"
] as const;
const validTaskAssigneeTypeValues = ["Human", "Agent", "Client"] as const;
const validTaskPriorityValues = ["low", "medium", "high"] as const;
const validTaskExecutionReadinessValues = [
  "not_ready",
  "assisted",
  "ready_with_review",
  "ready"
] as const;
const validTaskValidationStatusValues = [
  "pending",
  "confirmed",
  "failed",
  "skipped"
] as const;
const projectContextTypes = [
  "existing_knowledge",
  "work_done",
  "meeting_notes",
  "email_brief",
  "session_prep",
  "blockers"
] as const;
const validHubTierValues = [
  "free",
  "starter",
  "professional",
  "enterprise",
  "included"
] as const;
const defaultHubSpotOAuthRequiredScopes = [
  "oauth",
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.companies.read",
  "crm.objects.companies.write",
  "crm.objects.deals.read",
  "crm.objects.deals.write",
  "crm.objects.owners.read",
  "crm.schemas.contacts.read",
  "crm.schemas.contacts.write",
  "crm.schemas.companies.read",
  "crm.schemas.companies.write",
  "crm.schemas.deals.read",
  "crm.schemas.deals.write"
] as const;
const defaultHubSpotOAuthOptionalScopes = [
  "crm.objects.line_items.read",
  "crm.objects.line_items.write",
  "crm.objects.products.read",
  "crm.objects.products.write",
  "crm.objects.quotes.read",
  "crm.objects.quotes.write",
  "crm.objects.orders.read",
  "crm.objects.orders.write",
  "crm.objects.leads.read",
  "crm.objects.leads.write",
  "crm.objects.services.read",
  "crm.objects.services.write",
  "crm.objects.users.write",
  "crm.objects.marketing_events.read",
  "crm.objects.marketing_events.write",
  "crm.objects.custom.read",
  "crm.objects.custom.write",
  "crm.objects.partner-clients.read",
  "crm.objects.partner-clients.write",
  "crm.objects.partner-services.read",
  "crm.objects.partner-services.write",
  "crm.schemas.line_items.read",
  "crm.schemas.quotes.read",
  "crm.schemas.quotes.write",
  "crm.schemas.orders.read",
  "crm.schemas.orders.write",
  "crm.schemas.subscriptions.read",
  "crm.schemas.subscriptions.write",
  "crm.schemas.listings.read",
  "crm.schemas.listings.write",
  "crm.schemas.custom.read",
  "crm.schemas.custom.write",
  "crm.lists.read",
  "crm.lists.write",
  "crm.import",
  "crm.dealsplits.read_write",
  "communication_preferences.read",
  "communication_preferences.read_write",
  "settings.currencies.read",
  "settings.currencies.write",
  "settings.users.write",
  "settings.users.teams.write",
  "settings.security.security_health.read",
  "business_units_view.read",
  "business-intelligence",
  "content",
  "files",
  "hubdb",
  "marketing-email",
  "marketing.campaigns.read",
  "marketing.campaigns.write",
  "automation"
] as const;
const hubSpotScopeProfiles = {
  core_crm: {
    label: "Core CRM",
    requiredScopes: [...defaultHubSpotOAuthRequiredScopes],
    optionalScopes: []
  },
  automation: {
    label: "Automation",
    requiredScopes: [...defaultHubSpotOAuthRequiredScopes],
    optionalScopes: [
      "crm.objects.marketing_events.read",
      "crm.objects.marketing_events.write",
      "marketing.campaigns.read",
      "marketing.campaigns.write",
      "marketing-email",
      "business-intelligence"
    ]
  },
  cms_content: {
    label: "CMS & Content",
    requiredScopes: [...defaultHubSpotOAuthRequiredScopes],
    optionalScopes: ["content", "files", "hubdb"]
  },
  commercial_objects: {
    label: "Commercial Objects",
    requiredScopes: [...defaultHubSpotOAuthRequiredScopes],
    optionalScopes: [
      "crm.objects.quotes.read",
      "crm.objects.quotes.write",
      "crm.schemas.quotes.read",
      "crm.schemas.quotes.write",
      "crm.objects.orders.read",
      "crm.objects.orders.write",
      "crm.schemas.orders.read",
      "crm.schemas.orders.write",
      "crm.schemas.subscriptions.read",
      "crm.schemas.subscriptions.write",
      "crm.dealsplits.read_write"
    ]
  },
  advanced_admin: {
    label: "Advanced Admin",
    requiredScopes: [...defaultHubSpotOAuthRequiredScopes],
    optionalScopes: [
      "settings.currencies.write",
      "settings.users.read",
      "settings.users.write",
      "settings.users.teams.read",
      "settings.users.teams.write",
      "settings.security.security_health.read",
      "business_units_view.read",
      "crm.objects.users.read",
      "crm.objects.users.write",
      "crm.objects.partner-clients.read",
      "crm.objects.partner-clients.write",
      "crm.objects.partner-services.read",
      "crm.objects.partner-services.write",
      "crm.objects.services.read",
      "crm.objects.services.write",
      "crm.schemas.listings.read",
      "crm.schemas.listings.write",
      "crm.objects.leads.read",
      "crm.objects.leads.write"
    ]
  }
} as const;
type HubSpotScopeProfileKey = keyof typeof hubSpotScopeProfiles;
const validPlatformTierSelectionKeys = [
  "smart_crm",
  "marketing_hub",
  "sales_hub",
  "service_hub",
  "content_hub",
  "operations_hub",
  "data_hub",
  "commerce_hub",
  "breeze",
  "small_business_bundle",
  "free_tools"
] as const;
const defaultWorkspaceUsers = [
  {
    id: "jarrud-vander-merwe",
    name: "Jarrud van der Merwe",
    email: "jarrud@muloo.co",
    role: "HubSpot Architect"
  },
  {
    id: "muloo-operator",
    name: "Muloo Operator",
    email: "operator@muloo.com",
    role: "Operations"
  }
] as const;
export const industryOptions = [
  "Accounting & Advisory",
  "Agency & Professional Services",
  "Construction & Property",
  "Education & Training",
  "Financial Services",
  "Healthcare",
  "Legal",
  "Manufacturing",
  "Nonprofit",
  "Retail & Ecommerce",
  "SaaS & Technology",
  "Travel & Hospitality",
  "Other"
] as const;
const clientRegionOptions = [
  "Global",
  "UK",
  "ZA",
  "AUS",
  "USA West",
  "Brazil",
  "Spain",
  "DACH",
  "Europe",
  "North America",
  "LATAM",
  "Other"
] as const;
const clientRoleTagOptions = ["client", "partner", "group"] as const;
const serviceFamilyOptions = [
  "hubspot_architecture",
  "custom_engineering",
  "ai_automation"
] as const;

const defaultProviderConnections = [
  {
    providerKey: "hubspot_oauth",
    label: "HubSpot OAuth",
    connectionType: "oauth",
    defaultModel: null,
    endpointUrl: null,
    notes: "Primary auth layer later for user sign-in and account linking.",
    isEnabled: false
  },
  {
    providerKey: "anthropic",
    label: "Anthropic / Claude",
    connectionType: "api_key",
    defaultModel: "claude-sonnet-4-20250514",
    endpointUrl: null,
    notes: "Discovery drafting, project summaries, and blueprint generation.",
    isEnabled: false
  },
  {
    providerKey: "openai",
    label: "OpenAI / ChatGPT",
    connectionType: "api_key",
    defaultModel: "gpt-5.4",
    endpointUrl: null,
    notes:
      "Alternative agent workflows, QA passes, summarisation, and future assistants.",
    isEnabled: false
  },
  {
    providerKey: "perplexity",
    label: "Perplexity / Sonar",
    connectionType: "api_key",
    defaultModel: "sonar-pro",
    endpointUrl: null,
    notes:
      "Web-grounded research, current-state synthesis, and source-backed drafting.",
    isEnabled: false
  },
  {
    providerKey: "gemini",
    label: "Google Gemini",
    connectionType: "api_key",
    defaultModel: "gemini-2.5-pro",
    endpointUrl: null,
    notes:
      "Meeting-summary workflows and discovery ingestion from call outputs.",
    isEnabled: false
  }
] as const;
const defaultAiWorkflowRouting = [
  {
    workflowKey: "discovery_extract",
    label: "Discovery Extraction",
    providerKey: "gemini",
    modelOverride: "gemini-2.5-pro",
    notes:
      "Session note extraction, transcript parsing, and first-pass field drafting."
  },
  {
    workflowKey: "discovery_summary",
    label: "Discovery Summary",
    providerKey: "anthropic",
    modelOverride: "claude-sonnet-4-20250514",
    notes:
      "Project-level discovery synthesis, risks, and operator-friendly next questions."
  },
  {
    workflowKey: "blueprint_generation",
    label: "Discovery Blueprint Generation",
    providerKey: "anthropic",
    modelOverride: "claude-sonnet-4-20250514",
    notes: "Phased implementation blueprints for discovery-led projects."
  },
  {
    workflowKey: "scope_blueprint_generation",
    label: "Scoped Job Blueprint Generation",
    providerKey: "openai",
    modelOverride: "gpt-5.4",
    notes: "Technical blueprint generation for standalone scoped jobs."
  },
  {
    workflowKey: "solution_shaping",
    label: "Solution Shaping",
    providerKey: "openai",
    modelOverride: "gpt-5.4",
    notes: "Turn a pain point into recommended HubSpot-led solution options."
  },
  {
    workflowKey: "scoped_summary",
    label: "Scoped Job Summary",
    providerKey: "anthropic",
    modelOverride: "claude-sonnet-4-20250514",
    notes: "Generate executive scope summaries for standalone scoped jobs."
  },
  {
    workflowKey: "json_repair",
    label: "JSON Repair",
    providerKey: "openai",
    modelOverride: "gpt-5.4",
    notes: "Repair malformed model outputs into valid JSON when needed."
  },
  {
    workflowKey: "agent_execution_brief",
    label: "Agent Execution Brief",
    providerKey: "anthropic",
    modelOverride: "claude-sonnet-4-20250514",
    notes:
      "Prepare task-level execution briefs, checkpoints, and risk notes for queued agent delivery."
  },
  {
    workflowKey: "project_email_drafting",
    label: "Project Email Drafting",
    providerKey: "openai",
    modelOverride: "gpt-5.4",
    notes:
      "Draft internal-to-client emails from the saved project summary, quote status, and supporting context."
  },
  {
    workflowKey: "project_prepare_brief",
    label: "Project Prepare Brief",
    providerKey: "openai",
    modelOverride: "gpt-5.4",
    notes:
      "Generate meeting prep briefs, onsite agenda suggestions, and optimization context for existing-client work."
  },
  {
    workflowKey: "portal_audit",
    label: "Portal Audit",
    providerKey: "anthropic",
    modelOverride: "claude-sonnet-4-20250514",
    notes:
      "Detailed HubSpot portal audit generation with structured findings, quick wins, and implementation recommendations."
  },
  {
    workflowKey: "hubspot_operator_request",
    label: "HubSpot Operator Request",
    providerKey: "openai",
    modelOverride: "gpt-5.4",
    notes:
      "Translate natural-language HubSpot requests into safe direct actions or a manual execution plan."
  }
] as const;
const defaultProductCatalog = [
  {
    slug: "hubspot-implementation-phase",
    name: "Implementation Phase",
    serviceFamily: "hubspot_architecture",
    category: "one_time",
    billingModel: "fixed",
    description:
      "One-off implementation phase delivered from approved discovery scope.",
    unitPrice: 15000,
    defaultQuantity: 1,
    unitLabel: "phase",
    sortOrder: 10
  },
  {
    slug: "monthly-support-retainer",
    name: "Monthly Support Retainer",
    serviceFamily: "hubspot_architecture",
    category: "retainer",
    billingModel: "monthly",
    description:
      "Ongoing monthly HubSpot support, optimisation, and advisory cover.",
    unitPrice: 18000,
    defaultQuantity: 1,
    unitLabel: "month",
    sortOrder: 20
  },
  {
    slug: "additional-implementation-hours",
    name: "Additional Implementation Hours",
    serviceFamily: "hubspot_architecture",
    category: "add_on",
    billingModel: "hourly",
    description:
      "Additional scoped implementation hours outside the base approved scope.",
    unitPrice: 1500,
    defaultQuantity: 10,
    unitLabel: "hour",
    sortOrder: 30
  },
  {
    slug: "training-workshop",
    name: "Training Workshop",
    serviceFamily: "hubspot_architecture",
    category: "add_on",
    billingModel: "fixed",
    description:
      "Dedicated enablement or training workshop for client stakeholders.",
    unitPrice: 7500,
    defaultQuantity: 1,
    unitLabel: "workshop",
    sortOrder: 40
  },
  {
    slug: "documentation-sop-pack",
    name: "Documentation & SOP Pack",
    serviceFamily: "hubspot_architecture",
    category: "add_on",
    billingModel: "fixed",
    description:
      "Optional process-flow, SOP, and implementation documentation pack delivered alongside the approved scope.",
    unitPrice: 12000,
    defaultQuantity: 1,
    unitLabel: "pack",
    sortOrder: 50
  }
] as const;
const defaultAgentCatalog = [
  {
    slug: "discovery-structuring-agent",
    name: "Discovery Structuring Agent",
    purpose:
      "Turn meeting notes, uploaded docs, and client inputs into structured discovery records.",
    provider: "anthropic",
    model: "claude-sonnet",
    triggerType: "manual",
    approvalMode: "review_required",
    allowedActions: ["summarise", "draft-discovery", "identify-gaps"],
    systemPrompt:
      "Structure discovery inputs into Muloo's operating model. Highlight gaps, risks, and assumptions without inventing requirements.",
    sortOrder: 10
  },
  {
    slug: "delivery-planner-agent",
    name: "Delivery Planner Agent",
    purpose:
      "Convert approved discovery into phased delivery plans, rollout sequences, and implementation checklists.",
    provider: "anthropic",
    model: "claude-sonnet",
    triggerType: "manual",
    approvalMode: "review_required",
    allowedActions: ["draft-plan", "sequence-work", "suggest-dependencies"],
    systemPrompt:
      "Break approved scope into practical phases, dependencies, and client-ready implementation steps.",
    sortOrder: 20
  },
  {
    slug: "scope-commercial-agent",
    name: "Scope & Commercial Agent",
    purpose:
      "Support phase pricing, product bundling, and optional retainer/add-on suggestions.",
    provider: "openai",
    model: "gpt-5.4",
    triggerType: "manual",
    approvalMode: "review_required",
    allowedActions: ["draft-quote", "bundle-products", "summarise-scope"],
    systemPrompt:
      "Translate approved scope into clean commercial options without overpromising delivery or changing the agreed recommendation.",
    sortOrder: 30
  },
  {
    slug: "portal-audit-agent",
    name: "Portal Audit Agent",
    purpose:
      "Run detailed HubSpot portal audits using the latest snapshot, project context, and delivery heuristics to surface findings and prioritised recommendations.",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    triggerType: "manual",
    approvalMode: "review_required",
    allowedActions: [
      "audit",
      "findings",
      "quick-wins",
      "recommendations",
      "portal-review"
    ],
    systemPrompt:
      "Audit HubSpot portals like a senior architect. Ground findings in observed evidence, separate confirmed issues from missing access or tier limitations, and prioritise practical next actions for delivery.",
    sortOrder: 35
  },
  {
    slug: "hubspot-build-agent",
    name: "HubSpot Build Agent",
    purpose:
      "Execute safe HubSpot CRM build work like properties, property groups, custom objects, pipelines, and record updates through direct APIs.",
    provider: "openai",
    model: "gpt-5.4",
    triggerType: "manual",
    approvalMode: "review_required",
    allowedActions: [
      "properties",
      "property-groups",
      "custom-objects",
      "pipelines",
      "records",
      "direct-rest-api"
    ],
    systemPrompt:
      "Prefer deterministic HubSpot API operations. Avoid UI-driven setup when an official API path exists, and surface any required review before writing to production.",
    sortOrder: 40
  },
  {
    slug: "hubspot-workflow-agent",
    name: "HubSpot Workflow Agent",
    purpose:
      "Prepare automation-ready workflow designs, custom workflow action plans, and custom code action handoffs for HubSpot implementations.",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    triggerType: "manual",
    approvalMode: "review_required",
    allowedActions: [
      "workflow",
      "automation",
      "custom-workflow-action",
      "custom-code-action",
      "review-first"
    ],
    systemPrompt:
      "Guide workflow and automation implementation toward supported HubSpot patterns. Keep risky or beta-heavy automation behind review checkpoints.",
    sortOrder: 50
  },
  {
    slug: "hubspot-qa-agent",
    name: "HubSpot QA Agent",
    purpose:
      "Review HubSpot delivery outputs, validate schema readiness, and call out execution gaps before go-live or handoff.",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    triggerType: "manual",
    approvalMode: "review_required",
    allowedActions: [
      "qa",
      "validate",
      "review",
      "compare-schema",
      "readiness-check"
    ],
    systemPrompt:
      "Focus on validation, risk review, and production readiness. Do not fabricate completion; call out missing inputs, risky assumptions, and test gaps clearly.",
    sortOrder: 60
  }
] as const;
const defaultDeliveryTemplates = [
  {
    slug: "theme-install-localization",
    name: "Theme Install + Localization",
    description:
      "Repeatable CMS/theme implementation flow for marketplace theme installs, regional variants, QA, and launch.",
    serviceFamily: "custom_engineering",
    category: "website",
    scopeType: "standalone_quote",
    recommendedHubs: ["cms"],
    defaultPlannedHours: 42,
    sortOrder: 10,
    tasks: [
      {
        title: "Confirm scope, assumptions, and delivery boundaries",
        description:
          "Lock the exact technical delivery scope, design/content handoff points, and what Muloo is not responsible for.",
        category: "01 Scope & Theme Approval",
        executionType: "manual",
        priority: "high",
        status: "todo",
        assigneeType: "Human",
        plannedHours: 2,
        approvalRequired: true,
        sortOrder: 10
      },
      {
        title: "Select and approve the marketplace theme",
        description:
          "Shortlist the theme, confirm fit against required page types and localization needs, and obtain final approval.",
        category: "01 Scope & Theme Approval",
        executionType: "client_approval",
        priority: "high",
        status: "waiting_on_client",
        assigneeType: "Client",
        plannedHours: 1,
        approvalRequired: true,
        sortOrder: 20
      },
      {
        title: "Install approved theme and configure CMS foundation",
        description:
          "Install the selected marketplace theme, prepare a safe baseline, and confirm portal-level CMS configuration.",
        category: "02 CMS Foundation",
        executionType: "agent_ready",
        priority: "high",
        status: "todo",
        assigneeType: "Agent",
        plannedHours: 3,
        sortOrder: 30
      },
      {
        title: "Create child theme and technical customization layer",
        description:
          "Prepare the child theme or safe customization layer so implementation work stays upgrade-friendly.",
        category: "02 CMS Foundation",
        executionType: "manual",
        priority: "high",
        status: "todo",
        assigneeType: "Human",
        plannedHours: 4,
        sortOrder: 40
      },
      {
        title: "Configure required HubSpot system pages",
        description:
          "Set up the system page set required for the site, including search, password, preferences, and error experiences.",
        category: "03 Core Site Structure",
        executionType: "agent_ready",
        priority: "medium",
        status: "todo",
        assigneeType: "Agent",
        plannedHours: 3,
        sortOrder: 50
      },
      {
        title: "Configure blog structure and publishing settings",
        description:
          "Set up blog templates, listing/detail behavior, and publishing settings required for launch.",
        category: "03 Core Site Structure",
        executionType: "manual",
        priority: "medium",
        status: "todo",
        assigneeType: "Human",
        plannedHours: 3,
        sortOrder: 60
      },
      {
        title: "Define localization approach and content-routing rules",
        description:
          "Confirm whether localization will use smart content, regional page variants, or another supported model.",
        category: "04 Localization Design",
        executionType: "manual",
        priority: "high",
        status: "todo",
        assigneeType: "Human",
        plannedHours: 2,
        sortOrder: 70
      },
      {
        title: "Build regional site framework for required geographies",
        description:
          "Create the page structure, shared components, and localization scaffolding for regional variants.",
        category: "04 Localization Design",
        executionType: "agent_ready",
        priority: "high",
        status: "todo",
        assigneeType: "Agent",
        plannedHours: 6,
        sortOrder: 80
      },
      {
        title: "Receive approved content and design assets from partner",
        description:
          "Collect Figma, copy, assets, and regional content guidance needed for implementation.",
        category: "05 Partner Handoff",
        executionType: "client_dependency",
        priority: "high",
        status: "waiting_on_client",
        assigneeType: "Client",
        plannedHours: 1,
        sortOrder: 90
      },
      {
        title: "Implement page templates, linking, and technical configuration",
        description:
          "Apply the approved design/content handoff to the HubSpot build and complete the core technical implementation.",
        category: "06 Build & Linking",
        executionType: "manual",
        priority: "high",
        status: "todo",
        assigneeType: "Human",
        plannedHours: 8,
        sortOrder: 100
      },
      {
        title: "Run QA across templates, links, and regional variants",
        description:
          "Check page behavior, localization logic, responsive rendering, and technical quality before sign-off.",
        category: "07 QA & Launch",
        executionType: "agent_ready",
        priority: "high",
        status: "todo",
        assigneeType: "Agent",
        plannedHours: 4,
        qaRequired: true,
        sortOrder: 110
      },
      {
        title: "Prepare launch checklist and go-live plan",
        description:
          "Confirm launch dependencies, domain steps, partner approvals, and the sequence for go-live.",
        category: "07 QA & Launch",
        executionType: "manual",
        priority: "high",
        status: "todo",
        assigneeType: "Human",
        plannedHours: 2,
        sortOrder: 120
      },
      {
        title: "Complete go-live and handover support",
        description:
          "Execute launch, monitor the deployment, tidy defects, and close with technical handover notes.",
        category: "08 Go-Live & Handover",
        executionType: "manual",
        priority: "high",
        status: "todo",
        assigneeType: "Human",
        plannedHours: 3,
        qaRequired: true,
        sortOrder: 130
      }
    ]
  },
  {
    slug: "hubspot-onboarding-foundation",
    name: "HubSpot Onboarding Foundation",
    description:
      "Baseline onboarding delivery template for implementation projects moving from approved scope into execution.",
    serviceFamily: "hubspot_architecture",
    category: "hubspot",
    scopeType: "discovery",
    recommendedHubs: ["sales", "marketing", "service"],
    defaultPlannedHours: 60,
    sortOrder: 20,
    tasks: [
      {
        title: "Confirm approved scope, stakeholders, and delivery sequence",
        description:
          "Turn the approved scope into a working delivery plan with named owners, dependencies, and sign-off points.",
        category: "01 Project Kickoff",
        executionType: "manual",
        priority: "high",
        status: "todo",
        assigneeType: "Human",
        plannedHours: 3,
        approvalRequired: true,
        sortOrder: 10
      },
      {
        title: "Prepare implementation checklist from approved blueprint",
        description:
          "Convert the approved blueprint into a practical delivery checklist and rollout sequence.",
        category: "01 Project Kickoff",
        executionType: "agent_ready",
        priority: "medium",
        status: "todo",
        assigneeType: "Agent",
        plannedHours: 2,
        sortOrder: 20
      }
    ]
  }
] as const;
const sessionFieldLabels: Record<number, string[]> = {
  1: [
    "business_overview",
    "primary_pain_challenge",
    "goals_and_success_metrics",
    "key_stakeholders",
    "timeline_and_constraints"
  ],
  2: [
    "current_tech_stack",
    "current_hubspot_state",
    "data_landscape",
    "current_processes",
    "what_has_been_tried_before"
  ],
  3: [
    "hubs_and_features_required",
    "pipeline_and_process_design",
    "automation_requirements",
    "integration_requirements",
    "reporting_requirements"
  ],
  4: [
    "confirmed_scope",
    "out_of_scope",
    "risks_and_blockers",
    "client_responsibilities",
    "agreed_next_steps",
    "engagement_track",
    "platform_fit",
    "change_management_rating",
    "data_readiness_rating",
    "scope_volatility_rating"
  ]
};
const workRequestTypeOptions = [
  "quote_request",
  "job_spec",
  "project_brief",
  "change_request"
] as const;
const changeRequestStatusOptions = [
  "new",
  "under_review",
  "priced",
  "approved",
  "rejected",
  "appended_to_delivery",
  "closed"
] as const;

type EngagementType = (typeof validEngagementTypes)[number];
type ProjectHub = (typeof validProjectHubValues)[number];
type DiscoverySessionFields = Record<string, string>;
type DiscoverySessionStatus = "draft" | "in_progress" | "complete";
type DiscoveryEvidenceType = (typeof discoveryEvidenceTypeValues)[number];
type ChangeDeliveryTaskPlan = {
  title: string;
  description: string;
  category: string;
  plannedHours: number;
  assigneeType: "Human" | "Agent" | "Client";
  executionType: string;
  priority: string;
  qaRequired: boolean;
  approvalRequired: boolean;
};
type ClientQuestionnaireQuestion = {
  key: string;
  label: string;
  hint: string;
  enabled?: boolean;
};
type ClientQuestionnaireSessionConfig = {
  title: string;
  description: string;
  enabled?: boolean;
  questions: ClientQuestionnaireQuestion[];
};
type ClientQuestionnaireConfig = Record<
  number,
  ClientQuestionnaireSessionConfig
>;
type HubSpotAgentCapabilitySupport =
  | "supported"
  | "beta"
  | "external_best_path"
  | "not_recommended";
type HubSpotAgentExecutionPath =
  | "direct_rest_api"
  | "custom_workflow_action"
  | "custom_code_action"
  | "app_home_or_ui_extension"
  | "developer_mcp_or_cli"
  | "manual_or_review";
type HubSpotAgentActionKey =
  | "create_property_group"
  | "create_property"
  | "create_custom_object"
  | "create_pipeline"
  | "upsert_record";
const hubSpotAgentActionSchema = z.enum([
  "create_property_group",
  "create_property",
  "create_custom_object",
  "create_pipeline",
  "upsert_record"
]);
type HubSpotAgentCapability = {
  key: string;
  label: string;
  support: HubSpotAgentCapabilitySupport;
  recommendedPath: HubSpotAgentExecutionPath;
  summary: string;
  notes: string[];
  docs: Array<{ label: string; url: string }>;
  directActions?: HubSpotAgentActionKey[];
};
const hubSpotAgentRequestPlanSchema = z.object({
  mode: z.enum(["execute_action", "manual_plan"]),
  summary: z.string().trim().min(1),
  capabilityKey: z.string().trim().min(1),
  action: hubSpotAgentActionSchema.optional(),
  input: z.record(z.unknown()).optional(),
  manualPlan: z.array(z.string().trim().min(1)).default([]),
  cautions: z.array(z.string().trim().min(1)).default([])
});

function normalizeHubSpotAgentAction(
  value: unknown
): z.infer<typeof hubSpotAgentActionSchema> | undefined {
  const normalized = normalizeAuditString(value)?.toLowerCase() ?? "";

  switch (normalized) {
    case "create_property_group":
    case "property_group":
    case "create group":
      return "create_property_group";
    case "create_property":
    case "property":
    case "create field":
      return "create_property";
    case "create_custom_object":
    case "custom_object":
    case "custom object":
      return "create_custom_object";
    case "create_pipeline":
    case "pipeline":
      return "create_pipeline";
    case "upsert_record":
    case "upsert":
    case "record":
      return "upsert_record";
    default:
      return undefined;
  }
}

function normalizeHubSpotOperatorStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return entry.trim();
      }

      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const record = entry as Record<string, unknown>;
        return (
          normalizeAuditString(record.step) ??
          normalizeAuditString(record.title) ??
          normalizeAuditString(record.description) ??
          ""
        );
      }

      return "";
    })
    .filter(Boolean);
}

function inferHubSpotOperatorCapability(
  action: z.infer<typeof hubSpotAgentActionSchema> | undefined,
  summary: string,
  request: string
) {
  if (action) {
    return "crm_schema";
  }

  const haystack = `${summary} ${request}`.toLowerCase();

  if (haystack.includes("dashboard") || haystack.includes("report")) {
    return "reporting_manual_delivery";
  }

  if (haystack.includes("workflow") || haystack.includes("automation")) {
    return "workflow_manual_delivery";
  }

  if (haystack.includes("cms") || haystack.includes("content")) {
    return "cms_manual_delivery";
  }

  return "manual_delivery";
}

function normalizeHubSpotAgentRequestPlanPayload(
  value: unknown,
  request: string
) {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const action = normalizeHubSpotAgentAction(
    record.action ?? record.directAction ?? record.operation
  );
  const input =
    record.input && typeof record.input === "object" && !Array.isArray(record.input)
      ? (record.input as Record<string, unknown>)
      : undefined;
  const summary =
    normalizeAuditString(record.summary) ??
    normalizeAuditString(record.message) ??
    normalizeAuditString(record.decision) ??
    "Reviewed the request and prepared the safest next step.";
  const manualPlan = [
    ...normalizeHubSpotOperatorStrings(record.manualPlan),
    ...normalizeHubSpotOperatorStrings(record.plan),
    ...normalizeHubSpotOperatorStrings(record.steps),
    ...normalizeHubSpotOperatorStrings(record.nextSteps)
  ];
  const cautions = [
    ...normalizeHubSpotOperatorStrings(record.cautions),
    ...normalizeHubSpotOperatorStrings(record.risks),
    ...normalizeHubSpotOperatorStrings(record.notes)
  ];
  const requestedMode = normalizeAuditString(record.mode)?.toLowerCase() ?? "";
  const canExecute = Boolean(action && input && Object.keys(input).length > 0);
  const mode: z.infer<typeof hubSpotAgentRequestPlanSchema>["mode"] =
    requestedMode === "execute_action" && canExecute
      ? "execute_action"
      : "manual_plan";

  return {
    mode,
    summary,
    capabilityKey:
      normalizeAuditString(record.capabilityKey) ??
      normalizeAuditString(record.capability) ??
      inferHubSpotOperatorCapability(action, summary, request),
    ...(mode === "execute_action" ? { action, input } : {}),
    manualPlan:
      mode === "manual_plan" && manualPlan.length === 0
        ? [
            "Review the request as a manual delivery plan because it does not map cleanly to a safe direct HubSpot API action."
          ]
        : manualPlan,
    cautions
  };
}

async function parseHubSpotAgentRequestPlanModelJson(
  rawText: string,
  request: string
) {
  const normalizedJson = extractJsonBlock(rawText);

  try {
    return hubSpotAgentRequestPlanSchema.parse(
      normalizeHubSpotAgentRequestPlanPayload(
        JSON.parse(normalizedJson) as unknown,
        request
      )
    );
  } catch (initialError) {
    try {
      const repairedText = await callAiWorkflow(
        "json_repair",
        `You repair malformed JSON for Muloo Deploy OS.

Rules:
- Return ONLY valid JSON.
- Do not add markdown fences or commentary.
- Preserve the original intended structure and values as closely as possible.
`,
        JSON.stringify(
          {
            label: "hubspot-operator-request",
            malformedJson: normalizedJson
          },
          null,
          2
        ),
        { maxTokens: 4000 }
      );

      const repairedJson = extractJsonBlock(repairedText);
      return hubSpotAgentRequestPlanSchema.parse(
        normalizeHubSpotAgentRequestPlanPayload(
          JSON.parse(repairedJson) as unknown,
          request
        )
      );
    } catch (repairError) {
      if (
        initialError instanceof SyntaxError ||
        initialError instanceof ZodError
      ) {
        throw initialError;
      }

      if (
        repairError instanceof SyntaxError ||
        repairError instanceof ZodError
      ) {
        throw repairError;
      }

      throw new SyntaxError(
        "Failed to parse hubspot-operator-request JSON from model output"
      );
    }
  }
}

const hubSpotAgentCapabilities: HubSpotAgentCapability[] = [
  {
    key: "crm_schema",
    label: "CRM Objects, Properties, Pipelines, and Associations",
    support: "supported",
    recommendedPath: "direct_rest_api",
    summary:
      "Use HubSpot's CRM REST APIs for custom properties, property groups, custom objects, associations, pipelines, stages, and record CRUD.",
    notes: [
      "This is the strongest path for agent execution because the APIs are stable, scoped, and deterministic.",
      "Start with properties on standard objects before reaching for custom objects.",
      "When the data model grows beyond standard objects, create a custom object schema first, then attach properties and associations."
    ],
    docs: [
      {
        label: "CRM Properties API",
        url: "https://developers.hubspot.com/docs/api-reference/crm-properties-v3/guide"
      },
      {
        label: "Custom Objects API",
        url: "https://developers.hubspot.com/docs/api-reference/crm-custom-objects-v3/guide"
      },
      {
        label: "Associations v4 API",
        url: "https://developers.hubspot.com/docs/api-reference/crm-associations-v4/guide"
      },
      {
        label: "Pipelines API",
        url: "https://developers.hubspot.com/docs/api-reference/crm-pipelines-v3/guide"
      },
      {
        label: "Objects API",
        url: "https://developers.hubspot.com/docs/api-reference/crm-objects-v3/guide"
      }
    ],
    directActions: [
      "create_property_group",
      "create_property",
      "create_custom_object",
      "create_pipeline",
      "upsert_record"
    ]
  },
  {
    key: "workflow_automation",
    label: "Workflows and Automation",
    support: "beta",
    recommendedPath: "custom_workflow_action",
    summary:
      "For agent-style execution inside HubSpot automation, prefer custom workflow actions and agent tools rather than brittle UI automation.",
    notes: [
      "Custom workflow actions are the right bridge when HubSpot workflows need to call external Muloo execution.",
      "Custom code actions are useful when the logic should execute inside HubSpot's managed serverless runtime.",
      "Treat workflow creation and mutation as a review-heavy lane until the workflow APIs and project tooling are fully standardized in our stack."
    ],
    docs: [
      {
        label: "Define a custom workflow action",
        url: "https://developers.hubspot.com/docs/apps/developer-platform/add-features/custom-workflow-actions"
      },
      {
        label: "Automation API | Custom Workflow Actions",
        url: "https://developers.hubspot.com/docs/api/automation/custom-workflow-actions"
      },
      {
        label: "Workflows | Custom Code Actions",
        url: "https://developers.hubspot.com/docs/api-reference/automation-actions-v4-v4/custom-code-actions"
      },
      {
        label: "Create an agent tool",
        url: "https://developers.hubspot.com/docs/apps/developer-platform/add-features/agent-tools/create-an-agent-tool"
      }
    ]
  },
  {
    key: "dashboards_and_reporting",
    label: "Dashboards and Reporting",
    support: "external_best_path",
    recommendedPath: "app_home_or_ui_extension",
    summary:
      "Use HubSpot app home and UI extensions as the native reporting surface, and use report-sharing or external BI for richer dashboard delivery.",
    notes: [
      "There is still no clean general-purpose public dashboard-builder path to rely on for agent CRUD the way we can for CRM schema APIs.",
      "For internal productized reporting, app home is the better native interface than trying to automate the dashboard UI.",
      "For executive dashboards, external BI remains the safer pattern when HubSpot-native reporting won't cover the use case cleanly."
    ],
    docs: [
      {
        label: "Create an app home page",
        url: "https://developers.hubspot.com/docs/apps/developer-platform/add-features/ui-extensibility/create-an-app-home-page"
      },
      {
        label: "UI extensions overview",
        url: "https://developers.hubspot.com/docs/apps/developer-platform/add-features/ui-extensibility/overview"
      },
      {
        label: "October 2025 Developer Rollup",
        url: "https://developers.hubspot.com/changelog/october-2025-developer-rollup"
      }
    ]
  },
  {
    key: "cms_and_theme_delivery",
    label: "CMS Themes, Pages, and Developer Assets",
    support: "supported",
    recommendedPath: "developer_mcp_or_cli",
    summary:
      "For CMS builds, developer projects, the HubSpot CLI, and HubSpot's MCP tooling are the best path rather than direct CRM-style API calls.",
    notes: [
      "This is the right lane for themes, modules, UI extensions, app home, serverless functions, and future HubSpot-native agent tools.",
      "Developer MCP is useful for scaffolding and managing HubSpot projects locally, while the remote MCP server is useful for secure CRM context retrieval.",
      "When the work is asset-heavy, treat the codebase and deployment pipeline as the source of truth, not the browser UI."
    ],
    docs: [
      {
        label: "HubSpot MCP Server",
        url: "https://developers.hubspot.com/mcp"
      },
      {
        label: "Introducing the HubSpot Developer Platform",
        url: "https://developers.hubspot.com/changelog/introducing-the-hubspot-developer-platform-2025"
      },
      {
        label: "Create an app home page",
        url: "https://developers.hubspot.com/docs/apps/developer-platform/add-features/ui-extensibility/create-an-app-home-page"
      }
    ]
  }
];

const sessionTitles: Record<number, string> = {
  1: "Business & Goals",
  2: "Current State",
  3: "Future State Design",
  4: "Scope & Handover"
};
const defaultClientQuestionnaireConfig: ClientQuestionnaireConfig = {
  1: {
    title: "Business & Goals",
    description:
      "Help Muloo understand the business, why this project matters, and what success should look like.",
    questions: [
      {
        key: "business_overview",
        label: "Tell us about your business",
        hint: "What the business does, key services, and who you serve."
      },
      {
        key: "primary_pain_challenge",
        label: "What is the biggest challenge driving this project?",
        hint: "What is not working well enough today?"
      },
      {
        key: "goals_and_success_metrics",
        label: "What outcomes would make this project a success?",
        hint: "Think in terms of business results, team improvements, or customer outcomes."
      },
      {
        key: "key_stakeholders",
        label: "Who should be involved in decisions and delivery?",
        hint: "List the people, teams, or roles that matter."
      },
      {
        key: "timeline_and_constraints",
        label: "Are there key timing or business constraints?",
        hint: "Important deadlines, events, campaigns, resourcing, or dependencies."
      }
    ]
  },
  2: {
    title: "Current State",
    description:
      "Describe the systems, tools, data, and workflows you use today so discovery starts from reality.",
    questions: [
      {
        key: "current_tech_stack",
        label: "What tools and platforms do you use today?",
        hint: "CRM, email, forms, reporting, finance, website, or any other important tools."
      },
      {
        key: "current_hubspot_state",
        label: "What is your current HubSpot situation?",
        hint: "If you already use HubSpot, what is in place and what feels incomplete or broken?"
      },
      {
        key: "data_landscape",
        label: "Where does your key data live today?",
        hint: "Spreadsheets, legacy CRM, email lists, finance systems, or other sources."
      },
      {
        key: "current_processes",
        label: "How do your teams currently work?",
        hint: "Describe the current sales, marketing, service, or operational process."
      },
      {
        key: "what_has_been_tried_before",
        label: "What has already been tried?",
        hint: "Previous systems, projects, fixes, or workarounds."
      }
    ]
  },
  3: {
    title: "Future State Design",
    description:
      "Describe what you want the future way of working to look like so Muloo can shape the recommendation properly.",
    questions: [
      {
        key: "hubs_and_features_required",
        label: "Which hubs or capabilities matter most?",
        hint: "Sales, marketing, service, content, operations, automation, reporting, and so on."
      },
      {
        key: "pipeline_and_process_design",
        label: "How should the future process work?",
        hint: "What should happen from first enquiry through to delivery, renewal, or support?"
      },
      {
        key: "automation_requirements",
        label: "What should be automated?",
        hint: "Routing, notifications, qualification, reminders, handoffs, or customer journeys."
      },
      {
        key: "integration_requirements",
        label: "What other systems need to connect?",
        hint: "Finance, events, website, support, surveys, forms, or any other critical tools."
      },
      {
        key: "reporting_requirements",
        label: "What reporting or visibility is needed?",
        hint: "Dashboards, KPIs, board reporting, pipeline visibility, attribution, or service performance."
      }
    ]
  },
  4: {
    title: "Scope & Handover",
    description:
      "Help Muloo understand what should be prioritised, what is out of scope for now, and what the client team needs to provide.",
    questions: [
      {
        key: "confirmed_scope",
        label: "What do you see as the priority scope for this work?",
        hint: "The pieces that matter most to get right first."
      },
      {
        key: "out_of_scope",
        label: "What should not be part of this phase?",
        hint: "Anything that should be excluded, deferred, or treated separately."
      },
      {
        key: "risks_and_blockers",
        label: "What could delay or complicate delivery?",
        hint: "Access, data, resourcing, change resistance, approvals, or technical unknowns."
      },
      {
        key: "client_responsibilities",
        label: "What can your team provide or own?",
        hint: "Data, access, decisions, approvals, subject matter expertise, or internal project ownership."
      },
      {
        key: "agreed_next_steps",
        label: "What should happen next after discovery?",
        hint: "Actions, owners, and what you expect to receive back from Muloo."
      }
    ]
  }
};
const blueprintTaskTypeValues = ["Agent", "Human", "Client"] as const;
const discoveryEvidenceTypeValues = [
  "transcript",
  "summary",
  "uploaded-doc",
  "website-link",
  "screen-grab",
  "miro-note",
  "operator-note",
  "client-input"
] as const;
const blueprintGenerationSchema = z.object({
  phases: z
    .array(
      z.object({
        phase: z.number().int().positive(),
        phaseName: z.string().trim().min(1),
        tasks: z
          .array(
            z.object({
              name: z.string().trim().min(1),
              type: z.enum(blueprintTaskTypeValues),
              effortHours: z.number().positive(),
              order: z.number().int().positive()
            })
          )
          .min(1)
      })
    )
    .min(1)
    .max(5)
});
const discoverySummarySchema = z.object({
  executiveSummary: z.string().trim().min(1),
  mainPainPoints: z.array(z.string().trim().min(1)).default([]),
  recommendedApproach: z.string().trim().min(1),
  whyThisApproach: z.string().trim().min(1),
  phaseOneFocus: z.string().trim().min(1),
  futureUpgradePath: z.string().trim().min(1),
  inScopeItems: z.array(z.string().trim().min(1)).default([]),
  outOfScopeItems: z.array(z.string().trim().min(1)).default([]),
  supportingTools: z.array(z.string().trim().min(1)).default([]),
  engagementTrack: z.string().trim().min(1),
  platformFit: z.string().trim().min(1),
  changeManagementRating: z.string().trim().min(1),
  dataReadinessRating: z.string().trim().min(1),
  scopeVolatilityRating: z.string().trim().min(1),
  missingInformation: z.array(z.string().trim().min(1)).default([]),
  keyRisks: z.array(z.string().trim().min(1)).default([]),
  recommendedNextQuestions: z.array(z.string().trim().min(1)).default([])
});
const projectEmailDraftSchema = z.object({
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1)
});
const projectAgendaRecordSchema = z.object({
  sessionType: z.string().trim().min(1),
  date: z.string().trim().min(1).nullable().optional(),
  duration: z.string().trim().min(1).nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional(),
  content: z.string().trim().min(1),
  generatedAt: z.string().datetime()
});
type DiscoverySummaryPayload = z.output<typeof discoverySummarySchema>;
const discoverySummaryLooseSchema = z.object({
  executiveSummary: z.string().trim().optional(),
  mainPainPoints: z.array(z.string().trim().min(1)).optional().default([]),
  recommendedApproach: z.string().trim().optional(),
  whyThisApproach: z.string().trim().optional(),
  phaseOneFocus: z.string().trim().optional(),
  futureUpgradePath: z.string().trim().optional(),
  inScopeItems: z.array(z.string().trim().min(1)).optional().default([]),
  outOfScopeItems: z.array(z.string().trim().min(1)).optional().default([]),
  supportingTools: z.array(z.string().trim().min(1)).optional().default([]),
  engagementTrack: z.string().trim().optional(),
  platformFit: z.string().trim().optional(),
  changeManagementRating: z.string().trim().optional(),
  dataReadinessRating: z.string().trim().optional(),
  scopeVolatilityRating: z.string().trim().optional(),
  missingInformation: z.array(z.string().trim().min(1)).optional().default([]),
  keyRisks: z.array(z.string().trim().min(1)).optional().default([]),
  recommendedNextQuestions: z
    .array(z.string().trim().min(1))
    .optional()
    .default([])
});
const solutionShapingOptionSchema = z.object({
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  rationale: z.string().trim().min(1),
  recommendedScopeType: z.string().trim().min(1),
  recommendedEngagementType: z.string().trim().min(1),
  recommendedServiceFamily: z.string().trim().min(1),
  recommendedHubs: z.array(z.string().trim().min(1)).default([]),
  recommendedCustomerPlatformTier: z.string().trim().optional().default(""),
  recommendedPlatformTierSelections: z.record(z.string().trim()).default({}),
  jobSpecSeed: z.string().trim().min(1),
  executiveSummary: z.string().trim().min(1)
});
const solutionShapingSchema = z.object({
  options: z.array(solutionShapingOptionSchema).min(3).max(3)
});

function serializeDiscoverySummary<
  T extends {
    executiveSummary: string;
    mainPainPoints: string[];
    recommendedApproach: string;
    whyThisApproach: string;
    phaseOneFocus: string;
    futureUpgradePath: string;
    inScopeItems: string[];
    outOfScopeItems: string[];
    supportingTools: string[];
    engagementTrack: string;
    platformFit: string;
    changeManagementRating: string;
    dataReadinessRating: string;
    scopeVolatilityRating: string;
    missingInformation: string[];
    keyRisks: string[];
    recommendedNextQuestions: string[];
  }
>(summary: T) {
  return {
    executiveSummary: summary.executiveSummary,
    mainPainPoints: summary.mainPainPoints,
    recommendedApproach: summary.recommendedApproach,
    whyThisApproach: summary.whyThisApproach,
    phaseOneFocus: summary.phaseOneFocus,
    futureUpgradePath: summary.futureUpgradePath,
    inScopeItems: summary.inScopeItems,
    outOfScopeItems: summary.outOfScopeItems,
    supportingTools: summary.supportingTools,
    engagementTrack: summary.engagementTrack,
    platformFit: summary.platformFit,
    changeManagementRating: summary.changeManagementRating,
    dataReadinessRating: summary.dataReadinessRating,
    scopeVolatilityRating: summary.scopeVolatilityRating,
    missingInformation: summary.missingInformation,
    keyRisks: summary.keyRisks,
    recommendedNextQuestions: summary.recommendedNextQuestions
  };
}

function isValidEngagementType(value: string): value is EngagementType {
  return validEngagementTypes.includes(value as EngagementType);
}

function isValidProjectHub(value: string): value is ProjectHub {
  return validProjectHubValues.includes(value as ProjectHub);
}

function isValidCustomerPlatformTier(
  value: string
): value is (typeof validCustomerPlatformTierValues)[number] {
  return validCustomerPlatformTierValues.includes(
    value as (typeof validCustomerPlatformTierValues)[number]
  );
}

function isValidImplementationApproach(
  value: string
): value is (typeof validImplementationApproachValues)[number] {
  return validImplementationApproachValues.includes(
    value as (typeof validImplementationApproachValues)[number]
  );
}

function isValidHubTier(
  value: string
): value is (typeof validHubTierValues)[number] {
  return validHubTierValues.includes(
    value as (typeof validHubTierValues)[number]
  );
}

function normalizePlatformTierSelections(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, string>;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, tier]) =>
          validPlatformTierSelectionKeys.includes(
            key as (typeof validPlatformTierSelectionKeys)[number]
          ) &&
          typeof tier === "string" &&
          isValidHubTier(tier.trim().toLowerCase())
      )
      .map(([key, tier]) => [key, (tier as string).trim().toLowerCase()])
  );
}

const platformTierRank: Record<string, number> = {
  free: 0,
  included: 1,
  starter: 1,
  professional: 2,
  enterprise: 3
};

const platformProductLabels: Record<string, string> = {
  smart_crm: "Smart CRM",
  marketing_hub: "Marketing Hub",
  sales_hub: "Sales Hub",
  service_hub: "Service Hub",
  content_hub: "Content Hub",
  operations_hub: "Operations Hub",
  data_hub: "Data Hub",
  commerce_hub: "Commerce Hub",
  breeze: "Breeze",
  small_business_bundle: "Small Business Bundle",
  free_tools: "Free Tools"
};

const productKeyByProjectHub: Partial<Record<ProjectHub, string>> = {
  sales: "sales_hub",
  marketing: "marketing_hub",
  service: "service_hub",
  cms: "content_hub",
  ops: "operations_hub",
  data: "data_hub",
  commerce: "commerce_hub"
};

type PackagingAssessment = {
  fit: "good" | "attention" | "upgrade_needed";
  summary: string;
  warnings: string[];
  recommendedNextStep: string;
  reasoning: string[];
  workaroundPath: string | null;
  requiredProductTiers: Record<string, string>;
  selectedProductTiers: Record<string, string>;
};

function mergeRequiredTier(
  target: Record<string, string>,
  productKey: string,
  tier: string
) {
  const current = target[productKey];
  if (
    !current ||
    (platformTierRank[tier] ?? 0) > (platformTierRank[current] ?? 0)
  ) {
    target[productKey] = tier;
  }
}

function getSelectedProductTier(
  productKey: string,
  customerPlatformTier: string | null | undefined,
  platformTierSelections: Record<string, string>
) {
  const directSelection = platformTierSelections[productKey];
  if (directSelection) {
    return directSelection;
  }

  if (productKey === "smart_crm" && customerPlatformTier) {
    return customerPlatformTier;
  }

  if (productKey === "breeze" && customerPlatformTier) {
    return "included";
  }

  return "";
}

function derivePlatformPackagingAssessment(input: {
  selectedHubs: string[];
  customerPlatformTier?: string | null | undefined;
  platformTierSelections?: Record<string, string> | null | undefined;
  implementationApproach?: string | null | undefined;
  evidenceText: string;
}) {
  const selectedHubs = new Set(input.selectedHubs);
  const normalizedSelections = normalizePlatformTierSelections(
    input.platformTierSelections
  );
  const customerPlatformTier =
    typeof input.customerPlatformTier === "string" &&
    isValidCustomerPlatformTier(input.customerPlatformTier)
      ? input.customerPlatformTier
      : "";
  const requiredProductTiers: Record<string, string> = {};
  const selectedProductTiers: Record<string, string> = {};
  const warnings: string[] = [];
  const reasoning: string[] = [];
  const evidenceText = input.evidenceText.toLowerCase();
  const implementationApproach =
    typeof input.implementationApproach === "string" &&
    isValidImplementationApproach(input.implementationApproach)
      ? input.implementationApproach
      : "pragmatic_poc";
  const allowsWorkaroundArchitecture =
    implementationApproach === "pragmatic_poc" ||
    includesAny(evidenceText, [
      "staging layer",
      "staging",
      "middleware",
      "external layer",
      "warehouse",
      "databox",
      "proof of concept",
      "poc",
      "phase 1"
    ]);

  for (const hub of selectedHubs) {
    const productKey = productKeyByProjectHub[hub as ProjectHub];
    if (!productKey) {
      continue;
    }

    const selectedTier = getSelectedProductTier(
      productKey,
      customerPlatformTier,
      normalizedSelections
    );

    if (selectedTier) {
      selectedProductTiers[productKey] = selectedTier;
    } else {
      warnings.push(
        `${platformProductLabels[productKey]} is in scope but no tier has been selected yet.`
      );
    }
  }

  if (includesAny(evidenceText, ["website", "cms", "theme", "page", "blog"])) {
    mergeRequiredTier(requiredProductTiers, "content_hub", "starter");
    reasoning.push(
      "Website/CMS language in the brief suggests Content Hub is part of the workable delivery surface."
    );
  }

  if (
    includesAny(evidenceText, [
      "smart content",
      "localized",
      "localised",
      "localization",
      "localisation",
      "multi-region",
      "multi region",
      "geo-target",
      "geo target"
    ])
  ) {
    if (allowsWorkaroundArchitecture) {
      warnings.push(
        "Localized or smart-content requirements may be deliverable on lower packaging if the solution uses pragmatic page structure workarounds instead of native advanced personalization."
      );
      reasoning.push(
        "The brief mentions localization, but the selected planning approach allows pragmatic workaround patterns before assuming a higher native HubSpot tier."
      );
    } else {
      mergeRequiredTier(requiredProductTiers, "content_hub", "professional");
      reasoning.push(
        "Localization and smart-content language points toward Content Hub Professional when implemented natively in HubSpot."
      );
    }
  }

  if (
    includesAny(evidenceText, [
      "workflow",
      "automation",
      "nurture",
      "lead scoring",
      "branching",
      "sequence",
      "webhook"
    ])
  ) {
    const automationProduct = selectedHubs.has("marketing")
      ? "marketing_hub"
      : selectedHubs.has("sales")
        ? "sales_hub"
        : selectedHubs.has("service")
          ? "service_hub"
          : "operations_hub";
    mergeRequiredTier(requiredProductTiers, automationProduct, "professional");
    reasoning.push(
      "Automation-specific language suggests a Professional-tier Hub product if those workflows are expected to run natively inside HubSpot."
    );
  }

  if (
    includesAny(evidenceText, [
      "custom object",
      "custom objects",
      "many to many",
      "attendance record",
      "bridge table"
    ])
  ) {
    if (allowsWorkaroundArchitecture) {
      warnings.push(
        "The brief references many-to-many style attendance history, but the selected planning approach allows that relationship model to live in an external staging layer rather than forcing Smart CRM Enterprise immediately."
      );
      reasoning.push(
        "Many-to-many attendance requirements normally point toward richer data modeling, but a pragmatic POC can keep the bridge model outside HubSpot and sync summarized CRM-friendly fields in."
      );
    } else {
      mergeRequiredTier(requiredProductTiers, "smart_crm", "enterprise");
      reasoning.push(
        "Many-to-many or bridge-record requirements usually indicate a need for richer native CRM modeling, which pushes toward Smart CRM Enterprise."
      );
    }
  }

  if (
    includesAny(evidenceText, [
      "data sync",
      "dedupe",
      "duplicate",
      "enrichment",
      "data quality",
      "staging layer",
      "middleware"
    ])
  ) {
    if (allowsWorkaroundArchitecture) {
      warnings.push(
        "Data quality, dedupe, and staging needs may be handled through a lightweight external consolidation layer in Phase 1 rather than requiring Data Hub immediately."
      );
      reasoning.push(
        "The brief references data normalization work, but a pragmatic POC can use external data handling instead of assuming Data Hub Professional from day one."
      );
    } else {
      mergeRequiredTier(requiredProductTiers, "data_hub", "professional");
      reasoning.push(
        "Data sync, dedupe, and staged data-management language suggests Data Hub Professional if the data quality workflow is expected to live natively in HubSpot."
      );
    }
  }

  if (
    includesAny(evidenceText, [
      "payment",
      "invoice",
      "quote",
      "commerce",
      "checkout",
      "subscription"
    ])
  ) {
    mergeRequiredTier(requiredProductTiers, "commerce_hub", "starter");
    reasoning.push(
      "Commerce and payment language suggests Commerce Hub if those flows are expected inside HubSpot."
    );
  }

  let fit: PackagingAssessment["fit"] =
    warnings.length > 0 ? "attention" : "good";

  for (const [productKey, requiredTier] of Object.entries(
    requiredProductTiers
  )) {
    const selectedTier = getSelectedProductTier(
      productKey,
      customerPlatformTier,
      normalizedSelections
    );

    if (selectedTier) {
      selectedProductTiers[productKey] = selectedTier;
    }

    if (!selectedTier) {
      warnings.push(
        allowsWorkaroundArchitecture
          ? `${platformProductLabels[productKey]} may need at least ${requiredTier} for a native HubSpot delivery, but a boxed Phase 1 can still proceed if Muloo uses a documented workaround architecture.`
          : `${platformProductLabels[productKey]} likely needs at least ${requiredTier}, but no tier has been selected for this product.`
      );
      fit = allowsWorkaroundArchitecture
        ? fit === "good"
          ? "attention"
          : fit
        : "upgrade_needed";
      continue;
    }

    if (
      (platformTierRank[selectedTier] ?? 0) <
      (platformTierRank[requiredTier] ?? 0)
    ) {
      warnings.push(
        allowsWorkaroundArchitecture
          ? `${platformProductLabels[productKey]} is currently set to ${selectedTier}. That can still work for a boxed Phase 1 if Muloo keeps the heavier model outside HubSpot and documents the workaround clearly.`
          : `${platformProductLabels[productKey]} is currently set to ${selectedTier}, but this scoped work likely needs ${requiredTier} or a documented workaround.`
      );
      fit = allowsWorkaroundArchitecture
        ? fit === "good"
          ? "attention"
          : fit
        : "upgrade_needed";
    }
  }

  const summary =
    fit === "good"
      ? allowsWorkaroundArchitecture
        ? "The selected HubSpot packaging appears workable for the scoped Phase 1 approach, assuming the complex data modeling remains outside HubSpot where needed."
        : "The selected HubSpot packaging appears to support the scoped work."
      : fit === "attention"
        ? allowsWorkaroundArchitecture
          ? "The selected packaging can work for a boxed Phase 1 if Muloo keeps the heavier data architecture outside HubSpot and treats HubSpot as the operational front end."
          : "The scoped work is broadly aligned, but some packaging assumptions or workaround decisions still need to be confirmed."
        : "The scoped work likely exceeds the currently selected HubSpot packaging and needs an upgrade or agreed workaround before delivery.";

  const recommendedNextStep =
    fit === "good"
      ? allowsWorkaroundArchitecture
        ? "Proceed with blueprinting using a pragmatic architecture: keep the complex consolidation logic outside HubSpot and use HubSpot as the operational CRM layer."
        : "Proceed with blueprinting and delivery planning using the selected packaging."
      : fit === "attention"
        ? allowsWorkaroundArchitecture
          ? "Proceed as a boxed Phase 1 POC, keep the data-heavy model outside HubSpot, and only uplift packaging later if the client wants more native HubSpot capability."
          : "Confirm whether this should be a pragmatic workaround-led delivery or a more native HubSpot implementation before finalizing the blueprint and quote."
        : "Resolve the packaging gap first by upgrading the required HubSpot products or revising the scoped solution.";

  const workaroundPath = allowsWorkaroundArchitecture
    ? "A pragmatic Phase 1 path can keep complex identity resolution, bridge-table logic, and heavy data normalization outside HubSpot, then sync only the operational CRM fields and summary metrics into HubSpot."
    : null;

  return {
    fit,
    summary,
    warnings,
    recommendedNextStep,
    reasoning,
    workaroundPath,
    requiredProductTiers,
    selectedProductTiers
  } satisfies PackagingAssessment;
}

function isValidDiscoveryEvidenceType(
  value: string
): value is DiscoveryEvidenceType {
  return discoveryEvidenceTypeValues.includes(value as DiscoveryEvidenceType);
}

async function ensureWorkspaceUsersSeeded() {
  const existingCount = await prisma.workspaceUser.count();

  if (existingCount > 0) {
    return;
  }

  await prisma.workspaceUser.createMany({
    data: defaultWorkspaceUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: true,
      sortOrder: 10
    }))
  });
}

export async function loadWorkspaceUsers() {
  await ensureWorkspaceUsersSeeded();

  return prisma.workspaceUser.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });
}

export async function createWorkspaceUser(value: {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  role?: unknown;
  isActive?: unknown;
  sortOrder?: unknown;
}) {
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const email =
    typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const password =
    typeof value.password === "string" ? value.password.trim() : "";
  const role = typeof value.role === "string" ? value.role.trim() : "";
  const sortOrder =
    typeof value.sortOrder === "number"
      ? value.sortOrder
      : Number(value.sortOrder);

  if (!name || !email || !role) {
    throw new Error("name, email, and role are required");
  }

  if (password && password.length < 8) {
    throw new Error("password must be at least 8 characters");
  }

  const nextSortOrder = Number.isFinite(sortOrder)
    ? Math.round(sortOrder)
    : await prisma.workspaceUser
        .findFirst({
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true }
        })
        .then((user) => (user?.sortOrder ?? 0) + 10);
  const passwordHash = password ? await hashPassword(password) : null;

  const user = await prisma.workspaceUser.create({
    data: {
      name,
      email,
      password: passwordHash,
      role,
      isActive: value.isActive === false ? false : true,
      sortOrder: nextSortOrder
    }
  });

  return serializeWorkspaceUser(user);
}

export async function updateWorkspaceUser(
  userId: string,
  value: {
    name?: unknown;
    email?: unknown;
    password?: unknown;
    role?: unknown;
    isActive?: unknown;
    sortOrder?: unknown;
  }
) {
  const data: Prisma.Prisma.WorkspaceUserUpdateInput = {};

  if (value.name !== undefined) {
    if (typeof value.name !== "string" || value.name.trim().length === 0) {
      throw new Error("name must be a non-empty string");
    }
    data.name = value.name.trim();
  }

  if (value.email !== undefined) {
    if (typeof value.email !== "string" || value.email.trim().length === 0) {
      throw new Error("email must be a non-empty string");
    }
    data.email = value.email.trim().toLowerCase();
  }

  if (value.password !== undefined) {
    if (typeof value.password !== "string") {
      throw new Error("password must be a string");
    }

    const password = value.password.trim();

    if (password && password.length < 8) {
      throw new Error("password must be at least 8 characters");
    }

    data.password = password ? await hashPassword(password) : null;
  }

  if (value.role !== undefined) {
    if (typeof value.role !== "string" || value.role.trim().length === 0) {
      throw new Error("role must be a non-empty string");
    }
    data.role = value.role.trim();
  }

  if (value.isActive !== undefined) {
    data.isActive = Boolean(value.isActive);
  }

  if (value.sortOrder !== undefined) {
    const sortOrder =
      typeof value.sortOrder === "number"
        ? value.sortOrder
        : Number(value.sortOrder);
    if (!Number.isFinite(sortOrder)) {
      throw new Error("sortOrder must be a valid number");
    }
    data.sortOrder = Math.round(sortOrder);
  }

  const user = await prisma.workspaceUser.update({
    where: { id: userId },
    data
  });

  return serializeWorkspaceUser(user);
}

function inferDefaultHubsForServiceFamily(serviceFamily: string) {
  switch (serviceFamily) {
    case "custom_engineering":
      return ["cms"];
    case "ai_automation":
      return ["ops"];
    case "hubspot_architecture":
    default:
      return ["sales", "marketing", "service"];
  }
}

export async function convertWorkRequestToProject(requestId: string) {
  const workRequest = await prisma.workRequest.findUnique({
    where: { id: requestId },
    include: {
      project: {
        include: {
          client: true,
          portal: true
        }
      }
    }
  });

  if (!workRequest) {
    throw new Error("Work request not found");
  }

  if (workRequest.projectId && workRequest.project) {
    return {
      project: serializeProject(workRequest.project),
      workRequest: serializeWorkRequest(workRequest)
    };
  }

  const scopeType =
    workRequest.requestType === "project_brief"
      ? "discovery"
      : "standalone_quote";
  const serviceFamily = workRequest.serviceFamily || "hubspot_architecture";
  const owner = await resolveProjectOwner();
  const defaultTemplate = await prisma.deliveryTemplate.findFirst({
    where: {
      serviceFamily,
      scopeType,
      isActive: true
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });

  const clientName =
    workRequest.companyName?.trim() ||
    workRequest.portalOrWebsite?.trim() ||
    workRequest.contactName.trim();
  const clientSlug = createSlug(clientName);

  const client = await prisma.client.upsert({
    where: { slug: clientSlug },
    update: {
      name: clientName,
      website: workRequest.portalOrWebsite?.trim() || null
    },
    create: {
      name: clientName,
      slug: clientSlug,
      website: workRequest.portalOrWebsite?.trim() || null
    }
  });

  const portal = await prisma.hubSpotPortal.create({
    data: {
      portalId: createPendingPortalId(),
      displayName: clientName
    }
  });

  const project = await prisma.project.create({
    data: {
      name: workRequest.title,
      status: "draft",
      engagementType: "IMPLEMENTATION",
      owner: owner.owner,
      ownerEmail: owner.ownerEmail,
      serviceFamily,
      scopeType,
      deliveryTemplateId: defaultTemplate?.id ?? null,
      commercialBrief: [workRequest.summary, workRequest.details]
        .filter(Boolean)
        .join("\n\n"),
      selectedHubs:
        scopeType === "standalone_quote"
          ? inferDefaultHubsForServiceFamily(serviceFamily)
          : [],
      clientChampionFirstName: workRequest.contactName.split(/\s+/)[0] || null,
      clientChampionLastName:
        workRequest.contactName.split(/\s+/).slice(1).join(" ") || null,
      clientChampionEmail: workRequest.contactEmail,
      clientId: client.id,
      portalId: portal.id
    },
    include: {
      client: true,
      portal: true
    }
  });

  const updatedRequest = await prisma.workRequest.update({
    where: { id: requestId },
    data: {
      projectId: project.id,
      status: "converted"
    },
    include: {
      project: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  return {
    project: serializeProject(project),
    workRequest: serializeWorkRequest(updatedRequest)
  };
}

async function resolveProjectOwner(ownerName?: string, ownerEmail?: string) {
  const workspaceUsers = await loadWorkspaceUsers();
  const normalizedName = ownerName?.trim().toLowerCase() ?? "";
  const normalizedEmail = ownerEmail?.trim().toLowerCase() ?? "";
  const matchedOwner = workspaceUsers.find(
    (candidate) =>
      candidate.name.toLowerCase() === normalizedName ||
      candidate.email.toLowerCase() === normalizedEmail
  );

  if (matchedOwner) {
    return {
      owner: matchedOwner.name,
      ownerEmail: matchedOwner.email
    };
  }

  return {
    owner: ownerName?.trim() || workspaceUsers[0]?.name || "Muloo Operator",
    ownerEmail:
      ownerEmail?.trim() || workspaceUsers[0]?.email || "operator@muloo.com"
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    )
  );
}

function createSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function createPendingPortalId(): string {
  return `${pendingPortalPrefix}${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

async function deleteHubSpotPortalIfUnused(
  transaction: PrismaTransactionClient,
  portalId: string
) {
  const [remainingProjects, remainingClients] = await Promise.all([
    transaction.project.count({
      where: { portalId }
    }),
    transaction.client.count({
      where: { hubSpotPortalId: portalId }
    })
  ]);

  if (remainingProjects === 0 && remainingClients === 0) {
    await transaction.hubSpotPortal
      .delete({
        where: { id: portalId }
      })
      .catch(() => null);
  }
}

async function syncClientHubSpotPortal(
  transaction: PrismaTransactionClient,
  clientId: string,
  portalId: string
) {
  await Promise.all([
    transaction.client.update({
      where: { id: clientId },
      data: {
        hubSpotPortalId: portalId
      }
    }),
    transaction.project.updateMany({
      where: { clientId },
      data: {
        portalId
      }
    })
  ]);
}

async function resolveClientHubSpotPortal(
  transaction: PrismaTransactionClient,
  input: {
    clientId: string;
    clientName: string;
    requestedPortalId: string | undefined;
    fallbackPortalId: string | undefined;
  }
) {
  const client = await transaction.client.findUnique({
    where: { id: input.clientId },
    select: {
      hubSpotPortalId: true
    }
  });

  if (input.requestedPortalId !== undefined) {
    return input.requestedPortalId
      ? transaction.hubSpotPortal.upsert({
          where: { portalId: input.requestedPortalId },
          update: {},
          create: {
            portalId: input.requestedPortalId,
            displayName: input.clientName
          }
        })
      : transaction.hubSpotPortal.create({
          data: {
            portalId: createPendingPortalId(),
            displayName: input.clientName
          }
        });
  }

  if (client?.hubSpotPortalId) {
    const existingPortal = await transaction.hubSpotPortal.findUnique({
      where: { id: client.hubSpotPortalId }
    });

    if (existingPortal) {
      return existingPortal;
    }
  }

  if (input.fallbackPortalId) {
    const fallbackPortal = await transaction.hubSpotPortal.findUnique({
      where: { id: input.fallbackPortalId }
    });

    if (fallbackPortal) {
      return fallbackPortal;
    }
  }

  return transaction.hubSpotPortal.create({
    data: {
      portalId: createPendingPortalId(),
      displayName: input.clientName
    }
  });
}

function normalizeProject<T extends { portal: { portalId: string } | null }>(
  project: T
): T {
  return project.portal &&
    project.portal.portalId.startsWith(pendingPortalPrefix)
    ? ({ ...project, portal: null } as T)
    : project;
}

async function reconcileProjectClientPortal(projectId: string) {
  return prisma.$transaction(async (transaction) => {
    const project = await transaction.project.findUnique({
      where: { id: projectId },
      include: {
        client: true,
        portal: true
      }
    });

    if (!project) {
      return null;
    }

    const clientPortalId = project.client.hubSpotPortalId;
    const projectPortalIsPending = project.portal.portalId.startsWith(
      pendingPortalPrefix
    );

    if (clientPortalId && clientPortalId !== project.portalId) {
      const previousPortalId = project.portalId;

      await syncClientHubSpotPortal(transaction, project.clientId, clientPortalId);

      if (previousPortalId !== clientPortalId) {
        await deleteHubSpotPortalIfUnused(transaction, previousPortalId);
      }

      return transaction.project.findUnique({
        where: { id: projectId },
        include: {
          client: true,
          portal: true
        }
      });
    }

    if (!clientPortalId && !projectPortalIsPending) {
      await syncClientHubSpotPortal(transaction, project.clientId, project.portalId);

      return transaction.project.findUnique({
        where: { id: projectId },
        include: {
          client: true,
          portal: true
        }
      });
    }

    return project;
  });
}

function cloneClientQuestionnaireConfig(
  value: ClientQuestionnaireConfig
): ClientQuestionnaireConfig {
  return JSON.parse(JSON.stringify(value)) as ClientQuestionnaireConfig;
}

function createClientQuestionKey(label: string, fallbackIndex: number): string {
  const normalized = createSlug(label).replace(/-/g, "_");
  return normalized || `custom_question_${fallbackIndex}`;
}

function normalizeClientQuestionnaireConfig(
  value: unknown
): ClientQuestionnaireConfig {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const defaults = cloneClientQuestionnaireConfig(
    defaultClientQuestionnaireConfig
  );

  return [1, 2, 3, 4].reduce<ClientQuestionnaireConfig>(
    (config, sessionNumber) => {
      const rawSession = source[String(sessionNumber)] ?? source[sessionNumber];
      const defaultSession = defaults[sessionNumber] ?? defaults[1]!;
      if (
        !rawSession ||
        typeof rawSession !== "object" ||
        Array.isArray(rawSession)
      ) {
        config[sessionNumber] = defaultSession;
        return config;
      }

      const sessionRecord = rawSession as Record<string, unknown>;
      const usedKeys = new Set<string>();

      const questions = Array.isArray(sessionRecord.questions)
        ? sessionRecord.questions
            .filter(
              (question): question is Record<string, unknown> =>
                Boolean(question) &&
                typeof question === "object" &&
                !Array.isArray(question)
            )
            .map((question, index) => {
              const baseKey =
                typeof question.key === "string" &&
                question.key.trim().length > 0
                  ? question.key.trim()
                  : createClientQuestionKey(
                      typeof question.label === "string" ? question.label : "",
                      index + 1
                    );
              let key = baseKey;
              let suffix = 2;
              while (usedKeys.has(key)) {
                key = `${baseKey}_${suffix}`;
                suffix += 1;
              }
              usedKeys.add(key);

              return {
                key,
                label:
                  typeof question.label === "string" &&
                  question.label.trim().length > 0
                    ? question.label.trim()
                    : `Question ${index + 1}`,
                hint:
                  typeof question.hint === "string" ? question.hint.trim() : ""
              };
            })
        : [];

      config[sessionNumber] = {
        title:
          typeof sessionRecord.title === "string" &&
          sessionRecord.title.trim().length > 0
            ? sessionRecord.title.trim()
            : defaultSession.title,
        description:
          typeof sessionRecord.description === "string" &&
          sessionRecord.description.trim().length > 0
            ? sessionRecord.description.trim()
            : defaultSession.description,
        enabled:
          typeof sessionRecord.enabled === "boolean"
            ? sessionRecord.enabled
            : (defaultSession.enabled ?? true),
        questions: questions.length > 0 ? questions : defaultSession.questions
      };

      config[sessionNumber].questions = config[sessionNumber].questions.map(
        (question, index) => {
          const rawQuestion =
            Array.isArray(sessionRecord.questions) &&
            sessionRecord.questions[index] &&
            typeof sessionRecord.questions[index] === "object" &&
            !Array.isArray(sessionRecord.questions[index])
              ? (sessionRecord.questions[index] as Record<string, unknown>)
              : null;

          return {
            ...question,
            enabled:
              rawQuestion && typeof rawQuestion.enabled === "boolean"
                ? rawQuestion.enabled
                : true
          };
        }
      );

      return config;
    },
    {} as ClientQuestionnaireConfig
  );
}

function getEnabledClientInputSections(
  config: ClientQuestionnaireConfig
): number[] {
  return Object.entries(config)
    .map(([sessionNumberText, session]) => ({
      sessionNumber: Number(sessionNumberText),
      session
    }))
    .filter(
      ({ sessionNumber, session }) =>
        Number.isFinite(sessionNumber) &&
        session.enabled !== false &&
        session.questions.some((question) => question.enabled !== false)
    )
    .map(({ sessionNumber }) => sessionNumber)
    .sort((left, right) => left - right);
}

function normalizeAssignedInputSections(
  value: unknown,
  availableSections: number[]
): number[] {
  const requestedSections = Array.isArray(value)
    ? value
        .map((entry) =>
          typeof entry === "number" ? entry : Number.parseInt(String(entry), 10)
        )
        .filter((entry) => Number.isFinite(entry))
    : [];

  const normalizedSections = Array.from(
    new Set(
      requestedSections.filter((section) => availableSections.includes(section))
    )
  ).sort((left, right) => left - right);

  return normalizedSections.length > 0 ? normalizedSections : availableSections;
}

function resolveAssignedInputSectionsForAccess(input: {
  questionnaireAccess: boolean;
  assignedInputSections: number[];
  availableSections: number[];
}) {
  if (!input.questionnaireAccess) {
    return [];
  }

  return normalizeAssignedInputSections(
    input.assignedInputSections,
    input.availableSections
  );
}

function parseCookies(request: http.IncomingMessage): Record<string, string> {
  const cookieHeader = request.headers.cookie;

  if (!cookieHeader) {
    return {};
  }

  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf("=");
        if (separatorIndex === -1) {
          return [part, ""];
        }

        return [
          decodeURIComponent(part.slice(0, separatorIndex)),
          decodeURIComponent(part.slice(separatorIndex + 1))
        ];
      })
  );
}

export function createCookieHeader(
  value: string,
  options?: { maxAge?: number; name?: string }
) {
  const cookieParts = [
    `${options?.name ?? authCookieName}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax"
  ];

  if (options?.maxAge !== undefined) {
    cookieParts.push(`Max-Age=${options.maxAge}`);
  }

  return cookieParts.join("; ");
}

export function resolveSimpleAuthCredentials() {
  const username =
    process.env.SIMPLE_AUTH_USERNAME ?? defaultSimpleAuthUsername;
  const password =
    process.env.SIMPLE_AUTH_PASSWORD ?? defaultSimpleAuthPassword;

  if (!username.trim() || !password.trim()) {
    return null;
  }

  return {
    username: username.trim(),
    password: password.trim()
  };
}

function isBcryptHash(value: string | null | undefined) {
  return typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  inputPassword: string,
  storedPassword: string | null | undefined
) {
  if (!storedPassword) {
    return false;
  }

  if (isBcryptHash(storedPassword)) {
    return bcrypt.compare(inputPassword, storedPassword);
  }

  return storedPassword === inputPassword;
}

export function createSimpleAuthToken(username: string) {
  const secret =
    process.env.SIMPLE_AUTH_SECRET ?? "muloo-deploy-os-internal-auth";

  return Buffer.from(`${username}:${secret}`).toString("base64url");
}

export function createWorkspaceUserAuthToken(userId: string) {
  const secret =
    process.env.SIMPLE_AUTH_SECRET ?? "muloo-deploy-os-internal-auth";

  return Buffer.from(`workspace-user:${userId}:${secret}`).toString(
    "base64url"
  );
}

export function createClientAuthToken(userId: string) {
  const secret =
    process.env.CLIENT_AUTH_SECRET ?? "muloo-deploy-os-client-auth";

  return Buffer.from(`${userId}:${secret}`).toString("base64url");
}

function createSignedStateToken(value: Record<string, unknown>) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = crypto
    .createHmac(
      "sha256",
      process.env.GOOGLE_OAUTH_STATE_SECRET ??
        process.env.CLIENT_AUTH_SECRET ??
        "muloo-google-oauth-state"
    )
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function verifySignedStateToken(value: string) {
  const [payload, signature] = value.split(".");

  if (!payload || !signature) {
    throw new Error("Invalid OAuth state");
  }

  const expectedSignature = crypto
    .createHmac(
      "sha256",
      process.env.GOOGLE_OAUTH_STATE_SECRET ??
        process.env.CLIENT_AUTH_SECRET ??
        "muloo-google-oauth-state"
    )
    .update(payload)
    .digest("base64url");

  if (signature !== expectedSignature) {
    throw new Error("Invalid OAuth state");
  }

  const decoded = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8")
  ) as Record<string, unknown>;

  if (typeof decoded.expiresAt !== "number" || decoded.expiresAt < Date.now()) {
    throw new Error("OAuth state has expired");
  }

  return decoded;
}

function getAuthenticatedWorkspaceUserId(request: http.IncomingMessage) {
  const cookies = parseCookies(request);
  const token = cookies[authCookieName];

  if (!token) {
    return null;
  }

  const secret =
    process.env.SIMPLE_AUTH_SECRET ?? "muloo-deploy-os-internal-auth";

  try {
    const [tokenType, userId, tokenSecret] = Buffer.from(token, "base64url")
      .toString("utf8")
      .split(":");

    if (
      tokenType !== "workspace-user" ||
      !userId?.trim() ||
      tokenSecret !== secret
    ) {
      return null;
    }

    return userId.trim();
  } catch {
    return null;
  }
}

function humanizeTokenLabel(value: string) {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

function normalizeStoredProjectAgenda(value: unknown) {
  const parsed = projectAgendaRecordSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function isAuthenticated(request: http.IncomingMessage) {
  const cookies = parseCookies(request);
  const credentials = resolveSimpleAuthCredentials();
  const token = cookies[authCookieName];

  if (!token) {
    return false;
  }

  if (credentials && token === createSimpleAuthToken(credentials.username)) {
    return true;
  }

  const workspaceUserId = getAuthenticatedWorkspaceUserId(request);

  if (!workspaceUserId) {
    return false;
  }

  const workspaceUser = await prisma.workspaceUser
    .findUnique({
      where: { id: workspaceUserId },
      select: { isActive: true }
    })
    .catch(() => null);

  return Boolean(workspaceUser?.isActive);
}

export async function resolveInternalActor(
  request: http.IncomingMessage
): Promise<{ actor: string; userId?: string | null }> {
  const userId = getAuthenticatedWorkspaceUserId(request);

  if (userId) {
    const user = await prisma.workspaceUser.findUnique({
      where: { id: userId },
      select: { id: true, email: true }
    });

    if (user) {
      return { actor: user.email, userId: user.id };
    }
  }

  const credentials = resolveSimpleAuthCredentials();
  if (
    credentials &&
    parseCookies(request)[authCookieName] ===
      createSimpleAuthToken(credentials.username)
  ) {
    return { actor: credentials.username, userId: null };
  }

  return { actor: "system", userId: null };
}

export async function audit(
  actor: string,
  action: string,
  entityType: string,
  entityId: string,
  opts?: {
    before?: object | null;
    after?: object | null;
    metadata?: object | null;
    projectId?: string | null;
  }
) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  try {
    await prisma.auditLog.create({
      data: {
        actor,
        action,
        entityType,
        entityId,
        ...(opts?.before ? { before: opts.before } : {}),
        ...(opts?.after ? { after: opts.after } : {}),
        ...(opts?.metadata ? { metadata: opts.metadata } : {}),
        ...(opts?.projectId ? { projectId: opts.projectId } : {})
      }
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("Audit log write skipped.", error);
    }
  }
}

export function getAuthenticatedClientUserId(request: http.IncomingMessage) {
  const cookies = parseCookies(request);
  const token = cookies[clientAuthCookieName];

  if (!token) {
    return null;
  }

  try {
    const [userId, secret] = Buffer.from(token, "base64url")
      .toString("utf8")
      .split(":");

    if (
      !userId ||
      secret !==
        (process.env.CLIENT_AUTH_SECRET ?? "muloo-deploy-os-client-auth")
    ) {
      return null;
    }

    return userId;
  } catch {
    return null;
  }
}

function emptyDiscoverySessions(): Record<number, DiscoverySessionFields> {
  return {
    1: {},
    2: {},
    3: {},
    4: {}
  };
}

function normalizeDiscoveryFields(value: unknown): DiscoverySessionFields {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(
      ([key, fieldValue]) => [
        key,
        typeof fieldValue === "string" ? fieldValue : ""
      ]
    )
  );
}

function normalizeDiscoverySessionFields(
  sessionNumber: number,
  value: unknown
): DiscoverySessionFields {
  const normalizedFields = normalizeDiscoveryFields(value);
  const allowedFields =
    sessionFieldLabels[sessionNumber] ?? sessionFieldLabels[1] ?? [];

  return Object.fromEntries(
    allowedFields.map((fieldName) => [
      fieldName,
      normalizedFields[fieldName] ?? ""
    ])
  );
}

function buildDiscoverySessions(
  submissions: Array<{ version: number; sections: unknown }>
): Record<number, DiscoverySessionFields> {
  const sessions = emptyDiscoverySessions();

  for (const submission of submissions) {
    if (submission.version >= 1 && submission.version <= 4) {
      sessions[submission.version] = normalizeDiscoveryFields(
        submission.sections
      );
    }
  }

  return sessions;
}

function getDiscoverySessionStatus(
  fields: DiscoverySessionFields
): DiscoverySessionStatus {
  const values = Object.values(fields).map((value) => value.trim());

  if (values.length === 0 || values.every((value) => value.length === 0)) {
    return "draft";
  }

  return values.every((value) => value.length > 0) ? "complete" : "in_progress";
}

function getCompletedDiscoverySections(
  fields: DiscoverySessionFields
): string[] {
  return Object.entries(fields)
    .filter(([, value]) => value.trim().length > 0)
    .map(([key]) => key);
}

function getDiscoverySessionStatusFromSubmission(
  submission?: {
    status?: string;
    completedSections?: string[];
    sections?: unknown;
  } | null
): DiscoverySessionStatus {
  const fields = normalizeDiscoveryFields(submission?.sections);
  const derivedStatus = getDiscoverySessionStatus(fields);

  if (derivedStatus === "complete") {
    return "complete";
  }

  if (
    derivedStatus === "in_progress" ||
    (submission?.completedSections?.length ?? 0) > 0
  ) {
    return "in_progress";
  }

  return "draft";
}

function buildDiscoverySessionsWithStatus(
  submissions: Array<{
    version: number;
    status: string;
    sections: unknown;
    completedSections?: string[];
  }>
) {
  return [1, 2, 3, 4].map((sessionNumber) => {
    const submission = submissions.find(
      (candidate) => candidate.version === sessionNumber
    );
    const fields = normalizeDiscoveryFields(submission?.sections);

    return {
      session: sessionNumber,
      title: sessionTitles[sessionNumber] ?? `Session ${sessionNumber}`,
      status: getDiscoverySessionStatusFromSubmission(submission),
      fields
    };
  });
}

function serializeProject<
  T extends {
    id: string;
    name: string;
    status: string;
    quoteApprovalStatus?: string | null;
    quoteSharedAt?: Date | null;
    quoteApprovedAt?: Date | null;
    quoteApprovedByName?: string | null;
    quoteApprovedByEmail?: string | null;
    scopeLockedAt?: Date | null;
    owner: string;
    ownerEmail: string;
    serviceFamily: string;
    implementationApproach?: string | null;
    customerPlatformTier?: string | null;
    platformTierSelections?: unknown | null;
    problemStatement?: string | null;
    solutionRecommendation?: string | null;
    scopeExecutiveSummary?: string | null;
    clientQuestionnaireConfig?: unknown | null;
    scopeType?: string | null;
    deliveryTemplateId?: string | null;
    commercialBrief?: string | null;
    lastAgenda?: unknown | null;
    clientChampionFirstName?: string | null;
    clientChampionLastName?: string | null;
    clientChampionEmail?: string | null;
    selectedHubs: string[];
    engagementType: Prisma.$Enums.EngagementType;
    includesPortalAudit?: boolean;
    portalQuoteEnabled?: boolean | null;
    createdAt: Date;
    updatedAt: Date;
    client: {
      id: string;
      name: string;
      slug: string;
      industry: string | null;
      region: string | null;
      website: string | null;
      additionalWebsites: string[];
      linkedinUrl: string | null;
      facebookUrl: string | null;
      instagramUrl: string | null;
      xUrl: string | null;
      youtubeUrl: string | null;
    };
    portal: {
      id: string;
      portalId: string;
      displayName: string;
      region: string | null;
      connected: boolean;
      connectedEmail: string | null;
      connectedName: string | null;
      hubDomain: string | null;
      installedAt: Date | null;
    } | null;
  }
>(project: T) {
  const normalizedProject = normalizeProject(project);
  const defaultWorkspacePath =
    normalizedProject.engagementType === "AUDIT" ||
    normalizedProject.engagementType === "OPTIMISATION" ||
    normalizedProject.engagementType === "GUIDED_DEPLOYMENT"
      ? `/projects/${normalizedProject.id}/prepare`
      : `/projects/${normalizedProject.id}`;
  const packagingAssessment = derivePlatformPackagingAssessment({
    selectedHubs: normalizedProject.selectedHubs,
    implementationApproach: normalizedProject.implementationApproach,
    customerPlatformTier: normalizedProject.customerPlatformTier,
    platformTierSelections: normalizePlatformTierSelections(
      normalizedProject.platformTierSelections
    ),
    evidenceText: [
      normalizedProject.problemStatement ?? "",
      normalizedProject.solutionRecommendation ?? "",
      normalizedProject.scopeExecutiveSummary ?? "",
      normalizedProject.commercialBrief ?? "",
      normalizedProject.client.industry ?? "",
      normalizedProject.client.website ?? ""
    ].join(" \n")
  });

  return {
    ...normalizedProject,
    quoteApprovalStatus: normalizedProject.quoteApprovalStatus ?? "draft",
    quoteSharedAt: normalizedProject.quoteSharedAt?.toISOString() ?? null,
    quoteApprovedAt: normalizedProject.quoteApprovedAt?.toISOString() ?? null,
    quoteApprovedByName: normalizedProject.quoteApprovedByName ?? null,
    quoteApprovedByEmail: normalizedProject.quoteApprovedByEmail ?? null,
    scopeLockedAt: normalizedProject.scopeLockedAt?.toISOString() ?? null,
    clientQuestionnaireConfig: normalizeClientQuestionnaireConfig(
      normalizedProject.clientQuestionnaireConfig
    ),
    platformTierSelections: normalizePlatformTierSelections(
      normalizedProject.platformTierSelections
    ),
    packagingAssessment,
    clientName: normalizedProject.client.name,
    hubsInScope: normalizedProject.selectedHubs,
    lastAgenda: normalizeStoredProjectAgenda(normalizedProject.lastAgenda),
    defaultWorkspacePath,
    portalQuoteEnabled: normalizedProject.portalQuoteEnabled !== false
  };
}

function serializeClientProject<
  T extends {
    id: string;
    name: string;
    status: string;
    quoteApprovalStatus?: string | null;
    quoteSharedAt?: Date | null;
    quoteApprovedAt?: Date | null;
    quoteApprovedByName?: string | null;
    quoteApprovedByEmail?: string | null;
    scopeLockedAt?: Date | null;
    serviceFamily: string;
    scopeType?: string | null;
    deliveryTemplateId?: string | null;
    commercialBrief?: string | null;
    clientQuestionnaireConfig?: unknown | null;
    engagementType: Prisma.$Enums.EngagementType;
    selectedHubs: string[];
    updatedAt: Date;
    portalQuoteEnabled?: boolean | null;
    client: {
      name: string;
      website: string | null;
    };
  }
>(project: T) {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    quoteApprovalStatus: project.quoteApprovalStatus ?? "draft",
    quoteSharedAt: project.quoteSharedAt?.toISOString() ?? null,
    quoteApprovedAt: project.quoteApprovedAt?.toISOString() ?? null,
    quoteApprovedByName: project.quoteApprovedByName ?? null,
    quoteApprovedByEmail: project.quoteApprovedByEmail ?? null,
    scopeLockedAt: project.scopeLockedAt?.toISOString() ?? null,
    serviceFamily: project.serviceFamily,
    scopeType: project.scopeType ?? "discovery",
    deliveryTemplateId: project.deliveryTemplateId ?? null,
    commercialBrief: project.commercialBrief ?? null,
    clientQuestionnaireConfig: normalizeClientQuestionnaireConfig(
      project.clientQuestionnaireConfig
    ),
    engagementType: project.engagementType,
    selectedHubs: project.selectedHubs,
    updatedAt: project.updatedAt.toISOString(),
    portalQuoteEnabled: project.portalQuoteEnabled !== false,
    client: {
      name: project.client.name,
      website: project.client.website
    }
  };
}

function humanizePortalValue(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatPortalHubList(hubs: string[]) {
  if (hubs.length === 0) {
    return "the selected HubSpot setup";
  }

  return hubs.map((hub) => humanizePortalValue(hub)).join(", ");
}

type PortalSummaryStep = {
  title: string;
  detail: string;
  owner: string;
};

type PortalProjectSummary = {
  headline: string;
  summary: string;
  currentPhaseLabel: string;
  currentPhaseDetail: string;
  progressLabel: string;
  progressDetail: string;
  waitingOnLabel: string;
  nextSteps: PortalSummaryStep[];
  lastUpdatedAt: string;
};

function buildPortalProjectSummary(input: {
  project: {
    name: string;
    status: string;
    quoteApprovalStatus?: string | null;
    commercialBrief?: string | null;
    engagementType: Prisma.$Enums.EngagementType;
    selectedHubs: string[];
    updatedAt: Date;
    client: {
      name: string;
    };
  };
  assignedInputSections: number[];
  submissions: Array<{
    sessionNumber: number;
    status: string;
  }>;
  tasks: Array<{
    title: string;
    status: string;
    description: string | null;
  }>;
}): PortalProjectSummary {
  const quoteApprovalStatus = input.project.quoteApprovalStatus ?? "draft";
  const totalTasks = input.tasks.length;
  const completedTasks = input.tasks.filter((task) => task.status === "done").length;
  const openTasks = input.tasks.filter((task) => task.status !== "done");
  const inProgressTasks = input.tasks.filter((task) =>
    ["in_progress", "todo", "backlog"].includes(task.status)
  );
  const blockedTasks = input.tasks.filter((task) => task.status === "blocked");
  const waitingOnClientTasks = input.tasks.filter(
    (task) => task.status === "waiting_on_client"
  );
  const incompleteInputSections = input.assignedInputSections.filter((section) => {
    const submission = input.submissions.find(
      (candidate) => candidate.sessionNumber === section
    );

    return submission?.status !== "complete";
  });

  let currentPhaseLabel = "Project underway";
  let currentPhaseDetail =
    "Muloo is managing the current phase of delivery for this project.";

  if (input.project.status === "complete") {
    currentPhaseLabel = "Completed";
    currentPhaseDetail =
      "The planned work for this project has been completed and is ready for review or follow-up support.";
  } else if (quoteApprovalStatus === "shared") {
    currentPhaseLabel = "Quote review";
    currentPhaseDetail =
      "The commercial scope is ready for review before the next delivery phase begins.";
  } else if (
    ["draft", "scoping", "designed"].includes(input.project.status)
  ) {
    currentPhaseLabel = "Scoping & planning";
    currentPhaseDetail =
      "Muloo is shaping the project scope, inputs, and recommended delivery path.";
  } else if (input.project.status === "ready-for-execution") {
    currentPhaseLabel = "Ready for execution";
    currentPhaseDetail =
      "The plan is prepared and the project is being lined up for active delivery.";
  } else if (
    ["active", "in_progress", "in-flight"].includes(input.project.status)
  ) {
    currentPhaseLabel = "Delivery in progress";
    currentPhaseDetail =
      "Muloo is actively progressing the approved scope and tracking delivery through the portal.";
  } else if (input.project.status === "on_hold") {
    currentPhaseLabel = "On hold";
    currentPhaseDetail =
      "This project is paused for now. Use Messages if you need clarity on what is blocking the next step.";
  }

  const summary =
    input.project.commercialBrief?.trim() ||
    `This ${humanizePortalValue(
      input.project.engagementType
    ).toLowerCase()} project for ${input.project.client.name} is focused on ${formatPortalHubList(
      input.project.selectedHubs
    )}. Use this portal to follow progress, review scope, and see what happens next.`;

  let progressLabel = "Project setup in progress";
  let progressDetail =
    "Muloo is preparing the next stage of work and will surface progress here as the project advances.";

  if (totalTasks > 0) {
    progressLabel = `${completedTasks} of ${totalTasks} delivery items complete`;
    progressDetail =
      openTasks.length > 0
        ? `${openTasks.length} delivery item${
            openTasks.length === 1 ? "" : "s"
          } still active or queued in the current plan.`
        : "All delivery items currently on the board have been completed.";
  } else if (quoteApprovalStatus === "shared") {
    progressLabel = "Waiting for quote approval";
    progressDetail =
      "Delivery planning is ready, but approval is needed before the scope can move fully into execution.";
  } else if (incompleteInputSections.length > 0) {
    progressLabel = "Waiting for project inputs";
    progressDetail =
      "Muloo is collecting the remaining project inputs needed to shape the delivery plan.";
  }

  let waitingOnLabel = "Muloo";
  if (quoteApprovalStatus === "shared") {
    waitingOnLabel = "Your team";
  } else if (
    incompleteInputSections.length > 0 ||
    waitingOnClientTasks.length > 0
  ) {
    waitingOnLabel = "Your team";
  } else if (input.project.status === "complete") {
    waitingOnLabel = "No immediate action";
  }

  const nextSteps: PortalSummaryStep[] = [];

  if (quoteApprovalStatus === "shared") {
    nextSteps.push({
      title: "Review the shared quote",
      detail:
        "Check the scope and commercial breakdown in the portal, then approve it if it matches what your team is expecting.",
      owner: "Your team"
    });
  }

  if (incompleteInputSections.length > 0) {
    nextSteps.push({
      title: "Complete the remaining project inputs",
      detail: `Finish the open input section${
        incompleteInputSections.length === 1 ? "" : "s"
      } so Muloo can finalize the next stage cleanly.`,
      owner: "Your team"
    });
  }

  waitingOnClientTasks.slice(0, 2).forEach((task) => {
    nextSteps.push({
      title: task.title,
      detail:
        task.description?.trim() ||
        "This item is waiting on a response or input from your team before Muloo can move it forward.",
      owner: "Your team"
    });
  });

  if (nextSteps.length < 3) {
    inProgressTasks.slice(0, 3 - nextSteps.length).forEach((task) => {
      nextSteps.push({
        title: `Muloo is progressing: ${task.title}`,
        detail:
          task.description?.trim() ||
          "This delivery item is actively being worked on inside the current plan.",
        owner: "Muloo"
      });
    });
  }

  if (nextSteps.length === 0 && blockedTasks.length > 0) {
    nextSteps.push({
      title: "Muloo is working through a blocker",
      detail:
        blockedTasks[0]?.description?.trim() ||
        "The next delivery step is currently blocked. Use Messages if you want an update on what is being resolved.",
      owner: "Muloo"
    });
  }

  if (nextSteps.length === 0 && input.project.status === "complete") {
    nextSteps.push({
      title: "Review completed outputs",
      detail:
        "Check the delivered work and use Messages or Support if you want to request refinements or follow-on work.",
      owner: "Your team"
    });
  }

  if (nextSteps.length === 0) {
    nextSteps.push({
      title: "Stay aligned through the portal",
      detail:
        "Use Messages to ask questions and the Delivery tab to follow the latest progress as the project moves forward.",
      owner: "Shared"
    });
  }

  return {
    headline: `${input.project.name} overview`,
    summary,
    currentPhaseLabel,
    currentPhaseDetail,
    progressLabel,
    progressDetail,
    waitingOnLabel,
    nextSteps,
    lastUpdatedAt: input.project.updatedAt.toISOString()
  };
}

function serializeClientContact<
  T extends {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
    title: string | null;
    canApproveQuotes: boolean;
    createdAt: Date;
    updatedAt: Date;
  }
>(contact: T) {
  return {
    id: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName ?? "",
    email: contact.email,
    title: contact.title ?? "",
    canApproveQuotes: contact.canApproveQuotes,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString()
  };
}

function normalizeClientRoleTags(value: unknown) {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]+/)
      : [];

  const normalizedValues = Array.from(
    new Set(
      values
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry): entry is (typeof clientRoleTagOptions)[number] =>
          (clientRoleTagOptions as readonly string[]).includes(entry)
        )
    )
  );

  return normalizedValues.length > 0 ? normalizedValues : ["client"];
}

function normalizeClientRegion(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  return trimmedValue;
}

function normalizeClientVisibilityIds(value: unknown) {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]+/)
      : [];

  return Array.from(
    new Set(
      values
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

function normalizeWebsiteUrl(value: string | null | undefined) {
  const trimmedValue = value?.trim() ?? "";

  if (!trimmedValue) {
    return "";
  }

  return /^https?:\/\//i.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractMetaContent(
  html: string,
  attributeName: "name" | "property",
  attributeValue: string
) {
  const pattern = new RegExp(
    `<meta[^>]+${attributeName}=["']${attributeValue}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const reversePattern = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+${attributeName}=["']${attributeValue}["'][^>]*>`,
    "i"
  );

  const match = pattern.exec(html) ?? reversePattern.exec(html);
  return match?.[1]?.trim() ?? "";
}

function extractLinkHref(html: string, relValue: string) {
  const pattern = new RegExp(
    `<link[^>]+rel=["'][^"']*${relValue}[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const reversePattern = new RegExp(
    `<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*${relValue}[^"']*["'][^>]*>`,
    "i"
  );
  const match = pattern.exec(html) ?? reversePattern.exec(html);
  return match?.[1]?.trim() ?? "";
}

function resolveUrlFromPage(baseUrl: string, value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return "";
  }

  try {
    return new URL(trimmedValue, baseUrl).toString();
  } catch {
    return trimmedValue;
  }
}

function extractSocialLinksFromHtml(html: string, baseUrl: string) {
  const links = Array.from(
    html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi),
    (match) => resolveUrlFromPage(baseUrl, match[1] ?? "")
  ).filter(Boolean);

  const pick = (patterns: string[]) =>
    links.find((link) =>
      patterns.some((pattern) => link.toLowerCase().includes(pattern))
    ) ?? "";

  return {
    linkedinUrl: pick(["linkedin.com"]),
    facebookUrl: pick(["facebook.com"]),
    instagramUrl: pick(["instagram.com"]),
    xUrl: pick(["x.com/", "twitter.com/"]),
    youtubeUrl: pick(["youtube.com/", "youtu.be/"])
  };
}

async function fetchClientWebsiteEnrichment(client: {
  website: string | null;
  additionalWebsites: string[];
}) {
  const candidateUrls = [
    normalizeWebsiteUrl(client.website),
    ...client.additionalWebsites.map((website) => normalizeWebsiteUrl(website))
  ].filter(Boolean);

  const targetUrl = candidateUrls[0] ?? "";
  if (!targetUrl) {
    throw new Error("Add a website before refreshing enrichment");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MulooDeployOS/1.0; +https://deploy.wearemuloo.com)"
      },
      redirect: "follow",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Website returned status ${response.status}`);
    }

    const html = await response.text();
    const finalUrl = response.url || targetUrl;
    const titleMatch = /<title[^>]*>(.*?)<\/title>/is.exec(html);
    const title = stripHtml(titleMatch?.[1] ?? "");
    const companyOverview =
      extractMetaContent(html, "property", "og:description") ||
      extractMetaContent(html, "name", "description") ||
      extractMetaContent(html, "name", "twitter:description") ||
      stripHtml(/<p[^>]*>(.*?)<\/p>/is.exec(html)?.[1] ?? "");
    const enrichedLogoUrl = resolveUrlFromPage(
      finalUrl,
      extractMetaContent(html, "property", "og:image") ||
        extractMetaContent(html, "name", "twitter:image") ||
        extractLinkHref(html, "apple-touch-icon") ||
        extractLinkHref(html, "icon")
    );
    const socialLinks = extractSocialLinksFromHtml(html, finalUrl);

    return {
      finalUrl,
      title,
      companyOverview: companyOverview || null,
      enrichedLogoUrl: enrichedLogoUrl || null,
      ...socialLinks
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Website enrichment timed out");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function mergeClientEnrichmentFields<
  T extends {
    linkedinUrl: string | null;
    facebookUrl: string | null;
    instagramUrl: string | null;
    xUrl: string | null;
    youtubeUrl: string | null;
  }
>(
  client: T,
  enrichment: {
    companyOverview: string | null;
    enrichedLogoUrl: string | null;
    linkedinUrl: string;
    facebookUrl: string;
    instagramUrl: string;
    xUrl: string;
    youtubeUrl: string;
  }
) {
  return {
    companyOverview: enrichment.companyOverview,
    enrichedLogoUrl: enrichment.enrichedLogoUrl,
    linkedinUrl: client.linkedinUrl?.trim() || enrichment.linkedinUrl || null,
    facebookUrl: client.facebookUrl?.trim() || enrichment.facebookUrl || null,
    instagramUrl:
      client.instagramUrl?.trim() || enrichment.instagramUrl || null,
    xUrl: client.xUrl?.trim() || enrichment.xUrl || null,
    youtubeUrl: client.youtubeUrl?.trim() || enrichment.youtubeUrl || null,
    lastEnrichedAt: new Date()
  };
}

function serializeClientDirectoryRecord<
  T extends {
    id: string;
    name: string;
    slug: string;
    clientRoles: string[];
    parentClientId: string | null;
    hubSpotPortalId?: string | null;
    industry: string | null;
    region: string | null;
    website: string | null;
    logoUrl: string | null;
    enrichedLogoUrl: string | null;
    companyOverview: string | null;
    additionalWebsites: string[];
    linkedinUrl: string | null;
    facebookUrl: string | null;
    instagramUrl: string | null;
    xUrl: string | null;
    youtubeUrl: string | null;
    lastEnrichedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    parentClient?: { id: string; name: string } | null;
    childClients?: Array<{ id: string; name: string }>;
    visibleToPartners?: Array<{ partnerClient: { id: string; name: string } }>;
    visibleClients?: Array<{ client: { id: string; name: string } }>;
    hubSpotPortal?: {
      id: string;
      portalId: string;
      displayName: string;
      region: string | null;
      connected: boolean;
      connectedEmail: string | null;
      connectedName: string | null;
      hubDomain: string | null;
      tokenExpiresAt: Date | null;
      installedAt: Date | null;
      updatedAt: Date;
      createdAt: Date;
    } | null;
  }
>(client: T) {
  return {
    id: client.id,
    name: client.name,
    slug: client.slug,
    clientRoles: client.clientRoles,
    parentClientId: client.parentClientId ?? null,
    parentClientName: client.parentClient?.name ?? null,
    hubSpotPortalId: client.hubSpotPortalId ?? null,
    hubSpotPortal: client.hubSpotPortal
      ? serializeHubSpotPortal(client.hubSpotPortal)
      : null,
    industry: client.industry,
    region: client.region,
    website: client.website,
    logoUrl: client.logoUrl,
    enrichedLogoUrl: client.enrichedLogoUrl,
    companyOverview: client.companyOverview,
    additionalWebsites: client.additionalWebsites,
    linkedinUrl: client.linkedinUrl,
    facebookUrl: client.facebookUrl,
    instagramUrl: client.instagramUrl,
    xUrl: client.xUrl,
    youtubeUrl: client.youtubeUrl,
    lastEnrichedAt: client.lastEnrichedAt?.toISOString() ?? null,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
    childClients:
      client.childClients?.map((childClient) => ({
        id: childClient.id,
        name: childClient.name
      })) ?? [],
    visibleToPartners:
      client.visibleToPartners?.map((record) => ({
        id: record.partnerClient.id,
        name: record.partnerClient.name
      })) ?? [],
    visibleClients:
      client.visibleClients?.map((record) => ({
        id: record.client.id,
        name: record.client.name
      })) ?? []
  };
}

const projectQuotePhaseTaskSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["Agent", "Human", "Client"]),
  effortHours: z.number().finite().nonnegative()
});

const projectQuotePhaseLineSchema = z.object({
  phase: z.number().int().positive(),
  phaseName: z.string().min(1),
  included: z.boolean(),
  humanHours: z.number().finite().nonnegative(),
  rate: z.number().finite().nonnegative(),
  feeZar: z.number().finite().nonnegative(),
  tasks: z.array(projectQuotePhaseTaskSchema)
});

const projectQuoteProductLineSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  billingModel: z.string().min(1),
  description: z.string().nullable().optional(),
  unitLabel: z.string().min(1),
  quantity: z.number().finite().positive(),
  unitPrice: z.number().finite().positive(),
  lineTotalZar: z.number().finite().nonnegative()
});

const projectQuoteTotalsSchema = z.object({
  totalHumanHours: z.number().finite().nonnegative(),
  totalFeeZar: z.number().finite().nonnegative(),
  additionalProductsTotalZar: z.number().finite().nonnegative(),
  grandTotalZar: z.number().finite().nonnegative(),
  paymentAmountZar: z.number().finite().nonnegative()
});

const projectQuoteContextSchema = z.object({
  quoteContextSummary: z.string().nullable(),
  inScopeItems: z.array(z.string()),
  outOfScopeItems: z.array(z.string()),
  supportingTools: z.array(z.string()),
  keyRisks: z.array(z.string()),
  nextQuestions: z.array(z.string()),
  clientResponsibilities: z.array(z.string()),
  isStandaloneQuote: z.boolean(),
  blueprintGeneratedAt: z.string().nullable()
});

const projectQuotePayloadSchema = z.object({
  currency: z.enum(["ZAR", "GBP", "EUR", "USD", "AUD"]),
  defaultRate: z.number().finite().positive(),
  phaseLines: z.array(projectQuotePhaseLineSchema),
  productLines: z.array(projectQuoteProductLineSchema),
  totals: projectQuoteTotalsSchema,
  paymentSchedule: z.array(z.string().min(1)).min(1),
  context: projectQuoteContextSchema
});

function serializeProjectQuote<
  T extends {
    id: string;
    projectId: string;
    version: number;
    status: string;
    currency: string;
    defaultRate: number | null;
    phaseLines: Prisma.Prisma.JsonValue;
    productLines: Prisma.Prisma.JsonValue;
    totals: Prisma.Prisma.JsonValue;
    paymentSchedule: Prisma.Prisma.JsonValue;
    context: Prisma.Prisma.JsonValue | null;
    sharedAt: Date;
    approvedAt: Date | null;
    approvedByName: string | null;
    approvedByEmail: string | null;
    createdAt: Date;
    updatedAt: Date;
  }
>(quote: T) {
  return {
    id: quote.id,
    projectId: quote.projectId,
    version: quote.version,
    status: quote.status,
    currency: quote.currency,
    defaultRate: quote.defaultRate ?? null,
    phaseLines: z.array(projectQuotePhaseLineSchema).parse(quote.phaseLines),
    productLines: z
      .array(projectQuoteProductLineSchema)
      .parse(quote.productLines),
    totals: projectQuoteTotalsSchema.parse(quote.totals),
    paymentSchedule: z.array(z.string()).parse(quote.paymentSchedule),
    context:
      quote.context === null
        ? null
        : projectQuoteContextSchema.parse(quote.context),
    sharedAt: quote.sharedAt.toISOString(),
    approvedAt: quote.approvedAt?.toISOString() ?? null,
    approvedByName: quote.approvedByName ?? null,
    approvedByEmail: quote.approvedByEmail ?? null,
    createdAt: quote.createdAt.toISOString(),
    updatedAt: quote.updatedAt.toISOString()
  };
}

async function loadLatestProjectQuote(projectId: string, statuses?: string[]) {
  const quote = await prisma.projectQuote.findFirst({
    where: {
      projectId,
      ...(statuses?.length ? { status: { in: statuses } } : {})
    },
    orderBy: [{ version: "desc" }]
  });

  return quote ? serializeProjectQuote(quote) : null;
}

export function serializeClientPortalUser<
  T extends {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    inviteAcceptedAt?: Date | null;
  }
>(user: T) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    authStatus: user.inviteAcceptedAt ? "active" : "invite_pending"
  };
}

function serializeClientInputSubmission<
  T extends {
    id: string;
    projectId: string;
    userId: string;
    sessionNumber: number;
    status: string;
    answers: unknown;
    createdAt: Date;
    updatedAt: Date;
  }
>(submission: T) {
  return {
    id: submission.id,
    projectId: submission.projectId,
    userId: submission.userId,
    sessionNumber: submission.sessionNumber,
    status: submission.status,
    answers:
      submission.answers && typeof submission.answers === "object"
        ? submission.answers
        : {},
    createdAt: submission.createdAt.toISOString(),
    updatedAt: submission.updatedAt.toISOString()
  };
}

function serializeProjectMessage<
  T extends {
    id: string;
    projectId: string;
    senderType: string;
    senderName: string;
    body: string;
    internalSeenAt?: Date | null;
    clientSeenAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }
>(message: T) {
  return {
    id: message.id,
    projectId: message.projectId,
    senderType: message.senderType,
    senderName: message.senderName,
    body: message.body,
    internalSeenAt: message.internalSeenAt?.toISOString() ?? null,
    clientSeenAt: message.clientSeenAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString()
  };
}

function isProjectScopeLocked(value: {
  quoteApprovalStatus?: string | null;
  scopeLockedAt?: Date | string | null;
}) {
  return (
    value.quoteApprovalStatus === "approved" || Boolean(value.scopeLockedAt)
  );
}

function deriveTaskExecutionPath(input: {
  title: string;
  description: string | null;
  category: string | null;
  executionType: string;
  assigneeType: string | null;
}) {
  const searchableText = [
    input.title,
    input.description ?? "",
    input.category ?? "",
    input.executionType
  ]
    .join(" ")
    .toLowerCase();

  if ((input.assigneeType ?? "").toLowerCase() === "client") {
    return {
      lane: "client_input",
      label: "Client input",
      summary:
        "Best handled in the client portal or through direct client follow-up.",
      apiEligible: false,
      directActions: [] as string[],
      notes: [
        "Keep this as a client-owned dependency rather than agent execution."
      ]
    };
  }

  if (
    includesAny(searchableText, [
      "property",
      "properties",
      "field",
      "fields",
      "custom object",
      "object schema",
      "pipeline",
      "stage",
      "record",
      "association"
    ])
  ) {
    return {
      lane: "direct_api",
      label: "Direct API",
      summary:
        "This work is a good fit for deterministic HubSpot API execution.",
      apiEligible: true,
      directActions: [
        "create_property_group",
        "create_property",
        "create_custom_object",
        "create_pipeline",
        "upsert_record"
      ],
      notes: [
        "Use the connected HubSpot portal and prefer dry-run before live execution."
      ]
    };
  }

  if (
    includesAny(searchableText, [
      "workflow",
      "automation",
      "nurture",
      "sequence",
      "enrollment",
      "trigger"
    ])
  ) {
    return {
      lane: "workflow_bridge",
      label: "Workflow bridge",
      summary:
        "Best delivered through reviewed workflow design, custom workflow actions, or custom code actions.",
      apiEligible: false,
      directActions: [],
      notes: [
        "Treat this as review-first work rather than direct API execution."
      ]
    };
  }

  if (
    includesAny(searchableText, [
      "theme",
      "cms",
      "module",
      "template",
      "app home",
      "ui extension",
      "serverless",
      "website"
    ])
  ) {
    return {
      lane: "developer_tooling",
      label: "Developer tooling",
      summary:
        "Better handled through HubSpot developer projects, UI extensions, or external engineering workflows.",
      apiEligible: false,
      directActions: [],
      notes: [
        "Do not force this through CRM APIs if the developer platform is the proper path."
      ]
    };
  }

  if (
    includesAny(searchableText, [
      "dashboard",
      "report",
      "qa",
      "review",
      "audit",
      "approval"
    ])
  ) {
    return {
      lane: "manual_review",
      label: "Manual / review",
      summary:
        "This is better as reviewed human work or QA support, not direct API execution.",
      apiEligible: false,
      directActions: [],
      notes: [
        "Keep an operator in the loop before treating this as automated work."
      ]
    };
  }

  return {
    lane: "human_delivery",
    label: "Human delivery",
    summary:
      "Treat this as standard delivery work unless a more explicit API path is defined.",
    apiEligible: false,
    directActions: [],
    notes: [
      "Refine the execution type if you want a tighter automation path later."
    ]
  };
}

export function serializeTask<
  T extends {
    id: string;
    projectId: string;
    title: string;
    description: string | null;
    category: string | null;
    executionType: string;
    executionLaneRationale?: string | null;
    hubspotTierRequired?: string | null;
    coworkBrief?: string | null;
    manualInstructions?: string | null;
    apiPayload?: Prisma.Prisma.JsonValue | null;
    agentModuleKey?: string | null;
    executionPayload?: Prisma.Prisma.JsonValue | null;
    validationStatus?: string;
    validationEvidence?: string | null;
    findingId?: string | null;
    recommendationId?: string | null;
    priority: string;
    status: string;
    plannedHours: number | null;
    actualHours: number | null;
    qaRequired: boolean;
    executionReadiness: string;
    approvalRequired: boolean;
    dependencyIds: string[];
    assigneeType: string | null;
    scopeOrigin?: string | null;
    changeRequestId?: string | null;
    assignedAgentId?: string | null;
    assignedAgent?: { name: string } | null;
    executionJobs?: Array<{
      id: string;
      status: string;
      resultStatus: string | null;
      outputSummary?: string | null;
      createdAt: Date;
      completedAt: Date | null;
    }>;
    approvals?: Array<{
      id: string;
      status: string;
      requestedAt: Date;
      approvedAt: Date | null;
      rejectedAt: Date | null;
      approvedBy: string | null;
      rejectedBy: string | null;
      notes: string | null;
    }>;
    createdAt: Date;
    updatedAt: Date;
  }
>(task: T) {
  const latestExecutionJob = task.executionJobs?.[0] ?? null;
  const latestApproval = task.approvals?.[0] ?? null;
  const executionPath = deriveTaskExecutionPath({
    title: task.title,
    description: task.description,
    category: task.category,
    executionType: task.executionType,
    assigneeType: task.assigneeType
  });

  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    category: task.category,
    executionType: task.executionType,
    executionLaneRationale: task.executionLaneRationale ?? null,
    hubspotTierRequired: task.hubspotTierRequired ?? null,
    coworkBrief: task.coworkBrief ?? null,
    manualInstructions: task.manualInstructions ?? null,
    apiPayload: task.apiPayload ?? null,
    agentModuleKey: task.agentModuleKey ?? null,
    executionPayload: task.executionPayload ?? null,
    validationStatus: task.validationStatus ?? "pending",
    validationEvidence: task.validationEvidence ?? null,
    findingId: task.findingId ?? null,
    recommendationId: task.recommendationId ?? null,
    priority: task.priority,
    status: task.status,
    plannedHours: task.plannedHours,
    actualHours: task.actualHours,
    qaRequired: task.qaRequired,
    executionReadiness: task.executionReadiness,
    approvalRequired: task.approvalRequired,
    dependencyIds: task.dependencyIds,
    assigneeType: task.assigneeType,
    executionPath,
    scopeOrigin: task.scopeOrigin ?? "baseline",
    changeRequestId: task.changeRequestId ?? null,
    assignedAgentId: task.assignedAgentId ?? null,
    assignedAgentName: task.assignedAgent?.name ?? null,
    latestApproval: latestApproval
      ? {
          id: latestApproval.id,
          status: latestApproval.status,
          requestedAt: latestApproval.requestedAt.toISOString(),
          approvedAt: latestApproval.approvedAt?.toISOString() ?? null,
          rejectedAt: latestApproval.rejectedAt?.toISOString() ?? null,
          approvedBy: latestApproval.approvedBy ?? null,
          rejectedBy: latestApproval.rejectedBy ?? null,
          notes: latestApproval.notes ?? null
        }
      : null,
    latestExecutionJob: latestExecutionJob
      ? {
          id: latestExecutionJob.id,
          status: latestExecutionJob.status,
          resultStatus: latestExecutionJob.resultStatus,
          outputSummary: latestExecutionJob.outputSummary ?? null,
          createdAt: latestExecutionJob.createdAt.toISOString(),
          completedAt: latestExecutionJob.completedAt?.toISOString() ?? null
        }
      : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString()
  };
}

export function serializePortalTask<
  T extends Parameters<typeof serializeTask>[0]
>(task: T) {
  const serialized = serializeTask(task);

  return {
    ...serialized,
    executionLaneRationale: null,
    hubspotTierRequired: null,
    coworkBrief: null,
    manualInstructions: null,
    apiPayload: null,
    executionPayload: null,
    validationEvidence: null,
    assignedAgentName: null,
    latestExecutionJob: null,
    latestApproval: null
  };
}

function serializeExecutionJob<
  T extends {
    id: string;
    projectId: string;
    taskId: string | null;
    jobType?: string | null;
    moduleKey: string;
    executionMethod: string;
    mode: string;
    status: string;
    payload: unknown | null;
    outputSummary?: string | null;
    resultStatus: string | null;
    outputLog: string | null;
    errorLog: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    project?: { name: string } | null;
    task?: { title: string } | null;
  }
>(job: T) {
  return {
    id: job.id,
    projectId: job.projectId,
    projectName: job.project?.name ?? null,
    taskId: job.taskId,
    taskTitle: job.task?.title ?? null,
    jobType: job.jobType ?? null,
    moduleKey: job.moduleKey,
    executionMethod: job.executionMethod,
    mode: job.mode,
    status: job.status,
    payload: job.payload,
    outputSummary: job.outputSummary ?? null,
    resultStatus: job.resultStatus,
    outputLog: job.outputLog,
    errorLog: job.errorLog,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString()
  };
}

function mergeWorkflowRunPayload(
  existingPayload: Prisma.Prisma.JsonValue | null,
  nextPayload: Prisma.Prisma.InputJsonValue | undefined
): Prisma.Prisma.InputJsonValue | undefined {
  if (
    existingPayload &&
    typeof existingPayload === "object" &&
    !Array.isArray(existingPayload) &&
    nextPayload &&
    typeof nextPayload === "object" &&
    !Array.isArray(nextPayload)
  ) {
    return {
      ...(existingPayload as Record<string, unknown>),
      ...(nextPayload as Record<string, unknown>)
    } as Prisma.Prisma.InputJsonValue;
  }

  if (nextPayload !== undefined) {
    return nextPayload;
  }

  if (existingPayload === null) {
    return undefined;
  }

  return existingPayload as Prisma.Prisma.InputJsonValue;
}

function serializeWorkflowRun<
  T extends {
    id: string;
    workflowKey: string;
    title: string;
    projectId: string | null;
    clientId: string | null;
    portalId: string | null;
    providerKey: string | null;
    model: string | null;
    routeSource: string | null;
    requestText: string | null;
    summary: string | null;
    status: string;
    resultStatus: string | null;
    outputLog: string | null;
    errorLog: string | null;
    payload: Prisma.Prisma.JsonValue | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    project?: {
      id: string;
      name: string;
      client?: { id: string; name: string } | null;
      portal?: { id: string; displayName: string; portalId: string } | null;
    } | null;
    client?: { id: string; name: string } | null;
    portal?: { id: string; displayName: string; portalId: string } | null;
  }
>(run: T) {
  const resolvedClient = run.client ?? run.project?.client ?? null;
  const resolvedPortal = run.portal ?? run.project?.portal ?? null;

  return {
    id: run.id,
    workflowKey: run.workflowKey,
    title: run.title,
    projectId: run.projectId,
    projectName: run.project?.name ?? null,
    clientId: resolvedClient?.id ?? run.clientId ?? null,
    clientName: resolvedClient?.name ?? null,
    portalId: resolvedPortal?.id ?? run.portalId ?? null,
    portalDisplayName: resolvedPortal?.displayName ?? null,
    portalExternalId: resolvedPortal?.portalId ?? null,
    providerKey: run.providerKey,
    model: run.model,
    routeSource: run.routeSource,
    requestText: run.requestText,
    summary: run.summary,
    status: run.status,
    resultStatus: run.resultStatus,
    outputLog: run.outputLog,
    errorLog: run.errorLog,
    payload: run.payload,
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString()
  };
}

async function createWorkflowRunRecord(input: {
  workflowKey: string;
  title: string;
  projectId?: string | null;
  clientId?: string | null;
  portalId?: string | null;
  requestText?: string | null;
  payload?: Prisma.Prisma.InputJsonValue;
}) {
  const resolvedRoute = await resolveAiWorkflow(input.workflowKey);

  return prisma.workflowRun.create({
    data: {
      workflowKey: input.workflowKey,
      title: input.title,
      projectId: input.projectId ?? null,
      clientId: input.clientId ?? null,
      portalId: input.portalId ?? null,
      providerKey: resolvedRoute.providerKey,
      model: resolvedRoute.model,
      routeSource: resolvedRoute.routeSource,
      requestText: input.requestText ?? null,
      status: "queued",
      resultStatus: "queued",
      ...(input.payload !== undefined ? { payload: input.payload } : {})
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          client: { select: { id: true, name: true } },
          portal: { select: { id: true, displayName: true, portalId: true } }
        }
      },
      client: { select: { id: true, name: true } },
      portal: { select: { id: true, displayName: true, portalId: true } }
    }
  });
}

async function updateWorkflowRunRecord(
  runId: string,
  input: {
    summary?: string | null;
    status?: string;
    resultStatus?: string | null;
    outputLog?: string | null;
    errorLog?: string | null;
    payload?: Prisma.Prisma.InputJsonValue;
    startedAt?: Date | null;
    completedAt?: Date | null;
  }
) {
  const existingRun = await prisma.workflowRun.findUnique({
    where: { id: runId },
    select: { payload: true }
  });

  return prisma.workflowRun.update({
    where: { id: runId },
    data: {
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.resultStatus !== undefined
        ? { resultStatus: input.resultStatus }
        : {}),
      ...(input.outputLog !== undefined ? { outputLog: input.outputLog } : {}),
      ...(input.errorLog !== undefined ? { errorLog: input.errorLog } : {}),
      ...(input.startedAt !== undefined ? { startedAt: input.startedAt } : {}),
      ...(input.completedAt !== undefined
        ? { completedAt: input.completedAt }
        : {}),
      ...(input.payload !== undefined
        ? (() => {
            const mergedPayload = mergeWorkflowRunPayload(
              existingRun?.payload ?? null,
              input.payload
            );
            return mergedPayload !== undefined
              ? { payload: mergedPayload }
              : {};
          })()
        : {})
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          client: { select: { id: true, name: true } },
          portal: { select: { id: true, displayName: true, portalId: true } }
        }
      },
      client: { select: { id: true, name: true } },
      portal: { select: { id: true, displayName: true, portalId: true } }
    }
  });
}

async function executeTrackedWorkflowRun<TResult>(input: {
  workflowKey: string;
  title: string;
  projectId?: string | null;
  clientId?: string | null;
  portalId?: string | null;
  requestText?: string | null;
  payload?: Prisma.Prisma.InputJsonValue;
  execute: () => Promise<{
    result: TResult;
    summary?: string | null;
    outputLog?: string | null;
    resultStatus?: string | null;
    payload?: Prisma.Prisma.InputJsonValue;
  }>;
}) {
  const queuedRun = await createWorkflowRunRecord(input);
  const runningRun = await updateWorkflowRunRecord(queuedRun.id, {
    status: "running",
    resultStatus: "executing",
    startedAt: new Date()
  });

  try {
    const outcome = await input.execute();
    const completedRun = await updateWorkflowRunRecord(runningRun.id, {
      summary: outcome.summary ?? null,
      status: "completed",
      resultStatus: outcome.resultStatus ?? "completed",
      outputLog: outcome.outputLog ?? null,
      errorLog: null,
      ...(outcome.payload !== undefined ? { payload: outcome.payload } : {}),
      completedAt: new Date()
    });

    return {
      run: serializeWorkflowRun(completedRun),
      result: outcome.result
    };
  } catch (error) {
    const failedRun = await updateWorkflowRunRecord(runningRun.id, {
      status: "failed",
      resultStatus: "failed",
      errorLog: error instanceof Error ? error.message : "Workflow execution failed",
      completedAt: new Date()
    });

    const wrappedError =
      error instanceof Error
        ? error
        : new Error("Workflow execution failed");
    Object.assign(wrappedError, {
      workflowRun: serializeWorkflowRun(failedRun)
    });
    throw wrappedError;
  }
}

export async function loadWorkflowRuns(input?: {
  projectId?: string | null;
  clientId?: string | null;
  portalId?: string | null;
  workflowKeys?: string[];
  limit?: number;
}) {
  const conditions: Prisma.Prisma.WorkflowRunWhereInput[] = [];

  if (input?.projectId) {
    conditions.push({ projectId: input.projectId });
  }

  if (input?.clientId) {
    conditions.push({
      OR: [{ clientId: input.clientId }, { project: { clientId: input.clientId } }]
    });
  }

  if (input?.portalId) {
    conditions.push({
      OR: [{ portalId: input.portalId }, { project: { portalId: input.portalId } }]
    });
  }

  if (input?.workflowKeys?.length) {
    conditions.push({
      workflowKey: {
        in: input.workflowKeys.filter(Boolean)
      }
    });
  }

  const runs = await prisma.workflowRun.findMany({
    ...(conditions.length > 0 ? { where: { AND: conditions } } : {}),
    include: {
      project: {
        select: {
          id: true,
          name: true,
          client: { select: { id: true, name: true } },
          portal: { select: { id: true, displayName: true, portalId: true } }
        }
      },
      client: { select: { id: true, name: true } },
      portal: { select: { id: true, displayName: true, portalId: true } }
    },
    orderBy: [{ createdAt: "desc" }],
    ...(input?.limit ? { take: input.limit } : {})
  });

  return runs.map((run) => serializeWorkflowRun(run));
}

export async function loadAgentRuns() {
  const jobs = await prisma.executionJob.findMany({
    where: { moduleKey: "agent-task" },
    include: {
      project: { select: { name: true } },
      task: { select: { title: true } }
    },
    orderBy: [{ createdAt: "desc" }]
  });

  return jobs.map((job) => serializeExecutionJob(job));
}

export async function loadProjectExecutionJobStatus(
  projectId: string,
  jobId: string
) {
  const job = await prisma.executionJob.findFirst({
    where: {
      id: jobId,
      projectId
    },
    include: {
      project: { select: { name: true } },
      task: { select: { title: true } }
    }
  });

  if (!job) {
    throw new Error("Execution job not found");
  }

  return serializeExecutionJob(job);
}

export async function startProjectPortalAuditExecutionJob(
  projectId: string,
  providerKey = "anthropic",
  modelId?: string
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      portalId: true
    }
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (!project.portalId) {
    throw new Error("No portal connected to this project");
  }

  const job = await prisma.executionJob.create({
    data: {
      projectId: project.id,
      jobType: "portal_audit",
      moduleKey: "portal_audit",
      executionMethod: "agent",
      mode: "async",
      status: "queued",
      resultStatus: "pending",
      outputSummary: "Queued portal audit agent.",
      payload: {
        projectId: project.id,
        portalId: project.portalId,
        providerKey,
        ...(modelId ? { modelId } : {})
      }
    },
    include: {
      project: { select: { name: true } },
      task: { select: { title: true } }
    }
  });

  // Add to BullMQ queue — worker picks this up immediately
  await executionQueue.add(
    job.moduleKey,
    {
      executionJobId: job.id,
      moduleKey: job.moduleKey,
      projectId: project.id,
      portalId: project.portalId,
      dryRun: false,
      payload: job.payload,
      providerKey,
      ...(modelId ? { modelId } : {})
    },
    { jobId: job.id } // use same ID for traceability
  );

  return serializeExecutionJob(job);
}

export async function updateAgentRun(
  runId: string,
  value: {
    status?: unknown;
    resultStatus?: unknown;
    outputLog?: unknown;
    errorLog?: unknown;
  }
) {
  const existingRun = await prisma.executionJob.findUnique({
    where: { id: runId },
    include: {
      task: true
    }
  });

  if (!existingRun) {
    throw new Error("Agent run not found");
  }

  const updateData: {
    status?: string;
    resultStatus?: string | null;
    outputLog?: string | null;
    errorLog?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
  } = {};

  let normalizedStatus: string | null = null;

  if (value.status !== undefined) {
    if (typeof value.status !== "string" || value.status.trim().length === 0) {
      throw new Error("status must be a non-empty string");
    }

    normalizedStatus = value.status.trim();
    updateData.status = normalizedStatus;
    if (normalizedStatus === "in_progress") {
      updateData.startedAt = new Date();
      updateData.completedAt = null;
    }
    if (
      ["completed", "failed", "cancelled", "review_ready"].includes(
        normalizedStatus
      )
    ) {
      updateData.completedAt = new Date();
      if (normalizedStatus !== "failed") {
        updateData.errorLog = null;
      }
    }
  }

  if (value.resultStatus !== undefined) {
    if (value.resultStatus !== null && typeof value.resultStatus !== "string") {
      throw new Error("resultStatus must be a string or null");
    }
    updateData.resultStatus =
      typeof value.resultStatus === "string"
        ? value.resultStatus.trim() || null
        : null;
  }

  if (value.outputLog !== undefined) {
    if (value.outputLog !== null && typeof value.outputLog !== "string") {
      throw new Error("outputLog must be a string or null");
    }
    updateData.outputLog =
      typeof value.outputLog === "string" ? value.outputLog : null;
  }

  if (value.errorLog !== undefined) {
    if (value.errorLog !== null && typeof value.errorLog !== "string") {
      throw new Error("errorLog must be a string or null");
    }
    updateData.errorLog =
      typeof value.errorLog === "string" ? value.errorLog : null;
  }

  const run = await prisma.executionJob.update({
    where: { id: runId },
    data: updateData,
    include: {
      project: { select: { name: true } },
      task: {
        select: { id: true, title: true, plannedHours: true, actualHours: true }
      }
    }
  });

  if (existingRun.taskId && normalizedStatus) {
    if (["in_progress", "review_ready"].includes(normalizedStatus)) {
      await prisma.task.update({
        where: { id: existingRun.taskId },
        data: {
          status: "in_progress"
        }
      });
    }

    if (normalizedStatus === "completed") {
      const resolvedActualHours =
        run.task?.actualHours ?? run.task?.plannedHours ?? null;
      await prisma.task.update({
        where: { id: existingRun.taskId },
        data: {
          status: "done",
          ...(resolvedActualHours !== null
            ? { actualHours: resolvedActualHours }
            : {})
        }
      });
    }

    if (normalizedStatus === "failed") {
      await prisma.task.update({
        where: { id: existingRun.taskId },
        data: {
          status: "blocked"
        }
      });
    }
  }

  return serializeExecutionJob(run);
}

async function loadProjectAgentExecutionContext(projectId: string) {
  const [project, evidenceItems, recentMessages] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: true,
        blueprint: {
          include: {
            tasks: {
              orderBy: [{ phase: "asc" }, { order: "asc" }],
              take: 12
            }
          }
        }
      }
    }),
    loadDiscoveryEvidence(projectId),
    prisma.projectMessage.findMany({
      where: { projectId },
      orderBy: [{ createdAt: "desc" }],
      take: 6
    })
  ]);

  if (!project) {
    throw new Error("Project not found");
  }

  return {
    project,
    evidenceItems,
    recentMessages
  };
}

function buildFallbackAgentExecutionBrief(input: {
  projectName: string;
  clientName: string;
  serviceFamily: string;
  taskTitle: string;
  taskDescription: string | null;
  category: string | null;
  allowedActions: string[];
  approvalMode: string;
  supportingContext: string[];
}) {
  const contextLines =
    input.supportingContext.length > 0
      ? input.supportingContext.map((item) => `- ${item}`).join("\n")
      : "- No supporting context attached yet.";
  const actionLines =
    input.allowedActions.length > 0
      ? input.allowedActions.map((action) => `- ${action}`).join("\n")
      : "- No explicit actions configured.";

  return [
    `Execution Brief: ${input.taskTitle}`,
    `Project: ${input.projectName}`,
    `Client: ${input.clientName}`,
    `Service family: ${input.serviceFamily}`,
    input.category ? `Task category: ${input.category}` : null,
    "",
    "Objective",
    input.taskDescription ||
      "Complete the assigned delivery task using the approved project context.",
    "",
    "Allowed actions",
    actionLines,
    "",
    "Supporting context",
    contextLines,
    "",
    `Approval mode: ${input.approvalMode}`,
    "Expected outcome",
    "Produce a safe, reviewable implementation result and capture any blockers, assumptions, or follow-up actions before completion."
  ]
    .filter(Boolean)
    .join("\n");
}

async function generateAgentExecutionBrief(
  task: {
    title: string;
    description: string | null;
    category: string | null;
    executionType: string;
    executionReadiness: string;
    assignedAgent: {
      name: string;
      purpose: string;
      serviceFamily: string;
      allowedActions: string[];
      approvalMode: string;
      systemPrompt: string | null;
    };
  },
  context: Awaited<ReturnType<typeof loadProjectAgentExecutionContext>>
) {
  const supportingContext = context.evidenceItems
    .slice(0, 8)
    .map(
      (item) =>
        `${item.sourceLabel}${
          item.sourceUrl ? ` (${item.sourceUrl})` : ""
        }${item.content ? `: ${item.content.slice(0, 220)}` : ""}`
    )
    .filter(Boolean);

  const blueprintTasks =
    context.project.blueprint?.tasks
      ?.slice(0, 8)
      .map(
        (blueprintTask) =>
          `Phase ${blueprintTask.phase}: ${blueprintTask.name} (${blueprintTask.type}, ${blueprintTask.effortHours}h)`
      ) ?? [];

  const messageContext = context.recentMessages
    .map((message) => `${message.senderName}: ${message.body.slice(0, 180)}`)
    .filter(Boolean);

  const fallback = buildFallbackAgentExecutionBrief({
    projectName: context.project.name,
    clientName: context.project.client.name,
    serviceFamily: context.project.serviceFamily,
    taskTitle: task.title,
    taskDescription: task.description,
    category: task.category,
    allowedActions: task.assignedAgent.allowedActions,
    approvalMode: task.assignedAgent.approvalMode,
    supportingContext
  });

  try {
    const response = await callAiWorkflow(
      "agent_execution_brief",
      `You are Muloo Deploy OS's agent execution planner.
Create a concise execution brief for a delivery task before the assigned agent begins work.

Rules:
- Return plain text only.
- Keep the output structured and practical.
- Include these sections in order: Objective, Recommended approach, Inputs required, Guardrails, Completion checklist, Escalation triggers.
- Tailor the brief to the task and service family.
- Respect the agent's allowed actions and approval mode.
- Do not invent client requirements that are not evidenced.
- If context is missing, call that out explicitly under Inputs required or Escalation triggers.`,
      [
        `Project: ${context.project.name}`,
        `Client: ${context.project.client.name}`,
        `Service family: ${context.project.serviceFamily}`,
        `Scope type: ${context.project.scopeType ?? "discovery"}`,
        `Project brief: ${context.project.commercialBrief ?? ""}`,
        `Task title: ${task.title}`,
        `Task description: ${task.description ?? ""}`,
        `Task category: ${task.category ?? ""}`,
        `Execution type: ${task.executionType}`,
        `Readiness: ${task.executionReadiness}`,
        `Assigned agent: ${task.assignedAgent.name}`,
        `Agent purpose: ${task.assignedAgent.purpose}`,
        `Agent service family: ${task.assignedAgent.serviceFamily}`,
        `Agent allowed actions: ${
          task.assignedAgent.allowedActions.join(", ") || "none listed"
        }`,
        `Agent approval mode: ${task.assignedAgent.approvalMode}`,
        task.assignedAgent.systemPrompt
          ? `Agent system prompt: ${task.assignedAgent.systemPrompt}`
          : null,
        supportingContext.length > 0
          ? `Supporting context:
${supportingContext.map((item) => `- ${item}`).join("\n")}`
          : "Supporting context: none attached",
        blueprintTasks.length > 0
          ? `Blueprint context:
${blueprintTasks.map((item) => `- ${item}`).join("\n")}`
          : null,
        messageContext.length > 0
          ? `Recent project messages:
${messageContext.map((item) => `- ${item}`).join("\n")}`
          : null
      ]
        .filter(Boolean)
        .join("\n\n"),
      { maxTokens: 1200 }
    );

    return response.trim() || fallback;
  } catch {
    return fallback;
  }
}

export async function queueAgentRun(projectId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, projectId },
    include: {
      assignedAgent: true,
      project: { select: { name: true } }
    }
  });

  if (!task) {
    throw new Error("Task not found");
  }

  if (
    task.assigneeType !== "Agent" ||
    !task.assignedAgentId ||
    !task.assignedAgent
  ) {
    throw new Error("Task is not assigned to an agent");
  }

  if (!["ready_with_review", "ready"].includes(task.executionReadiness)) {
    throw new Error("Task is not execution-ready for agent delivery");
  }

  if (task.approvalRequired) {
    throw new Error("Task still requires approval before agent delivery");
  }

  const [context, resolvedWorkflow] = await Promise.all([
    loadProjectAgentExecutionContext(projectId),
    resolveAiWorkflowForAgent(
      "agent_execution_brief",
      task.assignedAgent.provider,
      task.assignedAgent.model
    )
  ]);
  const executionBrief = await generateAgentExecutionBrief(
    {
      title: task.title,
      description: task.description,
      category: task.category,
      executionType: task.executionType,
      executionReadiness: task.executionReadiness,
      assignedAgent: {
        name: task.assignedAgent.name,
        purpose: task.assignedAgent.purpose,
        serviceFamily: task.assignedAgent.serviceFamily,
        allowedActions: task.assignedAgent.allowedActions,
        approvalMode: task.assignedAgent.approvalMode,
        systemPrompt: task.assignedAgent.systemPrompt
      }
    },
    context
  );

  const job = await prisma.executionJob.create({
    data: {
      projectId,
      taskId: task.id,
      moduleKey: "agent-task",
      executionMethod: resolvedWorkflow.providerKey,
      mode: task.executionReadiness === "ready" ? "ready" : "dry-run",
      status: "queued",
      resultStatus:
        task.executionReadiness === "ready"
          ? "ready_to_execute"
          : "review_required",
      outputLog: executionBrief,
      payload: {
        workflowKey: "agent_execution_brief",
        agentId: task.assignedAgent.id,
        agentName: task.assignedAgent.name,
        agentProvider: task.assignedAgent.provider,
        agentModel: task.assignedAgent.model,
        routedProvider: resolvedWorkflow.providerKey,
        routedModel: resolvedWorkflow.model,
        routeSource: resolvedWorkflow.routeSource,
        taskTitle: task.title,
        taskDescription: task.description,
        taskCategory: task.category,
        taskExecutionType: task.executionType,
        executionReadiness: task.executionReadiness,
        projectName: task.project.name,
        projectServiceFamily: context.project.serviceFamily,
        allowedActions: task.assignedAgent.allowedActions,
        approvalMode: task.assignedAgent.approvalMode
      }
    },
    include: {
      project: { select: { name: true } },
      task: { select: { title: true } }
    }
  });

  return serializeExecutionJob(job);
}

function serializeDeliveryTemplate<
  T extends {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    serviceFamily: string;
    category: string;
    scopeType: string;
    recommendedHubs: string[];
    defaultPlannedHours: number | null;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
    tasks?: Array<{
      id: string;
      title: string;
      description: string | null;
      category: string | null;
      executionType: string;
      priority: string;
      status: string;
      qaRequired: boolean;
      approvalRequired: boolean;
      assigneeType: string | null;
      plannedHours: number | null;
      sortOrder: number;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }
>(template: T) {
  return {
    id: template.id,
    slug: template.slug,
    name: template.name,
    description: template.description,
    serviceFamily: template.serviceFamily,
    category: template.category,
    scopeType: template.scopeType,
    recommendedHubs: template.recommendedHubs,
    defaultPlannedHours: template.defaultPlannedHours,
    isActive: template.isActive,
    sortOrder: template.sortOrder,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
    tasks:
      template.tasks?.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        category: task.category,
        executionType: task.executionType,
        priority: task.priority,
        status: task.status,
        qaRequired: task.qaRequired,
        approvalRequired: task.approvalRequired,
        assigneeType: task.assigneeType,
        plannedHours: task.plannedHours,
        sortOrder: task.sortOrder,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString()
      })) ?? []
  };
}

function serializeWorkRequest<
  T extends {
    id: string;
    projectId: string | null;
    title: string;
    serviceFamily: string;
    requestType: string;
    companyName: string | null;
    contactName: string;
    contactEmail: string;
    summary: string;
    details: string | null;
    urgency: string | null;
    budgetRange: string | null;
    portalOrWebsite: string | null;
    internalNotes?: string | null;
    commercialImpactHours?: number | null;
    commercialImpactFeeZar?: number | null;
    deliveryTasks?: unknown | null;
    reviewedAt?: Date | null;
    approvedAt?: Date | null;
    approvedByName?: string | null;
    rejectedAt?: Date | null;
    deliveryAppendedAt?: Date | null;
    links: string[];
    status: string;
    createdAt: Date;
    updatedAt: Date;
    project?: { id: string; name: string } | null;
  }
>(request: T) {
  return {
    id: request.id,
    projectId: request.projectId,
    title: request.title,
    serviceFamily: request.serviceFamily,
    requestType: request.requestType,
    companyName: request.companyName,
    contactName: request.contactName,
    contactEmail: request.contactEmail,
    summary: request.summary,
    details: request.details,
    urgency: request.urgency,
    budgetRange: request.budgetRange,
    portalOrWebsite: request.portalOrWebsite,
    internalNotes: request.internalNotes ?? null,
    commercialImpactHours: request.commercialImpactHours ?? null,
    commercialImpactFeeZar: request.commercialImpactFeeZar ?? null,
    deliveryTasks: normalizeChangeDeliveryTasks(request.deliveryTasks),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    approvedAt: request.approvedAt?.toISOString() ?? null,
    approvedByName: request.approvedByName ?? null,
    rejectedAt: request.rejectedAt?.toISOString() ?? null,
    deliveryAppendedAt: request.deliveryAppendedAt?.toISOString() ?? null,
    links: request.links,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    project: request.project
      ? {
          id: request.project.id,
          name: request.project.name
        }
      : null
  };
}

function normalizeOptionalTaskString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeTaskValidationStatus(value: unknown) {
  if (
    typeof value === "string" &&
    validTaskValidationStatusValues.includes(
      value as (typeof validTaskValidationStatusValues)[number]
    )
  ) {
    return value;
  }

  return "pending";
}

function normalizeOptionalJsonObject(
  value: unknown,
  fieldName: string
): Prisma.Prisma.InputJsonValue | Prisma.Prisma.NullTypes.JsonNull | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.Prisma.JsonNull;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Prisma.Prisma.InputJsonValue;
  }

  throw new Error(`${fieldName} must be an object`);
}

function normalizeRequiredTaskString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
}

function normalizeChangeDeliveryTasks(
  value: unknown
): ChangeDeliveryTaskPlan[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (task): task is Record<string, unknown> =>
        Boolean(task) && typeof task === "object"
    )
    .map((task) => {
      const plannedHours =
        typeof task.plannedHours === "number"
          ? task.plannedHours
          : Number(task.plannedHours);
      const assigneeType =
        typeof task.assigneeType === "string"
          ? task.assigneeType.trim()
          : "Human";
      const normalizedAssigneeType =
        assigneeType === "Agent" || assigneeType === "Client"
          ? assigneeType
          : "Human";
      const priority =
        typeof task.priority === "string" && task.priority.trim().length > 0
          ? task.priority.trim().toLowerCase()
          : "medium";

      return {
        title: normalizeRequiredTaskString(task.title, "change task title"),
        description:
          typeof task.description === "string" ? task.description.trim() : "",
        category: typeof task.category === "string" ? task.category.trim() : "",
        plannedHours:
          Number.isFinite(plannedHours) && plannedHours >= 0 ? plannedHours : 0,
        assigneeType: normalizedAssigneeType,
        executionType:
          typeof task.executionType === "string" &&
          task.executionType.trim().length > 0
            ? task.executionType.trim()
            : "manual",
        priority:
          priority === "low" || priority === "high" || priority === "medium"
            ? priority
            : "medium",
        qaRequired: Boolean(task.qaRequired),
        approvalRequired: Boolean(task.approvalRequired)
      };
    });
}

function extractJsonBlock(rawText: string): string {
  const trimmed = rawText.trim();

  if (!trimmed) {
    throw new SyntaxError("Model returned empty content");
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

async function parseModelJson<T>(
  rawText: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  repairLabel: string
): Promise<T> {
  const normalizedJson = extractJsonBlock(rawText);

  try {
    return schema.parse(JSON.parse(normalizedJson) as unknown);
  } catch (initialError) {
    try {
      const repairedText = await callAiWorkflow(
        "json_repair",
        `You repair malformed JSON for Muloo Deploy OS.

Rules:
- Return ONLY valid JSON.
- Do not add markdown fences or commentary.
- Preserve the original intended structure and values as closely as possible.
`,
        JSON.stringify(
          {
            label: repairLabel,
            malformedJson: normalizedJson
          },
          null,
          2
        ),
        { maxTokens: 4000 }
      );

      const repairedJson = extractJsonBlock(repairedText);
      return schema.parse(JSON.parse(repairedJson) as unknown);
    } catch (repairError) {
      if (
        initialError instanceof SyntaxError ||
        initialError instanceof ZodError
      ) {
        throw initialError;
      }

      if (
        repairError instanceof SyntaxError ||
        repairError instanceof ZodError
      ) {
        throw repairError;
      }

      throw new SyntaxError(
        `Failed to parse ${repairLabel} JSON from model output`
      );
    }
  }
}

function createBlueprintTask(
  name: string,
  type: (typeof blueprintTaskTypeValues)[number],
  effortHours: number,
  order: number
) {
  return {
    name,
    type,
    effortHours,
    order
  };
}

function buildFallbackBlueprint(
  discoveryPayload: NonNullable<
    Awaited<ReturnType<typeof loadProjectDiscoveryForBlueprint>>
  >
) {
  const { discovery } = discoveryPayload;
  const session1 =
    discovery.sessions.find((session) => session.session === 1)?.fields ?? {};
  const session2 =
    discovery.sessions.find((session) => session.session === 2)?.fields ?? {};
  const session3 =
    discovery.sessions.find((session) => session.session === 3)?.fields ?? {};
  const session4 =
    discovery.sessions.find((session) => session.session === 4)?.fields ?? {};

  const phases: Array<{
    phase: number;
    phaseName: string;
    tasks: Array<{
      name: string;
      type: (typeof blueprintTaskTypeValues)[number];
      effortHours: number;
      order: number;
    }>;
  }> = [
    {
      phase: 1,
      phaseName: "Foundation & Alignment",
      tasks: [
        createBlueprintTask(
          "Validate discovery findings and confirm scope",
          "Human",
          3,
          1
        ),
        createBlueprintTask(
          "Confirm client stakeholders, owners, and approvals",
          "Client",
          1,
          2
        ),
        createBlueprintTask(
          "Set up project workspace, documentation, and governance",
          "Human",
          2,
          3
        )
      ]
    },
    {
      phase: 2,
      phaseName: "Data & Process Design",
      tasks: [
        createBlueprintTask(
          "Map current data sources and migration requirements",
          "Human",
          4,
          1
        ),
        createBlueprintTask(
          "Prepare data cleanup list and import strategy",
          "Agent",
          3,
          2
        ),
        createBlueprintTask(
          "Approve target lifecycle, pipeline, and process design",
          "Client",
          1,
          3
        )
      ]
    }
  ];

  const buildTasks: Array<{
    name: string;
    type: (typeof blueprintTaskTypeValues)[number];
    effortHours: number;
    order: number;
  }> = [];

  if (discovery.selectedHubs.includes("sales")) {
    buildTasks.push(
      createBlueprintTask(
        "Configure Sales Hub properties, pipelines, and handoff stages",
        "Human",
        5,
        buildTasks.length + 1
      ),
      createBlueprintTask(
        "Generate sales object and field checklist",
        "Agent",
        2,
        buildTasks.length + 1
      )
    );
  }

  if (discovery.selectedHubs.includes("marketing")) {
    buildTasks.push(
      createBlueprintTask(
        "Configure marketing lifecycle, campaign, and lead routing setup",
        "Human",
        4,
        buildTasks.length + 1
      ),
      createBlueprintTask(
        "Draft marketing automation and nurture recommendations",
        "Agent",
        2,
        buildTasks.length + 1
      )
    );
  }

  if (discovery.selectedHubs.includes("service")) {
    buildTasks.push(
      createBlueprintTask(
        "Configure service pipelines, inbox, and support process foundations",
        "Human",
        4,
        buildTasks.length + 1
      )
    );
  }

  if (discovery.selectedHubs.includes("cms")) {
    buildTasks.push(
      createBlueprintTask(
        "Align CMS/content requirements with website rebuild dependencies",
        "Human",
        3,
        buildTasks.length + 1
      )
    );
  }

  if (discovery.selectedHubs.includes("ops")) {
    buildTasks.push(
      createBlueprintTask(
        "Define RevOps governance, custom objects, and operational controls",
        "Human",
        4,
        buildTasks.length + 1
      )
    );
  }

  if (discovery.selectedHubs.includes("data")) {
    buildTasks.push(
      createBlueprintTask(
        "Configure data management, quality, and sync foundations",
        "Human",
        4,
        buildTasks.length + 1
      )
    );
  }

  if (discovery.selectedHubs.includes("commerce")) {
    buildTasks.push(
      createBlueprintTask(
        "Configure commerce, quote, and payment foundations",
        "Human",
        4,
        buildTasks.length + 1
      )
    );
  }

  if ((session3.integration_requirements ?? "").trim().length > 0) {
    buildTasks.push(
      createBlueprintTask(
        "Assess and sequence required integrations",
        "Human",
        3,
        buildTasks.length + 1
      )
    );
  }

  phases.push({
    phase: 3,
    phaseName: "Hub Configuration & Automation",
    tasks:
      buildTasks.length > 0
        ? buildTasks
        : [
            createBlueprintTask(
              "Configure core HubSpot setup based on approved future-state design",
              "Human",
              6,
              1
            ),
            createBlueprintTask(
              "Prepare automation implementation checklist",
              "Agent",
              2,
              2
            )
          ]
  });

  phases.push({
    phase: 4,
    phaseName: "Testing, Enablement & Launch",
    tasks: [
      createBlueprintTask(
        "Run QA on records, workflows, and reporting outputs",
        "Human",
        3,
        1
      ),
      createBlueprintTask(
        "Support user acceptance testing and change readiness",
        "Client",
        2,
        2
      ),
      createBlueprintTask(
        "Prepare handover, adoption, and next-step recommendations",
        "Human",
        3,
        3
      )
    ]
  });

  const needsExtraPhase =
    discovery.engagementType === "MIGRATION" ||
    (session2.data_landscape ?? "").trim().length > 0 ||
    discovery.discoveryProfile.dataReadinessRating.toLowerCase() === "low";

  if (needsExtraPhase) {
    phases.splice(2, 0, {
      phase: 3,
      phaseName: "Migration Readiness",
      tasks: [
        createBlueprintTask(
          "Audit legacy data structure and migration constraints",
          "Human",
          4,
          1
        ),
        createBlueprintTask(
          "Prepare migration mapping and issue log",
          "Agent",
          3,
          2
        ),
        createBlueprintTask(
          "Approve data owners and cutover responsibilities",
          "Client",
          1,
          3
        )
      ]
    });

    for (const [index, phase] of phases.entries()) {
      phase.phase = index + 1;
      phase.tasks = phase.tasks.map((task, taskIndex) => ({
        ...task,
        order: taskIndex + 1
      }));
    }
  }

  const scopeText = [session1.primary_pain_challenge, session4.confirmed_scope]
    .filter(Boolean)
    .join(" ");

  if (
    /report/i.test(scopeText) ||
    (session3.reporting_requirements ?? "").trim().length > 0
  ) {
    const finalPhase = phases[phases.length - 1];

    if (finalPhase) {
      finalPhase.tasks.splice(
        Math.max(finalPhase.tasks.length - 1, 0),
        0,
        createBlueprintTask(
          "Configure reporting views and success dashboards",
          "Human",
          3,
          0
        )
      );
      finalPhase.tasks = finalPhase.tasks.map((task, index) => ({
        ...task,
        order: index + 1
      }));
    }
  }

  return blueprintGenerationSchema.parse({ phases });
}

function includesAny(value: string, patterns: string[]) {
  const normalizedValue = value.toLowerCase();
  return patterns.some((pattern) => normalizedValue.includes(pattern));
}

function getDiscoveryEvidenceText(
  discoveryPayload: NonNullable<
    Awaited<ReturnType<typeof loadProjectDiscoveryForBlueprint>>
  >
) {
  return [
    discoveryPayload.discovery.projectName,
    discoveryPayload.discovery.engagementType,
    discoveryPayload.discovery.scopeType ?? "",
    discoveryPayload.discovery.commercialBrief ?? "",
    discoveryPayload.discovery.client.industry ?? "",
    ...discoveryPayload.discovery.sessions.flatMap((session) =>
      Object.values(session.fields)
    ),
    ...discoveryPayload.discovery.evidenceItems.flatMap((item) => [
      item.sourceLabel,
      item.sourceUrl ?? "",
      item.content ?? ""
    ])
  ]
    .join(" \n")
    .toLowerCase();
}

function uniqueList(items: Array<string | null | undefined>, maxItems = 6) {
  return Array.from(
    new Set(
      items
        .map((item) => item?.trim())
        .filter((item): item is string => Boolean(item))
    )
  ).slice(0, maxItems);
}

function deriveSupportingToolsFallback(input: {
  evidenceText: string;
  selectedHubs: string[];
  serviceFamily?: string | null;
  implementationApproach?: string | null;
}) {
  const suggestions: string[] = [];
  const selectedHubs = new Set(input.selectedHubs);
  const evidenceText = input.evidenceText.toLowerCase();
  const pragmaticApproach = input.implementationApproach === "pragmatic_poc";

  if (
    includesAny(evidenceText, [
      "dashboard",
      "reporting",
      "executive dashboard",
      "brand reporting",
      "kpi"
    ])
  ) {
    suggestions.push(
      "Databox for executive and brand-level dashboards layered over HubSpot reporting."
    );
  }

  if (
    includesAny(evidenceText, [
      "staging",
      "middleware",
      "database",
      "dedupe",
      "duplicate",
      "data quality",
      "extract",
      "event platform"
    ])
  ) {
    if (pragmaticApproach) {
      suggestions.push(
        "Supabase or Railway Postgres as a lightweight staging database for consolidation, normalization, and deduplication."
      );
    } else {
      suggestions.push(
        "A managed staging layer such as Azure SQL, Supabase, or Railway Postgres to separate heavy normalization from the operational HubSpot CRM."
      );
    }
  }

  if (
    includesAny(evidenceText, [
      "microsoft",
      "azure",
      "office 365",
      "teams",
      "sharepoint",
      "sql server"
    ])
  ) {
    suggestions.push(
      "An Azure-native staging layer such as Azure SQL or Azure Functions may fit better if the client already operates primarily inside the Microsoft stack."
    );
  }

  if (
    includesAny(evidenceText, [
      "self hosted",
      "self-hosted",
      "private cloud",
      "private server",
      "own server",
      "internal hosting"
    ])
  ) {
    suggestions.push(
      "A self-hosted or private worker service can keep sensitive transformation logic under tighter client control while still pushing CRM-friendly outputs into HubSpot."
    );
  }

  if (
    includesAny(evidenceText, [
      "api",
      "sync",
      "integration",
      "extract",
      "webhook",
      "current platform"
    ])
  ) {
    suggestions.push(
      "A lightweight sync or middleware layer to control extraction, transformation, and auditability between the source platform and HubSpot."
    );
  }

  if (
    includesAny(evidenceText, [
      "documentation",
      "handover",
      "process",
      "sop",
      "operating procedure",
      "training"
    ])
  ) {
    suggestions.push(
      "A paid Documentation & SOP Pack can capture the agreed data model, sync logic, operating procedures, and handover notes once the Phase 1 process is proven."
    );
  }

  if (selectedHubs.has("cms")) {
    suggestions.push(
      "HubSpot Content Hub as the front-end content surface, with external infrastructure only where data or workflow complexity genuinely requires it."
    );
  }

  if (selectedHubs.has("data")) {
    suggestions.push(
      "Databox plus a staging database gives a pragmatic data-and-reporting layer without forcing all complexity into HubSpot on day one."
    );
  }

  if (selectedHubs.has("marketing")) {
    suggestions.push(
      "Databox can sit alongside HubSpot to give leadership cleaner executive and brand-level visibility before a broader Marketing Hub rollout."
    );
  }

  if (
    selectedHubs.has("data") ||
    includesAny(evidenceText, ["warehouse", "etl", "transform", "normalize"])
  ) {
    suggestions.push(
      "A lightweight ETL or transformation layer should own normalization and auditability so HubSpot only receives CRM-friendly summary records."
    );
  }

  if (input.serviceFamily === "custom_engineering") {
    suggestions.push(
      "A small engineering-owned staging service or self-hosted worker can keep complex processing outside HubSpot while still syncing CRM-friendly outputs back in."
    );
  }

  return uniqueList(suggestions, 5);
}

function deriveKeyRisksFallback(input: {
  evidenceText: string;
  packagingAssessment: PackagingAssessment;
}) {
  const risks: string[] = [];
  const evidenceText = input.evidenceText.toLowerCase();

  if (
    includesAny(evidenceText, ["duplicate", "dedupe", "identity", "attendance"])
  ) {
    risks.push(
      "Identity resolution may require manual review where duplicates, job changes, or inconsistent company naming reduce matching confidence."
    );
  }

  if (
    includesAny(evidenceText, ["api", "extract", "export", "current platform"])
  ) {
    risks.push(
      "Access limitations or poor source exports from the current platform could slow extraction, validation, and early proof-of-value work."
    );
  }

  if (
    includesAny(evidenceText, ["dashboard", "databox", "reporting", "brand"])
  ) {
    risks.push(
      "Reporting credibility depends on clean source data and agreed metric definitions, especially for brand crossover and attendance history."
    );
  }

  if (input.packagingAssessment.fit === "upgrade_needed") {
    risks.push(
      "The selected HubSpot packaging may constrain delivery unless the team explicitly agrees a workaround architecture or approves an upgrade path."
    );
  }

  if (
    includesAny(evidenceText, [
      "dashboard",
      "databox",
      "reporting",
      "executive",
      "brand reporting"
    ])
  ) {
    risks.push(
      "Dashboard value depends on agreeing metric definitions early, otherwise executives may lose confidence in the first reporting outputs."
    );
  }

  if (
    includesAny(evidenceText, ["documentation", "handover", "sop", "process"])
  ) {
    risks.push(
      "If documentation and SOP creation are not explicitly scoped, operational knowledge may stay trapped in delivery conversations and handover quality will vary."
    );
  }

  if (
    includesAny(evidenceText, ["phase 1", "poc", "proof of concept", "lean"])
  ) {
    risks.push(
      "Phase 1 can drift into a broader transformation unless the team keeps the POC tightly boxed around the agreed operational outcomes."
    );
  }

  return uniqueList(risks, 5);
}

function deriveNextQuestionsFallback(input: {
  evidenceText: string;
  packagingAssessment: PackagingAssessment;
}) {
  const questions: string[] = [];
  const evidenceText = input.evidenceText.toLowerCase();

  if (includesAny(evidenceText, ["api", "export", "extract", "platform"])) {
    questions.push(
      "What access is available to the current platform: API, database, scheduled export, or manual extracts?"
    );
  }

  if (includesAny(evidenceText, ["attendance", "registration", "event"])) {
    questions.push(
      "How do the source records distinguish registration, attendance, cancellation, no-show, and CPD completion today?"
    );
  }

  if (includesAny(evidenceText, ["duplicate", "identity", "company"])) {
    questions.push(
      "Which fields can be trusted most for identity resolution: email, phone, company, CRM ID, or another source key?"
    );
  }

  if (includesAny(evidenceText, ["dashboard", "reporting", "executive"])) {
    questions.push(
      "What are the minimum dashboards leadership needs in the first 30 days to treat the POC as successful?"
    );
  }

  if (input.packagingAssessment.fit === "upgrade_needed") {
    questions.push(
      "Is the client comfortable with a workaround-led Phase 1, or do they want to approve a HubSpot packaging uplift before delivery starts?"
    );
  }

  if (
    includesAny(evidenceText, [
      "dashboard",
      "databox",
      "reporting",
      "executive"
    ])
  ) {
    questions.push(
      "Which executive, operational, and brand-level metrics must appear in the first reporting release for this POC to be judged successful?"
    );
  }

  if (
    includesAny(evidenceText, ["documentation", "handover", "sop", "process"])
  ) {
    questions.push(
      "Does the client want Muloo to include a paid SOP and documentation pack covering the data model, operating process, and handover guidance?"
    );
  }

  return uniqueList(questions, 5);
}

function ensureMinimumRecommendations(
  items: string[],
  fallbacks: string[],
  minimum: number,
  maxItems = 5
) {
  if (items.length >= minimum) {
    return uniqueList(items, maxItems);
  }

  return uniqueList([...items, ...fallbacks], maxItems);
}

function deriveDefaultSupportingTools(input: {
  selectedHubs: string[];
  packagingAssessment: PackagingAssessment;
}) {
  const suggestions: string[] = [];
  const selectedHubs = new Set(input.selectedHubs);

  suggestions.push(
    "Databox for executive and operational dashboards layered over HubSpot once the core CRM views are in place."
  );

  if (selectedHubs.has("data") || input.packagingAssessment.fit !== "good") {
    suggestions.push(
      "A lightweight staging database such as Railway Postgres, Supabase, or Azure SQL to keep normalization and auditability outside HubSpot."
    );
  }

  suggestions.push(
    "A small middleware or sync layer to control extraction, transformation, and CRM-safe data delivery into HubSpot."
  );

  suggestions.push(
    "Documentation & SOP Pack as a paid bolt-on so the agreed model, process rules, and handover guidance do not stay trapped in delivery conversations."
  );

  return uniqueList(suggestions, 5);
}

function deriveDefaultKeyRisks(input: {
  packagingAssessment: PackagingAssessment;
}) {
  const risks: string[] = [
    "The current source data may require more manual cleanup than expected before duplicate resolution is reliable.",
    "A boxed Phase 1 can still drift if the team starts solving full future-state requirements instead of the agreed POC outcomes.",
    "Reporting trust will depend on agreeing metric definitions and sample validation early, otherwise leadership may challenge the outputs."
  ];

  if (input.packagingAssessment.fit !== "good") {
    risks.push(
      "The chosen HubSpot packaging may only work if the team accepts a workaround architecture and keeps the complex model outside HubSpot."
    );
  }

  return uniqueList(risks, 5);
}

function deriveDefaultNextQuestions(input: {
  packagingAssessment: PackagingAssessment;
}) {
  const questions: string[] = [
    "What is the minimum sample data set we can use to prove identity resolution, attendance history, and brand participation in Phase 1?",
    "Which dashboards or metrics must leadership see in the first release for the POC to be treated as successful?",
    "Which parts of the current process must stay manual in Phase 1, and which parts genuinely need to be automated now?"
  ];

  if (input.packagingAssessment.fit !== "good") {
    questions.push(
      "Is the client comfortable with a workaround-led Phase 1, or do they want to approve a HubSpot packaging uplift before delivery starts?"
    );
  }

  return uniqueList(questions, 5);
}

function deriveStandaloneSummaryFallback(input: {
  discoveryPayload: NonNullable<
    Awaited<ReturnType<typeof loadProjectDiscoveryForBlueprint>>
  >;
  packagingAssessment: PackagingAssessment;
  evidenceText: string;
}) {
  const { discoveryPayload, packagingAssessment } = input;
  const clientName = discoveryPayload.discovery.client.name || "The client";
  const hubLabelMap: Record<string, string> = {
    sales: "Sales Hub",
    marketing: "Marketing Hub",
    service: "Service Hub",
    ops: "Operations Hub",
    cms: "Content Hub",
    data: "Data Hub",
    commerce: "Commerce Hub"
  };
  const selectedHubs = discoveryPayload.discovery.selectedHubs;
  const selectedHubLabels = selectedHubs.length
    ? selectedHubs.map((hub) => hubLabelMap[hub] ?? hub).join(", ")
    : "the selected HubSpot workspace";

  const recommendedApproach =
    discoveryPayload.project.solutionRecommendation?.trim() ||
    "Implement a boxed Phase 1 that keeps HubSpot as the operational front end and uses a lightweight external layer for the heavier data normalization work.";

  const executiveSummary = `${clientName} needs a practical Phase 1 that solves the immediate operational pain without forcing every data complexity directly into HubSpot. Start with a boxed implementation that cleans and consolidates source data outside HubSpot where needed, then syncs CRM-friendly records, audience views, and reporting outputs into ${selectedHubLabels}.`;

  const whyThisApproach =
    packagingAssessment.fit === "good"
      ? "This keeps the first release lean and usable for the team while still creating a clean foundation for later automation, enrichment, and broader HubSpot adoption."
      : "This keeps the first release lean and commercially sensible. Instead of loading packaging cost too early, the complex normalization work can sit outside HubSpot while HubSpot remains the operational CRM and reporting surface.";

  const phaseOneFocus =
    "Phase 1 should prove the working model: extract a representative sample, normalize and deduplicate it, push clean CRM-friendly records into HubSpot, and give the team usable views and reporting they can trust.";

  const futureUpgradePath =
    packagingAssessment.fit === "good"
      ? "If Phase 1 proves value, later work can add automation, enrichment, and broader operational rollout without reworking the core model."
      : "If Phase 1 proves value, later work can uplift HubSpot packaging where genuinely needed and move deeper automation, enrichment, or native modeling into the roadmap rather than forcing it all into the first release.";

  const inScopeItems = uniqueList(
    [
      "Current-state source and access review",
      "Data extraction and staging layer setup",
      "Deduplication and identity-resolution rules",
      "HubSpot CRM configuration for the agreed Phase 1 audience model",
      "Core reporting and validation for the POC"
    ],
    6
  );

  const outOfScopeItems = uniqueList(
    [
      "Full source-platform replacement or redesign",
      "Broader marketing automation rollout",
      "Advanced workflow and lifecycle orchestration",
      "Complete historical data perfection where source quality is weak",
      "Unscoped SOP/documentation pack unless added as a paid bolt-on"
    ],
    6
  );

  const mainPainPoints = uniqueList(
    [
      "Fragmented or duplicated records make it hard to trust attendance and audience history.",
      "Operational teams do not have one clean view of the audience inside HubSpot.",
      "Reporting is constrained by source-system structure and inconsistent data quality.",
      "Current setup limits segmentation, communication planning, and strategic reuse of the audience database."
    ],
    5
  );

  return {
    executiveSummary,
    mainPainPoints,
    recommendedApproach,
    whyThisApproach,
    phaseOneFocus,
    futureUpgradePath,
    inScopeItems,
    outOfScopeItems,
    engagementTrack: "Technical implementation",
    platformFit:
      packagingAssessment.fit === "good"
        ? "HubSpot-led Phase 1 with supporting architecture where required"
        : "HubSpot front end with workaround architecture for the heavier data layer",
    changeManagementRating: "medium",
    dataReadinessRating: "medium",
    scopeVolatilityRating: "medium"
  };
}

function deriveBlueprintGuidance(
  discoveryPayload: NonNullable<
    Awaited<ReturnType<typeof loadProjectDiscoveryForBlueprint>>
  >
) {
  const evidenceText = getDiscoveryEvidenceText(discoveryPayload);
  const selectedHubs = new Set(discoveryPayload.discovery.selectedHubs);
  const engagementType = discoveryPayload.discovery.engagementType;

  const hasMigrationScope =
    engagementType === "MIGRATION" ||
    includesAny(evidenceText, [
      "migration",
      "migrate",
      "import",
      "legacy crm",
      "salesforce",
      "freshworks",
      "historical data",
      "excel",
      "outlook"
    ]);
  const hasWebsiteScope =
    selectedHubs.has("cms") ||
    includesAny(evidenceText, [
      "website",
      "cms",
      "site",
      "landing page",
      "brand refresh",
      "rebuild",
      "template",
      "seo"
    ]);
  const hasReportingScope = includesAny(evidenceText, [
    "report",
    "dashboard",
    "kpi",
    "attribution"
  ]);
  const hasMarketingScope =
    selectedHubs.has("marketing") ||
    includesAny(evidenceText, [
      "campaign",
      "form",
      "lead",
      "lifecycle",
      "email nurture",
      "segmentation"
    ]);
  const hasSalesScope =
    selectedHubs.has("sales") ||
    includesAny(evidenceText, [
      "pipeline",
      "deal",
      "sales",
      "mql",
      "sql",
      "qualification"
    ]);
  const hasServiceScope =
    selectedHubs.has("service") ||
    includesAny(evidenceText, [
      "service",
      "ticket",
      "support",
      "help desk",
      "customer portal"
    ]);
  const hasDataScope =
    selectedHubs.has("data") ||
    includesAny(evidenceText, [
      "data quality",
      "enrichment",
      "dedupe",
      "duplicate",
      "data sync",
      "warehouse",
      "staging layer"
    ]);
  const hasCommerceScope =
    selectedHubs.has("commerce") ||
    includesAny(evidenceText, [
      "quote",
      "invoice",
      "payment",
      "checkout",
      "subscription",
      "commerce"
    ]);
  const hasCrmFoundationScope =
    selectedHubs.has("sales") ||
    selectedHubs.has("marketing") ||
    selectedHubs.has("service") ||
    selectedHubs.has("ops") ||
    includesAny(evidenceText, [
      "crm",
      "contact",
      "company",
      "deal",
      "lead status",
      "lifecycle stage",
      "pipeline",
      "property",
      "properties",
      "record",
      "records",
      "ticket",
      "inbox"
    ]);
  const recommendedModules = [
    hasCrmFoundationScope ? "CRM Core Foundation" : null,
    hasSalesScope ? "Sales Hub Core" : null,
    hasMarketingScope ? "Marketing Hub Foundation" : null,
    hasServiceScope ? "Service Hub Core" : null,
    hasWebsiteScope ? "CMS / Website Foundation" : null,
    hasDataScope ? "Data Hub Foundation" : null,
    hasCommerceScope ? "Commerce Hub Foundation" : null,
    hasMigrationScope ? "Data Migration Foundation" : null,
    hasReportingScope ? "Reporting Foundation" : null
  ].filter((module): module is string => Boolean(module));

  return {
    hasMigrationScope,
    hasWebsiteScope,
    hasReportingScope,
    hasMarketingScope,
    hasSalesScope,
    hasServiceScope,
    hasDataScope,
    hasCommerceScope,
    recommendedModules
  };
}

function classifyBlueprintTaskType(
  taskName: string
): (typeof blueprintTaskTypeValues)[number] {
  const normalizedName = taskName.toLowerCase();
  const clientKeywords = [
    "approve",
    "confirm",
    "provide",
    "share",
    "grant",
    "review",
    "sign off",
    "finalize",
    "complete",
    "billing",
    "license",
    "seat",
    "stakeholder",
    "owner"
  ];
  const agentKeywords = [
    "generate",
    "prepare",
    "draft",
    "compile",
    "inventory",
    "checklist",
    "mapping",
    "issue log",
    "validate",
    "qa",
    "preflight",
    "audit"
  ];
  const manualOnlyKeywords = [
    "configure",
    "build",
    "design",
    "implement",
    "conduct",
    "train",
    "perform",
    "execute",
    "establish",
    "align",
    "set up",
    "create dashboard",
    "reporting views"
  ];

  if (includesAny(normalizedName, clientKeywords)) {
    return "Client";
  }

  if (
    includesAny(normalizedName, agentKeywords) &&
    !includesAny(normalizedName, manualOnlyKeywords)
  ) {
    return "Agent";
  }

  return "Human";
}

function normalizeBlueprintEffort(
  taskType: (typeof blueprintTaskTypeValues)[number],
  effortHours: number
) {
  const roundedHours = Math.max(1, Math.round(effortHours));

  switch (taskType) {
    case "Agent":
      return Math.min(Math.max(roundedHours, 1), 4);
    case "Client":
      return Math.min(Math.max(roundedHours, 1), 6);
    case "Human":
      return Math.min(Math.max(roundedHours, 2), 12);
  }
}

function applyImplementationApproachToEffort(
  implementationApproach: string | null | undefined,
  taskType: (typeof blueprintTaskTypeValues)[number],
  effortHours: number
) {
  if (implementationApproach !== "pragmatic_poc") {
    return effortHours;
  }

  if (taskType === "Human") {
    return Math.max(1, Math.round(effortHours * 0.75));
  }

  return effortHours;
}

function taskMatchesScope(
  taskName: string,
  guidance: ReturnType<typeof deriveBlueprintGuidance>
) {
  const normalizedName = taskName.toLowerCase();

  if (
    !guidance.hasWebsiteScope &&
    includesAny(normalizedName, [
      "website",
      "cms",
      "page",
      "template",
      "seo",
      "theme",
      "landing page"
    ])
  ) {
    return false;
  }

  if (
    !guidance.hasMigrationScope &&
    includesAny(normalizedName, [
      "migration",
      "import",
      "legacy",
      "dedupe",
      "cutover",
      "historical data"
    ])
  ) {
    return false;
  }

  if (
    !guidance.hasServiceScope &&
    includesAny(normalizedName, ["service", "ticket", "support", "help desk"])
  ) {
    return false;
  }

  if (
    !guidance.hasDataScope &&
    includesAny(normalizedName, [
      "data",
      "dedupe",
      "duplicate",
      "enrichment",
      "sync"
    ])
  ) {
    return false;
  }

  if (
    !guidance.hasCommerceScope &&
    includesAny(normalizedName, [
      "commerce",
      "payment",
      "invoice",
      "checkout",
      "subscription"
    ])
  ) {
    return false;
  }

  return true;
}

function normalizeGeneratedBlueprint(
  blueprint: z.infer<typeof blueprintGenerationSchema>,
  discoveryPayload: NonNullable<
    Awaited<ReturnType<typeof loadProjectDiscoveryForBlueprint>>
  >
) {
  const guidance = deriveBlueprintGuidance(discoveryPayload);
  const packagingAssessment = derivePlatformPackagingAssessment({
    selectedHubs: discoveryPayload.project.selectedHubs,
    implementationApproach: discoveryPayload.project.implementationApproach,
    customerPlatformTier: discoveryPayload.project.customerPlatformTier,
    platformTierSelections: normalizePlatformTierSelections(
      discoveryPayload.project.platformTierSelections
    ),
    evidenceText: getDiscoveryEvidenceText(discoveryPayload)
  });

  const normalizedPhases = blueprint.phases
    .map((phase, phaseIndex) => {
      const dedupedTasks = Array.from(
        new Map(
          phase.tasks.map((task) => [task.name.trim().toLowerCase(), task])
        ).values()
      );

      const scopedTasks = dedupedTasks
        .filter((task) => taskMatchesScope(task.name, guidance))
        .map((task, taskIndex) => {
          const taskType = classifyBlueprintTaskType(task.name);

          return {
            ...task,
            type: taskType,
            effortHours: applyImplementationApproachToEffort(
              discoveryPayload.project.implementationApproach,
              taskType,
              normalizeBlueprintEffort(taskType, task.effortHours)
            ),
            order: taskIndex + 1
          };
        });

      return {
        phase: phaseIndex + 1,
        phaseName: phase.phaseName,
        tasks: scopedTasks
      };
    })
    .filter((phase) => phase.tasks.length > 0);

  if (normalizedPhases.length > 0 && packagingAssessment.fit !== "good") {
    const firstPhase = normalizedPhases[0];
    if (firstPhase) {
      const alreadyHasPackagingTask = firstPhase.tasks.some((task) =>
        includesAny(task.name.toLowerCase(), [
          "package",
          "tier",
          "upgrade",
          "licen"
        ])
      );

      if (!alreadyHasPackagingTask) {
        firstPhase.tasks.unshift({
          name:
            packagingAssessment.fit === "upgrade_needed"
              ? "Approve required HubSpot package upgrade or agreed workaround"
              : "Confirm selected HubSpot packaging and scope assumptions",
          type: "Client",
          effortHours: 1,
          order: 1
        });
        firstPhase.tasks = firstPhase.tasks.map((task, index) => ({
          ...task,
          order: index + 1
        }));
      }
    }
  }

  return blueprintGenerationSchema.parse({
    phases:
      normalizedPhases.length > 0
        ? normalizedPhases
        : buildFallbackBlueprint(discoveryPayload).phases
  });
}

type StandalonePlanSeedTask = {
  title: string;
  description: string;
  category: string;
  executionType: string;
  assigneeType: string;
  priority: string;
  status: string;
  qaRequired?: boolean;
  approvalRequired?: boolean;
  dependsOn?: string[];
  plannedHours?: number | null;
  executionReadiness?: string;
};

function buildPlanSeedFromTemplate(template: {
  tasks: Array<{
    title: string;
    description: string | null;
    category: string | null;
    executionType: string;
    assigneeType: string | null;
    priority: string;
    status: string;
    qaRequired: boolean;
    approvalRequired: boolean;
    plannedHours: number | null;
  }>;
}): StandalonePlanSeedTask[] {
  return template.tasks.map((task) => ({
    title: task.title,
    description: task.description ?? "",
    category: task.category ?? "Planned Delivery",
    executionType: task.executionType,
    assigneeType: task.assigneeType ?? "Human",
    priority: task.priority,
    status: task.status,
    qaRequired: task.qaRequired,
    approvalRequired: task.approvalRequired,
    plannedHours: task.plannedHours ?? null,
    executionReadiness:
      task.assigneeType === "Agent" ? "ready_with_review" : "not_ready"
  }));
}

function buildStandalonePlanSeed(
  project: {
    name: string;
    commercialBrief: string | null;
    implementationApproach?: string | null;
    customerPlatformTier?: string | null;
    platformTierSelections?: Record<string, string> | null;
    selectedHubs?: string[];
  },
  evidenceItems: Array<{
    sourceLabel: string;
    sourceUrl: string | null;
    content: string | null;
  }>
) {
  const scopeText = [
    project.name,
    project.commercialBrief ?? "",
    ...evidenceItems.flatMap((item) => [
      item.sourceLabel,
      item.sourceUrl ?? "",
      item.content ?? ""
    ])
  ]
    .join(" \n")
    .toLowerCase();
  const packagingAssessment = derivePlatformPackagingAssessment({
    selectedHubs: project.selectedHubs ?? ["cms"],
    implementationApproach: project.implementationApproach,
    customerPlatformTier: project.customerPlatformTier,
    platformTierSelections: project.platformTierSelections ?? {},
    evidenceText: scopeText
  });

  const hasLocalization = includesAny(scopeText, [
    "local",
    "localized",
    "localised",
    "region",
    "regional",
    "uk",
    "usa",
    "canada",
    "aus",
    "australia",
    "smart content",
    "multi-region"
  ]);
  const hasBlog = includesAny(scopeText, ["blog", "article", "post"]);
  const hasMigration = includesAny(scopeText, [
    "replace",
    "webflow",
    "migration",
    "migrate",
    "existing site"
  ]);
  const hasSystemPages = includesAny(scopeText, [
    "system pages",
    "404",
    "500",
    "search",
    "subscription",
    "preferences",
    "password"
  ]);
  const packagingDependencyTitle =
    packagingAssessment.fit !== "good"
      ? packagingAssessment.fit === "upgrade_needed"
        ? "Approve required HubSpot tier upgrade or workaround"
        : "Confirm selected HubSpot package and product tiers"
      : null;

  const tasks: StandalonePlanSeedTask[] = [
    ...(packagingAssessment.fit !== "good"
      ? [
          {
            title:
              packagingAssessment.fit === "upgrade_needed"
                ? "Resolve HubSpot packaging gap before implementation"
                : "Confirm HubSpot packaging assumptions before delivery",
            description:
              `${packagingAssessment.summary} ${packagingAssessment.warnings.join(" ")}`.trim(),
            category: "00 Platform Packaging",
            executionType: "manual",
            assigneeType: "Human",
            priority: "high",
            status: "todo",
            approvalRequired: packagingAssessment.fit === "upgrade_needed",
            executionReadiness: "not_ready",
            plannedHours: 2
          },
          {
            title:
              packagingAssessment.fit === "upgrade_needed"
                ? "Approve required HubSpot tier upgrade or workaround"
                : "Confirm selected HubSpot package and product tiers",
            description: packagingAssessment.recommendedNextStep,
            category: "00 Platform Packaging",
            executionType: "client_approval",
            assigneeType: "Client",
            priority: "high",
            status: "waiting_on_client",
            approvalRequired: true,
            plannedHours: 1,
            dependsOn: [
              packagingAssessment.fit === "upgrade_needed"
                ? "Resolve HubSpot packaging gap before implementation"
                : "Confirm HubSpot packaging assumptions before delivery"
            ]
          }
        ]
      : []),
    {
      title: "Confirm scope, assumptions, and delivery boundaries",
      description:
        "Lock the exact technical delivery scope, handoff points with the design/content partner, and what Muloo is explicitly not responsible for.",
      category: "01 Scope & Theme Approval",
      executionType: "manual",
      assigneeType: "Human",
      priority: "high",
      status: "todo",
      approvalRequired: true,
      executionReadiness: "not_ready",
      ...(packagingDependencyTitle
        ? { dependsOn: [packagingDependencyTitle] }
        : {})
    },
    {
      title: "Select and approve the marketplace theme",
      description:
        "Shortlist the theme, confirm fit against the required page types and localization needs, and obtain final approval before installation work starts.",
      category: "01 Scope & Theme Approval",
      executionType: "client_approval",
      assigneeType: "Client",
      priority: "high",
      status: "waiting_on_client",
      approvalRequired: true,
      dependsOn: ["Confirm scope, assumptions, and delivery boundaries"]
    },
    {
      title: "Install approved theme and configure CMS foundation",
      description:
        "Install the selected marketplace theme in HubSpot, create a safe working baseline, and confirm portal-level CMS configuration is ready for build work.",
      category: "02 CMS Foundation",
      executionType: "agent_ready",
      assigneeType: "Agent",
      priority: "high",
      status: "todo",
      executionReadiness: "ready_with_review",
      dependsOn: ["Select and approve the marketplace theme"]
    },
    {
      title: "Create child theme and technical customization layer",
      description:
        "Prepare the child theme or equivalent safe customization layer so implementation work stays upgrade-friendly and isolated from the base theme.",
      category: "02 CMS Foundation",
      executionType: "manual",
      assigneeType: "Human",
      priority: "high",
      status: "todo",
      dependsOn: ["Install approved theme and configure CMS foundation"]
    }
  ];

  if (hasSystemPages) {
    tasks.push({
      title: "Configure required HubSpot system pages",
      description:
        "Set up the system page set required for this site, including error, search, password, subscription, and preferences experiences as needed.",
      category: "03 Core Site Structure",
      executionType: "agent_ready",
      assigneeType: "Agent",
      priority: "medium",
      status: "todo",
      executionReadiness: "ready_with_review",
      dependsOn: ["Create child theme and technical customization layer"]
    });
  }

  if (hasBlog) {
    tasks.push({
      title: "Configure blog structure and publishing settings",
      description:
        "Set up the blog foundation, templates, listing/detail behavior, and any region-specific publishing considerations required for launch.",
      category: "03 Core Site Structure",
      executionType: "manual",
      assigneeType: "Human",
      priority: "medium",
      status: "todo",
      executionReadiness: "ready_with_review",
      dependsOn: ["Create child theme and technical customization layer"]
    });
  }

  tasks.push({
    title: "Define localization approach and content-routing rules",
    description:
      "Confirm whether localization will use smart content, regional page variants, or another supported model, and document the routing logic before build begins.",
    category: "04 Localization Design",
    executionType: "manual",
    assigneeType: "Human",
    priority: "high",
    status: "todo",
    dependsOn: ["Create child theme and technical customization layer"]
  });

  if (hasLocalization) {
    tasks.push({
      title: "Build regional site framework for required geographies",
      description:
        "Create the page structure, shared components, and localization scaffolding for the required regional variants in the portal.",
      category: "04 Localization Design",
      executionType: "agent_ready",
      assigneeType: "Agent",
      priority: "high",
      status: "todo",
      executionReadiness: "ready_with_review",
      dependsOn: ["Define localization approach and content-routing rules"]
    });
  }

  tasks.push(
    {
      title: "Receive approved content and design assets from partner",
      description:
        "Collect Figma, copy, asset packs, and any regional content or page-mapping guidance needed for implementation.",
      category: "05 Partner Handoff",
      executionType: "client_dependency",
      assigneeType: "Client",
      priority: "high",
      status: "waiting_on_client",
      dependsOn: ["Define localization approach and content-routing rules"]
    },
    {
      title: "Implement page templates, linking, and technical configuration",
      description:
        "Apply the approved design/content handoff to the HubSpot build, wire templates and navigation, and complete the core technical implementation.",
      category: "06 Build & Linking",
      executionType: "manual",
      assigneeType: "Human",
      priority: "high",
      status: "todo",
      dependsOn: ["Receive approved content and design assets from partner"]
    }
  );

  if (hasMigration) {
    tasks.push({
      title: "Migrate agreed website content from the existing site",
      description:
        "Move the agreed content set from the legacy site into the new HubSpot structure, preserving the approved content hierarchy and page intent.",
      category: "06 Build & Linking",
      executionType: "manual",
      assigneeType: "Human",
      priority: "medium",
      status: "todo",
      dependsOn: ["Receive approved content and design assets from partner"]
    });
  }

  tasks.push(
    {
      title: "Run QA across templates, links, and regional variants",
      description:
        "Check page behavior, links, localization logic, responsive rendering, and technical quality before launch sign-off.",
      category: "07 QA & Launch",
      executionType: "agent_ready",
      assigneeType: "Agent",
      priority: "high",
      status: "todo",
      qaRequired: true,
      executionReadiness: "ready_with_review",
      dependsOn: [
        "Implement page templates, linking, and technical configuration"
      ]
    },
    {
      title: "Prepare launch checklist and go-live plan",
      description:
        "Confirm launch dependencies, domain steps, partner approvals, and the sequence for go-live so cutover happens in a controlled way.",
      category: "07 QA & Launch",
      executionType: "manual",
      assigneeType: "Human",
      priority: "high",
      status: "todo",
      dependsOn: ["Run QA across templates, links, and regional variants"]
    },
    {
      title: "Complete go-live and handover support",
      description:
        "Execute launch, monitor the deployment, tidy defects, and close the project with a clean technical handover and support notes.",
      category: "08 Go-Live & Handover",
      executionType: "manual",
      assigneeType: "Human",
      priority: "high",
      status: "todo",
      qaRequired: true,
      dependsOn: ["Prepare launch checklist and go-live plan"]
    }
  );

  return tasks;
}

async function loadPreferredAgentIdsByServiceFamily(serviceFamily: string) {
  const agents = await prisma.agentDefinition.findMany({
    where: {
      isActive: true,
      serviceFamily
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      allowedActions: true,
      purpose: true,
      name: true
    }
  });

  return agents;
}

function scoreAgentForTask(
  agent: { allowedActions: string[]; purpose: string; name: string },
  task: {
    title: string;
    description: string;
    category: string;
    executionType: string;
  }
) {
  const searchableText = [
    task.title,
    task.description,
    task.category,
    task.executionType
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;
  for (const action of agent.allowedActions) {
    const normalizedAction = action.toLowerCase();
    const actionKeywords = Array.from(
      new Set(
        [
          normalizedAction,
          ...normalizedAction.split(/[-_]/g),
          ...(normalizedAction.includes("property")
            ? ["field", "properties", "schema"]
            : []),
          ...(normalizedAction.includes("pipeline")
            ? ["stage", "dealstage"]
            : []),
          ...(normalizedAction.includes("record")
            ? ["contact", "company", "deal", "ticket", "object"]
            : []),
          ...(normalizedAction.includes("workflow")
            ? ["automation", "trigger", "enrollment"]
            : []),
          ...(normalizedAction.includes("qa") ||
          normalizedAction.includes("review")
            ? ["validate", "audit", "check"]
            : [])
        ].filter((keyword) => keyword.length > 2)
      )
    );

    for (const keyword of actionKeywords) {
      if (searchableText.includes(keyword)) {
        score += 3;
      }
    }
  }

  const purposeText = `${agent.name} ${agent.purpose}`.toLowerCase();
  for (const keyword of searchableText.split(/\W+/)) {
    if (keyword.length > 3 && purposeText.includes(keyword)) {
      score += 1;
    }
  }

  return score;
}

function pickAgentForTask(
  agents: Array<{
    id: string;
    allowedActions: string[];
    purpose: string;
    name: string;
  }>,
  task: {
    title: string;
    description: string;
    category: string;
    executionType: string;
    assigneeType: string;
  }
) {
  if (task.assigneeType !== "Agent" || agents.length === 0) {
    return null;
  }

  const ranked = agents
    .map((agent) => ({
      agent,
      score: scoreAgentForTask(agent, task)
    }))
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.agent.id ?? null;
}

async function resolveAssignedAgentIdForTask(
  projectId: string,
  task: {
    title: string;
    description: string;
    category: string;
    executionType: string;
    assigneeType: string;
  },
  explicitAssignedAgentId?: string | null
) {
  if (task.assigneeType !== "Agent") {
    return null;
  }

  if (explicitAssignedAgentId?.trim()) {
    return explicitAssignedAgentId.trim();
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { serviceFamily: true }
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const availableAgents = await loadPreferredAgentIdsByServiceFamily(
    project.serviceFamily
  );

  return pickAgentForTask(availableAgents, task);
}

async function generateStandaloneProjectPlan(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      serviceFamily: true,
      scopeType: true,
      commercialBrief: true,
      customerPlatformTier: true,
      platformTierSelections: true,
      selectedHubs: true,
      deliveryTemplate: {
        include: {
          tasks: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
          }
        }
      }
    }
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.scopeType !== "standalone_quote") {
    throw new Error(
      "Generated project plans are currently only available for standalone scoped jobs"
    );
  }

  const [evidenceItems, availableAgents] = await Promise.all([
    loadDiscoveryEvidence(projectId, 0),
    loadPreferredAgentIdsByServiceFamily(project.serviceFamily)
  ]);
  const taskSeed =
    project.deliveryTemplate && project.deliveryTemplate.tasks.length > 0
      ? buildPlanSeedFromTemplate(project.deliveryTemplate)
      : buildStandalonePlanSeed(
          {
            name: project.name,
            commercialBrief: project.commercialBrief,
            customerPlatformTier: project.customerPlatformTier,
            platformTierSelections: normalizePlatformTierSelections(
              project.platformTierSelections
            ),
            selectedHubs: project.selectedHubs
          },
          evidenceItems
        );

  await prisma.executionJob.deleteMany({
    where: {
      projectId,
      taskId: {
        not: null
      }
    }
  });
  await prisma.task.deleteMany({
    where: { projectId }
  });

  const createdTasks = [] as Array<
    Awaited<ReturnType<typeof prisma.task.create>>
  >;

  for (const task of taskSeed) {
    const createdTask = await prisma.task.create({
      data: {
        projectId,
        title: task.title,
        description: task.description,
        category: task.category,
        executionType: task.executionType,
        priority: task.priority,
        status: task.status,
        plannedHours: task.plannedHours ?? null,
        qaRequired: task.qaRequired ?? false,
        approvalRequired: task.approvalRequired ?? false,
        assigneeType: task.assigneeType,
        assignedAgentId: pickAgentForTask(availableAgents, task),
        executionReadiness:
          task.executionReadiness ??
          (task.assigneeType === "Agent" ? "ready_with_review" : "not_ready")
      }
    });

    createdTasks.push(createdTask);
  }

  const taskIdMap = new Map(createdTasks.map((task) => [task.title, task.id]));

  const updatedTasks = [] as typeof createdTasks;

  for (const createdTask of createdTasks) {
    const seed = taskSeed.find((task) => task.title === createdTask.title);
    const dependencyIds = (seed?.dependsOn ?? [])
      .map((dependencyTitle: string) => taskIdMap.get(dependencyTitle))
      .filter((dependencyId: string | undefined): dependencyId is string =>
        Boolean(dependencyId)
      );

    const updatedTask = await prisma.task.update({
      where: { id: createdTask.id },
      data: {
        dependencyIds
      }
    });

    updatedTasks.push(updatedTask);
  }

  return updatedTasks;
}

async function generateBlueprintProjectPlan(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      serviceFamily: true,
      quoteApprovalStatus: true,
      blueprint: {
        include: {
          tasks: {
            orderBy: [{ phase: "asc" }, { order: "asc" }]
          }
        }
      },
      quotes: {
        where: {
          status: "approved"
        },
        orderBy: [{ version: "desc" }],
        take: 1
      }
    }
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (!project.blueprint || project.blueprint.tasks.length === 0) {
    throw new Error(
      "Generate a blueprint first before creating the delivery board for this project"
    );
  }

  const approvedQuote = project.quotes[0] ?? null;
  const sourceTasks =
    project.quoteApprovalStatus === "approved"
      ? (() => {
          if (!approvedQuote) {
            throw new Error(
              "Approve and publish the quote before creating the delivery board for this project"
            );
          }

          const approvedPhaseLines = projectQuotePhaseLineSchema
            .array()
            .parse(approvedQuote.phaseLines)
            .filter((phase) => phase.included)
            .sort((left, right) => left.phase - right.phase);

          const quoteTasks = approvedPhaseLines.flatMap((phase) =>
            phase.tasks.map((task) => ({
              phase: phase.phase,
              phaseName: phase.phaseName,
              name: task.name,
              type: task.type,
              effortHours: task.effortHours
            }))
          );

          if (quoteTasks.length === 0) {
            throw new Error(
              "The approved quote does not include any delivery phases yet."
            );
          }

          return quoteTasks;
        })()
      : project.blueprint.tasks;

  const availableAgents = await loadPreferredAgentIdsByServiceFamily(
    project.serviceFamily
  );

  await prisma.executionJob.deleteMany({
    where: {
      projectId,
      taskId: {
        not: null
      }
    }
  });
  await prisma.task.deleteMany({
    where: { projectId }
  });

  const createdTasks = [] as Array<
    Awaited<ReturnType<typeof prisma.task.create>>
  >;

  for (const blueprintTask of sourceTasks) {
    const status =
      blueprintTask.type === "Client" ? "waiting_on_client" : "todo";
    const priority =
      blueprintTask.effortHours >= 8
        ? "high"
        : blueprintTask.effortHours >= 4
          ? "medium"
          : "low";
    const executionType =
      blueprintTask.type === "Agent"
        ? "agent_ready"
        : blueprintTask.type === "Client"
          ? "client_dependency"
          : "manual";

    const task = await prisma.task.create({
      data: {
        projectId,
        title: blueprintTask.name,
        description: `${
          project.quoteApprovalStatus === "approved"
            ? `Generated from approved quote phase ${blueprintTask.phase}: ${blueprintTask.phaseName}.`
            : `Generated from blueprint phase ${blueprintTask.phase}: ${blueprintTask.phaseName}.`
        } Planned effort: ${blueprintTask.effortHours} hour${
          blueprintTask.effortHours === 1 ? "" : "s"
        }.`,
        category: `Phase ${blueprintTask.phase} - ${blueprintTask.phaseName}`,
        executionType,
        priority,
        status,
        plannedHours: blueprintTask.effortHours,
        executionReadiness:
          blueprintTask.type === "Agent" ? "ready_with_review" : "not_ready",
        qaRequired:
          /qa|test|validation|launch/i.test(blueprintTask.name) ||
          /qa|launch/i.test(blueprintTask.phaseName),
        approvalRequired:
          blueprintTask.type === "Client" ||
          /approve|confirm|sign off|review/i.test(blueprintTask.name),
        assigneeType: blueprintTask.type,
        assignedAgentId: pickAgentForTask(availableAgents, {
          title: blueprintTask.name,
          description: `${
            project.quoteApprovalStatus === "approved"
              ? `Generated from approved quote phase ${blueprintTask.phase}: ${blueprintTask.phaseName}`
              : `Generated from blueprint phase ${blueprintTask.phase}: ${blueprintTask.phaseName}`
          }`,
          category: `Phase ${blueprintTask.phase} - ${blueprintTask.phaseName}`,
          executionType,
          assigneeType: blueprintTask.type
        })
      }
    });

    createdTasks.push(task);
  }

  return createdTasks;
}

async function generateProjectPlan(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      scopeType: true,
      blueprint: {
        select: {
          id: true
        }
      }
    }
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.blueprint?.id) {
    return generateBlueprintProjectPlan(projectId);
  }

  if (project.scopeType === "standalone_quote") {
    return generateStandaloneProjectPlan(projectId);
  }

  return generateBlueprintProjectPlan(projectId);
}

export async function ensureProjectPlanGenerationAllowed(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      quoteApprovalStatus: true,
      scopeLockedAt: true,
      _count: {
        select: {
          tasks: true
        }
      }
    }
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (!isProjectScopeLocked(project)) {
    return;
  }

  if (
    project.quoteApprovalStatus === "approved" &&
    project._count.tasks === 0
  ) {
    return;
  }

  throw new Error(
    "Approved scope is locked. Delivery scope can only be generated once from the approved quote."
  );
}

export async function loadProjectTasks(projectId: string) {
  const tasks = await prisma.task.findMany({
    where: { projectId },
    include: {
      assignedAgent: { select: { name: true } },
      approvals: {
        select: {
          id: true,
          status: true,
          requestedAt: true,
          approvedAt: true,
          rejectedAt: true,
          approvedBy: true,
          rejectedBy: true,
          notes: true
        },
        orderBy: [{ requestedAt: "desc" }],
        take: 1
      },
      executionJobs: {
        select: {
          id: true,
          status: true,
          resultStatus: true,
          outputSummary: true,
          createdAt: true,
          completedAt: true
        },
        orderBy: [{ createdAt: "desc" }],
        take: 1
      }
    },
    orderBy: [{ createdAt: "asc" }]
  });

  return tasks.map((task) => serializeTask(task));
}

const validTaskStatusTransitions = new Map<string, string[]>([
  ["backlog", ["todo"]],
  ["todo", ["in_progress"]],
  ["in_progress", ["blocked", "waiting_on_client", "done", "todo"]],
  ["waiting_on_client", ["in_progress"]],
  ["blocked", ["in_progress"]],
  ["done", ["in_progress", "todo"]]
]);

function isValidTaskTransition(currentStatus: string, nextStatus: string) {
  return validTaskStatusTransitions.get(currentStatus)?.includes(nextStatus) ?? false;
}

function buildGenericCoworkInstruction(input: {
  taskId: string;
  taskTitle: string;
  portalId?: string | null;
  brief?: string | null;
  manualInstructions?: string | null;
}) {
  const steps = (input.manualInstructions ?? input.brief ?? "")
    .split(/\n+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((description, index) => ({
      order: index + 1,
      action: "verify" as const,
      target: input.taskTitle,
      description
    }));

  return {
    id: `cowork-${input.taskId}`,
    taskType: "hubspot_dashboard_create" as const,
    portalId: input.portalId ?? "unknown",
    targetUrl: input.portalId
      ? `https://app-eu1.hubspot.com/home-dashboard?portalId=${encodeURIComponent(
          input.portalId
        )}`
      : "https://app-eu1.hubspot.com/",
    steps:
      steps.length > 0
        ? steps
        : [
            {
              order: 1,
              action: "verify" as const,
              target: input.taskTitle,
              description:
                input.brief ??
                "Review the task brief and complete the requested browser workflow."
            }
          ],
    expectedOutcome: `Task "${input.taskTitle}" completed in HubSpot.`,
    fallbackToManual: []
  };
}

async function loadLatestTaskApprovalRecord(projectId: string, taskId: string) {
  return prisma.taskApproval.findFirst({
    where: { projectId, taskId },
    orderBy: [{ requestedAt: "desc" }]
  });
}

async function createExecutionJobForTask(input: {
  actor: string;
  projectId: string;
  task: {
    id: string;
    title: string;
    executionType: string;
    agentModuleKey: string | null;
    executionPayload: Prisma.Prisma.JsonValue | null;
    coworkBrief: string | null;
    manualInstructions: string | null;
    project: {
      portalId: string;
      name: string;
    };
  };
  dryRun?: boolean;
  sessionId?: string | null;
}) {
  const executionPayload =
    input.task.executionPayload &&
    typeof input.task.executionPayload === "object" &&
    !Array.isArray(input.task.executionPayload)
      ? (input.task.executionPayload as Record<string, unknown>)
      : {};
  const executionType = input.task.executionType.trim().toLowerCase();
  const moduleKey =
    input.task.agentModuleKey?.trim() ||
    (executionType === "api" ? "generic" : "cowork");
  const isDryRun = input.dryRun ?? false;

  if (executionType === "cowork") {
    const coworkInstruction = buildGenericCoworkInstruction({
      taskId: input.task.id,
      taskTitle: input.task.title,
      portalId:
        typeof executionPayload.portalId === "string"
          ? executionPayload.portalId
          : input.task.project.portalId,
      brief: input.task.coworkBrief,
      manualInstructions: input.task.manualInstructions
    });

    const job = await prisma.executionJob.create({
      data: {
        projectId: input.projectId,
        taskId: input.task.id,
        moduleKey,
        executionMethod: "cowork",
        mode: isDryRun ? "dry-run" : "apply",
        status: "queued",
        resultStatus: "cowork_pending",
        executionTier: 3,
        coworkInstruction,
        payload: executionPayload as Prisma.Prisma.InputJsonValue,
        outputSummary: "Queued cowork execution."
      },
      include: {
        project: { select: { name: true } },
        task: { select: { title: true } }
      }
    });

    await audit(input.actor, "execution.created", "ExecutionJob", job.id, {
      projectId: input.projectId,
      after: {
        moduleKey: job.moduleKey,
        executionMethod: job.executionMethod,
        status: job.status
      },
      metadata: { taskId: input.task.id, executionType }
    });

    return serializeExecutionJob(job);
  }

  const payload: Record<string, unknown> = {
    ...executionPayload,
    ...(input.sessionId ? { sessionId: input.sessionId } : {})
  };

  const job = await prisma.executionJob.create({
    data: {
      projectId: input.projectId,
      taskId: input.task.id,
      moduleKey,
      executionMethod: "queue",
      mode: isDryRun ? "dry-run" : "apply",
      status: "queued",
      resultStatus: "pending",
      payload: payload as Prisma.Prisma.InputJsonValue,
      outputSummary: isDryRun
        ? "Queued dry-run task execution."
        : "Queued task execution."
    },
    include: {
      project: { select: { name: true } },
      task: { select: { title: true } }
    }
  });

  await executionQueue.add(
    job.moduleKey,
    {
      executionJobId: job.id,
      moduleKey: job.moduleKey,
      projectId: input.projectId,
      portalId:
        typeof payload["portalId"] === "string"
          ? (payload["portalId"] as string)
          : undefined,
      sessionId:
        typeof payload["sessionId"] === "string"
          ? (payload["sessionId"] as string)
          : undefined,
      dryRun: isDryRun,
      payload
    },
    { jobId: job.id }
  );

  await audit(input.actor, "execution.created", "ExecutionJob", job.id, {
    projectId: input.projectId,
    after: {
      moduleKey: job.moduleKey,
      executionMethod: job.executionMethod,
      status: job.status
    },
    metadata: { taskId: input.task.id, executionType }
  });

  return serializeExecutionJob(job);
}

export async function loadProjectTaskBoard(projectId: string) {
  const tasks = await prisma.task.findMany({
    where: { projectId },
    include: {
      assignedAgent: { select: { name: true } },
      approvals: {
        select: {
          id: true,
          status: true,
          requestedAt: true,
          approvedAt: true,
          rejectedAt: true,
          approvedBy: true,
          rejectedBy: true,
          notes: true
        },
        orderBy: [{ requestedAt: "desc" }],
        take: 1
      },
      executionJobs: {
        select: {
          id: true,
          status: true,
          resultStatus: true,
          outputSummary: true,
          createdAt: true,
          completedAt: true
        },
        orderBy: [{ createdAt: "desc" }],
        take: 1
      }
    },
    orderBy: [{ createdAt: "asc" }]
  });

  const serializedTasks = tasks.map((task) => serializeTask(task));
  const columns = {
    backlog: serializedTasks.filter((task) => task.status === "backlog"),
    todo: serializedTasks.filter((task) => task.status === "todo"),
    in_progress: serializedTasks.filter((task) => task.status === "in_progress"),
    waiting_on_client: serializedTasks.filter(
      (task) => task.status === "waiting_on_client"
    ),
    blocked: serializedTasks.filter((task) => task.status === "blocked"),
    done: serializedTasks.filter((task) => task.status === "done")
  };
  const executionJobs = Object.fromEntries(
    serializedTasks
      .filter((task) => task.latestExecutionJob)
      .map((task) => [
        task.id,
        {
          jobId: task.latestExecutionJob?.id,
          status: task.latestExecutionJob?.status,
          completedAt: task.latestExecutionJob?.completedAt ?? null
        }
      ])
  );

  return { columns, executionJobs };
}

export async function loadTaskApproval(projectId: string, taskId: string) {
  const approval = await loadLatestTaskApprovalRecord(projectId, taskId);

  if (!approval) {
    return null;
  }

  return {
    id: approval.id,
    taskId: approval.taskId,
    projectId: approval.projectId,
    status: approval.status,
    requestedAt: approval.requestedAt.toISOString(),
    approvedAt: approval.approvedAt?.toISOString() ?? null,
    rejectedAt: approval.rejectedAt?.toISOString() ?? null,
    approvedBy: approval.approvedBy ?? null,
    rejectedBy: approval.rejectedBy ?? null,
    notes: approval.notes ?? null
  };
}

export async function requestTaskApproval(input: {
  actor: string;
  projectId: string;
  taskId: string;
  notes?: string | null;
}) {
  const task = await prisma.task.findFirst({
    where: { id: input.taskId, projectId: input.projectId }
  });

  if (!task) {
    throw new Error("Task not found");
  }

  const approval = await prisma.taskApproval.create({
    data: {
      taskId: input.taskId,
      projectId: input.projectId,
      notes: input.notes?.trim() || null
    }
  });

  await audit(input.actor, "task.approval_requested", "Task", task.id, {
    projectId: input.projectId,
    metadata: { approvalId: approval.id }
  });

  return { approvalId: approval.id };
}

export async function approveTaskApproval(input: {
  actor: string;
  projectId: string;
  taskId: string;
  notes?: string | null;
}) {
  const approval = await loadLatestTaskApprovalRecord(input.projectId, input.taskId);

  if (!approval) {
    throw new Error("Task approval not found");
  }

  const updated = await prisma.taskApproval.update({
    where: { id: approval.id },
    data: {
      status: "approved",
      approvedAt: new Date(),
      approvedBy: input.actor,
      rejectedAt: null,
      rejectedBy: null,
      notes: input.notes?.trim() || approval.notes
    }
  });

  await audit(input.actor, "task.approved", "Task", input.taskId, {
    projectId: input.projectId,
    metadata: { approvalId: updated.id }
  });

  return { approved: true };
}

export async function rejectTaskApproval(input: {
  actor: string;
  projectId: string;
  taskId: string;
  notes?: string | null;
}) {
  const approval = await loadLatestTaskApprovalRecord(input.projectId, input.taskId);

  if (!approval) {
    throw new Error("Task approval not found");
  }

  const updated = await prisma.taskApproval.update({
    where: { id: approval.id },
    data: {
      status: "rejected",
      rejectedAt: new Date(),
      rejectedBy: input.actor,
      notes: input.notes?.trim() || approval.notes
    }
  });

  await audit(input.actor, "task.rejected", "Task", input.taskId, {
    projectId: input.projectId,
    metadata: { approvalId: updated.id }
  });

  return { rejected: true };
}

export async function transitionProjectTaskStatus(input: {
  actor: string;
  projectId: string;
  taskId: string;
  status: string;
}) {
  const task = await prisma.task.findFirst({
    where: { id: input.taskId, projectId: input.projectId },
    include: {
      assignedAgent: { select: { name: true } },
      approvals: {
        select: {
          id: true,
          status: true,
          requestedAt: true,
          approvedAt: true,
          rejectedAt: true,
          approvedBy: true,
          rejectedBy: true,
          notes: true
        },
        orderBy: [{ requestedAt: "desc" }],
        take: 1
      },
      executionJobs: {
        select: {
          id: true,
          status: true,
          resultStatus: true,
          outputSummary: true,
          createdAt: true,
          completedAt: true
        },
        orderBy: [{ createdAt: "desc" }],
        take: 1
      },
      project: {
        select: { portalId: true, name: true }
      }
    }
  });

  if (!task) {
    throw new Error("Task not found");
  }

  const nextStatus = input.status.trim();

  if (!validTaskStatusValues.includes(nextStatus as (typeof validTaskStatusValues)[number])) {
    throw new Error("Invalid task status");
  }

  if (!isValidTaskTransition(task.status, nextStatus)) {
    throw new Error("Invalid task status transition");
  }

  if (nextStatus === "done" && task.approvalRequired) {
    const latestApproval = task.approvals[0] ?? null;
    if (!latestApproval || latestApproval.status !== "approved") {
      throw new Error("This task requires approval before completion");
    }
  }

  const updatedTask = await prisma.task.update({
    where: { id: task.id },
    data: { status: nextStatus },
    include: {
      assignedAgent: { select: { name: true } },
      approvals: {
        select: {
          id: true,
          status: true,
          requestedAt: true,
          approvedAt: true,
          rejectedAt: true,
          approvedBy: true,
          rejectedBy: true,
          notes: true
        },
        orderBy: [{ requestedAt: "desc" }],
        take: 1
      },
      executionJobs: {
        select: {
          id: true,
          status: true,
          resultStatus: true,
          outputSummary: true,
          createdAt: true,
          completedAt: true
        },
        orderBy: [{ createdAt: "desc" }],
        take: 1
      }
    }
  });

  await audit(input.actor, "task.status_changed", "Task", task.id, {
    projectId: input.projectId,
    before: { status: task.status },
    after: { status: nextStatus }
  });

  if (task.executionType.trim().toLowerCase() === "api" && nextStatus === "in_progress") {
    await createExecutionJobForTask({
      actor: input.actor,
      projectId: input.projectId,
      task
    });

    const refreshedTask = await prisma.task.findFirstOrThrow({
      where: { id: task.id, projectId: input.projectId },
      include: {
        assignedAgent: { select: { name: true } },
        approvals: {
          select: {
            id: true,
            status: true,
            requestedAt: true,
            approvedAt: true,
            rejectedAt: true,
            approvedBy: true,
            rejectedBy: true,
            notes: true
          },
          orderBy: [{ requestedAt: "desc" }],
          take: 1
        },
        executionJobs: {
          select: {
            id: true,
            status: true,
            resultStatus: true,
            outputSummary: true,
            createdAt: true,
            completedAt: true
          },
          orderBy: [{ createdAt: "desc" }],
          take: 1
        }
      }
    });

    return serializeTask(refreshedTask);
  }

  return serializeTask(updatedTask);
}

export async function executeProjectTask(input: {
  actor: string;
  projectId: string;
  taskId: string;
  dryRun?: boolean;
  sessionId?: string | null;
}) {
  const task = await prisma.task.findFirst({
    where: { id: input.taskId, projectId: input.projectId },
    include: {
      project: {
        select: { portalId: true, name: true }
      }
    }
  });

  if (!task) {
    throw new Error("Task not found");
  }

  const executionType = task.executionType.trim().toLowerCase();

  if (!["api", "cowork"].includes(executionType)) {
    throw new Error("Task execution type is not runnable");
  }

  if (task.executionReadiness === "not_ready") {
    throw new Error("Task is not ready for execution");
  }

  if (task.approvalRequired) {
    const latestApproval = await loadLatestTaskApprovalRecord(
      input.projectId,
      input.taskId
    );

    if (!latestApproval || latestApproval.status !== "approved") {
      throw new Error("This task requires approval before execution");
    }
  }

  const serializedJob = await createExecutionJobForTask({
    actor: input.actor,
    projectId: input.projectId,
    task,
    ...(input.dryRun !== undefined ? { dryRun: input.dryRun } : {}),
    ...(input.sessionId ? { sessionId: input.sessionId } : {})
  });

  await prisma.task.update({
    where: { id: task.id },
    data: { status: "in_progress" }
  });

  await audit(input.actor, "task.execution_started", "Task", task.id, {
    projectId: input.projectId,
    metadata: { jobId: serializedJob.id }
  });

  return { jobId: serializedJob.id, status: "queued" };
}

export async function createProjectTask(
  projectId: string,
  value: {
    title?: unknown;
    description?: unknown;
    category?: unknown;
    executionType?: unknown;
    executionLaneRationale?: unknown;
    hubspotTierRequired?: unknown;
    coworkBrief?: unknown;
    manualInstructions?: unknown;
    apiPayload?: unknown;
    agentModuleKey?: unknown;
    executionPayload?: unknown;
    validationStatus?: unknown;
    validationEvidence?: unknown;
    findingId?: unknown;
    recommendationId?: unknown;
    priority?: unknown;
    status?: unknown;
    plannedHours?: unknown;
    actualHours?: unknown;
    qaRequired?: unknown;
    approvalRequired?: unknown;
    assigneeType?: unknown;
    executionReadiness?: unknown;
    assignedAgentId?: unknown;
  }
) {
  const status =
    typeof value.status === "string" &&
    validTaskStatusValues.includes(
      value.status as (typeof validTaskStatusValues)[number]
    )
      ? value.status
      : "todo";
  const assigneeType =
    typeof value.assigneeType === "string" &&
    validTaskAssigneeTypeValues.includes(
      value.assigneeType as (typeof validTaskAssigneeTypeValues)[number]
    )
      ? value.assigneeType
      : "Human";
  const assignedAgentId =
    assigneeType === "Agent" &&
    typeof value.assignedAgentId === "string" &&
    value.assignedAgentId.trim().length > 0
      ? value.assignedAgentId.trim()
      : null;
  const executionReadiness =
    typeof value.executionReadiness === "string" &&
    validTaskExecutionReadinessValues.includes(
      value.executionReadiness as (typeof validTaskExecutionReadinessValues)[number]
    )
      ? value.executionReadiness
      : assigneeType === "Agent"
        ? "ready_with_review"
        : "not_ready";
  const priority =
    typeof value.priority === "string" &&
    validTaskPriorityValues.includes(
      value.priority.toLowerCase() as (typeof validTaskPriorityValues)[number]
    )
      ? value.priority.toLowerCase()
      : "medium";
  const normalizedTitle = normalizeRequiredTaskString(value.title, "title");
  const normalizedDescription =
    normalizeOptionalTaskString(value.description) ?? "";
  const normalizedCategory = normalizeOptionalTaskString(value.category) ?? "";
  const normalizedExecutionType =
    normalizeOptionalTaskString(value.executionType) ?? "manual";
  const normalizedApiPayload = normalizeOptionalJsonObject(
    value.apiPayload,
    "apiPayload"
  );
  const normalizedExecutionPayload = normalizeOptionalJsonObject(
    value.executionPayload,
    "executionPayload"
  );
  const resolvedAssignedAgentId = await resolveAssignedAgentIdForTask(
    projectId,
    {
      title: normalizedTitle,
      description: normalizedDescription,
      category: normalizedCategory,
      executionType: normalizedExecutionType,
      assigneeType
    },
    assignedAgentId
  );

  const task = await prisma.task.create({
    data: {
      projectId,
      title: normalizedTitle,
      description: normalizedDescription || null,
      category: normalizedCategory || null,
      executionType: normalizedExecutionType,
      executionLaneRationale: normalizeOptionalTaskString(
        value.executionLaneRationale
      ),
      hubspotTierRequired: normalizeOptionalTaskString(
        value.hubspotTierRequired
      ),
      coworkBrief: normalizeOptionalTaskString(value.coworkBrief),
      manualInstructions: normalizeOptionalTaskString(value.manualInstructions),
      agentModuleKey: normalizeOptionalTaskString(value.agentModuleKey),
      ...(normalizedApiPayload !== undefined
        ? { apiPayload: normalizedApiPayload }
        : {}),
      ...(normalizedExecutionPayload !== undefined
        ? { executionPayload: normalizedExecutionPayload }
        : {}),
      validationStatus: normalizeTaskValidationStatus(value.validationStatus),
      validationEvidence: normalizeOptionalTaskString(value.validationEvidence),
      findingId: normalizeOptionalTaskString(value.findingId),
      recommendationId: normalizeOptionalTaskString(value.recommendationId),
      priority,
      status,
      plannedHours:
        typeof value.plannedHours === "number"
          ? value.plannedHours
          : Number.isFinite(Number(value.plannedHours))
            ? Number(value.plannedHours)
            : null,
      actualHours:
        typeof value.actualHours === "number"
          ? value.actualHours
          : Number.isFinite(Number(value.actualHours))
            ? Number(value.actualHours)
            : null,
      qaRequired: Boolean(value.qaRequired),
      approvalRequired: Boolean(value.approvalRequired),
      assigneeType,
      executionReadiness,
      assignedAgentId: resolvedAssignedAgentId
    },
    include: { assignedAgent: { select: { name: true } } }
  });

  return serializeTask(task);
}

export async function generateProjectTaskPlan(projectId: string) {
  return (await generateProjectPlan(projectId)).map((task) =>
    serializeTask(task)
  );
}

export async function updateProjectTaskRecord(
  projectId: string,
  taskId: string,
  value: {
    status?: unknown;
    title?: unknown;
    description?: unknown;
    category?: unknown;
    executionType?: unknown;
    executionLaneRationale?: unknown;
    hubspotTierRequired?: unknown;
    coworkBrief?: unknown;
    manualInstructions?: unknown;
    apiPayload?: unknown;
    agentModuleKey?: unknown;
    executionPayload?: unknown;
    validationStatus?: unknown;
    validationEvidence?: unknown;
    findingId?: unknown;
    recommendationId?: unknown;
    priority?: unknown;
    qaRequired?: unknown;
    approvalRequired?: unknown;
    assigneeType?: unknown;
    executionReadiness?: unknown;
    assignedAgentId?: unknown;
    plannedHours?: unknown;
    actualHours?: unknown;
  }
) {
  const existingTask = await prisma.task.findFirst({
    where: {
      id: taskId,
      projectId
    }
  });

  if (!existingTask) {
    throw new Error("Task not found");
  }

  const projectLockState = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      quoteApprovalStatus: true,
      scopeLockedAt: true
    }
  });

  if (projectLockState && isProjectScopeLocked(projectLockState)) {
    const blockedKeys = [
      "title",
      "description",
      "category",
      "executionType",
      "executionLaneRationale",
      "hubspotTierRequired",
      "coworkBrief",
      "manualInstructions",
      "apiPayload",
      "agentModuleKey",
      "executionPayload",
      "priority",
      "plannedHours",
      "qaRequired",
      "approvalRequired"
    ].filter((key) => Object.prototype.hasOwnProperty.call(value, key));

    if (blockedKeys.length > 0) {
      throw new Error(
        "Approved scope is locked. Use change management to revise scoped task details."
      );
    }
  }

  const data: Record<string, unknown> = {};

  if (value.status !== undefined) {
    const nextStatus =
      typeof value.status === "string" ? value.status.trim() : "";

    if (
      !validTaskStatusValues.includes(
        nextStatus as (typeof validTaskStatusValues)[number]
      )
    ) {
      throw new Error("Invalid task status");
    }

    data.status = nextStatus;
  }

  if (value.title !== undefined) {
    data.title = normalizeRequiredTaskString(value.title, "title");
  }

  if (value.description !== undefined) {
    data.description = normalizeOptionalTaskString(value.description);
  }

  if (value.category !== undefined) {
    data.category = normalizeOptionalTaskString(value.category);
  }

  if (value.executionType !== undefined) {
    data.executionType =
      normalizeOptionalTaskString(value.executionType) ?? "manual";
  }

  if (value.executionLaneRationale !== undefined) {
    data.executionLaneRationale = normalizeOptionalTaskString(
      value.executionLaneRationale
    );
  }

  if (value.hubspotTierRequired !== undefined) {
    data.hubspotTierRequired = normalizeOptionalTaskString(
      value.hubspotTierRequired
    );
  }

  if (value.coworkBrief !== undefined) {
    data.coworkBrief = normalizeOptionalTaskString(value.coworkBrief);
  }

  if (value.manualInstructions !== undefined) {
    data.manualInstructions = normalizeOptionalTaskString(
      value.manualInstructions
    );
  }

  if (value.apiPayload !== undefined) {
    data.apiPayload = normalizeOptionalJsonObject(
      value.apiPayload,
      "apiPayload"
    );
  }

  if (value.agentModuleKey !== undefined) {
    data.agentModuleKey = normalizeOptionalTaskString(value.agentModuleKey);
  }

  if (value.executionPayload !== undefined) {
    data.executionPayload = normalizeOptionalJsonObject(
      value.executionPayload,
      "executionPayload"
    );
  }

  if (value.validationStatus !== undefined) {
    const nextValidationStatus =
      typeof value.validationStatus === "string"
        ? value.validationStatus.trim()
        : "";

    if (
      !validTaskValidationStatusValues.includes(
        nextValidationStatus as (typeof validTaskValidationStatusValues)[number]
      )
    ) {
      throw new Error("Invalid validation status");
    }

    data.validationStatus = nextValidationStatus;
  }

  if (value.validationEvidence !== undefined) {
    data.validationEvidence = normalizeOptionalTaskString(
      value.validationEvidence
    );
  }

  if (value.findingId !== undefined) {
    data.findingId = normalizeOptionalTaskString(value.findingId);
  }

  if (value.recommendationId !== undefined) {
    data.recommendationId = normalizeOptionalTaskString(value.recommendationId);
  }

  if (value.priority !== undefined) {
    if (
      typeof value.priority !== "string" ||
      !validTaskPriorityValues.includes(
        value.priority.toLowerCase() as (typeof validTaskPriorityValues)[number]
      )
    ) {
      throw new Error("Invalid task priority");
    }

    data.priority = value.priority.toLowerCase();
  }

  if (value.assigneeType !== undefined) {
    if (
      typeof value.assigneeType !== "string" ||
      !validTaskAssigneeTypeValues.includes(
        value.assigneeType as (typeof validTaskAssigneeTypeValues)[number]
      )
    ) {
      throw new Error("Invalid assignee type");
    }

    data.assigneeType = value.assigneeType;
    if (value.assigneeType !== "Agent") {
      data.assignedAgentId = null;
    }
  }

  if (value.executionReadiness !== undefined) {
    if (
      typeof value.executionReadiness !== "string" ||
      !validTaskExecutionReadinessValues.includes(
        value.executionReadiness as (typeof validTaskExecutionReadinessValues)[number]
      )
    ) {
      throw new Error("Invalid execution readiness");
    }

    data.executionReadiness = value.executionReadiness;
  }

  if (value.assignedAgentId !== undefined) {
    if (value.assignedAgentId === null || value.assignedAgentId === "") {
      data.assignedAgentId = null;
    } else if (typeof value.assignedAgentId === "string") {
      data.assignedAgentId = value.assignedAgentId.trim();
    } else {
      throw new Error("Invalid assigned agent");
    }
  }

  if (value.plannedHours !== undefined) {
    const plannedHours =
      typeof value.plannedHours === "number"
        ? value.plannedHours
        : Number(value.plannedHours);

    if (!Number.isFinite(plannedHours) || plannedHours < 0) {
      throw new Error("Invalid planned hours");
    }

    data.plannedHours = plannedHours;
  }

  if (value.actualHours !== undefined) {
    const actualHours =
      typeof value.actualHours === "number"
        ? value.actualHours
        : Number(value.actualHours);

    if (!Number.isFinite(actualHours) || actualHours < 0) {
      throw new Error("Invalid actual hours");
    }

    data.actualHours = actualHours;
  }

  if (value.qaRequired !== undefined) {
    data.qaRequired = Boolean(value.qaRequired);
  }

  if (value.approvalRequired !== undefined) {
    data.approvalRequired = Boolean(value.approvalRequired);
  }

  const nextTaskShape = {
    title: typeof data.title === "string" ? data.title : existingTask.title,
    description:
      typeof data.description === "string"
        ? data.description
        : (existingTask.description ?? ""),
    category:
      typeof data.category === "string"
        ? data.category
        : (existingTask.category ?? ""),
    executionType:
      typeof data.executionType === "string"
        ? data.executionType
        : existingTask.executionType,
    assigneeType:
      typeof data.assigneeType === "string"
        ? data.assigneeType
        : (existingTask.assigneeType ?? "Human")
  };

  if (nextTaskShape.assigneeType === "Agent" && !("assignedAgentId" in data)) {
    data.assignedAgentId = await resolveAssignedAgentIdForTask(
      projectId,
      nextTaskShape,
      existingTask.assignedAgentId
    );
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data,
    include: { assignedAgent: { select: { name: true } } }
  });

  return serializeTask(task);
}

export async function deleteProjectTaskRecord(
  projectId: string,
  taskId: string
) {
  const existingTask = await prisma.task.findFirst({
    where: {
      id: taskId,
      projectId
    }
  });

  if (!existingTask) {
    throw new Error("Task not found");
  }

  await prisma.executionJob.deleteMany({
    where: { taskId }
  });
  await prisma.task.delete({
    where: { id: taskId }
  });
}

async function loadProjectDiscoveryForBlueprint(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: true,
      portal: true,
      discovery: {
        orderBy: { version: "asc" },
        select: {
          version: true,
          status: true,
          sections: true,
          completedSections: true,
          updatedAt: true
        }
      }
    }
  });

  if (!project) {
    return null;
  }

  const evidenceItems = await loadDiscoveryEvidence(projectId);

  const sessions = buildDiscoverySessionsWithStatus(project.discovery).map(
    (session) => ({
      session: session.session,
      title: session.title,
      status: session.status,
      completedFieldCount: Object.values(session.fields).filter(
        (value) => value.trim().length > 0
      ).length,
      fields: session.fields
    })
  );
  const session4 = sessions.find((session) => session.session === 4);
  const discoveryProfile = {
    engagementTrack: session4?.fields.engagement_track?.trim() ?? "",
    platformFit: session4?.fields.platform_fit?.trim() ?? "",
    changeManagementRating:
      session4?.fields.change_management_rating?.trim() ?? "",
    dataReadinessRating: session4?.fields.data_readiness_rating?.trim() ?? "",
    scopeVolatilityRating:
      session4?.fields.scope_volatility_rating?.trim() ?? ""
  };

  return {
    project,
    discovery: {
      projectId: project.id,
      projectName: project.name,
      engagementType: project.engagementType,
      selectedHubs: project.selectedHubs,
      client: {
        name: project.client.name,
        industry: project.client.industry,
        region: project.client.region,
        website: project.client.website,
        additionalWebsites: project.client.additionalWebsites,
        linkedinUrl: project.client.linkedinUrl,
        facebookUrl: project.client.facebookUrl,
        instagramUrl: project.client.instagramUrl,
        xUrl: project.client.xUrl,
        youtubeUrl: project.client.youtubeUrl
      },
      portal: project.portal
        ? {
            portalId: project.portal.portalId,
            displayName: project.portal.displayName,
            region: project.portal.region,
            connected: project.portal.connected
          }
        : null,
      sessions,
      evidenceItems,
      commercialBrief: project.commercialBrief,
      problemStatement: project.problemStatement,
      solutionRecommendation: project.solutionRecommendation,
      scopeExecutiveSummary: project.scopeExecutiveSummary,
      customerPlatformTier: project.customerPlatformTier,
      platformTierSelections: normalizePlatformTierSelections(
        project.platformTierSelections
      ),
      scopeType: project.scopeType ?? "discovery",
      discoveryProfile
    }
  };
}

export async function generateSolutionOptions(input: {
  clientName?: string;
  website?: string;
  problemStatement: string;
  serviceFamily?: string;
}) {
  const rawOptions = await callAiWorkflow(
    "solution_shaping",
    `You are Muloo Deploy OS's HubSpot solution shaping assistant.
Given an early-stage problem statement, suggest three practical ways Muloo could move forward.

Rules:
- Return ONLY valid JSON. No markdown or explanation.
- Use exactly this structure: {"options":[{"title":"...","summary":"...","rationale":"...","recommendedScopeType":"standalone_quote","recommendedEngagementType":"IMPLEMENTATION","recommendedServiceFamily":"hubspot_architecture","recommendedHubs":["sales"],"recommendedCustomerPlatformTier":"starter","recommendedPlatformTierSelections":{"sales_hub":"starter"},"jobSpecSeed":"...","executiveSummary":"..."}]}
- Always return exactly 3 options.
- Anchor solutions in current HubSpot packaging and practical delivery patterns.
- Prefer options that Muloo can actually scope and deliver.
- recommendedScopeType must be either "standalone_quote" or "discovery".
- recommendedEngagementType must be one of AUDIT, IMPLEMENTATION, MIGRATION, OPTIMISATION, GUIDED_DEPLOYMENT.
- recommendedServiceFamily must be one of hubspot_architecture, custom_engineering, ai_automation.
- recommendedHubs may only contain sales, marketing, service, ops, cms, data, commerce.
- recommendedCustomerPlatformTier should be starter, professional, enterprise, or blank.
- recommendedPlatformTierSelections should only use these keys: smart_crm, marketing_hub, sales_hub, service_hub, content_hub, operations_hub, data_hub, commerce_hub, breeze, small_business_bundle, free_tools.
- jobSpecSeed should be a clean structured scope brief, not a bullet dump.
- executiveSummary should be a short client-facing summary of the selected direction.
- Include a conservative option, a recommended option, and a more ambitious option when possible.`,
    JSON.stringify(input, null, 2),
    { maxTokens: 3500 }
  );

  const parsedOptions = await parseModelJson(
    rawOptions,
    solutionShapingSchema,
    "solution-options"
  );

  return {
    options: parsedOptions.options.map((option) => ({
      ...option,
      recommendedScopeType:
        option.recommendedScopeType === "discovery"
          ? "discovery"
          : "standalone_quote",
      recommendedEngagementType: isValidEngagementType(
        option.recommendedEngagementType
      )
        ? option.recommendedEngagementType
        : "IMPLEMENTATION",
      recommendedServiceFamily: serviceFamilyOptions.includes(
        option.recommendedServiceFamily as (typeof serviceFamilyOptions)[number]
      )
        ? option.recommendedServiceFamily
        : "hubspot_architecture",
      recommendedHubs: Array.from(
        new Set(
          (option.recommendedHubs ?? [])
            .map((hub) => hub.trim().toLowerCase())
            .filter((hub) => isValidProjectHub(hub))
        )
      ),
      recommendedCustomerPlatformTier: isValidCustomerPlatformTier(
        (option.recommendedCustomerPlatformTier ?? "").trim().toLowerCase()
      )
        ? (option.recommendedCustomerPlatformTier ?? "").trim().toLowerCase()
        : "",
      recommendedPlatformTierSelections: normalizePlatformTierSelections(
        option.recommendedPlatformTierSelections
      )
    }))
  };
}

export async function generateProjectEmailDraft(input: {
  projectId: string;
  intent: string;
  mode?: "generate" | "cleanup";
  providerKey?: string;
  modelOverride?: string;
  sourceSubject?: string;
  sourceBody?: string;
  customInstructions?: string;
}) {
  const [project, summary, evidenceItems, latestQuote, clientUsers] =
    await Promise.all([
      prisma.project.findUnique({
        where: { id: input.projectId },
        include: {
          client: true,
          portal: true
        }
      }),
      loadDiscoverySummary(input.projectId).catch(() => null),
      loadDiscoveryEvidence(input.projectId).catch(() => []),
      loadLatestProjectQuote(input.projectId).catch(() => null),
      loadClientUsersForProject(input.projectId).catch(() => [])
    ]);

  if (!project) {
    throw new Error("Project not found");
  }

  const contextPreview = evidenceItems.slice(0, 8).map((item) => {
    const content = (item.content ?? "").trim();
    const contentPreview =
      content.length > 240 ? `${content.slice(0, 240).trim()}...` : content;
    return {
      sourceLabel: item.sourceLabel,
      evidenceType: item.evidenceType,
      sourceUrl: item.sourceUrl,
      content: contentPreview
    };
  });

  const resolvedWorkflow = await resolveAiWorkflowSelection(
    "project_email_drafting",
    input.providerKey,
    input.modelOverride
  );

  const rawDraft = await callResolvedAiWorkflow(
    resolvedWorkflow,
    input.mode === "cleanup"
      ? `You clean up draft Muloo client emails without changing the intended meaning.

Rules:
- Return ONLY valid JSON. No markdown or commentary.
- Use exactly this structure: {"subject":"...","body":"..."}
- Keep the meaning, recipients, and commercial intent intact.
- Improve clarity, grammar, structure, and professionalism.
- Keep the body in plain text with natural paragraph breaks.
- Do not turn it into marketing copy or heavy formatting.
- Only strengthen the call to action if it is weak or unclear.
- Do not invent meetings, deadlines, attachments, or facts.`
      : `You draft polished Muloo operator emails to clients.

Rules:
- Return ONLY valid JSON. No markdown or commentary.
- Use exactly this structure: {"subject":"...","body":"..."}
- Write like a confident, warm project lead from Muloo.
- Keep the email practical and commercially aware.
- Body should be plain text with natural paragraph breaks, ready to paste into email.
- Use concise sentences.
- Mention the actual next step requested from the client.
- If the workflow intent is questionnaire_invite, ask them to complete the project inputs in the portal and explain why it matters.
- If the workflow intent is next_steps, summarise what Muloo has understood and what should happen next.
- If the workflow intent is quote_ready, explain that the quote is available in the client portal for review.
- If the workflow intent is approval_follow_up, ask for approval politely and mention any timing dependency.
- Do not invent meetings, deadlines, or attachments.
- Use the saved project context, summary, quote status, and supporting context.`,
    JSON.stringify(
      {
        intent: input.intent,
        mode: input.mode ?? "generate",
        customInstructions: input.customInstructions?.trim() || "",
        sourceDraft:
          input.mode === "cleanup"
            ? {
                subject: input.sourceSubject?.trim() || "",
                body: input.sourceBody?.trim() || ""
              }
            : null,
        project: {
          name: project.name,
          clientName: project.client.name,
          serviceFamily: project.serviceFamily,
          scopeType: project.scopeType ?? "discovery",
          engagementType: project.engagementType,
          owner: project.owner,
          ownerEmail: project.ownerEmail,
          commercialBrief: project.commercialBrief,
          problemStatement: project.problemStatement,
          solutionRecommendation: project.solutionRecommendation,
          scopeExecutiveSummary: project.scopeExecutiveSummary,
          selectedHubs: project.selectedHubs,
          quoteApprovalStatus: project.quoteApprovalStatus,
          quoteSharedAt: project.quoteSharedAt?.toISOString() ?? null,
          quoteApprovedAt: project.quoteApprovedAt?.toISOString() ?? null
        },
        summary,
        latestQuote: latestQuote
          ? {
              version: latestQuote.version,
              status: latestQuote.status,
              currency: latestQuote.currency,
              totals: latestQuote.totals
            }
          : null,
        clientUsers: clientUsers.map((user) => ({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          questionnaireAccess: user.questionnaireAccess
        })),
        supportingContext: contextPreview
      },
      null,
      2
    ),
    { maxTokens: 2200 }
  );

  return parseModelJson(
    rawDraft,
    projectEmailDraftSchema,
    "project-email-draft"
  );
}

function formatProjectTypeForAiContext(input: {
  engagementType: string;
  scopeType?: string | null;
}) {
  return [input.engagementType, input.scopeType?.trim()]
    .filter((value): value is string => Boolean(value))
    .map((value) => humanizeTokenLabel(value))
    .join(" / ");
}

function formatProjectPackagingForAiContext(
  project: ReturnType<typeof serializeProject>
) {
  const packagingSummary = project.packagingAssessment?.summary?.trim() ?? "";
  const tier = project.customerPlatformTier?.trim()
    ? humanizeTokenLabel(project.customerPlatformTier)
    : "";

  return [tier, packagingSummary].filter(Boolean).join(" | ") || "Not set";
}

function collectAnsweredProjectInputs(
  config: ClientQuestionnaireConfig,
  submissions: Array<{
    sessionNumber: number;
    answers: unknown;
    updatedAt: Date;
  }>
) {
  const questionMap = new Map<
    string,
    { sessionNumber: number; label: string }
  >();

  for (const [sessionNumberText, session] of Object.entries(config)) {
    const sessionNumber = Number(sessionNumberText);
    if (!Number.isFinite(sessionNumber) || session.enabled === false) {
      continue;
    }

    for (const question of session.questions) {
      if (question.enabled === false) {
        continue;
      }

      questionMap.set(`${sessionNumber}:${question.key}`, {
        sessionNumber,
        label: question.label
      });
    }
  }

  const latestAnswers = new Map<
    string,
    { sessionNumber: number; question: string; answer: string }
  >();
  const sortedSubmissions = [...submissions].sort(
    (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime()
  );

  for (const submission of sortedSubmissions) {
    const answers =
      submission.answers &&
      typeof submission.answers === "object" &&
      !Array.isArray(submission.answers)
        ? (submission.answers as Record<string, unknown>)
        : {};

    for (const [answerKey, rawAnswer] of Object.entries(answers)) {
      const answer =
        typeof rawAnswer === "string" ? rawAnswer.trim() : String(rawAnswer ?? "").trim();
      const question = questionMap.get(`${submission.sessionNumber}:${answerKey}`);

      if (!question || !answer || latestAnswers.has(`${question.sessionNumber}:${answerKey}`)) {
        continue;
      }

      latestAnswers.set(`${question.sessionNumber}:${answerKey}`, {
        sessionNumber: question.sessionNumber,
        question: question.label,
        answer
      });
    }
  }

  return [...latestAnswers.values()].sort(
    (left, right) =>
      left.sessionNumber - right.sessionNumber ||
      left.question.localeCompare(right.question)
  );
}

async function loadProjectAiComposerContext(projectId: string) {
  const [
    project,
    blueprint,
    discoverySubmissions,
    quickWins,
    openTasks,
    clientInputSubmissions,
    sessionPrepEntry
  ] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: true,
        portal: true
      }
    }),
    loadBlueprint(projectId).catch(() => null),
    prisma.discoverySubmission.findMany({
      where: { projectId },
      orderBy: { version: "asc" },
      select: {
        version: true,
        status: true,
        sections: true,
        completedSections: true
      }
    }),
    prisma.finding.findMany({
      where: {
        projectId,
        quickWin: true
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 8,
      select: {
        title: true,
        status: true
      }
    }),
    prisma.task.findMany({
      where: {
        projectId,
        status: {
          not: "done"
        }
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 8,
      select: {
        title: true,
        status: true,
        category: true
      }
    }),
    prisma.clientInputSubmission.findMany({
      where: { projectId },
      orderBy: [{ updatedAt: "desc" }],
      select: {
        sessionNumber: true,
        answers: true,
        updatedAt: true
      }
    }),
    prisma.projectContext.findUnique({
      where: {
        projectId_contextType: {
          projectId,
          contextType: "session_prep"
        }
      },
      select: {
        content: true
      }
    })
  ]);

  if (!project) {
    throw new Error("Project not found");
  }

  const serializedProject = serializeProject(project);
  const questionnaireConfig = normalizeClientQuestionnaireConfig(
    project.clientQuestionnaireConfig
  );
  const answeredInputs = collectAnsweredProjectInputs(
    questionnaireConfig,
    clientInputSubmissions
  );
  const discoveryProgress = buildDiscoverySessionsWithStatus(discoverySubmissions)
    .filter((session) => session.status !== "complete")
    .map((session) => ({
      title: session.title,
      status: session.status
    }));
  const outstandingTasks =
    openTasks.length > 0
      ? openTasks.map((task) => ({
          title: task.title,
          status: task.status,
          category: task.category
        }))
      : (blueprint?.tasks ?? []).slice(0, 8).map((task) => ({
          title: task.name,
          status: "planned",
          category: task.phaseName
        }));

  return {
    project,
    serializedProject,
    blueprintGenerated: Boolean(blueprint),
    quickWins: quickWins.map((quickWin) => ({
      title: quickWin.title,
      status: quickWin.status
    })),
    outstandingTasks,
    discoveryProgress,
    answeredInputs,
    prepareNotes: sessionPrepEntry?.content?.trim() ?? ""
  };
}

function buildSimplifiedProjectEmailContext(context: Awaited<ReturnType<typeof loadProjectAiComposerContext>>) {
  return [
    `Client: ${context.serializedProject.clientName}`,
    `Project: ${context.serializedProject.name}`,
    `Project type: ${formatProjectTypeForAiContext(context.project)}`,
    `Hubs in scope: ${
      context.serializedProject.hubsInScope.length > 0
        ? context.serializedProject.hubsInScope.map((hub) => humanizeTokenLabel(hub)).join(", ")
        : "Not set"
    }`,
    `Platform packaging: ${formatProjectPackagingForAiContext(context.serializedProject)}`,
    `Status: ${context.serializedProject.status}`,
    context.quickWins.length > 0
      ? `Quick wins: ${context.quickWins
          .slice(0, 4)
          .map((quickWin) => quickWin.title)
          .join("; ")}`
      : null,
    context.blueprintGenerated
      ? "Blueprint generated: yes"
      : "Blueprint generated: no"
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n");
}

function buildProjectAgendaContext(context: Awaited<ReturnType<typeof loadProjectAiComposerContext>>) {
  const quickWinLines = context.quickWins
    .map((quickWin) => `- ${quickWin.title}`)
    .slice(0, 8);
  const taskLines = context.outstandingTasks
    .slice(0, 8)
    .map((task) =>
      `- ${task.title}${task.category ? ` (${task.category})` : ""}`
    );
  const discoveryLines = context.discoveryProgress.map(
    (session) => `- ${session.title} (${humanizeTokenLabel(session.status)})`
  );
  const answeredInputLines = context.answeredInputs
    .slice(0, 8)
    .map((entry) => `- ${entry.question}: ${entry.answer}`);

  return [
    `Client: ${context.serializedProject.clientName}`,
    `Project: ${context.serializedProject.name}`,
    `Project type: ${formatProjectTypeForAiContext(context.project)}`,
    `Hubs in scope: ${
      context.serializedProject.hubsInScope.length > 0
        ? context.serializedProject.hubsInScope.map((hub) => humanizeTokenLabel(hub)).join(", ")
        : "Not set"
    }`,
    `Platform packaging: ${formatProjectPackagingForAiContext(context.serializedProject)}`,
    `Status: ${context.serializedProject.status}`,
    quickWinLines.length > 0
      ? `Quick wins identified:\n${quickWinLines.join("\n")}`
      : null,
    taskLines.length > 0
      ? `Outstanding blueprint tasks:\n${taskLines.join("\n")}`
      : null,
    discoveryLines.length > 0
      ? `Open discovery areas:\n${discoveryLines.join("\n")}`
      : null,
    answeredInputLines.length > 0
      ? `Project inputs answered:\n${answeredInputLines.join("\n")}`
      : null,
    context.prepareNotes
      ? `Prepare notes:\n${context.prepareNotes.slice(0, 600)}`
      : null
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n\n");
}

export async function generateSimplifiedProjectEmailDraft(input: {
  projectId: string;
  notes?: string;
}) {
  const context = await loadProjectAiComposerContext(input.projectId);
  const resolvedWorkflow = await resolveAiWorkflow("project_email_drafting");
  const draft = await callResolvedAiWorkflow(
    resolvedWorkflow,
    `You are writing a professional but warm email on behalf of a HubSpot consultant. Use the project context provided and the user's notes to draft a concise, friendly email. Do not add fluff. Sound like a human consultant, not a corporation.

Return only the email body as plain text. Do not add a subject line, markdown, commentary, or placeholders.

Project context:
${buildSimplifiedProjectEmailContext(context)}`,
    input.notes?.trim() || "Draft a brief project update email.",
    { maxTokens: 1400 }
  );

  const normalizedDraft = draft.trim();

  if (!normalizedDraft) {
    throw new Error("Email draft came back empty");
  }

  return normalizedDraft;
}

export async function generateProjectAgenda(input: {
  projectId: string;
  sessionType: string;
  date?: string | null;
  duration?: string | null;
  notes?: string | null;
}) {
  const context = await loadProjectAiComposerContext(input.projectId);
  const resolvedWorkflow = await resolveAiWorkflow("project_agenda_generation");
  const promptParts = [`Build an agenda for a ${input.sessionType}.`];

  if (input.date?.trim()) {
    promptParts.push(`Scheduled for: ${input.date.trim()}.`);
  }

  if (input.duration?.trim()) {
    promptParts.push(`Duration: ${input.duration.trim()}.`);
  }

  if (input.notes?.trim()) {
    promptParts.push(`Additional focus: ${input.notes.trim()}.`);
  }

  promptParts.push(
    "Use the project context to make every agenda item specific and relevant."
  );

  const agenda = await callResolvedAiWorkflow(
    resolvedWorkflow,
    `You are a HubSpot implementation consultant building a structured meeting agenda.
Use the project context below to create a relevant, time-boxed agenda.
Make it practical and specific to what this project actually needs.
Format the response as plain text with a title, optional date and duration lines, and time-boxed agenda items using HH:MM - HH:MM ranges followed by concise bullet points.
Do not use markdown headings, tables, or commentary before or after the agenda.

Project context:
${buildProjectAgendaContext(context)}`,
    promptParts.join(" "),
    { maxTokens: 1800 }
  );

  const content = agenda.trim();

  if (!content) {
    throw new Error("Agenda came back empty");
  }

  const lastAgenda = projectAgendaRecordSchema.parse({
    sessionType: input.sessionType.trim(),
    date: input.date?.trim() ? input.date.trim() : null,
    duration: input.duration?.trim() ? input.duration.trim() : null,
    notes: input.notes?.trim() ? input.notes.trim() : null,
    content,
    generatedAt: new Date().toISOString()
  });

  await prisma.project.update({
    where: { id: input.projectId },
    data: {
      lastAgenda: lastAgenda as Prisma.Prisma.InputJsonValue
    }
  });

  return lastAgenda;
}

async function generateStandaloneScopeSummary(
  discoveryPayload: NonNullable<
    Awaited<ReturnType<typeof loadProjectDiscoveryForBlueprint>>
  >
) {
  const evidenceText = getDiscoveryEvidenceText(discoveryPayload);
  const packagingAssessment = derivePlatformPackagingAssessment({
    selectedHubs: discoveryPayload.discovery.selectedHubs,
    customerPlatformTier: discoveryPayload.project.customerPlatformTier,
    platformTierSelections: normalizePlatformTierSelections(
      discoveryPayload.project.platformTierSelections
    ),
    implementationApproach: discoveryPayload.project.implementationApproach,
    evidenceText
  });
  let rawSummary = "";
  try {
    rawSummary = await callAiWorkflow(
      "scoped_summary",
      `You are Muloo Deploy OS's scoped implementation adviser.
Given a standalone HubSpot-related job brief, supporting notes, and platform context, produce a practical Muloo recommendation for quoting, planning, and client communication.

Rules:
- Return ONLY valid JSON. No markdown or explanation.
- Use exactly these keys: executiveSummary, mainPainPoints, recommendedApproach, whyThisApproach, phaseOneFocus, futureUpgradePath, inScopeItems, outOfScopeItems, supportingTools, engagementTrack, platformFit, changeManagementRating, dataReadinessRating, scopeVolatilityRating, missingInformation, keyRisks, recommendedNextQuestions
- Keep executiveSummary to one short paragraph written like a Muloo operator explaining the recommended starting point to a smart client.
- mainPainPoints should contain the 3 to 5 most important business or delivery problems this project is trying to solve.
- recommendedApproach should be a direct recommendation in plain English, describing the best starting path in a confident but practical way. Write it like a Muloo operator making the call after the meeting: "Use...", "Keep...", "Start with...", or "Implement...".
- whyThisApproach should explain why that recommendation is sensible, including practical shortcuts, workaround architecture, or tradeoffs where relevant. Avoid vague hedging phrases like "likely", "may", or "could" unless the uncertainty genuinely matters.
- phaseOneFocus should explain what the lean first phase / POC should actually deliver and what success looks like.
- futureUpgradePath should explain what later expansion, packaging uplift, or deeper architecture could look like once Phase 1 proves value.
- inScopeItems should list the key work items that are clearly part of this scoped job.
- outOfScopeItems should list what is intentionally not being done in this phase so the scope stays boxed.
- supportingTools should list practical supporting tools or infrastructure around HubSpot that strengthen the recommended solution, such as Databox, Railway, Supabase, Azure, self-hosted database, middleware, or ETL tooling. Only include tools that are genuinely useful for this scoped job.
- engagementTrack should be a business-friendly label such as "Standalone implementation", "Technical implementation", or "Scoped integration".
- platformFit should describe the recommended HubSpot fit and supporting architecture in one short phrase.
- changeManagementRating, dataReadinessRating, and scopeVolatilityRating should be low, medium, or high.
- missingInformation should contain only the most important open inputs still needed.
- keyRisks should focus on delivery, handoff, technical complexity, and dependency risk. Return at least 3 items unless the brief is extremely thin.
- recommendedNextQuestions should be practical next clarification points. Return at least 3 items unless the brief is extremely thin.
- supportingTools should return 2 to 5 concrete recommendations when surrounding tooling materially strengthens the solution.
- Base the answer on the scoped brief, the selected HubSpot packaging, supporting context, and any linked documents or notes.
- Think like a senior Muloo consultant and operator, not a literal parser. Synthesize the pain point, recommend a sensible path, note packaging assumptions, and explain when a pragmatic workaround architecture is acceptable.
- Frame the answer as: problem -> boxed Phase 1 recommendation -> why this is the smartest starting point -> later path if the POC proves value.
- If HubSpot is mainly the operational front end and another tool or staging layer should handle the heavy lifting, say that plainly and confidently.
- Prefer "best starting path", "boxed Phase 1", and "later path" language over generic consulting phrases.
- If implementationApproach is pragmatic_poc, prefer a boxed first phase that solves the core pain without prematurely loading cost or complexity.
- Do not assume every capability must be solved natively inside HubSpot if the brief clearly allows a staging layer, middleware, Databox, or other supporting architecture.
- Do not speak about discovery sessions unless they actually exist.
- Do not simply repeat the raw brief. Synthesize it into a clear recommendation with human judgement.
- Prefer short, decisive sentences over generic consulting language.
- If there is a lower-cost workable path, say so plainly.
- If the brief is describing a POC, keep the recommendation boxed and avoid planning a future-state transformation as if it is Phase 1.`,
      JSON.stringify(
        {
          project: {
            id: discoveryPayload.project.id,
            name: discoveryPayload.project.name,
            engagementType: discoveryPayload.project.engagementType,
            serviceFamily: discoveryPayload.project.serviceFamily,
            implementationApproach:
              discoveryPayload.project.implementationApproach,
            selectedHubs: discoveryPayload.project.selectedHubs,
            scopeType: discoveryPayload.project.scopeType,
            commercialBrief: discoveryPayload.project.commercialBrief,
            problemStatement: discoveryPayload.project.problemStatement,
            solutionRecommendation:
              discoveryPayload.project.solutionRecommendation,
            customerPlatformTier: discoveryPayload.project.customerPlatformTier,
            platformTierSelections: normalizePlatformTierSelections(
              discoveryPayload.project.platformTierSelections
            )
          },
          client: discoveryPayload.discovery.client,
          packagingAssessment,
          evidenceText,
          supportingContext: discoveryPayload.discovery.evidenceItems
        },
        null,
        2
      ),
      { maxTokens: 2500 }
    );
  } catch {
    rawSummary = "";
  }

  let parsedSummary: z.infer<typeof discoverySummarySchema>;
  let partialSummary: z.infer<typeof discoverySummaryLooseSchema> | null = null;

  try {
    if (!rawSummary.trim()) {
      throw new SyntaxError("Scoped summary model output was empty");
    }
    parsedSummary = await parseModelJson<DiscoverySummaryPayload>(
      rawSummary,
      discoverySummarySchema,
      "scoped-summary"
    );
  } catch (parseError) {
    if (parseError instanceof SyntaxError || parseError instanceof ZodError) {
      try {
        partialSummary = discoverySummaryLooseSchema.parse(
          JSON.parse(extractJsonBlock(rawSummary)) as unknown
        );
      } catch {
        partialSummary = null;
      }
    } else {
      throw parseError;
    }

    const fallbackSummary = deriveStandaloneSummaryFallback({
      discoveryPayload,
      packagingAssessment,
      evidenceText
    });
    const mainPainPoints: string[] =
      partialSummary?.mainPainPoints && partialSummary.mainPainPoints.length > 0
        ? [...partialSummary.mainPainPoints]
        : [...fallbackSummary.mainPainPoints];
    const inScopeItems: string[] =
      partialSummary?.inScopeItems && partialSummary.inScopeItems.length > 0
        ? [...partialSummary.inScopeItems]
        : [...fallbackSummary.inScopeItems];
    const outOfScopeItems: string[] =
      partialSummary?.outOfScopeItems &&
      partialSummary.outOfScopeItems.length > 0
        ? [...partialSummary.outOfScopeItems]
        : [...fallbackSummary.outOfScopeItems];
    const supportingTools: string[] = partialSummary?.supportingTools
      ? [...partialSummary.supportingTools]
      : [];
    const missingInformation: string[] = partialSummary?.missingInformation
      ? [...partialSummary.missingInformation]
      : [];
    const keyRisks: string[] = partialSummary?.keyRisks
      ? [...partialSummary.keyRisks]
      : [];
    const recommendedNextQuestions: string[] =
      partialSummary?.recommendedNextQuestions
        ? [...partialSummary.recommendedNextQuestions]
        : [];

    parsedSummary = discoverySummarySchema.parse({
      executiveSummary:
        partialSummary?.executiveSummary || fallbackSummary.executiveSummary,
      mainPainPoints,
      recommendedApproach:
        partialSummary?.recommendedApproach ||
        fallbackSummary.recommendedApproach,
      whyThisApproach:
        partialSummary?.whyThisApproach || fallbackSummary.whyThisApproach,
      phaseOneFocus:
        partialSummary?.phaseOneFocus || fallbackSummary.phaseOneFocus,
      futureUpgradePath:
        partialSummary?.futureUpgradePath || fallbackSummary.futureUpgradePath,
      inScopeItems,
      outOfScopeItems,
      supportingTools,
      engagementTrack:
        partialSummary?.engagementTrack || fallbackSummary.engagementTrack,
      platformFit: partialSummary?.platformFit || fallbackSummary.platformFit,
      changeManagementRating:
        partialSummary?.changeManagementRating ||
        fallbackSummary.changeManagementRating,
      dataReadinessRating:
        partialSummary?.dataReadinessRating ||
        fallbackSummary.dataReadinessRating,
      scopeVolatilityRating:
        partialSummary?.scopeVolatilityRating ||
        fallbackSummary.scopeVolatilityRating,
      missingInformation,
      keyRisks,
      recommendedNextQuestions
    });
  }
  const normalizedSummary = {
    ...parsedSummary,
    mainPainPoints: parsedSummary.mainPainPoints ?? [],
    inScopeItems: parsedSummary.inScopeItems ?? [],
    outOfScopeItems: parsedSummary.outOfScopeItems ?? [],
    supportingTools: ensureMinimumRecommendations(
      uniqueList(
        [
          ...(parsedSummary.supportingTools ?? []),
          ...deriveSupportingToolsFallback({
            evidenceText,
            selectedHubs: discoveryPayload.discovery.selectedHubs,
            serviceFamily: discoveryPayload.project.serviceFamily,
            implementationApproach:
              discoveryPayload.project.implementationApproach
          })
        ],
        5
      ),
      deriveDefaultSupportingTools({
        selectedHubs: discoveryPayload.discovery.selectedHubs,
        packagingAssessment
      }),
      3,
      5
    ),
    missingInformation: parsedSummary.missingInformation ?? [],
    keyRisks: ensureMinimumRecommendations(
      uniqueList(
        [
          ...(parsedSummary.keyRisks ?? []),
          ...deriveKeyRisksFallback({ evidenceText, packagingAssessment })
        ],
        5
      ),
      deriveDefaultKeyRisks({ packagingAssessment }),
      3,
      5
    ),
    recommendedNextQuestions: ensureMinimumRecommendations(
      uniqueList(
        [
          ...(parsedSummary.recommendedNextQuestions ?? []),
          ...deriveNextQuestionsFallback({ evidenceText, packagingAssessment })
        ],
        5
      ),
      deriveDefaultNextQuestions({ packagingAssessment }),
      3,
      5
    )
  };

  const savedSummary = await prisma.discoverySummary.upsert({
    where: { projectId: discoveryPayload.project.id },
    update: normalizedSummary,
    create: {
      projectId: discoveryPayload.project.id,
      ...normalizedSummary
    }
  });

  await prisma.project.update({
    where: { id: discoveryPayload.project.id },
    data: { scopeExecutiveSummary: normalizedSummary.executiveSummary }
  });

  return serializeDiscoverySummary(savedSummary);
}

export async function generateDiscoverySummary(projectId: string) {
  const discoveryPayload = await loadProjectDiscoveryForBlueprint(projectId);

  if (!discoveryPayload) {
    throw new Error("Project not found");
  }

  if (discoveryPayload.project.scopeType === "standalone_quote") {
    return generateStandaloneScopeSummary(discoveryPayload);
  }

  const missingInformation = discoveryPayload.discovery.sessions.flatMap(
    (session) =>
      Object.entries(session.fields)
        .filter(([, value]) => value.trim().length === 0)
        .map(([key]) => `Session ${session.session}: ${key}`)
  );
  const evidenceText = getDiscoveryEvidenceText(discoveryPayload);
  const packagingAssessment = derivePlatformPackagingAssessment({
    selectedHubs: discoveryPayload.discovery.selectedHubs,
    customerPlatformTier: discoveryPayload.project.customerPlatformTier,
    platformTierSelections: normalizePlatformTierSelections(
      discoveryPayload.project.platformTierSelections
    ),
    implementationApproach: discoveryPayload.project.implementationApproach,
    evidenceText
  });

  const rawSummary = await callAiWorkflow(
    "discovery_summary",
    `You are Muloo Deploy OS's Discovery Structuring Agent.
Given a structured HubSpot discovery project, create a clear project-level discovery recommendation.

Rules:
- Return ONLY valid JSON. No markdown or explanation.
- Use exactly these keys: executiveSummary, mainPainPoints, recommendedApproach, whyThisApproach, phaseOneFocus, futureUpgradePath, inScopeItems, outOfScopeItems, supportingTools, engagementTrack, platformFit, changeManagementRating, dataReadinessRating, scopeVolatilityRating, missingInformation, keyRisks, recommendedNextQuestions
- Keep executiveSummary to one short paragraph written for a smart client and an internal delivery lead.
- mainPainPoints should capture the 3 to 5 most material business or delivery problems.
- recommendedApproach should state the recommended way forward in plain English. Write it like a Muloo operator making the call after the meeting: "Use...", "Keep...", "Start with...", or "Implement...".
- whyThisApproach should explain why that path is sensible and what tradeoffs it avoids. Avoid vague hedging unless the uncertainty genuinely matters.
- phaseOneFocus should explain what the first delivery phase should accomplish.
- futureUpgradePath should explain what later phases, upgrades, or broader operationalisation could look like.
- inScopeItems should list the clearest items that belong in the recommended scope.
- outOfScopeItems should list what should stay out of scope for now.
- supportingTools should list practical supporting tools, reporting layers, or infrastructure that should sit alongside HubSpot when they materially improve the recommended solution.
- missingInformation should contain only the most important information gaps.
- keyRisks should focus on delivery, adoption, data, and scope risk. Return at least 3 items unless the source material is extremely thin.
- recommendedNextQuestions should be practical and operator-friendly. Return at least 3 items unless the source material is extremely thin.
- supportingTools should return 2 to 5 concrete recommendations when surrounding tooling, storage, reporting, or integration layers materially improve the solution.
- If discoveryProfile already contains a value for engagementTrack, platformFit, changeManagementRating, dataReadinessRating, or scopeVolatilityRating, preserve that meaning in the output.
- Keep the tone clear, practical, and human. Avoid bloated consultant wording.`,
    JSON.stringify(
      {
        ...discoveryPayload.discovery,
        heuristicMissingInformation: missingInformation
      },
      null,
      2
    )
  );

  const parsedSummary = await parseModelJson(
    rawSummary,
    discoverySummarySchema,
    "discovery-summary"
  );
  const normalizedSummary = {
    ...parsedSummary,
    mainPainPoints: parsedSummary.mainPainPoints ?? [],
    inScopeItems: parsedSummary.inScopeItems ?? [],
    outOfScopeItems: parsedSummary.outOfScopeItems ?? [],
    supportingTools: ensureMinimumRecommendations(
      uniqueList(
        [
          ...(parsedSummary.supportingTools ?? []),
          ...deriveSupportingToolsFallback({
            evidenceText,
            selectedHubs: discoveryPayload.discovery.selectedHubs,
            serviceFamily: discoveryPayload.project.serviceFamily,
            implementationApproach:
              discoveryPayload.project.implementationApproach
          })
        ],
        5
      ),
      deriveDefaultSupportingTools({
        selectedHubs: discoveryPayload.discovery.selectedHubs,
        packagingAssessment
      }),
      2,
      5
    ),
    missingInformation: parsedSummary.missingInformation ?? [],
    keyRisks: ensureMinimumRecommendations(
      uniqueList(
        [
          ...(parsedSummary.keyRisks ?? []),
          ...deriveKeyRisksFallback({ evidenceText, packagingAssessment })
        ],
        5
      ),
      deriveDefaultKeyRisks({ packagingAssessment }),
      3,
      5
    ),
    recommendedNextQuestions: ensureMinimumRecommendations(
      uniqueList(
        [
          ...(parsedSummary.recommendedNextQuestions ?? []),
          ...deriveNextQuestionsFallback({ evidenceText, packagingAssessment })
        ],
        5
      ),
      deriveDefaultNextQuestions({ packagingAssessment }),
      3,
      5
    )
  };

  const savedSummary = await prisma.discoverySummary.upsert({
    where: { projectId },
    update: normalizedSummary,
    create: {
      projectId,
      ...normalizedSummary
    }
  });

  return serializeDiscoverySummary(savedSummary);
}

export async function loadDiscoverySummary(projectId: string) {
  const summary = await prisma.discoverySummary.findUnique({
    where: { projectId }
  });

  return summary ? serializeDiscoverySummary(summary) : null;
}

function waitForDelay(delayMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export async function loadDiscoverySummaryWithRetry(
  projectId: string,
  attempts = 4,
  delayMs = 350
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const summary = await loadDiscoverySummary(projectId);

    if (summary) {
      return summary;
    }

    if (attempt < attempts - 1) {
      await waitForDelay(delayMs * (attempt + 1));
    }
  }

  return null;
}

export async function ensureProjectScopeUnlocked(
  projectId: string,
  errorMessage = "Approved scope is locked. Use change management to revise this project."
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      quoteApprovalStatus: true,
      scopeLockedAt: true
    }
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (isProjectScopeLocked(project)) {
    throw new Error(errorMessage);
  }
}

export async function shareProjectQuote(projectId: string, payload: unknown) {
  await ensureProjectScopeUnlocked(projectId);
  const latestExistingQuote = await prisma.projectQuote.findFirst({
    where: { projectId },
    orderBy: [{ version: "desc" }]
  });
  const hasIncomingPayload =
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    Object.keys(payload as Record<string, unknown>).length > 0;

  const normalizedPayload = hasIncomingPayload
    ? projectQuotePayloadSchema.parse(payload)
    : latestExistingQuote
      ? {
          currency: z
            .enum(["ZAR", "GBP", "EUR", "USD", "AUD"])
            .parse(latestExistingQuote.currency),
          defaultRate: latestExistingQuote.defaultRate ?? 1500,
          phaseLines: z
            .array(projectQuotePhaseLineSchema)
            .parse(latestExistingQuote.phaseLines),
          productLines: z
            .array(projectQuoteProductLineSchema)
            .parse(latestExistingQuote.productLines),
          totals: projectQuoteTotalsSchema.parse(latestExistingQuote.totals),
          paymentSchedule: z
            .array(z.string().min(1))
            .parse(latestExistingQuote.paymentSchedule),
          context:
            latestExistingQuote.context === null
              ? {
                  quoteContextSummary: null,
                  inScopeItems: [],
                  outOfScopeItems: [],
                  supportingTools: [],
                  keyRisks: [],
                  nextQuestions: [],
                  clientResponsibilities: [],
                  isStandaloneQuote: false,
                  blueprintGeneratedAt: null
                }
              : projectQuoteContextSchema.parse(latestExistingQuote.context)
        }
      : null;

  if (!normalizedPayload) {
    throw new Error(
      "Open the quote page first, set the commercial scope, then push the quote to the client portal."
    );
  }

  const [project, summary, blueprint] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: true,
        portal: true
      }
    }),
    loadDiscoverySummary(projectId),
    loadBlueprint(projectId)
  ]);

  if (!project) {
    throw new Error("Project not found");
  }

  const isStandaloneQuote = project.scopeType === "standalone_quote";

  if (!summary) {
    throw new Error(
      isStandaloneQuote
        ? "Generate the scoped summary before sharing the quote."
        : "Generate the discovery summary before sharing the quote."
    );
  }

  if (!isStandaloneQuote && !blueprint) {
    throw new Error(
      "Generate the discovery summary and blueprint before sharing the quote."
    );
  }

  const sharedAt = new Date();

  const { updatedProject, createdQuote } = await prisma.$transaction(
    async (transaction) => {
      await transaction.projectQuote.updateMany({
        where: {
          projectId,
          status: {
            in: ["shared", "draft"]
          }
        },
        data: {
          status: "superseded"
        }
      });

      const createdQuote = hasIncomingPayload
        ? await transaction.projectQuote.create({
            data: {
              projectId,
              version: (latestExistingQuote?.version ?? 0) + 1,
              status: "shared",
              currency: normalizedPayload.currency,
              defaultRate: normalizedPayload.defaultRate,
              phaseLines:
                normalizedPayload.phaseLines as Prisma.Prisma.InputJsonValue,
              productLines:
                normalizedPayload.productLines as Prisma.Prisma.InputJsonValue,
              totals: normalizedPayload.totals as Prisma.Prisma.InputJsonValue,
              paymentSchedule:
                normalizedPayload.paymentSchedule as Prisma.Prisma.InputJsonValue,
              context:
                normalizedPayload.context as Prisma.Prisma.InputJsonValue,
              sharedAt
            }
          })
        : await transaction.projectQuote.update({
            where: { id: latestExistingQuote!.id },
            data: {
              status: "shared",
              sharedAt
            }
          });

      const updatedProject = await transaction.project.update({
        where: { id: projectId },
        data: {
          quoteApprovalStatus: "shared",
          quoteSharedAt: sharedAt
        },
        include: {
          client: true,
          portal: true
        }
      });

      return { updatedProject, createdQuote };
    }
  );

  await createProjectMessage({
    projectId,
    senderType: "internal",
    senderName: "Muloo",
    body: "Your quote is now available in the client portal. Open this project and use the Open Quote button to review the latest commercial scope and approval pack."
  });

  return {
    project: serializeProject(updatedProject),
    quote: serializeProjectQuote(createdQuote)
  };
}

export async function approveProjectQuote(
  projectId: string,
  clientUserId: string
) {
  const access = await prisma.clientProjectAccess.findUnique({
    where: {
      userId_projectId: {
        userId: clientUserId,
        projectId
      }
    },
    include: {
      user: true,
      project: {
        include: {
          client: true,
          portal: true
        }
      }
    }
  });

  if (!access) {
    throw new Error("Project not found");
  }

  if (access.role !== "approver") {
    throw new Error("Only approved quote signatories can approve this quote.");
  }

  if (access.project.quoteApprovalStatus === "draft") {
    throw new Error(
      "Quote must be shared to the client portal before approval."
    );
  }

  const approverName =
    `${access.user.firstName} ${access.user.lastName}`.trim();
  const approvedAt = access.project.quoteApprovedAt ?? new Date();
  const lockedAt = access.project.scopeLockedAt ?? approvedAt;

  const { updatedProject, approvedQuote } = await prisma.$transaction(
    async (transaction) => {
      const latestQuote = await transaction.projectQuote.findFirst({
        where: {
          projectId,
          status: {
            in: ["shared", "approved"]
          }
        },
        orderBy: [{ version: "desc" }]
      });

      if (!latestQuote) {
        throw new Error(
          "Quote has not yet been published to the client portal."
        );
      }

      const approvedQuote = await transaction.projectQuote.update({
        where: { id: latestQuote.id },
        data: {
          status: "approved",
          approvedAt,
          approvedByName: approverName || access.user.email,
          approvedByEmail: access.user.email
        }
      });

      const updatedProject = await transaction.project.update({
        where: { id: projectId },
        data: {
          quoteApprovalStatus: "approved",
          quoteApprovedAt: approvedAt,
          quoteApprovedByName: approverName || access.user.email,
          quoteApprovedByEmail: access.user.email,
          scopeLockedAt: lockedAt,
          status:
            access.project.status === "complete"
              ? access.project.status
              : "ready-for-execution"
        },
        include: {
          client: true,
          portal: true
        }
      });

      return { updatedProject, approvedQuote };
    }
  );

  await createProjectMessage({
    projectId,
    senderType: "client",
    senderName: approverName || access.user.email,
    body: "Approved the quote in the client portal. The project scope is now locked for delivery."
  });

  return {
    project: serializeProject(updatedProject),
    quote: serializeProjectQuote(approvedQuote)
  };
}

export async function resetDiscoverySummary(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { scopeType: true }
  });

  await prisma.discoverySummary.deleteMany({
    where: { projectId }
  });

  if (project?.scopeType === "standalone_quote") {
    await prisma.executionJob.deleteMany({
      where: { projectId }
    });
    await prisma.task.deleteMany({
      where: { projectId }
    });
    await prisma.blueprintTask.deleteMany({
      where: { blueprint: { projectId } }
    });
    await prisma.blueprint.deleteMany({
      where: { projectId }
    });
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { scopeExecutiveSummary: null }
  });
}

async function generateBlueprintFromDiscovery(projectId: string) {
  const discoveryPayload = await loadProjectDiscoveryForBlueprint(projectId);

  if (!discoveryPayload) {
    throw new Error("Project not found");
  }

  const session1 = discoveryPayload.discovery.sessions.find(
    (session) => session.session === 1
  );
  const session3 = discoveryPayload.discovery.sessions.find(
    (session) => session.session === 3
  );

  if (session1?.status !== "complete" || session3?.status !== "complete") {
    throw new Error(
      "Session 1 (Business & Goals) and Session 3 (Future State Design) must be complete before generating a blueprint"
    );
  }

  let parsedBlueprint: z.infer<typeof blueprintGenerationSchema>;
  const guidance = deriveBlueprintGuidance(discoveryPayload);
  const packagingAssessment = derivePlatformPackagingAssessment({
    selectedHubs: discoveryPayload.project.selectedHubs,
    implementationApproach: discoveryPayload.project.implementationApproach,
    customerPlatformTier: discoveryPayload.project.customerPlatformTier,
    platformTierSelections: normalizePlatformTierSelections(
      discoveryPayload.project.platformTierSelections
    ),
    evidenceText: getDiscoveryEvidenceText(discoveryPayload)
  });

  try {
    const discoverySummary = await loadDiscoverySummary(projectId);
    const rawBlueprint = await callAiWorkflow(
      "blueprint_generation",
      `You are a HubSpot implementation planning assistant for Muloo, a technical HubSpot delivery company.
Given structured discovery data from a client project, generate a phased implementation blueprint.

Rules:
- Return ONLY valid JSON. No explanation, no markdown, no preamble.
- Use exactly this structure: {"phases":[{"phase":1,"phaseName":"Foundation & Alignment","tasks":[{"name":"Task name","type":"Human","effortHours":3,"order":1}]}]}
- Organise work into 3 to 5 phases.
- Each phase must contain at least 1 task.
- Each task must have: name, type (Agent/Human/Client), effortHours (realistic estimate), order (within phase).
- Agent = automated by DeployOS tooling. Human = Muloo consultant time. Client = client must action.
- Human task hours must be realistic for a senior HubSpot consultant.
- Prefer concise, implementation-ready task names.
- Base the blueprint on enabled hubs, use cases, risks, data readiness, and complexity in the discovery.
- Respect the selected HubSpot customer platform and product tiers. Do not assume features that exceed the selected packaging.
- Respect the selected implementation approach. If implementationApproach is pragmatic_poc, prefer lean Phase 1 delivery patterns, external staging/workaround architecture where appropriate, and avoid enterprise-grade design unless the requirement is truly native to HubSpot.
- If the requested scope appears to require a higher tier than selected, add an early approval/decision task to resolve the packaging gap before implementation continues.
- Do not invent scope that is not evidenced in discovery.
- Only include website or CMS implementation tasks if website/CMS scope is explicitly present.
- Only include migration tasks if migration/import/data-cutover work is explicitly present.
- Use Muloo standards modules where relevant: ${guidance.recommendedModules.join(", ")}.
- Agent tasks must be low-ambiguity operational support only, such as inventories, checklists, validation, or draft artefacts.
- Do not classify configuration, architecture, training, reporting design, stakeholder workshops, or content strategy as Agent work.
- Client tasks should be approvals, access, data provision, licensing, or sign-off items only.
- Default to Human when a task needs consultant judgment.
`,
      JSON.stringify(
        {
          ...discoveryPayload.discovery,
          discoverySummary,
          packagingAssessment,
          implementationApproach:
            discoveryPayload.project.implementationApproach,
          blueprintGuidance: guidance
        },
        null,
        2
      ),
      { maxTokens: 4000 }
    );

    parsedBlueprint = await parseModelJson(
      rawBlueprint,
      blueprintGenerationSchema,
      "blueprint"
    );
  } catch (error) {
    console.error("Falling back to heuristic blueprint generation", error);
    parsedBlueprint = buildFallbackBlueprint(discoveryPayload);
  }

  parsedBlueprint = normalizeGeneratedBlueprint(
    parsedBlueprint,
    discoveryPayload
  );

  return prisma.blueprint.upsert({
    where: { projectId },
    update: {
      generatedAt: new Date(),
      tasks: {
        deleteMany: {},
        create: parsedBlueprint.phases.flatMap((phase) =>
          phase.tasks.map((task) => ({
            phase: phase.phase,
            phaseName: phase.phaseName,
            name: task.name,
            type: task.type,
            effortHours: task.effortHours,
            order: task.order
          }))
        )
      }
    },
    create: {
      projectId,
      tasks: {
        create: parsedBlueprint.phases.flatMap((phase) =>
          phase.tasks.map((task) => ({
            phase: phase.phase,
            phaseName: phase.phaseName,
            name: task.name,
            type: task.type,
            effortHours: task.effortHours,
            order: task.order
          }))
        )
      }
    },
    include: {
      tasks: {
        orderBy: [{ phase: "asc" }, { order: "asc" }]
      }
    }
  });
}

function buildStandaloneFallbackBlueprint(
  project: {
    name: string;
    commercialBrief: string | null;
    implementationApproach?: string | null;
    customerPlatformTier?: string | null;
    platformTierSelections?: Record<string, string> | null;
    selectedHubs?: string[];
  },
  evidenceItems: Array<{
    sourceLabel: string;
    sourceUrl: string | null;
    content: string | null;
  }>
) {
  const planSeed = buildStandalonePlanSeed(project, evidenceItems);
  const phaseMap = new Map<
    string,
    {
      phase: number;
      phaseName: string;
      tasks: Array<{
        name: string;
        type: (typeof blueprintTaskTypeValues)[number];
        effortHours: number;
        order: number;
      }>;
    }
  >();

  for (const task of planSeed) {
    const existingPhase = phaseMap.get(task.category);
    const taskType =
      task.assigneeType === "Agent"
        ? "Agent"
        : task.assigneeType === "Client"
          ? "Client"
          : "Human";
    const effortHours =
      taskType === "Client"
        ? 2
        : taskType === "Agent"
          ? 3
          : task.priority === "high"
            ? 6
            : task.priority === "medium"
              ? 4
              : 3;
    const normalizedEffortHours = applyImplementationApproachToEffort(
      project.implementationApproach,
      taskType,
      effortHours
    );

    if (existingPhase) {
      existingPhase.tasks.push({
        name: task.title,
        type: taskType,
        effortHours: normalizedEffortHours,
        order: existingPhase.tasks.length + 1
      });
      continue;
    }

    phaseMap.set(task.category, {
      phase: phaseMap.size + 1,
      phaseName: task.category.replace(/^\d+\s+/, ""),
      tasks: [
        {
          name: task.title,
          type: taskType,
          effortHours: normalizedEffortHours,
          order: 1
        }
      ]
    });
  }

  return blueprintGenerationSchema.parse({
    phases: Array.from(phaseMap.values())
  });
}

async function generateBlueprintFromScope(projectId: string) {
  const discoveryPayload = await loadProjectDiscoveryForBlueprint(projectId);

  if (!discoveryPayload) {
    throw new Error("Project not found");
  }

  let parsedBlueprint: z.infer<typeof blueprintGenerationSchema>;
  const guidance = deriveBlueprintGuidance(discoveryPayload);
  const discoverySummary = await loadDiscoverySummary(projectId);
  const packagingAssessment = derivePlatformPackagingAssessment({
    selectedHubs: discoveryPayload.project.selectedHubs,
    implementationApproach: discoveryPayload.project.implementationApproach,
    customerPlatformTier: discoveryPayload.project.customerPlatformTier,
    platformTierSelections: normalizePlatformTierSelections(
      discoveryPayload.project.platformTierSelections
    ),
    evidenceText: getDiscoveryEvidenceText(discoveryPayload)
  });

  try {
    const rawBlueprint = await callAiWorkflow(
      "scope_blueprint_generation",
      `You are a HubSpot technical scoping assistant for Muloo, a HubSpot delivery company.
Given a standalone scoped job brief, supporting documentation, and project context, generate a phased technical implementation blueprint.

Rules:
- Return ONLY valid JSON. No explanation, no markdown, no preamble.
- Use exactly this structure: {"phases":[{"phase":1,"phaseName":"Foundation & Alignment","tasks":[{"name":"Task name","type":"Human","effortHours":3,"order":1}]}]}
- Organise work into 3 to 5 phases.
- Each phase must contain at least 1 task.
- Each task must have: name, type (Agent/Human/Client), effortHours (realistic anticipated estimate), order (within phase).
- Agent = repeatable operational work that can be automated or agent-assisted. Human = consultant/implementer time. Client = approvals, assets, access, or sign-off.
- Base the blueprint on the scoped brief, supporting context, site/platform constraints, and handoff boundaries.
- Respect the selected HubSpot customer platform and product tiers. Do not assume features that exceed the selected packaging.
- Respect the selected implementation approach. If implementationApproach is pragmatic_poc, optimise for a lean POC path, external staging/workaround architecture where acceptable, and do not invent enterprise-grade native HubSpot work unless the brief requires it.
- If requested functionality likely requires a higher tier than selected, add an early packaging/upgrade decision task before planning impossible implementation work.
- Treat repeatable jobs as templated implementation patterns where appropriate.
- Do not require discovery-only steps unless explicitly evidenced.
- Only include tasks that are relevant to the scoped job.
- Prefer concise, implementation-ready task names.
- Use Muloo standards modules where relevant: ${guidance.recommendedModules.join(", ")}.
- If this is a CMS/theme implementation, do not introduce CRM foundation, sales, marketing, service, reporting, or portal-governance work unless the brief explicitly requires it.
- If the job is website/CMS heavy, include theme setup, templates, localization, QA, launch, and handover when evidenced.
- Agent tasks may include inventories, environment preflight, validation, setup checklists, QA passes, and repeatable configuration support.
- Do not classify stakeholder alignment, architecture decisions, custom implementation judgment, or launch ownership as Agent work.
`,
      JSON.stringify(
        {
          project: {
            id: discoveryPayload.project.id,
            name: discoveryPayload.project.name,
            engagementType: discoveryPayload.project.engagementType,
            selectedHubs: discoveryPayload.project.selectedHubs,
            scopeType: discoveryPayload.project.scopeType,
            commercialBrief: discoveryPayload.project.commercialBrief,
            problemStatement: discoveryPayload.project.problemStatement,
            solutionRecommendation:
              discoveryPayload.project.solutionRecommendation,
            scopeExecutiveSummary:
              discoveryPayload.project.scopeExecutiveSummary,
            implementationApproach:
              discoveryPayload.project.implementationApproach,
            customerPlatformTier: discoveryPayload.project.customerPlatformTier,
            platformTierSelections: normalizePlatformTierSelections(
              discoveryPayload.project.platformTierSelections
            )
          },
          client: discoveryPayload.discovery.client,
          portal: discoveryPayload.discovery.portal,
          supportingContext: discoveryPayload.discovery.evidenceItems,
          scopedSummary: discoverySummary,
          packagingAssessment,
          blueprintGuidance: guidance
        },
        null,
        2
      ),
      { maxTokens: 4000 }
    );

    parsedBlueprint = await parseModelJson(
      rawBlueprint,
      blueprintGenerationSchema,
      "blueprint"
    );
  } catch (error) {
    console.error(
      "Falling back to heuristic standalone blueprint generation",
      error
    );
    parsedBlueprint = buildStandaloneFallbackBlueprint(
      {
        name: discoveryPayload.project.name,
        commercialBrief: discoveryPayload.project.commercialBrief,
        implementationApproach: discoveryPayload.project.implementationApproach,
        customerPlatformTier: discoveryPayload.project.customerPlatformTier,
        platformTierSelections: normalizePlatformTierSelections(
          discoveryPayload.project.platformTierSelections
        ),
        selectedHubs: discoveryPayload.project.selectedHubs
      },
      discoveryPayload.discovery.evidenceItems
    );
  }

  parsedBlueprint = normalizeGeneratedBlueprint(
    parsedBlueprint,
    discoveryPayload
  );

  return prisma.blueprint.upsert({
    where: { projectId },
    update: {
      generatedAt: new Date(),
      tasks: {
        deleteMany: {},
        create: parsedBlueprint.phases.flatMap((phase) =>
          phase.tasks.map((task) => ({
            phase: phase.phase,
            phaseName: phase.phaseName,
            name: task.name,
            type: task.type,
            effortHours: task.effortHours,
            order: task.order
          }))
        )
      }
    },
    create: {
      projectId,
      tasks: {
        create: parsedBlueprint.phases.flatMap((phase) =>
          phase.tasks.map((task) => ({
            phase: phase.phase,
            phaseName: phase.phaseName,
            name: task.name,
            type: task.type,
            effortHours: task.effortHours,
            order: task.order
          }))
        )
      }
    },
    include: {
      tasks: {
        orderBy: [{ phase: "asc" }, { order: "asc" }]
      }
    }
  });
}

export async function generateBlueprintForProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      scopeType: true
    }
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.scopeType === "standalone_quote") {
    const blueprint = await generateBlueprintFromScope(projectId);
    await generateProjectPlan(projectId).catch((error) => {
      console.error(
        "Failed to refresh project plan after blueprint generation",
        error
      );
    });
    return blueprint;
  }

  const blueprint = await generateBlueprintFromDiscovery(projectId);
  await generateProjectPlan(projectId).catch((error) => {
    console.error(
      "Failed to refresh project plan after blueprint generation",
      error
    );
  });
  return blueprint;
}

export async function loadBlueprint(projectId: string) {
  return prisma.blueprint.findUnique({
    where: { projectId },
    include: {
      tasks: {
        orderBy: [{ phase: "asc" }, { order: "asc" }]
      }
    }
  });
}

function serializeProductCatalogItem<
  T extends {
    id: string;
    slug: string;
    name: string;
    serviceFamily: string;
    category: string;
    billingModel: string;
    description: string | null;
    unitPrice: number;
    defaultQuantity: number;
    unitLabel: string;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }
>(product: T) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    serviceFamily: product.serviceFamily,
    category: product.category,
    billingModel: product.billingModel,
    description: product.description,
    unitPrice: product.unitPrice,
    defaultQuantity: product.defaultQuantity,
    unitLabel: product.unitLabel,
    isActive: product.isActive,
    sortOrder: product.sortOrder,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString()
  };
}

function serializeAgentDefinition<
  T extends {
    id: string;
    slug: string;
    name: string;
    purpose: string;
    serviceFamily: string;
    provider: string;
    model: string;
    triggerType: string;
    approvalMode: string;
    allowedActions: string[];
    systemPrompt: string | null;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }
>(agent: T) {
  return {
    id: agent.id,
    slug: agent.slug,
    name: agent.name,
    purpose: agent.purpose,
    serviceFamily: agent.serviceFamily,
    provider: agent.provider,
    model: agent.model,
    triggerType: agent.triggerType,
    approvalMode: agent.approvalMode,
    allowedActions: agent.allowedActions,
    systemPrompt: agent.systemPrompt,
    isActive: agent.isActive,
    sortOrder: agent.sortOrder,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString()
  };
}

export function serializeWorkspaceUser<
  T extends {
    id: string;
    name: string;
    email: string;
    password?: string | null;
    role: string;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }
>(user: T) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    hasPassword: Boolean(user.password),
    role: user.role,
    isActive: user.isActive,
    sortOrder: user.sortOrder,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

function serializeWorkspaceProviderConnection<
  T extends {
    id: string;
    providerKey: string;
    label: string;
    connectionType: string;
    apiKey: string | null;
    defaultModel: string | null;
    endpointUrl: string | null;
    notes: string | null;
    isEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  }
>(provider: T) {
  return {
    id: provider.id,
    providerKey: provider.providerKey,
    label: provider.label,
    connectionType: provider.connectionType,
    apiKey: provider.apiKey,
    hasApiKey: Boolean(provider.apiKey),
    defaultModel: provider.defaultModel,
    endpointUrl: provider.endpointUrl,
    notes: provider.notes,
    isEnabled: provider.isEnabled,
    createdAt: provider.createdAt.toISOString(),
    updatedAt: provider.updatedAt.toISOString()
  };
}

function serializeWorkspaceAiRouting<
  T extends {
    id: string;
    workflowKey: string;
    label: string;
    providerKey: string;
    modelOverride: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }
>(routing: T) {
  return {
    id: routing.id,
    workflowKey: routing.workflowKey,
    label: routing.label,
    providerKey: routing.providerKey,
    modelOverride: routing.modelOverride,
    notes: routing.notes,
    createdAt: routing.createdAt.toISOString(),
    updatedAt: routing.updatedAt.toISOString()
  };
}

function serializeWorkspaceApiKey<
  T extends {
    keyName: string;
    label: string | null;
    keyValue: string;
    createdAt: Date;
    updatedAt: Date;
  }
>(apiKey: T) {
  return {
    keyName: apiKey.keyName,
    label: apiKey.label,
    isSet: Boolean(apiKey.keyValue.trim()),
    createdAt: apiKey.createdAt.toISOString(),
    updatedAt: apiKey.updatedAt.toISOString()
  };
}

function isProjectContextType(
  value: string
): value is (typeof projectContextTypes)[number] {
  return (projectContextTypes as readonly string[]).includes(value);
}

function formatProjectContextType(value: string) {
  const labels: Record<string, string> = {
    existing_knowledge: "What we already know",
    work_done: "What has already been done",
    meeting_notes: "Meeting and session notes",
    email_brief: "Email context",
    session_prep: "Session prep notes",
    blockers: "Known blockers and sensitivities"
  };

  return labels[value] ?? value;
}

function serializeProjectContextEntry<
  T extends {
    contextType: string;
    content: string;
    source: string | null;
    createdAt: Date;
    updatedAt: Date;
  }
>(entry: T) {
  return {
    contextType: entry.contextType,
    label: formatProjectContextType(entry.contextType),
    content: entry.content,
    source: entry.source,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString()
  };
}

function serializeWorkspaceEmailSettings<
  T extends {
    id: string;
    providerLabel: string;
    host: string | null;
    port: number | null;
    secure: boolean;
    username: string | null;
    password: string | null;
    fromName: string | null;
    fromEmail: string | null;
    replyToEmail: string | null;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  }
>(settings: T) {
  return {
    id: settings.id,
    providerLabel: settings.providerLabel,
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    username: settings.username,
    hasPassword: Boolean(settings.password),
    fromName: settings.fromName,
    fromEmail: settings.fromEmail,
    replyToEmail: settings.replyToEmail,
    enabled: settings.enabled,
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString()
  };
}

function serializeWorkspaceEmailOAuthConnection<
  T extends {
    id: string;
    providerKey: string;
    label: string;
    clientId: string | null;
    clientSecret: string | null;
    redirectUri: string | null;
    scopes: string[];
    connectedEmail: string | null;
    connectedName: string | null;
    tokenExpiresAt: Date | null;
    gmailFilterLabel: string | null;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  }
>(connection: T) {
  return {
    id: connection.id,
    providerKey: connection.providerKey,
    label: connection.label,
    clientId: connection.clientId,
    hasClientSecret: Boolean(connection.clientSecret),
    redirectUri: connection.redirectUri,
    scopes: connection.scopes,
    connectedEmail: connection.connectedEmail,
    connectedName: connection.connectedName,
    tokenExpiresAt: connection.tokenExpiresAt?.toISOString() ?? null,
    gmailFilterLabel: connection.gmailFilterLabel,
    isConnected: Boolean(connection.connectedEmail),
    enabled: connection.enabled,
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString()
  };
}

function serializeWorkspaceTodo<
  T extends {
    id: string;
    title: string;
    notes: string | null;
    completed: boolean;
    completedAt: Date | null;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }
>(todo: T) {
  return {
    id: todo.id,
    title: todo.title,
    notes: todo.notes ?? undefined,
    completed: todo.completed,
    completedAt: todo.completedAt?.toISOString(),
    sortOrder: todo.sortOrder,
    createdAt: todo.createdAt.toISOString(),
    updatedAt: todo.updatedAt.toISOString()
  };
}

function serializeWorkspaceCalendarConnection<
  T extends {
    id: string;
    providerKey: string;
    label: string;
    clientId: string | null;
    clientSecret: string | null;
    redirectUri: string | null;
    scopes: string[];
    connectedEmail: string | null;
    connectedName: string | null;
    tokenExpiresAt: Date | null;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  }
>(connection: T) {
  return {
    id: connection.id,
    providerKey: connection.providerKey,
    label: connection.label,
    clientId: connection.clientId,
    hasClientSecret: Boolean(connection.clientSecret),
    redirectUri: connection.redirectUri || resolveWorkspaceCalendarRedirectUri(),
    scopes: connection.scopes,
    connectedEmail: connection.connectedEmail,
    connectedName: connection.connectedName,
    tokenExpiresAt: connection.tokenExpiresAt?.toISOString() ?? null,
    enabled: connection.enabled,
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString()
  };
}

function serializeWorkspaceXeroConnection<
  T extends {
    id: string;
    tenantId: string | null;
    tenantName: string | null;
    connectedEmail: string | null;
    tokenExpiresAt: Date | null;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  }
>(connection: T) {
  return {
    id: connection.id,
    tenantId: connection.tenantId,
    tenantName: connection.tenantName,
    connectedEmail: connection.connectedEmail,
    tokenExpiresAt: connection.tokenExpiresAt?.toISOString() ?? null,
    enabled: connection.enabled,
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString()
  };
}

function serializeWorkspaceDailySummary<
  T extends {
    id: string;
    summaryDate: Date;
    content: string;
    generatedBy: string;
    createdAt: Date;
  }
>(summary: T) {
  return {
    id: summary.id,
    summaryDate: summary.summaryDate.toISOString(),
    content: summary.content,
    generatedBy: summary.generatedBy,
    createdAt: summary.createdAt.toISOString()
  };
}

function serializeHubSpotPortal<
  T extends {
    id: string;
    portalId: string;
    displayName: string;
    region: string | null;
    connected: boolean;
    connectedEmail: string | null;
    connectedName: string | null;
    hubDomain: string | null;
    tokenExpiresAt: Date | null;
    installedAt: Date | null;
    updatedAt: Date;
    createdAt: Date;
  }
>(portal: T) {
  return {
    id: portal.id,
    portalId: portal.portalId,
    displayName: portal.displayName,
    region: portal.region,
    connected: portal.connected,
    connectedEmail: portal.connectedEmail,
    connectedName: portal.connectedName,
    hubDomain: portal.hubDomain,
    tokenExpiresAt: portal.tokenExpiresAt?.toISOString() ?? null,
    installedAt: portal.installedAt?.toISOString() ?? null,
    updatedAt: portal.updatedAt.toISOString(),
    createdAt: portal.createdAt.toISOString()
  };
}

function createHubSpotLogger() {
  return {
    info(message: string, context?: Record<string, unknown>) {
      console.info(message, context);
    },
    warn(message: string, context?: Record<string, unknown>) {
      console.warn(message, context);
    },
    error(message: string, context?: Record<string, unknown>) {
      console.error(message, context);
    }
  };
}

function serializePortalSnapshot<
  T extends {
    id: string;
    portalId: string;
    capturedAt: Date;
    hubTier: string | null;
    activeHubs: string[];
    contactPropertyCount: number | null;
    companyPropertyCount: number | null;
    dealPropertyCount: number | null;
    ticketPropertyCount: number | null;
    customObjectCount: number | null;
    dealPipelineCount: number | null;
    dealStageCount: number | null;
    ticketPipelineCount: number | null;
    activeUserCount: number | null;
    teamCount: number | null;
    activeListCount: number | null;
    rawApiResponses: Prisma.Prisma.JsonValue | null;
    createdAt: Date;
  }
>(snapshot: T) {
  return {
    id: snapshot.id,
    portalId: snapshot.portalId,
    capturedAt: snapshot.capturedAt.toISOString(),
    hubTier: snapshot.hubTier,
    activeHubs: snapshot.activeHubs,
    contactPropertyCount: snapshot.contactPropertyCount,
    companyPropertyCount: snapshot.companyPropertyCount,
    dealPropertyCount: snapshot.dealPropertyCount,
    ticketPropertyCount: snapshot.ticketPropertyCount,
    customObjectCount: snapshot.customObjectCount,
    dealPipelineCount: snapshot.dealPipelineCount,
    dealStageCount: snapshot.dealStageCount,
    ticketPipelineCount: snapshot.ticketPipelineCount,
    activeUserCount: snapshot.activeUserCount,
    teamCount: snapshot.teamCount,
    activeListCount: snapshot.activeListCount,
    rawApiResponses: snapshot.rawApiResponses,
    createdAt: snapshot.createdAt.toISOString()
  };
}

const findingAreaSchema = z.enum([
  "crm",
  "pipelines",
  "properties",
  "views",
  "dashboards",
  "workflows",
  "team",
  "permissions",
  "data_quality",
  "integrations",
  "sequences",
  "reporting",
  "other"
]);

const findingSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
const findingStatusSchema = z.enum(["open", "in_progress", "resolved"]);
const recommendationTypeSchema = z.enum([
  "quick_win",
  "structural",
  "advisory"
]);
const recommendationEffortSchema = z.enum(["xs", "s", "m", "l", "xl"]);
const recommendationImpactSchema = z.enum(["low", "medium", "high"]);
const recommendationApprovalStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected"
]);
const aiGeneratedPortalAuditRecommendationPrefix = "[AI audit]";
const portalAuditGenerationSchema = z.object({
  executiveSummary: z.string().trim().min(1),
  findings: z
    .array(
      z.object({
        area: findingAreaSchema,
        severity: findingSeveritySchema,
        title: z.string().trim().min(1),
        description: z.string().trim().min(1),
        quickWin: z.boolean().optional(),
        phaseRecommendation: z.string().trim().min(1).optional(),
        evidence: z.string().trim().min(1).optional()
      })
    )
    .min(3)
    .max(24),
  recommendations: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        area: findingAreaSchema,
        type: recommendationTypeSchema,
        phase: z.string().trim().min(1).optional(),
        rationale: z.string().trim().min(1),
        effort: recommendationEffortSchema,
        impact: recommendationImpactSchema,
        linkedFindingTitles: z.array(z.string().trim().min(1)).optional()
      })
    )
    .max(12)
    .default([])
});

const projectPrepareBriefSchema = z.object({
  executiveSummary: z.string().trim().min(1),
  meetingGoal: z.string().trim().min(1),
  whatWeKnow: z.array(z.string().trim().min(1)).min(3).max(12).default([]),
  openQuestions: z.array(z.string().trim().min(1)).min(3).max(12).default([]),
  agenda: z.array(z.string().trim().min(1)).min(4).max(12).default([]),
  recommendedApproach: z.string().trim().min(1),
  likelyWorkstreams: z.array(z.string().trim().min(1)).min(2).max(10).default([]),
  risks: z.array(z.string().trim().min(1)).max(10).default([]),
  suggestedNextStep: z.string().trim().min(1)
});

type PrepareBrief = z.infer<typeof projectPrepareBriefSchema>;

function normalizeAuditString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeAuditBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "y"].includes(normalized)) {
      return true;
    }

    if (["false", "no", "n"].includes(normalized)) {
      return false;
    }
  }

  return undefined;
}

function truncateModelContext(
  value: string | null | undefined,
  maxLength: number
): string | null {
  const normalized = normalizeAuditString(value);

  if (!normalized) {
    return null;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function normalizePrepareBriefList(
  value: unknown,
  maximum: number
): string[] {
  const entries = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value
          .split(/\n+|(?:^|\s)[-*•]\s+|\d+\.\s+|;\s+/)
          .map((entry) => entry.trim())
          .filter(Boolean)
      : [];

  return entries
    .map((entry) => normalizeAuditString(entry))
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, maximum);
}

function normalizePrepareBriefText(value: unknown): string | null {
  if (Array.isArray(value)) {
    const joined = value
      .map((entry) => normalizeAuditString(entry))
      .filter((entry): entry is string => Boolean(entry))
      .join(" ");

    return normalizeAuditString(joined);
  }

  return normalizeAuditString(value);
}

function normalizePrepareBriefPayload(value: unknown) {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    executiveSummary:
      normalizePrepareBriefText(
        record.executiveSummary ?? record.summary ?? record.overview
      ) ?? "",
    meetingGoal:
      normalizePrepareBriefText(
        record.meetingGoal ?? record.goal ?? record.objective
      ) ?? "",
    whatWeKnow: normalizePrepareBriefList(
      record.whatWeKnow ?? record.what_we_know ?? record.knownContext,
      12
    ),
    openQuestions: normalizePrepareBriefList(
      record.openQuestions ?? record.open_questions ?? record.questions,
      12
    ),
    agenda: normalizePrepareBriefList(
      record.agenda ?? record.agendaItems ?? record.meetingAgenda,
      12
    ),
    recommendedApproach:
      normalizePrepareBriefText(
        record.recommendedApproach ??
          record.recommended_approach ??
          record.approach
      ) ?? "",
    likelyWorkstreams: normalizePrepareBriefList(
      record.likelyWorkstreams ?? record.likely_workstreams ?? record.workstreams,
      10
    ),
    risks: normalizePrepareBriefList(
      record.risks ?? record.deliveryRisks ?? record.constraints,
      10
    ),
    suggestedNextStep:
      normalizePrepareBriefText(
        record.suggestedNextStep ?? record.suggested_next_step ?? record.nextStep
      ) ?? ""
  };
}

async function parseProjectPrepareBriefModelJson(rawText: string) {
  const normalizedJson = extractJsonBlock(rawText);

  try {
    return projectPrepareBriefSchema.parse(
      normalizePrepareBriefPayload(JSON.parse(normalizedJson) as unknown)
    );
  } catch (initialError) {
    try {
      const repairedText = await callAiWorkflow(
        "json_repair",
        `You repair malformed JSON for Muloo Deploy OS.

Rules:
- Return ONLY valid JSON.
- Do not add markdown fences or commentary.
- Preserve the original intended structure and values as closely as possible.
`,
        JSON.stringify(
          {
            label: "project-prepare-brief",
            malformedJson: normalizedJson
          },
          null,
          2
        ),
        { maxTokens: 4000 }
      );

      const repairedJson = extractJsonBlock(repairedText);
      return projectPrepareBriefSchema.parse(
        normalizePrepareBriefPayload(JSON.parse(repairedJson) as unknown)
      );
    } catch (repairError) {
      if (
        initialError instanceof SyntaxError ||
        initialError instanceof ZodError
      ) {
        throw initialError;
      }

      if (
        repairError instanceof SyntaxError ||
        repairError instanceof ZodError
      ) {
        throw repairError;
      }

      throw new SyntaxError(
        "Failed to parse project-prepare-brief JSON from model output"
      );
    }
  }
}

function normalizePortalAuditArea(
  value: unknown,
  fallbackText = ""
): z.infer<typeof findingAreaSchema> {
  const normalizedValue = normalizeAuditString(value)?.toLowerCase() ?? "";
  const haystack = `${normalizedValue} ${fallbackText}`.toLowerCase();

  if (haystack.includes("pipeline")) {
    return "pipelines";
  }

  if (
    haystack.includes("property") ||
    haystack.includes("field") ||
    haystack.includes("schema")
  ) {
    return "properties";
  }

  if (haystack.includes("view") || haystack.includes("list")) {
    return "views";
  }

  if (haystack.includes("dashboard")) {
    return "dashboards";
  }

  if (haystack.includes("workflow") || haystack.includes("automation")) {
    return "workflows";
  }

  if (
    haystack.includes("team") ||
    haystack.includes("user") ||
    haystack.includes("owner")
  ) {
    return "team";
  }

  if (
    haystack.includes("permission") ||
    haystack.includes("role") ||
    haystack.includes("access")
  ) {
    return "permissions";
  }

  if (
    haystack.includes("data quality") ||
    haystack.includes("duplicate") ||
    haystack.includes("lifecycle") ||
    haystack.includes("hygiene")
  ) {
    return "data_quality";
  }

  if (
    haystack.includes("integration") ||
    haystack.includes("sync") ||
    haystack.includes("connected app")
  ) {
    return "integrations";
  }

  if (haystack.includes("sequence")) {
    return "sequences";
  }

  if (haystack.includes("report")) {
    return "reporting";
  }

  if (
    haystack.includes("crm") ||
    haystack.includes("lead") ||
    haystack.includes("contact") ||
    haystack.includes("company") ||
    haystack.includes("deal")
  ) {
    return "crm";
  }

  return "other";
}

function normalizePortalAuditSeverity(
  value: unknown
): z.infer<typeof findingSeveritySchema> {
  const normalized = normalizeAuditString(value)?.toLowerCase() ?? "";

  if (normalized === "critical" || normalized === "high") {
    return normalized;
  }

  if (
    normalized === "medium" ||
    normalized === "moderate" ||
    normalized === "med"
  ) {
    return "medium";
  }

  return "low";
}

function normalizePortalAuditRecommendationType(
  value: unknown,
  fallbackText = ""
): z.infer<typeof recommendationTypeSchema> {
  const haystack = `${normalizeAuditString(value) ?? ""} ${fallbackText}`
    .toLowerCase()
    .trim();

  if (haystack.includes("quick")) {
    return "quick_win";
  }

  if (
    haystack.includes("structural") ||
    haystack.includes("rebuild") ||
    haystack.includes("architecture")
  ) {
    return "structural";
  }

  return "advisory";
}

function normalizePortalAuditEffort(
  value: unknown
): z.infer<typeof recommendationEffortSchema> {
  const normalized = normalizeAuditString(value)?.toLowerCase() ?? "";

  if (["xs", "s", "m", "l", "xl"].includes(normalized)) {
    return normalized as z.infer<typeof recommendationEffortSchema>;
  }

  if (["small", "low"].includes(normalized)) {
    return "s";
  }

  if (["medium", "moderate"].includes(normalized)) {
    return "m";
  }

  if (["large", "high"].includes(normalized)) {
    return "l";
  }

  return "m";
}

function normalizePortalAuditImpact(
  value: unknown
): z.infer<typeof recommendationImpactSchema> {
  const normalized = normalizeAuditString(value)?.toLowerCase() ?? "";

  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }

  if (normalized === "moderate") {
    return "medium";
  }

  return "medium";
}

function normalizePortalAuditPayload(value: unknown) {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const findingsSource = Array.isArray(record.findings) ? record.findings : [];
  const recommendationsSource = Array.isArray(record.recommendations)
    ? record.recommendations
    : [];
  const executiveSummary =
    normalizeAuditString(record.executiveSummary) ??
    normalizeAuditString(record.summary) ??
    normalizeAuditString(record.executive_summary) ??
    "Portal audit generated without an executive summary.";

  return {
    executiveSummary,
    findings: findingsSource
      .map((entry) => {
        const item =
          entry && typeof entry === "object" && !Array.isArray(entry)
            ? (entry as Record<string, unknown>)
            : {};
        const title =
          normalizeAuditString(item.title) ??
          normalizeAuditString(item.finding) ??
          normalizeAuditString(item.name) ??
          normalizeAuditString(item.issue) ??
          normalizeAuditString(item.observation);
        const description =
          normalizeAuditString(item.description) ??
          normalizeAuditString(item.details) ??
          normalizeAuditString(item.detail) ??
          normalizeAuditString(item.summary) ??
          normalizeAuditString(item.observation) ??
          normalizeAuditString(item.issue) ??
          title;

        if (!title || !description) {
          return null;
        }

        const fallbackText = `${title} ${description}`;

        return {
          area: normalizePortalAuditArea(
            item.area ?? item.category ?? item.section ?? item.group,
            fallbackText
          ),
          severity: normalizePortalAuditSeverity(
            item.severity ?? item.priority ?? item.risk
          ),
          title,
          description,
          quickWin: normalizeAuditBoolean(
            item.quickWin ?? item.quick_win ?? item.isQuickWin
          ),
          phaseRecommendation:
            normalizeAuditString(
              item.phaseRecommendation ?? item.phase ?? item.timing
            ) ?? undefined,
          evidence:
            normalizeAuditString(
              item.evidence ?? item.proof ?? item.supportingEvidence
            ) ?? undefined
        };
      })
      .filter(Boolean),
    recommendations: recommendationsSource
      .map((entry) => {
        const item =
          entry && typeof entry === "object" && !Array.isArray(entry)
            ? (entry as Record<string, unknown>)
            : {};
        const title =
          normalizeAuditString(item.title) ??
          normalizeAuditString(item.recommendation) ??
          normalizeAuditString(item.action) ??
          normalizeAuditString(item.name);
        const rationale =
          normalizeAuditString(item.rationale) ??
          normalizeAuditString(item.reason) ??
          normalizeAuditString(item.description) ??
          normalizeAuditString(item.why) ??
          title;

        if (!title || !rationale) {
          return null;
        }

        const fallbackText = `${title} ${rationale}`;

        return {
          title,
          area: normalizePortalAuditArea(
            item.area ?? item.category ?? item.section ?? item.group,
            fallbackText
          ),
          type: normalizePortalAuditRecommendationType(
            item.type ?? item.recommendationType,
            fallbackText
          ),
          phase:
            normalizeAuditString(item.phase ?? item.when ?? item.timing) ??
            undefined,
          rationale,
          effort: normalizePortalAuditEffort(
            item.effort ?? item.size ?? item.levelOfEffort
          ),
          impact: normalizePortalAuditImpact(
            item.impact ?? item.priority ?? item.expectedImpact
          ),
          linkedFindingTitles: Array.isArray(item.linkedFindingTitles)
            ? item.linkedFindingTitles
                .map((title) => normalizeAuditString(title))
                .filter((title): title is string => Boolean(title))
            : undefined
        };
      })
      .filter(Boolean)
  };
}

async function parsePortalAuditModelJson(rawText: string) {
  const normalizedJson = extractJsonBlock(rawText);

  try {
    return portalAuditGenerationSchema.parse(
      normalizePortalAuditPayload(JSON.parse(normalizedJson) as unknown)
    );
  } catch (initialError) {
    try {
      const repairedText = await callAiWorkflow(
        "json_repair",
        `You repair malformed JSON for Muloo Deploy OS.

Rules:
- Return ONLY valid JSON.
- Do not add markdown fences or commentary.
- Preserve the original intended structure and values as closely as possible.
`,
        JSON.stringify(
          {
            label: "portal-audit",
            malformedJson: normalizedJson
          },
          null,
          2
        ),
        { maxTokens: 4000 }
      );

      const repairedJson = extractJsonBlock(repairedText);
      return portalAuditGenerationSchema.parse(
        normalizePortalAuditPayload(JSON.parse(repairedJson) as unknown)
      );
    } catch (repairError) {
      if (
        initialError instanceof SyntaxError ||
        initialError instanceof ZodError
      ) {
        throw initialError;
      }

      if (
        repairError instanceof SyntaxError ||
        repairError instanceof ZodError
      ) {
        throw repairError;
      }

      throw new SyntaxError("Failed to parse portal-audit JSON from model output");
    }
  }
}

const createFindingInputSchema = z.object({
  area: findingAreaSchema,
  severity: findingSeveritySchema,
  source: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  quickWin: z.boolean().optional(),
  phaseRecommendation: z.string().trim().min(1).optional(),
  evidence: z
    .union([
      z.string().trim().min(1),
      z.record(z.string(), z.unknown()),
      z.array(z.unknown())
    ])
    .optional()
});

const updateFindingInputSchema = z.object({
  area: findingAreaSchema.optional(),
  severity: findingSeveritySchema.optional(),
  source: z.string().trim().min(1).nullable().optional(),
  category: z.string().trim().min(1).nullable().optional(),
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  quickWin: z.boolean().optional(),
  phaseRecommendation: z.string().trim().min(1).optional(),
  evidence: z
    .union([
      z.string().trim().min(1),
      z.record(z.string(), z.unknown()),
      z.array(z.unknown())
    ])
    .nullable()
    .optional(),
  status: findingStatusSchema.optional()
});

const createRecommendationInputSchema = z.object({
  title: z.string().trim().min(1),
  area: findingAreaSchema,
  type: recommendationTypeSchema,
  phase: z.string().trim().min(1).optional(),
  rationale: z.string().trim().min(1),
  effort: recommendationEffortSchema,
  impact: recommendationImpactSchema,
  findingId: z.string().trim().min(1).optional(),
  linkedFindingIds: z.array(z.string().trim().min(1)).optional()
});

const updateRecommendationInputSchema = z.object({
  title: z.string().trim().min(1).optional(),
  area: findingAreaSchema.optional(),
  type: recommendationTypeSchema.optional(),
  phase: z.string().trim().min(1).optional(),
  rationale: z.string().trim().min(1).optional(),
  effort: recommendationEffortSchema.optional(),
  impact: recommendationImpactSchema.optional(),
  findingId: z.string().trim().min(1).nullable().optional(),
  linkedFindingIds: z.array(z.string().trim().min(1)).optional(),
  clientApprovalStatus: recommendationApprovalStatusSchema.optional()
});

function normalizeFindingEvidence(
  value: unknown
):
  | Prisma.Prisma.InputJsonValue
  | Prisma.Prisma.NullTypes.JsonNull
  | undefined {
  if (value === undefined || value === null) {
    return value === undefined ? undefined : Prisma.Prisma.JsonNull;
  }

  if (typeof value === "string") {
    return { summary: value } as Prisma.Prisma.InputJsonValue;
  }

  return value as Prisma.Prisma.InputJsonValue;
}

function serializeFinding<
  T extends {
    id: string;
    projectId: string;
    area: string;
    severity: string;
    source: string | null;
    category: string | null;
    title: string;
    description: string;
    quickWin: boolean;
    phaseRecommendation: string;
    evidence: Prisma.Prisma.JsonValue | null;
    status: string;
    recommendations?: Array<{
      id: string;
      title: string;
      rationale: string;
      type: string;
      impact: string;
      effort: string;
      phase: string;
      findingId: string | null;
    }>;
    createdAt: Date;
    updatedAt: Date;
  }
>(finding: T) {
  return {
    id: finding.id,
    projectId: finding.projectId,
    area: finding.area,
    severity: finding.severity,
    source: finding.source,
    category: finding.category,
    title: finding.title,
    description: finding.description,
    quickWin: finding.quickWin,
    phaseRecommendation: finding.phaseRecommendation,
    evidence: finding.evidence,
    status: finding.status,
    recommendations:
      finding.recommendations?.map((recommendation) => ({
        id: recommendation.id,
        title: recommendation.title,
        rationale: recommendation.rationale,
        type: recommendation.type,
        impact: recommendation.impact,
        effort: recommendation.effort,
        phase: recommendation.phase,
        findingId: recommendation.findingId
      })) ?? [],
    createdAt: finding.createdAt.toISOString(),
    updatedAt: finding.updatedAt.toISOString()
  };
}

function serializeRecommendation<
  T extends {
    id: string;
    projectId: string;
    title: string;
    area: string;
    type: string;
    phase: string;
    rationale: string;
    effort: string;
    impact: string;
    clientApprovalStatus: string;
    findingId: string | null;
    linkedFindingIds: string[];
    createdAt: Date;
    updatedAt: Date;
  }
>(recommendation: T) {
  return {
    id: recommendation.id,
    projectId: recommendation.projectId,
    title: recommendation.title,
    area: recommendation.area,
    type: recommendation.type,
    phase: recommendation.phase,
    rationale: recommendation.rationale,
    effort: recommendation.effort,
    impact: recommendation.impact,
    clientApprovalStatus: recommendation.clientApprovalStatus,
    findingId: recommendation.findingId,
    linkedFindingIds: recommendation.linkedFindingIds,
    createdAt: recommendation.createdAt.toISOString(),
    updatedAt: recommendation.updatedAt.toISOString()
  };
}

async function ensureProductCatalogSeeded() {
  for (const product of defaultProductCatalog) {
    await prisma.productCatalogItem.upsert({
      where: { slug: product.slug },
      update: {},
      create: {
        ...product
      }
    });
  }
}

async function ensureProviderConnectionsSeeded() {
  for (const provider of defaultProviderConnections) {
    await prisma.workspaceProviderConnection.upsert({
      where: { providerKey: provider.providerKey },
      update: {},
      create: {
        ...provider
      }
    });
  }
}

async function ensureAiRoutingSeeded() {
  for (const routing of defaultAiWorkflowRouting) {
    await prisma.workspaceAiRouting.upsert({
      where: { workflowKey: routing.workflowKey },
      update: {},
      create: {
        ...routing
      }
    });
  }
}

async function ensureWorkspaceEmailSettingsSeeded() {
  const existingCount = await prisma.workspaceEmailSettings.count();

  if (existingCount > 0) {
    return;
  }

  await prisma.workspaceEmailSettings.create({
    data: {
      providerLabel: "SMTP",
      secure: false,
      enabled: false
    }
  });
}

async function ensureWorkspaceEmailOAuthConnectionsSeeded() {
  const existingConnection =
    await prisma.workspaceEmailOAuthConnection.findUnique({
      where: { providerKey: "google_workspace" }
    });

  if (existingConnection) {
    return;
  }

  await prisma.workspaceEmailOAuthConnection.create({
    data: {
      providerKey: "google_workspace",
      label: "Google Workspace Mailbox",
      scopes: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.readonly"
      ],
      enabled: false
    }
  });
}

async function ensureAgentCatalogSeeded() {
  for (const agent of defaultAgentCatalog) {
    const existingAgent = await prisma.agentDefinition.findUnique({
      where: { slug: agent.slug }
    });

    if (existingAgent) {
      continue;
    }

    await prisma.agentDefinition.create({
      data: {
        ...agent,
        allowedActions: [...agent.allowedActions]
      }
    });
  }
}

async function ensureDeliveryTemplatesSeeded() {
  const existingCount = await prisma.deliveryTemplate.count();

  if (existingCount > 0) {
    return;
  }

  for (const template of defaultDeliveryTemplates) {
    await prisma.deliveryTemplate.create({
      data: {
        slug: template.slug,
        name: template.name,
        description: template.description,
        serviceFamily: template.serviceFamily,
        category: template.category,
        scopeType: template.scopeType,
        recommendedHubs: [...template.recommendedHubs],
        defaultPlannedHours: template.defaultPlannedHours,
        isActive: true,
        sortOrder: template.sortOrder,
        tasks: {
          create: template.tasks.map((task) => ({
            title: task.title,
            description: task.description,
            category: task.category,
            executionType: task.executionType,
            priority: task.priority,
            status: task.status,
            qaRequired: "qaRequired" in task ? task.qaRequired : false,
            approvalRequired:
              "approvalRequired" in task ? task.approvalRequired : false,
            assigneeType: task.assigneeType,
            plannedHours: task.plannedHours ?? null,
            sortOrder: task.sortOrder
          }))
        }
      }
    });
  }
}

export async function loadProductCatalog() {
  await ensureProductCatalogSeeded();

  const products = await prisma.productCatalogItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });

  return products.map((product) => serializeProductCatalogItem(product));
}

export async function loadAgentCatalog() {
  await ensureAgentCatalogSeeded();

  const agents = await prisma.agentDefinition.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });

  return agents.map((agent) => serializeAgentDefinition(agent));
}

export async function loadProviderConnections() {
  await ensureProviderConnectionsSeeded();

  const providers = await prisma.workspaceProviderConnection.findMany({
    orderBy: [{ label: "asc" }]
  });

  return providers.map((provider) =>
    serializeWorkspaceProviderConnection(provider)
  );
}

export async function loadWorkspaceApiKeys() {
  const keys = await prisma.workspaceApiKey.findMany({
    where: { workspaceId: DEFAULT_WORKSPACE_ID },
    orderBy: [{ label: "asc" }, { keyName: "asc" }]
  });

  return keys.map((key) => serializeWorkspaceApiKey(key));
}

export async function loadHubSpotPortals() {
  const portals = await prisma.hubSpotPortal.findMany({
    where: {
      NOT: {
        portalId: {
          startsWith: pendingPortalPrefix
        }
      }
    },
    orderBy: [
      { connected: "desc" },
      { updatedAt: "desc" },
      { displayName: "asc" }
    ]
  });

  return portals.map((portal) => serializeHubSpotPortal(portal));
}

export async function loadLatestPortalSnapshot(portalId: string) {
  const snapshot = await prisma.portalSnapshot.findFirst({
    where: { portalId },
    orderBy: [{ capturedAt: "desc" }]
  });

  return snapshot ? serializePortalSnapshot(snapshot) : null;
}

export async function createPortalSnapshotForPortal(portalId: string) {
  const portal = await prisma.hubSpotPortal.findUnique({
    where: { id: portalId },
    select: {
      id: true,
      accessToken: true,
      scopes: true
    }
  });

  if (!portal) {
    throw new Error("HubSpot portal not found");
  }

  if (!portal.accessToken) {
    throw new Error("HubSpot portal is not connected");
  }

  const client = new HubSpotClient({
    accessToken: portal.accessToken,
    baseUrl: normalizeHubSpotBaseUrl(),
    logger: createHubSpotLogger(),
    scopes: portal.scopes
  });

  const snapshotPayload = await client.capturePortalSnapshot();
  const { activeUserCount, teamCount, activeListCount, rawApiResponses } =
    snapshotPayload;
  const snapshot = await prisma.portalSnapshot.create({
    data: {
      portalId,
      hubTier: snapshotPayload.hubTier ?? null,
      activeHubs: snapshotPayload.activeHubs,
      contactPropertyCount: snapshotPayload.contactPropertyCount ?? null,
      companyPropertyCount: snapshotPayload.companyPropertyCount ?? null,
      dealPropertyCount: snapshotPayload.dealPropertyCount ?? null,
      ticketPropertyCount: snapshotPayload.ticketPropertyCount ?? null,
      customObjectCount: snapshotPayload.customObjectCount ?? null,
      dealPipelineCount: snapshotPayload.dealPipelineCount ?? null,
      dealStageCount: snapshotPayload.dealStageCount ?? null,
      ticketPipelineCount: snapshotPayload.ticketPipelineCount ?? null,
      activeUserCount: activeUserCount ?? null,
      teamCount: teamCount ?? null,
      activeListCount: activeListCount ?? null,
      rawApiResponses: rawApiResponses as Prisma.Prisma.InputJsonValue
    }
  });

  return serializePortalSnapshot(snapshot);
}

export async function loadProjectContext(projectId: string) {
  const entries = await prisma.projectContext.findMany({
    where: { projectId }
  });

  const entryMap = new Map(
    entries.map((entry) => [entry.contextType, serializeProjectContextEntry(entry)])
  );

  return Object.fromEntries(
    projectContextTypes.map((contextType) => [
      contextType,
      entryMap.get(contextType) ?? null
    ])
  );
}

export async function saveProjectContext(
  projectId: string,
  contextType: string,
  value: {
    content?: unknown;
    source?: unknown;
  }
) {
  if (!isProjectContextType(contextType)) {
    throw new Error("Unsupported project context type");
  }

  if (typeof value.content !== "string") {
    throw new Error("content must be a string");
  }

  if (value.source !== undefined && typeof value.source !== "string") {
    throw new Error("source must be a string");
  }

  const entry = await prisma.projectContext.upsert({
    where: {
      projectId_contextType: {
        projectId,
        contextType
      }
    },
    create: {
      projectId,
      contextType,
      content: value.content,
      source: typeof value.source === "string" ? value.source : "manual"
    },
    update: {
      content: value.content,
      source: typeof value.source === "string" ? value.source : "manual",
      updatedAt: new Date()
    }
  });

  return serializeProjectContextEntry(entry);
}

export async function deleteProjectContext(projectId: string, contextType: string) {
  if (!isProjectContextType(contextType)) {
    throw new Error("Unsupported project context type");
  }

  await prisma.projectContext.deleteMany({
    where: {
      projectId,
      contextType
    }
  });

  return { success: true };
}

export async function loadProjectFindings(projectId: string) {
  const findings = await prisma.finding.findMany({
    where: { projectId },
    include: {
      recommendations: {
        orderBy: [{ createdAt: "desc" }],
        take: 3
      }
    },
    orderBy: [{ createdAt: "desc" }]
  });

  const severityOrder = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3
  } as const;

  return findings
    .sort((left, right) => {
      const leftOrder =
        severityOrder[left.severity as keyof typeof severityOrder] ?? 99;
      const rightOrder =
        severityOrder[right.severity as keyof typeof severityOrder] ?? 99;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return right.createdAt.valueOf() - left.createdAt.valueOf();
    })
    .map((finding) => serializeFinding(finding));
}

export async function createProjectFinding(projectId: string, value: unknown) {
  const payload = createFindingInputSchema.parse(value);
  const evidence = normalizeFindingEvidence(payload.evidence);
  const finding = await prisma.finding.create({
    data: {
      projectId,
      area: payload.area,
      severity: payload.severity,
      source: payload.source ?? "manual",
      category: payload.category ?? null,
      title: payload.title,
      description: payload.description,
      quickWin: payload.quickWin ?? false,
      phaseRecommendation: payload.phaseRecommendation ?? "next",
      ...(evidence !== undefined ? { evidence } : {})
    }
  });

  return serializeFinding(finding);
}

export async function updateProjectFinding(
  projectId: string,
  findingId: string,
  value: unknown
) {
  const payload = updateFindingInputSchema.parse(value);
  const existingFinding = await prisma.finding.findFirst({
    where: { id: findingId, projectId },
    select: { id: true }
  });

  if (!existingFinding) {
    throw new Error("Finding not found");
  }

  const finding = await prisma.finding.update({
    where: { id: findingId },
    data: {
      ...(payload.area !== undefined ? { area: payload.area } : {}),
      ...(payload.severity !== undefined ? { severity: payload.severity } : {}),
      ...(payload.source !== undefined ? { source: payload.source } : {}),
      ...(payload.category !== undefined
        ? { category: payload.category }
        : {}),
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(payload.description !== undefined
        ? { description: payload.description }
        : {}),
      ...(payload.quickWin !== undefined ? { quickWin: payload.quickWin } : {}),
      ...(payload.phaseRecommendation !== undefined
        ? { phaseRecommendation: payload.phaseRecommendation }
        : {}),
      ...(() => {
        const evidence = normalizeFindingEvidence(payload.evidence);
        return evidence !== undefined ? { evidence } : {};
      })(),
      ...(payload.status !== undefined ? { status: payload.status } : {})
    }
  });

  return serializeFinding(finding);
}

export async function deleteProjectFinding(
  projectId: string,
  findingId: string
) {
  const existingFinding = await prisma.finding.findFirst({
    where: { id: findingId, projectId },
    select: { id: true }
  });

  if (!existingFinding) {
    throw new Error("Finding not found");
  }

  await prisma.finding.delete({
    where: { id: findingId }
  });
}

export async function loadProjectRecommendations(projectId: string) {
  const recommendations = await prisma.recommendation.findMany({
    where: { projectId },
    orderBy: [{ createdAt: "desc" }]
  });

  return recommendations.map((recommendation) =>
    serializeRecommendation(recommendation)
  );
}

export async function createProjectRecommendation(
  projectId: string,
  value: unknown
) {
  const payload = createRecommendationInputSchema.parse(value);
  const recommendation = await prisma.recommendation.create({
    data: {
      projectId,
      title: payload.title,
      area: payload.area,
      type: payload.type,
      phase: payload.phase ?? "next",
      rationale: payload.rationale,
      effort: payload.effort,
      impact: payload.impact,
      findingId: payload.findingId ?? null,
      linkedFindingIds: payload.linkedFindingIds ?? []
    }
  });

  return serializeRecommendation(recommendation);
}

export async function generateProjectPortalAudit(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          industry: true,
          region: true,
          website: true
        }
      },
      portal: {
        select: {
          id: true,
          portalId: true,
          displayName: true,
          connected: true,
          connectedEmail: true,
          hubDomain: true,
          scopes: true,
          updatedAt: true
        }
      },
      discoverySummary: true
    }
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (!project.portal) {
    throw new Error(
      "Connect the client HubSpot portal before running the AI audit"
    );
  }

  if (!project.portal.connected) {
    throw new Error(
      "Reconnect the client HubSpot portal before running the AI audit"
    );
  }

  let latestSnapshot = await prisma.portalSnapshot.findFirst({
    where: { portalId: project.portal.id },
    orderBy: [{ capturedAt: "desc" }]
  });

  if (!latestSnapshot) {
    await createPortalSnapshotForPortal(project.portal.id);
    latestSnapshot = await prisma.portalSnapshot.findFirst({
      where: { portalId: project.portal.id },
      orderBy: [{ capturedAt: "desc" }]
    });
  }

  if (!latestSnapshot) {
    throw new Error("Capture a portal snapshot before running the AI audit");
  }

  const [existingManualFindings, existingManualRecommendations] =
    await Promise.all([
      prisma.finding.findMany({
        where: {
          projectId,
          OR: [{ source: null }, { NOT: { source: "ai_audit" } }]
        },
        orderBy: [{ createdAt: "desc" }]
      }),
      prisma.recommendation.findMany({
        where: {
          projectId,
          NOT: {
            rationale: {
              startsWith: aiGeneratedPortalAuditRecommendationPrefix
            }
          }
        },
        orderBy: [{ createdAt: "desc" }]
      })
    ]);

  const rawAudit = await callAiWorkflow(
    "portal_audit",
    `You are Muloo Deploy OS's dedicated HubSpot Portal Audit Agent.

You are auditing a live HubSpot portal for a delivery team. Your job is to produce a detailed, implementation-grade audit from the captured portal footprint and project context.

Rules:
- Return ONLY valid JSON. No markdown. No commentary.
- Use exactly these keys: executiveSummary, findings, recommendations.
- executiveSummary must be a practical 1 to 3 paragraph operator summary that explains the current state, biggest risks, and where Muloo should focus first.
- findings must contain concrete, evidence-backed observations. Prefer 8 to 18 findings when there is enough evidence.
- Do not invent HubSpot features, counts, or configuration details that are not present in the input.
- If a metric is unavailable because of missing scope, portal tier, or unavailable snapshot data, do not present that as a confirmed fault. Call out the limitation only when it materially affects audit confidence.
- quickWin should be true only when the issue can realistically be improved quickly without a major redesign.
- phaseRecommendation should describe the most sensible delivery timing such as "now", "phase 1", "phase 2", or "later".
- evidence should reference the specific counts, snapshot fields, or raw API sections that support the finding.
- recommendations should be prioritized next actions Muloo can take. Prefer 4 to 8 recommendations.
- linkedFindingTitles should reference finding titles from the generated findings when there is a direct link.
- Avoid duplicating existing manual findings or recommendations unless the new evidence materially strengthens or reframes them.
- Keep the tone sharp, practical, and delivery-oriented. Think like a senior HubSpot architect performing an optimisation audit for a paying client.`,
    stringifyPromptData({
      project: {
        id: project.id,
        name: project.name,
        engagementType: project.engagementType,
        owner: project.owner,
        ownerEmail: project.ownerEmail,
        implementationApproach: project.implementationApproach,
        customerPlatformTier: project.customerPlatformTier,
        selectedHubs: project.selectedHubs,
        problemStatement: project.problemStatement,
        solutionRecommendation: project.solutionRecommendation,
        scopeExecutiveSummary: project.scopeExecutiveSummary,
        commercialBrief: project.commercialBrief
      },
      client: project.client,
      portal: {
        id: project.portal.id,
        portalId: project.portal.portalId,
        displayName: project.portal.displayName,
        connectedEmail: project.portal.connectedEmail,
        hubDomain: project.portal.hubDomain,
        scopes: project.portal.scopes,
        updatedAt: project.portal.updatedAt.toISOString()
      },
      discoverySummary: project.discoverySummary,
      latestSnapshot: {
        capturedAt: latestSnapshot.capturedAt.toISOString(),
        hubTier: latestSnapshot.hubTier,
        activeHubs: latestSnapshot.activeHubs,
        contactPropertyCount: latestSnapshot.contactPropertyCount,
        companyPropertyCount: latestSnapshot.companyPropertyCount,
        dealPropertyCount: latestSnapshot.dealPropertyCount,
        ticketPropertyCount: latestSnapshot.ticketPropertyCount,
        customObjectCount: latestSnapshot.customObjectCount,
        dealPipelineCount: latestSnapshot.dealPipelineCount,
        dealStageCount: latestSnapshot.dealStageCount,
        ticketPipelineCount: latestSnapshot.ticketPipelineCount,
        activeUserCount: latestSnapshot.activeUserCount,
        teamCount: latestSnapshot.teamCount,
        activeListCount: latestSnapshot.activeListCount,
        rawApiPreview: summarizePortalSnapshotRawApiResponses(
          latestSnapshot.rawApiResponses
        )
      },
      existingManualFindings: existingManualFindings.map((finding) => ({
        area: finding.area,
        severity: finding.severity,
        title: finding.title,
        description: finding.description,
        quickWin: finding.quickWin,
        status: finding.status
      })),
      existingManualRecommendations: existingManualRecommendations.map(
        (recommendation) => ({
          area: recommendation.area,
          title: recommendation.title,
          type: recommendation.type,
          phase: recommendation.phase,
          effort: recommendation.effort,
          impact: recommendation.impact
        })
      )
    }),
    { maxTokens: 3200 }
  );

  const parsedAudit = await parsePortalAuditModelJson(rawAudit);

  const uniqueFindings = Array.from(
    new Map(
      parsedAudit.findings.map((finding) => [
        `${finding.area}:${finding.title.trim().toLowerCase()}`,
        finding
      ])
    ).values()
  );
  const uniqueRecommendations = Array.from(
    new Map(
      parsedAudit.recommendations.map((recommendation) => [
        `${recommendation.area}:${recommendation.title.trim().toLowerCase()}`,
        recommendation
      ])
    ).values()
  );

  return prisma.$transaction(
    async (transaction) => {
      await transaction.finding.deleteMany({
        where: {
          projectId,
          source: "ai_audit"
        }
      });

      await transaction.recommendation.deleteMany({
        where: {
          projectId,
          rationale: {
            startsWith: aiGeneratedPortalAuditRecommendationPrefix
          }
        }
      });

      const findings = [] as Array<ReturnType<typeof serializeFinding>>;
      const findingIdByTitle = new Map<string, string>();

      for (const finding of uniqueFindings) {
        const createdFinding = await transaction.finding.create({
          data: {
            projectId,
            area: finding.area,
            severity: finding.severity,
            source: "ai_audit",
            category: finding.area,
            title: finding.title.trim(),
            description: finding.description.trim(),
            quickWin: finding.quickWin ?? false,
            phaseRecommendation: finding.phaseRecommendation?.trim() || "phase 1",
            evidence: {
              summary:
                finding.evidence?.trim() ||
                "Generated from the latest portal snapshot and project context.",
              generatedBy: "legacy_portal_audit"
            } as Prisma.Prisma.InputJsonValue,
            status: "open"
          }
        });

        findings.push(serializeFinding(createdFinding));
        findingIdByTitle.set(
          createdFinding.title.trim().toLowerCase(),
          createdFinding.id
        );
      }

      const recommendations = [] as Array<
        ReturnType<typeof serializeRecommendation>
      >;

      for (const recommendation of uniqueRecommendations) {
        const linkedFindingIds = (recommendation.linkedFindingTitles ?? [])
          .map(
            (title) => findingIdByTitle.get(title.trim().toLowerCase()) ?? null
          )
          .filter((value): value is string => Boolean(value));

        const createdRecommendation = await transaction.recommendation.create({
          data: {
            projectId,
            findingId: linkedFindingIds[0] ?? null,
            title: recommendation.title.trim(),
            area: recommendation.area,
            type: recommendation.type,
            phase: recommendation.phase?.trim() || "phase 1",
            rationale: `${aiGeneratedPortalAuditRecommendationPrefix} ${recommendation.rationale.trim()}`,
            effort: recommendation.effort,
            impact: recommendation.impact,
            linkedFindingIds
          }
        });

        recommendations.push(serializeRecommendation(createdRecommendation));
      }

      return {
        executiveSummary: parsedAudit.executiveSummary.trim(),
        findings,
        recommendations
      };
    },
    {
      maxWait: 10_000,
      timeout: 30_000
    }
  );
}

export async function generateProjectPrepareBrief(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          industry: true,
          region: true,
          website: true
        }
      },
      portal: {
        select: {
          id: true,
          portalId: true,
          displayName: true,
          connected: true,
          connectedEmail: true,
          hubDomain: true
        }
      },
      discoverySummary: true
    }
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const [
    relatedProjects,
    findings,
    recommendations,
    supportingContext,
    latestSnapshot,
    contextEntries
  ] =
    await Promise.all([
      prisma.project.findMany({
        where: {
          clientId: project.clientId,
          NOT: { id: projectId }
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 6,
        select: {
          id: true,
          name: true,
          status: true,
          engagementType: true,
          updatedAt: true,
          selectedHubs: true,
          problemStatement: true,
          solutionRecommendation: true,
          scopeExecutiveSummary: true
        }
      }),
      prisma.finding.findMany({
        where: { projectId },
        orderBy: [{ createdAt: "desc" }],
        take: 12
      }),
      prisma.recommendation.findMany({
        where: { projectId },
        orderBy: [{ createdAt: "desc" }],
        take: 10
      }),
      prisma.discoveryEvidence.findMany({
        where: { projectId, sessionNumber: 0 },
        orderBy: [{ createdAt: "desc" }],
        take: 16
      }),
      project.portal
        ? prisma.portalSnapshot.findFirst({
            where: { portalId: project.portal.id },
            orderBy: [{ capturedAt: "desc" }]
          })
        : Promise.resolve(null),
      prisma.projectContext.findMany({
        where: { projectId },
        orderBy: [{ updatedAt: "desc" }]
      })
    ]);

  const consultantContext = contextEntries
    .filter((entry) => entry.content.trim().length > 0)
    .map((entry) => ({
      contextType: entry.contextType,
      label: formatProjectContextType(entry.contextType),
      content: entry.content,
      source: entry.source,
      updatedAt: entry.updatedAt.toISOString()
    }));

  const rawBrief = await callAiWorkflow(
    "project_prepare_brief",
    `You are Muloo Deploy OS's meeting-prep and optimisation planning assistant.

You are helping Jarrud prepare for a client session where Muloo may already know a lot, the client may already have HubSpot, and the next step is often to validate, sharpen, and sequence work rather than restart discovery from zero.

Rules:
- Return ONLY valid JSON. No markdown or commentary.
- Use exactly these keys: executiveSummary, meetingGoal, whatWeKnow, openQuestions, agenda, recommendedApproach, likelyWorkstreams, risks, suggestedNextStep.
- Think like a senior HubSpot consultant preparing for an onsite or working session.
- Be practical, concise, and decision-oriented.
- Treat the consultant context as the primary source of truth for what Muloo already knows, what has already been done, and what is sensitive or blocked.
- whatWeKnow should reflect facts already visible in the project, portal, audit, prior work, and notes.
- openQuestions should focus on what must be validated live with the client before scope is finalised.
- agenda should be a realistic workshop / meeting sequence, not generic filler.
- likelyWorkstreams should describe the work that is likely to emerge next.
- risks should focus on delivery risk, portal constraints, governance gaps, or assumptions that could derail the next phase.
- suggestedNextStep should be the single clearest next action Muloo should take after reading the brief.`,
    stringifyPromptData({
      project: {
        id: project.id,
        name: project.name,
        engagementType: project.engagementType,
        status: project.status,
        selectedHubs: project.selectedHubs,
        implementationApproach: project.implementationApproach,
        customerPlatformTier: project.customerPlatformTier,
        problemStatement: project.problemStatement,
        solutionRecommendation: project.solutionRecommendation,
        scopeExecutiveSummary: project.scopeExecutiveSummary,
        commercialBrief: project.commercialBrief
      },
      client: project.client,
      portal: project.portal
        ? {
            portalId: project.portal.portalId,
            displayName: project.portal.displayName,
            connected: project.portal.connected,
            connectedEmail: project.portal.connectedEmail,
            hubDomain: project.portal.hubDomain
          }
        : null,
      latestSnapshot: latestSnapshot
        ? {
            capturedAt: latestSnapshot.capturedAt.toISOString(),
            hubTier: latestSnapshot.hubTier,
            activeHubs: latestSnapshot.activeHubs,
            contactPropertyCount: latestSnapshot.contactPropertyCount,
            companyPropertyCount: latestSnapshot.companyPropertyCount,
            dealPropertyCount: latestSnapshot.dealPropertyCount,
            customObjectCount: latestSnapshot.customObjectCount,
            dealPipelineCount: latestSnapshot.dealPipelineCount,
            dealStageCount: latestSnapshot.dealStageCount,
            activeUserCount: latestSnapshot.activeUserCount,
            teamCount: latestSnapshot.teamCount,
            activeListCount: latestSnapshot.activeListCount
          }
        : null,
      discoverySummary: project.discoverySummary,
      relatedProjects: relatedProjects.map((relatedProject) => ({
        id: relatedProject.id,
        name: relatedProject.name,
        status: relatedProject.status,
        engagementType: relatedProject.engagementType,
        updatedAt: relatedProject.updatedAt.toISOString(),
        selectedHubs: relatedProject.selectedHubs,
        problemStatement: truncateModelContext(
          relatedProject.problemStatement,
          500
        ),
        solutionRecommendation: truncateModelContext(
          relatedProject.solutionRecommendation,
          500
        ),
        scopeExecutiveSummary: truncateModelContext(
          relatedProject.scopeExecutiveSummary,
          500
        )
      })),
      findings: findings.map((finding) => ({
        area: finding.area,
        severity: finding.severity,
        title: finding.title,
        description: truncateModelContext(finding.description, 600),
        quickWin: finding.quickWin,
        status: finding.status
      })),
      recommendations: recommendations.map((recommendation) => ({
        title: recommendation.title,
        area: recommendation.area,
        type: recommendation.type,
        phase: recommendation.phase,
        rationale: truncateModelContext(recommendation.rationale, 500),
        effort: recommendation.effort,
        impact: recommendation.impact
      })),
      supportingContext: supportingContext.slice(0, 10).map((item) => ({
        evidenceType: item.evidenceType,
        sourceLabel: item.sourceLabel,
        sourceUrl: item.sourceUrl,
        content: truncateModelContext(item.content, 1500),
        createdAt: item.createdAt.toISOString()
      })),
      consultantContext: consultantContext.slice(0, 6).map((entry) => ({
        ...entry,
        content: truncateModelContext(entry.content, 2000)
      }))
    }),
    { maxTokens: 2600 }
  );

  return parseProjectPrepareBriefModelJson(rawBrief);
}

function buildPortalAuditRunLog(audit: {
  executiveSummary: string;
  findings: Array<{ title: string; severity: string; area: string }>;
  recommendations: Array<{ title: string; area: string }>;
}) {
  return [
    "Portal audit completed.",
    "",
    audit.executiveSummary,
    "",
    `Findings captured: ${audit.findings.length}`,
    ...audit.findings
      .slice(0, 8)
      .map(
        (finding) =>
          `- [${finding.severity.toUpperCase()}] ${finding.title} (${finding.area})`
      ),
    "",
    `Recommendations captured: ${audit.recommendations.length}`,
    ...audit.recommendations
      .slice(0, 6)
      .map((recommendation) => `- ${recommendation.title} (${recommendation.area})`)
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPrepareBriefRunLog(brief: PrepareBrief) {
  return [
    "Prepare brief generated.",
    "",
    "Executive summary",
    brief.executiveSummary,
    "",
    `Meeting goal: ${brief.meetingGoal}`,
    "",
    "Open questions",
    ...brief.openQuestions.slice(0, 8).map((question) => `- ${question}`),
    "",
    "Agenda",
    ...brief.agenda.slice(0, 8).map((agendaItem, index) => `${index + 1}. ${agendaItem}`),
    "",
    `Suggested next step: ${brief.suggestedNextStep}`
  ]
    .filter(Boolean)
    .join("\n");
}

function buildHubSpotAgentRunLog(result: {
  request: string;
  dryRun: boolean;
  plan: {
    mode: "execute_action" | "manual_plan";
    summary: string;
    capabilityKey?: string | null;
    action?: string | null | undefined;
    manualPlan: string[];
    cautions: string[];
  };
  execution: unknown | null;
}) {
  return [
    result.dryRun ? "Portal Ops dry run completed." : "Portal Ops request completed.",
    "",
    `Request: ${result.request}`,
    `Mode: ${result.plan.mode}`,
    `Summary: ${result.plan.summary}`,
    result.plan.action ? `Action: ${result.plan.action}` : null,
    result.plan.capabilityKey
      ? `Capability: ${result.plan.capabilityKey}`
      : null,
    result.plan.manualPlan.length > 0 ? "" : null,
    result.plan.manualPlan.length > 0 ? "Manual plan" : null,
    ...result.plan.manualPlan.slice(0, 10).map((step, index) => `${index + 1}. ${step}`),
    result.plan.cautions.length > 0 ? "" : null,
    result.plan.cautions.length > 0 ? "Cautions" : null,
    ...result.plan.cautions.slice(0, 10).map((caution) => `- ${caution}`),
    result.execution ? "" : null,
    result.execution ? "Execution payload" : null,
    result.execution ? JSON.stringify(result.execution, null, 2) : null
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n");
}

export async function runTrackedProjectPortalAudit(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      clientId: true,
      portalId: true
    }
  });

  if (!project) {
    throw new Error("Project not found");
  }

  return executeTrackedWorkflowRun({
    workflowKey: "portal_audit",
    title: `Portal Audit · ${project.name}`,
    projectId: project.id,
    clientId: project.clientId,
    portalId: project.portalId,
    execute: async () => {
      const audit = await generateProjectPortalAudit(project.id);

      return {
        result: audit,
        summary: `Captured ${audit.findings.length} findings and ${audit.recommendations.length} recommendations.`,
        outputLog: buildPortalAuditRunLog(audit),
        resultStatus: "completed",
        payload: {
          findingCount: audit.findings.length,
          recommendationCount: audit.recommendations.length,
          executiveSummary: audit.executiveSummary
        }
      };
    }
  });
}

export async function runTrackedProjectPrepareBrief(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      clientId: true,
      portalId: true
    }
  });

  if (!project) {
    throw new Error("Project not found");
  }

  return executeTrackedWorkflowRun({
    workflowKey: "project_prepare_brief",
    title: `Prepare Brief · ${project.name}`,
    projectId: project.id,
    clientId: project.clientId,
    portalId: project.portalId,
    execute: async () => {
      const brief = await generateProjectPrepareBrief(project.id);

      return {
        result: brief,
        summary: brief.meetingGoal,
        outputLog: buildPrepareBriefRunLog(brief),
        resultStatus: "completed",
        payload: {
          meetingGoal: brief.meetingGoal,
          suggestedNextStep: brief.suggestedNextStep,
          agendaLength: brief.agenda.length,
          openQuestionCount: brief.openQuestions.length
        }
      };
    }
  });
}

export async function runTrackedHubSpotAgentRequest(value: {
  request?: unknown;
  dryRun?: unknown;
  portalRecordId?: unknown;
}) {
  const portalRecordId =
    typeof value.portalRecordId === "string" && value.portalRecordId.trim()
      ? value.portalRecordId.trim()
      : null;

  const portal = portalRecordId
    ? await prisma.hubSpotPortal.findUnique({
        where: { id: portalRecordId },
        include: {
          clients: {
            select: { id: true, name: true },
            take: 1
          },
          projects: {
            select: {
              id: true,
              name: true,
              clientId: true,
              updatedAt: true
            },
            orderBy: [{ updatedAt: "desc" }],
            take: 1
          }
        }
      })
    : null;

  const projectContext = portal?.projects[0] ?? null;
  const clientContext =
    portal?.clients[0] ??
    (projectContext
      ? await prisma.client.findUnique({
          where: { id: projectContext.clientId },
          select: { id: true, name: true }
        })
      : null);

  return executeTrackedWorkflowRun({
    workflowKey: "hubspot_operator_request",
    title: `Portal Ops · ${portal?.displayName ?? "Client Portal"}`,
    projectId: projectContext?.id ?? null,
    clientId: clientContext?.id ?? null,
    portalId: portal?.id ?? null,
    requestText:
      typeof value.request === "string" ? value.request.trim() : null,
    payload: {
      portalDisplayName: portal?.displayName ?? null,
      portalExternalId: portal?.portalId ?? null,
      requestedDryRun: value.dryRun !== false
    },
    execute: async () => {
      const result = await runHubSpotAgentRequest(value);

      return {
        result,
        summary: result.plan.summary,
        outputLog: buildHubSpotAgentRunLog(result),
        resultStatus:
          result.plan.mode === "execute_action"
            ? result.dryRun
              ? "dry_run_ready"
              : "executed"
            : "manual_plan",
        payload: {
          mode: result.plan.mode,
          capabilityKey: result.plan.capabilityKey ?? null,
          action: result.plan.action ?? null,
          manualPlanCount: result.plan.manualPlan.length,
          cautionCount: result.plan.cautions.length,
          executionLogged: result.execution !== null
        }
      };
    }
  });
}

export async function updateProjectRecommendation(
  projectId: string,
  recommendationId: string,
  value: unknown
) {
  const payload = updateRecommendationInputSchema.parse(value);
  const existingRecommendation = await prisma.recommendation.findFirst({
    where: { id: recommendationId, projectId },
    select: { id: true }
  });

  if (!existingRecommendation) {
    throw new Error("Recommendation not found");
  }

  const recommendation = await prisma.recommendation.update({
    where: { id: recommendationId },
    data: {
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(payload.area !== undefined ? { area: payload.area } : {}),
      ...(payload.type !== undefined ? { type: payload.type } : {}),
      ...(payload.phase !== undefined ? { phase: payload.phase } : {}),
      ...(payload.rationale !== undefined
        ? { rationale: payload.rationale }
        : {}),
      ...(payload.effort !== undefined ? { effort: payload.effort } : {}),
      ...(payload.impact !== undefined ? { impact: payload.impact } : {}),
      ...(payload.findingId !== undefined ? { findingId: payload.findingId } : {}),
      ...(payload.linkedFindingIds !== undefined
        ? { linkedFindingIds: payload.linkedFindingIds }
        : {}),
      ...(payload.clientApprovalStatus !== undefined
        ? { clientApprovalStatus: payload.clientApprovalStatus }
        : {})
    }
  });

  return serializeRecommendation(recommendation);
}

async function fetchHubSpotOAuthAccessTokenInfo(input: {
  accessToken: string;
  baseUrl?: string;
}) {
  const response = await fetch(
    `${normalizeHubSpotBaseUrl(input.baseUrl)}/oauth/v1/access-tokens/${encodeURIComponent(
      input.accessToken
    )}`
  );
  const body = (await response.json().catch(() => null)) as {
    hub_id?: number | string;
    hub_domain?: string;
    user?: string;
    user_id?: number | string;
    app_id?: number | string;
    scopes?: string[];
    token_type?: string;
  } | null;

  if (!response.ok || !body?.hub_id) {
    throw new Error(
      "Failed to load HubSpot portal details from the OAuth token"
    );
  }

  return body;
}

async function refreshHubSpotPortalAccessTokenIfNeeded(portalRecordId: string) {
  const portal = await prisma.hubSpotPortal.findUnique({
    where: { id: portalRecordId }
  });

  if (!portal?.connected || !portal.refreshToken) {
    return portal;
  }

  const tokenStillValid =
    portal.accessToken &&
    portal.tokenExpiresAt &&
    portal.tokenExpiresAt.getTime() > Date.now() + 60_000;

  if (tokenStillValid) {
    return portal;
  }

  const oauthConfig = await loadHubSpotOAuthProviderConfig();

  if (!oauthConfig.clientId || !oauthConfig.clientSecret) {
    throw new Error("HubSpot app credentials are incomplete");
  }

  const refreshResponse = await fetch(`${oauthConfig.baseUrl}/oauth/v1/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: oauthConfig.clientId,
      client_secret: oauthConfig.clientSecret,
      redirect_uri: oauthConfig.redirectUri,
      refresh_token: portal.refreshToken
    }).toString()
  });

  const refreshBody = (await refreshResponse.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    expires_in?: number;
    error?: string;
    message?: string;
  } | null;

  if (!refreshResponse.ok || !refreshBody?.access_token) {
    throw new Error(
      refreshBody?.message ||
        refreshBody?.error ||
        "HubSpot access token refresh failed"
    );
  }

  const refreshedPortal = await prisma.hubSpotPortal.update({
    where: { id: portal.id },
    data: {
      accessToken: refreshBody.access_token,
      refreshToken: refreshBody.refresh_token ?? portal.refreshToken,
      tokenType: refreshBody.token_type ?? portal.tokenType ?? "bearer",
      tokenExpiresAt:
        typeof refreshBody.expires_in === "number"
          ? new Date(Date.now() + refreshBody.expires_in * 1000)
          : portal.tokenExpiresAt,
      connected: true
    }
  });

  return refreshedPortal;
}

export async function createHubSpotOAuthStart(value: {
  projectId?: unknown;
  clientId?: unknown;
  portalRecordId?: unknown;
  installProfile?: unknown;
}) {
  const projectId =
    typeof value.projectId === "string" && value.projectId.trim()
      ? value.projectId.trim()
      : null;
  const clientId =
    typeof value.clientId === "string" && value.clientId.trim()
      ? value.clientId.trim()
      : null;
  const portalRecordId =
    typeof value.portalRecordId === "string" && value.portalRecordId.trim()
      ? value.portalRecordId.trim()
      : null;
  const installProfile =
    typeof value.installProfile === "string" &&
    value.installProfile in hubSpotScopeProfiles
      ? (value.installProfile as HubSpotScopeProfileKey)
      : "core_crm";
  const oauthConfig = await loadHubSpotOAuthProviderConfig();

  if (!oauthConfig.provider.isEnabled) {
    throw new Error("Enable the HubSpot OAuth provider first");
  }

  if (!oauthConfig.clientId || !oauthConfig.clientSecret) {
    throw new Error("HubSpot app client ID and secret must be saved first");
  }

  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, clientId: true }
    });

    if (!project) {
      throw new Error("Project not found");
    }

    if (clientId && clientId !== project.clientId) {
      throw new Error("Client does not match the selected project");
    }
  }

  if (clientId) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true }
    });

    if (!client) {
      throw new Error("Client not found");
    }
  }

  if (portalRecordId) {
    const portal = await prisma.hubSpotPortal.findUnique({
      where: { id: portalRecordId },
      select: { id: true }
    });

    if (!portal) {
      throw new Error("HubSpot portal not found");
    }
  }

  const selectedProfile = hubSpotScopeProfiles[installProfile];
  const requiredScopes = Array.from(new Set(selectedProfile.requiredScopes));
  const optionalScopes = Array.from(new Set(selectedProfile.optionalScopes));

  const state = createSignedStateToken({
    providerKey: "hubspot_oauth",
    projectId,
    clientId,
    portalRecordId,
    installProfile,
    redirectUri: oauthConfig.redirectUri,
    returnTo: projectId
      ? `/projects/${projectId}`
      : clientId
        ? "/clients"
        : "/settings/providers",
    expiresAt: Date.now() + 1000 * 60 * 10
  });

  const params = new URLSearchParams({
    client_id: oauthConfig.clientId,
    redirect_uri: oauthConfig.redirectUri,
    scope: requiredScopes.join(" "),
    state
  });

  if (optionalScopes.length > 0) {
    params.set("optional_scope", optionalScopes.join(" "));
  }

  return {
    authUrl: `https://app.hubspot.com/oauth/authorize?${params.toString()}`,
    installProfile,
    requestedScopes: {
      required: requiredScopes,
      optional: optionalScopes
    }
  };
}

export async function completeHubSpotOAuthCallback(value: {
  code?: unknown;
  state?: unknown;
}) {
  const code = typeof value.code === "string" ? value.code.trim() : "";
  const state = typeof value.state === "string" ? value.state.trim() : "";

  if (!code || !state) {
    throw new Error("HubSpot OAuth callback is missing code or state");
  }

  const verifiedState = verifySignedStateToken(state);
  const redirectUri =
    typeof verifiedState.redirectUri === "string"
      ? verifiedState.redirectUri.trim()
      : "";
  const projectId =
    typeof verifiedState.projectId === "string"
      ? verifiedState.projectId.trim()
      : "";
  let clientId =
    typeof verifiedState.clientId === "string"
      ? verifiedState.clientId.trim()
      : "";
  const portalRecordId =
    typeof verifiedState.portalRecordId === "string"
      ? verifiedState.portalRecordId.trim()
      : "";
  const returnTo =
    typeof verifiedState.returnTo === "string" && verifiedState.returnTo.trim()
      ? verifiedState.returnTo.trim()
      : "/settings/providers";

  if (!redirectUri) {
    throw new Error("OAuth redirect URI is missing from state");
  }

  const oauthConfig = await loadHubSpotOAuthProviderConfig();

  if (!oauthConfig.clientId || !oauthConfig.clientSecret) {
    throw new Error("HubSpot app client ID and secret are incomplete");
  }

  const tokenResponse = await fetch(`${oauthConfig.baseUrl}/oauth/v1/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: oauthConfig.clientId,
      client_secret: oauthConfig.clientSecret,
      redirect_uri: redirectUri,
      code
    }).toString()
  });

  const tokenBody = (await tokenResponse.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    expires_in?: number;
    error?: string;
    message?: string;
  } | null;

  if (!tokenResponse.ok || !tokenBody?.access_token) {
    throw new Error(
      tokenBody?.message || tokenBody?.error || "HubSpot token exchange failed"
    );
  }

  const accessToken = tokenBody.access_token;

  const accessTokenInfo = await fetchHubSpotOAuthAccessTokenInfo({
    accessToken,
    baseUrl: oauthConfig.baseUrl
  });
  const resolvedPortalId = `${accessTokenInfo.hub_id}`;
  const scopeValues = Array.isArray(accessTokenInfo.scopes)
    ? accessTokenInfo.scopes.filter(
        (scope): scope is string =>
          typeof scope === "string" && scope.trim().length > 0
      )
    : [
        ...defaultHubSpotOAuthRequiredScopes,
        ...defaultHubSpotOAuthOptionalScopes
      ];
  const displayName =
    accessTokenInfo.hub_domain?.trim() || `HubSpot Portal ${resolvedPortalId}`;
  const connectedEmail =
    typeof accessTokenInfo.user === "string" &&
    accessTokenInfo.user.includes("@")
      ? accessTokenInfo.user.trim().toLowerCase()
      : null;
  const connectedName =
    connectedEmail?.split("@")[0]?.replace(/\./g, " ")?.trim() || null;

  const portal = await prisma.$transaction(async (transaction) => {
    const existingByHubId = await transaction.hubSpotPortal.findUnique({
      where: { portalId: resolvedPortalId }
    });
    const targetPortal =
      existingByHubId ||
      (portalRecordId
        ? await transaction.hubSpotPortal.findUnique({
            where: { id: portalRecordId }
          })
        : null);

    const savedPortal = targetPortal
      ? await transaction.hubSpotPortal.update({
          where: { id: targetPortal.id },
          data: {
            portalId: resolvedPortalId,
            displayName,
            connected: true,
            accessToken,
            refreshToken: tokenBody.refresh_token ?? targetPortal.refreshToken,
            tokenType:
              tokenBody.token_type ?? accessTokenInfo.token_type ?? "bearer",
            scopes: scopeValues,
            tokenExpiresAt:
              typeof tokenBody.expires_in === "number"
                ? new Date(Date.now() + tokenBody.expires_in * 1000)
                : null,
            connectedEmail,
            connectedName,
            hubDomain: accessTokenInfo.hub_domain?.trim() || null,
            installedAt: new Date()
          }
        })
      : await transaction.hubSpotPortal.create({
          data: {
            portalId: resolvedPortalId,
            displayName,
            connected: true,
            accessToken,
            refreshToken: tokenBody.refresh_token ?? null,
            tokenType:
              tokenBody.token_type ?? accessTokenInfo.token_type ?? "bearer",
            scopes: scopeValues,
            tokenExpiresAt:
              typeof tokenBody.expires_in === "number"
                ? new Date(Date.now() + tokenBody.expires_in * 1000)
                : null,
            connectedEmail,
            connectedName,
            hubDomain: accessTokenInfo.hub_domain?.trim() || null,
            installedAt: new Date()
          }
        });

    if (!clientId && projectId) {
      const project = await transaction.project.findUnique({
        where: { id: projectId },
        select: { clientId: true }
      });

      clientId = project?.clientId ?? "";
    }

    if (clientId) {
      const previousPortalId = await transaction.client
        .findUnique({
          where: { id: clientId },
          select: { hubSpotPortalId: true }
        })
        .then((client) => client?.hubSpotPortalId ?? null);

      await syncClientHubSpotPortal(transaction, clientId, savedPortal.id);

      if (previousPortalId && previousPortalId !== savedPortal.id) {
        await deleteHubSpotPortalIfUnused(transaction, previousPortalId);
      }
    }

    return savedPortal;
  });

  try {
    await createPortalSnapshotForPortal(portal.id);
  } catch (error) {
    console.error("Failed to capture HubSpot portal snapshot after OAuth.", {
      portalId: portal.id,
      error: error instanceof Error ? error.message : "Unknown snapshot error"
    });
  }

  return {
    portal: serializeHubSpotPortal(portal),
    returnTo
  };
}

export async function loadProjectsDirectory() {
  const projects = await prisma.project.findMany({
    include: { client: true, portal: true },
    orderBy: { updatedAt: "desc" }
  });

  return projects.map((project) => serializeProject(project));
}

export async function loadProjectRecord(projectId: string) {
  const project = await reconcileProjectClientPortal(projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  return serializeProject(project);
}

export async function loadClientMemory(
  clientId: string,
  options?: { excludeProjectId?: string; limit?: number }
) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      hubSpotPortalId: true
    }
  });

  if (!client) {
    throw new Error("Client not found");
  }

  const projectWhere: Prisma.Prisma.ProjectWhereInput = {
    clientId,
    ...(options?.excludeProjectId ? { NOT: { id: options.excludeProjectId } } : {})
  };

  const [previousProjects, findings, recommendations, portalSnapshots, recentRuns] =
    await Promise.all([
      prisma.project.findMany({
        where: projectWhere,
        orderBy: [{ updatedAt: "desc" }],
        take: options?.limit ?? 8,
        include: { client: true, portal: true }
      }),
      prisma.finding.findMany({
        where: {
          project: {
            clientId,
            ...(options?.excludeProjectId
              ? { id: { not: options.excludeProjectId } }
              : {})
          }
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 10,
        include: {
          project: {
            select: { id: true, name: true }
          }
        }
      }),
      prisma.recommendation.findMany({
        where: {
          project: {
            clientId,
            ...(options?.excludeProjectId
              ? { id: { not: options.excludeProjectId } }
              : {})
          }
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 10,
        include: {
          project: {
            select: { id: true, name: true }
          }
        }
      }),
      client.hubSpotPortalId
        ? prisma.portalSnapshot.findMany({
            where: { portalId: client.hubSpotPortalId },
            orderBy: [{ capturedAt: "desc" }],
            take: 8
          })
        : Promise.resolve([]),
      loadWorkflowRuns({
        clientId,
        workflowKeys: [
          "portal_audit",
          "project_prepare_brief",
          "hubspot_operator_request"
        ],
        limit: 10
      })
    ]);

  const latestSnapshot = portalSnapshots[0] ?? null;
  const previousSnapshot = portalSnapshots[1] ?? null;
  const latestHubs = new Set(latestSnapshot?.activeHubs ?? []);
  const previousHubs = new Set(previousSnapshot?.activeHubs ?? []);
  const portalDiff =
    latestSnapshot && previousSnapshot
      ? {
          fromCapturedAt: previousSnapshot.capturedAt.toISOString(),
          toCapturedAt: latestSnapshot.capturedAt.toISOString(),
          newHubs: [...latestHubs].filter((hub) => !previousHubs.has(hub)),
          removedHubs: [...previousHubs].filter((hub) => !latestHubs.has(hub)),
          contactPropertyDelta:
            (latestSnapshot.contactPropertyCount ?? 0) -
            (previousSnapshot.contactPropertyCount ?? 0),
          companyPropertyDelta:
            (latestSnapshot.companyPropertyCount ?? 0) -
            (previousSnapshot.companyPropertyCount ?? 0),
          dealPropertyDelta:
            (latestSnapshot.dealPropertyCount ?? 0) -
            (previousSnapshot.dealPropertyCount ?? 0),
          customObjectDelta:
            (latestSnapshot.customObjectCount ?? 0) -
            (previousSnapshot.customObjectCount ?? 0),
          dealPipelineDelta:
            (latestSnapshot.dealPipelineCount ?? 0) -
            (previousSnapshot.dealPipelineCount ?? 0),
          dealStageDelta:
            (latestSnapshot.dealStageCount ?? 0) -
            (previousSnapshot.dealStageCount ?? 0),
          activeUserDelta:
            (latestSnapshot.activeUserCount ?? 0) -
            (previousSnapshot.activeUserCount ?? 0),
          activeListDelta:
            (latestSnapshot.activeListCount ?? 0) -
            (previousSnapshot.activeListCount ?? 0)
        }
      : null;

  return {
    client: {
      id: client.id,
      name: client.name,
      hubSpotPortalId: client.hubSpotPortalId
    },
    previousProjects: previousProjects.map((project) => serializeProject(project)),
    recentFindings: findings.map((finding) => ({
      id: finding.id,
      title: finding.title,
      area: finding.area,
      severity: finding.severity,
      status: finding.status,
      quickWin: finding.quickWin,
      updatedAt: finding.updatedAt.toISOString(),
      project: finding.project
    })),
    recentRecommendations: recommendations.map((recommendation) => ({
      id: recommendation.id,
      title: recommendation.title,
      area: recommendation.area,
      type: recommendation.type,
      phase: recommendation.phase,
      impact: recommendation.impact,
      updatedAt: recommendation.updatedAt.toISOString(),
      project: recommendation.project
    })),
    portalSnapshots: portalSnapshots.map((snapshot) => ({
      id: snapshot.id,
      capturedAt: snapshot.capturedAt.toISOString(),
      hubTier: snapshot.hubTier,
      activeHubs: snapshot.activeHubs,
      contactPropertyCount: snapshot.contactPropertyCount,
      companyPropertyCount: snapshot.companyPropertyCount,
      dealPropertyCount: snapshot.dealPropertyCount,
      ticketPropertyCount: snapshot.ticketPropertyCount,
      customObjectCount: snapshot.customObjectCount,
      dealPipelineCount: snapshot.dealPipelineCount,
      dealStageCount: snapshot.dealStageCount,
      ticketPipelineCount: snapshot.ticketPipelineCount,
      activeUserCount: snapshot.activeUserCount,
      teamCount: snapshot.teamCount,
      activeListCount: snapshot.activeListCount
    })),
    portalDiff,
    recentRuns
  };
}

export async function createProjectRecord(value: {
  name?: unknown;
  clientName?: unknown;
  hubspotPortalId?: unknown;
  selectedHubs?: unknown;
  owner?: unknown;
  ownerEmail?: unknown;
  serviceFamily?: unknown;
  implementationApproach?: unknown;
  customerPlatformTier?: unknown;
  platformTierSelections?: unknown;
  problemStatement?: unknown;
  solutionRecommendation?: unknown;
  scopeExecutiveSummary?: unknown;
  scopeType?: unknown;
  deliveryTemplateId?: unknown;
  commercialBrief?: unknown;
  engagementType?: unknown;
  includesPortalAudit?: unknown;
  industry?: unknown;
  website?: unknown;
  additionalWebsites?: unknown;
  linkedinUrl?: unknown;
  facebookUrl?: unknown;
  instagramUrl?: unknown;
  xUrl?: unknown;
  youtubeUrl?: unknown;
  clientChampionFirstName?: unknown;
  clientChampionLastName?: unknown;
  clientChampionEmail?: unknown;
}) {
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const clientName =
    typeof value.clientName === "string" ? value.clientName.trim() : "";
  const scopeType =
    typeof value.scopeType === "string" && value.scopeType.trim().length > 0
      ? value.scopeType.trim()
      : "discovery";
  const selectedHubs = Array.isArray(value.selectedHubs)
    ? value.selectedHubs
        .filter((hub): hub is string => typeof hub === "string")
        .map((hub) => hub.trim())
        .filter(Boolean)
    : [];

  if (
    !name ||
    !clientName ||
    (scopeType !== "standalone_quote" && selectedHubs.length === 0)
  ) {
    throw new Error(
      scopeType === "standalone_quote"
        ? "name and clientName are required"
        : "name, clientName, and selectedHubs are required"
    );
  }

  if (
    typeof value.engagementType === "string" &&
    !isValidEngagementType(value.engagementType)
  ) {
    throw new Error("Invalid engagement type");
  }

  if (
    value.includesPortalAudit !== undefined &&
    typeof value.includesPortalAudit !== "boolean"
  ) {
    throw new Error("includesPortalAudit must be a boolean");
  }

  const engagementType = (
    typeof value.engagementType === "string"
      ? value.engagementType
      : "IMPLEMENTATION"
  ) as Prisma.$Enums.EngagementType;
  const autoAudit =
    engagementType === "OPTIMISATION" || engagementType === "AUDIT";
  const includesPortalAudit =
    value.includesPortalAudit !== undefined
      ? value.includesPortalAudit
      : autoAudit;

  const serviceFamily =
    typeof value.serviceFamily === "string" &&
    value.serviceFamily.trim().length > 0
      ? value.serviceFamily.trim()
      : "hubspot_architecture";
  const implementationApproach =
    typeof value.implementationApproach === "string" &&
    isValidImplementationApproach(value.implementationApproach.trim())
      ? value.implementationApproach.trim()
      : "pragmatic_poc";
  const customerPlatformTier =
    typeof value.customerPlatformTier === "string" &&
    isValidCustomerPlatformTier(value.customerPlatformTier.trim().toLowerCase())
      ? value.customerPlatformTier.trim().toLowerCase()
      : null;
  const platformTierSelections = normalizePlatformTierSelections(
    value.platformTierSelections
  );
  const slug = createSlug(clientName);
  const requestedPortalId =
    typeof value.hubspotPortalId === "string"
      ? value.hubspotPortalId.trim()
      : undefined;

  const project = await prisma.$transaction(async (transaction) => {
    const client = await transaction.client.upsert({
      where: { slug },
      update: {
        name: clientName,
        industry:
          typeof value.industry === "string"
            ? value.industry.trim() || null
            : null,
        website:
          typeof value.website === "string"
            ? value.website.trim() || null
            : null,
        additionalWebsites: normalizeStringArray(value.additionalWebsites),
        linkedinUrl:
          typeof value.linkedinUrl === "string"
            ? value.linkedinUrl.trim() || null
            : null,
        facebookUrl:
          typeof value.facebookUrl === "string"
            ? value.facebookUrl.trim() || null
            : null,
        instagramUrl:
          typeof value.instagramUrl === "string"
            ? value.instagramUrl.trim() || null
            : null,
        xUrl: typeof value.xUrl === "string" ? value.xUrl.trim() || null : null,
        youtubeUrl:
          typeof value.youtubeUrl === "string"
            ? value.youtubeUrl.trim() || null
            : null
      },
      create: {
        name: clientName,
        slug,
        industry:
          typeof value.industry === "string"
            ? value.industry.trim() || null
            : null,
        website:
          typeof value.website === "string"
            ? value.website.trim() || null
            : null,
        additionalWebsites: normalizeStringArray(value.additionalWebsites),
        linkedinUrl:
          typeof value.linkedinUrl === "string"
            ? value.linkedinUrl.trim() || null
            : null,
        facebookUrl:
          typeof value.facebookUrl === "string"
            ? value.facebookUrl.trim() || null
            : null,
        instagramUrl:
          typeof value.instagramUrl === "string"
            ? value.instagramUrl.trim() || null
            : null,
        xUrl: typeof value.xUrl === "string" ? value.xUrl.trim() || null : null,
        youtubeUrl:
          typeof value.youtubeUrl === "string"
            ? value.youtubeUrl.trim() || null
            : null
      }
    });

    const portal = await resolveClientHubSpotPortal(transaction, {
      clientId: client.id,
      clientName,
      requestedPortalId,
      fallbackPortalId: undefined
    });

    if (client.hubSpotPortalId !== portal.id) {
      await syncClientHubSpotPortal(transaction, client.id, portal.id);
    }

    return transaction.project.create({
      data: {
        name,
        status: "draft",
        engagementType,
        includesPortalAudit,
        ...(await resolveProjectOwner(
          typeof value.owner === "string" ? value.owner : undefined,
          typeof value.ownerEmail === "string" ? value.ownerEmail : undefined
        )),
        serviceFamily,
        implementationApproach,
        customerPlatformTier,
        platformTierSelections,
        problemStatement:
          typeof value.problemStatement === "string"
            ? value.problemStatement.trim() || null
            : null,
        solutionRecommendation:
          typeof value.solutionRecommendation === "string"
            ? value.solutionRecommendation.trim() || null
            : null,
        scopeExecutiveSummary:
          typeof value.scopeExecutiveSummary === "string"
            ? value.scopeExecutiveSummary.trim() || null
            : null,
        clientChampionFirstName:
          typeof value.clientChampionFirstName === "string"
            ? value.clientChampionFirstName.trim() || null
            : null,
        clientChampionLastName:
          typeof value.clientChampionLastName === "string"
            ? value.clientChampionLastName.trim() || null
            : null,
        clientChampionEmail:
          typeof value.clientChampionEmail === "string"
            ? value.clientChampionEmail.trim() || null
            : null,
        scopeType,
        deliveryTemplateId:
          typeof value.deliveryTemplateId === "string"
            ? value.deliveryTemplateId.trim() || null
            : null,
        commercialBrief:
          typeof value.commercialBrief === "string"
            ? value.commercialBrief.trim() || null
            : null,
        selectedHubs,
        clientId: client.id,
        portalId: portal.id
      },
      include: {
        client: true,
        portal: true
      }
    });
  });

  return serializeProject(project);
}

export async function updateProjectRecord(
  projectId: string,
  value: {
    name?: unknown;
    clientName?: unknown;
    type?: unknown;
    implementationApproach?: unknown;
    customerPlatformTier?: unknown;
    platformTierSelections?: unknown;
    problemStatement?: unknown;
    solutionRecommendation?: unknown;
    scopeExecutiveSummary?: unknown;
    clientQuestionnaireConfig?: unknown;
    scopeType?: unknown;
    deliveryTemplateId?: unknown;
    commercialBrief?: unknown;
    portalId?: unknown;
    owner?: unknown;
    ownerEmail?: unknown;
    hubs?: unknown;
    includesPortalAudit?: unknown;
    clientIndustry?: unknown;
    clientWebsite?: unknown;
    clientAdditionalWebsites?: unknown;
    clientLinkedinUrl?: unknown;
    clientFacebookUrl?: unknown;
    clientInstagramUrl?: unknown;
    clientXUrl?: unknown;
    clientYoutubeUrl?: unknown;
    clientChampionFirstName?: unknown;
    clientChampionLastName?: unknown;
    clientChampionEmail?: unknown;
  }
) {
  await ensureProjectScopeUnlocked(projectId);

  const normalizedPayload: {
    name?: string;
    clientName?: string;
    type?: EngagementType;
    implementationApproach?: string;
    customerPlatformTier?: string;
    platformTierSelections?: Record<string, string>;
    problemStatement?: string;
    solutionRecommendation?: string;
    scopeExecutiveSummary?: string;
    clientQuestionnaireConfig?: ClientQuestionnaireConfig;
    scopeType?: string;
    deliveryTemplateId?: string;
    commercialBrief?: string;
    portalId?: string;
    owner?: string;
    ownerEmail?: string;
    hubs?: ProjectHub[];
    includesPortalAudit?: boolean;
    clientIndustry?: string;
    clientWebsite?: string;
    clientAdditionalWebsites?: string[];
    clientLinkedinUrl?: string;
    clientFacebookUrl?: string;
    clientInstagramUrl?: string;
    clientXUrl?: string;
    clientYoutubeUrl?: string;
    clientChampionFirstName?: string;
    clientChampionLastName?: string;
    clientChampionEmail?: string;
  } = {};

  if (value.name !== undefined) {
    if (typeof value.name !== "string" || value.name.trim().length === 0) {
      throw new Error("name must be a non-empty string");
    }
    normalizedPayload.name = value.name.trim();
  }

  if (value.clientName !== undefined) {
    if (
      typeof value.clientName !== "string" ||
      value.clientName.trim().length === 0
    ) {
      throw new Error("clientName must be a non-empty string");
    }
    normalizedPayload.clientName = value.clientName.trim();
  }

  if (value.type !== undefined) {
    if (typeof value.type !== "string" || !isValidEngagementType(value.type)) {
      throw new Error("Invalid engagement type");
    }
    normalizedPayload.type = value.type;
  }

  if (value.includesPortalAudit !== undefined) {
    if (typeof value.includesPortalAudit !== "boolean") {
      throw new Error("includesPortalAudit must be a boolean");
    }
    normalizedPayload.includesPortalAudit = value.includesPortalAudit;
  }

  if (value.customerPlatformTier !== undefined) {
    if (
      value.customerPlatformTier !== null &&
      (typeof value.customerPlatformTier !== "string" ||
        (value.customerPlatformTier.trim().length > 0 &&
          !isValidCustomerPlatformTier(
            value.customerPlatformTier.trim().toLowerCase()
          )))
    ) {
      throw new Error(
        "customerPlatformTier must be free, starter, professional, enterprise, or blank"
      );
    }
    normalizedPayload.customerPlatformTier =
      typeof value.customerPlatformTier === "string"
        ? value.customerPlatformTier.trim().toLowerCase()
        : "";
  }

  if (value.implementationApproach !== undefined) {
    if (
      typeof value.implementationApproach !== "string" ||
      !isValidImplementationApproach(value.implementationApproach.trim())
    ) {
      throw new Error(
        "implementationApproach must be pragmatic_poc or best_practice"
      );
    }
    normalizedPayload.implementationApproach =
      value.implementationApproach.trim();
  }

  if (value.platformTierSelections !== undefined) {
    normalizedPayload.platformTierSelections = normalizePlatformTierSelections(
      value.platformTierSelections
    );
  }

  const stringFields = [
    [
      "problemStatement",
      value.problemStatement,
      "problemStatement must be a string"
    ],
    [
      "solutionRecommendation",
      value.solutionRecommendation,
      "solutionRecommendation must be a string"
    ],
    [
      "scopeExecutiveSummary",
      value.scopeExecutiveSummary,
      "scopeExecutiveSummary must be a string"
    ],
    [
      "commercialBrief",
      value.commercialBrief,
      "commercialBrief must be a string"
    ],
    ["owner", value.owner, "owner must be a string"],
    ["ownerEmail", value.ownerEmail, "ownerEmail must be a string"],
    ["clientIndustry", value.clientIndustry, "clientIndustry must be a string"],
    ["clientWebsite", value.clientWebsite, "clientWebsite must be a string"],
    [
      "clientLinkedinUrl",
      value.clientLinkedinUrl,
      "clientLinkedinUrl must be a string"
    ],
    [
      "clientFacebookUrl",
      value.clientFacebookUrl,
      "clientFacebookUrl must be a string"
    ],
    [
      "clientInstagramUrl",
      value.clientInstagramUrl,
      "clientInstagramUrl must be a string"
    ],
    ["clientXUrl", value.clientXUrl, "clientXUrl must be a string"],
    [
      "clientYoutubeUrl",
      value.clientYoutubeUrl,
      "clientYoutubeUrl must be a string"
    ],
    [
      "clientChampionFirstName",
      value.clientChampionFirstName,
      "clientChampionFirstName must be a string"
    ],
    [
      "clientChampionLastName",
      value.clientChampionLastName,
      "clientChampionLastName must be a string"
    ],
    [
      "clientChampionEmail",
      value.clientChampionEmail,
      "clientChampionEmail must be a string"
    ]
  ] as const;

  for (const [key, fieldValue, errorMessage] of stringFields) {
    if (fieldValue !== undefined) {
      if (typeof fieldValue !== "string") {
        throw new Error(errorMessage);
      }
      normalizedPayload[key] = fieldValue.trim();
    }
  }

  if (value.clientQuestionnaireConfig !== undefined) {
    normalizedPayload.clientQuestionnaireConfig =
      normalizeClientQuestionnaireConfig(value.clientQuestionnaireConfig);
  }

  if (value.scopeType !== undefined) {
    if (typeof value.scopeType !== "string") {
      throw new Error("scopeType must be a string");
    }
    normalizedPayload.scopeType = value.scopeType.trim();
  }

  if (value.deliveryTemplateId !== undefined) {
    if (
      typeof value.deliveryTemplateId !== "string" &&
      value.deliveryTemplateId !== null
    ) {
      throw new Error("deliveryTemplateId must be a string or null");
    }
    normalizedPayload.deliveryTemplateId =
      typeof value.deliveryTemplateId === "string"
        ? value.deliveryTemplateId.trim()
        : "";
  }

  if (value.portalId !== undefined) {
    if (typeof value.portalId !== "string") {
      throw new Error("portalId must be a string");
    }
    normalizedPayload.portalId = value.portalId.trim();
  }

  if (value.clientAdditionalWebsites !== undefined) {
    normalizedPayload.clientAdditionalWebsites = normalizeStringArray(
      value.clientAdditionalWebsites
    );
  }

  if (value.hubs !== undefined) {
    if (
      !Array.isArray(value.hubs) ||
      value.hubs.length === 0 ||
      value.hubs.some((hub) => typeof hub !== "string")
    ) {
      throw new Error("hubs must be a non-empty array of hub keys");
    }

    const normalizedHubs = Array.from(
      new Set(value.hubs.map((hub) => hub.trim().toLowerCase()))
    );

    if (normalizedHubs.some((hub) => !isValidProjectHub(hub))) {
      throw new Error("Invalid hubs selection");
    }

    normalizedPayload.hubs = normalizedHubs;
  }

  if (
    normalizedPayload.name === undefined &&
    normalizedPayload.clientName === undefined &&
    normalizedPayload.type === undefined &&
    normalizedPayload.customerPlatformTier === undefined &&
    normalizedPayload.implementationApproach === undefined &&
    normalizedPayload.platformTierSelections === undefined &&
    normalizedPayload.problemStatement === undefined &&
    normalizedPayload.solutionRecommendation === undefined &&
    normalizedPayload.scopeExecutiveSummary === undefined &&
    normalizedPayload.clientQuestionnaireConfig === undefined &&
    normalizedPayload.scopeType === undefined &&
    normalizedPayload.deliveryTemplateId === undefined &&
    normalizedPayload.commercialBrief === undefined &&
    normalizedPayload.portalId === undefined &&
    normalizedPayload.owner === undefined &&
    normalizedPayload.ownerEmail === undefined &&
    normalizedPayload.hubs === undefined &&
    normalizedPayload.includesPortalAudit === undefined &&
    normalizedPayload.clientIndustry === undefined &&
    normalizedPayload.clientWebsite === undefined &&
    normalizedPayload.clientAdditionalWebsites === undefined &&
    normalizedPayload.clientLinkedinUrl === undefined &&
    normalizedPayload.clientFacebookUrl === undefined &&
    normalizedPayload.clientInstagramUrl === undefined &&
    normalizedPayload.clientXUrl === undefined &&
    normalizedPayload.clientYoutubeUrl === undefined &&
    normalizedPayload.clientChampionFirstName === undefined &&
    normalizedPayload.clientChampionLastName === undefined &&
    normalizedPayload.clientChampionEmail === undefined
  ) {
    throw new Error("At least one editable field is required");
  }

  const existingProject = await prisma.project.findUnique({
    where: { id: projectId },
    include: { client: true, portal: true }
  });

  if (!existingProject) {
    throw new Error("Project not found");
  }

  const nextClientName =
    normalizedPayload.clientName ?? existingProject.client.name;
  const nextOwnerDetails =
    normalizedPayload.owner !== undefined ||
    normalizedPayload.ownerEmail !== undefined
      ? await resolveProjectOwner(
          normalizedPayload.owner ?? existingProject.owner,
          normalizedPayload.ownerEmail ?? existingProject.ownerEmail
        )
      : null;

  const project = await prisma.$transaction(async (transaction) => {
    let nextClientId = existingProject.clientId;
    let nextPortalId = existingProject.portalId;
    let previousClientPortalId = existingProject.client.hubSpotPortalId;

    if (normalizedPayload.clientName) {
      const clientSlug = createSlug(normalizedPayload.clientName);
      const client = await transaction.client.upsert({
        where: { slug: clientSlug },
        update: { name: normalizedPayload.clientName },
        create: {
          name: normalizedPayload.clientName,
          slug: clientSlug
        }
      });

      nextClientId = client.id;
      previousClientPortalId = client.hubSpotPortalId;
    }

    if (
      normalizedPayload.clientIndustry !== undefined ||
      normalizedPayload.clientWebsite !== undefined ||
      normalizedPayload.clientAdditionalWebsites !== undefined ||
      normalizedPayload.clientLinkedinUrl !== undefined ||
      normalizedPayload.clientFacebookUrl !== undefined ||
      normalizedPayload.clientInstagramUrl !== undefined ||
      normalizedPayload.clientXUrl !== undefined ||
      normalizedPayload.clientYoutubeUrl !== undefined
    ) {
      await transaction.client.update({
        where: { id: nextClientId },
        data: {
          ...(normalizedPayload.clientIndustry !== undefined
            ? { industry: normalizedPayload.clientIndustry || null }
            : {}),
          ...(normalizedPayload.clientWebsite !== undefined
            ? { website: normalizedPayload.clientWebsite || null }
            : {}),
          ...(normalizedPayload.clientAdditionalWebsites !== undefined
            ? {
                additionalWebsites: normalizedPayload.clientAdditionalWebsites
              }
            : {}),
          ...(normalizedPayload.clientLinkedinUrl !== undefined
            ? { linkedinUrl: normalizedPayload.clientLinkedinUrl || null }
            : {}),
          ...(normalizedPayload.clientFacebookUrl !== undefined
            ? { facebookUrl: normalizedPayload.clientFacebookUrl || null }
            : {}),
          ...(normalizedPayload.clientInstagramUrl !== undefined
            ? { instagramUrl: normalizedPayload.clientInstagramUrl || null }
            : {}),
          ...(normalizedPayload.clientXUrl !== undefined
            ? { xUrl: normalizedPayload.clientXUrl || null }
            : {}),
          ...(normalizedPayload.clientYoutubeUrl !== undefined
            ? { youtubeUrl: normalizedPayload.clientYoutubeUrl || null }
            : {})
        }
      });
    }

    const portal = await resolveClientHubSpotPortal(transaction, {
      clientId: nextClientId,
      clientName: nextClientName,
      requestedPortalId: normalizedPayload.portalId,
      fallbackPortalId: existingProject.portalId
    });

    nextPortalId = portal.id;

    if (
      normalizedPayload.portalId !== undefined ||
      nextClientId !== existingProject.clientId ||
      previousClientPortalId !== nextPortalId
    ) {
      await syncClientHubSpotPortal(transaction, nextClientId, nextPortalId);
    }

    const updatedProject = await transaction.project.update({
      where: { id: projectId },
      data: {
        ...(() => {
          if (
            normalizedPayload.type === undefined &&
            normalizedPayload.includesPortalAudit === undefined
          ) {
            return {};
          }

          const autoAudit =
            normalizedPayload.type === "OPTIMISATION" ||
            normalizedPayload.type === "AUDIT";
          const includesPortalAudit =
            normalizedPayload.includesPortalAudit !== undefined
              ? normalizedPayload.includesPortalAudit
              : autoAudit;

          return {
            ...(normalizedPayload.type
              ? {
                  engagementType:
                    normalizedPayload.type as Prisma.$Enums.EngagementType
                }
              : {}),
            includesPortalAudit
          };
        })(),
        ...(normalizedPayload.customerPlatformTier !== undefined
          ? {
              customerPlatformTier:
                normalizedPayload.customerPlatformTier || null
            }
          : {}),
        ...(normalizedPayload.name !== undefined
          ? { name: normalizedPayload.name }
          : {}),
        ...(normalizedPayload.implementationApproach !== undefined
          ? {
              implementationApproach: normalizedPayload.implementationApproach
            }
          : {}),
        ...(normalizedPayload.platformTierSelections !== undefined
          ? {
              platformTierSelections:
                Object.keys(normalizedPayload.platformTierSelections).length > 0
                  ? normalizedPayload.platformTierSelections
                  : Prisma.Prisma.JsonNull
            }
          : {}),
        ...(normalizedPayload.problemStatement !== undefined
          ? { problemStatement: normalizedPayload.problemStatement || null }
          : {}),
        ...(normalizedPayload.solutionRecommendation !== undefined
          ? {
              solutionRecommendation:
                normalizedPayload.solutionRecommendation || null
            }
          : {}),
        ...(normalizedPayload.scopeExecutiveSummary !== undefined
          ? {
              scopeExecutiveSummary:
                normalizedPayload.scopeExecutiveSummary || null
            }
          : {}),
        ...(normalizedPayload.clientQuestionnaireConfig !== undefined
          ? {
              clientQuestionnaireConfig:
                normalizedPayload.clientQuestionnaireConfig
            }
          : {}),
        ...(normalizedPayload.scopeType !== undefined
          ? { scopeType: normalizedPayload.scopeType || "discovery" }
          : {}),
        ...(normalizedPayload.deliveryTemplateId !== undefined
          ? { deliveryTemplateId: normalizedPayload.deliveryTemplateId || null }
          : {}),
        ...(normalizedPayload.commercialBrief !== undefined
          ? { commercialBrief: normalizedPayload.commercialBrief || null }
          : {}),
        ...(normalizedPayload.hubs
          ? { selectedHubs: normalizedPayload.hubs }
          : {}),
        ...(nextOwnerDetails ? nextOwnerDetails : {}),
        ...(nextClientId !== existingProject.clientId
          ? { clientId: nextClientId }
          : {}),
        ...(nextPortalId !== existingProject.portalId
          ? { portalId: nextPortalId }
          : {}),
        ...(normalizedPayload.clientChampionFirstName !== undefined
          ? {
              clientChampionFirstName:
                normalizedPayload.clientChampionFirstName || null
            }
          : {}),
        ...(normalizedPayload.clientChampionLastName !== undefined
          ? {
              clientChampionLastName:
                normalizedPayload.clientChampionLastName || null
            }
          : {}),
        ...(normalizedPayload.clientChampionEmail !== undefined
          ? {
              clientChampionEmail: normalizedPayload.clientChampionEmail || null
            }
          : {})
      },
      include: { client: true, portal: true, discovery: true }
    });

    if (nextClientId !== existingProject.clientId) {
      const remainingClientProjects = await transaction.project.count({
        where: { clientId: existingProject.clientId }
      });

      if (remainingClientProjects === 0) {
        await transaction.client.delete({
          where: { id: existingProject.clientId }
        });
      }
    }

    if (nextPortalId !== existingProject.portalId) {
      await deleteHubSpotPortalIfUnused(transaction, existingProject.portalId);
    }

    return updatedProject;
  });

  return serializeProject(project);
}

export async function updateProjectRecordStatus(
  projectId: string,
  status: unknown
) {
  const allowedStatuses = [
    "active",
    "complete",
    "archived",
    "draft",
    "ready-for-execution",
    "in-flight"
  ];

  if (typeof status !== "string" || !allowedStatuses.includes(status)) {
    throw new Error("Invalid status");
  }

  try {
    const project = await prisma.project.update({
      where: { id: projectId },
      data: { status },
      include: { client: true, portal: true, discovery: true }
    });

    return serializeProject(project);
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      throw new Error("Project not found");
    }

    throw error;
  }
}

export async function deleteProjectRecord(projectId: string) {
  const existingProject = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, portalId: true }
  });

  if (!existingProject) {
    throw new Error("Project not found");
  }

  await prisma.executionJob.deleteMany({
    where: { projectId }
  });
  await prisma.task.deleteMany({
    where: { projectId }
  });
  await prisma.blueprintTask.deleteMany({
    where: { blueprint: { projectId } }
  });
  await prisma.blueprint.deleteMany({
    where: { projectId }
  });
  await prisma.discoverySubmission.deleteMany({
    where: { projectId }
  });
  await prisma.project.delete({
    where: { id: projectId }
  });

  await prisma.$transaction(async (transaction) => {
    await deleteHubSpotPortalIfUnused(transaction, existingProject.portalId);
  });
}

function normalizeHubSpotBaseUrl(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return "https://api.hubapi.com";
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function resolveHubSpotOAuthRedirectUri(explicitRedirectUri?: string | null) {
  const trimmedExplicitRedirectUri = explicitRedirectUri?.trim() ?? "";

  if (trimmedExplicitRedirectUri) {
    return trimmedExplicitRedirectUri;
  }

  const baseUrl =
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_BASE_URL ??
    "https://deploy.wearemuloo.com";

  return `${baseUrl}/settings/providers/hubspot/callback`;
}

async function loadHubSpotOAuthProviderConnectionRecord() {
  await ensureProviderConnectionsSeeded();

  return prisma.workspaceProviderConnection.findUnique({
    where: { providerKey: "hubspot_oauth" }
  });
}

async function loadHubSpotOAuthProviderConfig() {
  const provider = await loadHubSpotOAuthProviderConnectionRecord();

  if (!provider) {
    throw new Error("HubSpot OAuth provider is not configured");
  }

  const clientId = provider.defaultModel?.trim() ?? "";
  const clientSecret = provider.apiKey?.trim() ?? "";
  const baseUrl = normalizeHubSpotBaseUrl(provider.endpointUrl);

  return {
    provider,
    clientId,
    clientSecret,
    baseUrl,
    redirectUri: resolveHubSpotOAuthRedirectUri()
  };
}

export async function resolveHubSpotAgentConnection(
  portalRecordId?: string | null
) {
  await ensureProviderConnectionsSeeded();

  const provider = await prisma.workspaceProviderConnection.findUnique({
    where: { providerKey: "hubspot_oauth" }
  });
  const requestedPortalId = portalRecordId?.trim() || null;
  const availablePortals = await prisma.hubSpotPortal.findMany({
    where: {
      NOT: {
        portalId: {
          startsWith: pendingPortalPrefix
        }
      }
    },
    orderBy: [
      { connected: "desc" },
      { updatedAt: "desc" },
      { displayName: "asc" }
    ]
  });

  if (requestedPortalId) {
    const portal =
      await refreshHubSpotPortalAccessTokenIfNeeded(requestedPortalId);

    if (!portal) {
      throw new Error("Selected HubSpot portal was not found");
    }

    const portalAccessToken =
      portal.connected && portal.accessToken?.trim()
        ? portal.accessToken.trim()
        : "";

    return {
      ready: portalAccessToken.length > 0,
      accessToken: portalAccessToken,
      source: "connected_portal",
      baseUrl: normalizeHubSpotBaseUrl(
        process.env.HUBSPOT_BASE_URL ?? provider?.endpointUrl ?? undefined
      ),
      portalId: portal.portalId,
      portalRecordId: portal.id,
      portalDisplayName: portal.displayName,
      providerEnabled: provider?.isEnabled ?? false,
      availablePortals: availablePortals.map((connectedPortal) =>
        serializeHubSpotPortal(connectedPortal)
      )
    };
  }

  const envAccessToken = process.env.HUBSPOT_ACCESS_TOKEN?.trim() ?? "";
  const accessToken = envAccessToken;
  const source = envAccessToken ? "env" : "missing";
  const baseUrl = normalizeHubSpotBaseUrl(
    process.env.HUBSPOT_BASE_URL ?? provider?.endpointUrl ?? undefined
  );
  const portalId = process.env.HUBSPOT_PORTAL_ID?.trim() || null;

  return {
    ready: accessToken.length > 0,
    accessToken,
    source,
    baseUrl,
    portalId,
    portalRecordId: null,
    portalDisplayName: null,
    providerEnabled: provider?.isEnabled ?? false,
    availablePortals: availablePortals.map((connectedPortal) =>
      serializeHubSpotPortal(connectedPortal)
    )
  };
}

export function buildHubSpotAgentCapabilitiesPayload(input: {
  ready: boolean;
  source: string;
  baseUrl: string;
  portalId: string | null;
  portalRecordId: string | null;
  portalDisplayName: string | null;
  providerEnabled: boolean;
  availablePortals: ReturnType<typeof serializeHubSpotPortal>[];
}) {
  return {
    connection: {
      ready: input.ready,
      source: input.source,
      baseUrl: input.baseUrl,
      portalId: input.portalId,
      portalRecordId: input.portalRecordId,
      portalDisplayName: input.portalDisplayName,
      providerEnabled: input.providerEnabled
    },
    portals: input.availablePortals,
    capabilities: hubSpotAgentCapabilities,
    supportedActions: Array.from(
      new Set(
        hubSpotAgentCapabilities.flatMap(
          (capability) => capability.directActions ?? []
        )
      )
    )
  };
}

export async function executeHubSpotAgentAction(value: {
  action?: unknown;
  input?: unknown;
  dryRun?: unknown;
  portalRecordId?: unknown;
}): Promise<unknown> {
  const action = typeof value.action === "string" ? value.action.trim() : "";
  const dryRun = value.dryRun !== false;
  const portalRecordId =
    typeof value.portalRecordId === "string" && value.portalRecordId.trim()
      ? value.portalRecordId.trim()
      : null;
  const input =
    value.input &&
    typeof value.input === "object" &&
    !Array.isArray(value.input)
      ? (value.input as Record<string, unknown>)
      : {};

  if (
    ![
      "create_property_group",
      "create_property",
      "create_custom_object",
      "create_pipeline",
      "upsert_record"
    ].includes(action)
  ) {
    throw new Error("Unsupported HubSpot agent action");
  }

  const connection = await resolveHubSpotAgentConnection(portalRecordId);
  const connectionSummary = {
    ready: connection.ready,
    source: connection.source,
    baseUrl: connection.baseUrl,
    portalId: connection.portalId,
    portalRecordId: connection.portalRecordId,
    portalDisplayName: connection.portalDisplayName
  };

  if (dryRun) {
    return {
      dryRun: true,
      action,
      connection: connectionSummary,
      requestPreview: input
    };
  }

  if (!connection.ready) {
    throw new Error(
      "HubSpot auth is not configured. Connect a HubSpot portal first or set HUBSPOT_ACCESS_TOKEN for the legacy fallback path."
    );
  }

  const client = new HubSpotClient({
    accessToken: connection.accessToken,
    baseUrl: connection.baseUrl,
    logger: createHubSpotLogger()
  });

  switch (action as HubSpotAgentActionKey) {
    case "create_property_group": {
      const objectType =
        typeof input.objectType === "string" ? input.objectType.trim() : "";
      const name = typeof input.name === "string" ? input.name.trim() : "";
      const label = typeof input.label === "string" ? input.label.trim() : "";
      const displayOrder =
        typeof input.displayOrder === "number"
          ? input.displayOrder
          : Number(input.displayOrder);

      if (!objectType || !name || !label) {
        throw new Error("objectType, name, and label are required");
      }

      const result = await client.createPropertyGroup(objectType, {
        name,
        label,
        ...(Number.isFinite(displayOrder) ? { displayOrder } : {})
      });

      return {
        dryRun: false,
        action,
        connection: connectionSummary,
        result
      };
    }
    case "create_property": {
      const objectType =
        typeof input.objectType === "string" ? input.objectType.trim() : "";
      const name = typeof input.name === "string" ? input.name.trim() : "";
      const label = typeof input.label === "string" ? input.label.trim() : "";
      const type = typeof input.type === "string" ? input.type.trim() : "";
      const fieldType =
        typeof input.fieldType === "string" ? input.fieldType.trim() : "";

      if (!objectType || !name || !label || !type || !fieldType) {
        throw new Error(
          "objectType, name, label, type, and fieldType are required"
        );
      }

      const result = await client.createProperty(objectType, {
        name,
        label,
        type,
        fieldType,
        ...(typeof input.description === "string" && input.description.trim()
          ? { description: input.description.trim() }
          : {}),
        ...(typeof input.groupName === "string" && input.groupName.trim()
          ? { groupName: input.groupName.trim() }
          : {}),
        ...(input.formField !== undefined
          ? { formField: Boolean(input.formField) }
          : {}),
        ...(Array.isArray(input.options)
          ? {
              options: input.options
                .filter(
                  (option): option is Record<string, unknown> =>
                    Boolean(option) && typeof option === "object"
                )
                .map((option, index) => ({
                  label:
                    typeof option.label === "string" ? option.label.trim() : "",
                  value:
                    typeof option.value === "string" ? option.value.trim() : "",
                  ...(option.displayOrder !== undefined
                    ? {
                        displayOrder:
                          typeof option.displayOrder === "number"
                            ? option.displayOrder
                            : Number(option.displayOrder) || index
                      }
                    : {}),
                  ...(option.hidden !== undefined
                    ? { hidden: Boolean(option.hidden) }
                    : {})
                }))
            }
          : {})
      });

      return {
        dryRun: false,
        action,
        connection: connectionSummary,
        result
      };
    }
    case "create_custom_object": {
      const name = typeof input.name === "string" ? input.name.trim() : "";
      const singularLabel =
        typeof input.singularLabel === "string"
          ? input.singularLabel.trim()
          : "";
      const pluralLabel =
        typeof input.pluralLabel === "string" ? input.pluralLabel.trim() : "";
      const primaryDisplayProperty =
        typeof input.primaryDisplayProperty === "string"
          ? input.primaryDisplayProperty.trim()
          : "";
      const properties = Array.isArray(input.properties)
        ? input.properties
            .filter(
              (property): property is Record<string, unknown> =>
                Boolean(property) && typeof property === "object"
            )
            .map((property) => ({
              name:
                typeof property.name === "string" ? property.name.trim() : "",
              label:
                typeof property.label === "string" ? property.label.trim() : "",
              type:
                typeof property.type === "string" ? property.type.trim() : "",
              fieldType:
                typeof property.fieldType === "string"
                  ? property.fieldType.trim()
                  : "",
              ...(typeof property.description === "string" &&
              property.description.trim()
                ? { description: property.description.trim() }
                : {}),
              ...(typeof property.groupName === "string" &&
              property.groupName.trim()
                ? { groupName: property.groupName.trim() }
                : {}),
              ...(property.formField !== undefined
                ? { formField: Boolean(property.formField) }
                : {}),
              ...(Array.isArray(property.options)
                ? {
                    options: property.options
                      .filter(
                        (option): option is Record<string, unknown> =>
                          Boolean(option) && typeof option === "object"
                      )
                      .map((option) => ({
                        label:
                          typeof option.label === "string"
                            ? option.label.trim()
                            : "",
                        value:
                          typeof option.value === "string"
                            ? option.value.trim()
                            : ""
                      }))
                  }
                : {})
            }))
        : [];

      if (!name || !singularLabel || !pluralLabel || !primaryDisplayProperty) {
        throw new Error(
          "name, singularLabel, pluralLabel, and primaryDisplayProperty are required"
        );
      }

      if (properties.length === 0) {
        throw new Error(
          "At least one property is required for a custom object"
        );
      }

      const result = await client.createCustomObjectSchema({
        name,
        ...(typeof input.description === "string" && input.description.trim()
          ? { description: input.description.trim() }
          : {}),
        labels: {
          singular: singularLabel,
          plural: pluralLabel
        },
        primaryDisplayProperty,
        secondaryDisplayProperties: normalizeStringArray(
          input.secondaryDisplayProperties
        ),
        searchableProperties: normalizeStringArray(input.searchableProperties),
        requiredProperties: normalizeStringArray(input.requiredProperties),
        associatedObjects: normalizeStringArray(input.associatedObjects),
        properties
      });

      return {
        dryRun: false,
        action,
        connection: connectionSummary,
        result
      };
    }
    case "create_pipeline": {
      const objectType =
        typeof input.objectType === "string" ? input.objectType.trim() : "";
      const label = typeof input.label === "string" ? input.label.trim() : "";
      const displayOrder =
        typeof input.displayOrder === "number"
          ? input.displayOrder
          : Number(input.displayOrder);
      const stages = Array.isArray(input.stages)
        ? input.stages
            .filter(
              (stage): stage is Record<string, unknown> =>
                Boolean(stage) && typeof stage === "object"
            )
            .map((stage) => ({
              label: typeof stage.label === "string" ? stage.label.trim() : "",
              ...(stage.displayOrder !== undefined
                ? {
                    displayOrder:
                      typeof stage.displayOrder === "number"
                        ? stage.displayOrder
                        : Number(stage.displayOrder) || 0
                  }
                : {}),
              ...(stage.probability !== undefined
                ? {
                    probability:
                      typeof stage.probability === "number"
                        ? stage.probability
                        : Number(stage.probability)
                  }
                : {})
            }))
        : [];

      if ((objectType !== "deals" && objectType !== "tickets") || !label) {
        throw new Error(
          "objectType must be deals or tickets, and label is required"
        );
      }

      const result = await client.createPipeline(objectType, {
        label,
        ...(Number.isFinite(displayOrder) ? { displayOrder } : {}),
        ...(stages.length > 0 ? { stages } : {})
      });

      return {
        dryRun: false,
        action,
        connection: connectionSummary,
        result
      };
    }
    case "upsert_record": {
      const objectType =
        typeof input.objectType === "string" ? input.objectType.trim() : "";
      const id = typeof input.id === "string" ? input.id.trim() : "";
      const idProperty =
        typeof input.idProperty === "string" ? input.idProperty.trim() : "";
      const properties =
        input.properties &&
        typeof input.properties === "object" &&
        !Array.isArray(input.properties)
          ? (input.properties as Record<
              string,
              string | number | boolean | null
            >)
          : null;

      if (!objectType || !properties) {
        throw new Error("objectType and properties are required");
      }

      const result = await client.upsertObjectRecord({
        objectType,
        ...(id ? { id } : {}),
        ...(idProperty ? { idProperty } : {}),
        properties
      });

      return {
        dryRun: false,
        action,
        connection: connectionSummary,
        result
      };
    }
  }
}

export async function runHubSpotAgentRequest(value: {
  request?: unknown;
  dryRun?: unknown;
  portalRecordId?: unknown;
}) {
  const request =
    typeof value.request === "string" ? value.request.trim() : "";
  const dryRun = value.dryRun !== false;
  const portalRecordId =
    typeof value.portalRecordId === "string" && value.portalRecordId.trim()
      ? value.portalRecordId.trim()
      : null;

  if (!request) {
    throw new Error("request must be a non-empty string");
  }

  const connection = await resolveHubSpotAgentConnection(portalRecordId);
  const planText = await callAiWorkflow(
    "hubspot_operator_request",
    `You are Muloo Deploy OS's HubSpot Operator Agent.

You receive natural-language requests for a specific HubSpot portal. Your job is to decide whether the request can be executed safely through a supported direct action, or whether it should return a manual plan instead.

Rules:
- Return ONLY valid JSON.
- Use exactly these keys: mode, summary, capabilityKey, action, input, manualPlan, cautions.
- mode must be either "execute_action" or "manual_plan".
- Only choose "execute_action" when the request clearly maps to one supported direct action and you can produce a valid input payload.
- If the request is about dashboards, reports, workflow design, CMS, app home, UI extensions, or anything without a safe direct CRUD path, return "manual_plan".
- Do not pretend a dashboard can be created through the direct REST actions if it cannot.
- If you choose "execute_action", action must be one of:
  - create_property_group -> input: { objectType, name, label, displayOrder? }
  - create_property -> input: { objectType, name, label, type, fieldType, description?, groupName?, formField?, options? }
  - create_custom_object -> input: { name, singularLabel, pluralLabel, primaryDisplayProperty, secondaryDisplayProperties?, searchableProperties?, requiredProperties?, associatedObjects?, properties }
  - create_pipeline -> input: { objectType, label, displayOrder?, stages? }
  - upsert_record -> input: { objectType, id, idProperty?, properties }
- manualPlan should be a short ordered list of the best next steps when direct execution is not the right path.
- cautions should call out portal limitations, review needs, or missing information.
- Keep the response practical and execution-focused.`,
    stringifyPromptData({
      request,
      dryRun,
      targetPortal: {
        portalRecordId: connection.portalRecordId,
        portalId: connection.portalId,
        portalDisplayName: connection.portalDisplayName,
        ready: connection.ready
      },
      supportedActions: Array.from(
        new Set(
          hubSpotAgentCapabilities.flatMap(
            (capability) => capability.directActions ?? []
          )
        )
      ),
      capabilities: hubSpotAgentCapabilities.map((capability) => ({
        key: capability.key,
        label: capability.label,
        support: capability.support,
        recommendedPath: capability.recommendedPath,
        summary: capability.summary,
        notes: capability.notes,
        directActions: capability.directActions ?? []
      }))
    }),
    { maxTokens: 3000 }
  );

  const plan = await parseHubSpotAgentRequestPlanModelJson(planText, request);

  if (plan.mode === "execute_action") {
    if (!plan.action || !plan.input) {
      return {
        request,
        dryRun,
        plan: {
          ...plan,
          mode: "manual_plan" as const,
          manualPlan:
            plan.manualPlan.length > 0
              ? plan.manualPlan
              : [
                  "Review the request manually because the model did not return a complete executable HubSpot action."
                ]
        },
        execution: null
      };
    }

    const execution = await executeHubSpotAgentAction({
      action: plan.action,
      input: plan.input,
      dryRun,
      portalRecordId
    });

    return {
      request,
      dryRun,
      plan,
      execution
    };
  }

  return {
    request,
    dryRun,
    plan,
    execution: null
  };
}

export async function loadAiRouting() {
  await ensureAiRoutingSeeded();

  const routes = await prisma.workspaceAiRouting.findMany({
    orderBy: [{ label: "asc" }]
  });

  return routes.map((routing) => serializeWorkspaceAiRouting(routing));
}

export async function loadWorkspaceEmailSettings() {
  await ensureWorkspaceEmailSettingsSeeded();

  const settings = await prisma.workspaceEmailSettings.findFirstOrThrow({
    orderBy: [{ createdAt: "asc" }]
  });

  return serializeWorkspaceEmailSettings(settings);
}

function resolveAppBaseUrl() {
  return (
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_BASE_URL ??
    "https://deploy.wearemuloo.com"
  );
}

function ensureScope(values: string[], scope: string) {
  return values.includes(scope) ? values : [...values, scope];
}

function resolveGoogleWorkspaceEmailOAuthRedirectUri(
  explicitRedirectUri?: string | null
) {
  const trimmedExplicitRedirectUri = explicitRedirectUri?.trim() ?? "";

  if (trimmedExplicitRedirectUri) {
    return trimmedExplicitRedirectUri;
  }

  return `${resolveAppBaseUrl()}/settings/email/google/callback`;
}

function resolveWorkspaceGoogleLoginRedirectUri() {
  return `${resolveAppBaseUrl()}/api/auth/google/callback`;
}

async function resolveWorkspaceGoogleLoginOauthConfig() {
  const emailConnection = await prisma.workspaceEmailOAuthConnection
    .findUnique({
      where: { providerKey: "google_workspace" }
    })
    .catch(() => null);
  const calendarConnection = await prisma.workspaceCalendarConnection
    .findUnique({
      where: { providerKey: "google_calendar" }
    })
    .catch(() => null);

  const clientId =
    emailConnection?.clientId?.trim() ||
    calendarConnection?.clientId?.trim() ||
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    "";
  const clientSecret =
    emailConnection?.clientSecret?.trim() ||
    calendarConnection?.clientSecret?.trim() ||
    process.env.GOOGLE_CLIENT_SECRET?.trim() ||
    "";
  const allowedDomain =
    process.env.GOOGLE_LOGIN_ALLOWED_DOMAIN?.trim()
      .toLowerCase()
      .replace(/^@+/, "") || null;

  return {
    clientId,
    clientSecret,
    redirectUri: resolveWorkspaceGoogleLoginRedirectUri(),
    allowedDomain
  };
}

function resolveWorkspaceCalendarRedirectUri() {
  return `${resolveAppBaseUrl()}/api/workspace/calendar/callback`;
}

function resolveWorkspaceXeroRedirectUri() {
  return `${resolveAppBaseUrl()}/api/workspace/xero/callback`;
}

function normalizeDateInput(
  value: string | Date | null | undefined
): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const microsoftDateMatch = value.match(/\/Date\((\d+)(?:[+-]\d+)?\)\//);

  if (microsoftDateMatch?.[1]) {
    const timestamp = Number(microsoftDateMatch[1]);
    return Number.isFinite(timestamp) ? new Date(timestamp) : null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatWorkflowLabel(workflowKey: string) {
  return workflowKey
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

async function refreshGoogleWorkspaceEmailAccessTokenIfNeeded(
  minimumValidityMs = 60_000
) {
  const connection = await getGoogleWorkspaceEmailOAuthConnectionRecord();

  if (
    !connection?.enabled ||
    !connection.connectedEmail ||
    !connection.refreshToken ||
    !connection.clientId ||
    !connection.clientSecret
  ) {
    return null;
  }

  const tokenStillValid =
    connection.accessToken &&
    connection.tokenExpiresAt &&
    connection.tokenExpiresAt.getTime() > Date.now() + minimumValidityMs;

  if (tokenStillValid) {
    return connection;
  }

  const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: connection.clientId,
      client_secret: connection.clientSecret,
      refresh_token: connection.refreshToken,
      grant_type: "refresh_token"
    }).toString()
  });

  const refreshBody = (await refreshResponse.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    token_type?: string;
    error?: string;
    error_description?: string;
  } | null;

  if (!refreshResponse.ok || !refreshBody?.access_token) {
    throw new Error(
      refreshBody?.error_description ||
        refreshBody?.error ||
        "Google access token refresh failed"
    );
  }

  return prisma.workspaceEmailOAuthConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: refreshBody.access_token,
      tokenType: refreshBody.token_type ?? connection.tokenType ?? "Bearer",
      tokenExpiresAt:
        typeof refreshBody.expires_in === "number"
          ? new Date(Date.now() + refreshBody.expires_in * 1000)
          : connection.tokenExpiresAt
    }
  });
}

export async function loadWorkspaceEmailOAuthConnection() {
  await ensureWorkspaceEmailOAuthConnectionsSeeded();

  const connection =
    await prisma.workspaceEmailOAuthConnection.findUniqueOrThrow({
      where: { providerKey: "google_workspace" }
    });

  return serializeWorkspaceEmailOAuthConnection({
    ...connection,
    scopes: ensureScope(
      connection.scopes,
      "https://www.googleapis.com/auth/gmail.readonly"
    ),
    redirectUri: resolveGoogleWorkspaceEmailOAuthRedirectUri(
      connection.redirectUri
    )
  });
}

export async function loadWorkspaceTodos() {
  const todos = await prisma.workspaceTodo.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  return todos.map((todo) => serializeWorkspaceTodo(todo));
}

export async function createWorkspaceTodo(value: {
  title?: unknown;
  notes?: unknown;
}) {
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const notes =
    typeof value.notes === "string" ? value.notes.trim() || null : null;

  if (!title) {
    throw new Error("title is required");
  }

  const todo = await prisma.workspaceTodo.create({
    data: { title, notes }
  });

  return serializeWorkspaceTodo(todo);
}

export async function updateWorkspaceTodo(
  todoId: string,
  value: {
    title?: unknown;
    notes?: unknown;
    completed?: unknown;
    sortOrder?: unknown;
  }
) {
  const data: Prisma.Prisma.WorkspaceTodoUpdateInput = {};

  if (value.title !== undefined) {
    if (typeof value.title !== "string" || value.title.trim().length === 0) {
      throw new Error("title must be a non-empty string");
    }

    data.title = value.title.trim();
  }

  if (value.notes !== undefined) {
    if (typeof value.notes !== "string" && value.notes !== null) {
      throw new Error("notes must be a string");
    }

    data.notes =
      typeof value.notes === "string" ? value.notes.trim() || null : null;
  }

  if (value.sortOrder !== undefined) {
    const sortOrder =
      typeof value.sortOrder === "number"
        ? value.sortOrder
        : Number(value.sortOrder);

    if (!Number.isFinite(sortOrder)) {
      throw new Error("sortOrder must be a valid number");
    }

    data.sortOrder = Math.round(sortOrder);
  }

  if (value.completed === true) {
    data.completed = true;
    data.completedAt = new Date();
  } else if (value.completed === false) {
    data.completed = false;
    data.completedAt = null;
  } else if (value.completed !== undefined) {
    throw new Error("completed must be a boolean");
  }

  const todo = await prisma.workspaceTodo.update({
    where: { id: todoId },
    data
  });

  return serializeWorkspaceTodo(todo);
}

export async function deleteWorkspaceTodo(todoId: string) {
  const todo = await prisma.workspaceTodo.delete({
    where: { id: todoId }
  });

  return serializeWorkspaceTodo(todo);
}

export async function clearCompletedWorkspaceTodos() {
  return prisma.workspaceTodo.deleteMany({
    where: { completed: true }
  });
}

export async function getGmailActionRequired() {
  await ensureWorkspaceEmailOAuthConnectionsSeeded();

  const connection = await prisma.workspaceEmailOAuthConnection.findUnique({
    where: { providerKey: "google_workspace" }
  });

  if (!connection?.enabled) {
    return { connected: false as const };
  }

  const refreshedConnection =
    await refreshGoogleWorkspaceEmailAccessTokenIfNeeded(5 * 60_000);

  if (!refreshedConnection?.accessToken) {
    return { connected: false as const };
  }

  const gmailFilterLabel = refreshedConnection.gmailFilterLabel?.trim() || null;
  const query = gmailFilterLabel
    ? `label:${gmailFilterLabel} is:unread`
    : "is:unread from:(-me) category:primary newer_than:14d";

  const messagesResponse = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?" +
      new URLSearchParams({
        q: query,
        maxResults: "20"
      }).toString(),
    {
      headers: {
        Authorization: `Bearer ${refreshedConnection.accessToken}`
      }
    }
  );

  const messagesBody = (await messagesResponse.json().catch(() => null)) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string };
  } | null;

  if (!messagesResponse.ok) {
    throw new Error(
      messagesBody?.error?.message || "Failed to load Gmail messages"
    );
  }

  const emails = await Promise.all(
    (messagesBody?.messages ?? [])
      .map((message) => message.id?.trim())
      .filter((messageId): messageId is string => Boolean(messageId))
      .map(async (messageId) => {
        const detailParams = new URLSearchParams({
          format: "metadata"
        });
        detailParams.append("metadataHeaders", "subject");
        detailParams.append("metadataHeaders", "from");
        detailParams.append("metadataHeaders", "date");

        const detailResponse = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages/" +
            encodeURIComponent(messageId) +
            `?${detailParams.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${refreshedConnection.accessToken}`
            }
          }
        );

        const detailBody = (await detailResponse.json().catch(() => null)) as {
          id?: string;
          snippet?: string;
          payload?: {
            headers?: Array<{ name?: string; value?: string }>;
          };
          error?: { message?: string };
        } | null;

        if (!detailResponse.ok || !detailBody?.id) {
          throw new Error(
            detailBody?.error?.message || "Failed to load Gmail message detail"
          );
        }

        const headers = new Map(
          (detailBody.payload?.headers ?? [])
            .filter(
              (header): header is { name: string; value: string } =>
                typeof header.name === "string" &&
                typeof header.value === "string"
            )
            .map((header) => [header.name.toLowerCase(), header.value])
        );

        return {
          id: detailBody.id,
          subject: headers.get("subject") ?? "(No subject)",
          from: headers.get("from") ?? "",
          date: headers.get("date") ?? "",
          snippet: detailBody.snippet ?? "",
          gmailUrl: `https://mail.google.com/mail/u/0/#inbox/${detailBody.id}`
        };
      })
  );

  return {
    connected: true as const,
    activeFilterLabel: gmailFilterLabel,
    emails
  };
}

async function refreshWorkspaceCalendarAccessTokenIfNeeded(
  minimumValidityMs = 5 * 60_000
) {
  const connection = await prisma.workspaceCalendarConnection.findUnique({
    where: { providerKey: "google_calendar" }
  });

  if (
    !connection?.enabled ||
    !connection.refreshToken ||
    !connection.clientId ||
    !connection.clientSecret
  ) {
    return null;
  }

  const tokenStillValid =
    connection.accessToken &&
    connection.tokenExpiresAt &&
    connection.tokenExpiresAt.getTime() > Date.now() + minimumValidityMs;

  if (tokenStillValid) {
    return connection;
  }

  const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: connection.clientId,
      client_secret: connection.clientSecret,
      refresh_token: connection.refreshToken,
      grant_type: "refresh_token"
    }).toString()
  });

  const refreshBody = (await refreshResponse.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    token_type?: string;
    error?: string;
    error_description?: string;
  } | null;

  if (!refreshResponse.ok || !refreshBody?.access_token) {
    throw new Error(
      refreshBody?.error_description ||
        refreshBody?.error ||
        "Google Calendar token refresh failed"
    );
  }

  return prisma.workspaceCalendarConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: refreshBody.access_token,
      tokenType: refreshBody.token_type ?? connection.tokenType ?? "Bearer",
      tokenExpiresAt:
        typeof refreshBody.expires_in === "number"
          ? new Date(Date.now() + refreshBody.expires_in * 1000)
          : connection.tokenExpiresAt
    }
  });
}

export async function loadWorkspaceCalendarConnection() {
  const connection = await prisma.workspaceCalendarConnection.upsert({
    where: { providerKey: "google_calendar" },
    update: {},
    create: {
      providerKey: "google_calendar",
      label: "Google Calendar",
      scopes: [
        "https://www.googleapis.com/auth/calendar.readonly",
        "openid",
        "email",
        "profile"
      ],
      enabled: false
    }
  });

  return serializeWorkspaceCalendarConnection(connection);
}

export async function saveWorkspaceApiKey(value: {
  keyName?: unknown;
  keyValue?: unknown;
  label?: unknown;
}) {
  if (typeof value.keyName !== "string" || value.keyName.trim().length === 0) {
    throw new Error("keyName must be a non-empty string");
  }

  if (
    typeof value.keyValue !== "string" ||
    value.keyValue.trim().length === 0
  ) {
    throw new Error("keyValue must be a non-empty string");
  }

  if (value.label !== undefined && typeof value.label !== "string") {
    throw new Error("label must be a string");
  }

  const keyName = value.keyName.trim().toLowerCase();
  const keyValue = value.keyValue.trim();
  const label =
    typeof value.label === "string" ? value.label.trim() || null : null;

  const savedKey = await prisma.workspaceApiKey.upsert({
    where: {
      workspaceId_keyName: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        keyName
      }
    },
    create: {
      workspaceId: DEFAULT_WORKSPACE_ID,
      keyName,
      keyValue,
      label
    },
    update: {
      keyValue,
      label,
      updatedAt: new Date()
    }
  });

  return serializeWorkspaceApiKey(savedKey);
}

export async function deleteWorkspaceApiKey(keyName: string) {
  const normalizedKeyName = keyName.trim().toLowerCase();

  if (!normalizedKeyName) {
    throw new Error("keyName must be a non-empty string");
  }

  await prisma.workspaceApiKey.deleteMany({
    where: {
      workspaceId: DEFAULT_WORKSPACE_ID,
      keyName: normalizedKeyName
    }
  });

  return { success: true };
}

export async function updateWorkspaceCalendarConnection(value: {
  clientId?: unknown;
  clientSecret?: unknown;
  redirectUri?: unknown;
  enabled?: unknown;
  scopes?: unknown;
}) {
  const connection = await prisma.workspaceCalendarConnection.upsert({
    where: { providerKey: "google_calendar" },
    update: {},
    create: {
      providerKey: "google_calendar",
      label: "Google Calendar",
      scopes: [
        "https://www.googleapis.com/auth/calendar.readonly",
        "openid",
        "email",
        "profile"
      ],
      enabled: false
    }
  });

  const updateData: Prisma.Prisma.WorkspaceCalendarConnectionUpdateInput = {};

  if (value.clientId !== undefined) {
    if (typeof value.clientId !== "string") {
      throw new Error("clientId must be a string");
    }

    updateData.clientId = value.clientId.trim() || null;
  }

  if (value.clientSecret !== undefined) {
    if (typeof value.clientSecret !== "string") {
      throw new Error("clientSecret must be a string");
    }

    updateData.clientSecret = value.clientSecret.trim() || null;
  }

  if (value.redirectUri !== undefined) {
    if (typeof value.redirectUri !== "string") {
      throw new Error("redirectUri must be a string");
    }

    updateData.redirectUri = value.redirectUri.trim() || null;
  }

  if (value.enabled !== undefined) {
    updateData.enabled = Boolean(value.enabled);
  }

  if (value.scopes !== undefined) {
    const scopes = Array.isArray(value.scopes)
      ? value.scopes
      : typeof value.scopes === "string"
        ? value.scopes.split(/[\n, ]+/)
        : [];

    const normalizedScopes = scopes
      .filter((scope): scope is string => typeof scope === "string")
      .map((scope) => scope.trim())
      .filter(Boolean);

    const nextScopes = ensureScope(
      normalizedScopes,
      "https://www.googleapis.com/auth/calendar.readonly"
    );

    if (nextScopes.length === 0) {
      throw new Error("At least one Calendar OAuth scope is required");
    }

    updateData.scopes = nextScopes;
  }

  const updatedConnection = await prisma.workspaceCalendarConnection.update({
    where: { id: connection.id },
    data: updateData
  });

  return serializeWorkspaceCalendarConnection(updatedConnection);
}

async function resolveWorkspaceCalendarOauthConfig() {
  const connection = await prisma.workspaceCalendarConnection.findUnique({
    where: { providerKey: "google_calendar" }
  });

  const clientId =
    connection?.clientId?.trim() || process.env.GOOGLE_CLIENT_ID?.trim() || "";
  const clientSecret =
    connection?.clientSecret?.trim() ||
    process.env.GOOGLE_CLIENT_SECRET?.trim() ||
    "";
  const redirectUri =
    connection?.redirectUri?.trim() || resolveWorkspaceCalendarRedirectUri();
  const scopes =
    connection?.scopes.length && connection.scopes.some(Boolean)
      ? ensureScope(connection.scopes, "https://www.googleapis.com/auth/calendar.readonly")
      : [
          "https://www.googleapis.com/auth/calendar.readonly",
          "openid",
          "email",
          "profile"
        ];

  return {
    connection,
    clientId,
    clientSecret,
    redirectUri,
    scopes
  };
}

export async function createWorkspaceCalendarOAuthStart() {
  const { clientId, clientSecret, redirectUri, scopes } =
    await resolveWorkspaceCalendarOauthConfig();

  if (!clientId || !clientSecret) {
    throw new Error("Google Calendar OAuth credentials are not configured");
  }

  const state = createSignedStateToken({
    providerKey: "google_calendar",
    redirectUri,
    expiresAt: Date.now() + 1000 * 60 * 10
  });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state
  });

  return {
    authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  };
}

export async function createWorkspaceGoogleLoginStart() {
  const { clientId, clientSecret, redirectUri, allowedDomain } =
    await resolveWorkspaceGoogleLoginOauthConfig();

  if (!clientId || !clientSecret) {
    throw new Error("Google sign-in is not configured");
  }

  const state = createSignedStateToken({
    providerKey: "google_login",
    redirectUri,
    expiresAt: Date.now() + 1000 * 60 * 10
  });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "select_account",
    include_granted_scopes: "true",
    scope: ["openid", "email", "profile"].join(" "),
    state
  });

  if (allowedDomain) {
    params.set("hd", allowedDomain);
  }

  return {
    authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  };
}

export async function completeWorkspaceGoogleLoginCallback(value: {
  code?: unknown;
  state?: unknown;
}) {
  const code = typeof value.code === "string" ? value.code.trim() : "";
  const state = typeof value.state === "string" ? value.state.trim() : "";

  if (!code || !state) {
    throw new Error("Google sign-in callback is missing code or state");
  }

  const verifiedState = verifySignedStateToken(state);
  const redirectUri =
    typeof verifiedState.redirectUri === "string"
      ? verifiedState.redirectUri
      : resolveWorkspaceGoogleLoginRedirectUri();
  const { clientId, clientSecret, allowedDomain } =
    await resolveWorkspaceGoogleLoginOauthConfig();

  if (!clientId || !clientSecret) {
    throw new Error("Google sign-in is not configured");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    }).toString()
  });

  const tokenBody = (await tokenResponse.json().catch(() => null)) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  } | null;

  if (!tokenResponse.ok || !tokenBody?.access_token) {
    throw new Error(
      tokenBody?.error_description ||
        tokenBody?.error ||
        "Google sign-in token exchange failed"
    );
  }

  const profileResponse = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: {
        Authorization: `Bearer ${tokenBody.access_token}`
      }
    }
  );
  const profileBody = (await profileResponse.json().catch(() => null)) as {
    email?: string;
    email_verified?: boolean;
    name?: string;
  } | null;

  const email = profileBody?.email?.trim().toLowerCase() ?? "";

  if (!profileResponse.ok || !email) {
    throw new Error("Could not load your Google profile");
  }

  if (profileBody?.email_verified === false) {
    throw new Error("Your Google email address is not verified");
  }

  const emailDomain = email.split("@")[1] ?? "";
  if (allowedDomain && emailDomain !== allowedDomain) {
    throw new Error(
      `Google sign-in is restricted to ${allowedDomain} accounts`
    );
  }

  const workspaceUser = await prisma.workspaceUser.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      isActive: true,
      name: true
    }
  });

  if (!workspaceUser?.isActive) {
    throw new Error(
      "Your Google account is not linked to an active workspace user"
    );
  }

  return {
    workspaceUser,
    connectedEmail: email,
    connectedName: profileBody?.name?.trim() || workspaceUser.name
  };
}

export async function completeWorkspaceCalendarOAuthCallback(value: {
  code?: unknown;
  state?: unknown;
}) {
  const code = typeof value.code === "string" ? value.code.trim() : "";
  const state = typeof value.state === "string" ? value.state.trim() : "";

  if (!code || !state) {
    throw new Error("Google Calendar OAuth callback is missing code or state");
  }

  const verifiedState = verifySignedStateToken(state);
  const redirectUri =
    typeof verifiedState.redirectUri === "string"
      ? verifiedState.redirectUri
      : resolveWorkspaceCalendarRedirectUri();
  const {
    clientId,
    clientSecret,
    scopes,
    connection
  } = await resolveWorkspaceCalendarOauthConfig();

  if (!clientId || !clientSecret) {
    throw new Error("Google Calendar OAuth credentials are not configured");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    }).toString()
  });

  const tokenBody = (await tokenResponse.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  } | null;

  if (!tokenResponse.ok || !tokenBody?.access_token) {
    throw new Error(
      tokenBody?.error_description ||
        tokenBody?.error ||
        "Google Calendar token exchange failed"
    );
  }

  const profileResponse = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: {
        Authorization: `Bearer ${tokenBody.access_token}`
      }
    }
  );
  const profileBody = (await profileResponse.json().catch(() => null)) as {
    email?: string;
    name?: string;
  } | null;

  if (!profileResponse.ok || !profileBody?.email) {
    throw new Error("Could not load the connected Google Calendar profile");
  }

  const updateData: Prisma.Prisma.WorkspaceCalendarConnectionUpdateInput = {
    label: "Google Calendar",
    clientId,
    clientSecret,
    redirectUri,
    scopes,
    accessToken: tokenBody.access_token,
    tokenType: tokenBody.token_type ?? "Bearer",
    tokenExpiresAt:
      typeof tokenBody.expires_in === "number"
        ? new Date(Date.now() + tokenBody.expires_in * 1000)
        : null,
    connectedEmail: profileBody.email.trim().toLowerCase(),
    connectedName: profileBody.name?.trim() || null,
    enabled: true
  };

  if (tokenBody.refresh_token) {
    updateData.refreshToken = tokenBody.refresh_token;
  }

  const savedConnection = await prisma.workspaceCalendarConnection.upsert({
    where: { providerKey: "google_calendar" },
    update: updateData,
    create: {
      providerKey: "google_calendar",
      label: "Google Calendar",
      clientId,
      clientSecret,
      redirectUri,
      scopes,
      accessToken: tokenBody.access_token,
      refreshToken: tokenBody.refresh_token ?? null,
      tokenType: tokenBody.token_type ?? "Bearer",
      tokenExpiresAt:
        typeof tokenBody.expires_in === "number"
          ? new Date(Date.now() + tokenBody.expires_in * 1000)
          : null,
      connectedEmail: profileBody.email.trim().toLowerCase(),
      connectedName: profileBody.name?.trim() || null,
      enabled: true
    }
  });

  return serializeWorkspaceCalendarConnection(savedConnection);
}

export async function getCalendarEvents() {
  const connection = await prisma.workspaceCalendarConnection.findUnique({
    where: { providerKey: "google_calendar" }
  });

  if (!connection?.enabled) {
    return { connected: false as const };
  }

  const refreshedConnection = await refreshWorkspaceCalendarAccessTokenIfNeeded(
    5 * 60_000
  );

  if (!refreshedConnection?.accessToken) {
    return { connected: false as const };
  }

  const now = new Date();
  const calendarResponse = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?" +
      new URLSearchParams({
        timeMin: now.toISOString(),
        timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "20"
      }).toString(),
    {
      headers: {
        Authorization: `Bearer ${refreshedConnection.accessToken}`
      }
    }
  );

  const calendarBody = (await calendarResponse.json().catch(() => null)) as {
    items?: Array<{
      id?: string;
      summary?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      location?: string;
      hangoutLink?: string;
      attendees?: Array<{ email?: string; displayName?: string }>;
    }>;
    error?: { message?: string };
  } | null;

  if (!calendarResponse.ok) {
    throw new Error(
      calendarBody?.error?.message || "Failed to load Google Calendar events"
    );
  }

  return {
    connected: true as const,
    connectedEmail: refreshedConnection.connectedEmail,
    connectedName: refreshedConnection.connectedName,
    events: (calendarBody?.items ?? [])
      .filter(
        (
          event
        ): event is {
          id: string;
          summary?: string;
          start?: { dateTime?: string; date?: string };
          end?: { dateTime?: string; date?: string };
          location?: string;
          hangoutLink?: string;
          attendees?: Array<{ email?: string; displayName?: string }>;
        } => typeof event?.id === "string"
      )
      .map((event) => ({
        id: event.id ?? "",
        summary: event.summary ?? "Untitled meeting",
        start: {
          ...(event.start?.dateTime ? { dateTime: event.start.dateTime } : {}),
          ...(event.start?.date ? { date: event.start.date } : {})
        },
        end: {
          ...(event.end?.dateTime ? { dateTime: event.end.dateTime } : {}),
          ...(event.end?.date ? { date: event.end.date } : {})
        },
        ...(event.location ? { location: event.location } : {}),
        ...(event.hangoutLink ? { hangoutLink: event.hangoutLink } : {}),
        ...(Array.isArray(event.attendees)
          ? {
              attendees: event.attendees
                .filter(
                  (
                    attendee
                  ): attendee is {
                    email: string;
                    displayName?: string;
                  } => typeof attendee.email === "string"
                )
                .map((attendee: { email: string; displayName?: string }) => ({
                  email: attendee.email,
                  ...(attendee.displayName
                    ? { displayName: attendee.displayName }
                    : {})
                }))
            }
          : {})
      }))
  };
}

export async function disconnectWorkspaceCalendarConnection() {
  await prisma.workspaceCalendarConnection.deleteMany({
    where: { providerKey: "google_calendar" }
  });

  return { success: true };
}

export async function getWorkspaceCalendarStatus() {
  const { connection, clientId, clientSecret } =
    await resolveWorkspaceCalendarOauthConfig();

  return {
    configured: Boolean(clientId && clientSecret),
    connected: Boolean(connection?.enabled && connection.connectedEmail),
    connectedEmail: connection?.connectedEmail ?? null
  };
}

function buildXeroBasicAuth(clientId: string, clientSecret: string) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

async function refreshWorkspaceXeroAccessTokenIfNeeded(
  minimumValidityMs = 5 * 60_000
) {
  const connection = await prisma.workspaceXeroConnection.findFirst({
    orderBy: [{ createdAt: "asc" }]
  });

  if (
    !connection?.enabled ||
    !connection.refreshToken ||
    !connection.clientId ||
    !connection.clientSecret
  ) {
    return null;
  }

  const tokenStillValid =
    connection.accessToken &&
    connection.tokenExpiresAt &&
    connection.tokenExpiresAt.getTime() > Date.now() + minimumValidityMs;

  if (tokenStillValid) {
    return connection;
  }

  const refreshResponse = await fetch(
    "https://identity.xero.com/connect/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${buildXeroBasicAuth(
          connection.clientId,
          connection.clientSecret
        )}`
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: connection.refreshToken
      }).toString()
    }
  );

  const refreshBody = (await refreshResponse.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  } | null;

  if (!refreshResponse.ok || !refreshBody?.access_token) {
    throw new Error(
      refreshBody?.error_description ||
        refreshBody?.error ||
        "Xero token refresh failed"
    );
  }

  return prisma.workspaceXeroConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: refreshBody.access_token,
      refreshToken: refreshBody.refresh_token ?? connection.refreshToken,
      tokenExpiresAt:
        typeof refreshBody.expires_in === "number"
          ? new Date(Date.now() + refreshBody.expires_in * 1000)
          : connection.tokenExpiresAt
    }
  });
}

export async function createWorkspaceXeroOAuthStart() {
  const clientId = process.env.XERO_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.XERO_CLIENT_SECRET?.trim() ?? "";

  if (!clientId || !clientSecret) {
    throw new Error("Xero OAuth credentials are not configured");
  }

  const redirectUri = resolveWorkspaceXeroRedirectUri();
  const scopes = [
    "openid",
    "profile",
    "email",
    "accounting.transactions",
    "accounting.contacts",
    "offline_access"
  ];
  const state = createSignedStateToken({
    providerKey: "xero",
    redirectUri,
    expiresAt: Date.now() + 1000 * 60 * 10
  });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    state
  });

  return {
    authUrl:
      "https://login.xero.com/identity/connect/authorize?" + params.toString()
  };
}

export async function completeWorkspaceXeroOAuthCallback(value: {
  code?: unknown;
  state?: unknown;
}) {
  const code = typeof value.code === "string" ? value.code.trim() : "";
  const state = typeof value.state === "string" ? value.state.trim() : "";

  if (!code || !state) {
    throw new Error("Xero OAuth callback is missing code or state");
  }

  const verifiedState = verifySignedStateToken(state);
  const redirectUri =
    typeof verifiedState.redirectUri === "string"
      ? verifiedState.redirectUri
      : resolveWorkspaceXeroRedirectUri();
  const clientId = process.env.XERO_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.XERO_CLIENT_SECRET?.trim() ?? "";

  if (!clientId || !clientSecret) {
    throw new Error("Xero OAuth credentials are not configured");
  }

  const tokenResponse = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${buildXeroBasicAuth(clientId, clientSecret)}`
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri
    }).toString()
  });

  const tokenBody = (await tokenResponse.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    id_token?: string;
    error?: string;
    error_description?: string;
  } | null;

  if (!tokenResponse.ok || !tokenBody?.access_token) {
    throw new Error(
      tokenBody?.error_description ||
        tokenBody?.error ||
        "Xero token exchange failed"
    );
  }

  const connectionsResponse = await fetch("https://api.xero.com/connections", {
    headers: {
      Authorization: `Bearer ${tokenBody.access_token}`
    }
  });
  const connectionsBody = (await connectionsResponse
    .json()
    .catch(() => null)) as
    | Array<{
        tenantId?: string;
        tenantName?: string;
      }>
    | { Message?: string }
    | null;

  if (
    !connectionsResponse.ok ||
    !Array.isArray(connectionsBody) ||
    !connectionsBody[0]?.tenantId
  ) {
    throw new Error("Could not load the connected Xero tenant");
  }

  let connectedEmail: string | null = null;

  if (typeof tokenBody.id_token === "string") {
    const payload = tokenBody.id_token.split(".")[1];

    if (payload) {
      try {
        const decoded = JSON.parse(
          Buffer.from(payload, "base64url").toString("utf8")
        ) as { email?: string };
        connectedEmail =
          typeof decoded.email === "string" ? decoded.email : null;
      } catch {
        connectedEmail = null;
      }
    }
  }

  const scopes = [
    "openid",
    "profile",
    "email",
    "accounting.transactions",
    "accounting.contacts",
    "offline_access"
  ];
  const existingConnection = await prisma.workspaceXeroConnection.findFirst({
    orderBy: [{ createdAt: "asc" }]
  });
  const connection = existingConnection
    ? await prisma.workspaceXeroConnection.update({
        where: { id: existingConnection.id },
        data: {
          tenantId: connectionsBody[0].tenantId,
          tenantName: connectionsBody[0].tenantName ?? null,
          clientId,
          clientSecret,
          redirectUri,
          scopes,
          accessToken: tokenBody.access_token,
          refreshToken:
            tokenBody.refresh_token ?? existingConnection.refreshToken,
          tokenExpiresAt:
            typeof tokenBody.expires_in === "number"
              ? new Date(Date.now() + tokenBody.expires_in * 1000)
              : null,
          connectedEmail,
          enabled: true
        }
      })
    : await prisma.workspaceXeroConnection.create({
        data: {
          tenantId: connectionsBody[0].tenantId,
          tenantName: connectionsBody[0].tenantName ?? null,
          clientId,
          clientSecret,
          redirectUri,
          scopes,
          accessToken: tokenBody.access_token,
          refreshToken: tokenBody.refresh_token ?? null,
          tokenExpiresAt:
            typeof tokenBody.expires_in === "number"
              ? new Date(Date.now() + tokenBody.expires_in * 1000)
              : null,
          connectedEmail,
          enabled: true
        }
      });

  return serializeWorkspaceXeroConnection(connection);
}

export async function getWorkspaceXeroInvoices() {
  const connection = await prisma.workspaceXeroConnection.findFirst({
    where: { enabled: true },
    orderBy: [{ createdAt: "asc" }]
  });

  if (!connection) {
    return { connected: false as const };
  }

  const refreshedConnection = await refreshWorkspaceXeroAccessTokenIfNeeded(
    5 * 60_000
  );

  if (!refreshedConnection?.accessToken || !refreshedConnection.tenantId) {
    return { connected: false as const };
  }

  const invoicesResponse = await fetch(
    "https://api.xero.com/api.xro/2.0/Invoices?" +
      new URLSearchParams({
        where: 'Status=="AUTHORISED"||Status=="SUBMITTED"',
        order: "DueDate ASC"
      }).toString(),
    {
      headers: {
        Authorization: `Bearer ${refreshedConnection.accessToken}`,
        "Xero-tenant-id": refreshedConnection.tenantId,
        Accept: "application/json"
      }
    }
  );

  const invoicesBody = (await invoicesResponse.json().catch(() => null)) as {
    Invoices?: Array<{
      InvoiceNumber?: string;
      Contact?: { Name?: string };
      DueDate?: string;
      AmountDue?: number;
      Status?: string;
      CurrencyCode?: string;
    }>;
    Message?: string;
  } | null;

  if (!invoicesResponse.ok) {
    throw new Error(invoicesBody?.Message || "Failed to load Xero invoices");
  }

  const now = new Date();
  const invoices = (invoicesBody?.Invoices ?? []).map((invoice) => {
    const dueDate = normalizeDateInput(invoice.DueDate);
    const amountDue = Number(invoice.AmountDue ?? 0);
    return {
      invoiceNumber: invoice.InvoiceNumber ?? "",
      contact: invoice.Contact?.Name ?? "",
      dueDate: dueDate?.toISOString() ?? invoice.DueDate ?? "",
      amountDue,
      status: invoice.Status ?? "",
      isOverdue: Boolean(dueDate && dueDate < now && amountDue > 0)
    };
  });
  const totalOutstanding = invoices.reduce(
    (sum, invoice) => sum + invoice.amountDue,
    0
  );
  const totalOverdue = invoices
    .filter((invoice) => invoice.isOverdue)
    .reduce((sum, invoice) => sum + invoice.amountDue, 0);

  return {
    connected: true as const,
    tenantName: refreshedConnection.tenantName,
    summary: {
      totalOutstanding,
      totalOverdue,
      currency: invoicesBody?.Invoices?.[0]?.CurrencyCode ?? "NZD",
      invoices
    }
  };
}

export async function disconnectWorkspaceXeroConnection() {
  await prisma.workspaceXeroConnection.deleteMany({});
  return { success: true };
}

export async function getWorkspaceXeroStatus() {
  const connection = await prisma.workspaceXeroConnection.findFirst({
    orderBy: [{ createdAt: "asc" }]
  });

  return {
    configured: Boolean(
      process.env.XERO_CLIENT_ID?.trim() &&
      process.env.XERO_CLIENT_SECRET?.trim()
    ),
    connected: Boolean(connection?.enabled && connection.tenantId),
    tenantName: connection?.tenantName ?? null
  };
}

export async function getActiveProjects(options?: { take?: number }) {
  const projects = await prisma.project.findMany({
    where: {
      status: {
        in: ["scoping", "designed", "ready-for-execution", "in-flight", "draft"]
      }
    },
    include: {
      client: { select: { id: true, name: true } },
      portal: { select: { id: true, displayName: true } },
      _count: {
        select: {
          tasks: {
            where: {
              status: { not: "done" }
            }
          }
        }
      }
    },
    orderBy: { updatedAt: "desc" },
    ...(options?.take ? { take: options.take } : { take: 10 })
  });

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    status: project.status,
    engagementType: project.engagementType,
    client: project.client,
    portal: project.portal,
    openTaskCount: project._count.tasks
  }));
}

export async function getQuotesPipeline() {
  const quotes = await prisma.projectQuote.findMany({
    where: { status: { in: ["shared", "pending"] } },
    include: {
      project: {
        select: {
          name: true,
          client: { select: { name: true } }
        }
      }
    },
    orderBy: { sharedAt: "desc" }
  });

  return quotes.map((quote) => ({
    id: quote.id,
    projectId: quote.projectId,
    projectName: quote.project.name,
    clientName: quote.project.client?.name ?? "",
    version: quote.version,
    status: quote.status,
    totals: quote.totals as Prisma.Prisma.JsonObject,
    sharedAt: quote.sharedAt.toISOString(),
    currency: quote.currency
  }));
}

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T) {
  return result.status === "fulfilled" ? result.value : fallback;
}

function selectSummaryCalendarEvents(
  payload: Awaited<ReturnType<typeof getCalendarEvents>>
) {
  if (!payload.connected) {
    return payload;
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfTomorrow = new Date(startOfToday);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 2);

  return {
    connected: true as const,
    events: payload.events.filter((event) => {
      const start = normalizeDateInput(
        event.start.dateTime ?? event.start.date
      );
      return Boolean(start && start >= startOfToday && start < endOfTomorrow);
    })
  };
}

function stringifyPromptData(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export async function generateWorkspaceDailySummary() {
  const [todos, emails, calendarEvents, projects, quotes] =
    await Promise.allSettled([
      prisma.workspaceTodo.findMany({
        where: { completed: false },
        orderBy: { sortOrder: "asc" },
        take: 20
      }),
      getGmailActionRequired(),
      getCalendarEvents(),
      getActiveProjects({ take: 5 }),
      getQuotesPipeline()
    ]);

  const routing =
    (await prisma.workspaceAiRouting.findFirst({
      where: { workflowKey: "daily_summary" }
    })) ??
    (await prisma.workspaceProviderConnection.findFirst({
      where: { isEnabled: true }
    }));

  if (!routing) {
    throw new Error("No AI provider configured");
  }

  const provider =
    "workflowKey" in routing
      ? await prisma.workspaceProviderConnection.findUnique({
          where: { providerKey: routing.providerKey }
        })
      : routing;

  if (!provider) {
    throw new Error("No AI provider configured");
  }

  const apiKey = await getProviderApiKey(provider.providerKey, provider.apiKey);
  const model =
    "workflowKey" in routing
      ? routing.modelOverride?.trim() || provider.defaultModel?.trim() || null
      : provider.defaultModel?.trim() || null;

  if (!apiKey || !model) {
    throw new Error("No AI provider configured");
  }

  const prompt = `You are a sharp executive assistant. Generate a concise daily briefing for Jarrud, owner of Muloo (a HubSpot implementation and RevOps agency).

DATA:
- Open todos: ${stringifyPromptData(
    settledValue(
      todos,
      [] as Array<{
        title: string;
        notes: string | null;
        sortOrder: number;
      }>
    )
  )}
- Emails needing action (top 5): ${stringifyPromptData(
    (() => {
      const emailPayload = settledValue(emails, {
        connected: false as const
      } as Awaited<ReturnType<typeof getGmailActionRequired>>);

      return emailPayload.connected
        ? { connected: true, emails: emailPayload.emails.slice(0, 5) }
        : emailPayload;
    })()
  )}
- Calendar events today and tomorrow: ${stringifyPromptData(
    selectSummaryCalendarEvents(
      settledValue(calendarEvents, { connected: false as const } as Awaited<
        ReturnType<typeof getCalendarEvents>
      >)
    )
  )}
- Active projects (top 5): ${stringifyPromptData(
    settledValue(projects, [] as Awaited<ReturnType<typeof getActiveProjects>>)
  )}
- Quotes awaiting approval: ${stringifyPromptData(
    settledValue(quotes, [] as Awaited<ReturnType<typeof getQuotesPipeline>>)
  )}

INSTRUCTIONS:
Be direct. Flag anything urgent. Format as clean markdown with clear sections. Use ## headings for each section. No fluff. No preamble. Start with the most time-sensitive items.`;

  let aiResponse = "";

  if (provider.providerKey === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const body = (await response.json().catch(() => null)) as {
      content?: Array<{ text?: string }>;
      error?: { message?: string };
    } | null;

    if (!response.ok || !body?.content?.[0]?.text) {
      throw new Error(
        body?.error?.message || "Anthropic daily summary generation failed"
      );
    }

    aiResponse = body.content[0].text;
  } else if (provider.providerKey === "openai") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const body = (await response.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    } | null;

    if (!response.ok || !body?.choices?.[0]?.message?.content) {
      throw new Error(
        body?.error?.message || "OpenAI daily summary generation failed"
      );
    }

    aiResponse = body.choices[0].message.content;
  } else {
    throw new Error("Daily summary currently supports OpenAI or Anthropic");
  }

  const summary = await prisma.workspaceDailySummary.create({
    data: {
      content: aiResponse,
      generatedBy: provider.providerKey,
      summaryDate: new Date()
    }
  });

  return {
    content: summary.content,
    generatedBy: summary.generatedBy,
    createdAt: summary.createdAt.toISOString()
  };
}

export async function getLatestWorkspaceDailySummary() {
  const summary = await prisma.workspaceDailySummary.findFirst({
    orderBy: { createdAt: "desc" }
  });

  return summary ? serializeWorkspaceDailySummary(summary) : { content: null };
}

export async function getWorkspaceAiRouting(workflowKey: string) {
  const route = await prisma.workspaceAiRouting.findFirst({
    where: { workflowKey }
  });

  if (!route) {
    return null;
  }

  return {
    ...serializeWorkspaceAiRouting(route),
    model: route.modelOverride
  };
}

export async function saveWorkspaceAiRouting(
  workflowKey: string,
  value: {
    providerKey?: unknown;
    model?: unknown;
  }
) {
  if (
    typeof value.providerKey !== "string" ||
    value.providerKey.trim().length === 0
  ) {
    throw new Error("providerKey must be a non-empty string");
  }

  const providerKey = value.providerKey.trim();
  const provider = await prisma.workspaceProviderConnection.findUnique({
    where: { providerKey }
  });

  if (!provider) {
    throw new Error("Provider connection not found");
  }

  const modelInput = typeof value.model === "string" ? value.model.trim() : "";
  const model = modelInput || provider.defaultModel?.trim() || "";

  if (!model) {
    throw new Error("model must be provided");
  }

  const route = await prisma.workspaceAiRouting.upsert({
    where: { workflowKey },
    update: {
      providerKey,
      modelOverride: model
    },
    create: {
      workflowKey,
      label: formatWorkflowLabel(workflowKey),
      providerKey,
      modelOverride: model
    }
  });

  return {
    ...serializeWorkspaceAiRouting(route),
    model: route.modelOverride
  };
}

export async function loadDeliveryTemplates() {
  await ensureDeliveryTemplatesSeeded();

  const templates = await prisma.deliveryTemplate.findMany({
    include: {
      tasks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });

  return templates.map((template) => serializeDeliveryTemplate(template));
}

export async function loadWorkRequests(filters?: {
  projectIds?: string[];
  contactEmail?: string;
  requestType?: string;
}) {
  const requests = await prisma.workRequest.findMany({
    where: {
      ...(filters?.requestType ? { requestType: filters.requestType } : {}),
      ...(filters?.projectIds?.length
        ? {
            OR: [
              { projectId: { in: filters.projectIds } },
              ...(filters.contactEmail
                ? [{ contactEmail: filters.contactEmail }]
                : [])
            ]
          }
        : filters?.contactEmail
          ? { contactEmail: filters.contactEmail }
          : {})
    },
    include: {
      project: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: [{ createdAt: "desc" }]
  });

  return requests.map((request) => serializeWorkRequest(request));
}

export async function loadProjectChangeRequests(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true }
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const workRequests = await loadWorkRequests({
    projectIds: [projectId],
    requestType: "change_request"
  });

  return {
    project,
    workRequests
  };
}

export async function createProductCatalogItem(value: {
  name?: unknown;
  serviceFamily?: unknown;
  category?: unknown;
  billingModel?: unknown;
  description?: unknown;
  unitPrice?: unknown;
  defaultQuantity?: unknown;
  unitLabel?: unknown;
  isActive?: unknown;
  sortOrder?: unknown;
}) {
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const serviceFamily =
    typeof value.serviceFamily === "string" ? value.serviceFamily.trim() : "";
  const category =
    typeof value.category === "string" ? value.category.trim() : "";
  const billingModel =
    typeof value.billingModel === "string" ? value.billingModel.trim() : "";
  const description =
    typeof value.description === "string" ? value.description.trim() : "";
  const unitLabel =
    typeof value.unitLabel === "string" ? value.unitLabel.trim() : "";
  const unitPrice =
    typeof value.unitPrice === "number"
      ? value.unitPrice
      : Number(value.unitPrice);
  const defaultQuantity =
    typeof value.defaultQuantity === "number"
      ? value.defaultQuantity
      : Number(value.defaultQuantity);
  const sortOrder =
    typeof value.sortOrder === "number"
      ? value.sortOrder
      : Number(value.sortOrder);

  if (
    serviceFamily &&
    !serviceFamilyOptions.includes(
      serviceFamily as (typeof serviceFamilyOptions)[number]
    )
  ) {
    throw new Error("Invalid serviceFamily");
  }

  if (!name || !category || !billingModel || !Number.isFinite(unitPrice)) {
    throw new Error(
      "name, category, billingModel, and a valid unitPrice are required"
    );
  }

  const product = await prisma.productCatalogItem.create({
    data: {
      slug: createSlug(name),
      name,
      serviceFamily: serviceFamily || "hubspot_architecture",
      category,
      billingModel,
      description: description || null,
      unitPrice,
      defaultQuantity:
        Number.isFinite(defaultQuantity) && defaultQuantity > 0
          ? Math.round(defaultQuantity)
          : 1,
      unitLabel: unitLabel || "item",
      isActive: value.isActive === false ? false : true,
      sortOrder: Number.isFinite(sortOrder) ? Math.round(sortOrder) : 999
    }
  });

  return serializeProductCatalogItem(product);
}

export async function createAgentDefinition(value: {
  name?: unknown;
  purpose?: unknown;
  serviceFamily?: unknown;
  provider?: unknown;
  model?: unknown;
  triggerType?: unknown;
  approvalMode?: unknown;
  allowedActions?: unknown;
  systemPrompt?: unknown;
  isActive?: unknown;
  sortOrder?: unknown;
}) {
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const purpose = typeof value.purpose === "string" ? value.purpose.trim() : "";
  const serviceFamily =
    typeof value.serviceFamily === "string"
      ? value.serviceFamily.trim()
      : "hubspot_architecture";
  const provider =
    typeof value.provider === "string" ? value.provider.trim() : "";
  const model = typeof value.model === "string" ? value.model.trim() : "";
  const triggerType =
    typeof value.triggerType === "string" ? value.triggerType.trim() : "manual";
  const approvalMode =
    typeof value.approvalMode === "string"
      ? value.approvalMode.trim()
      : "review_required";
  const systemPrompt =
    typeof value.systemPrompt === "string" ? value.systemPrompt.trim() : "";
  const allowedActions = Array.isArray(value.allowedActions)
    ? value.allowedActions
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const sortOrder =
    typeof value.sortOrder === "number"
      ? value.sortOrder
      : Number(value.sortOrder);

  if (!name || !purpose || !provider || !model) {
    throw new Error("name, purpose, provider, and model are required");
  }

  if (
    !serviceFamilyOptions.includes(
      serviceFamily as (typeof serviceFamilyOptions)[number]
    )
  ) {
    throw new Error("serviceFamily must be a valid service family");
  }

  const agent = await prisma.agentDefinition.create({
    data: {
      slug: createSlug(name),
      name,
      purpose,
      serviceFamily,
      provider,
      model,
      triggerType,
      approvalMode,
      allowedActions,
      systemPrompt: systemPrompt || null,
      isActive: value.isActive === false ? false : true,
      sortOrder: Number.isFinite(sortOrder) ? Math.round(sortOrder) : 999
    }
  });

  return serializeAgentDefinition(agent);
}

export async function createDeliveryTemplate(value: {
  name?: unknown;
  description?: unknown;
  serviceFamily?: unknown;
  category?: unknown;
  scopeType?: unknown;
  recommendedHubs?: unknown;
  defaultPlannedHours?: unknown;
  isActive?: unknown;
  sortOrder?: unknown;
  tasks?: unknown;
}) {
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const description =
    typeof value.description === "string" ? value.description.trim() : "";
  const serviceFamily =
    typeof value.serviceFamily === "string" ? value.serviceFamily.trim() : "";
  const category =
    typeof value.category === "string" ? value.category.trim() : "";
  const scopeType =
    typeof value.scopeType === "string" ? value.scopeType.trim() : "";
  const defaultPlannedHours =
    typeof value.defaultPlannedHours === "number"
      ? value.defaultPlannedHours
      : Number(value.defaultPlannedHours);
  const sortOrder =
    typeof value.sortOrder === "number"
      ? value.sortOrder
      : Number(value.sortOrder);
  const recommendedHubs = normalizeStringArray(value.recommendedHubs);
  const tasks = Array.isArray(value.tasks) ? value.tasks : [];

  if (
    serviceFamily &&
    !serviceFamilyOptions.includes(
      serviceFamily as (typeof serviceFamilyOptions)[number]
    )
  ) {
    throw new Error("Invalid serviceFamily");
  }

  if (!name || !category || !scopeType) {
    throw new Error("name, category, and scopeType are required");
  }

  const template = await prisma.deliveryTemplate.create({
    data: {
      slug: createSlug(name),
      name,
      description: description || null,
      serviceFamily: serviceFamily || "hubspot_architecture",
      category,
      scopeType,
      recommendedHubs,
      defaultPlannedHours: Number.isFinite(defaultPlannedHours)
        ? defaultPlannedHours
        : null,
      isActive: value.isActive === false ? false : true,
      sortOrder: Number.isFinite(sortOrder) ? Math.round(sortOrder) : 999,
      tasks: {
        create: tasks
          .filter(
            (task): task is Record<string, unknown> =>
              Boolean(task) && typeof task === "object"
          )
          .map((task, index) => ({
            title: normalizeRequiredTaskString(task.title, "task title"),
            description: normalizeOptionalTaskString(task.description),
            category: normalizeOptionalTaskString(task.category),
            executionType:
              normalizeOptionalTaskString(task.executionType) ?? "manual",
            priority:
              typeof task.priority === "string" && task.priority.trim()
                ? task.priority.trim().toLowerCase()
                : "medium",
            status:
              typeof task.status === "string" && task.status.trim()
                ? task.status.trim()
                : "todo",
            qaRequired: Boolean(task.qaRequired),
            approvalRequired: Boolean(task.approvalRequired),
            assigneeType: normalizeOptionalTaskString(task.assigneeType),
            plannedHours:
              typeof task.plannedHours === "number"
                ? task.plannedHours
                : Number(task.plannedHours),
            sortOrder:
              typeof task.sortOrder === "number"
                ? Math.round(task.sortOrder)
                : index + 1
          }))
      }
    },
    include: {
      tasks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  return serializeDeliveryTemplate(template);
}

export async function updateDeliveryTemplate(
  templateId: string,
  value: {
    name?: unknown;
    description?: unknown;
    serviceFamily?: unknown;
    category?: unknown;
    scopeType?: unknown;
    recommendedHubs?: unknown;
    defaultPlannedHours?: unknown;
    isActive?: unknown;
    sortOrder?: unknown;
    tasks?: unknown;
  }
) {
  const updateData: Prisma.Prisma.DeliveryTemplateUpdateInput = {};

  if (value.name !== undefined) {
    if (typeof value.name !== "string" || value.name.trim().length === 0) {
      throw new Error("name must be a non-empty string");
    }

    updateData.name = value.name.trim();
    updateData.slug = createSlug(value.name.trim());
  }

  if (value.description !== undefined) {
    if (typeof value.description !== "string") {
      throw new Error("description must be a string");
    }

    updateData.description = value.description.trim() || null;
  }

  if (value.serviceFamily !== undefined) {
    if (
      typeof value.serviceFamily !== "string" ||
      !serviceFamilyOptions.includes(
        value.serviceFamily.trim() as (typeof serviceFamilyOptions)[number]
      )
    ) {
      throw new Error("serviceFamily must be a valid service family");
    }

    updateData.serviceFamily = value.serviceFamily.trim();
  }

  if (value.category !== undefined) {
    if (
      typeof value.category !== "string" ||
      value.category.trim().length === 0
    ) {
      throw new Error("category must be a non-empty string");
    }

    updateData.category = value.category.trim();
  }

  if (value.scopeType !== undefined) {
    if (
      typeof value.scopeType !== "string" ||
      value.scopeType.trim().length === 0
    ) {
      throw new Error("scopeType must be a non-empty string");
    }

    updateData.scopeType = value.scopeType.trim();
  }

  if (value.recommendedHubs !== undefined) {
    updateData.recommendedHubs = normalizeStringArray(value.recommendedHubs);
  }

  if (value.defaultPlannedHours !== undefined) {
    const defaultPlannedHours =
      typeof value.defaultPlannedHours === "number"
        ? value.defaultPlannedHours
        : Number(value.defaultPlannedHours);
    updateData.defaultPlannedHours = Number.isFinite(defaultPlannedHours)
      ? defaultPlannedHours
      : null;
  }

  if (value.isActive !== undefined) {
    updateData.isActive = Boolean(value.isActive);
  }

  if (value.sortOrder !== undefined) {
    const sortOrder =
      typeof value.sortOrder === "number"
        ? value.sortOrder
        : Number(value.sortOrder);

    if (!Number.isFinite(sortOrder)) {
      throw new Error("sortOrder must be a valid number");
    }

    updateData.sortOrder = Math.round(sortOrder);
  }

  await prisma.deliveryTemplate.update({
    where: { id: templateId },
    data: updateData
  });

  if (value.tasks !== undefined) {
    if (!Array.isArray(value.tasks)) {
      throw new Error("tasks must be an array");
    }

    await prisma.deliveryTemplateTask.deleteMany({
      where: { templateId }
    });

    if (value.tasks.length > 0) {
      await prisma.deliveryTemplateTask.createMany({
        data: value.tasks
          .filter(
            (task): task is Record<string, unknown> =>
              Boolean(task) && typeof task === "object"
          )
          .map((task, index) => ({
            templateId,
            title: normalizeRequiredTaskString(task.title, "task title"),
            description: normalizeOptionalTaskString(task.description),
            category: normalizeOptionalTaskString(task.category),
            executionType:
              normalizeOptionalTaskString(task.executionType) ?? "manual",
            priority:
              typeof task.priority === "string" && task.priority.trim()
                ? task.priority.trim().toLowerCase()
                : "medium",
            status:
              typeof task.status === "string" && task.status.trim()
                ? task.status.trim()
                : "todo",
            qaRequired: Boolean(task.qaRequired),
            approvalRequired: Boolean(task.approvalRequired),
            assigneeType: normalizeOptionalTaskString(task.assigneeType),
            plannedHours:
              typeof task.plannedHours === "number"
                ? task.plannedHours
                : Number(task.plannedHours),
            sortOrder:
              typeof task.sortOrder === "number"
                ? Math.round(task.sortOrder)
                : index + 1
          }))
      });
    }
  }

  const template = await prisma.deliveryTemplate.findUniqueOrThrow({
    where: { id: templateId },
    include: {
      tasks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  return serializeDeliveryTemplate(template);
}

export async function createWorkRequest(value: {
  projectId?: unknown;
  title?: unknown;
  serviceFamily?: unknown;
  requestType?: unknown;
  companyName?: unknown;
  contactName?: unknown;
  contactEmail?: unknown;
  summary?: unknown;
  details?: unknown;
  urgency?: unknown;
  budgetRange?: unknown;
  portalOrWebsite?: unknown;
  links?: unknown;
  internalNotes?: unknown;
  commercialImpactHours?: unknown;
  commercialImpactFeeZar?: unknown;
  deliveryTasks?: unknown;
  approvedByName?: unknown;
  status?: unknown;
}) {
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const requestType =
    typeof value.requestType === "string" ? value.requestType.trim() : "";
  const serviceFamily =
    typeof value.serviceFamily === "string" ? value.serviceFamily.trim() : "";
  const companyName =
    typeof value.companyName === "string" ? value.companyName.trim() : "";
  const contactName =
    typeof value.contactName === "string" ? value.contactName.trim() : "";
  const contactEmail =
    typeof value.contactEmail === "string"
      ? value.contactEmail.trim().toLowerCase()
      : "";
  const summary = typeof value.summary === "string" ? value.summary.trim() : "";
  const details = typeof value.details === "string" ? value.details.trim() : "";
  const urgency = typeof value.urgency === "string" ? value.urgency.trim() : "";
  const budgetRange =
    typeof value.budgetRange === "string" ? value.budgetRange.trim() : "";
  const portalOrWebsite =
    typeof value.portalOrWebsite === "string"
      ? value.portalOrWebsite.trim()
      : "";
  const links = normalizeStringArray(value.links);
  const internalNotes =
    typeof value.internalNotes === "string" ? value.internalNotes.trim() : "";
  const approvedByName =
    typeof value.approvedByName === "string" ? value.approvedByName.trim() : "";
  const commercialImpactHours =
    typeof value.commercialImpactHours === "number"
      ? value.commercialImpactHours
      : Number(value.commercialImpactHours);
  const commercialImpactFeeZar =
    typeof value.commercialImpactFeeZar === "number"
      ? value.commercialImpactFeeZar
      : Number(value.commercialImpactFeeZar);
  const deliveryTasks = normalizeChangeDeliveryTasks(value.deliveryTasks);
  const requestedStatus =
    typeof value.status === "string" ? value.status.trim() : "";

  if (!title || !contactName || !contactEmail || !summary) {
    throw new Error(
      "title, contactName, contactEmail, and summary are required"
    );
  }

  if (
    serviceFamily &&
    !serviceFamilyOptions.includes(
      serviceFamily as (typeof serviceFamilyOptions)[number]
    )
  ) {
    throw new Error("Invalid serviceFamily");
  }

  if (
    requestType &&
    !workRequestTypeOptions.includes(
      requestType as (typeof workRequestTypeOptions)[number]
    )
  ) {
    throw new Error("Invalid requestType");
  }

  if (
    requestedStatus &&
    requestType === "change_request" &&
    !changeRequestStatusOptions.includes(
      requestedStatus as (typeof changeRequestStatusOptions)[number]
    )
  ) {
    throw new Error("Invalid change request status");
  }

  const request = await prisma.workRequest.create({
    data: {
      projectId:
        typeof value.projectId === "string" && value.projectId.trim()
          ? value.projectId.trim()
          : null,
      title,
      serviceFamily: serviceFamily || "hubspot_architecture",
      requestType: requestType || "job_spec",
      companyName: companyName || null,
      contactName,
      contactEmail,
      summary,
      details: details || null,
      urgency: urgency || null,
      budgetRange: budgetRange || null,
      portalOrWebsite: portalOrWebsite || null,
      internalNotes: internalNotes || null,
      commercialImpactHours:
        Number.isFinite(commercialImpactHours) && commercialImpactHours >= 0
          ? commercialImpactHours
          : null,
      commercialImpactFeeZar:
        Number.isFinite(commercialImpactFeeZar) && commercialImpactFeeZar >= 0
          ? commercialImpactFeeZar
          : null,
      deliveryTasks,
      reviewedAt:
        requestedStatus === "under_review" ||
        requestedStatus === "priced" ||
        requestedStatus === "approved" ||
        requestedStatus === "rejected" ||
        requestedStatus === "appended_to_delivery"
          ? new Date()
          : null,
      approvedAt:
        requestedStatus === "approved" ||
        requestedStatus === "appended_to_delivery"
          ? new Date()
          : null,
      approvedByName:
        requestedStatus === "approved" ||
        requestedStatus === "appended_to_delivery"
          ? approvedByName || "Muloo"
          : null,
      rejectedAt: requestedStatus === "rejected" ? new Date() : null,
      deliveryAppendedAt:
        requestedStatus === "appended_to_delivery" ? new Date() : null,
      links,
      status:
        requestType === "change_request" && requestedStatus
          ? requestedStatus
          : "new"
    },
    include: {
      project: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  return serializeWorkRequest(request);
}

export async function updateWorkRequest(
  requestId: string,
  value: {
    status?: unknown;
    title?: unknown;
    summary?: unknown;
    details?: unknown;
    internalNotes?: unknown;
    commercialImpactHours?: unknown;
    commercialImpactFeeZar?: unknown;
    deliveryTasks?: unknown;
    approvedByName?: unknown;
  }
) {
  const existingRequest = await prisma.workRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      requestType: true,
      status: true,
      reviewedAt: true,
      approvedAt: true,
      approvedByName: true,
      rejectedAt: true,
      deliveryAppendedAt: true
    }
  });

  if (!existingRequest) {
    throw new Error("Work request not found");
  }

  const updateData: Prisma.Prisma.WorkRequestUpdateInput = {};

  if (value.status !== undefined) {
    if (typeof value.status !== "string" || value.status.trim().length === 0) {
      throw new Error("status must be a non-empty string");
    }

    const nextStatus = value.status.trim();

    if (
      existingRequest.requestType === "change_request" &&
      !changeRequestStatusOptions.includes(
        nextStatus as (typeof changeRequestStatusOptions)[number]
      )
    ) {
      throw new Error("Invalid change request status");
    }

    updateData.status = nextStatus;

    if (
      existingRequest.requestType === "change_request" &&
      [
        "under_review",
        "priced",
        "approved",
        "rejected",
        "appended_to_delivery",
        "closed"
      ].includes(nextStatus)
    ) {
      updateData.reviewedAt = existingRequest.reviewedAt ?? new Date();
    }

    if (
      existingRequest.requestType === "change_request" &&
      (nextStatus === "approved" || nextStatus === "appended_to_delivery")
    ) {
      updateData.approvedAt = existingRequest.approvedAt ?? new Date();
      updateData.approvedByName =
        typeof value.approvedByName === "string" && value.approvedByName.trim()
          ? value.approvedByName.trim()
          : (existingRequest.approvedByName ?? "Muloo");
    }

    if (
      existingRequest.requestType === "change_request" &&
      nextStatus === "rejected"
    ) {
      updateData.rejectedAt = existingRequest.rejectedAt ?? new Date();
    }

    if (
      existingRequest.requestType === "change_request" &&
      nextStatus === "appended_to_delivery"
    ) {
      updateData.deliveryAppendedAt =
        existingRequest.deliveryAppendedAt ?? new Date();
    }
  }

  if (value.title !== undefined) {
    if (typeof value.title !== "string" || value.title.trim().length === 0) {
      throw new Error("title must be a non-empty string");
    }

    updateData.title = value.title.trim();
  }

  if (value.summary !== undefined) {
    if (
      typeof value.summary !== "string" ||
      value.summary.trim().length === 0
    ) {
      throw new Error("summary must be a non-empty string");
    }

    updateData.summary = value.summary.trim();
  }

  if (value.details !== undefined) {
    if (value.details !== null && typeof value.details !== "string") {
      throw new Error("details must be a string or null");
    }

    updateData.details =
      typeof value.details === "string" ? value.details.trim() || null : null;
  }

  if (value.internalNotes !== undefined) {
    if (
      value.internalNotes !== null &&
      typeof value.internalNotes !== "string"
    ) {
      throw new Error("internalNotes must be a string or null");
    }

    updateData.internalNotes =
      typeof value.internalNotes === "string"
        ? value.internalNotes.trim() || null
        : null;
  }

  if (value.commercialImpactHours !== undefined) {
    if (
      value.commercialImpactHours === null ||
      value.commercialImpactHours === ""
    ) {
      updateData.commercialImpactHours = null;
    } else {
      const commercialImpactHours =
        typeof value.commercialImpactHours === "number"
          ? value.commercialImpactHours
          : Number(value.commercialImpactHours);

      if (
        !Number.isFinite(commercialImpactHours) ||
        commercialImpactHours < 0
      ) {
        throw new Error(
          "commercialImpactHours must be a valid non-negative number"
        );
      }

      updateData.commercialImpactHours = commercialImpactHours;
    }
  }

  if (value.commercialImpactFeeZar !== undefined) {
    if (
      value.commercialImpactFeeZar === null ||
      value.commercialImpactFeeZar === ""
    ) {
      updateData.commercialImpactFeeZar = null;
    } else {
      const commercialImpactFeeZar =
        typeof value.commercialImpactFeeZar === "number"
          ? value.commercialImpactFeeZar
          : Number(value.commercialImpactFeeZar);

      if (
        !Number.isFinite(commercialImpactFeeZar) ||
        commercialImpactFeeZar < 0
      ) {
        throw new Error(
          "commercialImpactFeeZar must be a valid non-negative number"
        );
      }

      updateData.commercialImpactFeeZar = commercialImpactFeeZar;
    }
  }

  if (value.deliveryTasks !== undefined) {
    updateData.deliveryTasks = normalizeChangeDeliveryTasks(
      value.deliveryTasks
    );
  }

  if (value.approvedByName !== undefined) {
    if (
      value.approvedByName !== null &&
      typeof value.approvedByName !== "string"
    ) {
      throw new Error("approvedByName must be a string or null");
    }

    updateData.approvedByName =
      typeof value.approvedByName === "string"
        ? value.approvedByName.trim() || null
        : null;
  }

  const request = await prisma.workRequest.update({
    where: { id: requestId },
    data: updateData,
    include: {
      project: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  return serializeWorkRequest(request);
}

export async function appendApprovedChangeRequestToDelivery(requestId: string) {
  const workRequest = await prisma.workRequest.findUnique({
    where: { id: requestId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          serviceFamily: true,
          quoteApprovalStatus: true,
          scopeLockedAt: true
        }
      }
    }
  });

  if (!workRequest) {
    throw new Error("Change request not found");
  }

  if (workRequest.requestType !== "change_request") {
    throw new Error("Only change requests can be appended to delivery");
  }

  if (!workRequest.projectId || !workRequest.project) {
    throw new Error("Change request is not linked to a project");
  }

  if (!isProjectScopeLocked(workRequest.project)) {
    throw new Error(
      "Approve and lock the project scope before appending change work"
    );
  }

  if (!["approved", "appended_to_delivery"].includes(workRequest.status)) {
    throw new Error(
      "Approve the change request before pushing it into delivery"
    );
  }

  if (workRequest.deliveryAppendedAt) {
    throw new Error(
      "This change request has already been appended to delivery"
    );
  }

  const plannedTasks = normalizeChangeDeliveryTasks(workRequest.deliveryTasks);
  const availableAgents = await loadPreferredAgentIdsByServiceFamily(
    workRequest.project.serviceFamily
  );

  if (plannedTasks.length === 0) {
    throw new Error(
      "Add at least one delivery task before appending this change"
    );
  }

  const createdTasks = [] as Awaited<ReturnType<typeof prisma.task.create>>[];

  for (const plannedTask of plannedTasks) {
    const task = await prisma.task.create({
      data: {
        projectId: workRequest.projectId,
        changeRequestId: workRequest.id,
        scopeOrigin: "change_request",
        title: plannedTask.title,
        description: plannedTask.description || null,
        category: plannedTask.category || "Approved change request",
        executionType: plannedTask.executionType,
        priority: plannedTask.priority,
        status:
          plannedTask.assigneeType === "Client" ? "waiting_on_client" : "todo",
        plannedHours: plannedTask.plannedHours,
        actualHours: 0,
        qaRequired: plannedTask.qaRequired,
        approvalRequired: plannedTask.approvalRequired,
        assigneeType: plannedTask.assigneeType,
        assignedAgentId:
          plannedTask.assigneeType === "Agent"
            ? pickAgentForTask(availableAgents, {
                title: plannedTask.title,
                description: plannedTask.description,
                category: plannedTask.category,
                executionType: plannedTask.executionType,
                assigneeType: plannedTask.assigneeType
              })
            : null,
        executionReadiness:
          plannedTask.assigneeType === "Agent"
            ? "ready_with_review"
            : "not_ready"
      },
      include: {
        assignedAgent: { select: { name: true } }
      }
    });

    createdTasks.push(task);
  }

  const updatedRequest = await prisma.workRequest.update({
    where: { id: workRequest.id },
    data: {
      status: "appended_to_delivery",
      reviewedAt: workRequest.reviewedAt ?? new Date(),
      approvedAt: workRequest.approvedAt ?? new Date(),
      approvedByName: workRequest.approvedByName ?? "Muloo",
      deliveryAppendedAt: new Date()
    },
    include: {
      project: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  await createProjectMessage({
    projectId: workRequest.projectId,
    senderType: "internal",
    senderName: "Muloo",
    body: `Approved change request "${workRequest.title}" was appended to the delivery board with ${createdTasks.length} new task${createdTasks.length === 1 ? "" : "s"}.`
  });

  return {
    workRequest: serializeWorkRequest(updatedRequest),
    tasks: createdTasks.map((task) => serializeTask(task))
  };
}

export async function loadClientsDirectory() {
  const [clients, projects] = await Promise.all([
    prisma.client.findMany({
      include: {
        hubSpotPortal: true,
        parentClient: {
          select: {
            id: true,
            name: true
          }
        },
        childClients: {
          select: {
            id: true,
            name: true
          },
          orderBy: [{ name: "asc" }]
        },
        visibleToPartners: {
          include: {
            partnerClient: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        visibleClients: {
          include: {
            client: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        contacts: {
          orderBy: [{ canApproveQuotes: "desc" }, { firstName: "asc" }]
        }
      },
      orderBy: [{ updatedAt: "desc" }]
    }),
    prisma.project.findMany({
      include: {
        client: true,
        portal: true,
        clientAccess: {
          include: {
            user: true
          }
        }
      },
      orderBy: [{ updatedAt: "desc" }]
    })
  ]);

  return clients.map((client) => {
    const contactEmails = new Set(
      client.contacts
        .map((contact) => contact.email.trim().toLowerCase())
        .filter(Boolean)
    );
    const visibleClientIds = new Set(
      client.visibleClients.map((record) => record.client.id)
    );

    const linkedProjects = projects.filter((project) => {
      if (project.clientId === client.id) {
        return true;
      }

      if (visibleClientIds.has(project.clientId)) {
        return true;
      }

      if (
        project.clientChampionEmail &&
        contactEmails.has(project.clientChampionEmail.trim().toLowerCase())
      ) {
        return true;
      }

      return project.clientAccess.some((accessRecord) =>
        contactEmails.has(accessRecord.user.email.trim().toLowerCase())
      );
    });

    return {
      ...serializeClientDirectoryRecord(client),
      contacts: client.contacts.map((contact) => ({
        ...serializeClientContact(contact),
        portalAssignments: linkedProjects.flatMap((project) =>
          project.clientAccess
            .filter(
              (accessRecord) =>
                accessRecord.user.email.trim().toLowerCase() ===
                contact.email.trim().toLowerCase()
            )
            .map((accessRecord) => ({
              projectId: project.id,
              projectName: project.name,
              role: accessRecord.role,
              questionnaireAccess: accessRecord.questionnaireAccess,
              authStatus: accessRecord.user.inviteAcceptedAt
                ? "active"
                : "invite_pending"
            }))
        )
      })),
      projects: linkedProjects.map((project) => ({
        id: project.id,
        name: project.name,
        status: project.status,
        quoteApprovalStatus: project.quoteApprovalStatus ?? "draft",
        scopeType: project.scopeType ?? "discovery",
        updatedAt: project.updatedAt.toISOString()
      }))
    };
  });
}

async function syncPartnerVisibilityLinks(
  clientId: string,
  partnerClientIds: string[]
) {
  await prisma.partnerClientVisibility.deleteMany({
    where: { clientId }
  });

  if (partnerClientIds.length === 0) {
    return;
  }

  await prisma.partnerClientVisibility.createMany({
    data: partnerClientIds.map((partnerClientId) => ({
      partnerClientId,
      clientId
    }))
  });
}

export async function createClientDirectoryRecord(value: {
  name?: string;
  website?: string;
  logoUrl?: string;
  industry?: string;
  region?: string;
  hubSpotPortalId?: string;
  additionalWebsites?: string[];
  linkedinUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  xUrl?: string;
  youtubeUrl?: string;
  clientRoles?: string[];
  parentClientId?: string;
  visibleToPartnerIds?: string[];
}) {
  const requestedHubSpotPortalId =
    typeof value.hubSpotPortalId === "string" && value.hubSpotPortalId.trim()
      ? value.hubSpotPortalId.trim()
      : null;

  if (requestedHubSpotPortalId) {
    const portal = await prisma.hubSpotPortal.findUnique({
      where: { id: requestedHubSpotPortalId },
      select: { id: true }
    });

    if (!portal) {
      throw new Error("HubSpot portal not found");
    }
  }

  const client = await prisma.client.create({
    data: {
      name: value.name ?? "",
      slug: createSlug(value.name ?? ""),
      website: value.website ?? null,
      logoUrl: value.logoUrl ?? null,
      industry: value.industry ?? null,
      region: normalizeClientRegion(value.region),
      additionalWebsites: Array.isArray(value.additionalWebsites)
        ? value.additionalWebsites
            .filter((entry): entry is string => typeof entry === "string")
            .map((entry) => entry.trim())
            .filter(Boolean)
        : [],
      linkedinUrl:
        typeof value.linkedinUrl === "string"
          ? value.linkedinUrl.trim() || null
          : null,
      facebookUrl:
        typeof value.facebookUrl === "string"
          ? value.facebookUrl.trim() || null
          : null,
      instagramUrl:
        typeof value.instagramUrl === "string"
          ? value.instagramUrl.trim() || null
          : null,
      xUrl: typeof value.xUrl === "string" ? value.xUrl.trim() || null : null,
      youtubeUrl:
        typeof value.youtubeUrl === "string"
          ? value.youtubeUrl.trim() || null
          : null,
      clientRoles: normalizeClientRoleTags(value.clientRoles),
      ...(requestedHubSpotPortalId
        ? {
            hubSpotPortal: {
              connect: {
                id: requestedHubSpotPortalId
              }
            }
          }
        : {}),
      ...(typeof value.parentClientId === "string" &&
      value.parentClientId.trim()
        ? {
            parentClient: {
              connect: {
                id: value.parentClientId.trim()
              }
            }
          }
        : {})
    }
  });

  const partnerVisibilityIds = normalizeClientVisibilityIds(
    value.visibleToPartnerIds
  ).filter((partnerClientId) => partnerClientId !== client.id);

  if (partnerVisibilityIds.length > 0) {
    await syncPartnerVisibilityLinks(client.id, partnerVisibilityIds);
  }

  const createdClient = await prisma.client.findUnique({
    where: { id: client.id },
    include: {
      hubSpotPortal: true,
      parentClient: {
        select: {
          id: true,
          name: true
        }
      },
      childClients: {
        select: {
          id: true,
          name: true
        }
      },
      visibleToPartners: {
        include: {
          partnerClient: {
            select: {
              id: true,
              name: true
            }
          }
        }
      },
      visibleClients: {
        include: {
          client: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  });

  if (!createdClient) {
    throw new Error("Client not found");
  }

  return {
    ...serializeClientDirectoryRecord(createdClient),
    contacts: [],
    projects: []
  };
}

export async function updateClientDirectoryRecord(
  clientId: string,
  value: {
    name?: unknown;
    website?: unknown;
    additionalWebsites?: unknown;
    industry?: unknown;
    region?: unknown;
    hubSpotPortalId?: unknown;
    logoUrl?: unknown;
    linkedinUrl?: unknown;
    facebookUrl?: unknown;
    instagramUrl?: unknown;
    xUrl?: unknown;
    youtubeUrl?: unknown;
    clientRoles?: unknown;
    parentClientId?: unknown;
    visibleToPartnerIds?: unknown;
  }
) {
  const client = await prisma.client.findUnique({
    where: { id: clientId }
  });

  if (!client) {
    throw new Error("Client not found");
  }

  const updateData: Prisma.Prisma.ClientUpdateInput = {};
  let nextPartnerVisibilityIds: string[] | null = null;
  let nextHubSpotPortalId: string | null | undefined;

  if (typeof value.name === "string") {
    const name = value.name.trim();

    if (!name) {
      throw new Error("Client name is required");
    }

    if (name !== client.name) {
      updateData.name = name;
      updateData.slug = createSlug(name);
    }
  }

  if (typeof value.website === "string") {
    updateData.website = value.website.trim() || null;
  }

  if (value.additionalWebsites !== undefined) {
    const additionalWebsites = Array.isArray(value.additionalWebsites)
      ? value.additionalWebsites
      : typeof value.additionalWebsites === "string"
        ? value.additionalWebsites.split(/\r?\n|,/)
        : [];

    updateData.additionalWebsites = additionalWebsites
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (typeof value.industry === "string") {
    updateData.industry = value.industry.trim() || null;
  }

  if (value.region !== undefined) {
    updateData.region = normalizeClientRegion(value.region);
  }

  if (value.hubSpotPortalId !== undefined) {
    nextHubSpotPortalId =
      typeof value.hubSpotPortalId === "string"
        ? value.hubSpotPortalId.trim() || null
        : null;

    if (nextHubSpotPortalId) {
      const portal = await prisma.hubSpotPortal.findUnique({
        where: { id: nextHubSpotPortalId },
        select: { id: true }
      });

      if (!portal) {
        throw new Error("HubSpot portal not found");
      }
    }
  }

  if (typeof value.logoUrl === "string") {
    updateData.logoUrl = value.logoUrl.trim() || null;
  }

  if (typeof value.linkedinUrl === "string") {
    updateData.linkedinUrl = value.linkedinUrl.trim() || null;
  }

  if (typeof value.facebookUrl === "string") {
    updateData.facebookUrl = value.facebookUrl.trim() || null;
  }

  if (typeof value.instagramUrl === "string") {
    updateData.instagramUrl = value.instagramUrl.trim() || null;
  }

  if (typeof value.xUrl === "string") {
    updateData.xUrl = value.xUrl.trim() || null;
  }

  if (typeof value.youtubeUrl === "string") {
    updateData.youtubeUrl = value.youtubeUrl.trim() || null;
  }

  if (value.clientRoles !== undefined) {
    updateData.clientRoles = normalizeClientRoleTags(value.clientRoles);
  }

  if (value.parentClientId !== undefined) {
    const parentClientId =
      typeof value.parentClientId === "string"
        ? value.parentClientId.trim()
        : "";

    if (parentClientId && parentClientId === clientId) {
      throw new Error("A client cannot be its own parent");
    }

    updateData.parentClient = parentClientId
      ? { connect: { id: parentClientId } }
      : { disconnect: true };
  }

  if (value.visibleToPartnerIds !== undefined) {
    nextPartnerVisibilityIds = normalizeClientVisibilityIds(
      value.visibleToPartnerIds
    ).filter((partnerClientId) => partnerClientId !== clientId);
  }

  const refreshedClient = await prisma.$transaction(async (transaction) => {
    const updatedClient = await transaction.client.update({
      where: { id: clientId },
      data: {
        ...updateData,
        ...(nextHubSpotPortalId !== undefined
          ? {
              hubSpotPortal: nextHubSpotPortalId
                ? {
                    connect: {
                      id: nextHubSpotPortalId
                    }
                  }
                : { disconnect: true }
            }
          : {})
      }
    });

    if (nextHubSpotPortalId !== undefined) {
      if (nextHubSpotPortalId) {
        await transaction.project.updateMany({
          where: { clientId },
          data: {
            portalId: nextHubSpotPortalId
          }
        });
      } else {
        const linkedProjectCount = await transaction.project.count({
          where: { clientId }
        });

        if (linkedProjectCount > 0) {
          throw new Error(
            "Clients with linked projects must keep a HubSpot portal"
          );
        }
      }

      if (
        client.hubSpotPortalId &&
        client.hubSpotPortalId !== nextHubSpotPortalId
      ) {
        await deleteHubSpotPortalIfUnused(transaction, client.hubSpotPortalId);
      }
    }

    return transaction.client.findUnique({
      where: { id: updatedClient.id },
      include: {
        hubSpotPortal: true,
        parentClient: {
          select: {
            id: true,
            name: true
          }
        },
        childClients: {
          select: {
            id: true,
            name: true
          },
          orderBy: [{ name: "asc" }]
        },
        visibleToPartners: {
          include: {
            partnerClient: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        visibleClients: {
          include: {
            client: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });
  });

  if (nextPartnerVisibilityIds) {
    await syncPartnerVisibilityLinks(clientId, nextPartnerVisibilityIds);
  }

  if (!refreshedClient) {
    throw new Error("Client not found");
  }

  return {
    ...serializeClientDirectoryRecord(refreshedClient)
  };
}

export async function deleteClientDirectoryRecord(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      contacts: true
    }
  });

  if (!client) {
    throw new Error("Client not found");
  }

  const contactEmails = new Set(
    client.contacts
      .map((contact) => contact.email.trim().toLowerCase())
      .filter(Boolean)
  );

  const linkedProjects = await prisma.project.findMany({
    where: {
      OR: [
        { clientId },
        ...(contactEmails.size > 0
          ? [
              {
                clientChampionEmail: {
                  in: Array.from(contactEmails)
                }
              },
              {
                clientAccess: {
                  some: {
                    user: {
                      email: {
                        in: Array.from(contactEmails)
                      }
                    }
                  }
                }
              }
            ]
          : [])
      ]
    },
    select: {
      id: true
    }
  });

  if (linkedProjects.length > 0) {
    throw new Error("Cannot delete a client that still has linked projects");
  }

  await prisma.client.delete({
    where: { id: clientId }
  });
}

export async function refreshClientEnrichment(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId }
  });

  if (!client) {
    throw new Error("Client not found");
  }

  const enrichment = await fetchClientWebsiteEnrichment(client);

  const updatedClient = await prisma.client.update({
    where: { id: clientId },
    data: mergeClientEnrichmentFields(client, enrichment)
  });

  return serializeClientDirectoryRecord(updatedClient);
}

export async function createClientContact(
  clientId: string,
  value: {
    firstName?: unknown;
    lastName?: unknown;
    email?: unknown;
    title?: unknown;
    canApproveQuotes?: unknown;
  }
) {
  const firstName =
    typeof value.firstName === "string" ? value.firstName.trim() : "";
  const lastName =
    typeof value.lastName === "string" ? value.lastName.trim() : "";
  const email =
    typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const canApproveQuotes = Boolean(value.canApproveQuotes);

  if (!firstName || !email) {
    throw new Error("firstName and email are required");
  }

  const contact = await prisma.clientContact.create({
    data: {
      clientId,
      firstName,
      lastName: lastName || null,
      email,
      title: title || null,
      canApproveQuotes
    }
  });

  return serializeClientContact(contact);
}

export async function updateClientContact(
  clientId: string,
  contactId: string,
  value: {
    firstName?: unknown;
    lastName?: unknown;
    email?: unknown;
    title?: unknown;
    canApproveQuotes?: unknown;
  }
) {
  const existingContact = await prisma.clientContact.findUnique({
    where: { id: contactId }
  });

  if (!existingContact || existingContact.clientId !== clientId) {
    throw new Error("Client contact not found");
  }

  const updateData: Prisma.Prisma.ClientContactUpdateInput = {};

  if (value.firstName !== undefined) {
    if (
      typeof value.firstName !== "string" ||
      value.firstName.trim().length === 0
    ) {
      throw new Error("firstName must be a non-empty string");
    }

    updateData.firstName = value.firstName.trim();
  }

  if (value.lastName !== undefined) {
    if (typeof value.lastName !== "string") {
      throw new Error("lastName must be a string");
    }

    updateData.lastName = value.lastName.trim() || null;
  }

  if (value.email !== undefined) {
    if (typeof value.email !== "string" || value.email.trim().length === 0) {
      throw new Error("email must be a non-empty string");
    }

    updateData.email = value.email.trim().toLowerCase();
  }

  if (value.title !== undefined) {
    if (typeof value.title !== "string") {
      throw new Error("title must be a string");
    }

    updateData.title = value.title.trim() || null;
  }

  if (value.canApproveQuotes !== undefined) {
    updateData.canApproveQuotes = Boolean(value.canApproveQuotes);
  }

  const contact = await prisma.clientContact.update({
    where: { id: contactId },
    data: updateData
  });

  return serializeClientContact(contact);
}

export async function createClientPortalUserForProject(
  projectId: string,
  value: {
    firstName?: unknown;
    lastName?: unknown;
    email?: unknown;
    role?: unknown;
    questionnaireAccess?: unknown;
    assignedInputSections?: unknown;
  }
) {
  const firstName =
    typeof value.firstName === "string" ? value.firstName.trim() : "";
  const lastName =
    typeof value.lastName === "string" ? value.lastName.trim() : "";
  const email =
    typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const role =
    typeof value.role === "string" ? value.role.trim() : "contributor";
  const questionnaireAccess =
    value.questionnaireAccess === undefined
      ? true
      : Boolean(value.questionnaireAccess);
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      clientQuestionnaireConfig: true
    }
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const inputConfig = normalizeClientQuestionnaireConfig(
    project.clientQuestionnaireConfig
  );
  const availableInputSections = getEnabledClientInputSections(inputConfig);
  const assignedInputSections = questionnaireAccess
    ? normalizeAssignedInputSections(
        value.assignedInputSections,
        availableInputSections
      )
    : [];

  if (!firstName || !email) {
    throw new Error("firstName and email are required");
  }

  const existingUser = await prisma.clientPortalUser.findUnique({
    where: { email }
  });
  const isExistingActiveUser = Boolean(existingUser?.inviteAcceptedAt);
  const inviteToken = isExistingActiveUser
    ? null
    : crypto.randomBytes(24).toString("hex");
  const inviteTokenExpiresAt = inviteToken
    ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)
    : null;

  const user = await prisma.clientPortalUser.upsert({
    where: { email },
    update: {
      firstName,
      lastName,
      ...(isExistingActiveUser
        ? {}
        : {
            inviteToken,
            inviteTokenExpiresAt
          })
    },
    create: {
      firstName,
      lastName,
      email,
      password: "",
      inviteToken,
      inviteTokenExpiresAt
    }
  });

  await prisma.clientProjectAccess.upsert({
    where: {
      userId_projectId: {
        userId: user.id,
        projectId
      }
    },
    update: {
      role,
      questionnaireAccess,
      assignedInputSections
    },
    create: {
      userId: user.id,
      projectId,
      role,
      questionnaireAccess,
      assignedInputSections
    }
  });

  return {
    ...serializeClientPortalUser(user),
    inviteLink: inviteToken
      ? await buildClientAccessUrlForEmail(user.email, inviteToken)
      : null,
    role,
    questionnaireAccess,
    assignedInputSections,
    canApproveQuotes: role === "approver"
  };
}

function getAppBaseUrl() {
  return (
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_BASE_URL ??
    "https://deploy.wearemuloo.com"
  );
}

async function resolvePortalBasePathForEmail(email?: string | null) {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    return "/client" as const;
  }

  const partnerClient = await prisma.client.findFirst({
    where: {
      clientRoles: {
        has: "partner"
      },
      contacts: {
        some: {
          email: {
            equals: normalizedEmail,
            mode: "insensitive"
          }
        }
      }
    },
    select: {
      id: true
    }
  });

  return partnerClient ? ("/partner" as const) : ("/client" as const);
}

export async function resolvePortalBasePathForClientUser(userId: string) {
  const user = await prisma.clientPortalUser.findUnique({
    where: { id: userId },
    select: { email: true }
  });

  return resolvePortalBasePathForEmail(user?.email);
}

function buildPortalAccessUrl(
  portalBasePath: "/client" | "/partner",
  pathname: string,
  token: string
) {
  return `${getAppBaseUrl()}${portalBasePath}${pathname}?token=${encodeURIComponent(token)}`;
}

async function buildClientAccessUrlForEmail(email: string, token: string) {
  const portalBasePath = await resolvePortalBasePathForEmail(email);
  return buildPortalAccessUrl(portalBasePath, "/activate", token);
}

async function buildClientPortalLoginUrl(email: string) {
  const portalBasePath = await resolvePortalBasePathForEmail(email);
  return `${getAppBaseUrl()}${portalBasePath}/login`;
}

function buildClientPortalInviteEmail(input: {
  contact: {
    firstName: string;
    email: string;
    canApproveQuotes: boolean;
  };
  projects: Array<{ name: string }>;
  accessUrl: string;
  questionnaireAccess: boolean;
}) {
  const greetingName = input.contact.firstName.trim() || "there";
  const projectLines = input.projects
    .map((project) => `- ${project.name}`)
    .join("\n");
  const subject =
    input.projects.length === 1
      ? `Action required: access your Muloo portal for ${input.projects[0]?.name ?? "your project"}`
      : "Action required: access your Muloo project portal";

  const body = [
    `Hi ${greetingName},`,
    "",
    "You now have access to the Muloo project portal.",
    "",
    input.projects.length === 1
      ? `We’ve set you up on this project:\n${projectLines}`
      : `We’ve set you up on these projects:\n${projectLines}`,
    "",
    "This portal is where we’ll share project updates, documents, quotes, approvals, and any client inputs we need from your team.",
    "",
    "Your next step:",
    input.questionnaireAccess
      ? "- Open the portal and set your password if this is your first visit"
      : "- Open the portal and sign in",
    input.questionnaireAccess
      ? "- Open the assigned project and complete the requested project inputs"
      : "- Open the assigned project and review the latest updates and approvals",
    "- Return anytime as the project moves forward",
    "",
    input.questionnaireAccess
      ? "Your progress saves automatically as you work, so you can leave and come back later without losing your answers."
      : "You have visibility into the project without being asked to complete the active inputs.",
    input.contact.canApproveQuotes
      ? "You are also marked as a quote approver for any commercial sign-off required on these projects."
      : "If approval is needed later, we’ll surface it clearly in the portal.",
    "",
    `Portal access: ${input.accessUrl}`,
    "",
    "If anything is unclear, reply and we’ll help.",
    "",
    "Muloo"
  ].join("\n");

  return { subject, body };
}

export async function createClientInviteLink(
  userId: string,
  projectId: string
) {
  const access = await prisma.clientProjectAccess.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId
      }
    },
    include: {
      user: true
    }
  });

  if (!access) {
    throw new Error("Client user not found for this project");
  }

  const inviteToken = crypto.randomBytes(24).toString("hex");
  const inviteTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

  await prisma.clientPortalUser.update({
    where: { id: access.user.id },
    data: {
      inviteToken,
      inviteTokenExpiresAt
    }
  });

  return {
    user: serializeClientPortalUser(access.user),
    inviteLink: await buildClientAccessUrlForEmail(
      access.user.email,
      inviteToken
    )
  };
}

export async function createClientResetLink(userId: string, projectId: string) {
  const access = await prisma.clientProjectAccess.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId
      }
    },
    include: {
      user: true
    }
  });

  if (!access) {
    throw new Error("Client user not found for this project");
  }

  const resetToken = crypto.randomBytes(24).toString("hex");
  const resetExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

  await prisma.clientPortalUser.update({
    where: { id: userId },
    data: {
      passwordResetToken: resetToken,
      passwordResetTokenExpiresAt: resetExpiresAt
    }
  });

  return {
    user: serializeClientPortalUser(access.user),
    resetLink: await buildClientAccessUrlForEmail(access.user.email, resetToken)
  };
}

export async function loadClientUsersForProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      clientQuestionnaireConfig: true
    }
  });
  const availableInputSections = getEnabledClientInputSections(
    normalizeClientQuestionnaireConfig(project?.clientQuestionnaireConfig)
  );
  const accessRecords = await prisma.clientProjectAccess.findMany({
    where: { projectId },
    include: { user: true },
    orderBy: [{ createdAt: "asc" }]
  });

  return accessRecords.map((record) => ({
    ...serializeClientPortalUser(record.user),
    role: record.role,
    questionnaireAccess: record.questionnaireAccess,
    assignedInputSections: resolveAssignedInputSectionsForAccess({
      questionnaireAccess: record.questionnaireAccess,
      assignedInputSections: record.assignedInputSections,
      availableSections: availableInputSections
    }),
    canApproveQuotes: record.role === "approver"
  }));
}

export async function loadPartnerUsersForProject(projectId: string) {
  const accessRecords = await prisma.clientProjectAccess.findMany({
    where: { projectId },
    include: { user: { select: { id: true, email: true, firstName: true, lastName: true, inviteAcceptedAt: true } } },
    orderBy: [{ createdAt: "asc" }]
  });

  const partnerUsers: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    authStatus: string;
    partnerClientId: string | null;
    partnerClientName: string | null;
  }> = [];

  for (const record of accessRecords) {
    const email = record.user.email?.toLowerCase();
    if (!email) continue;
    const partnerClient = await prisma.client.findFirst({
      where: {
        clientRoles: { has: "partner" },
        contacts: { some: { email: { equals: email, mode: "insensitive" } } }
      },
      select: { id: true, name: true }
    });
    if (partnerClient) {
      partnerUsers.push({
        id: record.user.id,
        email: record.user.email,
        firstName: record.user.firstName,
        lastName: record.user.lastName,
        role: record.role,
        authStatus: record.user.inviteAcceptedAt ? "active" : "invite_pending",
        partnerClientId: partnerClient.id,
        partnerClientName: partnerClient.name
      });
    }
  }

  return partnerUsers;
}

export async function inviteClientContactToProjects(
  clientId: string,
  contactId: string,
  value: {
    projectIds?: unknown;
    questionnaireAccess?: unknown;
    sendEmail?: unknown;
  }
) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      contacts: true
    }
  });

  if (!client) {
    throw new Error("Client not found");
  }

  const contact = client.contacts.find(
    (candidate) => candidate.id === contactId
  );

  if (!contact) {
    throw new Error("Client contact not found");
  }

  const requestedProjectIds = Array.isArray(value.projectIds)
    ? Array.from(
        new Set(
          value.projectIds
            .filter((entry): entry is string => typeof entry === "string")
            .map((entry) => entry.trim())
            .filter(Boolean)
        )
      )
    : [];

  if (requestedProjectIds.length === 0) {
    throw new Error("Select at least one project for portal access");
  }

  const clientContactEmails = client.contacts
    .map((clientContact) => clientContact.email.trim().toLowerCase())
    .filter(Boolean);
  const linkedProjects = await prisma.project.findMany({
    where: {
      OR: [
        { clientId },
        ...(clientContactEmails.length > 0
          ? [
              {
                clientChampionEmail: {
                  in: clientContactEmails
                }
              },
              {
                clientAccess: {
                  some: {
                    user: {
                      email: {
                        in: clientContactEmails
                      }
                    }
                  }
                }
              }
            ]
          : [])
      ]
    },
    select: {
      id: true,
      name: true,
      clientId: true
    },
    orderBy: [{ updatedAt: "desc" }]
  });

  const selectedProjects = linkedProjects.filter((project) =>
    requestedProjectIds.includes(project.id)
  );

  if (selectedProjects.length !== requestedProjectIds.length) {
    throw new Error(
      "One or more selected projects are no longer linked to this client"
    );
  }

  const questionnaireAccess =
    value.questionnaireAccess === undefined
      ? true
      : Boolean(value.questionnaireAccess);
  const sendEmail =
    value.sendEmail === undefined ? true : Boolean(value.sendEmail);
  const role = contact.canApproveQuotes ? "approver" : "contributor";
  const contactName =
    [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() ||
    contact.email;

  let inviteLink: string | null = null;
  const assignments: Array<{
    projectId: string;
    projectName: string;
    role: string;
    questionnaireAccess: boolean;
    authStatus: string;
  }> = [];

  for (const project of selectedProjects) {
    const clientUser = await createClientPortalUserForProject(project.id, {
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      role,
      questionnaireAccess
    });

    if (clientUser.inviteLink) {
      inviteLink = clientUser.inviteLink;
    }

    assignments.push({
      projectId: project.id,
      projectName: project.name,
      role: clientUser.role,
      questionnaireAccess: clientUser.questionnaireAccess,
      authStatus: clientUser.authStatus
    });
  }

  const accessUrl = inviteLink ?? (await buildClientPortalLoginUrl(contact.email));
  let emailSent = false;
  let emailError: string | null = null;

  if (sendEmail) {
    const inviteEmail = buildClientPortalInviteEmail({
      contact,
      projects: selectedProjects,
      accessUrl,
      questionnaireAccess
    });

    try {
      await sendWorkspaceEmail({
        to: [contact.email],
        subject: inviteEmail.subject,
        body: inviteEmail.body
      });
      emailSent = true;
    } catch (error) {
      emailError =
        error instanceof Error
          ? error.message
          : "Failed to send onboarding email";
    }
  }

  await Promise.all(
    selectedProjects.map((project) =>
      createProjectMessage({
        projectId: project.id,
        senderType: "internal",
        senderName: "Muloo Client Workspace",
        body:
          `Portal access updated for ${contactName}` +
          ` (${contact.email}). ${
            questionnaireAccess
              ? "Assigned to project inputs."
              : "Visibility only."
          }${sendEmail ? ` ${emailSent ? "Onboarding email sent." : `Onboarding email could not be sent: ${emailError}`}` : ""}`
      })
    )
  );

  return {
    contact: serializeClientContact(contact),
    assignments,
    role,
    questionnaireAccess,
    accessUrl,
    emailSent,
    emailError
  };
}

export async function updateClientProjectAccess(
  projectId: string,
  userId: string,
  value: {
    role?: unknown;
    questionnaireAccess?: unknown;
    assignedInputSections?: unknown;
  }
) {
  const existingAccess = await prisma.clientProjectAccess.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId
      }
    },
    include: {
      user: true
    }
  });

  if (!existingAccess) {
    throw new Error("Client user not found for this project");
  }

  const updateData: Prisma.Prisma.ClientProjectAccessUpdateInput = {};

  if (value.role !== undefined) {
    if (typeof value.role !== "string" || value.role.trim().length === 0) {
      throw new Error("role must be a non-empty string");
    }

    updateData.role = value.role.trim();
  }

  if (value.questionnaireAccess !== undefined) {
    updateData.questionnaireAccess = Boolean(value.questionnaireAccess);
  }

  if (
    value.assignedInputSections !== undefined ||
    value.questionnaireAccess !== undefined
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        clientQuestionnaireConfig: true
      }
    });

    if (!project) {
      throw new Error("Project not found");
    }

    const availableInputSections = getEnabledClientInputSections(
      normalizeClientQuestionnaireConfig(project.clientQuestionnaireConfig)
    );
    const nextQuestionnaireAccess =
      value.questionnaireAccess === undefined
        ? existingAccess.questionnaireAccess
        : Boolean(value.questionnaireAccess);
    const currentAssignedInputSections = resolveAssignedInputSectionsForAccess({
      questionnaireAccess: existingAccess.questionnaireAccess,
      assignedInputSections: existingAccess.assignedInputSections,
      availableSections: availableInputSections
    });

    updateData.assignedInputSections = nextQuestionnaireAccess
      ? normalizeAssignedInputSections(
          value.assignedInputSections ?? currentAssignedInputSections,
          availableInputSections
        )
      : [];
  }

  const updatedAccess = await prisma.clientProjectAccess.update({
    where: {
      userId_projectId: {
        userId,
        projectId
      }
    },
    data: updateData,
    include: {
      user: true
    }
  });

  return {
    ...serializeClientPortalUser(updatedAccess.user),
    role: updatedAccess.role,
    questionnaireAccess: updatedAccess.questionnaireAccess,
    assignedInputSections: updatedAccess.assignedInputSections,
    canApproveQuotes: updatedAccess.role === "approver"
  };
}

export async function loadClientProjectsForUser(userId: string) {
  const accessRecords = await prisma.clientProjectAccess.findMany({
    where: { userId },
    include: {
      project: {
        include: {
          client: true
        }
      }
    },
    orderBy: {
      project: {
        updatedAt: "desc"
      }
    }
  });

  return accessRecords.map((record) => ({
    role: record.role,
    project: serializeClientProject(record.project)
  }));
}

export async function loadClientProjectDetail(
  projectId: string,
  userId: string
) {
  const access = await prisma.clientProjectAccess.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId
      }
    },
    include: {
      project: {
        include: {
          client: true
        }
      },
      user: true
    }
  });

  if (!access) {
    return null;
  }

  const [submissions, portalTasks] = await Promise.all([
    prisma.clientInputSubmission.findMany({
      where: {
        projectId,
        userId
      },
      orderBy: [{ sessionNumber: "asc" }]
    }),
    prisma.task.findMany({
      where: {
        projectId
      },
      select: {
        title: true,
        status: true,
        description: true
      },
      orderBy: [{ createdAt: "asc" }]
    })
  ]);
  const normalizedInputConfig = normalizeClientQuestionnaireConfig(
    access.project.clientQuestionnaireConfig
  );
  const availableInputSections = getEnabledClientInputSections(
    normalizedInputConfig
  );
  const assignedInputSections = resolveAssignedInputSectionsForAccess({
    questionnaireAccess: access.questionnaireAccess,
    assignedInputSections: access.assignedInputSections,
    availableSections: availableInputSections
  });

  return {
    user: serializeClientPortalUser(access.user),
    role: access.role,
    canCompleteQuestionnaire: access.questionnaireAccess,
    assignedInputSections,
    project: {
      ...serializeClientProject(access.project),
      clientQuestionnaireConfig: Object.fromEntries(
        Object.entries(normalizedInputConfig)
          .filter(
            ([sessionNumberText, session]) =>
              access.questionnaireAccess &&
              assignedInputSections.includes(Number(sessionNumberText)) &&
              session.enabled !== false &&
              session.questions.some((question) => question.enabled !== false)
          )
          .map(([sessionNumberText, session]) => [
            Number(sessionNumberText),
            {
              ...session,
              questions: session.questions.filter(
                (question) => question.enabled !== false
              )
            }
          ])
      ) as ClientQuestionnaireConfig
    },
    portalSummary: buildPortalProjectSummary({
      project: access.project,
      assignedInputSections,
      submissions,
      tasks: portalTasks
    }),
    submissions: submissions.map((submission) =>
      serializeClientInputSubmission(submission)
    )
  };
}

export async function loadPortalAssistantProjectContext(
  projectId: string,
  userId: string
) {
  const access = await prisma.clientProjectAccess.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId
      }
    },
    include: {
      project: {
        include: {
          client: true
        }
      }
    }
  });

  if (!access) {
    return null;
  }

  const [submissions, visibleTasks, recentMessages] = await Promise.all([
    prisma.clientInputSubmission.findMany({
      where: {
        projectId,
        userId
      },
      orderBy: [{ sessionNumber: "asc" }]
    }),
    prisma.task.findMany({
      where: {
        projectId
      },
      select: {
        title: true,
        status: true,
        description: true
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 10
    }),
    prisma.projectMessage.findMany({
      where: {
        projectId
      },
      select: {
        senderType: true,
        senderName: true,
        body: true,
        createdAt: true
      },
      orderBy: [{ createdAt: "desc" }],
      take: 6
    })
  ]);

  const normalizedInputConfig = normalizeClientQuestionnaireConfig(
    access.project.clientQuestionnaireConfig
  );
  const availableInputSections = getEnabledClientInputSections(
    normalizedInputConfig
  );
  const assignedInputSections = resolveAssignedInputSectionsForAccess({
    questionnaireAccess: access.questionnaireAccess,
    assignedInputSections: access.assignedInputSections,
    availableSections: availableInputSections
  });
  const portalSummary = buildPortalProjectSummary({
    project: access.project,
    assignedInputSections,
    submissions,
    tasks: visibleTasks
  });

  return {
    portalRole: access.role,
    project: {
      id: access.project.id,
      name: access.project.name,
      clientName: access.project.client.name,
      status: access.project.status,
      engagementType: access.project.engagementType,
      scopeType: access.project.scopeType ?? "discovery",
      selectedHubs: access.project.selectedHubs,
      updatedAt: access.project.updatedAt.toISOString(),
      portalSummary
    },
    visibleTasks: visibleTasks.map((task) => ({
      title: task.title,
      status: task.status,
      description: task.description
    })),
    recentMessages: recentMessages
      .slice()
      .reverse()
      .map((message) => ({
        senderType: message.senderType,
        senderName: message.senderName,
        body: message.body,
        createdAt: message.createdAt.toISOString()
      }))
  };
}

export async function loadClientQuoteDocument(
  projectId: string,
  userId: string
) {
  const access = await prisma.clientProjectAccess.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId
      }
    }
  });

  if (!access) {
    return null;
  }

  const [project, discoverySubmissions, summary, blueprint, products, quote] =
    await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        include: {
          client: true,
          portal: true
        }
      }),
      prisma.discoverySubmission.findMany({
        where: { projectId },
        orderBy: { version: "asc" },
        select: {
          version: true,
          status: true,
          sections: true,
          completedSections: true
        }
      }),
      loadDiscoverySummary(projectId),
      loadBlueprint(projectId),
      loadProductCatalog(),
      loadLatestProjectQuote(projectId, ["shared", "approved"])
    ]);

  if (!project) {
    return null;
  }

  return {
    project: serializeProject(project),
    sessions: buildDiscoverySessionsWithStatus(discoverySubmissions),
    summary,
    blueprint,
    products,
    quote
  };
}

export async function saveClientInputSubmission(
  projectId: string,
  userId: string,
  sessionNumber: number,
  answers: unknown
) {
  const access = await prisma.clientProjectAccess.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId
      }
    },
    select: {
      questionnaireAccess: true
    }
  });

  if (!access) {
    throw new Error("Project not found");
  }

  if (!access.questionnaireAccess) {
    throw new Error(
      "Project input access is not enabled for this client user on this project."
    );
  }

  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    throw new Error("answers must be an object");
  }

  const normalizedAnswers = Object.fromEntries(
    Object.entries(answers as Record<string, unknown>).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() : ""
    ])
  );
  const totalQuestionCount = Object.keys(normalizedAnswers).length;
  const completedCount = Object.values(normalizedAnswers).filter(
    (value) => typeof value === "string" && value.trim().length > 0
  ).length;
  const status =
    completedCount === 0
      ? "draft"
      : completedCount === totalQuestionCount
        ? "complete"
        : "in_progress";

  const submission = await prisma.clientInputSubmission.upsert({
    where: {
      projectId_userId_sessionNumber: {
        projectId,
        userId,
        sessionNumber
      }
    },
    update: {
      answers: normalizedAnswers,
      status
    },
    create: {
      projectId,
      userId,
      sessionNumber,
      answers: normalizedAnswers,
      status
    }
  });

  return serializeClientInputSubmission(submission);
}

export async function loadProjectMessages(projectId: string) {
  const messages = await prisma.projectMessage.findMany({
    where: { projectId },
    orderBy: [{ createdAt: "asc" }]
  });

  return messages.map((message) => serializeProjectMessage(message));
}

export async function createProjectMessage(value: {
  projectId?: unknown;
  senderType?: unknown;
  senderName?: unknown;
  body?: unknown;
}) {
  const projectId =
    typeof value.projectId === "string" ? value.projectId.trim() : "";
  const senderType =
    typeof value.senderType === "string" ? value.senderType.trim() : "";
  const senderName =
    typeof value.senderName === "string" ? value.senderName.trim() : "";
  const body = typeof value.body === "string" ? value.body.trim() : "";

  if (!projectId || !senderType || !senderName || !body) {
    throw new Error("projectId, senderType, senderName, and body are required");
  }

  const message = await prisma.projectMessage.create({
    data: {
      projectId,
      senderType,
      senderName,
      body,
      internalSeenAt: senderType === "internal" ? new Date() : null,
      clientSeenAt: senderType === "client" ? new Date() : null
    }
  });

  return serializeProjectMessage(message);
}

export async function markProjectMessagesSeenByInternal(projectId: string) {
  await prisma.projectMessage.updateMany({
    where: {
      projectId,
      senderType: "client",
      internalSeenAt: null
    },
    data: {
      internalSeenAt: new Date()
    }
  });
}

export async function markAllProjectMessagesSeenByInternal() {
  await prisma.projectMessage.updateMany({
    where: {
      senderType: "client",
      internalSeenAt: null
    },
    data: {
      internalSeenAt: new Date()
    }
  });
}

export async function markProjectMessagesSeenByClient(
  projectIds: string[] | string
) {
  const normalizedProjectIds = Array.isArray(projectIds)
    ? projectIds
    : [projectIds];

  if (normalizedProjectIds.length === 0) {
    return;
  }

  await prisma.projectMessage.updateMany({
    where: {
      projectId: { in: normalizedProjectIds },
      senderType: "internal",
      clientSeenAt: null
    },
    data: {
      clientSeenAt: new Date()
    }
  });
}

export async function loadInternalInbox() {
  const [workRequests, messages] = await Promise.all([
    loadWorkRequests(),
    prisma.projectMessage.findMany({
      include: {
        project: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }],
      take: 100
    })
  ]);

  return {
    workRequests,
    messages: messages.map((message) => ({
      ...serializeProjectMessage(message),
      project: message.project
    }))
  };
}

export async function loadClientInbox(userId: string) {
  const accessRecords = await prisma.clientProjectAccess.findMany({
    where: { userId },
    select: { projectId: true }
  });
  const projectIds = accessRecords.map((record) => record.projectId);

  const [workRequests, messages] = await Promise.all([
    prisma.clientPortalUser
      .findUnique({
        where: { id: userId },
        select: { email: true }
      })
      .then((user) =>
        loadWorkRequests(
          user?.email
            ? {
                projectIds,
                contactEmail: user.email
              }
            : {
                projectIds
              }
        )
      ),
    prisma.projectMessage.findMany({
      where: {
        projectId: { in: projectIds }
      },
      include: {
        project: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }],
      take: 100
    })
  ]);

  return {
    workRequests,
    messages: messages.map((message) => ({
      ...serializeProjectMessage(message),
      project: message.project
    }))
  };
}

export async function loadInboxSummary() {
  const [newWorkRequests, unseenClientMessages] = await Promise.all([
    prisma.workRequest.count({
      where: { status: "new" }
    }),
    prisma.projectMessage.count({
      where: {
        senderType: "client",
        internalSeenAt: null
      }
    })
  ]);

  return {
    newWorkRequests,
    newMessages: unseenClientMessages,
    total: newWorkRequests + unseenClientMessages
  };
}

export async function loadClientInboxSummary(userId: string) {
  const accessRecords = await prisma.clientProjectAccess.findMany({
    where: { userId },
    select: { projectId: true }
  });
  const projectIds = accessRecords.map((record) => record.projectId);
  const clientUser = await prisma.clientPortalUser.findUnique({
    where: { id: userId },
    select: { email: true }
  });

  const [unseenInternalMessages, openRequests] = await Promise.all([
    prisma.projectMessage.count({
      where: {
        projectId: { in: projectIds },
        senderType: "internal",
        clientSeenAt: null
      }
    }),
    prisma.workRequest.count({
      where: {
        OR: [
          { projectId: { in: projectIds } },
          {
            contactEmail: clientUser?.email ?? ""
          }
        ],
        status: { not: "closed" }
      }
    })
  ]);

  return {
    newMessages: unseenInternalMessages,
    openRequests,
    total: unseenInternalMessages + openRequests
  };
}

export async function updateProductCatalogItem(
  productId: string,
  value: {
    name?: unknown;
    serviceFamily?: unknown;
    category?: unknown;
    billingModel?: unknown;
    description?: unknown;
    unitPrice?: unknown;
    defaultQuantity?: unknown;
    unitLabel?: unknown;
    isActive?: unknown;
    sortOrder?: unknown;
  }
) {
  const updateData: Prisma.Prisma.ProductCatalogItemUpdateInput = {};

  if (value.name !== undefined) {
    if (typeof value.name !== "string" || value.name.trim().length === 0) {
      throw new Error("name must be a non-empty string");
    }

    updateData.name = value.name.trim();
    updateData.slug = createSlug(value.name.trim());
  }

  if (value.category !== undefined) {
    if (
      typeof value.category !== "string" ||
      value.category.trim().length === 0
    ) {
      throw new Error("category must be a non-empty string");
    }

    updateData.category = value.category.trim();
  }

  if (value.serviceFamily !== undefined) {
    if (
      typeof value.serviceFamily !== "string" ||
      !serviceFamilyOptions.includes(
        value.serviceFamily.trim() as (typeof serviceFamilyOptions)[number]
      )
    ) {
      throw new Error("serviceFamily must be a valid service family");
    }

    updateData.serviceFamily = value.serviceFamily.trim();
  }

  if (value.billingModel !== undefined) {
    if (
      typeof value.billingModel !== "string" ||
      value.billingModel.trim().length === 0
    ) {
      throw new Error("billingModel must be a non-empty string");
    }

    updateData.billingModel = value.billingModel.trim();
  }

  if (value.description !== undefined) {
    if (typeof value.description !== "string") {
      throw new Error("description must be a string");
    }

    updateData.description = value.description.trim() || null;
  }

  if (value.unitPrice !== undefined) {
    const unitPrice =
      typeof value.unitPrice === "number"
        ? value.unitPrice
        : Number(value.unitPrice);

    if (!Number.isFinite(unitPrice)) {
      throw new Error("unitPrice must be a valid number");
    }

    updateData.unitPrice = unitPrice;
  }

  if (value.defaultQuantity !== undefined) {
    const defaultQuantity =
      typeof value.defaultQuantity === "number"
        ? value.defaultQuantity
        : Number(value.defaultQuantity);

    if (!Number.isFinite(defaultQuantity) || defaultQuantity <= 0) {
      throw new Error("defaultQuantity must be a positive number");
    }

    updateData.defaultQuantity = Math.round(defaultQuantity);
  }

  if (value.unitLabel !== undefined) {
    if (
      typeof value.unitLabel !== "string" ||
      value.unitLabel.trim().length === 0
    ) {
      throw new Error("unitLabel must be a non-empty string");
    }

    updateData.unitLabel = value.unitLabel.trim();
  }

  if (value.isActive !== undefined) {
    updateData.isActive = Boolean(value.isActive);
  }

  if (value.sortOrder !== undefined) {
    const sortOrder =
      typeof value.sortOrder === "number"
        ? value.sortOrder
        : Number(value.sortOrder);

    if (!Number.isFinite(sortOrder)) {
      throw new Error("sortOrder must be a valid number");
    }

    updateData.sortOrder = Math.round(sortOrder);
  }

  const product = await prisma.productCatalogItem.update({
    where: { id: productId },
    data: updateData
  });

  return serializeProductCatalogItem(product);
}

export async function updateWorkspaceProviderConnection(
  providerKey: string,
  value: {
    label?: unknown;
    connectionType?: unknown;
    apiKey?: unknown;
    defaultModel?: unknown;
    endpointUrl?: unknown;
    notes?: unknown;
    isEnabled?: unknown;
  }
) {
  const updateData: Prisma.Prisma.WorkspaceProviderConnectionUpdateInput = {};

  if (value.label !== undefined) {
    if (typeof value.label !== "string" || value.label.trim().length === 0) {
      throw new Error("label must be a non-empty string");
    }

    updateData.label = value.label.trim();
  }

  if (value.connectionType !== undefined) {
    if (
      typeof value.connectionType !== "string" ||
      value.connectionType.trim().length === 0
    ) {
      throw new Error("connectionType must be a non-empty string");
    }

    updateData.connectionType = value.connectionType.trim();
  }

  if (value.apiKey !== undefined) {
    if (typeof value.apiKey !== "string") {
      throw new Error("apiKey must be a string");
    }

    updateData.apiKey = value.apiKey.trim() || null;
  }

  if (value.defaultModel !== undefined) {
    if (typeof value.defaultModel !== "string") {
      throw new Error("defaultModel must be a string");
    }

    updateData.defaultModel = value.defaultModel.trim() || null;
  }

  if (value.endpointUrl !== undefined) {
    if (typeof value.endpointUrl !== "string") {
      throw new Error("endpointUrl must be a string");
    }

    updateData.endpointUrl = value.endpointUrl.trim() || null;
  }

  if (value.notes !== undefined) {
    if (typeof value.notes !== "string") {
      throw new Error("notes must be a string");
    }

    updateData.notes = value.notes.trim() || null;
  }

  if (value.isEnabled !== undefined) {
    updateData.isEnabled = Boolean(value.isEnabled);
  }

  const provider = await prisma.workspaceProviderConnection.update({
    where: { providerKey },
    data: updateData
  });

  return serializeWorkspaceProviderConnection(provider);
}

export async function updateWorkspaceEmailSettings(value: {
  providerLabel?: unknown;
  host?: unknown;
  port?: unknown;
  secure?: unknown;
  username?: unknown;
  password?: unknown;
  fromName?: unknown;
  fromEmail?: unknown;
  replyToEmail?: unknown;
  enabled?: unknown;
}) {
  await ensureWorkspaceEmailSettingsSeeded();

  const settings = await prisma.workspaceEmailSettings.findFirstOrThrow({
    orderBy: [{ createdAt: "asc" }]
  });

  const updateData: Prisma.Prisma.WorkspaceEmailSettingsUpdateInput = {};

  if (value.providerLabel !== undefined) {
    if (
      typeof value.providerLabel !== "string" ||
      value.providerLabel.trim().length === 0
    ) {
      throw new Error("providerLabel must be a non-empty string");
    }
    updateData.providerLabel = value.providerLabel.trim();
  }

  if (value.host !== undefined) {
    if (typeof value.host !== "string") {
      throw new Error("host must be a string");
    }
    updateData.host = value.host.trim() || null;
  }

  if (value.port !== undefined) {
    if (value.port === null || value.port === "") {
      updateData.port = null;
    } else {
      const port =
        typeof value.port === "number" ? value.port : Number(value.port);
      if (!Number.isFinite(port) || port <= 0) {
        throw new Error("port must be a valid positive number");
      }
      updateData.port = Math.round(port);
    }
  }

  if (value.secure !== undefined) {
    updateData.secure = Boolean(value.secure);
  }

  if (value.username !== undefined) {
    if (typeof value.username !== "string") {
      throw new Error("username must be a string");
    }
    updateData.username = value.username.trim() || null;
  }

  if (value.password !== undefined) {
    if (typeof value.password !== "string") {
      throw new Error("password must be a string");
    }
    updateData.password = value.password.trim() || null;
  }

  if (value.fromName !== undefined) {
    if (typeof value.fromName !== "string") {
      throw new Error("fromName must be a string");
    }
    updateData.fromName = value.fromName.trim() || null;
  }

  if (value.fromEmail !== undefined) {
    if (typeof value.fromEmail !== "string") {
      throw new Error("fromEmail must be a string");
    }
    updateData.fromEmail = value.fromEmail.trim() || null;
  }

  if (value.replyToEmail !== undefined) {
    if (typeof value.replyToEmail !== "string") {
      throw new Error("replyToEmail must be a string");
    }
    updateData.replyToEmail = value.replyToEmail.trim() || null;
  }

  if (value.enabled !== undefined) {
    updateData.enabled = Boolean(value.enabled);
  }

  const updatedSettings = await prisma.workspaceEmailSettings.update({
    where: { id: settings.id },
    data: updateData
  });

  return serializeWorkspaceEmailSettings(updatedSettings);
}

export async function updateWorkspaceEmailOAuthConnection(value: {
  clientId?: unknown;
  clientSecret?: unknown;
  redirectUri?: unknown;
  enabled?: unknown;
  gmailFilterLabel?: unknown;
  scopes?: unknown;
}) {
  await ensureWorkspaceEmailOAuthConnectionsSeeded();

  const connection =
    await prisma.workspaceEmailOAuthConnection.findUniqueOrThrow({
      where: { providerKey: "google_workspace" }
    });

  const updateData: Prisma.Prisma.WorkspaceEmailOAuthConnectionUpdateInput = {};

  if (value.clientId !== undefined) {
    if (typeof value.clientId !== "string") {
      throw new Error("clientId must be a string");
    }

    updateData.clientId = value.clientId.trim() || null;
  }

  if (value.clientSecret !== undefined) {
    if (typeof value.clientSecret !== "string") {
      throw new Error("clientSecret must be a string");
    }

    updateData.clientSecret = value.clientSecret.trim() || null;
  }

  if (value.redirectUri !== undefined) {
    if (typeof value.redirectUri !== "string") {
      throw new Error("redirectUri must be a string");
    }

    updateData.redirectUri = value.redirectUri.trim() || null;
  }

  if (value.enabled !== undefined) {
    updateData.enabled = Boolean(value.enabled);
  }

  if (value.gmailFilterLabel !== undefined) {
    if (typeof value.gmailFilterLabel !== "string") {
      throw new Error("gmailFilterLabel must be a string");
    }

    updateData.gmailFilterLabel = value.gmailFilterLabel.trim() || null;
  }

  if (value.scopes !== undefined) {
    const scopes = Array.isArray(value.scopes)
      ? value.scopes
      : typeof value.scopes === "string"
        ? value.scopes.split(/[\n, ]+/)
        : [];

    const normalizedScopes = scopes
      .filter((scope): scope is string => typeof scope === "string")
      .map((scope) => scope.trim())
      .filter(Boolean);

    const nextScopes = ensureScope(
      normalizedScopes,
      "https://www.googleapis.com/auth/gmail.readonly"
    );

    if (nextScopes.length === 0) {
      throw new Error("At least one OAuth scope is required");
    }

    updateData.scopes = nextScopes;
  }

  const updatedConnection = await prisma.workspaceEmailOAuthConnection.update({
    where: { id: connection.id },
    data: updateData
  });

  return serializeWorkspaceEmailOAuthConnection({
    ...updatedConnection,
    redirectUri: resolveGoogleWorkspaceEmailOAuthRedirectUri(
      updatedConnection.redirectUri
    )
  });
}

export async function createWorkspaceGoogleEmailOAuthStart() {
  await ensureWorkspaceEmailOAuthConnectionsSeeded();

  const connection =
    await prisma.workspaceEmailOAuthConnection.findUniqueOrThrow({
      where: { providerKey: "google_workspace" }
    });

  if (!connection.clientId?.trim()) {
    throw new Error("Google OAuth client ID is not configured yet");
  }

  const redirectUri = resolveGoogleWorkspaceEmailOAuthRedirectUri(
    connection.redirectUri
  );
  const state = createSignedStateToken({
    providerKey: "google_workspace",
    redirectUri,
    expiresAt: Date.now() + 1000 * 60 * 10
  });
  const scopes = ensureScope(
    connection.scopes.length
      ? connection.scopes
      : [
          "openid",
          "email",
          "profile",
          "https://www.googleapis.com/auth/gmail.send"
        ],
    "https://www.googleapis.com/auth/gmail.readonly"
  );

  const params = new URLSearchParams({
    client_id: connection.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: scopes.join(" "),
    state
  });

  return {
    authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  };
}

export async function completeWorkspaceGoogleEmailOAuthCallback(value: {
  code?: unknown;
  state?: unknown;
}) {
  const code = typeof value.code === "string" ? value.code.trim() : "";
  const state = typeof value.state === "string" ? value.state.trim() : "";

  if (!code || !state) {
    throw new Error("Google OAuth callback is missing code or state");
  }

  const verifiedState = verifySignedStateToken(state);
  const redirectUri =
    typeof verifiedState.redirectUri === "string"
      ? verifiedState.redirectUri
      : "";

  if (!redirectUri) {
    throw new Error("OAuth redirect URI is missing from state");
  }

  await ensureWorkspaceEmailOAuthConnectionsSeeded();

  const connection =
    await prisma.workspaceEmailOAuthConnection.findUniqueOrThrow({
      where: { providerKey: "google_workspace" }
    });

  if (!connection.clientId?.trim() || !connection.clientSecret?.trim()) {
    throw new Error("Google OAuth client credentials are incomplete");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      client_id: connection.clientId,
      client_secret: connection.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    }).toString()
  });

  const tokenBody = (await tokenResponse.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  } | null;

  if (!tokenResponse.ok || !tokenBody?.access_token) {
    throw new Error(
      tokenBody?.error_description ||
        tokenBody?.error ||
        "Google token exchange failed"
    );
  }

  const profileResponse = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: {
        Authorization: `Bearer ${tokenBody.access_token}`
      }
    }
  );
  const profileBody = (await profileResponse.json().catch(() => null)) as {
    email?: string;
    name?: string;
  } | null;

  if (!profileResponse.ok || !profileBody?.email) {
    throw new Error("Could not load the connected Google profile");
  }

  const updatedConnection = await prisma.workspaceEmailOAuthConnection.update({
    where: { id: connection.id },
    data: {
      scopes: ensureScope(
        connection.scopes.length
          ? connection.scopes
          : [
              "openid",
              "email",
              "profile",
              "https://www.googleapis.com/auth/gmail.send"
            ],
        "https://www.googleapis.com/auth/gmail.readonly"
      ),
      accessToken: tokenBody.access_token,
      refreshToken: tokenBody.refresh_token ?? connection.refreshToken,
      tokenType: tokenBody.token_type ?? "Bearer",
      connectedEmail: profileBody.email.trim().toLowerCase(),
      connectedName: profileBody.name?.trim() || null,
      tokenExpiresAt:
        typeof tokenBody.expires_in === "number"
          ? new Date(Date.now() + tokenBody.expires_in * 1000)
          : null,
      redirectUri,
      enabled: true
    }
  });

  return serializeWorkspaceEmailOAuthConnection({
    ...updatedConnection,
    redirectUri: resolveGoogleWorkspaceEmailOAuthRedirectUri(
      updatedConnection.redirectUri
    )
  });
}

export async function disconnectWorkspaceGoogleEmailOAuthConnection() {
  await ensureWorkspaceEmailOAuthConnectionsSeeded();

  const connection =
    await prisma.workspaceEmailOAuthConnection.findUniqueOrThrow({
      where: { providerKey: "google_workspace" }
    });

  if (connection.accessToken) {
    await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(
        connection.accessToken
      )}`,
      {
        method: "POST"
      }
    ).catch(() => null);
  }

  const updatedConnection = await prisma.workspaceEmailOAuthConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: null,
      refreshToken: null,
      tokenType: null,
      connectedEmail: null,
      connectedName: null,
      tokenExpiresAt: null,
      enabled: false
    }
  });

  return serializeWorkspaceEmailOAuthConnection({
    ...updatedConnection,
    redirectUri: resolveGoogleWorkspaceEmailOAuthRedirectUri(
      updatedConnection.redirectUri
    )
  });
}

async function getGoogleWorkspaceEmailOAuthConnectionRecord() {
  await ensureWorkspaceEmailOAuthConnectionsSeeded();

  return prisma.workspaceEmailOAuthConnection.findUnique({
    where: { providerKey: "google_workspace" }
  });
}

function buildRawEmailMessage(value: {
  from: string;
  to: string[];
  cc: string[];
  replyTo?: string | null;
  subject: string;
  body: string;
}) {
  const lines = [
    `From: ${value.from}`,
    `To: ${value.to.join(", ")}`,
    ...(value.cc.length > 0 ? [`Cc: ${value.cc.join(", ")}`] : []),
    ...(value.replyTo ? [`Reply-To: ${value.replyTo}`] : []),
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    `Subject: ${value.subject}`,
    "",
    value.body
  ];

  return Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function sendWorkspaceEmailViaGoogleMailbox(value: {
  to: string[];
  cc: string[];
  subject: string;
  body: string;
}) {
  const connection = await refreshGoogleWorkspaceEmailAccessTokenIfNeeded();
  const settings = await prisma.workspaceEmailSettings.findFirstOrThrow({
    orderBy: [{ createdAt: "asc" }]
  });

  if (!connection?.accessToken || !connection.connectedEmail) {
    return null;
  }

  const fromEmail =
    settings.fromEmail &&
    settings.fromEmail.trim().toLowerCase() ===
      connection.connectedEmail.trim().toLowerCase()
      ? settings.fromEmail.trim()
      : connection.connectedEmail.trim();
  const fromHeader = settings.fromName
    ? `"${settings.fromName}" <${fromEmail}>`
    : fromEmail;
  const raw = buildRawEmailMessage({
    from: fromHeader,
    to: value.to,
    cc: value.cc,
    replyTo: settings.replyToEmail,
    subject: value.subject,
    body: value.body
  });

  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ raw })
    }
  );

  const body = (await response.json().catch(() => null)) as {
    id?: string;
    error?: { message?: string };
  } | null;

  if (!response.ok || !body?.id) {
    throw new Error(body?.error?.message || "Failed to send email via Gmail");
  }

  return {
    accepted: [...value.to, ...value.cc],
    rejected: [],
    messageId: body.id,
    transport: "google_mailbox"
  };
}

export async function sendWorkspaceEmail(value: {
  to?: unknown;
  cc?: unknown;
  subject?: unknown;
  body?: unknown;
}) {
  await ensureWorkspaceEmailSettingsSeeded();

  const parseEmailRecipients = (input: unknown) =>
    (Array.isArray(input) ? input : [input])
      .flatMap((entry) =>
        typeof entry === "string" ? entry.split(/[,\n;]/) : []
      )
      .map((entry) => entry.trim())
      .filter(Boolean);

  const to = parseEmailRecipients(value.to)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const cc = parseEmailRecipients(value.cc)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const subject = typeof value.subject === "string" ? value.subject.trim() : "";
  const body = typeof value.body === "string" ? value.body.trim() : "";

  if (to.length === 0 || !subject || !body) {
    throw new Error("to, subject, and body are required");
  }

  const googleResult = await sendWorkspaceEmailViaGoogleMailbox({
    to,
    cc,
    subject,
    body
  });

  if (googleResult) {
    return googleResult;
  }

  const settings = await prisma.workspaceEmailSettings.findFirstOrThrow({
    orderBy: [{ createdAt: "asc" }]
  });

  if (!settings.enabled) {
    throw new Error(
      "No active Google mailbox is connected, and SMTP sending is not enabled yet"
    );
  }

  if (!settings.host || !settings.port || !settings.fromEmail) {
    throw new Error("Workspace email settings are incomplete");
  }

  const transport = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    ...(settings.username
      ? {
          auth: {
            user: settings.username,
            pass: settings.password ?? ""
          }
        }
      : {})
  });

  const info = await transport.sendMail({
    from: settings.fromName
      ? `"${settings.fromName}" <${settings.fromEmail}>`
      : settings.fromEmail,
    to,
    ...(cc.length > 0 ? { cc } : {}),
    ...(settings.replyToEmail ? { replyTo: settings.replyToEmail } : {}),
    subject,
    text: body
  });

  return {
    accepted: Array.isArray(info.accepted) ? info.accepted : [],
    rejected: Array.isArray(info.rejected) ? info.rejected : [],
    messageId: typeof info.messageId === "string" ? info.messageId : null,
    transport: "smtp"
  };
}

export async function updateWorkspaceAiRouting(
  workflowKey: string,
  value: {
    providerKey?: unknown;
    modelOverride?: unknown;
    notes?: unknown;
  }
) {
  const updateData: Prisma.Prisma.WorkspaceAiRoutingUpdateInput = {};

  if (value.providerKey !== undefined) {
    if (
      typeof value.providerKey !== "string" ||
      value.providerKey.trim().length === 0
    ) {
      throw new Error("providerKey must be a non-empty string");
    }

    updateData.providerKey = value.providerKey.trim();
  }

  if (value.modelOverride !== undefined) {
    if (typeof value.modelOverride !== "string") {
      throw new Error("modelOverride must be a string");
    }

    updateData.modelOverride = value.modelOverride.trim() || null;
  }

  if (value.notes !== undefined) {
    if (typeof value.notes !== "string") {
      throw new Error("notes must be a string");
    }

    updateData.notes = value.notes.trim() || null;
  }

  const routing = await prisma.workspaceAiRouting.update({
    where: { workflowKey },
    data: updateData
  });

  return serializeWorkspaceAiRouting(routing);
}

async function getProviderApiKey(
  providerKey: string,
  storedApiKey: string | null
) {
  if (storedApiKey) {
    return storedApiKey;
  }

  const workspaceKey = await getApiKey(
    DEFAULT_WORKSPACE_ID,
    providerKey,
    prisma
  );

  if (workspaceKey) {
    return workspaceKey;
  }

  switch (providerKey) {
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY ?? null;
    case "openai":
      return process.env.OPENAI_API_KEY ?? null;
    case "perplexity":
      return process.env.PERPLEXITY_API_KEY ?? null;
    case "gemini":
      return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? null;
    default:
      return null;
  }
}

async function resolveProviderCandidate(
  providerMap: Map<
    string,
    {
      providerKey: string;
      apiKey: string | null;
      defaultModel: string | null;
      endpointUrl: string | null;
      isEnabled: boolean;
    }
  >,
  providerKey: string | null | undefined,
  modelOverride?: string | null
) {
  if (!providerKey) {
    return null;
  }

  const provider = providerMap.get(providerKey) ?? null;
  if (!provider || provider.isEnabled === false) {
    return null;
  }

  const apiKey = await getProviderApiKey(provider.providerKey, provider.apiKey);
  if (!apiKey) {
    return null;
  }

  return {
    providerKey: provider.providerKey,
    model: modelOverride || provider.defaultModel || null,
    endpointUrl: provider.endpointUrl,
    apiKey
  };
}

async function resolveAiWorkflow(workflowKey: string) {
  await Promise.all([
    ensureProviderConnectionsSeeded(),
    ensureAiRoutingSeeded()
  ]);

  const [routing, providers] = await Promise.all([
    prisma.workspaceAiRouting.findUnique({ where: { workflowKey } }),
    prisma.workspaceProviderConnection.findMany()
  ]);

  const providerMap = new Map(
    providers.map((provider) => [provider.providerKey, provider])
  );
  const routedProviderKey = routing?.providerKey ?? null;
  const routedModelOverride = routing?.modelOverride ?? null;
  const routedCandidate = routing
    ? await resolveProviderCandidate(
        providerMap,
        routedProviderKey,
        routedModelOverride
      )
    : null;

  if (routing && routedCandidate) {
    return {
      workflowKey,
      routeSource: "workflow_route",
      ...routedCandidate
    };
  }

  if (routing) {
    throw new Error(
      `Configured provider ${routing.providerKey} is not available for workflow ${workflowKey}`
    );
  }

  const fallbackOrder = ["anthropic", "openai", "perplexity", "gemini"];
  for (const providerKey of fallbackOrder) {
    const fallbackCandidate = await resolveProviderCandidate(
      providerMap,
      providerKey,
      routedProviderKey === providerKey ? routedModelOverride : null
    );
    if (fallbackCandidate) {
      return {
        workflowKey,
        routeSource: "provider_fallback",
        ...fallbackCandidate
      };
    }
  }

  throw new Error(
    `No AI provider with credentials available for workflow ${workflowKey}`
  );
}

async function resolveAiWorkflowSelection(
  workflowKey: string,
  providerKey?: string | null,
  modelOverride?: string | null
) {
  if (!providerKey) {
    return resolveAiWorkflow(workflowKey);
  }

  await Promise.all([
    ensureProviderConnectionsSeeded(),
    ensureAiRoutingSeeded()
  ]);

  const providers = await prisma.workspaceProviderConnection.findMany();
  const providerMap = new Map(
    providers.map((provider) => [provider.providerKey, provider])
  );
  const candidate = await resolveProviderCandidate(
    providerMap,
    providerKey,
    modelOverride ?? null
  );

  if (!candidate) {
    throw new Error(`No enabled credentials found for provider ${providerKey}`);
  }

  return {
    workflowKey,
    routeSource: "manual_selection",
    ...candidate
  };
}

async function resolveAiWorkflowForAgent(
  workflowKey: string,
  preferredProviderKey: string | null | undefined,
  preferredModel: string | null | undefined
) {
  await Promise.all([
    ensureProviderConnectionsSeeded(),
    ensureAiRoutingSeeded()
  ]);

  const providers = await prisma.workspaceProviderConnection.findMany();
  const providerMap = new Map(
    providers.map((provider) => [provider.providerKey, provider])
  );

  const preferredCandidate = await resolveProviderCandidate(
    providerMap,
    preferredProviderKey,
    preferredModel ?? null
  );

  if (preferredCandidate) {
    return {
      workflowKey,
      routeSource: "agent_preference",
      ...preferredCandidate
    };
  }

  return resolveAiWorkflow(workflowKey);
}

function extractOpenAiText(payload: any) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item?.text === "string" ? item.text : ""))
      .join("\n")
      .trim();
  }

  return "";
}

function extractOpenAiErrorMessage(payload: any) {
  const error = payload?.error;

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  return null;
}

function extractPerplexityErrorMessage(payload: any) {
  const error = payload?.error;

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  return null;
}

function extractGeminiText(payload: any) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
}

function summarizePortalSnapshotRawApiResponses(value: Prisma.Prisma.JsonValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const payload = value as Record<string, unknown>;

  function summarizeProperties(key: string) {
    const source = payload[key];
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return null;
    }

    const sourceRecord = source as { results?: unknown[] };
    const results = Array.isArray(sourceRecord.results)
      ? sourceRecord.results
      : [];

    return results.slice(0, 20).map((entry) => {
      const record =
        entry && typeof entry === "object"
          ? (entry as Record<string, unknown>)
          : {};

      return {
        name: typeof record.name === "string" ? record.name : null,
        label: typeof record.label === "string" ? record.label : null,
        type: typeof record.type === "string" ? record.type : null,
        fieldType:
          typeof record.fieldType === "string" ? record.fieldType : null,
        groupName:
          typeof record.groupName === "string" ? record.groupName : null
      };
    });
  }

  function summarizePipelines(key: string) {
    const source = payload[key];
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return null;
    }

    const sourceRecord = source as { results?: unknown[] };
    const results = Array.isArray(sourceRecord.results)
      ? sourceRecord.results
      : [];

    return results.slice(0, 10).map((entry) => {
      const record =
        entry && typeof entry === "object"
          ? (entry as Record<string, unknown>)
          : {};
      const stages = Array.isArray(record.stages) ? record.stages : [];

      return {
        id: typeof record.id === "string" ? record.id : null,
        label: typeof record.label === "string" ? record.label : null,
        stages: stages.slice(0, 10).map((stage) => {
          const stageRecord =
            stage && typeof stage === "object"
              ? (stage as Record<string, unknown>)
              : {};
          return {
            id: typeof stageRecord.id === "string" ? stageRecord.id : null,
            label:
              typeof stageRecord.label === "string" ? stageRecord.label : null
          };
        })
      };
    });
  }

  function summarizeSchemas() {
    const source = payload.customObjectSchemas;
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return null;
    }

    const sourceRecord = source as { results?: unknown[] };
    const results = Array.isArray(sourceRecord.results)
      ? sourceRecord.results
      : [];

    return results.slice(0, 10).map((entry) => {
      const record =
        entry && typeof entry === "object"
          ? (entry as Record<string, unknown>)
          : {};
      const labels =
        record.labels && typeof record.labels === "object"
          ? (record.labels as Record<string, unknown>)
          : {};
      const properties = Array.isArray(record.properties)
        ? record.properties
        : [];

      return {
        name: typeof record.name === "string" ? record.name : null,
        singularLabel:
          typeof labels.singular === "string" ? labels.singular : null,
        pluralLabel: typeof labels.plural === "string" ? labels.plural : null,
        primaryDisplayProperty:
          typeof record.primaryDisplayProperty === "string"
            ? record.primaryDisplayProperty
            : null,
        propertyCount: properties.length
      };
    });
  }

  function summarizeCollection(key: string, preferredFields: string[]) {
    const source = payload[key];
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return null;
    }

    const collection = source as {
      results?: unknown[];
      lists?: unknown[];
      total?: number;
      count?: number;
    };
    const items = Array.isArray(collection.results)
      ? collection.results
      : Array.isArray(collection.lists)
        ? collection.lists
        : [];

    return {
      total:
        typeof collection.total === "number"
          ? collection.total
          : typeof collection.count === "number"
            ? collection.count
            : items.length,
      sample: items.slice(0, 10).map((entry) => {
        const record =
          entry && typeof entry === "object"
            ? (entry as Record<string, unknown>)
            : {};
        return Object.fromEntries(
          preferredFields.map((field) => [
            field,
            typeof record[field] === "string" ? record[field] : null
          ])
        );
      })
    };
  }

  const accountInfoSource = payload.accountInfoDetails;
  const accountInfo =
    accountInfoSource &&
    typeof accountInfoSource === "object" &&
    !Array.isArray(accountInfoSource)
      ? Object.fromEntries(
          Object.entries(accountInfoSource as Record<string, unknown>)
            .filter(([, entry]) =>
              typeof entry === "string" ||
              typeof entry === "number" ||
              typeof entry === "boolean"
            )
            .slice(0, 20)
        )
      : null;

  return {
    accountInfo,
    contactPropertiesSample: summarizeProperties("contactProperties"),
    companyPropertiesSample: summarizeProperties("companyProperties"),
    dealPropertiesSample: summarizeProperties("dealProperties"),
    ticketPropertiesSample: summarizeProperties("ticketProperties"),
    dealPipelinesSample: summarizePipelines("dealPipelines"),
    ticketPipelinesSample: summarizePipelines("ticketPipelines"),
    customObjectsSample: summarizeSchemas(),
    usersSample: summarizeCollection("users", ["id", "email", "firstName", "lastName"]),
    teamsSample: summarizeCollection("teams", ["id", "name"]),
    listsSample: summarizeCollection("lists", ["listId", "name"])
  };
}

async function callAiWorkflow(
  workflowKey: string,
  system: string,
  user: string,
  options?: { maxTokens?: number }
): Promise<string> {
  const resolved = await resolveAiWorkflow(workflowKey);
  return callResolvedAiWorkflow(resolved, system, user, options);
}

async function callResolvedAiWorkflow(
  resolved: {
    workflowKey: string;
    routeSource: string;
    providerKey: string;
    model: string | null;
    endpointUrl: string | null;
    apiKey: string;
  },
  system: string,
  user: string,
  options?: { maxTokens?: number }
): Promise<string> {
  const maxTokens = options?.maxTokens ?? 2000;

  if (resolved.providerKey === "anthropic") {
    const response = await fetch(
      resolved.endpointUrl || "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": resolved.apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: resolved.model || "claude-sonnet-4-20250514",
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: user }]
        })
      }
    );

    if (!response.ok) {
      throw new Error(
        `Anthropic request failed with status ${response.status}`
      );
    }

    const payload = (await response.json()) as {
      content?: Array<{ text?: string }>;
    };
    return payload?.content?.[0]?.text?.trim() ?? "";
  }

  if (resolved.providerKey === "openai") {
    const response = await fetch(
      resolved.endpointUrl || "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resolved.apiKey}`
        },
        body: JSON.stringify({
          model: resolved.model || "gpt-5.4",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user }
          ],
          max_completion_tokens: maxTokens
        })
      }
    );

      if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(
        extractOpenAiErrorMessage(payload) ||
          `OpenAI request failed with status ${response.status}`
      );
    }

    return extractOpenAiText(await response.json());
  }

  if (resolved.providerKey === "perplexity") {
    const response = await fetch(
      resolved.endpointUrl || "https://api.perplexity.ai/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resolved.apiKey}`
        },
        body: JSON.stringify({
          model: resolved.model || "sonar-pro",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user }
          ],
          max_tokens: maxTokens
        })
      }
    );

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        extractPerplexityErrorMessage(payload) ||
          `Perplexity request failed with status ${response.status}`
      );
    }

    return extractOpenAiText(payload);
  }

  if (resolved.providerKey === "gemini") {
    const model = resolved.model || "gemini-2.5-pro";
    const endpoint =
      resolved.endpointUrl ||
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${resolved.apiKey}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: system }]
        },
        contents: [
          {
            role: "user",
            parts: [{ text: user }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: maxTokens
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini request failed with status ${response.status}`);
    }

    return extractGeminiText(await response.json());
  }

  throw new Error(`Unsupported AI provider: ${resolved.providerKey}`);
}

export async function updateAgentDefinition(
  agentId: string,
  value: {
    name?: unknown;
    purpose?: unknown;
    serviceFamily?: unknown;
    provider?: unknown;
    model?: unknown;
    triggerType?: unknown;
    approvalMode?: unknown;
    allowedActions?: unknown;
    systemPrompt?: unknown;
    isActive?: unknown;
    sortOrder?: unknown;
  }
) {
  const updateData: Prisma.Prisma.AgentDefinitionUpdateInput = {};

  if (value.name !== undefined) {
    if (typeof value.name !== "string" || value.name.trim().length === 0) {
      throw new Error("name must be a non-empty string");
    }

    updateData.name = value.name.trim();
    updateData.slug = createSlug(value.name.trim());
  }

  if (value.purpose !== undefined) {
    if (
      typeof value.purpose !== "string" ||
      value.purpose.trim().length === 0
    ) {
      throw new Error("purpose must be a non-empty string");
    }

    updateData.purpose = value.purpose.trim();
  }

  if (value.serviceFamily !== undefined) {
    if (
      typeof value.serviceFamily !== "string" ||
      !serviceFamilyOptions.includes(
        value.serviceFamily.trim() as (typeof serviceFamilyOptions)[number]
      )
    ) {
      throw new Error("serviceFamily must be a valid service family");
    }

    updateData.serviceFamily = value.serviceFamily.trim();
  }

  if (value.provider !== undefined) {
    if (
      typeof value.provider !== "string" ||
      value.provider.trim().length === 0
    ) {
      throw new Error("provider must be a non-empty string");
    }

    updateData.provider = value.provider.trim();
  }

  if (value.model !== undefined) {
    if (typeof value.model !== "string" || value.model.trim().length === 0) {
      throw new Error("model must be a non-empty string");
    }

    updateData.model = value.model.trim();
  }

  if (value.triggerType !== undefined) {
    if (
      typeof value.triggerType !== "string" ||
      value.triggerType.trim().length === 0
    ) {
      throw new Error("triggerType must be a non-empty string");
    }

    updateData.triggerType = value.triggerType.trim();
  }

  if (value.approvalMode !== undefined) {
    if (
      typeof value.approvalMode !== "string" ||
      value.approvalMode.trim().length === 0
    ) {
      throw new Error("approvalMode must be a non-empty string");
    }

    updateData.approvalMode = value.approvalMode.trim();
  }

  if (value.allowedActions !== undefined) {
    if (!Array.isArray(value.allowedActions)) {
      throw new Error("allowedActions must be an array of strings");
    }

    updateData.allowedActions = value.allowedActions
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (value.systemPrompt !== undefined) {
    if (typeof value.systemPrompt !== "string") {
      throw new Error("systemPrompt must be a string");
    }

    updateData.systemPrompt = value.systemPrompt.trim() || null;
  }

  if (value.isActive !== undefined) {
    updateData.isActive = Boolean(value.isActive);
  }

  if (value.sortOrder !== undefined) {
    const sortOrder =
      typeof value.sortOrder === "number"
        ? value.sortOrder
        : Number(value.sortOrder);

    if (!Number.isFinite(sortOrder)) {
      throw new Error("sortOrder must be a valid number");
    }

    updateData.sortOrder = Math.round(sortOrder);
  }

  const agent = await prisma.agentDefinition.update({
    where: { id: agentId },
    data: updateData
  });

  return serializeAgentDefinition(agent);
}

function serializeDiscoveryEvidence<
  T extends {
    id: string;
    projectId: string;
    sessionNumber: number;
    evidenceType: string;
    sourceLabel: string;
    sourceUrl: string | null;
    content: string | null;
    createdAt: Date;
    updatedAt: Date;
  }
>(evidence: T) {
  return {
    id: evidence.id,
    projectId: evidence.projectId,
    sessionNumber: evidence.sessionNumber,
    evidenceType: evidence.evidenceType,
    sourceLabel: evidence.sourceLabel,
    sourceUrl: evidence.sourceUrl,
    content: evidence.content,
    createdAt: evidence.createdAt.toISOString(),
    updatedAt: evidence.updatedAt.toISOString()
  };
}

export async function loadDiscoveryEvidence(
  projectId: string,
  sessionNumber?: number
) {
  const evidenceItems = await prisma.discoveryEvidence.findMany({
    where: {
      projectId,
      ...(sessionNumber !== undefined ? { sessionNumber } : {})
    },
    orderBy: [{ sessionNumber: "asc" }, { createdAt: "desc" }]
  });

  return evidenceItems.map((item) => serializeDiscoveryEvidence(item));
}

export async function createDiscoveryEvidence(
  projectId: string,
  sessionNumber: number,
  value: {
    evidenceType?: unknown;
    sourceLabel?: unknown;
    sourceUrl?: unknown;
    content?: unknown;
  }
) {
  const evidenceType =
    typeof value.evidenceType === "string" &&
    isValidDiscoveryEvidenceType(value.evidenceType)
      ? value.evidenceType
      : null;
  const sourceLabel =
    typeof value.sourceLabel === "string" ? value.sourceLabel.trim() : "";
  const sourceUrl =
    typeof value.sourceUrl === "string" ? value.sourceUrl.trim() : "";
  const content = typeof value.content === "string" ? value.content.trim() : "";

  if (!evidenceType || !sourceLabel || (!content && !sourceUrl)) {
    throw new Error(
      "evidenceType, sourceLabel, and either content or sourceUrl are required"
    );
  }

  const evidenceItem = await prisma.discoveryEvidence.create({
    data: {
      projectId,
      sessionNumber,
      evidenceType,
      sourceLabel,
      sourceUrl: sourceUrl || null,
      content: content || null
    }
  });

  return serializeDiscoveryEvidence(evidenceItem);
}

export async function saveDiscoverySession(
  projectId: string,
  sessionNumber: number,
  fields: unknown
) {
  const normalizedFields = normalizeDiscoverySessionFields(
    sessionNumber,
    fields
  );
  const completedSections = getCompletedDiscoverySections(normalizedFields);
  const status = getDiscoverySessionStatus(normalizedFields);

  await prisma.discoverySubmission.upsert({
    where: {
      projectId_version: {
        projectId,
        version: sessionNumber
      }
    },
    update: {
      sections: normalizedFields,
      completedSections,
      status
    },
    create: {
      projectId,
      version: sessionNumber,
      sections: normalizedFields,
      completedSections,
      status
    }
  });

  return {
    session: sessionNumber,
    title: sessionTitles[sessionNumber] ?? `Session ${sessionNumber}`,
    status,
    fields: normalizedFields
  };
}

export async function loadDiscoverySessionsPayload(projectId: string) {
  const [submissions, evidenceItems] = await Promise.all([
    prisma.discoverySubmission.findMany({
      where: { projectId },
      orderBy: { version: "asc" },
      select: {
        version: true,
        status: true,
        sections: true,
        completedSections: true
      }
    }),
    loadDiscoveryEvidence(projectId)
  ]);

  return {
    sessions: buildDiscoverySessions(
      submissions.map((submission) => ({
        version: submission.version,
        sections: submission.sections
      }))
    ),
    sessionDetails: buildDiscoverySessionsWithStatus(submissions),
    evidenceItems
  };
}

export async function extractDiscoveryFields(
  text: string,
  session: number
): Promise<{ fields: DiscoverySessionFields; message?: string }> {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    return {
      fields: {},
      message: "ANTHROPIC_API_KEY not configured — extraction unavailable"
    };
  }

  const fields = sessionFieldLabels[session] ?? sessionFieldLabels[1] ?? [];
  const systemPrompt = `You are extracting structured information from HubSpot discovery meeting notes.

Extract values for EXACTLY these fields: ${fields.join(", ")}

Rules:
- Return ONLY a valid JSON object. No markdown, no backticks, no explanation.
- Use the exact field names listed above as JSON keys.
- Values should be concise summaries (2-4 sentences max per field).
- If a field topic is not mentioned in the notes, return an empty string "" for that field.
- Do not add any fields not listed above.

Example format:
{
  "business_overview": "...",
  "primary_pain_challenge": "..."
}`;
  const userPrompt = `Meeting notes:\n\n${text}\n\nExtract the fields now.`;

  const rawText = await callAiWorkflow(
    "discovery_extract",
    systemPrompt,
    userPrompt
  ).catch(() => "{}");
  console.log(
    "[discovery/extract] Claude raw response:",
    rawText.substring(0, 500)
  );

  try {
    const extractedFields = normalizeDiscoveryFields(
      JSON.parse(extractJsonBlock(rawText)) as unknown
    );
    console.log(
      "[discovery/extract] Parsed fields:",
      JSON.stringify(extractedFields)
    );
    return { fields: extractedFields };
  } catch {
    console.log("[discovery/extract] Parsed fields:", JSON.stringify({}));
    return { fields: {} };
  }
}
