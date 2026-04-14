/**
 * Email Activity / Message Troubleshooting domain service.
 * Note: The v3/messages API requires the Email Activity add-on (Pro/Premier plans).
 * This service handles that gracefully with informative errors.
 */

import { getSendGridClient } from "../../client/sendgrid-client.js";
import { SendGridApiError } from "../../utils/errors.js";
import type { z } from "zod";
import type {
  SearchEmailActivityInputSchema,
  GetMessageDetailsInputSchema,
  TroubleshootRecipientInputSchema,
} from "../../schemas/activity.js";

type SearchInput = z.infer<typeof SearchEmailActivityInputSchema>;
type GetDetailsInput = z.infer<typeof GetMessageDetailsInputSchema>;
type TroubleshootRecipientInput = z.infer<typeof TroubleshootRecipientInputSchema>;

interface ActivityMessage {
  msg_id: string;
  from_email: string;
  subject: string;
  to_email: string;
  status: string;
  opens_count: number;
  clicks_count: number;
  last_event_time: string;
  teammate?: string;
  template_id?: string;
  outbound_ip?: string;
}

interface ActivityResponse {
  messages: ActivityMessage[];
  _metadata?: { next?: string; count?: number; prev?: string };
}

interface MessageDetail extends ActivityMessage {
  events: Array<{
    event_name: string;
    processed: string;
    reason?: string;
    status?: string;
    bounce_classification?: string;
    http_user_agent?: string;
  }>;
}

export interface TroubleshootResult {
  email: string;
  message_id: string | undefined;
  status: string;
  events: MessageDetail["events"];
  likely_cause: string;
  evidence: string[];
  recommended_next_checks: string[];
  confidence: "high" | "medium" | "low";
}

export class ActivityService {
  private readonly client = getSendGridClient();

  async searchEmailActivity(input: SearchInput): Promise<{
    messages: ActivityMessage[];
    total: number;
    hasMore: boolean;
    nextPageToken?: string;
    planWarning?: string;
  }> {
    const query = this.buildActivityQuery(input);
    const params: Record<string, unknown> = { limit: input.limit ?? 25 };
    if (query) params["query"] = query;
    if (input.page_token) params["page_token"] = input.page_token;

    try {
      const res = await this.client.get<ActivityResponse>("/messages", params);
      const messages = res.messages ?? [];
      const nextPageToken = res._metadata?.next
        ? new URL("http://x?" + res._metadata.next.split("?")[1]).searchParams.get("page_token") ?? undefined
        : undefined;
      return {
        messages,
        total: res._metadata?.count ?? messages.length,
        hasMore: !!nextPageToken,
        nextPageToken,
      };
    } catch (err) {
      if (err instanceof SendGridApiError && err.normalized.isPlanLimitation) {
        return {
          messages: [],
          total: 0,
          hasMore: false,
          planWarning:
            "The Email Activity API (v3/messages) requires the SendGrid Email Activity add-on, " +
            "available on Pro and Premier plans. This endpoint returned 403 Forbidden. " +
            "See: https://docs.sendgrid.com/ui/analytics-and-reporting/email-activity-feed",
        };
      }
      throw err;
    }
  }

  async getMessageDetails(input: GetDetailsInput): Promise<{
    message?: MessageDetail;
    planWarning?: string;
  }> {
    try {
      const msg = await this.client.get<MessageDetail>(
        `/messages/${encodeURIComponent(input.message_id)}`,
      );
      return { message: msg };
    } catch (err) {
      if (err instanceof SendGridApiError && err.normalized.isPlanLimitation) {
        return {
          planWarning:
            "Message detail lookup requires the Email Activity add-on. " +
            "Please upgrade your SendGrid plan to access this feature.",
        };
      }
      throw err;
    }
  }

  async troubleshootMessage(
    messageId: string | undefined,
    toEmail: string | undefined,
    subject: string | undefined,
    afterTime: string | undefined,
  ): Promise<TroubleshootResult | { planWarning: string }> {
    const searchResult = await this.searchEmailActivity({
      message_id: messageId,
      to_email: toEmail,
      subject,
      after_time: afterTime,
      limit: 5,
    });

    if (searchResult.planWarning) {
      return { planWarning: searchResult.planWarning };
    }

    if (searchResult.messages.length === 0) {
      return {
        email: toEmail ?? "unknown",
        message_id: messageId,
        status: "not_found",
        events: [],
        likely_cause: "No messages found matching the search criteria.",
        evidence: ["No results returned from activity search."],
        recommended_next_checks: [
          "Verify the recipient address or subject is correct.",
          "Expand the time range.",
          "Check if the message was sent from a different sender.",
        ],
        confidence: "low",
      };
    }

    const msg = searchResult.messages[0]!;
    const detail = messageId ? await this.getMessageDetails({ message_id: msg.msg_id }) : { message: undefined };

    return this.analyzeMessage(msg, detail.message);
  }

  async troubleshootRecipient(
    input: TroubleshootRecipientInput,
  ): Promise<TroubleshootResult | { planWarning: string }> {
    return this.troubleshootMessage(undefined, input.email, undefined, undefined);
  }

  private analyzeMessage(msg: ActivityMessage, detail?: MessageDetail): TroubleshootResult {
    const events = detail?.events ?? [];
    const evidence: string[] = [];
    const recommended: string[] = [];
    let likelyCause = "Unknown";
    let confidence: "high" | "medium" | "low" = "low";

    switch (msg.status) {
      case "delivered":
        likelyCause = "Message was delivered successfully.";
        confidence = "high";
        evidence.push(`Last event: ${msg.last_event_time}`);
        if (msg.opens_count === 0) recommended.push("Message was delivered but not yet opened — check subject line and preview text.");
        break;
      case "bounce":
        likelyCause = "Recipient mailbox rejected the message (hard or soft bounce).";
        confidence = "high";
        const bounceEvent = events.find((e) => e.event_name === "bounce");
        if (bounceEvent?.reason) evidence.push(`Bounce reason: ${bounceEvent.reason}`);
        if (bounceEvent?.bounce_classification) evidence.push(`Classification: ${bounceEvent.bounce_classification}`);
        recommended.push("Check bounce type: hard bounces indicate invalid addresses.");
        recommended.push("Remove hard bounced addresses from your sending lists.");
        recommended.push("Use sendgrid_list_bounces to see full bounce details.");
        break;
      case "deferred":
        likelyCause = "Receiving server temporarily rejected the message. SendGrid will retry.";
        confidence = "high";
        evidence.push("Delivery was deferred — SendGrid retries for up to 72 hours.");
        recommended.push("Wait for automatic retries or check again in 1-2 hours.");
        recommended.push("Verify the recipient domain has valid MX records.");
        break;
      case "dropped":
        likelyCause = "Message was dropped before send due to a suppression or policy.";
        confidence = "high";
        const dropEvent = events.find((e) => e.event_name === "dropped");
        if (dropEvent?.reason) evidence.push(`Drop reason: ${dropEvent.reason}`);
        recommended.push("Use sendgrid_lookup_recipient_suppressions to check suppression status.");
        recommended.push("Common causes: unsubscribe, bounce suppression, spam report.");
        break;
      case "spam_report":
        likelyCause = "Recipient marked the email as spam.";
        confidence = "high";
        recommended.push("Review email content and sending frequency.");
        recommended.push("Use sendgrid_list_spam_reports to see full list.");
        break;
    }

    return {
      email: msg.to_email,
      message_id: msg.msg_id,
      status: msg.status,
      events,
      likely_cause: likelyCause,
      evidence,
      recommended_next_checks: recommended,
      confidence,
    };
  }

  private buildActivityQuery(input: SearchInput): string {
    const clauses: string[] = [];
    if (input.to_email) clauses.push(`to_email="${input.to_email}"`);
    if (input.from_email) clauses.push(`from_email="${input.from_email}"`);
    if (input.subject) clauses.push(`subject="${input.subject}"`);
    if (input.status) clauses.push(`status="${input.status}"`);
    if (input.message_id) clauses.push(`msg_id="${input.message_id}"`);
    if (input.after_time) clauses.push(`last_event_time>="${input.after_time}"`);
    if (input.before_time) clauses.push(`last_event_time<="${input.before_time}"`);
    if (input.categories?.length) {
      clauses.push(`(${input.categories.map((c) => `categories="${c}"`).join(" OR ")})`);
    }
    return clauses.join(" AND ");
  }
}
