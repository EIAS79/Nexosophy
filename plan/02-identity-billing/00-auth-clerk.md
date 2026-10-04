# Authentication & Clerk Provider — Canonical Nexosophy Specification

> This file is the single owner of Clerk authentication/provider mechanics. Nexosophy internal users, workspaces and roles remain authoritative in their own domain specs.

# Clerk Authentication Provider Integration

> Status: normative provider implementation specification.
>
> This document makes the authentication provider concrete while preserving Nexosophy's own internal user, workspace, permission and audit model.

**Master plan:** [`../README.md`](../README.md)  
**Parent auth spec:** [`01-authentication-login.md`](01-authentication-login.md)  
**Session/security spec:** [`05-sessions-security-devices.md`](05-sessions-security-devices.md)  
**Delivery phase:** Phase 2 — Authentication and accounts  
**Related systems:** onboarding, accounts/profiles, RBAC, billing, audit, notifications, admin/support

---

## 1. Provider decision

**Primary managed authentication provider: Clerk.**

Use Clerk for identity proof/session/authentication mechanics:

- sign-up;
- sign-in;
- email verification;
- password credential flow if enabled;
- password reset/recovery;
- social OAuth connections such as Google and Microsoft when configured;
- session issuance/validation;
- MFA where enabled by product tier/policy;
- passkeys/WebAuthn where enabled;
- device/session management capabilities supported by provider;
- authentication webhooks/events needed to synchronize internal user state.

Nexosophy remains authoritative for:

- internal user ID;
- profile and academic role/persona;
- workspaces;
- memberships;
- roles and permissions;
- feature entitlements;
- billing account mapping;
- app audit events;
- content ownership;
- deletion/export workflows;
- policy decisions.

Do not make Clerk Organizations the canonical Nexosophy workspace/RBAC store. This avoids coupling core authorization and billing semantics to the identity provider.

---

## 2. Identity mapping

```text
Clerk User (external identity provider record)
        |
        | clerk_user_id
        v
Nexosophy UserIdentity
        |
        v
Nexosophy User
        |
        +--> Profile
        +--> WorkspaceMemberships
        +--> BillingAccount(s)
        +--> Content ownership/audit actor
```

Recommended table:

```text
UserIdentity
- id
- user_id
- provider = clerk
- provider_user_id
- primary_email_snapshot
- created_at
- last_synced_at
- disabled_at
```

`provider_user_id` is unique.

Email is **not** the durable cross-system primary key.

---

## 3. Authentication UI strategy

Nexosophy may use either:

1. Clerk prebuilt components themed to the design system for speed/security; or
2. Clerk custom flows using supported SDK APIs if UX requires complete control.

The decision is per surface, but security behavior must stay provider-supported.

Routes remain Nexosophy-owned:

```text
/login
/signup
/verify-email
/forgot-password
/reset-password
/mfa
/auth/callback
/account/security
```

The route can render/provider-drive Clerk UI while preserving Nexosophy navigation, accessibility, analytics boundaries and return-to behavior.

---

## 4. Sign-up flow

```text
User opens /signup
 -> chooses email/password or configured social provider
 -> Clerk performs credential/identity flow
 -> verification if required
 -> Clerk session created
 -> Nexosophy backend validates Clerk session token
 -> find/create internal UserIdentity
 -> create internal User transactionally if first sign-in
 -> create default personal workspace if product rules require
 -> onboarding status initialized
 -> redirect to validated return path or onboarding
```

Internal user provisioning must be idempotent.

A repeated callback/webhook/request cannot create duplicate users.

---

## 5. Login flow

```text
/login
 -> Clerk authentication UI/flow
 -> password/provider/passkey
 -> MFA/session task if required
 -> Clerk session
 -> Nexosophy session-aware request validates provider token
 -> internal user lookup
 -> disabled/suspended policy check
 -> validated return-to destination
```

The provider saying `authenticated` does not automatically mean the internal account has authorization to every Nexosophy resource.

---

## 6. Social OAuth providers

Initial supported providers should be explicitly configured, not inferred.

Recommended launch set:

- Google;
- Microsoft.

Potential later providers:

- Apple;
- GitHub for developer/researcher audience where product data justifies it;
- institution OIDC/SAML/enterprise SSO under enterprise plan.

Only buttons for configured/live providers render.

Social provider scopes must be minimal for sign-in. Do not request Drive/Calendar/mail scopes during authentication. Those belong to separate connected-app consent flows.

---

## 7. Account collision/linking

Critical rule: never merge internal accounts merely because two identities present the same string email without a verified, policy-safe linking flow.

Scenarios:

### Existing signed-in user connects provider

- require active authenticated session;
- step-up auth for sensitive linking if needed;
- connect through Clerk-supported account linking;
- revalidate internal mapping.

### User signs in through social provider matching existing local email

Follow provider/Clerk safe linking behavior and Nexosophy account policy. If confidence is insufficient, require proof through existing account/session rather than silently merging.

### Provider email changes

Do not create a new Nexosophy user because email changed. Durable provider user ID mapping remains.

---

## 8. Backend token/session verification

The Next.js frontend uses Clerk's supported Next.js SDK.

The NestJS/Fastify API must verify authentic Clerk-issued tokens server-side and derive the provider subject/session claims according to Clerk's documented verification mechanism.

Backend middleware produces an internal request principal:

```text
RequestPrincipal
- internal_user_id
- clerk_user_id
- clerk_session_id where relevant
- authentication_time/assurance context where available
- active workspace selected by Nexosophy
- internal permissions loaded by Nexosophy authorization layer
```

Never authorize workspace data from a client-supplied role string.

---

## 9. Session model

Clerk manages authentication session issuance.

Nexosophy tracks application-level session/security metadata only as needed for:

- audit;
- revocation/suspension propagation;
- security screen display;
- anomaly/support investigation;
- internal caches.

Do not duplicate token issuance unless an explicit architecture need arises.

Session checks must account for:

- provider session revocation;
- internal user suspension/deletion;
- membership/permission changes;
- billing entitlement changes;
- account security state.

---

## 10. Webhook synchronization

Create endpoint:

`POST /api/webhooks/clerk`

Purpose:

- synchronize external identity lifecycle into internal identity table;
- react to user profile/email lifecycle events as required;
- handle external user deletion/disable workflows according to internal retention policy.

Requirements:

- verify Clerk webhook signature using current supported mechanism;
- idempotent event receipt;
- deduplicate provider event IDs;
- store minimal operational event record;
- process asynchronously when work is nontrivial;
- never delete Nexosophy content solely because one webhook is received without applying product retention/deletion policy.

---

## 11. Internal user provisioning

Provisioning service:

```text
IdentityProvisioningService
  resolveOrCreateInternalUser(clerkUserId)
  syncVerifiedEmails(...)
  syncDisplayIdentityFields(...)
  handleProviderDeletion(...)
  repairIdentityMapping(...)
```

Transaction on first provision:

1. lock/unique insert provider identity;
2. create internal user if absent;
3. attach identity;
4. initialize default profile;
5. initialize onboarding record;
6. optionally create personal workspace;
7. audit account creation;
8. emit domain event.

---

## 12. Internal account states

Internal state is separate from provider account existence:

```text
PENDING_ONBOARDING
ACTIVE
SUSPENDED
DELETION_REQUESTED
DELETION_PENDING
DELETED/ANONYMIZED according to retention policy
```

An active Clerk session cannot bypass `SUSPENDED`.

---

## 13. Email verification

When email verification is required:

- provider verifies according to configured Clerk strategy;
- Nexosophy reads verified state from trusted provider identity data;
- internal record stores required verification snapshot/state;
- sensitive product actions can require verified email by internal policy.

Never trust a frontend boolean for verification.

---

## 14. Password handling

If password auth is enabled, Clerk owns password credential processing/storage.

Nexosophy application/database must not store:

- plaintext passwords;
- password hashes copied from Clerk;
- reset secrets.

Nexosophy owns only policy/UI state needed around login, not the password credential material.

---

## 15. Password reset/account recovery

Flow:

```text
/forgot-password
 -> Clerk-supported recovery flow
 -> neutral anti-enumeration UI
 -> recovery verification
 -> credential reset
 -> provider session/security behavior
 -> Nexosophy security notification/audit if event available/appropriate
 -> /login or authenticated destination
```

Recovery must work on phone, tablet and desktop and support password manager/autofill conventions.

---

## 16. MFA

MFA policy can vary by user/account tier:

- optional for normal users;
- encouraged for professors/research leads/admins;
- mandatory for internal admin/operations roles;
- potentially required by institutional workspace policy later.

Supported factors depend on configured Clerk capabilities and plan.

Nexosophy security UI should display provider-supported enrolled factors without inventing unsupported states.

Actions that should require step-up/recent auth include:

- disabling last strong MFA factor;
- account email/security changes;
- destructive workspace transfer actions;
- internal administrative billing/refund actions;
- API key creation where introduced.

---

## 17. Passkeys

If enabled, use Clerk-supported passkey/WebAuthn implementation.

Nexosophy must not handle private passkey keys.

Security settings expose:

- add passkey;
- list recognizable credential/device labels where supported;
- remove passkey with sufficient recent authentication;
- fallback/recovery path.

Passkeys are additive unless product explicitly supports passwordless-only account configuration.

---

## 18. Return-to navigation

Before redirecting to auth, store/encode only a safe internal return path.

Rules:

- relative/internal path only;
- reject protocol-relative/external URLs;
- reject javascript/data schemes;
- preserve useful query state selectively;
- after login, recheck authorization rather than assuming prior page remains allowed.

This prevents open redirects and stale-access issues.

---

## 19. Next.js integration

The web app uses supported Clerk Next.js SDK primitives for:

- provider context;
- middleware/proxy integration;
- server-side auth access;
- client-side auth UI only where needed;
- route protection near resources;
- sign-in/sign-up components/custom flow APIs.

Public marketing pages remain public without unnecessary auth-blocking rendering.

Protected app pages require authentication server-side.

---

## 20. NestJS/Fastify API integration

API authentication guard responsibilities:

1. extract Clerk token/session credential from supported request mechanism;
2. verify cryptographically against Clerk configuration/JWKS/provider mechanism;
3. validate issuer/audience/expiry as required;
4. obtain provider subject;
5. resolve internal `UserIdentity`;
6. reject deleted/suspended user;
7. attach internal principal;
8. pass to Nexosophy authorization service.

Authorization guard is separate from authentication guard.

---

## 21. RBAC boundary

Clerk authenticates **who the user is**.

Nexosophy decides **what the user may do**.

Example:

```text
Clerk: user_abc is authenticated
Nexosophy DB:
  user_42 is member of workspace_7
  role = PROFESSOR
  permissions = [...]
  subscription entitlements = [...]
Authorization service:
  can user_42 modify node_99? -> yes/no
```

Never use frontend Clerk metadata as sole authorization source for content access.

---

## 22. Workspace switching

Nexosophy workspace switcher controls active internal workspace context.

Do not make Clerk active Organization state the canonical routing key.

Persist last active workspace as internal preference.

Every backend request containing a workspace ID revalidates membership.

---

## 23. Billing identity binding

Authentication/billing chain:

```text
Clerk user ID
 -> internal UserIdentity
 -> internal User
 -> BillingAccount owner/member context
 -> Stripe Customer ID
```

Stripe and Clerk are never joined directly by email.

This protects against email changes, duplicate emails, alias behavior and provider account changes.

---

## 24. Account settings

Security/settings area includes:

- name/profile editing according to source-of-truth rules;
- verified emails;
- connected sign-in methods;
- password change where enabled;
- MFA;
- passkeys;
- active sessions/devices where supported;
- sign out current session;
- sign out other/all sessions where supported;
- account export/deletion initiation;
- security event history subset.

Separate profile persona fields from identity/security fields.

---

## 25. Internal admin/support identity panel

Restricted route example:

`/admin/users/:userId/security`

Can display:

- internal user ID;
- Clerk user ID;
- account state;
- verified email summaries;
- created/last-sign-in timestamps where legitimately available;
- identity sync status;
- recent security/audit events;
- suspension state;
- provider-dashboard deep link for authorized staff if operational policy permits.

Admin must **not** see passwords, OAuth tokens, passkey private material, recovery codes or provider secrets.

---

## 26. Secrets/configuration

Representative configuration:

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET
CLERK_ALLOWED_ORIGINS / domain configuration as required
CLERK_SIGN_IN_URL
CLERK_SIGN_UP_URL
```

Rules:

- test/dev/prod Clerk applications or environment-isolated configuration;
- no production secrets in preview logs/build output;
- secret rotation runbook;
- least-privilege dashboard access;
- MFA for provider dashboard administrators.

---

## 27. Email/domain configuration

Production auth requires correct domain configuration and branded email behavior.

Validate:

- production domain;
- email sender/branding capabilities;
- redirect/callback domains;
- development/preview domain behavior;
- OAuth provider redirect URIs;
- no wildcard callback configuration broader than necessary.

---

## 28. OAuth configuration

For each provider:

- dedicated production OAuth application where required;
- correct redirect URI;
- minimal scopes;
- correct consent screen branding;
- terms/privacy links;
- verified domain where provider requires;
- separate development credentials/configuration;
- secret rotation process.

Do not share one accidental developer OAuth app across environments without policy.

---

## 29. Responsive behavior

### Desktop

- centered auth card or split marketing/auth layout;
- keyboard-first complete operation;
- return-to context can be stated without clutter.

### Tablet

- auth card remains readable without oversized empty space;
- virtual keyboard does not cover controls;
- OAuth buttons and MFA inputs are touch accessible.

### Mobile

- single column;
- no horizontal scrolling;
- correct input types/autocomplete;
- safe viewport behavior with mobile keyboards;
- password manager compatible;
- one-time-code autofill where supported;
- social login buttons large enough for touch;
- recovery links visible, not buried;
- auth state survives external OAuth app/browser transition.

---

## 30. Accessibility

- semantic form labels;
- errors linked via `aria-describedby` or equivalent;
- summary for multi-error submissions;
- focus moves to first actionable error appropriately;
- provider buttons have accessible provider name;
- loading state does not trap focus;
- MFA fields support paste;
- timeout/expired-link messaging is explicit;
- no CAPTCHA flow that lacks an accessible fallback if bot protection is introduced.

---

## 31. Abuse/rate-limit controls

Use provider protections plus Nexosophy edge/application controls for:

- brute-force attempts;
- credential stuffing signals;
- signup abuse;
- password reset abuse;
- email verification resend abuse;
- webhook flooding;
- callback abuse.

Do not implement user enumeration through error wording or timing where avoidable.

---

## 32. Logging/privacy

Safe authentication logs may include:

- internal user ID;
- provider user/session opaque IDs where necessary;
- outcome;
- auth method category;
- timestamp;
- coarse risk/security metadata required for legitimate security use.

Do not log:

- passwords;
- OAuth access/refresh tokens;
- TOTP secrets;
- passkey private data;
- recovery codes;
- email verification/reset secrets;
- full provider webhook secrets/signatures.

---

## 33. Failure scenarios

Must test/recover from:

- Clerk unavailable;
- provider callback delayed;
- OAuth user cancels consent;
- OAuth provider returns error;
- stale/expired session;
- internal identity row missing for valid Clerk user;
- duplicate provisioning race;
- verified email changes;
- user deleted in Clerk unexpectedly;
- internal user suspended while Clerk session remains valid;
- member removed from workspace while page open;
- login completed on one device while another flow is stale;
- MFA device lost;
- passkey unavailable on current device;
- webhook duplicate/out-of-order;
- callback open-redirect attempt;
- test/prod key mismatch.

---

## 34. Testing

### Unit

- return path validation;
- identity mapping;
- internal account state checks;
- provisioning idempotency;
- authorization separation;
- webhook event normalization.

### Integration

- valid/invalid token verification;
- provider user -> internal user provisioning;
- suspended user rejection;
- webhook signature verification;
- account/profile synchronization;
- social identity linking behavior;
- membership removal during active session.

### E2E

1. email sign-up -> verify -> onboarding;
2. email/password login -> app;
3. Google login -> new account -> onboarding;
4. Microsoft login -> existing linked account;
5. password recovery;
6. MFA enrollment/login if enabled;
7. passkey enrollment/login if enabled;
8. safe return-to after authentication;
9. sign out and protected route rejection;
10. internal suspension while external identity remains valid.

---

## 35. Migration/provider replacement strategy

Nexosophy must remain replaceable at the identity-provider boundary.

Required abstractions:

```text
IdentityProvider
  verifyRequest(...)
  getUser(...)
  begin/complete supported account operations where needed

Internal identity table
  provider
  provider_user_id
```

Core domain rows reference internal `user_id`, never Clerk ID directly except identity mapping/audit metadata.

If Clerk is replaced later, content/workspaces/billing remain attached to internal users.

---

## 36. Launch checklist

- [ ] Production Clerk application configured.
- [ ] Production domain/callback URLs configured.
- [ ] Google OAuth production credentials configured if enabled.
- [ ] Microsoft OAuth production credentials configured if enabled.
- [ ] Email verification/recovery tested.
- [ ] MFA/passkey product settings finalized.
- [ ] Internal user provisioning idempotent.
- [ ] Clerk webhook endpoint signature verification active.
- [ ] Provider outage behavior tested.
- [ ] Suspended/deleted internal user cannot use valid provider session to access app.
- [ ] Workspace authorization remains entirely server-side in Nexosophy.
- [ ] Billing mapping uses internal user, not email.
- [ ] Auth dashboard production access protected by MFA.
- [ ] Privacy/data deletion/export behavior reviewed.
- [ ] Mobile OAuth/recovery tested on iOS/Android browsers.
- [ ] Accessibility tests pass.

---

## 37. Definition of Done

Clerk integration is complete when:

- users can sign up/sign in/recover using configured production methods;
- identity provisioning is deterministic and idempotent;
- internal user IDs remain canonical for all Nexosophy domain data;
- Clerk sessions are cryptographically validated by protected backend paths;
- internal suspension/permission changes override stale client/provider state;
- OAuth account linking does not create silent account takeovers;
- MFA/passkeys work when enabled;
- auth works across phone/tablet/desktop and supported assistive technology;
- provider outage and callback failure have understandable recovery;
- secrets/tokens are not leaked;
- the system can later replace Clerk without rewriting content ownership, workspaces or billing;
- production observability, tests, runbooks and security reviews pass the global Definition of Done.
