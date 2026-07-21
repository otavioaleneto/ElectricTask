import { Router, type IRouter, type Response } from "express";
import {
  db,
  notificationsTable,
  tasksTable,
  projectsTable,
  subscriptionsTable,
  usersTable,
} from "@workspace/db";
import { and, eq, desc, inArray, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { getAccessibleWorkspaceIds } from "../lib/access";
import { toNotification } from "../lib/serialize";
import {
  ensureDueSoonNotifications,
  ensureSubscriptionNotifications,
} from "../lib/notifications";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/notifications", async (req: AuthRequest, res: Response) => {
  await ensureDueSoonNotifications(req.user!);
  await ensureSubscriptionNotifications(req.user!);
  const workspaceIds = await getAccessibleWorkspaceIds(req.user!);
  if (workspaceIds.length === 0) {
    res.status(200).json([]);
    return;
  }
  const taskRows = await db
    .select({
      id: notificationsTable.id,
      type: notificationsTable.type,
      read: notificationsTable.read,
      createdAt: notificationsTable.createdAt,
      taskId: tasksTable.id,
      projectId: tasksTable.projectId,
      taskTitle: tasksTable.title,
      actorId: usersTable.id,
      actorName: usersTable.name,
      actorAvatar: usersTable.avatarUrl,
    })
    .from(notificationsTable)
    .innerJoin(tasksTable, eq(notificationsTable.taskId, tasksTable.id))
    .innerJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .leftJoin(usersTable, eq(notificationsTable.actorId, usersTable.id))
    .where(
      and(
        eq(notificationsTable.userId, req.user!.id),
        inArray(projectsTable.workspaceId, workspaceIds),
      ),
    );

  const subRows = await db
    .select({
      id: notificationsTable.id,
      type: notificationsTable.type,
      read: notificationsTable.read,
      createdAt: notificationsTable.createdAt,
      subId: subscriptionsTable.id,
      companySlug: subscriptionsTable.companySlug,
      customName: subscriptionsTable.customName,
      customColor: subscriptionsTable.customColor,
      amountCents: subscriptionsTable.amountCents,
      currency: subscriptionsTable.currency,
      nextDueDate: subscriptionsTable.nextDueDate,
      paymentType: subscriptionsTable.paymentType,
    })
    .from(notificationsTable)
    .innerJoin(
      subscriptionsTable,
      eq(notificationsTable.subscriptionId, subscriptionsTable.id),
    )
    .where(
      and(
        eq(notificationsTable.userId, req.user!.id),
        inArray(subscriptionsTable.workspaceId, workspaceIds),
      ),
    );

  const taskNotifs = taskRows.map((r) =>
    toNotification(
      { id: r.id, type: r.type, read: r.read, createdAt: r.createdAt },
      { id: r.taskId, projectId: r.projectId, title: r.taskTitle },
      r.actorId != null
        ? {
            id: r.actorId,
            name: r.actorName ?? "",
            avatarUrl: r.actorAvatar ?? null,
          }
        : null,
    ),
  );
  const subNotifs = subRows.map((r) =>
    toNotification(
      { id: r.id, type: r.type, read: r.read, createdAt: r.createdAt },
      null,
      null,
      {
        id: r.subId,
        companySlug: r.companySlug,
        customName: r.customName,
        customColor: r.customColor,
        amountCents: r.amountCents,
        currency: r.currency,
        nextDueDate: r.nextDueDate,
        paymentType: r.paymentType,
      },
    ),
  );

  const all = [...taskNotifs, ...subNotifs].sort((a, b) => {
    const t =
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return t !== 0 ? t : b.id - a.id;
  });
  res.status(200).json(all);
});

router.get(
  "/notifications/unread-count",
  async (req: AuthRequest, res: Response) => {
    await ensureDueSoonNotifications(req.user!);
    await ensureSubscriptionNotifications(req.user!);
    const workspaceIds = await getAccessibleWorkspaceIds(req.user!);
    if (workspaceIds.length === 0) {
      res.status(200).json({ count: 0 });
      return;
    }
    const [taskCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notificationsTable)
      .innerJoin(tasksTable, eq(notificationsTable.taskId, tasksTable.id))
      .innerJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
      .where(
        and(
          eq(notificationsTable.userId, req.user!.id),
          eq(notificationsTable.read, false),
          inArray(projectsTable.workspaceId, workspaceIds),
        ),
      );
    const [subCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notificationsTable)
      .innerJoin(
        subscriptionsTable,
        eq(notificationsTable.subscriptionId, subscriptionsTable.id),
      )
      .where(
        and(
          eq(notificationsTable.userId, req.user!.id),
          eq(notificationsTable.read, false),
          inArray(subscriptionsTable.workspaceId, workspaceIds),
        ),
      );
    res.status(200).json({
      count: Number(taskCount?.count ?? 0) + Number(subCount?.count ?? 0),
    });
  },
);

router.post(
  "/notifications/read-all",
  async (req: AuthRequest, res: Response) => {
    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(
        and(
          eq(notificationsTable.userId, req.user!.id),
          eq(notificationsTable.read, false),
        ),
      );
    res.status(204).send();
  },
);

router.post(
  "/notifications/:notificationId/read",
  async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.notificationId);
    const [notification] = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, id));
    if (!notification || notification.userId !== req.user!.id) {
      res.status(404).json({ error: "Notificação não encontrada" });
      return;
    }
    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(eq(notificationsTable.id, id));
    res.status(204).send();
  },
);

export default router;
