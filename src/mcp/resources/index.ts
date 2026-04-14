/**
 * MCP Resource definitions.
 * Resources expose reusable state snapshots that IDE agents can load for recurring context.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AccountService } from "../../domains/account/service.js";
import type { AccountSummary } from "../../domains/account/service.js";
import { StatsService } from "../../domains/stats/service.js";
import type { StatsPeriodSummary } from "../../schemas/stats.js";
import { SuppressionsService } from "../../domains/suppressions/service.js";
import type { SuppressionsOverview } from "../../schemas/suppressions.js";
import { TemplatesService } from "../../domains/templates/service.js";
import type { Template } from "../../schemas/templates.js";
import { SendersService } from "../../domains/senders/service.js";
import type { VerifiedSender } from "../../schemas/senders.js";
import { SettingsService } from "../../domains/settings/service.js";
import type { TrackingSettings, MailSettings } from "../../schemas/settings.js";
import { formatError } from "../../utils/errors.js";
import { TtlCache } from "../../utils/cache.js";
import { getConfig } from "../../config/index.js";

const RESOURCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function registerResources(server: McpServer): void {
  const accountService = new AccountService();
  const statsService = new StatsService();
  const suppressionsService = new SuppressionsService();
  const templatesService = new TemplatesService();
  const sendersService = new SendersService();
  const settingsService = new SettingsService();

  const accountCache = new TtlCache<AccountSummary>(RESOURCE_TTL_MS);
  const templatesCache = new TtlCache<{ templates: Template[]; total: number; hasMore: boolean; nextPageToken?: string }>(RESOURCE_TTL_MS);
  const stats7Cache = new TtlCache<StatsPeriodSummary>(RESOURCE_TTL_MS);
  const stats30Cache = new TtlCache<StatsPeriodSummary>(RESOURCE_TTL_MS);
  const suppressionsCache = new TtlCache<SuppressionsOverview>(RESOURCE_TTL_MS);
  const trackingCache = new TtlCache<TrackingSettings>(RESOURCE_TTL_MS);
  const mailSettingsCache = new TtlCache<MailSettings>(RESOURCE_TTL_MS);
  const sendersCache = new TtlCache<{ senders: VerifiedSender[]; hasMore: boolean }>(RESOURCE_TTL_MS);

  // ─── sendgrid://account/summary ───────────────────────────────────────────
  server.resource(
    "sendgrid-account-summary",
    "sendgrid://account/summary",
    {
      description: "Account username, credits, verified sender status, and health notes.",
      mimeType: "application/json",
    },
    async (_uri: URL) => {
      try {
        const summary = await accountCache.getOrLoad(() => accountService.getAccountSummary());
        return {
          contents: [
            {
              uri: "sendgrid://account/summary",
              mimeType: "application/json",
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: "sendgrid://account/summary",
              mimeType: "application/json",
              text: JSON.stringify({ error: formatError(err) }, null, 2),
            },
          ],
        };
      }
    },
  );

  // ─── sendgrid://templates ─────────────────────────────────────────────────
  server.resource(
    "sendgrid-templates",
    "sendgrid://templates",
    {
      description: "List of dynamic email templates with version status.",
      mimeType: "application/json",
    },
    async (_uri: URL) => {
      try {
        const result = await templatesCache.getOrLoad(() =>
          templatesService.listTemplates({ generations: "dynamic", page_size: 50 }),
        );
        return {
          contents: [
            {
              uri: "sendgrid://templates",
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  total: result.total,
                  templates: result.templates.map((t) => ({
                    id: t.id,
                    name: t.name,
                    generation: t.generation,
                    updated_at: t.updated_at,
                    active_version: t.versions?.find((v) => v.active === 1)?.name ?? "none",
                  })),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: "sendgrid://templates",
              mimeType: "application/json",
              text: JSON.stringify({ error: formatError(err) }, null, 2),
            },
          ],
        };
      }
    },
  );

  // ─── sendgrid://stats/last-7-days ────────────────────────────────────────
  server.resource(
    "sendgrid-stats-last-7-days",
    "sendgrid://stats/last-7-days",
    {
      description: "Email stats summary for the past 7 days with derived metrics.",
      mimeType: "application/json",
    },
    async (_uri: URL) => {
      try {
        const summary = await stats7Cache.getOrLoad(() => statsService.getLast7DaysSummary());
        return {
          contents: [
            {
              uri: "sendgrid://stats/last-7-days",
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  period: summary.period,
                  totals: summary.totals,
                  derived: summary.derived,
                  anomalies: summary.anomalies,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: "sendgrid://stats/last-7-days",
              mimeType: "application/json",
              text: JSON.stringify({ error: formatError(err) }, null, 2),
            },
          ],
        };
      }
    },
  );

  // ─── sendgrid://stats/last-30-days ───────────────────────────────────────
  server.resource(
    "sendgrid-stats-last-30-days",
    "sendgrid://stats/last-30-days",
    {
      description: "Email stats summary for the past 30 days with derived metrics.",
      mimeType: "application/json",
    },
    async (_uri: URL) => {
      try {
        const summary = await stats30Cache.getOrLoad(() => statsService.getLast30DaysSummary());
        return {
          contents: [
            {
              uri: "sendgrid://stats/last-30-days",
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  period: summary.period,
                  totals: summary.totals,
                  derived: summary.derived,
                  anomalies: summary.anomalies,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: "sendgrid://stats/last-30-days",
              mimeType: "application/json",
              text: JSON.stringify({ error: formatError(err) }, null, 2),
            },
          ],
        };
      }
    },
  );

  // ─── sendgrid://suppressions/overview ────────────────────────────────────
  server.resource(
    "sendgrid-suppressions-overview",
    "sendgrid://suppressions/overview",
    {
      description: "Counts and samples for all suppression types.",
      mimeType: "application/json",
    },
    async (_uri: URL) => {
      try {
        const overview = await suppressionsCache.getOrLoad(() => suppressionsService.getSuppressionsOverview());
        return {
          contents: [
            {
              uri: "sendgrid://suppressions/overview",
              mimeType: "application/json",
              text: JSON.stringify(overview, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: "sendgrid://suppressions/overview",
              mimeType: "application/json",
              text: JSON.stringify({ error: formatError(err) }, null, 2),
            },
          ],
        };
      }
    },
  );

  // ─── sendgrid://settings/tracking ────────────────────────────────────────
  server.resource(
    "sendgrid-settings-tracking",
    "sendgrid://settings/tracking",
    {
      description: "Click, open, subscription tracking, and Google Analytics settings.",
      mimeType: "application/json",
    },
    async (_uri: URL) => {
      try {
        const settings = await trackingCache.getOrLoad(() => settingsService.getTrackingSettings());
        return {
          contents: [
            {
              uri: "sendgrid://settings/tracking",
              mimeType: "application/json",
              text: JSON.stringify(settings, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: "sendgrid://settings/tracking",
              mimeType: "application/json",
              text: JSON.stringify({ error: formatError(err) }, null, 2),
            },
          ],
        };
      }
    },
  );

  // ─── sendgrid://settings/mail ─────────────────────────────────────────────
  server.resource(
    "sendgrid-settings-mail",
    "sendgrid://settings/mail",
    {
      description: "Mail settings: sandbox mode, footer, bypass settings.",
      mimeType: "application/json",
    },
    async (_uri: URL) => {
      try {
        const settings = await mailSettingsCache.getOrLoad(() => settingsService.getMailSettings());
        return {
          contents: [
            {
              uri: "sendgrid://settings/mail",
              mimeType: "application/json",
              text: JSON.stringify(settings, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: "sendgrid://settings/mail",
              mimeType: "application/json",
              text: JSON.stringify({ error: formatError(err) }, null, 2),
            },
          ],
        };
      }
    },
  );

  // ─── sendgrid://config/policy ────────────────────────────────────────────
  server.resource(
    "sendgrid-config-policy",
    "sendgrid://config/policy",
    {
      description:
        "Active safety policy: read-only mode, write-enable state, test mode, allowlists, region, and logging config.",
      mimeType: "application/json",
    },
    async (_uri: URL) => {
      const { sendgrid: sg, logging } = getConfig();
      let mode: string;
      if (sg.readOnly) {
        mode = "read_only";
      } else if (sg.writesEnabled) {
        mode = "writes_enabled";
      } else {
        mode = "writes_disabled";
      }
      return {
        contents: [
          {
            uri: "sendgrid://config/policy",
            mimeType: "application/json",
            text: JSON.stringify(
              {
                mode,
                region: sg.region,
                read_only: sg.readOnly,
                writes_enabled: sg.writesEnabled,
                write_approval_required: sg.writesEnabled,
                test_mode_only: sg.testModeOnly,
                allowlists: {
                  from_domains: sg.allowedFromDomains,
                  to_domains: sg.allowedToDomains,
                  to_emails: sg.allowedToEmails,
                },
                pagination: {
                  default_page_size: sg.defaultPageSize,
                  max_page_size: sg.maxPageSize,
                },
                timeout_ms: sg.timeoutMs,
                logging: {
                  level: logging.level,
                  redact_pii: logging.redactPii,
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ─── sendgrid://senders ───────────────────────────────────────────────────
  server.resource(
    "sendgrid-senders",
    "sendgrid://senders",
    {
      description: "Verified sender identities and their verification status.",
      mimeType: "application/json",
    },
    async (_uri: URL) => {
      try {
        const result = await sendersCache.getOrLoad(() => sendersService.listVerifiedSenders({ limit: 100 }));
        return {
          contents: [
            {
              uri: "sendgrid://senders",
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  total: result.senders.length,
                  verified: result.senders.filter((s) => s.verified).length,
                  senders: result.senders,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: "sendgrid://senders",
              mimeType: "application/json",
              text: JSON.stringify({ error: formatError(err) }, null, 2),
            },
          ],
        };
      }
    },
  );
}
