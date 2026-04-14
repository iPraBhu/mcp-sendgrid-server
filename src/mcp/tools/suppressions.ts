/**
 * MCP tool definitions for Suppression management.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SuppressionsService } from "../../domains/suppressions/service.js";
import {
  ListSuppressionsInputSchema,
  LookupRecipientSuppressionsInputSchema,
  DeleteSuppressionInputSchema,
  AddGlobalUnsubscribeInputSchema,
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

  // ─── Write tools (require approval token) ─────────────────────────────────

  server.tool(
    "sendgrid_delete_bounce",
    "Remove an email address from the bounce suppression list. " +
      "Use after investigating and resolving the underlying delivery issue. " +
      "Requires SENDGRID_READ_ONLY=false, SENDGRID_WRITES_ENABLED=true, and a matching approval_token.",
    DeleteSuppressionInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_delete_bounce", { email: input.email });
      try {
        await service.deleteBounce(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { summary: `Bounce record removed for ${input.email}.`, email: input.email, deleted: true },
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
    "sendgrid_delete_block",
    "Remove an email address from the block suppression list. " +
      "Requires SENDGRID_READ_ONLY=false, SENDGRID_WRITES_ENABLED=true, and a matching approval_token.",
    DeleteSuppressionInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_delete_block", { email: input.email });
      try {
        await service.deleteBlock(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { summary: `Block removed for ${input.email}.`, email: input.email, deleted: true },
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
    "sendgrid_delete_invalid_email",
    "Remove an email address from the invalid email suppression list. " +
      "Only use after confirming the address is now valid and deliverable. " +
      "Requires SENDGRID_READ_ONLY=false, SENDGRID_WRITES_ENABLED=true, and a matching approval_token.",
    DeleteSuppressionInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_delete_invalid_email", { email: input.email });
      try {
        await service.deleteInvalidEmail(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { summary: `Invalid email record removed for ${input.email}.`, email: input.email, deleted: true },
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
    "sendgrid_delete_spam_report",
    "Remove an email address from the spam report suppression list. " +
      "Only use when the report was in error or after re-obtaining explicit opt-in consent. " +
      "Requires SENDGRID_READ_ONLY=false, SENDGRID_WRITES_ENABLED=true, and a matching approval_token.",
    DeleteSuppressionInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_delete_spam_report", { email: input.email });
      try {
        await service.deleteSpamReport(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { summary: `Spam report removed for ${input.email}.`, email: input.email, deleted: true },
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
    "sendgrid_delete_global_unsubscribe",
    "Remove an email address from the global unsubscribe list. " +
      "Only use after obtaining fresh, explicit opt-in consent from the recipient. " +
      "Requires SENDGRID_READ_ONLY=false, SENDGRID_WRITES_ENABLED=true, and a matching approval_token.",
    DeleteSuppressionInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_delete_global_unsubscribe", { email: input.email });
      try {
        await service.deleteGlobalUnsubscribe(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: `Global unsubscribe removed for ${input.email}.`,
                  email: input.email,
                  deleted: true,
                  note: "Ensure you have re-obtained explicit consent before sending to this address.",
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
    "sendgrid_add_global_unsubscribes",
    "Add one or more email addresses to the global unsubscribe list. " +
      "Use this to honour opt-out requests received outside of SendGrid (e.g. direct reply, in-person request). " +
      "Requires SENDGRID_READ_ONLY=false, SENDGRID_WRITES_ENABLED=true, and a matching approval_token.",
    AddGlobalUnsubscribeInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_add_global_unsubscribes", { count: input.emails.length });
      try {
        const result = await service.addGlobalUnsubscribes(input);
        const added = result?.recipient_emails ?? input.emails;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: `${added.length} address(es) added to the global unsubscribe list.`,
                  added,
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
