import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  useGetWorkspaceGraph,
  getGetWorkspaceGraphQueryKey,
} from "@workspace/api-client-react";
import type { GraphNode } from "@workspace/api-client-react";
import { useWorkspace } from "@/lib/workspace-context";
import { Card } from "@/components/ui/card";
import { Share2, FileText, Network, CheckSquare } from "lucide-react";

const CANVAS_W = 900;
const CANVAS_H = 640;

type Pos = { x: number; y: number };

const typeOrder: Record<GraphNode["type"], number> = {
  note: 0,
  mindmap: 1,
  task: 2,
};

const typeStyle: Record<
  GraphNode["type"],
  { border: string; bg: string; icon: typeof FileText }
> = {
  note: { border: "#3b82f6", bg: "rgba(59,130,246,0.12)", icon: FileText },
  mindmap: { border: "#8b5cf6", bg: "rgba(139,92,246,0.12)", icon: Network },
  task: { border: "#22c55e", bg: "rgba(34,197,94,0.12)", icon: CheckSquare },
};

const nodeKey = (n: { type: string; id: number }) => `${n.type}:${n.id}`;

export default function Graph() {
  const { activeWorkspaceId } = useWorkspace();
  const [, setLocation] = useLocation();

  const { data: graph, isLoading } = useGetWorkspaceGraph(activeWorkspaceId!, {
    query: {
      enabled: !!activeWorkspaceId,
      queryKey: getGetWorkspaceGraphQueryKey(activeWorkspaceId!),
    },
  });

  const [positions, setPositions] = useState<Record<string, Pos>>({});
  const [dragKey, setDragKey] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef<Pos>({ x: 0, y: 0 });
  const downClient = useRef<Pos>({ x: 0, y: 0 });
  const movedRef = useRef(false);

  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];

  const sig = nodes
    .map(nodeKey)
    .sort()
    .join("|");

  useEffect(() => {
    if (nodes.length === 0) {
      setPositions({});
      return;
    }
    const ordered = [...nodes].sort((a, b) =>
      typeOrder[a.type] !== typeOrder[b.type]
        ? typeOrder[a.type] - typeOrder[b.type]
        : a.id - b.id,
    );
    const cx = CANVAS_W / 2;
    const cy = CANVAS_H / 2;
    const radius = Math.min(270, 110 + ordered.length * 9);
    const next: Record<string, Pos> = {};
    ordered.forEach((n, i) => {
      const angle = (i / ordered.length) * 2 * Math.PI - Math.PI / 2;
      next[nodeKey(n)] = {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    });
    setPositions(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const onPointerDown = (e: React.PointerEvent, key: string) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const pos = positions[key];
    if (!rect || !pos) return;
    movedRef.current = false;
    downClient.current = { x: e.clientX, y: e.clientY };
    dragOffset.current = {
      x: e.clientX - rect.left - pos.x,
      y: e.clientY - rect.top - pos.y,
    };
    setDragKey(key);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragKey) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = e.clientX - downClient.current.x;
    const dy = e.clientY - downClient.current.y;
    if (Math.hypot(dx, dy) > 4) movedRef.current = true;
    const x = e.clientX - rect.left - dragOffset.current.x;
    const y = e.clientY - rect.top - dragOffset.current.y;
    setPositions((prev) => ({
      ...prev,
      [dragKey]: {
        x: Math.max(60, Math.min(CANVAS_W - 60, x)),
        y: Math.max(30, Math.min(CANVAS_H - 30, y)),
      },
    }));
  };

  const onPointerUp = () => setDragKey(null);

  const navTo = (n: GraphNode) => {
    if (movedRef.current) return;
    if (n.type === "note") setLocation(`/notes/${n.id}`);
    else if (n.type === "mindmap") setLocation(`/mindmaps/${n.id}`);
    else if (n.type === "task" && n.projectId != null)
      setLocation(`/projects/${n.projectId}?task=${n.id}`);
  };

  if (!activeWorkspaceId)
    return <div className="p-8">Selecione um workspace primeiro.</div>;
  if (isLoading) return <div className="p-8">Carregando grafo...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Grafo</h1>
          <p className="text-muted-foreground">
            Visão geral das conexões entre notas, mapas mentais e tarefas.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: "#3b82f6" }}
            />
            Notas
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: "#8b5cf6" }}
            />
            Mapas
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: "#22c55e" }}
            />
            Tarefas
          </span>
        </div>
      </div>

      {nodes.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <Share2 className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-lg font-medium">Grafo vazio</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            Crie notas e mapas mentais, e conecte-os com links [[título]] para
            ver o grafo de conhecimento.
          </p>
        </Card>
      ) : (
        <div className="overflow-auto rounded-xl border border-border bg-muted/30">
          <div
            ref={canvasRef}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            className="relative select-none"
            style={{
              width: CANVAS_W,
              height: CANVAS_H,
              backgroundImage:
                "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          >
            <svg className="absolute inset-0 h-full w-full pointer-events-none">
              {edges.map((edge) => {
                const s = positions[`${edge.sourceType}:${edge.sourceId}`];
                const t = positions[`${edge.targetType}:${edge.targetId}`];
                if (!s || !t) return null;
                return (
                  <line
                    key={edge.id}
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke="hsl(var(--primary))"
                    strokeWidth={1.5}
                    strokeOpacity={0.4}
                  />
                );
              })}
            </svg>

            {nodes.map((node) => {
              const key = nodeKey(node);
              const pos = positions[key];
              if (!pos) return null;
              const style = typeStyle[node.type];
              const Icon = style.icon;
              return (
                <div
                  key={key}
                  onPointerDown={(e) => onPointerDown(e, key)}
                  onClick={() => navTo(node)}
                  className={`absolute flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-medium shadow-sm max-w-[180px] ${
                    dragKey === key ? "cursor-grabbing z-20" : "cursor-grab z-10"
                  } hover:shadow-md`}
                  style={{
                    left: pos.x,
                    top: pos.y,
                    transform: "translate(-50%, -50%)",
                    borderColor: style.border,
                    backgroundColor: "hsl(var(--card))",
                    boxShadow: `0 0 0 4px ${style.bg}`,
                  }}
                  title={node.title}
                >
                  <Icon
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: style.border }}
                  />
                  <span className="truncate">{node.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
