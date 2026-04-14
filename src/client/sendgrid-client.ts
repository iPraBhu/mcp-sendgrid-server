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
import { Semaphore } from "../utils/concurrency.js";

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
  private readonly semaphore: Semaphore;
  /**
   * In-flight GET requests keyed by full URL (including query string).
   * Concurrent requests for the same URL share one promise, avoiding duplicate API calls.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly inflight = new Map<string, Promise<SendGridResponse<any>>>();

  constructor() {
    const config = getConfig();
    this.baseUrl = config.sendgrid.baseUrl;
    this.apiKey = config.sendgrid.apiKey;
    this.defaultTimeoutMs = config.sendgrid.timeoutMs;
    this.semaphore = new Semaphore(config.sendgrid.maxConcurrency);
  }

  async request<T>(options: RequestOptions): Promise<SendGridResponse<T>> {
    const { method = "GET", path, params, body, timeoutMs, noRetry = false } = options;
    const url = `${this.baseUrl}/v3${path}${params ? buildQueryString(params) : ""}`;

    // Coalesce concurrent identical GET requests — return the in-flight promise instead of firing again.
    if (method === "GET") {
      const existing = this.inflight.get(url);
      if (existing) return existing as Promise<SendGridResponse<T>>;
    }

    const execute = () =>
      this.semaphore.run(() => this.executeRequest<T>(url, method, body, timeoutMs ?? this.defaultTimeoutMs));

    const isRetryableFn = (err: unknown) => {
      if (err instanceof SendGridApiError) {
        const retryAfterMs: number | undefined = err.normalized.isRateLimit
          ? (err.normalized.retryAfterMs ?? 2000)
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
    };

    const promise: Promise<SendGridResponse<T>> = noRetry
      ? execute()
      : withRetry(execute, isRetryableFn);

    if (method === "GET") {
      this.inflight.set(url, promise);
      void promise.finally(() => this.inflight.delete(url));
    }

    return promise;
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
        const normalized = normalizeHttpError(response.status, responseBody, url);
        const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
        if (retryAfterMs !== undefined) normalized.retryAfterMs = retryAfterMs;
        throw new SendGridApiError(normalized);
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

  async get<T>(path: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<T> {
    const opts: RequestOptions = { method: "GET", path };
    if (params) opts.params = params;
    if (timeoutMs !== undefined) opts.timeoutMs = timeoutMs;
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
