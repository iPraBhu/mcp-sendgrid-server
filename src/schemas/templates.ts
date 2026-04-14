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
