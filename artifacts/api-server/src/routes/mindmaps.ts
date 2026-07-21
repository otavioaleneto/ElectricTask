import { Router, type IRouter, type Response } from "express";
import {
  db,
  mindmapsTable,
  workspacesTable,
  insertReturning,
  updateReturning,
  type MindmapDataShape,
} from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { CreateMindmapBody, UpdateMindmapBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { parseBody } from "../lib/validate";
import { toMindmap } from "../lib/serialize";
import {
  getWorkspaceForUser,
  getMindmapForUser,
  requireWorkspaceWrite,
} from "../lib/access";

const router: IRouter = Router();

router.use(requireAuth);

const emptyData: MindmapDataShape = { nodes: [], edges: [] };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Cross-dialect hierarchy lock (works on PG and MySQL, unlike
// pg_advisory_xact_lock): take a transaction-scoped exclusive row lock on the
// workspace row so all hierarchy mutations for a workspace serialize.
async function lockWorkspaceHierarchy(tx: Tx, workspaceId: number) {
  await tx
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .for("update");
}

// Validates that `parentId` may become the parent of `child` while keeping the
// hierarchy exactly two levels deep (no cycles, no grandchildren). Must run
// inside a transaction that already holds the workspace hierarchy lock so
// concurrent link operations cannot race into an invalid tree.
async function assertLinkable(
  tx: Tx,
  child: { id: number | null; workspaceId: number },
  parentId: number,
): Promise<void> {
  if (child.id !== null && parentId === child.id) {
    throw new HttpError(400, "Um mapa mental não pode ser vinculado a si mesmo.");
  }
  const [parent] = await tx
    .select()
    .from(mindmapsTable)
    .where(eq(mindmapsTable.id, parentId));
  if (!parent || parent.workspaceId !== child.workspaceId) {
    throw new HttpError(404, "Mapa mental principal não encontrado.");
  }
  if (parent.parentId !== null) {
    throw new HttpError(
      409,
      "Não é possível vincular a um mapa mental que já é complementar.",
    );
  }
  if (child.id !== null) {
    const kids = await tx
      .select({ id: mindmapsTable.id })
      .from(mindmapsTable)
      .where(eq(mindmapsTable.parentId, child.id))
      .limit(1);
    if (kids.length > 0) {
      throw new HttpError(
        409,
        "Este mapa mental já possui mapas complementares e não pode ser vinculado a outro.",
      );
    }
  }
}

router.get(
  "/workspaces/:workspaceId/mindmaps",
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
      .from(mindmapsTable)
      .where(eq(mindmapsTable.workspaceId, ws.id))
      .orderBy(asc(mindmapsTable.id));
    res.status(200).json(rows.map(toMindmap));
  },
);

router.post(
  "/workspaces/:workspaceId/mindmaps",
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
    const body = parseBody(CreateMindmapBody, req.body, res);
    if (!body) return;
    const parentId = body.parentId ?? null;
    try {
      const created = await db.transaction(async (tx) => {
        if (parentId !== null) {
          await lockWorkspaceHierarchy(tx, ws.id);
          await assertLinkable(tx, { id: null, workspaceId: ws.id }, parentId);
        }
        const [mindmap] = await insertReturning(tx, mindmapsTable, {
          workspaceId: ws.id,
          name: body.name,
          data: (body.data as MindmapDataShape | undefined) ?? emptyData,
          taskId: body.taskId ?? null,
          parentId,
        });
        return mindmap;
      });
      res.status(201).json(toMindmap(created));
    } catch (e) {
      if (e instanceof HttpError) {
        res.status(e.status).json({ error: e.message });
        return;
      }
      throw e;
    }
  },
);

router.get("/mindmaps/:mindmapId", async (req: AuthRequest, res: Response) => {
  const mindmap = await getMindmapForUser(
    req.user!,
    Number(req.params.mindmapId),
  );
  if (!mindmap) {
    res.status(404).json({ error: "Mapa mental não encontrado" });
    return;
  }
  res.status(200).json(toMindmap(mindmap));
});

router.patch("/mindmaps/:mindmapId", async (req: AuthRequest, res: Response) => {
  const mindmap = await getMindmapForUser(
    req.user!,
    Number(req.params.mindmapId),
  );
  if (!mindmap) {
    res.status(404).json({ error: "Mapa mental não encontrado" });
    return;
  }
  if (!(await requireWorkspaceWrite(req.user!, mindmap.workspaceId, res)))
    return;
  const body = parseBody(UpdateMindmapBody, req.body, res);
  if (!body) return;
  try {
    const updated = await db.transaction(async (tx) => {
      if (body.parentId !== undefined && body.parentId !== null) {
        await lockWorkspaceHierarchy(tx, mindmap.workspaceId);
        await assertLinkable(
          tx,
          { id: mindmap.id, workspaceId: mindmap.workspaceId },
          body.parentId,
        );
      }
      const [row] = await updateReturning(
        tx,
        mindmapsTable,
        {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.data !== undefined
            ? { data: body.data as MindmapDataShape }
            : {}),
          ...(body.taskId !== undefined ? { taskId: body.taskId } : {}),
          ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
        },
        eq(mindmapsTable.id, mindmap.id),
      );
      return row;
    });
    res.status(200).json(toMindmap(updated));
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json({ error: e.message });
      return;
    }
    throw e;
  }
});

router.delete(
  "/mindmaps/:mindmapId",
  async (req: AuthRequest, res: Response) => {
    const mindmap = await getMindmapForUser(
      req.user!,
      Number(req.params.mindmapId),
    );
    if (!mindmap) {
      res.status(404).json({ error: "Mapa mental não encontrado" });
      return;
    }
    if (!(await requireWorkspaceWrite(req.user!, mindmap.workspaceId, res)))
      return;
    // Hold the same hierarchy lock as link operations so a delete cannot race a
    // concurrent link-to-this-parent (which relies on ON DELETE SET NULL).
    await db.transaction(async (tx) => {
      await lockWorkspaceHierarchy(tx, mindmap.workspaceId);
      await tx.delete(mindmapsTable).where(eq(mindmapsTable.id, mindmap.id));
    });
    res.status(204).send();
  },
);

export default router;
