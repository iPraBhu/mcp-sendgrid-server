/**
 * Zod schemas for Stats / Analytics operations.
 */

import { z } from "zod";
import { DateRangeSchema } from "./common.js";

const AggregatedBySchema = z.enum(["day", "week", "month"]).optional().default("day");

export const GetGlobalStatsInputSchema = DateRangeSchema.extend({
  aggregated_by: AggregatedBySchema.describe("Aggregation period"),
});

export const GetCategoryStatsInputSchema = DateRangeSchema.extend({
  categories: z
    .array(z.string())
    .min(1)
    .max(10)
    .describe("Category names to query stats for (max 10)"),
  aggregated_by: AggregatedBySchema,
});

export const CompareStatsRangesInputSchema = z.object({
  range_a: DateRangeSchema.describe("First date range"),
  range_b: DateRangeSchema.describe("Second date range (for comparison)"),
  aggregated_by: AggregatedBySchema,
  categories: z.array(z.string()).max(10).optional().describe("Limit to these categories"),
});

export const GetDeliverabilityInputSchema = z.object({
  period: z.enum(["7d", "30d"]).optional().default("7d").describe("Summary period"),
});

export interface RawStatMetrics {
  blocks: number;
  bounce_drops: number;
  bounces: number;
  clicks: number;
  deferred: number;
  delivered: number;
  invalid_emails: number;
  opens: number;
  processed: number;
  requests: number;
  spam_report_drops: number;
  spam_reports: number;
  unsubscribe_drops: number;
  unsubscribes: number;
  unique_clicks: number;
  unique_opens: number;
}

export interface DerivedMetrics {
  deliveryRate: string;
  bounceRate: string;
  openRate: string;
  clickRate: string;
  spamRate: string;
  unsubscribeRate: string;
}

export interface StatsPeriodSummary {
  period: { start: string; end: string };
  totals: RawStatMetrics;
  derived: DerivedMetrics;
  dailyData: Array<{ date: string; stats: RawStatMetrics }>;
  anomalies?: string[];
  trends?: string[];
}
