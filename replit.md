# ElectricTask

Central de produtividade para criadores: projetos/Kanban, notas, mapas mentais e assinaturas, com apps web e mobile. Marca: azul elétrico (#3b82f6 / hsl 217 91% 60%) + preto; nome de pacotes/pastas segue "flowdeck" (interno, não renomeado).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres (`postgres://`) or MySQL/MariaDB (`mysql://`) connection string; dialect is picked from the URL scheme
- Uploads: object storage when `PRIVATE_OBJECT_DIR` is set; otherwise local disk (`LOCAL_UPLOADS_DIR` or `cwd/uploads`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL or MySQL/MariaDB (5.7+) + Drizzle ORM (dual schema trees, dialect-branching helpers in `lib/db`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract source of truth (Orval codegen → `lib/api-client-react`, `lib/api-zod`)
- `lib/db` — Drizzle schemas (`src/schema` PG, `src/schema-mysql` MySQL — keep column-identical) + cross-dialect helpers (`insertReturning`, `upsert`, `likeInsensitive`, …)
- `artifacts/api-server/src/routes/` — Express routes (subscriptions.ts holds subscriptions, payment methods, workspace categories)
- `artifacts/flowdeck/src/pages/` — web pages (payment-methods.tsx, subscription-categories.tsx manage per-workspace payment methods/categories)
- Subscription categories are workspace-scoped rows seeded with defaults on first list; deleting an in-use category reassigns its subscriptions to "other" (key "other" cannot be deleted)
- `installer/` + `scripts/build-installer.mjs` — shared-hosting (cPanel) install wizard and package builder; `install-setup.md` (PT-BR guide); admin download at `GET /api/admin/installer/download` (allowlist-only zip); wizard supports MySQL/MariaDB (default) and PostgreSQL; package ships `schema.pgsql.sql` + `schema.mysql.sql`

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
