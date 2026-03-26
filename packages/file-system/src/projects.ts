import fs from "node:fs/promises";
import path from "node:path";

import type { OnboardingSpec, SpecFile } from "@muloo/core";
import { createPropertySpecFromProject as createPropertySpec } from "@muloo/executor";
import { PrismaClient } from "@prisma/client";
import {
  createProjectFromTemplateRequestSchema,
  createProjectRequestSchema,
  onboardingProjectSchema,
  projectDesignSchema,
  projectDiscoverySchema,
  type CreateProjectFromTemplateRequest,
  type CreateProjectRequest,
  type DiscoverySectionKey,
  type OnboardingProject,
  type OnboardingTemplate,
  type ProjectDiscovery,
  type ProjectDesign,
  type ProjectModulePlan,
  type UpdateProjectDiscoverySectionRequest,
  type UpdateProjectMetadataRequest,
  type UpdateProjectLifecycleDesignRequest,
  type UpdateProjectPipelinesDesignRequest,
  type UpdateProjectPropertiesDesignRequest,
  updateProjectDiscoverySectionRequestSchema,
  updateProjectLifecycleDesignRequestSchema,
  updateProjectMetadataRequestSchema,
  updateProjectPipelinesDesignRequestSchema,
  updateProjectPropertiesDesignRequestSchema,
  type UpdateProjectScopeRequest,
  updateProjectScopeRequestSchema
} from "@muloo/shared";

import { loadTemplateById } from "./templates";

const prisma = new PrismaClient();

function getProjectsDirectory(cwd: string): string {
  return path.resolve(cwd, "data", "projects");
}

function getProjectFilePath(cwd: string, projectId: string): string {
  return path.join(getProjectsDirectory(cwd), `${projectId}.json`);
}

async function loadValidatedProjectFile(
  filePath: string
): Promise<SpecFile<OnboardingProject>> {
  const content = await fs.readFile(filePath, "utf8");
  const raw = JSON.parse(content) as unknown;
  const spec = onboardingProjectSchema.parse(raw);

  return {
    absolutePath: filePath,
    raw,
    spec
  };
}

async function loadProjectFromPrisma(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      discoveryData: true
    }
  });

  const rawProject =
    project?.discoveryData &&
    typeof project.discoveryData === "object" &&
    !Array.isArray(project.discoveryData)
      ? ("projectFile" in project.discoveryData
          ? (project.discoveryData as { projectFile?: unknown }).projectFile
          : project.discoveryData)
      : null;

  if (!rawProject) {
    return null;
  }

  try {
    return onboardingProjectSchema.parse(rawProject);
  } catch {
    return null;
  }
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeOrderedStrings(values: string[]): string[] {
  return values
    .map((value) => value.trim())
    .filter(
      (value, index, allValues) =>
        value.length > 0 && allValues.indexOf(value) === index
    );
}

function deriveObjectsInScope(params: {
  hubsInScope: OnboardingProject["hubspotScope"]["hubsInScope"];
  template?: OnboardingTemplate;
}): OnboardingProject["crmDesign"]["objectsInScope"] {
  if (params.template) {
    return params.template.defaultObjectsInScope;
  }

  const objects = new Set<
    OnboardingProject["crmDesign"]["objectsInScope"][number]
  >(["contacts", "companies"]);

  if (
    params.hubsInScope.includes("sales") ||
    params.hubsInScope.includes("marketing")
  ) {
    objects.add("deals");
  }

  if (params.hubsInScope.includes("service")) {
    objects.add("tickets");
  }

  return [...objects];
}

function buildBlankModulePlan(
  moduleSelection: CreateProjectRequest["moduleSelection"]
): ProjectModulePlan[] {
  return moduleSelection.map((module) => ({
    moduleId: module.moduleId,
    status: module.status,
    dependencies: module.dependencies,
    ...(module.notes ? { notes: module.notes } : {})
  }));
}

function buildTemplateModulePlan(params: {
  moduleSelection: CreateProjectFromTemplateRequest["moduleSelection"];
  template: OnboardingTemplate;
}): ProjectModulePlan[] {
  const selectedModuleMap = new Map(
    params.moduleSelection.map((module) => [module.moduleId, module])
  );

  const seeded = params.template.defaultModules
    .filter((module) => selectedModuleMap.has(module.moduleId))
    .map((module) => {
      const selected = selectedModuleMap.get(module.moduleId);

      return {
        moduleId: module.moduleId,
        status: selected?.status ?? module.status,
        dependencies: selected?.dependencies ?? module.dependencies,
        notes: selected?.notes ?? module.notes
      };
    });

  const additional = params.moduleSelection
    .filter(
      (module) =>
        !params.template.defaultModules.some(
          (candidate) => candidate.moduleId === module.moduleId
        )
    )
    .map((module) => ({
      moduleId: module.moduleId,
      status: module.status,
      dependencies: module.dependencies,
      ...(module.notes ? { notes: module.notes } : {})
    }));

  return [...seeded, ...additional];
}

function buildPropertyPlanningFromTemplate(template: OnboardingTemplate) {
  const objectTypes = dedupeStrings([
    ...template.propertyLibrary.groups.map((group) => group.objectType),
    ...template.propertyLibrary.properties.map(
      (property) => property.objectType
    ),
    ...template.defaultObjectsInScope
  ]) as OnboardingProject["propertyPlanning"]["propertiesByObject"][number]["objectType"][];

  return {
    propertyGroupsByObject: objectTypes.map((objectType) => ({
      objectType,
      groups: template.propertyLibrary.groups
        .filter((group) => group.objectType === objectType)
        .map((group) => ({
          internalName: group.internalName,
          label: group.label,
          ...(group.description ? { description: group.description } : {}),
          sourceTag: group.sourceTag
        }))
    })),
    propertiesByObject: objectTypes.map((objectType) => ({
      objectType,
      properties: template.propertyLibrary.properties
        .filter((property) => property.objectType === objectType)
        .map((property) => ({
          internalName: property.internalName,
          label: property.label,
          ...(property.description
            ? { description: property.description }
            : {}),
          required: property.required,
          valueType: property.valueType,
          fieldType: property.fieldType,
          groupName: property.groupName,
          ...(property.options ? { options: property.options } : {}),
          sourceTag: property.sourceTag
        }))
    }))
  };
}

function buildBlankPropertyPlanning(
  objectsInScope: OnboardingProject["crmDesign"]["objectsInScope"]
) {
  return {
    propertyGroupsByObject: objectsInScope.map((objectType) => ({
      objectType,
      groups: []
    })),
    propertiesByObject: objectsInScope.map((objectType) => ({
      objectType,
      properties: []
    }))
  };
}

function buildPropertyPlanningForObjects(params: {
  objectsInScope: OnboardingProject["crmDesign"]["objectsInScope"];
  propertyGroupsByObject: OnboardingProject["propertyPlanning"]["propertyGroupsByObject"];
  propertiesByObject: OnboardingProject["propertyPlanning"]["propertiesByObject"];
}) {
  const groupsByObject = new Map(
    params.propertyGroupsByObject.map((group) => [
      group.objectType,
      group.groups
    ])
  );
  const propertiesByObject = new Map(
    params.propertiesByObject.map((group) => [
      group.objectType,
      group.properties
    ])
  );

  return {
    propertyGroupsByObject: params.objectsInScope.map((objectType) => ({
      objectType,
      groups: groupsByObject.get(objectType) ?? []
    })),
    propertiesByObject: params.objectsInScope.map((objectType) => ({
      objectType,
      properties: propertiesByObject.get(objectType) ?? []
    }))
  };
}

function deriveDesignObjectsInScope(params: {
  project: OnboardingProject;
  propertiesByObject?: OnboardingProject["propertyPlanning"]["propertiesByObject"];
  propertyGroupsByObject?: OnboardingProject["propertyPlanning"]["propertyGroupsByObject"];
  pipelines?: OnboardingProject["crmDesign"]["pipelines"];
}) {
  return dedupeStrings([
    ...params.project.crmDesign.objectsInScope,
    ...(params.propertiesByObject?.map((group) => group.objectType) ?? []),
    ...(params.propertyGroupsByObject?.map((group) => group.objectType) ?? []),
    ...(params.pipelines?.map((pipeline) => pipeline.objectType) ?? [])
  ]) as OnboardingProject["crmDesign"]["objectsInScope"];
}

function buildPortalDisplayName(
  clientName: string
): OnboardingProject["hubspotScope"]["portal"]["displayName"] {
  return clientName;
}

function createEmptyProjectDiscovery(
  project: Pick<
    OnboardingProject,
    "clientContext" | "hubspotScope" | "crmDesign"
  >
): ProjectDiscovery {
  return projectDiscoverySchema.parse({
    completedSections: [],
    businessContext: {
      companyName: project.clientContext.clientName,
      region: project.clientContext.primaryRegion
    },
    platformContext: {
      activeHubs: project.hubspotScope.hubsInScope
    },
    crmArchitecture: {
      objectsInScope: project.crmDesign.objectsInScope,
      dealPipelines: project.crmDesign.pipelines.map(
        (pipeline) => pipeline.label
      ),
      lifecycleStages: project.crmDesign.lifecycleStages,
      leadStatuses: project.crmDesign.leadStatuses
    }
  });
}

function isFilledString(value: string): boolean {
  return value.trim().length > 0;
}

function isFilledStringArray(values: string[]): boolean {
  return values.some((value) => value.trim().length > 0);
}

function isDiscoverySectionComplete(
  section: DiscoverySectionKey,
  discovery: ProjectDiscovery
): boolean {
  switch (section) {
    case "businessContext":
      return (
        isFilledString(discovery.businessContext.companyName) &&
        isFilledString(discovery.businessContext.businessModel) &&
        isFilledString(discovery.businessContext.region) &&
        isFilledString(discovery.businessContext.teamStructure) &&
        isFilledStringArray(discovery.businessContext.growthGoals) &&
        isFilledStringArray(discovery.businessContext.implementationObjectives)
      );
    case "platformContext":
      return (
        isFilledString(discovery.platformContext.currentHubspotUsage) &&
        isFilledStringArray(discovery.platformContext.activeHubs) &&
        isFilledStringArray(discovery.platformContext.subscriptionTiers) &&
        isFilledString(discovery.platformContext.existingCrmCleanliness) &&
        isFilledStringArray(discovery.platformContext.connectedTools) &&
        isFilledString(discovery.platformContext.migrationNeeds)
      );
    case "crmArchitecture":
      return (
        isFilledStringArray(discovery.crmArchitecture.objectsInScope) &&
        isFilledString(discovery.crmArchitecture.contactCompanyRules) &&
        isFilledStringArray(discovery.crmArchitecture.dealPipelines) &&
        isFilledStringArray(discovery.crmArchitecture.lifecycleStages) &&
        isFilledStringArray(discovery.crmArchitecture.leadStatuses) &&
        isFilledString(discovery.crmArchitecture.ownershipModel) &&
        isFilledString(discovery.crmArchitecture.associations)
      );
    case "salesRequirements":
      return (
        isFilledString(discovery.salesRequirements.pipelineRequirements) &&
        isFilledString(discovery.salesRequirements.qualificationLogic) &&
        isFilledString(discovery.salesRequirements.sdrAeProcess) &&
        isFilledString(discovery.salesRequirements.taskAutomationNeeds) &&
        isFilledString(discovery.salesRequirements.reportingNeeds)
      );
    case "marketingRequirements":
      return (
        isFilledString(discovery.marketingRequirements.segmentation) &&
        isFilledString(discovery.marketingRequirements.campaignStructure) &&
        isFilledString(discovery.marketingRequirements.forms) &&
        isFilledString(discovery.marketingRequirements.leadCapture) &&
        isFilledString(discovery.marketingRequirements.emailNeeds) &&
        isFilledString(discovery.marketingRequirements.reportingNeeds)
      );
    case "serviceRequirements":
      return (
        isFilledString(discovery.serviceRequirements.tickets) &&
        isFilledString(discovery.serviceRequirements.supportCategories) &&
        isFilledString(discovery.serviceRequirements.routingLogic) &&
        isFilledString(discovery.serviceRequirements.slas) &&
        isFilledString(
          discovery.serviceRequirements.portalOrHelpCentreRequirements
        )
      );
    case "integrationsAndData":
      return (
        isFilledStringArray(discovery.integrationsAndData.sourceSystems) &&
        isFilledString(discovery.integrationsAndData.syncDirection) &&
        isFilledString(discovery.integrationsAndData.fieldMappingNeeds) &&
        isFilledString(discovery.integrationsAndData.importRequirements) &&
        isFilledString(discovery.integrationsAndData.dedupeConcerns)
      );
    case "governanceAndOps":
      return (
        isFilledString(discovery.governanceAndOps.namingConventions) &&
        isFilledString(discovery.governanceAndOps.permissions) &&
        isFilledString(discovery.governanceAndOps.qaRequirements) &&
        isFilledString(discovery.governanceAndOps.trainingNeeds) &&
        isFilledString(discovery.governanceAndOps.handoverNeeds)
      );
    case "risksAndAssumptions":
      return (
        isFilledStringArray(discovery.risksAndAssumptions.blockers) &&
        isFilledStringArray(discovery.risksAndAssumptions.dependencies) &&
        isFilledStringArray(discovery.risksAndAssumptions.accessIssues) &&
        discovery.risksAndAssumptions.customDevLikely !== null &&
        isFilledStringArray(discovery.risksAndAssumptions.assumptions)
      );
  }
}

function normalizeDiscovery(discovery: ProjectDiscovery): ProjectDiscovery {
  const completedSections = (
    [
      "businessContext",
      "platformContext",
      "crmArchitecture",
      "salesRequirements",
      "marketingRequirements",
      "serviceRequirements",
      "integrationsAndData",
      "governanceAndOps",
      "risksAndAssumptions"
    ] as DiscoverySectionKey[]
  ).filter((section) => isDiscoverySectionComplete(section, discovery));

  return projectDiscoverySchema.parse({
    ...discovery,
    completedSections,
    updatedAt: new Date().toISOString()
  });
}

function buildBlankProject(input: CreateProjectRequest): OnboardingProject {
  const objectsInScope = deriveObjectsInScope({
    hubsInScope: input.hubspotScope.hubsInScope
  });
  const now = new Date().toISOString();

  return onboardingProjectSchema.parse({
    schemaVersion: "1.0",
    id: input.id,
    name: input.name,
    clientId: input.clientId,
    portalId: input.portalId,
    status: input.status ?? "draft",
    owner: input.owner,
    createdAt: now,
    updatedAt: now,
    clientContext: input.clientContext,
    hubspotScope: {
      hubsInScope: input.hubspotScope.hubsInScope,
      portal: {
        portalId: input.portalId,
        displayName: buildPortalDisplayName(input.clientContext.clientName),
        region: input.clientContext.primaryRegion,
        connected: false
      },
      environment: input.hubspotScope.environment
    },
    crmDesign: {
      lifecycleStages: ["subscriber", "lead", "customer"],
      leadStatuses: ["New"],
      pipelines: [],
      objectsInScope,
      customObjectsPlanned: []
    },
    propertyPlanning: buildBlankPropertyPlanning(objectsInScope),
    modulePlanning: buildBlankModulePlan(input.moduleSelection),
    executionContext: {
      dryRunEnabled: true,
      validationStatus: "draft",
      lastExecutionSummary: {
        status: "never-run",
        notes: "Blank project created through Muloo Deploy OS authoring."
      }
    },
    discovery: createEmptyProjectDiscovery({
      clientContext: input.clientContext,
      hubspotScope: {
        hubsInScope: input.hubspotScope.hubsInScope,
        portal: {
          portalId: input.portalId,
          displayName: buildPortalDisplayName(input.clientContext.clientName),
          region: input.clientContext.primaryRegion,
          connected: false
        },
        environment: input.hubspotScope.environment
      },
      crmDesign: {
        lifecycleStages: ["subscriber", "lead", "customer"],
        leadStatuses: ["New"],
        pipelines: [],
        objectsInScope,
        customObjectsPlanned: []
      }
    }),
    templateProvenance: {
      seedType: "blank",
      seededAt: now,
      baselineSourceTags: [],
      seededModuleIds: input.moduleSelection.map((module) => module.moduleId)
    }
  });
}

function buildProjectFromTemplate(params: {
  input: CreateProjectFromTemplateRequest;
  template: OnboardingTemplate;
}): OnboardingProject {
  const now = new Date().toISOString();
  const objectsInScope = dedupeStrings([
    ...params.template.defaultObjectsInScope,
    ...deriveObjectsInScope({
      hubsInScope: params.input.hubspotScope.hubsInScope,
      template: params.template
    })
  ]) as OnboardingProject["crmDesign"]["objectsInScope"];
  const propertyPlanning = buildPropertyPlanningFromTemplate(params.template);
  const baselineSourceTags = dedupeStrings([
    ...params.template.propertyLibrary.groups.map((group) => group.sourceTag),
    ...params.template.propertyLibrary.properties.map(
      (property) => property.sourceTag
    )
  ]);
  const modulePlanning = buildTemplateModulePlan({
    moduleSelection: params.input.moduleSelection,
    template: params.template
  });

  return onboardingProjectSchema.parse({
    schemaVersion: "1.0",
    id: params.input.id,
    name: params.input.name,
    clientId: params.input.clientId,
    portalId: params.input.portalId,
    status: params.input.status ?? "draft",
    owner: params.input.owner,
    createdAt: now,
    updatedAt: now,
    clientContext: params.input.clientContext,
    hubspotScope: {
      hubsInScope: params.input.hubspotScope.hubsInScope,
      portal: {
        portalId: params.input.portalId,
        displayName: buildPortalDisplayName(
          params.input.clientContext.clientName
        ),
        region: params.input.clientContext.primaryRegion,
        connected: false
      },
      environment: params.input.hubspotScope.environment
    },
    crmDesign: {
      lifecycleStages: params.template.defaultLifecycleStages,
      leadStatuses: params.template.defaultLeadStatuses,
      pipelines: params.template.defaultPipelines,
      objectsInScope,
      customObjectsPlanned: []
    },
    propertyPlanning,
    modulePlanning,
    executionContext: {
      dryRunEnabled: true,
      validationStatus: "draft",
      lastExecutionSummary: {
        status: "never-run",
        notes: `Project seeded from template '${params.template.name}'.`
      }
    },
    discovery: createEmptyProjectDiscovery({
      clientContext: params.input.clientContext,
      hubspotScope: {
        hubsInScope: params.input.hubspotScope.hubsInScope,
        portal: {
          portalId: params.input.portalId,
          displayName: buildPortalDisplayName(
            params.input.clientContext.clientName
          ),
          region: params.input.clientContext.primaryRegion,
          connected: false
        },
        environment: params.input.hubspotScope.environment
      },
      crmDesign: {
        lifecycleStages: params.template.defaultLifecycleStages,
        leadStatuses: params.template.defaultLeadStatuses,
        pipelines: params.template.defaultPipelines,
        objectsInScope,
        customObjectsPlanned: []
      }
    }),
    templateProvenance: {
      seedType: "template",
      templateId: params.template.id,
      templateName: params.template.name,
      seededAt: now,
      baselineSourceTags,
      seededModuleIds: modulePlanning.map((module) => module.moduleId)
    }
  });
}

async function saveProject(
  cwd: string,
  project: OnboardingProject
): Promise<OnboardingProject> {
  const directory = getProjectsDirectory(cwd);
  await fs.mkdir(directory, { recursive: true });
  const filePath = getProjectFilePath(cwd, project.id);
  const tempPath = `${filePath}.tmp`;

  await fs.writeFile(tempPath, `${JSON.stringify(project, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
  return project;
}

export async function loadAllProjects(options?: {
  cwd?: string;
}): Promise<OnboardingProject[]> {
  const cwd = options?.cwd ?? process.cwd();
  const directory = getProjectsDirectory(cwd);
  const entries = await fs.readdir(directory);
  const files = entries
    .filter((entry) => entry.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right));

  const projects = await Promise.all(
    files.map((file) => loadValidatedProjectFile(path.join(directory, file)))
  );

  return projects.map((projectFile) => projectFile.spec);
}

export async function loadProjectById(
  projectId: string,
  options?: { cwd?: string }
): Promise<OnboardingProject> {
  const prismaProject = await loadProjectFromPrisma(projectId);

  if (prismaProject) {
    return prismaProject;
  }

  const cwd = options?.cwd ?? process.cwd();
  const filePath = getProjectFilePath(cwd, projectId);

  try {
    process.emitWarning(
      `Project ${projectId} is being loaded from the legacy filesystem fallback.`,
      {
        code: "MULOO_FILESYSTEM_FALLBACK"
      }
    );
    return (await loadValidatedProjectFile(filePath)).spec;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(`Project '${projectId}' was not found.`);
    }

    throw error;
  }
}

export async function createProject(
  payload: CreateProjectRequest,
  options?: { cwd?: string }
): Promise<OnboardingProject> {
  const cwd = options?.cwd ?? process.cwd();
  const input = createProjectRequestSchema.parse(payload);

  try {
    await loadProjectById(input.id, { cwd });
    throw new Error(`Project '${input.id}' already exists.`);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("was not found")) {
      throw error;
    }
  }

  return saveProject(cwd, buildBlankProject(input));
}

export async function createProjectFromTemplate(
  payload: CreateProjectFromTemplateRequest,
  options?: { cwd?: string }
): Promise<OnboardingProject> {
  const cwd = options?.cwd ?? process.cwd();
  const input = createProjectFromTemplateRequestSchema.parse(payload);

  try {
    await loadProjectById(input.id, { cwd });
    throw new Error(`Project '${input.id}' already exists.`);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("was not found")) {
      throw error;
    }
  }

  const template = await loadTemplateById(input.templateId, { cwd });
  return saveProject(cwd, buildProjectFromTemplate({ input, template }));
}

export async function updateProjectMetadata(
  projectId: string,
  payload: UpdateProjectMetadataRequest,
  options?: { cwd?: string }
): Promise<OnboardingProject> {
  const cwd = options?.cwd ?? process.cwd();
  const project = await loadProjectById(projectId, { cwd });
  const input = updateProjectMetadataRequestSchema.parse(payload);
  const updatedAt = new Date().toISOString();

  return saveProject(
    cwd,
    onboardingProjectSchema.parse({
      ...project,
      ...(input.name ? { name: input.name } : {}),
      ...(input.clientId ? { clientId: input.clientId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.portalId ? { portalId: input.portalId } : {}),
      ...(input.owner ? { owner: input.owner } : {}),
      clientContext: {
        ...project.clientContext,
        ...(input.clientContext ?? {})
      },
      hubspotScope: {
        ...project.hubspotScope,
        ...(input.hubspotScope
          ? {
              hubsInScope: input.hubspotScope.hubsInScope,
              environment: input.hubspotScope.environment
            }
          : {}),
        portal: {
          ...project.hubspotScope.portal,
          portalId: input.portalId ?? project.portalId,
          displayName:
            input.clientContext?.clientName ?? project.clientContext.clientName,
          region:
            input.clientContext?.primaryRegion ??
            project.clientContext.primaryRegion
        }
      },
      updatedAt
    })
  );
}

export async function updateProjectScope(
  projectId: string,
  payload: UpdateProjectScopeRequest,
  options?: { cwd?: string }
): Promise<OnboardingProject> {
  const cwd = options?.cwd ?? process.cwd();
  const project = await loadProjectById(projectId, { cwd });
  const input = updateProjectScopeRequestSchema.parse(payload);
  const objectsInScope = deriveObjectsInScope({
    hubsInScope: input.hubsInScope ?? project.hubspotScope.hubsInScope
  });

  const modulePlanning = input.moduleSelection.map((module) => ({
    moduleId: module.moduleId,
    status: module.status,
    dependencies: module.dependencies,
    ...(module.notes ? { notes: module.notes } : {})
  }));

  const existingGroups = new Map(
    project.propertyPlanning.propertyGroupsByObject.map((group) => [
      group.objectType,
      group.groups
    ])
  );
  const existingProperties = new Map(
    project.propertyPlanning.propertiesByObject.map((group) => [
      group.objectType,
      group.properties
    ])
  );

  return saveProject(
    cwd,
    onboardingProjectSchema.parse({
      ...project,
      updatedAt: new Date().toISOString(),
      hubspotScope: {
        ...project.hubspotScope,
        ...(input.hubsInScope ? { hubsInScope: input.hubsInScope } : {}),
        ...(input.environment ? { environment: input.environment } : {})
      },
      crmDesign: {
        ...project.crmDesign,
        objectsInScope
      },
      propertyPlanning: buildPropertyPlanningForObjects({
        objectsInScope,
        propertyGroupsByObject: objectsInScope.map((objectType) => ({
          objectType,
          groups: existingGroups.get(objectType) ?? []
        })),
        propertiesByObject: objectsInScope.map((objectType) => ({
          objectType,
          properties: existingProperties.get(objectType) ?? []
        }))
      }),
      modulePlanning,
      templateProvenance: project.templateProvenance
        ? {
            ...project.templateProvenance,
            seededModuleIds: modulePlanning.map((module) => module.moduleId)
          }
        : undefined
    })
  );
}

export async function loadProjectDesignById(
  projectId: string,
  options?: { cwd?: string }
): Promise<ProjectDesign> {
  const project = await loadProjectById(projectId, options);

  return projectDesignSchema.parse({
    projectId: project.id,
    lifecycleStages: project.crmDesign.lifecycleStages,
    leadStatuses: project.crmDesign.leadStatuses,
    objectsInScope: project.crmDesign.objectsInScope,
    propertyPlanning: project.propertyPlanning,
    pipelines: project.crmDesign.pipelines,
    templateProvenance: project.templateProvenance
  });
}

export async function loadProjectDiscoveryById(
  projectId: string,
  options?: { cwd?: string }
): Promise<ProjectDiscovery> {
  const project = await loadProjectById(projectId, options);

  return normalizeDiscovery(
    project.discovery ??
      createEmptyProjectDiscovery({
        clientContext: project.clientContext,
        hubspotScope: project.hubspotScope,
        crmDesign: project.crmDesign
      })
  );
}

export async function updateProjectDiscoverySection(
  projectId: string,
  payload: UpdateProjectDiscoverySectionRequest,
  options?: { cwd?: string }
): Promise<OnboardingProject> {
  const cwd = options?.cwd ?? process.cwd();
  const project = await loadProjectById(projectId, { cwd });
  const input = updateProjectDiscoverySectionRequestSchema.parse(payload);
  const currentDiscovery =
    project.discovery ??
    createEmptyProjectDiscovery({
      clientContext: project.clientContext,
      hubspotScope: project.hubspotScope,
      crmDesign: project.crmDesign
    });

  const updatedDiscovery = normalizeDiscovery(
    projectDiscoverySchema.parse({
      ...currentDiscovery,
      [input.section]: {
        ...currentDiscovery[input.section],
        ...input.data
      }
    })
  );

  return saveProject(
    cwd,
    onboardingProjectSchema.parse({
      ...project,
      updatedAt: new Date().toISOString(),
      discovery: updatedDiscovery
    })
  );
}

export async function updateProjectLifecycleDesign(
  projectId: string,
  payload: UpdateProjectLifecycleDesignRequest,
  options?: { cwd?: string }
): Promise<OnboardingProject> {
  const cwd = options?.cwd ?? process.cwd();
  const project = await loadProjectById(projectId, { cwd });
  const input = updateProjectLifecycleDesignRequestSchema.parse(payload);

  return saveProject(
    cwd,
    onboardingProjectSchema.parse({
      ...project,
      updatedAt: new Date().toISOString(),
      crmDesign: {
        ...project.crmDesign,
        lifecycleStages: normalizeOrderedStrings(input.lifecycleStages),
        leadStatuses: normalizeOrderedStrings(input.leadStatuses)
      }
    })
  );
}

export async function updateProjectPropertiesDesign(
  projectId: string,
  payload: UpdateProjectPropertiesDesignRequest,
  options?: { cwd?: string }
): Promise<OnboardingProject> {
  const cwd = options?.cwd ?? process.cwd();
  const project = await loadProjectById(projectId, { cwd });
  const input = updateProjectPropertiesDesignRequestSchema.parse(payload);
  const objectsInScope = deriveDesignObjectsInScope({
    project,
    propertyGroupsByObject: input.propertyGroupsByObject,
    propertiesByObject: input.propertiesByObject,
    pipelines: project.crmDesign.pipelines
  });

  return saveProject(
    cwd,
    onboardingProjectSchema.parse({
      ...project,
      updatedAt: new Date().toISOString(),
      crmDesign: {
        ...project.crmDesign,
        objectsInScope
      },
      propertyPlanning: buildPropertyPlanningForObjects({
        objectsInScope,
        propertyGroupsByObject: input.propertyGroupsByObject,
        propertiesByObject: input.propertiesByObject
      })
    })
  );
}

export async function updateProjectPipelinesDesign(
  projectId: string,
  payload: UpdateProjectPipelinesDesignRequest,
  options?: { cwd?: string }
): Promise<OnboardingProject> {
  const cwd = options?.cwd ?? process.cwd();
  const project = await loadProjectById(projectId, { cwd });
  const input = updateProjectPipelinesDesignRequestSchema.parse(payload);
  const objectsInScope = deriveDesignObjectsInScope({
    project,
    pipelines: input.pipelines
  });

  return saveProject(
    cwd,
    onboardingProjectSchema.parse({
      ...project,
      updatedAt: new Date().toISOString(),
      crmDesign: {
        ...project.crmDesign,
        objectsInScope,
        pipelines: input.pipelines.map((pipeline) => ({
          ...pipeline,
          stages: [...pipeline.stages].sort(
            (left, right) => left.order - right.order
          )
        }))
      },
      propertyPlanning: buildPropertyPlanningForObjects({
        objectsInScope,
        propertyGroupsByObject: project.propertyPlanning.propertyGroupsByObject,
        propertiesByObject: project.propertyPlanning.propertiesByObject
      })
    })
  );
}

export function createPropertySpecFromProject(params: {
  project: OnboardingProject;
  moduleId: string;
}): SpecFile<OnboardingSpec> {
  return createPropertySpec(params.project, params.moduleId);
}
