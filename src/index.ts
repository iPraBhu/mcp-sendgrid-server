#!/usr/bin/env node
/**
 * Entry point for the SendGrid MCP server.
 * Supports stdio transport (default) and HTTP transport (opt-in via MCP_TRANSPORT=http).
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from "node:module";
import { loadConfig } from "./config/index.js";
import { createMcpServer } from "./mcp/server.js";
import { logger } from "./utils/logger.js";

const _require = createRequire(import.meta.url);
const { version, name } = _require("../package.json") as { version: string; name: string };

function handleCliFlags(): void {
  const arg = process.argv[2];
  if (arg === "--version" || arg === "-v") {
    process.stdout.write(`${version}\n`);
    process.exit(0);
  }
  if (arg === "--help" || arg === "-h") {
    process.stdout.write(`
${name} v${version}

An MCP server that connects AI coding agents to your Twilio SendGrid account.

USAGE
  npx mcp-sendgrid-server           Start the server (stdio transport)
  mcp-sendgrid-server --version     Print version
  mcp-sendgrid-server --help        Show this help

REQUIRED
  SENDGRID_API_KEY                  Your SendGrid API key (SG. prefix)

KEY OPTIONS
  SENDGRID_MODE         full (default) | analytics
                          analytics = stats, activity, suppression reads, and IP access reads only; no sends
  SENDGRID_READ_ONLY    true (default) | false
                          Set to false to allow write operations
  SENDGRID_WRITES_ENABLED  false (default) | true
                          Second safety switch; must also be true to enable writes
  SENDGRID_WRITE_APPROVAL_TOKEN  <string>
                          Required when writes are enabled; must be passed as approval_token
                          in every write tool call
  SENDGRID_TEST_MODE_ONLY  false (default) | true
                          Restricts sends to allowlisted recipients only
  MCP_TRANSPORT         stdio (default) | http
                          Use http for a long-lived network-accessible server
  MCP_HTTP_PORT         3100 (default)
                          Port when MCP_TRANSPORT=http; health check at /health
  SENDGRID_REGION       global (default) | eu
  LOG_LEVEL             info (default) | debug | warn | error
  REDACT_PII            true (default) | false

EXAMPLES
  # Read-only (default)
  SENDGRID_API_KEY=SG.xxx npx mcp-sendgrid-server

  # Analytics mode
  SENDGRID_API_KEY=SG.xxx SENDGRID_MODE=analytics npx mcp-sendgrid-server

  # Enable sending
  SENDGRID_API_KEY=SG.xxx SENDGRID_READ_ONLY=false SENDGRID_WRITES_ENABLED=true \\
    SENDGRID_WRITE_APPROVAL_TOKEN=my-token npx mcp-sendgrid-server

  # HTTP transport
  SENDGRID_API_KEY=SG.xxx MCP_TRANSPORT=http MCP_HTTP_PORT=3100 npx mcp-sendgrid-server

Full documentation: https://github.com/iPraBhu/mcp-sendgrid-server
`);
    process.exit(0);
  }
  if (arg !== undefined) {
    process.stderr.write(`Unknown argument: ${arg}\nRun with --help for usage.\n`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  handleCliFlags();
  // Load and validate configuration first — fails fast if SENDGRID_API_KEY is missing.
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    process.stderr.write(`[FATAL] Configuration error: ${String(err)}\n`);
    process.exit(1);
  }

  const server = createMcpServer();

  if (config.mcp.transport === "http") {
    await startHttpTransport(server, config.mcp.httpPort);
  } else {
    await startStdioTransport(server);
  }
}

async function startStdioTransport(server: ReturnType<typeof createMcpServer>): Promise<void> {
  logger.info("Starting MCP server on stdio transport.");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP server connected via stdio. Waiting for requests...");
}

async function startHttpTransport(
  server: ReturnType<typeof createMcpServer>,
  port: number,
): Promise<void> {
  // Dynamic import to avoid loading HTTP modules in stdio-only deployments
  const { StreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/streamableHttp.js"
  );

  logger.info(`Starting MCP server on HTTP transport at port ${port}.`);

  const { createServer } = await import("node:http");

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  const httpServer = createServer((req, res) => {
    if (req.url === "/mcp" || req.url?.startsWith("/mcp?")) {
      transport.handleRequest(req, res).catch((err: unknown) => {
        logger.error("HTTP transport error", { error: String(err) });
        if (!res.headersSent) {
          res.writeHead(500).end("Internal server error");
        }
      });
    } else if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({ status: "ok", server: "mcp-sendgrid-server" }),
      );
    } else {
      res.writeHead(404).end("Not found");
    }
  });

  await server.connect(transport);

  await new Promise<void>((resolve, reject) => {
    httpServer.listen(port, () => {
      logger.info(`MCP HTTP server listening on http://localhost:${port}/mcp`);
      resolve();
    });
    httpServer.on("error", reject);
  });
}

// Handle uncaught errors gracefully
process.on("uncaughtException", (err) => {
  process.stderr.write(`[FATAL] Uncaught exception: ${String(err)}\n`);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  process.stderr.write(`[FATAL] Unhandled rejection: ${String(reason)}\n`);
  process.exit(1);
});

main().catch((err) => {
  process.stderr.write(`[FATAL] ${String(err)}\n`);
  process.exit(1);
});
