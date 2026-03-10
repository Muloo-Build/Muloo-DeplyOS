#!/usr/bin/env node

import path from "node:path";

import { loadCliConfig } from "@muloo/config";
import { createLogger, formatDryRunSummary } from "@muloo/core";
import { executePropertyDryRun } from "@muloo/executor";
import {
  createPropertySpecFromProject,
  loadProjectById,
  loadValidatedOnboardingSpec,
  writeJsonArtifact
} from "@muloo/file-system";
import { HubSpotClient } from "@muloo/hubspot-client";

interface CliArgs {
  specPath?: string;
  projectId?: string;
  moduleId?: string;
}

function readFlagValue(argv: string[], flag: string): string | undefined {
  const index = argv.findIndex((value) => value === flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

function parseArgs(argv: string[]): CliArgs {
  if (argv.includes("--apply") || argv.includes("--live")) {
    throw new Error(
      "Live execution is blocked in this phase. Remove --apply/--live and run a dry run."
    );
  }

  const projectId = readFlagValue(argv, "--project");
  const moduleId = readFlagValue(argv, "--module");
  const specPath = readFlagValue(argv, "--spec");
  const positionals = argv.filter((value, index) => {
    const previous = argv[index - 1];
    return (
      !value.startsWith("--") &&
      previous !== "--spec" &&
      previous !== "--project" &&
      previous !== "--module"
    );
  });

  if (projectId || moduleId) {
    if (!projectId || !moduleId) {
      throw new Error("Project mode requires both --project and --module.");
    }

    if (specPath || positionals[0]) {
      throw new Error("Use either --spec or --project/--module, not both.");
    }

    return {
      projectId,
      moduleId
    };
  }

  const resolvedSpecPath = specPath ?? positionals[0];
  if (!resolvedSpecPath) {
    throw new Error(
      "Missing input. Use --spec <path> or --project <id> --module <module-key>."
    );
  }

  return { specPath: resolvedSpecPath };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const logger = createLogger({ service: "muloo-cli" });
  const config = loadCliConfig({ cwd });

  const spec = args.specPath
    ? await loadValidatedOnboardingSpec(args.specPath)
    : createPropertySpecFromProject({
        project: await loadProjectById(args.projectId as string),
        moduleId: args.moduleId as string
      });

  const hubSpotClientOptions: {
    accessToken: string;
    logger: typeof logger;
    baseUrl?: string;
  } = {
    accessToken: config.hubspotAccessToken,
    logger
  };

  if (config.integrations.hubspotBaseUrl) {
    hubSpotClientOptions.baseUrl = config.integrations.hubspotBaseUrl;
  }

  const hubSpotClient = new HubSpotClient(hubSpotClientOptions);

  const result = await executePropertyDryRun({
    artifactDir: path.resolve(cwd, config.artifactDir),
    hubSpotClient,
    logger,
    spec,
    specPath: spec.absolutePath,
    writeArtifact: writeJsonArtifact
  });

  if (args.projectId && args.moduleId) {
    process.stdout.write(
      `Project: ${args.projectId}\nModule: ${args.moduleId}\n`
    );
  }

  process.stdout.write(`${formatDryRunSummary(result)}\n`);
  process.stdout.write(`Artifact: ${result.artifactPath}\n`);
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown CLI failure";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
