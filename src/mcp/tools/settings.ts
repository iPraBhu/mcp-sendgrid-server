/**
 * MCP tool definitions for Settings (tracking, mail settings).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SettingsService } from "../../domains/settings/service.js";
import { formatError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

export function registerSettingsTools(server: McpServer): void {
  const service = new SettingsService();

  server.tool(
    "sendgrid_get_tracking_settings",
    "Get the current SendGrid tracking settings: click tracking, open tracking, " +
      "subscription tracking, and Google Analytics UTM parameters.",
    {},
    async () => {
      logger.audit("sendgrid_get_tracking_settings", {});
      try {
        const settings = await service.getTrackingSettings();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: "Current SendGrid tracking settings.",
                  click_tracking: settings.click_tracking,
                  open_tracking: settings.open_tracking,
                  subscription_tracking: settings.subscription_tracking,
                  google_analytics: settings.google_analytics,
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
    "sendgrid_get_mail_settings",
    "Get the current SendGrid mail settings: bypass list management, footer, sandbox mode, " +
      "forward spam, plain content, and address whitelist.",
    {},
    async () => {
      logger.audit("sendgrid_get_mail_settings", {});
      try {
        const settings = await service.getMailSettings();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: "Current SendGrid mail settings.",
                  bypass_list_management: settings.bypass_list_management,
                  bypass_spam_management: settings.bypass_spam_management,
                  bypass_bounce_management: settings.bypass_bounce_management,
                  bypass_unsubscribe_management: settings.bypass_unsubscribe_management,
                  footer: settings.footer,
                  forward_spam: settings.forward_spam,
                  sandbox_mode: settings.sandbox_mode,
                  plain_content: settings.plain_content,
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
