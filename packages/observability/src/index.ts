import pino, { type DestinationStream, type Logger, type LoggerOptions } from "pino";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "headers.authorization",
  "headers.cookie",
  "password",
  "token",
  "secret",
  "*.password",
  "*.token",
  "*.secret",
] as const;

export function createLoggerOptions(
  service: string,
  level = process.env.LOG_LEVEL ?? "info",
  options: LoggerOptions = {},
): LoggerOptions {
  return {
    name: service,
    level,
    base: {
      service,
      appEnv: process.env.APP_ENV ?? "local",
    },
    redact: {
      paths: [...REDACT_PATHS],
      censor: "[REDACTED]",
    },
    ...options,
  };
}

export function createLogger(
  service: string,
  level = process.env.LOG_LEVEL ?? "info",
  options: LoggerOptions = {},
  destination?: DestinationStream,
): Logger {
  return pino(createLoggerOptions(service, level, options), destination);
}
