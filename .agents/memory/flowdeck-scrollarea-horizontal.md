---
name: Radix ScrollArea clips horizontal children
description: Why horizontally-overflowing content (Kanban board) gets cut off with no scrollbar inside the shell, and the fix.
---

# Radix ScrollArea clips horizontal overflow

The shell wraps every page's content in a shared Radix `ScrollArea` (vertical only —
`components/ui/scroll-area.tsx`, `<main>` is `overflow-hidden`). Radix's `Viewport`
injects a **direct child div with inline `style="min-width:100%; display:table"`**,
which shrink-wraps to its content's max-content width.

**Symptom:** any child that overflows horizontally (e.g. the Kanban board whose
columns have a min-width) expands that table wrapper past the viewport. Because
`<main>` is `overflow-hidden` and only a *vertical* ScrollBar is rendered, the extra
width is clipped with **no horizontal scrollbar** — content looks "cut off," most
visible on narrow (tablet ~820px) screens. The child's own `overflow-x-auto` never
engages because its width is never bounded.

**Fix (applied in `scroll-area.tsx` Viewport):**
`[&>div]:!block [&>div]:!min-w-0` — forces the injected wrapper to `display:block` so
it fills the viewport width (100%) instead of shrink-wrapping. `!important` is
required because Radix sets the wrapper styles *inline*, and only `!important`
stylesheet rules beat inline styles. Then the full width chain is containing and the
child's `overflow-x-auto` scrolls horizontally.

**Why safe globally:** only shell + notification-bell consume this ScrollArea, both
vertical-only (no horizontal ScrollBar mounted), so nothing relied on the wrapper's
content-width expansion. Vertical scroll/thumb sizing is driven by viewport
scrollHeight and is unaffected by the wrapper's display value.

**How to apply:** for any horizontally-scrolling surface inside the shell, ensure
every ancestor in the flex chain has `min-w-0` AND this ScrollArea override is present;
put `overflow-x-auto` on the scroll container itself.
