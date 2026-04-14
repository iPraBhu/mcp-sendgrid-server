/**
 * MCP tool definitions for Senders / Domain Authentication.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SendersService } from "../../domains/senders/service.js";
import { ListVerifiedSendersInputSchema } from "../../schemas/senders.js";
import { formatError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

export function registerSenderTools(server: McpServer): void {
  const service = new SendersService();

  server.tool(
    "sendgrid_list_verified_senders",
    "List verified sender identities configured in the SendGrid account. " +
      "Shows verification status, from email, display name, and whether the sender is locked.",
    ListVerifiedSendersInputSchema.shape,
    async (input) => {
      logger.audit("sendgrid_list_verified_senders", input as Record<string, unknown>);
      try {
        const result = await service.listVerifiedSenders(input);
        const verified = result.senders.filter((s) => s.verified);
        const unverified = result.senders.filter((s) => !s.verified);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  summary: `${result.senders.length} verified sender(s) — ${verified.length} confirmed, ${unverified.length} pending verification.`,
                  verified_count: verified.length,
                  unverified_count: unverified.length,
                  has_more: result.hasMore,
                  senders: result.senders.map((s) => ({
                    id: s.id,
                    nickname: s.nickname,
                    from_email: s.from_email,
                    from_name: s.from_name,
                    verified: s.verified,
                    locked: s.locked,
                  })),
                  warning: unverified.length > 0
                    ? `${unverified.length} sender(s) are not yet verified and cannot be used for sending.`
                    : undefined,
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
