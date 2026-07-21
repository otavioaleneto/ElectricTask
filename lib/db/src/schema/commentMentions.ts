import { pgTable, serial, integer, unique } from "drizzle-orm/pg-core";
import { commentsTable } from "./comments";
import { usersTable } from "./users";

export const commentMentionsTable = pgTable(
  "comment_mentions",
  {
    id: serial("id").primaryKey(),
    commentId: integer("comment_id")
      .notNull()
      .references(() => commentsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
  },
  (t) => ({
    uniqCommentUser: unique().on(t.commentId, t.userId),
  }),
);

export type CommentMention = typeof commentMentionsTable.$inferSelect;
export type InsertCommentMention = typeof commentMentionsTable.$inferInsert;
