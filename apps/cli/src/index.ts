#!/usr/bin/env node

import path from "node:path";

import { loadRuntimeConfig } from "@muloo/config";
import { createLogger, formatDryRunSummary } from "@muloo/core";
import { executePropertyDryRun } from "@muloo/executor";
import { loadValidatedOnboardingSpec, writeJsonArtifact } from "@muloo/file-system";
import { HubSpotClient } from "@muloo/hubspot-client";

interface CliArgs {
  specPath: string;
}

function parseArgs(argv: string[]): CliArgs {
  if (argv.includes("--apply") || argv.includes("--live")) {
    throw new Error("Live execution is blocked in this phase. Remove --apply/--live and run a dry run.");
  }

  const specIndex = argv.findIndex((value) => value === "--spec");
  const specPath = specIndex >= 0 ? argv[specIndex + 1] : argv[0];

  if (!specPath) {
    throw new Error("Missing spec path. Usage: muloo-deploy --spec specs/examples/contact-properties.json");
  }

  return { specPath };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const logger = createLogger({ service: "muloo-cli" });
  const config = loadRuntimeConfig({ cwd });
  const spec = await loadValidatedOnboardingSpec(args.specPath);

  const hubSpotClient = new HubSpotClient({
    accessToken: config.hubspotPrivateAppToken,
    logger
  });

  const result = await executePropertyDryRun({
    artifactDir: path.resolve(cwd, config.artifactDir),
    hubSpotClient,
    logger,
    spec,
    specPath: spec.absolutePath,
    writeArtifact: writeJsonArtifact
  });

  process.stdout.write(`${formatDryRunSummary(result)}\n`);
  process.stdout.write(`Artifact: ${result.artifactPath}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown CLI failure";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
