import { Router, type IRouter, type Response } from "express";
import {
  db,
  checklistsTable,
  checklistItemsTable,
  insertReturning,
  updateReturning,
} from "@workspace/db";
import { eq, inArray, asc, sql } from "drizzle-orm";
import {
  CreateChecklistBody,
  UpdateChecklistBody,
  CreateChecklistItemBody,
  UpdateChecklistItemBody,
} from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { parseBody } from "../lib/validate";
import { toChecklist, toChecklistItem } from "../lib/serialize";
import {
  getTaskForUser,
  getChecklistForUser,
  getChecklistItemForUser,
  requireProjectWrite,
  requireTaskWrite,
  requireChecklistWrite,
} from "../lib/access";

const router: IRouter = Router();

router.use(requireAuth);

router.get(
  "/tasks/:taskId/checklists",
  async (req: AuthRequest, res: Response) => {
    const task = await getTaskForUser(req.user!, Number(req.params.taskId));
    if (!task) {
      res.status(404).json({ error: "Tarefa não encontrada" });
      return;
    }
    const checklists = await db
      .select()
      .from(checklistsTable)
      .where(eq(checklistsTable.taskId, task.id))
      .orderBy(asc(checklistsTable.position), asc(checklistsTable.id));
    const checklistIds = checklists.map((c) => c.id);
    const items =
      checklistIds.length > 0
        ? await db
            .select()
            .from(checklistItemsTable)
            .where(inArray(checklistItemsTable.checklistId, checklistIds))
            .orderBy(
              asc(checklistItemsTable.position),
              asc(checklistItemsTable.id),
            )
        : [];
    res
      .status(200)
      .json(
        checklists.map((c) =>
          toChecklist(
            c,
            items.filter((i) => i.checklistId === c.id),
          ),
        ),
      );
  },
);

router.post(
  "/tasks/:taskId/checklists",
  async (req: AuthRequest, res: Response) => {
    const task = await getTaskForUser(req.user!, Number(req.params.taskId));
    if (!task) {
      res.status(404).json({ error: "Tarefa não encontrada" });
      return;
    }
    if (!(await requireProjectWrite(req.user!, task.projectId, res))) return;
    const body = parseBody(CreateChecklistBody, req.body, res);
    if (!body) return;
    const [{ max }] = await db
      .select({
        max: sql<number>`coalesce(max(${checklistsTable.position}), -1)`,
      })
      .from(checklistsTable)
      .where(eq(checklistsTable.taskId, task.id));
    const [checklist] = await insertReturning(db, checklistsTable, {
      taskId: task.id,
      title: body.title,
      position: Number(max) + 1,
    });
    res.status(201).json(toChecklist(checklist, []));
  },
);

router.patch(
  "/checklists/:checklistId",
  async (req: AuthRequest, res: Response) => {
    const checklist = await getChecklistForUser(
      req.user!,
      Number(req.params.checklistId),
    );
    if (!checklist) {
      res.status(404).json({ error: "Checklist não encontrada" });
      return;
    }
    if (!(await requireTaskWrite(req.user!, checklist.taskId, res))) return;
    const body = parseBody(UpdateChecklistBody, req.body, res);
    if (!body) return;
    const [updated] = await updateReturning(
      db,
      checklistsTable,
      {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.position !== undefined ? { position: body.position } : {}),
      },
      eq(checklistsTable.id, checklist.id),
    );
    const items = await db
      .select()
      .from(checklistItemsTable)
      .where(eq(checklistItemsTable.checklistId, updated.id))
      .orderBy(asc(checklistItemsTable.position), asc(checklistItemsTable.id));
    res.status(200).json(toChecklist(updated, items));
  },
);

router.delete(
  "/checklists/:checklistId",
  async (req: AuthRequest, res: Response) => {
    const checklist = await getChecklistForUser(
      req.user!,
      Number(req.params.checklistId),
    );
    if (!checklist) {
      res.status(404).json({ error: "Checklist não encontrada" });
      return;
    }
    if (!(await requireTaskWrite(req.user!, checklist.taskId, res))) return;
    await db
      .delete(checklistsTable)
      .where(eq(checklistsTable.id, checklist.id));
    res.status(204).send();
  },
);

router.post(
  "/checklists/:checklistId/items",
  async (req: AuthRequest, res: Response) => {
    const checklist = await getChecklistForUser(
      req.user!,
      Number(req.params.checklistId),
    );
    if (!checklist) {
      res.status(404).json({ error: "Checklist não encontrada" });
      return;
    }
    if (!(await requireTaskWrite(req.user!, checklist.taskId, res))) return;
    const body = parseBody(CreateChecklistItemBody, req.body, res);
    if (!body) return;
    const [{ max }] = await db
      .select({
        max: sql<number>`coalesce(max(${checklistItemsTable.position}), -1)`,
      })
      .from(checklistItemsTable)
      .where(eq(checklistItemsTable.checklistId, checklist.id));
    const [item] = await insertReturning(db, checklistItemsTable, {
      checklistId: checklist.id,
      content: body.content,
      position: Number(max) + 1,
    });
    res.status(201).json(toChecklistItem(item));
  },
);

router.patch(
  "/checklist-items/:itemId",
  async (req: AuthRequest, res: Response) => {
    const item = await getChecklistItemForUser(
      req.user!,
      Number(req.params.itemId),
    );
    if (!item) {
      res.status(404).json({ error: "Item não encontrado" });
      return;
    }
    if (!(await requireChecklistWrite(req.user!, item.checklistId, res)))
      return;
    const body = parseBody(UpdateChecklistItemBody, req.body, res);
    if (!body) return;
    const [updated] = await updateReturning(
      db,
      checklistItemsTable,
      {
        ...(body.content !== undefined ? { content: body.content } : {}),
        ...(body.done !== undefined ? { done: body.done } : {}),
        ...(body.position !== undefined ? { position: body.position } : {}),
      },
      eq(checklistItemsTable.id, item.id),
    );
    res.status(200).json(toChecklistItem(updated));
  },
);

router.delete(
  "/checklist-items/:itemId",
  async (req: AuthRequest, res: Response) => {
    const item = await getChecklistItemForUser(
      req.user!,
      Number(req.params.itemId),
    );
    if (!item) {
      res.status(404).json({ error: "Item não encontrado" });
      return;
    }
    if (!(await requireChecklistWrite(req.user!, item.checklistId, res)))
      return;
    await db
      .delete(checklistItemsTable)
      .where(eq(checklistItemsTable.id, item.id));
    res.status(204).send();
  },
);

export default router;
