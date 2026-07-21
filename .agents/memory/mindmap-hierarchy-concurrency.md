---
name: Mind map 2-level hierarchy concurrency
description: Invariant for any write that can change a mindmap's parentId (create/link/reparent/delete).
---

# Mind map parent/child hierarchy is strictly 2 levels

Mind maps (`mindmapsTable.parentId`, nullable self-FK, `onDelete: set null`) form a
strict 2-level tree: a top-level map (`parentId === null`) may have children, but a
child may not have children, and a map that already has children may not become a
child. There are no cross-workspace links.

## Invariant

**Any endpoint that can change the parent/child tree (create-with-parent, PATCH
parentId, DELETE) MUST run inside a `db.transaction` and call
`pg_advisory_xact_lock(NS, workspaceId)` (helper `lockWorkspaceHierarchy`) BEFORE
re-validating and writing.** Validation (`assertLinkable`) re-reads current state
inside the locked transaction — it must not trust rows read before the lock.

**Why:** Row-level checks alone lose to concurrency. Two simultaneous links
(A→B and B→A, or C→P and P→Q) can each individually pass a pre-read check yet
commit a cycle or a 3-level chain. A DELETE racing a link-to-that-parent can throw
an FK-violation 500 (the SET NULL fires on one side while the other inserts the
reference). The workspace-scoped advisory lock serializes all hierarchy mutations
per workspace so re-validation sees committed truth.

**How to apply:** If you add any new endpoint that writes `parentId` or deletes a
map (bulk move, import, etc.), wrap it the same way. Do not add a hierarchy write
path that skips the lock.
