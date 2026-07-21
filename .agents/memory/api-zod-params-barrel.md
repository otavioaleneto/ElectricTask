---
name: api-zod Params barrel collision
description: Why lib/api-zod/src/index.ts must NOT re-export ./generated/types — orval query-param ops cause TS2308.
---

# api-zod barrel must only export ./generated/api

The hand-written barrel `lib/api-zod/src/index.ts` exports **only** `export * from "./generated/api";`. Do not add back `export * from "./generated/types"`.

**Why:** orval's zod target emits, for any operation with query params, BOTH a runtime value `{OperationId}Params` (a zod schema in `generated/api.ts`) AND a TypeScript type `{OperationId}Params` (in `generated/types/`). Re-exporting both folders with `export *` makes the same name ambiguous (a value vs a type) and `tsc --build` fails with TS2308 ("already exported a member named '...Params'"). `export type * from "./generated/types"` does NOT fix it — TS still refuses to merge a star-exported value with a star-exported type. This surfaces the first time any endpoint gets query params (e.g. listTasks filters) and would recur for every future `{op}Params` op.

**How to apply:** Consumers get zod schemas (e.g. `CreateTaskBody`, `HealthCheckResponse`) from `@workspace/api-zod` (all live in `generated/api.ts`). TypeScript model types come from `@workspace/api-client-react`, never from api-zod. So dropping the types barrel breaks nothing. `clean:true` in codegen only wipes `generated/`, so this one-line `index.ts` persists across `pnpm --filter @workspace/api-spec run codegen`.
