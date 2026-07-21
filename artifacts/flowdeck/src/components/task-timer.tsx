import { useState, useEffect } from "react";
import {
  useGetTaskTimer,
  useStartTimer,
  useStopTimer,
  getGetTaskTimerQueryKey,
  getListTaskActivityQueryKey,
  getListActiveTimersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Play, Pause, Clock } from "lucide-react";

function formatTimer(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function TaskTimer({
  taskId,
  open,
  onChanged,
}: {
  taskId: number;
  open: boolean;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: timer } = useGetTaskTimer(taskId, {
    query: { enabled: open, queryKey: getGetTaskTimerQueryKey(taskId) },
  });
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const [seconds, setSeconds] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const running = timer?.running ?? false;

  useEffect(() => {
    setSeconds(timer?.totalSeconds ?? 0);
  }, [timer]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: getGetTaskTimerQueryKey(taskId),
    });
    queryClient.invalidateQueries({
      queryKey: getListTaskActivityQueryKey(taskId),
    });
    queryClient.invalidateQueries({
      queryKey: getListActiveTimersQueryKey(),
    });
    onChanged();
  };

  const handleStart = () => {
    startTimer.mutate({ taskId }, { onSuccess: refresh });
  };

  const handleStop = (finished: boolean) => {
    stopTimer.mutate(
      { taskId, data: { finished } },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          refresh();
        },
      },
    );
  };

  return (
    <div className="space-y-3">
      <Label>Cronômetro</Label>
      <div className="flex items-center gap-2 rounded-lg border border-border p-3">
        <Clock
          className={`h-5 w-5 shrink-0 ${
            running ? "text-primary" : "text-muted-foreground"
          }`}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-mono text-lg tabular-nums leading-none">
            {formatTimer(seconds)}
          </span>
          <span className="truncate text-[11px] text-muted-foreground">
            Tempo total da tarefa
          </span>
        </div>
        {running ? (
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full"
            onClick={() => setConfirmOpen(true)}
            disabled={stopTimer.isPending}
            aria-label="Pausar"
            title="Pausar"
          >
            <Pause className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full"
            onClick={handleStart}
            disabled={startTimer.isPending}
            aria-label="Iniciar"
            title="Iniciar"
          >
            <Play className="h-4 w-4" />
          </Button>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tarefa finalizada?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja finalizar a tarefa e marcá-la como concluída, ou apenas
              pausar o cronômetro?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={stopTimer.isPending}>
              Cancelar
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => handleStop(false)}
              disabled={stopTimer.isPending}
            >
              Apenas pausar
            </Button>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleStop(true);
              }}
              disabled={stopTimer.isPending}
            >
              Finalizar tarefa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
