import type { Task, Column } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckSquare, CalendarOff, CheckCircle2 } from "lucide-react";

const PRIORITY_LABEL: Record<string, string> = {
  high: "ALTA",
  medium: "MÉDIA",
  low: "BAIXA",
};

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return date
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .replace(/^./, (c) => c.toUpperCase());
}

export function ProjectRoadmap({
  tasks,
  columns,
  onSelect,
}: {
  tasks: Task[];
  columns: Column[];
  onSelect: (taskId: number) => void;
}) {
  const columnById = new Map(columns.map((c) => [c.id, c]));

  const dated = tasks.filter((t) => t.dueDate);
  const undated = tasks.filter((t) => !t.dueDate);

  const groups = new Map<string, { label: string; tasks: Task[] }>();
  for (const t of dated) {
    const d = new Date(t.dueDate!);
    const key = monthKey(d);
    if (!groups.has(key)) groups.set(key, { label: monthLabel(d), tasks: [] });
    groups.get(key)!.tasks.push(t);
  }

  const TaskRow = ({ task }: { task: Task }) => {
    const col = columnById.get(task.columnId);
    return (
      <button
        onClick={() => onSelect(task.id)}
        className="w-full text-left"
      >
        <Card
          className={`hover:ring-2 ring-primary/50 transition-all ${
            task.completed ? "opacity-70" : ""
          }`}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex flex-col items-center justify-center shrink-0 w-14">
              {task.dueDate ? (
                <>
                  <span className="text-lg font-bold leading-none">
                    {new Date(task.dueDate).getDate()}
                  </span>
                  <span className="text-[10px] uppercase text-muted-foreground">
                    {new Date(task.dueDate).toLocaleDateString("pt-BR", {
                      month: "short",
                    })}
                  </span>
                </>
              ) : (
                <CalendarOff className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4
                className={`font-medium text-sm truncate ${
                  task.completed ? "line-through" : ""
                }`}
              >
                {task.title}
              </h4>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {col && (
                  <span className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: col.color }}
                    />
                    {col.name}
                  </span>
                )}
                {task.checklistTotal > 0 && (
                  <span className="flex items-center gap-1">
                    <CheckSquare className="w-3 h-3" />
                    {task.checklistDone}/{task.checklistTotal}
                  </span>
                )}
              </div>
              {task.labels.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {task.labels.map((l) => (
                    <span
                      key={l.id}
                      className="inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium text-white"
                      style={{ backgroundColor: l.color }}
                    >
                      {l.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="shrink-0 flex items-center gap-2">
              {task.completed && (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
              <Badge
                variant={
                  task.priority === "high"
                    ? "destructive"
                    : task.priority === "medium"
                      ? "default"
                      : "secondary"
                }
                className="text-[10px] px-1.5 py-0"
              >
                {PRIORITY_LABEL[task.priority]}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </button>
    );
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
        <Clock className="h-10 w-10 mb-3 opacity-20" />
        <p>Nenhuma tarefa para exibir no roadmap.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {[...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, group]) => (
        <div key={key} className="relative">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur py-2 mb-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
              {group.label}
            </h3>
          </div>
          <div className="space-y-3 border-l-2 border-border pl-5 ml-1">
            {group.tasks.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </div>
        </div>
      ))}

      {undated.length > 0 && (
        <div>
          <div className="py-2 mb-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Sem prazo definido
            </h3>
          </div>
          <div className="space-y-3 border-l-2 border-dashed border-border pl-5 ml-1">
            {undated.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
