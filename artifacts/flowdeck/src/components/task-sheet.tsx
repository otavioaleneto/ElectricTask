import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  useGetTask,
  useUpdateTask,
  useDeleteTask,
  useListChecklists,
  useCreateChecklist,
  useListMindmaps,
  useCreateMindmap,
  useListWorkspaceMembers,
  useListLabels,
  useCreateLabel,
  useUpdateLabel,
  useDeleteLabel,
  useListSubscriptions,
  useListTaskSubscriptions,
  useLinkTaskSubscription,
  useUnlinkTaskSubscription,
  getGetTaskQueryKey,
  getListChecklistsQueryKey,
  getListMindmapsQueryKey,
  getListWorkspaceMembersQueryKey,
  getListLabelsQueryKey,
  getListSubscriptionsQueryKey,
  getListTaskSubscriptionsQueryKey,
  type Subscription,
} from "@workspace/api-client-react";
import { ChecklistGroup } from "./checklist-group";
import { TaskComments } from "./task-comments";
import { TaskActivity } from "./task-activity";
import { TaskAttachments } from "./task-attachments";
import { TaskAttachmentsGallery } from "./task-attachments-gallery";
import { RichTextEditor, type RichTextEditorHandle } from "./rich-text-editor";
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
import { TaskTimer } from "./task-timer";
import { TaskVideoLinks } from "./task-video-links";
import { SubscriptionLogo } from "@/components/subscription-logo";
import { brandDisplay } from "@/lib/subscription-brands";
import { parseDueDate, startOfToday } from "@/lib/date";
import type { Column } from "@workspace/api-client-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Trash2,
  Network,
  Plus,
  X,
  ExternalLink,
  Loader2,
  Tag,
  Pencil,
  Check,
  Save,
  PictureInPicture2,
  CreditCard,
} from "lucide-react";

const LABEL_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#64748b",
];

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

function subDueLabel(dateStr: string): {
  text: string;
  overdue: boolean;
  soon: boolean;
} {
  const due = parseDueDate(dateStr);
  const d = Math.round(
    (due.getTime() - startOfToday().getTime()) / 86_400_000,
  );
  if (d < 0)
    return {
      text: `Vencida há ${Math.abs(d)} ${Math.abs(d) === 1 ? "dia" : "dias"}`,
      overdue: true,
      soon: false,
    };
  if (d === 0) return { text: "Vence hoje", overdue: false, soon: true };
  if (d === 1) return { text: "Vence amanhã", overdue: false, soon: true };
  return { text: `Vence em ${d} dias`, overdue: false, soon: d <= 7 };
}

export function TaskSheet({
  taskId,
  projectId,
  workspaceId,
  columns,
  open,
  onOpenChange,
  onChanged,
  onFloat,
}: {
  taskId: number;
  projectId: number;
  workspaceId: number;
  columns: Column[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
  onFloat?: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: task, isLoading } = useGetTask(taskId, {
    query: { enabled: open, queryKey: getGetTaskQueryKey(taskId) },
  });
  const { data: checklists = [] } = useListChecklists(taskId, {
    query: { enabled: open, queryKey: getListChecklistsQueryKey(taskId) },
  });
  const { data: mindmaps = [] } = useListMindmaps(workspaceId, {
    query: { enabled: open, queryKey: getListMindmapsQueryKey(workspaceId) },
  });
  const { data: members = [] } = useListWorkspaceMembers(workspaceId, {
    query: {
      enabled: open,
      queryKey: getListWorkspaceMembersQueryKey(workspaceId),
    },
  });
  const { data: labels = [] } = useListLabels(projectId, {
    query: { enabled: open, queryKey: getListLabelsQueryKey(projectId) },
  });
  const { data: taskSubscriptions = [] } = useListTaskSubscriptions(taskId, {
    query: { enabled: open, queryKey: getListTaskSubscriptionsQueryKey(taskId) },
  });
  const { data: allSubscriptions = [] } = useListSubscriptions(
    workspaceId,
    {},
    {
      query: {
        enabled: open,
        queryKey: getListSubscriptionsQueryKey(workspaceId),
      },
    },
  );

  const linkSubscription = useLinkTaskSubscription();
  const unlinkSubscription = useUnlinkTaskSubscription();
  const [subPickerOpen, setSubPickerOpen] = useState(false);

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const createChecklist = useCreateChecklist();
  const createMindmap = useCreateMindmap();
  const createLabel = useCreateLabel();
  const updateLabel = useUpdateLabel();
  const deleteLabel = useDeleteLabel();

  const [title, setTitle] = useState("");
  const [newChecklist, setNewChecklist] = useState("");
  const [linking, setLinking] = useState(false);
  const [editMeta, setEditMeta] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const [editLabelId, setEditLabelId] = useState<number | null>(null);
  const [editLabelName, setEditLabelName] = useState("");
  const [editLabelColor, setEditLabelColor] = useState(LABEL_COLORS[0]);
  const [confirmClose, setConfirmClose] = useState(false);
  const [savingClose, setSavingClose] = useState(false);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<RichTextEditorHandle>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
    }
  }, [task]);

  const handleOpenChange = (next: boolean) => {
    if (!next && editorRef.current?.isDirty()) {
      setConfirmClose(true);
      return;
    }
    onOpenChange(next);
  };

  const discardAndClose = () => {
    editorRef.current?.reset();
    setConfirmClose(false);
    onOpenChange(false);
  };

  const saveAndClose = async () => {
    setSavingClose(true);
    try {
      await editorRef.current?.save();
      setConfirmClose(false);
      onOpenChange(false);
    } catch {
      toast({
        title: "Não foi possível salvar a descrição",
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSavingClose(false);
    }
  };

  const handleFloatingSave = async () => {
    if (!task) return;
    const hasTitleChange = !!(title.trim() && title !== task.title);
    const hasDescChange = editorRef.current?.isDirty() ?? false;
    if (!hasTitleChange && !hasDescChange) {
      toast({ title: "Nenhuma alteração para salvar" });
      return;
    }
    setSaving(true);
    try {
      if (hasTitleChange) {
        const updated = await updateTask.mutateAsync({
          taskId,
          data: { title: title.trim() },
        });
        queryClient.setQueryData(getGetTaskQueryKey(taskId), updated);
      }
      if (hasDescChange) {
        await editorRef.current?.save();
      }
      refreshTask();
      toast({ title: "Alterações salvas" });
    } catch {
      toast({
        title: "Não foi possível salvar a tarefa",
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const refreshTask = () => {
    queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(taskId) });
    onChanged();
  };
  const refreshChecklist = () => {
    queryClient.invalidateQueries({
      queryKey: getListChecklistsQueryKey(taskId),
    });
    refreshTask();
  };

  const saveField = (data: Record<string, unknown>) => {
    updateTask.mutate(
      { taskId, data },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetTaskQueryKey(taskId), updated);
          refreshTask();
        },
      },
    );
  };

  const refreshLabels = () => {
    queryClient.invalidateQueries({
      queryKey: getListLabelsQueryKey(projectId),
    });
  };

  const toggleLabel = (labelId: number) => {
    if (!task) return;
    const current = task.labels.map((l) => l.id);
    const next = current.includes(labelId)
      ? current.filter((x) => x !== labelId)
      : [...current, labelId];
    saveField({ labelIds: next });
  };

  const handleCreateLabel = () => {
    const name = newLabelName.trim();
    if (!name || !task) return;
    createLabel.mutate(
      { projectId, data: { name, color: newLabelColor } },
      {
        onSuccess: (created) => {
          setNewLabelName("");
          setNewLabelColor(LABEL_COLORS[0]);
          refreshLabels();
          saveField({
            labelIds: [...task.labels.map((l) => l.id), created.id],
          });
        },
      },
    );
  };

  const startEditLabel = (l: { id: number; name: string; color: string }) => {
    setEditLabelId(l.id);
    setEditLabelName(l.name);
    setEditLabelColor(l.color);
  };

  const handleSaveLabel = () => {
    const name = editLabelName.trim();
    if (!name || editLabelId == null) return;
    updateLabel.mutate(
      { labelId: editLabelId, data: { name, color: editLabelColor } },
      {
        onSuccess: () => {
          setEditLabelId(null);
          refreshLabels();
          refreshTask();
        },
      },
    );
  };

  const handleDeleteLabel = (labelId: number) => {
    deleteLabel.mutate(
      { labelId },
      {
        onSuccess: () => {
          if (editLabelId === labelId) setEditLabelId(null);
          refreshLabels();
          refreshTask();
        },
      },
    );
  };

  const handleAddChecklist = () => {
    if (!newChecklist.trim()) return;
    createChecklist.mutate(
      { taskId, data: { title: newChecklist.trim() } },
      {
        onSuccess: () => {
          setNewChecklist("");
          refreshChecklist();
        },
      },
    );
  };

  const handleCreateMindmap = () => {
    if (linking) return;
    setLinking(true);
    createMindmap.mutate(
      { workspaceId, data: { name: title || "Mapa Mental", taskId } },
      {
        onSuccess: (mm) => {
          updateTask.mutate(
            { taskId, data: { mindmapId: mm.id } },
            {
              onSuccess: (updated) => {
                queryClient.setQueryData(
                  getGetTaskQueryKey(taskId),
                  updated,
                );
                queryClient.invalidateQueries({
                  queryKey: getListMindmapsQueryKey(workspaceId),
                });
                refreshTask();
                setLinking(false);
                setLocation(`/mindmaps/${mm.id}`);
              },
              onError: () => setLinking(false),
            },
          );
        },
        onError: () => setLinking(false),
      },
    );
  };

  const linkedMindmap = mindmaps.find((m) => m.id === task?.mindmapId);

  const linkedSubIds = new Set(taskSubscriptions.map((s) => s.id));
  const availableSubscriptions = allSubscriptions.filter(
    (s) => !linkedSubIds.has(s.id),
  );

  const refreshSubscriptions = () => {
    queryClient.invalidateQueries({
      queryKey: getListTaskSubscriptionsQueryKey(taskId),
    });
  };

  const handleLinkSubscription = (subscriptionId: number) => {
    linkSubscription.mutate(
      { taskId, data: { subscriptionId } },
      {
        onSuccess: (subs) => {
          queryClient.setQueryData(
            getListTaskSubscriptionsQueryKey(taskId),
            subs,
          );
          setSubPickerOpen(false);
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title:
              err?.data?.error ?? "Não foi possível vincular a assinatura",
          });
        },
      },
    );
  };

  const handleUnlinkSubscription = (subscriptionId: number) => {
    unlinkSubscription.mutate(
      { taskId, subscriptionId },
      {
        onSuccess: refreshSubscriptions,
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title:
              err?.data?.error ?? "Não foi possível desvincular a assinatura",
          });
        },
      },
    );
  };

  return (
    <>
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {onFloat && (
          <button
            type="button"
            onClick={onFloat}
            aria-label="Flutuar tarefa"
            title="Flutuar tarefa"
            className="absolute right-12 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <PictureInPicture2 className="h-4 w-4" />
            <span className="sr-only">Flutuar tarefa</span>
          </button>
        )}
        <SheetHeader>
          <div
            className={`flex items-center justify-between gap-4 ${
              onFloat ? "pr-16" : "pr-8"
            }`}
          >
            <SheetTitle>Detalhes da Tarefa</SheetTitle>
            {task && (
              <div className="flex items-center gap-2 whitespace-nowrap text-sm font-medium">
                <span>Concluída</span>
                <Checkbox
                  checked={task.completed}
                  onCheckedChange={(c) => saveField({ completed: !!c })}
                  aria-label="Marcar tarefa como concluída"
                />
              </div>
            )}
          </div>
          {task && (
            <div className="flex items-start gap-2 text-left">
              {editMeta ? (
                <div className="flex-1 space-y-3 rounded-md border bg-muted/30 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Coluna</Label>
                      <Select
                        value={String(task.columnId)}
                        onValueChange={(v) =>
                          saveField({ columnId: parseInt(v, 10) })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {columns.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Prioridade</Label>
                      <Select
                        value={task.priority}
                        onValueChange={(v) => saveField({ priority: v })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Baixa</SelectItem>
                          <SelectItem value="medium">Média</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Responsável</Label>
                    <Select
                      value={task.assigneeId ? String(task.assigneeId) : "none"}
                      onValueChange={(v) =>
                        saveField({
                          assigneeId: v === "none" ? null : parseInt(v, 10),
                        })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Ninguém" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Ninguém</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.userId} value={String(m.userId)}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={m.avatarUrl || undefined} />
                                <AvatarFallback className="text-[10px]">
                                  {m.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {m.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">Coluna:</span>{" "}
                  {columns.find((c) => c.id === task.columnId)?.name ?? "—"}
                  <span className="mx-1.5 text-muted-foreground/40">|</span>
                  <span className="font-semibold text-foreground">
                    Prioridade:
                  </span>{" "}
                  {PRIORITY_LABELS[task.priority] ?? task.priority}
                  <span className="mx-1.5 text-muted-foreground/40">|</span>
                  <span className="font-semibold text-foreground">
                    Responsável:
                  </span>{" "}
                  {task.assigneeId
                    ? members.find((m) => m.userId === task.assigneeId)?.name ??
                      "…"
                    : "Ninguém"}
                </p>
              )}
              <button
                type="button"
                onClick={() => setEditMeta((v) => !v)}
                aria-label={
                  editMeta
                    ? "Concluir edição"
                    : "Editar coluna, prioridade e responsável"
                }
                title={editMeta ? "Concluir" : "Editar"}
                className="mt-0.5 shrink-0 rounded-sm p-1 text-muted-foreground opacity-70 transition-opacity hover:text-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {editMeta ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Pencil className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          )}
        </SheetHeader>

        {isLoading || !task ? (
          <div className="py-10 text-center text-muted-foreground">
            Carregando...
          </div>
        ) : (
          <>
          <Tabs defaultValue="details" className="py-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="attachments">Anexos</TabsTrigger>
              <TabsTrigger value="comments">Comentários</TabsTrigger>
              <TabsTrigger value="activity">Atividade</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="space-y-6 pb-24">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() =>
                  title.trim() && title !== task.title && saveField({ title })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4 items-start">
              <div className="space-y-2">
                <Label>Tipo de tarefa</Label>
                <Select
                  value={task.type}
                  onValueChange={(v) => saveField({ type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Padrão</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <TaskTimer taskId={taskId} open={open} onChanged={refreshTask} />
            </div>

            <div className="space-y-2">
              <Label>Data de entrega</Label>
              <Input
                type="date"
                value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
                onChange={(e) =>
                  saveField({ dueDate: e.target.value || null })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <RichTextEditor
                key={taskId}
                taskId={taskId}
                ref={editorRef}
                initialContent={task.description || ""}
                onSave={(html) =>
                  updateTask.mutateAsync(
                    { taskId, data: { description: html } },
                    {
                      onSuccess: () => {
                        queryClient.setQueryData<typeof task>(
                          getGetTaskQueryKey(taskId),
                          (old) => (old ? { ...old, description: html } : old),
                        );
                        refreshTask();
                      },
                    },
                  )
                }
              />
            </div>

            <Separator />

            <TaskAttachments taskId={taskId} />

            <Separator />

            <div className="space-y-2">
              <Label>Etiquetas</Label>
              <div className="flex flex-wrap items-center gap-1.5">
                {task.labels.map((l) => (
                  <span
                    key={l.id}
                    className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: l.color }}
                  >
                    {l.name}
                    <button
                      onClick={() => toggleLabel(l.id)}
                      aria-label={`Remover ${l.name}`}
                      className="opacity-80 hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs"
                    >
                      <Tag className="mr-1 h-3 w-3" /> Etiqueta
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-64 p-2">
                    <div className="max-h-48 space-y-0.5 overflow-y-auto">
                      {labels.length === 0 && (
                        <p className="px-1 py-2 text-xs text-muted-foreground">
                          Nenhuma etiqueta ainda.
                        </p>
                      )}
                      {labels.map((l) =>
                        editLabelId === l.id ? (
                          <div
                            key={l.id}
                            className="space-y-1.5 rounded-md border p-2"
                          >
                            <Input
                              value={editLabelName}
                              onChange={(e) => setEditLabelName(e.target.value)}
                              className="h-7 text-xs"
                            />
                            <div className="flex flex-wrap gap-1">
                              {LABEL_COLORS.map((c) => (
                                <button
                                  key={c}
                                  onClick={() => setEditLabelColor(c)}
                                  className={`h-5 w-5 rounded-sm ${
                                    editLabelColor === c
                                      ? "ring-2 ring-offset-1 ring-offset-background ring-foreground"
                                      : ""
                                  }`}
                                  style={{ backgroundColor: c }}
                                  aria-label={`Cor ${c}`}
                                />
                              ))}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                className="h-6 text-xs"
                                onClick={handleSaveLabel}
                              >
                                Salvar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs"
                                onClick={() => setEditLabelId(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            key={l.id}
                            className="flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-muted"
                          >
                            <button
                              onClick={() => toggleLabel(l.id)}
                              className="flex flex-1 items-center gap-2 text-left"
                            >
                              <span
                                className="h-3 w-3 rounded-sm"
                                style={{ backgroundColor: l.color }}
                              />
                              <span className="flex-1 truncate text-xs">
                                {l.name}
                              </span>
                              {task.labels.some((tl) => tl.id === l.id) && (
                                <Check className="h-3.5 w-3.5 text-primary" />
                              )}
                            </button>
                            <button
                              onClick={() => startEditLabel(l)}
                              aria-label="Editar etiqueta"
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteLabel(l.id)}
                              aria-label="Excluir etiqueta"
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ),
                      )}
                    </div>
                    <Separator className="my-2" />
                    <div className="space-y-1.5">
                      <Input
                        value={newLabelName}
                        onChange={(e) => setNewLabelName(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleCreateLabel()
                        }
                        placeholder="Nova etiqueta"
                        className="h-7 text-xs"
                      />
                      <div className="flex flex-wrap gap-1">
                        {LABEL_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => setNewLabelColor(c)}
                            className={`h-5 w-5 rounded-sm ${
                              newLabelColor === c
                                ? "ring-2 ring-offset-1 ring-offset-background ring-foreground"
                                : ""
                            }`}
                            style={{ backgroundColor: c }}
                            aria-label={`Cor ${c}`}
                          />
                        ))}
                      </div>
                      <Button
                        size="sm"
                        className="h-6 w-full text-xs"
                        onClick={handleCreateLabel}
                        disabled={!newLabelName.trim() || createLabel.isPending}
                      >
                        Criar etiqueta
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base">Checklists</Label>
                {task.checklistTotal > 0 && (
                  <Badge variant="secondary">
                    {task.checklistDone}/{task.checklistTotal}
                  </Badge>
                )}
              </div>
              <div className="space-y-3">
                {checklists
                  .slice()
                  .sort((a, b) => a.position - b.position)
                  .map((cl) => (
                    <ChecklistGroup
                      key={cl.id}
                      checklist={cl}
                      onChanged={refreshChecklist}
                    />
                  ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newChecklist}
                  onChange={(e) => setNewChecklist(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddChecklist()}
                  placeholder="Nova checklist..."
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="shrink-0"
                  onClick={handleAddChecklist}
                  aria-label="Adicionar checklist"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-base">Mapa Mental</Label>
              {linkedMindmap ? (
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-primary" />
                    <span className="text-sm">{linkedMindmap.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        setLocation(`/mindmaps/${linkedMindmap.id}`)
                      }
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => saveField({ mindmapId: null })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleCreateMindmap}
                  disabled={linking}
                >
                  {linking ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Network className="mr-2 h-4 w-4" />
                  )}
                  Criar e vincular mapa mental
                </Button>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base">Assinaturas</Label>
                <Popover open={subPickerOpen} onOpenChange={setSubPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8">
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Vincular
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Buscar assinatura..." />
                      <CommandList>
                        <CommandEmpty>
                          {availableSubscriptions.length === 0
                            ? "Nenhuma assinatura disponível."
                            : "Nenhuma assinatura encontrada."}
                        </CommandEmpty>
                        <CommandGroup>
                          {availableSubscriptions.map((sub) => (
                            <CommandItem
                              key={sub.id}
                              value={brandDisplay(sub).name}
                              onSelect={() => handleLinkSubscription(sub.id)}
                              className="gap-2"
                            >
                              <SubscriptionLogo sub={sub} size={24} />
                              <span className="truncate">
                                {brandDisplay(sub).name}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              {taskSubscriptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma assinatura vinculada a esta tarefa.
                </p>
              ) : (
                <div className="space-y-2">
                  {taskSubscriptions.map((sub: Subscription) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onOpenChange(false);
                          setLocation("/subscriptions");
                        }}
                        className="flex min-w-0 items-center gap-2 text-left"
                      >
                        <SubscriptionLogo sub={sub} size={28} />
                        <div className="min-w-0">
                          <span className="block truncate text-sm">
                            {brandDisplay(sub).name}
                          </span>
                          {(() => {
                            const meta = subDueLabel(sub.nextDueDate);
                            return (
                              <span
                                className={`block truncate text-xs ${
                                  meta.overdue
                                    ? "text-destructive"
                                    : meta.soon
                                      ? "text-amber-600 dark:text-amber-500"
                                      : "text-muted-foreground"
                                }`}
                              >
                                {meta.text}
                              </span>
                            );
                          })()}
                        </div>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => handleUnlinkSubscription(sub.id)}
                        disabled={unlinkSubscription.isPending}
                        aria-label="Desvincular assinatura"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {task.type === "video" && (
              <>
                <Separator />
                <TaskVideoLinks
                  taskId={taskId}
                  videoLinks={task.videoLinks}
                  onChanged={refreshTask}
                />
              </>
            )}

            <Separator />

            <Button
              variant="destructive"
              className="w-full"
              onClick={() =>
                deleteTask.mutate(
                  { taskId },
                  {
                    onSuccess: () => {
                      onChanged();
                      onOpenChange(false);
                    },
                  },
                )
              }
            >
              <Trash2 className="mr-2 h-4 w-4" /> Excluir Tarefa
            </Button>
            </TabsContent>

            <TabsContent value="attachments">
              <TaskAttachmentsGallery taskId={taskId} />
            </TabsContent>

            <TabsContent value="comments">
              <TaskComments taskId={taskId} members={members} />
            </TabsContent>

            <TabsContent value="activity">
              <TaskActivity taskId={taskId} />
            </TabsContent>
          </Tabs>
          <div className="pointer-events-none sticky bottom-6 z-10 flex justify-end">
            <Button
              type="button"
              size="icon"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void handleFloatingSave()}
              disabled={saving}
              aria-label="Salvar tarefa"
              title="Salvar tarefa"
              className="pointer-events-auto h-14 w-14 rounded-full shadow-lg"
            >
              {saving ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Save className="h-6 w-6" />
              )}
              <span className="sr-only">Salvar tarefa</span>
            </Button>
          </div>
          </>
        )}
      </SheetContent>
    </Sheet>

    <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Houve alterações nessa tarefa</AlertDialogTitle>
          <AlertDialogDescription>
            Você editou a descrição e ainda não salvou. Deseja salvar as
            alterações antes de fechar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={savingClose} onClick={discardAndClose}>
            Descartar alterações
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={savingClose}
            onClick={(e) => {
              e.preventDefault();
              void saveAndClose();
            }}
          >
            Salvar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
