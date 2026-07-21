import {
  pgTable,
  serial,
  integer,
  text,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { notesTable } from "./notes";

export type LinkTargetType = "note" | "mindmap" | "task";

export const itemLinksTable = pgTable(
  "item_links",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    sourceNoteId: integer("source_note_id")
      .notNull()
      .references(() => notesTable.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull().$type<LinkTargetType>(),
    targetId: integer("target_id").notNull(),
  },
  (t) => ({
    uniqSourceTarget: uniqueIndex("item_links_source_target_uniq").on(
      t.sourceNoteId,
      t.targetType,
      t.targetId,
    ),
    byWorkspace: index("item_links_workspace_idx").on(t.workspaceId),
    byTarget: index("item_links_target_idx").on(
      t.workspaceId,
      t.targetType,
      t.targetId,
    ),
  }),
);

export type ItemLink = typeof itemLinksTable.$inferSelect;
export type InsertItemLink = typeof itemLinksTable.$inferInsert;
