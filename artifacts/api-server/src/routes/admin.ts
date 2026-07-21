import { Router, type IRouter, type Response } from "express";
import {
  db,
  usersTable,
  workspacesTable,
  projectsTable,
  tasksTable,
  insertReturning,
  updateReturning,
  type User,
} from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { CreateUserBody, UpdateUserBody } from "@workspace/api-zod";
import { requireAdmin, hashPassword, type AuthRequest } from "../lib/auth";
import { parseBody } from "../lib/validate";
import { avatarSrc } from "../lib/serialize";

const router: IRouter = Router();

router.use(requireAdmin);

async function toAdminUser(u: User) {
  const [wsRow] = await db
    .select({ value: count() })
    .from(workspacesTable)
    .where(eq(workspacesTable.ownerId, u.id));
  const workspaceCount = wsRow?.value ?? 0;

  const wsIds = (
    await db
      .select({ id: workspacesTable.id })
      .from(workspacesTable)
      .where(eq(workspacesTable.ownerId, u.id))
  ).map((w) => w.id);

  let projectCount = 0;
  for (const wsId of wsIds) {
    const [pRow] = await db
      .select({ value: count() })
      .from(projectsTable)
      .where(eq(projectsTable.workspaceId, wsId));
    projectCount += pRow?.value ?? 0;
  }

  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as "user" | "admin",
    avatarUrl: avatarSrc(u.id, u.avatarUrl),
    createdAt: u.createdAt.toISOString(),
    workspaceCount,
    projectCount,
  };
}

router.get("/admin/users", async (_req: AuthRequest, res: Response) => {
  const users = await db
    .select()
    .from(usersTable)
    .orderBy(desc(usersTable.id));
  const result = await Promise.all(users.map(toAdminUser));
  res.status(200).json(result);
});

router.post("/admin/users", async (req: AuthRequest, res: Response) => {
  const body = parseBody(CreateUserBody, req.body, res);
  if (!body) return;
  const email = body.email.toLowerCase().trim();
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));
  if (existing) {
    res.status(400).json({ error: "E-mail já cadastrado" });
    return;
  }
  const [user] = await insertReturning(db, usersTable, {
    email,
    name: body.name,
    passwordHash: hashPassword(body.password),
    role: body.role ?? "user",
  });
  res.status(201).json(await toAdminUser(user));
});

router.patch("/admin/users/:userId", async (req: AuthRequest, res: Response) => {
  const userId = Number(req.params.userId);
  const [target] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!target) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  const body = parseBody(UpdateUserBody, req.body, res);
  if (!body) return;
  const [updated] = await updateReturning(
    db,
    usersTable,
    {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.role !== undefined ? { role: body.role } : {}),
      ...(body.password !== undefined
        ? { passwordHash: hashPassword(body.password) }
        : {}),
    },
    eq(usersTable.id, userId),
  );
  res.status(200).json(await toAdminUser(updated));
});

router.delete(
  "/admin/users/:userId",
  async (req: AuthRequest, res: Response) => {
    const userId = Number(req.params.userId);
    if (userId === req.user!.id) {
      res
        .status(400)
        .json({ error: "Você não pode excluir a própria conta" });
      return;
    }
    const [target] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    if (!target) {
      res.status(404).json({ error: "Usuário não encontrado" });
      return;
    }
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    res.status(204).send();
  },
);

router.get("/admin/stats", async (_req: AuthRequest, res: Response) => {
  const allUsers = await db.select().from(usersTable);
  const [wsRow] = await db.select({ value: count() }).from(workspacesTable);
  const [pRow] = await db.select({ value: count() }).from(projectsTable);
  const [tRow] = await db.select({ value: count() }).from(tasksTable);

  const recent = await db
    .select()
    .from(usersTable)
    .orderBy(desc(usersTable.id))
    .limit(5);
  const recentUsers = await Promise.all(recent.map(toAdminUser));

  res.status(200).json({
    userCount: allUsers.filter((u) => u.role === "user").length,
    adminCount: allUsers.filter((u) => u.role === "admin").length,
    workspaceCount: wsRow?.value ?? 0,
    projectCount: pRow?.value ?? 0,
    taskCount: tRow?.value ?? 0,
    recentUsers,
  });
});

export default router;
