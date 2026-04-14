/**
 * MCP Prompt definitions.
 * Prompts guide agent workflows for common SendGrid operations.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPrompts(server: McpServer): void {
  // ─── summarize_deliverability_health ─────────────────────────────────────
  server.prompt(
    "summarize_deliverability_health",
    "Generate a comprehensive deliverability health report. " +
      "Analyzes recent stats, anomalies, and produces actionable recommendations.",
    {
      period: z.enum(["7d", "30d"]).optional().describe("Analysis period (default: 7d)"),
    },
    ({ period }) => {
      const p = period ?? "7d";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please generate a deliverability health report for the last ${p === "7d" ? "7 days" : "30 days"}.

Steps:
1. Call sendgrid_get_deliverability_summary with period="${p}" to get the health score and metrics.
2. If health score < 90, call sendgrid_get_suppressions_overview to check for suppression issues.
3. If bounce rate > 2%, call sendgrid_list_bounces to see recent bounces.
4. Provide a concise summary with:
   - Overall health score and status
   - Key metrics (delivery rate, bounce rate, open rate, spam rate)
   - Any anomalies detected
   - Top 3 recommendations
   - Whether immediate action is required`,
            },
          },
        ],
      };
    },
  );

  // ─── troubleshoot_message_delivery ───────────────────────────────────────
  server.prompt(
    "troubleshoot_message_delivery",
    "Investigate why a specific email message did not arrive as expected. " +
      "Walks through activity log, suppression checks, and diagnosis.",
    {
      email: z.string().email().optional().describe("Recipient email to investigate"),
      message_id: z.string().optional().describe("SendGrid message ID"),
      subject: z.string().optional().describe("Email subject to search for"),
    },
    ({ email, message_id, subject }) => {
      const target = message_id
        ? `message ID: ${message_id}`
        : email
          ? `recipient: ${email}`
          : subject
            ? `subject: "${subject}"`
            : "the message";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please investigate the delivery issue for ${target}.

Steps:
1. ${message_id ? `Call sendgrid_troubleshoot_message with message_id="${message_id}"` : email ? `Call sendgrid_troubleshoot_recipient_delivery with email="${email}"` : `Call sendgrid_search_email_activity with subject="${subject ?? ""}" and review results`}
2. Call sendgrid_lookup_recipient_suppressions for the recipient email to check all suppression lists.
3. If the message bounced, call sendgrid_list_bounces to confirm and get full details.
4. Provide:
   - Current delivery status
   - Most likely cause with confidence level
   - Evidence from the activity log
   - Step-by-step recommended actions
   - Whether the issue is transient (retryable) or permanent`,
            },
          },
        ],
      };
    },
  );

  // ─── compare_sendgrid_time_ranges ─────────────────────────────────────────
  server.prompt(
    "compare_sendgrid_time_ranges",
    "Compare email performance between two time periods to identify trends.",
    {
      range_a_start: z.string().describe("Start date for period A (YYYY-MM-DD)"),
      range_a_end: z.string().describe("End date for period A (YYYY-MM-DD)"),
      range_b_start: z.string().describe("Start date for period B (YYYY-MM-DD)"),
      range_b_end: z.string().describe("End date for period B (YYYY-MM-DD)"),
    },
    ({ range_a_start, range_a_end, range_b_start, range_b_end }) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please compare email performance between these two periods:
- Period A: ${range_a_start} to ${range_a_end}
- Period B: ${range_b_start} to ${range_b_end}

Steps:
1. Call sendgrid_compare_stats_ranges with:
   - range_a: { start_date: "${range_a_start}", end_date: "${range_a_end}" }
   - range_b: { start_date: "${range_b_start}", end_date: "${range_b_end}" }
2. Analyze the comparison results and identify:
   - Volume changes
   - Delivery rate changes
   - Bounce rate trends
   - Open and click rate changes
   - Any concerning anomalies
3. Provide a clear narrative summary with:
   - Whether performance improved, declined, or stayed stable
   - The most significant metric changes
   - Hypotheses for any notable changes
   - Recommended actions based on the trends`,
            },
          },
        ],
      };
    },
  );

  // ─── review_template_for_transactional_use ───────────────────────────────
  server.prompt(
    "review_template_for_transactional_use",
    "Review a SendGrid template to confirm it is ready for transactional email production use.",
    {
      template_id: z.string().describe("The SendGrid template ID to review"),
    },
    ({ template_id }) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please review template ${template_id} for transactional production readiness.

Steps:
1. Call sendgrid_get_template_readiness_report with template_id="${template_id}"
2. Call sendgrid_get_template with template_id="${template_id}" for full version details
3. Review and report:
   - Readiness score and overall status
   - Whether there is an active version
   - Subject line completeness
   - Version history and last update date
   - Any blocking issues or warnings
   - Whether plain text content is available
   - Recommendation: ready / needs changes / blocked
4. If issues found, list them in priority order with remediation steps`,
            },
          },
        ],
      };
    },
  );

  // ─── safe_test_send_checklist ─────────────────────────────────────────────
  server.prompt(
    "safe_test_send_checklist",
    "Walk through a safe test-send checklist before sending a transactional email to production recipients.",
    {
      from_email: z.string().email().describe("Sender email address"),
      template_id: z.string().optional().describe("Template ID if using a template"),
      test_recipient: z.string().email().describe("Test recipient email address"),
    },
    ({ from_email, template_id, test_recipient }) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please run a safe test-send checklist for a send from ${from_email} to ${test_recipient}${template_id ? ` using template ${template_id}` : ""}.

Steps:
1. Call sendgrid_get_account_summary to verify the account is healthy and can send.
2. Call sendgrid_list_verified_senders to confirm ${from_email} is verified.
3. ${template_id ? `Call sendgrid_get_template_readiness_report with template_id="${template_id}" to check template readiness.` : "Confirm your email payload has both subject and content (text or HTML)."}
4. Call sendgrid_lookup_recipient_suppressions with email="${test_recipient}" to ensure the test recipient is not suppressed.
5. Call sendgrid_validate_send_payload with your actual send payload to run pre-send validation.
6. If all checks pass, use sendgrid_test_send_email with force_recipient="${test_recipient}" to send the test.
7. After sending, call sendgrid_search_email_activity with to_email="${test_recipient}" to verify delivery.

Report the status of each step and whether it is safe to proceed to production sending.`,
            },
          },
        ],
      };
    },
  );
}
