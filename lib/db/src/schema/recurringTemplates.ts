import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { columnsTable } from "./columns";
import { usersTable } from "./users";

// Snapshot of the source task's checklists at template-creation time.
export type RecurrenceChecklistShape = {
  title: string;
  items: string[];
}[];

export const recurringTemplatesTable = pgTable("recurring_templates", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  columnId: integer("column_id")
    .notNull()
    .references(() => columnsTable.id, { onDelete: "cascade" }),
  createdBy: integer("created_by").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull().default("standard"),
  priority: text("priority").notNull().default("medium"),
  assigneeId: integer("assignee_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  // No DDL default on the JSON columns: MySQL/MariaDB cannot reliably default
  // JSON. Application code always provides values on insert.
  labelIds: jsonb("label_ids").notNull().$type<number[]>(),
  checklist: jsonb("checklist").notNull().$type<RecurrenceChecklistShape>(),
  // hourly | daily | weekly | monthly
  frequency: text("frequency").notNull(),
  // "HH:mm" (server-local time); required for daily/weekly/monthly.
  timeOfDay: text("time_of_day"),
  // 0 (Sunday) - 6 (Saturday); required for weekly.
  dayOfWeek: integer("day_of_week"),
  // 1-31 (clamped to month length); required for monthly.
  dayOfMonth: integer("day_of_month"),
  active: boolean("active").notNull().default(true),
  nextRunAt: timestamp("next_run_at").notNull(),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type RecurringTemplate = typeof recurringTemplatesTable.$inferSelect;
export type InsertRecurringTemplate =
  typeof recurringTemplatesTable.$inferInsert;
