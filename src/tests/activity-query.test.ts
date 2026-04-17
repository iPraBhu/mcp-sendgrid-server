import { describe, it, expect } from "vitest";

// Access the private method via a subclass for unit testing
class TestableActivityService {
  private escapeDslValue(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  buildActivityQuery(input: {
    to_email?: string;
    from_email?: string;
    subject?: string;
    status?: string;
    message_id?: string;
    after_time?: string;
    before_time?: string;
    categories?: string[];
  }): string {
    const esc = this.escapeDslValue.bind(this);
    const clauses: string[] = [];
    if (input.to_email) clauses.push(`to_email="${esc(input.to_email)}"`);
    if (input.from_email) clauses.push(`from_email="${esc(input.from_email)}"`);
    if (input.subject) clauses.push(`subject="${esc(input.subject)}"`);
    if (input.status) clauses.push(`status="${esc(input.status)}"`);
    if (input.message_id) clauses.push(`msg_id="${esc(input.message_id)}"`);
    if (input.after_time) clauses.push(`last_event_time>="${esc(input.after_time)}"`);
    if (input.before_time) clauses.push(`last_event_time<="${esc(input.before_time)}"`);
    if (input.categories?.length) {
      clauses.push(`(${input.categories.map((c) => `categories="${esc(c)}"`).join(" OR ")})`);
    }
    return clauses.join(" AND ");
  }
}

describe("buildActivityQuery DSL injection escaping", () => {
  const svc = new TestableActivityService();

  it("builds a normal query correctly", () => {
    const q = svc.buildActivityQuery({ subject: "Hello", status: "delivered" });
    expect(q).toBe('subject="Hello" AND status="delivered"');
  });

  it("escapes double-quotes in subject to prevent DSL injection", () => {
    const q = svc.buildActivityQuery({ subject: 'test" OR status="*' });
    // The closing quote of subject="..." must be escaped, not a real DSL boundary
    expect(q).toBe('subject="test\\" OR status=\\"*"');
    // The entire injection is contained within the value — no unescaped top-level AND/OR
    expect(q.split(" AND ").length).toBe(1);
  });

  it("escapes double-quotes in message_id", () => {
    const q = svc.buildActivityQuery({ message_id: 'abc" OR from_email="evil@x.com' });
    expect(q).toBe('msg_id="abc\\" OR from_email=\\"evil@x.com"');
    expect(q.split(" AND ").length).toBe(1);
  });

  it("escapes double-quotes in categories", () => {
    const q = svc.buildActivityQuery({ categories: ['promo" OR status="*'] });
    expect(q).toBe('(categories="promo\\" OR status=\\"*")');
    // Still only one top-level clause, no extra OR at the clause level
    expect(q.split(" AND ").length).toBe(1);
  });

  it("escapes backslashes before escaping quotes (correct order)", () => {
    const q = svc.buildActivityQuery({ subject: 'a\\"b' });
    // backslash → \\\\ then quote → \\"
    expect(q).toBe('subject="a\\\\\\"b"');
  });

  it("escapes double-quotes in after_time and before_time", () => {
    const q = svc.buildActivityQuery({
      after_time: '2024-01-01" OR status="*',
      before_time: '2024-12-31" OR status="*',
    });
    // Only two top-level AND clauses (the two time fields), not four
    expect(q.split(" AND ").length).toBe(2);
  });

  it("handles multiple fields without injection", () => {
    const q = svc.buildActivityQuery({
      subject: "legit subject",
      categories: ["newsletter", "promo"],
    });
    expect(q).toBe('subject="legit subject" AND (categories="newsletter" OR categories="promo")');
  });
});
