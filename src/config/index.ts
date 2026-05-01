/**
 * Configuration loading and validation.
 * All environment variable access is centralized here.
 * The API key is never logged or exposed outside this module.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type McpTransport = "stdio" | "http";
export type SendGridRegion = "global" | "eu";
export type ServerMode = "full" | "analytics";

export interface SendGridConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly region: SendGridRegion;
  readonly timeoutMs: number;
  /** Extended timeout for slow endpoints (e.g. Email Activity search). */
  readonly activityTimeoutMs: number;
  readonly maxConcurrency: number;
  readonly defaultPageSize: number;
  readonly maxPageSize: number;
  /**
   * Server mode. "analytics" restricts the server to stats, email activity,
   * suppression read tools, and IP access read tools only — mail send, templates,
   * settings, senders, and writes are not registered. Implies readOnly=true.
   */
  readonly mode: ServerMode;
  readonly readOnly: boolean;
  /**
   * Global write enable switch. When false (default), all write operations are blocked
   * even if SENDGRID_READ_ONLY=false.
   */
  readonly writesEnabled: boolean;
  /**
   * Manual approval token required at runtime for any write operation.
   * Only applicable when writesEnabled=true.
   */
  readonly writeApprovalToken: string | undefined;
  readonly testModeOnly: boolean;
  readonly allowedFromDomains: readonly string[];
  readonly allowedToDomains: readonly string[];
  readonly allowedToEmails: readonly string[];
}

export interface McpConfig {
  readonly transport: McpTransport;
  readonly httpPort: number;
}

export interface LoggingConfig {
  readonly level: LogLevel;
  readonly redactPii: boolean;
}

export interface Config {
  readonly sendgrid: SendGridConfig;
  readonly mcp: McpConfig;
  readonly logging: LoggingConfig;
}

const SENDGRID_GLOBAL_URL = "https://api.sendgrid.com";
const SENDGRID_EU_URL = "https://api.eu.sendgrid.com";

function getBaseUrl(region: SendGridRegion, override?: string): string {
  if (override) return override.replace(/\/$/, "");
  return region === "eu" ? SENDGRID_EU_URL : SENDGRID_GLOBAL_URL;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

function parseInteger(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseStringList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

function parseNonEmptyString(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v && v.length > 0 ? v : undefined;
}

function parseLogLevel(value: string | undefined): LogLevel {
  const levels: LogLevel[] = ["debug", "info", "warn", "error"];
  if (value && levels.includes(value as LogLevel)) return value as LogLevel;
  return "info";
}

function parseRegion(value: string | undefined): SendGridRegion {
  if (value === "eu") return "eu";
  return "global";
}

function parseTransport(value: string | undefined): McpTransport {
  if (value === "http") return "http";
  return "stdio";
}

function parseServerMode(value: string | undefined): ServerMode {
  if (value === "analytics") return "analytics";
  return "full";
}

let _config: Config | null = null;

export function loadConfig(): Config {
  if (_config) return _config;

  const apiKey = process.env["SENDGRID_API_KEY"];
  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      "SENDGRID_API_KEY environment variable is required but not set. " +
        "Please set it to a valid SendGrid API key.",
    );
  }

  const region = parseRegion(process.env["SENDGRID_REGION"]);
  const baseUrl = getBaseUrl(region, process.env["SENDGRID_BASE_URL"]);
  const defaultPageSize = parseInteger(process.env["SENDGRID_DEFAULT_PAGE_SIZE"], 25);
  const maxPageSize = parseInteger(process.env["SENDGRID_MAX_PAGE_SIZE"], 100);

  const mode = parseServerMode(process.env["SENDGRID_MODE"]);

  // Default-safe: run in read-only mode unless explicitly disabled.
  // Analytics mode always forces read-only regardless of SENDGRID_READ_ONLY.
  const readOnly = mode === "analytics" ? true : parseBoolean(process.env["SENDGRID_READ_ONLY"], true);
  const writesEnabled = mode === "analytics" ? false : parseBoolean(process.env["SENDGRID_WRITES_ENABLED"], false);
  const writeApprovalToken = parseNonEmptyString(process.env["SENDGRID_WRITE_APPROVAL_TOKEN"]);

  if (writesEnabled && !writeApprovalToken) {
    throw new Error(
      "SENDGRID_WRITES_ENABLED is true but SENDGRID_WRITE_APPROVAL_TOKEN is not set. " +
        "Set SENDGRID_WRITE_APPROVAL_TOKEN to a strong random value to enable write operations.",
    );
  }

  _config = {
    sendgrid: {
      apiKey,
      baseUrl,
      region,
      timeoutMs: parseInteger(process.env["SENDGRID_TIMEOUT_MS"], 30_000),
      activityTimeoutMs: parseInteger(process.env["SENDGRID_ACTIVITY_TIMEOUT_MS"], 60_000),
      maxConcurrency: parseInteger(process.env["SENDGRID_MAX_CONCURRENCY"], 10),
      defaultPageSize: Math.min(defaultPageSize, maxPageSize),
      maxPageSize: Math.min(maxPageSize, 500),
      mode,
      readOnly,
      writesEnabled,
      writeApprovalToken,
      testModeOnly: parseBoolean(process.env["SENDGRID_TEST_MODE_ONLY"], false),
      allowedFromDomains: parseStringList(process.env["SENDGRID_ALLOWED_FROM_DOMAINS"]),
      allowedToDomains: parseStringList(process.env["SENDGRID_ALLOWED_TO_DOMAINS"]),
      allowedToEmails: parseStringList(process.env["SENDGRID_ALLOWED_TO_EMAILS"]),
    },
    mcp: {
      transport: parseTransport(process.env["MCP_TRANSPORT"]),
      httpPort: parseInteger(process.env["MCP_HTTP_PORT"], 3100),
    },
    logging: {
      level: parseLogLevel(process.env["LOG_LEVEL"]),
      redactPii: parseBoolean(process.env["REDACT_PII"], true),
    },
  };

  return _config;
}

/** Reset config (used in tests). */
export function resetConfig(): void {
  _config = null;
}

export function getConfig(): Config {
  return loadConfig();
}
