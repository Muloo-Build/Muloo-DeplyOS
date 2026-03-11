async function fetchJson(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Request failed for ${path}`);
  }

  return response.json();
}

async function requestJson(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {})
    }
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

const hubOptions = ["sales", "marketing", "service", "cms", "ops"];
const environmentOptions = ["sandbox", "production"];
const projectStatusOptions = [
  "draft",
  "scoping",
  "designed",
  "ready-for-execution",
  "in-flight",
  "completed"
];
const moduleStatusOptions = ["not-started", "planned", "ready", "blocked"];
const implementationTypeOptions = [
  "sales-hub-foundation",
  "marketing-ops-rollout",
  "service-hub-enablement",
  "multi-hub-implementation"
];
const objectTypeOptions = ["contacts", "companies", "deals", "tickets"];
const propertyFieldTypeOptions = [
  "text",
  "textarea",
  "number",
  "date",
  "booleancheckbox",
  "radio",
  "select",
  "checkbox"
];
const propertyValueTypeOptions = [
  "string",
  "number",
  "date",
  "datetime",
  "enumeration",
  "bool"
];
const pipelineObjectTypeOptions = ["deals", "tickets"];

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatTimestamp(value) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderBadgeClass(value) {
  if (
    value === "ready" ||
    value === "valid" ||
    value === "available" ||
    value === "succeeded"
  ) {
    return "badge good";
  }

  if (
    value === "warning" ||
    value === "planned" ||
    value === "in-progress" ||
    value === "running"
  ) {
    return "badge";
  }

  return "badge warn";
}

function renderEmptyState(label, message) {
  return `<div class="kv"><div class="kv-item"><span>${label}</span><strong>${message}</strong></div></div>`;
}

function renderModuleCard(module) {
  return `
    <article class="module-card">
      <p class="panel-label">${module.category}</p>
      <h3>${module.name}</h3>
      <p class="module-copy">${module.summary}</p>
      <div class="section-header">
        <span class="${renderBadgeClass(module.status)}">${module.status}</span>
        <span class="small">${module.requiresHubSpot ? "HubSpot-backed" : "Internal only"}</span>
      </div>
    </article>
  `;
}

function renderProjectCard(project) {
  const seedLabel =
    project.seedType === "template"
      ? `Template: ${project.templateName ?? "seeded"}`
      : project.seedType === "blank"
        ? "Blank authoring project"
        : "Project blueprint";

  return `
    <article class="module-card">
      <p class="panel-label">${project.implementationType}</p>
      <h3>${project.name}</h3>
      <p class="module-copy">${project.clientName} / ${project.primaryRegion}</p>
      <div class="section-header">
        <span class="${renderBadgeClass(project.validationStatus)}">${project.validationStatus}</span>
        <span class="small">${project.readiness} / ${project.executionCount} run(s)</span>
      </div>
      <p class="small">${seedLabel}</p>
      <a class="button-link" href="/project?id=${encodeURIComponent(project.id)}">Open project</a>
    </article>
  `;
}

function renderProjectModuleCard(projectId, module) {
  const dependencyText = module.dependencies.length
    ? `Depends on: ${module.dependencies.join(", ")}`
    : "No dependencies";

  return `
    <article class="module-card">
      <p class="panel-label">${module.category}</p>
      <h3>${module.name}</h3>
      <p class="module-copy">${module.summary}</p>
      <div class="section-header">
        <span class="${renderBadgeClass(module.validationStatus)}">${module.validationStatus}</span>
        <span class="small">${module.readiness}</span>
      </div>
      <p class="small">${dependencyText}</p>
      <p class="small">Blockers: ${module.blockerCount} / Missing inputs: ${module.missingInputCount} / Warnings: ${module.warningCount}</p>
      <a class="button-link" href="/module?project=${encodeURIComponent(projectId)}&module=${encodeURIComponent(module.moduleId)}">Inspect module</a>
    </article>
  `;
}

function renderFindingRows(title, findings) {
  if (!findings.length) {
    return `<div class="kv-item"><span>${title}</span><strong>none</strong></div>`;
  }

  return findings
    .map(
      (finding) =>
        `<div class="kv-item"><span>${title}</span><strong>${finding.message}</strong></div>`
    )
    .join("");
}

function renderReasonRows(title, reasons) {
  if (!reasons.length) {
    return `<div class="kv-item"><span>${title}</span><strong>none</strong></div>`;
  }

  return reasons
    .map(
      (reason) =>
        `<div class="kv-item"><span>${title}</span><strong>${reason.type}: ${reason.message}</strong></div>`
    )
    .join("");
}

function renderInputRows(inputs) {
  if (!inputs.length) {
    return `<div class="kv-item"><span>Inputs</span><strong>none</strong></div>`;
  }

  return inputs
    .map(
      (input) =>
        `<div class="kv-item"><span>${input.label}</span><strong>${input.status}${input.message ? ` / ${input.message}` : ""}</strong></div>`
    )
    .join("");
}

function renderOperationRows(title, operations) {
  if (!operations.length) {
    return `<div class="kv-item"><span>${title}</span><strong>none</strong></div>`;
  }

  return operations
    .map(
      (operation) =>
        `<div class="kv-item"><span>${title}</span><strong>${operation.operationType} / ${operation.targetKey}${operation.message ? ` / ${operation.message}` : ""}</strong></div>`
    )
    .join("");
}

function renderExecutionCard(execution) {
  const createCount =
    execution.summaryMetrics.toCreateCount ??
    execution.summaryMetrics.toCreatePipelineCount ??
    0;
  const reviewCount =
    execution.summaryMetrics.needsReviewCount ??
    execution.summaryMetrics.needsReviewPipelineCount ??
    0;
  const executedCount = execution.summaryMetrics.executedOperationCount ?? 0;
  const blockedCount = execution.summaryMetrics.blockedOperationCount ?? 0;
  const executionCounts =
    execution.mode === "apply"
      ? `${executedCount} executed / ${blockedCount} blocked`
      : `${createCount} create / ${reviewCount} review`;

  return `
    <article class="module-card">
      <p class="panel-label">${execution.moduleKey}</p>
      <h3>${execution.status}</h3>
      <p class="module-copy">${execution.mode} / ${formatTimestamp(execution.startedAt)}</p>
      <div class="section-header">
        <span class="${renderBadgeClass(execution.status)}">${execution.status}</span>
        <span class="small">${executionCounts}</span>
      </div>
      <p class="small">${execution.result?.summary ?? execution.output.summaryText ?? "No summary available."}</p>
      <a class="button-link" href="/execution?id=${encodeURIComponent(execution.id)}">Open execution</a>
    </article>
  `;
}

function renderExecutionStep(step) {
  return `
    <article class="timeline-item">
      <div class="section-header">
        <div>
          <p class="panel-label">${step.type}</p>
          <h3>${step.label}</h3>
        </div>
        <span class="${renderBadgeClass(step.status)}">${step.status}</span>
      </div>
      <p class="module-copy">${step.summary ?? "No step summary recorded."}</p>
      <div class="kv compact">
        <div class="kv-item"><span>Started</span><strong>${step.startedAt ? formatTimestamp(step.startedAt) : "not started"}</strong></div>
        <div class="kv-item"><span>Completed</span><strong>${step.completedAt ? formatTimestamp(step.completedAt) : "not completed"}</strong></div>
        <div class="kv-item"><span>Warnings</span><strong>${step.warnings.length}</strong></div>
        <div class="kv-item"><span>Errors</span><strong>${step.errors.length}</strong></div>
      </div>
    </article>
  `;
}

function renderSelectOptions(values, selectedValue) {
  return values
    .map(
      (value) =>
        `<option value="${value}"${value === selectedValue ? " selected" : ""}>${value}</option>`
    )
    .join("");
}

function renderCheckboxGroup(name, values, selectedValues) {
  return values
    .map(
      (value) => `
        <label class="checkbox-row">
          <input type="checkbox" name="${name}" value="${value}"${selectedValues.includes(value) ? " checked" : ""} />
          <span>${value}</span>
        </label>
      `
    )
    .join("");
}

function renderModuleSelectionRows(modules, selectedModules) {
  const selectedMap = new Map(
    selectedModules.map((module) => [module.moduleId, module])
  );

  return modules
    .map((module) => {
      const selected = selectedMap.get(module.id);

      return `
        <div class="module-form-row">
          <label class="checkbox-row">
            <input type="checkbox" name="moduleId" value="${module.id}"${selected ? " checked" : ""} />
            <span>${module.name}</span>
          </label>
          <select name="moduleStatus:${module.id}">
            ${renderSelectOptions(moduleStatusOptions, selected?.status ?? "planned")}
          </select>
        </div>
      `;
    })
    .join("");
}

function getCheckedValues(form, name) {
  return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map(
    (input) => input.value
  );
}

function buildModuleSelectionFromForm(form, modules, existingModules = []) {
  const existingMap = new Map(
    existingModules.map((module) => [module.moduleId, module])
  );

  return modules
    .filter(
      (module) =>
        form.querySelector(`input[name="moduleId"][value="${module.id}"]`)
          ?.checked
    )
    .map((module) => {
      const status =
        form.querySelector(`select[name="moduleStatus:${module.id}"]`)?.value ??
        "planned";
      const existing = existingMap.get(module.id);

      return {
        moduleId: module.id,
        status,
        dependencies: existing?.dependencies ?? [],
        ...(existing?.notes ? { notes: existing.notes } : {})
      };
    });
}

function countStandardProperties(project) {
  return project.propertyPlanning.propertiesByObject.reduce(
    (count, group) =>
      count +
      group.properties.filter(
        (property) => property.sourceTag === "muloo-standard"
      ).length,
    0
  );
}

function countStandardGroups(project) {
  return project.propertyPlanning.propertyGroupsByObject.reduce(
    (count, group) =>
      count +
      group.groups.filter(
        (propertyGroup) => propertyGroup.sourceTag === "muloo-standard"
      ).length,
    0
  );
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function slugifyLabel(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function renderProjectWorkflowNav(projectId, activeKey) {
  const items = [
    {
      key: "overview",
      label: "Overview",
      href: `/project?id=${encodeURIComponent(projectId)}`
    },
    {
      key: "lifecycle",
      label: "Lifecycle",
      href: `/project/design/lifecycle?project=${encodeURIComponent(projectId)}`
    },
    {
      key: "properties",
      label: "Properties",
      href: `/project/design/properties?project=${encodeURIComponent(projectId)}`
    },
    {
      key: "pipelines",
      label: "Pipelines",
      href: `/project/design/pipelines?project=${encodeURIComponent(projectId)}`
    },
    {
      key: "executions",
      label: "Execution history",
      href: `/project?id=${encodeURIComponent(projectId)}`
    }
  ];

  return `
    <nav class="workflow-nav">
      ${items
        .map(
          (item) =>
            `<a class="workflow-link${item.key === activeKey ? " active" : ""}" href="${item.href}">${item.label}</a>`
        )
        .join("")}
    </nav>
  `;
}

function mapPropertyPlanningByObject(propertyPlanning) {
  const state = {};

  for (const objectType of objectTypeOptions) {
    const groupEntry = propertyPlanning.propertyGroupsByObject.find(
      (item) => item.objectType === objectType
    );
    const propertyEntry = propertyPlanning.propertiesByObject.find(
      (item) => item.objectType === objectType
    );

    state[objectType] = {
      groups: cloneJson(groupEntry?.groups ?? []),
      properties: cloneJson(propertyEntry?.properties ?? [])
    };
  }

  return state;
}

function buildPropertyPlanningPayload(state) {
  return {
    propertyGroupsByObject: objectTypeOptions.map((objectType) => ({
      objectType,
      groups: state[objectType]?.groups ?? []
    })),
    propertiesByObject: objectTypeOptions.map((objectType) => ({
      objectType,
      properties: state[objectType]?.properties ?? []
    }))
  };
}

function parseOptionsInput(value) {
  return String(value)
    .split(/\n|;/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [labelPart, valuePart] = entry.includes(":")
        ? entry.split(":")
        : [entry, slugifyLabel(entry)];

      return {
        label: labelPart.trim(),
        value: (valuePart ?? slugifyLabel(labelPart)).trim()
      };
    });
}

function formatOptionsInput(options) {
  return (options ?? [])
    .map((option) => `${option.label}:${option.value}`)
    .join("\n");
}

function renderProjectDesignStatus(
  project,
  validation,
  readiness,
  extraRows = ""
) {
  return `
    <div class="status-panel">
      <div class="kv">
        <div class="kv-item"><span>Validation</span><strong>${validation.status}</strong></div>
        <div class="kv-item"><span>Readiness</span><strong>${readiness.readiness}</strong></div>
        <div class="kv-item"><span>Template</span><strong>${project.templateProvenance?.templateName ?? "Blank project"}</strong></div>
        <div class="kv-item"><span>Seed type</span><strong>${project.templateProvenance?.seedType ?? "none"}</strong></div>
        <div class="kv-item"><span>Blockers</span><strong>${readiness.blockers.length}</strong></div>
        <div class="kv-item"><span>Warnings</span><strong>${validation.warnings.length}</strong></div>
        ${extraRows}
        ${renderReasonRows("Blocker", readiness.blockers)}
        ${renderFindingRows("Error", validation.errors)}
        ${renderFindingRows("Warning", validation.warnings)}
        ${renderFindingRows("Info", validation.infos)}
      </div>
    </div>
  `;
}

async function initDashboard() {
  const [health, modules, projects] = await Promise.all([
    fetchJson("/api/health"),
    fetchJson("/api/modules"),
    fetchJson("/api/projects")
  ]);
  const healthCard = document.getElementById("health-card");
  const stats = document.getElementById("dashboard-stats");
  const moduleGrid = document.getElementById("dashboard-modules");
  const projectGrid = document.getElementById("dashboard-projects");

  if (healthCard) {
    healthCard.innerHTML = `
      <span class="panel-label">Platform health</span>
      <strong>${health.status}</strong>
      <span class="small">${health.environment} / ${health.executionMode}</span>
    `;
  }

  if (stats) {
    const readyProjects = projects.projects.filter(
      (project) => project.readiness === "ready"
    ).length;

    stats.innerHTML = `
      <article class="stat-card">
        <p class="panel-label">Known modules</p>
        <h3>${modules.modules.length}</h3>
        <p class="small">Execution areas defined for delivery operations.</p>
      </article>
      <article class="stat-card">
        <p class="panel-label">Modelled projects</p>
        <h3>${projects.projects.length}</h3>
        <p class="small">Structured onboarding blueprints currently available.</p>
      </article>
      <article class="stat-card">
        <p class="panel-label">Ready projects</p>
        <h3>${readyProjects}</h3>
        <p class="small">Projects whose full module plan is ready for execution.</p>
      </article>
    `;
  }

  if (projectGrid) {
    projectGrid.innerHTML = projects.projects.map(renderProjectCard).join("");
  }

  if (moduleGrid) {
    moduleGrid.innerHTML = modules.modules
      .slice(0, 3)
      .map(renderModuleCard)
      .join("");
  }
}

async function initModulesPage() {
  const modules = await fetchJson("/api/modules");
  const grid = document.getElementById("modules-page-grid");

  if (grid) {
    grid.innerHTML = modules.modules.map(renderModuleCard).join("");
  }
}

async function initProjectsPage() {
  const projects = await fetchJson("/api/projects");
  const grid = document.getElementById("projects-page-grid");

  if (grid) {
    grid.innerHTML = projects.projects.map(renderProjectCard).join("");
  }
}

async function initProjectNewPage() {
  const [templatesResponse, modulesResponse] = await Promise.all([
    fetchJson("/api/templates"),
    fetchJson("/api/modules")
  ]);
  const templates = templatesResponse.templates;
  const modules = modulesResponse.modules;
  const form = document.getElementById("project-create-form");
  const templateDetail = document.getElementById(
    "project-create-template-detail"
  );
  const status = document.getElementById("project-create-status");

  if (!form || !templateDetail) {
    return;
  }

  form.innerHTML = `
    <label class="field">
      <span>Seed type</span>
      <select name="seedType">
        <option value="blank">Blank</option>
        <option value="template">Template</option>
      </select>
    </label>
    <label class="field">
      <span>Template</span>
      <select name="templateId">
        <option value="">Select a template</option>
        ${templates
          .map(
            (template) =>
              `<option value="${template.id}">${template.name}</option>`
          )
          .join("")}
      </select>
    </label>
    <label class="field">
      <span>Project id</span>
      <input name="id" placeholder="project-client-foundation" required />
    </label>
    <label class="field">
      <span>Project name</span>
      <input name="name" placeholder="Client Foundation Project" required />
    </label>
    <label class="field">
      <span>Client id</span>
      <input name="clientId" placeholder="client-slug" required />
    </label>
    <label class="field">
      <span>Client name</span>
      <input name="clientName" placeholder="Client Name" required />
    </label>
    <label class="field">
      <span>Portal id</span>
      <input name="portalId" placeholder="123456789" required />
    </label>
    <label class="field">
      <span>Owner name</span>
      <input name="ownerName" placeholder="Owner Name" required />
    </label>
    <label class="field">
      <span>Owner email</span>
      <input name="ownerEmail" type="email" placeholder="owner@muloo.example" required />
    </label>
    <label class="field">
      <span>Primary region</span>
      <input name="primaryRegion" value="North America" required />
    </label>
    <label class="field">
      <span>Implementation type</span>
      <select name="implementationType">
        ${renderSelectOptions(implementationTypeOptions, "sales-hub-foundation")}
      </select>
    </label>
    <label class="field">
      <span>Environment</span>
      <select name="environment">
        ${renderSelectOptions(environmentOptions, "production")}
      </select>
    </label>
    <label class="field field-full">
      <span>Notes</span>
      <textarea name="notes" rows="4">Initial authoring entry created in Muloo Deploy OS.</textarea>
    </label>
    <div class="field field-full">
      <span>Hubs in scope</span>
      <div class="checkbox-grid">
        ${renderCheckboxGroup("hubInScope", hubOptions, ["sales"])}
      </div>
    </div>
    <div class="field field-full">
        <span>Modules in scope</span>
        <div class="module-selection-grid">
          ${renderModuleSelectionRows(
            modules,
            modules
              .filter((module) =>
                ["crm-setup", "properties"].includes(module.id)
              )
              .map((module) => ({
                moduleId: module.id,
                status: module.id === "crm-setup" ? "ready" : "planned"
              }))
          )}
        </div>
      </div>
    <button class="button-link" type="submit">Save project</button>
  `;

  function renderTemplateDetail(templateId) {
    const template = templates.find((candidate) => candidate.id === templateId);

    templateDetail.innerHTML = template
      ? `
        <div class="kv">
          <div class="kv-item"><span>Name</span><strong>${template.name}</strong></div>
          <div class="kv-item"><span>Type</span><strong>${template.templateType}</strong></div>
          <div class="kv-item"><span>Hubs</span><strong>${template.hubsInScope.join(", ")}</strong></div>
          <div class="kv-item"><span>Modules</span><strong>${template.defaultModules.map((module) => module.moduleId).join(", ")}</strong></div>
          <div class="kv-item"><span>Properties</span><strong>${template.propertyLibrary.properties.length}</strong></div>
          <div class="kv-item"><span>Pipelines</span><strong>${template.defaultPipelines.length}</strong></div>
          <div class="kv-item"><span>Description</span><strong>${template.description}</strong></div>
        </div>
      `
      : renderEmptyState(
          "Template",
          "Choose a Muloo template or create from blank."
        );
  }

  renderTemplateDetail("");

  form
    .querySelector('select[name="seedType"]')
    ?.addEventListener("change", (event) => {
      const seedType = event.target.value;
      const templateSelect = form.querySelector('select[name="templateId"]');

      templateSelect.disabled = seedType !== "template";
      if (seedType !== "template") {
        templateSelect.value = "";
        renderTemplateDetail("");
      }
    });

  form
    .querySelector('select[name="templateId"]')
    ?.addEventListener("change", (event) => {
      renderTemplateDetail(event.target.value);
    });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const seedType = String(formData.get("seedType"));
    const payload = {
      id: String(formData.get("id")),
      name: String(formData.get("name")),
      clientId: String(formData.get("clientId")),
      portalId: String(formData.get("portalId")),
      owner: {
        name: String(formData.get("ownerName")),
        email: String(formData.get("ownerEmail"))
      },
      clientContext: {
        clientName: String(formData.get("clientName")),
        primaryRegion: String(formData.get("primaryRegion")),
        implementationType: String(formData.get("implementationType")),
        notes: String(formData.get("notes"))
      },
      hubspotScope: {
        hubsInScope: getCheckedValues(form, "hubInScope"),
        environment: String(formData.get("environment"))
      },
      moduleSelection: buildModuleSelectionFromForm(form, modules),
      status: "draft"
    };

    try {
      const response =
        seedType === "template"
          ? await requestJson("/api/projects/from-template", {
              method: "POST",
              body: JSON.stringify({
                ...payload,
                templateId: String(formData.get("templateId"))
              })
            })
          : await requestJson("/api/projects", {
              method: "POST",
              body: JSON.stringify(payload)
            });

      if (status) {
        status.innerHTML = `
          <div class="kv">
            <div class="kv-item"><span>Saved</span><strong>${response.project.name}</strong></div>
            <div class="kv-item"><span>Project id</span><strong>${response.project.id}</strong></div>
          </div>
          <a class="button-link" href="/project?id=${encodeURIComponent(response.project.id)}">Open project</a>
        `;
      }
    } catch (error) {
      if (status) {
        status.innerHTML = `<div class="kv"><div class="kv-item"><span>Error</span><strong>${error.message}</strong></div></div>`;
      }
    }
  });
}

async function initProjectDetailPage() {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("id");

  if (!projectId) {
    throw new Error("Missing project id in query string.");
  }

  const [
    projectResponse,
    summaryResponse,
    modulesResponse,
    validationResponse,
    readinessResponse,
    executionsResponse
  ] = await Promise.all([
    fetchJson(`/api/projects/${encodeURIComponent(projectId)}`),
    fetchJson(`/api/projects/${encodeURIComponent(projectId)}/summary`),
    fetchJson(`/api/projects/${encodeURIComponent(projectId)}/modules`),
    fetchJson(`/api/projects/${encodeURIComponent(projectId)}/validation`),
    fetchJson(`/api/projects/${encodeURIComponent(projectId)}/readiness`),
    fetchJson(`/api/projects/${encodeURIComponent(projectId)}/executions`)
  ]);

  const hero = document.getElementById("project-detail-hero");
  const summary = document.getElementById("project-detail-summary");
  const readiness = document.getElementById("project-detail-readiness");
  const baseline = document.getElementById("project-detail-baseline");
  const validation = document.getElementById("project-detail-validation");
  const executions = document.getElementById("project-detail-executions");
  const modules = document.getElementById("project-detail-modules");
  const workflowNav = document.getElementById("project-workflow-nav");
  const metadataForm = document.getElementById("project-metadata-form");
  const scopeForm = document.getElementById("project-scope-form");
  const scopeStatus = document.getElementById("project-scope-status");
  let project = projectResponse.project;
  const projectSummary = summaryResponse.summary;
  const projectValidation = validationResponse.validation;
  const projectReadiness = readinessResponse.readiness;
  const projectExecutions = executionsResponse.executions;
  const projectModules = modulesResponse.modules;
  const modulesCatalog = (await fetchJson("/api/modules")).modules;

  if (hero) {
    hero.innerHTML = `
      <div>
        <p class="eyebrow">Project detail</p>
        <h2>${project.name}</h2>
        <p class="hero-copy">${project.clientContext.notes}</p>
      </div>
    `;
  }

  if (workflowNav) {
    workflowNav.innerHTML = renderProjectWorkflowNav(project.id, "overview");
  }

  if (summary) {
    summary.innerHTML = `
      <div class="kv">
        <div class="kv-item"><span>Client</span><strong>${projectSummary.clientName}</strong></div>
        <div class="kv-item"><span>Region</span><strong>${projectSummary.primaryRegion}</strong></div>
        <div class="kv-item"><span>Status</span><strong>${projectSummary.status}</strong></div>
        <div class="kv-item"><span>Portal</span><strong>${projectSummary.portalDisplayName}</strong></div>
        <div class="kv-item"><span>Seed type</span><strong>${projectSummary.seedType ?? "unknown"}</strong></div>
        <div class="kv-item"><span>Template</span><strong>${projectSummary.templateName ?? "none"}</strong></div>
        <div class="kv-item"><span>Updated</span><strong>${formatDate(projectSummary.updatedAt)}</strong></div>
      </div>
    `;
  }

  if (baseline) {
    baseline.innerHTML = `
      <div class="kv">
        <div class="kv-item"><span>Seed source</span><strong>${project.templateProvenance?.seedType ?? "none"}</strong></div>
        <div class="kv-item"><span>Template</span><strong>${project.templateProvenance?.templateName ?? "Blank project"}</strong></div>
        <div class="kv-item"><span>Seeded modules</span><strong>${project.templateProvenance?.seededModuleIds?.join(", ") || project.modulePlanning.map((module) => module.moduleId).join(", ")}</strong></div>
        <div class="kv-item"><span>Baseline source tags</span><strong>${project.templateProvenance?.baselineSourceTags?.join(", ") || "none"}</strong></div>
        <div class="kv-item"><span>Standard groups</span><strong>${countStandardGroups(project)}</strong></div>
        <div class="kv-item"><span>Standard properties</span><strong>${countStandardProperties(project)}</strong></div>
      </div>
    `;
  }

  if (readiness) {
    readiness.innerHTML = `
      <div class="kv">
        <div class="kv-item"><span>Validation</span><strong>${projectValidation.status}</strong></div>
        <div class="kv-item"><span>Readiness</span><strong>${projectReadiness.readiness}</strong></div>
        <div class="kv-item"><span>Ready modules</span><strong>${projectReadiness.readyModuleIds.join(", ") || "none"}</strong></div>
        <div class="kv-item"><span>Blocked modules</span><strong>${projectReadiness.blockedModuleIds.join(", ") || "none"}</strong></div>
        ${renderReasonRows("Blocker", projectReadiness.blockers)}
        ${renderFindingRows("Warning", projectReadiness.warnings)}
      </div>
    `;
  }

  if (validation) {
    validation.innerHTML = `
      <div class="kv">
        ${renderFindingRows("Error", projectValidation.errors)}
        ${renderFindingRows("Warning", projectValidation.warnings)}
        ${renderFindingRows("Info", projectValidation.infos)}
      </div>
    `;
  }

  if (executions) {
    executions.innerHTML = projectExecutions.length
      ? projectExecutions.map(renderExecutionCard).join("")
      : renderEmptyState("History", "No executions recorded yet.");
  }

  if (modules) {
    modules.innerHTML = projectModules
      .map((module) => renderProjectModuleCard(projectId, module))
      .join("");
  }

  if (metadataForm) {
    metadataForm.innerHTML = `
      <label class="field">
        <span>Project name</span>
        <input name="name" value="${project.name}" required />
      </label>
      <label class="field">
        <span>Status</span>
        <select name="status">
          ${renderSelectOptions(projectStatusOptions, project.status)}
        </select>
      </label>
      <label class="field">
        <span>Client id</span>
        <input name="clientId" value="${project.clientId}" required />
      </label>
      <label class="field">
        <span>Client name</span>
        <input name="clientName" value="${project.clientContext.clientName}" required />
      </label>
      <label class="field">
        <span>Portal id</span>
        <input name="portalId" value="${project.portalId}" required />
      </label>
      <label class="field">
        <span>Owner name</span>
        <input name="ownerName" value="${project.owner.name}" required />
      </label>
      <label class="field">
        <span>Owner email</span>
        <input name="ownerEmail" type="email" value="${project.owner.email}" required />
      </label>
      <label class="field">
        <span>Primary region</span>
        <input name="primaryRegion" value="${project.clientContext.primaryRegion}" required />
      </label>
      <label class="field">
        <span>Implementation type</span>
        <select name="implementationType">
          ${renderSelectOptions(
            implementationTypeOptions,
            project.clientContext.implementationType
          )}
        </select>
      </label>
      <label class="field field-full">
        <span>Notes</span>
        <textarea name="notes" rows="4">${project.clientContext.notes}</textarea>
      </label>
      <button class="button-link" type="submit">Save metadata</button>
    `;

    metadataForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(metadataForm);

      await requestJson(`/api/projects/${encodeURIComponent(project.id)}`, {
        method: "PUT",
        body: JSON.stringify({
          name: String(formData.get("name")),
          clientId: String(formData.get("clientId")),
          portalId: String(formData.get("portalId")),
          status: String(formData.get("status")),
          owner: {
            name: String(formData.get("ownerName")),
            email: String(formData.get("ownerEmail"))
          },
          clientContext: {
            clientName: String(formData.get("clientName")),
            primaryRegion: String(formData.get("primaryRegion")),
            implementationType: String(formData.get("implementationType")),
            notes: String(formData.get("notes"))
          }
        })
      });

      window.location.reload();
    });
  }

  if (scopeForm) {
    scopeForm.innerHTML = `
      <div class="field field-full">
        <span>Hubs in scope</span>
        <div class="checkbox-grid">
          ${renderCheckboxGroup(
            "hubInScope",
            hubOptions,
            project.hubspotScope.hubsInScope
          )}
        </div>
      </div>
      <label class="field">
        <span>Environment</span>
        <select name="environment">
          ${renderSelectOptions(environmentOptions, project.hubspotScope.environment)}
        </select>
      </label>
      <div class="field field-full">
        <span>Modules in scope</span>
        <div class="module-selection-grid">
          ${renderModuleSelectionRows(modulesCatalog, project.modulePlanning)}
        </div>
      </div>
      <button class="button-link" type="submit">Save scope</button>
    `;

    scopeForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      try {
        await requestJson(
          `/api/projects/${encodeURIComponent(project.id)}/scope`,
          {
            method: "PUT",
            body: JSON.stringify({
              hubsInScope: getCheckedValues(scopeForm, "hubInScope"),
              environment: scopeForm.querySelector('select[name="environment"]')
                ?.value,
              moduleSelection: buildModuleSelectionFromForm(
                scopeForm,
                modulesCatalog,
                project.modulePlanning
              )
            })
          }
        );

        if (scopeStatus) {
          scopeStatus.innerHTML = `<div class="kv"><div class="kv-item"><span>Status</span><strong>Scope updated.</strong></div></div>`;
        }
        window.location.reload();
      } catch (error) {
        if (scopeStatus) {
          scopeStatus.innerHTML = `<div class="kv"><div class="kv-item"><span>Error</span><strong>${error.message}</strong></div></div>`;
        }
      }
    });
  }
}

function renderLifecycleEditorRows(values, inputName, placeholder) {
  const rows = values.length ? values : [""];

  return rows
    .map(
      (value, index) => `
        <div class="editor-card compact">
          <div class="editor-grid">
            <label class="field">
              <span>Order</span>
              <input value="${index + 1}" disabled />
            </label>
            <label class="field">
              <span>Value</span>
              <input name="${inputName}" value="${value}" placeholder="${placeholder}" />
            </label>
          </div>
          <div class="editor-actions">
            <button class="button-secondary button-danger" type="button" data-action="remove-item" data-list="${inputName}" data-index="${index}">Remove</button>
          </div>
        </div>
      `
    )
    .join("");
}

async function initProjectLifecycleDesignPage() {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("project");

  if (!projectId) {
    throw new Error("Missing project id in query string.");
  }

  const [projectResponse, designResponse] = await Promise.all([
    fetchJson(`/api/projects/${encodeURIComponent(projectId)}`),
    fetchJson(`/api/projects/${encodeURIComponent(projectId)}/design`)
  ]);
  let project = projectResponse.project;
  const hero = document.getElementById("project-design-lifecycle-hero");
  const workflowNav = document.getElementById("project-workflow-nav");
  const form = document.getElementById("project-design-lifecycle-form");
  const status = document.getElementById("project-design-lifecycle-status");
  const state = {
    lifecycleStages: [...designResponse.design.lifecycleStages],
    leadStatuses: [...designResponse.design.leadStatuses]
  };

  function renderForm() {
    if (!form) {
      return;
    }

    form.innerHTML = `
      <div class="editor-stack">
        <div class="editor-card">
          <div class="section-header">
            <div>
              <p class="panel-label">Lifecycle stages</p>
              <h3>Ordered lifecycle values</h3>
            </div>
            <button class="button-secondary" type="button" data-action="add-item" data-list="lifecycleStages">Add stage</button>
          </div>
          <div class="editor-list">
            ${renderLifecycleEditorRows(
              state.lifecycleStages,
              "lifecycleStages",
              "subscriber"
            )}
          </div>
        </div>
        <div class="editor-card">
          <div class="section-header">
            <div>
              <p class="panel-label">Lead statuses</p>
              <h3>Ordered sales intake states</h3>
            </div>
            <button class="button-secondary" type="button" data-action="add-item" data-list="leadStatuses">Add status</button>
          </div>
          <div class="editor-list">
            ${renderLifecycleEditorRows(
              state.leadStatuses,
              "leadStatuses",
              "Open"
            )}
          </div>
        </div>
        <div class="editor-actions">
          <button class="button-link" type="submit">Save lifecycle design</button>
        </div>
      </div>
    `;
  }

  function renderStatus(validation, readiness) {
    if (!status) {
      return;
    }

    status.innerHTML = `
      ${renderProjectDesignStatus(project, validation, readiness)}
      <div class="callout">
        <p>Lifecycle and lead-status edits update project validation immediately. Empty lists remain saveable in v1 so operators can progressively design a project, but readiness will flag the project as not ready.</p>
      </div>
    `;
  }

  if (hero) {
    hero.innerHTML = `
      <div>
        <p class="eyebrow">Design editor</p>
        <h2>${project.name}</h2>
        <p class="hero-copy">Edit lifecycle stages and lead statuses for ${project.clientContext.clientName}.</p>
      </div>
    `;
  }

  if (workflowNav) {
    workflowNav.innerHTML = renderProjectWorkflowNav(project.id, "lifecycle");
  }

  renderForm();
  renderStatus(designResponse.validation, designResponse.readiness);

  form?.addEventListener("click", (event) => {
    const target = event.target.closest("button[data-action]");

    if (!target) {
      return;
    }

    const listName = target.dataset.list;
    const index = Number(target.dataset.index);

    if (target.dataset.action === "add-item" && listName) {
      state[listName].push("");
      renderForm();
      return;
    }

    if (target.dataset.action === "remove-item" && listName) {
      state[listName].splice(index, 1);
      renderForm();
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    state.lifecycleStages = [
      ...form.querySelectorAll('input[name="lifecycleStages"]')
    ].map((input) => input.value);
    state.leadStatuses = [
      ...form.querySelectorAll('input[name="leadStatuses"]')
    ].map((input) => input.value);

    const response = await requestJson(
      `/api/projects/${encodeURIComponent(project.id)}/design/lifecycle`,
      {
        method: "PUT",
        body: JSON.stringify({
          lifecycleStages: state.lifecycleStages,
          leadStatuses: state.leadStatuses
        })
      }
    );

    project = response.project;
    state.lifecycleStages = [...response.design.lifecycleStages];
    state.leadStatuses = [...response.design.leadStatuses];
    renderForm();
    renderStatus(response.validation, response.readiness);
  });
}

function renderPropertiesFormContent(currentObjectType, currentState) {
  const groups = currentState.groups.length
    ? currentState.groups
    : [{ internalName: "", label: "", description: "", sourceTag: "" }];
  const properties = currentState.properties.length
    ? currentState.properties
    : [
        {
          internalName: "",
          label: "",
          groupName: "",
          valueType: "string",
          fieldType: "text",
          description: "",
          required: false,
          options: [],
          sourceTag: ""
        }
      ];

  return `
    <div class="editor-stack">
      <label class="field">
        <span>Object type</span>
        <select name="objectType">
          ${renderSelectOptions(objectTypeOptions, currentObjectType)}
        </select>
      </label>
      <div class="editor-card">
        <div class="section-header">
          <div>
            <p class="panel-label">Property groups</p>
            <h3>Group definitions for ${currentObjectType}</h3>
          </div>
          <button class="button-secondary" type="button" data-action="add-group">Add group</button>
        </div>
        <div class="editor-list">
          ${groups
            .map(
              (group, index) => `
                <div class="editor-card compact" data-group-row="${index}">
                  <div class="editor-grid">
                    <label class="field">
                      <span>Group name</span>
                      <input name="group-internal-name" value="${group.internalName ?? ""}" placeholder="custom_group" />
                    </label>
                    <label class="field">
                      <span>Label</span>
                      <input name="group-label" value="${group.label ?? ""}" placeholder="Custom Group" />
                    </label>
                    <label class="field field-full">
                      <span>Description</span>
                      <textarea name="group-description" rows="2">${group.description ?? ""}</textarea>
                    </label>
                    <label class="field">
                      <span>Source tag</span>
                      <input value="${group.sourceTag ?? ""}" readonly />
                    </label>
                  </div>
                  <div class="editor-actions">
                    <button class="button-secondary button-danger" type="button" data-action="remove-group" data-index="${index}">Remove group</button>
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
      <div class="editor-card">
        <div class="section-header">
          <div>
            <p class="panel-label">Properties</p>
            <h3>Field definitions for ${currentObjectType}</h3>
          </div>
          <button class="button-secondary" type="button" data-action="add-property">Add property</button>
        </div>
        <div class="editor-list">
          ${properties
            .map(
              (property, index) => `
                <div class="editor-card compact" data-property-row="${index}">
                  <div class="editor-grid wide">
                    <label class="field">
                      <span>Internal name</span>
                      <input name="property-internal-name" value="${property.internalName ?? ""}" placeholder="custom_field" />
                    </label>
                    <label class="field">
                      <span>Label</span>
                      <input name="property-label" value="${property.label ?? ""}" placeholder="Custom Field" />
                    </label>
                    <label class="field">
                      <span>Group</span>
                      <input name="property-group" value="${property.groupName ?? ""}" placeholder="contactinformation" />
                    </label>
                    <label class="field">
                      <span>Field type</span>
                      <select name="property-field-type">
                        ${renderSelectOptions(propertyFieldTypeOptions, property.fieldType ?? "text")}
                      </select>
                    </label>
                    <label class="field">
                      <span>Value type</span>
                      <select name="property-value-type">
                        ${renderSelectOptions(propertyValueTypeOptions, property.valueType ?? "string")}
                      </select>
                    </label>
                    <label class="field">
                      <span>Required</span>
                      <select name="property-required">
                        ${renderSelectOptions(["false", "true"], String(property.required ?? false))}
                      </select>
                    </label>
                    <label class="field field-full">
                      <span>Description</span>
                      <textarea name="property-description" rows="2">${property.description ?? ""}</textarea>
                    </label>
                    <label class="field field-full">
                      <span>Options</span>
                      <textarea name="property-options" rows="3" placeholder="Label:value">${formatOptionsInput(property.options)}</textarea>
                    </label>
                    <label class="field">
                      <span>Source tag</span>
                      <input value="${property.sourceTag ?? ""}" readonly />
                    </label>
                  </div>
                  <div class="editor-actions">
                    <button class="button-secondary button-danger" type="button" data-action="remove-property" data-index="${index}">Remove property</button>
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
      <div class="editor-actions">
        <button class="button-link" type="submit">Save properties design</button>
      </div>
    </div>
  `;
}

function capturePropertiesObjectState(form, state, objectType) {
  const groupRows = [...form.querySelectorAll("[data-group-row]")];
  const propertyRows = [...form.querySelectorAll("[data-property-row]")];

  state[objectType] = {
    groups: groupRows.map((row) => ({
      internalName: row
        .querySelector('input[name="group-internal-name"]')
        .value.trim(),
      label: row.querySelector('input[name="group-label"]').value.trim(),
      description: row
        .querySelector('textarea[name="group-description"]')
        .value.trim(),
      sourceTag: row.querySelector("input[readonly]")?.value.trim() || undefined
    })),
    properties: propertyRows.map((row) => ({
      internalName: row
        .querySelector('input[name="property-internal-name"]')
        .value.trim(),
      label: row.querySelector('input[name="property-label"]').value.trim(),
      groupName: row.querySelector('input[name="property-group"]').value.trim(),
      fieldType: row.querySelector('select[name="property-field-type"]').value,
      valueType: row.querySelector('select[name="property-value-type"]').value,
      description: row
        .querySelector('textarea[name="property-description"]')
        .value.trim(),
      required:
        row.querySelector('select[name="property-required"]').value === "true",
      options: parseOptionsInput(
        row.querySelector('textarea[name="property-options"]').value
      ),
      sourceTag: row.querySelector("input[readonly]")?.value.trim() || undefined
    }))
  };
}

async function initProjectPropertiesDesignPage() {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("project");

  if (!projectId) {
    throw new Error("Missing project id in query string.");
  }

  const [projectResponse, designResponse] = await Promise.all([
    fetchJson(`/api/projects/${encodeURIComponent(projectId)}`),
    fetchJson(`/api/projects/${encodeURIComponent(projectId)}/design`)
  ]);
  let project = projectResponse.project;
  const hero = document.getElementById("project-design-properties-hero");
  const workflowNav = document.getElementById("project-workflow-nav");
  const form = document.getElementById("project-design-properties-form");
  const status = document.getElementById("project-design-properties-status");
  const state = mapPropertyPlanningByObject(
    designResponse.design.propertyPlanning
  );
  let currentObjectType = designResponse.design.objectsInScope[0] ?? "contacts";

  function renderForm() {
    if (!form) {
      return;
    }

    form.innerHTML = renderPropertiesFormContent(
      currentObjectType,
      state[currentObjectType] ?? { groups: [], properties: [] }
    );
  }

  function renderStatus(validation, readiness) {
    if (!status) {
      return;
    }

    status.innerHTML = `
      ${renderProjectDesignStatus(
        project,
        validation,
        readiness,
        `<div class="kv-item"><span>Standard groups</span><strong>${countStandardGroups(project)}</strong></div>
         <div class="kv-item"><span>Standard properties</span><strong>${countStandardProperties(project)}</strong></div>`
      )}
      <div class="callout">
        <p>Template-seeded source tags stay visible as read-only markers. New groups and properties can be added without removing baseline provenance.</p>
      </div>
    `;
  }

  if (hero) {
    hero.innerHTML = `
      <div>
        <p class="eyebrow">Design editor</p>
        <h2>${project.name}</h2>
        <p class="hero-copy">Design object-level property groups and properties for ${project.clientContext.clientName}.</p>
      </div>
    `;
  }

  if (workflowNav) {
    workflowNav.innerHTML = renderProjectWorkflowNav(project.id, "properties");
  }

  renderForm();
  renderStatus(designResponse.validation, designResponse.readiness);

  form?.addEventListener("change", (event) => {
    if (event.target.name === "objectType") {
      capturePropertiesObjectState(form, state, currentObjectType);
      currentObjectType = event.target.value;
      renderForm();
    }
  });

  form?.addEventListener("click", (event) => {
    const target = event.target.closest("button[data-action]");

    if (!target) {
      return;
    }

    capturePropertiesObjectState(form, state, currentObjectType);

    if (target.dataset.action === "add-group") {
      state[currentObjectType].groups.push({
        internalName: "",
        label: "",
        description: "",
        sourceTag: ""
      });
      renderForm();
      return;
    }

    if (target.dataset.action === "remove-group") {
      state[currentObjectType].groups.splice(Number(target.dataset.index), 1);
      renderForm();
      return;
    }

    if (target.dataset.action === "add-property") {
      state[currentObjectType].properties.push({
        internalName: "",
        label: "",
        groupName: "",
        fieldType: "text",
        valueType: "string",
        description: "",
        required: false,
        options: [],
        sourceTag: ""
      });
      renderForm();
      return;
    }

    if (target.dataset.action === "remove-property") {
      state[currentObjectType].properties.splice(
        Number(target.dataset.index),
        1
      );
      renderForm();
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    capturePropertiesObjectState(form, state, currentObjectType);

    const response = await requestJson(
      `/api/projects/${encodeURIComponent(project.id)}/design/properties`,
      {
        method: "PUT",
        body: JSON.stringify(buildPropertyPlanningPayload(state))
      }
    );

    project = response.project;
    Object.assign(
      state,
      mapPropertyPlanningByObject(response.design.propertyPlanning)
    );
    renderForm();
    renderStatus(response.validation, response.readiness);
  });
}

function renderPipelinesFormContent(pipelines) {
  const items = pipelines.length
    ? pipelines
    : [{ objectType: "deals", internalName: "", label: "", stages: [] }];

  return `
    <div class="editor-stack">
      <div class="editor-actions">
        <button class="button-secondary" type="button" data-action="add-pipeline">Add pipeline</button>
      </div>
      <div class="editor-list">
        ${items
          .map(
            (pipeline, pipelineIndex) => `
              <div class="editor-card" data-pipeline-row="${pipelineIndex}">
                <div class="section-header">
                  <div>
                    <p class="panel-label">${pipeline.objectType}</p>
                    <h3>${pipeline.label || "New pipeline"}</h3>
                  </div>
                  <button class="button-secondary button-danger" type="button" data-action="remove-pipeline" data-index="${pipelineIndex}">Remove pipeline</button>
                </div>
                <div class="editor-grid">
                  <label class="field">
                    <span>Object type</span>
                    <select name="pipeline-object-type">
                      ${renderSelectOptions(
                        pipelineObjectTypeOptions,
                        pipeline.objectType ?? "deals"
                      )}
                    </select>
                  </label>
                  <label class="field">
                    <span>Pipeline key</span>
                    <input name="pipeline-internal-name" value="${pipeline.internalName ?? ""}" placeholder="sales_pipeline" />
                  </label>
                  <label class="field">
                    <span>Pipeline label</span>
                    <input name="pipeline-label" value="${pipeline.label ?? ""}" placeholder="Sales Pipeline" />
                  </label>
                </div>
                <div class="nested-list">
                  <div class="section-header">
                    <div>
                      <p class="panel-label">Stages</p>
                      <h3>Ordered pipeline stages</h3>
                    </div>
                    <button class="button-secondary" type="button" data-action="add-stage" data-index="${pipelineIndex}">Add stage</button>
                  </div>
                  ${(pipeline.stages ?? [])
                    .map(
                      (stage, stageIndex) => `
                        <div class="editor-card compact" data-stage-row="${stageIndex}">
                          <div class="editor-grid wide">
                            <label class="field">
                              <span>Stage label</span>
                              <input name="stage-label" value="${stage.label ?? ""}" placeholder="Qualified to buy" />
                            </label>
                            <label class="field">
                              <span>Stage internal name</span>
                              <input name="stage-internal-name" value="${stage.internalName ?? ""}" placeholder="qualifiedtobuy" />
                            </label>
                            <label class="field">
                              <span>Order</span>
                              <input name="stage-order" type="number" value="${stage.order ?? stageIndex + 1}" min="1" />
                            </label>
                          </div>
                          <div class="editor-actions">
                            <button class="button-secondary button-danger" type="button" data-action="remove-stage" data-pipeline-index="${pipelineIndex}" data-stage-index="${stageIndex}">Remove stage</button>
                          </div>
                        </div>
                      `
                    )
                    .join("")}
                </div>
              </div>
            `
          )
          .join("")}
      </div>
      <div class="editor-actions">
        <button class="button-link" type="submit">Save pipelines design</button>
      </div>
    </div>
  `;
}

function capturePipelinesState(form, previousState) {
  return [...form.querySelectorAll("[data-pipeline-row]")].map(
    (pipelineRow, pipelineIndex) => {
      const previousPipeline = previousState[pipelineIndex];

      return {
        objectType: pipelineRow.querySelector(
          'select[name="pipeline-object-type"]'
        ).value,
        internalName: pipelineRow
          .querySelector('input[name="pipeline-internal-name"]')
          .value.trim(),
        label: pipelineRow
          .querySelector('input[name="pipeline-label"]')
          .value.trim(),
        stages: [...pipelineRow.querySelectorAll("[data-stage-row]")].map(
          (stageRow, stageIndex) => ({
            internalName: stageRow
              .querySelector('input[name="stage-internal-name"]')
              .value.trim(),
            label: stageRow
              .querySelector('input[name="stage-label"]')
              .value.trim(),
            order: Number(
              stageRow.querySelector('input[name="stage-order"]').value ||
                stageIndex + 1
            ),
            ...(previousPipeline?.stages?.[stageIndex]?.probability !==
            undefined
              ? { probability: previousPipeline.stages[stageIndex].probability }
              : {})
          })
        )
      };
    }
  );
}

async function initProjectPipelinesDesignPage() {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("project");

  if (!projectId) {
    throw new Error("Missing project id in query string.");
  }

  const [projectResponse, designResponse] = await Promise.all([
    fetchJson(`/api/projects/${encodeURIComponent(projectId)}`),
    fetchJson(`/api/projects/${encodeURIComponent(projectId)}/design`)
  ]);
  let project = projectResponse.project;
  const hero = document.getElementById("project-design-pipelines-hero");
  const workflowNav = document.getElementById("project-workflow-nav");
  const form = document.getElementById("project-design-pipelines-form");
  const status = document.getElementById("project-design-pipelines-status");
  let state = cloneJson(designResponse.design.pipelines);

  function renderForm() {
    if (!form) {
      return;
    }

    form.innerHTML = renderPipelinesFormContent(state);
  }

  function renderStatus(validation, readiness) {
    if (!status) {
      return;
    }

    status.innerHTML = `
      ${renderProjectDesignStatus(project, validation, readiness)}
      <div class="callout">
        <p>Pipelines are structural in v1. Operators can manage pipeline keys, labels, object types, and ordered stages, while deeper workflow behavior stays outside this editor.</p>
      </div>
    `;
  }

  if (hero) {
    hero.innerHTML = `
      <div>
        <p class="eyebrow">Design editor</p>
        <h2>${project.name}</h2>
        <p class="hero-copy">Design deal and ticket pipelines for ${project.clientContext.clientName}.</p>
      </div>
    `;
  }

  if (workflowNav) {
    workflowNav.innerHTML = renderProjectWorkflowNav(project.id, "pipelines");
  }

  renderForm();
  renderStatus(designResponse.validation, designResponse.readiness);

  form?.addEventListener("click", (event) => {
    const target = event.target.closest("button[data-action]");

    if (!target) {
      return;
    }

    state = capturePipelinesState(form, state);

    if (target.dataset.action === "add-pipeline") {
      state.push({
        objectType: "deals",
        internalName: "",
        label: "",
        stages: []
      });
      renderForm();
      return;
    }

    if (target.dataset.action === "remove-pipeline") {
      state.splice(Number(target.dataset.index), 1);
      renderForm();
      return;
    }

    if (target.dataset.action === "add-stage") {
      const pipelineIndex = Number(target.dataset.index);
      state[pipelineIndex].stages.push({
        internalName: "",
        label: "",
        order: state[pipelineIndex].stages.length + 1
      });
      renderForm();
      return;
    }

    if (target.dataset.action === "remove-stage") {
      const pipelineIndex = Number(target.dataset.pipelineIndex);
      const stageIndex = Number(target.dataset.stageIndex);
      state[pipelineIndex].stages.splice(stageIndex, 1);
      renderForm();
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    state = capturePipelinesState(form, state);

    const response = await requestJson(
      `/api/projects/${encodeURIComponent(project.id)}/design/pipelines`,
      {
        method: "PUT",
        body: JSON.stringify({
          pipelines: state
        })
      }
    );

    project = response.project;
    state = cloneJson(response.design.pipelines);
    renderForm();
    renderStatus(response.validation, response.readiness);
  });
}

async function initModuleDetailPage() {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("project");
  const moduleKey = params.get("module");

  if (!projectId || !moduleKey) {
    throw new Error("Missing project or module in query string.");
  }

  const { module } = await fetchJson(
    `/api/projects/${encodeURIComponent(projectId)}/modules/${encodeURIComponent(moduleKey)}`
  );

  const hero = document.getElementById("module-detail-hero");
  const contract = document.getElementById("module-detail-contract");
  const readiness = document.getElementById("module-detail-readiness");
  const inputs = document.getElementById("module-detail-inputs");
  const execution = document.getElementById("module-detail-execution");

  if (hero) {
    hero.innerHTML = `
      <div>
        <p class="eyebrow">Module detail</p>
        <h2>${module.name}</h2>
        <p class="hero-copy">${module.summary}</p>
      </div>
    `;
  }

  if (contract) {
    const guardrails = module.contract.applyGuardrails;
    const guardrailRows = guardrails
      ? `
        <div class="kv-item"><span>Apply support</span><strong>${guardrails.enabled ? "guarded apply" : "disabled"}</strong></div>
        <div class="kv-item"><span>Apply summary</span><strong>${guardrails.summary}</strong></div>
        <div class="kv-item"><span>Allowed operations</span><strong>${guardrails.allowedOperationTypes.join(", ") || "none"}</strong></div>
        <div class="kv-item"><span>Blocked operations</span><strong>${guardrails.blockedOperationTypes.join(", ") || "none"}</strong></div>
        <div class="kv-item"><span>Confirmation flags</span><strong>${guardrails.confirmationFlags.join(", ") || "none"}</strong></div>
        ${guardrails.guardConditions
          .map(
            (condition) =>
              `<div class="kv-item"><span>${condition.label}</span><strong>${condition.description}</strong></div>`
          )
          .join("")}
      `
      : `
        <div class="kv-item"><span>Apply support</span><strong>dry-run only</strong></div>
      `;

    contract.innerHTML = `
      <div class="kv">
        <div class="kv-item"><span>Module key</span><strong>${module.contract.moduleKey}</strong></div>
        <div class="kv-item"><span>Modes</span><strong>${module.contract.supportedModes.join(", ") || "none"}</strong></div>
        <div class="kv-item"><span>Validation handler</span><strong>${module.contract.handlers.validation ? "yes" : "no"}</strong></div>
        <div class="kv-item"><span>Readiness handler</span><strong>${module.contract.handlers.readiness ? "yes" : "no"}</strong></div>
        <div class="kv-item"><span>Dry-run handler</span><strong>${module.contract.handlers.dryRun ? "yes" : "no"}</strong></div>
        <div class="kv-item"><span>Apply handler</span><strong>${module.contract.handlers.apply ? "yes" : "no"}</strong></div>
        ${guardrailRows}
      </div>
    `;
  }

  if (readiness) {
    readiness.innerHTML = `
      <div class="kv">
        <div class="kv-item"><span>Status</span><strong>${module.validationStatus}</strong></div>
        <div class="kv-item"><span>Readiness</span><strong>${module.readiness}</strong></div>
        ${renderReasonRows("Blocker", module.blockers)}
        ${renderFindingRows("Warning", module.warnings)}
        ${renderFindingRows("Info", module.infos)}
      </div>
    `;
  }

  if (inputs) {
    inputs.innerHTML = `
      <div class="kv">
        ${renderInputRows(module.inputRequirements)}
      </div>
    `;
  }

  if (execution) {
    execution.innerHTML = module.executionSummary.executionCount
      ? `
        <div class="kv">
          <div class="kv-item"><span>Execution count</span><strong>${module.executionSummary.executionCount}</strong></div>
          <div class="kv-item"><span>Last status</span><strong>${module.executionSummary.lastExecutionStatus}</strong></div>
          <div class="kv-item"><span>Last mode</span><strong>${module.executionSummary.lastExecutionMode ?? "unknown"}</strong></div>
          <div class="kv-item"><span>Last run</span><strong>${formatTimestamp(module.executionSummary.lastExecutedAt)}</strong></div>
          <div class="kv-item"><span>Last summary</span><strong>${module.executionSummary.lastSummary ?? "none"}</strong></div>
        </div>
        <a class="button-link" href="/execution?id=${encodeURIComponent(module.executionSummary.lastExecutionId)}">Open last execution</a>
      `
      : renderEmptyState(
          "Execution",
          "No execution history recorded for this module."
        );
  }
}

async function initExecutionDetailPage() {
  const params = new URLSearchParams(window.location.search);
  const executionId = params.get("id");

  if (!executionId) {
    throw new Error("Missing execution id in query string.");
  }

  const [executionResponse, stepsResponse] = await Promise.all([
    fetchJson(`/api/executions/${encodeURIComponent(executionId)}`),
    fetchJson(`/api/executions/${encodeURIComponent(executionId)}/steps`)
  ]);

  const hero = document.getElementById("execution-detail-hero");
  const summary = document.getElementById("execution-detail-summary");
  const operations = document.getElementById("execution-detail-operations");
  const timeline = document.getElementById("execution-detail-timeline");
  const execution = executionResponse.execution;

  if (hero) {
    hero.innerHTML = `
      <div>
        <p class="eyebrow">Execution detail</p>
        <h2>${execution.moduleKey}</h2>
        <p class="hero-copy">${execution.result?.summary ?? execution.output.summaryText ?? "No execution summary recorded."}</p>
      </div>
    `;
  }

  if (summary) {
    summary.innerHTML = `
      <div class="kv">
        <div class="kv-item"><span>Status</span><strong>${execution.status}</strong></div>
        <div class="kv-item"><span>Project</span><strong>${execution.projectId}</strong></div>
        <div class="kv-item"><span>Mode</span><strong>${execution.mode}</strong></div>
        <div class="kv-item"><span>Started</span><strong>${formatTimestamp(execution.startedAt)}</strong></div>
        <div class="kv-item"><span>Completed</span><strong>${execution.completedAt ? formatTimestamp(execution.completedAt) : "in progress"}</strong></div>
        <div class="kv-item"><span>Warnings</span><strong>${execution.warnings.length}</strong></div>
        <div class="kv-item"><span>Errors</span><strong>${execution.errors.length}</strong></div>
        <div class="kv-item"><span>Requested operations</span><strong>${execution.operations.requested.length}</strong></div>
        <div class="kv-item"><span>Executed operations</span><strong>${execution.operations.executed.length}</strong></div>
        <div class="kv-item"><span>Blocked operations</span><strong>${execution.operations.blocked.length}</strong></div>
      </div>
    `;
  }

  if (operations) {
    operations.innerHTML = `
      <div class="kv">
        ${renderOperationRows("Requested", execution.operations.requested)}
        ${renderOperationRows("Executed", execution.operations.executed)}
        ${renderOperationRows("Blocked", execution.operations.blocked)}
      </div>
    `;
  }

  if (timeline) {
    timeline.innerHTML = stepsResponse.steps.length
      ? stepsResponse.steps.map(renderExecutionStep).join("")
      : renderEmptyState("Timeline", "No execution steps recorded.");
  }
}

async function initSettingsPage() {
  const settings = await fetchJson("/api/settings");
  const container = document.getElementById("settings-readiness");

  if (container) {
    container.innerHTML = `
      <div class="kv">
        <div class="kv-item"><span>Environment</span><strong>${settings.environment}</strong></div>
        <div class="kv-item"><span>Base URL</span><strong>${settings.appBaseUrl}</strong></div>
        <div class="kv-item"><span>Artifact directory</span><strong>${settings.artifactDir}</strong></div>
        <div class="kv-item"><span>Execution mode</span><strong>${settings.executionMode}</strong></div>
        <div class="kv-item"><span>Apply enabled</span><strong>${settings.applyEnabled ? "yes" : "no"}</strong></div>
        ${Object.entries(settings.integrationStatus)
          .map(
            ([key, value]) =>
              `<div class="kv-item"><span>${key}</span><strong>${value ? "configured" : "not configured"}</strong></div>`
          )
          .join("")}
      </div>
    `;
  }
}

async function main() {
  const page = document.body.dataset.page;

  try {
    if (page === "dashboard") {
      await initDashboard();
      return;
    }

    if (page === "modules") {
      await initModulesPage();
      return;
    }

    if (page === "projects") {
      await initProjectsPage();
      return;
    }

    if (page === "project-new") {
      await initProjectNewPage();
      return;
    }

    if (page === "project-detail") {
      await initProjectDetailPage();
      return;
    }

    if (page === "project-design-lifecycle") {
      await initProjectLifecycleDesignPage();
      return;
    }

    if (page === "project-design-properties") {
      await initProjectPropertiesDesignPage();
      return;
    }

    if (page === "project-design-pipelines") {
      await initProjectPipelinesDesignPage();
      return;
    }

    if (page === "module-detail") {
      await initModuleDetailPage();
      return;
    }

    if (page === "execution-detail") {
      await initExecutionDetailPage();
      return;
    }

    if (page === "settings") {
      await initSettingsPage();
    }
  } catch (error) {
    console.error(error);
  }
}

void main();
