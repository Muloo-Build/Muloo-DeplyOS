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

function renderModuleCard(module) {
  const badgeClass =
    module.status === "available"
      ? "badge good"
      : module.status === "in-progress"
        ? "badge"
        : "badge warn";

  return `
    <article class="module-card">
      <p class="panel-label">${module.category}</p>
      <h3>${module.name}</h3>
      <p class="module-copy">${module.summary}</p>
      <div class="section-header">
        <span class="${badgeClass}">${module.status}</span>
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
      <p class="module-copy">${project.clientName} � ${project.primaryRegion}</p>
      <div class="section-header">
        <span class="badge">${project.status}</span>
        <span class="small">${project.hubsInScope.join(", ")}</span>
      </div>
      <a class="button-link" href="/project?id=${encodeURIComponent(project.id)}">Open project</a>
    </article>
  `;
}

function renderProjectModuleCard(module) {
  const dependencyText = module.dependencies.length
    ? `Depends on: ${module.dependencies.join(", ")}`
    : "No dependencies";

  return `
    <article class="module-card">
      <p class="panel-label">${module.category}</p>
      <h3>${module.name}</h3>
      <p class="module-copy">${module.summary}</p>
      <div class="section-header">
        <span class="badge">${module.status}</span>
        <span class="small">${dependencyText}</span>
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
      <span class="small">${health.environment} � ${health.executionMode}</span>
    `;
  }

  if (stats) {
    const readyProjects = projects.projects.filter(
      (project) => project.status === "ready-for-execution"
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
        <p class="small">Projects that can drive dry-run execution immediately.</p>
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

  const [projectResponse, summaryResponse, modulesResponse] = await Promise.all(
    [
      fetchJson(`/api/projects/${encodeURIComponent(projectId)}`),
      fetchJson(`/api/projects/${encodeURIComponent(projectId)}/summary`),
      fetchJson(`/api/projects/${encodeURIComponent(projectId)}/modules`)
    ]
  );

  const hero = document.getElementById("project-detail-hero");
  const summary = document.getElementById("project-detail-summary");
  const execution = document.getElementById("project-detail-execution");
  const modules = document.getElementById("project-detail-modules");
  const project = projectResponse.project;
  const projectSummary = summaryResponse.summary;

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

  if (execution) {
    execution.innerHTML = `
      <div class="kv">
        <div class="kv-item"><span>Dry run enabled</span><strong>${project.executionContext.dryRunEnabled ? "yes" : "no"}</strong></div>
        <div class="kv-item"><span>Validation</span><strong>${project.executionContext.validationStatus}</strong></div>
        <div class="kv-item"><span>Last execution</span><strong>${project.executionContext.lastExecutionSummary.status}</strong></div>
        <div class="kv-item"><span>Hubs in scope</span><strong>${project.hubspotScope.hubsInScope.join(", ")}</strong></div>
      </div>
    `;
  }

  if (modules) {
    modules.innerHTML = modulesResponse.modules
      .map(renderProjectModuleCard)
      .join("");
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

    if (page === "settings") {
      await initSettingsPage();
    }
  } catch (error) {
    console.error(error);
  }
}

void main();
