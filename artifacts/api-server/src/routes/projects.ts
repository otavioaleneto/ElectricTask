import { Router, type IRouter, type Response } from "express";
import {
  db,
  projectsTable,
  projectViewsTable,
  columnsTable,
  tasksTable,
  insertReturning,
  updateReturning,
  upsert,
} from "@workspace/db";
import { eq, and, inArray, asc } from "drizzle-orm";
import { CreateProjectBody, UpdateProjectBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { parseBody } from "../lib/validate";
import { toProject, type RecentTaskInfo } from "../lib/serialize";
import {
  getWorkspaceForUser,
  getProjectForUser,
  requireWorkspaceWrite,
} from "../lib/access";

const router: IRouter = Router();

router.use(requireAuth);

async function projectCounts(projectIds: number[]) {
  const taskCount = new Map<number, number>();
  const completedCount = new Map<number, number>();
  const recentTasks = new Map<number, RecentTaskInfo[]>();
  if (projectIds.length === 0)
    return { taskCount, completedCount, recentTasks };
  const tasks = await db
    .select()
    .from(tasksTable)
    .where(inArray(tasksTable.projectId, projectIds));
  for (const t of tasks) {
    taskCount.set(t.projectId, (taskCount.get(t.projectId) ?? 0) + 1);
    if (t.completed) {
      completedCount.set(
        t.projectId,
        (completedCount.get(t.projectId) ?? 0) + 1,
      );
    }
  }
  return { taskCount, completedCount, recentTasks, tasks };
}

function buildRecentTasks(
  tasks: { id: number; title: string; projectId: number; priority: string; createdAt: Date }[],
  projectName: Map<number, string>,
) {
  const byProject = new Map<number, RecentTaskInfo[]>();
  const sorted = [...tasks].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  for (const t of sorted) {
    const list = byProject.get(t.projectId) ?? [];
    if (list.length >= 3) continue;
    list.push({
      id: t.id,
      title: t.title,
      projectId: t.projectId,
      projectName: projectName.get(t.projectId) ?? "",
      priority: t.priority,
      createdAt: t.createdAt.toISOString(),
    });
    byProject.set(t.projectId, list);
  }
  return byProject;
}

async function lastViewedMap(userId: number, projectIds: number[]) {
  const map = new Map<number, string>();
  if (projectIds.length === 0) return map;
  const rows = await db
    .select()
    .from(projectViewsTable)
    .where(
      and(
        eq(projectViewsTable.userId, userId),
        inArray(projectViewsTable.projectId, projectIds),
      ),
    );
  for (const r of rows) {
    map.set(r.projectId, r.lastViewedAt.toISOString());
  }
  return map;
}

router.get(
  "/workspaces/:workspaceId/projects",
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
      .where(eq(projectsTable.workspaceId, ws.id))
      .orderBy(asc(projectsTable.position), asc(projectsTable.id));
    const ids = projects.map((p) => p.id);
    const { taskCount, completedCount, tasks } = await projectCounts(ids);
    const projectName = new Map(projects.map((p) => [p.id, p.name]));
    const recent = buildRecentTasks(tasks ?? [], projectName);
    const viewed = await lastViewedMap(req.user!.id, ids);
    res
      .status(200)
      .json(
        projects.map((p) =>
          toProject(
            p,
            taskCount.get(p.id) ?? 0,
            completedCount.get(p.id) ?? 0,
            recent.get(p.id) ?? [],
            viewed.get(p.id) ?? null,
          ),
        ),
      );
  },
);

router.post(
  "/workspaces/:workspaceId/projects",
  async (req: AuthRequest, res: Response) => {
    const ws = await getWorkspaceForUser(
      req.user!,
      Number(req.params.workspaceId),
    );
    if (!ws) {
      res.status(404).json({ error: "Workspace não encontrado" });
      return;
    }
    if (!(await requireWorkspaceWrite(req.user!, ws.id, res))) return;
    const body = parseBody(CreateProjectBody, req.body, res);
    if (!body) return;
    const [project] = await insertReturning(db, projectsTable, {
      workspaceId: ws.id,
      name: body.name,
      description: body.description ?? null,
      type: body.type ?? "social",
      coverImageUrl: body.coverImageUrl ?? null,
      platform:
        body.type === "development" ? "generic" : body.platform ?? "generic",
      accentColor: body.accentColor ?? "#3b82f6",
    });

    const defaults = [
      { name: "A Fazer", color: "#3b82f6", position: 0 },
      { name: "Em Progresso", color: "#f59e0b", position: 1 },
      { name: "Concluído", color: "#22c55e", position: 2 },
    ];
    await db
      .insert(columnsTable)
      .values(defaults.map((c) => ({ ...c, projectId: project.id })));

    res.status(201).json(toProject(project, 0, 0, [], null));
  },
);

router.get("/projects/:projectId", async (req: AuthRequest, res: Response) => {
  const project = await getProjectForUser(
    req.user!,
    Number(req.params.projectId),
  );
  if (!project) {
    res.status(404).json({ error: "Projeto não encontrado" });
    return;
  }
  const { taskCount, completedCount, tasks } = await projectCounts([
    project.id,
  ]);
  const recent = buildRecentTasks(
    tasks ?? [],
    new Map([[project.id, project.name]]),
  );
  const viewed = await lastViewedMap(req.user!.id, [project.id]);
  res
    .status(200)
    .json(
      toProject(
        project,
        taskCount.get(project.id) ?? 0,
        completedCount.get(project.id) ?? 0,
        recent.get(project.id) ?? [],
        viewed.get(project.id) ?? null,
      ),
    );
});

router.post(
  "/projects/:projectId/view",
  async (req: AuthRequest, res: Response) => {
    const project = await getProjectForUser(
      req.user!,
      Number(req.params.projectId),
    );
    if (!project) {
      res.status(404).json({ error: "Projeto não encontrado" });
      return;
    }
    await upsert(
      db,
      projectViewsTable,
      { userId: req.user!.id, projectId: project.id },
      {
        target: [projectViewsTable.userId, projectViewsTable.projectId],
        set: { lastViewedAt: new Date() },
      },
    );
    res.status(204).send();
  },
);

router.patch("/projects/:projectId", async (req: AuthRequest, res: Response) => {
  const project = await getProjectForUser(
    req.user!,
    Number(req.params.projectId),
  );
  if (!project) {
    res.status(404).json({ error: "Projeto não encontrado" });
    return;
  }
  if (!(await requireWorkspaceWrite(req.user!, project.workspaceId, res)))
    return;
  const body = parseBody(UpdateProjectBody, req.body, res);
  if (!body) return;
  const effectiveType = body.type ?? project.type;
  const [updated] = await updateReturning(
    db,
    projectsTable,
    {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined
        ? { description: body.description }
        : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.coverImageUrl !== undefined
        ? { coverImageUrl: body.coverImageUrl }
        : {}),
      ...(effectiveType === "development"
        ? { platform: "generic" }
        : body.platform !== undefined
          ? { platform: body.platform }
          : {}),
      ...(body.accentColor !== undefined
        ? { accentColor: body.accentColor }
        : {}),
    },
    eq(projectsTable.id, project.id),
  );
  const { taskCount, completedCount, tasks } = await projectCounts([
    project.id,
  ]);
  const recent = buildRecentTasks(
    tasks ?? [],
    new Map([[updated.id, updated.name]]),
  );
  const viewed = await lastViewedMap(req.user!.id, [project.id]);
  res
    .status(200)
    .json(
      toProject(
        updated,
        taskCount.get(project.id) ?? 0,
        completedCount.get(project.id) ?? 0,
        recent.get(project.id) ?? [],
        viewed.get(project.id) ?? null,
      ),
    );
});

router.delete(
  "/projects/:projectId",
  async (req: AuthRequest, res: Response) => {
    const project = await getProjectForUser(
      req.user!,
      Number(req.params.projectId),
    );
    if (!project) {
      res.status(404).json({ error: "Projeto não encontrado" });
      return;
    }
    if (!(await requireWorkspaceWrite(req.user!, project.workspaceId, res)))
      return;
    await db.delete(projectsTable).where(eq(projectsTable.id, project.id));
    res.status(204).send();
  },
);

export default router;
