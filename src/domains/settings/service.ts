/**
 * Settings domain service (tracking settings, mail settings).
 */

import { getSendGridClient } from "../../client/sendgrid-client.js";
import type { TrackingSettings, MailSettings } from "../../schemas/settings.js";

interface SettingResult<T> {
  result: T;
}

export class SettingsService {
  private readonly client = getSendGridClient();

  async getTrackingSettings(): Promise<TrackingSettings> {
    const res = await this.client.get<SettingResult<TrackingSettings>>("/tracking_settings");
    // Some versions of the API wrap in 'result', others return directly
    return (res as unknown as TrackingSettings).click_tracking !== undefined
      ? (res as unknown as TrackingSettings)
      : res.result;
  }

  async getMailSettings(): Promise<MailSettings> {
    const res = await this.client.get<SettingResult<MailSettings>>("/mail_settings");
    return (res as unknown as MailSettings).bypass_list_management !== undefined
      ? (res as unknown as MailSettings)
      : res.result;
  }
}
