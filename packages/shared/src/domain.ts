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
export const templateTypeSchema = z.enum([
  "sales-foundation",
  "revops-foundation",
  "service-foundation"
]);
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
export const operationalValidationStatusSchema = z.enum([
  "valid",
  "warning",
  "invalid",
  "blocked"
]);
export const readinessOutcomeSchema = z.enum(["ready", "not_ready"]);
export const executionModeSchema = z.enum(["dry-run", "apply"]);
export const executionTypeSchema = z.enum(["project-module", "legacy-spec"]);
export const taskExecutionLaneSchema = z.enum([
  "api",
  "cowork",
  "manual",
  "blocked_by_tier"
]);
export const taskValidationStatusSchema = z.enum([
  "pending",
  "confirmed",
  "failed",
  "skipped"
]);
export const executionStepTypeSchema = z.enum([
  "project",
  "validation",
  "input",
  "integration",
  "analysis",
  "guardrail",
  "execution",
  "artifact",
  "persistence"
]);
export const moduleInputStatusSchema = z.enum(["present", "missing"]);
export const readinessReasonTypeSchema = z.enum([
  "dependency",
  "validation",
  "input",
  "operator"
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
export const moduleOperationTypeSchema = z.enum([
  "create-contact-property",
  "update-contact-property",
  "delete-contact-property",
  "rename-contact-property",
  "mutate-contact-property-options",
  "create-pipeline",
  "update-pipeline",
  "delete-pipeline"
]);
export const executionOperationStatusSchema = z.enum([
  "requested",
  "executed",
  "blocked"
]);
export const aiProviderSchema = z.enum([
  "openai",
  "anthropic",
  "perplexity",
  "gemini"
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
    stages: z.array(pipelineStageSchema).default([])
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
    description: z.string().min(1).optional(),
    sourceTag: z.string().min(1).optional()
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
    options: z.array(propertyOptionPlanSchema).optional(),
    sourceTag: z.string().min(1).optional()
  })
  .strict()
  .superRefine((value, context) => {
    const optionRequiredFieldTypes = new Set(["select", "radio", "checkbox"]);

    if (
      (value.valueType === "enumeration" ||
        optionRequiredFieldTypes.has(value.fieldType)) &&
      !value.options?.length
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enumeration-style fields must include at least one option.",
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

export const propertyLibraryGroupSchema = z
  .object({
    objectType: objectTypeSchema,
    internalName: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1).optional(),
    sourceTag: z.string().min(1)
  })
  .strict();

export const propertyLibraryEntrySchema = z
  .object({
    objectType: objectTypeSchema,
    groupName: z.string().min(1),
    internalName: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1).optional(),
    required: z.boolean(),
    valueType: propertyValueTypeSchema,
    fieldType: propertyFieldTypeSchema,
    options: z.array(propertyOptionPlanSchema).optional(),
    sourceTag: z.string().min(1)
  })
  .strict()
  .superRefine((value, context) => {
    const optionRequiredFieldTypes = new Set(["select", "radio", "checkbox"]);

    if (
      (value.valueType === "enumeration" ||
        optionRequiredFieldTypes.has(value.fieldType)) &&
      !value.options?.length
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Enumeration-style library fields must include at least one option.",
        path: ["options"]
      });
    }
  });

export const propertyLibrarySchema = z
  .object({
    groups: z.array(propertyLibraryGroupSchema).default([]),
    properties: z.array(propertyLibraryEntrySchema).default([])
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

export const projectTemplateProvenanceSchema = z
  .object({
    seedType: z.enum(["blank", "template"]),
    templateId: z.string().min(1).optional(),
    templateName: z.string().min(1).optional(),
    seededAt: z.string().datetime(),
    baselineSourceTags: z.array(z.string().min(1)).default([]),
    seededModuleIds: z.array(z.string().min(1)).default([])
  })
  .strict();

export const onboardingTemplateSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    templateType: templateTypeSchema,
    hubsInScope: z.array(hubInScopeSchema).min(1),
    environment: hubspotEnvironmentSchema.optional(),
    defaultModules: z.array(projectModulePlanSchema).min(1),
    defaultLifecycleStages: z.array(z.string().min(1)).default([]),
    defaultLeadStatuses: z.array(z.string().min(1)).default([]),
    defaultObjectsInScope: z.array(objectTypeSchema).min(1),
    propertyLibrary: propertyLibrarySchema,
    defaultPipelines: z.array(pipelineSchema).default([]),
    notes: z.array(z.string().min(1)).default([]),
    assumptions: z.array(z.string().min(1)).default([])
  })
  .strict();

export const discoverySectionKeySchema = z.enum([
  "businessContext",
  "platformContext",
  "crmArchitecture",
  "salesRequirements",
  "marketingRequirements",
  "serviceRequirements",
  "integrationsAndData",
  "governanceAndOps",
  "risksAndAssumptions"
]);

export const discoveryBusinessContextSchema = z
  .object({
    companyName: z.string().default(""),
    businessModel: z.string().default(""),
    region: z.string().default(""),
    teamStructure: z.string().default(""),
    growthGoals: z.array(z.string().min(1)).default([]),
    implementationObjectives: z.array(z.string().min(1)).default([])
  })
  .strict();

export const discoveryPlatformContextSchema = z
  .object({
    currentHubspotUsage: z.string().default(""),
    activeHubs: z.array(z.string().min(1)).default([]),
    subscriptionTiers: z.array(z.string().min(1)).default([]),
    existingCrmCleanliness: z.string().default(""),
    connectedTools: z.array(z.string().min(1)).default([]),
    migrationNeeds: z.string().default("")
  })
  .strict();

export const discoveryCrmArchitectureSchema = z
  .object({
    objectsInScope: z.array(z.string().min(1)).default([]),
    contactCompanyRules: z.string().default(""),
    dealPipelines: z.array(z.string().min(1)).default([]),
    lifecycleStages: z.array(z.string().min(1)).default([]),
    leadStatuses: z.array(z.string().min(1)).default([]),
    ownershipModel: z.string().default(""),
    associations: z.string().default("")
  })
  .strict();

export const discoverySalesRequirementsSchema = z
  .object({
    pipelineRequirements: z.string().default(""),
    qualificationLogic: z.string().default(""),
    sdrAeProcess: z.string().default(""),
    taskAutomationNeeds: z.string().default(""),
    reportingNeeds: z.string().default("")
  })
  .strict();

export const discoveryMarketingRequirementsSchema = z
  .object({
    segmentation: z.string().default(""),
    campaignStructure: z.string().default(""),
    forms: z.string().default(""),
    leadCapture: z.string().default(""),
    emailNeeds: z.string().default(""),
    reportingNeeds: z.string().default("")
  })
  .strict();

export const discoveryServiceRequirementsSchema = z
  .object({
    tickets: z.string().default(""),
    supportCategories: z.string().default(""),
    routingLogic: z.string().default(""),
    slas: z.string().default(""),
    portalOrHelpCentreRequirements: z.string().default("")
  })
  .strict();

export const discoveryIntegrationsAndDataSchema = z
  .object({
    sourceSystems: z.array(z.string().min(1)).default([]),
    syncDirection: z.string().default(""),
    fieldMappingNeeds: z.string().default(""),
    importRequirements: z.string().default(""),
    dedupeConcerns: z.string().default("")
  })
  .strict();

export const discoveryGovernanceAndOpsSchema = z
  .object({
    namingConventions: z.string().default(""),
    permissions: z.string().default(""),
    qaRequirements: z.string().default(""),
    trainingNeeds: z.string().default(""),
    handoverNeeds: z.string().default("")
  })
  .strict();

export const discoveryRisksAndAssumptionsSchema = z
  .object({
    blockers: z.array(z.string().min(1)).default([]),
    dependencies: z.array(z.string().min(1)).default([]),
    accessIssues: z.array(z.string().min(1)).default([]),
    customDevLikely: z.boolean().nullable().default(null),
    assumptions: z.array(z.string().min(1)).default([])
  })
  .strict();

export const projectDiscoverySchema = z
  .object({
    completedSections: z.array(discoverySectionKeySchema).default([]),
    businessContext: discoveryBusinessContextSchema.default({}),
    platformContext: discoveryPlatformContextSchema.default({}),
    crmArchitecture: discoveryCrmArchitectureSchema.default({}),
    salesRequirements: discoverySalesRequirementsSchema.default({}),
    marketingRequirements: discoveryMarketingRequirementsSchema.default({}),
    serviceRequirements: discoveryServiceRequirementsSchema.default({}),
    integrationsAndData: discoveryIntegrationsAndDataSchema.default({}),
    governanceAndOps: discoveryGovernanceAndOpsSchema.default({}),
    risksAndAssumptions: discoveryRisksAndAssumptionsSchema.default({}),
    updatedAt: z.string().datetime().optional()
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
        lifecycleStages: z.array(z.string().min(1)).default([]),
        leadStatuses: z.array(z.string().min(1)).default([]),
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
    executionContext: executionContextSchema,
    templateProvenance: projectTemplateProvenanceSchema.optional(),
    discovery: projectDiscoverySchema.optional()
  })
  .strict();

export const validationFindingSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1)
  })
  .strict();

export const projectOwnerInputSchema = z
  .object({
    name: z.string().min(1),
    email: z.string().email()
  })
  .strict();

export const projectClientContextInputSchema = z
  .object({
    clientName: z.string().min(1),
    primaryRegion: z.string().min(1),
    implementationType: implementationTypeSchema,
    notes: z.string().min(1)
  })
  .strict();

export const projectHubspotScopeInputSchema = z
  .object({
    hubsInScope: z.array(hubInScopeSchema).min(1),
    environment: hubspotEnvironmentSchema
  })
  .strict();

export const projectModuleSelectionSchema = z
  .object({
    moduleId: z.string().min(1),
    status: projectModuleStatusSchema.default("planned"),
    dependencies: z.array(z.string().min(1)).default([]),
    notes: z.string().min(1).optional()
  })
  .strict();

export const createProjectRequestSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    clientId: z.string().min(1),
    portalId: z.string().min(1),
    owner: projectOwnerInputSchema,
    clientContext: projectClientContextInputSchema,
    hubspotScope: projectHubspotScopeInputSchema,
    moduleSelection: z.array(projectModuleSelectionSchema).min(1),
    status: projectStatusSchema.optional()
  })
  .strict();

export const createProjectFromTemplateRequestSchema = createProjectRequestSchema
  .extend({
    templateId: z.string().min(1)
  })
  .strict();

export const updateProjectMetadataRequestSchema = z
  .object({
    name: z.string().min(1).optional(),
    clientId: z.string().min(1).optional(),
    status: projectStatusSchema.optional(),
    owner: projectOwnerInputSchema.optional(),
    clientContext: projectClientContextInputSchema.partial().optional(),
    hubspotScope: projectHubspotScopeInputSchema.optional(),
    portalId: z.string().min(1).optional()
  })
  .strict();

export const updateProjectScopeRequestSchema = z
  .object({
    moduleSelection: z.array(projectModuleSelectionSchema).min(1),
    hubsInScope: z.array(hubInScopeSchema).min(1).optional(),
    environment: hubspotEnvironmentSchema.optional()
  })
  .strict();

export const updateProjectLifecycleDesignRequestSchema = z
  .object({
    lifecycleStages: z.array(z.string().min(1)).default([]),
    leadStatuses: z.array(z.string().min(1)).default([])
  })
  .strict();

export const updateProjectPropertiesDesignRequestSchema = z
  .object({
    propertyGroupsByObject: z.array(groupedPropertyGroupPlanSchema).default([]),
    propertiesByObject: z.array(groupedPropertyPlanSchema).default([])
  })
  .strict();

export const updateProjectPipelinesDesignRequestSchema = z
  .object({
    pipelines: z.array(pipelineSchema).default([])
  })
  .strict();

export const updateProjectDiscoverySectionRequestSchema = z
  .object({
    section: discoverySectionKeySchema,
    data: z.union([
      discoveryBusinessContextSchema.partial(),
      discoveryPlatformContextSchema.partial(),
      discoveryCrmArchitectureSchema.partial(),
      discoverySalesRequirementsSchema.partial(),
      discoveryMarketingRequirementsSchema.partial(),
      discoveryServiceRequirementsSchema.partial(),
      discoveryIntegrationsAndDataSchema.partial(),
      discoveryGovernanceAndOpsSchema.partial(),
      discoveryRisksAndAssumptionsSchema.partial()
    ])
  })
  .strict();

export const projectDesignSchema = z
  .object({
    projectId: z.string().min(1),
    lifecycleStages: z.array(z.string().min(1)).default([]),
    leadStatuses: z.array(z.string().min(1)).default([]),
    objectsInScope: z.array(objectTypeSchema).default([]),
    propertyPlanning: z
      .object({
        propertyGroupsByObject: z
          .array(groupedPropertyGroupPlanSchema)
          .default([]),
        propertiesByObject: z.array(groupedPropertyPlanSchema).default([])
      })
      .strict(),
    pipelines: z.array(pipelineSchema).default([]),
    templateProvenance: projectTemplateProvenanceSchema.optional()
  })
  .strict();

export const moduleInputRequirementSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1),
    required: z.boolean()
  })
  .strict();

export const moduleInputRequirementStatusSchema = moduleInputRequirementSchema
  .extend({
    status: moduleInputStatusSchema,
    message: z.string().min(1).optional()
  })
  .strict();

export const readinessReasonSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    type: readinessReasonTypeSchema
  })
  .strict();

export const moduleValidationResultSchema = z
  .object({
    moduleId: z.string().min(1),
    status: operationalValidationStatusSchema,
    readiness: readinessOutcomeSchema,
    blockers: z.array(readinessReasonSchema).default([]),
    missingInputs: z.array(moduleInputRequirementStatusSchema).default([]),
    inputRequirements: z.array(moduleInputRequirementStatusSchema).default([]),
    errors: z.array(validationFindingSchema),
    warnings: z.array(validationFindingSchema),
    infos: z.array(validationFindingSchema)
  })
  .strict();

export const projectValidationResultSchema = z
  .object({
    projectId: z.string().min(1),
    status: operationalValidationStatusSchema,
    readiness: readinessOutcomeSchema,
    errors: z.array(validationFindingSchema),
    warnings: z.array(validationFindingSchema),
    infos: z.array(validationFindingSchema),
    modules: z.array(moduleValidationResultSchema),
    validatedAt: z.string().datetime(),
    derivedExecutionValidationStatus: validationStatusSchema
  })
  .strict();

export const projectReadinessSummarySchema = z
  .object({
    projectId: z.string().min(1),
    status: operationalValidationStatusSchema,
    readiness: readinessOutcomeSchema,
    readyModuleIds: z.array(z.string().min(1)),
    blockedModuleIds: z.array(z.string().min(1)),
    invalidModuleIds: z.array(z.string().min(1)),
    warningModuleIds: z.array(z.string().min(1)),
    blockers: z.array(readinessReasonSchema).default([]),
    warnings: z.array(validationFindingSchema).default([]),
    moduleDetails: z
      .array(
        z
          .object({
            moduleId: z.string().min(1),
            status: operationalValidationStatusSchema,
            readiness: readinessOutcomeSchema,
            blockerCount: z.number().int().nonnegative(),
            warningCount: z.number().int().nonnegative(),
            missingInputCount: z.number().int().nonnegative()
          })
          .strict()
      )
      .default([])
  })
  .strict();

export const executionJobSummaryMetricsSchema = z
  .object({
    desiredPropertyCount: z.number().int().nonnegative().optional(),
    existingPropertyCount: z.number().int().nonnegative().optional(),
    unchangedCount: z.number().int().nonnegative().optional(),
    toCreateCount: z.number().int().nonnegative().optional(),
    needsReviewCount: z.number().int().nonnegative().optional(),
    desiredPipelineCount: z.number().int().nonnegative().optional(),
    existingPipelineCount: z.number().int().nonnegative().optional(),
    unchangedPipelineCount: z.number().int().nonnegative().optional(),
    toCreatePipelineCount: z.number().int().nonnegative().optional(),
    needsReviewPipelineCount: z.number().int().nonnegative().optional(),
    desiredStageCount: z.number().int().nonnegative().optional(),
    existingStageCount: z.number().int().nonnegative().optional(),
    requestedOperationCount: z.number().int().nonnegative().optional(),
    executedOperationCount: z.number().int().nonnegative().optional(),
    blockedOperationCount: z.number().int().nonnegative().optional(),
    createdPropertyCount: z.number().int().nonnegative().optional()
  })
  .strict();

export const executionJobOutputSchema = z
  .object({
    artifactPath: z.string().min(1).optional(),
    summaryText: z.string().min(1).optional(),
    specPath: z.string().min(1).optional()
  })
  .strict();

export const executionOperationSchema = z
  .object({
    id: z.string().min(1),
    operationType: moduleOperationTypeSchema,
    status: executionOperationStatusSchema,
    targetType: z.enum(["contact-property", "pipeline"]),
    targetKey: z.string().min(1),
    targetLabel: z.string().min(1).optional(),
    objectType: objectTypeSchema.optional(),
    message: z.string().min(1).optional()
  })
  .strict();

export const executionOperationSummarySchema = z
  .object({
    requested: z.array(executionOperationSchema).default([]),
    executed: z.array(executionOperationSchema).default([]),
    blocked: z.array(executionOperationSchema).default([])
  })
  .strict();

export const moduleExecutionHandlerSupportSchema = z
  .object({
    validation: z.boolean(),
    readiness: z.boolean(),
    dryRun: z.boolean(),
    apply: z.boolean()
  })
  .strict();

export const moduleApplyGuardConditionSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1)
  })
  .strict();

export const moduleApplyGuardrailsSchema = z
  .object({
    enabled: z.boolean(),
    summary: z.string().min(1),
    requiresExplicitFlag: z.boolean().default(true),
    confirmationFlags: z.array(z.string().min(1)).default([]),
    approvalRequirement: z.string().min(1).optional(),
    allowedOperationTypes: z.array(moduleOperationTypeSchema).default([]),
    blockedOperationTypes: z.array(moduleOperationTypeSchema).default([]),
    guardConditions: z.array(moduleApplyGuardConditionSchema).default([])
  })
  .strict();

export const moduleExecutionStepTemplateSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    type: executionStepTypeSchema
  })
  .strict();

export const moduleExecutionStepSetSchema = z
  .object({
    dryRun: z.array(moduleExecutionStepTemplateSchema).default([]),
    apply: z.array(moduleExecutionStepTemplateSchema).default([])
  })
  .strict();

export const moduleExecutionContractDefinitionSchema = z
  .object({
    moduleKey: z.string().min(1),
    moduleLabel: z.string().min(1),
    supportedModes: z.array(executionModeSchema).default([]),
    inputRequirements: z.array(moduleInputRequirementSchema).default([]),
    handlers: moduleExecutionHandlerSupportSchema,
    applyGuardrails: moduleApplyGuardrailsSchema.optional(),
    resultKind: z.string().min(1),
    executionSteps: moduleExecutionStepSetSchema.default({
      dryRun: [],
      apply: []
    })
  })
  .strict();

export const moduleExecutionResultSchema = z
  .object({
    moduleKey: z.string().min(1),
    moduleLabel: z.string().min(1),
    mode: executionModeSchema,
    status: executionStatusSchema,
    summary: z.string().min(1),
    metrics: executionJobSummaryMetricsSchema,
    warnings: z.array(z.string()),
    errors: z.array(z.string()),
    output: executionJobOutputSchema,
    operations: executionOperationSummarySchema.default({
      requested: [],
      executed: [],
      blocked: []
    })
  })
  .strict();

export const executionStepSchema = z
  .object({
    id: z.string().min(1),
    jobId: z.string().min(1),
    key: z.string().min(1),
    label: z.string().min(1),
    type: executionStepTypeSchema,
    order: z.number().int().nonnegative(),
    status: executionStatusSchema,
    startedAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
    warnings: z.array(z.string()).default([]),
    errors: z.array(z.string()).default([]),
    summary: z.string().min(1).optional(),
    output: executionJobOutputSchema.optional()
  })
  .strict();

export const executionJobRecordSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    moduleKey: z.string().min(1),
    executionType: executionTypeSchema,
    status: executionStatusSchema,
    mode: executionModeSchema,
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
    summaryMetrics: executionJobSummaryMetricsSchema,
    warnings: z.array(z.string()),
    errors: z.array(z.string()),
    output: executionJobOutputSchema,
    operations: executionOperationSummarySchema.default({
      requested: [],
      executed: [],
      blocked: []
    }),
    result: moduleExecutionResultSchema.optional(),
    steps: z.array(executionStepSchema).default([]),
    triggeredBy: z.string().min(1),
    environment: z.string().min(1)
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
    validationStatus: operationalValidationStatusSchema,
    readiness: readinessOutcomeSchema,
    executionCount: z.number().int().nonnegative(),
    lastExecutionStatus: executionStatusSchema.optional(),
    seedType: z.enum(["blank", "template"]).optional(),
    templateName: z.string().min(1).optional(),
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
    dependencies: z.array(z.string().min(1)),
    validationStatus: operationalValidationStatusSchema,
    readiness: readinessOutcomeSchema,
    blockerCount: z.number().int().nonnegative(),
    missingInputCount: z.number().int().nonnegative(),
    errorCount: z.number().int().nonnegative(),
    warningCount: z.number().int().nonnegative(),
    infoCount: z.number().int().nonnegative()
  })
  .strict();

export const projectModuleDetailSchema = projectModuleSummarySchema
  .extend({
    blockers: z.array(readinessReasonSchema).default([]),
    missingInputs: z.array(moduleInputRequirementStatusSchema).default([]),
    inputRequirements: z.array(moduleInputRequirementStatusSchema).default([]),
    warnings: z.array(validationFindingSchema).default([]),
    infos: z.array(validationFindingSchema).default([]),
    contract: moduleExecutionContractDefinitionSchema,
    executionSummary: z
      .object({
        executionCount: z.number().int().nonnegative(),
        lastExecutionId: z.string().min(1).optional(),
        lastExecutionStatus: executionStatusSchema.optional(),
        lastExecutionMode: executionModeSchema.optional(),
        lastExecutedAt: z.string().datetime().optional(),
        lastSummary: z.string().min(1).optional()
      })
      .strict()
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

export const coworkStepSchema = z
  .object({
    order: z.number().int().positive(),
    action: z.enum(["navigate", "click", "fill_field", "select_option", "verify"]),
    target: z.string().min(1),
    value: z.string().optional(),
    description: z.string().min(1)
  })
  .strict();

export const coworkInstructionSchema = z
  .object({
    id: z.string().min(1),
    taskType: z.enum(["hubspot_property_create", "hubspot_report_create", "hubspot_dashboard_create"]),
    portalId: z.string().min(1),
    targetUrl: z.string().url(),
    steps: z.array(coworkStepSchema),
    expectedOutcome: z.string().min(1),
    fallbackToManual: z.array(z.unknown()).optional()
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
export type OnboardingTemplate = z.infer<typeof onboardingTemplateSchema>;
export type ModuleDefinition = z.infer<typeof moduleDefinitionSchema>;
export type ProjectModulePlan = z.infer<typeof projectModulePlanSchema>;
export type ProjectTemplateProvenance = z.infer<
  typeof projectTemplateProvenanceSchema
>;
export type PropertyLibrary = z.infer<typeof propertyLibrarySchema>;
export type PropertyLibraryEntry = z.infer<typeof propertyLibraryEntrySchema>;
export type PropertyLibraryGroup = z.infer<typeof propertyLibraryGroupSchema>;
export type ValidationFinding = z.infer<typeof validationFindingSchema>;
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type CreateProjectFromTemplateRequest = z.infer<
  typeof createProjectFromTemplateRequestSchema
>;
export type UpdateProjectMetadataRequest = z.infer<
  typeof updateProjectMetadataRequestSchema
>;
export type UpdateProjectScopeRequest = z.infer<
  typeof updateProjectScopeRequestSchema
>;
export type UpdateProjectLifecycleDesignRequest = z.infer<
  typeof updateProjectLifecycleDesignRequestSchema
>;
export type UpdateProjectPropertiesDesignRequest = z.infer<
  typeof updateProjectPropertiesDesignRequestSchema
>;
export type UpdateProjectPipelinesDesignRequest = z.infer<
  typeof updateProjectPipelinesDesignRequestSchema
>;
export type DiscoverySectionKey = z.infer<typeof discoverySectionKeySchema>;
export type ProjectDiscovery = z.infer<typeof projectDiscoverySchema>;
export type UpdateProjectDiscoverySectionRequest = z.infer<
  typeof updateProjectDiscoverySectionRequestSchema
>;
export type ProjectDesign = z.infer<typeof projectDesignSchema>;
export type ModuleInputRequirement = z.infer<
  typeof moduleInputRequirementSchema
>;
export type ModuleInputRequirementStatus = z.infer<
  typeof moduleInputRequirementStatusSchema
>;
export type ReadinessReason = z.infer<typeof readinessReasonSchema>;
export type ModuleValidationResult = z.infer<
  typeof moduleValidationResultSchema
>;
export type ProjectValidationResult = z.infer<
  typeof projectValidationResultSchema
>;
export type ProjectReadinessSummary = z.infer<
  typeof projectReadinessSummarySchema
>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type ProjectModuleSummary = z.infer<typeof projectModuleSummarySchema>;
export type ProjectModuleDetail = z.infer<typeof projectModuleDetailSchema>;
export type ModuleExecutionContractDefinition = z.infer<
  typeof moduleExecutionContractDefinitionSchema
>;
export type ModuleExecutionResult = z.infer<typeof moduleExecutionResultSchema>;
export type ExecutionJobOutput = z.infer<typeof executionJobOutputSchema>;
export type ExecutionOperation = z.infer<typeof executionOperationSchema>;
export type ExecutionOperationSummary = z.infer<
  typeof executionOperationSummarySchema
>;
export type ExecutionJobRecord = z.infer<typeof executionJobRecordSchema>;
export type ExecutionJob = z.infer<typeof executionJobSchema>;
export type ExecutionStep = z.infer<typeof executionStepSchema>;
export type CoworkStep = z.infer<typeof coworkStepSchema>;
export type CoworkInstruction = z.infer<typeof coworkInstructionSchema>;
export type AuditLog = z.infer<typeof auditLogSchema>;
export type AIProvider = z.infer<typeof aiProviderSchema>;
