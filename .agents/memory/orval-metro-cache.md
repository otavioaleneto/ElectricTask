---
name: orval codegen breaks bundler resolution (metro + vite)
description: Why both the Expo mobile bundler and the Vite web app fail to resolve ./generated/api right after running OpenAPI codegen, and how to fix it.
---

# orval codegen → stale bundler resolution (mobile metro AND web vite)

After running OpenAPI codegen (orval) that regenerates the shared `@workspace/api-client-react` package, a running dev bundler can fail even though the generated files exist on disk again:

- Expo/metro mobile: `Unable to resolve "./generated/api" from "lib/api-client-react/src/index.ts"`.
- Vite web: `Pre-transform error: Failed to load url .../lib/api-client-react/src/generated/api.ts ... Does the file exist?`, and the browser HMR client then reports `Failed to reload /src/pages/<page>.tsx` for pages that import the client.

**Why:** orval's "Cleaning output folder" step briefly deletes `lib/api-client-react/src/generated/*` (and api-zod) before re-emitting them. Any bundler already running caches the missing-file resolution state in its module graph. This affects BOTH metro and vite — earlier belief that only mobile broke was wrong.

**How to apply:** This is a stale-cache artifact, not a real break. Restart the affected workflow(s) — `artifacts/flowdeck-mobile: expo` and/or `artifacts/flowdeck: web` — so a fresh bundler process re-reads the now-present files and rebundles cleanly. For web, the browser tab also needs a fresh load (the restart forces vite to re-optimize; a hard refresh clears the stale client graph). Confirm by screenshotting the preview. Do not chase it as a code/import bug. Verify the regenerated files actually exist (`ls lib/api-client-react/src/generated/`) before assuming it is just cache.
