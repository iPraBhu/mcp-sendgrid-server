/**
 * IP Access Management domain service.
 * Handles recent access attempts and IP allow-list management.
 */

import { getSendGridClient } from "../../client/sendgrid-client.js";
import { assertWriteApproved } from "../../utils/policy.js";
import type { z } from "zod";
import type {
  AddIpToWhitelistInputSchema,
  IpAccessActivityEntry,
  IpAccessActivityResponse,
  IpWhitelistEntry,
  IpWhitelistResponse,
  ListIpAccessActivityInputSchema,
  RemoveIpFromWhitelistInputSchema,
} from "../../schemas/ip-access.js";

type ListActivityInput = z.infer<typeof ListIpAccessActivityInputSchema>;
type AddIpInput = z.infer<typeof AddIpToWhitelistInputSchema>;
type RemoveIpInput = z.infer<typeof RemoveIpFromWhitelistInputSchema>;

export class IpAccessService {
  private readonly client = getSendGridClient();

  async listAccessActivity(input: ListActivityInput): Promise<IpAccessActivityEntry[]> {
    const params: Record<string, unknown> = {};
    if (input.limit !== undefined) params["limit"] = input.limit;

    const response = await this.client.get<IpAccessActivityResponse>("/access_settings/activity", params);
    return response.result ?? [];
  }

  async listWhitelist(): Promise<IpWhitelistEntry[]> {
    const response = await this.client.get<IpWhitelistResponse>("/access_settings/whitelist");
    return response.result ?? [];
  }

  async addIpToWhitelist(input: AddIpInput): Promise<IpWhitelistEntry[]> {
    assertWriteApproved("sendgrid_add_ip_to_whitelist", input.approval_token);
    const response = await this.client.post<IpWhitelistResponse>("/access_settings/whitelist", {
      ips: input.ips.map((ip) => ({ ip })),
    });
    return response.result ?? [];
  }

  async removeIpFromWhitelist(input: RemoveIpInput): Promise<void> {
    assertWriteApproved("sendgrid_remove_ip_from_whitelist", input.approval_token);
    await this.client.request({
      method: "DELETE",
      path: `/access_settings/whitelist/${encodeURIComponent(input.rule_id)}`,
      noRetry: false,
    });
  }
}
