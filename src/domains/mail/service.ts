/**
 * Mail Send domain service.
 * Handles actual send, test-send, and payload validation.
 */

import { getSendGridClient } from "../../client/sendgrid-client.js";
import { getConfig } from "../../config/index.js";
import { PolicyError, ValidationError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import type {
  SendEmailInput,
  TestSendEmailInput,
  ValidateSendPayloadInput,
} from "../../schemas/mail.js";

const MAX_ATTACHMENT_SIZE_BYTES = 30 * 1024 * 1024; // 30 MB total
const MAX_SINGLE_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB per attachment
const DANGEROUS_MIME_TYPES = [
  "application/x-executable",
  "application/x-msdownload",
  "application/x-sh",
  "text/x-sh",
];

export interface SendResult {
  success: boolean;
  message: string;
  messageId: string | undefined;
  status: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class MailService {
  private readonly client = getSendGridClient();
  private readonly config = getConfig();

  /**
   * Validate a send payload locally without making any API calls.
   */
  validatePayload(input: ValidateSendPayloadInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Subject or template required
    if (!input.subject && !input.template_id) {
      errors.push("Either 'subject' or 'template_id' is required.");
    }

    // Content or template required
    if (!input.text && !input.html && !input.template_id) {
      errors.push("Email must have 'text', 'html', or a 'template_id'.");
    }

    // From domain check
    if (this.config.sendgrid.allowedFromDomains.length > 0) {
      const fromDomain = input.from.email.split("@")[1]?.toLowerCase();
      if (fromDomain && !this.config.sendgrid.allowedFromDomains.includes(fromDomain)) {
        errors.push(
          `Sender domain '${fromDomain}' is not in SENDGRID_ALLOWED_FROM_DOMAINS. ` +
            `Allowed: ${this.config.sendgrid.allowedFromDomains.join(", ")}`,
        );
      }
    }

    // To domain/email checks (only in test mode)
    if (this.config.sendgrid.testModeOnly) {
      for (const recipient of input.to) {
        if (!this.isAllowedRecipient(recipient.email)) {
          errors.push(
            `Recipient '${recipient.email}' is not in the test-send allowlist. ` +
              "SENDGRID_TEST_MODE_ONLY is enabled.",
          );
        }
      }
    }

    // Template ID format
    if (input.template_id && !input.template_id.startsWith("d-")) {
      warnings.push(
        "template_id should start with 'd-' for dynamic templates. Legacy templates may behave differently.",
      );
    }

    // send_at validation
    if (input.send_at !== undefined) {
      const maxFuture = Math.floor(Date.now() / 1000) + 72 * 3600;
      if (input.send_at > maxFuture) {
        errors.push("send_at cannot be more than 72 hours in the future.");
      }
      if (input.send_at < Math.floor(Date.now() / 1000)) {
        warnings.push("send_at is in the past — the message may be sent immediately.");
      }
    }

    // Attachment checks
    if (input.attachments?.length) {
      let totalSize = 0;
      for (const att of input.attachments) {
        const approxBytes = Math.round((att.content.length * 3) / 4);
        totalSize += approxBytes;
        if (approxBytes > MAX_SINGLE_ATTACHMENT_BYTES) {
          errors.push(
            `Attachment '${att.filename}' exceeds 10 MB limit (approx ${Math.round(approxBytes / 1024 / 1024)} MB).`,
          );
        }
        if (att.type && DANGEROUS_MIME_TYPES.includes(att.type.toLowerCase())) {
          errors.push(`Attachment '${att.filename}' has a dangerous MIME type: ${att.type}.`);
        }
      }
      if (totalSize > MAX_ATTACHMENT_SIZE_BYTES) {
        errors.push(
          `Total attachment size (~${Math.round(totalSize / 1024 / 1024)} MB) exceeds 30 MB SendGrid limit.`,
        );
      }
    }

    // Custom args must be strings
    if (input.custom_args) {
      for (const [key, val] of Object.entries(input.custom_args)) {
        if (typeof val !== "string") {
          errors.push(`custom_args['${key}'] must be a string.`);
        }
      }
    }

    // Reserved header check
    const reservedHeaders = ["x-sg-id", "x-sg-eid", "received", "dkim-signature", "content-type", "content-transfer-encoding", "to", "from", "subject", "reply-to", "cc"];
    if (input.headers) {
      for (const key of Object.keys(input.headers)) {
        if (reservedHeaders.includes(key.toLowerCase())) {
          warnings.push(`Header '${key}' is reserved by SendGrid and may be ignored or cause errors.`);
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Send a transactional email.
   * Blocked in READ_ONLY mode or TEST_MODE_ONLY mode.
   */
  async send(input: SendEmailInput): Promise<SendResult> {
    this.assertWriteApproved("sendgrid_send_email", input.approval_token);
    if (this.config.sendgrid.testModeOnly) {
      throw new PolicyError(
        "SENDGRID_TEST_MODE_ONLY is enabled. Use sendgrid_test_send_email for test sends, or disable TEST_MODE_ONLY for production sends.",
        "TEST_MODE_ONLY",
      );
    }

    const validation = this.validatePayload(input);
    if (!validation.valid) {
      throw new ValidationError(
        `Send payload validation failed:\n${validation.errors.join("\n")}`,
        validation.errors,
      );
    }

    logger.audit("sendgrid_send_email", { from: input.from.email, to: input.to.map((t) => t.email), subject: input.subject });

    const payload = this.buildSgPayload(input);
    const res = await this.client.postRaw("/mail/send", payload);

    const messageId = (res.headers["x-message-id"] as string | undefined) ?? undefined;
    return {
      success: true,
      message: `Email queued successfully${messageId ? ` (message ID: ${messageId})` : ""}.`,
      messageId,
      status: res.status,
    };
  }

  /**
   * Test-send an email with safety guards.
   */
  async testSend(input: TestSendEmailInput): Promise<SendResult> {
    this.assertWriteApproved("sendgrid_test_send_email", input.approval_token);

    // Build effective recipients
    let effectiveTo = input.to;
    if (input.force_recipient) {
      effectiveTo = [input.force_recipient];
    }

    // Validate all effective recipients against allowlist
    for (const recipient of effectiveTo) {
      if (!this.isAllowedRecipient(recipient.email)) {
        throw new PolicyError(
          `Test-send recipient '${recipient.email}' is not in the allowlist. ` +
            `Allowed emails: ${this.config.sendgrid.allowedToEmails.join(", ")} | ` +
            `Allowed domains: ${this.config.sendgrid.allowedToDomains.join(", ")}`,
          "TEST_SEND_ALLOWLIST",
        );
      }
    }

    const modifiedInput: SendEmailInput = {
      ...input,
      to: effectiveTo,
      cc: undefined,
      bcc: undefined,
      categories: [
        ...(input.categories ?? []),
        ...(input.add_test_category !== false ? ["mcp-test-send"] : []),
      ],
      headers: {
        ...(input.headers ?? {}),
        ...(input.add_test_header !== false ? { "X-MCP-Test-Send": "true" } : {}),
      },
    };

    const validation = this.validatePayload(modifiedInput);
    if (!validation.valid) {
      throw new ValidationError(
        `Test-send payload validation failed:\n${validation.errors.join("\n")}`,
        validation.errors,
      );
    }

    logger.audit("sendgrid_test_send_email", {
      from: input.from.email,
      effective_to: effectiveTo.map((r) => r.email),
      original_to_count: input.to.length,
    });

    const payload = this.buildSgPayload(modifiedInput);
    const res = await this.client.postRaw("/mail/send", payload);
    const messageId = (res.headers["x-message-id"] as string | undefined) ?? undefined;

    return {
      success: true,
      message: `Test email sent successfully to ${effectiveTo.map((r) => r.email).join(", ")}${messageId ? ` (message ID: ${messageId})` : ""}.`,
      messageId,
      status: res.status,
    };
  }

  private isAllowedRecipient(email: string): boolean {
    const cfg = this.config.sendgrid;
    // If no allowlists configured, allow all (non-test-mode behaviour)
    if (cfg.allowedToEmails.length === 0 && cfg.allowedToDomains.length === 0) return true;

    const lowerEmail = email.toLowerCase();
    if (cfg.allowedToEmails.includes(lowerEmail)) return true;

    const domain = lowerEmail.split("@")[1];
    if (domain && cfg.allowedToDomains.includes(domain)) return true;

    return false;
  }

  private buildSgPayload(input: SendEmailInput): Record<string, unknown> {
    const personalizations: Record<string, unknown>[] = [
      {
        to: input.to,
        ...(input.cc?.length ? { cc: input.cc } : {}),
        ...(input.bcc?.length ? { bcc: input.bcc } : {}),
        ...(input.dynamic_template_data ? { dynamic_template_data: input.dynamic_template_data } : {}),
      },
    ];

    const payload: Record<string, unknown> = {
      personalizations,
      from: input.from,
      ...(input.reply_to ? { reply_to: input.reply_to } : {}),
    };

    if (input.template_id) {
      payload["template_id"] = input.template_id;
    } else {
      if (input.subject) payload["subject"] = input.subject;
      const content: Array<{ type: string; value: string }> = [];
      if (input.text) content.push({ type: "text/plain", value: input.text });
      if (input.html) content.push({ type: "text/html", value: input.html });
      if (content.length > 0) payload["content"] = content;
    }

    if (input.attachments?.length) payload["attachments"] = input.attachments;
    if (input.categories?.length) payload["categories"] = input.categories;
    if (input.custom_args) payload["custom_args"] = input.custom_args;
    if (input.headers) payload["headers"] = input.headers;
    if (input.asm) payload["asm"] = input.asm;
    if (input.send_at !== undefined) payload["send_at"] = input.send_at;
    if (input.ip_pool_name) payload["ip_pool_name"] = input.ip_pool_name;
    if (input.tracking_settings) payload["tracking_settings"] = input.tracking_settings;
    if (input.mail_settings) payload["mail_settings"] = input.mail_settings;

    return payload;
  }

  private assertWriteApproved(operation: string, approvalToken: string | undefined): void {
    const cfg = this.config.sendgrid;

    if (cfg.readOnly) {
      throw new PolicyError(
        "This server is running in read-only mode by default. " +
          "Set SENDGRID_READ_ONLY=false AND explicitly enable writes to perform send operations.",
        "READ_ONLY",
      );
    }

    if (!cfg.writesEnabled) {
      throw new PolicyError(
        `[WRITES_DISABLED] Write operations are disabled by configuration. To enable writes: set SENDGRID_WRITES_ENABLED=true and restart the server. (Blocked: ${operation})`,
        "WRITES_DISABLED",
      );
    }

    if (!cfg.writeApprovalToken) {
      throw new PolicyError(
        "[WRITES_MISCONFIGURED] Write operations are enabled but missing SENDGRID_WRITE_APPROVAL_TOKEN. Restart with a token to proceed.",
        "WRITES_MISCONFIGURED",
      );
    }

    if (!approvalToken || approvalToken !== cfg.writeApprovalToken) {
      throw new PolicyError(
        "[WRITE_APPROVAL_REQUIRED] Runtime write approval is required. Provide 'approval_token' matching SENDGRID_WRITE_APPROVAL_TOKEN.",
        "WRITE_APPROVAL_REQUIRED",
      );
    }
  }
}
