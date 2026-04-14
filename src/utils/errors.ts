/**
 * Centralized error mapping and normalization.
 * Converts raw SendGrid API errors into structured, human-readable MCP errors.
 */

export interface SendGridErrorDetail {
  message: string;
  field: string | undefined;
  help: string | undefined;
}

export interface NormalizedError {
  code: string;
  message: string;
  httpStatus: number;
  details: SendGridErrorDetail[];
  isRetryable: boolean;
  isAuthError: boolean;
  isRateLimit: boolean;
  isPlanLimitation: boolean;
  /** Parsed value of the Retry-After response header, in milliseconds. */
  retryAfterMs?: number;
  rawError?: unknown;
}

/** Structured error thrown by the SendGrid client. */
export class SendGridApiError extends Error {
  readonly normalized: NormalizedError;

  constructor(normalized: NormalizedError) {
    super(normalized.message);
    this.name = "SendGridApiError";
    this.normalized = normalized;
  }
}

/** Error thrown when local policy blocks an operation (read-only mode, allowlist violation, etc.). */
export class PolicyError extends Error {
  constructor(
    message: string,
    public readonly policyName: string,
  ) {
    super(message);
    this.name = "PolicyError";
  }
}

/** Error thrown when input validation fails before hitting the API. */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly fields: string[],
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

interface SendGridRawError {
  errors?: Array<{ message?: string; field?: string; help?: string }>;
  message?: string;
  error?: string;
}

export function normalizeHttpError(
  httpStatus: number,
  body: unknown,
  url: string,
): NormalizedError {
  const raw = body as SendGridRawError;
  const errors: SendGridErrorDetail[] = (raw?.errors ?? []).map((e) => ({
    message: e.message ?? "Unknown error",
    field: e.field,
    help: e.help,
  }));

  if (errors.length === 0 && raw?.message) {
    errors.push({ message: raw.message, field: undefined, help: undefined });
  }
  if (errors.length === 0 && raw?.error) {
    errors.push({ message: raw.error, field: undefined, help: undefined });
  }

  const primaryMessage = errors[0]?.message ?? `HTTP ${httpStatus} from SendGrid API`;

  let code = "SENDGRID_ERROR";
  let isAuthError = false;
  let isRateLimit = false;
  let isPlanLimitation = false;
  const isRetryable = httpStatus === 429 || (httpStatus >= 500 && httpStatus < 600);

  switch (httpStatus) {
    case 400:
      code = "INVALID_REQUEST";
      break;
    case 401:
      code = "AUTH_FAILED";
      isAuthError = true;
      break;
    case 403:
      code = "FORBIDDEN";
      isAuthError = true;
      if (
        primaryMessage.toLowerCase().includes("entitlement") ||
        primaryMessage.toLowerCase().includes("plan") ||
        primaryMessage.toLowerCase().includes("feature") ||
        url.includes("/messages") // email activity requires add-on
      ) {
        isPlanLimitation = true;
        code = "PLAN_LIMITATION";
      }
      break;
    case 404:
      code = "NOT_FOUND";
      break;
    case 429:
      code = "RATE_LIMITED";
      isRateLimit = true;
      break;
    case 500:
    case 502:
    case 503:
    case 504:
      code = "SENDGRID_UNAVAILABLE";
      break;
  }

  const message = buildUserMessage(code, primaryMessage, httpStatus, url);

  return {
    code,
    message,
    httpStatus,
    details: errors,
    isRetryable,
    isAuthError,
    isRateLimit,
    isPlanLimitation,
    rawError: body,
  };
}

function buildUserMessage(code: string, primary: string, status: number, url: string): string {
  switch (code) {
    case "AUTH_FAILED":
      return "SendGrid authentication failed. Verify SENDGRID_API_KEY is correct and has the required permissions.";
    case "FORBIDDEN":
      return `SendGrid returned 403 Forbidden: ${primary}. Check API key scope and account permissions.`;
    case "PLAN_LIMITATION":
      return (
        `This feature is not available on your SendGrid plan or requires an add-on. ` +
        `Detail: ${primary}. The Email Activity API (${url}) requires the Email Activity add-on.`
      );
    case "RATE_LIMITED":
      return "SendGrid rate limit exceeded. The request will be retried automatically with backoff.";
    case "NOT_FOUND":
      return `Resource not found: ${primary}`;
    case "INVALID_REQUEST":
      return `Invalid request to SendGrid API: ${primary}`;
    case "SENDGRID_UNAVAILABLE":
      return `SendGrid API is temporarily unavailable (HTTP ${status}). This will be retried.`;
    default:
      return `SendGrid API error (HTTP ${status}): ${primary}`;
  }
}

/** Format a NormalizedError into a human-readable MCP tool error string. */
export function formatError(err: unknown): string {
  if (err instanceof SendGridApiError) {
    const { normalized } = err;
    const lines = [normalized.message];
    if (normalized.details.length > 1) {
      lines.push("Additional details:");
      normalized.details.slice(1).forEach((d) => {
        lines.push(`  - ${d.field ? `[${d.field}] ` : ""}${d.message}`);
      });
    }
    if (normalized.isPlanLimitation) {
      lines.push(
        "Note: Some SendGrid features require specific plans or add-ons. See README for details.",
      );
    }
    return lines.join("\n");
  }
  if (err instanceof PolicyError) {
    return `Policy violation [${err.policyName}]: ${err.message}`;
  }
  if (err instanceof ValidationError) {
    return `Validation failed: ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
