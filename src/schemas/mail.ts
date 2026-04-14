/**
 * Zod schemas for Mail Send operations.
 */

import { z } from "zod";
import { EmailPersonalizationSchema } from "./common.js";

export const AttachmentSchema = z.object({
  content: z.string().describe("Base64-encoded content"),
  filename: z.string().min(1),
  type: z.string().optional().describe("MIME type, e.g. application/pdf"),
  disposition: z.enum(["attachment", "inline"]).optional().default("attachment"),
  content_id: z.string().optional(),
});

const BaseSendPayloadSchema = z.object({
  from: EmailPersonalizationSchema.describe("Sender email address and optional display name"),
  to: z
    .array(EmailPersonalizationSchema)
    .min(1)
    .max(1000)
    .describe("Recipient(s) — up to 1000"),
  cc: z.array(EmailPersonalizationSchema).max(1000).optional().describe("CC recipients"),
  bcc: z.array(EmailPersonalizationSchema).max(1000).optional().describe("BCC recipients"),
  reply_to: EmailPersonalizationSchema.optional(),
  subject: z
    .string()
    .min(1)
    .max(998)
    .optional()
    .describe("Subject line (required if not using a template)"),
  text: z.string().optional().describe("Plain-text email body"),
  html: z.string().optional().describe("HTML email body"),
  template_id: z
    .string()
    .optional()
    .describe("SendGrid dynamic template ID (d-xxxxxxxx...)"),
  dynamic_template_data: z
    .record(z.unknown())
    .optional()
    .describe("Template variable substitutions"),
  categories: z.array(z.string()).max(10).optional().describe("Up to 10 category tags"),
  custom_args: z
    .record(z.string())
    .optional()
    .describe("Custom arguments for event webhooks (string values only)"),
  headers: z
    .record(z.string())
    .optional()
    .describe("Custom email headers (avoid reserved names)"),
  attachments: z.array(AttachmentSchema).max(10).optional().describe("File attachments (max 10)"),
  asm: z
    .object({
      group_id: z.number().int().describe("Unsubscribe group ID"),
      groups_to_display: z.array(z.number()).max(25).optional(),
    })
    .optional()
    .describe("Unsubscribe group configuration"),
  send_at: z
    .number()
    .int()
    .optional()
    .describe("Unix timestamp for scheduled send (up to 72 hours in the future)"),
  ip_pool_name: z.string().optional().describe("IP pool name for dedicated IPs"),
  tracking_settings: z
    .object({
      click_tracking: z.object({ enable: z.boolean() }).optional(),
      open_tracking: z.object({ enable: z.boolean() }).optional(),
      subscription_tracking: z.object({ enable: z.boolean() }).optional(),
    })
    .optional(),
  mail_settings: z
    .object({
      sandbox_mode: z.object({ enable: z.boolean() }).optional(),
      bypass_list_management: z.object({ enable: z.boolean() }).optional(),
      footer: z
        .object({ enable: z.boolean(), text: z.string().optional(), html: z.string().optional() })
        .optional(),
    })
    .optional(),
});

export const SendEmailInputSchema = BaseSendPayloadSchema.extend({
  approval_token: z
    .string()
    .min(1)
    .describe(
      "Manual runtime approval token for write operations. Must match SENDGRID_WRITE_APPROVAL_TOKEN when writes are enabled.",
    ),
});

export const TestSendEmailInputSchema = SendEmailInputSchema.extend({
  force_recipient: EmailPersonalizationSchema.optional().describe(
    "Override all recipients — useful for test sends",
  ),
  add_test_category: z.boolean().optional().default(true).describe(
    "Automatically add 'mcp-test-send' category",
  ),
  add_test_header: z.boolean().optional().default(true).describe(
    "Add X-MCP-Test-Send header for tracing",
  ),
});

export const ValidateSendPayloadInputSchema = BaseSendPayloadSchema;

export type SendEmailInput = z.infer<typeof SendEmailInputSchema>;
export type TestSendEmailInput = z.infer<typeof TestSendEmailInputSchema>;
export type ValidateSendPayloadInput = z.infer<typeof ValidateSendPayloadInputSchema>;
