/**
 * MCP server factory.
 * Creates and configures the McpServer with all tools, resources, and prompts.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createRequire } from "node:module";
import { registerMailTools } from "./tools/mail.js";
import { registerTemplateTools } from "./tools/templates.js";
import { registerActivityTools } from "./tools/activity.js";
import { registerStatsTools } from "./tools/stats.js";
import { registerSuppressionTools } from "./tools/suppressions.js";
import { registerIpAccessTools } from "./tools/ip-access.js";
import { registerSettingsTools } from "./tools/settings.js";
import { registerSenderTools } from "./tools/senders.js";
import { registerAccountTools } from "./tools/account.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";
import { logger } from "../utils/logger.js";
import { getConfig } from "../config/index.js";

const _require = createRequire(import.meta.url);
const { version: SERVER_VERSION } = _require("../../package.json") as { version: string };
const SERVER_NAME = "mcp-sendgrid-server";

export function createMcpServer(): McpServer {
  const config = getConfig();
  const analyticsMode = config.sendgrid.mode === "analytics";

  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  if (analyticsMode) {
    logger.info("Starting in analytics mode — only stats, activity, and suppression read tools are registered.");
  }

  logger.info("Registering MCP tools, resources, and prompts...");

  // --- Tools ---
  if (!analyticsMode) {
    registerMailTools(server);
    registerTemplateTools(server);
    registerSettingsTools(server);
    registerSenderTools(server);
    registerAccountTools(server);
  }
  registerActivityTools(server);
  registerStatsTools(server);
  registerSuppressionTools(server, { analyticsMode });
  registerIpAccessTools(server, { analyticsMode });

  // --- Resources ---
  registerResources(server, { analyticsMode });

  // --- Prompts ---
  if (!analyticsMode) {
    registerPrompts(server);
  }

  logger.info("MCP server configured.", {
    name: SERVER_NAME,
    version: SERVER_VERSION,
    mode: config.sendgrid.mode,
  });

  return server;
}
