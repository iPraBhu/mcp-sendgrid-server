/**
 * Zod schemas for Email Activity / Message Troubleshooting.
 */

import { z } from "zod";

export const MessageStatusSchema = z.enum([
  "processed",
  "dropped",
  "delivered",
  "deferred",
  "bounce",
  "blocked",
  "spam_report",
  "unsubscribe",
  "group_unsubscribe",
  "open",
  "click",
]);

const RedactPiiField = {
  redact_pii: z
    .boolean()
    .optional()
    .describe(
      "When true, mask email addresses in the tool output (overrides the REDACT_PII server config). " +
        "Defaults to the REDACT_PII server setting.",
    ),
};

export const SearchEmailActivityInputSchema = z.object({
  to_email: z.string().email().optional().describe("Filter by recipient email"),
  from_email: z.string().email().optional().describe("Filter by sender email"),
  subject: z.string().optional().describe("Partial subject match"),
  categories: z.array(z.string()).optional().describe("Filter by category"),
  status: MessageStatusSchema.optional().describe("Filter by message status"),
  after_time: z
    .string()
    .optional()
    .describe("ISO 8601 timestamp — messages after this time"),
  before_time: z
    .string()
    .optional()
    .describe("ISO 8601 timestamp — messages before this time"),
  message_id: z.string().optional().describe("Filter by SendGrid message ID"),
  limit: z.number().int().min(1).max(1000).optional().default(25).describe("Max messages to return"),
  page_token: z.string().optional().describe("Pagination token from previous response"),
  ...RedactPiiField,
});

export const GetMessageDetailsInputSchema = z.object({
  message_id: z.string().min(1).describe("The SendGrid message ID (msg_id)"),
  ...RedactPiiField,
});

export const TroubleshootMessageInputSchemaShape = {
  message_id: z.string().optional().describe("Message ID to investigate"),
  to_email: z.string().email().optional().describe("Recipient to investigate"),
  subject: z.string().optional().describe("Subject to search for"),
  after_time: z.string().optional().describe("Search window start (ISO 8601)"),
  ...RedactPiiField,
};

export const TroubleshootMessageInputSchema = z
  .object(TroubleshootMessageInputSchemaShape)
  .refine(
    (data) => data.message_id ?? data.to_email ?? data.subject,
    "At least one of message_id, to_email, or subject is required",
  );

export const TroubleshootRecipientInputSchema = z.object({
  email: z.string().email().describe("The recipient email address to investigate"),
  ...RedactPiiField,
});
