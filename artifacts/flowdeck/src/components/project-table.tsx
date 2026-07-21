import { useState } from "react";
import type { Task, Column } from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  CheckCircle2,
  ListChecks,
} from "lucide-react";
import { parseDueDate, startOfToday, shortDate } from "@/lib/date";

const PRIORITY_LABEL: Record<string, string> = {
  high: "ALTA",
  medium: "MÉDIA",
  low: "BAIXA",
};

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

type SortCol = "title" | "status" | "assignee" | "priority" | "dueDate";

export function ProjectTable({
  tasks,
  columns,
  onSelect,
}: {
  tasks: Task[];
  columns: Column[];
  onSelect: (taskId: number) => void;
}) {
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const columnById = new Map(columns.map((c) => [c.id, c]));
  const today = startOfToday();

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const sorted = (() => {
    if (!sortCol) return tasks;
    const dir = sortDir === "asc" ? 1 : -1;
    return tasks.slice().sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "title":
          cmp = a.title.localeCompare(b.title, "pt-BR");
          break;
        case "status":
          cmp =
            (columnById.get(a.columnId)?.position ?? 0) -
            (columnById.get(b.columnId)?.position ?? 0);
          break;
        case "assignee":
          cmp = (a.assignee?.name ?? "").localeCompare(
            b.assignee?.name ?? "",
            "pt-BR",
          );
          break;
        case "priority":
          cmp = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
          break;
        case "dueDate": {
          const av = a.dueDate ? parseDueDate(a.dueDate).getTime() : null;
          const bv = b.dueDate ? parseDueDate(b.dueDate).getTime() : null;
          // Tasks without a due date always sort last, regardless of direction.
          if (av === null && bv === null) return a.position - b.position;
          if (av === null) return 1;
          if (bv === null) return -1;
          cmp = av - bv;
          break;
        }
      }
      if (cmp === 0) cmp = a.position - b.position;
      return cmp * dir;
    });
  })();

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
        <ListChecks className="h-10 w-10 mb-3 opacity-20" />
        <p>Nenhuma tarefa para exibir.</p>
      </div>
    );
  }

  const SortHeader = ({
    col,
    children,
    className,
  }: {
    col: SortCol;
    children: React.ReactNode;
    className?: string;
  }) => (
    <TableHead className={className}>
      <button
        onClick={() => toggleSort(col)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {children}
        {sortCol === col ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <SortHeader col="title">Título</SortHeader>
            <SortHeader col="status">Status</SortHeader>
            <SortHeader col="assignee">Responsável</SortHeader>
            <TableHead>Etiquetas</TableHead>
            <SortHeader col="priority">Prioridade</SortHeader>
            <SortHeader col="dueDate">Prazo</SortHeader>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((task) => {
            const col = columnById.get(task.columnId);
            const due = task.dueDate ? parseDueDate(task.dueDate) : null;
            const overdue = !!due && !task.completed && due < today;
            return (
              <TableRow
                key={task.id}
                onClick={() => onSelect(task.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(task.id);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Abrir tarefa ${task.title}`}
                className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <TableCell className="max-w-[280px]">
                  <div className="flex items-center gap-2">
                    {task.completed && (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                    )}
                    <span
                      className={`font-medium truncate ${
                        task.completed
                          ? "line-through text-muted-foreground"
                          : ""
                      }`}
                    >
                      {task.title}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {col ? (
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: col.color }}
                      />
                      {col.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {task.assignee ? (
                    <span className="inline-flex items-center gap-2 whitespace-nowrap">
                      <Avatar className="h-6 w-6">
                        <AvatarImage
                          src={task.assignee.avatarUrl || undefined}
                        />
                        <AvatarFallback className="text-[10px]">
                          {task.assignee.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {task.assignee.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {task.labels.length > 0 ? (
                    <div className="flex flex-wrap gap-1 max-w-[220px]">
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
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell>
                  {due ? (
                    <span
                      className={`whitespace-nowrap ${
                        overdue ? "text-destructive font-medium" : ""
                      }`}
                    >
                      {shortDate(due)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
