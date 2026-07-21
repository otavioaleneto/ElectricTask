import { useState, useEffect } from "react";
import {
  useCreateTaskRecurrence,
  useListProjectRecurrences,
  useUpdateRecurrence,
  useDeleteRecurrence,
  getListProjectRecurrencesQueryKey,
} from "@workspace/api-client-react";
import type {
  Task,
  Column,
  Recurrence,
  RecurrenceInputFrequency,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Loader2, Pause, Play, Repeat, Trash2 } from "lucide-react";

const WEEKDAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

const FREQUENCY_OPTIONS: {
  value: RecurrenceInputFrequency;
  label: string;
}[] = [
  { value: "hourly", label: "A cada hora" },
  { value: "daily", label: "Diariamente" },
  { value: "weekly", label: "Semanalmente" },
  { value: "monthly", label: "Mensalmente" },
];

export function describeRecurrence(r: Recurrence): string {
  switch (r.frequency) {
    case "hourly":
      return "A cada hora";
    case "daily":
      return `Diariamente às ${r.timeOfDay ?? "09:00"}`;
    case "weekly":
      return `${WEEKDAYS[r.dayOfWeek ?? 1]} às ${r.timeOfDay ?? "09:00"}`;
    case "monthly":
      return `Dia ${r.dayOfMonth ?? 1} de cada mês às ${r.timeOfDay ?? "09:00"}`;
    default:
      return r.frequency;
  }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CreateRecurrenceDialog({
  task,
  columns,
  onClose,
}: {
  task: Task | null;
  columns: Column[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [columnId, setColumnId] = useState<string>("");
  const [frequency, setFrequency] =
    useState<RecurrenceInputFrequency>("daily");
  const [timeOfDay, setTimeOfDay] = useState("09:00");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [dayOfMonth, setDayOfMonth] = useState("1");

  useEffect(() => {
    if (task) {
      setColumnId(String(task.columnId));
      setFrequency("daily");
      setTimeOfDay("09:00");
      setDayOfWeek("1");
      setDayOfMonth("1");
    }
  }, [task]);

  const createMutation = useCreateTaskRecurrence({
    mutation: {
      onSuccess: (created) => {
        queryClient.invalidateQueries({
          queryKey: getListProjectRecurrencesQueryKey(created.projectId),
        });
        toast({
          title: "Recorrência criada",
          description: `Próxima tarefa: ${formatDateTime(created.nextRunAt)}`,
        });
        onClose();
      },
      onError: () => {
        toast({
          title: "Erro ao criar recorrência",
          variant: "destructive",
        });
      },
    },
  });

  const handleCreate = () => {
    if (!task || !columnId) return;
    const dom = Number(dayOfMonth);
    if (
      frequency === "monthly" &&
      (!Number.isInteger(dom) || dom < 1 || dom > 31)
    ) {
      toast({
        title: "Dia do mês inválido",
        description: "Informe um dia entre 1 e 31.",
        variant: "destructive",
      });
      return;
    }
    if (frequency !== "hourly" && !/^\d{2}:\d{2}$/.test(timeOfDay)) {
      toast({
        title: "Horário inválido",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({
      taskId: task.id,
      data: {
        columnId: Number(columnId),
        frequency,
        ...(frequency !== "hourly" ? { timeOfDay } : {}),
        ...(frequency === "weekly" ? { dayOfWeek: Number(dayOfWeek) } : {}),
        ...(frequency === "monthly" ? { dayOfMonth: dom } : {}),
      },
    });
  };

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-4 w-4" />
            Repetir tarefa
          </DialogTitle>
          <DialogDescription>
            Cria automaticamente uma cópia de "{task?.title}" na frequência
            escolhida, com etiquetas e checklists.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Frequência</Label>
            <Select
              value={frequency}
              onValueChange={(v) =>
                setFrequency(v as RecurrenceInputFrequency)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {frequency === "weekly" && (
            <div className="space-y-2">
              <Label>Dia da semana</Label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {frequency === "monthly" && (
            <div className="space-y-2">
              <Label>Dia do mês</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Em meses mais curtos, será usado o último dia do mês.
              </p>
            </div>
          )}
          {frequency !== "hourly" && (
            <div className="space-y-2">
              <Label>Horário</Label>
              <Input
                type="time"
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Coluna de destino</Label>
            <Select value={columnId} onValueChange={setColumnId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a coluna" />
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending || !columnId}
          >
            {createMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Criar recorrência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RecurrencesDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [toDelete, setToDelete] = useState<Recurrence | null>(null);

  const { data: recurrences, isLoading } = useListProjectRecurrences(
    projectId,
    {
      query: {
        enabled: open,
        queryKey: getListProjectRecurrencesQueryKey(projectId),
      },
    },
  );

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: getListProjectRecurrencesQueryKey(projectId),
    });

  const updateMutation = useUpdateRecurrence({
    mutation: {
      onSuccess: (updated) => {
        invalidate();
        toast({
          title: updated.active
            ? "Recorrência retomada"
            : "Recorrência pausada",
          description: updated.active
            ? `Próxima tarefa: ${formatDateTime(updated.nextRunAt)}`
            : undefined,
        });
      },
      onError: () => {
        toast({ title: "Erro ao atualizar recorrência", variant: "destructive" });
      },
    },
  });

  const deleteMutation = useDeleteRecurrence({
    mutation: {
      onSuccess: () => {
        invalidate();
        setToDelete(null);
        toast({ title: "Recorrência excluída" });
      },
      onError: () => {
        toast({ title: "Erro ao excluir recorrência", variant: "destructive" });
      },
    },
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat className="h-4 w-4" />
              Tarefas recorrentes
            </DialogTitle>
            <DialogDescription>
              Modelos que criam tarefas automaticamente neste projeto.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto space-y-2 py-2">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !recurrences || recurrences.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma recorrência neste projeto. Use o botão de repetir em uma
                tarefa para criar uma.
              </p>
            ) : (
              recurrences.map((r) => (
                <div
                  key={r.id}
                  className={`flex items-center gap-3 rounded-lg border border-border p-3 ${
                    r.active ? "" : "opacity-60"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {describeRecurrence(r)} · Coluna: {r.columnName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.active
                        ? `Próxima: ${formatDateTime(r.nextRunAt)}`
                        : "Pausada"}
                      {r.lastRunAt
                        ? ` · Última: ${formatDateTime(r.lastRunAt)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={r.active ? "Pausar" : "Retomar"}
                      title={r.active ? "Pausar" : "Retomar"}
                      disabled={updateMutation.isPending}
                      onClick={() =>
                        updateMutation.mutate({
                          recurrenceId: r.id,
                          data: { active: !r.active },
                        })
                      }
                    >
                      {r.active ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      aria-label="Excluir recorrência"
                      title="Excluir recorrência"
                      onClick={() => setToDelete(r)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir recorrência?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.title}" deixará de ser criada automaticamente. As
              tarefas já criadas não serão afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (toDelete) {
                  deleteMutation.mutate({ recurrenceId: toDelete.id });
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
