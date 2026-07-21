import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { tasksTable } from "./tasks";

export const taskVideoLinksTable = pgTable("task_video_links", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  label: text("label"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type TaskVideoLink = typeof taskVideoLinksTable.$inferSelect;
export type InsertTaskVideoLink = typeof taskVideoLinksTable.$inferInsert;
