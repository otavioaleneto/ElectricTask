---
name: FlowDeck mobile + shared cookie auth
description: How the Expo mobile companion reuses the api-server's cookie/session auth, and the CORS/customFetch setup that makes it work on both web and native.
---

# FlowDeck mobile companion (artifacts/flowdeck-mobile)

## Cookie/session auth reuse (web + React Native)
The api-server authenticates with a signed httpOnly cookie, not bearer tokens. Making the shared api-client work for both web and Expo requires two settings that must stay in lockstep: the client fetch layer sends `credentials: "include"`, and the server enables credentialed CORS.

**Critical security rule:** credentialed CORS must NEVER reflect an arbitrary origin (`cors({ origin: true, credentials: true })` was rejected in review — it lets any malicious site make authenticated calls and read responses). Use an explicit allowlist built from the Replit domain env vars (`REPLIT_DEV_DOMAIN`, `REPLIT_EXPO_DEV_DOMAIN`, `REPLIT_DOMAINS`) plus localhost, and allow no-Origin requests (native mobile / curl are not browser cross-site requests).

**Why:** With credentialed CORS + `credentials:"include"`, the dev proxy responds `Set-Cookie: ...; SameSite=None; Secure` and React Native's native cookie jar persists/sends it automatically across restarts. No bearer/`setAuthTokenGetter` is needed.
**How to apply:** If auth fails on mobile or web, verify both settings before adding token logic — but never widen CORS to a blanket origin reflector to "fix" it.

## Boot/auth flow
- `contexts/auth.tsx`: hydrate cached user from AsyncStorage for instant boot, then verify with `getCurrentUser()`; on 401 clear the cached user. `(tabs)/_layout.tsx` redirects to `/login` when unauthenticated.
- `ApiError` is NOT exported from `@workspace/api-client-react` (only `ErrorType`). Detect 401 via `(e as {status?:number}).status`, not `instanceof ApiError`.

## Move-tasks UX
Kanban "move" on mobile is done WITHOUT drag libs: per-task left/right arrows + a bottom-sheet column picker, calling `useMoveTask` with optimistic cache updates on `getListTasksQueryKey(projectId)`. Append moves use `position = targetColumn.taskCount`.

## Theming
The app commits to FlowDeck's Black/Red dark identity in BOTH `light` and `dark` palettes of `constants/colors.ts` (and `userInterfaceStyle: "dark"` in app.json), so it always reads black-and-red regardless of device appearance.
