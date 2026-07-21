import { useEffect, useState } from "react";
import {
  useListActiveTimers,
  getListActiveTimersQueryKey,
} from "@workspace/api-client-react";
import { Clock } from "lucide-react";
import { useFloatingTask } from "@/lib/floating-task-context";

function formatElapsed(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function ActiveTimerIndicator() {
  const { floatTask, openFloating } = useFloatingTask();
  const { data: timers = [] } = useListActiveTimers({
    query: {
      queryKey: getListActiveTimersQueryKey(),
      refetchInterval: 30000,
      refetchOnWindowFocus: true,
    },
  });

  const timer = timers[0];
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!timer) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer?.startedAt, timer?.taskId]);

  if (!timer) return null;

  const elapsed = Math.max(
    0,
    Math.round((now - new Date(timer.startedAt).getTime()) / 1000),
  );

  return (
    <button
      onClick={() => {
        floatTask({
          taskId: timer.taskId,
          projectId: timer.projectId,
          workspaceId: timer.workspaceId,
        });
        openFloating();
      }}
      title={`Cronômetro ativo: ${timer.taskTitle} — ${timer.projectName}`}
      aria-label={`Cronômetro ativo em ${timer.taskTitle}. Abrir tarefa.`}
      className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-primary transition-colors hover:bg-primary/20"
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      <Clock className="h-3.5 w-3.5 shrink-0" />
      <span className="font-mono text-xs font-semibold tabular-nums leading-none">
        {formatElapsed(elapsed)}
      </span>
      <span className="hidden max-w-[140px] truncate text-xs leading-none sm:inline">
        {timer.taskTitle}
      </span>
      {timers.length > 1 && (
        <span className="rounded-full bg-primary/20 px-1.5 text-[10px] font-bold leading-4">
          +{timers.length - 1}
        </span>
      )}
    </button>
  );
}
