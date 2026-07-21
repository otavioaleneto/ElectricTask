import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardList, X } from "lucide-react";
import {
  useListColumns,
  useGetCurrentUser,
  getListColumnsQueryKey,
  getListTasksQueryKey,
  getGetTaskQueryKey,
  getGetWorkspaceSummaryQueryKey,
} from "@workspace/api-client-react";
import { TaskSheet } from "@/components/task-sheet";
import {
  useFloatingTask,
  type FloatingTaskInfo,
} from "@/lib/floating-task-context";

const BUBBLE_SIZE = 56;
const EDGE_GAP = 12;
const DRAG_THRESHOLD = 4;

export function FloatingTask() {
  const { floating, closeFloating } = useFloatingTask();
  const { data: user, isLoading } = useGetCurrentUser();

  useEffect(() => {
    if (!isLoading && !user && floating) closeFloating();
  }, [isLoading, user, floating, closeFloating]);

  if (!floating || isLoading || !user) return null;
  return <FloatingTaskInner key={floating.taskId} floating={floating} />;
}

function FloatingTaskInner({ floating }: { floating: FloatingTaskInfo }) {
  const { expanded, openFloating, minimizeFloating, closeFloating } =
    useFloatingTask();
  const queryClient = useQueryClient();

  const { data: columns = [] } = useListColumns(floating.projectId, {
    query: {
      enabled: true,
      queryKey: getListColumnsQueryKey(floating.projectId),
    },
  });

  const handleChanged = () => {
    queryClient.invalidateQueries({
      queryKey: getGetTaskQueryKey(floating.taskId),
    });
    queryClient.invalidateQueries({
      queryKey: getListTasksQueryKey(floating.projectId),
    });
    queryClient.invalidateQueries({
      queryKey: getListColumnsQueryKey(floating.projectId),
    });
    queryClient.invalidateQueries({
      queryKey: getGetWorkspaceSummaryQueryKey(floating.workspaceId),
    });
  };

  const [pos, setPos] = useState(() => ({
    x:
      typeof window !== "undefined"
        ? window.innerWidth - BUBBLE_SIZE - 24
        : EDGE_GAP,
    y:
      typeof window !== "undefined"
        ? window.innerHeight - BUBBLE_SIZE - 96
        : EDGE_GAP,
  }));

  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);
  const draggedRef = useRef(false);

  const clamp = (x: number, y: number) => ({
    x: Math.min(Math.max(EDGE_GAP, x), window.innerWidth - BUBBLE_SIZE - EDGE_GAP),
    y: Math.min(
      Math.max(EDGE_GAP, y),
      window.innerHeight - BUBBLE_SIZE - EDGE_GAP,
    ),
  });

  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p.x, p.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      d.moved = true;
    }
    setPos(clamp(d.origX + dx, d.origY + dy));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
    draggedRef.current = d?.moved ?? false;
  };

  const onPointerCancel = () => {
    dragRef.current = null;
    draggedRef.current = false;
  };

  const onBubbleClick = () => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    openFloating();
  };

  if (expanded) {
    return (
      <TaskSheet
        taskId={floating.taskId}
        projectId={floating.projectId}
        workspaceId={floating.workspaceId}
        columns={columns}
        open
        onOpenChange={(o) => {
          if (!o) closeFloating();
        }}
        onChanged={handleChanged}
        onFloat={minimizeFloating}
      />
    );
  }

  return (
    <div
      className="fixed z-40 select-none"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="group relative">
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onClick={onBubbleClick}
          aria-label="Abrir tarefa flutuante"
          title="Abrir tarefa"
          style={{ touchAction: "none", width: BUBBLE_SIZE, height: BUBBLE_SIZE }}
          className="flex cursor-grab items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-2 ring-background transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background active:cursor-grabbing"
        >
          <ClipboardList className="h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            closeFloating();
          }}
          aria-label="Fechar tarefa flutuante"
          title="Fechar"
          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow transition-opacity hover:bg-destructive/90 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
