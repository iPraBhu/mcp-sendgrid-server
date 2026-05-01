/**
 * MCP tool definitions for IP Access Management.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IpAccessService } from "../../domains/ip-access/service.js";
import {
  AddIpToWhitelistInputSchema,
  ListIpAccessActivityInputSchema,
  RemoveIpFromWhitelistInputSchema,
} from "../../schemas/ip-access.js";
import { formatError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

export function registerIpAccessTools(
  server: McpServer,
  options: { analyticsMode?: boolean } = {},
): void {
  const { analyticsMode = false } = options;
  const service = new IpAccessService();

  server.tool(
    "sendgrid_list_ip_access_activity",
    "List recent IP access attempts against the SendGrid account. " +
      "This is the feed behind SendGrid IP access alert emails.",
    ListIpAccessActivityInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_list_ip_access_activity", input as Record<string, unknown>);
      try {
        const activity = await service.listAccessActivity(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: `${activity.length} recent IP access attempt(s) returned.`,
                  count: activity.length,
                  activity,
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
    "sendgrid_list_ip_whitelist",
    "List IP addresses and CIDR ranges currently allowed to access the SendGrid account.",
    {},
    async () => {
      logger.audit("sendgrid_list_ip_whitelist", {});
      try {
        const whitelist = await service.listWhitelist();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: `${whitelist.length} allowed IP rule(s) returned.`,
                  count: whitelist.length,
                  whitelist,
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

  // IP Access write tools are not registered in analytics mode.
  if (analyticsMode) return;

  server.tool(
    "sendgrid_add_ip_to_whitelist",
    "Add one or more IP addresses or CIDR ranges to the SendGrid IP allow list. " +
      "Requires SENDGRID_READ_ONLY=false, SENDGRID_WRITES_ENABLED=true, and a matching approval_token.",
    AddIpToWhitelistInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_add_ip_to_whitelist", { count: input.ips.length });
      try {
        const whitelist = await service.addIpToWhitelist(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: `${input.ips.length} IP address(es) submitted to the allow list.`,
                  added: input.ips,
                  whitelist,
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
    "sendgrid_remove_ip_from_whitelist",
    "Remove a specific IP address or CIDR range from the SendGrid IP allow list by rule ID. " +
      "Requires SENDGRID_READ_ONLY=false, SENDGRID_WRITES_ENABLED=true, and a matching approval_token.",
    RemoveIpFromWhitelistInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_remove_ip_from_whitelist", { rule_id: input.rule_id });
      try {
        await service.removeIpFromWhitelist(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: `Allowed IP rule ${input.rule_id} removed.`,
                  rule_id: input.rule_id,
                  deleted: true,
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
