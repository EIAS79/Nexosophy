# ADR 0002 — Web Application Framework

**Status:** Accepted

## Decision
Use **Next.js App Router**, pinned to a supported Active LTS/security-patched release. At planning completion the current target is Next.js 16.3.x with security patches applied.

Use React Server Components where they improve public/initial rendering, and client components for interactive editor/workspace surfaces.

## Constraints
- authenticated authorization remains server/API authoritative;
- no business state depends on server-local Next.js memory;
- public pages optimize SEO/Core Web Vitals;
- editor-heavy code is dynamically loaded and excluded from public marketing bundles.

## Alternatives
Standalone Vite SPA; Remix/React Router framework.

## Consequences
Next.js provides routing/rendering/SEO and mature deployment options, while API remains a separate service to avoid coupling all backend traffic to web rendering processes.

## References

- [Architecture Decision Framework](../04-architecture-decisions.md)
- [Canonical Specification Index](../../SPEC_INDEX.md)
