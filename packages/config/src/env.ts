import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1).optional(),
  HUBSPOT_ACCESS_TOKEN: z.string().min(1).optional(),
  HUBSPOT_PRIVATE_APP_TOKEN: z.string().min(1).optional(),
  HUBSPOT_PORTAL_ID: z.string().min(1).optional(),
  HUBSPOT_BASE_URL: z.string().url().optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  MULOO_EXECUTION_MODE: z.enum(["dry-run", "guarded-apply"]).default("dry-run"),
  MULOO_ALLOW_DESTRUCTIVE_ACTIONS: z.enum(["false"]).default("false"),
  MULOO_ARTIFACT_DIR: z.string().min(1).default("artifacts")
});

export interface BaseConfig {
  nodeEnv: "development" | "test" | "production";
  port: number;
  appBaseUrl: string;
  artifactDir: string;
  executionMode: "dry-run" | "guarded-apply";
  allowDestructiveActions: false;
  applyEnabled: boolean;
  integrations: {
    databaseUrl?: string;
    hubspotAccessToken?: string;
    hubspotPortalId?: string;
    hubspotBaseUrl?: string;
    openAiApiKey?: string;
  };
}

export interface CliConfig extends BaseConfig {
  hubspotAccessToken: string;
}

interface LoadConfigOptions {
  cwd: string;
}

const apiEnvironmentSchema = environmentSchema.extend({
  API_PORT: z.coerce.number().int().positive().optional(),
  API_BASE_URL: z.string().url().optional()
});

function parseDotEnv(content: string): Record<string, string> {
  return content
    .split(/\r?\n/)
    .reduce<Record<string, string>>((accumulator, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        return accumulator;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex < 0) {
        return accumulator;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed
        .slice(separatorIndex + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");
      accumulator[key] = value;
      return accumulator;
    }, {});
}

function readEnvironmentFile(cwd: string): Record<string, string> {
  const envPath = path.join(cwd, ".env");
  return fs.existsSync(envPath)
    ? parseDotEnv(fs.readFileSync(envPath, "utf8"))
    : {};
}

function readResolvedEnvironment(cwd: string): Record<string, string> {
  return {
    ...readEnvironmentFile(cwd),
    ...process.env
  };
}

export function loadBaseConfig(options: LoadConfigOptions): BaseConfig {
  const parsed = environmentSchema.parse(readResolvedEnvironment(options.cwd));

  const hubspotAccessToken =
    parsed.HUBSPOT_ACCESS_TOKEN ?? parsed.HUBSPOT_PRIVATE_APP_TOKEN;
  const integrations: BaseConfig["integrations"] = {};

  if (parsed.DATABASE_URL !== undefined) {
    integrations.databaseUrl = parsed.DATABASE_URL;
  }

  if (hubspotAccessToken !== undefined) {
    integrations.hubspotAccessToken = hubspotAccessToken;
  }

  if (parsed.HUBSPOT_PORTAL_ID !== undefined) {
    integrations.hubspotPortalId = parsed.HUBSPOT_PORTAL_ID;
  }

  if (parsed.HUBSPOT_BASE_URL !== undefined) {
    integrations.hubspotBaseUrl = parsed.HUBSPOT_BASE_URL;
  }

  if (parsed.OPENAI_API_KEY !== undefined) {
    integrations.openAiApiKey = parsed.OPENAI_API_KEY;
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    appBaseUrl: parsed.APP_BASE_URL,
    artifactDir: parsed.MULOO_ARTIFACT_DIR,
    executionMode: parsed.MULOO_EXECUTION_MODE,
    allowDestructiveActions: false,
    applyEnabled: parsed.MULOO_EXECUTION_MODE === "guarded-apply",
    integrations
  };
}

export function loadApiConfig(options: LoadConfigOptions): BaseConfig {
  const config = loadBaseConfig(options);
  const parsed = apiEnvironmentSchema.parse(readResolvedEnvironment(options.cwd));
  const port = parsed.API_PORT ?? 3001;

  return {
    ...config,
    port,
    appBaseUrl: parsed.API_BASE_URL ?? `http://localhost:${port}`
  };
}

export function loadCliConfig(options: LoadConfigOptions): CliConfig {
  const config = loadBaseConfig(options);

  if (!config.integrations.hubspotAccessToken) {
    throw new Error(
      "HUBSPOT_ACCESS_TOKEN or HUBSPOT_PRIVATE_APP_TOKEN is required for execution workflows."
    );
  }

  return {
    ...config,
    hubspotAccessToken: config.integrations.hubspotAccessToken
  };
}

export function getIntegrationStatus(
  config: BaseConfig
): Record<string, boolean> {
  return {
    appBaseUrl: config.appBaseUrl.length > 0,
    databaseUrl: Boolean(config.integrations.databaseUrl),
    hubspotAccessToken: Boolean(config.integrations.hubspotAccessToken),
    hubspotPortalId: Boolean(config.integrations.hubspotPortalId),
    hubspotBaseUrl: Boolean(config.integrations.hubspotBaseUrl),
    openAiApiKey: Boolean(config.integrations.openAiApiKey)
  };
}
