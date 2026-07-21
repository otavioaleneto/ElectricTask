import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { db, usersTable, type User } from "@workspace/db";
import { eq } from "drizzle-orm";

export const SESSION_COOKIE = "flowdeck_session";
if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
  throw new Error(
    "SESSION_SECRET must be set in production. Refusing to start with an insecure default.",
  );
}

export const SESSION_SECRET =
  process.env.SESSION_SECRET ?? "flowdeck-dev-secret-change-me";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const keyBuffer = Buffer.from(key, "hex");
  const derived = scryptSync(password, salt, 64);
  if (keyBuffer.length !== derived.length) return false;
  return timingSafeEqual(keyBuffer, derived);
}

export interface AuthRequest extends Request {
  user?: User;
}

export function setSession(res: Response, userId: number): void {
  res.cookie(SESSION_COOKIE, String(userId), {
    httpOnly: true,
    sameSite: "lax",
    signed: true,
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(SESSION_COOKIE);
}

export async function loadUser(req: AuthRequest): Promise<User | null> {
  const raw = req.signedCookies?.[SESSION_COOKIE];
  if (!raw) return null;
  const userId = Number(raw);
  if (!Number.isInteger(userId)) return null;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return user ?? null;
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = await loadUser(req);
  if (!user) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  req.user = user;
  next();
}

export async function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = await loadUser(req);
  if (!user) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  if (user.role !== "admin") {
    res.status(403).json({ error: "Acesso restrito a administradores" });
    return;
  }
  req.user = user;
  next();
}
