/**
 * Zod schemas for Suppression management.
 */

import { z } from "zod";
import { PaginationSchema } from "./common.js";

export const ListSuppressionsInputSchema = PaginationSchema.extend({
  start_time: z.number().int().optional().describe("Filter: Unix timestamp start"),
  end_time: z.number().int().optional().describe("Filter: Unix timestamp end"),
  email: z.string().email().optional().describe("Filter by specific email address"),
});

export const LookupRecipientSuppressionsInputSchema = z.object({
  email: z.string().email().describe("Email address to check for suppressions"),
});

// ─── Write schemas ──────────────────────────────────────────────────────────

const WriteApprovalSchema = z.object({
  approval_token: z
    .string()
    .min(1)
    .describe(
      "Manual runtime approval token for write operations. Must match SENDGRID_WRITE_APPROVAL_TOKEN when writes are enabled.",
    ),
});

export const DeleteSuppressionInputSchema = WriteApprovalSchema.extend({
  email: z.string().email().describe("Email address to remove from the suppression list"),
});

export const AddGlobalUnsubscribeInputSchema = WriteApprovalSchema.extend({
  emails: z
    .array(z.string().email())
    .min(1)
    .max(25)
    .describe("Email address(es) to add to the global unsubscribe list (max 25 per call)"),
});

export interface SuppressionEntry {
  email: string;
  created?: number;
  reason?: string;
  status?: string;
  error_code?: string;
  description?: string;
  classification?: string;
}

export interface SuppressionsOverview {
  bounces: { count: number; sample: SuppressionEntry[] };
  blocks: { count: number; sample: SuppressionEntry[] };
  invalid_emails: { count: number; sample: SuppressionEntry[] };
  spam_reports: { count: number; sample: SuppressionEntry[] };
  unsubscribes: { count: number; sample: SuppressionEntry[] };
  total_suppressed: number;
  summary: string;
}

export interface RecipientSuppressions {
  email: string;
  bounced: boolean;
  blocked: boolean;
  invalid: boolean;
  spam_reported: boolean;
  unsubscribed: boolean;
  details: SuppressionEntry[];
  suppression_reason: string;
  recommended_action: string;
}
