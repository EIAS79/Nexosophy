# ADR 0013 — External integrations and Office editing boundary
- Status: Accepted for implementation; provider activation remains an operator decision.
- Date: 2026-10-09

OAuth authorization codes are one-time and state-bound. Google/Microsoft additionally use PKCE. Access/refresh tokens are encrypted server-side and never exposed to browser code. Provider IDs/versions are synchronization metadata only and never grant Nexosophy permissions.

Google/Microsoft calendar synchronization uses explicit local↔remote mappings. Simultaneous local/remote change creates a conflict record instead of silent last-write-wins. Drive/OneDrive are linked as read-only metadata in this phase; binary import remains the trusted upload pipeline. Mendeley imports into canonical reference records.

Webhook events are deduplicated and only trigger reconciliation. Disconnect clears token ciphertext and revokes provider credentials where a revocation endpoint exists.

Office editing is disabled by default. The production adapter implemented here targets an operator-approved self-hosted ONLYOFFICE deployment with separate licensing, network-isolation, JWT and patch-management decisions. Collabora remains preview-only until a separately reviewed WOPI host exists. Office saves are fetched by a durable worker, stored as a new binary asset/version, and enter the normal malware scan/trust pipeline before delivery.
