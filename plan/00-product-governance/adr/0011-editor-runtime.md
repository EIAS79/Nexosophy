# ADR 0011 — Universal Editor Runtime

**Status:** Accepted

## Decision
Use a shared editor capability/runtime layer rather than unrelated editor applications.

For rich documents, use a ProseMirror/Tiptap-class architecture unless Phase 06 benchmark/extension requirements disqualify it.

The runtime owns document lifecycle, capability registration, autosave state, command integration, shared insertion, version/conflict hooks and accessibility shell.

## Invariant
"Saved" means durable server acknowledgement, not merely a local mutation.

## Review trigger
Changing the rich-text engine requires an ADR if it changes persistence/document schema or collaboration semantics.

## References
- [Architecture Decision Framework](../04-architecture-decisions.md)
- [Canonical Specification Index](../../SPEC_INDEX.md)
