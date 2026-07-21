import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { usersTable } from "./users";

export const subscriptionCategoriesTable = pgTable(
  "subscription_categories",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    createdBy: integer("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    byWorkspaceKey: uniqueIndex("subscription_categories_workspace_key_idx").on(
      t.workspaceId,
      t.key,
    ),
  }),
);

export type SubscriptionCategoryRow =
  typeof subscriptionCategoriesTable.$inferSelect;
export type InsertSubscriptionCategory =
  typeof subscriptionCategoriesTable.$inferInsert;
