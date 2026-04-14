/**
 * Structured audit logger.
 * - Never logs the raw API key.
 * - Supports PII redaction.
 * - Used for audit logging of tool invocations.
 */

import { getConfig, LogLevel } from "../config/index.js";
import { redactEmail } from "./redaction.js";

type LogRecord = Record<string, unknown>;

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  try {
    const config = getConfig();
    return LOG_LEVELS[level] >= LOG_LEVELS[config.logging.level];
  } catch {
    // Config not yet loaded (e.g. during early startup or tests). Default: log warn+.
    return LOG_LEVELS[level] >= LOG_LEVELS["warn"];
  }
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  const lowerKey = key.toLowerCase();

  // Never expose the API key
  if (lowerKey.includes("apikey") || lowerKey.includes("api_key") || lowerKey === "authorization") {
    return "[REDACTED]";
  }

  let redactPii = true; // safe default
  try {
    redactPii = getConfig().logging.redactPii;
  } catch { /* config not loaded */ }
  if (redactPii) {
    if (typeof value === "string" && (lowerKey.includes("email") || lowerKey.includes("to") || lowerKey.includes("from") || lowerKey.includes("bcc") || lowerKey.includes("cc"))) {
      return redactEmail(value);
    }
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return sanitizeRecord(value as LogRecord);
  }

  if (Array.isArray(value)) {
    return value.map((item, i) => sanitizeValue(String(i), item));
  }

  return value;
}

function sanitizeRecord(record: LogRecord): LogRecord {
  const result: LogRecord = {};
  for (const [key, val] of Object.entries(record)) {
    result[key] = sanitizeValue(key, val);
  }
  return result;
}

function formatLog(level: LogLevel, message: string, data?: LogRecord): string {
  const ts = new Date().toISOString();
  const sanitized = data ? sanitizeRecord(data) : undefined;
  const parts: unknown[] = [`[${ts}] [${level.toUpperCase()}]`, message];
  if (sanitized) parts.push(JSON.stringify(sanitized));
  return parts.join(" ");
}

function writeLog(level: LogLevel, message: string, data?: LogRecord): void {
  if (!shouldLog(level)) return;
  const line = formatLog(level, message, data);
  if (level === "error" || level === "warn") {
    process.stderr.write(line + "\n");
  } else {
    process.stderr.write(line + "\n");
  }
}

export const logger = {
  debug: (message: string, data?: LogRecord) => writeLog("debug", message, data),
  info: (message: string, data?: LogRecord) => writeLog("info", message, data),
  warn: (message: string, data?: LogRecord) => writeLog("warn", message, data),
  error: (message: string, data?: LogRecord) => writeLog("error", message, data),

  /** Audit log for tool invocations — always at info level with redaction. */
  audit: (toolName: string, inputs: LogRecord): void => {
    writeLog("info", `[AUDIT] tool=${toolName}`, { inputs: sanitizeRecord(inputs) });
  },
};
