import { moduleDefinitionSchema, type ModuleDefinition } from "./domain";

const catalog: ModuleDefinition[] = [
  {
    id: "crm-setup",
    name: "CRM Setup",
    summary: "Baseline HubSpot object and record configuration workflows.",
    route: "/modules",
    category: "delivery",
    status: "in-progress",
    requiresHubSpot: true
  },
  {
    id: "pipelines",
    name: "Pipelines",
    summary:
      "Pipeline and stage modelling for post-discovery delivery handoff.",
    route: "/modules",
    category: "delivery",
    status: "planned",
    requiresHubSpot: true
  },
  {
    id: "properties",
    name: "Properties",
    summary: "Custom property standards, diffing, review, and safe execution.",
    route: "/modules",
    category: "delivery",
    status: "in-progress",
    requiresHubSpot: true
  },
  {
    id: "automation",
    name: "Automation",
    summary:
      "Workflow and lifecycle automation foundations with execution guardrails.",
    route: "/modules",
    category: "operations",
    status: "planned",
    requiresHubSpot: true
  },
  {
    id: "reporting",
    name: "Reporting",
    summary:
      "Reporting foundations, dashboards, and operator review checkpoints.",
    route: "/modules",
    category: "operations",
    status: "planned",
    requiresHubSpot: true
  },
  {
    id: "qa",
    name: "QA",
    summary:
      "Quality checks, audit evidence, and delivery readiness validation.",
    route: "/modules",
    category: "assurance",
    status: "planned",
    requiresHubSpot: false
  }
];

export const moduleCatalog = moduleDefinitionSchema.array().parse(catalog);
