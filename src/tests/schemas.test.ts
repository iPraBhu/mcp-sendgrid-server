import { describe, it, expect } from "vitest";
import { SendEmailInputSchema, AttachmentSchema } from "../schemas/mail.js";
import { DateRangeSchema } from "../schemas/common.js";
import { GetGlobalStatsInputSchema } from "../schemas/stats.js";
import { SearchEmailActivityInputSchema } from "../schemas/activity.js";

describe("SendEmailInputSchema", () => {
  it("validates a minimal valid email payload", () => {
    const result = SendEmailInputSchema.safeParse({
      from: { email: "sender@example.com" },
      to: [{ email: "recipient@test.com" }],
      subject: "Hello",
      text: "World",
    });
    expect(result.success).toBe(true);
  });

  it("requires at least one 'to' recipient", () => {
    const result = SendEmailInputSchema.safeParse({
      from: { email: "sender@example.com" },
      to: [],
      subject: "Hello",
      text: "Body",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid 'from' email", () => {
    const result = SendEmailInputSchema.safeParse({
      from: { email: "not-an-email" },
      to: [{ email: "recipient@test.com" }],
      subject: "Hello",
      text: "Body",
    });
    expect(result.success).toBe(false);
  });

  it("accepts template_id without subject/content", () => {
    const result = SendEmailInputSchema.safeParse({
      from: { email: "sender@example.com" },
      to: [{ email: "recipient@test.com" }],
      template_id: "d-abc123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 10 categories", () => {
    const result = SendEmailInputSchema.safeParse({
      from: { email: "sender@example.com" },
      to: [{ email: "recipient@test.com" }],
      subject: "Test",
      text: "Body",
      categories: Array.from({ length: 11 }, (_, i) => `cat-${i}`),
    });
    expect(result.success).toBe(false);
  });
});

describe("AttachmentSchema", () => {
  it("validates a valid attachment", () => {
    const result = AttachmentSchema.safeParse({
      content: "SGVsbG8=",
      filename: "file.pdf",
      type: "application/pdf",
    });
    expect(result.success).toBe(true);
  });

  it("requires content and filename", () => {
    const result = AttachmentSchema.safeParse({ content: "abc" });
    expect(result.success).toBe(false);
  });

  it("defaults disposition to attachment", () => {
    const result = AttachmentSchema.safeParse({ content: "abc", filename: "f.txt" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.disposition).toBe("attachment");
    }
  });
});

describe("DateRangeSchema", () => {
  it("accepts valid YYYY-MM-DD dates", () => {
    const result = DateRangeSchema.safeParse({ start_date: "2024-01-01", end_date: "2024-01-31" });
    expect(result.success).toBe(true);
  });

  it("rejects non-YYYY-MM-DD format", () => {
    const result = DateRangeSchema.safeParse({ start_date: "01/01/2024", end_date: "2024-01-31" });
    expect(result.success).toBe(false);
  });
});

describe("GetGlobalStatsInputSchema", () => {
  it("accepts valid input with defaults", () => {
    const result = GetGlobalStatsInputSchema.safeParse({
      start_date: "2024-01-01",
      end_date: "2024-01-31",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.aggregated_by).toBe("day");
    }
  });

  it("rejects invalid aggregated_by", () => {
    const result = GetGlobalStatsInputSchema.safeParse({
      start_date: "2024-01-01",
      end_date: "2024-01-31",
      aggregated_by: "year",
    });
    expect(result.success).toBe(false);
  });
});

describe("SearchEmailActivityInputSchema", () => {
  it("accepts empty input with defaults", () => {
    const result = SearchEmailActivityInputSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(25);
    }
  });

  it("rejects invalid status", () => {
    const result = SearchEmailActivityInputSchema.safeParse({ status: "sent" });
    expect(result.success).toBe(false);
  });

  it("accepts valid status values", () => {
    const result = SearchEmailActivityInputSchema.safeParse({ status: "delivered" });
    expect(result.success).toBe(true);
  });
});
