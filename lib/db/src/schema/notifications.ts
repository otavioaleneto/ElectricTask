import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tasksTable } from "./tasks";
import { usersTable } from "./users";
import { subscriptionsTable } from "./subscriptions";

export const notificationsTable = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    taskId: integer("task_id").references(() => tasksTable.id, {
      onDelete: "cascade",
    }),
    subscriptionId: integer("subscription_id").references(
      () => subscriptionsTable.id,
      { onDelete: "cascade" },
    ),
    actorId: integer("actor_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    userInboxIdx: index("notifications_user_inbox_idx").on(
      t.userId,
      t.read,
      t.createdAt,
    ),
    dueSoonUnique: uniqueIndex("notifications_due_soon_unique")
      .on(t.userId, t.taskId)
      .where(sql`${t.type} = 'due_soon'`),
    subscriptionDueUnique: uniqueIndex("notifications_subscription_due_unique")
      .on(t.userId, t.subscriptionId)
      .where(sql`${t.type} = 'subscription_due'`),
    subscriptionOverdueUnique: uniqueIndex(
      "notifications_subscription_overdue_unique",
    )
      .on(t.userId, t.subscriptionId)
      .where(sql`${t.type} = 'subscription_overdue'`),
  }),
);

export type Notification = typeof notificationsTable.$inferSelect;
export type InsertNotification = typeof notificationsTable.$inferInsert;
