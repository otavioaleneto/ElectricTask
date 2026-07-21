import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  avatarUrl: text("avatar_url"),
  theme: text("theme").notNull().default("dark"),
  securityQuestion1: text("security_question_1"),
  securityQuestion2: text("security_question_2"),
  securityQuestion3: text("security_question_3"),
  securityAnswerHash1: text("security_answer_hash_1"),
  securityAnswerHash2: text("security_answer_hash_2"),
  securityAnswerHash3: text("security_answer_hash_3"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
