---
name: FlowDeck hybrid DB + local storage
description: Rules for keeping the app runnable on both PostgreSQL and MySQL/MariaDB, and for the local-disk uploads driver.
---

# Hybrid DB (PostgreSQL + MySQL/MariaDB)

- Dialect is chosen at runtime from the `DATABASE_URL` scheme (`postgres://`/`postgresql://` vs `mysql://`/`mariadb://`). There are TWO drizzle schemas (`lib/db/src/schema` for PG, `lib/db/src/schema-mysql` for MySQL) that must stay column-identical.
  **Why:** shared hosting (cPanel) usually only offers MySQL; cloud/dev uses PG.
  **How to apply:** any schema change must be made in BOTH schema trees and both exported SQL files regenerated (`scripts/build-installer.mjs`).
- API code must NEVER use PG-only query features directly: no `.returning()`, `onConflictDoUpdate`, `ilike`, advisory locks — use the cross-dialect helpers in `lib/db` (see `lib/db/src/helpers.ts`), which branch per dialect.
- After editing `lib/db`, run `cd lib/db && npx tsc -b --force` before typechecking api-server, or stale build info hides errors.
- Full test suite runs green on both engines; MariaDB e2e recipe is in `flowdeck-installer.md` (bash sandbox blocks mariadbd — use a temp workflow).

# Local-disk uploads driver

- Storage mode is `!process.env.PRIVATE_OBJECT_DIR` → local disk (`LOCAL_UPLOADS_DIR` or `cwd/uploads`), with HMAC(SESSION_SECRET)-signed 15-min PUT URLs at `/api/storage/local-upload/:id`.
- The local upload router MUST be mounted before `express.json` (it consumes the raw body via `express.raw`).
- The signed upload URL is RELATIVE. Browsers resolve it against the origin, but node `fetch` (tests) and React Native `fetch` (mobile) require absolute URLs — every non-browser consumer of `uploadURL` must prefix the API base when it starts with `/`. Tests set `LOCAL_UPLOADS_DIR` to a tmpdir so repo `uploads/` stays clean.
