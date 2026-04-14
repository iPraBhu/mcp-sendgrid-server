/**
 * MCP tool definitions for Email Activity / Message Troubleshooting.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ActivityService } from "../../domains/activity/service.js";
import {
  SearchEmailActivityInputSchema,
  GetMessageDetailsInputSchema,
  TroubleshootMessageInputSchemaShape,
  TroubleshootRecipientInputSchema,
} from "../../schemas/activity.js";
import { formatError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import { redactEmailsInText } from "../../utils/redaction.js";
import { getConfig } from "../../config/index.js";

function applyOutputRedaction(json: string, overrideRedactPii?: boolean): string {
  const shouldRedact = overrideRedactPii ?? getConfig().logging.redactPii;
  return shouldRedact ? redactEmailsInText(json) : json;
}

type TroubleshootMsgInput = z.infer<z.ZodObject<typeof TroubleshootMessageInputSchemaShape>>;

const PLAN_NOTE =
  "Note: Email Activity requires the SendGrid Email Activity add-on (Pro/Premier plans).";

export function registerActivityTools(server: McpServer): void {
  const service = new ActivityService();

  server.tool(
    "sendgrid_search_email_activity",
    "Search SendGrid email activity / message log. " +
      "Filter by recipient, sender, subject, status, date range, or category. " +
      "Requires the Email Activity add-on on Pro/Premier plans. " +
      "Returns message status, event times, open/click counts.",
    SearchEmailActivityInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_search_email_activity", input as Record<string, unknown>);
      try {
        const result = await service.searchEmailActivity(input);
        if (result.planWarning) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ warning: result.planWarning, messages: [] }, null, 2),
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: applyOutputRedaction(
                JSON.stringify(
                  {
                    summary: `Found ${result.messages.length} message(s).`,
                    total: result.total,
                    has_more: result.hasMore,
                    next_page_token: result.nextPageToken,
                    messages: result.messages,
                    plan_note: PLAN_NOTE,
                  },
                  null,
                  2,
                ),
                input.redact_pii,
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
    "sendgrid_get_message_details",
    "Get detailed event history for a specific SendGrid message by message ID. " +
      "Shows all events: processed, delivered, opened, clicked, bounced, etc. " +
      "Requires Email Activity add-on.",
    GetMessageDetailsInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_get_message_details", { message_id: input.message_id });
      try {
        const result = await service.getMessageDetails(input);
        if (result.planWarning) {
          return {
            content: [
              { type: "text", text: JSON.stringify({ warning: result.planWarning }, null, 2) },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: applyOutputRedaction(
                JSON.stringify(
                  {
                    summary: result.message
                      ? `Message ${result.message.msg_id} — status: ${result.message.status}`
                      : "Message not found.",
                    message: result.message,
                    plan_note: PLAN_NOTE,
                  },
                  null,
                  2,
                ),
                input.redact_pii,
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
    "sendgrid_troubleshoot_message",
    "Investigate delivery issues for a specific message. " +
      "Searches email activity, analyzes event history, and returns a structured diagnosis " +
      "with likely cause, evidence, and recommended next steps.",
    TroubleshootMessageInputSchemaShape,
    async (input: TroubleshootMsgInput) => {
      logger.audit("sendgrid_troubleshoot_message", input as Record<string, unknown>);
      try {
        const result = await service.troubleshootMessage(
          input.message_id,
          input.to_email,
          input.subject,
          input.after_time,
        );
        if ("planWarning" in result) {
          return {
            content: [
              { type: "text", text: JSON.stringify({ warning: result.planWarning }, null, 2) },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: applyOutputRedaction(
                JSON.stringify(
                  {
                    summary: result.likely_cause,
                    email: result.email,
                    message_id: result.message_id,
                    status: result.status,
                    confidence: result.confidence,
                    evidence: result.evidence,
                    recommended_next_checks: result.recommended_next_checks,
                    event_count: result.events.length,
                  },
                  null,
                  2,
                ),
                input.redact_pii,
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
    "sendgrid_troubleshoot_recipient_delivery",
    "Investigate why a specific recipient is not receiving emails. " +
      "Checks activity log, suppression lists, and provides actionable diagnosis.",
    TroubleshootRecipientInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_troubleshoot_recipient_delivery", { email: input.email });
      try {
        const result = await service.troubleshootRecipient(input);
        if ("planWarning" in result) {
          return {
            content: [
              { type: "text", text: JSON.stringify({ warning: result.planWarning }, null, 2) },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: applyOutputRedaction(
                JSON.stringify(
                  {
                    summary: result.likely_cause,
                    email: result.email,
                    status: result.status,
                    confidence: result.confidence,
                    evidence: result.evidence,
                    recommended_next_checks: result.recommended_next_checks,
                  },
                  null,
                  2,
                ),
                input.redact_pii,
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
