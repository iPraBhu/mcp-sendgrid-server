/**
 * Account domain service.
 * Aggregates account summary / health from multiple endpoints.
 */

import { getSendGridClient } from "../../client/sendgrid-client.js";
import { logger } from "../../utils/logger.js";

interface UserProfile {
  address?: string;
  city?: string;
  company?: string;
  country?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  state?: string;
  username?: string;
  website?: string;
}

interface UserCredits {
  remain: number;
  total: number;
  overage: number;
  used: number;
  last_reset?: string;
  next_reset?: string;
  type?: string;
}

interface Subuser {
  id: number;
  username: string;
  email: string;
  disabled: boolean;
}

export interface AccountSummary {
  username: string | undefined;
  company: string | undefined;
  country: string | undefined;
  credits:
    | {
        remain: number;
        total: number;
        used: number;
        overage: number;
        type: string | undefined;
        next_reset: string | undefined;
      }
    | undefined;
  subusers_count: number | undefined;
  health_notes: string[];
  capabilities: {
    can_send: boolean;
    has_verified_senders: boolean;
    note: string | undefined;
  };
}

export class AccountService {
  private readonly client = getSendGridClient();

  async getAccountSummary(): Promise<AccountSummary> {
    const [profileResult, creditsResult, subusersResult, verifiedSendersResult] =
      await Promise.allSettled([
        this.client.get<UserProfile>("/user/profile"),
        this.client.get<UserCredits>("/user/credits"),
        this.client.get<Subuser[]>("/subusers"),
        this.client.get<{ results?: unknown[] }>("/verified_senders", { limit: 1 }),
      ]);

    const profile = profileResult.status === "fulfilled" ? profileResult.value : null;
    const credits = creditsResult.status === "fulfilled" ? creditsResult.value : null;
    const subusers = subusersResult.status === "fulfilled" ? subusersResult.value : null;
    const senders = verifiedSendersResult.status === "fulfilled" ? verifiedSendersResult.value : null;

    if (profileResult.status === "rejected") {
      logger.warn("Could not fetch user profile for account summary", {
        error: String(profileResult.reason),
      });
    }

    const healthNotes: string[] = [];

    if (credits) {
      const remainPct = credits.total > 0 ? (credits.remain / credits.total) * 100 : 0;
      if (remainPct < 10) {
        healthNotes.push(`⚠️ Low email credits: ${credits.remain} remaining of ${credits.total}.`);
      }
      if (credits.overage > 0) {
        healthNotes.push(`ℹ️ Overage credits in use: ${credits.overage}.`);
      }
    }

    const hasVerifiedSenders =
      senders !== null && (senders.results?.length ?? 0) > 0;

    if (!hasVerifiedSenders) {
      healthNotes.push(
        "⚠️ No verified sender identities found. Email sends will fail without a verified sender.",
      );
    }

    return {
      username: profile?.username,
      company: profile?.company,
      country: profile?.country,
      credits: credits
        ? {
            remain: credits.remain,
            total: credits.total,
            used: credits.used,
            overage: credits.overage,
            type: credits.type,
            next_reset: credits.next_reset,
          }
        : undefined,
      subusers_count: Array.isArray(subusers) ? subusers.length : undefined,
      health_notes: healthNotes,
      capabilities: {
        can_send: hasVerifiedSenders,
        has_verified_senders: hasVerifiedSenders,
        note: hasVerifiedSenders
          ? "Account appears ready to send."
          : "Verify at least one sender identity before sending.",
      },
    };
  }

  async getRecentOperationalSummary(): Promise<{
    account: AccountSummary;
    recent_suppressions_warning?: string;
    ready_to_send: boolean;
    action_items: string[];
  }> {
    const account = await this.getAccountSummary();
    const actionItems: string[] = [...account.health_notes];

    if (!account.capabilities.can_send) {
      actionItems.push("Set up a verified sender identity in SendGrid Settings → Sender Authentication.");
    }

    return {
      account,
      ready_to_send: account.capabilities.can_send,
      action_items: actionItems,
    };
  }
}
