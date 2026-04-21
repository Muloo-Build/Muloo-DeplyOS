import net from "node:net";

const host = process.argv[2];
const port = Number(process.argv[3]);
const timeoutMs = Number(process.argv[4] ?? 30000);
const startedAt = Date.now();

if (!host || !Number.isInteger(port)) {
  console.error(
    "Usage: node scripts/wait-for-tcp.mjs <host> <port> [timeoutMs]"
  );
  process.exit(1);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function canConnect() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

while (Date.now() - startedAt < timeoutMs) {
  if (await canConnect()) {
    console.log(`TCP ready on ${host}:${port}`);
    process.exit(0);
  }

  await delay(500);
}

console.error(`Timed out waiting for TCP on ${host}:${port}`);
process.exit(1);
