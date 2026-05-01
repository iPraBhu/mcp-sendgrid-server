/**
 * Zod schemas for IP Access Management.
 */

import { z } from "zod";

const WriteApprovalSchema = z.object({
  approval_token: z
    .string()
    .min(1)
    .describe(
      "Manual runtime approval token for write operations. Must match SENDGRID_WRITE_APPROVAL_TOKEN when writes are enabled.",
    ),
});

export const ListIpAccessActivityInputSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().describe("Number of recent access attempts to return"),
});

export const AddIpToWhitelistInputSchema = WriteApprovalSchema.extend({
  ips: z
    .array(z.string().min(1))
    .min(1)
    .max(25)
    .describe("IP address(es) or CIDR ranges to add to the allow list"),
});

export const RemoveIpFromWhitelistInputSchema = WriteApprovalSchema.extend({
  rule_id: z.string().min(1).describe("Allowed IP rule ID to remove"),
});

export interface IpAccessActivityEntry {
  allowed?: boolean;
  auth_method?: string;
  first_at?: number;
  ip?: string;
  last_at?: number;
  location?: string;
}

export interface IpWhitelistEntry {
  id?: number;
  ip?: string;
  created_at?: number;
  updated_at?: number;
}

export interface IpAccessActivityResponse {
  result?: IpAccessActivityEntry[];
}

export interface IpWhitelistResponse {
  result?: IpWhitelistEntry[];
}
