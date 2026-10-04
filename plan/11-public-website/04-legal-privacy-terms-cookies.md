# Legal, Privacy, Terms & Cookie Surfaces

> **Status:** canonical Nexosophy implementation specification.

## Purpose

Define the public legal surfaces and the product hooks needed so published policies match actual data and billing behavior.

## Required public routes

- /privacy — privacy policy.
- /terms — terms of service.
- /cookies — cookie/analytics disclosure and preferences where required.
- /billing-terms or incorporated subscription/refund/cancellation language.
- /acceptable-use — abuse and prohibited-use rules where needed.
- /subprocessors — provider transparency if product/legal policy requires it.

## Product integration

- Signup/checkout surfaces link the current policy versions.
- Material policy changes can record effective date and optionally require renewed acceptance if legally required.
- Cookie/analytics consent state is stored separately from essential authentication/session state.
- Marketing analytics respects consent policy and Do-Not-Track/region policy where adopted.
- Account export/deletion/support flows link to relevant privacy rights instructions.

## Data model

- PolicyVersion with type, effective_at, published_at, content hash/version.
- PolicyAcceptance with user, policy version, timestamp and context only where explicit acceptance is required.
- ConsentPreference with category/version/time where a consent manager is used.

## Operational controls

- Legal text is version-controlled or CMS-published with review workflow.
- Deploying code must not silently change legal meaning.
- Links from Stripe/Clerk/public emails point to production canonical legal URLs.
- Security/privacy team reviews discrepancies between policy and implementation.

## Definition of Done

- Production legal routes render without authentication.
- Version/effective dates are visible.
- Checkout/signup links resolve correctly.
- Analytics/cookie behavior matches published policy.
- Legal review is recorded before GA.

## Cross-cutting requirements

- Desktop, tablet and phone behavior must be intentionally designed for user-facing surfaces.
- Accessibility, authorization, privacy, error states, observability and automated tests are release requirements.
- Any external provider is accessed through a documented adapter and failure mode.
- No document in this file overrides stricter requirements in product governance, security or API-scale specifications.