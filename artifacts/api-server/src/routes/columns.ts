import { Router, type IRouter, type Response } from "express";
import {
  db,
  columnsTable,
  insertReturning,
  updateReturning,
} from "@workspace/db";
import { eq, asc, sql } from "drizzle-orm";
import { CreateColumnBody, UpdateColumnBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { parseBody } from "../lib/validate";
import { toColumn } from "../lib/serialize";
import {
  getProjectForUser,
  getColumnForUser,
  requireWorkspaceWrite,
  requireProjectWrite,
} from "../lib/access";

const router: IRouter = Router();

router.use(requireAuth);

router.get(
  "/projects/:projectId/columns",
  async (req: AuthRequest, res: Response) => {
    const project = await getProjectForUser(
      req.user!,
      Number(req.params.projectId),
    );
    if (!project) {
      res.status(404).json({ error: "Projeto não encontrado" });
      return;
    }
    const cols = await db
      .select()
      .from(columnsTable)
      .where(eq(columnsTable.projectId, project.id))
      .orderBy(asc(columnsTable.position), asc(columnsTable.id));
    res.status(200).json(cols.map(toColumn));
  },
);

router.post(
  "/projects/:projectId/columns",
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
    const body = parseBody(CreateColumnBody, req.body, res);
    if (!body) return;
    let position = body.position;
    if (position === undefined) {
      const [{ max }] = await db
        .select({ max: sql<number>`coalesce(max(${columnsTable.position}), -1)` })
        .from(columnsTable)
        .where(eq(columnsTable.projectId, project.id));
      position = Number(max) + 1;
    }
    const [col] = await insertReturning(db, columnsTable, {
      projectId: project.id,
      name: body.name,
      color: body.color ?? "#3b82f6",
      position,
    });
    res.status(201).json(toColumn(col));
  },
);

router.patch("/columns/:columnId", async (req: AuthRequest, res: Response) => {
  const col = await getColumnForUser(req.user!, Number(req.params.columnId));
  if (!col) {
    res.status(404).json({ error: "Coluna não encontrada" });
    return;
  }
  if (!(await requireProjectWrite(req.user!, col.projectId, res))) return;
  const body = parseBody(UpdateColumnBody, req.body, res);
  if (!body) return;
  const [updated] = await updateReturning(
    db,
    columnsTable,
    {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.color !== undefined ? { color: body.color } : {}),
      ...(body.position !== undefined ? { position: body.position } : {}),
      ...(body.isDone !== undefined ? { isDone: body.isDone } : {}),
    },
    eq(columnsTable.id, col.id),
  );
  res.status(200).json(toColumn(updated));
});

router.delete("/columns/:columnId", async (req: AuthRequest, res: Response) => {
  const col = await getColumnForUser(req.user!, Number(req.params.columnId));
  if (!col) {
    res.status(404).json({ error: "Coluna não encontrada" });
    return;
  }
  if (!(await requireProjectWrite(req.user!, col.projectId, res))) return;
  await db.delete(columnsTable).where(eq(columnsTable.id, col.id));
  res.status(204).send();
});

export default router;
