import { loadApiConfig } from "@muloo/config";

import { createAppServer } from "./server";

async function main(): Promise<void> {
  const config = loadApiConfig({ cwd: process.cwd() });
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
