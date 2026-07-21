---
name: Installer update safety (shared hosting)
description: Why "updating" the cPanel package can look like data loss — two failure modes — and how the package guards against both
---

Rule: the shared-hosting package must never be able to destroy data, updates must preserve `.env` + `.installed`, and the packaged app must auto-repair schema drift at boot.

**Why:** a production user reported all projects/tasks "deleted" after uploading a new package version. There are TWO distinct failure modes that look like data loss, and data was intact in both:

1. **Env loss:** deleting the old folder before extracting loses hidden `.env`/`.installed`; the app reboots into install mode and the wizard is re-run against a new empty database. Recovery: restore the old `DATABASE_URL` in `.env`.
2. **Schema drift (the confirmed 2026-07 incident):** `.env` unchanged, same DB, but the new code queries columns/tables the old DB lacks (e.g. `users.security_question_1`) — queries 500, screens look empty, data is fully intact. Fixed permanently: the package now ships `installer/upgrade-db.js` and `server.js` runs an idempotent schema upgrade at every boot before importing the app (creates missing tables/columns/indexes/FKs, never drops; logs to `upgrade-db.log`; on failure logs and boots anyway). The wizard's create-tables step also runs it when `users` already exists.

**How to apply:** keep these invariants when touching installer/build-installer: no destructive SQL in shipped schema files; wizard `create-tables` guarded on existing `users`; upgrade-db.js never drops/alters existing data; PG optional statements (FKs/indexes) run under SAVEPOINTs (a plain try/catch inside a PG transaction turns COMMIT into silent ROLLBACK); PG missing-index check is by NAME globally (PG index names are schema-global), MySQL by (table,name). Update docs (LEIA-ME + install-setup.md) must say: extract over existing files, never delete the folder, never re-run `/install`. When a user reports post-update "data loss": first compare `.env` `DATABASE_URL` with the original DB, then check `upgrade-db.log` / server log for failed queries on missing columns.
