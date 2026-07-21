import { pgTable, serial, integer, unique } from "drizzle-orm/pg-core";
import { tasksTable } from "./tasks";
import { labelsTable } from "./labels";

export const taskLabelsTable = pgTable(
  "task_labels",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasksTable.id, { onDelete: "cascade" }),
    labelId: integer("label_id")
      .notNull()
      .references(() => labelsTable.id, { onDelete: "cascade" }),
  },
  (t) => ({
    uniqTaskLabel: unique().on(t.taskId, t.labelId),
  }),
);

export type TaskLabel = typeof taskLabelsTable.$inferSelect;
export type InsertTaskLabel = typeof taskLabelsTable.$inferInsert;
