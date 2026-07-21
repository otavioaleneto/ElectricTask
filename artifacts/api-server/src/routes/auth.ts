import { Router, type IRouter, type Response } from "express";
import {
  db,
  usersTable,
  workspacesTable,
  workspaceMembersTable,
  insertReturning,
  insertIgnore,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  LoginBody,
  UpdatePreferencesBody,
  RegisterBody,
  UpdateProfileBody,
  ChangePasswordBody,
  UpdateSecurityQuestionsBody,
  SetAvatarBody,
  GetRecoveryQuestionsBody,
  ResetPasswordWithQuestionsBody,
} from "@workspace/api-zod";
import {
  hashPassword,
  verifyPassword,
  setSession,
  clearSession,
  requireAuth,
  loadUser,
  type AuthRequest,
} from "../lib/auth";
import { parseBody } from "../lib/validate";
import {
  checkRateLimit,
  registerFailure,
  clearRateLimit,
} from "../lib/rateLimit";
import { toAuthUser } from "../lib/serialize";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "../lib/objectStorage";
import { logger } from "../lib/logger";
import { seedTutorialWorkspace } from "../lib/tutorialSeed";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const AVATAR_MAX_SIZE = 5 * 1024 * 1024;

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function normalizeAnswer(answer: string): string {
  return answer.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function clientIp(req: { ip?: string; socket?: { remoteAddress?: string } }): string {
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

router.post("/auth/login", async (req, res: Response) => {
  const body = parseBody(LoginBody, req.body, res);
  if (!body) return;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalizeEmail(body.email)));
  if (!user || !verifyPassword(body.password, user.passwordHash)) {
    res.status(401).json({ error: "E-mail ou senha inválidos" });
    return;
  }
  setSession(res, user.id);
  res.status(200).json(toAuthUser(user));
});

router.post("/auth/register", async (req, res: Response) => {
  const body = parseBody(RegisterBody, req.body, res);
  if (!body) return;
  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    res.status(400).json({ error: "E-mail inválido" });
    return;
  }
  const name = body.name.trim();
  if (!name) {
    res.status(400).json({ error: "Nome inválido" });
    return;
  }
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));
  if (existing) {
    res.status(400).json({ error: "E-mail já cadastrado" });
    return;
  }

  const created = await db.transaction(async (tx) => {
    const [user] = await insertReturning(tx, usersTable, {
      email,
      name,
      passwordHash: hashPassword(body.password),
      role: "user",
      securityQuestion1: body.question1.trim(),
      securityQuestion2: body.question2.trim(),
      securityQuestion3: body.question3.trim(),
      securityAnswerHash1: hashPassword(normalizeAnswer(body.answer1)),
      securityAnswerHash2: hashPassword(normalizeAnswer(body.answer2)),
      securityAnswerHash3: hashPassword(normalizeAnswer(body.answer3)),
    });
    const [ws] = await insertReturning(tx, workspacesTable, {
      ownerId: user.id,
      name: "Meu Workspace",
      description: null,
      color: "#3b82f6",
    });
    await insertIgnore(tx, workspaceMembersTable, {
      workspaceId: ws.id,
      userId: user.id,
      role: "owner",
    });
    return user;
  });

  // Seed do workspace Tutorial — falha não bloqueia o cadastro
  try {
    await seedTutorialWorkspace(created.id);
  } catch (err) {
    logger.error({ err, userId: created.id }, "Falha ao criar workspace Tutorial");
  }

  setSession(res, created.id);
  res.status(201).json(toAuthUser(created));
});

router.post("/auth/logout", (_req, res: Response) => {
  clearSession(res);
  res.status(200).json({ success: true });
});

router.get("/auth/me", async (req: AuthRequest, res: Response) => {
  const user = await loadUser(req);
  if (!user) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  res.status(200).json(toAuthUser(user));
});

router.patch(
  "/auth/preferences",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const body = parseBody(UpdatePreferencesBody, req.body, res);
    if (!body) return;
    const updates: Record<string, unknown> = {};
    if (body.theme) updates.theme = body.theme;
    if (Object.keys(updates).length > 0) {
      await db
        .update(usersTable)
        .set(updates)
        .where(eq(usersTable.id, req.user!.id));
    }
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.id));
    res.status(200).json(toAuthUser(user));
  },
);

router.patch(
  "/auth/profile",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const body = parseBody(UpdateProfileBody, req.body, res);
    if (!body) return;
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) {
        res.status(400).json({ error: "Nome inválido" });
        return;
      }
      updates.name = name;
    }
    if (body.email !== undefined) {
      const email = normalizeEmail(body.email);
      if (!isValidEmail(email)) {
        res.status(400).json({ error: "E-mail inválido" });
        return;
      }
      const [existing] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email));
      if (existing && existing.id !== req.user!.id) {
        res.status(400).json({ error: "E-mail já cadastrado" });
        return;
      }
      updates.email = email;
    }
    if (Object.keys(updates).length > 0) {
      await db
        .update(usersTable)
        .set(updates)
        .where(eq(usersTable.id, req.user!.id));
    }
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.id));
    res.status(200).json(toAuthUser(user));
  },
);

router.patch(
  "/auth/password",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const body = parseBody(ChangePasswordBody, req.body, res);
    if (!body) return;
    const user = req.user!;
    if (!verifyPassword(body.currentPassword, user.passwordHash)) {
      res.status(400).json({ error: "Senha atual incorreta" });
      return;
    }
    await db
      .update(usersTable)
      .set({ passwordHash: hashPassword(body.newPassword) })
      .where(eq(usersTable.id, user.id));
    res.status(200).json({ success: true });
  },
);

router.patch(
  "/auth/security-questions",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const body = parseBody(UpdateSecurityQuestionsBody, req.body, res);
    if (!body) return;
    const user = req.user!;
    if (!verifyPassword(body.currentPassword, user.passwordHash)) {
      res.status(400).json({ error: "Senha atual incorreta" });
      return;
    }
    await db
      .update(usersTable)
      .set({
        securityQuestion1: body.question1.trim(),
        securityQuestion2: body.question2.trim(),
        securityQuestion3: body.question3.trim(),
        securityAnswerHash1: hashPassword(normalizeAnswer(body.answer1)),
        securityAnswerHash2: hashPassword(normalizeAnswer(body.answer2)),
        securityAnswerHash3: hashPassword(normalizeAnswer(body.answer3)),
      })
      .where(eq(usersTable.id, user.id));
    const [updated] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id));
    res.status(200).json(toAuthUser(updated));
  },
);

router.post(
  "/auth/avatar",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const body = parseBody(SetAvatarBody, req.body, res);
    if (!body) return;
    if (!body.objectPath.startsWith("/objects/")) {
      res.status(400).json({ error: "Caminho de objeto inválido" });
      return;
    }
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        body.objectPath,
      );
      const [metadata] = await objectFile.getMetadata();
      const size = Number(metadata.size ?? 0);
      const contentType = String(metadata.contentType ?? "");
      if (size <= 0) {
        res.status(400).json({ error: "Arquivo enviado inválido" });
        return;
      }
      if (size > AVATAR_MAX_SIZE) {
        res
          .status(400)
          .json({ error: "A imagem excede o tamanho máximo de 5 MB" });
        return;
      }
      if (!contentType.startsWith("image/")) {
        res.status(400).json({ error: "O arquivo precisa ser uma imagem" });
        return;
      }
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(400).json({ error: "Arquivo enviado não encontrado" });
        return;
      }
      logger.error({ err: error }, "Erro ao validar avatar enviado");
      res.status(500).json({ error: "Falha ao definir avatar" });
      return;
    }
    await db
      .update(usersTable)
      .set({ avatarUrl: body.objectPath })
      .where(eq(usersTable.id, req.user!.id));
    const [updated] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.id));
    res.status(200).json(toAuthUser(updated));
  },
);

router.get(
  "/users/:userId/avatar",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId)) {
      res.status(404).json({ error: "Avatar não encontrado" });
      return;
    }
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    if (!user || !user.avatarUrl) {
      res.status(404).json({ error: "Avatar não encontrado" });
      return;
    }
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        user.avatarUrl,
      );
      const [metadata] = await objectFile.getMetadata();
      const contentType = String(
        metadata.contentType ?? "application/octet-stream",
      );
      res.setHeader("Content-Type", contentType);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "private, max-age=3600");
      const stream = objectFile.createReadStream();
      stream.on("error", (err) => {
        logger.error({ err }, "Erro ao transmitir avatar");
        if (!res.headersSent) {
          res.status(500).json({ error: "Falha ao carregar avatar" });
        } else {
          res.destroy();
        }
      });
      stream.pipe(res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "Avatar não encontrado" });
        return;
      }
      logger.error({ err: error }, "Erro ao carregar avatar");
      res.status(500).json({ error: "Falha ao carregar avatar" });
    }
  },
);

router.post("/auth/recovery/questions", async (req, res: Response) => {
  const body = parseBody(GetRecoveryQuestionsBody, req.body, res);
  if (!body) return;
  const ipKey = `recovery-questions:ip:${clientIp(req)}`;
  const limit = checkRateLimit(ipKey);
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(limit.retryAfterSeconds));
    res.status(429).json({
      error: "Muitas tentativas. Tente novamente mais tarde.",
    });
    return;
  }
  const email = normalizeEmail(body.email);
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));
  if (
    !user ||
    !user.securityQuestion1 ||
    !user.securityQuestion2 ||
    !user.securityQuestion3 ||
    !user.securityAnswerHash1 ||
    !user.securityAnswerHash2 ||
    !user.securityAnswerHash3
  ) {
    registerFailure(ipKey);
    res.status(404).json({
      error:
        "Não foi possível iniciar a recuperação para esta conta. Verifique o e-mail ou contate um administrador.",
    });
    return;
  }
  res.status(200).json({
    question1: user.securityQuestion1,
    question2: user.securityQuestion2,
    question3: user.securityQuestion3,
  });
});

router.post("/auth/recovery/reset", async (req, res: Response) => {
  const body = parseBody(ResetPasswordWithQuestionsBody, req.body, res);
  if (!body) return;
  const email = normalizeEmail(body.email);
  const emailKey = `recovery-reset:email:${email}`;
  const ipKey = `recovery-reset:ip:${clientIp(req)}`;
  const emailLimit = checkRateLimit(emailKey);
  const ipLimit = checkRateLimit(ipKey);
  if (!emailLimit.allowed || !ipLimit.allowed) {
    res.setHeader(
      "Retry-After",
      String(Math.max(emailLimit.retryAfterSeconds, ipLimit.retryAfterSeconds)),
    );
    res.status(429).json({
      error: "Muitas tentativas. Tente novamente mais tarde.",
    });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));
  const genericError =
    "Não foi possível redefinir a senha. Verifique suas respostas.";
  if (
    !user ||
    !user.securityAnswerHash1 ||
    !user.securityAnswerHash2 ||
    !user.securityAnswerHash3
  ) {
    registerFailure(emailKey);
    registerFailure(ipKey);
    res.status(400).json({ error: genericError });
    return;
  }
  const match1 = verifyPassword(
    normalizeAnswer(body.answer1),
    user.securityAnswerHash1,
  );
  const match2 = verifyPassword(
    normalizeAnswer(body.answer2),
    user.securityAnswerHash2,
  );
  const match3 = verifyPassword(
    normalizeAnswer(body.answer3),
    user.securityAnswerHash3,
  );
  if (!(match1 && match2 && match3)) {
    registerFailure(emailKey);
    registerFailure(ipKey);
    res.status(400).json({ error: genericError });
    return;
  }
  await db
    .update(usersTable)
    .set({ passwordHash: hashPassword(body.newPassword) })
    .where(eq(usersTable.id, user.id));
  clearRateLimit(emailKey);
  clearRateLimit(ipKey);
  res.status(200).json({ success: true });
});

export default router;
