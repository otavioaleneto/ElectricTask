import {
  db,
  workspacesTable,
  workspaceMembersTable,
  projectsTable,
  columnsTable,
  tasksTable,
  labelsTable,
  mindmapsTable,
  checklistsTable,
  checklistItemsTable,
  notesTable,
  type User,
  type Workspace,
  type Project,
  type Task,
  type Note,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { Response } from "express";

export type WorkspaceRole = "owner" | "editor" | "viewer";

async function membershipRole(
  userId: number,
  workspaceId: number,
): Promise<WorkspaceRole | null> {
  const [member] = await db
    .select()
    .from(workspaceMembersTable)
    .where(
      and(
        eq(workspaceMembersTable.workspaceId, workspaceId),
        eq(workspaceMembersTable.userId, userId),
      ),
    );
  return member ? (member.role as WorkspaceRole) : null;
}

export async function getWorkspaceRoleForUser(
  user: User,
  workspaceId: number,
): Promise<WorkspaceRole | null> {
  const [ws] = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId));
  if (!ws) return null;
  if (user.role === "admin") return "owner";
  if (ws.ownerId === user.id) return "owner";
  return membershipRole(user.id, workspaceId);
}

export async function getWorkspaceForUser(
  user: User,
  workspaceId: number,
): Promise<Workspace | null> {
  const [ws] = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId));
  if (!ws) return null;
  if (user.role === "admin" || ws.ownerId === user.id) return ws;
  const role = await membershipRole(user.id, workspaceId);
  return role ? ws : null;
}

export async function getAccessibleWorkspaceIds(user: User): Promise<number[]> {
  if (user.role === "admin") {
    const rows = await db
      .select({ id: workspacesTable.id })
      .from(workspacesTable);
    return rows.map((r) => r.id);
  }
  const owned = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(eq(workspacesTable.ownerId, user.id));
  const member = await db
    .select({ id: workspaceMembersTable.workspaceId })
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.userId, user.id));
  return Array.from(
    new Set([...owned.map((r) => r.id), ...member.map((r) => r.id)]),
  );
}

export async function isWorkspaceMemberUser(
  workspaceId: number,
  userId: number,
): Promise<boolean> {
  const [ws] = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId));
  if (!ws) return false;
  if (ws.ownerId === userId) return true;
  const role = await membershipRole(userId, workspaceId);
  return role !== null;
}

export async function getProjectForUser(
  user: User,
  projectId: number,
): Promise<Project | null> {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));
  if (!project) return null;
  const ws = await getWorkspaceForUser(user, project.workspaceId);
  if (!ws) return null;
  return project;
}

export async function getColumnForUser(user: User, columnId: number) {
  const [column] = await db
    .select()
    .from(columnsTable)
    .where(eq(columnsTable.id, columnId));
  if (!column) return null;
  const project = await getProjectForUser(user, column.projectId);
  if (!project) return null;
  return column;
}

export async function getTaskForUser(
  user: User,
  taskId: number,
): Promise<Task | null> {
  const [task] = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, taskId));
  if (!task) return null;
  const project = await getProjectForUser(user, task.projectId);
  if (!project) return null;
  return task;
}

export async function getLabelForUser(user: User, labelId: number) {
  const [label] = await db
    .select()
    .from(labelsTable)
    .where(eq(labelsTable.id, labelId));
  if (!label) return null;
  const project = await getProjectForUser(user, label.projectId);
  if (!project) return null;
  return label;
}

export async function getChecklistForUser(user: User, checklistId: number) {
  const [checklist] = await db
    .select()
    .from(checklistsTable)
    .where(eq(checklistsTable.id, checklistId));
  if (!checklist) return null;
  const task = await getTaskForUser(user, checklist.taskId);
  if (!task) return null;
  return checklist;
}

export async function getChecklistItemForUser(user: User, itemId: number) {
  const [item] = await db
    .select()
    .from(checklistItemsTable)
    .where(eq(checklistItemsTable.id, itemId));
  if (!item) return null;
  const checklist = await getChecklistForUser(user, item.checklistId);
  if (!checklist) return null;
  return item;
}

export async function getMindmapForUser(user: User, mindmapId: number) {
  const [mindmap] = await db
    .select()
    .from(mindmapsTable)
    .where(eq(mindmapsTable.id, mindmapId));
  if (!mindmap) return null;
  const ws = await getWorkspaceForUser(user, mindmap.workspaceId);
  if (!ws) return null;
  return mindmap;
}

export async function getNoteForUser(
  user: User,
  noteId: number,
): Promise<Note | null> {
  const [note] = await db
    .select()
    .from(notesTable)
    .where(eq(notesTable.id, noteId));
  if (!note) return null;
  const ws = await getWorkspaceForUser(user, note.workspaceId);
  if (!ws) return null;
  return note;
}

export async function requireWorkspaceWrite(
  user: User,
  workspaceId: number,
  res: Response,
): Promise<boolean> {
  const role = await getWorkspaceRoleForUser(user, workspaceId);
  if (role === null) {
    res.status(404).json({ error: "Workspace não encontrado" });
    return false;
  }
  if (role === "viewer") {
    res
      .status(403)
      .json({ error: "Você não tem permissão para editar este workspace" });
    return false;
  }
  return true;
}

export async function requireWorkspaceManage(
  user: User,
  workspaceId: number,
  res: Response,
): Promise<boolean> {
  const role = await getWorkspaceRoleForUser(user, workspaceId);
  if (role === null) {
    res.status(404).json({ error: "Workspace não encontrado" });
    return false;
  }
  if (role !== "owner") {
    res
      .status(403)
      .json({ error: "Apenas o dono pode gerenciar este workspace" });
    return false;
  }
  return true;
}

export async function requireProjectWrite(
  user: User,
  projectId: number,
  res: Response,
): Promise<boolean> {
  const [project] = await db
    .select({ workspaceId: projectsTable.workspaceId })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));
  if (!project) {
    res.status(404).json({ error: "Projeto não encontrado" });
    return false;
  }
  return requireWorkspaceWrite(user, project.workspaceId, res);
}

export async function requireTaskWrite(
  user: User,
  taskId: number,
  res: Response,
): Promise<boolean> {
  const [task] = await db
    .select({ projectId: tasksTable.projectId })
    .from(tasksTable)
    .where(eq(tasksTable.id, taskId));
  if (!task) {
    res.status(404).json({ error: "Tarefa não encontrada" });
    return false;
  }
  return requireProjectWrite(user, task.projectId, res);
}

export async function requireChecklistWrite(
  user: User,
  checklistId: number,
  res: Response,
): Promise<boolean> {
  const [checklist] = await db
    .select({ taskId: checklistsTable.taskId })
    .from(checklistsTable)
    .where(eq(checklistsTable.id, checklistId));
  if (!checklist) {
    res.status(404).json({ error: "Checklist não encontrada" });
    return false;
  }
  return requireTaskWrite(user, checklist.taskId, res);
}
