import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { getIntegrationStatus, type BaseConfig } from "@muloo/config";
import {
  loadAllProjectSummaries,
  loadProjectById,
  loadProjectSummaryById,
  summarizeProjectModules
} from "@muloo/file-system";
import { moduleCatalog } from "@muloo/shared";

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const staticRoutes: Record<string, string> = {
  "/": "index.html",
  "/modules": "modules.html",
  "/projects": "projects.html",
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
  resource?: "modules" | "summary";
} | null {
  const match = /^\/api\/projects\/([^/]+?)(?:\/(modules|summary))?$/.exec(
    pathname
  );

  if (!match || !match[1]) {
    return null;
  }

  const projectId = decodeURIComponent(match[1]);
  const resource = match[2];
  const normalizedResource =
    resource === "modules" || resource === "summary" ? resource : undefined;

  return normalizedResource
    ? { projectId, resource: normalizedResource }
    : { projectId };
}

export function createAppServer(config: BaseConfig): http.Server {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", config.appBaseUrl);

    try {
      if (url.pathname === "/api/health") {
        return sendJson(response, 200, {
          status: "ok",
          service: "muloo-deploy-os-api",
          timestamp: new Date().toISOString(),
          environment: config.nodeEnv,
          executionMode: config.executionMode,
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
          integrationStatus: getIntegrationStatus(config)
        });
      }

      if (url.pathname === "/api/projects") {
        return sendJson(response, 200, {
          projects: await loadAllProjectSummaries()
        });
      }

      const projectRoute = matchProjectRoute(url.pathname);
      if (projectRoute) {
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
      const statusCode = message.includes("was not found") ? 404 : 500;
      sendJson(response, statusCode, { error: message });
    }
  });
}
