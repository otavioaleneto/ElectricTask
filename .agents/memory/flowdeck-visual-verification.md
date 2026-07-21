---
name: FlowDeck visual verification in dev
description: How to visually verify web UI when the app is auth-gated and the vite port has no /api proxy
---

- The naked dev domain (`https://$REPLIT_DEV_DOMAIN/`, no port suffix) serves the vite SPA AND routes `/api` to the api-server. The `:21518` port form serves vite only — `/api` falls through to the HTML fallback (200 text/html), so pages crash on data load instead of redirecting to login.
- The screenshot browser has no session cookie: any auth-guarded route on the naked domain redirects to `/login`. You cannot screenshot authenticated pages.
- **How to verify visuals**: build a temporary harness in `artifacts/mockup-sandbox/src/components/mockups/<topic>/X.tsx` that imports the real component via relative path (e.g. `../../../../../flowdeck/src/components/...`), set needed CSS vars inline (e.g. `--primary: 217 91% 60%`), then screenshot `https://$REPLIT_DEV_DOMAIN/__mockup/preview/<topic>/X` as an external_url. Delete the harness afterward.
- **Why:** repeated sessions burned time chasing "why does /api return HTML on 21518" and crashed screenshots that were environment artifacts, not code bugs.
