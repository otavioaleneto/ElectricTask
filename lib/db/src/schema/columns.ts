import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const columnsTable = pgTable("columns", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  color: text("color").notNull().default("#3b82f6"),
  isDone: boolean("is_done").notNull().default(false),
});

export type Column = typeof columnsTable.$inferSelect;
export type InsertColumn = typeof columnsTable.$inferInsert;
