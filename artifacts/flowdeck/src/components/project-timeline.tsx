import type { Task, Column } from "@workspace/api-client-react";
import { CalendarOff, Clock } from "lucide-react";
import {
  parseDueDate,
  startOfToday,
  daysInMonth,
  monthLabel,
  shortDate,
} from "@/lib/date";

const MONTH_WIDTH = 168;

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
};

function monthsBetween(start: Date, end: Date) {
  const arr: { year: number; month: number }[] = [];
  let y = start.getFullYear();
  let m = start.getMonth();
  const ey = end.getFullYear();
  const em = end.getMonth();
  while (y < ey || (y === ey && m <= em)) {
    arr.push({ year: y, month: m });
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return arr;
}

export function ProjectTimeline({
  tasks,
  columns,
  onSelect,
}: {
  tasks: Task[];
  columns: Column[];
  onSelect: (taskId: number) => void;
}) {
  const columnById = new Map(columns.map((c) => [c.id, c]));
  const dated = tasks
    .filter((t) => t.dueDate)
    .sort(
      (a, b) =>
        parseDueDate(a.dueDate!).getTime() - parseDueDate(b.dueDate!).getTime(),
    );
  const undated = tasks.filter((t) => !t.dueDate);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
        <Clock className="h-10 w-10 mb-3 opacity-20" />
        <p>Nenhuma tarefa para exibir na linha do tempo.</p>
      </div>
    );
  }

  if (dated.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <CalendarOff className="h-10 w-10 mb-3 opacity-20" />
          <p>Defina prazos nas tarefas para vê-las na linha do tempo.</p>
        </div>
        <UndatedSection tasks={undated} onSelect={onSelect} />
      </div>
    );
  }

  const first = parseDueDate(dated[0].dueDate!);
  const last = parseDueDate(dated[dated.length - 1].dueDate!);
  const months = monthsBetween(first, last);
  const totalWidth = months.length * MONTH_WIDTH;

  const offsetFor = (date: Date) => {
    const idx = months.findIndex(
      (mm) => mm.year === date.getFullYear() && mm.month === date.getMonth(),
    );
    if (idx === -1) return 0;
    const frac = (date.getDate() - 1) / daysInMonth(date.getFullYear(), date.getMonth());
    return (idx + frac) * MONTH_WIDTH;
  };

  const today = startOfToday();
  const todayInRange =
    today >= new Date(first.getFullYear(), first.getMonth(), 1) &&
    today <= new Date(last.getFullYear(), last.getMonth() + 1, 0);
  const todayLeft = todayInRange ? offsetFor(today) : null;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto pb-2">
        <div style={{ width: totalWidth + 240 }} className="min-w-full">
          <div className="flex border-b sticky top-0 bg-background z-10">
            {months.map((mm) => (
              <div
                key={`${mm.year}-${mm.month}`}
                style={{ width: MONTH_WIDTH }}
                className="shrink-0 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-l border-border/40 first:border-l-0"
              >
                {monthLabel(mm.year, mm.month)}
              </div>
            ))}
          </div>

          <div className="relative py-2">
            <div className="absolute inset-0 flex pointer-events-none">
              {months.map((mm) => (
                <div
                  key={`g${mm.year}-${mm.month}`}
                  style={{ width: MONTH_WIDTH }}
                  className="shrink-0 border-l border-border/30 first:border-l-0"
                />
              ))}
            </div>
            {todayLeft !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary/50"
                style={{ left: todayLeft }}
                title="Hoje"
              />
            )}

            {dated.map((task) => {
              const due = parseDueDate(task.dueDate!);
              const col = columnById.get(task.columnId);
              return (
                <div key={task.id} className="relative h-12">
                  <button
                    onClick={() => onSelect(task.id)}
                    style={{ left: offsetFor(due) }}
                    className="absolute top-1/2 -translate-y-1/2 flex items-center gap-2"
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        PRIORITY_DOT[task.priority]
                      }`}
                    />
                    <span
                      className={`flex items-center gap-2 rounded-md border bg-card px-2 py-1 text-xs shadow-sm whitespace-nowrap max-w-[220px] hover:bg-muted transition-colors ${
                        task.completed ? "opacity-60" : ""
                      }`}
                    >
                      {col && (
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: col.color }}
                        />
                      )}
                      <span
                        className={`truncate ${
                          task.completed ? "line-through" : ""
                        }`}
                      >
                        {task.title}
                      </span>
                      <span className="text-muted-foreground shrink-0">
                        {shortDate(due)}
                      </span>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <UndatedSection tasks={undated} onSelect={onSelect} />
    </div>
  );
}

function UndatedSection({
  tasks,
  onSelect,
}: {
  tasks: Task[];
  onSelect: (taskId: number) => void;
}) {
  if (tasks.length === 0) return null;
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        <CalendarOff className="h-3.5 w-3.5" />
        Sem prazo ({tasks.length})
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tasks.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs hover:bg-muted transition-colors ${
              t.completed ? "opacity-60 line-through" : ""
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[t.priority]}`}
            />
            {t.title}
          </button>
        ))}
      </div>
    </div>
  );
}
