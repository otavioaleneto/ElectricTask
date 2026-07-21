---
name: api-zod barrel export
description: The @workspace/api-zod public barrel must export ONLY ./generated/api, never ./generated/types. The codegen script is patched to auto-restore this after every orval run.
---

`lib/api-zod/src/index.ts` must be exactly `export * from "./generated/api";` (single line).

**Why:** The orval `zod` target (see `lib/api-spec/orval.config.ts`, `schemas: { path: "generated/types" }`) emits BOTH `generated/api.ts` (zod schema *values*) AND `generated/types/*` (TS types with the *same names*). Adding a second barrel line `export * from './generated/types'` duplicates those names, so `pnpm -w run typecheck:libs` fails with TS2308. Orval rewrites `src/index.ts` on every run and re-adds the `./generated/types` line.

**How to apply:** The `codegen` script in `lib/api-spec/package.json` has been patched to auto-restore the single-line barrel immediately after orval finishes (via a `node -e` inline script), before typecheck:libs runs. So `pnpm --filter @workspace/api-spec run codegen` now works end-to-end without manual intervention. If the barrel gets corrupted again, check that the patch line is still in `lib/api-spec/package.json`.
