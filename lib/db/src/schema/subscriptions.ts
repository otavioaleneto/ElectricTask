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
import { paymentMethodsTable } from "./paymentMethods";

export const subscriptionsTable = pgTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    createdBy: integer("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    companySlug: text("company_slug"),
    customName: text("custom_name"),
    customColor: text("custom_color"),
    category: text("category").notNull().default("other"),
    amountCents: integer("amount_cents").notNull().default(0),
    currency: text("currency").notNull().default("BRL"),
    billingCycle: text("billing_cycle").notNull().default("monthly"),
    customCycleDays: integer("custom_cycle_days"),
    nextDueDate: text("next_due_date").notNull(),
    reminderDaysBefore: integer("reminder_days_before").notNull().default(7),
    paymentType: text("payment_type").notNull().default("manual"),
    paymentMethodId: integer("payment_method_id").references(
      () => paymentMethodsTable.id,
      { onDelete: "set null" },
    ),
    status: text("status").notNull().default("active"),
    website: text("website"),
    username: text("username"),
    credentialCiphertext: text("credential_ciphertext"),
    notes: text("notes"),
    lastPaidAt: timestamp("last_paid_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    byWorkspace: index("subscriptions_workspace_idx").on(t.workspaceId),
  }),
);

export type Subscription = typeof subscriptionsTable.$inferSelect;
export type InsertSubscription = typeof subscriptionsTable.$inferInsert;
