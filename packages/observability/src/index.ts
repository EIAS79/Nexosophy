import pino, { type Logger, type LoggerOptions } from "pino";

export function createLogger(
  service: string,
  level = process.env.LOG_LEVEL ?? "info",
  options: LoggerOptions = {},
): Logger {
  return pino({
    name: service,
    level,
    base: {
      service,
      appEnv: process.env.APP_ENV ?? "local",
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "headers.authorization",
        "headers.cookie",
      ],
      censor: "[REDACTED]",
    },
    ...options,
  });
}
