// Hybrid database entrypoint: the same application code runs on PostgreSQL or
// MySQL/MariaDB. The dialect is detected from the DATABASE_URL scheme
// (mysql:// or mysql2:// -> MySQL; anything else -> Postgres).
//
// Types are ALWAYS the canonical pg-core schema (./schema). When running on
// MySQL, structurally-compatible mysql-core tables (./schema-mysql) are used
// at runtime and cast to the PG types. Postgres-only query-builder features
// (.returning(), .onConflictDoNothing(), ilike(), db.execute of PG SQL) must
// never be used in application code — use the helpers from ./helpers instead.
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import pg from "pg";
import { createPool as createMysqlPool } from "mysql2/promise";
import * as pgSchema from "./schema";
import * as mysqlSchema from "./schema-mysql";
import { dbDialect } from "./dialect";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

type Db = NodePgDatabase<typeof pgSchema>;

let dbInstance: Db;
let poolInstance: { end: () => Promise<void> };

if (dbDialect === "mysql") {
  const mysqlPool = createMysqlPool({
    uri: process.env.DATABASE_URL,
    connectionLimit: Number(process.env.DB_POOL_MAX || 10),
    // Serialize/parse DATETIME as UTC so Date values round-trip consistently
    // regardless of the host server timezone.
    timezone: "Z",
  });
  dbInstance = drizzleMysql(mysqlPool, {
    schema: mysqlSchema,
    mode: "default",
  }) as unknown as Db;
  poolInstance = { end: () => mysqlPool.end() };
} else {
  const pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  dbInstance = drizzlePg(pgPool, { schema: pgSchema });
  poolInstance = pgPool;
}

export const db = dbInstance;
export const pool = poolInstance;

// Runtime table objects for the active dialect, typed as the canonical PG
// schema. Keep this list in sync with lib/db/src/schema/index.ts.
const activeSchema = (
  dbDialect === "mysql" ? (mysqlSchema as unknown) : pgSchema
) as typeof pgSchema;

export const usersTable = activeSchema.usersTable;
export const workspacesTable = activeSchema.workspacesTable;
export const workspaceMembersTable = activeSchema.workspaceMembersTable;
export const projectsTable = activeSchema.projectsTable;
export const projectViewsTable = activeSchema.projectViewsTable;
export const columnsTable = activeSchema.columnsTable;
export const tasksTable = activeSchema.tasksTable;
export const labelsTable = activeSchema.labelsTable;
export const taskLabelsTable = activeSchema.taskLabelsTable;
export const taskVideoLinksTable = activeSchema.taskVideoLinksTable;
export const timeEntriesTable = activeSchema.timeEntriesTable;
export const checklistsTable = activeSchema.checklistsTable;
export const checklistItemsTable = activeSchema.checklistItemsTable;
export const taskAttachmentsTable = activeSchema.taskAttachmentsTable;
export const mindmapsTable = activeSchema.mindmapsTable;
export const notesTable = activeSchema.notesTable;
export const itemLinksTable = activeSchema.itemLinksTable;
export const commentsTable = activeSchema.commentsTable;
export const commentMentionsTable = activeSchema.commentMentionsTable;
export const activityLogTable = activeSchema.activityLogTable;
export const paymentMethodsTable = activeSchema.paymentMethodsTable;
export const subscriptionCategoriesTable =
  activeSchema.subscriptionCategoriesTable;
export const subscriptionsTable = activeSchema.subscriptionsTable;
export const subscriptionPaymentsTable = activeSchema.subscriptionPaymentsTable;
export const recurringTemplatesTable = activeSchema.recurringTemplatesTable;
export const taskSubscriptionsTable = activeSchema.taskSubscriptionsTable;
export const notificationsTable = activeSchema.notificationsTable;

// All row/insert types (User, InsertUser, ...) come from the PG schema.
export type * from "./schema";

export { dbDialect, isMysql, type DbDialect } from "./dialect";
export * from "./helpers";
