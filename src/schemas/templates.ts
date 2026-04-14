/**
 * Zod schemas for Template operations.
 */

import { z } from "zod";

export const ListTemplatesInputSchema = z.object({
  generations: z
    .enum(["legacy", "dynamic", "legacy,dynamic"])
    .optional()
    .default("dynamic")
    .describe("Template generation type to list"),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .describe("Number of templates to return"),
  page_token: z.string().optional().describe("Pagination token"),
});

export const GetTemplateInputSchema = z.object({
  template_id: z.string().min(1).describe("SendGrid template ID"),
});

export const ListTemplateVersionsInputSchema = z.object({
  template_id: z.string().min(1).describe("SendGrid template ID"),
});

export const GetTemplateVersionInputSchema = z.object({
  template_id: z.string().min(1).describe("SendGrid template ID"),
  version_id: z.string().min(1).describe("Template version ID"),
});

export const GetTemplateReadinessInputSchema = z.object({
  template_id: z.string().min(1).describe("Template ID to analyze for transactional readiness"),
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

export const CreateTemplateInputSchema = WriteApprovalSchema.extend({
  name: z.string().min(1).max(100).describe("Name for the new template"),
  generation: z
    .enum(["dynamic", "legacy"])
    .optional()
    .default("dynamic")
    .describe("Template generation type (use 'dynamic' for Handlebars-based templates)"),
});

export const ActivateTemplateVersionInputSchema = WriteApprovalSchema.extend({
  template_id: z.string().min(1).describe("SendGrid template ID"),
  version_id: z.string().min(1).describe("Version ID to activate"),
});

export const CreateTemplateVersionInputSchema = WriteApprovalSchema.extend({
  template_id: z.string().min(1).describe("Template ID to add a version to"),
  name: z.string().min(1).max(100).describe("Name for the new version"),
  subject: z.string().optional().describe("Email subject line (can include Handlebars variables)"),
  html_content: z.string().optional().describe("HTML body (can include Handlebars variables)"),
  plain_content: z.string().optional().describe("Plain-text body; leave empty to auto-generate"),
  generate_plain_content: z
    .boolean()
    .optional()
    .default(true)
    .describe("Auto-generate plain text from HTML content"),
  active: z
    .number()
    .int()
    .min(0)
    .max(1)
    .optional()
    .default(0)
    .describe("Set to 1 to immediately activate this version"),
});

export interface TemplateVersion {
  id: string;
  template_id: string;
  active: number;
  name: string;
  subject: string;
  updated_at: string;
  generate_plain_content: boolean;
  editor: string;
  html_content?: string;
  plain_content?: string;
}

export interface Template {
  id: string;
  name: string;
  generation: string;
  updated_at: string;
  versions: TemplateVersion[];
}

export interface TemplateReadinessReport {
  template_id: string;
  name: string;
  active_version?: TemplateVersion;
  issues: string[];
  warnings: string[];
  readiness_score: number;
  recommendation: string;
}
