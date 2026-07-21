---
name: api-zod barrel codegen quirk
description: orval regenerates a duplicate barrel export in @workspace/api-zod that breaks the libs typecheck/build; how to fix it after every codegen run.
---

After running orval codegen for the API spec, `lib/api-zod/src/index.ts` gets a
duplicate `export * from './generated/types';` line re-added next to
`export * from "./generated/api";`. Because `./generated/api` already re-exports
the type members, this produces TS2308 "has already exported a member named ..."
errors and fails `pnpm -w run typecheck:libs` (and anything that builds the libs).

**The fix:** overwrite the file to exactly one line:
`export * from "./generated/api";`

**Why:** the generator config emits both barrels even though `api` already
re-exports `types`. The duplicate is regenerated on *every* codegen run, so it is
not a one-time fix — re-apply it each time you regenerate.

**How to apply:** any time you change `lib/api-spec/openapi.yaml` and run orval
(e.g. `pnpm --filter @workspace/api-spec exec orval --config ./orval.config.ts`),
immediately rewrite `lib/api-zod/src/index.ts` to the single line above, then
re-run `pnpm -w run typecheck:libs` to confirm it is clean. The proper long-term
fix is to correct the orval/generator config so it stops emitting the second
barrel.
