/**
 * Shared SendGrid REST client.
 * - Injects Authorization header automatically.
 * - Handles retry with exponential backoff for 429 and 5xx.
 * - Normalizes error responses.
 * - Enforces timeouts.
 * - Never logs the API key.
 */

import { getConfig } from "../config/index.js";
import { normalizeHttpError, SendGridApiError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { withRetry, parseRetryAfter } from "../utils/retry.js";
import { buildQueryString } from "../utils/pagination.js";

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface RequestOptions {
  method?: HttpMethod;
  path: string;
  params?: Record<string, unknown>;
  body?: unknown;
  /** Override timeout for this specific request */
  timeoutMs?: number;
  /** Disable retry for this request */
  noRetry?: boolean;
}

export interface SendGridResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export class SendGridClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly defaultTimeoutMs: number;

  constructor() {
    const config = getConfig();
    this.baseUrl = config.sendgrid.baseUrl;
    this.apiKey = config.sendgrid.apiKey;
    this.defaultTimeoutMs = config.sendgrid.timeoutMs;
  }

  async request<T>(options: RequestOptions): Promise<SendGridResponse<T>> {
    const { method = "GET", path, params, body, timeoutMs, noRetry = false } = options;
    const url = `${this.baseUrl}/v3${path}${params ? buildQueryString(params) : ""}`;

    const execute = () => this.executeRequest<T>(url, method, body, timeoutMs ?? this.defaultTimeoutMs);

    if (noRetry) return execute();

    return withRetry(execute, (err) => {
      if (err instanceof SendGridApiError) {
        const retryAfterMs: number | undefined = err.normalized.isRateLimit
          ? (parseRetryAfter(null) ?? 2000)
          : undefined;
        return {
          isRetryable: err.normalized.isRetryable,
          ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
        };
      }
      // Network-level errors (ECONNRESET, ETIMEDOUT) are retryable
      if (
        err instanceof Error &&
        (err.message.includes("ETIMEDOUT") ||
          err.message.includes("ECONNRESET") ||
          err.message.includes("fetch"))
      ) {
        return { isRetryable: true as const };
      }
      return { isRetryable: false as const };
    });
  }

  private async executeRequest<T>(
    url: string,
    method: HttpMethod,
    body: unknown,
    timeoutMs: number,
  ): Promise<SendGridResponse<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      logger.debug(`${method} ${url}`);
      const fetchInit: RequestInit = {
        method,
        headers: this.buildHeaders(body),
        signal: controller.signal,
      };
      if (body !== undefined) {
        fetchInit.body = JSON.stringify(body);
      }
      const response = await fetch(url, fetchInit);

      clearTimeout(timer);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // 204 No Content
      if (response.status === 202 || response.status === 204) {
        return { data: {} as T, status: response.status, headers: responseHeaders };
      }

      let responseBody: unknown;
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }

      if (!response.ok) {
        throw new SendGridApiError(
          normalizeHttpError(response.status, responseBody, url),
        );
      }

      return { data: responseBody as T, status: response.status, headers: responseHeaders };
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof SendGridApiError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Request to SendGrid timed out after ${timeoutMs}ms: ${url}`);
      }
      throw err;
    }
  }

  private buildHeaders(body: unknown): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "User-Agent": "mcp-sendgrid-server/1.0.0",
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    return headers;
  }

  // --- Convenience methods ---

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const opts: RequestOptions = { method: "GET", path };
    if (params) opts.params = params;
    const res = await this.request<T>(opts);
    return res.data;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.request<T>({ method: "POST", path, body });
    return res.data;
  }

  async postRaw(path: string, body: unknown): Promise<SendGridResponse<unknown>> {
    return this.request({ method: "POST", path, body });
  }
}

let _client: SendGridClient | null = null;

export function getSendGridClient(): SendGridClient {
  if (!_client) _client = new SendGridClient();
  return _client;
}

/** Reset the client singleton (used in tests). */
export function resetClient(): void {
  _client = null;
}
