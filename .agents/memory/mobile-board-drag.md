---
name: Mobile board drag-and-drop
description: How task drag-between-columns works on the Expo mobile Kanban board.
---
The mobile project board (`artifacts/flowdeck-mobile/app/project/[id].tsx` + `components/TaskCard.tsx`) supports long-press drag of task cards between columns.

Key design choices (the why):
- **Floating overlay preview, not card translation.** Translating the real card across columns gets clipped by the per-column vertical ScrollView and the horizontal board ScrollView. Instead the source card dims in place (`isDragging`) and a `TaskCardPreview` rendered at the screen root follows the finger via shared values (x/y/active).
- **Window-coordinate snapshot hit-testing.** At drag start we `measureInWindow` every column and card rect into a ref snapshot. Scroll is disabled during drag (`scrollEnabled={!draggingTask}`), so the snapshot stays valid. Target column = X within a column rect; insertion index = count of remaining card centers above finger Y.
- Gesture is long-press-activated (220ms) so taps still open the editor and scrolling still works before activation.
- Gated on `canEdit` (viewers can't drag) and only when >1 column. Commits via the existing `moveMutation { taskId, data: { columnId, position } }` (optimistic + rollback already there). No-op guard skips same-column same-index drops.
