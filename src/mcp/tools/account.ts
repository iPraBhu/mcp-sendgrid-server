/**
 * MCP tool definitions for Account summary and operational status.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AccountService } from "../../domains/account/service.js";
import { formatError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

export function registerAccountTools(server: McpServer): void {
  const service = new AccountService();

  server.tool(
    "sendgrid_get_account_summary",
    "Get a summary of the SendGrid account: username, company, email credits, subuser count, " +
      "verified sender status, and health notes.",
    {},
    async () => {
      logger.audit("sendgrid_get_account_summary", {});
      try {
        const summary = await service.getAccountSummary();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: summary.capabilities.note ?? "Account summary retrieved.",
                  username: summary.username,
                  company: summary.company,
                  country: summary.country,
                  credits: summary.credits,
                  subusers_count: summary.subusers_count,
                  capabilities: summary.capabilities,
                  health_notes: summary.health_notes,
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
    "sendgrid_get_recent_operational_summary",
    "Get a full operational readiness summary: account health, send capability, " +
      "action items, and any issues that need immediate attention.",
    {},
    async () => {
      logger.audit("sendgrid_get_recent_operational_summary", {});
      try {
        const result = await service.getRecentOperationalSummary();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: result.ready_to_send
                    ? "Account is operational and ready to send."
                    : "Account has issues that may prevent sending.",
                  ready_to_send: result.ready_to_send,
                  action_items: result.action_items,
                  account: {
                    username: result.account.username,
                    credits: result.account.credits,
                    capabilities: result.account.capabilities,
                    health_notes: result.account.health_notes,
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
}
