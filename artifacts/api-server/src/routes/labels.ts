import { Router, type IRouter, type Response } from "express";
import {
  db,
  labelsTable,
  insertReturning,
  updateReturning,
} from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { CreateLabelBody, UpdateLabelBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { parseBody } from "../lib/validate";
import { toLabel } from "../lib/serialize";
import {
  getProjectForUser,
  getLabelForUser,
  requireProjectWrite,
} from "../lib/access";

const router: IRouter = Router();

router.use(requireAuth);

router.get(
  "/projects/:projectId/labels",
  async (req: AuthRequest, res: Response) => {
    const project = await getProjectForUser(
      req.user!,
      Number(req.params.projectId),
    );
    if (!project) {
      res.status(404).json({ error: "Projeto não encontrado" });
      return;
    }
    const labels = await db
      .select()
      .from(labelsTable)
      .where(eq(labelsTable.projectId, project.id))
      .orderBy(asc(labelsTable.name), asc(labelsTable.id));
    res.status(200).json(labels.map(toLabel));
  },
);

router.post(
  "/projects/:projectId/labels",
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
    const body = parseBody(CreateLabelBody, req.body, res);
    if (!body) return;
    const [label] = await insertReturning(db, labelsTable, {
      projectId: project.id,
      name: body.name,
      color: body.color ?? "#3b82f6",
    });
    res.status(201).json(toLabel(label));
  },
);

router.patch("/labels/:labelId", async (req: AuthRequest, res: Response) => {
  const label = await getLabelForUser(req.user!, Number(req.params.labelId));
  if (!label) {
    res.status(404).json({ error: "Etiqueta não encontrada" });
    return;
  }
  if (!(await requireProjectWrite(req.user!, label.projectId, res))) return;
  const body = parseBody(UpdateLabelBody, req.body, res);
  if (!body) return;
  const [updated] = await updateReturning(
    db,
    labelsTable,
    {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.color !== undefined ? { color: body.color } : {}),
    },
    eq(labelsTable.id, label.id),
  );
  res.status(200).json(toLabel(updated));
});

router.delete("/labels/:labelId", async (req: AuthRequest, res: Response) => {
  const label = await getLabelForUser(req.user!, Number(req.params.labelId));
  if (!label) {
    res.status(404).json({ error: "Etiqueta não encontrada" });
    return;
  }
  if (!(await requireProjectWrite(req.user!, label.projectId, res))) return;
  await db.delete(labelsTable).where(eq(labelsTable.id, label.id));
  res.status(204).send();
});

export default router;
