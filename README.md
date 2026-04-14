# mcp-sendgrid-server

**Model Context Protocol server for Twilio SendGrid transactional email.**

Expose SendGrid's sending, template, analytics, and suppression APIs as a fully typed MCP interface — usable directly from Cursor, Claude Code, VS Code Copilot, Windsurf, Zed, and any other MCP-compatible agent.

[![npm version](https://img.shields.io/npm/v/mcp-sendgrid-server.svg)](https://www.npmjs.com/package/mcp-sendgrid-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node ≥18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-purple)](https://modelcontextprotocol.io)

---

## Overview

`mcp-sendgrid-server` bridges SendGrid's REST API and the [Model Context Protocol](https://modelcontextprotocol.io), giving AI coding agents structured, safe access to your email infrastructure without requiring custom integration code.

**What it provides:**

- **28 MCP tools** covering send, templates, activity, stats, suppressions, and account management
- **8 MCP resources** for loading live account snapshots as agent context
- **5 guided prompts** for common workflows: deliverability audits, delivery troubleshooting, template review, safe test-send
- **Built-in safety controls** — read-only mode, test-send allowlists, PII redaction, payload validation before any API call
- **Graceful degradation** — features gated by SendGrid plan (e.g. Email Activity add-on) return structured warnings, not failures

---

## Requirements

- Node.js `>=18`
- A [Twilio SendGrid](https://sendgrid.com) account and API key

---

## Installation

```bash
# npm
npm install -g mcp-sendgrid-server

# pnpm
pnpm add -g mcp-sendgrid-server

# yarn
yarn global add mcp-sendgrid-server
```

Or run without installing:

```bash
npx -y mcp-sendgrid-server
```

---

## Quickstart

**1. Verify the server starts:**

```bash
SENDGRID_API_KEY=SG.your-key npx mcp-sendgrid-server
# → [INFO] MCP server connected via stdio. Waiting for requests...
```

By default, the server starts in **read-only mode** (safe by default). Validation, read APIs, resources, and prompts work normally; write operations (sends) are blocked unless explicitly enabled.

**2. Add it to your MCP client** (see [Client Configuration](#client-configuration) below).

**3. Ask your agent:**

```
What is the deliverability health of my SendGrid account over the last 7 days?
```

---

## Client Configuration

All clients use `stdio` transport by default — the MCP client spawns the server as a subprocess. Replace `SG.your-api-key-here` with your actual key in every example below.

### Cursor

**File:** `~/.cursor/mcp.json` (global) or `<project>/.cursor/mcp.json` (project-scoped)

```json
{
  "mcpServers": {
    "sendgrid": {
      "command": "npx",
      "args": ["-y", "mcp-sendgrid-server"],
      "env": {
        "SENDGRID_API_KEY": "SG.your-api-key-here"
      }
    }
  }
}
```

> **Tip:** Use `-y` to suppress npx's first-run confirmation prompt, which would otherwise block Cursor on initial load.

**Global binary** (faster startup after `npm install -g`):

```json
{
  "mcpServers": {
    "sendgrid": {
      "command": "mcp-sendgrid-server",
      "env": {
        "SENDGRID_API_KEY": "SG.your-api-key-here"
      }
    }
  }
}
```

---

### Claude Code

**Via CLI** (recommended):

```bash
claude mcp add sendgrid -e SENDGRID_API_KEY=SG.your-api-key-here -- npx -y mcp-sendgrid-server
```

**Via config file** — `~/.claude/claude_mcp_config.json`:

```json
{
  "mcpServers": {
    "sendgrid": {
      "command": "npx",
      "args": ["-y", "mcp-sendgrid-server"],
      "env": {
        "SENDGRID_API_KEY": "SG.your-api-key-here"
      }
    }
  }
}
```

---

### VS Code (GitHub Copilot / MCP extension)

**`.vscode/mcp.json`** — commit this file; keep the key out of source control using env interpolation:

```json
{
  "servers": {
    "sendgrid": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-sendgrid-server"],
      "env": {
        "SENDGRID_API_KEY": "${env:SENDGRID_API_KEY}"
      }
    }
  }
}
```

**Enable write operations from VS Code config** (requires manual approval; keep the token out of source control):

```json
{
  "servers": {
    "sendgrid": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-sendgrid-server"],
      "env": {
        "SENDGRID_API_KEY": "${env:SENDGRID_API_KEY}",
        "SENDGRID_READ_ONLY": "false",
        "SENDGRID_WRITES_ENABLED": "true",
        "SENDGRID_WRITE_APPROVAL_TOKEN": "${env:SENDGRID_WRITE_APPROVAL_TOKEN}"
      }
    }
  }
}
```

**Disable write operations from VS Code config** (safe default):

```json
{
  "servers": {
    "sendgrid": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-sendgrid-server"],
      "env": {
        "SENDGRID_API_KEY": "${env:SENDGRID_API_KEY}",
        "SENDGRID_READ_ONLY": "true"
      }
    }
  }
}
```

**User `settings.json`** — for secrets that should never be committed:

```json
{
  "mcp.servers": {
    "sendgrid": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-sendgrid-server"],
      "env": {
        "SENDGRID_API_KEY": "SG.your-api-key-here"
      }
    }
  }
}
```

---

### Windsurf

**File:** `~/.codeium/windsurf/mcp_config.json`

```json
{
  "mcpServers": {
    "sendgrid": {
      "command": "npx",
      "args": ["-y", "mcp-sendgrid-server"],
      "env": {
        "SENDGRID_API_KEY": "SG.your-api-key-here"
      }
    }
  }
}
```

---

### Zed

**File:** `~/.config/zed/settings.json`

```json
{
  "context_servers": {
    "sendgrid": {
      "command": {
        "path": "npx",
        "args": ["-y", "mcp-sendgrid-server"],
        "env": {
          "SENDGRID_API_KEY": "SG.your-api-key-here"
        }
      }
    }
  }
}
```

---

### Configuration variants

The following variants apply to any client above — swap the `env` block as needed.

**EU data residency:**

```json
"env": {
  "SENDGRID_API_KEY": "SG.your-eu-api-key-here",
  "SENDGRID_REGION": "eu"
}
```

**Read-only** (no sends — safe for shared or read-heavy environments):

```json
"env": {
  "SENDGRID_API_KEY": "SG.your-api-key-here",
  "SENDGRID_READ_ONLY": "true"
}
```

**Enable write operations** (manual approval required; set these in your IDE MCP config):

```json
"env": {
  "SENDGRID_API_KEY": "SG.your-api-key-here",
  "SENDGRID_READ_ONLY": "false",
  "SENDGRID_WRITES_ENABLED": "true",
  "SENDGRID_WRITE_APPROVAL_TOKEN": "replace-with-strong-random-token"
}
```

When writes are enabled, every write tool call must include `approval_token` matching `SENDGRID_WRITE_APPROVAL_TOKEN`.

**Disable write operations** (recommended for most environments):

```json
"env": {
  "SENDGRID_API_KEY": "SG.your-api-key-here",
  "SENDGRID_READ_ONLY": "true"
}
```

**Test-mode** (sends only to an allowlist — recommended for staging):

```json
"env": {
  "SENDGRID_API_KEY": "SG.your-api-key-here",
  "SENDGRID_TEST_MODE_ONLY": "true",
  "SENDGRID_ALLOWED_TO_EMAILS": "qa@yourcompany.com,dev@yourcompany.com",
  "SENDGRID_ALLOWED_FROM_DOMAINS": "yourcompany.com"
}
```

**HTTP transport** (long-lived network-accessible server):

```bash
SENDGRID_API_KEY=SG.your-key MCP_TRANSPORT=http MCP_HTTP_PORT=3100 npx mcp-sendgrid-server
```

Point MCP clients at `http://localhost:3100/mcp`. Health check: `GET http://localhost:3100/health`.

---

## Configuration Reference

All configuration is via environment variables. No config file is required.

| Variable | Required | Default | Description |
|---|---|---|---|
| `SENDGRID_API_KEY` | **Yes** | — | SendGrid API key (`SG.` prefix) |
| `SENDGRID_REGION` | No | `global` | `global` or `eu` for EU data residency |
| `SENDGRID_BASE_URL` | No | — | Override the API base URL entirely |
| `SENDGRID_READ_ONLY` | No | `true` | Disable all write operations (safe default) |
| `SENDGRID_WRITES_ENABLED` | No | `false` | Extra safety switch: when `false`, all writes are blocked even if `SENDGRID_READ_ONLY=false` |
| `SENDGRID_WRITE_APPROVAL_TOKEN` | No | — | Required when `SENDGRID_WRITES_ENABLED=true`; write tools require matching `approval_token` at runtime |
| `SENDGRID_TEST_MODE_ONLY` | No | `false` | Restrict sends to allowlisted recipients when `true` |
| `SENDGRID_ALLOWED_FROM_DOMAINS` | No | — | Comma-separated sender domain allowlist |
| `SENDGRID_ALLOWED_TO_DOMAINS` | No | — | Comma-separated recipient domain allowlist (test mode) |
| `SENDGRID_ALLOWED_TO_EMAILS` | No | — | Comma-separated recipient email allowlist (test mode) |
| `SENDGRID_DEFAULT_PAGE_SIZE` | No | `25` | Default results per page |
| `SENDGRID_MAX_PAGE_SIZE` | No | `100` | Maximum results per page (hard cap) |
| `SENDGRID_TIMEOUT_MS` | No | `30000` | HTTP request timeout in ms |
| `MCP_TRANSPORT` | No | `stdio` | `stdio` or `http` |
| `MCP_HTTP_PORT` | No | `3100` | Listening port when `MCP_TRANSPORT=http` |
| `LOG_LEVEL` | No | `info` | `debug` · `info` · `warn` · `error` |
| `REDACT_PII` | No | `true` | Redact email addresses from all log output |

---

## Tools

### Mail

| Tool | Description |
|---|---|
| `sendgrid_validate_send_payload` | Validate a send payload locally — no API call, no email sent |
| `sendgrid_test_send_email` | Send only to allowlisted recipients, with test category and tracing header |
| `sendgrid_send_email` | Send a transactional email; blocked by default (read-only) and requires explicit write approval |

### Templates

| Tool | Description |
|---|---|
| `sendgrid_list_templates` | List dynamic or legacy templates |
| `sendgrid_get_template` | Full template details including all versions |
| `sendgrid_list_template_versions` | All versions for a template |
| `sendgrid_get_template_version` | Detail for a specific version |
| `sendgrid_get_template_readiness_report` | Readiness score, issues, and warnings for production use |

### Email Activity

| Tool | Description |
|---|---|
| `sendgrid_search_email_activity` | Search the message log by recipient, subject, status, date, or category |
| `sendgrid_get_message_details` | Full event timeline for a message by ID |
| `sendgrid_troubleshoot_message` | Structured diagnosis for a specific message |
| `sendgrid_troubleshoot_recipient_delivery` | Investigate why a recipient is not receiving email |

> Email Activity tools require the **Email Activity add-on** (Pro/Premier plans). See [Plan Limitations](#plan-limitations).

### Stats & Analytics

| Tool | Description |
|---|---|
| `sendgrid_get_global_stats` | Delivery, bounce, open, click, spam, and unsubscribe metrics for a date range |
| `sendgrid_get_category_stats` | Same metrics filtered by category |
| `sendgrid_compare_stats_ranges` | Side-by-side comparison of two date ranges with trend analysis |
| `sendgrid_get_deliverability_summary` | Health score (0–100), anomalies, and recommendations for last 7 or 30 days |

### Suppressions

| Tool | Description |
|---|---|
| `sendgrid_get_suppressions_overview` | Counts and samples across all suppression types |
| `sendgrid_lookup_recipient_suppressions` | All active suppressions for a single email address |
| `sendgrid_list_bounces` | Paginated bounce list |
| `sendgrid_list_blocks` | Paginated block list |
| `sendgrid_list_invalid_emails` | Paginated invalid email list |
| `sendgrid_list_spam_reports` | Paginated spam complaint list |
| `sendgrid_list_unsubscribes` | Paginated global unsubscribe list |

### Account & Settings

| Tool | Description |
|---|---|
| `sendgrid_list_verified_senders` | Verified sender identities and verification status |
| `sendgrid_get_tracking_settings` | Click, open, and subscription tracking configuration |
| `sendgrid_get_mail_settings` | Sandbox mode, footer, bypass settings |
| `sendgrid_get_account_summary` | Credits, capabilities, and account health notes |
| `sendgrid_get_recent_operational_summary` | Full readiness check with action items |

---

## Resources

Resources are live data snapshots that agents can load as context without calling a tool explicitly.

| URI | Contents |
|---|---|
| `sendgrid://account/summary` | Credits, capabilities, verified sender count, health notes |
| `sendgrid://templates` | All dynamic templates with active version name |
| `sendgrid://stats/last-7-days` | Totals and derived metrics for the past 7 days |
| `sendgrid://stats/last-30-days` | Totals and derived metrics for the past 30 days |
| `sendgrid://suppressions/overview` | Counts and samples for each suppression type |
| `sendgrid://settings/tracking` | Click, open, subscription, and analytics tracking config |
| `sendgrid://settings/mail` | Mail settings: sandbox, footer, bypass flags |
| `sendgrid://senders` | Verified senders with verification status |

---

## Prompts

Prompts encode multi-step agent workflows that reference the tools and resources above.

| Prompt | Workflow |
|---|---|
| `summarize_deliverability_health` | Fetch stats, check suppressions, produce health score and recommendations |
| `troubleshoot_message_delivery` | Search activity, check suppressions, diagnose and rank likely causes |
| `compare_sendgrid_time_ranges` | Pull two periods, compare metrics, explain trend narrative |
| `review_template_for_transactional_use` | Inspect template, score readiness, list blocking issues |
| `safe_test_send_checklist` | Validate account, sender, template, recipient, then test-send |

---

## Usage Examples

### Validate before sending

```json
{
  "tool": "sendgrid_validate_send_payload",
  "input": {
    "from": { "email": "noreply@yourapp.com", "name": "Your App" },
    "to": [{ "email": "user@example.com" }],
    "template_id": "d-abc123xyz",
    "dynamic_template_data": {
      "first_name": "Jane",
      "action_url": "https://yourapp.com/confirm?token=abc"
    }
  }
}
```

### Send a transactional email

```json
{
  "tool": "sendgrid_send_email",
  "input": {
    "approval_token": "replace-with-strong-random-token",
    "from": { "email": "noreply@yourapp.com", "name": "Your App" },
    "to": [{ "email": "user@example.com", "name": "Jane Doe" }],
    "subject": "Confirm your email address",
    "html": "<p>Click <a href='https://yourapp.com/confirm?token=abc'>here</a> to confirm.</p>",
    "text": "Confirm your email: https://yourapp.com/confirm?token=abc",
    "categories": ["onboarding", "transactional"]
  }
}
```

### Investigate a delivery failure

```json
{
  "tool": "sendgrid_troubleshoot_recipient_delivery",
  "input": { "email": "user@example.com" }
}
```

### Check deliverability health

```json
{
  "tool": "sendgrid_get_deliverability_summary",
  "input": { "period": "30d" }
}
```

### Compare two periods

```json
{
  "tool": "sendgrid_compare_stats_ranges",
  "input": {
    "range_a": { "start_date": "2024-01-01", "end_date": "2024-01-31" },
    "range_b": { "start_date": "2024-02-01", "end_date": "2024-02-29" }
  }
}
```

---

## API Key Permissions

Create a restricted API key at **SendGrid → Settings → API Keys**. Grant only the permissions your use case requires.

| Scope | Required for |
|---|---|
| **Mail Send** | `sendgrid_send_email`, `sendgrid_test_send_email` |
| **Template Engine — Read** | All `sendgrid_*template*` tools |
| **Email Activity — Read** | `sendgrid_search_email_activity`, `sendgrid_get_message_details`, troubleshoot tools |
| **Stats — Read** | All `sendgrid_*stats*` and `sendgrid_get_deliverability_summary` tools |
| **Suppressions — Read** | All `sendgrid_list_*` and `sendgrid_*suppression*` tools |
| **Verified Senders — Read** | `sendgrid_list_verified_senders` |
| **Tracking Settings — Read** | `sendgrid_get_tracking_settings` |
| **Mail Settings — Read** | `sendgrid_get_mail_settings` |
| **User Account — Read** | `sendgrid_get_account_summary` |

For read-only deployments (default), omit **Mail Send** and keep `SENDGRID_READ_ONLY=true`.

---

## Plan Limitations

Some SendGrid APIs are gated by plan tier or paid add-ons. The server handles these gracefully — affected tools return a structured `planWarning` field rather than throwing an error.

| Feature | Requirement | Affected Tools |
|---|---|---|
| **Email Activity API** | Email Activity add-on (Pro/Premier, or separate purchase) | `search_email_activity`, `get_message_details`, `troubleshoot_*` |
| **Domain Authentication** | Pro plan or higher | Surfaced in `get_account_summary`; missing data returned silently |
| **Subuser Management** | Pro plan or higher | `subusers_count` is `undefined` on lower plans |
| **IP Pool Routing** | Dedicated IP (Pro+) | Omit `ip_pool_name` from send payloads if not provisioned |

---

## Security

### Defaults

| Behaviour | Default |
|---|---|
| PII redaction in logs | **On** (`REDACT_PII=true`) — email addresses are masked in all log output |
| API key in logs | **Never** logged under any circumstance |
| Attachment content in logs | **Never** — only filename, MIME type, and approximate size are recorded |
| Sensitive headers in logs | Redacted — `Authorization`, `X-SMTPAPI`, and similar headers are masked |

### Send safety modes

| Mode | Env var | Behaviour |
|---|---|---|
| **Normal** | — | Sends proceed after payload validation |
| **Read-only (default)** | `SENDGRID_READ_ONLY=true` | All writes blocked; validation and reads still function |
| **Test-mode** | `SENDGRID_TEST_MODE_ONLY=true` | `sendgrid_send_email` blocked; `sendgrid_test_send_email` allowed only to configured allowlist |

### Enabling write operations (manual approval)

Write operations (sending email) require **both** server configuration approval and runtime approval.

**1) Config approval (server startup):**

```bash
SENDGRID_READ_ONLY=false
SENDGRID_WRITES_ENABLED=true
SENDGRID_WRITE_APPROVAL_TOKEN='replace-with-strong-random-token'
```

**2) Runtime approval (per tool call):**

Provide `approval_token` in every call to a write tool (e.g. `sendgrid_send_email`, `sendgrid_test_send_email`).

### Attachment validation

Attachments are rejected if any of the following conditions are met:

- Any single attachment exceeds **10 MB**
- Total attachment payload exceeds **30 MB**
- MIME type matches a known executable class (`.exe`, `.sh`, `application/x-msdownload`, etc.)

---

## Troubleshooting

**`SENDGRID_API_KEY environment variable is required`**
Set the variable in your shell environment or in the `env` block of your MCP client config.

**`SendGrid authentication failed`**
Verify the key starts with `SG.`, has not been revoked, and has the required scopes. Check **SendGrid → Settings → API Keys**.

**Email Activity tools return a `planWarning`**
The Email Activity API requires the Email Activity add-on, available on Pro and Premier plans or as a separate purchase. The tools degrade gracefully with an explanatory message.

**`Policy violation [READ_ONLY]`**
The server runs read-only by default. To enable writes, set `SENDGRID_READ_ONLY=false` and restart.

**`Policy violation [WRITES_DISABLED]`**
Write operations are disabled unless explicitly enabled. Set `SENDGRID_WRITES_ENABLED=true` and restart.

**`Policy violation [WRITE_APPROVAL_REQUIRED]`**
Write tools require manual runtime approval. Provide `approval_token` matching `SENDGRID_WRITE_APPROVAL_TOKEN`.

**`Policy violation [TEST_SEND_ALLOWLIST]`**
`SENDGRID_TEST_MODE_ONLY=true` is set and the recipient is not on the allowlist. Add the address to `SENDGRID_ALLOWED_TO_EMAILS` or its domain to `SENDGRID_ALLOWED_TO_DOMAINS`.

**No verified senders found**
At least one sender identity must be verified before sending. Go to **SendGrid → Settings → Sender Authentication → Verify a Single Sender**.

**Stats tools return empty data**
Stats for the current day or very recent periods may not yet be aggregated. Use a date range with an end date at least one day in the past.

**HTTP transport: client cannot connect**
Confirm `MCP_TRANSPORT=http` and `MCP_HTTP_PORT` are set, then connect to `http://localhost:{port}/mcp`. Validate with: `curl http://localhost:3100/health`.

---

## Development

```bash
# Clone and install
git clone https://github.com/your-org/mcp-sendgrid-server.git
cd mcp-sendgrid-server
pnpm install

# Run in watch mode (stdio)
SENDGRID_API_KEY=SG.your-key pnpm dev

# Build
pnpm build

# Test
pnpm test
pnpm test:coverage

# Lint and format
pnpm lint
pnpm format
pnpm typecheck
```

### Project structure

```
src/
├── config/          Environment loading, typed Config object
├── client/          SendGrid HTTP client — fetch-based, retry/backoff, error normalization
├── utils/           Logger, PII redaction, error mapping, retry, pagination, dates
├── schemas/         Zod schemas for every tool input
├── domains/         Business logic by domain (mail, templates, activity, stats, suppressions, settings, senders, account)
├── mcp/
│   ├── tools/       MCP tool registrations — one file per domain
│   ├── resources/   MCP resource registrations
│   ├── prompts/     MCP prompt definitions
│   └── server.ts    McpServer factory
└── index.ts         Entry point — stdio or HTTP transport
```

---

## License

[MIT](LICENSE) © 2024

---

> **Vibe coded** — this project was built entirely through natural-language prompts with [Claude Code](https://claude.ai/code). No manual code was written.

*Not affiliated with or endorsed by Twilio SendGrid. SendGrid is a trademark of Twilio Inc.*
