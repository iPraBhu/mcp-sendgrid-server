import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetConfig } from "../config/index.js";
import { buildOffsetParams, buildPageParams, buildQueryString } from "../utils/pagination.js";

beforeEach(() => {
  resetConfig();
  process.env["SENDGRID_API_KEY"] = "SG.testkey";
});

afterEach(() => {
  resetConfig();
  delete process.env["SENDGRID_DEFAULT_PAGE_SIZE"];
  delete process.env["SENDGRID_MAX_PAGE_SIZE"];
});

describe("buildOffsetParams", () => {
  it("uses defaults when no params provided", () => {
    const { limit, offset } = buildOffsetParams(undefined, undefined);
    expect(limit).toBe(25);
    expect(offset).toBe(0);
  });

  it("clamps limit to maxPageSize", () => {
    process.env["SENDGRID_MAX_PAGE_SIZE"] = "50";
    resetConfig();
    process.env["SENDGRID_API_KEY"] = "SG.testkey";
    const { limit } = buildOffsetParams(200, undefined);
    expect(limit).toBe(50);
  });

  it("uses provided offset", () => {
    const { offset } = buildOffsetParams(undefined, 100);
    expect(offset).toBe(100);
  });
});

describe("buildPageParams", () => {
  it("defaults to page 1", () => {
    const params = buildPageParams(undefined, undefined);
    expect(params.page).toBe(1);
    expect(params.page_size).toBe(25);
  });

  it("clamps page to minimum of 1", () => {
    const params = buildPageParams(0, undefined);
    expect(params.page).toBe(1);
  });
});

describe("buildQueryString", () => {
  it("builds a query string from params", () => {
    const qs = buildQueryString({ start_date: "2024-01-01", end_date: "2024-01-31", limit: 25 });
    expect(qs).toBe("?start_date=2024-01-01&end_date=2024-01-31&limit=25");
  });

  it("omits undefined and null values", () => {
    const qs = buildQueryString({ a: "x", b: undefined, c: null });
    expect(qs).toBe("?a=x");
  });

  it("encodes special characters", () => {
    const qs = buildQueryString({ query: "to_email=\"test@example.com\"" });
    expect(qs).toContain("query=");
    expect(qs).not.toContain('"');
  });

  it("returns empty string for empty params", () => {
    expect(buildQueryString({})).toBe("");
  });

  it("handles array values with repeated keys", () => {
    const qs = buildQueryString({ categories: ["a", "b", "c"] });
    expect(qs).toBe("?categories=a&categories=b&categories=c");
  });
});
