import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { tasksTable } from "./tasks";

export const checklistsTable = pgTable("checklists", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
});

export type Checklist = typeof checklistsTable.$inferSelect;
export type InsertChecklist = typeof checklistsTable.$inferInsert;
