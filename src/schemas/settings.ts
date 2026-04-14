/**
 * Zod schemas for Settings operations (tracking, mail).
 */

import { z } from "zod";

export const GetTrackingSettingsInputSchema = z.object({}).describe("No parameters required");

export const GetMailSettingsInputSchema = z.object({}).describe("No parameters required");

export interface TrackingSettings {
  click_tracking: { enabled: boolean; enable_text?: boolean };
  open_tracking: { enabled: boolean; substitution_tag?: string };
  subscription_tracking: {
    enabled: boolean;
    text?: string;
    html?: string;
    substitution_tag?: string;
  };
  google_analytics: {
    enabled: boolean;
    utm_source?: string;
    utm_medium?: string;
    utm_term?: string;
    utm_content?: string;
    utm_campaign?: string;
  };
}

export interface MailSettings {
  bypass_list_management: { enabled: boolean };
  bypass_spam_management: { enabled: boolean };
  bypass_bounce_management: { enabled: boolean };
  bypass_unsubscribe_management: { enabled: boolean };
  footer: { enabled: boolean; text?: string; html?: string };
  forward_spam: { enabled: boolean; email?: string };
  plain_content: { enabled: boolean };
  sandbox_mode: { enabled: boolean };
  address_whitelist: { enabled: boolean; list?: string[] };
}
