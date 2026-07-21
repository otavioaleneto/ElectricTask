import {
  pgTable,
  text,
  serial,
  integer,
  jsonb,
  timestamp,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";

export type MindmapNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  color?: string | null;
  details?: string | null;
  type?:
    | "text"
    | "project"
    | "label"
    | "hotspot"
    | "mindmap"
    | "task"
    | "light"
    | null;
  projectId?: number | null;
  mindmapId?: number | null;
  taskId?: number | null;
  icon?: string | null;
};

export type MindmapEdge = {
  id: string;
  source: string;
  target: string;
  directed?: boolean | null;
};

export type MindmapArea = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  label?: string | null;
};

export type MindmapElement = {
  id: string;
  shape: "arrow" | "circle" | "square" | "triangle" | "diamond";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number | null;
  color?: string | null;
};

export type MindmapDataShape = {
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  areas?: MindmapArea[];
  elements?: MindmapElement[];
};

export const mindmapsTable = pgTable("mindmaps", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  data: jsonb("data")
    .notNull()
    .$type<MindmapDataShape>()
    .default({ nodes: [], edges: [] }),
  taskId: integer("task_id"),
  parentId: integer("parent_id").references(
    (): AnyPgColumn => mindmapsTable.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Mindmap = typeof mindmapsTable.$inferSelect;
export type InsertMindmap = typeof mindmapsTable.$inferInsert;
