---
name: dnd-kit drag is not e2e-automatable
description: Why @dnd-kit reorder UIs need a non-drag fallback to be verifiable, and how to test them.
---

The Playwright-based test agent cannot exercise `@dnd-kit` pointer drags. Its synthetic
pointerdown/move/up events do not satisfy dnd-kit's `PointerSensor` activation, so the list
never visibly reorders during e2e — the handles render, but the drag is a no-op in automation.
This is an automation limitation, not a bug in the drag code (canonical
DndContext + SortableContext + useSortable + arrayMove works fine in a real browser).

**Why:** Observed twice on the FlowDeck dashboard reorder feature — drag-only e2e left
reorder + persistence unverifiable.

**How to apply:** For any dnd-kit reorder UI, also add a non-drag control (up/down move
buttons and/or the `KeyboardSensor`) that performs the same reorder. Then e2e can click those
buttons to assert ordering and persistence deterministically, while drag stays the primary UX.
The move buttons double as accessibility/touch affordances, so this is worth doing regardless.
