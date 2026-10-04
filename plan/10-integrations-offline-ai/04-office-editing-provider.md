# Office Editing Provider Boundary

> **Status:** canonical Nexosophy implementation specification.

## Purpose

Define how DOCX/XLSX/PPTX editing is integrated through an approved specialist office engine without pretending Nexosophy can recreate Microsoft Office fidelity inside its native editor.

## Provider decision boundary

- Native Nexosophy rich documents remain separate from Office-format documents.
- PDF is preview/annotation/export oriented; editable office formats use a provider or conversion path.
- ONLYOFFICE, Collabora or another engine may be selected only after licensing, security, mobile UX, hosting and concurrency evaluation.
- The chosen provider is behind an OfficeEditorAdapter so document identity, permissions, history and storage remain Nexosophy-owned.

## Required user flows

- Open supported Office file from the universal file explorer.
- Show preview-only mode when editing provider is disabled or unsupported.
- Launch editor with short-lived resource-scoped authorization.
- Save changes back as a new binary version without changing the node identity.
- Expose provider errors, unsupported features and fidelity limitations.
- Download original/current version and export/convert where supported.
- Recover from editor-provider outage without corrupting the stored document.

## Security and permissions

- Provider receives only the minimum file/session scope required.
- Never expose object-store master credentials to the browser/provider.
- Edit tokens are short-lived, document-scoped and user/workspace-authorized.
- Webhook/callback save operations are authenticated, idempotent and tied to an expected document/version.
- External editor cannot bypass Nexosophy sharing or tenant isolation.

## Scale and resilience

- Office sessions do not consume ordinary API request workers for their full lifetime.
- Binary save/upload traffic uses object storage/provider channels where possible.
- Concurrent edit behavior follows the provider's supported collaboration model and is load-tested separately.
- Provider outage degrades to preview/download where safe.
- Autoscaling and licensing limits are monitored before exposing Office edit to broad cohorts.

## Definition of Done

- Provider and licensing decision recorded in ADR.
- Security review passes for tokens/callbacks/storage access.
- Round-trip save/version history works for representative DOCX/XLSX/PPTX files.
- Unsupported/fidelity-loss cases are explicitly surfaced.
- Provider disconnect/outage does not lose original files.

## Cross-cutting requirements

- Desktop, tablet and phone behavior must be intentionally designed for user-facing surfaces.
- Accessibility, authorization, privacy, error states, observability and automated tests are release requirements.
- Any external provider is accessed through a documented adapter and failure mode.
- No document in this file overrides stricter requirements in product governance, security or API-scale specifications.