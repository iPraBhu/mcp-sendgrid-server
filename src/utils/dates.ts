/**
 * Date range utilities for SendGrid analytics and activity APIs.
 * SendGrid stats use YYYY-MM-DD dates; activity uses ISO timestamps.
 */

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface DateRangeIso {
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
}

/**
 * Format a Date to YYYY-MM-DD (SendGrid stats format).
 */
export function toSgDate(date: Date): string {
  return date.toISOString().split("T")[0] as string;
}

/**
 * Get today's date as YYYY-MM-DD.
 */
export function today(): string {
  return toSgDate(new Date());
}

/**
 * Get the date N days ago as YYYY-MM-DD.
 */
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toSgDate(d);
}

/**
 * Last 7 days date range (inclusive).
 */
export function last7Days(): DateRange {
  return { startDate: daysAgo(6), endDate: today() };
}

/**
 * Last 30 days date range (inclusive).
 */
export function last30Days(): DateRange {
  return { startDate: daysAgo(29), endDate: today() };
}

/**
 * Previous 7-day range (for comparison).
 */
export function previous7Days(): DateRange {
  return { startDate: daysAgo(13), endDate: daysAgo(7) };
}

/**
 * Previous 30-day range (for comparison).
 */
export function previous30Days(): DateRange {
  return { startDate: daysAgo(59), endDate: daysAgo(30) };
}

/**
 * Parse a flexible date string into YYYY-MM-DD.
 * Accepts YYYY-MM-DD or ISO 8601.
 */
export function parseDateString(input: string): string {
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const d = new Date(input);
  if (isNaN(d.getTime())) throw new Error(`Invalid date: "${input}"`);
  return toSgDate(d);
}

/**
 * Validate that startDate <= endDate.
 */
export function validateDateRange(range: DateRange): void {
  if (range.startDate > range.endDate) {
    throw new Error(
      `startDate (${range.startDate}) must be before or equal to endDate (${range.endDate})`,
    );
  }
}

/**
 * Count days between two YYYY-MM-DD dates (inclusive).
 */
export function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  return Math.round((end - start) / 86_400_000) + 1;
}

/**
 * Format a timestamp (seconds since epoch) to ISO string.
 */
export function epochToIso(epoch: number): string {
  return new Date(epoch * 1000).toISOString();
}
