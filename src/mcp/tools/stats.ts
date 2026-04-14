/**
 * MCP tool definitions for Stats / Analytics operations.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StatsService } from "../../domains/stats/service.js";
import {
  GetGlobalStatsInputSchema,
  GetCategoryStatsInputSchema,
  CompareStatsRangesInputSchema,
  GetDeliverabilityInputSchema,
} from "../../schemas/stats.js";
import { formatError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

export function registerStatsTools(server: McpServer): void {
  const service = new StatsService();

  server.tool(
    "sendgrid_get_global_stats",
    "Get global email statistics for a date range. " +
      "Returns processed, delivered, bounced, blocked, deferred, opens, clicks, spam reports, " +
      "unsubscribes, plus computed delivery rate, bounce rate, open rate, click rate, spam rate. " +
      "Includes anomaly detection.",
    GetGlobalStatsInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_get_global_stats", input as Record<string, unknown>);
      try {
        const summary = await service.getGlobalStats(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: `Stats for ${summary.period.start} to ${summary.period.end}. ` +
                    `${summary.totals.requests} sent, delivery rate: ${summary.derived.deliveryRate}.`,
                  period: summary.period,
                  totals: summary.totals,
                  derived_metrics: summary.derived,
                  anomalies: summary.anomalies ?? [],
                  daily_data_points: summary.dailyData.length,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${formatError(err)}` }], isError: true };
      }
    },
  );

  server.tool(
    "sendgrid_get_category_stats",
    "Get email statistics filtered by category name(s). " +
      "Returns same metrics as global stats but scoped to specific categories.",
    GetCategoryStatsInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_get_category_stats", input as Record<string, unknown>);
      try {
        const summary = await service.getCategoryStats(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: `Category stats for [${input.categories.join(", ")}] — ` +
                    `${summary.totals.requests} sent, delivery: ${summary.derived.deliveryRate}.`,
                  categories: input.categories,
                  period: summary.period,
                  totals: summary.totals,
                  derived_metrics: summary.derived,
                  anomalies: summary.anomalies ?? [],
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${formatError(err)}` }], isError: true };
      }
    },
  );

  server.tool(
    "sendgrid_compare_stats_ranges",
    "Compare email statistics between two date ranges. " +
      "Returns metrics for both periods plus a comparison summary with trend, " +
      "volume change, and rate changes.",
    CompareStatsRangesInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_compare_stats_ranges", input as Record<string, unknown>);
      try {
        const result = await service.compareStatsRanges(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: result.comparison.summary,
                  trend: result.comparison.trend,
                  comparison: result.comparison,
                  range_a: {
                    period: result.range_a.period,
                    totals: result.range_a.totals,
                    derived: result.range_a.derived,
                    anomalies: result.range_a.anomalies,
                  },
                  range_b: {
                    period: result.range_b.period,
                    totals: result.range_b.totals,
                    derived: result.range_b.derived,
                    anomalies: result.range_b.anomalies,
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${formatError(err)}` }], isError: true };
      }
    },
  );

  server.tool(
    "sendgrid_get_deliverability_summary",
    "Get a comprehensive deliverability health report for the last 7 or 30 days. " +
      "Includes current stats, previous period comparison, health score (0-100), " +
      "and specific recommendations to improve deliverability.",
    GetDeliverabilityInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_get_deliverability_summary", input as Record<string, unknown>);
      try {
        const result = await service.getDeliverabilityReport(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: `Deliverability health: ${result.health_status} (score: ${result.health_score}/100) over last ${result.period}.`,
                  health_score: result.health_score,
                  health_status: result.health_status,
                  period: result.period,
                  current_period: {
                    totals: result.current.totals,
                    derived: result.current.derived,
                    anomalies: result.current.anomalies,
                  },
                  previous_period: result.previous
                    ? {
                        totals: result.previous.totals,
                        derived: result.previous.derived,
                      }
                    : null,
                  comparison: result.comparison ?? null,
                  recommendations: result.recommendations,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${formatError(err)}` }], isError: true };
      }
    },
  );
}
