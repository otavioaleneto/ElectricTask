import { Router, type IRouter, type Response } from "express";
import {
  db,
  workspacesTable,
  workspaceMembersTable,
  projectsTable,
  tasksTable,
  mindmapsTable,
  columnsTable,
  labelsTable,
  taskLabelsTable,
  activityLogTable,
  usersTable,
  insertReturning,
  updateReturning,
  insertIgnore,
} from "@workspace/db";
import { eq, inArray, and, gte } from "drizzle-orm";
import { CreateWorkspaceBody, UpdateWorkspaceBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { parseBody } from "../lib/validate";
import { toWorkspace, avatarSrc } from "../lib/serialize";
import {
  getWorkspaceForUser,
  getWorkspaceRoleForUser,
  requireWorkspaceWrite,
  requireWorkspaceManage,
  type WorkspaceRole,
} from "../lib/access";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/workspaces", async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (user.role === "admin") {
    const rows = await db
      .select()
      .from(workspacesTable)
      .orderBy(workspacesTable.id);
    res.status(200).json(rows.map((w) => toWorkspace(w, "owner")));
    return;
  }

  const roleByWs = new Map<number, WorkspaceRole>();
  const memberRows = await db
    .select({
      workspaceId: workspaceMembersTable.workspaceId,
      role: workspaceMembersTable.role,
    })
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.userId, user.id));
  for (const m of memberRows) {
    roleByWs.set(m.workspaceId, m.role as WorkspaceRole);
  }
  const owned = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.ownerId, user.id));
  for (const w of owned) roleByWs.set(w.id, "owner");

  const ids = Array.from(roleByWs.keys());
  const rows =
    ids.length > 0
      ? await db
          .select()
          .from(workspacesTable)
          .where(inArray(workspacesTable.id, ids))
          .orderBy(workspacesTable.id)
      : [];
  res
    .status(200)
    .json(rows.map((w) => toWorkspace(w, roleByWs.get(w.id) ?? null)));
});

router.post("/workspaces", async (req: AuthRequest, res: Response) => {
  const body = parseBody(CreateWorkspaceBody, req.body, res);
  if (!body) return;
  const [ws] = await insertReturning(db, workspacesTable, {
    ownerId: req.user!.id,
    name: body.name,
    description: body.description ?? null,
    color: body.color ?? "#3b82f6",
  });
  await insertIgnore(db, workspaceMembersTable, {
    workspaceId: ws.id,
    userId: req.user!.id,
    role: "owner",
  });
  res.status(201).json(toWorkspace(ws, "owner"));
});

router.get(
  "/workspaces/:workspaceId",
  async (req: AuthRequest, res: Response) => {
    const ws = await getWorkspaceForUser(
      req.user!,
      Number(req.params.workspaceId),
    );
    if (!ws) {
      res.status(404).json({ error: "Workspace não encontrado" });
      return;
    }
    const role = await getWorkspaceRoleForUser(req.user!, ws.id);
    res.status(200).json(toWorkspace(ws, role));
  },
);

router.patch(
  "/workspaces/:workspaceId",
  async (req: AuthRequest, res: Response) => {
    const workspaceId = Number(req.params.workspaceId);
    if (!(await requireWorkspaceWrite(req.user!, workspaceId, res))) return;
    const body = parseBody(UpdateWorkspaceBody, req.body, res);
    if (!body) return;
    const [updated] = await updateReturning(
      db,
      workspacesTable,
      {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
        ...(body.color !== undefined ? { color: body.color } : {}),
      },
      eq(workspacesTable.id, workspaceId),
    );
    const role = await getWorkspaceRoleForUser(req.user!, workspaceId);
    res.status(200).json(toWorkspace(updated, role));
  },
);

router.delete(
  "/workspaces/:workspaceId",
  async (req: AuthRequest, res: Response) => {
    const workspaceId = Number(req.params.workspaceId);
    if (!(await requireWorkspaceManage(req.user!, workspaceId, res))) return;
    await db.delete(workspacesTable).where(eq(workspacesTable.id, workspaceId));
    res.status(204).send();
  },
);

router.get(
  "/workspaces/:workspaceId/summary",
  async (req: AuthRequest, res: Response) => {
    const ws = await getWorkspaceForUser(
      req.user!,
      Number(req.params.workspaceId),
    );
    if (!ws) {
      res.status(404).json({ error: "Workspace não encontrado" });
      return;
    }
    const projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.workspaceId, ws.id));
    const projectIds = projects.map((p) => p.id);
    const projectName = new Map(projects.map((p) => [p.id, p.name]));

    const tasks =
      projectIds.length > 0
        ? await db
            .select()
            .from(tasksTable)
            .where(inArray(tasksTable.projectId, projectIds))
        : [];

    const mindmapRows = await db
      .select()
      .from(mindmapsTable)
      .where(eq(mindmapsTable.workspaceId, ws.id));

    const completedCount = tasks.filter((t) => t.completed).length;
    const platformMap = new Map<string, number>();
    for (const p of projects) {
      platformMap.set(p.platform, (platformMap.get(p.platform) ?? 0) + 1);
    }

    const recentTasks = [...tasks]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 6)
      .map((t) => ({
        id: t.id,
        title: t.title,
        projectId: t.projectId,
        projectName: projectName.get(t.projectId) ?? "",
        priority: t.priority,
        createdAt: t.createdAt.toISOString(),
      }));

    const taskIds = tasks.map((t) => t.id);

    // Tasks by status (kanban column, grouped by name across projects)
    const columns =
      projectIds.length > 0
        ? await db
            .select()
            .from(columnsTable)
            .where(inArray(columnsTable.projectId, projectIds))
        : [];
    const columnById = new Map(columns.map((c) => [c.id, c]));
    const statusMap = new Map<string, { count: number; color: string }>();
    for (const t of tasks) {
      const col = columnById.get(t.columnId);
      const name = col?.name ?? "Sem coluna";
      const cur = statusMap.get(name);
      if (cur) cur.count += 1;
      else statusMap.set(name, { count: 1, color: col?.color ?? "#64748b" });
    }
    const statusBreakdown = Array.from(statusMap.entries())
      .map(([status, v]) => ({ status, count: v.count, color: v.color }))
      .sort((a, b) => b.count - a.count);

    // Tasks by assignee (+ unassigned bucket)
    const assigneeCount = new Map<number, number>();
    let unassignedCount = 0;
    for (const t of tasks) {
      if (t.assigneeId == null) unassignedCount += 1;
      else
        assigneeCount.set(
          t.assigneeId,
          (assigneeCount.get(t.assigneeId) ?? 0) + 1,
        );
    }
    const assigneeIds = Array.from(assigneeCount.keys());
    const assigneeUsers =
      assigneeIds.length > 0
        ? await db
            .select({
              id: usersTable.id,
              name: usersTable.name,
              avatarUrl: usersTable.avatarUrl,
            })
            .from(usersTable)
            .where(inArray(usersTable.id, assigneeIds))
        : [];
    const userById = new Map(assigneeUsers.map((u) => [u.id, u]));
    const assigneeBreakdown: {
      assigneeId: number | null;
      name: string;
      avatarUrl: string | null;
      count: number;
    }[] = assigneeIds
      .map((id) => ({
        assigneeId: id as number | null,
        name: userById.get(id)?.name ?? "Desconhecido",
        avatarUrl: avatarSrc(id, userById.get(id)?.avatarUrl),
        count: assigneeCount.get(id) ?? 0,
      }))
      .sort((a, b) => b.count - a.count);
    if (unassignedCount > 0) {
      assigneeBreakdown.push({
        assigneeId: null,
        name: "Sem responsável",
        avatarUrl: null,
        count: unassignedCount,
      });
    }

    // Tasks by label (a task may carry several labels)
    const labelRows =
      taskIds.length > 0
        ? await db
            .select({
              labelId: taskLabelsTable.labelId,
              name: labelsTable.name,
              color: labelsTable.color,
            })
            .from(taskLabelsTable)
            .innerJoin(labelsTable, eq(taskLabelsTable.labelId, labelsTable.id))
            .where(inArray(taskLabelsTable.taskId, taskIds))
        : [];
    const labelMap = new Map<
      number,
      { name: string; color: string; count: number }
    >();
    for (const r of labelRows) {
      const cur = labelMap.get(r.labelId);
      if (cur) cur.count += 1;
      else labelMap.set(r.labelId, { name: r.name, color: r.color, count: 1 });
    }
    const labelBreakdown = Array.from(labelMap.entries())
      .map(([labelId, v]) => ({
        labelId,
        name: v.name,
        color: v.color,
        count: v.count,
      }))
      .sort((a, b) => b.count - a.count);

    // Completion over time (predefined period, daily buckets, gap-filled)
    const periodParam = String(req.query.period ?? "30d");
    const periodDays =
      periodParam === "7d" ? 7 : periodParam === "90d" ? 90 : 30;
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (periodDays - 1));
    const completionRows =
      taskIds.length > 0
        ? await db
            .select({ createdAt: activityLogTable.createdAt })
            .from(activityLogTable)
            .where(
              and(
                inArray(activityLogTable.taskId, taskIds),
                eq(activityLogTable.action, "completed"),
                gte(activityLogTable.createdAt, start),
              ),
            )
        : [];
    const dayCount = new Map<string, number>();
    for (const r of completionRows) {
      const key = r.createdAt.toISOString().slice(0, 10);
      dayCount.set(key, (dayCount.get(key) ?? 0) + 1);
    }
    const completionSeries: { date: string; count: number }[] = [];
    for (let i = 0; i < periodDays; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      completionSeries.push({ date: key, count: dayCount.get(key) ?? 0 });
    }

    res.status(200).json({
      projectCount: projects.length,
      taskCount: tasks.length,
      completedCount,
      openCount: tasks.length - completedCount,
      mindmapCount: mindmapRows.length,
      platformBreakdown: Array.from(platformMap.entries()).map(
        ([platform, count]) => ({ platform, count }),
      ),
      recentTasks,
      statusBreakdown,
      assigneeBreakdown,
      labelBreakdown,
      completionSeries,
    });
  },
);

export default router;
