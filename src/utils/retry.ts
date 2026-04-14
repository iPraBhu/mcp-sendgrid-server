/**
 * Retry with exponential backoff for transient errors.
 * Handles 429 (rate limit) and 5xx (transient server errors).
 */

import { logger } from "./logger.js";

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  jitterMs?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 4,
  initialDelayMs: 500,
  maxDelayMs: 16_000,
  jitterMs: 200,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeDelay(attempt: number, opts: Required<RetryOptions>): number {
  const exponential = opts.initialDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, opts.maxDelayMs);
  const jitter = Math.random() * opts.jitterMs;
  return Math.round(capped + jitter);
}

export interface RetryableError {
  isRetryable: boolean;
  isRateLimit?: boolean;
  retryAfterMs?: number;
}

/**
 * Execute an async operation with retry and exponential backoff.
 *
 * @param operation - The async function to retry
 * @param isRetryable - Returns true if the caught error should be retried
 * @param opts - Retry configuration
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  isRetryable: (err: unknown) => RetryableError,
  opts: RetryOptions = {},
): Promise<T> {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  let lastError: unknown;

  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      const { isRetryable: shouldRetry, retryAfterMs } = isRetryable(err);

      if (!shouldRetry || attempt === options.maxAttempts - 1) {
        throw err;
      }

      const waitMs = retryAfterMs ?? computeDelay(attempt, options);
      logger.warn(`Retrying request after ${waitMs}ms (attempt ${attempt + 1}/${options.maxAttempts})`, {
        attempt,
        waitMs,
      });
      await delay(waitMs);
    }
  }

  throw lastError;
}

/**
 * Parse Retry-After header value into milliseconds.
 * Handles both delta-seconds (integer) and HTTP-date formats.
 */
export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = parseInt(value, 10);
  if (!isNaN(seconds)) return seconds * 1000;
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }
  return undefined;
}
