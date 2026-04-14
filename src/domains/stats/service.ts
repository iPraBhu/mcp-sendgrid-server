/**
 * Stats / Analytics domain service.
 * Computes derived metrics and provides trend/anomaly analysis.
 */

import { getSendGridClient } from "../../client/sendgrid-client.js";
import {
  last7Days,
  last30Days,
  previous7Days,
  previous30Days,
  validateDateRange,
} from "../../utils/dates.js";
import type { z } from "zod";
import type {
  GetGlobalStatsInputSchema,
  GetCategoryStatsInputSchema,
  CompareStatsRangesInputSchema,
  GetDeliverabilityInputSchema,
  RawStatMetrics,
  DerivedMetrics,
  StatsPeriodSummary,
} from "../../schemas/stats.js";

type GetGlobalStatsInput = z.infer<typeof GetGlobalStatsInputSchema>;
type GetCategoryStatsInput = z.infer<typeof GetCategoryStatsInputSchema>;
type CompareStatsInput = z.infer<typeof CompareStatsRangesInputSchema>;
type GetDeliverabilityInput = z.infer<typeof GetDeliverabilityInputSchema>;

interface StatDataPoint {
  date: string;
  stats: Array<{ metrics: RawStatMetrics; name?: string; type?: string }>;
}

function emptyMetrics(): RawStatMetrics {
  return {
    blocks: 0, bounce_drops: 0, bounces: 0, clicks: 0, deferred: 0,
    delivered: 0, invalid_emails: 0, opens: 0, processed: 0, requests: 0,
    spam_report_drops: 0, spam_reports: 0, unsubscribe_drops: 0, unsubscribes: 0,
    unique_clicks: 0, unique_opens: 0,
  };
}

function addMetrics(a: RawStatMetrics, b: RawStatMetrics): RawStatMetrics {
  const keys = Object.keys(a) as (keyof RawStatMetrics)[];
  const result = { ...a };
  for (const k of keys) {
    (result[k] as number) += b[k];
  }
  return result;
}

function computeDerived(m: RawStatMetrics): DerivedMetrics {
  const pct = (num: number, denom: number) =>
    denom > 0 ? ((num / denom) * 100).toFixed(2) + "%" : "N/A";

  return {
    deliveryRate: pct(m.delivered, m.requests),
    bounceRate: pct(m.bounces, m.requests),
    openRate: pct(m.unique_opens, m.delivered),
    clickRate: pct(m.unique_clicks, m.delivered),
    spamRate: pct(m.spam_reports, m.delivered),
    unsubscribeRate: pct(m.unsubscribes, m.delivered),
  };
}

function detectAnomalies(summary: StatsPeriodSummary): string[] {
  const anomalies: string[] = [];
  const { derived, totals } = summary;

  const bounceNum = totals.requests > 0 ? (totals.bounces / totals.requests) * 100 : 0;
  const spamNum = totals.delivered > 0 ? (totals.spam_reports / totals.delivered) * 100 : 0;
  const deliveryNum = totals.requests > 0 ? (totals.delivered / totals.requests) * 100 : 0;

  if (bounceNum > 5) anomalies.push(`High bounce rate: ${derived.bounceRate} (threshold: 5%)`);
  if (spamNum > 0.1) anomalies.push(`Elevated spam complaint rate: ${derived.spamRate} (threshold: 0.1%)`);
  if (totals.requests > 0 && deliveryNum < 90) anomalies.push(`Low delivery rate: ${derived.deliveryRate} (threshold: 90%)`);
  if (totals.deferred > totals.delivered * 0.2) anomalies.push(`High deferral rate: ${totals.deferred} deferred vs ${totals.delivered} delivered`);
  if (totals.blocks > totals.requests * 0.05) anomalies.push(`Elevated blocks: ${totals.blocks} (>${5}% of requests)`);

  return anomalies;
}

function buildSummary(
  dataPoints: StatDataPoint[],
  startDate: string,
  endDate: string,
): StatsPeriodSummary {
  let totals = emptyMetrics();
  const daily: StatsPeriodSummary["dailyData"] = [];

  for (const point of dataPoints) {
    const dayMetrics = emptyMetrics();
    for (const statEntry of point.stats) {
      const m = statEntry.metrics ?? emptyMetrics();
      for (const k of Object.keys(m) as (keyof RawStatMetrics)[]) {
        (dayMetrics[k] as number) += m[k] ?? 0;
      }
    }
    totals = addMetrics(totals, dayMetrics);
    daily.push({ date: point.date, stats: dayMetrics });
  }

  const derived = computeDerived(totals);
  const summary: StatsPeriodSummary = {
    period: { start: startDate, end: endDate },
    totals,
    derived,
    dailyData: daily,
  };

  summary.anomalies = detectAnomalies(summary);
  return summary;
}

export class StatsService {
  private readonly client = getSendGridClient();

  async getGlobalStats(input: GetGlobalStatsInput): Promise<StatsPeriodSummary> {
    validateDateRange({ startDate: input.start_date, endDate: input.end_date });
    const data = await this.client.get<StatDataPoint[]>("/stats", {
      start_date: input.start_date,
      end_date: input.end_date,
      aggregated_by: input.aggregated_by ?? "day",
    });
    return buildSummary(data, input.start_date, input.end_date);
  }

  async getCategoryStats(input: GetCategoryStatsInput): Promise<StatsPeriodSummary> {
    validateDateRange({ startDate: input.start_date, endDate: input.end_date });
    const params: Record<string, unknown> = {
      start_date: input.start_date,
      end_date: input.end_date,
      aggregated_by: input.aggregated_by ?? "day",
    };
    // SendGrid category stats allows multiple categories via repeated param
    if (input.categories.length === 1) {
      params["categories"] = input.categories[0];
    } else {
      params["categories"] = input.categories;
    }

    const data = await this.client.get<StatDataPoint[]>("/categories/stats", params);
    return buildSummary(data, input.start_date, input.end_date);
  }

  async compareStatsRanges(input: CompareStatsInput): Promise<{
    range_a: StatsPeriodSummary;
    range_b: StatsPeriodSummary;
    comparison: ComparisonSummary;
  }> {
    validateDateRange({ startDate: input.range_a.start_date, endDate: input.range_a.end_date });
    validateDateRange({ startDate: input.range_b.start_date, endDate: input.range_b.end_date });

    const [rangeA, rangeB] = await Promise.all([
      this.getGlobalStats({ ...input.range_a, aggregated_by: input.aggregated_by }),
      this.getGlobalStats({ ...input.range_b, aggregated_by: input.aggregated_by }),
    ]);

    return {
      range_a: rangeA,
      range_b: rangeB,
      comparison: buildComparison(rangeA, rangeB),
    };
  }

  async getLast7DaysSummary(): Promise<StatsPeriodSummary> {
    const { startDate, endDate } = last7Days();
    return this.getGlobalStats({ start_date: startDate, end_date: endDate, aggregated_by: "day" });
  }

  async getLast30DaysSummary(): Promise<StatsPeriodSummary> {
    const { startDate, endDate } = last30Days();
    return this.getGlobalStats({ start_date: startDate, end_date: endDate, aggregated_by: "day" });
  }

  async getDeliverabilityReport(input: GetDeliverabilityInput): Promise<{
    period: string;
    current: StatsPeriodSummary;
    previous?: StatsPeriodSummary;
    comparison?: ComparisonSummary;
    health_score: number;
    health_status: string;
    recommendations: string[];
  }> {
    const period = input.period ?? "7d";
    const current = period === "7d" ? await this.getLast7DaysSummary() : await this.getLast30DaysSummary();
    const prevRange = period === "7d" ? previous7Days() : previous30Days();
    let previous: StatsPeriodSummary | undefined;
    let comparison: ComparisonSummary | undefined;

    try {
      previous = await this.getGlobalStats({
        start_date: prevRange.startDate,
        end_date: prevRange.endDate,
        aggregated_by: "day",
      });
      comparison = buildComparison(current, previous);
    } catch {
      // Previous period stats may be unavailable
    }

    const { health_score, health_status, recommendations } = computeHealthScore(current);
    return { period, current, previous, comparison, health_score, health_status, recommendations };
  }
}

export interface ComparisonSummary {
  volume_change_pct: string;
  delivery_rate_change: string;
  bounce_rate_change: string;
  open_rate_change: string;
  click_rate_change: string;
  spam_rate_change: string;
  trend: "improving" | "declining" | "stable";
  summary: string;
}

function numPct(s: string): number {
  if (s === "N/A") return 0;
  return parseFloat(s.replace("%", ""));
}

function changePct(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "+∞%" : "0%";
  const change = ((current - previous) / previous) * 100;
  return (change >= 0 ? "+" : "") + change.toFixed(1) + "%";
}

function buildComparison(current: StatsPeriodSummary, previous: StatsPeriodSummary): ComparisonSummary {
  const volumeChange = changePct(current.totals.requests, previous.totals.requests);
  const deliveryChange = changePct(numPct(current.derived.deliveryRate), numPct(previous.derived.deliveryRate));
  const bounceChange = changePct(numPct(current.derived.bounceRate), numPct(previous.derived.bounceRate));
  const openChange = changePct(numPct(current.derived.openRate), numPct(previous.derived.openRate));
  const clickChange = changePct(numPct(current.derived.clickRate), numPct(previous.derived.clickRate));
  const spamChange = changePct(numPct(current.derived.spamRate), numPct(previous.derived.spamRate));

  const currentDelivery = numPct(current.derived.deliveryRate);
  const previousDelivery = numPct(previous.derived.deliveryRate);
  const deliveryDelta = currentDelivery - previousDelivery;

  let trend: ComparisonSummary["trend"] = "stable";
  if (deliveryDelta > 1) trend = "improving";
  else if (deliveryDelta < -1) trend = "declining";

  const summaryParts: string[] = [
    `Sent ${current.totals.requests} emails (${volumeChange} vs previous period).`,
    `Delivery rate: ${current.derived.deliveryRate} (${deliveryChange}).`,
    `Bounce rate: ${current.derived.bounceRate} (${bounceChange}).`,
  ];
  if (current.anomalies?.length) {
    summaryParts.push(`Anomalies detected: ${current.anomalies.join("; ")}`);
  }

  return {
    volume_change_pct: volumeChange,
    delivery_rate_change: deliveryChange,
    bounce_rate_change: bounceChange,
    open_rate_change: openChange,
    click_rate_change: clickChange,
    spam_rate_change: spamChange,
    trend,
    summary: summaryParts.join(" "),
  };
}

function computeHealthScore(summary: StatsPeriodSummary): {
  health_score: number;
  health_status: string;
  recommendations: string[];
} {
  let score = 100;
  const recs: string[] = [];

  const deliveryRate = numPct(summary.derived.deliveryRate);
  const bounceRate = numPct(summary.derived.bounceRate);
  const spamRate = numPct(summary.derived.spamRate);

  if (deliveryRate < 95) { score -= 20; recs.push("Delivery rate below 95% — investigate blocks and bounces."); }
  else if (deliveryRate < 98) { score -= 10; recs.push("Delivery rate could be improved."); }

  if (bounceRate > 5) { score -= 25; recs.push("Bounce rate > 5% — clean your recipient list immediately."); }
  else if (bounceRate > 2) { score -= 10; recs.push("Bounce rate elevated — review list hygiene."); }

  if (spamRate > 0.1) { score -= 30; recs.push("Spam complaint rate > 0.1% — review content and consent."); }
  else if (spamRate > 0.05) { score -= 15; recs.push("Spam complaint rate approaching threshold — monitor closely."); }

  const deferralRate = summary.totals.requests > 0 ? (summary.totals.deferred / summary.totals.requests) * 100 : 0;
  if (deferralRate > 10) { score -= 10; recs.push("High deferral rate — check IP reputation and sending volume ramp."); }

  score = Math.max(0, score);
  const health_status = score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 50 ? "Needs Attention" : "Poor";

  return { health_score: score, health_status, recommendations: recs };
}
