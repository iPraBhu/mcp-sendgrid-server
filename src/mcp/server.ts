/**
 * MCP server factory.
 * Creates and configures the McpServer with all tools, resources, and prompts.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMailTools } from "./tools/mail.js";
import { registerTemplateTools } from "./tools/templates.js";
import { registerActivityTools } from "./tools/activity.js";
import { registerStatsTools } from "./tools/stats.js";
import { registerSuppressionTools } from "./tools/suppressions.js";
import { registerSettingsTools } from "./tools/settings.js";
import { registerSenderTools } from "./tools/senders.js";
import { registerAccountTools } from "./tools/account.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";
import { logger } from "../utils/logger.js";

const SERVER_NAME = "mcp-sendgrid-server";
const SERVER_VERSION = "1.0.0";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  logger.info("Registering MCP tools, resources, and prompts...");

  // --- Tools ---
  registerMailTools(server);
  registerTemplateTools(server);
  registerActivityTools(server);
  registerStatsTools(server);
  registerSuppressionTools(server);
  registerSettingsTools(server);
  registerSenderTools(server);
  registerAccountTools(server);

  // --- Resources ---
  registerResources(server);

  // --- Prompts ---
  registerPrompts(server);

  logger.info("MCP server configured.", {
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  return server;
}
