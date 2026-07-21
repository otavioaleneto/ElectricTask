---
name: FlowDeck shell nameless-user crash
description: Why the whole FlowDeck web app can white-screen on an authenticated route, and how to make the app-root shell resilient.
---

# FlowDeck shell nameless-user crash

The app-root shell (`artifacts/flowdeck/src/components/shell.tsx`, SidebarContent) reads `user.name`/`user.email` unguarded (e.g. `user.name.charAt(0)` in the avatar fallback). Because the shell wraps every authenticated route, if the current session resolves to a `user` object that is truthy but missing `name`, the ENTIRE app white-screens with "Cannot read properties of undefined (reading 'charAt')".

**Why:** Observed reliably in the Replit preview: `GET /api/auth/me` returns HTTP 304 and the client ends up with a user object lacking `name` (persisted client cache and/or 304 empty-body handling in the Orval fetch mutator). It survives both vite and api-server restarts, so it is NOT transient HMR noise. The server's `toAuthUser` always emits `name` and every DB user has a name, so it is a client/session/304 artifact — not a data or server bug.

**How to apply:** Never assume `user.name`/`user.email` exist in app-root UI; guard them (e.g. `user.name?.charAt(0) ?? "?"`). When an app-wide white-screen reproduces across clean reloads, suspect 304 handling / persisted client cache rather than your latest feature diff — confirm with `git diff` that your change doesn't touch the crashing line before spending time on it.

**Status (2026-07-04):** Fixed — shell now guards `name`/`email`, and the shared fetch mutator retries a surfaced GET/HEAD 304 once with `cache: "no-store"` (a raw 304 has an empty body, which previously made the client return `null`/partial data instead of the payload). Keep both defenses if either file is rewritten.
