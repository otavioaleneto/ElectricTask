// MySQL mirror of lib/db/src/schema (the canonical, Postgres-typed schema).
// Table and column names MUST stay identical to the pg-core schema. Types come
// exclusively from the pg schema; this module is only used at runtime when
// DATABASE_URL points at MySQL/MariaDB, and by drizzle-mysql.config.ts to
// export schema.mysql.sql.
//
// Dialect translation rules (keep in sync when editing the pg schema):
// - serial -> int().autoincrement()
// - timestamp.defaultNow() -> datetime(fsp 3) DEFAULT CURRENT_TIMESTAMP(3)
//   (never MySQL TIMESTAMP: implicit ON UPDATE semantics + 2038 limit)
// - jsonb -> custom "json" type that JSON.parses strings (MariaDB returns
//   LONGTEXT for JSON columns)
// - text columns that are indexed OR have a literal default -> varchar
//   (MySQL cannot index TEXT without a prefix nor give TEXT a default)
// - partial unique indexes (unsupported in MySQL) -> STORED generated key
//   columns + plain unique indexes (NULLs never collide)
import {
  mysqlTable,
  text,
  varchar,
  int,
  boolean,
  datetime,
  index,
  unique,
  uniqueIndex,
  customType,
  type AnyMySqlColumn,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import type {
  LinkTargetType,
  MindmapDataShape,
  RecurrenceChecklistShape,
} from "../schema";

// MariaDB stores JSON as LONGTEXT and returns strings; MySQL returns objects.
const json = <TData>(name: string) =>
  customType<{ data: TData; driverData: unknown }>({
    dataType: () => "json",
    toDriver: (value) => JSON.stringify(value),
    fromDriver: (value): TData =>
      typeof value === "string" ? (JSON.parse(value) as TData) : (value as TData),
  })(name);

const createdTs = (name: string) =>
  datetime(name, { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`);

// ----- users -----
export const usersTable = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 191 }).notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 32 }).notNull().default("user"),
  avatarUrl: text("avatar_url"),
  theme: varchar("theme", { length: 32 }).notNull().default("dark"),
  securityQuestion1: text("security_question_1"),
  securityQuestion2: text("security_question_2"),
  securityQuestion3: text("security_question_3"),
  securityAnswerHash1: text("security_answer_hash_1"),
  securityAnswerHash2: text("security_answer_hash_2"),
  securityAnswerHash3: text("security_answer_hash_3"),
  createdAt: createdTs("created_at"),
});

// ----- workspaces -----
export const workspacesTable = mysqlTable("workspaces", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("owner_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  color: varchar("color", { length: 32 }).notNull().default("#3b82f6"),
  createdAt: createdTs("created_at"),
});

// ----- workspace_members -----
export const workspaceMembersTable = mysqlTable(
  "workspace_members",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    userId: int("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 32 }).notNull().default("editor"),
    createdAt: createdTs("created_at"),
  },
  (t) => ({
    uniqueMember: unique().on(t.workspaceId, t.userId),
  }),
);

// ----- projects -----
export const projectsTable = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  type: varchar("type", { length: 32 }).notNull().default("social"),
  coverImageUrl: text("cover_image_url"),
  platform: varchar("platform", { length: 64 }).notNull().default("generic"),
  accentColor: varchar("accent_color", { length: 32 })
    .notNull()
    .default("#3b82f6"),
  position: int("position").notNull().default(0),
  createdAt: createdTs("created_at"),
});

// ----- project_views -----
export const projectViewsTable = mysqlTable(
  "project_views",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    projectId: int("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    lastViewedAt: createdTs("last_viewed_at"),
  },
  (t) => ({
    userProjectUnique: uniqueIndex("project_views_user_project_unique").on(
      t.userId,
      t.projectId,
    ),
  }),
);

// ----- columns -----
export const columnsTable = mysqlTable("columns", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: int("position").notNull().default(0),
  color: varchar("color", { length: 32 }).notNull().default("#3b82f6"),
  isDone: boolean("is_done").notNull().default(false),
});

// ----- tasks -----
export const tasksTable = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  columnId: int("column_id")
    .notNull()
    .references(() => columnsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  type: varchar("type", { length: 32 }).notNull().default("standard"),
  priority: varchar("priority", { length: 32 }).notNull().default("medium"),
  dueDate: varchar("due_date", { length: 64 }),
  position: int("position").notNull().default(0),
  mindmapId: int("mindmap_id"),
  assigneeId: int("assignee_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  completed: boolean("completed").notNull().default(false),
  completedAt: datetime("completed_at", { fsp: 3 }),
  createdAt: createdTs("created_at"),
});

// ----- labels -----
export const labelsTable = mysqlTable("labels", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: varchar("color", { length: 32 }).notNull().default("#3b82f6"),
  createdAt: createdTs("created_at"),
});

// ----- task_labels -----
export const taskLabelsTable = mysqlTable(
  "task_labels",
  {
    id: int("id").autoincrement().primaryKey(),
    taskId: int("task_id")
      .notNull()
      .references(() => tasksTable.id, { onDelete: "cascade" }),
    labelId: int("label_id")
      .notNull()
      .references(() => labelsTable.id, { onDelete: "cascade" }),
  },
  (t) => ({
    uniqTaskLabel: unique().on(t.taskId, t.labelId),
  }),
);

// ----- task_video_links -----
export const taskVideoLinksTable = mysqlTable("task_video_links", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("task_id")
    .notNull()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  label: text("label"),
  position: int("position").notNull().default(0),
  createdAt: createdTs("created_at"),
});

// ----- time_entries -----
export const timeEntriesTable = mysqlTable(
  "time_entries",
  {
    id: int("id").autoincrement().primaryKey(),
    taskId: int("task_id")
      .notNull()
      .references(() => tasksTable.id, { onDelete: "cascade" }),
    userId: int("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    startedAt: createdTs("started_at"),
    endedAt: datetime("ended_at", { fsp: 3 }),
    durationSeconds: int("duration_seconds"),
    createdAt: createdTs("created_at"),
    // Partial-unique-index workaround: unique "one running entry per
    // user+task" key that is NULL once the entry has ended.
    runningKey: varchar("running_key", { length: 64 }).generatedAlwaysAs(
      sql`(case when \`ended_at\` is null then concat(\`task_id\`, ':', \`user_id\`) end)`,
      { mode: "stored" },
    ),
  },
  (t) => [
    uniqueIndex("time_entries_one_running_per_user_task").on(t.runningKey),
  ],
);

// ----- checklists -----
export const checklistsTable = mysqlTable("checklists", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("task_id")
    .notNull()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  position: int("position").notNull().default(0),
});

// ----- checklist_items -----
export const checklistItemsTable = mysqlTable("checklist_items", {
  id: int("id").autoincrement().primaryKey(),
  checklistId: int("checklist_id")
    .notNull()
    .references(() => checklistsTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  done: boolean("done").notNull().default(false),
  position: int("position").notNull().default(0),
});

// ----- task_attachments -----
export const taskAttachmentsTable = mysqlTable("task_attachments", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("task_id")
    .notNull()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  contentType: text("content_type").notNull(),
  size: int("size").notNull(),
  objectPath: text("object_path").notNull(),
  uploadedBy: int("uploaded_by").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  createdAt: createdTs("created_at"),
});

// ----- mindmaps -----
export const mindmapsTable = mysqlTable("mindmaps", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // No DDL default: MySQL/MariaDB cannot reliably default JSON columns.
  // Application code always provides data on insert.
  data: json<MindmapDataShape>("data").notNull(),
  taskId: int("task_id"),
  parentId: int("parent_id").references(
    (): AnyMySqlColumn => mindmapsTable.id,
    { onDelete: "set null" },
  ),
  createdAt: createdTs("created_at"),
});

// ----- notes -----
export const notesTable = mysqlTable(
  "notes",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // No DDL default (TEXT cannot default in MySQL); inserts always provide
    // content (enforced by the shared insert helpers/call sites).
    content: text("content").notNull(),
    isLocked: boolean("is_locked").notNull().default(false),
    createdAt: createdTs("created_at"),
    updatedAt: createdTs("updated_at"),
  },
  (t) => ({
    byWorkspace: index("notes_workspace_idx").on(t.workspaceId),
  }),
);

// ----- item_links -----
export const itemLinksTable = mysqlTable(
  "item_links",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    sourceNoteId: int("source_note_id")
      .notNull()
      .references(() => notesTable.id, { onDelete: "cascade" }),
    targetType: varchar("target_type", { length: 32 })
      .notNull()
      .$type<LinkTargetType>(),
    targetId: int("target_id").notNull(),
  },
  (t) => ({
    uniqSourceTarget: uniqueIndex("item_links_source_target_uniq").on(
      t.sourceNoteId,
      t.targetType,
      t.targetId,
    ),
    byWorkspace: index("item_links_workspace_idx").on(t.workspaceId),
    byTarget: index("item_links_target_idx").on(
      t.workspaceId,
      t.targetType,
      t.targetId,
    ),
  }),
);

// ----- comments -----
export const commentsTable = mysqlTable("comments", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("task_id")
    .notNull()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  userId: int("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: createdTs("created_at"),
});

// ----- comment_mentions -----
export const commentMentionsTable = mysqlTable(
  "comment_mentions",
  {
    id: int("id").autoincrement().primaryKey(),
    commentId: int("comment_id")
      .notNull()
      .references(() => commentsTable.id, { onDelete: "cascade" }),
    userId: int("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
  },
  (t) => ({
    uniqCommentUser: unique().on(t.commentId, t.userId),
  }),
);

// ----- activity_log -----
export const activityLogTable = mysqlTable("activity_log", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("task_id")
    .notNull()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  userId: int("user_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  action: text("action").notNull(),
  detail: text("detail"),
  createdAt: createdTs("created_at"),
});

// ----- payment_methods -----
export const paymentMethodsTable = mysqlTable(
  "payment_methods",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdBy: int("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: createdTs("created_at"),
  },
  (t) => ({
    byWorkspace: index("payment_methods_workspace_idx").on(t.workspaceId),
  }),
);

// ----- subscription_categories -----
export const subscriptionCategoriesTable = mysqlTable(
  "subscription_categories",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 191 }).notNull(),
    label: text("label").notNull(),
    createdBy: int("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: createdTs("created_at"),
    updatedAt: createdTs("updated_at"),
  },
  (t) => ({
    byWorkspaceKey: uniqueIndex("subscription_categories_workspace_key_idx").on(
      t.workspaceId,
      t.key,
    ),
  }),
);

// ----- subscriptions -----
export const subscriptionsTable = mysqlTable(
  "subscriptions",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    createdBy: int("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    companySlug: text("company_slug"),
    customName: text("custom_name"),
    customColor: text("custom_color"),
    category: varchar("category", { length: 191 }).notNull().default("other"),
    amountCents: int("amount_cents").notNull().default(0),
    currency: varchar("currency", { length: 8 }).notNull().default("BRL"),
    billingCycle: varchar("billing_cycle", { length: 32 })
      .notNull()
      .default("monthly"),
    customCycleDays: int("custom_cycle_days"),
    nextDueDate: varchar("next_due_date", { length: 64 }).notNull(),
    reminderDaysBefore: int("reminder_days_before").notNull().default(7),
    paymentType: varchar("payment_type", { length: 32 })
      .notNull()
      .default("manual"),
    paymentMethodId: int("payment_method_id").references(
      () => paymentMethodsTable.id,
      { onDelete: "set null" },
    ),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    website: text("website"),
    username: text("username"),
    credentialCiphertext: text("credential_ciphertext"),
    notes: text("notes"),
    lastPaidAt: datetime("last_paid_at", { fsp: 3 }),
    createdAt: createdTs("created_at"),
    updatedAt: createdTs("updated_at"),
  },
  (t) => ({
    byWorkspace: index("subscriptions_workspace_idx").on(t.workspaceId),
  }),
);

// ----- subscription_payments -----
export const subscriptionPaymentsTable = mysqlTable(
  "subscription_payments",
  {
    id: int("id").autoincrement().primaryKey(),
    subscriptionId: int("subscription_id")
      .notNull()
      .references(() => subscriptionsTable.id, { onDelete: "cascade" }),
    workspaceId: int("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    amountCents: int("amount_cents").notNull(),
    currency: varchar("currency", { length: 8 }).notNull(),
    dueDate: varchar("due_date", { length: 64 }).notNull(),
    paidBy: int("paid_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    paidAt: createdTs("paid_at"),
    createdAt: createdTs("created_at"),
  },
  (t) => ({
    bySubscription: index("subscription_payments_subscription_idx").on(
      t.subscriptionId,
    ),
  }),
);

// ----- recurring_templates -----
export const recurringTemplatesTable = mysqlTable("recurring_templates", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  columnId: int("column_id")
    .notNull()
    .references(() => columnsTable.id, { onDelete: "cascade" }),
  createdBy: int("created_by").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  type: varchar("type", { length: 32 }).notNull().default("standard"),
  priority: varchar("priority", { length: 32 }).notNull().default("medium"),
  assigneeId: int("assignee_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  // No DDL default: MySQL/MariaDB cannot reliably default JSON columns.
  // Application code always provides values on insert.
  labelIds: json<number[]>("label_ids").notNull(),
  checklist: json<RecurrenceChecklistShape>("checklist").notNull(),
  frequency: varchar("frequency", { length: 32 }).notNull(),
  timeOfDay: varchar("time_of_day", { length: 16 }),
  dayOfWeek: int("day_of_week"),
  dayOfMonth: int("day_of_month"),
  active: boolean("active").notNull().default(true),
  nextRunAt: datetime("next_run_at", { fsp: 3 }).notNull(),
  lastRunAt: datetime("last_run_at", { fsp: 3 }),
  createdAt: createdTs("created_at"),
});

// ----- task_subscriptions -----
export const taskSubscriptionsTable = mysqlTable(
  "task_subscriptions",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    taskId: int("task_id")
      .notNull()
      .references(() => tasksTable.id, { onDelete: "cascade" }),
    subscriptionId: int("subscription_id")
      .notNull()
      .references(() => subscriptionsTable.id, { onDelete: "cascade" }),
    createdAt: createdTs("created_at"),
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

// ----- notifications -----
export const notificationsTable = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 32 }).notNull(),
    taskId: int("task_id").references(() => tasksTable.id, {
      onDelete: "cascade",
    }),
    subscriptionId: int("subscription_id").references(
      () => subscriptionsTable.id,
      { onDelete: "cascade" },
    ),
    actorId: int("actor_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    read: boolean("read").notNull().default(false),
    createdAt: createdTs("created_at"),
    // Partial-unique-index workarounds (see header comment).
    dueSoonKey: varchar("due_soon_key", { length: 64 }).generatedAlwaysAs(
      sql`(case when \`type\` = 'due_soon' then concat(\`user_id\`, ':', \`task_id\`) end)`,
      { mode: "stored" },
    ),
    subscriptionDueKey: varchar("subscription_due_key", {
      length: 64,
    }).generatedAlwaysAs(
      sql`(case when \`type\` = 'subscription_due' then concat(\`user_id\`, ':', \`subscription_id\`) end)`,
      { mode: "stored" },
    ),
    subscriptionOverdueKey: varchar("subscription_overdue_key", {
      length: 64,
    }).generatedAlwaysAs(
      sql`(case when \`type\` = 'subscription_overdue' then concat(\`user_id\`, ':', \`subscription_id\`) end)`,
      { mode: "stored" },
    ),
  },
  (t) => ({
    userInboxIdx: index("notifications_user_inbox_idx").on(
      t.userId,
      t.read,
      t.createdAt,
    ),
    dueSoonUnique: uniqueIndex("notifications_due_soon_unique").on(
      t.dueSoonKey,
    ),
    subscriptionDueUnique: uniqueIndex(
      "notifications_subscription_due_unique",
    ).on(t.subscriptionDueKey),
    subscriptionOverdueUnique: uniqueIndex(
      "notifications_subscription_overdue_unique",
    ).on(t.subscriptionOverdueKey),
  }),
);
