# mcp-sendgrid-server

An MCP (Model Context Protocol) server that connects AI coding agents to your [Twilio SendGrid](https://sendgrid.com) account. Once configured, your agent can send email, inspect delivery activity, pull stats, manage suppressions, and review templates — all through natural language.

[![npm version](https://img.shields.io/npm/v/mcp-sendgrid-server.svg)](https://www.npmjs.com/package/mcp-sendgrid-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node ≥18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-purple)](https://modelcontextprotocol.io)

---

## What it does

The server exposes SendGrid capabilities as MCP tools your agent can call:

- **Send email** — validate payloads, test-send to an allowlist, or send transactional email
- **Templates** — list, inspect, and get readiness reports for dynamic templates
- **Email Activity** — search message logs, view delivery timelines, troubleshoot failed deliveries
- **Stats & Analytics** — global and category stats, period comparisons, deliverability health scores
- **Suppressions** — view and manage bounces, blocks, spam reports, invalid emails, unsubscribes
- **Account & Settings** — verified senders, tracking settings, mail settings, account summary

It is **read-only by default**. Write operations (sending email, modifying suppressions) require explicit opt-in via environment variables plus a runtime approval token on every call.

---

## Requirements

- Node.js `>=18`
- A Twilio SendGrid account and API key

---

## Installation

```bash
# Run without installing (recommended for MCP clients)
npx -y mcp-sendgrid-server

# Or install globally
npm install -g mcp-sendgrid-server
```

---

## Adding to your MCP client

All MCP clients work the same way — you declare the server in a config file and pass your API key as an environment variable. The client spawns the server as a subprocess on `stdio`.

**Generic config block** (works for Cursor, Claude Code, Windsurf, and most other clients):

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

**Config file locations by client:**

| Client | File |
|---|---|
| Cursor | `~/.cursor/mcp.json` (global) or `<project>/.cursor/mcp.json` |
| Claude Code | `~/.claude/claude_mcp_config.json` — or run `claude mcp add sendgrid -e SENDGRID_API_KEY=SG.your-key -- npx -y mcp-sendgrid-server` |
| VS Code | `.vscode/mcp.json` in your project (use `${env:SENDGRID_API_KEY}` to avoid committing the key) |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Zed | `~/.config/zed/settings.json` under `"context_servers"` |

Once added, verify it starts:

```bash
SENDGRID_API_KEY=SG.your-key npx mcp-sendgrid-server
# → [INFO] MCP server connected via stdio. Waiting for requests...
```

---

## Configuration

All configuration is done via environment variables in the `env` block of your MCP client config. No config file is needed.

### Core

| Variable | Required | Default | Possible values | Description |
|---|---|---|---|---|
| `SENDGRID_API_KEY` | **Yes** | — | Any valid `SG.` key | Your SendGrid API key |
| `SENDGRID_MODE` | No | `full` | `full`, `analytics` | `full` enables all tools. `analytics` restricts to stats, email activity, and suppression reads only — nothing can be sent or modified. See [Server Modes](#server-modes). |
| `SENDGRID_REGION` | No | `global` | `global`, `eu` | Use `eu` if your SendGrid account is on the EU data residency plan |
| `SENDGRID_BASE_URL` | No | — | Any URL | Overrides the API base URL entirely. Useful for proxies or testing. Takes precedence over `SENDGRID_REGION`. |

### Write controls

The server has three layered safety switches for write operations. All three must allow a write for it to proceed.

| Variable | Required | Default | Possible values | Description |
|---|---|---|---|---|
| `SENDGRID_READ_ONLY` | No | `true` | `true`, `false` | When `true`, all write operations are blocked. The safe default — set to `false` only when you intend to enable sending. |
| `SENDGRID_WRITES_ENABLED` | No | `false` | `true`, `false` | Second safety switch. Even if `SENDGRID_READ_ONLY=false`, writes remain blocked until this is also `true`. |
| `SENDGRID_WRITE_APPROVAL_TOKEN` | No* | — | Any string | *Required when `SENDGRID_WRITES_ENABLED=true`. Every write tool call must supply this value as `approval_token` at runtime. Use a strong random string. |
| `SENDGRID_TEST_MODE_ONLY` | No | `false` | `true`, `false` | When `true`, `sendgrid_send_email` is blocked entirely. Only `sendgrid_test_send_email` is allowed, and only to addresses/domains on the allowlist. |

**To enable sending**, you need all three:

```json
"env": {
  "SENDGRID_API_KEY": "SG.your-key",
  "SENDGRID_READ_ONLY": "false",
  "SENDGRID_WRITES_ENABLED": "true",
  "SENDGRID_WRITE_APPROVAL_TOKEN": "your-strong-random-token"
}
```

Then pass `"approval_token": "your-strong-random-token"` in every send tool call.

### Allowlists

Used when `SENDGRID_TEST_MODE_ONLY=true` to restrict who emails can be sent to and from.

| Variable | Required | Default | Possible values | Description |
|---|---|---|---|---|
| `SENDGRID_ALLOWED_FROM_DOMAINS` | No | — | Comma-separated domains | Only these domains are permitted as the sender `from` address, e.g. `mycompany.com,partner.com` |
| `SENDGRID_ALLOWED_TO_DOMAINS` | No | — | Comma-separated domains | Recipient domain allowlist for test sends, e.g. `mycompany.com` |
| `SENDGRID_ALLOWED_TO_EMAILS` | No | — | Comma-separated emails | Specific recipient addresses allowed in test-send mode, e.g. `qa@mycompany.com,dev@mycompany.com` |

### Pagination

| Variable | Required | Default | Possible values | Description |
|---|---|---|---|---|
| `SENDGRID_DEFAULT_PAGE_SIZE` | No | `25` | `1`–`100` | Number of results returned per page by default |
| `SENDGRID_MAX_PAGE_SIZE` | No | `100` | `1`–`500` | Hard cap on results per page; capped at 500 server-side |

### Transport & timeouts

| Variable | Required | Default | Possible values | Description |
|---|---|---|---|---|
| `MCP_TRANSPORT` | No | `stdio` | `stdio`, `http` | `stdio` is for IDE/CLI agents (default). `http` starts a long-lived HTTP server. |
| `MCP_HTTP_PORT` | No | `3100` | Any valid port | Listening port when `MCP_TRANSPORT=http`. Connect at `http://localhost:{port}/mcp`. Health check at `/health`. |
| `SENDGRID_TIMEOUT_MS` | No | `30000` | Milliseconds | HTTP request timeout for most API calls |

### Logging

| Variable | Required | Default | Possible values | Description |
|---|---|---|---|---|
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, `error` | Log verbosity. Use `debug` to trace all API calls. |
| `REDACT_PII` | No | `true` | `true`, `false` | When `true`, email addresses are masked in all log output. API keys are never logged regardless. |

---

## Server Modes

### Full mode (default)

All tools, resources, and prompts are available. Write operations are still gated by the write control variables above.

```json
"env": {
  "SENDGRID_API_KEY": "SG.your-key",
  "SENDGRID_MODE": "full"
}
```

### Analytics mode

Only stats, email activity, and suppression read tools are registered. Nothing can be sent or modified — the mode forcibly overrides `SENDGRID_READ_ONLY` and `SENDGRID_WRITES_ENABLED` regardless of what you set. Useful when you want an agent that can investigate deliverability but has no ability to send.

```json
"env": {
  "SENDGRID_API_KEY": "SG.your-key",
  "SENDGRID_MODE": "analytics"
}
```

**Available in analytics mode:** all stats tools, all email activity tools, suppression read tools, and the `sendgrid://stats/*`, `sendgrid://suppressions/overview`, `sendgrid://config/policy` resources.

**Not registered:** mail send, templates, settings, senders, account tools, suppression write tools.

---

## Tools

### Mail

| Tool | Description |
|---|---|
| `sendgrid_validate_send_payload` | Validate a send payload locally — no API call, no email sent |
| `sendgrid_test_send_email` | Send only to allowlisted recipients; adds a test category and tracing header |
| `sendgrid_send_email` | Send a transactional email; blocked by default, requires write approval |

### Templates

| Tool | Description |
|---|---|
| `sendgrid_list_templates` | List dynamic or legacy templates |
| `sendgrid_get_template` | Full template details including all versions |
| `sendgrid_list_template_versions` | All versions for a template |
| `sendgrid_get_template_version` | Detail for a specific version |
| `sendgrid_get_template_readiness_report` | Readiness score, issues, and warnings for production use |

### Email Activity

> Requires the **Email Activity add-on** on your SendGrid plan (Pro/Premier or separate purchase). Tools return a `planWarning` if not available.

| Tool | Description |
|---|---|
| `sendgrid_search_email_activity` | Search the message log by recipient, subject, status, date, or category |
| `sendgrid_get_message_details` | Full event timeline for a message by ID |
| `sendgrid_troubleshoot_message` | Structured diagnosis for a specific message |
| `sendgrid_troubleshoot_recipient_delivery` | Investigate why a recipient is not receiving email |

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
| `sendgrid_delete_bounce` | Remove an address from the bounce list (requires write approval) |
| `sendgrid_delete_block` | Remove an address from the block list (requires write approval) |
| `sendgrid_delete_invalid_email` | Remove an address from the invalid email list (requires write approval) |
| `sendgrid_delete_spam_report` | Remove an address from the spam report list (requires write approval) |
| `sendgrid_delete_global_unsubscribe` | Remove an address from the global unsubscribe list (requires write approval) |
| `sendgrid_add_global_unsubscribes` | Add addresses to the global unsubscribe list (requires write approval) |

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

Resources are live data snapshots agents can read as context. They are cached for 5 minutes.

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
| `sendgrid://config/policy` | Active server mode, write policy, allowlists, and logging config |

---

## Prompts

Built-in multi-step workflows your agent can invoke by name.

| Prompt | What it does |
|---|---|
| `summarize_deliverability_health` | Fetches stats, checks suppressions, produces a health score and recommendations |
| `troubleshoot_message_delivery` | Searches activity, checks suppressions, diagnoses and ranks likely causes |
| `compare_sendgrid_time_ranges` | Pulls two time periods, compares metrics, explains the trend |
| `review_template_for_transactional_use` | Inspects a template, scores readiness, lists blocking issues |
| `safe_test_send_checklist` | Validates account, sender, template, and recipient, then test-sends |

---

## API Key Permissions

Create a restricted API key at **SendGrid → Settings → API Keys**. Grant only what your use case needs.

| Permission | Required for |
|---|---|
| Mail Send | `sendgrid_send_email`, `sendgrid_test_send_email` |
| Template Engine — Read | All template tools |
| Email Activity — Read | All activity and troubleshoot tools |
| Stats — Read | All stats tools and `sendgrid_get_deliverability_summary` |
| Suppressions — Read | All suppression list and lookup tools |
| Suppressions — Write | Suppression delete/add tools |
| Verified Senders — Read | `sendgrid_list_verified_senders` |
| Tracking Settings — Read | `sendgrid_get_tracking_settings` |
| Mail Settings — Read | `sendgrid_get_mail_settings` |
| User Account — Read | `sendgrid_get_account_summary` |

For read-only deployments (the default), omit Mail Send and Suppressions — Write.

---

## Plan Limitations

Some APIs require higher SendGrid plans or paid add-ons. Affected tools return a `planWarning` field instead of throwing an error.

| Feature | Requirement |
|---|---|
| Email Activity API | Email Activity add-on (Pro/Premier, or separate purchase) |
| Domain Authentication details | Pro plan or higher |
| Subuser counts | Pro plan or higher |
| IP Pool Routing | Dedicated IP (Pro+) — omit `ip_pool_name` from send payloads if not provisioned |

---

## Troubleshooting

**`SENDGRID_API_KEY environment variable is required`**
The key is missing. Set it in the `env` block of your MCP client config.

**`SendGrid authentication failed`**
The key has been revoked, has insufficient permissions, or does not start with `SG.`. Check **SendGrid → Settings → API Keys**.

**`Policy violation [READ_ONLY]`**
The server is in read-only mode (the default). Set `SENDGRID_READ_ONLY=false` and restart to allow writes.

**`Policy violation [WRITES_DISABLED]`**
`SENDGRID_READ_ONLY=false` but `SENDGRID_WRITES_ENABLED` is still `false`. Set it to `true` and provide a `SENDGRID_WRITE_APPROVAL_TOKEN`.

**`Policy violation [WRITE_APPROVAL_REQUIRED]`**
Writes are enabled but the `approval_token` field was not included in the tool call, or it does not match `SENDGRID_WRITE_APPROVAL_TOKEN`.

**`Policy violation [TEST_SEND_ALLOWLIST]`**
`SENDGRID_TEST_MODE_ONLY=true` and the recipient is not on the allowlist. Add the address to `SENDGRID_ALLOWED_TO_EMAILS` or the domain to `SENDGRID_ALLOWED_TO_DOMAINS`.

**Email Activity tools return a `planWarning`**
The Email Activity add-on is not enabled on your account. Tools degrade gracefully with an explanatory message.

**Stats tools return empty data**
Stats for the current day may not yet be aggregated. Use a date range ending at least one day in the past.

**No verified senders found**
At least one sender must be verified before sending. Go to **SendGrid → Settings → Sender Authentication → Verify a Single Sender**.

---

## Development

```bash
git clone https://github.com/iPraBhu/mcp-sendgrid-server.git
cd mcp-sendgrid-server
pnpm install

SENDGRID_API_KEY=SG.your-key pnpm dev   # watch mode
pnpm build                               # compile TypeScript
pnpm test                                # run tests
pnpm typecheck                           # type check without emitting
```

---

## License

[MIT](LICENSE) © 2026 Pratik Bhuite

*Not affiliated with or endorsed by Twilio SendGrid. SendGrid is a trademark of Twilio Inc.*
