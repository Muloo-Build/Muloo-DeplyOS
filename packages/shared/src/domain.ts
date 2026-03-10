import { z } from "zod";

export const moduleStatusSchema = z.enum([
  "planned",
  "in-progress",
  "available"
]);
export const projectStatusSchema = z.enum([
  "draft",
  "scoping",
  "designed",
  "ready-for-execution",
  "in-flight",
  "completed"
]);
export const projectModuleStatusSchema = z.enum([
  "not-started",
  "planned",
  "ready",
  "blocked"
]);
export const executionStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled"
]);
export const actorTypeSchema = z.enum(["operator", "system", "agent"]);
export const implementationTypeSchema = z.enum([
  "sales-hub-foundation",
  "marketing-ops-rollout",
  "service-hub-enablement",
  "multi-hub-implementation"
]);
export const hubInScopeSchema = z.enum([
  "sales",
  "marketing",
  "service",
  "cms",
  "ops"
]);
export const hubspotEnvironmentSchema = z.enum(["sandbox", "production"]);
export const objectTypeSchema = z.enum([
  "contacts",
  "companies",
  "deals",
  "tickets"
]);
export const validationStatusSchema = z.enum([
  "draft",
  "validated",
  "needs-review"
]);
export const propertyValueTypeSchema = z.enum([
  "string",
  "number",
  "date",
  "datetime",
  "enumeration",
  "bool"
]);
export const propertyFieldTypeSchema = z.enum([
  "text",
  "textarea",
  "number",
  "date",
  "booleancheckbox",
  "radio",
  "select",
  "checkbox"
]);

export const clientSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
    industry: z.string().min(1).optional(),
    lifecycleStage: z
      .enum(["discovery-complete", "onboarding", "active-delivery"])
      .default("discovery-complete")
  })
  .strict();

export const hubSpotPortalSchema = z
  .object({
    portalId: z.string().min(1),
    displayName: z.string().min(1),
    region: z.string().min(1).optional(),
    connected: z.boolean().default(false)
  })
  .strict();

export const pipelineStageSchema = z
  .object({
    internalName: z.string().min(1),
    label: z.string().min(1),
    order: z.number().int().nonnegative(),
    probability: z.number().int().min(0).max(100).optional()
  })
  .strict();

export const pipelineSchema = z
  .object({
    objectType: z.enum(["deals", "tickets"]),
    internalName: z.string().min(1),
    label: z.string().min(1),
    stages: z.array(pipelineStageSchema).min(1)
  })
  .strict();

export const customObjectPlanSchema = z
  .object({
    internalName: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1)
  })
  .strict();

export const propertyOptionPlanSchema = z
  .object({
    label: z.string().min(1),
    value: z.string().min(1),
    displayOrder: z.number().int().nonnegative().optional()
  })
  .strict();

export const propertyGroupPlanSchema = z
  .object({
    internalName: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1).optional()
  })
  .strict();

export const groupedPropertyGroupPlanSchema = z
  .object({
    objectType: objectTypeSchema,
    groups: z.array(propertyGroupPlanSchema).default([])
  })
  .strict();

export const propertyPlanSchema = z
  .object({
    internalName: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1).optional(),
    required: z.boolean(),
    valueType: propertyValueTypeSchema,
    fieldType: propertyFieldTypeSchema,
    groupName: z.string().min(1),
    options: z.array(propertyOptionPlanSchema).optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.valueType === "enumeration" && !value.options?.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enumeration fields must include at least one option.",
        path: ["options"]
      });
    }
  });

export const groupedPropertyPlanSchema = z
  .object({
    objectType: objectTypeSchema,
    properties: z.array(propertyPlanSchema).default([])
  })
  .strict();

export const moduleDefinitionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    summary: z.string().min(1),
    route: z.string().min(1),
    category: z.enum(["delivery", "operations", "assurance"]),
    status: moduleStatusSchema,
    requiresHubSpot: z.boolean().default(false)
  })
  .strict();

export const projectModulePlanSchema = z
  .object({
    moduleId: z.string().min(1),
    status: projectModuleStatusSchema,
    dependencies: z.array(z.string().min(1)).default([]),
    notes: z.string().min(1).optional()
  })
  .strict();

export const executionSummarySchema = z
  .object({
    status: z.enum(["never-run", "success", "warning", "failed"]),
    lastRunAt: z.string().datetime().optional(),
    artifactPath: z.string().min(1).optional(),
    notes: z.string().min(1).optional()
  })
  .strict();

export const executionContextSchema = z
  .object({
    dryRunEnabled: z.boolean().default(true),
    validationStatus: validationStatusSchema,
    lastExecutionSummary: executionSummarySchema
  })
  .strict();

export const onboardingProjectSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    id: z.string().min(1),
    name: z.string().min(1),
    clientId: z.string().min(1),
    portalId: z.string().min(1),
    status: projectStatusSchema,
    owner: z
      .object({
        name: z.string().min(1),
        email: z.string().email()
      })
      .strict(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    clientContext: z
      .object({
        clientName: z.string().min(1),
        primaryRegion: z.string().min(1),
        implementationType: implementationTypeSchema,
        notes: z.string().min(1)
      })
      .strict(),
    hubspotScope: z
      .object({
        hubsInScope: z.array(hubInScopeSchema).min(1),
        portal: hubSpotPortalSchema,
        environment: hubspotEnvironmentSchema
      })
      .strict(),
    crmDesign: z
      .object({
        lifecycleStages: z.array(z.string().min(1)).min(1),
        leadStatuses: z.array(z.string().min(1)).min(1),
        pipelines: z.array(pipelineSchema).default([]),
        objectsInScope: z.array(objectTypeSchema).min(1),
        customObjectsPlanned: z.array(customObjectPlanSchema).default([])
      })
      .strict(),
    propertyPlanning: z
      .object({
        propertyGroupsByObject: z
          .array(groupedPropertyGroupPlanSchema)
          .default([]),
        propertiesByObject: z.array(groupedPropertyPlanSchema).min(1)
      })
      .strict(),
    modulePlanning: z.array(projectModulePlanSchema).min(1),
    executionContext: executionContextSchema
  })
  .strict();

export const projectSummarySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    status: projectStatusSchema,
    clientName: z.string().min(1),
    primaryRegion: z.string().min(1),
    implementationType: implementationTypeSchema,
    portalDisplayName: z.string().min(1),
    hubsInScope: z.array(hubInScopeSchema),
    moduleCount: z.number().int().nonnegative(),
    readyModuleCount: z.number().int().nonnegative(),
    dryRunEnabled: z.boolean(),
    updatedAt: z.string().datetime()
  })
  .strict();

export const projectModuleSummarySchema = z
  .object({
    moduleId: z.string().min(1),
    name: z.string().min(1),
    summary: z.string().min(1),
    category: z.enum(["delivery", "operations", "assurance"]),
    requiresHubSpot: z.boolean(),
    status: projectModuleStatusSchema,
    dependencies: z.array(z.string().min(1))
  })
  .strict();

export const executionStepSchema = z
  .object({
    id: z.string().min(1),
    jobId: z.string().min(1),
    key: z.string().min(1),
    label: z.string().min(1),
    order: z.number().int().nonnegative(),
    status: executionStatusSchema,
    message: z.string().min(1).optional(),
    startedAt: z.string().datetime().optional(),
    finishedAt: z.string().datetime().optional()
  })
  .strict();

export const executionJobSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    moduleId: z.string().min(1),
    status: executionStatusSchema,
    trigger: z.enum(["manual", "scheduled", "agent"]),
    createdAt: z.string().datetime(),
    startedAt: z.string().datetime().optional(),
    finishedAt: z.string().datetime().optional()
  })
  .strict();

export const auditLogSchema = z
  .object({
    id: z.string().min(1),
    entityType: z.enum([
      "project",
      "job",
      "step",
      "module",
      "portal",
      "client"
    ]),
    entityId: z.string().min(1),
    action: z.string().min(1),
    actorType: actorTypeSchema,
    actorId: z.string().min(1).optional(),
    timestamp: z.string().datetime(),
    metadata: z.record(z.unknown()).optional()
  })
  .strict();

export type Client = z.infer<typeof clientSchema>;
export type HubSpotPortal = z.infer<typeof hubSpotPortalSchema>;
export type OnboardingProject = z.infer<typeof onboardingProjectSchema>;
export type ModuleDefinition = z.infer<typeof moduleDefinitionSchema>;
export type ProjectModulePlan = z.infer<typeof projectModulePlanSchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type ProjectModuleSummary = z.infer<typeof projectModuleSummarySchema>;
export type ExecutionJob = z.infer<typeof executionJobSchema>;
export type ExecutionStep = z.infer<typeof executionStepSchema>;
export type AuditLog = z.infer<typeof auditLogSchema>;
