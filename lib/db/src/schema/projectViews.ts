import {
  pgTable,
  serial,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { projectsTable } from "./projects";

export const projectViewsTable = pgTable(
  "project_views",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    lastViewedAt: timestamp("last_viewed_at").notNull().defaultNow(),
  },
  (t) => ({
    userProjectUnique: uniqueIndex("project_views_user_project_unique").on(
      t.userId,
      t.projectId,
    ),
  }),
);

export type ProjectView = typeof projectViewsTable.$inferSelect;
export type InsertProjectView = typeof projectViewsTable.$inferInsert;
