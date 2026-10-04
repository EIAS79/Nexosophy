# ADR 0006 — S3-Compatible Object Storage

**Status:** Accepted

## Decision
Use an **S3-compatible private object store** behind a StorageAdapter. Provider selection may be Cloudflare R2, AWS S3 or another compatible managed provider after cost/region review.

## Rules
- browser uploads via short-lived signed multipart URLs;
- API does not proxy large payload bodies;
- metadata/trust state stays in PostgreSQL;
- private delivery uses signed URLs/cookies;
- checksums and size limits verified;
- untrusted uploads scanned/quarantined;
- derivatives have explicit manifests/lifecycle.

## Scale
CDN/object storage absorbs file bandwidth independently from API replicas.

## Exit strategy
S3-compatible keys/manifests and provider-neutral adapter simplify migration.

## References

- [Architecture Decision Framework](../04-architecture-decisions.md)
- [Canonical Specification Index](../../SPEC_INDEX.md)
