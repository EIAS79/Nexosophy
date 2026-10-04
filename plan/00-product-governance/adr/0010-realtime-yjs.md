# ADR 0010 — Realtime Collaboration and CRDT

**Status:** Accepted

## Decision
Use a **Yjs-compatible CRDT model** for collaborative document types, served by a dedicated realtime process with durable checkpoints and a shared backplane.

## Rules
- room authorization is resource-scoped;
- presence is ephemeral;
- document updates are durable/checkpointed;
- permission revocation rejects/disconnects sessions promptly;
- reconnect/offline merge is supported;
- hot-room/message limits protect service capacity.

## Scale
Realtime sockets scale separately from normal REST traffic and never depend on process-only durable state.

## References
- [Architecture Decision Framework](../04-architecture-decisions.md)
- [Canonical Specification Index](../../SPEC_INDEX.md)
