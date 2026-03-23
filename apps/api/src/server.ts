import http from "node:http";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { getIntegrationStatus, type BaseConfig } from "@muloo/config";
import { HubSpotClient } from "@muloo/hubspot-client";
import {
  createProjectFromTemplate,
  loadAllExecutionRecords,
  loadAllTemplates,
  loadExecutionById,
  loadExecutionSteps,
  loadProjectById,
  loadProjectDiscoveryById,
  loadProjectDesignById,
  loadProjectExecutions,
  loadProjectModuleDetail,
  loadProjectReadinessById,
  loadProjectSummaryById,
  loadTemplateById,
  summarizeProjectModules,
  summarizeProject,
  updateProjectDiscoverySection,
  updateProjectLifecycleDesign,
  updateProjectMetadata,
  updateProjectPipelinesDesign,
  updateProjectPropertiesDesign,
  updateProjectScope,
  validateAllProjects,
  validateProjectById
} from "@muloo/file-system";
import Prisma from "@prisma/client";
import { moduleCatalog } from "@muloo/shared";
import {
  createProjectFromTemplateRequestSchema,
  updateProjectDiscoverySectionRequestSchema,
  updateProjectLifecycleDesignRequestSchema,
  updateProjectMetadataRequestSchema,
  updateProjectPipelinesDesignRequestSchema,
  updateProjectPropertiesDesignRequestSchema,
  updateProjectScopeRequestSchema
} from "@muloo/shared";
import { z, ZodError } from "zod";

const { PrismaClient } = Prisma;
const prisma = new PrismaClient();

const contentTypes: Record<string, string> = {
  ".json": "application/json; charset=utf-8"
};

const pendingPortalPrefix = "pending-portal-";
const authCookieName = "muloo_deploy_os_auth";
const clientAuthCookieName = "muloo_deploy_os_client_auth";
const defaultSimpleAuthUsername = "jarrud";
const defaultSimpleAuthPassword = "deployos";
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
  "commerce"
] as const;
const validCustomerPlatformTierValues = [
  "starter",
  "professional",
  "enterprise"
] as const;
const validImplementationApproachValues = [
  "pragmatic_poc",
  "best_practice"
] as const;
const validHubTierValues = [
  "free",
  "starter",
  "professional",
  "enterprise",
  "included"
] as const;
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
const industryOptions = [
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
    notes: "Alternative agent workflows, QA passes, summarisation, and future assistants.",
    isEnabled: false
  },
  {
    providerKey: "gemini",
    label: "Google Gemini",
    connectionType: "api_key",
    defaultModel: "gemini-2.5-pro",
    endpointUrl: null,
    notes: "Meeting-summary workflows and discovery ingestion from call outputs.",
    isEnabled: false
  }
] as const;
const defaultAiWorkflowRouting = [
  {
    workflowKey: "discovery_extract",
    label: "Discovery Extraction",
    providerKey: "gemini",
    modelOverride: "gemini-2.5-pro",
    notes: "Session note extraction, transcript parsing, and first-pass field drafting."
  },
  {
    workflowKey: "discovery_summary",
    label: "Discovery Summary",
    providerKey: "anthropic",
    modelOverride: "claude-sonnet-4-20250514",
    notes: "Project-level discovery synthesis, risks, and operator-friendly next questions."
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
    notes: "Prepare task-level execution briefs, checkpoints, and risk notes for queued agent delivery."
  },
  {
    workflowKey: "project_email_drafting",
    label: "Project Email Drafting",
    providerKey: "openai",
    modelOverride: "gpt-5.4",
    notes: "Draft internal-to-client emails from the saved project summary, quote status, and supporting context."
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
type ClientQuestionnaireConfig = Record<number, ClientQuestionnaireSessionConfig>;
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
  return validHubTierValues.includes(value as (typeof validHubTierValues)[number]);
}

function normalizePlatformTierSelections(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, string>;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, tier]) =>
        validPlatformTierSelectionKeys.includes(
          key as (typeof validPlatformTierSelectionKeys)[number]
        ) && typeof tier === "string" && isValidHubTier(tier.trim().toLowerCase())
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

  let fit: PackagingAssessment["fit"] = warnings.length > 0 ? "attention" : "good";

  for (const [productKey, requiredTier] of Object.entries(requiredProductTiers)) {
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

async function loadWorkspaceUsers() {
  await ensureWorkspaceUsersSeeded();

  return prisma.workspaceUser.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });
}

async function createWorkspaceUser(value: {
  name?: unknown;
  email?: unknown;
  role?: unknown;
  isActive?: unknown;
  sortOrder?: unknown;
}) {
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const email =
    typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const role = typeof value.role === "string" ? value.role.trim() : "";
  const sortOrder =
    typeof value.sortOrder === "number"
      ? value.sortOrder
      : Number(value.sortOrder);

  if (!name || !email || !role) {
    throw new Error("name, email, and role are required");
  }

  const user = await prisma.workspaceUser.create({
    data: {
      name,
      email,
      role,
      isActive: value.isActive === false ? false : true,
      sortOrder: Number.isFinite(sortOrder) ? Math.round(sortOrder) : 999
    }
  });

  return serializeWorkspaceUser(user);
}

async function updateWorkspaceUser(
  userId: string,
  value: {
    name?: unknown;
    email?: unknown;
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

async function convertWorkRequestToProject(requestId: string) {
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
    workRequest.requestType === "project_brief" ? "discovery" : "standalone_quote";
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
      selectedHubs: scopeType === "standalone_quote"
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

function isUniqueConstraintError(error: unknown): boolean {
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

function normalizeProject<T extends { portal: { portalId: string } | null }>(
  project: T
): T {
  return project.portal &&
    project.portal.portalId.startsWith(pendingPortalPrefix)
    ? ({ ...project, portal: null } as T)
    : project;
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

  return [1, 2, 3, 4].reduce<ClientQuestionnaireConfig>((config, sessionNumber) => {
    const rawSession = source[String(sessionNumber)] ?? source[sessionNumber];
    const defaultSession = defaults[sessionNumber] ?? defaults[1]!;
    if (!rawSession || typeof rawSession !== "object" || Array.isArray(rawSession)) {
      config[sessionNumber] = defaultSession;
      return config;
    }

    const sessionRecord = rawSession as Record<string, unknown>;
    const usedKeys = new Set<string>();

    const questions = Array.isArray(sessionRecord.questions)
      ? sessionRecord.questions
          .filter(
            (
              question
            ): question is Record<string, unknown> =>
              Boolean(question) &&
              typeof question === "object" &&
              !Array.isArray(question)
          )
          .map((question, index) => {
            const baseKey =
              typeof question.key === "string" && question.key.trim().length > 0
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
                typeof question.label === "string" && question.label.trim().length > 0
                  ? question.label.trim()
                  : `Question ${index + 1}`,
              hint:
                typeof question.hint === "string" ? question.hint.trim() : ""
            };
          })
      : [];

    config[sessionNumber] = {
      title:
        typeof sessionRecord.title === "string" && sessionRecord.title.trim().length > 0
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
          : defaultSession.enabled ?? true,
      questions: questions.length > 0 ? questions : defaultSession.questions
    };

    config[sessionNumber].questions = config[sessionNumber].questions.map((question, index) => {
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
    });

    return config;
  }, {} as ClientQuestionnaireConfig);
}

function getEnabledClientInputSections(config: ClientQuestionnaireConfig): number[] {
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
    new Set(requestedSections.filter((section) => availableSections.includes(section)))
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

function sendJson(
  response: http.ServerResponse,
  statusCode: number,
  payload: unknown
): void {
  response.writeHead(statusCode, { "Content-Type": contentTypes[".json"] });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
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

function setCookie(
  response: http.ServerResponse,
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

  response.setHeader("Set-Cookie", cookieParts.join("; "));
}

function resolveSimpleAuthCredentials() {
  return {
    username: process.env.SIMPLE_AUTH_USERNAME ?? defaultSimpleAuthUsername,
    password: process.env.SIMPLE_AUTH_PASSWORD ?? defaultSimpleAuthPassword
  };
}

function createSimpleAuthToken(username: string) {
  const secret =
    process.env.SIMPLE_AUTH_SECRET ?? "muloo-deploy-os-internal-auth";

  return Buffer.from(`${username}:${secret}`).toString("base64url");
}

function createClientAuthToken(userId: string) {
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

  if (
    typeof decoded.expiresAt !== "number" ||
    decoded.expiresAt < Date.now()
  ) {
    throw new Error("OAuth state has expired");
  }

  return decoded;
}

function isAuthenticated(request: http.IncomingMessage) {
  const cookies = parseCookies(request);
  const { username } = resolveSimpleAuthCredentials();

  return cookies[authCookieName] === createSimpleAuthToken(username);
}

function getAuthenticatedClientUserId(request: http.IncomingMessage) {
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

async function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const content = Buffer.concat(chunks).toString("utf8").trim();
  return content.length > 0 ? (JSON.parse(content) as unknown) : {};
}

function matchProjectRoute(pathname: string): {
  projectId: string;
  resource?:
    | "modules"
    | "summary"
    | "validation"
    | "readiness"
    | "executions"
    | "scope"
    | "discovery"
    | "status"
    | "changes"
    | "email-draft"
    | "send-email";
} | null {
  const match =
    /^\/api\/projects\/([^/]+?)(?:\/(modules|summary|validation|readiness|executions|scope|discovery|status|changes|email-draft|send-email))?$/.exec(
      pathname
    );

  if (!match || !match[1]) {
    return null;
  }

  const projectId = decodeURIComponent(match[1]);
  const resource = match[2];
  const normalizedResource =
    resource === "modules" ||
    resource === "summary" ||
    resource === "validation" ||
    resource === "readiness" ||
    resource === "executions" ||
    resource === "scope" ||
    resource === "discovery" ||
    resource === "status" ||
    resource === "changes" ||
    resource === "email-draft" ||
    resource === "send-email"
      ? resource
      : undefined;

  return normalizedResource
    ? { projectId, resource: normalizedResource }
    : { projectId };
}

function matchClientDirectoryRoute(pathname: string): {
  clientId?: string;
  resource?: "contacts";
  contactId?: string;
} | null {
  const match =
    /^\/api\/clients(?:\/([^/]+?)(?:\/(contacts)(?:\/([^/]+))?)?)?$/.exec(
      pathname
    );

  if (!match) {
    return null;
  }

  return {
    ...(match[1] ? { clientId: decodeURIComponent(match[1]) } : {}),
    ...(match[2] === "contacts" ? { resource: "contacts" as const } : {}),
    ...(match[3] ? { contactId: decodeURIComponent(match[3]) } : {})
  };
}

function matchClientContactPortalAccessRoute(pathname: string): {
  clientId: string;
  contactId: string;
} | null {
  const match =
    /^\/api\/clients\/([^/]+?)\/contacts\/([^/]+?)\/portal-access$/.exec(pathname);

  if (!match?.[1] || !match[2]) {
    return null;
  }

  return {
    clientId: decodeURIComponent(match[1]),
    contactId: decodeURIComponent(match[2])
  };
}

function matchProjectQuoteRoute(pathname: string): {
  projectId: string;
  action?: "share";
} | null {
  const match =
    /^\/api\/projects\/([^/]+?)\/quote(?:\/(share))?$/.exec(pathname);

  if (!match || !match[1]) {
    return null;
  }

  return {
    projectId: decodeURIComponent(match[1]),
    ...(match[2] === "share" ? { action: "share" as const } : {})
  };
}

function matchProjectDesignRoute(pathname: string): {
  projectId: string;
  resource?: "lifecycle" | "properties" | "pipelines";
} | null {
  const match =
    /^\/api\/projects\/([^/]+?)\/design(?:\/(lifecycle|properties|pipelines))?$/.exec(
      pathname
    );

  if (!match || !match[1]) {
    return null;
  }

  const resource =
    match[2] === "lifecycle" ||
    match[2] === "properties" ||
    match[2] === "pipelines"
      ? match[2]
      : undefined;

  return {
    projectId: decodeURIComponent(match[1]),
    ...(resource ? { resource } : {})
  };
}

function matchTemplateRoute(pathname: string): { templateId: string } | null {
  const match = /^\/api\/templates\/([^/]+)$/.exec(pathname);

  if (!match || !match[1]) {
    return null;
  }

  return {
    templateId: decodeURIComponent(match[1])
  };
}

function matchProductRoute(pathname: string): { productId?: string } | null {
  const match = /^\/api\/products(?:\/([^/]+))?$/.exec(pathname);

  if (!match) {
    return null;
  }

  return match[1] ? { productId: decodeURIComponent(match[1]) } : {};
}

function matchWorkspaceUserRoute(pathname: string): { userId?: string } | null {
  const match = /^\/api\/users(?:\/([^/]+))?$/.exec(pathname);

  if (!match) {
    return null;
  }

  return match[1] ? { userId: decodeURIComponent(match[1]) } : {};
}

function matchProviderConnectionRoute(pathname: string): {
  providerKey?: string;
} | null {
  const match = /^\/api\/provider-connections(?:\/([^/]+))?$/.exec(pathname);

  if (!match) {
    return null;
  }

  return match[1] ? { providerKey: decodeURIComponent(match[1]) } : {};
}

function matchAiRoutingRoute(pathname: string): {
  workflowKey?: string;
} | null {
  const match = /^\/api\/ai-routing(?:\/([^/]+))?$/.exec(pathname);

  if (!match) {
    return null;
  }

  return match[1] ? { workflowKey: decodeURIComponent(match[1]) } : {};
}

function matchAgentRoute(pathname: string): { agentId?: string } | null {
  const match = /^\/api\/agents(?:\/([^/]+))?$/.exec(pathname);

  if (!match) {
    return null;
  }

  return match[1] ? { agentId: decodeURIComponent(match[1]) } : {};
}

function matchDeliveryTemplateRoute(pathname: string): {
  templateId?: string;
} | null {
  const match = /^\/api\/delivery-templates(?:\/([^/]+))?$/.exec(pathname);

  if (!match) {
    return null;
  }

  return match[1] ? { templateId: decodeURIComponent(match[1]) } : {};
}

function matchWorkRequestRoute(pathname: string): {
  requestId?: string;
  action?: "convert" | "append-to-delivery";
} | null {
  const match = /^\/api\/work-requests(?:\/([^/]+?)(?:\/(convert|append-to-delivery))?)?$/.exec(
    pathname
  );

  if (!match) {
    return null;
  }

  return match[1]
    ? {
        requestId: decodeURIComponent(match[1]),
        ...(match[2] === "convert"
          ? { action: "convert" as const }
          : match[2] === "append-to-delivery"
            ? { action: "append-to-delivery" as const }
            : {})
      }
    : {};
}

function matchClientProjectRoute(pathname: string): {
  projectId?: string;
  resource?: "messages" | "submissions" | "tasks" | "quote";
  sessionId?: number;
} | null {
  const listMatch = /^\/api\/client\/projects$/.exec(pathname);

  if (listMatch) {
    return {};
  }

  const projectMatch = /^\/api\/client\/projects\/([^/]+?)(?:\/(tasks|messages|quote)|\/submissions\/([1-4]))?$/.exec(
    pathname
  );

  if (!projectMatch || !projectMatch[1]) {
    return null;
  }

  return {
    projectId: decodeURIComponent(projectMatch[1]),
    ...(projectMatch[2] === "tasks" ||
    projectMatch[2] === "messages" ||
    projectMatch[2] === "quote"
      ? {
          resource: projectMatch[2] as "tasks" | "messages" | "quote"
        }
      : projectMatch[3]
      ? {
          resource: "submissions" as const,
          sessionId: Number(projectMatch[3])
        }
      : {})
  };
}

function matchClientProjectQuoteApprovalRoute(pathname: string): {
  projectId: string;
} | null {
  const match =
    /^\/api\/client\/projects\/([^/]+?)\/quote\/approve$/.exec(pathname);

  if (!match || !match[1]) {
    return null;
  }

  return {
    projectId: decodeURIComponent(match[1])
  };
}

function matchClientWorkRequestRoute(pathname: string): null | {} {
  return /^\/api\/client\/work-requests$/.test(pathname) ? {} : null;
}

function matchInboxRoute(pathname: string): { resource?: "summary" } | null {
  const match = /^\/api\/inbox(?:\/(summary))?$/.exec(pathname);

  if (!match) {
    return null;
  }

  return match[1] === "summary" ? { resource: "summary" } : {};
}

function matchClientInboxRoute(
  pathname: string
): { resource?: "summary" } | null {
  const match = /^\/api\/client\/inbox(?:\/(summary))?$/.exec(pathname);

  if (!match) {
    return null;
  }

  return match[1] === "summary" ? { resource: "summary" } : {};
}

function matchProjectClientUsersRoute(pathname: string): {
  projectId: string;
} | null {
  const match = /^\/api\/projects\/([^/]+?)\/client-users$/.exec(pathname);

  if (!match || !match[1]) {
    return null;
  }

  return {
    projectId: decodeURIComponent(match[1])
  };
}

function matchProjectClientUserRoute(pathname: string): {
  projectId: string;
  userId: string;
} | null {
  const match =
    /^\/api\/projects\/([^/]+?)\/client-users\/([^/]+?)$/.exec(pathname);

  if (!match || !match[1] || !match[2]) {
    return null;
  }

  return {
    projectId: decodeURIComponent(match[1]),
    userId: decodeURIComponent(match[2])
  };
}

function matchProjectClientUserActionRoute(pathname: string): {
  projectId: string;
  userId: string;
  action: "invite-link" | "reset-link";
} | null {
  const match =
    /^\/api\/projects\/([^/]+?)\/client-users\/([^/]+?)\/(invite-link|reset-link)$/.exec(
      pathname
    );

  if (!match || !match[1] || !match[2] || !match[3]) {
    return null;
  }

  return {
    projectId: decodeURIComponent(match[1]),
    userId: decodeURIComponent(match[2]),
    action: match[3] as "invite-link" | "reset-link"
  };
}

function matchProjectModuleRoute(pathname: string): {
  projectId: string;
  moduleKey: string;
} | null {
  const match = /^\/api\/projects\/([^/]+)\/modules\/([^/]+)$/.exec(pathname);

  if (!match || !match[1] || !match[2]) {
    return null;
  }

  return {
    projectId: decodeURIComponent(match[1]),
    moduleKey: decodeURIComponent(match[2])
  };
}

function matchExecutionRoute(pathname: string): {
  executionId: string;
  resource?: "steps";
} | null {
  const match = /^\/api\/executions\/([^/]+?)(?:\/(steps))?$/.exec(pathname);

  if (!match || !match[1]) {
    return null;
  }

  return match[2] === "steps"
    ? {
        executionId: decodeURIComponent(match[1]),
        resource: "steps"
      }
    : {
        executionId: decodeURIComponent(match[1])
      };
}

function matchRunRoute(pathname: string): {
  runId: string;
} | null {
  const match = /^\/api\/runs\/([^/]+?)$/.exec(pathname);

  if (!match || !match[1]) {
    return null;
  }

  return {
    runId: decodeURIComponent(match[1])
  };
}

function matchDiscoveryRoute(pathname: string): { projectId: string } | null {
  const match = /^\/api\/discovery\/([^/]+)\/sessions$/.exec(pathname);

  if (!match || !match[1]) {
    return null;
  }

  return {
    projectId: decodeURIComponent(match[1])
  };
}

function matchProjectBlueprintRoute(pathname: string): {
  projectId: string;
  action?: "generate";
} | null {
  const match = /^\/api\/projects\/([^/]+?)\/blueprint(?:\/(generate))?$/.exec(
    pathname
  );

  if (!match || !match[1]) {
    return null;
  }

  return {
    projectId: decodeURIComponent(match[1]),
    ...(match[2] === "generate" ? { action: "generate" } : {})
  };
}

function matchProjectTasksRoute(pathname: string): {
  projectId: string;
  action?: "generate-plan";
  taskId?: string;
} | null {
  const match =
    /^\/api\/projects\/([^/]+?)\/tasks(?:\/(generate-plan|[^/]+))?$/.exec(
      pathname
    );

  if (!match || !match[1]) {
    return null;
  }

  if (!match[2]) {
    return {
      projectId: decodeURIComponent(match[1])
    };
  }

  if (match[2] === "generate-plan") {
    return {
      projectId: decodeURIComponent(match[1]),
      action: "generate-plan"
    };
  }

  return {
    projectId: decodeURIComponent(match[1]),
    taskId: decodeURIComponent(match[2])
  };
}

function matchProjectTaskAgentRunRoute(pathname: string): {
  projectId: string;
  taskId: string;
} | null {
  const match = /^\/api\/projects\/([^/]+?)\/tasks\/([^/]+?)\/queue-agent-run$/.exec(pathname);

  if (!match || !match[1] || !match[2]) {
    return null;
  }

  return {
    projectId: decodeURIComponent(match[1]),
    taskId: decodeURIComponent(match[2])
  };
}

function matchProjectMessagesRoute(pathname: string): {
  projectId: string;
} | null {
  const match = /^\/api\/projects\/([^/]+?)\/messages$/.exec(pathname);

  if (!match || !match[1]) {
    return null;
  }

  return {
    projectId: decodeURIComponent(match[1])
  };
}

function matchProjectDiscoverySummaryRoute(
  pathname: string
): { projectId: string } | null {
  const match = /^\/api\/projects\/([^/]+?)\/discovery-summary$/.exec(pathname);

  if (!match || !match[1]) {
    return null;
  }

  return {
    projectId: decodeURIComponent(match[1])
  };
}

function matchProjectSessionRoute(pathname: string): {
  projectId: string;
  sessionId: number;
} | null {
  const match = /^\/api\/projects\/([^/]+?)\/sessions\/([1-4])$/.exec(pathname);

  if (!match || !match[1] || !match[2]) {
    return null;
  }

  return {
    projectId: decodeURIComponent(match[1]),
    sessionId: Number(match[2])
  };
}

function matchProjectSessionEvidenceRoute(pathname: string): {
  projectId: string;
  sessionId: number;
} | null {
  const match =
    /^\/api\/projects\/([^/]+?)\/sessions\/([0-4])\/evidence$/.exec(pathname);

  if (!match || !match[1] || !match[2]) {
    return null;
  }

  return {
    projectId: decodeURIComponent(match[1]),
    sessionId: Number(match[2])
  };
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
    clientChampionFirstName?: string | null;
    clientChampionLastName?: string | null;
    clientChampionEmail?: string | null;
    selectedHubs: string[];
    engagementType: Prisma.$Enums.EngagementType;
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
    } | null;
  }
>(project: T) {
  const normalizedProject = normalizeProject(project);
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
    hubsInScope: normalizedProject.selectedHubs
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
    client: {
      name: project.client.name,
      website: project.client.website
    }
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
    productLines: z.array(projectQuoteProductLineSchema).parse(
      quote.productLines
    ),
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

async function loadLatestProjectQuote(
  projectId: string,
  statuses?: string[]
) {
  const quote = await prisma.projectQuote.findFirst({
    where: {
      projectId,
      ...(statuses?.length ? { status: { in: statuses } } : {})
    },
    orderBy: [{ version: "desc" }]
  });

  return quote ? serializeProjectQuote(quote) : null;
}

function serializeClientPortalUser<
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
    value.quoteApprovalStatus === "approved" ||
    Boolean(value.scopeLockedAt)
  );
}

function serializeTask<
  T extends {
    id: string;
    projectId: string;
    title: string;
    description: string | null;
    category: string | null;
    executionType: string;
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
      createdAt: Date;
      completedAt: Date | null;
    }>;
    createdAt: Date;
    updatedAt: Date;
  }
>(task: T) {
  const latestExecutionJob = task.executionJobs?.[0] ?? null;

  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    category: task.category,
    executionType: task.executionType,
    priority: task.priority,
    status: task.status,
    plannedHours: task.plannedHours,
    actualHours: task.actualHours,
    qaRequired: task.qaRequired,
    executionReadiness: task.executionReadiness,
    approvalRequired: task.approvalRequired,
    dependencyIds: task.dependencyIds,
    assigneeType: task.assigneeType,
    scopeOrigin: task.scopeOrigin ?? "baseline",
    changeRequestId: task.changeRequestId ?? null,
    assignedAgentId: task.assignedAgentId ?? null,
    assignedAgentName: task.assignedAgent?.name ?? null,
    latestExecutionJob: latestExecutionJob
      ? {
          id: latestExecutionJob.id,
          status: latestExecutionJob.status,
          resultStatus: latestExecutionJob.resultStatus,
          createdAt: latestExecutionJob.createdAt.toISOString(),
          completedAt: latestExecutionJob.completedAt?.toISOString() ?? null
        }
      : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString()
  };
}

function serializeExecutionJob<
  T extends {
    id: string;
    projectId: string;
    taskId: string | null;
    moduleKey: string;
    executionMethod: string;
    mode: string;
    status: string;
    payload: unknown | null;
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
    moduleKey: job.moduleKey,
    executionMethod: job.executionMethod,
    mode: job.mode,
    status: job.status,
    payload: job.payload,
    resultStatus: job.resultStatus,
    outputLog: job.outputLog,
    errorLog: job.errorLog,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString()
  };
}

async function loadAgentRuns() {
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

async function updateAgentRun(
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
    if (["completed", "failed", "cancelled", "review_ready"].includes(normalizedStatus)) {
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
    updateData.resultStatus = typeof value.resultStatus === "string" ? value.resultStatus.trim() || null : null;
  }

  if (value.outputLog !== undefined) {
    if (value.outputLog !== null && typeof value.outputLog !== "string") {
      throw new Error("outputLog must be a string or null");
    }
    updateData.outputLog = typeof value.outputLog === "string" ? value.outputLog : null;
  }

  if (value.errorLog !== undefined) {
    if (value.errorLog !== null && typeof value.errorLog !== "string") {
      throw new Error("errorLog must be a string or null");
    }
    updateData.errorLog = typeof value.errorLog === "string" ? value.errorLog : null;
  }

  const run = await prisma.executionJob.update({
    where: { id: runId },
    data: updateData,
    include: {
      project: { select: { name: true } },
      task: { select: { id: true, title: true, plannedHours: true, actualHours: true } }
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
      const resolvedActualHours = run.task?.actualHours ?? run.task?.plannedHours ?? null;
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
${supportingContext
              .map((item) => `- ${item}`)
              .join("\n")}`
          : "Supporting context: none attached",
        blueprintTasks.length > 0
          ? `Blueprint context:
${blueprintTasks
              .map((item) => `- ${item}`)
              .join("\n")}`
          : null,
        messageContext.length > 0
          ? `Recent project messages:
${messageContext
              .map((item) => `- ${item}`)
              .join("\n")}`
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

async function queueAgentRun(projectId: string, taskId: string) {
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

function normalizeRequiredTaskString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
}

function normalizeChangeDeliveryTasks(value: unknown): ChangeDeliveryTaskPlan[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((task): task is Record<string, unknown> => Boolean(task) && typeof task === "object")
    .map((task) => {
      const plannedHours =
        typeof task.plannedHours === "number"
          ? task.plannedHours
          : Number(task.plannedHours);
      const assigneeType =
        typeof task.assigneeType === "string" ? task.assigneeType.trim() : "Human";
      const normalizedAssigneeType =
        assigneeType === "Agent" || assigneeType === "Client" ? assigneeType : "Human";
      const priority =
        typeof task.priority === "string" && task.priority.trim().length > 0
          ? task.priority.trim().toLowerCase()
          : "medium";

      return {
        title: normalizeRequiredTaskString(task.title, "change task title"),
        description:
          typeof task.description === "string" ? task.description.trim() : "",
        category: typeof task.category === "string" ? task.category.trim() : "",
        plannedHours: Number.isFinite(plannedHours) && plannedHours >= 0 ? plannedHours : 0,
        assigneeType: normalizedAssigneeType,
        executionType:
          typeof task.executionType === "string" && task.executionType.trim().length > 0
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
      const repairedText = await callAiWorkflow("json_repair", 
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

      if (repairError instanceof SyntaxError || repairError instanceof ZodError) {
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
        createBlueprintTask("Validate discovery findings and confirm scope", "Human", 3, 1),
        createBlueprintTask("Confirm client stakeholders, owners, and approvals", "Client", 1, 2),
        createBlueprintTask("Set up project workspace, documentation, and governance", "Human", 2, 3)
      ]
    },
    {
      phase: 2,
      phaseName: "Data & Process Design",
      tasks: [
        createBlueprintTask("Map current data sources and migration requirements", "Human", 4, 1),
        createBlueprintTask("Prepare data cleanup list and import strategy", "Agent", 3, 2),
        createBlueprintTask("Approve target lifecycle, pipeline, and process design", "Client", 1, 3)
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
      createBlueprintTask("Configure Sales Hub properties, pipelines, and handoff stages", "Human", 5, buildTasks.length + 1),
      createBlueprintTask("Generate sales object and field checklist", "Agent", 2, buildTasks.length + 1)
    );
  }

  if (discovery.selectedHubs.includes("marketing")) {
    buildTasks.push(
      createBlueprintTask("Configure marketing lifecycle, campaign, and lead routing setup", "Human", 4, buildTasks.length + 1),
      createBlueprintTask("Draft marketing automation and nurture recommendations", "Agent", 2, buildTasks.length + 1)
    );
  }

  if (discovery.selectedHubs.includes("service")) {
    buildTasks.push(
      createBlueprintTask("Configure service pipelines, inbox, and support process foundations", "Human", 4, buildTasks.length + 1)
    );
  }

  if (discovery.selectedHubs.includes("cms")) {
    buildTasks.push(
      createBlueprintTask("Align CMS/content requirements with website rebuild dependencies", "Human", 3, buildTasks.length + 1)
    );
  }

  if (discovery.selectedHubs.includes("ops")) {
    buildTasks.push(
      createBlueprintTask("Define RevOps governance, custom objects, and operational controls", "Human", 4, buildTasks.length + 1)
    );
  }

  if (discovery.selectedHubs.includes("data")) {
    buildTasks.push(
      createBlueprintTask("Configure data management, quality, and sync foundations", "Human", 4, buildTasks.length + 1)
    );
  }

  if (discovery.selectedHubs.includes("commerce")) {
    buildTasks.push(
      createBlueprintTask("Configure commerce, quote, and payment foundations", "Human", 4, buildTasks.length + 1)
    );
  }

  if ((session3.integration_requirements ?? "").trim().length > 0) {
    buildTasks.push(
      createBlueprintTask("Assess and sequence required integrations", "Human", 3, buildTasks.length + 1)
    );
  }

  phases.push({
    phase: 3,
    phaseName: "Hub Configuration & Automation",
    tasks:
      buildTasks.length > 0
        ? buildTasks
        : [
            createBlueprintTask("Configure core HubSpot setup based on approved future-state design", "Human", 6, 1),
            createBlueprintTask("Prepare automation implementation checklist", "Agent", 2, 2)
          ]
  });

  phases.push({
    phase: 4,
    phaseName: "Testing, Enablement & Launch",
    tasks: [
      createBlueprintTask("Run QA on records, workflows, and reporting outputs", "Human", 3, 1),
      createBlueprintTask("Support user acceptance testing and change readiness", "Client", 2, 2),
      createBlueprintTask("Prepare handover, adoption, and next-step recommendations", "Human", 3, 3)
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
        createBlueprintTask("Audit legacy data structure and migration constraints", "Human", 4, 1),
        createBlueprintTask("Prepare migration mapping and issue log", "Agent", 3, 2),
        createBlueprintTask("Approve data owners and cutover responsibilities", "Client", 1, 3)
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

  if (/report/i.test(scopeText) || (session3.reporting_requirements ?? "").trim().length > 0) {
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
    includesAny(evidenceText, [
      "documentation",
      "handover",
      "sop",
      "process"
    ])
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

  if (
    includesAny(evidenceText, ["api", "export", "extract", "platform"])
  ) {
    questions.push(
      "What access is available to the current platform: API, database, scheduled export, or manual extracts?"
    );
  }

  if (
    includesAny(evidenceText, ["attendance", "registration", "event"])
  ) {
    questions.push(
      "How do the source records distinguish registration, attendance, cancellation, no-show, and CPD completion today?"
    );
  }

  if (
    includesAny(evidenceText, ["duplicate", "identity", "company"])
  ) {
    questions.push(
      "Which fields can be trusted most for identity resolution: email, phone, company, CRM ID, or another source key?"
    );
  }

  if (
    includesAny(evidenceText, ["dashboard", "reporting", "executive"])
  ) {
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
    includesAny(evidenceText, [
      "documentation",
      "handover",
      "sop",
      "process"
    ])
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
    ? selectedHubs
        .map((hub) => hubLabelMap[hub] ?? hub)
        .join(", ")
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
    includesAny(normalizedName, ["data", "dedupe", "duplicate", "enrichment", "sync"])
  ) {
    return false;
  }

  if (
    !guidance.hasCommerceScope &&
    includesAny(normalizedName, ["commerce", "payment", "invoice", "checkout", "subscription"])
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
        includesAny(task.name.toLowerCase(), ["package", "tier", "upgrade", "licen"])
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

function buildPlanSeedFromTemplate(
  template: {
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
  }
): StandalonePlanSeedTask[] {
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
    executionReadiness: task.assigneeType === "Agent" ? "ready_with_review" : "not_ready"
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
            description: `${packagingAssessment.summary} ${packagingAssessment.warnings.join(" ")}`.trim(),
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
      dependsOn: ["Implement page templates, linking, and technical configuration"]
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
  task: { title: string; description: string; category: string; executionType: string }
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
    if (normalizedAction && searchableText.includes(normalizedAction)) {
      score += 3;
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
  agents: Array<{ id: string; allowedActions: string[]; purpose: string; name: string }>,
  task: { title: string; description: string; category: string; executionType: string; assigneeType: string }
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
    throw new Error("Generated project plans are currently only available for standalone scoped jobs");
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

  const createdTasks = [] as Array<Awaited<ReturnType<typeof prisma.task.create>>>;

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
        executionReadiness: task.executionReadiness ?? (task.assigneeType === "Agent" ? "ready_with_review" : "not_ready")
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

  const availableAgents = await loadPreferredAgentIdsByServiceFamily(project.serviceFamily);

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

  const createdTasks = [] as Array<Awaited<ReturnType<typeof prisma.task.create>>>;

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

async function ensureProjectPlanGenerationAllowed(projectId: string) {
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
    dataReadinessRating:
      session4?.fields.data_readiness_rating?.trim() ?? "",
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

async function generateSolutionOptions(input: {
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

async function generateProjectEmailDraft(input: {
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

  const contextPreview = evidenceItems
    .slice(0, 8)
    .map((item) => {
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

  return parseModelJson(rawDraft, projectEmailDraftSchema, "project-email-draft");
}

async function generateStandaloneScopeSummary(
  discoveryPayload: NonNullable<Awaited<ReturnType<typeof loadProjectDiscoveryForBlueprint>>>
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
    if (
      parseError instanceof SyntaxError ||
      parseError instanceof ZodError
    ) {
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
      partialSummary?.outOfScopeItems && partialSummary.outOfScopeItems.length > 0
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
        partialSummary?.futureUpgradePath ||
        fallbackSummary.futureUpgradePath,
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

async function generateDiscoverySummary(projectId: string) {
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

  const rawSummary = await callAiWorkflow("discovery_summary",
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

async function loadDiscoverySummary(projectId: string) {
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

async function loadDiscoverySummaryWithRetry(
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

async function ensureProjectScopeUnlocked(
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

async function shareProjectQuote(projectId: string, payload: unknown) {
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
              context: normalizedPayload.context as Prisma.Prisma.InputJsonValue,
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
    body:
      "Your quote is now available in the client portal. Open this project and use the Open Quote button to review the latest commercial scope and approval pack."
  });

  return {
    project: serializeProject(updatedProject),
    quote: serializeProjectQuote(createdQuote)
  };
}

async function approveProjectQuote(projectId: string, clientUserId: string) {
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
    throw new Error("Quote must be shared to the client portal before approval.");
  }

  const approverName = `${access.user.firstName} ${access.user.lastName}`.trim();
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
        throw new Error("Quote has not yet been published to the client portal.");
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
    body:
      "Approved the quote in the client portal. The project scope is now locked for delivery."
  });

  return {
    project: serializeProject(updatedProject),
    quote: serializeProjectQuote(approvedQuote)
  };
}

async function resetDiscoverySummary(projectId: string) {
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
    const rawBlueprint = await callAiWorkflow("blueprint_generation",
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
    const rawBlueprint = await callAiWorkflow("scope_blueprint_generation",
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
            customerPlatformTier:
              discoveryPayload.project.customerPlatformTier,
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
        implementationApproach:
          discoveryPayload.project.implementationApproach,
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

async function generateBlueprintForProject(projectId: string) {
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
      console.error("Failed to refresh project plan after blueprint generation", error);
    });
    return blueprint;
  }

  const blueprint = await generateBlueprintFromDiscovery(projectId);
  await generateProjectPlan(projectId).catch((error) => {
    console.error("Failed to refresh project plan after blueprint generation", error);
  });
  return blueprint;
}

async function loadBlueprint(projectId: string) {
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

function serializeWorkspaceUser<
  T extends {
    id: string;
    name: string;
    email: string;
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
    isConnected: Boolean(connection.connectedEmail),
    enabled: connection.enabled,
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString()
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
  const existingCount = await prisma.workspaceProviderConnection.count();

  if (existingCount > 0) {
    return;
  }

  await prisma.workspaceProviderConnection.createMany({
    data: defaultProviderConnections.map((provider) => ({
      ...provider
    }))
  });
}

async function ensureAiRoutingSeeded() {
  const existingCount = await prisma.workspaceAiRouting.count();

  if (existingCount > 0) {
    return;
  }

  await prisma.workspaceAiRouting.createMany({
    data: defaultAiWorkflowRouting.map((routing) => ({
      ...routing
    }))
  });
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
  const existingConnection = await prisma.workspaceEmailOAuthConnection.findUnique({
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
        "https://www.googleapis.com/auth/gmail.send"
      ],
      enabled: false
    }
  });
}

async function ensureAgentCatalogSeeded() {
  const existingCount = await prisma.agentDefinition.count();

  if (existingCount > 0) {
    return;
  }

  await prisma.agentDefinition.createMany({
    data: defaultAgentCatalog.map((agent) => ({
      ...agent,
      allowedActions: [...agent.allowedActions]
    }))
  });
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

async function loadProductCatalog() {
  await ensureProductCatalogSeeded();

  const products = await prisma.productCatalogItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });

  return products.map((product) => serializeProductCatalogItem(product));
}

async function loadAgentCatalog() {
  await ensureAgentCatalogSeeded();

  const agents = await prisma.agentDefinition.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });

  return agents.map((agent) => serializeAgentDefinition(agent));
}

async function loadProviderConnections() {
  await ensureProviderConnectionsSeeded();

  const providers = await prisma.workspaceProviderConnection.findMany({
    orderBy: [{ label: "asc" }]
  });

  return providers.map((provider) =>
    serializeWorkspaceProviderConnection(provider)
  );
}

function normalizeHubSpotBaseUrl(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return "https://api.hubapi.com";
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

async function resolveHubSpotAgentConnection() {
  await ensureProviderConnectionsSeeded();

  const provider = await prisma.workspaceProviderConnection.findUnique({
    where: { providerKey: "hubspot_oauth" }
  });
  const envAccessToken = process.env.HUBSPOT_ACCESS_TOKEN?.trim() ?? "";
  const providerAccessToken =
    provider?.isEnabled && provider.apiKey?.trim() ? provider.apiKey.trim() : "";
  const accessToken = envAccessToken || providerAccessToken;
  const source = envAccessToken
    ? "env"
    : providerAccessToken
      ? "provider_connection"
      : "missing";
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
    providerEnabled: provider?.isEnabled ?? false
  };
}

function buildHubSpotAgentCapabilitiesPayload(input: {
  ready: boolean;
  source: string;
  baseUrl: string;
  portalId: string | null;
  providerEnabled: boolean;
}) {
  return {
    connection: {
      ready: input.ready,
      source: input.source,
      baseUrl: input.baseUrl,
      portalId: input.portalId,
      providerEnabled: input.providerEnabled
    },
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

async function executeHubSpotAgentAction(value: {
  action?: unknown;
  input?: unknown;
  dryRun?: unknown;
}) {
  const action = typeof value.action === "string" ? value.action.trim() : "";
  const dryRun = value.dryRun !== false;
  const input =
    value.input && typeof value.input === "object" && !Array.isArray(value.input)
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

  const connection = await resolveHubSpotAgentConnection();
  const connectionSummary = {
    ready: connection.ready,
    source: connection.source,
    baseUrl: connection.baseUrl,
    portalId: connection.portalId
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
      "HubSpot auth is not configured. Add HUBSPOT_ACCESS_TOKEN or enable the HubSpot provider connection first."
    );
  }

  const client = new HubSpotClient({
    accessToken: connection.accessToken,
    baseUrl: connection.baseUrl,
    logger: {
      info(message: string, context?: Record<string, unknown>) {
        console.info(message, context);
      },
      warn(message: string, context?: Record<string, unknown>) {
        console.warn(message, context);
      },
      error(message: string, context?: Record<string, unknown>) {
        console.error(message, context);
      }
    }
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
        typeof input.singularLabel === "string" ? input.singularLabel.trim() : "";
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
        throw new Error("At least one property is required for a custom object");
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
        throw new Error("objectType must be deals or tickets, and label is required");
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
          ? (input.properties as Record<string, string | number | boolean | null>)
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

async function loadAiRouting() {
  await ensureAiRoutingSeeded();

  const routes = await prisma.workspaceAiRouting.findMany({
    orderBy: [{ label: "asc" }]
  });

  return routes.map((routing) => serializeWorkspaceAiRouting(routing));
}

async function loadWorkspaceEmailSettings() {
  await ensureWorkspaceEmailSettingsSeeded();

  const settings = await prisma.workspaceEmailSettings.findFirstOrThrow({
    orderBy: [{ createdAt: "asc" }]
  });

  return serializeWorkspaceEmailSettings(settings);
}

function resolveGoogleWorkspaceEmailOAuthRedirectUri(explicitRedirectUri?: string | null) {
  const trimmedExplicitRedirectUri = explicitRedirectUri?.trim() ?? "";

  if (trimmedExplicitRedirectUri) {
    return trimmedExplicitRedirectUri;
  }

  const baseUrl =
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_BASE_URL ??
    "https://deploy.wearemuloo.com";

  return `${baseUrl}/settings/email/google/callback`;
}

async function loadWorkspaceEmailOAuthConnection() {
  await ensureWorkspaceEmailOAuthConnectionsSeeded();

  const connection = await prisma.workspaceEmailOAuthConnection.findUniqueOrThrow({
    where: { providerKey: "google_workspace" }
  });

  return serializeWorkspaceEmailOAuthConnection({
    ...connection,
    redirectUri: resolveGoogleWorkspaceEmailOAuthRedirectUri(connection.redirectUri)
  });
}

async function loadDeliveryTemplates() {
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

async function loadWorkRequests(filters?: {
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

async function loadProjectChangeRequests(projectId: string) {
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

async function createProductCatalogItem(value: {
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
  const category = typeof value.category === "string" ? value.category.trim() : "";
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

async function createAgentDefinition(value: {
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
    typeof value.serviceFamily === "string" ? value.serviceFamily.trim() : "hubspot_architecture";
  const provider = typeof value.provider === "string" ? value.provider.trim() : "";
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

  if (!serviceFamilyOptions.includes(serviceFamily as (typeof serviceFamilyOptions)[number])) {
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

async function createDeliveryTemplate(value: {
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
  const category = typeof value.category === "string" ? value.category.trim() : "";
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
          .filter((task): task is Record<string, unknown> => Boolean(task) && typeof task === "object")
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

async function updateDeliveryTemplate(
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
    if (typeof value.category !== "string" || value.category.trim().length === 0) {
      throw new Error("category must be a non-empty string");
    }

    updateData.category = value.category.trim();
  }

  if (value.scopeType !== undefined) {
    if (typeof value.scopeType !== "string" || value.scopeType.trim().length === 0) {
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
          .filter((task): task is Record<string, unknown> => Boolean(task) && typeof task === "object")
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

async function createWorkRequest(value: {
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
    throw new Error("title, contactName, contactEmail, and summary are required");
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
        requestedStatus === "approved" || requestedStatus === "appended_to_delivery"
          ? new Date()
          : null,
      approvedByName:
        requestedStatus === "approved" || requestedStatus === "appended_to_delivery"
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

async function updateWorkRequest(
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
      ["under_review", "priced", "approved", "rejected", "appended_to_delivery", "closed"].includes(
        nextStatus
      )
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
          : existingRequest.approvedByName ?? "Muloo";
    }

    if (existingRequest.requestType === "change_request" && nextStatus === "rejected") {
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
    if (typeof value.summary !== "string" || value.summary.trim().length === 0) {
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
    if (value.internalNotes !== null && typeof value.internalNotes !== "string") {
      throw new Error("internalNotes must be a string or null");
    }

    updateData.internalNotes =
      typeof value.internalNotes === "string"
        ? value.internalNotes.trim() || null
        : null;
  }

  if (value.commercialImpactHours !== undefined) {
    if (value.commercialImpactHours === null || value.commercialImpactHours === "") {
      updateData.commercialImpactHours = null;
    } else {
    const commercialImpactHours =
      typeof value.commercialImpactHours === "number"
        ? value.commercialImpactHours
        : Number(value.commercialImpactHours);

    if (!Number.isFinite(commercialImpactHours) || commercialImpactHours < 0) {
      throw new Error("commercialImpactHours must be a valid non-negative number");
    }

    updateData.commercialImpactHours = commercialImpactHours;
    }
  }

  if (value.commercialImpactFeeZar !== undefined) {
    if (value.commercialImpactFeeZar === null || value.commercialImpactFeeZar === "") {
      updateData.commercialImpactFeeZar = null;
    } else {
    const commercialImpactFeeZar =
      typeof value.commercialImpactFeeZar === "number"
        ? value.commercialImpactFeeZar
        : Number(value.commercialImpactFeeZar);

    if (!Number.isFinite(commercialImpactFeeZar) || commercialImpactFeeZar < 0) {
      throw new Error("commercialImpactFeeZar must be a valid non-negative number");
    }

    updateData.commercialImpactFeeZar = commercialImpactFeeZar;
    }
  }

  if (value.deliveryTasks !== undefined) {
    updateData.deliveryTasks = normalizeChangeDeliveryTasks(value.deliveryTasks);
  }

  if (value.approvedByName !== undefined) {
    if (value.approvedByName !== null && typeof value.approvedByName !== "string") {
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

async function appendApprovedChangeRequestToDelivery(requestId: string) {
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
    throw new Error("Approve and lock the project scope before appending change work");
  }

  if (!["approved", "appended_to_delivery"].includes(workRequest.status)) {
    throw new Error("Approve the change request before pushing it into delivery");
  }

  if (workRequest.deliveryAppendedAt) {
    throw new Error("This change request has already been appended to delivery");
  }

  const plannedTasks = normalizeChangeDeliveryTasks(workRequest.deliveryTasks);
  const availableAgents = await loadPreferredAgentIdsByServiceFamily(
    workRequest.project.serviceFamily
  );

  if (plannedTasks.length === 0) {
    throw new Error("Add at least one delivery task before appending this change");
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
          plannedTask.assigneeType === "Agent" ? "ready_with_review" : "not_ready"
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

async function loadClientsDirectory() {
  const [clients, projects] = await Promise.all([
    prisma.client.findMany({
      include: {
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

    const linkedProjects = projects.filter((project) => {
      if (project.clientId === client.id) {
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
      id: client.id,
      name: client.name,
      slug: client.slug,
      industry: client.industry,
      region: client.region,
      website: client.website,
      logoUrl: client.logoUrl,
      additionalWebsites: client.additionalWebsites,
      linkedinUrl: client.linkedinUrl,
      facebookUrl: client.facebookUrl,
      instagramUrl: client.instagramUrl,
      xUrl: client.xUrl,
      youtubeUrl: client.youtubeUrl,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
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

async function updateClientDirectoryRecord(
  clientId: string,
  value: {
    name?: unknown;
    website?: unknown;
    industry?: unknown;
    region?: unknown;
    logoUrl?: unknown;
  }
) {
  const client = await prisma.client.findUnique({
    where: { id: clientId }
  });

  if (!client) {
    throw new Error("Client not found");
  }

  const updateData: Prisma.Prisma.ClientUpdateInput = {};

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

  if (typeof value.industry === "string") {
    updateData.industry = value.industry.trim() || null;
  }

  if (typeof value.region === "string") {
    updateData.region = value.region.trim() || null;
  }

  if (typeof value.logoUrl === "string") {
    updateData.logoUrl = value.logoUrl.trim() || null;
  }

  const updatedClient = await prisma.client.update({
    where: { id: clientId },
    data: updateData
  });

  return {
    id: updatedClient.id,
    name: updatedClient.name,
    slug: updatedClient.slug,
    industry: updatedClient.industry,
    region: updatedClient.region,
    website: updatedClient.website,
    logoUrl: updatedClient.logoUrl,
    additionalWebsites: updatedClient.additionalWebsites,
    linkedinUrl: updatedClient.linkedinUrl,
    facebookUrl: updatedClient.facebookUrl,
    instagramUrl: updatedClient.instagramUrl,
    xUrl: updatedClient.xUrl,
    youtubeUrl: updatedClient.youtubeUrl,
    createdAt: updatedClient.createdAt.toISOString(),
    updatedAt: updatedClient.updatedAt.toISOString()
  };
}

async function deleteClientDirectoryRecord(clientId: string) {
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

async function createClientContact(
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

async function updateClientContact(
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
    if (typeof value.firstName !== "string" || value.firstName.trim().length === 0) {
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

async function createClientPortalUserForProject(
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
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const role = typeof value.role === "string" ? value.role.trim() : "contributor";
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
    ? normalizeAssignedInputSections(value.assignedInputSections, availableInputSections)
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
      ? buildClientAccessUrl("/client/activate", inviteToken)
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

function buildClientAccessUrl(pathname: string, token: string) {
  return `${getAppBaseUrl()}${pathname}?token=${encodeURIComponent(token)}`;
}

function buildClientPortalLoginUrl() {
  return `${getAppBaseUrl()}/client/login`;
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
  const projectLines = input.projects.map((project) => `- ${project.name}`).join("\n");
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

async function createClientResetLink(userId: string, projectId: string) {
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
    resetLink: buildClientAccessUrl("/client/activate", resetToken)
  };
}

async function loadClientUsersForProject(projectId: string) {
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

async function inviteClientContactToProjects(
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

  const contact = client.contacts.find((candidate) => candidate.id === contactId);

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
    throw new Error("One or more selected projects are no longer linked to this client");
  }

  const questionnaireAccess =
    value.questionnaireAccess === undefined
      ? true
      : Boolean(value.questionnaireAccess);
  const sendEmail = value.sendEmail === undefined ? true : Boolean(value.sendEmail);
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

  const accessUrl = inviteLink ?? buildClientPortalLoginUrl();
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
        error instanceof Error ? error.message : "Failed to send onboarding email";
    }
  }

  await Promise.all(
    selectedProjects.map((project) =>
      createProjectMessage({
        projectId: project.id,
        senderType: "internal",
        senderName: "Muloo Client Workspace",
        body: `Portal access updated for ${contactName}` +
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

async function updateClientProjectAccess(
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

  if (value.assignedInputSections !== undefined || value.questionnaireAccess !== undefined) {
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

async function loadClientProjectsForUser(userId: string) {
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

async function loadClientProjectDetail(projectId: string, userId: string) {
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

  const submissions = await prisma.clientInputSubmission.findMany({
    where: {
      projectId,
      userId
    },
    orderBy: [{ sessionNumber: "asc" }]
  });
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
          .filter(([sessionNumberText, session]) =>
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
    submissions: submissions.map((submission) =>
      serializeClientInputSubmission(submission)
    )
  };
}

async function loadClientQuoteDocument(projectId: string, userId: string) {
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

async function saveClientInputSubmission(
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

async function loadProjectMessages(projectId: string) {
  const messages = await prisma.projectMessage.findMany({
    where: { projectId },
    orderBy: [{ createdAt: "asc" }]
  });

  return messages.map((message) => serializeProjectMessage(message));
}

async function createProjectMessage(value: {
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
      internalSeenAt:
        senderType === "internal" ? new Date() : null,
      clientSeenAt: senderType === "client" ? new Date() : null
    }
  });

  return serializeProjectMessage(message);
}

async function markProjectMessagesSeenByInternal(projectId: string) {
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

async function markAllProjectMessagesSeenByInternal() {
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

async function markProjectMessagesSeenByClient(
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

async function loadInternalInbox() {
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

async function loadClientInbox(userId: string) {
  const accessRecords = await prisma.clientProjectAccess.findMany({
    where: { userId },
    select: { projectId: true }
  });
  const projectIds = accessRecords.map((record) => record.projectId);

  const [workRequests, messages] = await Promise.all([
    prisma.clientPortalUser.findUnique({
      where: { id: userId },
      select: { email: true }
    }).then((user) =>
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

async function loadInboxSummary() {
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

async function loadClientInboxSummary(userId: string) {
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

async function updateProductCatalogItem(
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
    if (typeof value.category !== "string" || value.category.trim().length === 0) {
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
    if (typeof value.unitLabel !== "string" || value.unitLabel.trim().length === 0) {
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

async function updateWorkspaceProviderConnection(
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

async function updateWorkspaceEmailSettings(value: {
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
      const port = typeof value.port === "number" ? value.port : Number(value.port);
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

async function updateWorkspaceEmailOAuthConnection(value: {
  clientId?: unknown;
  clientSecret?: unknown;
  redirectUri?: unknown;
  enabled?: unknown;
  scopes?: unknown;
}) {
  await ensureWorkspaceEmailOAuthConnectionsSeeded();

  const connection = await prisma.workspaceEmailOAuthConnection.findUniqueOrThrow({
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

    if (normalizedScopes.length === 0) {
      throw new Error("At least one OAuth scope is required");
    }

    updateData.scopes = normalizedScopes;
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

async function createWorkspaceGoogleEmailOAuthStart() {
  await ensureWorkspaceEmailOAuthConnectionsSeeded();

  const connection = await prisma.workspaceEmailOAuthConnection.findUniqueOrThrow({
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
  const scopes = connection.scopes.length
    ? connection.scopes
    : [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.send"
      ];

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

async function completeWorkspaceGoogleEmailOAuthCallback(value: {
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

  const connection = await prisma.workspaceEmailOAuthConnection.findUniqueOrThrow({
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

  const tokenBody = (await tokenResponse.json().catch(() => null)) as
    | {
        access_token?: string;
        refresh_token?: string;
        token_type?: string;
        expires_in?: number;
        error?: string;
        error_description?: string;
      }
    | null;

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
  const profileBody = (await profileResponse.json().catch(() => null)) as
    | {
        email?: string;
        name?: string;
      }
    | null;

  if (!profileResponse.ok || !profileBody?.email) {
    throw new Error("Could not load the connected Google profile");
  }

  const updatedConnection = await prisma.workspaceEmailOAuthConnection.update({
    where: { id: connection.id },
    data: {
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

async function disconnectWorkspaceGoogleEmailOAuthConnection() {
  await ensureWorkspaceEmailOAuthConnectionsSeeded();

  const connection = await prisma.workspaceEmailOAuthConnection.findUniqueOrThrow({
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

async function refreshGoogleWorkspaceEmailAccessTokenIfNeeded() {
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
    connection.tokenExpiresAt.getTime() > Date.now() + 60_000;

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

  const refreshBody = (await refreshResponse.json().catch(() => null)) as
    | {
        access_token?: string;
        expires_in?: number;
        token_type?: string;
        error?: string;
        error_description?: string;
      }
    | null;

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

  const body = (await response.json().catch(() => null)) as
    | { id?: string; error?: { message?: string } }
    | null;

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

async function sendWorkspaceEmail(value: {
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

async function updateWorkspaceAiRouting(
  workflowKey: string,
  value: {
    providerKey?: unknown;
    modelOverride?: unknown;
    notes?: unknown;
  }
) {
  const updateData: Prisma.Prisma.WorkspaceAiRoutingUpdateInput = {};

  if (value.providerKey !== undefined) {
    if (typeof value.providerKey !== "string" || value.providerKey.trim().length === 0) {
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

function getProviderApiKey(providerKey: string, storedApiKey: string | null) {
  if (storedApiKey) {
    return storedApiKey;
  }

  switch (providerKey) {
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY ?? null;
    case "openai":
      return process.env.OPENAI_API_KEY ?? null;
    case "gemini":
      return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? null;
    default:
      return null;
  }
}

function resolveProviderCandidate(
  providerMap: Map<string, {
    providerKey: string;
    apiKey: string | null;
    defaultModel: string | null;
    endpointUrl: string | null;
    isEnabled: boolean;
  }>,
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

  const apiKey = getProviderApiKey(provider.providerKey, provider.apiKey);
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
  await Promise.all([ensureProviderConnectionsSeeded(), ensureAiRoutingSeeded()]);

  const [routing, providers] = await Promise.all([
    prisma.workspaceAiRouting.findUnique({ where: { workflowKey } }),
    prisma.workspaceProviderConnection.findMany()
  ]);

  const providerMap = new Map(
    providers.map((provider) => [provider.providerKey, provider])
  );
  const routedCandidate = routing
    ? resolveProviderCandidate(providerMap, routing.providerKey, routing.modelOverride)
    : null;

  if (routing && routedCandidate) {
    return {
      workflowKey,
      routeSource: "workflow_route",
      ...routedCandidate
    };
  }

  const fallbackOrder = ["anthropic", "openai", "gemini"];
  for (const providerKey of fallbackOrder) {
    const fallbackCandidate = resolveProviderCandidate(
      providerMap,
      providerKey,
      routing?.providerKey === providerKey ? routing?.modelOverride ?? null : null
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

  await Promise.all([ensureProviderConnectionsSeeded(), ensureAiRoutingSeeded()]);

  const providers = await prisma.workspaceProviderConnection.findMany();
  const providerMap = new Map(
    providers.map((provider) => [provider.providerKey, provider])
  );
  const candidate = resolveProviderCandidate(
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
  await Promise.all([ensureProviderConnectionsSeeded(), ensureAiRoutingSeeded()]);

  const providers = await prisma.workspaceProviderConnection.findMany();
  const providerMap = new Map(
    providers.map((provider) => [provider.providerKey, provider])
  );

  const preferredCandidate = resolveProviderCandidate(
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
      throw new Error(`Anthropic request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as { content?: Array<{ text?: string }> };
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
      throw new Error(`OpenAI request failed with status ${response.status}`);
    }

    return extractOpenAiText(await response.json());
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

async function updateAgentDefinition(
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
    if (typeof value.purpose !== "string" || value.purpose.trim().length === 0) {
      throw new Error("purpose must be a non-empty string");
    }

    updateData.purpose = value.purpose.trim();
  }

  if (value.serviceFamily !== undefined) {
    if (typeof value.serviceFamily !== "string" || !serviceFamilyOptions.includes(value.serviceFamily.trim() as (typeof serviceFamilyOptions)[number])) {
      throw new Error("serviceFamily must be a valid service family");
    }

    updateData.serviceFamily = value.serviceFamily.trim();
  }

  if (value.provider !== undefined) {
    if (typeof value.provider !== "string" || value.provider.trim().length === 0) {
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

async function loadDiscoveryEvidence(
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

async function createDiscoveryEvidence(
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

async function saveDiscoverySession(
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

async function extractDiscoveryFields(
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

  const rawText = await callAiWorkflow("discovery_extract", systemPrompt, userPrompt).catch(() => "{}");
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

export function createAppServer(config: BaseConfig): http.Server {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", config.appBaseUrl);

    try {
      if (url.pathname === "/api/auth/session") {
        return sendJson(response, 200, {
          authenticated: isAuthenticated(request)
        });
      }

      if (request.method === "POST" && url.pathname === "/api/auth/login") {
        const body = (await readJsonBody(request)) as {
          username?: string;
          password?: string;
        };
        const credentials = resolveSimpleAuthCredentials();

        if (
          body.username?.trim() !== credentials.username ||
          body.password !== credentials.password
        ) {
          return sendJson(response, 401, { error: "Invalid credentials" });
        }

        setCookie(response, createSimpleAuthToken(credentials.username), {
          maxAge: 60 * 60 * 12
        });
        return sendJson(response, 200, { authenticated: true });
      }

      if (request.method === "POST" && url.pathname === "/api/auth/logout") {
        setCookie(response, "", { maxAge: 0 });
        return sendJson(response, 200, { authenticated: false });
      }

      if (url.pathname === "/api/client-auth/session") {
        const clientUserId = getAuthenticatedClientUserId(request);

        if (!clientUserId) {
          return sendJson(response, 200, { authenticated: false });
        }

        const user = await prisma.clientPortalUser.findUnique({
          where: { id: clientUserId }
        });

        return sendJson(response, 200, {
          authenticated: Boolean(user),
          user: user ? serializeClientPortalUser(user) : null
        });
      }

      if (request.method === "POST" && url.pathname === "/api/client-auth/login") {
        const body = (await readJsonBody(request)) as {
          email?: string;
          password?: string;
        };
        const email = body.email?.trim().toLowerCase() ?? "";
        const password = body.password ?? "";

        const user = email
          ? await prisma.clientPortalUser.findUnique({
              where: { email }
            })
          : null;

        if (!user || user.password !== password) {
          return sendJson(response, 401, { error: "Invalid client credentials" });
        }

        setCookie(response, createClientAuthToken(user.id), {
          name: clientAuthCookieName,
          maxAge: 60 * 60 * 24 * 14
        });

        return sendJson(response, 200, {
          authenticated: true,
          user: serializeClientPortalUser(user)
        });
      }

      if (request.method === "POST" && url.pathname === "/api/client-auth/set-password") {
        const body = (await readJsonBody(request)) as {
          token?: string;
          password?: string;
        };
        const token = body.token?.trim() ?? "";
        const password = body.password?.trim() ?? "";

        if (!token || password.length < 8) {
          return sendJson(response, 400, {
            error: "A valid token and password of at least 8 characters are required"
          });
        }

        const now = new Date();
        const user =
          (await prisma.clientPortalUser.findFirst({
            where: {
              OR: [
                {
                  inviteToken: token,
                  inviteTokenExpiresAt: {
                    gt: now
                  }
                },
                {
                  passwordResetToken: token,
                  passwordResetTokenExpiresAt: {
                    gt: now
                  }
                }
              ]
            }
          })) ?? null;

        if (!user) {
          return sendJson(response, 400, {
            error: "This access link is invalid or has expired"
          });
        }

        const updatedUser = await prisma.clientPortalUser.update({
          where: { id: user.id },
          data: {
            password,
            inviteToken: null,
            inviteTokenExpiresAt: null,
            passwordResetToken: null,
            passwordResetTokenExpiresAt: null,
            inviteAcceptedAt: user.inviteAcceptedAt ?? now
          }
        });

        setCookie(response, createClientAuthToken(updatedUser.id), {
          name: clientAuthCookieName,
          maxAge: 60 * 60 * 24 * 14
        });

        return sendJson(response, 200, {
          authenticated: true,
          user: serializeClientPortalUser(updatedUser)
        });
      }

      if (
        request.method === "POST" &&
        url.pathname === "/api/client-auth/logout"
      ) {
        setCookie(response, "", {
          name: clientAuthCookieName,
          maxAge: 0
        });
        return sendJson(response, 200, { authenticated: false });
      }

      if (
        url.pathname.startsWith("/api/") &&
        !url.pathname.startsWith("/api/client-auth/") &&
        !url.pathname.startsWith("/api/auth/") &&
        !url.pathname.startsWith("/api/client/") &&
        url.pathname !== "/api/health"
      ) {
        if (!isAuthenticated(request)) {
          return sendJson(response, 401, { error: "Unauthorized" });
        }
      }

      if (url.pathname.startsWith("/api/client/")) {
        const clientUserId = getAuthenticatedClientUserId(request);

        if (!clientUserId) {
          return sendJson(response, 401, { error: "Client unauthorized" });
        }

        const clientInboxRoute = matchClientInboxRoute(url.pathname);

        if (clientInboxRoute) {
          if (request.method === "GET" && clientInboxRoute.resource === "summary") {
            return sendJson(response, 200, {
              summary: await loadClientInboxSummary(clientUserId)
            });
          }

          if (request.method === "GET") {
            await markProjectMessagesSeenByClient(
              (
                await prisma.clientProjectAccess.findMany({
                  where: { userId: clientUserId },
                  select: { projectId: true }
                })
              ).map((record) => record.projectId)
            );

            return sendJson(response, 200, await loadClientInbox(clientUserId));
          }

          return sendJson(response, 405, { error: "Method Not Allowed" });
        }

        const clientWorkRequestRoute = matchClientWorkRequestRoute(url.pathname);

        if (clientWorkRequestRoute) {
          const clientUser = await prisma.clientPortalUser.findUnique({
            where: { id: clientUserId }
          });

          if (!clientUser) {
            return sendJson(response, 401, { error: "Client unauthorized" });
          }

          if (request.method === "GET") {
            const accessRecords = await prisma.clientProjectAccess.findMany({
              where: { userId: clientUserId },
              select: { projectId: true }
            });

            return sendJson(response, 200, {
              workRequests: await loadWorkRequests({
                projectIds: accessRecords.map((record) => record.projectId),
                contactEmail: clientUser.email
              })
            });
          }

          if (request.method === "POST") {
            try {
              const body = (await readJsonBody(request)) as Record<string, unknown>;
              const workRequest = await createWorkRequest({
                ...body,
                contactName: `${clientUser.firstName} ${clientUser.lastName}`.trim(),
                contactEmail: clientUser.email
              });
              return sendJson(response, 201, { workRequest });
            } catch (error) {
              return sendJson(response, 400, {
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to create work request"
              });
            }
          }

          return sendJson(response, 405, { error: "Method Not Allowed" });
        }

        const clientProjectQuoteApprovalRoute =
          matchClientProjectQuoteApprovalRoute(url.pathname);

        if (clientProjectQuoteApprovalRoute) {
          if (request.method === "POST") {
            try {
              const result = await approveProjectQuote(
                clientProjectQuoteApprovalRoute.projectId,
                clientUserId
              );

              return sendJson(response, 200, {
                project: result.project,
                quote: result.quote,
                approved: true
              });
            } catch (error) {
              if (
                error instanceof Error &&
                error.message === "Project not found"
              ) {
                return sendJson(response, 404, { error: error.message });
              }

              return sendJson(response, 400, {
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to approve quote"
              });
            }
          }

          return sendJson(response, 405, { error: "Method Not Allowed" });
        }

        const clientProjectRoute = matchClientProjectRoute(url.pathname);

        if (clientProjectRoute) {
          if (request.method === "GET" && !clientProjectRoute.projectId) {
            return sendJson(response, 200, {
              projects: await loadClientProjectsForUser(clientUserId)
            });
          }

          if (
            request.method === "GET" &&
            clientProjectRoute.projectId &&
            !clientProjectRoute.resource
          ) {
            const detail = await loadClientProjectDetail(
              clientProjectRoute.projectId,
              clientUserId
            );

            if (!detail) {
              return sendJson(response, 404, { error: "Project not found" });
            }

            return sendJson(response, 200, detail);
          }

          if (
            request.method === "PATCH" &&
            clientProjectRoute.projectId &&
            clientProjectRoute.resource === "submissions" &&
            clientProjectRoute.sessionId
          ) {
            try {
              const body = (await readJsonBody(request)) as { answers?: unknown };
              const submission = await saveClientInputSubmission(
                clientProjectRoute.projectId,
                clientUserId,
                clientProjectRoute.sessionId,
                body.answers ?? {}
              );

              return sendJson(response, 200, { submission });
            } catch (error) {
              if (error instanceof Error) {
                return sendJson(response, 400, { error: error.message });
              }

              throw error;
            }
          }

          if (
            request.method === "GET" &&
            clientProjectRoute.projectId &&
            clientProjectRoute.resource === "tasks"
          ) {
            const access = await prisma.clientProjectAccess.findFirst({
              where: {
                projectId: clientProjectRoute.projectId,
                userId: clientUserId
              }
            });

            if (!access) {
              return sendJson(response, 404, { error: "Project not found" });
            }

            const tasks = await prisma.task.findMany({
              where: { projectId: clientProjectRoute.projectId },
              include: {
                assignedAgent: { select: { name: true } },
                executionJobs: {
                  select: {
                    id: true,
                    status: true,
                    resultStatus: true,
                    createdAt: true,
                    completedAt: true
                  },
                  orderBy: [{ createdAt: "desc" }],
                  take: 1
                }
              },
              orderBy: [{ createdAt: "asc" }]
            });

            return sendJson(response, 200, {
              tasks: tasks.map((task) => serializeTask(task))
            });
          }

          if (
            request.method === "GET" &&
            clientProjectRoute.projectId &&
            clientProjectRoute.resource === "quote"
          ) {
            const document = await loadClientQuoteDocument(
              clientProjectRoute.projectId,
              clientUserId
            );

            if (!document) {
              return sendJson(response, 404, { error: "Project not found" });
            }

            if (!document.quote) {
              return sendJson(response, 400, {
                error: "Quote has not yet been published to the client portal."
              });
            }

            const isStandaloneQuote =
              document.project.scopeType === "standalone_quote";

            if (!document.summary) {
              return sendJson(response, 400, {
                error: isStandaloneQuote
                  ? "Generate the scoped summary before opening the commercial document."
                  : "Generate the discovery summary before opening the quote."
              });
            }

            if (!isStandaloneQuote && !document.blueprint) {
              return sendJson(response, 400, {
                error:
                  "Generate the discovery summary and blueprint before opening the quote."
              });
            }

            return sendJson(response, 200, document);
          }

          if (
            clientProjectRoute.projectId &&
            clientProjectRoute.resource === "messages"
          ) {
            const access = await prisma.clientProjectAccess.findFirst({
              where: {
                projectId: clientProjectRoute.projectId,
                userId: clientUserId
              }
            });

            if (!access) {
              return sendJson(response, 404, { error: "Project not found" });
            }

            if (request.method === "GET") {
              await markProjectMessagesSeenByClient(clientProjectRoute.projectId);
              return sendJson(response, 200, {
                messages: await loadProjectMessages(clientProjectRoute.projectId)
              });
            }

            if (request.method === "POST") {
              const clientUser = await prisma.clientPortalUser.findUnique({
                where: { id: clientUserId }
              });

              if (!clientUser) {
                return sendJson(response, 401, { error: "Client unauthorized" });
              }

              try {
                const body = (await readJsonBody(request)) as { body?: unknown };
                const message = await createProjectMessage({
                  projectId: clientProjectRoute.projectId,
                  senderType: "client",
                  senderName: `${clientUser.firstName} ${clientUser.lastName}`.trim(),
                  body: body.body
                });

                return sendJson(response, 201, { message });
              } catch (error) {
                return sendJson(response, 400, {
                  error:
                    error instanceof Error
                      ? error.message
                      : "Failed to post message"
                });
              }
            }
          }
        }

        return sendJson(response, 404, { error: "Client route not found" });
      }

      const inboxRoute = matchInboxRoute(url.pathname);
      if (inboxRoute) {
        if (request.method === "GET" && inboxRoute.resource === "summary") {
          return sendJson(response, 200, {
            summary: await loadInboxSummary()
          });
        }

        if (request.method === "GET") {
          await markAllProjectMessagesSeenByInternal();
          return sendJson(response, 200, await loadInternalInbox());
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      if (request.method === "GET" && url.pathname === "/api/templates") {
        return sendJson(response, 200, {
          templates: await loadAllTemplates()
        });
      }

      const templateRoute = matchTemplateRoute(url.pathname);
      if (request.method === "GET" && templateRoute) {
        return sendJson(response, 200, {
          template: await loadTemplateById(templateRoute.templateId)
        });
      }

      if (url.pathname === "/api/health") {
        await prisma.$queryRaw`SELECT 1`;
        return sendJson(response, 200, {
          status: "ok",
          service: "muloo-deploy-os-api",
          timestamp: new Date().toISOString(),
          environment: config.nodeEnv,
          database: "connected",
          executionMode: config.executionMode,
          applyEnabled: config.applyEnabled,
          moduleCount: moduleCatalog.length
        });
      }

      if (url.pathname === "/api/modules") {
        return sendJson(response, 200, {
          modules: moduleCatalog
        });
      }

      if (url.pathname === "/api/settings") {
        return sendJson(response, 200, {
          environment: config.nodeEnv,
          appBaseUrl: config.appBaseUrl,
          artifactDir: config.artifactDir,
          executionMode: config.executionMode,
          applyEnabled: config.applyEnabled,
          integrationStatus: getIntegrationStatus(config)
        });
      }

      if (url.pathname === "/api/hubspot/agent-capabilities") {
        if (request.method === "GET") {
          const connection = await resolveHubSpotAgentConnection();
          return sendJson(
            response,
            200,
            buildHubSpotAgentCapabilitiesPayload(connection)
          );
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      if (url.pathname === "/api/hubspot/agent-execute") {
        if (request.method === "POST") {
          try {
            const body = (await readJsonBody(request)) as Record<string, unknown>;
            const result = await executeHubSpotAgentAction(body);
            return sendJson(response, 200, result);
          } catch (error) {
            return sendJson(response, 400, {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to execute HubSpot agent action"
            });
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      const workspaceUserRoute = matchWorkspaceUserRoute(url.pathname);
      if (workspaceUserRoute) {
        if (request.method === "GET" && !workspaceUserRoute.userId) {
          return sendJson(response, 200, {
            users: (await loadWorkspaceUsers()).map((user) =>
              serializeWorkspaceUser(user)
            )
          });
        }

        if (request.method === "POST" && !workspaceUserRoute.userId) {
          try {
            const body = (await readJsonBody(request)) as Record<string, unknown>;
            const user = await createWorkspaceUser(body);
            return sendJson(response, 201, { user });
          } catch (error) {
            return sendJson(response, 400, {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to create workspace user"
            });
          }
        }

        if (request.method === "PATCH" && workspaceUserRoute.userId) {
          try {
            const body = (await readJsonBody(request)) as Record<string, unknown>;
            const user = await updateWorkspaceUser(workspaceUserRoute.userId, body);
            return sendJson(response, 200, { user });
          } catch (error) {
            return sendJson(response, 400, {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to update workspace user"
            });
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      const providerConnectionRoute = matchProviderConnectionRoute(url.pathname);
      if (providerConnectionRoute) {
        if (request.method === "GET" && !providerConnectionRoute.providerKey) {
          return sendJson(response, 200, {
            providers: await loadProviderConnections()
          });
        }

        if (request.method === "PATCH" && providerConnectionRoute.providerKey) {
          try {
            const body = (await readJsonBody(request)) as Record<string, unknown>;
            const provider = await updateWorkspaceProviderConnection(
              providerConnectionRoute.providerKey,
              body
            );
            return sendJson(response, 200, { provider });
          } catch (error) {
            return sendJson(response, 400, {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to update provider connection"
            });
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      const aiRoutingRoute = matchAiRoutingRoute(url.pathname);
      if (aiRoutingRoute) {
        if (request.method === "GET" && !aiRoutingRoute.workflowKey) {
          return sendJson(response, 200, {
            routes: await loadAiRouting()
          });
        }

        if (request.method === "PATCH" && aiRoutingRoute.workflowKey) {
          try {
            const body = (await readJsonBody(request)) as Record<string, unknown>;
            const route = await updateWorkspaceAiRouting(
              aiRoutingRoute.workflowKey,
              body
            );
            return sendJson(response, 200, { route });
          } catch (error) {
            return sendJson(response, 400, {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to update AI routing"
            });
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      if (url.pathname === "/api/email-settings") {
        if (request.method === "GET") {
          return sendJson(response, 200, {
            settings: await loadWorkspaceEmailSettings()
          });
        }

        if (request.method === "PATCH") {
          try {
            const body = (await readJsonBody(request)) as Record<string, unknown>;
            const settings = await updateWorkspaceEmailSettings(body);
            return sendJson(response, 200, { settings });
          } catch (error) {
            return sendJson(response, 400, {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to update email settings"
            });
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      if (url.pathname === "/api/email-oauth/google") {
        if (request.method === "GET") {
          return sendJson(response, 200, {
            connection: await loadWorkspaceEmailOAuthConnection()
          });
        }

        if (request.method === "PATCH") {
          try {
            const body = (await readJsonBody(request)) as Record<string, unknown>;
            const connection = await updateWorkspaceEmailOAuthConnection(body);
            return sendJson(response, 200, { connection });
          } catch (error) {
            return sendJson(response, 400, {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to update Google email OAuth settings"
            });
          }
        }

        if (request.method === "DELETE") {
          try {
            const connection =
              await disconnectWorkspaceGoogleEmailOAuthConnection();
            return sendJson(response, 200, { connection });
          } catch (error) {
            return sendJson(response, 400, {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to disconnect Google mailbox"
            });
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      if (request.method === "POST" && url.pathname === "/api/email-oauth/google/start") {
        try {
          const result = await createWorkspaceGoogleEmailOAuthStart();
          return sendJson(response, 200, result);
        } catch (error) {
          return sendJson(response, 400, {
            error:
              error instanceof Error
                ? error.message
                : "Failed to start Google OAuth"
          });
        }
      }

      if (request.method === "POST" && url.pathname === "/api/email-oauth/google/callback") {
        try {
          const body = (await readJsonBody(request)) as Record<string, unknown>;
          const connection = await completeWorkspaceGoogleEmailOAuthCallback(body);
          return sendJson(response, 200, { connection });
        } catch (error) {
          return sendJson(response, 400, {
            error:
              error instanceof Error
                ? error.message
                : "Failed to complete Google OAuth"
          });
        }
      }

      const productRoute = matchProductRoute(url.pathname);
      if (productRoute) {
        if (request.method === "GET" && !productRoute.productId) {
          return sendJson(response, 200, {
            products: await loadProductCatalog()
          });
        }

        if (request.method === "POST" && !productRoute.productId) {
          try {
            const body = (await readJsonBody(request)) as {
              name?: unknown;
              category?: unknown;
              billingModel?: unknown;
              description?: unknown;
              unitPrice?: unknown;
              defaultQuantity?: unknown;
              unitLabel?: unknown;
              isActive?: unknown;
              sortOrder?: unknown;
            };

            const product = await createProductCatalogItem(body);
            return sendJson(response, 201, { product });
          } catch (error) {
            if (error instanceof Error) {
              return sendJson(response, 400, { error: error.message });
            }

            throw error;
          }
        }

        if (request.method === "PATCH" && productRoute.productId) {
          try {
            const body = (await readJsonBody(request)) as {
              name?: unknown;
              category?: unknown;
              billingModel?: unknown;
              description?: unknown;
              unitPrice?: unknown;
              defaultQuantity?: unknown;
              unitLabel?: unknown;
              isActive?: unknown;
              sortOrder?: unknown;
            };

            const product = await updateProductCatalogItem(
              productRoute.productId,
              body
            );
            return sendJson(response, 200, { product });
          } catch (error) {
            if (error instanceof Error) {
              return sendJson(response, 400, { error: error.message });
            }

            throw error;
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      const agentRoute = matchAgentRoute(url.pathname);
      if (agentRoute) {
        if (request.method === "GET" && !agentRoute.agentId) {
          return sendJson(response, 200, {
            agents: await loadAgentCatalog()
          });
        }

        if (request.method === "POST" && !agentRoute.agentId) {
          try {
            const body = (await readJsonBody(request)) as {
              name?: unknown;
              purpose?: unknown;
              provider?: unknown;
              model?: unknown;
              triggerType?: unknown;
              approvalMode?: unknown;
              allowedActions?: unknown;
              systemPrompt?: unknown;
              isActive?: unknown;
              sortOrder?: unknown;
            };

            const agent = await createAgentDefinition(body);
            return sendJson(response, 201, { agent });
          } catch (error) {
            return sendJson(response, 400, {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to create agent"
            });
          }
        }

        if (request.method === "PATCH" && agentRoute.agentId) {
          try {
            const body = (await readJsonBody(request)) as {
              name?: unknown;
              purpose?: unknown;
              provider?: unknown;
              model?: unknown;
              triggerType?: unknown;
              approvalMode?: unknown;
              allowedActions?: unknown;
              systemPrompt?: unknown;
              isActive?: unknown;
              sortOrder?: unknown;
            };

            const agent = await updateAgentDefinition(agentRoute.agentId, body);
            return sendJson(response, 200, { agent });
          } catch (error) {
            return sendJson(response, 400, {
              error:
                error instanceof Error ? error.message : "Failed to update agent"
            });
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      const deliveryTemplateRoute = matchDeliveryTemplateRoute(url.pathname);
      if (deliveryTemplateRoute) {
        if (request.method === "GET" && !deliveryTemplateRoute.templateId) {
          return sendJson(response, 200, {
            templates: await loadDeliveryTemplates()
          });
        }

        if (request.method === "POST" && !deliveryTemplateRoute.templateId) {
          try {
            const body = (await readJsonBody(request)) as Record<string, unknown>;
            const template = await createDeliveryTemplate(body);
            return sendJson(response, 201, { template });
          } catch (error) {
            return sendJson(response, 400, {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to create delivery template"
            });
          }
        }

        if (request.method === "PATCH" && deliveryTemplateRoute.templateId) {
          try {
            const body = (await readJsonBody(request)) as Record<string, unknown>;
            const template = await updateDeliveryTemplate(
              deliveryTemplateRoute.templateId,
              body
            );
            return sendJson(response, 200, { template });
          } catch (error) {
            return sendJson(response, 400, {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to update delivery template"
            });
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      const workRequestRoute = matchWorkRequestRoute(url.pathname);
      if (workRequestRoute) {
        if (request.method === "GET" && !workRequestRoute.requestId) {
          return sendJson(response, 200, {
            workRequests: await loadWorkRequests()
          });
        }

        if (request.method === "POST" && !workRequestRoute.requestId) {
          try {
            const body = (await readJsonBody(request)) as Record<string, unknown>;
            const workRequest = await createWorkRequest(body);
            return sendJson(response, 201, { workRequest });
          } catch (error) {
            return sendJson(response, 400, {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to create work request"
            });
          }
        }

        if (request.method === "PATCH" && workRequestRoute.requestId) {
          try {
            const body = (await readJsonBody(request)) as Record<string, unknown>;
            const workRequest = await updateWorkRequest(
              workRequestRoute.requestId,
              body
            );
            return sendJson(response, 200, { workRequest });
          } catch (error) {
            return sendJson(response, 400, {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to update work request"
            });
          }
        }

        if (
          request.method === "POST" &&
          workRequestRoute.requestId &&
          workRequestRoute.action === "convert"
        ) {
          try {
            const result = await convertWorkRequestToProject(
              workRequestRoute.requestId
            );
            return sendJson(response, 200, result);
          } catch (error) {
            return sendJson(response, 400, {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to convert work request"
            });
          }
        }

        if (
          request.method === "POST" &&
          workRequestRoute.requestId &&
          workRequestRoute.action === "append-to-delivery"
        ) {
          try {
            const result = await appendApprovedChangeRequestToDelivery(
              workRequestRoute.requestId
            );
            return sendJson(response, 200, result);
          } catch (error) {
            return sendJson(
              response,
              error instanceof Error &&
              ["Change request not found", "Change request is not linked to a project"].includes(
                error.message
              )
                ? 404
                : 400,
              {
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to append change request to delivery"
              }
            );
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      if (url.pathname === "/api/industries") {
        return sendJson(response, 200, {
          industries: industryOptions
        });
      }

      if (url.pathname === "/api/runs") {
        return sendJson(response, 200, {
          runs: await loadAllExecutionRecords(),
          agentRuns: await loadAgentRuns()
        });
      }

      const runRoute = matchRunRoute(url.pathname);
      if (runRoute) {
        if (request.method === "PATCH") {
          try {
            const body = (await readJsonBody(request)) as Record<string, unknown>;
            const run = await updateAgentRun(runRoute.runId, body);
            return sendJson(response, 200, { run });
          } catch (error) {
            return sendJson(response, 400, {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to update agent run"
            });
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      const projectTaskAgentRunRoute = matchProjectTaskAgentRunRoute(url.pathname);
      if (projectTaskAgentRunRoute) {
        if (request.method === "POST") {
          try {
            const run = await queueAgentRun(
              projectTaskAgentRunRoute.projectId,
              projectTaskAgentRunRoute.taskId
            );
            return sendJson(response, 201, { run });
          } catch (error) {
            return sendJson(response, 400, {
              error: error instanceof Error ? error.message : "Failed to queue agent run"
            });
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      if (url.pathname === "/api/projects") {
        if (request.method === "POST") {
          const body = (await readJsonBody(request)) as {
            name: string;
            clientName: string;
            hubspotPortalId?: string;
            selectedHubs: string[];
            owner?: string;
            ownerEmail?: string;
            serviceFamily?: string;
            implementationApproach?: string;
            customerPlatformTier?: string;
            platformTierSelections?: Record<string, string>;
            problemStatement?: string;
            solutionRecommendation?: string;
            scopeExecutiveSummary?: string;
            scopeType?: string;
            deliveryTemplateId?: string;
            commercialBrief?: string;
            engagementType?: string;
            industry?: string;
            website?: string;
            additionalWebsites?: string[];
            linkedinUrl?: string;
            facebookUrl?: string;
            instagramUrl?: string;
            xUrl?: string;
            youtubeUrl?: string;
            clientChampionFirstName?: string;
            clientChampionLastName?: string;
            clientChampionEmail?: string;
          };

          const scopeType =
            typeof body.scopeType === "string" && body.scopeType.trim().length > 0
              ? body.scopeType.trim()
              : "discovery";

          if (
            !body.name ||
            !body.clientName ||
            (scopeType !== "standalone_quote" && !body.selectedHubs?.length)
          ) {
            return sendJson(response, 400, {
              error:
                scopeType === "standalone_quote"
                  ? "name and clientName are required"
                  : "name, clientName, and selectedHubs are required"
            });
          }

          if (
            body.engagementType &&
            !isValidEngagementType(body.engagementType)
          ) {
            return sendJson(response, 400, {
              error: "Invalid engagement type"
            });
          }

          const serviceFamily =
            typeof body.serviceFamily === "string" &&
            serviceFamilyOptions.includes(
              body.serviceFamily.trim() as (typeof serviceFamilyOptions)[number]
            )
              ? body.serviceFamily.trim()
              : "hubspot_architecture";
          const implementationApproach =
            typeof body.implementationApproach === "string" &&
            isValidImplementationApproach(body.implementationApproach.trim())
              ? body.implementationApproach.trim()
              : "pragmatic_poc";
          const customerPlatformTier =
            typeof body.customerPlatformTier === "string" &&
            isValidCustomerPlatformTier(
              body.customerPlatformTier.trim().toLowerCase()
            )
              ? body.customerPlatformTier.trim().toLowerCase()
              : null;
          const platformTierSelections = normalizePlatformTierSelections(
            body.platformTierSelections
          );

          const slug = createSlug(body.clientName);
          const client = await prisma.client.upsert({
            where: { slug },
            update: {
              name: body.clientName,
              industry: body.industry?.trim() || null,
              website: body.website?.trim() || null,
              additionalWebsites: normalizeStringArray(body.additionalWebsites),
              linkedinUrl: body.linkedinUrl?.trim() || null,
              facebookUrl: body.facebookUrl?.trim() || null,
              instagramUrl: body.instagramUrl?.trim() || null,
              xUrl: body.xUrl?.trim() || null,
              youtubeUrl: body.youtubeUrl?.trim() || null
            },
            create: {
              name: body.clientName,
              slug,
              industry: body.industry?.trim() || null,
              website: body.website?.trim() || null,
              additionalWebsites: normalizeStringArray(body.additionalWebsites),
              linkedinUrl: body.linkedinUrl?.trim() || null,
              facebookUrl: body.facebookUrl?.trim() || null,
              instagramUrl: body.instagramUrl?.trim() || null,
              xUrl: body.xUrl?.trim() || null,
              youtubeUrl: body.youtubeUrl?.trim() || null
            }
          });

          const requestedPortalId = body.hubspotPortalId?.trim() ?? "";
          const portal = requestedPortalId
            ? await prisma.hubSpotPortal.upsert({
                where: { portalId: requestedPortalId },
                update: {},
                create: {
                  portalId: requestedPortalId,
                  displayName: body.clientName
                }
              })
            : await prisma.hubSpotPortal.create({
                data: {
                  portalId: createPendingPortalId(),
                  displayName: body.clientName
                }
              });

          const project = await prisma.project.create({
            data: {
              name: body.name,
              status: "draft",
              engagementType: (body.engagementType ??
                "IMPLEMENTATION") as Prisma.$Enums.EngagementType,
              ...(await resolveProjectOwner(body.owner, body.ownerEmail)),
              serviceFamily,
              implementationApproach,
              customerPlatformTier,
              platformTierSelections,
              problemStatement: body.problemStatement?.trim() || null,
              solutionRecommendation:
                body.solutionRecommendation?.trim() || null,
              scopeExecutiveSummary:
                body.scopeExecutiveSummary?.trim() || null,
              clientChampionFirstName:
                body.clientChampionFirstName?.trim() || null,
              clientChampionLastName:
                body.clientChampionLastName?.trim() || null,
              clientChampionEmail:
                body.clientChampionEmail?.trim() || null,
              scopeType,
              deliveryTemplateId: body.deliveryTemplateId?.trim() || null,
              commercialBrief: body.commercialBrief?.trim() || null,
              selectedHubs: Array.isArray(body.selectedHubs)
                ? body.selectedHubs
                : [],
              clientId: client.id,
              portalId: portal.id
            },
            include: {
              client: true,
              portal: true
            }
          });

          return sendJson(response, 201, {
            project: serializeProject(project)
          });
        }

        const projects = await prisma.project.findMany({
          include: { client: true, portal: true },
          orderBy: { updatedAt: "desc" }
        });
        return sendJson(response, 200, {
          projects: projects.map((project) => serializeProject(project))
        });
      }

      const discoveryRoute = matchDiscoveryRoute(url.pathname);
      if (request.method === "GET" && discoveryRoute) {
        const [submissions, evidenceItems] = await Promise.all([
          prisma.discoverySubmission.findMany({
            where: { projectId: discoveryRoute.projectId },
            orderBy: { version: "asc" },
            select: {
              version: true,
              status: true,
              sections: true,
              completedSections: true
            }
          }),
          loadDiscoveryEvidence(discoveryRoute.projectId)
        ]);

        return sendJson(response, 200, {
          sessions: buildDiscoverySessions(
            submissions.map((submission) => ({
              version: submission.version,
              sections: submission.sections
            }))
          ),
          sessionDetails: buildDiscoverySessionsWithStatus(submissions),
          evidenceItems
        });
      }

      const projectSessionRoute = matchProjectSessionRoute(url.pathname);
      if (request.method === "PATCH" && projectSessionRoute) {
        const project = await prisma.project.findUnique({
          where: { id: projectSessionRoute.projectId },
          select: { id: true, quoteApprovalStatus: true, scopeLockedAt: true }
        });

        if (!project) {
          return sendJson(response, 404, { error: "Project not found" });
        }

        if (isProjectScopeLocked(project)) {
          return sendJson(response, 409, {
            error:
              "Approved scope is locked. Use change management to revise this project."
          });
        }

        const body = (await readJsonBody(request)) as { fields?: unknown };
        const sessionDetail = await saveDiscoverySession(
          projectSessionRoute.projectId,
          projectSessionRoute.sessionId,
          body.fields ?? body
        );

        return sendJson(response, 200, { sessionDetail });
      }

      const projectClientUsersRoute = matchProjectClientUsersRoute(url.pathname);
      if (projectClientUsersRoute) {
        if (request.method === "GET") {
          return sendJson(response, 200, {
            clientUsers: await loadClientUsersForProject(
              projectClientUsersRoute.projectId
            )
          });
        }

        if (request.method === "POST") {
          try {
            const body = (await readJsonBody(request)) as {
              firstName?: unknown;
              lastName?: unknown;
              email?: unknown;
              password?: unknown;
              role?: unknown;
              questionnaireAccess?: unknown;
              assignedInputSections?: unknown;
            };

            const clientUser = await createClientPortalUserForProject(
              projectClientUsersRoute.projectId,
              body
            );

            return sendJson(response, 201, { clientUser });
          } catch (error) {
            if (error instanceof Error) {
              return sendJson(response, 400, { error: error.message });
            }

            throw error;
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      const projectClientUserActionRoute = matchProjectClientUserActionRoute(
        url.pathname
      );
      const projectClientUserRoute = matchProjectClientUserRoute(url.pathname);
      if (projectClientUserRoute) {
        if (request.method === "PATCH") {
          try {
            const body = (await readJsonBody(request)) as {
              role?: unknown;
              questionnaireAccess?: unknown;
              assignedInputSections?: unknown;
            };
            const clientUser = await updateClientProjectAccess(
              projectClientUserRoute.projectId,
              projectClientUserRoute.userId,
              body
            );

            return sendJson(response, 200, { clientUser });
          } catch (error) {
            if (
              error instanceof Error &&
              error.message === "Client user not found for this project"
            ) {
              return sendJson(response, 404, { error: error.message });
            }

            if (error instanceof Error) {
              return sendJson(response, 400, { error: error.message });
            }

            throw error;
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      if (projectClientUserActionRoute) {
        if (request.method === "POST") {
          try {
            if (projectClientUserActionRoute.action === "reset-link") {
              const result = await createClientResetLink(
                projectClientUserActionRoute.userId,
                projectClientUserActionRoute.projectId
              );

              return sendJson(response, 200, result);
            }

            const access = await prisma.clientProjectAccess.findUnique({
              where: {
                userId_projectId: {
                  userId: projectClientUserActionRoute.userId,
                  projectId: projectClientUserActionRoute.projectId
                }
              },
              include: {
                user: true
              }
            });

            if (!access) {
              return sendJson(response, 404, {
                error: "Client user not found for this project"
              });
            }

            const inviteToken = crypto.randomBytes(24).toString("hex");
            const inviteTokenExpiresAt = new Date(
              Date.now() + 1000 * 60 * 60 * 24 * 14
            );

            await prisma.clientPortalUser.update({
              where: { id: access.user.id },
              data: {
                inviteToken,
                inviteTokenExpiresAt
              }
            });

            return sendJson(response, 200, {
              user: serializeClientPortalUser(access.user),
              inviteLink: buildClientAccessUrl("/client/activate", inviteToken)
            });
          } catch (error) {
            if (error instanceof Error) {
              return sendJson(response, 400, { error: error.message });
            }

            throw error;
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      const projectMessagesRoute = matchProjectMessagesRoute(url.pathname);
      if (projectMessagesRoute) {
        const project = await prisma.project.findUnique({
          where: { id: projectMessagesRoute.projectId },
          select: { id: true }
        });

        if (!project) {
          return sendJson(response, 404, { error: "Project not found" });
        }

        if (request.method === "GET") {
          await markProjectMessagesSeenByInternal(projectMessagesRoute.projectId);
          return sendJson(response, 200, {
            messages: await loadProjectMessages(projectMessagesRoute.projectId)
          });
        }

        if (request.method === "POST") {
          try {
            const body = (await readJsonBody(request)) as {
              body?: unknown;
              senderName?: unknown;
            };
            const message = await createProjectMessage({
              projectId: projectMessagesRoute.projectId,
              senderType: "internal",
              senderName:
                typeof body.senderName === "string" && body.senderName.trim().length > 0
                  ? body.senderName
                  : "Muloo",
              body: body.body
            });

            return sendJson(response, 201, { message });
          } catch (error) {
            return sendJson(response, 400, {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to post message"
            });
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      const projectSessionEvidenceRoute = matchProjectSessionEvidenceRoute(
        url.pathname
      );
      if (projectSessionEvidenceRoute) {
        if (request.method === "GET") {
          const project = await prisma.project.findUnique({
            where: { id: projectSessionEvidenceRoute.projectId },
            select: { id: true }
          });

          if (!project) {
            return sendJson(response, 404, { error: "Project not found" });
          }

          const evidenceItems = await loadDiscoveryEvidence(
            projectSessionEvidenceRoute.projectId,
            projectSessionEvidenceRoute.sessionId
          );
          return sendJson(response, 200, { evidenceItems });
        }

        if (request.method === "POST") {
          const project = await prisma.project.findUnique({
            where: { id: projectSessionEvidenceRoute.projectId },
            select: { id: true, quoteApprovalStatus: true, scopeLockedAt: true }
          });

          if (!project) {
            return sendJson(response, 404, { error: "Project not found" });
          }

          if (isProjectScopeLocked(project)) {
            return sendJson(response, 409, {
              error:
                "Approved scope is locked. Use change management to revise this project."
            });
          }

          try {
            const body = (await readJsonBody(request)) as {
              evidenceType?: unknown;
              sourceLabel?: unknown;
              sourceUrl?: unknown;
              content?: unknown;
            };
            const evidenceItem = await createDiscoveryEvidence(
              projectSessionEvidenceRoute.projectId,
              projectSessionEvidenceRoute.sessionId,
              body
            );

            return sendJson(response, 201, { evidenceItem });
          } catch (error) {
            if (error instanceof Error) {
              return sendJson(response, 400, { error: error.message });
            }

            throw error;
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      const projectDiscoverySummaryRoute = matchProjectDiscoverySummaryRoute(
        url.pathname
      );
      if (projectDiscoverySummaryRoute) {
        if (request.method === "GET") {
          const project = await prisma.project.findUnique({
            where: { id: projectDiscoverySummaryRoute.projectId },
            select: { id: true }
          });

          if (!project) {
            return sendJson(response, 404, { error: "Project not found" });
          }

          const summary = await loadDiscoverySummary(
            projectDiscoverySummaryRoute.projectId
          );
          return sendJson(response, 200, { summary });
        }

        if (request.method === "POST") {
          let scopeUnlocked = false;

          try {
            await ensureProjectScopeUnlocked(
              projectDiscoverySummaryRoute.projectId
            );
            scopeUnlocked = true;
            const summary = await generateDiscoverySummary(
              projectDiscoverySummaryRoute.projectId
            );
            return sendJson(response, 200, { summary });
          } catch (error: unknown) {
            if (scopeUnlocked) {
              const recoveredSummary = await loadDiscoverySummaryWithRetry(
                projectDiscoverySummaryRoute.projectId
              ).catch(() => null);

              if (recoveredSummary) {
                return sendJson(response, 200, {
                  summary: recoveredSummary,
                  recovered: true
                });
              }
            }

            if (
              error instanceof Error &&
              error.message === "Project not found"
            ) {
              return sendJson(response, 404, { error: error.message });
            }

            if (
              error instanceof Error &&
              error.message ===
                "Approved scope is locked. Use change management to revise this project."
            ) {
              return sendJson(response, 409, { error: error.message });
            }

            if (error instanceof ZodError) {
              return sendJson(response, 502, {
                error: "Discovery summary returned invalid JSON",
                details: error.flatten()
              });
            }

            if (error instanceof SyntaxError) {
              return sendJson(response, 502, {
                error: "Discovery summary returned invalid JSON"
              });
            }

            if (error instanceof Error) {
              return sendJson(response, 500, { error: error.message });
            }

            throw error;
          }
        }

        if (request.method === "DELETE") {
          try {
            const project = await prisma.project.findUnique({
              where: { id: projectDiscoverySummaryRoute.projectId },
              select: { id: true, quoteApprovalStatus: true, scopeLockedAt: true }
            });

            if (!project) {
              return sendJson(response, 404, { error: "Project not found" });
            }

            if (isProjectScopeLocked(project)) {
              return sendJson(response, 409, {
                error:
                  "Approved scope is locked. Use change management to revise this project."
              });
            }

            await resetDiscoverySummary(projectDiscoverySummaryRoute.projectId);
            return sendJson(response, 200, { summary: null });
          } catch (error: unknown) {
            if (error instanceof Error) {
              return sendJson(response, 500, { error: error.message });
            }

            throw error;
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      const projectBlueprintRoute = matchProjectBlueprintRoute(url.pathname);
      if (projectBlueprintRoute) {
        if (
          request.method === "POST" &&
          projectBlueprintRoute.action === "generate"
        ) {
          try {
            await ensureProjectScopeUnlocked(projectBlueprintRoute.projectId);
            const blueprint = await generateBlueprintForProject(
              projectBlueprintRoute.projectId
            );
            return sendJson(response, 200, { blueprint });
          } catch (error: unknown) {
            if (
              error instanceof Error &&
              error.message === "Project not found"
            ) {
              return sendJson(response, 404, { error: error.message });
            }

            if (
              error instanceof Error &&
              error.message.includes("must be complete before generating")
            ) {
              return sendJson(response, 400, { error: error.message });
            }

            if (error instanceof ZodError) {
              return sendJson(response, 502, {
                error: "Blueprint generation returned invalid JSON",
                details: error.flatten()
              });
            }

            if (error instanceof SyntaxError) {
              return sendJson(response, 502, {
                error: "Blueprint generation returned invalid JSON"
              });
            }

            throw error;
          }
        }

        if (request.method === "GET" && !projectBlueprintRoute.action) {
          const blueprint = await loadBlueprint(
            projectBlueprintRoute.projectId
          );

          if (!blueprint) {
            return sendJson(response, 404, { error: "Blueprint not found" });
          }

          return sendJson(response, 200, { blueprint });
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      const projectTasksRoute = matchProjectTasksRoute(url.pathname);
      if (projectTasksRoute) {
        if (
          request.method === "GET" &&
          !projectTasksRoute.action &&
          !projectTasksRoute.taskId
        ) {
          const tasks = await prisma.task.findMany({
            where: { projectId: projectTasksRoute.projectId },
            include: {
              assignedAgent: { select: { name: true } },
              executionJobs: {
                select: {
                  id: true,
                  status: true,
                  resultStatus: true,
                  createdAt: true,
                  completedAt: true
                },
                orderBy: [{ createdAt: "desc" }],
                take: 1
              }
            },
            orderBy: [{ createdAt: "asc" }]
          });

          return sendJson(response, 200, {
            tasks: tasks.map((task) => serializeTask(task))
          });
        }

        if (
          request.method === "POST" &&
          !projectTasksRoute.action &&
          !projectTasksRoute.taskId
        ) {
          try {
            await ensureProjectScopeUnlocked(
              projectTasksRoute.projectId,
              "Approved scope is locked. Use change management to add more project steps."
            );
          } catch (error) {
            return sendJson(
              response,
              error instanceof Error && error.message === "Project not found"
                ? 404
                : 409,
              {
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to create task"
              }
            );
          }

          const body = (await readJsonBody(request)) as {
            title?: unknown;
            description?: unknown;
            category?: unknown;
            executionType?: unknown;
            priority?: unknown;
            status?: unknown;
            plannedHours?: unknown;
            actualHours?: unknown;
            qaRequired?: unknown;
            approvalRequired?: unknown;
            assigneeType?: unknown;
            executionReadiness?: unknown;
            assignedAgentId?: unknown;
          };

          const validStatuses = [
            "todo",
            "waiting_on_client",
            "in_progress",
            "blocked",
            "done"
          ];
          const validAssigneeTypes = ["Human", "Agent", "Client"];
          const validPriorities = ["low", "medium", "high"];
          const validExecutionReadiness = ["not_ready", "assisted", "ready_with_review", "ready"];

          const status =
            typeof body.status === "string" && validStatuses.includes(body.status)
              ? body.status
              : "todo";
          const assigneeType =
            typeof body.assigneeType === "string" &&
            validAssigneeTypes.includes(body.assigneeType)
              ? body.assigneeType
              : "Human";
          const assignedAgentId =
            assigneeType === "Agent" && typeof body.assignedAgentId === "string" && body.assignedAgentId.trim().length > 0
              ? body.assignedAgentId.trim()
              : null;
          const executionReadiness =
            typeof body.executionReadiness === "string" &&
            validExecutionReadiness.includes(body.executionReadiness)
              ? body.executionReadiness
              : assigneeType === "Agent"
                ? "ready_with_review"
                : "not_ready";
          const priority =
            typeof body.priority === "string" &&
            validPriorities.includes(body.priority.toLowerCase())
              ? body.priority.toLowerCase()
              : "medium";

          const task = await prisma.task.create({
            data: {
              projectId: projectTasksRoute.projectId,
              title: normalizeRequiredTaskString(body.title, "title"),
              description: normalizeOptionalTaskString(body.description),
              category: normalizeOptionalTaskString(body.category),
              executionType:
                normalizeOptionalTaskString(body.executionType) ?? "manual",
              priority,
              status,
              plannedHours:
                typeof body.plannedHours === "number"
                  ? body.plannedHours
                  : Number.isFinite(Number(body.plannedHours))
                    ? Number(body.plannedHours)
                    : null,
              actualHours:
                typeof body.actualHours === "number"
                  ? body.actualHours
                  : Number.isFinite(Number(body.actualHours))
                    ? Number(body.actualHours)
                    : null,
              qaRequired: Boolean(body.qaRequired),
              approvalRequired: Boolean(body.approvalRequired),
              assigneeType,
              executionReadiness,
              assignedAgentId
            },
            include: { assignedAgent: { select: { name: true } } }
          });

          return sendJson(response, 201, {
            task: serializeTask(task)
          });
        }

        if (
          request.method === "POST" &&
          projectTasksRoute.action === "generate-plan"
        ) {
          try {
            await ensureProjectPlanGenerationAllowed(
              projectTasksRoute.projectId
            );
          } catch (error) {
            return sendJson(
              response,
              error instanceof Error && error.message === "Project not found"
                ? 404
                : 409,
              {
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to generate project plan"
              }
            );
          }

          const tasks = await generateProjectPlan(projectTasksRoute.projectId);

          return sendJson(response, 200, {
            tasks: tasks.map((task) => serializeTask(task))
          });
        }

        if (request.method === "PATCH" && projectTasksRoute.taskId) {
          const body = (await readJsonBody(request)) as {
            status?: unknown;
            title?: unknown;
            description?: unknown;
            category?: unknown;
            executionType?: unknown;
            priority?: unknown;
            qaRequired?: unknown;
            approvalRequired?: unknown;
            assigneeType?: unknown;
            executionReadiness?: unknown;
            assignedAgentId?: unknown;
            plannedHours?: unknown;
            actualHours?: unknown;
          };
          const validStatuses = [
            "todo",
            "waiting_on_client",
            "in_progress",
            "blocked",
            "done"
          ];
          const validAssigneeTypes = ["Human", "Agent", "Client"];
          const validPriorities = ["low", "medium", "high"];
          const validExecutionReadiness = ["not_ready", "assisted", "ready_with_review", "ready"];

          const existingTask = await prisma.task.findFirst({
            where: {
              id: projectTasksRoute.taskId,
              projectId: projectTasksRoute.projectId
            }
          });

          if (!existingTask) {
            return sendJson(response, 404, { error: "Task not found" });
          }

          const projectLockState = await prisma.project.findUnique({
            where: { id: projectTasksRoute.projectId },
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
              "priority",
              "plannedHours",
              "qaRequired",
              "approvalRequired"
            ].filter((key) =>
              Object.prototype.hasOwnProperty.call(body, key)
            );

            if (blockedKeys.length > 0) {
              return sendJson(response, 409, {
                error:
                  "Approved scope is locked. Use change management to revise scoped task details."
              });
            }
          }

          const data: Record<string, unknown> = {};

          if (body.status !== undefined) {
            const nextStatus =
              typeof body.status === "string" ? body.status.trim() : "";

            if (!validStatuses.includes(nextStatus)) {
              return sendJson(response, 400, { error: "Invalid task status" });
            }

            data.status = nextStatus;
          }

          if (body.title !== undefined) {
            data.title = normalizeRequiredTaskString(body.title, "title");
          }

          if (body.description !== undefined) {
            data.description = normalizeOptionalTaskString(body.description);
          }

          if (body.category !== undefined) {
            data.category = normalizeOptionalTaskString(body.category);
          }

          if (body.executionType !== undefined) {
            data.executionType =
              normalizeOptionalTaskString(body.executionType) ?? "manual";
          }

          if (body.priority !== undefined) {
            if (
              typeof body.priority !== "string" ||
              !validPriorities.includes(body.priority.toLowerCase())
            ) {
              return sendJson(response, 400, { error: "Invalid task priority" });
            }

            data.priority = body.priority.toLowerCase();
          }

          if (body.assigneeType !== undefined) {
            if (
              typeof body.assigneeType !== "string" ||
              !validAssigneeTypes.includes(body.assigneeType)
            ) {
              return sendJson(response, 400, {
                error: "Invalid assignee type"
              });
            }

            data.assigneeType = body.assigneeType;
            if (body.assigneeType !== "Agent") {
              data.assignedAgentId = null;
            }
          }

          if (body.executionReadiness !== undefined) {
            if (typeof body.executionReadiness !== "string" || !validExecutionReadiness.includes(body.executionReadiness)) {
              return sendJson(response, 400, { error: "Invalid execution readiness" });
            }

            data.executionReadiness = body.executionReadiness;
          }

          if (body.assignedAgentId !== undefined) {
            if (body.assignedAgentId === null || body.assignedAgentId === "") {
              data.assignedAgentId = null;
            } else if (typeof body.assignedAgentId === "string") {
              data.assignedAgentId = body.assignedAgentId.trim();
            } else {
              return sendJson(response, 400, { error: "Invalid assigned agent" });
            }
          }

          if (body.plannedHours !== undefined) {
            const plannedHours =
              typeof body.plannedHours === "number"
                ? body.plannedHours
                : Number(body.plannedHours);

            if (!Number.isFinite(plannedHours) || plannedHours < 0) {
              return sendJson(response, 400, {
                error: "Invalid planned hours"
              });
            }

            data.plannedHours = plannedHours;
          }

          if (body.actualHours !== undefined) {
            const actualHours =
              typeof body.actualHours === "number"
                ? body.actualHours
                : Number(body.actualHours);

            if (!Number.isFinite(actualHours) || actualHours < 0) {
              return sendJson(response, 400, {
                error: "Invalid actual hours"
              });
            }

            data.actualHours = actualHours;
          }

          if (body.qaRequired !== undefined) {
            data.qaRequired = Boolean(body.qaRequired);
          }

          if (body.approvalRequired !== undefined) {
            data.approvalRequired = Boolean(body.approvalRequired);
          }

          const task = await prisma.task.update({
            where: { id: projectTasksRoute.taskId },
            data,
            include: { assignedAgent: { select: { name: true } } }
          });

          return sendJson(response, 200, {
            task: serializeTask(task)
          });
        }

        if (request.method === "DELETE" && projectTasksRoute.taskId) {
          try {
            await ensureProjectScopeUnlocked(
              projectTasksRoute.projectId,
              "Approved scope is locked. Use change management to remove or replace project steps."
            );
          } catch (error) {
            return sendJson(
              response,
              error instanceof Error && error.message === "Project not found"
                ? 404
                : 409,
              {
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to delete task"
              }
            );
          }

          const existingTask = await prisma.task.findFirst({
            where: {
              id: projectTasksRoute.taskId,
              projectId: projectTasksRoute.projectId
            }
          });

          if (!existingTask) {
            return sendJson(response, 404, { error: "Task not found" });
          }

          await prisma.executionJob.deleteMany({
            where: { taskId: projectTasksRoute.taskId }
          });
          await prisma.task.delete({
            where: { id: projectTasksRoute.taskId }
          });

          return sendJson(response, 200, { success: true });
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      const projectQuoteRoute = matchProjectQuoteRoute(url.pathname);
      if (projectQuoteRoute) {
        if (request.method === "POST" && projectQuoteRoute.action === "share") {
          try {
            const result = await shareProjectQuote(
              projectQuoteRoute.projectId,
              await readJsonBody(request)
            );
            return sendJson(response, 200, {
              project: result.project,
              quote: result.quote,
              shared: true
            });
          } catch (error) {
            if (
              error instanceof Error &&
              error.message === "Project not found"
            ) {
              return sendJson(response, 404, { error: error.message });
            }

            if (
              error instanceof Error &&
              error.message ===
                "Approved scope is locked. Use change management to revise this project."
            ) {
              return sendJson(response, 409, { error: error.message });
            }

            return sendJson(response, 400, {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to share quote"
            });
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      if (request.method === "POST" && url.pathname === "/api/discovery/save") {
        const body = (await readJsonBody(request)) as {
          projectId?: string;
          session?: number;
          fields?: Record<string, unknown>;
        };

        if (
          !body.projectId ||
          !body.session ||
          !sessionFieldLabels[body.session] ||
          !body.fields ||
          typeof body.fields !== "object" ||
          Array.isArray(body.fields)
        ) {
          return sendJson(response, 400, {
            error: "Invalid discovery payload"
          });
        }

        await saveDiscoverySession(body.projectId, body.session, body.fields);

        return sendJson(response, 200, { success: true });
      }

      if (
        request.method === "POST" &&
        url.pathname === "/api/discovery/extract"
      ) {
        const body = (await readJsonBody(request)) as {
          text?: string;
          session?: number;
        };

        if (!body.text || !body.session || !sessionFieldLabels[body.session]) {
          return sendJson(response, 400, {
            error: "Invalid extraction payload"
          });
        }

        const extraction = await extractDiscoveryFields(
          body.text,
          body.session
        );
        return sendJson(response, 200, extraction);
      }

      if (
        request.method === "POST" &&
        url.pathname === "/api/discovery/fetch-doc"
      ) {
        const body = (await readJsonBody(request)) as {
          url?: string;
          session?: number;
        };

        if (!body.url || !body.session || !sessionFieldLabels[body.session]) {
          return sendJson(response, 400, { error: "Invalid document payload" });
        }

        const docIdMatch = body.url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
        if (!docIdMatch) {
          return sendJson(response, 400, {
            error: "Invalid Google Doc URL"
          });
        }

        const exportUrl = `https://docs.google.com/document/d/${docIdMatch[1]}/export?format=txt`;
        const docResponse = await fetch(exportUrl);
        if (!docResponse.ok) {
          return sendJson(response, 400, {
            error:
              "Could not fetch document. Make sure it is set to public access."
          });
        }

        const docText = await docResponse.text();
        const extraction = await extractDiscoveryFields(docText, body.session);
        return sendJson(response, 200, extraction);
      }

      const clientContactPortalAccessRoute = matchClientContactPortalAccessRoute(
        url.pathname
      );
      if (clientContactPortalAccessRoute) {
        if (request.method === "POST") {
          try {
            const body = (await readJsonBody(request)) as {
              projectIds?: unknown;
              questionnaireAccess?: unknown;
              sendEmail?: unknown;
            };
            const result = await inviteClientContactToProjects(
              clientContactPortalAccessRoute.clientId,
              clientContactPortalAccessRoute.contactId,
              body
            );

            return sendJson(response, 200, result);
          } catch (error) {
            return sendJson(
              response,
              error instanceof Error &&
              ["Client not found", "Client contact not found"].includes(error.message)
                ? 404
                : 400,
              {
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to update client portal access"
              }
            );
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      const clientDirectoryRoute = matchClientDirectoryRoute(url.pathname);
      if (clientDirectoryRoute) {
        if (
          request.method === "GET" &&
          !clientDirectoryRoute.clientId &&
          !clientDirectoryRoute.resource
        ) {
          return sendJson(response, 200, {
            clients: await loadClientsDirectory()
          });
        }

        if (
          request.method === "POST" &&
          !clientDirectoryRoute.clientId &&
          !clientDirectoryRoute.resource
        ) {
          const body = (await readJsonBody(request)) as {
            name: string;
            website?: string;
            logoUrl?: string;
            industry?: string;
            region?: string;
          };

          try {
            const client = await prisma.client.create({
              data: {
                name: body.name,
                slug: createSlug(body.name),
                website: body.website ?? null,
                logoUrl: body.logoUrl ?? null,
                industry: body.industry ?? null,
                region: body.region ?? null
              }
            });

            return sendJson(response, 201, {
              client: {
                id: client.id,
                name: client.name,
                slug: client.slug,
                industry: client.industry,
                region: client.region,
                website: client.website,
                logoUrl: client.logoUrl,
                additionalWebsites: client.additionalWebsites,
                linkedinUrl: client.linkedinUrl,
                facebookUrl: client.facebookUrl,
                instagramUrl: client.instagramUrl,
                xUrl: client.xUrl,
                youtubeUrl: client.youtubeUrl,
                createdAt: client.createdAt.toISOString(),
                updatedAt: client.updatedAt.toISOString(),
                contacts: [],
                projects: []
              }
            });
          } catch (error: unknown) {
            if (isUniqueConstraintError(error)) {
              return sendJson(response, 409, {
                error: "A client with that name already exists"
              });
            }

            throw error;
          }
        }

        if (
          request.method === "PATCH" &&
          clientDirectoryRoute.clientId &&
          !clientDirectoryRoute.resource
        ) {
          try {
            const body = (await readJsonBody(request)) as {
              name?: unknown;
              website?: unknown;
              logoUrl?: unknown;
              industry?: unknown;
              region?: unknown;
            };

            const client = await updateClientDirectoryRecord(
              clientDirectoryRoute.clientId,
              body
            );

            return sendJson(response, 200, { client });
          } catch (error: unknown) {
            if (isUniqueConstraintError(error)) {
              return sendJson(response, 409, {
                error: "A client with that name already exists"
              });
            }

            return sendJson(
              response,
              error instanceof Error && error.message === "Client not found"
                ? 404
                : 400,
              {
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to update client"
              }
            );
          }
        }

        if (
          request.method === "DELETE" &&
          clientDirectoryRoute.clientId &&
          !clientDirectoryRoute.resource
        ) {
          try {
            await deleteClientDirectoryRecord(clientDirectoryRoute.clientId);
            return sendJson(response, 200, { success: true });
          } catch (error: unknown) {
            return sendJson(
              response,
              error instanceof Error && error.message === "Client not found"
                ? 404
                : 400,
              {
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to delete client"
              }
            );
          }
        }

        if (
          request.method === "POST" &&
          clientDirectoryRoute.clientId &&
          clientDirectoryRoute.resource === "contacts" &&
          !clientDirectoryRoute.contactId
        ) {
          try {
            const body = (await readJsonBody(request)) as {
              firstName?: unknown;
              lastName?: unknown;
              email?: unknown;
              title?: unknown;
              canApproveQuotes?: unknown;
            };
            const contact = await createClientContact(
              clientDirectoryRoute.clientId,
              body
            );
            return sendJson(response, 201, { contact });
          } catch (error) {
            if (isUniqueConstraintError(error)) {
              return sendJson(response, 409, {
                error: "A contact with that email already exists for this client"
              });
            }

            return sendJson(response, 400, {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to create client contact"
            });
          }
        }

        if (
          request.method === "PATCH" &&
          clientDirectoryRoute.clientId &&
          clientDirectoryRoute.resource === "contacts" &&
          clientDirectoryRoute.contactId
        ) {
          try {
            const body = (await readJsonBody(request)) as {
              firstName?: unknown;
              lastName?: unknown;
              email?: unknown;
              title?: unknown;
              canApproveQuotes?: unknown;
            };
            const contact = await updateClientContact(
              clientDirectoryRoute.clientId,
              clientDirectoryRoute.contactId,
              body
            );
            return sendJson(response, 200, { contact });
          } catch (error) {
            if (isUniqueConstraintError(error)) {
              return sendJson(response, 409, {
                error: "A contact with that email already exists for this client"
              });
            }

            return sendJson(
              response,
              error instanceof Error && error.message === "Client contact not found"
                ? 404
                : 400,
              {
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to update client contact"
              }
            );
          }
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      if (request.method === "POST" && url.pathname === "/api/portals") {
        const body = (await readJsonBody(request)) as {
          portalId: string;
          displayName: string;
          region?: string;
        };

        try {
          const portal = await prisma.hubSpotPortal.create({
            data: {
              portalId: body.portalId,
              displayName: body.displayName,
              region: body.region ?? null
            }
          });

          return sendJson(response, 201, { portal });
        } catch (error: unknown) {
          if (isUniqueConstraintError(error)) {
            return sendJson(response, 409, {
              error: "A portal with that ID already exists"
            });
          }

          throw error;
        }
      }

      if (
        request.method === "POST" &&
        url.pathname === "/api/projects/from-template"
      ) {
        const payload = createProjectFromTemplateRequestSchema.parse(
          await readJsonBody(request)
        );
        const project = await createProjectFromTemplate(payload);
        return sendJson(response, 201, {
          project,
          summary: await summarizeProject(project)
        });
      }

      if (url.pathname === "/api/projects/validation-summary") {
        return sendJson(response, 200, {
          validations: await validateAllProjects()
        });
      }

      if (request.method === "POST" && url.pathname === "/api/solution-options") {
        const body = (await readJsonBody(request)) as {
          clientName?: string;
          website?: string;
          problemStatement?: string;
          serviceFamily?: string;
        };

        if (typeof body.problemStatement !== "string" || body.problemStatement.trim().length < 20) {
          return sendJson(response, 400, {
            error: "problemStatement must be at least 20 characters"
          });
        }

        const options = await generateSolutionOptions({
          problemStatement: body.problemStatement.trim(),
          ...(typeof body.clientName === "string" && body.clientName.trim().length > 0
            ? { clientName: body.clientName.trim() }
            : {}),
          ...(typeof body.website === "string" && body.website.trim().length > 0
            ? { website: body.website.trim() }
            : {}),
          ...(typeof body.serviceFamily === "string" && body.serviceFamily.trim().length > 0
            ? { serviceFamily: body.serviceFamily.trim() }
            : {})
        });

        return sendJson(response, 200, options);
      }

      const projectModuleRoute = matchProjectModuleRoute(url.pathname);
      if (projectModuleRoute) {
        return sendJson(response, 200, {
          module: await loadProjectModuleDetail(
            projectModuleRoute.projectId,
            projectModuleRoute.moduleKey
          )
        });
      }

      const projectDesignRoute = matchProjectDesignRoute(url.pathname);
      if (projectDesignRoute) {
        if (request.method === "GET" && !projectDesignRoute.resource) {
          const design = await loadProjectDesignById(
            projectDesignRoute.projectId
          );
          return sendJson(response, 200, {
            design,
            validation: await validateProjectById(projectDesignRoute.projectId),
            readiness: await loadProjectReadinessById(
              projectDesignRoute.projectId
            )
          });
        }

        if (
          request.method === "PUT" &&
          projectDesignRoute.resource === "lifecycle"
        ) {
          const payload = updateProjectLifecycleDesignRequestSchema.parse(
            await readJsonBody(request)
          );
          const project = await updateProjectLifecycleDesign(
            projectDesignRoute.projectId,
            payload
          );
          return sendJson(response, 200, {
            project,
            design: await loadProjectDesignById(project.id),
            validation: await validateProjectById(project.id),
            readiness: await loadProjectReadinessById(project.id),
            summary: await summarizeProject(project)
          });
        }

        if (
          request.method === "PUT" &&
          projectDesignRoute.resource === "properties"
        ) {
          const payload = updateProjectPropertiesDesignRequestSchema.parse(
            await readJsonBody(request)
          );
          const project = await updateProjectPropertiesDesign(
            projectDesignRoute.projectId,
            payload
          );
          return sendJson(response, 200, {
            project,
            design: await loadProjectDesignById(project.id),
            validation: await validateProjectById(project.id),
            readiness: await loadProjectReadinessById(project.id),
            summary: await summarizeProject(project)
          });
        }

        if (
          request.method === "PUT" &&
          projectDesignRoute.resource === "pipelines"
        ) {
          const payload = updateProjectPipelinesDesignRequestSchema.parse(
            await readJsonBody(request)
          );
          const project = await updateProjectPipelinesDesign(
            projectDesignRoute.projectId,
            payload
          );
          return sendJson(response, 200, {
            project,
            design: await loadProjectDesignById(project.id),
            validation: await validateProjectById(project.id),
            readiness: await loadProjectReadinessById(project.id),
            summary: await summarizeProject(project)
          });
        }

        return sendJson(response, 405, { error: "Method Not Allowed" });
      }

      const executionRoute = matchExecutionRoute(url.pathname);
      if (executionRoute) {
        if (executionRoute.resource === "steps") {
          return sendJson(response, 200, {
            executionId: executionRoute.executionId,
            steps: await loadExecutionSteps(executionRoute.executionId)
          });
        }

        return sendJson(response, 200, {
          execution: await loadExecutionById(executionRoute.executionId)
        });
      }

      const projectRoute = matchProjectRoute(url.pathname);
      if (projectRoute) {
        if (projectRoute.resource === "changes") {
          if (request.method === "GET") {
            try {
              const result = await loadProjectChangeRequests(projectRoute.projectId);
              return sendJson(response, 200, result);
            } catch (error) {
              return sendJson(
                response,
                error instanceof Error && error.message === "Project not found"
                  ? 404
                  : 400,
                {
                  error:
                    error instanceof Error
                      ? error.message
                      : "Failed to load project change requests"
                }
              );
            }
          }

          if (request.method === "POST") {
            try {
              const project = await prisma.project.findUnique({
                where: { id: projectRoute.projectId },
                include: {
                  client: true
                }
              });

              if (!project) {
                return sendJson(response, 404, { error: "Project not found" });
              }

              const body = (await readJsonBody(request)) as Record<string, unknown>;
              const workRequest = await createWorkRequest({
                ...body,
                projectId: project.id,
                serviceFamily: project.serviceFamily,
                companyName: project.client.name,
                contactName:
                  typeof body.contactName === "string" && body.contactName.trim().length > 0
                    ? body.contactName
                    : project.clientChampionFirstName || project.owner || project.client.name,
                contactEmail:
                  typeof body.contactEmail === "string" && body.contactEmail.trim().length > 0
                    ? body.contactEmail
                    : project.clientChampionEmail || project.ownerEmail || "hello@muloo.co",
                requestType: "change_request"
              });

              return sendJson(response, 201, { workRequest });
            } catch (error) {
              return sendJson(response, 400, {
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to create project change request"
              });
            }
          }

          return sendJson(response, 405, { error: "Method Not Allowed" });
        }

        if (request.method === "GET" && !projectRoute.resource) {
          const project = await prisma.project.findUnique({
            where: { id: projectRoute.projectId },
            include: {
              client: true,
              portal: true
            }
          });

          if (!project) {
            return sendJson(response, 404, { error: "Project not found" });
          }

          return sendJson(response, 200, {
            project: serializeProject(project)
          });
        }
        if (request.method === "PATCH" && !projectRoute.resource) {
          try {
            await ensureProjectScopeUnlocked(projectRoute.projectId);
          } catch (error) {
            return sendJson(
              response,
              error instanceof Error && error.message === "Project not found"
                ? 404
                : 409,
              {
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to update project"
              }
            );
          }

          const body = (await readJsonBody(request)) as {
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
          };

          const normalizedPayload: {
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

          if (body.clientName !== undefined) {
            if (
              typeof body.clientName !== "string" ||
              body.clientName.trim().length === 0
            ) {
              return sendJson(response, 400, {
                error: "clientName must be a non-empty string"
              });
            }

            normalizedPayload.clientName = body.clientName.trim();
          }

          if (body.type !== undefined) {
            if (
              typeof body.type !== "string" ||
              !isValidEngagementType(body.type)
            ) {
              return sendJson(response, 400, {
                error: "Invalid engagement type"
              });
            }

            normalizedPayload.type = body.type;
          }

          if (body.customerPlatformTier !== undefined) {
            if (
              body.customerPlatformTier !== null &&
              (typeof body.customerPlatformTier !== "string" ||
                (body.customerPlatformTier.trim().length > 0 &&
                  !isValidCustomerPlatformTier(
                    body.customerPlatformTier.trim().toLowerCase()
                  )))
            ) {
              return sendJson(response, 400, {
                error: "customerPlatformTier must be starter, professional, enterprise, or blank"
              });
            }

            normalizedPayload.customerPlatformTier =
              typeof body.customerPlatformTier === "string"
                ? body.customerPlatformTier.trim().toLowerCase()
                : "";
          }

          if (body.implementationApproach !== undefined) {
            if (
              typeof body.implementationApproach !== "string" ||
              !isValidImplementationApproach(body.implementationApproach.trim())
            ) {
              return sendJson(response, 400, {
                error:
                  "implementationApproach must be pragmatic_poc or best_practice"
              });
            }

            normalizedPayload.implementationApproach =
              body.implementationApproach.trim();
          }

          if (body.platformTierSelections !== undefined) {
            normalizedPayload.platformTierSelections = normalizePlatformTierSelections(
              body.platformTierSelections
            );
          }

          if (body.problemStatement !== undefined) {
            if (typeof body.problemStatement !== "string") {
              return sendJson(response, 400, {
                error: "problemStatement must be a string"
              });
            }

            normalizedPayload.problemStatement = body.problemStatement.trim();
          }

          if (body.solutionRecommendation !== undefined) {
            if (typeof body.solutionRecommendation !== "string") {
              return sendJson(response, 400, {
                error: "solutionRecommendation must be a string"
              });
            }

            normalizedPayload.solutionRecommendation =
              body.solutionRecommendation.trim();
          }

          if (body.scopeExecutiveSummary !== undefined) {
            if (typeof body.scopeExecutiveSummary !== "string") {
              return sendJson(response, 400, {
                error: "scopeExecutiveSummary must be a string"
              });
            }

            normalizedPayload.scopeExecutiveSummary =
              body.scopeExecutiveSummary.trim();
          }

          if (body.clientQuestionnaireConfig !== undefined) {
            normalizedPayload.clientQuestionnaireConfig =
              normalizeClientQuestionnaireConfig(body.clientQuestionnaireConfig);
          }

          if (body.scopeType !== undefined) {
            if (typeof body.scopeType !== "string") {
              return sendJson(response, 400, {
                error: "scopeType must be a string"
              });
            }

            normalizedPayload.scopeType = body.scopeType.trim();
          }

          if (body.deliveryTemplateId !== undefined) {
            if (
              typeof body.deliveryTemplateId !== "string" &&
              body.deliveryTemplateId !== null
            ) {
              return sendJson(response, 400, {
                error: "deliveryTemplateId must be a string or null"
              });
            }

            normalizedPayload.deliveryTemplateId =
              typeof body.deliveryTemplateId === "string"
                ? body.deliveryTemplateId.trim()
                : "";
          }

          if (body.commercialBrief !== undefined) {
            if (typeof body.commercialBrief !== "string") {
              return sendJson(response, 400, {
                error: "commercialBrief must be a string"
              });
            }

            normalizedPayload.commercialBrief = body.commercialBrief.trim();
          }

          if (body.portalId !== undefined) {
            if (typeof body.portalId !== "string") {
              return sendJson(response, 400, {
                error: "portalId must be a string"
              });
            }

            normalizedPayload.portalId = body.portalId.trim();
          }

          if (body.owner !== undefined) {
            if (typeof body.owner !== "string") {
              return sendJson(response, 400, {
                error: "owner must be a string"
              });
            }

            normalizedPayload.owner = body.owner.trim();
          }

          if (body.ownerEmail !== undefined) {
            if (typeof body.ownerEmail !== "string") {
              return sendJson(response, 400, {
                error: "ownerEmail must be a string"
              });
            }

            normalizedPayload.ownerEmail = body.ownerEmail.trim();
          }

          if (body.clientIndustry !== undefined) {
            if (typeof body.clientIndustry !== "string") {
              return sendJson(response, 400, {
                error: "clientIndustry must be a string"
              });
            }

            normalizedPayload.clientIndustry = body.clientIndustry.trim();
          }

          if (body.clientWebsite !== undefined) {
            if (typeof body.clientWebsite !== "string") {
              return sendJson(response, 400, {
                error: "clientWebsite must be a string"
              });
            }

            normalizedPayload.clientWebsite = body.clientWebsite.trim();
          }

          if (body.clientAdditionalWebsites !== undefined) {
            normalizedPayload.clientAdditionalWebsites = normalizeStringArray(
              body.clientAdditionalWebsites
            );
          }

          if (body.clientLinkedinUrl !== undefined) {
            if (typeof body.clientLinkedinUrl !== "string") {
              return sendJson(response, 400, {
                error: "clientLinkedinUrl must be a string"
              });
            }

            normalizedPayload.clientLinkedinUrl = body.clientLinkedinUrl.trim();
          }

          if (body.clientFacebookUrl !== undefined) {
            if (typeof body.clientFacebookUrl !== "string") {
              return sendJson(response, 400, {
                error: "clientFacebookUrl must be a string"
              });
            }

            normalizedPayload.clientFacebookUrl = body.clientFacebookUrl.trim();
          }

          if (body.clientInstagramUrl !== undefined) {
            if (typeof body.clientInstagramUrl !== "string") {
              return sendJson(response, 400, {
                error: "clientInstagramUrl must be a string"
              });
            }

            normalizedPayload.clientInstagramUrl =
              body.clientInstagramUrl.trim();
          }

          if (body.clientXUrl !== undefined) {
            if (typeof body.clientXUrl !== "string") {
              return sendJson(response, 400, {
                error: "clientXUrl must be a string"
              });
            }

            normalizedPayload.clientXUrl = body.clientXUrl.trim();
          }

          if (body.clientYoutubeUrl !== undefined) {
            if (typeof body.clientYoutubeUrl !== "string") {
              return sendJson(response, 400, {
                error: "clientYoutubeUrl must be a string"
              });
            }

            normalizedPayload.clientYoutubeUrl = body.clientYoutubeUrl.trim();
          }

          if (body.hubs !== undefined) {
            if (
              !Array.isArray(body.hubs) ||
              body.hubs.length === 0 ||
              body.hubs.some((hub) => typeof hub !== "string")
            ) {
              return sendJson(response, 400, {
                error: "hubs must be a non-empty array of hub keys"
              });
            }

            const normalizedHubs = Array.from(
              new Set(body.hubs.map((hub) => hub.trim().toLowerCase()))
            );

            if (normalizedHubs.some((hub) => !isValidProjectHub(hub))) {
              return sendJson(response, 400, {
                error: "Invalid hubs selection"
              });
            }

            normalizedPayload.hubs = normalizedHubs;
          }

          if (body.clientChampionFirstName !== undefined) {
            if (typeof body.clientChampionFirstName !== "string") {
              return sendJson(response, 400, {
                error: "clientChampionFirstName must be a string"
              });
            }

            normalizedPayload.clientChampionFirstName =
              body.clientChampionFirstName.trim();
          }

          if (body.clientChampionLastName !== undefined) {
            if (typeof body.clientChampionLastName !== "string") {
              return sendJson(response, 400, {
                error: "clientChampionLastName must be a string"
              });
            }

            normalizedPayload.clientChampionLastName =
              body.clientChampionLastName.trim();
          }

          if (body.clientChampionEmail !== undefined) {
            if (typeof body.clientChampionEmail !== "string") {
              return sendJson(response, 400, {
                error: "clientChampionEmail must be a string"
              });
            }

            normalizedPayload.clientChampionEmail =
              body.clientChampionEmail.trim();
          }

          if (
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
            return sendJson(response, 400, {
              error: "At least one editable field is required"
            });
          }

          const existingProject = await prisma.project.findUnique({
            where: { id: projectRoute.projectId },
            include: { client: true, portal: true }
          });

          if (!existingProject) {
            return sendJson(response, 404, { error: "Project not found" });
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
                    ? {
                        industry: normalizedPayload.clientIndustry || null
                      }
                    : {}),
                  ...(normalizedPayload.clientWebsite !== undefined
                    ? {
                        website: normalizedPayload.clientWebsite || null
                      }
                    : {}),
                  ...(normalizedPayload.clientAdditionalWebsites !== undefined
                    ? {
                        additionalWebsites:
                          normalizedPayload.clientAdditionalWebsites
                      }
                    : {}),
                  ...(normalizedPayload.clientLinkedinUrl !== undefined
                    ? {
                        linkedinUrl:
                          normalizedPayload.clientLinkedinUrl || null
                      }
                    : {}),
                  ...(normalizedPayload.clientFacebookUrl !== undefined
                    ? {
                        facebookUrl:
                          normalizedPayload.clientFacebookUrl || null
                      }
                    : {}),
                  ...(normalizedPayload.clientInstagramUrl !== undefined
                    ? {
                        instagramUrl:
                          normalizedPayload.clientInstagramUrl || null
                      }
                    : {}),
                  ...(normalizedPayload.clientXUrl !== undefined
                    ? {
                        xUrl: normalizedPayload.clientXUrl || null
                      }
                    : {}),
                  ...(normalizedPayload.clientYoutubeUrl !== undefined
                    ? {
                        youtubeUrl:
                          normalizedPayload.clientYoutubeUrl || null
                      }
                    : {})
                }
              });
            }

            if (normalizedPayload.portalId !== undefined) {
              const portal = normalizedPayload.portalId
                ? await transaction.hubSpotPortal.upsert({
                    where: { portalId: normalizedPayload.portalId },
                    update: {},
                    create: {
                      portalId: normalizedPayload.portalId,
                      displayName: nextClientName
                    }
                  })
                : await transaction.hubSpotPortal.create({
                    data: {
                      portalId: createPendingPortalId(),
                      displayName: nextClientName
                    }
                  });

              nextPortalId = portal.id;
            }

            const updatedProject = await transaction.project.update({
              where: { id: projectRoute.projectId },
              data: {
                ...(normalizedPayload.type
                  ? {
                      engagementType:
                        normalizedPayload.type as Prisma.$Enums.EngagementType
                    }
                  : {}),
                ...(normalizedPayload.customerPlatformTier !== undefined
                  ? {
                      customerPlatformTier:
                        normalizedPayload.customerPlatformTier || null
                    }
                  : {}),
                ...(normalizedPayload.implementationApproach !== undefined
                  ? {
                      implementationApproach:
                        normalizedPayload.implementationApproach
                    }
                  : {}),
                ...(normalizedPayload.platformTierSelections !== undefined
                  ? {
                      platformTierSelections:
                        Object.keys(normalizedPayload.platformTierSelections)
                          .length > 0
                          ? normalizedPayload.platformTierSelections
                          : Prisma.Prisma.JsonNull
                    }
                  : {}),
                ...(normalizedPayload.problemStatement !== undefined
                  ? {
                      problemStatement:
                        normalizedPayload.problemStatement || null
                    }
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
                  ? {
                      deliveryTemplateId:
                        normalizedPayload.deliveryTemplateId || null
                    }
                  : {}),
                ...(normalizedPayload.commercialBrief !== undefined
                  ? {
                      commercialBrief:
                        normalizedPayload.commercialBrief || null
                    }
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
                      clientChampionEmail:
                        normalizedPayload.clientChampionEmail || null
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
              const remainingPortalProjects = await transaction.project.count({
                where: { portalId: existingProject.portalId }
              });

              if (remainingPortalProjects === 0) {
                await transaction.hubSpotPortal.delete({
                  where: { id: existingProject.portalId }
                });
              }
            }

            return updatedProject;
          });

          return sendJson(response, 200, {
            project: serializeProject(project)
          });
        }

        if (request.method === "PATCH" && projectRoute.resource === "status") {
          const body = (await readJsonBody(request)) as { status?: string };
          const allowedStatuses = [
            "active",
            "complete",
            "archived",
            "draft",
            "ready-for-execution",
            "in-flight"
          ];

          if (!body.status || !allowedStatuses.includes(body.status)) {
            return sendJson(response, 400, { error: "Invalid status" });
          }

          try {
            const project = await prisma.project.update({
              where: { id: projectRoute.projectId },
              data: { status: body.status },
              include: { client: true, portal: true, discovery: true }
            });

            return sendJson(response, 200, {
              project: serializeProject(project)
            });
          } catch (error: unknown) {
            if (
              typeof error === "object" &&
              error !== null &&
              "code" in error &&
              error.code === "P2025"
            ) {
              return sendJson(response, 404, { error: "Project not found" });
            }

            throw error;
          }
        }

        if (request.method === "DELETE" && !projectRoute.resource) {
          const existingProject = await prisma.project.findUnique({
            where: { id: projectRoute.projectId },
            select: { id: true, portalId: true }
          });

          if (!existingProject) {
            return sendJson(response, 404, { error: "Project not found" });
          }

          await prisma.executionJob.deleteMany({
            where: { projectId: projectRoute.projectId }
          });
          await prisma.task.deleteMany({
            where: { projectId: projectRoute.projectId }
          });
          await prisma.blueprintTask.deleteMany({
            where: { blueprint: { projectId: projectRoute.projectId } }
          });
          await prisma.blueprint.deleteMany({
            where: { projectId: projectRoute.projectId }
          });
          await prisma.discoverySubmission.deleteMany({
            where: { projectId: projectRoute.projectId }
          });
          await prisma.project.delete({
            where: { id: projectRoute.projectId }
          });

          const remainingProjects = await prisma.project.count({
            where: { portalId: existingProject.portalId }
          });

          if (remainingProjects === 0) {
            await prisma.hubSpotPortal.delete({
              where: { id: existingProject.portalId }
            });
          }

          return sendJson(response, 200, { success: true });
        }

        if (request.method === "PUT" && !projectRoute.resource) {
          const payload = updateProjectMetadataRequestSchema.parse(
            await readJsonBody(request)
          );
          const project = await updateProjectMetadata(
            projectRoute.projectId,
            payload
          );
          return sendJson(response, 200, {
            project,
            summary: await summarizeProject(project)
          });
        }

        if (request.method === "PUT" && projectRoute.resource === "scope") {
          const payload = updateProjectScopeRequestSchema.parse(
            await readJsonBody(request)
          );
          const project = await updateProjectScope(
            projectRoute.projectId,
            payload
          );
          return sendJson(response, 200, {
            project,
            summary: await summarizeProject(project)
          });
        }

        if (
          request.method === "POST" &&
          projectRoute.resource === "email-draft"
        ) {
          try {
            const body = (await readJsonBody(request)) as {
              intent?: unknown;
              mode?: unknown;
              providerKey?: unknown;
              modelOverride?: unknown;
              sourceSubject?: unknown;
              sourceBody?: unknown;
              customInstructions?: unknown;
            };

            if (typeof body.intent !== "string" || body.intent.trim().length === 0) {
              return sendJson(response, 400, {
                error: "intent must be a non-empty string"
              });
            }

            const draft = await generateProjectEmailDraft({
              projectId: projectRoute.projectId,
              intent: body.intent.trim(),
              mode:
                body.mode === "cleanup" || body.mode === "generate"
                  ? body.mode
                  : "generate",
              ...(typeof body.providerKey === "string" &&
              body.providerKey.trim().length > 0
                ? { providerKey: body.providerKey.trim() }
                : {}),
              ...(typeof body.modelOverride === "string"
                ? { modelOverride: body.modelOverride.trim() }
                : {}),
              ...(typeof body.sourceSubject === "string"
                ? { sourceSubject: body.sourceSubject }
                : {}),
              ...(typeof body.sourceBody === "string"
                ? { sourceBody: body.sourceBody }
                : {}),
              ...(typeof body.customInstructions === "string"
                ? { customInstructions: body.customInstructions.trim() }
                : {})
            });

            return sendJson(response, 200, { draft });
          } catch (error) {
            return sendJson(
              response,
              error instanceof Error && error.message === "Project not found"
                ? 404
                : 400,
              {
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to draft project email"
              }
            );
          }
        }

        if (
          request.method === "POST" &&
          projectRoute.resource === "send-email"
        ) {
          try {
            const body = (await readJsonBody(request)) as {
              to?: unknown;
              cc?: unknown;
              subject?: unknown;
              body?: unknown;
            };

            const result = await sendWorkspaceEmail(body);
            const toRecipients = (Array.isArray(body.to) ? body.to : [body.to])
              .flatMap((entry) =>
                typeof entry === "string" ? entry.split(/[,\n;]/) : []
              )
              .map((entry) => entry.trim())
              .filter(Boolean);
            const ccRecipients = (Array.isArray(body.cc) ? body.cc : [body.cc])
              .flatMap((entry) =>
                typeof entry === "string" ? entry.split(/[,\n;]/) : []
              )
              .map((entry) => entry.trim())
              .filter(Boolean);
            await createProjectMessage({
              projectId: projectRoute.projectId,
              senderType: "internal",
              senderName: "Muloo Email Composer",
              body: `Email sent\nTo: ${toRecipients.join(", ")}${
                ccRecipients.length > 0
                  ? `\nCc: ${ccRecipients.join(", ")}`
                  : ""
              }\nSubject: ${
                typeof body.subject === "string" ? body.subject.trim() : ""
              }\n\n${
                typeof body.body === "string" ? body.body.trim() : ""
              }`
            });
            return sendJson(response, 200, { sent: true, result });
          } catch (error) {
            return sendJson(response, 400, {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to send email"
            });
          }
        }

        if (projectRoute.resource === "discovery") {
          if (request.method === "GET") {
            return sendJson(response, 200, {
              projectId: projectRoute.projectId,
              discovery: await loadProjectDiscoveryById(projectRoute.projectId)
            });
          }

          if (request.method === "PUT") {
            const payload = updateProjectDiscoverySectionRequestSchema.parse(
              await readJsonBody(request)
            );
            const project = await updateProjectDiscoverySection(
              projectRoute.projectId,
              payload
            );

            return sendJson(response, 200, {
              project,
              discovery: await loadProjectDiscoveryById(project.id),
              summary: await summarizeProject(project)
            });
          }
        }

        if (request.method !== "GET") {
          return sendJson(response, 405, { error: "Method Not Allowed" });
        }

        if (projectRoute.resource === "modules") {
          const project = await loadProjectById(projectRoute.projectId);
          return sendJson(response, 200, {
            projectId: project.id,
            modules: summarizeProjectModules(project)
          });
        }

        if (projectRoute.resource === "summary") {
          return sendJson(response, 200, {
            summary: await loadProjectSummaryById(projectRoute.projectId)
          });
        }

        if (projectRoute.resource === "validation") {
          return sendJson(response, 200, {
            validation: await validateProjectById(projectRoute.projectId)
          });
        }

        if (projectRoute.resource === "readiness") {
          return sendJson(response, 200, {
            readiness: await loadProjectReadinessById(projectRoute.projectId)
          });
        }

        if (projectRoute.resource === "executions") {
          return sendJson(response, 200, {
            executions: await loadProjectExecutions(projectRoute.projectId)
          });
        }

        const project = await prisma.project.findUnique({
          where: { id: projectRoute.projectId },
          include: { client: true, portal: true, discovery: true }
        });
        if (!project) {
          return sendJson(response, 404, { error: "Project not found" });
        }
        return sendJson(response, 200, {
          project: serializeProject(project)
        });
      }

      if (url.pathname.startsWith("/api/")) {
        return sendJson(response, 404, { error: "Not Found" });
      }

      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("Not Found");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unexpected server error";
      const statusCode =
        error instanceof ZodError
          ? 400
          : (error instanceof Error &&
                "code" in error &&
                error.code === "ENOENT") ||
              message.includes("was not found")
            ? 404
            : 500;
      sendJson(response, statusCode, { error: message });
    }
  });
}
