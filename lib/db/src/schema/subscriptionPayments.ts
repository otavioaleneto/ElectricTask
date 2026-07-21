import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { usersTable } from "./users";
import { subscriptionsTable } from "./subscriptions";

export const subscriptionPaymentsTable = pgTable(
  "subscription_payments",
  {
    id: serial("id").primaryKey(),
    subscriptionId: integer("subscription_id")
      .notNull()
      .references(() => subscriptionsTable.id, { onDelete: "cascade" }),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    dueDate: text("due_date").notNull(),
    paidBy: integer("paid_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    paidAt: timestamp("paid_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    bySubscription: index("subscription_payments_subscription_idx").on(
      t.subscriptionId,
    ),
  }),
);

export type SubscriptionPayment = typeof subscriptionPaymentsTable.$inferSelect;
export type InsertSubscriptionPayment =
  typeof subscriptionPaymentsTable.$inferInsert;
