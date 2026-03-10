import type { Logger } from "./types";

interface LoggerOptions {
  service: string;
}

function write(level: "INFO" | "WARN" | "ERROR", service: string, message: string, context?: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
    context: context ?? {}
  };

  const line = `${JSON.stringify(entry)}\n`;
  const stream = level === "ERROR" ? process.stderr : process.stdout;
  stream.write(line);
}

export function createLogger(options: LoggerOptions): Logger {
  return {
    info(message, context) {
      write("INFO", options.service, message, context);
    },
    warn(message, context) {
      write("WARN", options.service, message, context);
    },
    error(message, context) {
      write("ERROR", options.service, message, context);
    }
  };
}
