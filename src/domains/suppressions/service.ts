/**
 * Suppressions domain service.
 * Handles bounces, blocks, invalid emails, spam reports, unsubscribes.
 */

import { getSendGridClient } from "../../client/sendgrid-client.js";
import { buildOffsetParams } from "../../utils/pagination.js";
import { assertWriteApproved } from "../../utils/policy.js";
import type { z } from "zod";
import type {
  ListSuppressionsInputSchema,
  LookupRecipientSuppressionsInputSchema,
  DeleteSuppressionInputSchema,
  AddGlobalUnsubscribeInputSchema,
  SuppressionEntry,
  SuppressionsOverview,
  RecipientSuppressions,
} from "../../schemas/suppressions.js";

type ListInput = z.infer<typeof ListSuppressionsInputSchema>;
type LookupInput = z.infer<typeof LookupRecipientSuppressionsInputSchema>;
type DeleteInput = z.infer<typeof DeleteSuppressionInputSchema>;
type AddUnsubscribeInput = z.infer<typeof AddGlobalUnsubscribeInputSchema>;

export class SuppressionsService {
  private readonly client = getSendGridClient();

  async listBounces(input: ListInput): Promise<SuppressionEntry[]> {
    const params = this.buildParams(input);
    return this.client.get<SuppressionEntry[]>("/suppression/bounces", params);
  }

  async listBlocks(input: ListInput): Promise<SuppressionEntry[]> {
    const params = this.buildParams(input);
    return this.client.get<SuppressionEntry[]>("/suppression/blocks", params);
  }

  async listInvalidEmails(input: ListInput): Promise<SuppressionEntry[]> {
    const params = this.buildParams(input);
    return this.client.get<SuppressionEntry[]>("/suppression/invalid_emails", params);
  }

  async listSpamReports(input: ListInput): Promise<SuppressionEntry[]> {
    const params = this.buildParams(input);
    return this.client.get<SuppressionEntry[]>("/suppression/spam_reports", params);
  }

  async listUnsubscribes(input: ListInput): Promise<SuppressionEntry[]> {
    const params = this.buildParams(input);
    // Global suppressions / unsubscribes
    return this.client.get<SuppressionEntry[]>("/suppression/unsubscribes", params);
  }

  async getSuppressionsOverview(): Promise<SuppressionsOverview> {
    const defaultInput: ListInput = { limit: 10, offset: 0 };
    const [bounces, blocks, invalid, spam, unsubs] = await Promise.allSettled([
      this.listBounces(defaultInput),
      this.listBlocks(defaultInput),
      this.listInvalidEmails(defaultInput),
      this.listSpamReports(defaultInput),
      this.listUnsubscribes(defaultInput),
    ]);

    const extract = (r: PromiseSettledResult<SuppressionEntry[]>) =>
      r.status === "fulfilled" ? r.value : [];

    const b = extract(bounces);
    const bl = extract(blocks);
    const inv = extract(invalid);
    const sp = extract(spam);
    const u = extract(unsubs);

    const total = b.length + bl.length + inv.length + sp.length + u.length;

    return {
      bounces: { count: b.length, sample: b.slice(0, 5) },
      blocks: { count: bl.length, sample: bl.slice(0, 5) },
      invalid_emails: { count: inv.length, sample: inv.slice(0, 5) },
      spam_reports: { count: sp.length, sample: sp.slice(0, 5) },
      unsubscribes: { count: u.length, sample: u.slice(0, 5) },
      total_suppressed: total,
      summary:
        total === 0
          ? "No suppressions found in the default page (first 10 per list)."
          : `Found ${b.length} bounce(s), ${bl.length} block(s), ${inv.length} invalid email(s), ${sp.length} spam report(s), ${u.length} unsubscribe(s) in the first page of each suppression list. Use individual list tools for full data.`,
    };
  }

  async lookupRecipientSuppressions(input: LookupInput): Promise<RecipientSuppressions> {
    const email = input.email.toLowerCase();

    const [bounces, blocks, invalid, spam, unsubs] = await Promise.allSettled([
      this.client.get<SuppressionEntry[]>(`/suppression/bounces/${encodeURIComponent(email)}`),
      this.client.get<SuppressionEntry[]>(`/suppression/blocks/${encodeURIComponent(email)}`),
      this.client.get<SuppressionEntry[]>(`/suppression/invalid_emails/${encodeURIComponent(email)}`),
      this.client.get<SuppressionEntry[]>(`/suppression/spam_reports/${encodeURIComponent(email)}`),
      this.client.get<SuppressionEntry[]>(`/suppression/unsubscribes/${encodeURIComponent(email)}`),
    ]);

    const safeGet = (r: PromiseSettledResult<SuppressionEntry[]>): SuppressionEntry[] => {
      if (r.status === "fulfilled") return Array.isArray(r.value) ? r.value : [r.value].filter(Boolean) as SuppressionEntry[];
      return [];
    };

    const bounceEntries = safeGet(bounces);
    const blockEntries = safeGet(blocks);
    const invalidEntries = safeGet(invalid);
    const spamEntries = safeGet(spam);
    const unsubEntries = safeGet(unsubs);

    const allDetails = [
      ...bounceEntries.map((e) => ({ ...e, status: e.status ?? "bounced" })),
      ...blockEntries.map((e) => ({ ...e, status: e.status ?? "blocked" })),
      ...invalidEntries.map((e) => ({ ...e, status: e.status ?? "invalid" })),
      ...spamEntries.map((e) => ({ ...e, status: e.status ?? "spam_report" })),
      ...unsubEntries.map((e) => ({ ...e, status: e.status ?? "unsubscribed" })),
    ];

    const bounced = bounceEntries.length > 0;
    const blocked = blockEntries.length > 0;
    const inv = invalidEntries.length > 0;
    const spamReported = spamEntries.length > 0;
    const unsubscribed = unsubEntries.length > 0;

    let suppression_reason = "No suppressions found for this address.";
    const recommended = ["Address appears deliverable via SendGrid."];

    if (inv) {
      suppression_reason = "Address is marked as invalid (undeliverable).";
      recommended.splice(0, 1, "Do not send to this address — it is permanently invalid.");
    } else if (bounced) {
      const reason = bounceEntries[0]?.reason ?? "unknown";
      suppression_reason = `Address has a bounce on record: ${reason}`;
      recommended.splice(0, 1, "Remove from sending list if hard bounce. Investigate if soft bounce.");
    } else if (spamReported) {
      suppression_reason = "Recipient has filed a spam complaint.";
      recommended.splice(0, 1, "Do not contact this recipient again.");
    } else if (unsubscribed) {
      suppression_reason = "Recipient has unsubscribed from email.";
      recommended.splice(0, 1, "Respect the unsubscribe. Do not send without re-opt-in.");
    } else if (blocked) {
      suppression_reason = "Address is blocked (usually due to content or IP reputation).";
      recommended.splice(0, 1, "Investigate block reason. May clear automatically.");
    }

    return {
      email,
      bounced,
      blocked,
      invalid: inv,
      spam_reported: spamReported,
      unsubscribed,
      details: allDetails,
      suppression_reason,
      recommended_action: recommended.join(" "),
    };
  }

  // ─── Write operations (require approval token) ────────────────────────────

  async deleteBounce(input: DeleteInput): Promise<void> {
    assertWriteApproved("sendgrid_delete_bounce", input.approval_token);
    await this.client.request({ method: "DELETE", path: `/suppression/bounces/${encodeURIComponent(input.email)}`, noRetry: false });
  }

  async deleteBlock(input: DeleteInput): Promise<void> {
    assertWriteApproved("sendgrid_delete_block", input.approval_token);
    await this.client.request({ method: "DELETE", path: `/suppression/blocks/${encodeURIComponent(input.email)}`, noRetry: false });
  }

  async deleteInvalidEmail(input: DeleteInput): Promise<void> {
    assertWriteApproved("sendgrid_delete_invalid_email", input.approval_token);
    await this.client.request({ method: "DELETE", path: `/suppression/invalid_emails/${encodeURIComponent(input.email)}`, noRetry: false });
  }

  async deleteSpamReport(input: DeleteInput): Promise<void> {
    assertWriteApproved("sendgrid_delete_spam_report", input.approval_token);
    await this.client.request({ method: "DELETE", path: `/suppression/spam_reports/${encodeURIComponent(input.email)}`, noRetry: false });
  }

  async deleteGlobalUnsubscribe(input: DeleteInput): Promise<void> {
    assertWriteApproved("sendgrid_delete_global_unsubscribe", input.approval_token);
    await this.client.request({ method: "DELETE", path: `/asm/suppressions/global/${encodeURIComponent(input.email)}`, noRetry: false });
  }

  async addGlobalUnsubscribes(input: AddUnsubscribeInput): Promise<{ recipient_emails: string[] }> {
    assertWriteApproved("sendgrid_add_global_unsubscribes", input.approval_token);
    return this.client.post<{ recipient_emails: string[] }>("/asm/suppressions/global", {
      recipient_emails: input.emails,
    });
  }

  private buildParams(input: ListInput): Record<string, unknown> {
    const { limit, offset } = buildOffsetParams(input.limit, input.offset);
    const params: Record<string, unknown> = { limit, offset };
    if (input.start_time !== undefined) params["start_time"] = input.start_time;
    if (input.end_time !== undefined) params["end_time"] = input.end_time;
    if (input.email) params["email"] = input.email;
    return params;
  }
}
