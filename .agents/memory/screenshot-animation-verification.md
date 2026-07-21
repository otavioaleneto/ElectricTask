---
name: Verifying animations via screenshots
description: How to visually verify CSS/JS animations with the external screenshot tool (caching, timing tricks, mockup harness).
---

- The external screenshot service caches by URL — append `?v=N` to force a fresh capture, or you'll silently re-check a stale image.
- Screenshots can't authenticate into the real app; build a throwaway harness in the mockup sandbox (`/__mockup/preview/<Comp>`) importing the real component via relative path, with inline CSS vars/keyframes copied from the app.
- To catch a transient animation state mid-flight, redefine its keyframe duration in the harness to something huge (e.g. 600s) — capture timing is unpredictable (often 10–30s after load), so short animations always finish before the shot.
- Delete the harness file before finishing the task.

**Why:** wasted rounds interpreting a finished/cached animation frame as "not working" (or vice versa).
**How to apply:** any time visual verification of an animation or transient effect is needed on web.
