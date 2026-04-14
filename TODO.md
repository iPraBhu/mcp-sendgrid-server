# MCP SendGrid Server — Feature & Optimization TODO

This checklist captures the recommended “must-have” features and optimizations discussed.

## Safety & Governance
- [x] Default-safe read-only mode (server starts read-only unless explicitly disabled)
- [x] Config approval for writes (`SENDGRID_WRITES_ENABLED=true`)
- [x] Runtime approval for writes (per-call `approval_token`)
- [ ] Policy snapshot tool/resource (expose current mode, allowlists, region, write-enable state)
- [ ] Output-level PII redaction toggle for diagnostic tools (not just logs)

## Reliability & Performance
- [ ] Honor `Retry-After` header on 429s (rate-limit compliance)
- [ ] Global concurrency limit for outbound SendGrid calls (bounded parallelism)
- [ ] Request coalescing for identical GETs (short window)
- [ ] TTL cache for resource-like reads (templates/senders/account/stats)
- [ ] Endpoint-specific timeout defaults (activity search vs simple reads)

## Agent UX
- [ ] Consistent response envelope across tools (`summary`, `data`, `warnings`, `next_steps`)
- [ ] Deterministic pagination contract everywhere (`hasMore` + cursor/offset)
- [ ] Capability/capacities resource (plan features, add-ons detected, enabled tools)
- [ ] Traceability improvements (ensure sends/test-sends always stamp category/header)

## Operational Write Coverage (guardrailed)
- [ ] Suppression management write tools (remove/add suppression entries with strong guardrails)
- [ ] Template write tools (set active version / safe updates with approvals)

