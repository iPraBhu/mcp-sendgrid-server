import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resetConfig } from "../config/index.js";

const originalEnv = { ...process.env };

// Snapshot and restore env around every test so vars don't bleed across tests
beforeEach(() => {
  process.env = { ...originalEnv };
  resetConfig();
  process.env["SENDGRID_API_KEY"] = "SG.testkey";
});

afterEach(() => {
  process.env = { ...originalEnv };
  resetConfig();
  vi.restoreAllMocks();
});

describe("MailService.validatePayload", () => {
  it("validates a minimal valid payload", async () => {
    const { MailService } = await import("../domains/mail/service.js");
    const svc = new MailService();
    const result = svc.validatePayload({
      from: { email: "sender@example.com" },
      to: [{ email: "recipient@test.com" }],
      subject: "Hello",
      text: "World",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when both subject and template_id are missing", async () => {
    const { MailService } = await import("../domains/mail/service.js");
    const svc = new MailService();
    const result = svc.validatePayload({
      from: { email: "sender@example.com" },
      to: [{ email: "recipient@test.com" }],
      text: "Hello",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("subject"))).toBe(true);
  });

  it("fails when no content and no template_id", async () => {
    const { MailService } = await import("../domains/mail/service.js");
    const svc = new MailService();
    const result = svc.validatePayload({
      from: { email: "sender@example.com" },
      to: [{ email: "recipient@test.com" }],
      subject: "Test",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("text") || e.includes("html") || e.includes("template_id"))).toBe(true);
  });

  it("passes with template_id and no content", async () => {
    const { MailService } = await import("../domains/mail/service.js");
    const svc = new MailService();
    const result = svc.validatePayload({
      from: { email: "sender@example.com" },
      to: [{ email: "recipient@test.com" }],
      template_id: "d-abc123",
    });
    expect(result.valid).toBe(true);
  });

  it("warns for legacy template ID (no d- prefix)", async () => {
    const { MailService } = await import("../domains/mail/service.js");
    const svc = new MailService();
    const result = svc.validatePayload({
      from: { email: "sender@example.com" },
      to: [{ email: "recipient@test.com" }],
      template_id: "abc123",
    });
    expect(result.warnings.some((w) => w.includes("d-"))).toBe(true);
  });

  it("errors when send_at is too far in the future", async () => {
    const { MailService } = await import("../domains/mail/service.js");
    const svc = new MailService();
    const tooFar = Math.floor(Date.now() / 1000) + 72 * 3600 + 1000;
    const result = svc.validatePayload({
      from: { email: "sender@example.com" },
      to: [{ email: "recipient@test.com" }],
      subject: "Scheduled",
      text: "Body",
      send_at: tooFar,
    });
    expect(result.errors.some((e) => e.includes("72 hours"))).toBe(true);
  });

  it("enforces from domain allowlist", async () => {
    resetConfig();
    process.env["SENDGRID_API_KEY"] = "SG.testkey";
    process.env["SENDGRID_ALLOWED_FROM_DOMAINS"] = "allowed.com";
    const { MailService } = await import("../domains/mail/service.js");
    const svc = new MailService();
    const result = svc.validatePayload({
      from: { email: "sender@notallowed.com" },
      to: [{ email: "recipient@test.com" }],
      subject: "Test",
      text: "Body",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("notallowed.com"))).toBe(true);
  });

  it("blocks dangerous attachment MIME types", async () => {
    const { MailService } = await import("../domains/mail/service.js");
    const svc = new MailService();
    const result = svc.validatePayload({
      from: { email: "sender@example.com" },
      to: [{ email: "recipient@test.com" }],
      subject: "Test",
      text: "Body",
      attachments: [
        {
          filename: "script.sh",
          content: Buffer.from("#!/bin/bash").toString("base64"),
          type: "application/x-sh",
          disposition: "attachment",
        },
      ],
    });
    expect(result.errors.some((e) => e.includes("dangerous MIME type"))).toBe(true);
  });
});

describe("MailService.send", () => {
  it("throws PolicyError when READ_ONLY is enabled", async () => {
    process.env["SENDGRID_READ_ONLY"] = "true";
    resetConfig();
    process.env["SENDGRID_API_KEY"] = "SG.testkey";
    const { MailService } = await import("../domains/mail/service.js");
    const svc = new MailService();
    await expect(
      svc.send({
        from: { email: "sender@example.com" },
        to: [{ email: "recipient@test.com" }],
        subject: "Test",
        text: "Body",
      }),
    ).rejects.toThrow(/READ_ONLY/);
  });

  it("throws PolicyError when TEST_MODE_ONLY is enabled", async () => {
    process.env["SENDGRID_TEST_MODE_ONLY"] = "true";
    resetConfig();
    process.env["SENDGRID_API_KEY"] = "SG.testkey";
    const { MailService } = await import("../domains/mail/service.js");
    const svc = new MailService();
    await expect(
      svc.send({
        from: { email: "sender@example.com" },
        to: [{ email: "recipient@test.com" }],
        subject: "Test",
        text: "Body",
      }),
    ).rejects.toThrow(/TEST_MODE_ONLY/);
  });
});
