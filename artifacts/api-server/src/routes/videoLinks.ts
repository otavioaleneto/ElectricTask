import { Router, type IRouter, type Response } from "express";
import {
  db,
  taskVideoLinksTable,
  insertReturning,
  updateReturning,
} from "@workspace/db";
import { eq, asc, sql } from "drizzle-orm";
import { AddVideoLinkBody, UpdateVideoLinkBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { parseBody } from "../lib/validate";
import { toVideoLink } from "../lib/serialize";
import { getTaskForUser, requireTaskWrite } from "../lib/access";

const router: IRouter = Router();

router.use(requireAuth);

function normalizeVideoUrl(raw: string): string | null {
  const trimmed = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  return parsed.toString();
}

async function getVideoLinkForUser(
  req: AuthRequest,
  videoLinkId: number,
) {
  const [link] = await db
    .select()
    .from(taskVideoLinksTable)
    .where(eq(taskVideoLinksTable.id, videoLinkId));
  if (!link) return null;
  const task = await getTaskForUser(req.user!, link.taskId);
  if (!task) return null;
  return link;
}

router.get(
  "/tasks/:taskId/video-links",
  async (req: AuthRequest, res: Response) => {
    const task = await getTaskForUser(req.user!, Number(req.params.taskId));
    if (!task) {
      res.status(404).json({ error: "Tarefa não encontrada" });
      return;
    }
    const links = await db
      .select()
      .from(taskVideoLinksTable)
      .where(eq(taskVideoLinksTable.taskId, task.id))
      .orderBy(asc(taskVideoLinksTable.position), asc(taskVideoLinksTable.id));
    res.status(200).json(links.map(toVideoLink));
  },
);

router.post(
  "/tasks/:taskId/video-links",
  async (req: AuthRequest, res: Response) => {
    const task = await getTaskForUser(req.user!, Number(req.params.taskId));
    if (!task) {
      res.status(404).json({ error: "Tarefa não encontrada" });
      return;
    }
    if (!(await requireTaskWrite(req.user!, task.id, res))) return;
    const body = parseBody(AddVideoLinkBody, req.body, res);
    if (!body) return;
    const url = normalizeVideoUrl(body.url);
    if (!url) {
      res
        .status(400)
        .json({ error: "URL inválida. Use um link http(s) válido." });
      return;
    }
    const [{ max }] = await db
      .select({
        max: sql<number>`coalesce(max(${taskVideoLinksTable.position}), -1)`,
      })
      .from(taskVideoLinksTable)
      .where(eq(taskVideoLinksTable.taskId, task.id));
    const [created] = await insertReturning(db, taskVideoLinksTable, {
      taskId: task.id,
      url,
      label: body.label ?? null,
      position: Number(max) + 1,
    });
    res.status(201).json(toVideoLink(created));
  },
);

router.patch(
  "/video-links/:videoLinkId",
  async (req: AuthRequest, res: Response) => {
    const link = await getVideoLinkForUser(
      req,
      Number(req.params.videoLinkId),
    );
    if (!link) {
      res.status(404).json({ error: "Link de vídeo não encontrado" });
      return;
    }
    if (!(await requireTaskWrite(req.user!, link.taskId, res))) return;
    const body = parseBody(UpdateVideoLinkBody, req.body, res);
    if (!body) return;
    let normalizedUrl: string | undefined;
    if (body.url !== undefined) {
      const url = normalizeVideoUrl(body.url);
      if (!url) {
        res
          .status(400)
          .json({ error: "URL inválida. Use um link http(s) válido." });
        return;
      }
      normalizedUrl = url;
    }
    const [updated] = await updateReturning(
      db,
      taskVideoLinksTable,
      {
        ...(normalizedUrl !== undefined ? { url: normalizedUrl } : {}),
        ...(body.label !== undefined ? { label: body.label ?? null } : {}),
      },
      eq(taskVideoLinksTable.id, link.id),
    );
    res.status(200).json(toVideoLink(updated));
  },
);

router.delete(
  "/video-links/:videoLinkId",
  async (req: AuthRequest, res: Response) => {
    const link = await getVideoLinkForUser(
      req,
      Number(req.params.videoLinkId),
    );
    if (!link) {
      res.status(404).json({ error: "Link de vídeo não encontrado" });
      return;
    }
    if (!(await requireTaskWrite(req.user!, link.taskId, res))) return;
    await db
      .delete(taskVideoLinksTable)
      .where(eq(taskVideoLinksTable.id, link.id));
    res.status(204).send();
  },
);

export default router;
