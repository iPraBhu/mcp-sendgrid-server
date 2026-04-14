import { describe, it, expect, vi } from "vitest";
import { withRetry, parseRetryAfter } from "../utils/retry.js";

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const operation = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(operation, () => ({ isRetryable: false }));
    expect(result).toBe("ok");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("retries on retryable error", async () => {
    let calls = 0;
    const operation = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 3) throw new Error("transient");
      return "success";
    });

    const result = await withRetry(
      operation,
      (err) => ({ isRetryable: err instanceof Error && err.message === "transient" }),
      { maxAttempts: 4, initialDelayMs: 1, maxDelayMs: 5, jitterMs: 0 },
    );
    expect(result).toBe("success");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("throws on non-retryable error immediately", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("fatal"));
    await expect(
      withRetry(operation, () => ({ isRetryable: false }), { maxAttempts: 3 }),
    ).rejects.toThrow("fatal");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting maxAttempts", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("flaky"));
    await expect(
      withRetry(
        operation,
        () => ({ isRetryable: true }),
        { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 5, jitterMs: 0 },
      ),
    ).rejects.toThrow("flaky");
    expect(operation).toHaveBeenCalledTimes(3);
  });
});

describe("parseRetryAfter", () => {
  it("returns undefined for null input", () => {
    expect(parseRetryAfter(null)).toBeUndefined();
  });

  it("parses delta-seconds", () => {
    expect(parseRetryAfter("5")).toBe(5000);
    expect(parseRetryAfter("30")).toBe(30_000);
  });

  it("parses HTTP-date format", () => {
    const future = new Date(Date.now() + 10_000).toUTCString();
    const result = parseRetryAfter(future);
    expect(result).toBeGreaterThan(8000);
    expect(result).toBeLessThan(12_000);
  });

  it("returns undefined for invalid value", () => {
    expect(parseRetryAfter("not-a-date")).toBeUndefined();
  });
});
