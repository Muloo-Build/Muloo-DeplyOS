#!/usr/bin/env node

import path from "node:path";

import { loadCliConfig } from "@muloo/config";
import { createLogger, formatDryRunSummary } from "@muloo/core";
import {
  executePropertyDryRun,
  getModuleExecutionContract
} from "@muloo/executor";
import {
  completeExecutionJobRecord,
  createExecutionJobRecord,
  createExecutionTimeline,
  failExecutionJobRecord,
  loadProjectById,
  loadValidatedOnboardingSpec,
  markExecutionStepFailed,
  markExecutionStepRunning,
  markExecutionStepSucceeded,
  replaceExecutionSteps,
  validateProjectById,
  writeJsonArtifact
} from "@muloo/file-system";
import { HubSpotClient } from "@muloo/hubspot-client";

interface ExecutionOutputShape {
  artifactPath?: string | undefined;
  summaryText?: string | undefined;
  specPath?: string | undefined;
}

interface CliArgs {
  specPath?: string;
  projectId?: string;
  moduleId?: string;
  mode: "dry-run" | "apply";
  allowCreateOnly: boolean;
}

function readFlagValue(argv: string[], flag: string): string | undefined {
  const index = argv.findIndex((value) => value === flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

function parseArgs(argv: string[]): CliArgs {
  if (argv.includes("--live")) {
    throw new Error(
      "Use --apply for the guarded apply path. --live is not supported."
    );
  }

  const mode: CliArgs["mode"] = argv.includes("--apply") ? "apply" : "dry-run";
  const allowCreateOnly = argv.includes("--allow-create-only");
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
      moduleId,
      mode,
      allowCreateOnly
    };
  }

  if (mode === "apply") {
    throw new Error(
      "Guarded apply is only available in project/module mode for the properties module."
    );
  }

  const resolvedSpecPath = specPath ?? positionals[0];
  if (!resolvedSpecPath) {
    throw new Error(
      "Missing input. Use --spec <path> or --project <id> --module <module-key>."
    );
  }

  return {
    specPath: resolvedSpecPath,
    mode,
    allowCreateOnly
  };
}

function ensureApplyFlags(args: CliArgs, applyEnabled: boolean): void {
  if (args.mode !== "apply") {
    return;
  }

  if (!applyEnabled) {
    throw new Error(
      "Guarded apply is disabled. Set MULOO_EXECUTION_MODE=guarded-apply and rerun with explicit apply flags."
    );
  }

  if (!args.allowCreateOnly) {
    throw new Error(
      "Guarded apply requires --allow-create-only to confirm the create-only contact-property scope."
    );
  }
}

function formatExecutionSummary(result: {
  mode: "dry-run" | "apply";
  summary: string;
  metrics: {
    requestedOperationCount?: number | undefined;
    executedOperationCount?: number | undefined;
    blockedOperationCount?: number | undefined;
  };
}): string {
  if (result.mode === "apply") {
    return [
      result.summary,
      `Requested operations: ${result.metrics.requestedOperationCount ?? 0}`,
      `Executed operations: ${result.metrics.executedOperationCount ?? 0}`,
      `Blocked operations: ${result.metrics.blockedOperationCount ?? 0}`
    ].join("\n");
  }

  return result.summary;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const logger = createLogger({ service: "muloo-cli" });
  const config = loadCliConfig({ cwd });
  const projectMode = Boolean(args.projectId && args.moduleId);

  ensureApplyFlags(args, config.applyEnabled);

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

  if (!projectMode) {
    const spec = await loadValidatedOnboardingSpec(args.specPath as string);
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
    return;
  }

  const contract = getModuleExecutionContract(args.moduleId as string);

  if (!contract) {
    throw new Error(
      `Project module '${args.moduleId}' is not connected to an execution contract.`
    );
  }

  if (args.mode === "dry-run") {
    if (
      !contract.dryRun ||
      !contract.definition.supportedModes.includes("dry-run")
    ) {
      throw new Error(
        `Project module '${args.moduleId}' does not support contract-based dry runs yet.`
      );
    }
  } else {
    if (
      !contract.apply ||
      !contract.definition.handlers.apply ||
      !contract.definition.supportedModes.includes("apply") ||
      !contract.definition.applyGuardrails?.enabled
    ) {
      throw new Error(
        `Project module '${args.moduleId}' does not support guarded apply execution.`
      );
    }
  }

  const executionRecord = await createExecutionJobRecord({
    projectId: args.projectId as string,
    moduleKey: args.moduleId as string,
    executionType: "project-module",
    mode: args.mode,
    triggeredBy: process.env.USERNAME ?? process.env.USER ?? "operator",
    environment: config.nodeEnv,
    specPath: `project:${args.projectId}:${args.moduleId}`
  });

  let steps = createExecutionTimeline(
    executionRecord.id,
    contract.definition,
    args.mode
  );
  await replaceExecutionSteps({
    executionId: executionRecord.id,
    steps
  });

  async function persistStepState(): Promise<void> {
    await replaceExecutionSteps({
      executionId: executionRecord.id,
      steps
    });
  }

  async function startStep(stepKey: string, summary?: string): Promise<void> {
    steps = markExecutionStepRunning(steps, stepKey, summary);
    await persistStepState();
  }

  async function completeStep(
    stepKey: string,
    params?: {
      summary?: string;
      warnings?: string[];
      output?: ExecutionOutputShape;
    }
  ): Promise<void> {
    steps = markExecutionStepSucceeded(steps, stepKey, params);
    await persistStepState();
  }

  async function failStep(
    stepKey: string,
    error: string,
    summary?: string
  ): Promise<void> {
    steps = markExecutionStepFailed(
      steps,
      stepKey,
      summary
        ? {
            error,
            summary
          }
        : {
            error
          }
    );
    await persistStepState();
  }

  let activeStepKey: string | undefined = "load-project";

  try {
    await startStep("load-project", "Loading project blueprint from disk.");
    const project = await loadProjectById(args.projectId as string);
    const modulePlan = project.modulePlanning.find(
      (module) => module.moduleId === args.moduleId
    );

    if (!modulePlan) {
      throw new Error(
        `Project '${project.id}' does not include module '${args.moduleId}'.`
      );
    }

    await completeStep("load-project", {
      summary: `Loaded project '${project.name}'.`
    });

    activeStepKey = "validate-project";
    await startStep(
      "validate-project",
      "Evaluating project and module readiness."
    );
    const projectValidation = await validateProjectById(
      args.projectId as string
    );
    const moduleValidation = projectValidation.modules.find(
      (module) => module.moduleId === args.moduleId
    );

    if (!moduleValidation) {
      throw new Error(
        `Project '${project.id}' does not include module '${args.moduleId}'.`
      );
    }

    await completeStep("validate-project", {
      summary: `Module readiness is '${moduleValidation.readiness}' with validation status '${moduleValidation.status}'.`
    });

    if (args.mode === "apply" && moduleValidation.readiness !== "ready") {
      throw new Error(
        `Guarded apply is blocked because module '${args.moduleId}' is not ready. Review project validation and readiness before applying.`
      );
    }

    activeStepKey = "resolve-module-input";
    await startStep(
      "resolve-module-input",
      "Resolving module-specific input from the project blueprint."
    );

    if (!contract.resolveInput) {
      throw new Error(
        `Project module '${args.moduleId}' does not define an input resolver.`
      );
    }

    const resolvedInput = contract.resolveInput({
      project,
      modulePlan
    });

    const resolvedSpecPath =
      typeof resolvedInput === "object" &&
      resolvedInput !== null &&
      "absolutePath" in resolvedInput
        ? String(resolvedInput.absolutePath)
        : undefined;

    await completeStep(
      "resolve-module-input",
      resolvedSpecPath
        ? {
            summary: `Resolved module input from '${project.id}'.`,
            output: {
              specPath: resolvedSpecPath
            }
          }
        : {
            summary: `Resolved module input from '${project.id}'.`
          }
    );
    activeStepKey = undefined;

    const readinessWarnings = [
      ...moduleValidation.blockers.map((blocker) => blocker.message),
      ...moduleValidation.warnings.map((warning) => warning.message)
    ];

    const result =
      args.mode === "apply"
        ? await contract.apply!({
            project,
            modulePlan,
            projectValidation,
            moduleValidation,
            logger,
            artifactDir: path.resolve(cwd, config.artifactDir),
            resolvedInput,
            stepReporter: {
              start: startStep,
              complete: completeStep,
              fail: (stepKey, params) =>
                failStep(stepKey, params.error, params.summary)
            },
            hubSpotClient,
            writeArtifact: writeJsonArtifact
          })
        : await contract.dryRun!({
            project,
            modulePlan,
            projectValidation,
            moduleValidation,
            logger,
            artifactDir: path.resolve(cwd, config.artifactDir),
            resolvedInput,
            stepReporter: {
              start: startStep,
              complete: completeStep,
              fail: (stepKey, params) =>
                failStep(stepKey, params.error, params.summary)
            },
            hubSpotClient,
            writeArtifact: writeJsonArtifact
          });

    activeStepKey = "persist-execution-record";
    await startStep(
      "persist-execution-record",
      "Persisting execution record summary."
    );
    steps = markExecutionStepSucceeded(steps, "persist-execution-record", {
      summary: "Execution record updated with module result.",
      output: result.output
    });

    if (result.status === "succeeded") {
      await completeExecutionJobRecord({
        executionId: executionRecord.id,
        summaryMetrics: result.metrics,
        warnings: [...readinessWarnings, ...result.warnings],
        output: result.output,
        operations: result.operations,
        steps,
        result
      });
      activeStepKey = undefined;
    } else {
      await failExecutionJobRecord({
        executionId: executionRecord.id,
        summaryMetrics: result.metrics,
        warnings: [...readinessWarnings, ...result.warnings],
        errors:
          result.errors.length > 0
            ? result.errors
            : ["Execution completed without success."],
        output: result.output,
        operations: result.operations,
        steps,
        result
      });
      activeStepKey = undefined;
    }

    process.stdout.write(
      `Project: ${args.projectId}\nModule: ${args.moduleId}\nMode: ${args.mode}\n`
    );
    process.stdout.write(`${formatExecutionSummary(result)}\n`);
    if (result.output.artifactPath) {
      process.stdout.write(`Artifact: ${result.output.artifactPath}\n`);
    }

    if (result.status !== "succeeded") {
      process.exitCode = 1;
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown execution failure";

    if (activeStepKey) {
      await failStep(activeStepKey, message, "Execution failed.");
    }
    await failExecutionJobRecord({
      executionId: executionRecord.id,
      errors: [message],
      steps
    });

    throw error;
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown CLI failure";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
