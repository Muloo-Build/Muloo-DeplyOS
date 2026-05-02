import { loadApiConfig } from "@muloo/config";

import { createAppServer } from "./app";
import {
  ensureDeliveryTemplatesSeeded,
  ensureWorkbookTemplatesSeeded
} from "./server";

async function main(): Promise<void> {
  const config = loadApiConfig({ cwd: process.cwd() });

  // T3 Step A — workspace-boot seed: make sure the default workbook +
  // delivery templates exist before we accept traffic. Both functions
  // upsert by stable identity (slug / title) so it's safe to run on every
  // boot. Failures here must NOT prevent the API from coming up — log and
  // continue, the lazy seed in loadWorkbookTemplates / loadDeliveryTemplates
  // will retry on the next request.
  await Promise.allSettled([
    ensureDeliveryTemplatesSeeded(),
    ensureWorkbookTemplatesSeeded()
  ]).then((results) => {
    for (const result of results) {
      if (result.status === "rejected") {
        const message =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        process.stderr.write(`Boot template seed warning: ${message}\n`);
      }
    }
  });

  const server = createAppServer(config);

  await new Promise<void>((resolve) => {
    server.listen(config.port, () => {
      process.stdout.write(
        `Muloo Deploy OS API listening on ${config.appBaseUrl}\n`
      );
      resolve();
    });
  });
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown API failure";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
