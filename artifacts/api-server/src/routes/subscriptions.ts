import { Router, type IRouter, type Response } from "express";
import {
  db,
  subscriptionsTable,
  subscriptionCategoriesTable,
  paymentMethodsTable,
  subscriptionPaymentsTable,
  taskSubscriptionsTable,
  tasksTable,
  projectsTable,
  usersTable,
  insertReturning,
  updateReturning,
  insertIgnore,
  isUniqueViolation,
  likeInsensitive,
  type User,
  type Subscription,
  type InsertSubscription,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import {
  CreateSubscriptionBody,
  UpdateSubscriptionBody,
  RevealSubscriptionCredentialBody,
  CreatePaymentMethodBody,
  UpdatePaymentMethodBody,
  CreateWorkspaceCategoryBody,
  UpdateWorkspaceCategoryBody,
  LinkTaskSubscriptionBody,
} from "@workspace/api-zod";
import { requireAuth, verifyPassword, type AuthRequest } from "../lib/auth";
import { parseBody } from "../lib/validate";
import {
  toSubscription,
  toSubscriptionPayment,
  toPaymentMethod,
  toWorkspaceCategory,
} from "../lib/serialize";
import {
  getWorkspaceForUser,
  requireWorkspaceWrite,
  getTaskForUser,
  requireTaskWrite,
} from "../lib/access";
import {
  encryptCredential,
  decryptCredential,
} from "../lib/subscriptionCrypto";
import {
  advanceDueDateFuture,
  monthlyCents,
  daysUntil,
  todayKey,
} from "../lib/subscriptions";
import { clearSubscriptionNotifications } from "../lib/notifications";
import {
  checkRateLimit,
  registerFailure,
  clearRateLimit,
} from "../lib/rateLimit";

const router: IRouter = Router();

router.use(requireAuth);

async function getSubscriptionForUser(
  user: User,
  id: number,
): Promise<Subscription | null> {
  if (!Number.isInteger(id)) return null;
  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.id, id));
  if (!sub) return null;
  const ws = await getWorkspaceForUser(user, sub.workspaceId);
  if (!ws) return null;
  return sub;
}

// Batch-resolve payment method names + linked task counts, then serialize.
async function serializeSubscriptions(rows: Subscription[]) {
  if (rows.length === 0) return [];
  const pmIds = Array.from(
    new Set(
      rows
        .map((r) => r.paymentMethodId)
        .filter((x): x is number => x != null),
    ),
  );
  const pmRows =
    pmIds.length > 0
      ? await db
          .select({
            id: paymentMethodsTable.id,
            name: paymentMethodsTable.name,
          })
          .from(paymentMethodsTable)
          .where(inArray(paymentMethodsTable.id, pmIds))
      : [];
  const pmName = new Map(pmRows.map((p) => [p.id, p.name]));

  const subIds = rows.map((r) => r.id);
  const countRows = await db
    .select({
      subscriptionId: taskSubscriptionsTable.subscriptionId,
      count: sql<number>`count(*)`,
    })
    .from(taskSubscriptionsTable)
    .where(inArray(taskSubscriptionsTable.subscriptionId, subIds))
    .groupBy(taskSubscriptionsTable.subscriptionId);
  const countMap = new Map(
    countRows.map((c) => [c.subscriptionId, Number(c.count)]),
  );

  return rows.map((s) =>
    toSubscription(
      s,
      s.paymentMethodId != null ? (pmName.get(s.paymentMethodId) ?? null) : null,
      countMap.get(s.id) ?? 0,
    ),
  );
}

// ----- Payment methods -----

router.get(
  "/workspaces/:workspaceId/payment-methods",
  async (req: AuthRequest, res: Response) => {
    const ws = await getWorkspaceForUser(
      req.user!,
      Number(req.params.workspaceId),
    );
    if (!ws) {
      res.status(404).json({ error: "Workspace não encontrado" });
      return;
    }
    const rows = await db
      .select()
      .from(paymentMethodsTable)
      .where(eq(paymentMethodsTable.workspaceId, ws.id))
      .orderBy(asc(paymentMethodsTable.name));
    const countRows = await db
      .select({
        paymentMethodId: subscriptionsTable.paymentMethodId,
        count: sql<number>`count(*)`,
      })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.workspaceId, ws.id))
      .groupBy(subscriptionsTable.paymentMethodId);
    const countMap = new Map(
      countRows.map((c) => [c.paymentMethodId, Number(c.count)]),
    );
    res
      .status(200)
      .json(rows.map((p) => toPaymentMethod(p, countMap.get(p.id) ?? 0)));
  },
);

router.post(
  "/workspaces/:workspaceId/payment-methods",
  async (req: AuthRequest, res: Response) => {
    const workspaceId = Number(req.params.workspaceId);
    if (!(await requireWorkspaceWrite(req.user!, workspaceId, res))) return;
    const body = parseBody(CreatePaymentMethodBody, req.body, res);
    if (!body) return;
    const [created] = await insertReturning(db, paymentMethodsTable, {
      workspaceId,
      name: body.name.trim(),
      createdBy: req.user!.id,
    });
    res.status(201).json(toPaymentMethod(created));
  },
);

router.patch(
  "/payment-methods/:paymentMethodId",
  async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.paymentMethodId);
    if (!Number.isInteger(id)) {
      res.status(404).json({ error: "Método de pagamento não encontrado" });
      return;
    }
    const [pm] = await db
      .select()
      .from(paymentMethodsTable)
      .where(eq(paymentMethodsTable.id, id));
    if (!pm) {
      res.status(404).json({ error: "Método de pagamento não encontrado" });
      return;
    }
    if (!(await requireWorkspaceWrite(req.user!, pm.workspaceId, res))) return;
    const body = parseBody(UpdatePaymentMethodBody, req.body, res);
    if (!body) return;
    const [updated] = await updateReturning(
      db,
      paymentMethodsTable,
      { name: body.name.trim() },
      eq(paymentMethodsTable.id, id),
    );
    res.status(200).json(toPaymentMethod(updated));
  },
);

router.delete(
  "/payment-methods/:paymentMethodId",
  async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.paymentMethodId);
    const [pm] = await db
      .select()
      .from(paymentMethodsTable)
      .where(eq(paymentMethodsTable.id, id));
    if (!pm) {
      res.status(404).json({ error: "Método de pagamento não encontrado" });
      return;
    }
    if (!(await requireWorkspaceWrite(req.user!, pm.workspaceId, res))) return;
    await db.delete(paymentMethodsTable).where(eq(paymentMethodsTable.id, id));
    res.status(204).send();
  },
);

// ----- Subscription categories -----

const DEFAULT_CATEGORIES: { key: string; label: string }[] = [
  { key: "streaming", label: "Streaming" },
  { key: "technology", label: "Tecnologia" },
  { key: "telecom", label: "Telecom" },
  { key: "hosting", label: "Hospedagem/VPS" },
  { key: "domain", label: "Domínios" },
  { key: "other", label: "Outros" },
];

const FALLBACK_CATEGORY_KEY = "other";

// Seeds the default categories the first time a workspace touches categories.
// "other" is undeletable, so once seeded the count never returns to zero and
// deleted defaults are never resurrected. The unique index on
// (workspace_id, key) + insertIgnore guards concurrent seeding.
async function ensureDefaultCategories(workspaceId: number): Promise<void> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(subscriptionCategoriesTable)
    .where(eq(subscriptionCategoriesTable.workspaceId, workspaceId));
  if (Number(row?.count ?? 0) > 0) return;
  await insertIgnore(
    db,
    subscriptionCategoriesTable,
    DEFAULT_CATEGORIES.map((c) => ({ workspaceId, ...c })),
  );
}

async function categoryExists(
  workspaceId: number,
  key: string,
): Promise<boolean> {
  await ensureDefaultCategories(workspaceId);
  const [row] = await db
    .select({ id: subscriptionCategoriesTable.id })
    .from(subscriptionCategoriesTable)
    .where(
      and(
        eq(subscriptionCategoriesTable.workspaceId, workspaceId),
        eq(subscriptionCategoriesTable.key, key),
      ),
    );
  return !!row;
}

function slugifyCategoryKey(label: string): string {
  const slug = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "categoria";
}

async function categorySubscriptionCount(
  workspaceId: number,
  key: string,
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.workspaceId, workspaceId),
        eq(subscriptionsTable.category, key),
      ),
    );
  return Number(row?.count ?? 0);
}

router.get(
  "/workspaces/:workspaceId/subscription-categories",
  async (req: AuthRequest, res: Response) => {
    const ws = await getWorkspaceForUser(
      req.user!,
      Number(req.params.workspaceId),
    );
    if (!ws) {
      res.status(404).json({ error: "Workspace não encontrado" });
      return;
    }
    await ensureDefaultCategories(ws.id);
    const rows = await db
      .select()
      .from(subscriptionCategoriesTable)
      .where(eq(subscriptionCategoriesTable.workspaceId, ws.id))
      .orderBy(asc(subscriptionCategoriesTable.id));
    const countRows = await db
      .select({
        category: subscriptionsTable.category,
        count: sql<number>`count(*)`,
      })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.workspaceId, ws.id))
      .groupBy(subscriptionsTable.category);
    const countMap = new Map(
      countRows.map((c) => [c.category, Number(c.count)]),
    );
    res
      .status(200)
      .json(rows.map((c) => toWorkspaceCategory(c, countMap.get(c.key) ?? 0)));
  },
);

router.post(
  "/workspaces/:workspaceId/subscription-categories",
  async (req: AuthRequest, res: Response) => {
    const workspaceId = Number(req.params.workspaceId);
    if (!(await requireWorkspaceWrite(req.user!, workspaceId, res))) return;
    const body = parseBody(CreateWorkspaceCategoryBody, req.body, res);
    if (!body) return;
    const label = body.label.trim();
    if (!label) {
      res.status(400).json({ error: "Informe um nome para a categoria" });
      return;
    }
    await ensureDefaultCategories(workspaceId);
    const key = slugifyCategoryKey(label);
    try {
      const [created] = await insertReturning(db, subscriptionCategoriesTable, {
        workspaceId,
        key,
        label,
        createdBy: req.user!.id,
      });
      res.status(201).json(toWorkspaceCategory(created, 0));
    } catch (err) {
      if (isUniqueViolation(err)) {
        res.status(409).json({ error: "Já existe uma categoria com esse nome" });
        return;
      }
      throw err;
    }
  },
);

router.patch(
  "/subscription-categories/:categoryId",
  async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.categoryId);
    if (!Number.isInteger(id)) {
      res.status(404).json({ error: "Categoria não encontrada" });
      return;
    }
    const [cat] = await db
      .select()
      .from(subscriptionCategoriesTable)
      .where(eq(subscriptionCategoriesTable.id, id));
    if (!cat) {
      res.status(404).json({ error: "Categoria não encontrada" });
      return;
    }
    if (!(await requireWorkspaceWrite(req.user!, cat.workspaceId, res))) return;
    const body = parseBody(UpdateWorkspaceCategoryBody, req.body, res);
    if (!body) return;
    const label = body.label.trim();
    if (!label) {
      res.status(400).json({ error: "Informe um nome para a categoria" });
      return;
    }
    const newKey = slugifyCategoryKey(label);
    const [duplicate] = await db
      .select({ id: subscriptionCategoriesTable.id })
      .from(subscriptionCategoriesTable)
      .where(
        and(
          eq(subscriptionCategoriesTable.workspaceId, cat.workspaceId),
          ne(subscriptionCategoriesTable.id, id),
          or(
            eq(subscriptionCategoriesTable.key, newKey),
            eq(
              sql`lower(${subscriptionCategoriesTable.label})`,
              label.toLowerCase(),
            ),
          ),
        ),
      );
    if (duplicate) {
      res.status(409).json({ error: "Já existe uma categoria com esse nome" });
      return;
    }
    const [updated] = await updateReturning(
      db,
      subscriptionCategoriesTable,
      { label, updatedAt: new Date() },
      eq(subscriptionCategoriesTable.id, id),
    );
    res
      .status(200)
      .json(
        toWorkspaceCategory(
          updated,
          await categorySubscriptionCount(cat.workspaceId, cat.key),
        ),
      );
  },
);

router.delete(
  "/subscription-categories/:categoryId",
  async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.categoryId);
    if (!Number.isInteger(id)) {
      res.status(404).json({ error: "Categoria não encontrada" });
      return;
    }
    const [cat] = await db
      .select()
      .from(subscriptionCategoriesTable)
      .where(eq(subscriptionCategoriesTable.id, id));
    if (!cat) {
      res.status(404).json({ error: "Categoria não encontrada" });
      return;
    }
    if (!(await requireWorkspaceWrite(req.user!, cat.workspaceId, res))) return;
    if (cat.key === FALLBACK_CATEGORY_KEY) {
      res.status(400).json({
        error: 'A categoria "Outros" é padrão e não pode ser excluída',
      });
      return;
    }
    await db.transaction(async (tx) => {
      // Subscriptions using the deleted category fall back to "other".
      await tx
        .update(subscriptionsTable)
        .set({ category: FALLBACK_CATEGORY_KEY, updatedAt: new Date() })
        .where(
          and(
            eq(subscriptionsTable.workspaceId, cat.workspaceId),
            eq(subscriptionsTable.category, cat.key),
          ),
        );
      await tx
        .delete(subscriptionCategoriesTable)
        .where(eq(subscriptionCategoriesTable.id, id));
    });
    res.status(204).send();
  },
);

// ----- Subscriptions -----

router.get(
  "/workspaces/:workspaceId/subscriptions",
  async (req: AuthRequest, res: Response) => {
    const ws = await getWorkspaceForUser(
      req.user!,
      Number(req.params.workspaceId),
    );
    if (!ws) {
      res.status(404).json({ error: "Workspace não encontrado" });
      return;
    }
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const category =
      typeof req.query.category === "string" ? req.query.category : "";
    const status = typeof req.query.status === "string" ? req.query.status : "";

    const conds = [eq(subscriptionsTable.workspaceId, ws.id)];
    if (category) conds.push(eq(subscriptionsTable.category, category));
    if (status) conds.push(eq(subscriptionsTable.status, status));
    if (q) {
      const like = `%${q}%`;
      const nameMatch = likeInsensitive(subscriptionsTable.customName, like);
      const slugMatch = likeInsensitive(subscriptionsTable.companySlug, like);
      conds.push(sql`(${nameMatch} OR ${slugMatch})`);
    }
    const rows = await db
      .select()
      .from(subscriptionsTable)
      .where(and(...conds))
      .orderBy(asc(subscriptionsTable.nextDueDate));
    res.status(200).json(await serializeSubscriptions(rows));
  },
);

router.post(
  "/workspaces/:workspaceId/subscriptions",
  async (req: AuthRequest, res: Response) => {
    const workspaceId = Number(req.params.workspaceId);
    if (!(await requireWorkspaceWrite(req.user!, workspaceId, res))) return;
    const body = parseBody(CreateSubscriptionBody, req.body, res);
    if (!body) return;

    if (!body.companySlug && !(body.customName && body.customName.trim())) {
      res.status(400).json({
        error: "Informe um serviço do catálogo ou um nome personalizado",
      });
      return;
    }
    if (body.paymentMethodId != null) {
      const [pm] = await db
        .select()
        .from(paymentMethodsTable)
        .where(
          and(
            eq(paymentMethodsTable.id, body.paymentMethodId),
            eq(paymentMethodsTable.workspaceId, workspaceId),
          ),
        );
      if (!pm) {
        res.status(400).json({ error: "Método de pagamento inválido" });
        return;
      }
    }
    if (body.category != null && !(await categoryExists(workspaceId, body.category))) {
      res.status(400).json({ error: "Categoria inválida" });
      return;
    }

    const credentialCiphertext =
      body.password && body.password.length > 0
        ? encryptCredential(body.password)
        : null;

    const [created] = await insertReturning(db, subscriptionsTable, {
      workspaceId,
      createdBy: req.user!.id,
      companySlug: body.companySlug ?? null,
      customName: body.customName ?? null,
      customColor: body.customColor ?? null,
      category: body.category ?? "other",
      amountCents: body.amountCents ?? 0,
      currency: body.currency ?? "BRL",
      billingCycle: body.billingCycle ?? "monthly",
      customCycleDays: body.customCycleDays ?? null,
      nextDueDate: body.nextDueDate,
      reminderDaysBefore: body.reminderDaysBefore ?? 7,
      paymentType: body.paymentType ?? "manual",
      paymentMethodId: body.paymentMethodId ?? null,
      status: body.status ?? "active",
      website: body.website ?? null,
      username: body.username ?? null,
      credentialCiphertext,
      notes: body.notes ?? null,
    });
    const [out] = await serializeSubscriptions([created]);
    res.status(201).json(out);
  },
);

router.get(
  "/subscriptions/:subscriptionId",
  async (req: AuthRequest, res: Response) => {
    const sub = await getSubscriptionForUser(
      req.user!,
      Number(req.params.subscriptionId),
    );
    if (!sub) {
      res.status(404).json({ error: "Assinatura não encontrada" });
      return;
    }
    const [serialized] = await serializeSubscriptions([sub]);

    const paymentRows = await db
      .select({ p: subscriptionPaymentsTable, paidByName: usersTable.name })
      .from(subscriptionPaymentsTable)
      .leftJoin(usersTable, eq(subscriptionPaymentsTable.paidBy, usersTable.id))
      .where(eq(subscriptionPaymentsTable.subscriptionId, sub.id))
      .orderBy(desc(subscriptionPaymentsTable.paidAt))
      .limit(50);

    const linkRows = await db
      .select({
        id: tasksTable.id,
        title: tasksTable.title,
        projectId: tasksTable.projectId,
        dueDate: tasksTable.dueDate,
      })
      .from(taskSubscriptionsTable)
      .innerJoin(tasksTable, eq(taskSubscriptionsTable.taskId, tasksTable.id))
      .where(eq(taskSubscriptionsTable.subscriptionId, sub.id))
      .orderBy(desc(taskSubscriptionsTable.id));

    res.status(200).json({
      subscription: serialized,
      payments: paymentRows.map((r) =>
        toSubscriptionPayment(r.p, r.paidByName ?? null),
      ),
      tasks: linkRows.map((t) => ({
        id: t.id,
        title: t.title,
        projectId: t.projectId,
        dueDate: t.dueDate ?? null,
      })),
    });
  },
);

router.patch(
  "/subscriptions/:subscriptionId",
  async (req: AuthRequest, res: Response) => {
    const sub = await getSubscriptionForUser(
      req.user!,
      Number(req.params.subscriptionId),
    );
    if (!sub) {
      res.status(404).json({ error: "Assinatura não encontrada" });
      return;
    }
    if (!(await requireWorkspaceWrite(req.user!, sub.workspaceId, res))) return;
    const body = parseBody(UpdateSubscriptionBody, req.body, res);
    if (!body) return;

    if (body.paymentMethodId != null) {
      const [pm] = await db
        .select()
        .from(paymentMethodsTable)
        .where(
          and(
            eq(paymentMethodsTable.id, body.paymentMethodId),
            eq(paymentMethodsTable.workspaceId, sub.workspaceId),
          ),
        );
      if (!pm) {
        res.status(400).json({ error: "Método de pagamento inválido" });
        return;
      }
    }
    if (
      body.category != null &&
      !(await categoryExists(sub.workspaceId, body.category))
    ) {
      res.status(400).json({ error: "Categoria inválida" });
      return;
    }

    const set: Partial<InsertSubscription> = { updatedAt: new Date() };
    if (body.companySlug !== undefined) set.companySlug = body.companySlug;
    if (body.customName !== undefined) set.customName = body.customName;
    if (body.customColor !== undefined) set.customColor = body.customColor;
    if (body.category !== undefined) set.category = body.category;
    if (body.amountCents !== undefined) set.amountCents = body.amountCents;
    if (body.currency !== undefined) set.currency = body.currency;
    if (body.billingCycle !== undefined) set.billingCycle = body.billingCycle;
    if (body.customCycleDays !== undefined)
      set.customCycleDays = body.customCycleDays;
    if (body.nextDueDate !== undefined) set.nextDueDate = body.nextDueDate;
    if (body.reminderDaysBefore !== undefined)
      set.reminderDaysBefore = body.reminderDaysBefore;
    if (body.paymentType !== undefined) set.paymentType = body.paymentType;
    if (body.paymentMethodId !== undefined)
      set.paymentMethodId = body.paymentMethodId;
    if (body.status !== undefined) set.status = body.status;
    if (body.website !== undefined) set.website = body.website;
    if (body.username !== undefined) set.username = body.username;
    if (body.notes !== undefined) set.notes = body.notes;
    if (body.password !== undefined) {
      set.credentialCiphertext =
        body.password && body.password.length > 0
          ? encryptCredential(body.password)
          : null;
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await updateReturning(
        tx,
        subscriptionsTable,
        set,
        eq(subscriptionsTable.id, sub.id),
      );
      // Due date or status changes invalidate any pending reminders; clear so
      // they regenerate lazily on the next fetch.
      if (body.nextDueDate !== undefined || body.status !== undefined) {
        await clearSubscriptionNotifications(tx, sub.id);
      }
      return row;
    });
    const [out] = await serializeSubscriptions([updated]);
    res.status(200).json(out);
  },
);

router.delete(
  "/subscriptions/:subscriptionId",
  async (req: AuthRequest, res: Response) => {
    const sub = await getSubscriptionForUser(
      req.user!,
      Number(req.params.subscriptionId),
    );
    if (!sub) {
      res.status(404).json({ error: "Assinatura não encontrada" });
      return;
    }
    if (!(await requireWorkspaceWrite(req.user!, sub.workspaceId, res))) return;
    await db.delete(subscriptionsTable).where(eq(subscriptionsTable.id, sub.id));
    res.status(204).send();
  },
);

router.post(
  "/subscriptions/:subscriptionId/reveal",
  async (req: AuthRequest, res: Response) => {
    const sub = await getSubscriptionForUser(
      req.user!,
      Number(req.params.subscriptionId),
    );
    if (!sub) {
      res.status(404).json({ error: "Assinatura não encontrada" });
      return;
    }
    const rlKey = `reveal:${req.user!.id}`;
    const status = checkRateLimit(rlKey);
    if (!status.allowed) {
      res.status(429).json({
        error: "Muitas tentativas. Tente novamente mais tarde.",
        retryAfterSeconds: status.retryAfterSeconds,
      });
      return;
    }
    const body = parseBody(RevealSubscriptionCredentialBody, req.body, res);
    if (!body) return;
    if (!verifyPassword(body.password, req.user!.passwordHash)) {
      registerFailure(rlKey);
      res.status(401).json({ error: "Senha incorreta" });
      return;
    }
    clearRateLimit(rlKey);

    let password: string | null = null;
    if (sub.credentialCiphertext) {
      try {
        password = decryptCredential(sub.credentialCiphertext);
      } catch {
        password = null;
      }
    }
    res.status(200).json({ username: sub.username ?? null, password });
  },
);

router.post(
  "/subscriptions/:subscriptionId/mark-paid",
  async (req: AuthRequest, res: Response) => {
    const sub = await getSubscriptionForUser(
      req.user!,
      Number(req.params.subscriptionId),
    );
    if (!sub) {
      res.status(404).json({ error: "Assinatura não encontrada" });
      return;
    }
    if (!(await requireWorkspaceWrite(req.user!, sub.workspaceId, res))) return;

    const now = new Date();
    const nextDue = advanceDueDateFuture(
      sub.nextDueDate,
      sub.billingCycle,
      sub.customCycleDays,
      todayKey(),
    );

    const updated = await db.transaction(async (tx) => {
      await tx.insert(subscriptionPaymentsTable).values({
        subscriptionId: sub.id,
        workspaceId: sub.workspaceId,
        amountCents: sub.amountCents,
        currency: sub.currency,
        dueDate: sub.nextDueDate,
        paidBy: req.user!.id,
        paidAt: now,
      });
      const [row] = await updateReturning(
        tx,
        subscriptionsTable,
        { nextDueDate: nextDue, lastPaidAt: now, updatedAt: now },
        eq(subscriptionsTable.id, sub.id),
      );
      await clearSubscriptionNotifications(tx, sub.id);
      return row;
    });
    const [out] = await serializeSubscriptions([updated]);
    res.status(200).json(out);
  },
);

router.get(
  "/workspaces/:workspaceId/subscription-summary",
  async (req: AuthRequest, res: Response) => {
    const ws = await getWorkspaceForUser(
      req.user!,
      Number(req.params.workspaceId),
    );
    if (!ws) {
      res.status(404).json({ error: "Workspace não encontrado" });
      return;
    }
    const subs = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.workspaceId, ws.id));
    const active = subs.filter((s) => s.status === "active");

    const byCur = new Map<string, number>();
    for (const s of active) {
      byCur.set(
        s.currency,
        (byCur.get(s.currency) ?? 0) +
          monthlyCents(s.amountCents, s.billingCycle, s.customCycleDays),
      );
    }
    const monthlyByCurrency = Array.from(byCur.entries())
      .map(([currency, amountCents]) => ({ currency, amountCents }))
      .sort((a, b) => b.amountCents - a.amountCents);

    const upcomingRows = [...active]
      .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))
      .slice(0, 8);
    const upcoming = await serializeSubscriptions(upcomingRows);

    // Project alerts: active subscriptions linked to a task in this workspace
    // that are due-soon or overdue, grouped by project.
    const linkRows = await db
      .select({
        projectId: tasksTable.projectId,
        subscriptionId: taskSubscriptionsTable.subscriptionId,
      })
      .from(taskSubscriptionsTable)
      .innerJoin(tasksTable, eq(taskSubscriptionsTable.taskId, tasksTable.id))
      .where(eq(taskSubscriptionsTable.workspaceId, ws.id));

    const subById = new Map(subs.map((s) => [s.id, s]));
    const projSubIds = new Map<number, Set<number>>();
    for (const l of linkRows) {
      const s = subById.get(l.subscriptionId);
      if (!s || s.status !== "active") continue;
      if (daysUntil(s.nextDueDate) <= s.reminderDaysBefore) {
        let set = projSubIds.get(l.projectId);
        if (!set) {
          set = new Set();
          projSubIds.set(l.projectId, set);
        }
        set.add(s.id);
      }
    }

    const projectIds = Array.from(projSubIds.keys());
    const projRows =
      projectIds.length > 0
        ? await db
            .select({
              id: projectsTable.id,
              name: projectsTable.name,
              accentColor: projectsTable.accentColor,
            })
            .from(projectsTable)
            .where(inArray(projectsTable.id, projectIds))
        : [];
    const projInfo = new Map(projRows.map((p) => [p.id, p]));

    const projectAlerts: {
      projectId: number;
      projectName: string;
      accentColor: string;
      subscriptions: Awaited<ReturnType<typeof serializeSubscriptions>>;
    }[] = [];
    for (const [pid, set] of projSubIds) {
      const info = projInfo.get(pid);
      if (!info) continue;
      const rows = Array.from(set)
        .map((id) => subById.get(id))
        .filter((s): s is Subscription => Boolean(s))
        .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
      projectAlerts.push({
        projectId: pid,
        projectName: info.name,
        accentColor: info.accentColor,
        subscriptions: await serializeSubscriptions(rows),
      });
    }

    res.status(200).json({ monthlyByCurrency, upcoming, projectAlerts });
  },
);

// ----- Task <-> subscription links -----

router.get(
  "/tasks/:taskId/subscriptions",
  async (req: AuthRequest, res: Response) => {
    const task = await getTaskForUser(req.user!, Number(req.params.taskId));
    if (!task) {
      res.status(404).json({ error: "Tarefa não encontrada" });
      return;
    }
    const rows = await db
      .select({ s: subscriptionsTable })
      .from(taskSubscriptionsTable)
      .innerJoin(
        subscriptionsTable,
        eq(taskSubscriptionsTable.subscriptionId, subscriptionsTable.id),
      )
      .where(eq(taskSubscriptionsTable.taskId, task.id))
      .orderBy(desc(taskSubscriptionsTable.id));
    res.status(200).json(await serializeSubscriptions(rows.map((r) => r.s)));
  },
);

router.post(
  "/tasks/:taskId/subscriptions",
  async (req: AuthRequest, res: Response) => {
    const taskId = Number(req.params.taskId);
    if (!(await requireTaskWrite(req.user!, taskId, res))) return;
    const task = await getTaskForUser(req.user!, taskId);
    if (!task) {
      res.status(404).json({ error: "Tarefa não encontrada" });
      return;
    }
    const body = parseBody(LinkTaskSubscriptionBody, req.body, res);
    if (!body) return;

    const [proj] = await db
      .select({ workspaceId: projectsTable.workspaceId })
      .from(projectsTable)
      .where(eq(projectsTable.id, task.projectId));
    const sub = await getSubscriptionForUser(req.user!, body.subscriptionId);
    if (!proj || !sub || sub.workspaceId !== proj.workspaceId) {
      res.status(400).json({ error: "Assinatura inválida para esta tarefa" });
      return;
    }

    await insertIgnore(db, taskSubscriptionsTable, {
      workspaceId: proj.workspaceId,
      taskId,
      subscriptionId: sub.id,
    });

    const rows = await db
      .select({ s: subscriptionsTable })
      .from(taskSubscriptionsTable)
      .innerJoin(
        subscriptionsTable,
        eq(taskSubscriptionsTable.subscriptionId, subscriptionsTable.id),
      )
      .where(eq(taskSubscriptionsTable.taskId, taskId))
      .orderBy(desc(taskSubscriptionsTable.id));
    res.status(201).json(await serializeSubscriptions(rows.map((r) => r.s)));
  },
);

router.delete(
  "/tasks/:taskId/subscriptions/:subscriptionId",
  async (req: AuthRequest, res: Response) => {
    const taskId = Number(req.params.taskId);
    if (!(await requireTaskWrite(req.user!, taskId, res))) return;
    await db
      .delete(taskSubscriptionsTable)
      .where(
        and(
          eq(taskSubscriptionsTable.taskId, taskId),
          eq(
            taskSubscriptionsTable.subscriptionId,
            Number(req.params.subscriptionId),
          ),
        ),
      );
    res.status(204).send();
  },
);

export default router;
