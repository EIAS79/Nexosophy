# Nexosophy Data Classification, Retention & Deletion

> **Status:** canonical data-governance specification

## 1. Purpose

Define how Nexosophy classifies, stores, retains, exports and deletes user, academic, research, laboratory, billing and operational data.

This is a product/engineering policy, not legal advice. Production retention periods may be adjusted by legal/commercial policy but implementation must support the categories and deletion semantics defined here.

## 2. Classification levels

### Public

Data intentionally publishable to anyone.

Examples:

- public marketing content;
- explicitly public published reports;
- public share content where configured.

### Internal

Ordinary authenticated account/workspace data without heightened confidentiality.

Examples:

- preferences;
- non-sensitive tasks;
- basic workspace metadata.

### Confidential

Data whose disclosure would materially affect a user/team.

Examples:

- private documents;
- course materials;
- unpublished research;
- non-public reports;
- workspace member data.

### Highly sensitive

Data requiring strongest controls.

Examples:

- confidential reporter source details;
- security credentials/tokens;
- selected laboratory/research data;
- payment/security event data;
- recovery codes;
- legal-hold material.

Secrets such as API keys/passwords are not ordinary application content and use dedicated secret/credential handling.

## 3. Classification inheritance

Workspace or resource policy may set a minimum classification.

A child resource may be more restrictive than its parent.

It must not become less restrictive automatically when moved without explicit policy evaluation.

## 4. Default retention principles

- active content retained while account/workspace remains active unless user/policy deletes it;
- trash has explicit retention before purge;
- audit/security records may have separate retention from content;
- billing/accounting records may require longer retention than deleted content;
- backups expire according to backup lifecycle and are not treated as immediately mutable primary data;
- support attachments have bounded retention.

Exact production durations are configuration/policy values, not hardcoded throughout application logic.

## 5. Trash vs deletion

### Trash

Recoverable user-facing soft deletion.

Properties:

- original parent/location recorded where possible;
- deletion actor/time recorded;
- descendants follow defined subtree semantics;
- restore handles conflicts explicitly.

### Permanent deletion

A durable deletion intent that triggers asynchronous removal/reconciliation across:

- primary database;
- object storage;
- search indexes;
- caches;
- derived artifacts;
- realtime snapshots;
- analytics identifiers where applicable and legally permitted.

## 6. Account deletion

Account deletion must define:

- ownership transfer/handling for shared workspaces;
- personal workspace deletion;
- legal/billing retention exceptions;
- external identity unlinking;
- Stripe/customer record handling according to legal/accounting requirements;
- notification/email suppression;
- scheduled purge/reconciliation;
- completion status.

Account deletion is not "delete one User row."

## 7. Workspace deletion

Workspace deletion requires:

- owner authorization;
- member impact warning;
- export option where appropriate;
- grace/trash period if policy allows;
- queued recursive purge;
- billing-seat/subscription implications;
- audit event.

## 8. Export

Users need export for portability and privacy requests.

Export jobs:

- are asynchronous;
- are scoped/authorized at request time and delivery time;
- use object storage for generated archives;
- use short-lived signed downloads;
- expire generated artifacts;
- include manifests where helpful;
- avoid exposing data the requester is not entitled to export.

## 9. Legal hold

If legal/compliance policy requires a legal hold:

- hold reason/reference is access-controlled;
- deletion job must recognize hold;
- user-facing behavior follows legal policy;
- hold does not silently make content broadly visible;
- release of hold resumes ordinary retention/deletion processing.

## 10. Audit retention

Audit records should store:

- actor;
- action;
- target identifiers;
- workspace;
- timestamp;
- request/correlation ID;
- minimal metadata.

They should not store full document bodies by default.

## 11. Backup semantics

Deletion from primary systems may remain in encrypted backups until backup expiry.

Requirements:

- documented backup retention;
- restore procedures reapply deletion/reconciliation state where necessary;
- backups are tightly access-controlled;
- expired backups are destroyed according to provider capability/policy.

## 12. Search/cache semantics

Deletion/revocation must not rely on TTL alone when data could leak.

Use:

- index deletion/update events;
- permission filters;
- versioned cache invalidation;
- reconciliation jobs.

## 13. Media / derivative retention

Deleting an asset may require deleting:

- original;
- thumbnails;
- previews;
- waveform;
- OCR/transcript;
- converted variants;
- temporary multipart remnants.

Manifest/relationship tracking is required so derivatives are discoverable.

## 14. Provider data

Connected providers may retain data independently according to their terms.

Nexosophy must:

- document provider relationship;
- revoke tokens;
- delete internal synced data according to policy;
- call provider deletion APIs where contractually/product-required and supported;
- avoid promising deletion beyond Nexosophy's control.

## 15. Deletion pipeline

Recommended state machine:

```text
REQUESTED
  ↓
VALIDATING
  ↓
QUEUED
  ↓
DELETING_PRIMARY
  ↓
DELETING_DERIVED
  ↓
RECONCILING
  ↓
COMPLETED
```

Failure states retain retry/checkpoint data.

Deletion jobs must be idempotent.

## 16. Scale behavior

Bulk export/deletion:

- runs in bounded batches;
- checkpoints progress;
- respects queue/dependency concurrency;
- avoids giant transactions;
- can resume after worker restart;
- exposes progress where user-visible.

## 17. Security

- highly sensitive fields may require field-level encryption/tokenization where justified;
- signed download links are short-lived;
- deletion/export actions are audited;
- support/admin access is least privilege;
- export bundles are never public by default;
- logs never include secrets/raw highly sensitive content.

## 18. User-facing surfaces

- `/settings/privacy`
- `/settings/data`
- `/settings/export`
- `/workspace/:id/settings/retention`
- `/trash`

Exact routes may be refined by the information architecture spec.

## 19. Tests

Required over implementation lifetime:

- delete/restore;
- delete during move/edit;
- large subtree purge;
- object/derivative reconciliation;
- search result removal;
- cache invalidation;
- export authorization;
- export expiry;
- worker restart/resume;
- account deletion with shared workspace ownership;
- legal-hold block;
- backup restore + deletion reconciliation drill.

## 20. Definition of Done

### Planning

- [x] Classification levels defined.
- [x] Trash/permanent deletion semantics defined.
- [x] Account/workspace deletion boundaries defined.
- [x] Export/legal-hold/backup semantics defined.
- [x] Async deletion/reconciliation model defined.

### Implementation

- [ ] Entity families have retention/classification mappings.
- [ ] Deletion/export jobs are idempotent and resumable.
- [ ] DB/object/search/cache deletion integration tests pass.
- [ ] Privacy documentation matches deployed behavior.
- [ ] Backup lifecycle and restore-deletion reconciliation are verified.
- [ ] Production support/runbook exists.

## 21. Governance section complete

After this file, continue directly into the initial ADR set and Phase 00 implementation.
