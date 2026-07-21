import { Router, type IRouter, type Response } from "express";
import {
  db,
  timeEntriesTable,
  tasksTable,
  usersTable,
  projectsTable,
  insertIgnoreReturning,
} from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { StopTimerBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { parseBody } from "../lib/validate";
import { logActivity } from "../lib/activity";
import { clearDueSoonForTask } from "../lib/notifications";
import {
  getTaskForUser,
  requireTaskWrite,
  getProjectForUser,
  getAccessibleWorkspaceIds,
} from "../lib/access";

const router: IRouter = Router();

router.use(requireAuth);

async function computeTimerState(taskId: number, userId: number) {
  // totalSeconds is the task-wide accumulated time across all users; running
  // and startedAt describe only the requesting user's current session.
  const entries = await db
    .select()
    .from(timeEntriesTable)
    .where(eq(timeEntriesTable.taskId, taskId));
  let totalSeconds = 0;
  let running = false;
  let startedAt: string | null = null;
  const now = Date.now();
  for (const e of entries) {
    if (e.endedAt) {
      totalSeconds += e.durationSeconds ?? 0;
    } else {
      totalSeconds += Math.max(
        0,
        Math.round((now - e.startedAt.getTime()) / 1000),
      );
      if (e.userId === userId) {
        running = true;
        startedAt = e.startedAt.toISOString();
      }
    }
  }
  return { running, startedAt, totalSeconds };
}

router.get(
  "/tasks/:taskId/timer",
  async (req: AuthRequest, res: Response) => {
    const task = await getTaskForUser(req.user!, Number(req.params.taskId));
    if (!task) {
      res.status(404).json({ error: "Tarefa não encontrada" });
      return;
    }
    const state = await computeTimerState(task.id, req.user!.id);
    res.status(200).json(state);
  },
);

router.post(
  "/tasks/:taskId/timer/start",
  async (req: AuthRequest, res: Response) => {
    const task = await getTaskForUser(req.user!, Number(req.params.taskId));
    if (!task) {
      res.status(404).json({ error: "Tarefa não encontrada" });
      return;
    }
    if (!(await requireTaskWrite(req.user!, task.id, res))) return;
    const userId = req.user!.id;
    await db.transaction(async (tx) => {
      const inserted = await insertIgnoreReturning(
        tx,
        timeEntriesTable,
        { taskId: task.id, userId, startedAt: new Date() },
        {
          target: [timeEntriesTable.taskId, timeEntriesTable.userId],
          where: isNull(timeEntriesTable.endedAt),
        },
      );
      if (inserted.length > 0) {
        await logActivity(tx, task.id, userId, "timer_started");
      }
    });
    const state = await computeTimerState(task.id, userId);
    res.status(200).json(state);
  },
);

router.post(
  "/tasks/:taskId/timer/stop",
  async (req: AuthRequest, res: Response) => {
    const task = await getTaskForUser(req.user!, Number(req.params.taskId));
    if (!task) {
      res.status(404).json({ error: "Tarefa não encontrada" });
      return;
    }
    if (!(await requireTaskWrite(req.user!, task.id, res))) return;
    const body = parseBody(StopTimerBody, req.body, res);
    if (!body) return;
    const userId = req.user!.id;
    const openEntries = await db
      .select()
      .from(timeEntriesTable)
      .where(
        and(
          eq(timeEntriesTable.taskId, task.id),
          eq(timeEntriesTable.userId, userId),
          isNull(timeEntriesTable.endedAt),
        ),
      );
    if (openEntries.length === 0) {
      res.status(400).json({ error: "Nenhum cronômetro em andamento" });
      return;
    }
    const now = new Date();
    let totalDuration = 0;
    await db.transaction(async (tx) => {
      for (const entry of openEntries) {
        const duration = Math.max(
          0,
          Math.round((now.getTime() - entry.startedAt.getTime()) / 1000),
        );
        totalDuration += duration;
        await tx
          .update(timeEntriesTable)
          .set({ endedAt: now, durationSeconds: duration })
          .where(eq(timeEntriesTable.id, entry.id));
      }
      await logActivity(
        tx,
        task.id,
        userId,
        body.finished ? "timer_finished" : "timer_paused",
        String(totalDuration),
      );
      if (body.finished && !task.completed) {
        await tx
          .update(tasksTable)
          .set({ completed: true })
          .where(eq(tasksTable.id, task.id));
        await logActivity(tx, task.id, userId, "completed");
        await clearDueSoonForTask(tx, task.id);
      }
    });
    const state = await computeTimerState(task.id, userId);
    res.status(200).json(state);
  },
);

router.get("/timers/active", async (req: AuthRequest, res: Response) => {
  const rows = await db
    .select({
      taskId: timeEntriesTable.taskId,
      taskTitle: tasksTable.title,
      projectId: tasksTable.projectId,
      projectName: projectsTable.name,
      workspaceId: projectsTable.workspaceId,
      startedAt: timeEntriesTable.startedAt,
    })
    .from(timeEntriesTable)
    .innerJoin(tasksTable, eq(timeEntriesTable.taskId, tasksTable.id))
    .innerJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .where(
      and(
        eq(timeEntriesTable.userId, req.user!.id),
        isNull(timeEntriesTable.endedAt),
      ),
    );
  const accessibleIds = new Set(await getAccessibleWorkspaceIds(req.user!));
  res.status(200).json(
    rows
      .filter((r) => accessibleIds.has(r.workspaceId))
      .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
      .map((r) => ({
        taskId: r.taskId,
        taskTitle: r.taskTitle,
        projectId: r.projectId,
        projectName: r.projectName,
        workspaceId: r.workspaceId,
        startedAt: r.startedAt.toISOString(),
      })),
  );
});

router.get(
  "/projects/:projectId/time-summary",
  async (req: AuthRequest, res: Response) => {
    const project = await getProjectForUser(
      req.user!,
      Number(req.params.projectId),
    );
    if (!project) {
      res.status(404).json({ error: "Projeto não encontrado" });
      return;
    }

    const rows = await db
      .select({
        taskId: timeEntriesTable.taskId,
        taskTitle: tasksTable.title,
        userId: timeEntriesTable.userId,
        userName: usersTable.name,
        userAvatar: usersTable.avatarUrl,
        startedAt: timeEntriesTable.startedAt,
        endedAt: timeEntriesTable.endedAt,
        durationSeconds: timeEntriesTable.durationSeconds,
      })
      .from(timeEntriesTable)
      .innerJoin(tasksTable, eq(timeEntriesTable.taskId, tasksTable.id))
      .innerJoin(usersTable, eq(timeEntriesTable.userId, usersTable.id))
      .where(eq(tasksTable.projectId, project.id));

    const now = Date.now();
    const secondsFor = (row: (typeof rows)[number]) =>
      row.endedAt
        ? (row.durationSeconds ?? 0)
        : Math.max(0, Math.round((now - row.startedAt.getTime()) / 1000));

    const taskMap = new Map<
      number,
      { taskId: number; title: string; totalSeconds: number }
    >();
    const memberMap = new Map<
      number,
      {
        userId: number;
        name: string;
        avatarUrl: string | null;
        totalSeconds: number;
      }
    >();
    let totalSeconds = 0;

    for (const row of rows) {
      const seconds = secondsFor(row);
      totalSeconds += seconds;

      const task = taskMap.get(row.taskId);
      if (task) {
        task.totalSeconds += seconds;
      } else {
        taskMap.set(row.taskId, {
          taskId: row.taskId,
          title: row.taskTitle,
          totalSeconds: seconds,
        });
      }

      const member = memberMap.get(row.userId);
      if (member) {
        member.totalSeconds += seconds;
      } else {
        memberMap.set(row.userId, {
          userId: row.userId,
          name: row.userName,
          avatarUrl: row.userAvatar,
          totalSeconds: seconds,
        });
      }
    }

    const tasks = Array.from(taskMap.values()).sort(
      (a, b) => b.totalSeconds - a.totalSeconds,
    );
    const members = Array.from(memberMap.values()).sort(
      (a, b) => b.totalSeconds - a.totalSeconds,
    );

    res.status(200).json({ totalSeconds, tasks, members });
  },
);

export default router;
