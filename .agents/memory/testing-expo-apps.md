---
name: Testing Expo (mobile) apps in this project
description: Why the runTest e2e harness can't validate the Expo mobile artifact, and how to verify mobile instead.
---

The `runTest()` Playwright harness (testing skill) navigates the **main web preview proxy** (localhost:80 path-routing). It does NOT stay on the Expo app's separate `*.expo.janeway.replit.dev` domain even when given an absolute Expo URL — it ends up on the web artifact at `/`.

**Symptom:** an e2e test plan written for the mobile UI reports web-app behavior (e.g. the web "Novo Workspace" dialog instead of the mobile "Novo projeto" sheet).

**Why:** the harness is bound to the proxied preview, and the cross-origin Expo domain is not reachable/retained by the test browser context.

**How to apply:** to verify the FlowDeck mobile (Expo) artifact, rely on:
- `pnpm --filter @workspace/flowdeck-mobile run typecheck`
- the `screenshot` tool with `type=app_preview`, `artifact_dir_name=flowdeck-mobile` (static render check; can't interact/log in)
- architect code review as the primary correctness gate beyond typecheck

Do not burn repeated `runTest` attempts trying to reach the Expo app.
