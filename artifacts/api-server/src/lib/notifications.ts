import {
  db,
  notificationsTable,
  tasksTable,
  projectsTable,
  subscriptionsTable,
  insertIgnore,
  type User,
} from "@workspace/db";
import { and, eq, isNotNull, inArray, sql } from "drizzle-orm";
import type { DbExecutor } from "./activity";
import { getAccessibleWorkspaceIds } from "./access";
import { daysUntil } from "./subscriptions";

export type NotificationType =
  | "assigned"
  | "mentioned"
  | "due_soon"
  | "subscription_due"
  | "subscription_overdue";

export async function createNotification(
  exec: DbExecutor,
  input: {
    userId: number;
    type: NotificationType;
    taskId: number;
    actorId?: number | null;
  },
): Promise<void> {
  await exec.insert(notificationsTable).values({
    userId: input.userId,
    type: input.type,
    taskId: input.taskId,
    actorId: input.actorId ?? null,
  });
}

export async function clearDueSoonForTask(
  exec: DbExecutor,
  taskId: number,
): Promise<void> {
  await exec
    .delete(notificationsTable)
    .where(
      and(
        eq(notificationsTable.taskId, taskId),
        eq(notificationsTable.type, "due_soon"),
      ),
    );
}

const pad = (n: number) => String(n).padStart(2, "0");

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Lazily create "due_soon" notifications for tasks assigned to the user that are
// due within the next 2 days. Idempotent via the partial unique index on
// (user_id, task_id) where type = 'due_soon' + ON CONFLICT DO NOTHING.
export async function ensureDueSoonNotifications(user: User): Promise<void> {
  const workspaceIds = await getAccessibleWorkspaceIds(user);
  if (workspaceIds.length === 0) return;

  const now = new Date();
  const today = dateKey(now);
  const plus = new Date(now);
  plus.setDate(plus.getDate() + 2);
  const limit = dateKey(plus);
  const dueCol = sql`substring(${tasksTable.dueDate}, 1, 10)`;

  const candidates = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .innerJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .where(
      and(
        eq(tasksTable.assigneeId, user.id),
        eq(tasksTable.completed, false),
        isNotNull(tasksTable.dueDate),
        sql`${dueCol} >= ${today}`,
        sql`${dueCol} <= ${limit}`,
        inArray(projectsTable.workspaceId, workspaceIds),
      ),
    );
  if (candidates.length === 0) return;

  await insertIgnore(
    db,
    notificationsTable,
    candidates.map((t) => ({
      userId: user.id,
      type: "due_soon" as const,
      taskId: t.id,
      actorId: null,
    })),
  );
}

// Lazily create subscription reminders for the requesting user across all
// accessible workspaces. Active subscriptions due within reminderDaysBefore
// produce "subscription_due"; past-due ones produce "subscription_overdue".
// Idempotent via the partial unique indexes + ON CONFLICT DO NOTHING.
export async function ensureSubscriptionNotifications(
  user: User,
): Promise<void> {
  const workspaceIds = await getAccessibleWorkspaceIds(user);
  if (workspaceIds.length === 0) return;

  const subs = await db
    .select({
      id: subscriptionsTable.id,
      nextDueDate: subscriptionsTable.nextDueDate,
      reminderDaysBefore: subscriptionsTable.reminderDaysBefore,
    })
    .from(subscriptionsTable)
    .where(
      and(
        inArray(subscriptionsTable.workspaceId, workspaceIds),
        eq(subscriptionsTable.status, "active"),
      ),
    );
  if (subs.length === 0) return;

  const dueSoon: { userId: number; type: "subscription_due"; subscriptionId: number; actorId: null }[] = [];
  const overdue: { userId: number; type: "subscription_overdue"; subscriptionId: number; actorId: null }[] = [];
  for (const s of subs) {
    const d = daysUntil(s.nextDueDate);
    if (d < 0) {
      overdue.push({
        userId: user.id,
        type: "subscription_overdue",
        subscriptionId: s.id,
        actorId: null,
      });
    } else if (d <= s.reminderDaysBefore) {
      dueSoon.push({
        userId: user.id,
        type: "subscription_due",
        subscriptionId: s.id,
        actorId: null,
      });
    }
  }

  if (dueSoon.length > 0) {
    await insertIgnore(db, notificationsTable, dueSoon);
  }
  if (overdue.length > 0) {
    await insertIgnore(db, notificationsTable, overdue);
  }
}

export async function clearSubscriptionNotifications(
  exec: DbExecutor,
  subscriptionId: number,
): Promise<void> {
  await exec
    .delete(notificationsTable)
    .where(
      and(
        eq(notificationsTable.subscriptionId, subscriptionId),
        inArray(notificationsTable.type, [
          "subscription_due",
          "subscription_overdue",
        ]),
      ),
    );
}
