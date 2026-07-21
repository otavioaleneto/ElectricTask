// Recurring task templates: next-run computation and the periodic generator
// that materializes template instances as normal tasks.
//
// Catch-up safety: each due template is claimed inside a transaction with a
// conditional UPDATE (active AND next_run_at <= now). The next_run_at advance
// and the task insert commit atomically, so a restart never duplicates an
// instance. After downtime, at most ONE instance is created per template
// (next_run_at is recomputed from "now", not replayed per missed period).
import {
  db,
  recurringTemplatesTable,
  tasksTable,
  columnsTable,
  labelsTable,
  taskLabelsTable,
  checklistsTable,
  checklistItemsTable,
  activityLogTable,
  insertReturning,
  updateCount,
  type RecurringTemplate,
} from "@workspace/db";
import { and, eq, lte, inArray, sql } from "drizzle-orm";
import { logger } from "./logger";

export type RecurrenceRule = {
  frequency: string;
  timeOfDay: string | null;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
};

function parseTimeOfDay(t: string | null): { h: number; m: number } {
  if (t) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(t);
    if (match) {
      const h = Number(match[1]);
      const m = Number(match[2]);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return { h, m };
    }
  }
  return { h: 9, m: 0 };
}

// Next occurrence strictly after `from`, in server-local time.
export function computeNextRun(rule: RecurrenceRule, from: Date): Date {
  if (rule.frequency === "hourly") {
    return new Date(from.getTime() + 60 * 60 * 1000);
  }
  const { h, m } = parseTimeOfDay(rule.timeOfDay);
  if (rule.frequency === "daily") {
    const next = new Date(from);
    next.setHours(h, m, 0, 0);
    if (next <= from) next.setDate(next.getDate() + 1);
    return next;
  }
  if (rule.frequency === "weekly") {
    const dow = rule.dayOfWeek ?? 1;
    const next = new Date(from);
    next.setHours(h, m, 0, 0);
    const delta = (dow - next.getDay() + 7) % 7;
    next.setDate(next.getDate() + delta);
    if (next <= from) next.setDate(next.getDate() + 7);
    return next;
  }
  // monthly (dayOfMonth clamped to the target month's length)
  const dom = rule.dayOfMonth ?? 1;
  const make = (year: number, monthIdx: number): Date => {
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    return new Date(year, monthIdx, Math.min(dom, daysInMonth), h, m, 0, 0);
  };
  let next = make(from.getFullYear(), from.getMonth());
  if (next <= from) next = make(from.getFullYear(), from.getMonth() + 1);
  return next;
}

async function generateInstance(
  template: RecurringTemplate,
  now: Date,
): Promise<boolean> {
  return await db.transaction(async (tx) => {
    const next = computeNextRun(template, new Date());
    // Atomic claim: a single conditional UPDATE (condition evaluated at write
    // time on both dialects), so only one runner advances next_run_at for a
    // due template even under concurrent sweeps.
    const claimed = await updateCount(
      tx,
      recurringTemplatesTable,
      { nextRunAt: next, lastRunAt: now },
      and(
        eq(recurringTemplatesTable.id, template.id),
        eq(recurringTemplatesTable.active, true),
        lte(recurringTemplatesTable.nextRunAt, now),
      ),
    );
    if (claimed === 0) return false;

    const [column] = await tx
      .select()
      .from(columnsTable)
      .where(eq(columnsTable.id, template.columnId));
    if (!column || column.projectId !== template.projectId) {
      // Target column vanished (FK would have cascaded the template, but be
      // defensive): skip creating the instance, keep the advanced schedule.
      logger.warn(
        { templateId: template.id },
        "Recorrência sem coluna de destino válida; instância não criada",
      );
      return false;
    }

    // Same position flow as POST /projects/:id/tasks (append to the end).
    const [{ max }] = await tx
      .select({
        max: sql<number>`coalesce(max(${tasksTable.position}), -1)`,
      })
      .from(tasksTable)
      .where(eq(tasksTable.columnId, template.columnId));

    const [task] = await insertReturning(tx, tasksTable, {
      projectId: template.projectId,
      columnId: template.columnId,
      title: template.title,
      description: template.description ?? null,
      type: template.type,
      priority: template.priority,
      dueDate: null,
      assigneeId: template.assigneeId ?? null,
      position: Number(max) + 1,
    });

    // Labels: only those that still exist in the project.
    if (template.labelIds.length > 0) {
      const validLabels = await tx
        .select({ id: labelsTable.id })
        .from(labelsTable)
        .where(
          and(
            inArray(labelsTable.id, template.labelIds),
            eq(labelsTable.projectId, template.projectId),
          ),
        );
      if (validLabels.length > 0) {
        await tx
          .insert(taskLabelsTable)
          .values(validLabels.map((l) => ({ taskId: task.id, labelId: l.id })));
      }
    }

    for (let ci = 0; ci < template.checklist.length; ci++) {
      const cl = template.checklist[ci];
      const [checklist] = await insertReturning(tx, checklistsTable, {
        taskId: task.id,
        title: cl.title,
        position: ci,
      });
      if (cl.items.length > 0) {
        await tx.insert(checklistItemsTable).values(
          cl.items.map((content, i) => ({
            checklistId: checklist.id,
            content,
            done: false,
            position: i,
          })),
        );
      }
    }

    await tx.insert(activityLogTable).values({
      taskId: task.id,
      userId: template.createdBy ?? null,
      action: "created",
      detail: "recorrência",
    });

    return true;
  });
}

export async function runRecurrenceSweep(now = new Date()): Promise<number> {
  const due = await db
    .select()
    .from(recurringTemplatesTable)
    .where(
      and(
        eq(recurringTemplatesTable.active, true),
        lte(recurringTemplatesTable.nextRunAt, now),
      ),
    );
  let created = 0;
  for (const template of due) {
    try {
      if (await generateInstance(template, now)) created++;
    } catch (err) {
      logger.error(
        { err, templateId: template.id },
        "Erro ao gerar instância de tarefa recorrente",
      );
    }
  }
  if (created > 0) {
    logger.info({ created }, "Tarefas recorrentes geradas");
  }
  return created;
}

const SWEEP_INTERVAL_MS = 60 * 1000;

export function startRecurrenceScheduler(): void {
  let sweeping = false;
  const tick = () => {
    if (sweeping) return;
    sweeping = true;
    runRecurrenceSweep()
      .catch((err) => {
        logger.error({ err }, "Erro na varredura de tarefas recorrentes");
      })
      .finally(() => {
        sweeping = false;
      });
  };
  tick();
  const timer = setInterval(tick, SWEEP_INTERVAL_MS);
  timer.unref();
}
