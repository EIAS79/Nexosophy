# Help Center & Customer Support

> **Status:** canonical Nexosophy implementation specification.

## Purpose

Define self-service help, support intake and internal diagnostic boundaries without exposing private workspace content by default.

## Help center

- /help landing page with searchable categories.
- Getting started, account/security, files/editors, calendar/productivity, academic/research/lab/reporting, billing and troubleshooting sections.
- Contextual links from product errors/settings to specific help articles.
- Article versioning for behavior that differs by plan/provider/app version.
- Status/incident links for known service problems.

## Support intake

- Authenticated support form pre-fills safe account/workspace identifiers but not document bodies.
- User can choose whether to attach screenshots/log bundle/content.
- Category/severity and affected feature/provider.
- Request/correlation ID capture from errors.
- Billing support can reference Stripe customer/subscription identifiers through secure admin tooling.

## Privacy and security

- Support staff permissions are least privilege.
- No hidden 'login as user' access without explicit audited support-access design.
- Sensitive attachment retention policy is defined.
- Support exports/log bundles redact secrets and authentication tokens.

## Operations

- Support SLA/severity definitions by plan when commercial policy requires.
- Escalation path to engineering/on-call for P0/P1.
- Known-issue macros link to status page rather than inventing independent incident text.
- Support analytics tracks categories/time-to-resolution, not customer document content.

## Definition of Done

- Critical user journeys have matching help content before GA.
- Support request can be correlated to backend telemetry safely.
- Billing/auth/security escalations have explicit runbooks.
- Help center is responsive, searchable and accessible.

## Cross-cutting requirements

- Desktop, tablet and phone behavior must be intentionally designed for user-facing surfaces.
- Accessibility, authorization, privacy, error states, observability and automated tests are release requirements.
- Any external provider is accessed through a documented adapter and failure mode.
- No document in this file overrides stricter requirements in product governance, security or API-scale specifications.