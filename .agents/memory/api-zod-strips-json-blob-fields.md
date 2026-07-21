---
name: api-zod strips unknown fields even inside JSON blobs
description: Why a new field on a JSON-blob-stored entity (e.g. mindmap nodes) silently disappears on save unless the OpenAPI schema is updated and codegen re-run.
---

# api-zod strips unknown fields — even inside JSON blobs

In this project the OpenAPI spec (lib/api-spec/openapi.yaml) drives codegen for
`@workspace/api-client-react` and `@workspace/api-zod` (orval). The api-server
validates request bodies with the generated zod schemas via `parseBody(...)`.

The footgun: orval/zod object schemas **strip unknown keys** on parse. So if you
add a new property to an entity that is persisted as a JSON blob (e.g. a mindmap
node lives in `mindmaps.data` jsonb, not its own table), you might think "no DB
migration needed, just add the TS type and use it." But on the update path the
new property is **silently dropped** by zod validation before it reaches the DB —
no error, the field just vanishes after a save/reload.

**Why:** the update body schema (e.g. MindmapUpdate -> MindmapData -> MindmapNode)
only keeps properties declared in the OpenAPI schema; everything else is removed.

**How to apply:** Any new field on a contract-validated payload — including nested
fields inside a JSON-blob shape — must be added to the OpenAPI schema and codegen
re-run (`pnpm --filter @workspace/api-spec run codegen`), even when no Drizzle
migration is required. Then **rebuild/restart the api-server** so it bundles the
regenerated api-zod; a stale running server keeps stripping the field. Verify with
an end-to-end PATCH+GET round-trip, not just a typecheck.
