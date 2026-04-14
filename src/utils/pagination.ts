/**
 * Pagination helpers for SendGrid API responses.
 * SendGrid uses different pagination strategies depending on the endpoint:
 * - Offset/limit (stats, suppressions)
 * - Page/page_size (templates, verified senders)
 * - Token-based cursors (email activity)
 */

import { getConfig } from "../config/index.js";

export interface PaginationMeta {
  total: number | undefined;
  page: number | undefined;
  pageSize: number;
  hasMore: boolean;
  nextOffset: number | undefined;
}


export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
  warnings?: string[];
}

export interface OffsetPaginationParams {
  limit?: number;
  offset?: number;
}

export interface PagePaginationParams {
  page?: number;
  page_size?: number;
}

/**
 * Build safe, clamped offset/limit query params.
 */
export function buildOffsetParams(
  limit: number | undefined,
  offset: number | undefined,
): OffsetPaginationParams {
  const config = getConfig();
  const safeLimit = Math.min(
    limit ?? config.sendgrid.defaultPageSize,
    config.sendgrid.maxPageSize,
  );
  return {
    limit: safeLimit,
    offset: offset ?? 0,
  };
}

/**
 * Build safe, clamped page/page_size query params.
 */
export function buildPageParams(
  page: number | undefined,
  pageSize: number | undefined,
): PagePaginationParams {
  const config = getConfig();
  const safePage = Math.max(1, page ?? 1);
  const safePageSize = Math.min(
    pageSize ?? config.sendgrid.defaultPageSize,
    config.sendgrid.maxPageSize,
  );
  return {
    page: safePage,
    page_size: safePageSize,
  };
}

/**
 * Determine if there are more pages based on returned count vs limit.
 */
export function hasMorePages(returnedCount: number, limit: number): boolean {
  return returnedCount >= limit;
}

/**
 * Build pagination meta from response data.
 */
export function buildMeta(
  items: unknown[],
  params: OffsetPaginationParams,
  total?: number,
): PaginationMeta {
  const limit = params.limit ?? 25;
  const offset = params.offset ?? 0;
  return {
    total: total ?? undefined,
    page: undefined,
    pageSize: limit,
    hasMore: total !== undefined ? offset + items.length < total : items.length >= limit,
    nextOffset: items.length >= limit ? offset + limit : undefined,
  };
}

/**
 * Build query string from params object, omitting undefined values.
 */
export function buildQueryString(params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}
