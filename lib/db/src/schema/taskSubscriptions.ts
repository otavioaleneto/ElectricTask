import {
  pgTable,
  serial,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { tasksTable } from "./tasks";
import { subscriptionsTable } from "./subscriptions";

export const taskSubscriptionsTable = pgTable(
  "task_subscriptions",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasksTable.id, { onDelete: "cascade" }),
    subscriptionId: integer("subscription_id")
      .notNull()
      .references(() => subscriptionsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    uniqTaskSub: uniqueIndex("task_subscriptions_task_sub_uniq").on(
      t.taskId,
      t.subscriptionId,
    ),
    byTask: index("task_subscriptions_task_idx").on(t.taskId),
    bySubscription: index("task_subscriptions_subscription_idx").on(
      t.subscriptionId,
    ),
  }),
);

export type TaskSubscription = typeof taskSubscriptionsTable.$inferSelect;
export type InsertTaskSubscription = typeof taskSubscriptionsTable.$inferInsert;
