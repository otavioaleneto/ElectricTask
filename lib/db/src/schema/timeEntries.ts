import {
  pgTable,
  serial,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tasksTable } from "./tasks";
import { usersTable } from "./users";

export const timeEntriesTable = pgTable(
  "time_entries",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasksTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    endedAt: timestamp("ended_at"),
    durationSeconds: integer("duration_seconds"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("time_entries_one_running_per_user_task")
      .on(table.taskId, table.userId)
      .where(sql`${table.endedAt} is null`),
  ],
);

export type TimeEntry = typeof timeEntriesTable.$inferSelect;
export type InsertTimeEntry = typeof timeEntriesTable.$inferInsert;
