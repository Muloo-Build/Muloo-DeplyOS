async function fetchJson(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Request failed for ${path}`);
  }

  return response.json();
}

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
  return `
    <article class="module-card">
      <p class="panel-label">${project.implementationType}</p>
      <h3>${project.name}</h3>
      <p class="module-copy">${project.clientName} / ${project.primaryRegion}</p>
      <div class="section-header">
        <span class="${renderBadgeClass(project.validationStatus)}">${project.validationStatus}</span>
        <span class="small">${project.readiness} / ${project.executionCount} run(s)</span>
      </div>
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

function renderExecutionCard(execution) {
  const createCount =
    execution.summaryMetrics.toCreateCount ??
    execution.summaryMetrics.toCreatePipelineCount ??
    0;
  const reviewCount =
    execution.summaryMetrics.needsReviewCount ??
    execution.summaryMetrics.needsReviewPipelineCount ??
    0;

  return `
    <article class="module-card">
      <p class="panel-label">${execution.moduleKey}</p>
      <h3>${execution.status}</h3>
      <p class="module-copy">${execution.mode} / ${formatTimestamp(execution.startedAt)}</p>
      <div class="section-header">
        <span class="${renderBadgeClass(execution.status)}">${execution.status}</span>
        <span class="small">${createCount} create / ${reviewCount} review</span>
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
  const validation = document.getElementById("project-detail-validation");
  const executions = document.getElementById("project-detail-executions");
  const modules = document.getElementById("project-detail-modules");
  const project = projectResponse.project;
  const projectSummary = summaryResponse.summary;
  const projectValidation = validationResponse.validation;
  const projectReadiness = readinessResponse.readiness;
  const projectExecutions = executionsResponse.executions;

  if (hero) {
    hero.innerHTML = `
      <div>
        <p class="eyebrow">Project detail</p>
        <h2>${project.name}</h2>
        <p class="hero-copy">${project.clientContext.notes}</p>
      </div>
    `;
  }

  if (summary) {
    summary.innerHTML = `
      <div class="kv">
        <div class="kv-item"><span>Client</span><strong>${projectSummary.clientName}</strong></div>
        <div class="kv-item"><span>Region</span><strong>${projectSummary.primaryRegion}</strong></div>
        <div class="kv-item"><span>Status</span><strong>${projectSummary.status}</strong></div>
        <div class="kv-item"><span>Portal</span><strong>${projectSummary.portalDisplayName}</strong></div>
        <div class="kv-item"><span>Updated</span><strong>${formatDate(projectSummary.updatedAt)}</strong></div>
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
    modules.innerHTML = modulesResponse.modules
      .map((module) => renderProjectModuleCard(projectId, module))
      .join("");
  }
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
    contract.innerHTML = `
      <div class="kv">
        <div class="kv-item"><span>Module key</span><strong>${module.contract.moduleKey}</strong></div>
        <div class="kv-item"><span>Modes</span><strong>${module.contract.supportedModes.join(", ") || "none"}</strong></div>
        <div class="kv-item"><span>Validation handler</span><strong>${module.contract.handlers.validation ? "yes" : "no"}</strong></div>
        <div class="kv-item"><span>Readiness handler</span><strong>${module.contract.handlers.readiness ? "yes" : "no"}</strong></div>
        <div class="kv-item"><span>Dry-run handler</span><strong>${module.contract.handlers.dryRun ? "yes" : "no"}</strong></div>
        <div class="kv-item"><span>Apply handler</span><strong>${module.contract.handlers.apply ? "yes" : "no"}</strong></div>
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

    if (page === "project-detail") {
      await initProjectDetailPage();
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
