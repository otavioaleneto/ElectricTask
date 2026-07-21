import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, Link, useLocation, useSearch } from "wouter";
import {
  useGetProject,
  useListColumns,
  useListTasks,
  useListLabels,
  useListWorkspaceMembers,
  getGetProjectQueryKey,
  getListColumnsQueryKey,
  getListTasksQueryKey,
  getListLabelsQueryKey,
  getListWorkspaceMembersQueryKey,
  getListProjectsQueryKey,
  getGetWorkspaceSummaryQueryKey,
  useMoveTask,
  useCreateColumn,
  useUpdateColumn,
  useDeleteColumn,
  useCreateTask,
  useDeleteTask,
  useUpdateTask,
  useUpdateProject,
  useDeleteProject,
  useRecordProjectView,
  useListActiveTimers,
  getListActiveTimersQueryKey,
} from "@workspace/api-client-react";
import type { Task, ListTasksParams } from "@workspace/api-client-react";
import { useFloatingTask } from "@/lib/floating-task-context";
import { parseDueDate } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Clock,
  CheckSquare,
  AlignLeft,
  Plus,
  MoreHorizontal,
  Trash2,
  Pencil,
  ChevronLeft,
  Network,
  Settings,
  SlidersHorizontal,
  Search,
  X,
  Video,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  Repeat,
} from "lucide-react";
import {
  CreateRecurrenceDialog,
  RecurrencesDialog,
} from "@/components/recurrence-dialogs";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { TaskSheet } from "@/components/task-sheet";
import { ProjectRoadmap } from "@/components/project-roadmap";
import { ProjectTable } from "@/components/project-table";
import { ProjectCalendar } from "@/components/project-calendar";
import { ProjectTimeline } from "@/components/project-timeline";
import { ProjectTimeReport } from "@/components/project-time-report";

const PROJECT_ACCENT_COLORS = [
  "#ef4444",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
];

const PLATFORM_OPTIONS = [
  { value: "youtube", label: "YouTube" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "twitter", label: "Twitter" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "twitch", label: "Twitch" },
  { value: "generic", label: "Outro" },
];

const COLUMN_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#3b82f6",
  "#22c55e",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#64748b",
];

const PRIORITY_LABEL: Record<string, string> = {
  high: "ALTA",
  medium: "MÉDIA",
  low: "BAIXA",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(
    d.getFullYear(),
  ).slice(-2)}`;
}

function isTaskOverdue(dueDate?: string | null): boolean {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = parseDueDate(dueDate);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

type SortKey = "manual" | "dueDate" | "priority" | "alpha";

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

const DUE_LABEL: Record<string, string> = {
  overdue: "Atrasadas",
  next7: "Próximos 7 dias",
  none: "Sem prazo",
};

function sortTasks(arr: Task[], sortBy: SortKey): Task[] {
  const copy = arr.slice();
  if (sortBy === "dueDate") {
    return copy.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return a.position - b.position;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return parseDueDate(a.dueDate).getTime() - parseDueDate(b.dueDate).getTime();
    });
  }
  if (sortBy === "priority") {
    return copy.sort(
      (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        a.position - b.position,
    );
  }
  if (sortBy === "alpha") {
    return copy.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  }
  return copy.sort((a, b) => a.position - b.position);
}

function FilterChip({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
      {label}
      <button
        onClick={onClear}
        aria-label="Remover filtro"
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export default function Project() {
  const { projectId } = useParams();
  const id = parseInt(projectId || "0", 10);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();

  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterLabel, setFilterLabel] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterDue, setFilterDue] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("manual");
  const [view, setView] = useState("kanban");
  const [filterSearch, setFilterSearch] = useState("");

  const taskParams: ListTasksParams = {
    ...(filterAssignee !== "all" ? { assigneeId: Number(filterAssignee) } : {}),
    ...(filterLabel !== "all" ? { labelId: Number(filterLabel) } : {}),
    ...(filterPriority !== "all"
      ? { priority: filterPriority as ListTasksParams["priority"] }
      : {}),
    ...(filterDue !== "all"
      ? { due: filterDue as ListTasksParams["due"] }
      : {}),
  };

  const { data: project, isLoading: isProjectLoading } = useGetProject(id, {
    query: { enabled: !!id, queryKey: getGetProjectQueryKey(id) },
  });
  const { data: columns = [] } = useListColumns(id, {
    query: { enabled: !!id, queryKey: getListColumnsQueryKey(id) },
  });
  const { data: tasks = [] } = useListTasks(id, taskParams, {
    query: { enabled: !!id, queryKey: getListTasksQueryKey(id, taskParams) },
  });
  const { data: labels = [] } = useListLabels(id, {
    query: { enabled: !!id, queryKey: getListLabelsQueryKey(id) },
  });
  const { data: activeTimers = [] } = useListActiveTimers({
    query: { queryKey: getListActiveTimersQueryKey() },
  });
  const activeTimerTaskIds = new Set(activeTimers.map((t) => t.taskId));
  const { data: members = [] } = useListWorkspaceMembers(
    project?.workspaceId ?? 0,
    {
      query: {
        enabled: !!project?.workspaceId,
        queryKey: getListWorkspaceMembersQueryKey(project?.workspaceId ?? 0),
      },
    },
  );

  const moveTask = useMoveTask();
  const createColumn = useCreateColumn();
  const updateColumn = useUpdateColumn();
  const deleteColumn = useDeleteColumn();
  const createTask = useCreateTask();
  const deleteTask = useDeleteTask();
  const updateTask = useUpdateTask();
  const { floatTask } = useFloatingTask();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const recordView = useRecordProjectView();

  const { mutate: recordViewMutate } = recordView;
  useEffect(() => {
    if (id) {
      recordViewMutate(
        { projectId: id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              predicate: (query) => {
                const key = query.queryKey[0];
                return (
                  typeof key === "string" &&
                  /^\/api\/workspaces\/\d+\/projects$/.test(key)
                );
              },
            });
          },
        },
      );
    }
  }, [id, recordViewMutate, queryClient]);

  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverCol, setDragOverCol] = useState<number | null>(null);
  const [draggedCol, setDraggedCol] = useState<number | null>(null);
  const [dragOverColId, setDragOverColId] = useState<number | null>(null);
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [newColumnName, setNewColumnName] = useState("");
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHeaderSlot(document.getElementById("page-header-slot"));
  }, []);
  const [editColumn, setEditColumn] = useState<{
    id: number;
    name: string;
    color: string;
  } | null>(null);
  const [addingTaskCol, setAddingTaskCol] = useState<number | null>(null);
  const [addingTaskTopCol, setAddingTaskTopCol] = useState<number | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const addTaskInputRef = useRef<HTMLInputElement>(null);
  const togglingTaskIdsRef = useRef<Set<number>>(new Set());
  const [hideCompleted, setHideCompleted] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [recurrenceTask, setRecurrenceTask] = useState<Task | null>(null);
  const [recurrencesOpen, setRecurrencesOpen] = useState(false);
  const [editProject, setEditProject] = useState({
    name: "",
    type: "social",
    platform: "youtube",
    accentColor: "#3b82f6",
    coverImageUrl: "",
  });
  const invalidateBoard = () => {
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListColumnsQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(id) });
  };

  useEffect(() => {
    const taskParam = new URLSearchParams(search).get("task");
    if (!taskParam) return;
    const tid = parseInt(taskParam, 10);
    if (!Number.isNaN(tid)) setOpenTaskId(tid);
  }, [search]);

  const closeTaskSheet = () => {
    setOpenTaskId(null);
    const params = new URLSearchParams(search);
    if (params.has("task")) {
      params.delete("task");
      const qs = params.toString();
      setLocation(`/projects/${id}${qs ? `?${qs}` : ""}`, { replace: true });
    }
  };

  if (isProjectLoading) return <div className="p-8">Carregando projeto...</div>;
  if (!project) return <div className="p-8">Projeto não encontrado</div>;

  const searchQuery = filterSearch.trim().toLowerCase();
  const filteredTasks = searchQuery
    ? tasks.filter((t) => t.title.toLowerCase().includes(searchQuery))
    : tasks;
  const visibleTasks = hideCompleted
    ? filteredTasks.filter((t) => !t.completed)
    : filteredTasks;
  const platformLabel =
    project.type === "development"
      ? "Desenvolvimento de Projeto"
      : (PLATFORM_OPTIONS.find((p) => p.value === project.platform)?.label ??
        project.platform);
  const filtersActive =
    filterAssignee !== "all" ||
    filterLabel !== "all" ||
    filterPriority !== "all" ||
    filterDue !== "all" ||
    searchQuery !== "";
  const clearFilters = () => {
    setFilterAssignee("all");
    setFilterLabel("all");
    setFilterPriority("all");
    setFilterDue("all");
    setFilterSearch("");
  };

  const openProjectDialog = () => {
    setEditProject({
      name: project.name,
      type: project.type,
      platform: project.platform,
      accentColor: project.accentColor || "#3b82f6",
      coverImageUrl: project.coverImageUrl || "",
    });
    setProjectDialogOpen(true);
  };

  const handleSaveProject = () => {
    if (!editProject.name.trim()) return;
    updateProject.mutate(
      {
        projectId: id,
        data: {
          name: editProject.name.trim(),
          type: editProject.type as any,
          platform: (editProject.type === "development"
            ? "generic"
            : editProject.platform) as any,
          accentColor: editProject.accentColor,
          coverImageUrl: editProject.coverImageUrl || null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(id) });
          queryClient.invalidateQueries({
            queryKey: getListProjectsQueryKey(project.workspaceId),
          });
          queryClient.invalidateQueries({
            queryKey: getGetWorkspaceSummaryQueryKey(project.workspaceId),
          });
          setProjectDialogOpen(false);
          toast({ title: "Projeto atualizado com sucesso" });
        },
      },
    );
  };

  const handleDeleteProject = () => {
    deleteProject.mutate(
      { projectId: id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListProjectsQueryKey(project.workspaceId),
          });
          queryClient.invalidateQueries({
            queryKey: getGetWorkspaceSummaryQueryKey(project.workspaceId),
          });
          setDeleteDialogOpen(false);
          toast({ title: "Projeto excluído" });
          setLocation("/");
        },
      },
    );
  };

  const handleDrop = (columnId: number, index: number) => {
    if (!draggedTask) return;
    const destCol = columns.find((c) => c.id === columnId);
    const srcCol = columns.find((c) => c.id === draggedTask.columnId);
    if (destCol?.isDone || srcCol?.isDone) {
      const newCompleted = !!destCol?.isDone;
      queryClient.setQueryData(
        getListTasksQueryKey(id, taskParams),
        (old: Task[] | undefined) =>
          old?.map((t) =>
            t.id === draggedTask.id ? { ...t, columnId, completed: newCompleted } : t,
          ),
      );
    }
    moveTask.mutate(
      { taskId: draggedTask.id, data: { columnId, position: index } },
      { onSuccess: invalidateBoard },
    );
    setDraggedTask(null);
    setDragOverCol(null);
  };

  const handleColumnDrop = (targetColId: number) => {
    if (draggedCol === null || draggedCol === targetColId) {
      setDraggedCol(null);
      setDragOverColId(null);
      return;
    }
    const ordered = columns
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((c) => c.id);
    const from = ordered.indexOf(draggedCol);
    const to = ordered.indexOf(targetColId);
    if (from === -1 || to === -1) {
      setDraggedCol(null);
      setDragOverColId(null);
      return;
    }
    ordered.splice(from, 1);
    ordered.splice(to, 0, draggedCol);
    ordered.forEach((colId, idx) => {
      const orig = columns.find((c) => c.id === colId);
      if (orig && orig.position !== idx) {
        updateColumn.mutate(
          { columnId: colId, data: { position: idx } },
          { onSuccess: invalidateBoard },
        );
      }
    });
    setDraggedCol(null);
    setDragOverColId(null);
  };

  const handleCreateColumn = () => {
    if (!newColumnName.trim()) return;
    createColumn.mutate(
      {
        projectId: id,
        data: {
          name: newColumnName.trim(),
          color: COLUMN_COLORS[columns.length % COLUMN_COLORS.length],
        },
      },
      {
        onSuccess: () => {
          invalidateBoard();
          setNewColumnName("");
          setColumnDialogOpen(false);
        },
      },
    );
  };

  const handleSaveColumn = () => {
    if (!editColumn) return;
    updateColumn.mutate(
      {
        columnId: editColumn.id,
        data: { name: editColumn.name, color: editColumn.color },
      },
      {
        onSuccess: () => {
          invalidateBoard();
          setEditColumn(null);
        },
      },
    );
  };

  const handleAddTask = (columnId: number) => {
    if (createTask.isPending) return;
    if (!newTaskTitle.trim()) {
      setAddingTaskCol(null);
      return;
    }
    createTask.mutate(
      { projectId: id, data: { title: newTaskTitle.trim(), columnId } },
      {
        onSuccess: () => {
          invalidateBoard();
          setNewTaskTitle("");
          requestAnimationFrame(() => addTaskInputRef.current?.focus());
        },
      },
    );
  };

  const handleAddTaskAtTop = (columnId: number) => {
    if (!newTaskTitle.trim()) {
      setAddingTaskTopCol(null);
      return;
    }
    createTask.mutate(
      { projectId: id, data: { title: newTaskTitle.trim(), columnId, insertAt: "start" } },
      {
        onSuccess: () => {
          invalidateBoard();
          setNewTaskTitle("");
          requestAnimationFrame(() => addTaskInputRef.current?.focus());
        },
      },
    );
  };

  const handleToggleComplete = (task: Task) => {
    if (togglingTaskIdsRef.current.has(task.id)) return;
    togglingTaskIdsRef.current.add(task.id);
    const newCompleted = !task.completed;
    queryClient.setQueryData(
      getListTasksQueryKey(id, taskParams),
      (old: Task[] | undefined) =>
        old?.map((t) =>
          t.id === task.id
            ? {
                ...t,
                completed: newCompleted,
                completedAt: newCompleted ? new Date().toISOString() : null,
              }
            : t,
        ),
    );
    updateTask.mutate(
      { taskId: task.id, data: { completed: newCompleted } },
      {
        onSettled: () => {
          togglingTaskIdsRef.current.delete(task.id);
          invalidateBoard();
        },
      },
    );
  };

  return (
    <div className="h-full flex flex-col space-y-6 min-w-0 animate-in fade-in duration-500">
      {headerSlot &&
        createPortal(
          <div className="flex items-center justify-between gap-3 min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <Link href="/">
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0"
                style={{ backgroundColor: project.accentColor }}
              >
                {project.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-semibold tracking-tight text-foreground truncate leading-tight">
                  {project.name}
                </h1>
                <p className="hidden sm:block text-xs text-muted-foreground truncate leading-tight">
                  {platformLabel} · {project.completedCount}/{project.taskCount} concluídas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Tarefas recorrentes"
                title="Tarefas recorrentes"
                onClick={() => setRecurrencesOpen(true)}
              >
                <Repeat className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={openProjectDialog}>
                <Settings className="h-4 w-4" />
              </Button>
              <Dialog open={columnDialogOpen} onOpenChange={setColumnDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Nova Coluna</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nova Coluna</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 py-2">
                    <Label>Nome da coluna</Label>
                    <Input
                      autoFocus
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateColumn()}
                      placeholder="Ex: Em Revisão"
                    />
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCreateColumn}>Criar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>,
          headerSlot,
        )}

      <Tabs
        value={view}
        onValueChange={setView}
        className="flex-1 flex flex-col min-h-0 min-w-0"
      >
        <TabsList className="flex w-full justify-start gap-6 h-auto rounded-none border-b border-border bg-transparent p-0">
          {[
            { value: "kanban", label: "Kanban" },
            { value: "roadmap", label: "Roadmap" },
            { value: "tabela", label: "Tabela" },
            { value: "calendario", label: "Calendário" },
            { value: "timeline", label: "Linha do tempo" },
            { value: "tempo", label: "Tempo" },
          ].map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2 pt-0 font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap min-w-0 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <div className="flex min-w-0 max-w-full flex-1 items-center gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 shrink-0 ${hideCompleted ? "text-primary" : "text-muted-foreground"}`}
              onClick={() => setHideCompleted(!hideCompleted)}
              title={hideCompleted ? "Mostrar concluídas" : "Ocultar concluídas"}
            >
              {hideCompleted ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Buscar tarefas..."
                className="h-8 w-44 pl-8 text-sm bg-background shadow-sm"
              />
            </div>
            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="h-8 w-auto gap-1 text-sm bg-background shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos responsáveis</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={String(m.userId)}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterLabel} onValueChange={setFilterLabel}>
              <SelectTrigger className="h-8 w-auto gap-1 text-sm bg-background shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas etiquetas</SelectItem>
                {labels.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: l.color }}
                      />
                      {l.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="h-8 w-auto gap-1 text-sm bg-background shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas prioridades</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterDue} onValueChange={setFilterDue}>
              <SelectTrigger className="h-8 w-auto gap-1 text-sm bg-background shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer prazo</SelectItem>
                <SelectItem value="overdue">Atrasadas</SelectItem>
                <SelectItem value="next7">Próximos 7 dias</SelectItem>
                <SelectItem value="none">Sem prazo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(view === "kanban" || view === "roadmap") && (
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger className="h-8 w-auto gap-1 text-sm bg-background shadow-sm">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Ordem manual</SelectItem>
                <SelectItem value="dueDate">Por prazo</SelectItem>
                <SelectItem value="priority">Por prioridade</SelectItem>
                <SelectItem value="alpha">Alfabética</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        {filtersActive && (
          <div className="flex items-center gap-2 flex-wrap mt-3 text-xs">
            <span className="text-muted-foreground">Filtros ativos:</span>
            {filterAssignee !== "all" && (
              <FilterChip
                label={`Responsável: ${
                  members.find((m) => String(m.userId) === filterAssignee)
                    ?.name ?? ""
                }`}
                onClear={() => setFilterAssignee("all")}
              />
            )}
            {filterLabel !== "all" && (
              <FilterChip
                label={`Etiqueta: ${
                  labels.find((l) => String(l.id) === filterLabel)?.name ?? ""
                }`}
                onClear={() => setFilterLabel("all")}
              />
            )}
            {filterPriority !== "all" && (
              <FilterChip
                label={`Prioridade: ${PRIORITY_LABEL[filterPriority]}`}
                onClear={() => setFilterPriority("all")}
              />
            )}
            {filterDue !== "all" && (
              <FilterChip
                label={`Prazo: ${DUE_LABEL[filterDue]}`}
                onClear={() => setFilterDue("all")}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={clearFilters}
            >
              Limpar tudo
            </Button>
          </div>
        )}
        <TabsContent
          value="kanban"
          className="flex-1 min-h-0 min-w-0 mt-4 overflow-x-auto pb-4"
        >
        {columns.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-16">
            <p className="text-sm text-muted-foreground">
              Nenhuma coluna ainda. Crie a primeira para organizar suas tarefas.
            </p>
            <Button onClick={() => setColumnDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Nova Coluna
            </Button>
          </div>
        ) : (
          <div className="grid grid-flow-col auto-cols-[minmax(272px,1fr)] sm:auto-cols-[minmax(300px,1fr)] gap-4 h-full items-start">

            {columns
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((col) => {
                const colTasks = sortTasks(
                  visibleTasks.filter((t) => t.columnId === col.id),
                  sortBy,
                );
                const isOver = dragOverCol === col.id;
                return (
                  <div
                    key={col.id}
                    onDragOver={(e) => {
                      if (draggedCol !== null) {
                        e.preventDefault();
                        setDragOverColId(col.id);
                      }
                    }}
                    onDrop={() => {
                      if (draggedCol !== null) handleColumnDrop(col.id);
                    }}
                    className={`flex flex-col min-w-0 max-h-full rounded-xl transition-all ${
                      draggedCol === col.id ? "opacity-40" : ""
                    } ${
                      draggedCol !== null &&
                      dragOverColId === col.id &&
                      draggedCol !== col.id
                        ? "ring-2 ring-primary/60"
                        : ""
                    }`}
                  >
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        setDraggedCol(col.id);
                      }}
                      onDragEnd={() => {
                        setDraggedCol(null);
                        setDragOverColId(null);
                      }}
                      className="group flex items-center justify-between mb-3 px-1 cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: col.color }}
                        />
                        <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider truncate">
                          {col.name}
                        </h3>
                        <span className="ml-1 text-xs font-medium text-muted-foreground shrink-0">
                          {colTasks.length}
                        </span>
                        {col.isDone && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              setEditColumn({
                                id: col.id,
                                name: col.name,
                                color: col.color,
                              })
                            }
                          >
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              updateColumn.mutate(
                                { columnId: col.id, data: { isDone: !col.isDone } },
                                { onSuccess: invalidateBoard },
                              )
                            }
                          >
                            <CheckCircle2 className={`mr-2 h-4 w-4 ${col.isDone ? "text-green-500" : ""}`} />
                            {col.isDone ? "Remover coluna de conclusão" : "Marcar como coluna de conclusão"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() =>
                              deleteColumn.mutate(
                                { columnId: col.id },
                                { onSuccess: invalidateBoard },
                              )
                            }
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div
                      onDragOver={(e) => {
                        if (draggedCol !== null) return;
                        e.preventDefault();
                        setDragOverCol(col.id);
                      }}
                      onDragLeave={() => setDragOverCol(null)}
                      onDrop={() => handleDrop(col.id, colTasks.length)}
                      className={`flex-1 overflow-y-auto flex flex-col gap-3 pb-2 pr-1 min-h-[120px] rounded-xl transition-colors ${
                        isOver
                          ? "bg-primary/5 ring-1 ring-inset ring-primary/30"
                          : ""
                      }`}
                    >
                      {addingTaskTopCol === col.id ? (
                        <div className="space-y-2">
                          <Input
                            autoFocus
                            ref={addTaskInputRef}
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAddTaskAtTop(col.id);
                              if (e.key === "Escape") { setAddingTaskTopCol(null); setNewTaskTitle(""); }
                            }}
                            placeholder="Título da tarefa"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleAddTaskAtTop(col.id)}
                              disabled={createTask.isPending || !newTaskTitle.trim()}
                            >
                              {createTask.isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Adicionar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={createTask.isPending}
                              onClick={() => { setAddingTaskTopCol(null); setNewTaskTitle(""); }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          onClick={() => { setAddingTaskTopCol(col.id); setAddingTaskCol(null); setNewTaskTitle(""); }}
                          className="mb-1 w-full justify-start border border-dashed border-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Adicionar no topo
                        </Button>
                      )}
                      {colTasks.map((task, index) => {
                        const overdue = isTaskOverdue(task.dueDate);
                        const hasVideo =
                          task.type === "video" &&
                          task.videoLinks.length > 0;
                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={() => setDraggedTask(task)}
                            onDragEnd={() => setDraggedTask(null)}
                            onDrop={(e) => {
                              e.stopPropagation();
                              handleDrop(col.id, index);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDragOverCol(col.id);
                            }}
                          >
                            <div
                              onClick={() => setOpenTaskId(task.id)}
                              className={`group flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm transition-all cursor-pointer hover:shadow-md hover:border-muted-foreground/30 ${
                                draggedTask?.id === task.id ? "opacity-40" : ""
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                {task.priority === "high" ? (
                                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-destructive">
                                    <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                                    Urgente
                                  </div>
                                ) : task.priority === "medium" ? (
                                  <div className="text-[10px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-500">
                                    Média
                                  </div>
                                ) : (
                                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                    Baixa
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  {task.dueDate && (
                                    <div
                                      className={`flex items-center gap-1.5 text-xs font-medium ${
                                        overdue && !task.completed
                                          ? "text-destructive"
                                          : "text-muted-foreground"
                                      }`}
                                    >
                                      <Clock className="h-3 w-3" />
                                      {parseDueDate(
                                        task.dueDate,
                                      ).toLocaleDateString("pt-BR", {
                                        month: "short",
                                        day: "numeric",
                                      })}
                                    </div>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Repetir tarefa"
                                    title="Repetir tarefa"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRecurrenceTask(task);
                                    }}
                                    className="h-6 w-6 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
                                  >
                                    <Repeat className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Excluir tarefa"
                                    title="Excluir tarefa"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTaskToDelete(task);
                                    }}
                                    className="h-6 w-6 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={
                                      task.completed
                                        ? "Reabrir tarefa"
                                        : "Concluir tarefa"
                                    }
                                    title={
                                      task.completed
                                        ? "Reabrir tarefa"
                                        : "Concluir tarefa"
                                    }
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleComplete(task);
                                    }}
                                    className={`h-6 w-6 shrink-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100 ${
                                      task.completed
                                        ? "text-green-500 opacity-100 hover:text-green-600"
                                        : "text-muted-foreground opacity-0 hover:text-green-500"
                                    }`}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>

                              <h4
                                className={`text-base font-semibold leading-snug ${
                                  task.completed
                                    ? "text-muted-foreground line-through"
                                    : "text-foreground"
                                }`}
                              >
                                {task.title}
                              </h4>

                              {task.labels.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {task.labels.map((l) => (
                                    <span
                                      key={l.id}
                                      className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                                    >
                                      <span
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{ backgroundColor: l.color }}
                                      />
                                      {l.name}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <div className="flex items-center justify-between mt-1 pt-3 border-t border-border/50">
                                  <div className="flex items-center gap-3 text-muted-foreground">
                                    <span
                                      className="text-[11px] font-medium tabular-nums"
                                      title={
                                        task.completed && task.completedAt
                                          ? "Criada - Concluída"
                                          : "Criada em"
                                      }
                                    >
                                      {formatShortDate(task.createdAt)}
                                      {task.completed && task.completedAt
                                        ? ` - ${formatShortDate(task.completedAt)}`
                                        : ""}
                                    </span>
                                    {activeTimerTaskIds.has(task.id) && (
                                      <span
                                        className="flex items-center gap-1 text-[11px] font-semibold text-primary"
                                        title="Cronômetro ativo"
                                      >
                                        <span className="relative flex h-2 w-2">
                                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                                          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                                        </span>
                                        <Clock className="h-3.5 w-3.5" />
                                      </span>
                                    )}
                                    {task.checklistTotal > 0 && (
                                      <span
                                        className="flex items-center gap-1 text-[11px] font-medium"
                                        title="Checklist"
                                      >
                                        <CheckSquare className="h-3.5 w-3.5" />
                                        {task.checklistDone}/{task.checklistTotal}
                                      </span>
                                    )}
                                    {task.description && (
                                      <span title="Descrição">
                                        <AlignLeft className="h-3.5 w-3.5" />
                                      </span>
                                    )}
                                    {task.mindmapId && (
                                      <span title="Mapa mental">
                                        <Network className="h-3.5 w-3.5" />
                                      </span>
                                    )}
                                    {hasVideo && (
                                      <a
                                        href={task.videoLinks[0].url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        title="Abrir vídeo"
                                        className="flex items-center text-primary hover:text-primary/80"
                                      >
                                        <Video className="h-3.5 w-3.5" />
                                      </a>
                                    )}
                                  </div>
                                  {task.assignee && (
                                    <span title={task.assignee.name}>
                                      <Avatar className="h-6 w-6 border border-background ring-1 ring-border/50">
                                        <AvatarImage
                                          src={
                                            task.assignee.avatarUrl || undefined
                                          }
                                        />
                                        <AvatarFallback className="bg-muted text-[10px] font-medium text-muted-foreground">
                                          {getInitials(task.assignee.name)}
                                        </AvatarFallback>
                                      </Avatar>
                                    </span>
                                  )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {addingTaskCol === col.id ? (
                        <div className="space-y-2">
                          <Input
                            autoFocus
                            ref={addTaskInputRef}
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAddTask(col.id);
                              if (e.key === "Escape") setAddingTaskCol(null);
                            }}
                            placeholder="Título da tarefa"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleAddTask(col.id)}
                              disabled={
                                createTask.isPending || !newTaskTitle.trim()
                              }
                            >
                              {createTask.isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Adicionar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={createTask.isPending}
                              onClick={() => {
                                setAddingTaskCol(null);
                                setNewTaskTitle("");
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setAddingTaskCol(col.id);
                            setNewTaskTitle("");
                          }}
                          className="mt-1 w-full justify-start border border-dashed border-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Adicionar tarefa
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
        </TabsContent>
        <TabsContent value="roadmap" className="flex-1 min-h-0 mt-4 overflow-y-auto">
          <ProjectRoadmap
            tasks={sortTasks(filteredTasks, sortBy)}
            columns={columns}
            onSelect={(taskId) => setOpenTaskId(taskId)}
          />
        </TabsContent>
        <TabsContent value="tabela" className="flex-1 min-h-0 min-w-0 mt-4 overflow-auto">
          <ProjectTable
            tasks={filteredTasks}
            columns={columns}
            onSelect={(taskId) => setOpenTaskId(taskId)}
          />
        </TabsContent>
        <TabsContent
          value="calendario"
          className="flex-1 min-h-0 mt-4 overflow-y-auto"
        >
          <ProjectCalendar
            tasks={filteredTasks}
            onSelect={(taskId) => setOpenTaskId(taskId)}
          />
        </TabsContent>
        <TabsContent
          value="timeline"
          className="flex-1 min-h-0 mt-4 overflow-y-auto"
        >
          <ProjectTimeline
            tasks={filteredTasks}
            columns={columns}
            onSelect={(taskId) => setOpenTaskId(taskId)}
          />
        </TabsContent>
        <TabsContent
          value="tempo"
          className="flex-1 min-h-0 mt-4 overflow-y-auto"
        >
          <ProjectTimeReport
            projectId={id}
            onSelect={(taskId) => setOpenTaskId(taskId)}
          />
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!editColumn}
        onOpenChange={(o) => !o && setEditColumn(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Coluna</DialogTitle>
          </DialogHeader>
          {editColumn && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={editColumn.name}
                  onChange={(e) =>
                    setEditColumn({ ...editColumn, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-2">
                  {COLUMN_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditColumn({ ...editColumn, color: c })}
                      className={`w-8 h-8 rounded-full transition-transform ${
                        editColumn.color === c
                          ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110"
                          : ""
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleSaveColumn}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Projeto</DialogTitle>
            <DialogDescription>
              Atualize o nome, plataforma, cor e capa do seu projeto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Projeto</Label>
              <Input
                value={editProject.name}
                onChange={(e) =>
                  setEditProject({ ...editProject, name: e.target.value })
                }
                placeholder="Ex: Canal Principal YouTube"
              />
            </div>
            {editProject.type !== "development" && (
              <div className="space-y-2">
                <Label>Plataforma</Label>
                <Select
                  value={editProject.platform}
                  onValueChange={(v) =>
                    setEditProject({ ...editProject, platform: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORM_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Cor de Destaque</Label>
              <div className="flex gap-2">
                {PROJECT_ACCENT_COLORS.map((color) => (
                  <div
                    key={color}
                    className={`w-8 h-8 rounded cursor-pointer border-2 ${
                      editProject.accentColor === color
                        ? "border-foreground"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() =>
                      setEditProject({ ...editProject, accentColor: color })
                    }
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Imagem de Capa</Label>
              <div
                className="h-28 w-full rounded-md border border-border overflow-hidden relative flex items-center justify-center"
                style={{ backgroundColor: editProject.accentColor }}
              >
                {editProject.coverImageUrl ? (
                  <img
                    src={editProject.coverImageUrl}
                    alt="capa"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-white/80">
                    Pré-visualização da capa
                  </span>
                )}
              </div>
              <Input
                value={editProject.coverImageUrl}
                onChange={(e) =>
                  setEditProject({
                    ...editProject,
                    coverImageUrl: e.target.value,
                  })
                }
                placeholder="Cole uma URL de imagem"
              />
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  className="text-xs"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () =>
                      setEditProject((p) => ({
                        ...p,
                        coverImageUrl: reader.result as string,
                      }));
                    reader.readAsDataURL(file);
                  }}
                />
                {editProject.coverImageUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setEditProject({ ...editProject, coverImageUrl: "" })
                    }
                  >
                    Remover
                  </Button>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              variant="destructive"
              onClick={() => {
                setProjectDialogOpen(false);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setProjectDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveProject}
                disabled={updateProject.isPending || !editProject.name.trim()}
              >
                Salvar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as colunas, tarefas e dados
              de "{project.name}" serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteProject();
              }}
              disabled={deleteProject.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!taskToDelete}
        onOpenChange={(o) => !o && setTaskToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A tarefa
              {taskToDelete ? ` "${taskToDelete.title}"` : ""} será removida
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!taskToDelete) return;
                deleteTask.mutate(
                  { taskId: taskToDelete.id },
                  {
                    onSuccess: () => {
                      invalidateBoard();
                      setTaskToDelete(null);
                    },
                  },
                );
              }}
              disabled={deleteTask.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {openTaskId && project && (
        <TaskSheet
          taskId={openTaskId}
          projectId={id}
          workspaceId={project.workspaceId}
          columns={columns}
          open={!!openTaskId}
          onOpenChange={(o) => !o && closeTaskSheet()}
          onChanged={invalidateBoard}
          onFloat={() => {
            floatTask({
              taskId: openTaskId,
              projectId: id,
              workspaceId: project.workspaceId,
            });
            closeTaskSheet();
          }}
        />
      )}

      <CreateRecurrenceDialog
        task={recurrenceTask}
        columns={columns}
        onClose={() => setRecurrenceTask(null)}
      />
      <RecurrencesDialog
        projectId={id}
        open={recurrencesOpen}
        onOpenChange={setRecurrencesOpen}
      />
    </div>
  );
}
