import { Router, type IRouter, type Response } from "express";
import {
  db,
  commentsTable,
  commentMentionsTable,
  usersTable,
  insertReturning,
} from "@workspace/db";
import { eq, and, inArray, asc } from "drizzle-orm";
import { CreateCommentBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { parseBody } from "../lib/validate";
import { toComment, type UserMini } from "../lib/serialize";
import { createNotification } from "../lib/notifications";
import {
  getTaskForUser,
  getProjectForUser,
  isWorkspaceMemberUser,
} from "../lib/access";

const router: IRouter = Router();

router.use(requireAuth);

async function userMinisByIds(ids: number[]): Promise<Map<number, UserMini>> {
  const map = new Map<number, UserMini>();
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return map;
  const rows = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(usersTable)
    .where(inArray(usersTable.id, unique));
  for (const r of rows) {
    map.set(r.id, { id: r.id, name: r.name, avatarUrl: r.avatarUrl ?? null });
  }
  return map;
}

router.get(
  "/tasks/:taskId/comments",
  async (req: AuthRequest, res: Response) => {
    const task = await getTaskForUser(req.user!, Number(req.params.taskId));
    if (!task) {
      res.status(404).json({ error: "Tarefa não encontrada" });
      return;
    }
    const rows = await db
      .select({
        id: commentsTable.id,
        taskId: commentsTable.taskId,
        body: commentsTable.body,
        createdAt: commentsTable.createdAt,
        authorId: usersTable.id,
        authorName: usersTable.name,
        authorAvatar: usersTable.avatarUrl,
      })
      .from(commentsTable)
      .innerJoin(usersTable, eq(commentsTable.userId, usersTable.id))
      .where(eq(commentsTable.taskId, task.id))
      .orderBy(asc(commentsTable.createdAt), asc(commentsTable.id));

    const commentIds = rows.map((r) => r.id);
    const mentionsByComment = new Map<number, UserMini[]>();
    if (commentIds.length > 0) {
      const mentionRows = await db
        .select({
          commentId: commentMentionsTable.commentId,
          userId: usersTable.id,
          name: usersTable.name,
          avatarUrl: usersTable.avatarUrl,
        })
        .from(commentMentionsTable)
        .innerJoin(
          usersTable,
          eq(commentMentionsTable.userId, usersTable.id),
        )
        .where(inArray(commentMentionsTable.commentId, commentIds));
      for (const m of mentionRows) {
        const list = mentionsByComment.get(m.commentId) ?? [];
        list.push({
          id: m.userId,
          name: m.name,
          avatarUrl: m.avatarUrl ?? null,
        });
        mentionsByComment.set(m.commentId, list);
      }
    }

    res.status(200).json(
      rows.map((r) =>
        toComment(
          {
            id: r.id,
            taskId: r.taskId,
            body: r.body,
            createdAt: r.createdAt,
          },
          {
            id: r.authorId,
            name: r.authorName,
            avatarUrl: r.authorAvatar ?? null,
          },
          mentionsByComment.get(r.id) ?? [],
        ),
      ),
    );
  },
);

router.post(
  "/tasks/:taskId/comments",
  async (req: AuthRequest, res: Response) => {
    const task = await getTaskForUser(req.user!, Number(req.params.taskId));
    if (!task) {
      res.status(404).json({ error: "Tarefa não encontrada" });
      return;
    }
    const body = parseBody(CreateCommentBody, req.body, res);
    if (!body) return;

    const project = await getProjectForUser(req.user!, task.projectId);
    if (!project) {
      res.status(404).json({ error: "Tarefa não encontrada" });
      return;
    }

    const mentionIds = Array.from(new Set(body.mentionedUserIds ?? []));
    for (const userId of mentionIds) {
      if (!(await isWorkspaceMemberUser(project.workspaceId, userId))) {
        res.status(400).json({ error: "Menção inválida" });
        return;
      }
    }

    const comment = await db.transaction(async (tx) => {
      const [created] = await insertReturning(tx, commentsTable, {
        taskId: task.id,
        userId: req.user!.id,
        body: body.body,
      });
      if (mentionIds.length > 0) {
        await tx.insert(commentMentionsTable).values(
          mentionIds.map((userId) => ({
            commentId: created.id,
            userId,
          })),
        );
        for (const userId of mentionIds) {
          if (userId !== req.user!.id) {
            await createNotification(tx, {
              userId,
              type: "mentioned",
              taskId: task.id,
              actorId: req.user!.id,
            });
          }
        }
      }
      return created;
    });

    const mentionMap = await userMinisByIds(mentionIds);
    const mentions = mentionIds
      .map((id) => mentionMap.get(id))
      .filter((m): m is UserMini => m != null);

    res.status(201).json(
      toComment(
        {
          id: comment.id,
          taskId: comment.taskId,
          body: comment.body,
          createdAt: comment.createdAt,
        },
        {
          id: req.user!.id,
          name: req.user!.name,
          avatarUrl: req.user!.avatarUrl ?? null,
        },
        mentions,
      ),
    );
  },
);

router.delete(
  "/comments/:commentId",
  async (req: AuthRequest, res: Response) => {
    const [comment] = await db
      .select()
      .from(commentsTable)
      .where(eq(commentsTable.id, Number(req.params.commentId)));
    if (!comment) {
      res.status(404).json({ error: "Comentário não encontrado" });
      return;
    }
    const task = await getTaskForUser(req.user!, comment.taskId);
    if (!task) {
      res.status(404).json({ error: "Comentário não encontrado" });
      return;
    }
    if (comment.userId !== req.user!.id) {
      res
        .status(403)
        .json({ error: "Apenas o autor pode excluir o comentário" });
      return;
    }
    await db.delete(commentsTable).where(eq(commentsTable.id, comment.id));
    res.status(204).send();
  },
);

export default router;
