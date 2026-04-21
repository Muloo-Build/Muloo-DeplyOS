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
    `Refusing to seed non-local database host ${parsedDatabaseUrl.hostname}.`
  );
  process.exit(1);
}

const child = spawn(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["exec", "tsx", "apps/api/prisma/seed-retainers.ts"],
  {
    cwd: rootDirectory,
    stdio: "inherit",
    env: {
      ...envFromFile,
      ...process.env,
      DATABASE_URL: databaseUrl
    }
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
