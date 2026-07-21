import {
  useGetProjectTimeSummary,
  getGetProjectTimeSummaryQueryKey,
} from "@workspace/api-client-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Clock, ListChecks, Users } from "lucide-react";

function formatDuration(total: number): string {
  if (total <= 0) return "0min";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) {
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  if (m > 0) return `${m}min`;
  return `${total}s`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function ProjectTimeReport({
  projectId,
  onSelect,
}: {
  projectId: number;
  onSelect: (taskId: number) => void;
}) {
  const { data: summary, isLoading } = useGetProjectTimeSummary(projectId, {
    query: {
      enabled: !!projectId,
      queryKey: getGetProjectTimeSummaryQueryKey(projectId),
    },
  });

  if (isLoading) {
    return (
      <div className="py-10 text-center text-muted-foreground">
        Carregando tempo registrado...
      </div>
    );
  }

  if (!summary || (summary.tasks.length === 0 && summary.totalSeconds === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Clock className="mb-3 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">
          Nenhum tempo registrado ainda
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Use o cronômetro nas tarefas para acompanhar o tempo gasto.
        </p>
      </div>
    );
  }

  const maxTaskSeconds = summary.tasks.reduce(
    (max, t) => Math.max(max, t.totalSeconds),
    0,
  );

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border bg-muted/30 p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          Tempo total do projeto
        </div>
        <div className="mt-1 font-mono text-3xl font-semibold tabular-nums text-foreground">
          {formatDuration(summary.totalSeconds)}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">
            Tempo por tarefa
          </h2>
        </div>
        <div className="space-y-2">
          {summary.tasks.map((t) => (
            <button
              key={t.taskId}
              onClick={() => onSelect(t.taskId)}
              className="group flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {t.title}
                </p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width:
                        maxTaskSeconds > 0
                          ? `${Math.max(4, (t.totalSeconds / maxTaskSeconds) * 100)}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
              <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                {formatDuration(t.totalSeconds)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {summary.members.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">
              Tempo por membro
            </h2>
          </div>
          <div className="space-y-2">
            {summary.members.map((m) => (
              <div
                key={m.userId}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={m.avatarUrl || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(m.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {m.name}
                </span>
                <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                  {formatDuration(m.totalSeconds)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
