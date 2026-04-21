import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

function parseDotEnv(content) {
  return content.split(/\r?\n/).reduce((accumulator, line) => {
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

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} terminated with signal ${signal}`));
        return;
      }

      if ((code ?? 0) !== 0) {
        reject(new Error(`${command} exited with code ${code}`));
        return;
      }

      resolve();
    });
  });
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");
const envPath = path.join(rootDirectory, ".env");
const envFromFile = fs.existsSync(envPath)
  ? parseDotEnv(fs.readFileSync(envPath, "utf8"))
  : {};

const databaseUrl =
  process.env.DATABASE_URL ??
  envFromFile.DATABASE_URL ??
  "postgresql://smoke:smoke@127.0.0.1:5432/muloo_smoke";

const parsedDatabaseUrl = new URL(databaseUrl);
const localHosts = new Set(["127.0.0.1", "localhost"]);

if (!localHosts.has(parsedDatabaseUrl.hostname)) {
  console.error(
    `Refusing to reset non-local database host ${parsedDatabaseUrl.hostname}.`
  );
  process.exit(1);
}

const env = {
  ...envFromFile,
  ...process.env,
  DATABASE_URL: databaseUrl
};

await run("docker", ["compose", "down", "-v"], {
  cwd: rootDirectory,
  env
});
await run("docker", ["compose", "up", "-d", "postgres"], {
  cwd: rootDirectory,
  env
});
await run("node", ["scripts/wait-for-tcp.mjs", "127.0.0.1", "5432", "60000"], {
  cwd: rootDirectory,
  env
});
await run(
  "node",
  [
    "scripts/run-with-root-env.mjs",
    "npx",
    "prisma",
    "migrate",
    "deploy",
    "--schema",
    "apps/api/prisma/schema.prisma"
  ],
  {
    cwd: rootDirectory,
    env
  }
);
await run("node", ["scripts/run-seed-retainers.mjs"], {
  cwd: rootDirectory,
  env
});
