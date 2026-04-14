/**
 * MCP tool definitions for Suppression management.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SuppressionsService } from "../../domains/suppressions/service.js";
import {
  ListSuppressionsInputSchema,
  LookupRecipientSuppressionsInputSchema,
} from "../../schemas/suppressions.js";
import { formatError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

export function registerSuppressionTools(server: McpServer): void {
  const service = new SuppressionsService();

  server.tool(
    "sendgrid_get_suppressions_overview",
    "Get a summary overview of all suppression types: bounces, blocks, invalid emails, spam reports, unsubscribes. " +
      "Returns counts and sample entries for each suppression type.",
    {},
    async () => {
      logger.audit("sendgrid_get_suppressions_overview", {});
      try {
        const overview = await service.getSuppressionsOverview();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: overview.summary,
                  total_suppressed: overview.total_suppressed,
                  bounces: overview.bounces,
                  blocks: overview.blocks,
                  invalid_emails: overview.invalid_emails,
                  spam_reports: overview.spam_reports,
                  unsubscribes: overview.unsubscribes,
                  note: "Counts reflect the first page of each list. Use individual list tools for full data.",
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
    "sendgrid_lookup_recipient_suppressions",
    "Look up all active suppressions for a specific email address. " +
      "Checks bounces, blocks, invalid emails, spam reports, and unsubscribes. " +
      "Returns a diagnosis and recommended action.",
    LookupRecipientSuppressionsInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_lookup_recipient_suppressions", { email: input.email });
      try {
        const result = await service.lookupRecipientSuppressions(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: result.suppression_reason,
                  email: result.email,
                  suppressed: result.bounced || result.blocked || result.invalid || result.spam_reported || result.unsubscribed,
                  suppressions: {
                    bounced: result.bounced,
                    blocked: result.blocked,
                    invalid: result.invalid,
                    spam_reported: result.spam_reported,
                    unsubscribed: result.unsubscribed,
                  },
                  recommended_action: result.recommended_action,
                  details: result.details,
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
    "sendgrid_list_bounces",
    "List email addresses with bounce records. " +
      "Supports pagination and time-range filtering.",
    ListSuppressionsInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_list_bounces", input as Record<string, unknown>);
      try {
        const bounces = await service.listBounces(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: `${bounces.length} bounce(s) returned.`,
                  count: bounces.length,
                  bounces,
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
    "sendgrid_list_blocks",
    "List email addresses that are blocked. " +
      "Blocks are usually caused by content filters or IP reputation issues.",
    ListSuppressionsInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_list_blocks", input as Record<string, unknown>);
      try {
        const blocks = await service.listBlocks(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ summary: `${blocks.length} block(s).`, count: blocks.length, blocks }, null, 2),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${formatError(err)}` }], isError: true };
      }
    },
  );

  server.tool(
    "sendgrid_list_invalid_emails",
    "List email addresses marked as invalid (permanently undeliverable).",
    ListSuppressionsInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_list_invalid_emails", input as Record<string, unknown>);
      try {
        const invalid = await service.listInvalidEmails(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { summary: `${invalid.length} invalid email(s).`, count: invalid.length, invalid_emails: invalid },
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
    "sendgrid_list_spam_reports",
    "List email addresses that have reported your emails as spam.",
    ListSuppressionsInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_list_spam_reports", input as Record<string, unknown>);
      try {
        const reports = await service.listSpamReports(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { summary: `${reports.length} spam report(s).`, count: reports.length, spam_reports: reports },
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
    "sendgrid_list_unsubscribes",
    "List email addresses that have globally unsubscribed from your emails.",
    ListSuppressionsInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_list_unsubscribes", input as Record<string, unknown>);
      try {
        const unsubs = await service.listUnsubscribes(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { summary: `${unsubs.length} global unsubscribe(s).`, count: unsubs.length, unsubscribes: unsubs },
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
