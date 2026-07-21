---
name: RN transformed layer hit-testing
description: On React Native, a pan/zoom "world" layer that holds gesture-enabled children must have a real, large, centered size — a zero-size or too-small transformed parent silently swallows child touches.
---

# React Native: transformed pan/zoom layers must be sized for hit-testing

When building a pan/zoom canvas (mind map, node graph, whiteboard) where an
`Animated.View` is translated+scaled and holds absolutely-positioned,
gesture-enabled children, that transformed layer MUST have an explicit,
large, centered size. On native RN a touch is only dispatched to a child if the
point falls inside every ancestor's frame. An absolutely-positioned parent with
only `left/top` (no width/height) collapses to 0x0, so its children render (visuals
use the transform) but receive NO touches — node drag/tap/long-press appear dead
while full-screen canvas pan/pinch still work (the outer catcher masks it).

**Fix pattern (coordinate math verified):**
- World layer: `position:absolute; left:-WORLD_OFFSET; top:-WORLD_OFFSET; width:WORLD_SIZE; height:WORLD_SIZE; transformOrigin:'50% 50%'` (WORLD_OFFSET = WORLD_SIZE/2).
- Children (nodes) translate by `worldCoord + WORLD_OFFSET`.
- A full-size SVG edge layer inside it sits at `left:0; top:0` and draws points at `coord + WORLD_OFFSET`.
- Net screen mapping stays `screen = pan + zoom * worldCoord` because with transformOrigin at the layer center, the `(1-zoom)*(O - WORLD_OFFSET)` term cancels when O == WORLD_OFFSET.

**Why:** symptom is invisible — types pass, Metro bundles, visuals look right, only touch is dead. Easy to misdiagnose as a gesture-composition bug.

**How to apply:** any transformed container holding gesture children on RN — size it big enough to cover the reachable coordinate range (including negative coords) and offset it so local origin maps to world (0,0).
