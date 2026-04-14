/**
 * MCP Resource definitions.
 * Resources expose reusable state snapshots that IDE agents can load for recurring context.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AccountService } from "../../domains/account/service.js";
import { StatsService } from "../../domains/stats/service.js";
import { SuppressionsService } from "../../domains/suppressions/service.js";
import { TemplatesService } from "../../domains/templates/service.js";
import { SendersService } from "../../domains/senders/service.js";
import { SettingsService } from "../../domains/settings/service.js";
import { formatError } from "../../utils/errors.js";

export function registerResources(server: McpServer): void {
  const accountService = new AccountService();
  const statsService = new StatsService();
  const suppressionsService = new SuppressionsService();
  const templatesService = new TemplatesService();
  const sendersService = new SendersService();
  const settingsService = new SettingsService();

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
        const summary = await accountService.getAccountSummary();
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
        const result = await templatesService.listTemplates({ generations: "dynamic", page_size: 50 });
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
        const summary = await statsService.getLast7DaysSummary();
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
        const summary = await statsService.getLast30DaysSummary();
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
        const overview = await suppressionsService.getSuppressionsOverview();
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
        const settings = await settingsService.getTrackingSettings();
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
        const settings = await settingsService.getMailSettings();
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
        const result = await sendersService.listVerifiedSenders({ limit: 100 });
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
