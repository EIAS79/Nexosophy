# Nexosophy Canonical Specification Index

> **Status:** canonical planning map.  
> **Rule:** each state machine/domain has one authoritative owner. Phase files orchestrate work and never redefine module behavior.

## Reading order

1. [Production Plan](README.md)
2. [Canonical Implementation Sequence](IMPLEMENTATION_SEQUENCE.md)
3. The focused specification(s) for the current phase
4. The matching execution contract under [13-phases/](13-phases/)

## 00 — Product governance

- [Product Vision](00-product-governance/00-product-vision.md)
- [Personas & Workflows](00-product-governance/01-personas-workflows.md)
- [Scope & Non-Goals](00-product-governance/02-scope-non-goals.md)
- [Global Definition of Done](00-product-governance/03-definition-of-done.md)
- [Architecture Decisions](00-product-governance/04-architecture-decisions.md)
- [Data Classification, Retention & Deletion](00-product-governance/05-data-classification-retention.md)

## 01 — Foundation & experience

- [Monorepo Structure](01-foundation/00-monorepo-structure.md)
- [Environments, Configuration & Secrets](01-foundation/01-environments-configuration.md)
- [CI/CD & Branching](01-foundation/02-ci-cd-branching.md)
- [Design System & Responsive UX](01-foundation/03-design-system-responsive.md)
- [Accessibility & Internationalization](01-foundation/04-accessibility-i18n.md)
- [Observability Foundation](01-foundation/05-observability-foundation.md)
- [Information Architecture, Navigation & App Shell](01-foundation/06-information-architecture-navigation.md)
- [Settings, Preferences & Personalization](01-foundation/07-settings-preferences.md)

## 02 — Identity, access & billing

- [Authentication & Clerk Provider](02-identity-billing/00-auth-clerk.md)
- [Users, Profiles & Internal Identity](02-identity-billing/01-users-profiles-onboarding.md)
- [Workspaces, RBAC & Sharing](02-identity-billing/02-workspaces-rbac-sharing.md)
- [Stripe Payments & Subscriptions](02-identity-billing/03-stripe-billing.md)
- [Entitlements, Quotas & Admin Billing](02-identity-billing/04-entitlements-admin-billing.md)
- [Onboarding & First-Run UX](02-identity-billing/05-onboarding-first-run.md)

## 03 — Data & content platform

- [PostgreSQL Data Architecture](03-data-content/00-postgres-schema.md)
- [Recursive Files & Folders](03-data-content/01-recursive-files-folders.md)
- [Object Storage & Uploads](03-data-content/02-object-storage-uploads.md)
- [History, Trash & Audit](03-data-content/03-history-trash-audit.md)
- [Search & Indexing Infrastructure](03-data-content/04-search-indexing.md)
- [Import, Export & Conversion](03-data-content/05-import-export-conversion.md)

## 04 — API, scale & realtime

- [API Contract & Error Model](04-api-scale/00-api-contract.md)
- [Scalability, Concurrency & Horizontal Capacity](04-api-scale/01-scalability-concurrency.md)
- [Rate Limiting, Idempotency & Backpressure](04-api-scale/02-rate-limit-idempotency.md)
- [Caching, Queues & Workers](04-api-scale/03-cache-queues-workers.md)
- [Realtime Collaboration Architecture](04-api-scale/04-realtime-collaboration.md)
- [Performance SLOs & Capacity Planning](04-api-scale/05-performance-slo-capacity.md)
- [Abuse Protection, WAF & DDoS Readiness](04-api-scale/06-abuse-ddos-waf.md)

## 05 — Core workspace & editors

- [Authenticated Home Dashboard](05-core-workspace/00-app-home-dashboard.md)
- [File Explorer & Workspace Tree UX](05-core-workspace/01-file-explorer.md)
- [Universal Editor Platform](05-core-workspace/02-editor-platform.md)
- [Rich Document Editor](05-core-workspace/03-rich-document-editor.md)
- [Notes, Infinite Pages & Ink](05-core-workspace/04-notes-infinite-pages.md)
- [Whiteboard & Visual Canvas](05-core-workspace/05-whiteboard-canvas.md)
- [Media, Attachments, Recording & Embeds](05-core-workspace/06-media-attachments.md)
- [PDF & Office Viewing / Editing Strategy](05-core-workspace/07-pdf-office-viewers.md)
- [Spreadsheets, Tables & Structured Databases](05-core-workspace/08-spreadsheets-tables-databases.md)
- [Code Files & Computational Notebooks](05-core-workspace/09-code-notebooks.md)
- [Search, Tags, Relations & Backlinks UX](05-core-workspace/12-search-tags-backlinks.md)
- [Templates & Reusable Content](05-core-workspace/13-templates.md)
- [Comments, Mentions & Collaborative Review](05-core-workspace/14-comments-collaboration.md)

## 06 — Productivity

- [Tasks, Projects & Focus Sessions](06-productivity/01-tasks-projects-focus.md)
- [Reminders & Scheduled Alerts](06-productivity/02-reminders.md)
- [Calendar & Scheduling](06-productivity/03-calendar.md)
- [Notifications, Inbox & Activity](06-productivity/04-notifications-inbox.md)
- [Command Palette & Quick Capture](06-productivity/05-command-palette.md)

## 07 — Academic

- [Student Courses & Academic Workspace](07-academic/01-student-course-workspace.md)
- [Assignments, Exams & Study Planning](07-academic/02-assignments-exams-study.md)
- [Flashcards & Spaced Repetition](07-academic/03-flashcards-spaced-repetition.md)
- [Master's / PhD Thesis & Research Workspace](07-academic/04-postgraduate-thesis-research.md)
- [References, Literature Review & Citations](07-academic/05-references-literature-citations.md)
- [Professor Teaching & Supervision](07-academic/06-professor-teaching-supervision.md)

## 08 — Research & laboratory

- [Research Projects & Electronic Lab Notebook](08-research-lab/01-research-projects-eln.md)
- [Protocols, SOPs & Method Versioning](08-research-lab/02-protocols-sops.md)
- [Samples, Reagents & Inventory](08-research-lab/03-samples-reagents-inventory.md)
- [Equipment, Booking & Maintenance](08-research-lab/04-equipment-booking-maintenance.md)
- [Laboratory Compliance, Traceability & Audit](08-research-lab/05-lab-compliance-audit.md)

## 09 — Reporting & analysis

- [Reporter & Investigative Workspace](09-reporting-analysis/01-reporter-workspace.md)
- [Reports Authoring, Review & Publishing](09-reporting-analysis/02-reports-authoring-publishing.md)
- [Sources, Interviews & Evidence](09-reporting-analysis/03-sources-interviews-evidence.md)
- [Claims, Fact Checking & Timelines](09-reporting-analysis/04-claims-fact-checking-timelines.md)
- [Datasets, Import & Cleaning](09-reporting-analysis/05-datasets-cleaning.md)
- [Analysis Workflows & Notebooks](09-reporting-analysis/06-analysis-notebooks.md)
- [Visualizations & Dashboards](09-reporting-analysis/07-visualizations-dashboards.md)
- [Product Usage Analytics & Experimentation](09-reporting-analysis/08-product-usage-analytics.md)

## 10 — Integrations, offline & AI

- [External Integrations & Connected Apps](10-integrations-offline-ai/01-external-integrations.md)
- [Offline Synchronization & PWA](10-integrations-offline-ai/02-offline-sync-pwa.md)
- [AI Assistance & Suggestions](10-integrations-offline-ai/03-ai-assistance.md)
- [Office Editing Provider Boundary](10-integrations-offline-ai/04-office-editing-provider.md)

## 11 — Public website & growth

- [Public Homepage](11-public-website/01-public-homepage.md)
- [Feature & Persona Marketing Pages](11-public-website/02-feature-persona-pages.md)
- [Pricing, Plans & Billing UX](11-public-website/03-pricing.md)
- [Legal, Privacy, Terms & Cookies](11-public-website/04-legal-privacy-terms-cookies.md)
- [Help Center & Support](11-public-website/05-help-support.md)
- [Public Status Page](11-public-website/06-status-page.md)
- [SEO, Acquisition Analytics & Conversion](11-public-website/07-seo-analytics.md)

## 12 — Quality, security & operations

- [Security, Privacy & Compliance](12-quality-security/01-security-privacy-compliance.md)
- [Testing & Production Certification](12-quality-security/02-testing-certification.md)
- [Backup & Disaster Recovery](12-quality-security/03-backup-disaster-recovery.md)
- [Incident Response, On-Call & Production Operations](12-quality-security/04-incident-response-operations.md)

## 13 — Delivery execution

There are exactly **25 canonical phases, 00–24**. See [IMPLEMENTATION_SEQUENCE.md](IMPLEMENTATION_SEQUENCE.md).

- Phase 00 — Repository & engineering baseline
- Phase 01 — Design system, navigation & shell
- Phase 02 — Authentication & accounts
- Phase 03 — Workspaces, RBAC & sharing
- Phase 04 — Recursive content tree
- Phase 05 — Uploads, storage & previews
- Phase 06 — API scale foundation & rich editor
- Phase 07 — History, trash & audit
- Phase 08 — Realtime collaboration
- Phase 09 — Notes & whiteboard
- Phase 10 — Search & relations
- Phase 11 — Productivity
- Phase 12 — Templates / import / export
- Phase 13 — Structured data & code
- Phase 14 — Student & courses
- Phase 15 — Postgraduate & references
- Phase 16 — Research & laboratory
- Phase 17 — Professor & supervision
- Phase 18 — Reporting & investigations
- Phase 19 — Analysis & visualization
- Phase 20 — Integrations & Office editing
- Phase 21 — Offline/PWA/mobile
- Phase 22 — Payments/subscriptions/billing
- Phase 23 — Production hardening/certification
- Phase 24 — Staged production launch

## Canonical ownership rules

- Clerk authentication/provider mechanics → `02-identity-billing/00-auth-clerk.md`
- Internal users/profiles → `02-identity-billing/01-users-profiles-onboarding.md`
- Workspace authorization/sharing → `02-identity-billing/02-workspaces-rbac-sharing.md`
- Stripe mechanics/money flow → `02-identity-billing/03-stripe-billing.md`
- Entitlement/quota enforcement → `02-identity-billing/04-entitlements-admin-billing.md`
- Pricing page/customer-facing commercial UX → `11-public-website/03-pricing.md`
- Database/file structure → `03-data-content/`
- User-facing explorer/editor behavior → `05-core-workspace/`
- API scale/concurrency/rate limit/queues/realtime → `04-api-scale/`
- Phase files → prerequisites, deliverables, tests and exit gates only

If two specifications appear to own the same state transition, entity source-of-truth or provider contract, reconcile them before coding.
