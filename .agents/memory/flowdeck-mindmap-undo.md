---
name: FlowDeck mind map undo/redo recorder
description: Non-obvious dep/guard rules for the snapshot history recorder in the mind map editor; break them and the baseline corrupts.
---

The mind map editor (`artifacts/flowdeck/src/pages/mindmap-editor.tsx`) records
undo/redo history as serialized `{nodes, edges, areas}` snapshots via an effect.

Rule: the recording effect's deps must be `[nodes, edges, areas, drag]` and must
**exclude `mindmap`**.

**Why:** loading a map is a two-commit sequence. The load effect (dep `mindmap`)
sets state + `loadedIdRef` in commit 1, but the new nodes only land in commit 2.
If the recording effect also depended on `mindmap`, it would fire in commit 1 with
STALE (empty) `nodes` and record an empty baseline, making the freshly loaded map
"undoable" back to blank. Excluding `mindmap` means the recorder only fires in
commit 2 (when nodes actually changed), where the snapshot equals the baseline set
by the load effect -> no-op.

**How to apply:** never add `mindmap` to that effect's deps to silence a lint
warning. The load effect owns baseline init (`historyRef=[baseline]`, index 0) and
sets `isApplyingHistoryRef.current=true` (a one-shot guard the recorder consumes).
Drag coalescing relies on the same effect skipping while `drag` is non-null and
recording once when `drag` returns to null — keep the `if (drag) return;` guard.
Applying a snapshot (undo/redo) also sets the one-shot `isApplyingHistoryRef` so the
resulting render isn't recorded as a new step.
