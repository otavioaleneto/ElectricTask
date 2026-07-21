---
name: Global UI outside the protected shell must be auth-gated
description: Any UI rendered at the app root (outside the authenticated Shell/ProtectedRoute) that persists across routes must check auth and clear on logout.
---

Rule: When a feature renders persistent UI at the app root — outside the
authenticated shell / protected routes — so it survives client-side
navigation (e.g. a floating/detachable task bubble, a persistent player, a
global overlay), it MUST:
- read the current-user query and render nothing (and clear its own state)
when unauthenticated or while the app is on the login route;
- be cleared explicitly on logout (call its context's close/reset action in
the logout handler) and clear cached protected queries.

**Why:** Such UI lives in React state/query cache that is not tied to auth.
If a user detaches/opens protected content and then logs out, the widget and
its cached data (e.g. a task's details) can linger on /login and be reopened
before the unauthorized refetch, which is a privacy/security regression. This
was caught in FlowDeck code review for the floating-task feature.

**How to apply:** In the global component, gate render on
`useGetCurrentUser()` (return null + clear when `!isLoading && !user`). In the
logout success handler, call the feature's `closeFloating()`/reset and
`queryClient.clear()` before redirecting to /login. State is otherwise
intentionally in-memory: it persists across wouter client-side navigation but
resets on a full page reload — that's expected, not a bug.
