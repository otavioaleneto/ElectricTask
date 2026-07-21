import { db, activityLogTable } from "@workspace/db";

export type ActivityAction =
  | "created"
  | "moved"
  | "completed"
  | "reopened"
  | "assignee_changed"
  | "due_changed"
  | "timer_started"
  | "timer_paused"
  | "timer_finished";

export type DbExecutor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

type Executor = DbExecutor;

export async function logActivity(
  exec: Executor,
  taskId: number,
  userId: number,
  action: ActivityAction,
  detail: string | null = null,
): Promise<void> {
  await exec.insert(activityLogTable).values({ taskId, userId, action, detail });
}
