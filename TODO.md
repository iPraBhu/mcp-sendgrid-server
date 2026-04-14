# MCP SendGrid Server — Feature & Optimization TODO

This checklist captures the recommended “must-have” features and optimizations discussed.

## Safety & Governance
- [x] Default-safe read-only mode (server starts read-only unless explicitly disabled)
- [x] Config approval for writes (`SENDGRID_WRITES_ENABLED=true`)
- [x] Runtime approval for writes (per-call `approval_token`)
- [x] Policy snapshot tool/resource (`sendgrid://config/policy` — exposes mode, allowlists, region, write-enable state)
- [x] Output-level PII redaction toggle for diagnostic tools (`redact_pii` param on activity tools)

## Reliability & Performance
- [x] Honor `Retry-After` header on 429s (extracted from response headers, passed through NormalizedError)
- [x] Global concurrency limit for outbound SendGrid calls (`SENDGRID_MAX_CONCURRENCY`, default 10, via Semaphore)
- [x] Request coalescing for identical GETs (in-flight deduplication via `Map<url, Promise>` in `SendGridClient`)
- [x] TTL cache for resource-like reads (5-minute TTL on all 8 resources via TtlCache)
- [x] Endpoint-specific timeout defaults (`SENDGRID_ACTIVITY_TIMEOUT_MS`, default 60 s for `/messages` endpoints)

## Agent UX
- [ ] Consistent response envelope across tools (`summary`, `data`, `warnings`, `next_steps`)
- [ ] Deterministic pagination contract everywhere (`hasMore` + cursor/offset)
- [ ] Capability/capacities resource (plan features, add-ons detected, enabled tools)
- [ ] Traceability improvements (ensure sends/test-sends always stamp category/header)

## Operational Write Coverage (guardrailed)
- [x] Suppression management write tools (delete bounce/block/invalid/spam/global-unsubscribe; add global unsubscribes)
- [x] Template write tools (create template, create version, activate version — all require approval token)

