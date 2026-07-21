import { Router, type IRouter, type Response } from "express";
import {
  db,
  workspacesTable,
  workspaceMembersTable,
  usersTable,
  projectsTable,
  tasksTable,
  insertReturning,
  updateReturning,
} from "@workspace/db";
import { and, eq, sql, inArray } from "drizzle-orm";
import {
  AddWorkspaceMemberBody,
  UpdateWorkspaceMemberRoleBody,
} from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { parseBody } from "../lib/validate";
import { toWorkspaceMember } from "../lib/serialize";
import { getWorkspaceForUser, requireWorkspaceManage } from "../lib/access";

const router: IRouter = Router();

router.use(requireAuth);

router.get(
  "/workspaces/:workspaceId/members",
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
      .select({
        userId: workspaceMembersTable.userId,
        role: workspaceMembersTable.role,
        createdAt: workspaceMembersTable.createdAt,
        name: usersTable.name,
        email: usersTable.email,
        avatarUrl: usersTable.avatarUrl,
      })
      .from(workspaceMembersTable)
      .innerJoin(usersTable, eq(workspaceMembersTable.userId, usersTable.id))
      .where(eq(workspaceMembersTable.workspaceId, ws.id))
      .orderBy(workspaceMembersTable.createdAt);
    res.status(200).json(rows.map(toWorkspaceMember));
  },
);

router.post(
  "/workspaces/:workspaceId/members",
  async (req: AuthRequest, res: Response) => {
    const workspaceId = Number(req.params.workspaceId);
    if (!(await requireWorkspaceManage(req.user!, workspaceId, res))) return;
    const body = parseBody(AddWorkspaceMemberBody, req.body, res);
    if (!body) return;

    const email = body.email.trim().toLowerCase();
    const [target] = await db
      .select()
      .from(usersTable)
      .where(sql`lower(${usersTable.email}) = ${email}`);
    if (!target) {
      res.status(404).json({ error: "Usuário não encontrado" });
      return;
    }
    if (target.role === "admin") {
      res.status(400).json({
        error: "Administradores já têm acesso a todos os workspaces",
      });
      return;
    }

    const existing = await db
      .select()
      .from(workspaceMembersTable)
      .where(
        and(
          eq(workspaceMembersTable.workspaceId, workspaceId),
          eq(workspaceMembersTable.userId, target.id),
        ),
      );
    if (existing.length > 0) {
      res.status(400).json({ error: "Usuário já é membro deste workspace" });
      return;
    }

    const role = body.role ?? "editor";
    const [member] = await insertReturning(db, workspaceMembersTable, {
      workspaceId,
      userId: target.id,
      role,
    });
    res.status(201).json(
      toWorkspaceMember({
        userId: target.id,
        name: target.name,
        email: target.email,
        avatarUrl: target.avatarUrl,
        role: member.role,
        createdAt: member.createdAt,
      }),
    );
  },
);

router.patch(
  "/workspaces/:workspaceId/members/:userId",
  async (req: AuthRequest, res: Response) => {
    const workspaceId = Number(req.params.workspaceId);
    const userId = Number(req.params.userId);
    if (!(await requireWorkspaceManage(req.user!, workspaceId, res))) return;
    const body = parseBody(UpdateWorkspaceMemberRoleBody, req.body, res);
    if (!body) return;

    const [ws] = await db
      .select()
      .from(workspacesTable)
      .where(eq(workspacesTable.id, workspaceId));
    if (ws && ws.ownerId === userId && body.role !== "owner") {
      res
        .status(400)
        .json({ error: "Não é possível alterar o papel do dono principal" });
      return;
    }

    const [member] = await db
      .select()
      .from(workspaceMembersTable)
      .where(
        and(
          eq(workspaceMembersTable.workspaceId, workspaceId),
          eq(workspaceMembersTable.userId, userId),
        ),
      );
    if (!member) {
      res.status(404).json({ error: "Membro não encontrado" });
      return;
    }

    const [updated] = await updateReturning(
      db,
      workspaceMembersTable,
      { role: body.role },
      eq(workspaceMembersTable.id, member.id),
    );
    const [u] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    res.status(200).json(
      toWorkspaceMember({
        userId,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl,
        role: updated.role,
        createdAt: updated.createdAt,
      }),
    );
  },
);

router.delete(
  "/workspaces/:workspaceId/members/:userId",
  async (req: AuthRequest, res: Response) => {
    const workspaceId = Number(req.params.workspaceId);
    const userId = Number(req.params.userId);
    if (!(await requireWorkspaceManage(req.user!, workspaceId, res))) return;

    const [ws] = await db
      .select()
      .from(workspacesTable)
      .where(eq(workspacesTable.id, workspaceId));
    if (ws && ws.ownerId === userId) {
      res
        .status(400)
        .json({ error: "Não é possível remover o dono principal do workspace" });
      return;
    }

    const [member] = await db
      .select()
      .from(workspaceMembersTable)
      .where(
        and(
          eq(workspaceMembersTable.workspaceId, workspaceId),
          eq(workspaceMembersTable.userId, userId),
        ),
      );
    if (!member) {
      res.status(404).json({ error: "Membro não encontrado" });
      return;
    }

    await db
      .update(tasksTable)
      .set({ assigneeId: null })
      .where(
        and(
          eq(tasksTable.assigneeId, userId),
          inArray(
            tasksTable.projectId,
            db
              .select({ id: projectsTable.id })
              .from(projectsTable)
              .where(eq(projectsTable.workspaceId, workspaceId)),
          ),
        ),
      );

    await db
      .delete(workspaceMembersTable)
      .where(eq(workspaceMembersTable.id, member.id));
    res.status(204).send();
  },
);

export default router;
