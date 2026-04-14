import { describe, it, expect } from "vitest";
import {
  redactEmail,
  redactEmails,
  redactEmailAddress,
  redactEmailsInText,
  maskString,
  redactHeader,
  redactAttachment,
} from "../utils/redaction.js";

describe("redactEmail", () => {
  it("redacts a standard email address", () => {
    const result = redactEmail("user@example.com");
    expect(result).toBe("u***@example.com");
  });

  it("redacts a single-char local part", () => {
    const result = redactEmail("a@example.com");
    expect(result).toBe("*@example.com");
  });

  it("preserves the domain", () => {
    expect(redactEmail("john.doe@company.io")).toBe("j***@company.io");
  });

  it("returns [redacted] for invalid emails", () => {
    expect(redactEmail("not-an-email")).toBe("[redacted]");
    expect(redactEmail("")).toBe("[redacted]");
  });

  it("handles subdomains", () => {
    const result = redactEmail("user@mail.example.co.uk");
    expect(result).toMatch(/^u\*\*\*@/);
  });
});

describe("redactEmails", () => {
  it("redacts each email in an array", () => {
    // Single-char locals are fully hidden (just *@domain) — that's intentional
    const result = redactEmails(["a@b.com", "x@y.org"]);
    expect(result).toEqual(["*@b.com", "*@y.org"]);
  });

  it("redacts multi-char local parts with first-char preserved", () => {
    const result = redactEmails(["user@example.com", "john@test.org"]);
    expect(result).toEqual(["u***@example.com", "j***@test.org"]);
  });
});

describe("redactEmailAddress", () => {
  it("redacts plain email", () => {
    expect(redactEmailAddress("user@test.com")).toBe("u***@test.com");
  });

  it("redacts 'Display Name <email>' format", () => {
    const result = redactEmailAddress("John Doe <john@example.com>");
    expect(result).toBe("[name redacted] <j***@example.com>");
  });

  it("redacts '<email>' without display name", () => {
    const result = redactEmailAddress("<info@example.com>");
    expect(result).toBe("<i***@example.com>");
  });
});

describe("redactEmailsInText", () => {
  it("redacts emails embedded in text", () => {
    const input = "Contact us at support@example.com or help@test.org for assistance.";
    const result = redactEmailsInText(input);
    expect(result).toContain("s***@example.com");
    expect(result).toContain("h***@test.org");
    expect(result).not.toContain("support@example.com");
  });

  it("leaves non-email text unchanged", () => {
    expect(redactEmailsInText("no emails here")).toBe("no emails here");
  });
});

describe("maskString", () => {
  it("shows first 4 chars by default", () => {
    expect(maskString("abcdefgh")).toBe("abcd***");
  });

  it("masks short strings entirely", () => {
    expect(maskString("ab")).toBe("**");
  });

  it("supports custom visible length", () => {
    expect(maskString("hello world", 3)).toBe("hel***");
  });
});

describe("redactHeader", () => {
  it("redacts Authorization header", () => {
    expect(redactHeader("Authorization", "Bearer token123")).toBe("[REDACTED]");
    expect(redactHeader("authorization", "Bearer token123")).toBe("[REDACTED]");
  });

  it("redacts X-SMTPAPI header", () => {
    expect(redactHeader("X-SMTPAPI", "payload")).toBe("[REDACTED]");
  });

  it("passes through non-sensitive headers", () => {
    expect(redactHeader("X-Custom-Header", "value")).toBe("value");
    expect(redactHeader("Content-Type", "application/json")).toBe("application/json");
  });
});

describe("redactAttachment", () => {
  it("removes content and replaces with size hint", () => {
    const result = redactAttachment({
      filename: "invoice.pdf",
      content: "SGVsbG8gV29ybGQ=", // ~12 bytes base64
      type: "application/pdf",
    });
    expect(result).toMatchObject({
      filename: "invoice.pdf",
      type: "application/pdf",
      content: "[content redacted]",
    });
    expect((result as Record<string, unknown>)["size_hint"]).toBeDefined();
  });

  it("handles missing fields gracefully", () => {
    const result = redactAttachment({ content: "abc" });
    expect((result as Record<string, unknown>)["filename"]).toBe("[no filename]");
    expect((result as Record<string, unknown>)["type"]).toBe("application/octet-stream");
  });
});
