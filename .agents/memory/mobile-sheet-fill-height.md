---
name: Mobile SheetModal fill-height
description: How to make a content-heavy bottom-sheet editor fill the screen with its action button pinned to the bottom.
---

# Mobile SheetModal fill-height

A bottom-sheet `Modal` that only sets `maxHeight` on the sheet and puts a plain
(non-flexing) `ScrollView` above the footer will NOT fill the screen and will NOT
pin its footer button to the bottom — content-short sheets hug content, and the
save button can float with empty space below it.

**Rule:** for a content-heavy editor sheet, give the sheet a concrete numeric
height (from `useWindowDimensions`, clamped under the existing `maxHeight` and the
top safe-area inset), give the scroll area `flex: 1`, and keep the footer as a
sibling OUTSIDE the scroll region. Then the scroll area fills available space and
the footer is structurally pinned to the bottom.

**Why:** percentage-only `maxHeight` with an auto-sized `KeyboardAvoidingView`
parent resolves unreliably across native vs Expo web; a concrete height is
deterministic. A non-flex ScrollView sizes to content, so the footer lands wherever
content ends instead of at the bottom.

**How to apply:** this is opt-in via SheetModal's `fillHeight` prop. Scope it to the
modes that need it (e.g. the edit editor) rather than every sheet, so light sheets
like create/"Nova tarefa" still hug their content.
