import { useState } from "react";
import type { Task } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import {
  parseDueDate,
  startOfToday,
  isSameDay,
  daysInMonth,
  monthLabel,
} from "@/lib/date";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
};

export function ProjectCalendar({
  tasks,
  onSelect,
}: {
  tasks: Task[];
  onSelect: (taskId: number) => void;
}) {
  const today = startOfToday();
  const dated = tasks.filter((t) => t.dueDate);
  const undated = tasks.filter((t) => !t.dueDate);

  const initial = (() => {
    if (dated.length > 0) {
      let earliest = parseDueDate(dated[0].dueDate!);
      for (const t of dated) {
        const d = parseDueDate(t.dueDate!);
        if (d < earliest) earliest = d;
      }
      return { year: earliest.getFullYear(), month: earliest.getMonth() };
    }
    return { year: today.getFullYear(), month: today.getMonth() };
  })();

  const [cur, setCur] = useState(initial);

  const tasksByDay = new Map<number, Task[]>();
  for (const t of dated) {
    const d = parseDueDate(t.dueDate!);
    if (d.getFullYear() === cur.year && d.getMonth() === cur.month) {
      const day = d.getDate();
      if (!tasksByDay.has(day)) tasksByDay.set(day, []);
      tasksByDay.get(day)!.push(t);
    }
  }

  const firstWeekday = new Date(cur.year, cur.month, 1).getDay();
  const totalDays = daysInMonth(cur.year, cur.month);
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const goMonth = (delta: number) => {
    setCur((c) => {
      const m = c.month + delta;
      const year = c.year + Math.floor(m / 12);
      const month = ((m % 12) + 12) % 12;
      return { year, month };
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-lg font-semibold">
          {monthLabel(cur.year, cur.month)}
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCur({ year: today.getFullYear(), month: today.getMonth() })
            }
          >
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={() => goMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => goMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px rounded-lg overflow-hidden border bg-border">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="bg-muted/60 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {w}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`e${idx}`} className="bg-background/40 min-h-[96px]" />;
          }
          const dayTasks = tasksByDay.get(day) ?? [];
          const isToday = isSameDay(new Date(cur.year, cur.month, day), today);
          return (
            <div
              key={day}
              className="bg-background min-h-[96px] p-1.5 flex flex-col gap-1"
            >
              <span
                className={`text-xs font-medium self-start px-1.5 py-0.5 rounded-full ${
                  isToday
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {day}
              </span>
              <div className="flex flex-col gap-1 overflow-hidden">
                {dayTasks.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onSelect(t.id)}
                    title={t.title}
                    className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-left text-[11px] hover:bg-muted transition-colors ${
                      t.completed ? "opacity-60 line-through" : ""
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                        PRIORITY_DOT[t.priority]
                      }`}
                    />
                    <span className="truncate">{t.title}</span>
                  </button>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-[10px] text-muted-foreground pl-1.5">
                    +{dayTasks.length - 3} mais
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {undated.length > 0 && (
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            <CalendarDays className="h-3.5 w-3.5" />
            Sem prazo ({undated.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {undated.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelect(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs hover:bg-muted transition-colors ${
                  t.completed ? "opacity-60 line-through" : ""
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    PRIORITY_DOT[t.priority]
                  }`}
                />
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
