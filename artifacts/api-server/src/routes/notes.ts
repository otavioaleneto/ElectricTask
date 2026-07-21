import { Router, type IRouter, type Response } from "express";
import {
  db,
  notesTable,
  mindmapsTable,
  tasksTable,
  projectsTable,
  itemLinksTable,
  insertReturning,
  updateReturning,
  likeInsensitive,
} from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";
import { CreateNoteBody, UpdateNoteBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { parseBody } from "../lib/validate";
import { toNoteSummary } from "../lib/serialize";
import {
  getWorkspaceForUser,
  getNoteForUser,
  requireWorkspaceWrite,
} from "../lib/access";
import {
  refreshNoteLinks,
  getNoteDetail,
  buildWorkspaceGraph,
} from "../lib/links";

const router: IRouter = Router();

router.use(requireAuth);

router.get(
  "/workspaces/:workspaceId/notes",
  async (req: AuthRequest, res: Response) => {
    const ws = await getWorkspaceForUser(
      req.user!,
      Number(req.params.workspaceId),
    );
    if (!ws) {
      res.status(404).json({ error: "Workspace não encontrado" });
      return;
    }
    const rows = await db
      .select()
      .from(notesTable)
      .where(eq(notesTable.workspaceId, ws.id))
      .orderBy(asc(notesTable.title));
    res.status(200).json(rows.map(toNoteSummary));
  },
);

router.post(
  "/workspaces/:workspaceId/notes",
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
    const body = parseBody(CreateNoteBody, req.body, res);
    if (!body) return;
    const detail = await db.transaction(async (tx) => {
      const [note] = await insertReturning(tx, notesTable, {
        workspaceId: ws.id,
        title: body.title,
        content: body.content ?? "",
      });
      await refreshNoteLinks(tx, ws.id, note.id, note.content);
      return getNoteDetail(tx, note);
    });
    res.status(201).json(detail);
  },
);

router.get("/notes/:noteId", async (req: AuthRequest, res: Response) => {
  const note = await getNoteForUser(req.user!, Number(req.params.noteId));
  if (!note) {
    res.status(404).json({ error: "Nota não encontrada" });
    return;
  }
  const detail = await getNoteDetail(db, note);
  res.status(200).json(detail);
});

router.patch("/notes/:noteId", async (req: AuthRequest, res: Response) => {
  const note = await getNoteForUser(req.user!, Number(req.params.noteId));
  if (!note) {
    res.status(404).json({ error: "Nota não encontrada" });
    return;
  }
  if (!(await requireWorkspaceWrite(req.user!, note.workspaceId, res))) return;
  const body = parseBody(UpdateNoteBody, req.body, res);
  if (!body) return;
  const detail = await db.transaction(async (tx) => {
    const [updated] = await updateReturning(
      tx,
      notesTable,
      {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.content !== undefined ? { content: body.content } : {}),
        ...(body.isLocked !== undefined ? { isLocked: body.isLocked } : {}),
        updatedAt: new Date(),
      },
      eq(notesTable.id, note.id),
    );
    if (body.content !== undefined) {
      await refreshNoteLinks(tx, updated.workspaceId, updated.id, updated.content);
    }
    return getNoteDetail(tx, updated);
  });
  res.status(200).json(detail);
});

router.delete("/notes/:noteId", async (req: AuthRequest, res: Response) => {
  const note = await getNoteForUser(req.user!, Number(req.params.noteId));
  if (!note) {
    res.status(404).json({ error: "Nota não encontrada" });
    return;
  }
  if (!(await requireWorkspaceWrite(req.user!, note.workspaceId, res))) return;
  await db.transaction(async (tx) => {
    await tx
      .delete(itemLinksTable)
      .where(
        and(
          eq(itemLinksTable.workspaceId, note.workspaceId),
          eq(itemLinksTable.targetType, "note"),
          eq(itemLinksTable.targetId, note.id),
        ),
      );
    await tx.delete(notesTable).where(eq(notesTable.id, note.id));
  });
  res.status(204).send();
});

router.get(
  "/workspaces/:workspaceId/mentionables",
  async (req: AuthRequest, res: Response) => {
    const ws = await getWorkspaceForUser(
      req.user!,
      Number(req.params.workspaceId),
    );
    if (!ws) {
      res.status(404).json({ error: "Workspace não encontrado" });
      return;
    }
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const like = `%${q}%`;

    const noteRows = await db
      .select({ id: notesTable.id, title: notesTable.title })
      .from(notesTable)
      .where(
        q
          ? and(
              eq(notesTable.workspaceId, ws.id),
              likeInsensitive(notesTable.title, like),
            )
          : eq(notesTable.workspaceId, ws.id),
      )
      .orderBy(asc(notesTable.title))
      .limit(20);

    const mindmapRows = await db
      .select({ id: mindmapsTable.id, name: mindmapsTable.name })
      .from(mindmapsTable)
      .where(
        q
          ? and(
              eq(mindmapsTable.workspaceId, ws.id),
              likeInsensitive(mindmapsTable.name, like),
            )
          : eq(mindmapsTable.workspaceId, ws.id),
      )
      .orderBy(asc(mindmapsTable.name))
      .limit(20);

    const taskRows = await db
      .select({
        id: tasksTable.id,
        title: tasksTable.title,
        projectId: tasksTable.projectId,
      })
      .from(tasksTable)
      .innerJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
      .where(
        q
          ? and(
              eq(projectsTable.workspaceId, ws.id),
              likeInsensitive(tasksTable.title, like),
            )
          : eq(projectsTable.workspaceId, ws.id),
      )
      .orderBy(asc(tasksTable.title))
      .limit(20);

    const items = [
      ...noteRows.map((n) => ({
        type: "note" as const,
        id: n.id,
        title: n.title,
        projectId: null,
      })),
      ...mindmapRows.map((m) => ({
        type: "mindmap" as const,
        id: m.id,
        title: m.name,
        projectId: null,
      })),
      ...taskRows.map((t) => ({
        type: "task" as const,
        id: t.id,
        title: t.title,
        projectId: t.projectId,
      })),
    ];
    res.status(200).json(items);
  },
);

router.get(
  "/workspaces/:workspaceId/graph",
  async (req: AuthRequest, res: Response) => {
    const ws = await getWorkspaceForUser(
      req.user!,
      Number(req.params.workspaceId),
    );
    if (!ws) {
      res.status(404).json({ error: "Workspace não encontrado" });
      return;
    }
    const graph = await buildWorkspaceGraph(db, ws.id);
    res.status(200).json(graph);
  },
);

export default router;
