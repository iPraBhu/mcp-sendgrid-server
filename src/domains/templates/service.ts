/**
 * Templates domain service.
 */

import { getSendGridClient } from "../../client/sendgrid-client.js";
import { assertWriteApproved } from "../../utils/policy.js";
import type {
  Template,
  TemplateVersion,
  TemplateReadinessReport,
  ListTemplatesInputSchema,
  CreateTemplateInputSchema,
  ActivateTemplateVersionInputSchema,
  CreateTemplateVersionInputSchema,
} from "../../schemas/templates.js";
import type { z } from "zod";

type ListTemplatesInput = z.infer<typeof ListTemplatesInputSchema>;
type CreateTemplateInput = z.infer<typeof CreateTemplateInputSchema>;
type ActivateVersionInput = z.infer<typeof ActivateTemplateVersionInputSchema>;
type CreateVersionInput = z.infer<typeof CreateTemplateVersionInputSchema>;

interface TemplateListResponse {
  result: Template[];
  _metadata?: { next_params?: { page_token?: string }; count?: number };
}

export class TemplatesService {
  private readonly client = getSendGridClient();

  async listTemplates(input: ListTemplatesInput): Promise<{
    templates: Template[];
    total: number;
    hasMore: boolean;
    nextPageToken?: string;
  }> {
    const params: Record<string, unknown> = {
      generations: input.generations ?? "dynamic",
      page_size: input.page_size ?? 25,
    };
    if (input.page_token) params["page_token"] = input.page_token;

    const res = await this.client.get<TemplateListResponse>("/templates", params);
    const templates = res.result ?? [];
    const nextPageToken = res._metadata?.next_params?.page_token;
    return {
      templates,
      total: res._metadata?.count ?? templates.length,
      hasMore: !!nextPageToken,
      nextPageToken,
    };
  }

  async getTemplate(templateId: string): Promise<Template> {
    return this.client.get<Template>(`/templates/${encodeURIComponent(templateId)}`);
  }

  async listTemplateVersions(templateId: string): Promise<TemplateVersion[]> {
    const template = await this.getTemplate(templateId);
    return template.versions ?? [];
  }

  async getTemplateVersion(templateId: string, versionId: string): Promise<TemplateVersion> {
    return this.client.get<TemplateVersion>(
      `/templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(versionId)}`,
    );
  }

  // ─── Write operations (require approval token) ────────────────────────────

  async createTemplate(input: CreateTemplateInput): Promise<Template> {
    assertWriteApproved("sendgrid_create_template", input.approval_token);
    return this.client.post<Template>("/templates", {
      name: input.name,
      generation: input.generation ?? "dynamic",
    });
  }

  async activateTemplateVersion(input: ActivateVersionInput): Promise<TemplateVersion> {
    assertWriteApproved("sendgrid_activate_template_version", input.approval_token);
    return this.client.post<TemplateVersion>(
      `/templates/${encodeURIComponent(input.template_id)}/versions/${encodeURIComponent(input.version_id)}/activate`,
      {},
    );
  }

  async createTemplateVersion(input: CreateVersionInput): Promise<TemplateVersion> {
    assertWriteApproved("sendgrid_create_template_version", input.approval_token);
    const body: Record<string, unknown> = {
      name: input.name,
      generate_plain_content: input.generate_plain_content ?? true,
      active: input.active ?? 0,
    };
    if (input.subject !== undefined) body["subject"] = input.subject;
    if (input.html_content !== undefined) body["html_content"] = input.html_content;
    if (input.plain_content !== undefined) body["plain_content"] = input.plain_content;
    return this.client.post<TemplateVersion>(
      `/templates/${encodeURIComponent(input.template_id)}/versions`,
      body,
    );
  }

  async getTemplateReadinessReport(templateId: string): Promise<TemplateReadinessReport> {
    const template = await this.getTemplate(templateId);
    const versions = template.versions ?? [];
    const activeVersion = versions.find((v) => v.active === 1);

    const issues: string[] = [];
    const warnings: string[] = [];

    if (versions.length === 0) {
      issues.push("Template has no versions. A version is required before sending.");
    }

    if (!activeVersion) {
      issues.push("No active version found. Mark a version as active before using in sends.");
    } else {
      if (!activeVersion.subject) {
        warnings.push("Active version has no subject line set. Subject must be set on send or in the template.");
      }
      if (activeVersion.generate_plain_content === false) {
        warnings.push("Plain text content generation is disabled. Some email clients prefer plain text.");
      }
    }

    if (template.generation !== "dynamic") {
      warnings.push("Template uses legacy generation. Consider migrating to dynamic templates.");
    }

    let readinessScore = 100;
    readinessScore -= issues.length * 30;
    readinessScore -= warnings.length * 10;
    readinessScore = Math.max(0, readinessScore);

    let recommendation = "Template appears ready for transactional use.";
    if (issues.length > 0) {
      recommendation = "Template has blocking issues that must be resolved before sending.";
    } else if (warnings.length > 0) {
      recommendation = "Template is usable but has warnings worth reviewing.";
    }

    return {
      template_id: templateId,
      name: template.name,
      active_version: activeVersion,
      issues,
      warnings,
      readiness_score: readinessScore,
      recommendation,
    };
  }
}
