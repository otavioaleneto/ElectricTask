import type { Server } from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  db,
  pool,
  usersTable,
  workspacesTable,
  workspaceMembersTable,
  projectsTable,
  columnsTable,
  tasksTable,
  insertReturning,
  type Task,
  type Workspace,
} from "@workspace/db";
import { inArray } from "drizzle-orm";
import app from "../app";
import { hashPassword } from "../lib/auth";

export const TEST_PASSWORD = "test-pass-123";

const createdUserIds: number[] = [];

export interface RunningServer {
  server: Server;
  baseUrl: string;
}

export async function startServer(): Promise<RunningServer> {
  // Em modo local (sem PRIVATE_OBJECT_DIR) os uploads iriam para cwd/uploads;
  // nos testes, redireciona para um diretório temporário.
  if (!process.env.PRIVATE_OBJECT_DIR && !process.env.LOCAL_UPLOADS_DIR) {
    process.env.LOCAL_UPLOADS_DIR = fs.mkdtempSync(
      path.join(os.tmpdir(), "flowdeck-test-uploads-"),
    );
  }
  const server = app.listen(0);
  await new Promise<void>((resolve) =>
    server.once("listening", () => resolve()),
  );
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

export async function stopServer(running: RunningServer): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    running.server.close((err) => (err ? reject(err) : resolve())),
  );
}

export async function createUser(opts?: {
  role?: "user" | "admin";
}): Promise<{ id: number; email: string }> {
  const email = `test-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}@example.test`;
  const [user] = await insertReturning(db, usersTable, {
    email,
    name: "Test User",
    passwordHash: hashPassword(TEST_PASSWORD),
    role: opts?.role ?? "user",
    theme: "dark",
  });
  createdUserIds.push(user.id);
  return { id: user.id, email };
}

export async function login(
  baseUrl: string,
  email: string,
  password: string = TEST_PASSWORD,
): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200) {
    throw new Error(`login failed with status ${res.status}`);
  }
  const setCookies = res.headers.getSetCookie();
  const cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
  if (!cookie) throw new Error("no session cookie returned from login");
  return cookie;
}

export interface TaskFixture {
  workspace: Workspace;
  projectId: number;
  columnId: number;
  task: Task;
}

export async function createWorkspaceWithTask(
  ownerId: number,
): Promise<TaskFixture> {
  const [workspace] = await insertReturning(db, workspacesTable, {
    ownerId,
    name: "Test WS",
    color: "#ef4444",
  });
  const [project] = await insertReturning(db, projectsTable, {
    workspaceId: workspace.id,
    name: "Test Project",
    position: 0,
  });
  const [column] = await insertReturning(db, columnsTable, {
    projectId: project.id,
    name: "Todo",
    color: "#ef4444",
    position: 0,
  });
  const [task] = await insertReturning(db, tasksTable, {
    projectId: project.id,
    columnId: column.id,
    title: "Test Task",
    priority: "medium",
    position: 0,
  });
  return { workspace, projectId: project.id, columnId: column.id, task };
}

export async function addWorkspaceMember(
  workspaceId: number,
  userId: number,
  role: "owner" | "editor" | "viewer",
): Promise<void> {
  await db
    .insert(workspaceMembersTable)
    .values({ workspaceId, userId, role });
}

export async function cleanup(): Promise<void> {
  if (createdUserIds.length > 0) {
    await db
      .delete(usersTable)
      .where(inArray(usersTable.id, createdUserIds));
    createdUserIds.length = 0;
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
