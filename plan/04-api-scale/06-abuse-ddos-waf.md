# Abuse Protection, WAF and DDoS Readiness

> **Plan path:** `plan/04-api-scale/06-abuse-ddos-waf.md`

## Purpose

Protect Nexosophy from automated abuse and volumetric/request-layer attacks without relying solely on app servers.

## Product outcomes

- Common abusive traffic is rejected before expensive work.
- Account and sharing features resist enumeration/scraping attacks.

## Required capabilities

- CDN/WAF managed rules.
- Bot/rate controls for public/auth endpoints.
- IP reputation/challenge options.
- Request body/header size limits.
- Upload quotas.
- Search scraping limits.
- Share-link brute-force protection.
- Credential-stuffing monitoring.
- API key scopes and revocation.
- Emergency global/feature kill switches.

## Routes / surfaces

- `Public site`
- `auth`
- `share links`
- `API`

## Core data model

- `AbuseEvent`
- `BlockedPrincipal`
- `ApiKey`

## Service / API contract

- Reject oversized/invalid requests at edge/proxy where possible.
- Security events feed monitoring and support investigation.

## Scale, concurrency and resilience

- DDoS traffic should be absorbed at edge/provider, not autoscale origin infinitely.
- Autoscaling maximums and spend alerts prevent cost-amplification attacks.

## Critical risks

- Aggressive bot rules can block university/corporate NAT users.
- Public sharing can become an exfiltration/scraping surface.

## Responsive / accessibility

- User-facing flows must specify desktop, tablet and phone behavior.
- Keyboard, focus, semantic labeling and reduced-motion behavior are mandatory on critical paths.
- Loading, empty, denied, error and degraded states are designed, not improvised.

## Observability

- Structured logs with request/correlation IDs and redaction.
- Endpoint/job/provider latency, errors and saturation metrics.
- Alerts must be actionable and tied to a runbook.

## Testing

- Unit tests for domain rules.
- Integration tests for database/cache/queue/provider boundaries.
- Authorization/tenant-isolation tests.
- Concurrency/race tests where multiple writers are possible.
- Load tests for hot endpoints and expensive operations.

## Definition of Done

- [ ] WAF/rate policies documented by endpoint class.
- [ ] Basic abuse simulation performed in staging.
- [ ] Emergency block/kill-switch runbook tested.
- [ ] Failure/retry behavior tested.
- [ ] Telemetry and operational ownership documented.
- [ ] Spec/API/schema docs updated.