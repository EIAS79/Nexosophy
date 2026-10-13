# Nexosophy-owned authentication — replacement roadmap

Decision: 2026-10-11. Clerk is being retired. Nexosophy will own account identity, sessions, profiles, security policy, onboarding and user experience. Run an audited self-hosted authentication engine on the Nexosophy Fastify API and PostgreSQL; no managed identity vendor.

## Capabilities to deliver
- Password registration/login, email verification, recovery and change, password policies.
- Persistent multi-device sessions, expiry, remote logout, session inventory and revocation.
- TOTP MFA, backup codes, WebAuthn passkeys, step-up verification and recovery.
- Google, GitHub, Facebook and Apple OAuth; Microsoft and enterprise federation later.
- Verified account linking, explicit consent and safe conflict resolution.
- Existing internal UUID accounts, workspace RBAC, invitation and tenant isolation remain authoritative.
- Accessible login/signup/security UI, audits, abuse controls, account export/deletion and recovery.

## Delivery gates
- [ ] A. Provider-independent backend design and reviewed PostgreSQL schema migration.
- [ ] B. Owned auth API and persistent verification/session integration.
- [ ] C. Remove Clerk dependencies from web layouts, login/signup, middleware and API calls.
- [ ] D. Email validation, recovery, MFA/passkeys and device-management UI.
- [ ] E. Register and test Google, GitHub, Facebook and Apple OAuth apps.
- [ ] F. Remove remaining Clerk webhook/runtime/packages after replacement works.
- [ ] G. Test two users, cross-workspace isolation, consent, revocation, browser/mobile accessibility.
- [ ] H. Run security, load, backup/restore and incident-response release certification.

## Security invariants
Only reviewed crypto and standards libraries; no homegrown hashes or OAuth implementations. Server-side session validation and database-backed revocation. Secure HttpOnly same-origin cookies. Origin and callback allowlists, CSRF protection, vetted OAuth code flow. No tokens in browser storage or Git. No automatic merging of identities by unverified email. High-risk actions need recent second factor. Missing credentials fail closed in staging/production.

## Environment
NEXOSOPHY_AUTH_SECRET (high-entropy secret), NEXOSOPHY_AUTH_URL, NEXOSOPHY_AUTH_TRUSTED_ORIGINS, email delivery service credentials, provider client IDs/secrets, passkey relying-party origin. Store only in Anas-controlled provider secret settings. Staging and production must use independent keys and databases; main remains unchanged during migration.

## Current status
Architecture choice approved, dependencies being introduced on development branch. Not yet functional or certified. Phase 02 is reopened; no prior Clerk-era checklist item counts as evidence for new implementation.
