/**
 * Senders / Domain Authentication domain service.
 */

import { getSendGridClient } from "../../client/sendgrid-client.js";
import type { VerifiedSender, DomainAuthentication } from "../../schemas/senders.js";
import type { z } from "zod";
import type { ListVerifiedSendersInputSchema } from "../../schemas/senders.js";

type ListInput = z.infer<typeof ListVerifiedSendersInputSchema>;

interface VerifiedSendersResponse {
  results: VerifiedSender[];
}

interface DomainAuthListResponse {
  result: DomainAuthentication[];
}

export class SendersService {
  private readonly client = getSendGridClient();

  async listVerifiedSenders(input: ListInput): Promise<{
    senders: VerifiedSender[];
    hasMore: boolean;
  }> {
    const params: Record<string, unknown> = { limit: input.limit ?? 25 };
    if (input.lastSeenId !== undefined) params["lastSeenId"] = input.lastSeenId;
    if (input.id !== undefined) params["id"] = input.id;

    const res = await this.client.get<VerifiedSendersResponse>("/verified_senders", params);
    const senders = res.results ?? [];
    return {
      senders,
      hasMore: senders.length >= (input.limit ?? 25),
    };
  }

  async getDomainAuthentications(): Promise<DomainAuthentication[]> {
    try {
      const res = await this.client.get<DomainAuthListResponse>("/whitelabel/domains");
      return res.result ?? (res as unknown as DomainAuthentication[]);
    } catch {
      // Not all plans support this endpoint
      return [];
    }
  }
}
