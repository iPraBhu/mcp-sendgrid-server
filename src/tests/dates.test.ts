import { describe, it, expect } from "vitest";
import {
  toSgDate,
  daysAgo,
  last7Days,
  last30Days,
  parseDateString,
  validateDateRange,
  daysBetween,
} from "../utils/dates.js";

describe("toSgDate", () => {
  it("formats a Date as YYYY-MM-DD", () => {
    const d = new Date("2024-03-15T12:00:00Z");
    expect(toSgDate(d)).toBe("2024-03-15");
  });
});

describe("daysAgo", () => {
  it("returns a date N days in the past", () => {
    const result = daysAgo(0);
    const today = new Date().toISOString().split("T")[0];
    expect(result).toBe(today);
  });

  it("returns 7 days ago correctly", () => {
    const result = daysAgo(7);
    const expected = new Date(Date.now() - 7 * 86_400_000).toISOString().split("T")[0];
    expect(result).toBe(expected);
  });
});

describe("last7Days", () => {
  it("returns a range of 7 days", () => {
    const { startDate, endDate } = last7Days();
    expect(daysBetween(startDate, endDate)).toBe(7);
    expect(endDate >= startDate).toBe(true);
  });
});

describe("last30Days", () => {
  it("returns a range of 30 days", () => {
    const { startDate, endDate } = last30Days();
    expect(daysBetween(startDate, endDate)).toBe(30);
  });
});

describe("parseDateString", () => {
  it("accepts YYYY-MM-DD directly", () => {
    expect(parseDateString("2024-01-15")).toBe("2024-01-15");
  });

  it("converts ISO string to YYYY-MM-DD", () => {
    expect(parseDateString("2024-01-15T10:00:00Z")).toBe("2024-01-15");
  });

  it("throws for invalid date", () => {
    expect(() => parseDateString("not-a-date")).toThrow(/Invalid date/);
  });
});

describe("validateDateRange", () => {
  it("passes for valid range", () => {
    expect(() => validateDateRange({ startDate: "2024-01-01", endDate: "2024-01-31" })).not.toThrow();
  });

  it("passes for equal start and end", () => {
    expect(() => validateDateRange({ startDate: "2024-01-01", endDate: "2024-01-01" })).not.toThrow();
  });

  it("throws when start > end", () => {
    expect(() => validateDateRange({ startDate: "2024-02-01", endDate: "2024-01-01" })).toThrow(
      /startDate/,
    );
  });
});

describe("daysBetween", () => {
  it("returns 1 for same day", () => {
    expect(daysBetween("2024-01-01", "2024-01-01")).toBe(1);
  });

  it("returns correct count for a week", () => {
    expect(daysBetween("2024-01-01", "2024-01-07")).toBe(7);
  });

  it("returns correct count for a month", () => {
    expect(daysBetween("2024-01-01", "2024-01-30")).toBe(30);
  });
});
