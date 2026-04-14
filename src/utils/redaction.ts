/**
 * PII and sensitive data redaction utilities.
 * Used throughout the server for logging and safe output.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Redact an email address, preserving the domain for diagnostics.
 * "user@example.com" → "u***@example.com"
 */
export function redactEmail(email: string): string {
  if (!email || !EMAIL_REGEX.test(email)) return "[redacted]";
  const [local, domain] = email.split("@") as [string, string];
  if (local.length <= 1) return `*@${domain}`;
  return `${local[0]}***@${domain}`;
}

/**
 * Redact an array of email addresses.
 */
export function redactEmails(emails: string[]): string[] {
  return emails.map(redactEmail);
}

/**
 * Redact an email in a "Name <email>" or plain "email" string.
 */
export function redactEmailAddress(address: string): string {
  // "Display Name <email@domain>"
  const angleMatch = address.match(/^(.*?)<([^>]+)>$/);
  if (angleMatch) {
    const name = angleMatch[1]?.trim() ?? "";
    const email = angleMatch[2] ?? "";
    const redacted = redactEmail(email);
    return name ? `[name redacted] <${redacted}>` : `<${redacted}>`;
  }
  return redactEmail(address);
}

/**
 * Redact all email addresses in a text string.
 */
export function redactEmailsInText(text: string): string {
  return text.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, (match) => redactEmail(match));
}

/**
 * Mask a string to show only first N chars + ellipsis.
 */
export function maskString(value: string, visibleChars = 4): string {
  if (value.length <= visibleChars) return "*".repeat(value.length);
  return value.slice(0, visibleChars) + "***";
}

/**
 * Redact sensitive header values (Authorization, X-SMTPAPI, etc.)
 */
export function redactHeader(name: string, value: string): string {
  const sensitive = ["authorization", "x-smtpapi", "api-key", "x-api-key"];
  if (sensitive.includes(name.toLowerCase())) return "[REDACTED]";
  return value;
}

/**
 * Redact attachment content (base64 data) — keep metadata only.
 */
export function redactAttachment(attachment: {
  filename?: string;
  content?: string;
  type?: string;
  disposition?: string;
}): object {
  return {
    filename: attachment.filename ?? "[no filename]",
    type: attachment.type ?? "application/octet-stream",
    disposition: attachment.disposition ?? "attachment",
    content: "[content redacted]",
    size_hint: attachment.content ? `~${Math.round(attachment.content.length * 0.75)} bytes` : "unknown",
  };
}
