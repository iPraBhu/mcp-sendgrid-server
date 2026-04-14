import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, resetConfig } from "../config/index.js";

describe("loadConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetConfig();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    resetConfig();
  });

  it("throws if SENDGRID_API_KEY is missing", () => {
    delete process.env["SENDGRID_API_KEY"];
    expect(() => loadConfig()).toThrow(/SENDGRID_API_KEY/);
  });

  it("throws if SENDGRID_API_KEY is empty string", () => {
    process.env["SENDGRID_API_KEY"] = "   ";
    expect(() => loadConfig()).toThrow(/SENDGRID_API_KEY/);
  });

  it("loads defaults when minimal env is set", () => {
    process.env["SENDGRID_API_KEY"] = "SG.testkey";
    const config = loadConfig();
    expect(config.sendgrid.apiKey).toBe("SG.testkey");
    expect(config.sendgrid.region).toBe("global");
    expect(config.sendgrid.baseUrl).toBe("https://api.sendgrid.com");
    expect(config.sendgrid.readOnly).toBe(true);
    expect(config.sendgrid.writesEnabled).toBe(false);
    expect(config.sendgrid.writeApprovalToken).toBeUndefined();
    expect(config.sendgrid.testModeOnly).toBe(false);
    expect(config.sendgrid.defaultPageSize).toBe(25);
    expect(config.sendgrid.maxPageSize).toBe(100);
    expect(config.sendgrid.timeoutMs).toBe(30_000);
    expect(config.logging.redactPii).toBe(true);
    expect(config.mcp.transport).toBe("stdio");
  });

  it("resolves EU base URL for eu region", () => {
    process.env["SENDGRID_API_KEY"] = "SG.testkey";
    process.env["SENDGRID_REGION"] = "eu";
    const config = loadConfig();
    expect(config.sendgrid.baseUrl).toBe("https://api.eu.sendgrid.com");
    expect(config.sendgrid.region).toBe("eu");
  });

  it("respects SENDGRID_BASE_URL override", () => {
    process.env["SENDGRID_API_KEY"] = "SG.testkey";
    process.env["SENDGRID_BASE_URL"] = "https://custom.api.example.com";
    const config = loadConfig();
    expect(config.sendgrid.baseUrl).toBe("https://custom.api.example.com");
  });

  it("strips trailing slash from custom base URL", () => {
    process.env["SENDGRID_API_KEY"] = "SG.testkey";
    process.env["SENDGRID_BASE_URL"] = "https://custom.api.example.com/";
    const config = loadConfig();
    expect(config.sendgrid.baseUrl).toBe("https://custom.api.example.com");
  });

  it("parses boolean env vars correctly", () => {
    process.env["SENDGRID_API_KEY"] = "SG.testkey";
    process.env["SENDGRID_READ_ONLY"] = "true";
    process.env["SENDGRID_TEST_MODE_ONLY"] = "1";
    process.env["REDACT_PII"] = "false";
    const config = loadConfig();
    expect(config.sendgrid.readOnly).toBe(true);
    expect(config.sendgrid.testModeOnly).toBe(true);
    expect(config.logging.redactPii).toBe(false);
  });

  it("throws if writes are enabled without an approval token", () => {
    process.env["SENDGRID_API_KEY"] = "SG.testkey";
    process.env["SENDGRID_READ_ONLY"] = "false";
    process.env["SENDGRID_WRITES_ENABLED"] = "true";
    delete process.env["SENDGRID_WRITE_APPROVAL_TOKEN"];
    expect(() => loadConfig()).toThrow(/SENDGRID_WRITE_APPROVAL_TOKEN/);
  });

  it("loads write config when enabled with token", () => {
    process.env["SENDGRID_API_KEY"] = "SG.testkey";
    process.env["SENDGRID_READ_ONLY"] = "false";
    process.env["SENDGRID_WRITES_ENABLED"] = "true";
    process.env["SENDGRID_WRITE_APPROVAL_TOKEN"] = "token-123";
    const config = loadConfig();
    expect(config.sendgrid.readOnly).toBe(false);
    expect(config.sendgrid.writesEnabled).toBe(true);
    expect(config.sendgrid.writeApprovalToken).toBe("token-123");
  });

  it("parses allowlist env vars", () => {
    process.env["SENDGRID_API_KEY"] = "SG.testkey";
    process.env["SENDGRID_ALLOWED_FROM_DOMAINS"] = "example.com, test.org";
    process.env["SENDGRID_ALLOWED_TO_EMAILS"] = "qa@test.org,dev@test.org";
    const config = loadConfig();
    expect(config.sendgrid.allowedFromDomains).toEqual(["example.com", "test.org"]);
    expect(config.sendgrid.allowedToEmails).toEqual(["qa@test.org", "dev@test.org"]);
  });

  it("clamps defaultPageSize to maxPageSize", () => {
    process.env["SENDGRID_API_KEY"] = "SG.testkey";
    process.env["SENDGRID_DEFAULT_PAGE_SIZE"] = "200";
    process.env["SENDGRID_MAX_PAGE_SIZE"] = "50";
    const config = loadConfig();
    expect(config.sendgrid.defaultPageSize).toBe(50);
    expect(config.sendgrid.maxPageSize).toBe(50);
  });

  it("parses HTTP transport", () => {
    process.env["SENDGRID_API_KEY"] = "SG.testkey";
    process.env["MCP_TRANSPORT"] = "http";
    process.env["MCP_HTTP_PORT"] = "4000";
    const config = loadConfig();
    expect(config.mcp.transport).toBe("http");
    expect(config.mcp.httpPort).toBe(4000);
  });

  it("returns cached config on second call", () => {
    process.env["SENDGRID_API_KEY"] = "SG.testkey";
    const c1 = loadConfig();
    const c2 = loadConfig();
    expect(c1).toBe(c2);
  });
});
