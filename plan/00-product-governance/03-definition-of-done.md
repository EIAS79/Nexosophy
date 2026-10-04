# Nexosophy Global Definition of Done

> **Status:** canonical release-quality gate  
> **Applies to:** every feature, endpoint, migration, background job, integration and phase

## 1. Principle

A feature is not done because the happy-path UI renders.

A feature is done only when its functional, authorization, data, failure, responsive, accessibility, observability, performance and operational requirements are satisfied for its release scope.

## 2. Required feature contract

Every implementation must identify:

- owner/spec;
- user outcome;
- routes/surfaces;
- domain entities;
- authorization rule;
- API/service boundary;
- persistence behavior;
- failure states;
- retry/idempotency behavior;
- scale characteristics;
- observability;
- tests;
- rollout/migration considerations.

## 3. Functional gate

- acceptance criteria implemented;
- empty/loading/error/denied states implemented;
- destructive actions have confirmation/recovery where required;
- linked systems update consistently;
- no fake or hardcoded production data path remains.

## 4. Authorization / tenancy gate

For workspace-owned resources:

- authentication checked;
- workspace/tenant scope enforced server-side;
- action permission checked;
- IDOR tests exist;
- search/export/background jobs honor authorization;
- realtime room access honors authorization;
- revocation behavior is tested.

A frontend-hidden button is never an authorization control.

## 5. Data gate

When persistence changes:

- schema/migration exists;
- indexes support expected access paths;
- uniqueness/integrity constraints exist where possible;
- backfill plan exists if required;
- rollback/forward-recovery strategy exists;
- retention/deletion implications reviewed;
- derived systems/cache/search reconciliation defined.

## 6. API gate

Every endpoint must define:

- typed request/response;
- validation;
- auth/authz;
- stable error codes;
- pagination for unbounded collections;
- idempotency for retry-sensitive writes;
- concurrency/conflict behavior;
- request size limits;
- rate-limit class;
- expected query/fan-out profile;
- latency objective;
- telemetry.

## 7. Background-job gate

Every durable job defines:

- payload schema/version;
- idempotency/deduplication;
- retry policy;
- timeout;
- dead-letter behavior;
- cancellation if user-facing;
- progress/checkpointing if long-running;
- dependency concurrency limits;
- observability;
- reconciliation/replay.

## 8. Provider-integration gate

Every external provider integration defines:

- adapter;
- credentials/secrets handling;
- timeouts;
- retries;
- webhook/callback authentication;
- idempotency;
- outage behavior;
- reconciliation;
- data-retention implications;
- disconnect/revoke path;
- support/runbook.

## 9. Responsive gate

User-facing features must define and test:

- 320–599px phone behavior;
- 600–1023px tablet behavior;
- 1024–1439px desktop behavior;
- 1440px+ wide-screen behavior;
- zoom/text-scale behavior.

No critical workflow may require hover.

Touch targets for primary touch actions target at least 44px.

## 10. Accessibility gate

Critical workflows require:

- semantic structure;
- accessible names;
- visible focus;
- logical keyboard order;
- keyboard operability;
- screen-reader announcements for material async changes;
- non-color-only states;
- contrast;
- reduced-motion behavior;
- accessible alternative for canvas-heavy information.

Target: WCAG 2.2 AA for core flows.

## 11. Security gate

- inputs validated;
- output escaped/sanitized where necessary;
- secrets not logged;
- CSP/XSS/CSRF/SSRF concerns reviewed where applicable;
- file uploads treated as untrusted;
- provider signatures validated;
- abuse/rate controls assigned;
- dependency/security scans pass;
- privileged actions audited.

## 12. Observability gate

Production-critical behavior requires:

- structured logs;
- request/correlation ID;
- error aggregation;
- latency/error metrics;
- saturation metric where relevant;
- trace propagation for distributed flows;
- dashboard/query;
- alert if failure is operationally urgent.

Metric cardinality must be bounded.

## 13. Performance / scalability gate

Every high-frequency or contention-sensitive path documents:

- expected request frequency;
- cacheability;
- DB query count;
- connection use;
- payload size;
- lock/contention risk;
- external calls;
- queue behavior;
- autoscaling dependency.

No unbounded list endpoint is allowed.

Cursor pagination is default for large/mutable collections.

## 14. Test gate

As applicable:

- unit tests;
- integration tests;
- authorization tests;
- tenant-isolation tests;
- provider contract tests;
- E2E critical-path tests;
- accessibility tests;
- concurrency/race tests;
- load/performance tests;
- failure/recovery tests.

## 15. Documentation gate

Update when affected:

- focused spec;
- OpenAPI/contracts;
- migrations;
- ADR;
- runbook;
- environment/config docs;
- public help/docs;
- changelog/release notes.

## 16. Rollout gate

For material changes:

- feature flag if needed;
- staged rollout;
- compatibility window;
- migration order;
- rollback/forward-fix path;
- telemetry to compare before/after.

## 17. Severity gate

### P0

Examples:

- cross-tenant data leak;
- widespread data corruption;
- critical security compromise;
- total service outage without mitigation.

Blocks production and may require emergency rollback.

### P1

Examples:

- major core workflow unavailable;
- broad severe performance regression;
- payment/auth failures with major user impact.

Blocks promotion until resolved or formally mitigated.

P0/P1 defects cannot be waived by ordinary product preference.

## 18. Exception process

A temporary exception requires:

- written ADR/exception record;
- reason;
- risk;
- owner;
- mitigation;
- expiry date;
- follow-up issue.

No indefinite undocumented exception.

## 19. Phase completion gate

A phase closes only when:

- all mandatory deliverables complete;
- required migrations deployed;
- staging validated;
- required tests green;
- security/a11y/scale requirements pass for phase scope;
- telemetry exists;
- known defects classified;
- exit gate signed/recorded.

Later phases do not erase an unmet earlier exit gate.

## 20. Production-ready gate

General availability requires:

- Phase 00–23 gates passed;
- staged launch controls ready;
- backup restore drill passed;
- incident response rehearsed;
- capacity envelope passed;
- tenant-isolation suite passed;
- auth/billing webhooks idempotent;
- legal/privacy surfaces published;
- support/status processes ready;
- no open P0/P1 launch blockers.

## 21. Definition of Done for this governance document

- [x] Functional gate defined.
- [x] Auth/tenancy gate defined.
- [x] Data/API/job/provider gates defined.
- [x] Responsive/accessibility/security/observability/performance gates defined.
- [x] Test/documentation/rollout gates defined.
- [x] Exception and severity policy defined.
- [x] Phase and GA gates defined.

## 22. Next document

Continue to `04-architecture-decisions.md`.
