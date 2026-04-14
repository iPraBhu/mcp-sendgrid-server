/**
 * MCP tool definitions for Mail Send operations.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MailService } from "../../domains/mail/service.js";
import {
  SendEmailInputSchema,
  TestSendEmailInputSchema,
  ValidateSendPayloadInputSchema,
} from "../../schemas/mail.js";
import { formatError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

export function registerMailTools(server: McpServer): void {
  const service = new MailService();

  // ─── sendgrid_validate_send_payload ───────────────────────────────────────
  server.tool(
    "sendgrid_validate_send_payload",
    "Validate a SendGrid email send payload locally without making any API calls or sending any email. " +
      "Checks required fields, content, sender domain allowlists, attachment sizes, and policy rules. " +
      "Use this first before attempting a real send.",
    ValidateSendPayloadInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_validate_send_payload", input as Record<string, unknown>);
      try {
        const result = service.validatePayload(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: result.valid
                    ? "✅ Payload is valid and ready to send."
                    : "❌ Payload has validation errors.",
                  valid: result.valid,
                  errors: result.errors,
                  warnings: result.warnings,
                  hint: result.valid
                    ? "Use sendgrid_send_email to send, or sendgrid_test_send_email for a test send."
                    : "Fix the errors above before sending.",
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

  // ─── sendgrid_test_send_email ─────────────────────────────────────────────
  server.tool(
    "sendgrid_test_send_email",
    "Send a test email via SendGrid with safety guardrails. " +
      "Validates against allowlists, can override recipients via force_recipient, " +
      "and automatically tags the message with a test category and header for tracing. " +
      "Blocked by default (read-only). Requires SENDGRID_READ_ONLY=false, SENDGRID_WRITES_ENABLED=true, and a matching approval_token at runtime.",
    TestSendEmailInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_test_send_email", input as Record<string, unknown>);
      try {
        const result = await service.testSend(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: result.message,
                  success: result.success,
                  message_id: result.messageId,
                  status_code: result.status,
                  note: "This was a test send. Check your inbox and the 'mcp-test-send' category in Email Activity.",
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

  // ─── sendgrid_send_email ──────────────────────────────────────────────────
  server.tool(
    "sendgrid_send_email",
    "Send a transactional email via SendGrid. " +
      "Supports text/HTML content, dynamic templates, attachments, scheduling (send_at), " +
      "unsubscribe groups, custom headers, and tracking settings. " +
      "BLOCKED by default (read-only) and also blocked if SENDGRID_TEST_MODE_ONLY=true. " +
      "Requires SENDGRID_READ_ONLY=false, SENDGRID_WRITES_ENABLED=true, and a matching approval_token at runtime. " +
      "Always validate first with sendgrid_validate_send_payload.",
    SendEmailInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_send_email", input as Record<string, unknown>);
      try {
        const result = await service.send(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: result.message,
                  success: result.success,
                  message_id: result.messageId,
                  status_code: result.status,
                  next_steps: result.messageId
                    ? `Track delivery with: sendgrid_get_message_details({ message_id: "${result.messageId}" })`
                    : "Use sendgrid_search_email_activity to track delivery.",
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
