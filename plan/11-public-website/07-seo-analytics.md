# SEO, Acquisition Analytics & Conversion Measurement

> **Status:** canonical Nexosophy implementation specification.

## Purpose

Define discoverability and product-marketing measurement without harming privacy, page performance or application observability.

## Technical SEO

- Canonical URLs and redirect policy.
- robots.txt and XML sitemap.
- Unique metadata for indexable marketing pages.
- OpenGraph/social cards.
- Structured data only when it truthfully matches page content.
- 404/410/canonical behavior for retired marketing pages.
- Authenticated workspace routes are not indexable.

## Content SEO

- Persona pages target genuine user intent rather than keyword stuffing.
- Documentation/help content may be indexable per support strategy.
- Comparison/landing pages must use factual claims and current feature state.
- Localized pages use hreflang only when real translations exist.

## Analytics event model

- Anonymous page/CTA events where consent/policy permits.
- Signup-start/signup-complete.
- Pricing-plan-selection and checkout-start; payment success comes from verified billing state, not browser return.
- Activation milestones and retention events defined in product analytics spec.
- Campaign/referrer attribution stored with bounded retention and no secret/sensitive query capture.

## Performance

- Marketing scripts load with explicit budget.
- Third-party tags are minimized and consent-gated where required.
- Core Web Vitals are monitored by page type.
- Images/video use responsive delivery and lazy loading except critical hero media.

## Definition of Done

- Sitemap/robots/canonical tests pass.
- Production analytics events are documented and privacy-reviewed.
- Checkout conversion reconciles with Stripe-derived paid state.
- No authenticated/private content appears in public indexing tests.

## Cross-cutting requirements

- Desktop, tablet and phone behavior must be intentionally designed for user-facing surfaces.
- Accessibility, authorization, privacy, error states, observability and automated tests are release requirements.
- Any external provider is accessed through a documented adapter and failure mode.
- No document in this file overrides stricter requirements in product governance, security or API-scale specifications.