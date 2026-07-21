import { Router, type IRouter, type Response } from "express";
import {
  db,
  recurringTemplatesTable,
  columnsTable,
  taskLabelsTable,
  checklistsTable,
  checklistItemsTable,
  insertReturning,
  updateReturning,
  type RecurringTemplate,
  type RecurrenceChecklistShape,
} from "@workspace/db";
import { eq, asc, inArray, desc } from "drizzle-orm";
import {
  CreateTaskRecurrenceBody,
  UpdateRecurrenceBody,
} from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../lib/auth";
import { parseBody } from "../lib/validate";
import { toRecurrence } from "../lib/serialize";
import { computeNextRun } from "../lib/recurrence";
import {
  getProjectForUser,
  getTaskForUser,
  getColumnForUser,
  requireProjectWrite,
} from "../lib/access";

const router: IRouter = Router();

router.use(requireAuth);

function ruleError(body: {
  frequency: string;
  timeOfDay?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
}): string | null {
  if (body.frequency !== "hourly" && !body.timeOfDay) {
    return "Horário é obrigatório para esta frequência";
  }
  if (body.frequency === "weekly" && body.dayOfWeek == null) {
    return "Dia da semana é obrigatório para recorrência semanal";
  }
  if (body.frequency === "monthly" && body.dayOfMonth == null) {
    return "Dia do mês é obrigatório para recorrência mensal";
  }
  return null;
}

async function getRecurrenceForUser(
  user: NonNullable<AuthRequest["user"]>,
  recurrenceId: number,
): Promise<RecurringTemplate | null> {
  if (!Number.isFinite(recurrenceId)) return null;
  const [row] = await db
    .select()
    .from(recurringTemplatesTable)
    .where(eq(recurringTemplatesTable.id, recurrenceId));
  if (!row) return null;
  const project = await getProjectForUser(user, row.projectId);
  return project ? row : null;
}

async function columnName(columnId: number): Promise<string> {
  const [col] = await db
    .select({ name: columnsTable.name })
    .from(columnsTable)
    .where(eq(columnsTable.id, columnId));
  return col?.name ?? "";
}

router.post(
  "/tasks/:taskId/recurrence",
  async (req: AuthRequest, res: Response) => {
    const task = await getTaskForUser(req.user!, Number(req.params.taskId));
    if (!task) {
      res.status(404).json({ error: "Tarefa não encontrada" });
      return;
    }
    if (!(await requireProjectWrite(req.user!, task.projectId, res))) return;
    const body = parseBody(CreateTaskRecurrenceBody, req.body, res);
    if (!body) return;
    const err = ruleError(body);
    if (err) {
      res.status(400).json({ error: err });
      return;
    }
    const column = await getColumnForUser(req.user!, body.columnId);
    if (!column || column.projectId !== task.projectId) {
      res.status(400).json({ error: "Coluna inválida" });
      return;
    }

    // Snapshot the task's labels and checklists into the template.
    const labelRows = await db
      .select({ labelId: taskLabelsTable.labelId })
      .from(taskLabelsTable)
      .where(eq(taskLabelsTable.taskId, task.id));
    const checklistRows = await db
      .select()
      .from(checklistsTable)
      .where(eq(checklistsTable.taskId, task.id))
      .orderBy(asc(checklistsTable.position), asc(checklistsTable.id));
    const itemRows =
      checklistRows.length > 0
        ? await db
            .select()
            .from(checklistItemsTable)
            .where(
              inArray(
                checklistItemsTable.checklistId,
                checklistRows.map((c) => c.id),
              ),
            )
            .orderBy(
              asc(checklistItemsTable.position),
              asc(checklistItemsTable.id),
            )
        : [];
    const checklist: RecurrenceChecklistShape = checklistRows.map((c) => ({
      title: c.title,
      items: itemRows
        .filter((i) => i.checklistId === c.id)
        .map((i) => i.content),
    }));

    const rule = {
      frequency: body.frequency,
      timeOfDay: body.timeOfDay ?? null,
      dayOfWeek: body.dayOfWeek ?? null,
      dayOfMonth: body.dayOfMonth ?? null,
    };
    const [created] = await insertReturning(db, recurringTemplatesTable, {
      projectId: task.projectId,
      columnId: body.columnId,
      createdBy: req.user!.id,
      title: task.title,
      description: task.description ?? null,
      type: task.type,
      priority: task.priority,
      assigneeId: task.assigneeId ?? null,
      labelIds: labelRows.map((l) => l.labelId),
      checklist,
      ...rule,
      active: true,
      nextRunAt: computeNextRun(rule, new Date()),
    });
    res.status(201).json(toRecurrence(created, column.name));
  },
);

router.get(
  "/projects/:projectId/recurrences",
  async (req: AuthRequest, res: Response) => {
    const project = await getProjectForUser(
      req.user!,
      Number(req.params.projectId),
    );
    if (!project) {
      res.status(404).json({ error: "Projeto não encontrado" });
      return;
    }
    const rows = await db
      .select({
        template: recurringTemplatesTable,
        columnName: columnsTable.name,
      })
      .from(recurringTemplatesTable)
      .innerJoin(
        columnsTable,
        eq(recurringTemplatesTable.columnId, columnsTable.id),
      )
      .where(eq(recurringTemplatesTable.projectId, project.id))
      .orderBy(
        desc(recurringTemplatesTable.active),
        asc(recurringTemplatesTable.nextRunAt),
        asc(recurringTemplatesTable.id),
      );
    res
      .status(200)
      .json(rows.map((r) => toRecurrence(r.template, r.columnName)));
  },
);

router.patch(
  "/recurrences/:recurrenceId",
  async (req: AuthRequest, res: Response) => {
    const template = await getRecurrenceForUser(
      req.user!,
      Number(req.params.recurrenceId),
    );
    if (!template) {
      res.status(404).json({ error: "Recorrência não encontrada" });
      return;
    }
    if (!(await requireProjectWrite(req.user!, template.projectId, res)))
      return;
    const body = parseBody(UpdateRecurrenceBody, req.body, res);
    if (!body) return;
    // On resume, reschedule from now so a paused backlog does not fire
    // immediately.
    const set =
      body.active && !template.active
        ? { active: true, nextRunAt: computeNextRun(template, new Date()) }
        : { active: body.active };
    const [updated] = await updateReturning(
      db,
      recurringTemplatesTable,
      set,
      eq(recurringTemplatesTable.id, template.id),
    );
    res
      .status(200)
      .json(toRecurrence(updated, await columnName(updated.columnId)));
  },
);

router.delete(
  "/recurrences/:recurrenceId",
  async (req: AuthRequest, res: Response) => {
    const template = await getRecurrenceForUser(
      req.user!,
      Number(req.params.recurrenceId),
    );
    if (!template) {
      res.status(404).json({ error: "Recorrência não encontrada" });
      return;
    }
    if (!(await requireProjectWrite(req.user!, template.projectId, res)))
      return;
    await db
      .delete(recurringTemplatesTable)
      .where(eq(recurringTemplatesTable.id, template.id));
    res.status(204).send();
  },
);

export default router;
