import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  notesTable,
  mindmapsTable,
  tasksTable,
  projectsTable,
  itemLinksTable,
  insertReturning,
  insertIgnore,
  type Note,
  type LinkTargetType,
} from "@workspace/db";
import type { DbExecutor } from "./activity";
import { toNote } from "./serialize";

export type ItemRef = {
  type: LinkTargetType;
  id: number;
  title: string;
  projectId: number | null;
};

export type GraphNodeOut = {
  type: LinkTargetType;
  id: number;
  title: string;
  projectId: number | null;
};

export type GraphEdgeOut = {
  id: string;
  sourceType: LinkTargetType;
  sourceId: number;
  targetType: LinkTargetType;
  targetId: number;
};

const LINK_RE = /\[\[([^[\]\n]+)\]\]/g;

export function parseLinkTokens(content: string): string[] {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(content)) !== null) {
    const token = m[1].trim();
    if (token) set.add(token);
  }
  return Array.from(set);
}

async function resolveToken(
  ex: DbExecutor,
  workspaceId: number,
  token: string,
): Promise<{ type: LinkTargetType; id: number } | null> {
  const lower = token.toLowerCase();

  const [note] = await ex
    .select({ id: notesTable.id })
    .from(notesTable)
    .where(
      and(
        eq(notesTable.workspaceId, workspaceId),
        sql`lower(${notesTable.title}) = ${lower}`,
      ),
    )
    .orderBy(asc(notesTable.id))
    .limit(1);
  if (note) return { type: "note", id: note.id };

  const [mindmap] = await ex
    .select({ id: mindmapsTable.id })
    .from(mindmapsTable)
    .where(
      and(
        eq(mindmapsTable.workspaceId, workspaceId),
        sql`lower(${mindmapsTable.name}) = ${lower}`,
      ),
    )
    .orderBy(asc(mindmapsTable.id))
    .limit(1);
  if (mindmap) return { type: "mindmap", id: mindmap.id };

  const [task] = await ex
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .innerJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .where(
      and(
        eq(projectsTable.workspaceId, workspaceId),
        sql`lower(${tasksTable.title}) = ${lower}`,
      ),
    )
    .orderBy(asc(tasksTable.id))
    .limit(1);
  if (task) return { type: "task", id: task.id };

  return null;
}

export async function refreshNoteLinks(
  ex: DbExecutor,
  workspaceId: number,
  noteId: number,
  content: string,
): Promise<void> {
  await ex
    .delete(itemLinksTable)
    .where(eq(itemLinksTable.sourceNoteId, noteId));

  const tokens = parseLinkTokens(content);
  if (tokens.length === 0) return;

  const seen = new Set<string>();
  const values: {
    workspaceId: number;
    sourceNoteId: number;
    targetType: LinkTargetType;
    targetId: number;
  }[] = [];

  for (const token of tokens) {
    let target = await resolveToken(ex, workspaceId, token);
    if (!target) {
      const [created] = await insertReturning(ex, notesTable, {
        workspaceId,
        title: token,
        content: "",
      });
      target = { type: "note", id: created.id };
    }
    if (target.type === "note" && target.id === noteId) continue;
    const key = `${target.type}:${target.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    values.push({
      workspaceId,
      sourceNoteId: noteId,
      targetType: target.type,
      targetId: target.id,
    });
  }

  if (values.length > 0) {
    await insertIgnore(ex, itemLinksTable, values);
  }
}

export async function resolveItemRefs(
  ex: DbExecutor,
  workspaceId: number,
  refs: { type: LinkTargetType; id: number }[],
): Promise<ItemRef[]> {
  const noteIds = refs.filter((r) => r.type === "note").map((r) => r.id);
  const mindmapIds = refs.filter((r) => r.type === "mindmap").map((r) => r.id);
  const taskIds = refs.filter((r) => r.type === "task").map((r) => r.id);

  const noteTitles = new Map<number, string>();
  if (noteIds.length) {
    const rows = await ex
      .select({ id: notesTable.id, title: notesTable.title })
      .from(notesTable)
      .where(
        and(
          eq(notesTable.workspaceId, workspaceId),
          inArray(notesTable.id, noteIds),
        ),
      );
    rows.forEach((r) => noteTitles.set(r.id, r.title));
  }

  const mindmapTitles = new Map<number, string>();
  if (mindmapIds.length) {
    const rows = await ex
      .select({ id: mindmapsTable.id, name: mindmapsTable.name })
      .from(mindmapsTable)
      .where(
        and(
          eq(mindmapsTable.workspaceId, workspaceId),
          inArray(mindmapsTable.id, mindmapIds),
        ),
      );
    rows.forEach((r) => mindmapTitles.set(r.id, r.name));
  }

  const taskInfo = new Map<number, { title: string; projectId: number }>();
  if (taskIds.length) {
    const rows = await ex
      .select({
        id: tasksTable.id,
        title: tasksTable.title,
        projectId: tasksTable.projectId,
      })
      .from(tasksTable)
      .innerJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
      .where(
        and(
          eq(projectsTable.workspaceId, workspaceId),
          inArray(tasksTable.id, taskIds),
        ),
      );
    rows.forEach((r) =>
      taskInfo.set(r.id, { title: r.title, projectId: r.projectId }),
    );
  }

  const out: ItemRef[] = [];
  for (const ref of refs) {
    if (ref.type === "note") {
      const title = noteTitles.get(ref.id);
      if (title !== undefined)
        out.push({ type: "note", id: ref.id, title, projectId: null });
    } else if (ref.type === "mindmap") {
      const title = mindmapTitles.get(ref.id);
      if (title !== undefined)
        out.push({ type: "mindmap", id: ref.id, title, projectId: null });
    } else {
      const info = taskInfo.get(ref.id);
      if (info)
        out.push({
          type: "task",
          id: ref.id,
          title: info.title,
          projectId: info.projectId,
        });
    }
  }
  return out;
}

export async function getNoteDetail(ex: DbExecutor, note: Note) {
  const outgoing = await ex
    .select({
      targetType: itemLinksTable.targetType,
      targetId: itemLinksTable.targetId,
    })
    .from(itemLinksTable)
    .where(eq(itemLinksTable.sourceNoteId, note.id))
    .orderBy(asc(itemLinksTable.id));

  const backRows = await ex
    .select({ sourceNoteId: itemLinksTable.sourceNoteId })
    .from(itemLinksTable)
    .where(
      and(
        eq(itemLinksTable.workspaceId, note.workspaceId),
        eq(itemLinksTable.targetType, "note"),
        eq(itemLinksTable.targetId, note.id),
      ),
    )
    .orderBy(asc(itemLinksTable.sourceNoteId));

  const outgoingLinks = await resolveItemRefs(
    ex,
    note.workspaceId,
    outgoing.map((o) => ({ type: o.targetType, id: o.targetId })),
  );
  const backlinks = await resolveItemRefs(
    ex,
    note.workspaceId,
    backRows.map((b) => ({ type: "note" as LinkTargetType, id: b.sourceNoteId })),
  );

  return { note: toNote(note), outgoingLinks, backlinks };
}

export async function buildWorkspaceGraph(
  ex: DbExecutor,
  workspaceId: number,
): Promise<{ nodes: GraphNodeOut[]; edges: GraphEdgeOut[] }> {
  const notes = await ex
    .select({ id: notesTable.id, title: notesTable.title })
    .from(notesTable)
    .where(eq(notesTable.workspaceId, workspaceId))
    .orderBy(asc(notesTable.id));

  const mindmaps = await ex
    .select({
      id: mindmapsTable.id,
      name: mindmapsTable.name,
      taskId: mindmapsTable.taskId,
    })
    .from(mindmapsTable)
    .where(eq(mindmapsTable.workspaceId, workspaceId))
    .orderBy(asc(mindmapsTable.id));

  const links = await ex
    .select({
      id: itemLinksTable.id,
      sourceNoteId: itemLinksTable.sourceNoteId,
      targetType: itemLinksTable.targetType,
      targetId: itemLinksTable.targetId,
    })
    .from(itemLinksTable)
    .where(eq(itemLinksTable.workspaceId, workspaceId))
    .orderBy(asc(itemLinksTable.id));

  const wsTasks = await ex
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      projectId: tasksTable.projectId,
      mindmapId: tasksTable.mindmapId,
    })
    .from(tasksTable)
    .innerJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .where(eq(projectsTable.workspaceId, workspaceId));

  const mindmapIdSet = new Set(mindmaps.map((m) => m.id));
  const wsTaskMap = new Map(wsTasks.map((t) => [t.id, t]));

  const connectedTaskIds = new Set<number>();
  for (const l of links) if (l.targetType === "task") connectedTaskIds.add(l.targetId);
  for (const m of mindmaps) if (m.taskId != null) connectedTaskIds.add(m.taskId);
  for (const t of wsTasks)
    if (t.mindmapId != null && mindmapIdSet.has(t.mindmapId))
      connectedTaskIds.add(t.id);

  const taskNodes = Array.from(connectedTaskIds)
    .map((id) => wsTaskMap.get(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const noteIdSet = new Set(notes.map((n) => n.id));
  const taskIdSet = new Set(taskNodes.map((t) => t.id));

  const nodes: GraphNodeOut[] = [
    ...notes.map((n) => ({
      type: "note" as LinkTargetType,
      id: n.id,
      title: n.title,
      projectId: null,
    })),
    ...mindmaps.map((m) => ({
      type: "mindmap" as LinkTargetType,
      id: m.id,
      title: m.name,
      projectId: null,
    })),
    ...taskNodes.map((t) => ({
      type: "task" as LinkTargetType,
      id: t.id,
      title: t.title,
      projectId: t.projectId,
    })),
  ];

  const existsNode = (type: LinkTargetType, id: number) =>
    type === "note"
      ? noteIdSet.has(id)
      : type === "mindmap"
        ? mindmapIdSet.has(id)
        : taskIdSet.has(id);

  const edges: GraphEdgeOut[] = [];
  const edgeKeys = new Set<string>();
  const addEdge = (
    id: string,
    sourceType: LinkTargetType,
    sourceId: number,
    targetType: LinkTargetType,
    targetId: number,
  ) => {
    if (!existsNode(sourceType, sourceId)) return;
    if (!existsNode(targetType, targetId)) return;
    const key = `${sourceType}${sourceId}-${targetType}${targetId}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ id, sourceType, sourceId, targetType, targetId });
  };

  for (const l of links)
    addEdge(`il${l.id}`, "note", l.sourceNoteId, l.targetType, l.targetId);

  for (const m of mindmaps)
    if (m.taskId != null)
      addEdge(`mt${m.id}-${m.taskId}`, "mindmap", m.id, "task", m.taskId);

  for (const t of wsTasks)
    if (t.mindmapId != null)
      addEdge(`tm${t.mindmapId}-${t.id}`, "mindmap", t.mindmapId, "task", t.id);

  return { nodes, edges };
}
