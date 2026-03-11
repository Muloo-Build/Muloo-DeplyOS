import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { getIntegrationStatus, type BaseConfig } from "@muloo/config";
import {
  createProject,
  createProjectFromTemplate,
  loadAllExecutionRecords,
  loadAllProjectSummaries,
  loadAllTemplates,
  loadExecutionById,
  loadExecutionSteps,
  loadProjectById,
  loadProjectDesignById,
  loadProjectExecutions,
  loadProjectModuleDetail,
  loadProjectReadinessById,
  loadProjectSummaryById,
  loadTemplateById,
  summarizeProjectModules,
  summarizeProject,
  updateProjectLifecycleDesign,
  updateProjectMetadata,
  updateProjectPipelinesDesign,
  updateProjectPropertiesDesign,
  updateProjectScope,
  validateAllProjects,
  validateProjectById
} from "@muloo/file-system";
import { moduleCatalog } from "@muloo/shared";
import {
  createProjectFromTemplateRequestSchema,
  createProjectRequestSchema,
  updateProjectLifecycleDesignRequestSchema,
  updateProjectMetadataRequestSchema,
  updateProjectPipelinesDesignRequestSchema,
  updateProjectPropertiesDesignRequestSchema,
  updateProjectScopeRequestSchema
} from "@muloo/shared";
import { ZodError } from "zod";

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const staticRoutes: Record<string, string> = {
  "/": "index.html",
  "/execution": "execution.html",
  "/module": "module.html",
  "/modules": "modules.html",
  "/guide": "guide.html",
  "/runs": "runs.html",
  "/project/design/lifecycle": "project-design-lifecycle.html",
  "/project/design/pipelines": "project-design-pipelines.html",
  "/project/design/properties": "project-design-properties.html",
  "/projects/new": "project-new.html",
  "/projects": "projects.html",
  "/templates": "templates.html",
  "/project": "project.html",
  "/settings": "settings.html",
  "/assets/styles.css": path.join("assets", "styles.css"),
  "/assets/app.js": path.join("assets", "app.js")
};

function sendJson(
  response: http.ServerResponse,
  statusCode: number,
  payload: unknown
): void {
  response.writeHead(statusCode, { "Content-Type": contentTypes[".json"] });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
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

async function serveStaticAsset(
  response: http.ServerResponse,
  assetPath: string
): Promise<void> {
  const absolutePath = path.resolve(process.cwd(), "apps", "web", assetPath);
  const extension = path.extname(absolutePath);
  const content = await readFile(absolutePath);

  response.writeHead(200, {
    "Content-Type": contentTypes[extension] ?? "application/octet-stream"
  });
  response.end(content);
}

function matchProjectRoute(pathname: string): {
  projectId: string;
  resource?:
    | "modules"
    | "summary"
    | "validation"
    | "readiness"
    | "executions"
    | "scope";
} | null {
  const match =
    /^\/api\/projects\/([^/]+?)(?:\/(modules|summary|validation|readiness|executions|scope))?$/.exec(
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
    resource === "scope"
      ? resource
      : undefined;

  return normalizedResource
    ? { projectId, resource: normalizedResource }
    : { projectId };
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

export function createAppServer(config: BaseConfig): http.Server {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", config.appBaseUrl);

    try {
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
        return sendJson(response, 200, {
          status: "ok",
          service: "muloo-deploy-os-api",
          timestamp: new Date().toISOString(),
          environment: config.nodeEnv,
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

      if (url.pathname === "/api/runs") {
        return sendJson(response, 200, {
          runs: await loadAllExecutionRecords()
        });
      }

      if (url.pathname === "/api/projects") {
        if (request.method === "POST") {
          const payload = createProjectRequestSchema.parse(
            await readJsonBody(request)
          );
          const project = await createProject(payload);
          return sendJson(response, 201, {
            project,
            summary: await summarizeProject(project)
          });
        }

        return sendJson(response, 200, {
          projects: await loadAllProjectSummaries()
        });
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

        return sendJson(response, 200, {
          project: await loadProjectById(projectRoute.projectId)
        });
      }

      const assetPath = staticRoutes[url.pathname];
      if (assetPath) {
        await serveStaticAsset(response, assetPath);
        return;
      }

      if (url.pathname.startsWith("/api/")) {
        return sendJson(response, 404, { error: "Not Found" });
      }

      await serveStaticAsset(response, "index.html");
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
