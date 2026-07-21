---
name: FlowDeck horizontal-overflow / min-w-0 layout rule
description: Why wide views (Kanban board, tables, timelines) on the web project page must sit in a min-w-0 flex chain.
---

The web Shell wraps every page in a Radix `ScrollArea` whose Viewport uses an internal
`display:table; min-width:100%` wrapper. A table wrapper is shrink-to-fit, so any descendant's
intrinsic `min-content` width propagates upward and inflates the whole page — `overflow-x-auto`
on an inner panel does NOT contain it unless that panel (and its flex ancestors) have
`min-width: 0`.

**Symptom:** opening a project (Kanban default) made the entire page scroll horizontally and
pushed the header buttons off-screen, because the header row uses `justify-between` and stretched
to the inflated page width.

**Why:** a flex item's default `min-width` is `auto` (won't shrink below content min-content),
and the ScrollArea table wrapper turns that propagation into page-level overflow.

**How to apply:** for any horizontally-wide view inside a page (Kanban row of `w-80` columns,
wide tables, timelines), put `min-w-0` on the whole flex chain down to the scroll container
(page root flex col -> Tabs -> the `overflow-x-auto`/`overflow-auto` panel). Self-contained
components that set a fixed pixel inner width inside their own `overflow-x-auto` (e.g.
project-timeline) are already safe and don't need it.

## Page width cap: the `wide` opt-in

The Shell wraps every page's content in `max-w-7xl mx-auto` (caps at 1280px, centered). On wide
monitors this boxed the Kanban board into 1280px, wasting side space and forcing a premature
horizontal scrollbar even when the screen had room — the user's "barra inferior maior que a tela".

**Decision:** `Shell` takes a `wide` prop; when true it drops `max-w-7xl mx-auto` and the content
fills the full available width. `ProtectedRoute` forwards `wide`, and the project route
(`/projects/:projectId`) passes it so the board uses the whole screen. All other pages stay capped.

**Why:** board-style views want every horizontal pixel; document/dashboard views read better capped.
**How to apply:** for a new full-width view, render its route with `<ProtectedRoute ... wide />`;
do NOT remove the global cap from Shell (it would un-cap dashboard/notes/etc.). The min-w-0 chain
above is still required for `wide` pages — full width does not remove the ScrollArea table-wrapper
propagation; it only changes the max width the chain is contained to.

## Multi-column board columns: grid, not fixed-width flex

The Kanban columns were `w-[340px] shrink-0` inside a flex row — fixed and non-shrinking, so on
smaller screens they overflowed and the right-most column's cards/"Adicionar tarefa" button were
clipped, and on wide screens they left empty space on the right.

**Decision:** lay the columns out as a CSS grid row, not fixed-width flex items:
`grid grid-flow-col auto-cols-[minmax(300px,1fr)] gap-4 items-start`, with each column carrying
`min-w-0` (no width/`shrink-0`). Columns then grow to fill the available width and compress down to
a 300px floor before the board scrolls horizontally.

**Why:** `minmax(300px,1fr)` gives both behaviors at once — fill-to-width when there's room, a
comfortable minimum + horizontal scroll when there isn't — so buttons are never clipped on common
laptop widths and space isn't wasted on wide monitors. Fixed `w-[Npx] shrink-0` can do neither.
**How to apply:** keep the scroll on the board's `overflow-x-auto` panel (the Kanban `TabsContent`)
and the `min-w-0` containment chain intact — the grid's min-content (N×300 + gaps) must scroll
*inside* that panel, not become page-level overflow. Verified at 900 / 1100 / 1680px: page never
scrolls horizontally; below ~1024px the board panel scrolls internally and reveals the last column.
Changing flex→grid does not affect DnD: column-reorder and task-drop handlers stay on the same divs.
