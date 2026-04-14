/**
 * Zod schemas for Sender / Domain operations.
 */

import { z } from "zod";

export const ListVerifiedSendersInputSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  lastSeenId: z.number().int().optional().describe("Pagination cursor (last seen sender ID)"),
  id: z.number().int().optional().describe("Filter by specific verified sender ID"),
});

export interface VerifiedSender {
  id: number;
  nickname: string;
  from_email: string;
  from_name?: string;
  reply_to?: string;
  address?: string;
  city?: string;
  country?: string;
  verified: boolean;
  locked: boolean;
}

export interface DomainAuthentication {
  id: number;
  domain: string;
  username?: string;
  valid: boolean;
  legacy: boolean;
  default: boolean;
  dns?: {
    mail_cname?: { valid: boolean; type: string; host: string; data: string };
    dkim1?: { valid: boolean; type: string; host: string; data: string };
    dkim2?: { valid: boolean; type: string; host: string; data: string };
  };
}
