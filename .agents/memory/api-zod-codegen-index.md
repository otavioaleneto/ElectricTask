---
name: api-zod codegen index collision
description: Running api-spec codegen rewrites lib/api-zod/src/index.ts in a way that breaks the build; how to restore it.
---

# api-zod codegen rewrites its index.ts and breaks the build

After running `pnpm --filter @workspace/api-spec run codegen`, the generator
rewrites `lib/api-zod/src/index.ts` to add `export * from './generated/types'`
**in addition to** `export * from './generated/api'`. Those two barrels export
overlapping names (e.g. `Body*`, `Params*`), so the dual export produces
duplicate-identifier TS errors and the libs build fails.

**Working state:** `lib/api-zod/src/index.ts` must contain ONLY:

```
export * from "./generated/api";
```

**Why:** the generated `types` and `api` barrels are not disjoint; exporting both
collides. The api-client-react index legitimately re-exports both `./generated/api`
and `./generated/api.schemas` (those are disjoint) — do not confuse the two libs.

**How to apply:** after every api-spec codegen run, restore `lib/api-zod/src/index.ts`
to the single-line export above, then run `pnpm -w run typecheck:libs` to confirm
the libs compile before touching downstream app code.
