---
name: FlowDeck shared-hosting installer
description: Conventions and pitfalls for the cPanel installer package, wizard, and admin download endpoint.
---

# FlowDeck shared-hosting installer

- The install package is assembled by `scripts/build-installer.mjs` (archiver — the `zip` CLI is NOT available in this environment).
- Rule: any zip served to admins from a live app root MUST use a strict allowlist of entries (dist/public/installer + a fixed file list). Never blacklist.
  **Why:** a blacklist leaks whatever else lands in the app root (backups, logs, dumps) to any admin session — architect review flagged this as a security failure.
  **How to apply:** when touching `artifacts/api-server/src/routes/installer.ts` or adding new package files, extend `ALLOWED_DIRS`/`ALLOWED_FILES` explicitly.
- `installer/server.js` loads `.env` dotenv-style: it does NOT override pre-set env vars. Any e2e test in the workspace shell must run the packaged app with `env -u DATABASE_URL` or it silently connects to the dev DB (login "fails" with valid credentials).
- Installer wizard API expects FLAT fields `adminName`/`adminEmail`/`adminPassword` (not a nested `admin` object).
- Installer password hash must stay byte-identical to `artifacts/api-server/src/lib/auth.ts` (`salt-hex:scryptSync(pw,salt,64)-hex`).
- Schema SQL files (`schema.pgsql.sql` + `schema.mysql.sql`) are generated offline with `drizzle-kit export` and a placeholder DATABASE_URL — no DB connection needed.
  - `drizzle-kit export` prints informational lines ("Reading schema files: …") before the SQL; the build script must strip everything before the first SQL statement or the file breaks MySQL (which is applied statement-by-statement, unlike PG which tolerates it inside a single multi-statement string).
- MySQL DDL is applied statement-by-statement WITHOUT a transaction (MySQL auto-commits DDL); PG keeps BEGIN/COMMIT. Splitting is done by `splitSqlStatements` — NOTE: it is a naive split on `;` at end-of-line (only strips leading `--` comment lines); it does NOT handle semicolons inside quoted strings, so schema exports must not contain them (drizzle-kit output currently doesn't).
- The installer's DB helpers are exported from `installer-server.js` module.exports for e2e testing; `dbTypeOf` takes the request BODY (with `dbType`/`databaseUrl` fields), not a URL string.
- STALE-BUNDLE PITFALL: a packaged `dist/index.mjs` older than the hybrid-DB code contains ONLY the pg driver — a MySQL install then "succeeds" (wizard uses its own mysql2 client) but the app 500s at the FIRST real DB query (login), because the pool connects lazily and the app boots/serves the login page fine.
  **Why:** this shipped to a real user once — the admin download served a cached zip built with `--skip-build`.
  **How to apply:** the download endpoint now always rebuilds (dev mode; `?cached=1` opts out) and `build-installer.mjs` refuses to package a bundle without the MySQL markers (`mysql2?|mariadb` regex source + `mysql2/promise`). Never weaken either check; after db-layer changes, rebuild before packaging.

# Bash tool testing quirk

- Background processes started in one bash tool call are killed when that call ends (`nohup` does not help). Run start-server + curl + assertions in a SINGLE bash invocation; background with `( ... & )` inside it.
- The bash sandbox's syscall monitor blocks `mariadbd`/`mariadb-install-db` entirely ("openat: get fd path ffffffff" errors). To e2e-test against MariaDB: fetch the binary via `nix build nixpkgs#mariadb --no-link --print-out-paths`, run it in a TEMPORARY workflow (workflows run outside the sandbox), connect over TCP 127.0.0.1:3307 with `--skip-grant-tables`, then remove the workflow. The mysql2 client from node works fine inside the sandbox.
