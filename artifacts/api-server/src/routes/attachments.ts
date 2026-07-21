import { Router, type IRouter, type Response } from "express";
import {
  db,
  taskAttachmentsTable,
  usersTable,
  insertReturning,
} from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { RegisterAttachmentBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { parseBody } from "../lib/validate";
import { toAttachment } from "../lib/serialize";
import { getTaskForUser, requireTaskWrite } from "../lib/access";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "../lib/objectStorage";
import { logger } from "../lib/logger";

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;
const INLINE_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

router.use(requireAuth);

router.get(
  "/tasks/:taskId/attachments",
  async (req: AuthRequest, res: Response) => {
    const task = await getTaskForUser(req.user!, Number(req.params.taskId));
    if (!task) {
      res.status(404).json({ error: "Tarefa não encontrada" });
      return;
    }
    const rows = await db
      .select({
        attachment: taskAttachmentsTable,
        uploaderName: usersTable.name,
      })
      .from(taskAttachmentsTable)
      .leftJoin(usersTable, eq(taskAttachmentsTable.uploadedBy, usersTable.id))
      .where(eq(taskAttachmentsTable.taskId, task.id))
      .orderBy(
        asc(taskAttachmentsTable.createdAt),
        asc(taskAttachmentsTable.id),
      );
    res
      .status(200)
      .json(rows.map((r) => toAttachment(r.attachment, r.uploaderName)));
  },
);

router.post(
  "/tasks/:taskId/attachments",
  async (req: AuthRequest, res: Response) => {
    const taskId = Number(req.params.taskId);
    const task = await getTaskForUser(req.user!, taskId);
    if (!task) {
      res.status(404).json({ error: "Tarefa não encontrada" });
      return;
    }
    if (!(await requireTaskWrite(req.user!, taskId, res))) return;

    const body = parseBody(RegisterAttachmentBody, req.body, res);
    if (!body) return;

    if (!body.objectPath.startsWith("/objects/")) {
      res.status(400).json({ error: "Caminho de objeto inválido" });
      return;
    }
    if (body.size > MAX_ATTACHMENT_SIZE) {
      res
        .status(400)
        .json({ error: "O arquivo excede o tamanho máximo de 25 MB" });
      return;
    }

    let actualSize: number;
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        body.objectPath,
      );
      const [metadata] = await objectFile.getMetadata();
      actualSize = Number(metadata.size ?? 0);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(400).json({ error: "Arquivo enviado não encontrado" });
        return;
      }
      logger.error({ err: error }, "Erro ao validar anexo enviado");
      res.status(500).json({ error: "Falha ao registrar anexo" });
      return;
    }
    if (actualSize <= 0) {
      res.status(400).json({ error: "Arquivo enviado inválido" });
      return;
    }
    if (actualSize > MAX_ATTACHMENT_SIZE) {
      res
        .status(400)
        .json({ error: "O arquivo excede o tamanho máximo de 25 MB" });
      return;
    }

    const name = body.name.trim().slice(0, 255) || "arquivo";

    const [created] = await insertReturning(db, taskAttachmentsTable, {
      taskId: task.id,
      name,
      contentType: body.contentType,
      size: actualSize,
      objectPath: body.objectPath,
      uploadedBy: req.user!.id,
    });

    res.status(201).json(toAttachment(created, req.user!.name));
  },
);

router.delete(
  "/attachments/:attachmentId",
  async (req: AuthRequest, res: Response) => {
    const [attachment] = await db
      .select()
      .from(taskAttachmentsTable)
      .where(eq(taskAttachmentsTable.id, Number(req.params.attachmentId)));
    if (!attachment) {
      res.status(404).json({ error: "Anexo não encontrado" });
      return;
    }
    const task = await getTaskForUser(req.user!, attachment.taskId);
    if (!task) {
      res.status(404).json({ error: "Anexo não encontrado" });
      return;
    }
    if (!(await requireTaskWrite(req.user!, attachment.taskId, res))) return;

    await db
      .delete(taskAttachmentsTable)
      .where(eq(taskAttachmentsTable.id, attachment.id));
    res.status(204).send();
  },
);

router.get(
  "/attachments/:attachmentId/file",
  async (req: AuthRequest, res: Response) => {
    const [attachment] = await db
      .select()
      .from(taskAttachmentsTable)
      .where(eq(taskAttachmentsTable.id, Number(req.params.attachmentId)));
    if (!attachment) {
      res.status(404).json({ error: "Anexo não encontrado" });
      return;
    }
    const task = await getTaskForUser(req.user!, attachment.taskId);
    if (!task) {
      res.status(404).json({ error: "Anexo não encontrado" });
      return;
    }

    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        attachment.objectPath,
      );
      const contentType = attachment.contentType || "application/octet-stream";
      const canInline =
        req.query.download !== "1" && INLINE_CONTENT_TYPES.has(contentType);
      res.setHeader("Content-Type", contentType);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader(
        "Content-Disposition",
        `${canInline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
      );
      res.setHeader("Cache-Control", "private, max-age=3600");
      const stream = objectFile.createReadStream();
      stream.on("error", (err) => {
        logger.error({ err }, "Erro ao transmitir anexo");
        if (!res.headersSent) {
          res.status(500).json({ error: "Falha ao baixar anexo" });
        } else {
          res.destroy();
        }
      });
      stream.pipe(res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "Arquivo não encontrado" });
        return;
      }
      logger.error({ err: error }, "Erro ao baixar anexo");
      res.status(500).json({ error: "Falha ao baixar anexo" });
    }
  },
);

export default router;
