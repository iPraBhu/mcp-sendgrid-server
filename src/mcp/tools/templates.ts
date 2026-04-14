/**
 * MCP tool definitions for Template operations.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TemplatesService } from "../../domains/templates/service.js";
import {
  ListTemplatesInputSchema,
  GetTemplateInputSchema,
  ListTemplateVersionsInputSchema,
  GetTemplateVersionInputSchema,
  GetTemplateReadinessInputSchema,
} from "../../schemas/templates.js";
import { formatError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

export function registerTemplateTools(server: McpServer): void {
  const service = new TemplatesService();

  server.tool(
    "sendgrid_list_templates",
    "List SendGrid email templates. Defaults to dynamic templates. " +
      "Returns template IDs, names, and version metadata.",
    ListTemplatesInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_list_templates", input as Record<string, unknown>);
      try {
        const result = await service.listTemplates(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: `Found ${result.templates.length} template(s). Total: ${result.total}.`,
                  templates: result.templates.map((t) => ({
                    id: t.id,
                    name: t.name,
                    generation: t.generation,
                    updated_at: t.updated_at,
                    version_count: t.versions?.length ?? 0,
                    active_version: t.versions?.find((v) => v.active === 1)?.name ?? "none",
                  })),
                  has_more: result.hasMore,
                  next_page_token: result.nextPageToken,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${formatError(err)}` }], isError: true };
      }
    },
  );

  server.tool(
    "sendgrid_get_template",
    "Get full details for a SendGrid template by ID, including all versions.",
    GetTemplateInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_get_template", { template_id: input.template_id });
      try {
        const template = await service.getTemplate(input.template_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: `Template "${template.name}" (${template.id})`,
                  id: template.id,
                  name: template.name,
                  generation: template.generation,
                  updated_at: template.updated_at,
                  versions: (template.versions ?? []).map((v) => ({
                    id: v.id,
                    name: v.name,
                    active: v.active === 1,
                    subject: v.subject,
                    updated_at: v.updated_at,
                    editor: v.editor,
                  })),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${formatError(err)}` }], isError: true };
      }
    },
  );

  server.tool(
    "sendgrid_list_template_versions",
    "List all versions for a SendGrid template.",
    ListTemplateVersionsInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_list_template_versions", { template_id: input.template_id });
      try {
        const versions = await service.listTemplateVersions(input.template_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: `${versions.length} version(s) for template ${input.template_id}.`,
                  template_id: input.template_id,
                  versions: versions.map((v) => ({
                    id: v.id,
                    name: v.name,
                    active: v.active === 1,
                    subject: v.subject,
                    updated_at: v.updated_at,
                    generate_plain_content: v.generate_plain_content,
                    editor: v.editor,
                  })),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${formatError(err)}` }], isError: true };
      }
    },
  );

  server.tool(
    "sendgrid_get_template_version",
    "Get detailed information about a specific template version, including subject and editor.",
    GetTemplateVersionInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_get_template_version", {
        template_id: input.template_id,
        version_id: input.version_id,
      });
      try {
        const version = await service.getTemplateVersion(input.template_id, input.version_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: `Version "${version.name}" for template ${input.template_id}`,
                  ...version,
                  active: version.active === 1,
                  // Omit large HTML/text content from default output
                  html_content: version.html_content ? `[${(version.html_content as string).length} chars]` : undefined,
                  plain_content: version.plain_content ? `[${(version.plain_content as string).length} chars]` : undefined,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${formatError(err)}` }], isError: true };
      }
    },
  );

  server.tool(
    "sendgrid_get_template_readiness_report",
    "Analyze a SendGrid template for transactional readiness. " +
      "Reports issues, warnings, and a readiness score. " +
      "Use before deploying a template to production.",
    GetTemplateReadinessInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_get_template_readiness_report", { template_id: input.template_id });
      try {
        const report = await service.getTemplateReadinessReport(input.template_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: report.recommendation,
                  template_id: report.template_id,
                  name: report.name,
                  readiness_score: report.readiness_score,
                  issues: report.issues,
                  warnings: report.warnings,
                  active_version: report.active_version
                    ? {
                        id: report.active_version.id,
                        name: report.active_version.name,
                        subject: report.active_version.subject,
                        updated_at: report.active_version.updated_at,
                      }
                    : null,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${formatError(err)}` }], isError: true };
      }
    },
  );
}
