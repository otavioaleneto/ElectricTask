---
name: api-server dev workflow is one-shot build (no watch)
description: Why backend code edits don't take effect until you restart the api-server workflow.
---

The `@workspace/api-server` dev script is `NODE_ENV=development && pnpm run build && pnpm run start` — a one-time esbuild bundle to `dist/index.mjs` then `node dist/index.mjs`. There is **no watch/reload**.

**Why:** After editing any api-server source (routes, lib, serializers), the running process keeps serving the STALE bundle. Symptom seen: brand-new public routes returned `401 {"error":"Não autenticado"}` and health at a nonexistent path returned 401 too — all because the old build was still live. Restarting the workflow rebuilt and everything worked.

**How to apply:** After ANY backend code change, `restart_workflow("artifacts/api-server: API Server")` before smoke-testing. The web app (Vite) DOES hot-reload; the API does not.

Extras for smoke testing from the shell:
- The api-server binds to `process.env.PORT` injected only by the workflow (not your shell). Find it via `cat /proc/<pid>/environ` of the `node .../index.mjs` process (it was 8080). Web Vite has its own PORT (e.g. 21518).
- Health route is `/api/healthz` (not `/api/health`).
- Session is a signed cookie `flowdeck_session` (cookie-parser signed); use a curl cookie jar (`-c`/`-b`) to auth end-to-end.
