// Dialect-aware data-access helpers.
//
// Route code is typed against the canonical Postgres schema, but at runtime
// the database may be MySQL/MariaDB (see ./dialect). Anything Postgres-only
// (.returning(), .onConflictDoNothing(), ilike(), ...) MUST go through these
// helpers instead of being called inline on the query builder.
import { inArray, sql, type SQL } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type {
  AnyPgColumn,
  AnyPgTable,
  IndexColumn,
  PgUpdateSetSource,
} from "drizzle-orm/pg-core";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { dbDialect } from "./dialect";

/** db or a transaction handle — anything that can run queries. */
export type DbExecutor = Pick<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  NodePgDatabase<any>,
  "select" | "insert" | "update" | "delete" | "execute"
>;

type TableWithId = AnyPgTable & { id: AnyPgColumn };

function toRows<T>(values: T | T[]): T[] {
  return Array.isArray(values) ? values : [values];
}

async function reselectByIds(
  ex: DbExecutor,
  table: TableWithId,
  ids: number[],
): Promise<Record<string, unknown>[]> {
  if (ids.length === 0) return [];
  const rows: Record<string, unknown>[] = await (
    ex.select().from(table as never) as never as {
      where: (w: SQL) => Promise<Record<string, unknown>[]>;
    }
  ).where(inArray(table.id, ids));
  const byId = new Map(rows.map((r) => [Number(r.id), r]));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is Record<string, unknown> => r !== undefined);
}

/**
 * INSERT ... and return the full inserted rows (in input order).
 * PG: native RETURNING. MySQL: $returningId() then re-select by PK.
 */
export async function insertReturning<T extends TableWithId>(
  ex: DbExecutor,
  table: T,
  values: InferInsertModel<T> | InferInsertModel<T>[],
): Promise<InferSelectModel<T>[]> {
  const rows = toRows(values);
  if (rows.length === 0) return [];
  if (dbDialect === "postgres") {
    return (await ex
      .insert(table)
      .values(rows as never)
      .returning()) as InferSelectModel<T>[];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inserted: { id: number }[] = await (
    ex.insert(table).values(rows as never) as any
  ).$returningId();
  const ids = inserted.map((r) => Number(r.id));
  return (await reselectByIds(ex, table, ids)) as InferSelectModel<T>[];
}

/**
 * UPDATE ... WHERE and return the updated rows.
 * PG: native RETURNING (single statement).
 * MySQL: select matching ids -> update by ids -> re-select by ids. This is
 * safe by construction even when SET touches columns used in WHERE.
 */
export async function updateReturning<T extends TableWithId>(
  ex: DbExecutor,
  table: T,
  set: PgUpdateSetSource<T>,
  where: SQL | undefined,
): Promise<InferSelectModel<T>[]> {
  if (dbDialect === "postgres") {
    return (await ex
      .update(table)
      .set(set as never)
      .where(where)
      .returning()) as InferSelectModel<T>[];
  }
  const found: { id: unknown }[] = await ex
    .select({ id: table.id })
    .from(table as never)
    .where(where);
  const ids = found.map((r) => Number(r.id));
  if (ids.length === 0) return [];
  await ex
    .update(table)
    .set(set as never)
    .where(inArray(table.id, ids));
  return (await reselectByIds(ex, table, ids)) as InferSelectModel<T>[];
}

/**
 * UPDATE ... WHERE as a SINGLE conditional statement, returning the number of
 * rows affected. Unlike updateReturning (which on MySQL is select-ids ->
 * update-by-ids and therefore drops the WHERE condition at write time), this
 * keeps the condition in the UPDATE itself on both dialects, so it is safe
 * for atomic claim / compare-and-set patterns.
 */
export async function updateCount<T extends TableWithId>(
  ex: DbExecutor,
  table: T,
  set: PgUpdateSetSource<T>,
  where: SQL | undefined,
): Promise<number> {
  if (dbDialect === "postgres") {
    const rows = await ex
      .update(table)
      .set(set as never)
      .where(where)
      .returning({ id: table.id });
    return rows.length;
  }
  const result: unknown = await ex
    .update(table)
    .set(set as never)
    .where(where);
  const header = (Array.isArray(result) ? result[0] : result) as
    | { affectedRows?: unknown }
    | undefined;
  return Number(header?.affectedRows ?? 0);
}

/**
 * DELETE ... WHERE and return the deleted rows.
 * MySQL: re-select first, then delete by ids.
 */
export async function deleteReturning<T extends TableWithId>(
  ex: DbExecutor,
  table: T,
  where: SQL | undefined,
): Promise<InferSelectModel<T>[]> {
  if (dbDialect === "postgres") {
    return (await ex
      .delete(table)
      .where(where)
      .returning()) as InferSelectModel<T>[];
  }
  const rows: Record<string, unknown>[] = await (
    ex.select().from(table as never) as never as {
      where: (w: SQL | undefined) => Promise<Record<string, unknown>[]>;
    }
  ).where(where);
  const ids = rows.map((r) => Number(r.id));
  if (ids.length > 0) {
    await ex.delete(table).where(inArray(table.id, ids));
  }
  return rows as InferSelectModel<T>[];
}

/**
 * INSERT that silently skips rows violating any unique constraint.
 * PG: ON CONFLICT DO NOTHING. MySQL: ON DUPLICATE KEY UPDATE no-op.
 */
export async function insertIgnore<T extends TableWithId>(
  ex: DbExecutor,
  table: T,
  values: InferInsertModel<T> | InferInsertModel<T>[],
): Promise<void> {
  const rows = toRows(values);
  if (rows.length === 0) return;
  if (dbDialect === "postgres") {
    await ex
      .insert(table)
      .values(rows as never)
      .onConflictDoNothing();
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (ex.insert(table).values(rows as never) as any).onDuplicateKeyUpdate({
    set: { id: sql`id` },
  });
}

/**
 * INSERT a single row; return [row] on success or [] if it hit a unique
 * constraint. PG: ON CONFLICT DO NOTHING ... RETURNING (atomic). MySQL:
 * plain insert catching ER_DUP_ENTRY (dup errors do not poison MySQL
 * transactions, unlike PG).
 */
export async function insertIgnoreReturning<T extends TableWithId>(
  ex: DbExecutor,
  table: T,
  values: InferInsertModel<T>,
  pgConflict?: { target: IndexColumn[]; where?: SQL },
): Promise<InferSelectModel<T>[]> {
  if (dbDialect === "postgres") {
    const q = ex.insert(table).values(values as never);
    return (await (pgConflict
      ? q.onConflictDoNothing(pgConflict)
      : q.onConflictDoNothing()
    ).returning()) as InferSelectModel<T>[];
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inserted: { id: number }[] = await (
      ex.insert(table).values(values as never) as any
    ).$returningId();
    const ids = inserted.map((r) => Number(r.id));
    return (await reselectByIds(ex, table, ids)) as InferSelectModel<T>[];
  } catch (error) {
    if (isUniqueViolation(error)) return [];
    throw error;
  }
}

/**
 * INSERT ... ON CONFLICT/DUPLICATE KEY UPDATE (upsert).
 * `target` is only used on PG (MySQL applies any unique key).
 */
export async function upsert<T extends TableWithId>(
  ex: DbExecutor,
  table: T,
  values: InferInsertModel<T> | InferInsertModel<T>[],
  conflict: { target: IndexColumn[]; set: PgUpdateSetSource<T> },
): Promise<void> {
  const rows = toRows(values);
  if (rows.length === 0) return;
  if (dbDialect === "postgres") {
    await ex
      .insert(table)
      .values(rows as never)
      .onConflictDoUpdate({
        target: conflict.target,
        set: conflict.set as never,
      });
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (ex.insert(table).values(rows as never) as any).onDuplicateKeyUpdate({
    set: conflict.set,
  });
}

/** True when the error is a unique-constraint violation on either dialect. */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    if (typeof current === "object") {
      const e = current as { code?: unknown; errno?: unknown; cause?: unknown };
      if (e.code === "23505") return true; // PG unique_violation
      if (e.errno === 1062 || e.code === "ER_DUP_ENTRY") return true; // MySQL
      current = e.cause;
    } else {
      break;
    }
  }
  return false;
}

/**
 * Case-insensitive LIKE that works on both dialects (replaces PG ILIKE).
 * `pattern` should already contain % wildcards, e.g. `%${q}%`.
 */
export function likeInsensitive(
  column: AnyPgColumn | SQL,
  pattern: string,
): SQL {
  return sql`lower(${column}) like lower(${pattern})`;
}
