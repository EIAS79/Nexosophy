# Feature & Persona Marketing Pages

> **Status:** canonical Nexosophy implementation specification.

## Purpose

Define the public acquisition pages that explain Nexosophy to different user groups without duplicating product logic or creating misleading claims.

## Required pages

- /features overview with capability groups and deep links.
- /students covering notes, courses, assignments, exams, calendar and study tools.
- /researchers covering references, literature, thesis/research projects and analysis.
- /professors covering teaching, supervision, review and collaboration.
- /labs covering ELN, protocols, samples, inventory and equipment.
- /reporters covering sources, evidence, claims, interviews, reports and timelines.
- /teams or institutions covering workspaces, roles, sharing, security and billing where applicable.

## Page composition

- Hero with role-specific problem and clear CTA.
- Capability proof sections that link to real product features.
- Workflow story from capture to output rather than a random feature grid.
- Responsive screenshots/illustrations when product UI exists.
- Security/privacy/data ownership block appropriate to audience.
- Pricing or contact-sales CTA only where supported by current commercial policy.
- FAQ that does not promise unavailable functionality.

## SEO and analytics

- Unique title/meta/canonical/schema where appropriate.
- Server-rendered crawlable content for indexable pages.
- UTM/referrer preservation into signup without leaking sensitive query data.
- CTA/impression analytics with low-cardinality event names and consent policy.
- Performance budget protects LCP/CLS/INP; marketing media is responsive/lazy where appropriate.

## Definition of Done

- Every target persona has a coherent public journey.
- All claims map to shipped or explicitly labeled upcoming capabilities.
- Mobile pages remain fully usable and accessible.
- Broken CTA/link checker passes in CI or release validation.

## Cross-cutting requirements

- Desktop, tablet and phone behavior must be intentionally designed for user-facing surfaces.
- Accessibility, authorization, privacy, error states, observability and automated tests are release requirements.
- Any external provider is accessed through a documented adapter and failure mode.
- No document in this file overrides stricter requirements in product governance, security or API-scale specifications.