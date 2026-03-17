const { spawn } = require("node:child_process");

const mode = process.argv[2] === "dev" ? "dev" : "start";
const nextCli = require.resolve("next/dist/bin/next");
const publicPort = process.env.PORT || "3000";
const publicHost =
  process.env.HOST ||
  process.env.HOSTNAME ||
  (mode === "start" ? "0.0.0.0" : "localhost");

const children = [];
let shuttingDown = false;

function launch(name, command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    ...options
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    for (const currentChild of children) {
      if (currentChild !== child && !currentChild.killed) {
        currentChild.kill("SIGTERM");
      }
    }

    if (signal) {
      process.stderr.write(`${name} exited with signal ${signal}\n`);
      process.exit(1);
      return;
    }

    process.exit(code ?? 1);
  });

  children.push(child);
  return child;
}

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

launch("web", process.execPath, [nextCli, mode, "-H", publicHost, "-p", publicPort], {
  cwd: "apps/web",
  env: {
    ...process.env,
    PORT: publicPort,
    HOST: publicHost,
    HOSTNAME: publicHost
  }
});

function runCommand(name, command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options
    });

    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          signal
            ? `${name} exited with signal ${signal}`
            : `${name} exited with code ${code ?? 1}`
        )
      );
    });
  });
}

async function startApi() {
  const apiPort = process.env.API_PORT || "3001";
  const apiEnv = {
    ...process.env,
    API_PORT: apiPort,
    API_BASE_URL: process.env.API_BASE_URL || `http://localhost:${apiPort}`
  };
  const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

  if (mode === "dev") {
    await runCommand(
      "prisma generate",
      npxCommand,
      ["prisma", "generate"],
      {
        cwd: "apps/api",
        env: apiEnv
      }
    );

    await runCommand(
      "typescript build",
      process.execPath,
      ["node_modules/typescript/lib/tsc.js", "-b", "tsconfig.json"],
      {
        env: apiEnv
      }
    );
  }

  if (mode === "start") {
    await runCommand(
      "prisma migrate deploy",
      npxCommand,
      ["prisma", "migrate", "deploy"],
      {
        cwd: "apps/api",
        env: apiEnv
      }
    );
  }

  launch("api", process.execPath, ["apps/api/dist/index.js"], {
    env: apiEnv
  });
}

startApi().catch((error) => {
  shutdown("SIGTERM");
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
