import type { Response } from "express";

type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: { issues: { message?: string }[] } };

interface Parseable<T> {
  safeParse(data: unknown): SafeParseResult<T>;
}

export function parseBody<T>(
  schema: Parseable<T>,
  body: unknown,
  res: Response,
): T | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    res
      .status(400)
      .json({ error: result.error.issues[0]?.message ?? "Dados inválidos" });
    return null;
  }
  return result.data;
}
