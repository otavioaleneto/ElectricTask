import { Router, type IRouter, type Response } from "express";
import {
  db,
  tasksTable,
  columnsTable,
  checklistsTable,
  checklistItemsTable,
  usersTable,
  labelsTable,
  taskLabelsTable,
  taskVideoLinksTable,
  activityLogTable,
  insertReturning,
  updateReturning,
  type Label,
  type TaskVideoLink,
} from "@workspace/db";
import {
  eq,
  and,
  inArray,
  asc,
  desc,
  sql,
  isNull,
  isNotNull,
} from "drizzle-orm";
import { CreateTaskBody, UpdateTaskBody, MoveTaskBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { parseBody } from "../lib/validate";
import { toTask, toActivity } from "../lib/serialize";
import { logActivity, type DbExecutor } from "../lib/activity";
import { createNotification, clearDueSoonForTask } from "../lib/notifications";
import {
  getProjectForUser,
  getTaskForUser,
  getColumnForUser,
  requireProjectWrite,
  isWorkspaceMemberUser,
} from "../lib/access";

const router: IRouter = Router();

router.use(requireAuth);

async function checklistCounts(taskIds: number[]) {
  const total = new Map<number, number>();
  const done = new Map<number, number>();
  if (taskIds.length === 0) return { total, done };
  const items = await db
    .select({
      taskId: checklistsTable.taskId,
      done: checklistItemsTable.done,
    })
    .from(checklistItemsTable)
    .innerJoin(
      checklistsTable,
      eq(checklistItemsTable.checklistId, checklistsTable.id),
    )
    .where(inArray(checklistsTable.taskId, taskIds));
  for (const i of items) {
    total.set(i.taskId, (total.get(i.taskId) ?? 0) + 1);
    if (i.done) done.set(i.taskId, (done.get(i.taskId) ?? 0) + 1);
  }
  return { total, done };
}

type AssigneeInfo = { id: number; name: string; avatarUrl: string | null };

async function assigneeMap(
  assigneeIds: (number | null)[],
): Promise<Map<number, AssigneeInfo>> {
  const map = new Map<number, AssigneeInfo>();
  const ids = Array.from(
    new Set(assigneeIds.filter((id): id is number => id != null)),
  );
  if (ids.length === 0) return map;
  const rows = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(usersTable)
    .where(inArray(usersTable.id, ids));
  for (const r of rows) {
    map.set(r.id, { id: r.id, name: r.name, avatarUrl: r.avatarUrl ?? null });
  }
  return map;
}

function pickAssignee(
  map: Map<number, AssigneeInfo>,
  assigneeId: number | null,
): AssigneeInfo | null {
  return assigneeId != null ? (map.get(assigneeId) ?? null) : null;
}

async function labelsByTask(taskIds: number[]): Promise<Map<number, Label[]>> {
  const map = new Map<number, Label[]>();
  if (taskIds.length === 0) return map;
  const rows = await db
    .select({
      taskId: taskLabelsTable.taskId,
      id: labelsTable.id,
      projectId: labelsTable.projectId,
      name: labelsTable.name,
      color: labelsTable.color,
      createdAt: labelsTable.createdAt,
    })
    .from(taskLabelsTable)
    .innerJoin(labelsTable, eq(taskLabelsTable.labelId, labelsTable.id))
    .where(inArray(taskLabelsTable.taskId, taskIds))
    .orderBy(asc(labelsTable.name), asc(labelsTable.id));
  for (const { taskId, ...label } of rows) {
    const list = map.get(taskId) ?? [];
    list.push(label);
    map.set(taskId, list);
  }
  return map;
}

async function videoLinksByTask(
  taskIds: number[],
): Promise<Map<number, TaskVideoLink[]>> {
  const map = new Map<number, TaskVideoLink[]>();
  if (taskIds.length === 0) return map;
  const rows = await db
    .select()
    .from(taskVideoLinksTable)
    .where(inArray(taskVideoLinksTable.taskId, taskIds))
    .orderBy(asc(taskVideoLinksTable.position), asc(taskVideoLinksTable.id));
  for (const r of rows) {
    const list = map.get(r.taskId) ?? [];
    list.push(r);
    map.set(r.taskId, list);
  }
  return map;
}

async function labelsValidForProject(
  projectId: number,
  labelIds: number[],
): Promise<boolean> {
  const unique = Array.from(new Set(labelIds));
  if (unique.length === 0) return true;
  const rows = await db
    .select({ id: labelsTable.id })
    .from(labelsTable)
    .where(
      and(inArray(labelsTable.id, unique), eq(labelsTable.projectId, projectId)),
    );
  return rows.length === unique.length;
}

async function replaceTaskLabels(
  exec: DbExecutor,
  taskId: number,
  labelIds: number[],
) {
  await exec.delete(taskLabelsTable).where(eq(taskLabelsTable.taskId, taskId));
  const unique = Array.from(new Set(labelIds));
  if (unique.length > 0) {
    await exec
      .insert(taskLabelsTable)
      .values(unique.map((labelId) => ({ taskId, labelId })));
  }
}

router.get(
  "/projects/:projectId/tasks",
  async (req: AuthRequest, res: Response) => {
    const project = await getProjectForUser(
      req.user!,
      Number(req.params.projectId),
    );
    if (!project) {
      res.status(404).json({ error: "Projeto não encontrado" });
      return;
    }
    const conditions = [eq(tasksTable.projectId, project.id)];

    const assigneeIdRaw = req.query.assigneeId;
    if (assigneeIdRaw !== undefined) {
      const assigneeId = Number(assigneeIdRaw);
      if (Number.isFinite(assigneeId)) {
        conditions.push(eq(tasksTable.assigneeId, assigneeId));
      }
    }

    const priorityRaw = req.query.priority;
    if (typeof priorityRaw === "string" && priorityRaw) {
      conditions.push(eq(tasksTable.priority, priorityRaw));
    }

    const dueRaw = req.query.due;
    if (dueRaw === "none") {
      conditions.push(isNull(tasksTable.dueDate));
    } else if (dueRaw === "overdue" || dueRaw === "next7") {
      const pad = (n: number) => String(n).padStart(2, "0");
      const now = new Date();
      const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
        now.getDate(),
      )}`;
      const dueCol = sql`substring(${tasksTable.dueDate}, 1, 10)`;
      conditions.push(isNotNull(tasksTable.dueDate));
      if (dueRaw === "overdue") {
        conditions.push(sql`${dueCol} < ${today}`);
      } else {
        const plus = new Date(now);
        plus.setDate(plus.getDate() + 7);
        const limit = `${plus.getFullYear()}-${pad(plus.getMonth() + 1)}-${pad(
          plus.getDate(),
        )}`;
        conditions.push(sql`${dueCol} >= ${today} and ${dueCol} <= ${limit}`);
      }
    }

    const labelIdRaw = req.query.labelId;
    if (labelIdRaw !== undefined) {
      const labelId = Number(labelIdRaw);
      if (Number.isFinite(labelId)) {
        const labeled = await db
          .select({ taskId: taskLabelsTable.taskId })
          .from(taskLabelsTable)
          .where(eq(taskLabelsTable.labelId, labelId));
        const ids = labeled.map((r) => r.taskId);
        conditions.push(inArray(tasksTable.id, ids.length > 0 ? ids : [-1]));
      }
    }

    const tasks = await db
      .select()
      .from(tasksTable)
      .where(and(...conditions))
      .orderBy(asc(tasksTable.position), asc(tasksTable.id));
    const { total, done } = await checklistCounts(tasks.map((t) => t.id));
    const aMap = await assigneeMap(tasks.map((t) => t.assigneeId));
    const lMap = await labelsByTask(tasks.map((t) => t.id));
    const vMap = await videoLinksByTask(tasks.map((t) => t.id));
    res
      .status(200)
      .json(
        tasks.map((t) =>
          toTask(
            t,
            total.get(t.id) ?? 0,
            done.get(t.id) ?? 0,
            pickAssignee(aMap, t.assigneeId),
            lMap.get(t.id) ?? [],
            vMap.get(t.id) ?? [],
          ),
        ),
      );
  },
);

router.post(
  "/projects/:projectId/tasks",
  async (req: AuthRequest, res: Response) => {
    const project = await getProjectForUser(
      req.user!,
      Number(req.params.projectId),
    );
    if (!project) {
      res.status(404).json({ error: "Projeto não encontrado" });
      return;
    }
    if (!(await requireProjectWrite(req.user!, project.id, res))) return;
    const body = parseBody(CreateTaskBody, req.body, res);
    if (!body) return;
    const column = await getColumnForUser(req.user!, body.columnId);
    if (!column || column.projectId !== project.id) {
      res.status(400).json({ error: "Coluna inválida" });
      return;
    }
    if (body.assigneeId != null) {
      const ok = await isWorkspaceMemberUser(
        project.workspaceId,
        body.assigneeId,
      );
      if (!ok) {
        res.status(400).json({ error: "Responsável inválido" });
        return;
      }
    }
    if (body.labelIds && body.labelIds.length > 0) {
      if (!(await labelsValidForProject(project.id, body.labelIds))) {
        res.status(400).json({ error: "Etiqueta inválida" });
        return;
      }
    }
    const task = await db.transaction(async (tx) => {
      let position: number;
      if (body.insertAt === "start") {
        await tx
          .update(tasksTable)
          .set({ position: sql`${tasksTable.position} + 1` })
          .where(eq(tasksTable.columnId, body.columnId));
        position = 0;
      } else {
        const [{ max }] = await tx
          .select({ max: sql<number>`coalesce(max(${tasksTable.position}), -1)` })
          .from(tasksTable)
          .where(eq(tasksTable.columnId, body.columnId));
        position = Number(max) + 1;
      }
      const [created] = await insertReturning(tx, tasksTable, {
        projectId: project.id,
        columnId: body.columnId,
        title: body.title,
        description: body.description ?? null,
        type: body.type ?? "standard",
        priority: body.priority ?? "medium",
        dueDate: body.dueDate ?? null,
        assigneeId: body.assigneeId ?? null,
        position,
      });
      if (body.labelIds !== undefined) {
        await replaceTaskLabels(tx, created.id, body.labelIds);
      }
      await logActivity(tx, created.id, req.user!.id, "created");
      if (created.assigneeId != null && created.assigneeId !== req.user!.id) {
        await createNotification(tx, {
          userId: created.assigneeId,
          type: "assigned",
          taskId: created.id,
          actorId: req.user!.id,
        });
      }
      return created;
    });
    const aMap = await assigneeMap([task.assigneeId]);
    const lMap = await labelsByTask([task.id]);
    res
      .status(201)
      .json(
        toTask(
          task,
          0,
          0,
          pickAssignee(aMap, task.assigneeId),
          lMap.get(task.id) ?? [],
        ),
      );
  },
);

router.get("/tasks/:taskId", async (req: AuthRequest, res: Response) => {
  const task = await getTaskForUser(req.user!, Number(req.params.taskId));
  if (!task) {
    res.status(404).json({ error: "Tarefa não encontrada" });
    return;
  }
  const { total, done } = await checklistCounts([task.id]);
  const aMap = await assigneeMap([task.assigneeId]);
  const lMap = await labelsByTask([task.id]);
  const vMap = await videoLinksByTask([task.id]);
  res
    .status(200)
    .json(
      toTask(
        task,
        total.get(task.id) ?? 0,
        done.get(task.id) ?? 0,
        pickAssignee(aMap, task.assigneeId),
        lMap.get(task.id) ?? [],
        vMap.get(task.id) ?? [],
      ),
    );
});

router.patch("/tasks/:taskId", async (req: AuthRequest, res: Response) => {
  const task = await getTaskForUser(req.user!, Number(req.params.taskId));
  if (!task) {
    res.status(404).json({ error: "Tarefa não encontrada" });
    return;
  }
  if (!(await requireProjectWrite(req.user!, task.projectId, res))) return;
  const body = parseBody(UpdateTaskBody, req.body, res);
  if (!body) return;
  let movedColumnName: string | null = null;
  if (body.columnId !== undefined) {
    const column = await getColumnForUser(req.user!, body.columnId);
    if (!column || column.projectId !== task.projectId) {
      res.status(400).json({ error: "Coluna inválida" });
      return;
    }
    movedColumnName = column.name;
  }
  if (body.assigneeId !== undefined && body.assigneeId !== null) {
    const project = await getProjectForUser(req.user!, task.projectId);
    const ok =
      project != null &&
      (await isWorkspaceMemberUser(project.workspaceId, body.assigneeId));
    if (!ok) {
      res.status(400).json({ error: "Responsável inválido" });
      return;
    }
  }
  if (body.labelIds !== undefined && body.labelIds.length > 0) {
    if (!(await labelsValidForProject(task.projectId, body.labelIds))) {
      res.status(400).json({ error: "Etiqueta inválida" });
      return;
    }
  }

  const assigneeChanged =
    body.assigneeId !== undefined && body.assigneeId !== task.assigneeId;
  let assigneeDetail: string | null = null;
  if (assigneeChanged && body.assigneeId != null) {
    const [u] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, body.assigneeId));
    assigneeDetail = u?.name ?? null;
  }

  const updated = await db.transaction(async (tx) => {
    const [row] = await updateReturning(
      tx,
      tasksTable,
      {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
        ...(body.columnId !== undefined ? { columnId: body.columnId } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        ...(body.dueDate !== undefined ? { dueDate: body.dueDate } : {}),
        ...(body.position !== undefined ? { position: body.position } : {}),
        ...(body.mindmapId !== undefined ? { mindmapId: body.mindmapId } : {}),
        ...(body.assigneeId !== undefined
          ? { assigneeId: body.assigneeId }
          : {}),
        ...(body.completed !== undefined ? { completed: body.completed } : {}),
        ...(body.completed !== undefined && body.completed !== task.completed
          ? { completedAt: body.completed ? new Date() : null }
          : {}),
      },
      eq(tasksTable.id, task.id),
    );
    if (body.labelIds !== undefined) {
      await replaceTaskLabels(tx, task.id, body.labelIds);
    }
    const actorId = req.user!.id;
    if (body.completed !== undefined && body.completed !== task.completed) {
      await logActivity(
        tx,
        task.id,
        actorId,
        body.completed ? "completed" : "reopened",
      );
    }
    if (body.columnId !== undefined && body.columnId !== task.columnId) {
      await logActivity(tx, task.id, actorId, "moved", movedColumnName);
    }
    if (assigneeChanged) {
      await logActivity(tx, task.id, actorId, "assignee_changed", assigneeDetail);
    }
    const dueChanged = body.dueDate !== undefined && body.dueDate !== task.dueDate;
    if (dueChanged) {
      await logActivity(tx, task.id, actorId, "due_changed", body.dueDate ?? null);
    }
    if (assigneeChanged && body.assigneeId != null && body.assigneeId !== actorId) {
      await createNotification(tx, {
        userId: body.assigneeId,
        type: "assigned",
        taskId: task.id,
        actorId,
      });
    }
    const completedNow =
      body.completed !== undefined &&
      body.completed !== task.completed &&
      body.completed === true;
    if (assigneeChanged || dueChanged || completedNow) {
      await clearDueSoonForTask(tx, task.id);
    }
    return row;
  });
  const { total, done } = await checklistCounts([task.id]);
  const aMap = await assigneeMap([updated.assigneeId]);
  const lMap = await labelsByTask([task.id]);
  const vMap = await videoLinksByTask([task.id]);
  res
    .status(200)
    .json(
      toTask(
        updated,
        total.get(task.id) ?? 0,
        done.get(task.id) ?? 0,
        pickAssignee(aMap, updated.assigneeId),
        lMap.get(task.id) ?? [],
        vMap.get(task.id) ?? [],
      ),
    );
});

router.delete("/tasks/:taskId", async (req: AuthRequest, res: Response) => {
  const task = await getTaskForUser(req.user!, Number(req.params.taskId));
  if (!task) {
    res.status(404).json({ error: "Tarefa não encontrada" });
    return;
  }
  if (!(await requireProjectWrite(req.user!, task.projectId, res))) return;
  await db.delete(tasksTable).where(eq(tasksTable.id, task.id));
  res.status(204).send();
});

router.post("/tasks/:taskId/move", async (req: AuthRequest, res: Response) => {
  const task = await getTaskForUser(req.user!, Number(req.params.taskId));
  if (!task) {
    res.status(404).json({ error: "Tarefa não encontrada" });
    return;
  }
  if (!(await requireProjectWrite(req.user!, task.projectId, res))) return;
  const body = parseBody(MoveTaskBody, req.body, res);
  if (!body) return;
  const column = await getColumnForUser(req.user!, body.columnId);
  if (!column || column.projectId !== task.projectId) {
    res.status(400).json({ error: "Coluna inválida" });
    return;
  }

  const columnChanged = task.columnId !== body.columnId;

  // Determine if completed state should change automatically on column move
  let autoComplete: boolean | null = null;
  if (columnChanged) {
    if (column.isDone) {
      autoComplete = true;
    } else {
      // Check if the source column was a "done" column
      const [srcCol] = await db
        .select({ isDone: columnsTable.isDone })
        .from(columnsTable)
        .where(eq(columnsTable.id, task.columnId));
      if (srcCol?.isDone) autoComplete = false;
    }
  }

  const updated = await db.transaction(async (tx) => {
    const siblings = await tx
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.columnId, body.columnId))
      .orderBy(asc(tasksTable.position), asc(tasksTable.id));

    const remaining = siblings.filter((t) => t.id !== task.id);
    const clamped = Math.max(0, Math.min(body.position, remaining.length));
    remaining.splice(clamped, 0, task);

    for (let i = 0; i < remaining.length; i++) {
      await tx
        .update(tasksTable)
        .set({ position: i, columnId: body.columnId })
        .where(eq(tasksTable.id, remaining[i].id));
    }

    if (autoComplete !== null && autoComplete !== task.completed) {
      await tx
        .update(tasksTable)
        .set({
          completed: autoComplete,
          completedAt: autoComplete ? new Date() : null,
        })
        .where(eq(tasksTable.id, task.id));
      await logActivity(
        tx,
        task.id,
        req.user!.id,
        autoComplete ? "completed" : "reopened",
      );
    }

    if (columnChanged) {
      await logActivity(tx, task.id, req.user!.id, "moved", column.name);
    }

    const [row] = await tx
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.id, task.id));
    return row;
  });
  const { total, done } = await checklistCounts([task.id]);
  const aMap = await assigneeMap([updated.assigneeId]);
  const lMap = await labelsByTask([task.id]);
  const vMap = await videoLinksByTask([task.id]);
  res
    .status(200)
    .json(
      toTask(
        updated,
        total.get(task.id) ?? 0,
        done.get(task.id) ?? 0,
        pickAssignee(aMap, updated.assigneeId),
        lMap.get(task.id) ?? [],
        vMap.get(task.id) ?? [],
      ),
    );
});

router.get(
  "/tasks/:taskId/activity",
  async (req: AuthRequest, res: Response) => {
    const task = await getTaskForUser(req.user!, Number(req.params.taskId));
    if (!task) {
      res.status(404).json({ error: "Tarefa não encontrada" });
      return;
    }
    const rows = await db
      .select({
        id: activityLogTable.id,
        taskId: activityLogTable.taskId,
        action: activityLogTable.action,
        detail: activityLogTable.detail,
        createdAt: activityLogTable.createdAt,
        actorId: usersTable.id,
        actorName: usersTable.name,
        actorAvatar: usersTable.avatarUrl,
      })
      .from(activityLogTable)
      .leftJoin(usersTable, eq(activityLogTable.userId, usersTable.id))
      .where(eq(activityLogTable.taskId, task.id))
      .orderBy(desc(activityLogTable.createdAt), desc(activityLogTable.id));
    res.status(200).json(
      rows.map((r) =>
        toActivity(
          {
            id: r.id,
            taskId: r.taskId,
            action: r.action,
            detail: r.detail,
            createdAt: r.createdAt,
          },
          r.actorId != null
            ? {
                id: r.actorId,
                name: r.actorName!,
                avatarUrl: r.actorAvatar ?? null,
              }
            : null,
        ),
      ),
    );
  },
);

export default router;
