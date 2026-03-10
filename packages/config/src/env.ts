import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

const envSchema = z.object({
  HUBSPOT_PRIVATE_APP_TOKEN: z.string().min(1, "HUBSPOT_PRIVATE_APP_TOKEN is required."),
  MULOO_EXECUTION_MODE: z.literal("dry-run").default("dry-run"),
  MULOO_ALLOW_DESTRUCTIVE_ACTIONS: z.enum(["false"]).default("false"),
  MULOO_ARTIFACT_DIR: z.string().min(1).default("artifacts")
});

export interface RuntimeConfig {
  hubspotPrivateAppToken: string;
  executionMode: "dry-run";
  allowDestructiveActions: false;
  artifactDir: string;
}

interface LoadRuntimeConfigOptions {
  cwd: string;
}

function parseDotEnv(content: string): Record<string, string> {
  return content.split(/\r?\n/).reduce<Record<string, string>>((accumulator, line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      return accumulator;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) {
      return accumulator;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    accumulator[key] = value;
    return accumulator;
  }, {});
}

export function loadRuntimeConfig(options: LoadRuntimeConfigOptions): RuntimeConfig {
  const envPath = path.join(options.cwd, ".env");
  const fileValues = fs.existsSync(envPath) ? parseDotEnv(fs.readFileSync(envPath, "utf8")) : {};
  const parsed = envSchema.parse({
    ...fileValues,
    ...process.env
  });

  return {
    hubspotPrivateAppToken: parsed.HUBSPOT_PRIVATE_APP_TOKEN,
    executionMode: parsed.MULOO_EXECUTION_MODE,
    allowDestructiveActions: false,
    artifactDir: parsed.MULOO_ARTIFACT_DIR
  };
}
