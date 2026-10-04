# Nexosophy Scope, Boundaries & Non-Goals

> **Status:** canonical product-governance specification

## 1. Purpose

Define what Nexosophy owns natively, what it integrates, what it imports/exports, what it delegates to specialist systems, and what is deliberately out of scope.

The purpose is to prevent uncontrolled scope and parallel sources of truth.

## 2. Scope classification

Every major capability must be classified as one of:

- **Native** — Nexosophy owns business state and user experience.
- **Integrated** — an external provider performs a specialized capability through an adapter.
- **Imported / exported** — Nexosophy exchanges portable files/data but does not reproduce the external product.
- **Embedded/provider-hosted** — the user may be redirected to or interact with a provider-hosted surface.
- **Deferred** — intentionally not part of the current production sequence.
- **Out of scope** — explicitly rejected unless a future ADR/product revision changes the boundary.

## 3. Native scope

Nexosophy owns:

- internal users/profiles;
- workspaces;
- memberships/RBAC/sharing;
- recursive node tree;
- native documents;
- notes/infinite pages;
- whiteboards;
- tasks/reminders/calendar;
- search/tags/relations/backlinks;
- history/trash/recovery;
- templates;
- references/citation records;
- student/course workflows;
- postgraduate workflows;
- research/ELN/lab workflows;
- reporting/investigation workflows;
- structured datasets/analysis metadata;
- entitlements/quotas as internal effective state;
- notifications/activity;
- audit trail;
- app/public UX;
- export orchestration.

## 4. Integrated scope

External providers may own specialist execution while Nexosophy owns the internal contract.

### Clerk

Owns:

- authentication;
- external identity;
- OAuth;
- sessions;
- MFA/passkeys;
- recovery.

Nexosophy owns:

- internal User;
- Workspace;
- Role;
- Permission;
- suspension/business state.

### Stripe

Owns:

- payment processing;
- Checkout;
- invoices;
- payment methods;
- subscription billing primitives;
- Customer Portal;
- payout processing.

Nexosophy owns:

- BillingAccount mapping;
- Plan/PlanVersion;
- effective entitlements;
- usage quotas;
- product access.

### Object storage

Owns blob durability/transfer primitives.

Nexosophy owns:

- asset metadata;
- authorization;
- upload session state;
- trust/scan state;
- attachment relationships.

### Email provider

Owns delivery transport.

Nexosophy owns:

- notification intent;
- templates/content policy;
- preference/quiet-hour rules;
- delivery audit metadata.

### Search provider

May own indexing/query execution.

PostgreSQL/Nexosophy remains source of truth.

### Office editor provider

May own Office-format editing runtime.

Nexosophy owns:

- file identity;
- authorization;
- versions;
- storage;
- history.

## 5. Imported/exported scope

Nexosophy supports common portable formats, but does not claim perfect fidelity with every external application.

Examples:

- PDF;
- DOCX;
- XLSX;
- PPTX;
- Markdown;
- TXT;
- CSV/TSV;
- JSON;
- BibTeX;
- RIS;
- images;
- audio/video where supported;
- ZIP/archive export.

Every format has an explicit fidelity classification:

- native editable;
- partially editable;
- preview-only;
- preserved attachment;
- export-only.

## 6. Explicit non-goals

Nexosophy is not:

- a full Microsoft Office clone;
- a complete Google Workspace clone;
- a general cloud drive replacement at provider-infrastructure level;
- an identity provider;
- a payment processor;
- a generalized ERP;
- a social network;
- unrestricted compute hosting;
- a medical device system;
- a guaranteed HIPAA/FERPA/GxP/etc. compliant product merely because controls exist;
- a laboratory instrument control system;
- a complete statistical package replacement;
- a source-code hosting platform;
- a public website builder/CMS for arbitrary sites.

## 7. Office boundary

Nexosophy must not spend years reimplementing Office fidelity.

Policy:

- preserve original binaries;
- provide preview where possible;
- offer Office editing only through approved provider integration;
- document unsupported features;
- create new file versions when provider saves;
- never silently convert/destructively rewrite originals.

## 8. Compute boundary

Code/notebook documents are native as content.

Execution is separate.

Rules:

- arbitrary code never executes in web/API processes;
- compute, if enabled, runs in isolated containers/microVMs or approved sandbox service;
- resource/time/network/filesystem limits apply;
- outputs are persisted as artifacts;
- execution can be disabled while editing remains available.

## 9. AI boundary

AI assistance may help with:

- summarization;
- suggestions;
- extraction;
- classification;
- drafting support;
- semantic retrieval.

AI must not become the canonical source of truth for:

- permissions;
- billing;
- grades;
- signed lab records;
- publication approval;
- legal/audit state.

AI-generated content must remain attributable/inspectable where material.

## 10. Compliance boundary

Nexosophy may implement controls relevant to privacy/security/compliance.

It must not claim certification or regulatory compliance that has not been independently established.

Product copy must distinguish:

- implemented controls;
- contractual commitments;
- formal certification;
- customer configuration obligations.

## 11. Data ownership boundary

PostgreSQL/internal stores are authoritative for Nexosophy business state unless an ADR explicitly states otherwise.

External provider state is reconciled into internal models for:

- identity mapping;
- subscription state;
- file sync;
- external calendar sync;
- connected-app metadata.

Provider callbacks/webhooks are treated as untrusted until authenticated/validated.

## 12. Hot-path dependency rule

A normal document read should not synchronously require:

- Stripe;
- Clerk network calls where local token/session verification is supported;
- email provider;
- conversion worker;
- analytics provider;
- Office editor provider.

Critical hot paths must minimize synchronous dependency chains.

## 13. Fallback policy

Every integration defines:

- timeout;
- retry;
- idempotency;
- circuit-breaker behavior;
- user-visible degraded state;
- reconciliation process;
- observability;
- support/runbook ownership.

## 14. Scope-change gate

A request that adds a new major provider, source of truth, permission model, persistent subsystem or compute runtime requires:

1. product fit review;
2. ADR;
3. threat model;
4. data classification review;
5. scalability/failure analysis;
6. migration/exit strategy.

## 15. Definition of Done

### Planning

- [x] Major capabilities classified as native/integrated/imported/delegated.
- [x] Clerk/Stripe/storage/search/Office boundaries explicit.
- [x] Compute and AI boundaries explicit.
- [x] Compliance-claim boundary explicit.
- [x] Scope-change gate defined.

### Implementation

- [ ] Each integration has an adapter boundary and failure policy.
- [ ] Unsupported format behavior is explicit in product UX.
- [ ] Provider failure tests verify graceful degradation/reconciliation.
- [ ] No unapproved provider becomes a hidden source of business truth.
- [ ] Production copy avoids unsupported compliance claims.

## 16. Next document

Continue to `03-definition-of-done.md`.
