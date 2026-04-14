import { describe, it, expect } from "vitest";
import {
  normalizeHttpError,
  SendGridApiError,
  PolicyError,
  ValidationError,
  formatError,
} from "../utils/errors.js";

describe("normalizeHttpError", () => {
  it("normalizes a 401 auth error", () => {
    const err = normalizeHttpError(401, { errors: [{ message: "Permission denied" }] }, "/v3/mail/send");
    expect(err.code).toBe("AUTH_FAILED");
    expect(err.isAuthError).toBe(true);
    expect(err.isRetryable).toBe(false);
    expect(err.message).toContain("SENDGRID_API_KEY");
  });

  it("normalizes a 429 rate limit error", () => {
    const err = normalizeHttpError(429, {}, "/v3/stats");
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.isRateLimit).toBe(true);
    expect(err.isRetryable).toBe(true);
  });

  it("normalizes a 403 plan limitation for /messages", () => {
    const err = normalizeHttpError(
      403,
      { errors: [{ message: "You do not have access to this resource" }] },
      "https://api.sendgrid.com/v3/messages",
    );
    expect(err.isPlanLimitation).toBe(true);
    expect(err.code).toBe("PLAN_LIMITATION");
    expect(err.message).toContain("add-on");
  });

  it("normalizes a 400 validation error", () => {
    const err = normalizeHttpError(
      400,
      { errors: [{ message: "The from email does not contain a valid address.", field: "from.email" }] },
      "/v3/mail/send",
    );
    expect(err.code).toBe("INVALID_REQUEST");
    expect(err.details[0]?.field).toBe("from.email");
  });

  it("normalizes a 500 server error as retryable", () => {
    const err = normalizeHttpError(500, { message: "Internal server error" }, "/v3/stats");
    expect(err.isRetryable).toBe(true);
    expect(err.code).toBe("SENDGRID_UNAVAILABLE");
  });

  it("handles missing error body gracefully", () => {
    const err = normalizeHttpError(404, {}, "/v3/templates/nonexistent");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.details.length).toBe(0);
  });
});

describe("formatError", () => {
  it("formats SendGridApiError", () => {
    const err = new SendGridApiError(normalizeHttpError(401, {}, "/v3/mail/send"));
    const formatted = formatError(err);
    expect(formatted).toContain("SENDGRID_API_KEY");
  });

  it("formats PolicyError", () => {
    const err = new PolicyError("Sends are disabled.", "READ_ONLY");
    const formatted = formatError(err);
    expect(formatted).toContain("READ_ONLY");
    expect(formatted).toContain("Sends are disabled.");
  });

  it("formats ValidationError", () => {
    const err = new ValidationError("Subject is required.", ["subject"]);
    const formatted = formatError(err);
    expect(formatted).toContain("Subject is required.");
  });

  it("formats plain Error", () => {
    expect(formatError(new Error("oops"))).toBe("oops");
  });

  it("formats unknown error", () => {
    expect(formatError("raw string error")).toBe("raw string error");
  });
});
