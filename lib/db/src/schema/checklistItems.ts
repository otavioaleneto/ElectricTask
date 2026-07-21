import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { checklistsTable } from "./checklists";

export const checklistItemsTable = pgTable("checklist_items", {
  id: serial("id").primaryKey(),
  checklistId: integer("checklist_id")
    .notNull()
    .references(() => checklistsTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  done: boolean("done").notNull().default(false),
  position: integer("position").notNull().default(0),
});

export type ChecklistItem = typeof checklistItemsTable.$inferSelect;
export type InsertChecklistItem = typeof checklistItemsTable.$inferInsert;
