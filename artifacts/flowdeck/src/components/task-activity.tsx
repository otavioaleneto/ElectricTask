import {
  useListTaskActivity,
  getListTaskActivityQueryKey,
} from "@workspace/api-client-react";
import type { Activity } from "@workspace/api-client-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(" ");
}

function describe(a: Activity): string {
  switch (a.action) {
    case "created":
      return "criou a tarefa";
    case "completed":
      return "concluiu a tarefa";
    case "reopened":
      return "reabriu a tarefa";
    case "moved":
      return a.detail ? `moveu para "${a.detail}"` : "moveu a tarefa";
    case "assignee_changed":
      return a.detail
        ? `definiu o responsável como ${a.detail}`
        : "removeu o responsável";
    case "due_changed":
      return a.detail
        ? `definiu a entrega para ${new Date(a.detail).toLocaleDateString("pt-BR")}`
        : "removeu a data de entrega";
    case "timer_started":
      return "iniciou o cronômetro";
    case "timer_paused":
      return a.detail
        ? `pausou o cronômetro (${formatDuration(Number(a.detail))})`
        : "pausou o cronômetro";
    case "timer_finished":
      return a.detail
        ? `finalizou a tarefa pelo cronômetro (${formatDuration(Number(a.detail))})`
        : "finalizou a tarefa pelo cronômetro";
    default:
      return "atualizou a tarefa";
  }
}

export function TaskActivity({ taskId }: { taskId: number }) {
  const { data: activities = [], isLoading } = useListTaskActivity(taskId, {
    query: { queryKey: getListTaskActivityQueryKey(taskId) },
  });

  if (isLoading) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Carregando...
      </p>
    );
  }

  if (activities.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhuma atividade ainda.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((a) => (
        <div key={a.id} className="flex gap-3">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarImage src={a.actor?.avatarUrl || undefined} />
            <AvatarFallback className="text-[10px]">
              {a.actor ? a.actor.name.charAt(0).toUpperCase() : "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-medium">
                {a.actor?.name ?? "Alguém"}
              </span>{" "}
              <span className="text-muted-foreground">{describe(a)}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDate(a.createdAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
