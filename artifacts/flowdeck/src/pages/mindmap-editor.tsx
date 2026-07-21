import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
} from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetMindmap,
  useUpdateMindmap,
  getGetMindmapQueryKey,
  useListProjects,
  getListProjectsQueryKey,
  useListMindmaps,
  getListMindmapsQueryKey,
  useListTasks,
  getListTasksQueryKey,
} from "@workspace/api-client-react";
import type {
  MindmapNode,
  MindmapEdge,
  MindmapArea,
  MindmapElement,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ChevronLeft,
  Plus,
  Save,
  Link2,
  AlignLeft,
  X,
  FolderKanban,
  ExternalLink,
  ArrowUpRight,
  Type,
  MapPin,
  Square,
  Pencil,
  Palette,
  Network,
  ListChecks,
  ZoomIn,
  ZoomOut,
  Maximize,
  BoxSelect,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  RotateCcw,
  RotateCw,
  Copy,
  Check,
  Users,
  Zap,
  ZapOff,
  Lightbulb,
  Shapes,
  Circle,
  Triangle,
  Diamond,
  MoveUpRight,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { MindmapRichText } from "@/components/mindmap-rich-text";
import { MindmapMinimap } from "@/components/mindmap-minimap";
import { MindmapIconPicker } from "@/components/mindmap-icon-picker";
import { useMindmapIcons } from "@/lib/mindmap-icons";
import { useFloatingTask } from "@/lib/floating-task-context";
import { useUnsavedGuard } from "@/lib/unsaved-guard";
import { useWorkspace } from "@/lib/workspace-context";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { sanitizeHtml } from "@/lib/sanitize";
import { WorkspaceMembersDialog } from "@/components/workspace-members-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  EnergyWire,
  PlasmaBall,
  useEnergyWires,
  useEnergyParticles,
  useReducedMotion,
  type WireRegistry,
} from "@/components/mindmap-energy";

const NODE_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#3b82f6",
  "#22c55e",
  "#8b5cf6",
  "#ec4899",
];

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

// Max number of undo steps kept (baseline snapshot + this many changes).
const MAX_UNDO_STEPS = 10;

// Node hover toolbar timings: hover 1s to show, 4s after leaving to hide.
// TOOLBAR_ANIM_MS must match the CSS animation length in index.css.
const TOOLBAR_SHOW_DELAY_MS = 1000;
const TOOLBAR_HIDE_DELAY_MS = 4000;
const TOOLBAR_ANIM_MS = 200;

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 10) / 10));
}

type AddType =
  | "text"
  | "project"
  | "label"
  | "hotspot"
  | "mindmap"
  | "task"
  | "light";

type MindmapSnapshot = {
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  areas: MindmapArea[];
  elements?: MindmapElement[];
};

type DragState =
  | { kind: "node"; id: string }
  | { kind: "area"; id: string }
  | { kind: "resize"; id: string }
  | { kind: "element"; id: string }
  | { kind: "element-resize"; id: string }
  | { kind: "element-rotate"; id: string }
  | { kind: "group" }
  | { kind: "marquee" }
  | { kind: "pan" };

type ElementShape = MindmapElement["shape"];

// Default color for decorative shapes and for the "light point" node:
// ElectricTask electric blue.
const ELECTRIC_BLUE = "#3b82f6";

function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// localStorage key for the "energy effects" on/off preference (bottom bar).
const ENERGY_PREF_KEY = "electrictask-mindmap-energy";

// A missing or malformed `data` payload must never white-screen the editor:
// normalize whatever the API returns into a valid empty document instead.
function safeMapData(data: unknown): {
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  areas: MindmapArea[];
  elements: MindmapElement[];
} {
  const d =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  return {
    nodes: Array.isArray(d.nodes) ? (d.nodes as MindmapNode[]) : [],
    edges: Array.isArray(d.edges) ? (d.edges as MindmapEdge[]) : [],
    areas: Array.isArray(d.areas) ? (d.areas as MindmapArea[]) : [],
    elements: Array.isArray(d.elements)
      ? (d.elements as MindmapElement[])
      : [],
  };
}

function genId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function isEditableTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}

function nodeAnchor(node: MindmapNode): { x: number; y: number } {
  if (node.type === "hotspot") return { x: node.x + 16, y: node.y + 16 };
  if (node.type === "light") return { x: node.x + 24, y: node.y + 24 };
  if (node.type === "label") return { x: node.x + 24, y: node.y + 12 };
  return { x: node.x + 60, y: node.y + 24 };
}

export default function MindmapEditor() {
  const { mindmapId } = useParams();
  const id = parseInt(mindmapId || "0", 10);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { register, guardedNavigate } = useUnsavedGuard();
  const { setActiveWorkspaceId } = useWorkspace();

  const { data: mindmap, isLoading } = useGetMindmap(id, {
    query: { enabled: !!id, queryKey: getGetMindmapQueryKey(id) },
  });
  const updateMindmap = useUpdateMindmap();

  const workspaceId = mindmap?.workspaceId;
  const { data: projects = [] } = useListProjects(workspaceId ?? 0, {
    query: {
      enabled: !!workspaceId,
      queryKey: getListProjectsQueryKey(workspaceId ?? 0),
    },
  });
  const { data: allMindmaps = [] } = useListMindmaps(workspaceId ?? 0, {
    query: {
      enabled: !!workspaceId,
      queryKey: getListMindmapsQueryKey(workspaceId ?? 0),
    },
  });
  const otherMindmaps = allMindmaps.filter((m) => m.id !== id);
  const mindmapInfo = new Map<number, { name: string; count: number }>(
    allMindmaps.map((m) => [
      m.id,
      { name: m.name, count: safeMapData(m.data).nodes.length },
    ]),
  );

  const [nodes, setNodes] = useState<MindmapNode[]>([]);
  const [edges, setEdges] = useState<MindmapEdge[]>([]);
  const [areas, setAreas] = useState<MindmapArea[]>([]);
  const [elements, setElements] = useState<MindmapElement[]>([]);
  const [dirty, setDirty] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [connect, setConnect] = useState<{
    source: string;
    directed: boolean;
  } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftDetails, setDraftDetails] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [viewHotspotId, setViewHotspotId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<AddType>("text");
  const [addProjectId, setAddProjectId] = useState<string>("");
  const [addMindmapId, setAddMindmapId] = useState<string>("");
  const [addTaskProjectId, setAddTaskProjectId] = useState<string>("");
  const [addTaskId, setAddTaskId] = useState<string>("");
  const [addColor, setAddColor] = useState<string | null>(null);
  const [draftMindmapId, setDraftMindmapId] = useState<string>("");
  const [draftIcon, setDraftIcon] = useState<string | null>(null);
  const [draftColor, setDraftColor] = useState<string | null>(null);
  const [areaEditId, setAreaEditId] = useState<string | null>(null);
  const [draftAreaLabel, setDraftAreaLabel] = useState("");
  const [colorAreaId, setColorAreaId] = useState<string | null>(null);
  const [colorElementId, setColorElementId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );
  const [selectMode, setSelectMode] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  });
  // Floating action bar shown below a node after hovering it for 1s.
  // `closing` drives the right-to-left collapse animation before unmount.
  const [nodeToolbar, setNodeToolbar] = useState<{
    nodeId: string;
    closing: boolean;
  } | null>(null);
  const toolbarShowTimerRef = useRef<number | null>(null);
  const toolbarHideTimerRef = useRef<number | null>(null);
  const toolbarCloseTimerRef = useRef<number | null>(null);

  const { floatTask, openFloating } = useFloatingTask();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const addTaskProjectNum = parseInt(addTaskProjectId || "0", 10);
  const { data: addTasks = [] } = useListTasks(addTaskProjectNum, undefined, {
    query: {
      enabled: !!addTaskProjectNum && addType === "task",
      queryKey: getListTasksQueryKey(addTaskProjectNum, undefined),
    },
  });

  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ w: 0, h: 0, clientX: 0, clientY: 0 });
  // Rotation drag bookkeeping: element center in screen coords plus the
  // pointer's starting angle and the element's starting rotation.
  const rotateStart = useRef({ cx: 0, cy: 0, angle0: 0, rotation0: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const dragMoved = useRef(false);
  const marqueeStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const groupStart = useRef<{
    positions: Record<string, { x: number; y: number }>;
    minX: number;
    minY: number;
  }>({ positions: {}, minX: 0, minY: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panRef = useRef(pan);
  panRef.current = pan;
  const spaceHeldRef = useRef(spaceHeld);
  spaceHeldRef.current = spaceHeld;
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  const contentRef = useRef<HTMLDivElement>(null);
  const nodeSizesRef = useRef<Map<string, { w: number; h: number }>>(new Map());

  // ElectricTask energy effects: animated "power cable" wires and drag sparks.
  // User can turn them off from the bottom bar (persisted); reduced motion
  // always wins.
  const reducedMotion = useReducedMotion();
  const [energyOn, setEnergyOn] = useState(() => {
    try {
      return localStorage.getItem(ENERGY_PREF_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const effectsOn = energyOn && !reducedMotion;
  const toggleEnergy = () => {
    setEnergyOn((v) => {
      const next = !v;
      try {
        localStorage.setItem(ENERGY_PREF_KEY, next ? "on" : "off");
      } catch {
        // Persistence is best-effort (e.g. storage disabled).
      }
      return next;
    });
  };
  const wireRegistry = useRef<WireRegistry>(new Map());
  useEnergyWires(wireRegistry, effectsOn);
  const { sparkCanvasRef, spawnSparks, spawnBurst } =
    useEnergyParticles(effectsOn);
  // Edge ids created in this session that still need their "grow from source
  // to target" reveal (played once, then removed from the set).
  const introEdgesRef = useRef<Set<string>>(new Set());
  // If effects get disabled mid-intro (toggle off / reduced motion), drop any
  // pending intros so they don't replay later when effects come back on.
  useEffect(() => {
    if (!effectsOn) introEdgesRef.current.clear();
  }, [effectsOn]);

  // Briefly flashes a node's border/glow blue ("receiving energy") when a new
  // connection lands on it. Pure DOM class toggle -- no React re-render.
  const flashNode = (nodeId: string) => {
    const el = canvasRef.current?.querySelector<HTMLElement>(
      `[data-node-id="${nodeId}"]`,
    );
    if (!el) return;
    el.classList.remove("mindmap-energy-receive");
    // Force a reflow so re-adding the class restarts the animation.
    void el.offsetWidth;
    el.classList.add("mindmap-energy-receive");
    el.addEventListener(
      "animationend",
      () => el.classList.remove("mindmap-energy-receive"),
      { once: true },
    );
  };

  const anyNodeHasIcon = nodes.some((n) => n.icon);
  const iconMod = useMindmapIcons(anyNodeHasIcon);
  const latestRef = useRef({ nodes, edges, areas, elements });
  latestRef.current = { nodes, edges, areas, elements };
  const loadedIdRef = useRef<number | null>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const isApplyingHistoryRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    if (!mindmap) return;
    const isNewMap = loadedIdRef.current !== mindmap.id;
    if (isNewMap || !dirtyRef.current) {
      const data = safeMapData(mindmap.data);
      setNodes(data.nodes);
      setEdges(data.edges);
      setAreas(data.areas);
      setElements(data.elements);
      loadedIdRef.current = mindmap.id;
      // The load applies state programmatically; don't let the history
      // recorder capture it as a user step.
      isApplyingHistoryRef.current = true;
      if (isNewMap) {
        setDirty(false);
        setSelectedIds([]);
        setMarquee(null);
        // Reset the undo/redo baseline for the freshly loaded map.
        historyRef.current = [
          JSON.stringify({
            nodes: data.nodes,
            edges: data.edges,
            areas: data.areas,
            elements: data.elements,
          }),
        ];
        historyIndexRef.current = 0;
        setCanUndo(false);
        setCanRedo(false);
      }
    }
  }, [mindmap]);

  // ---- Undo / redo history --------------------------------------------------
  // Record a snapshot of the document ({nodes, edges, areas}) at each commit
  // point. Continuous drags are coalesced into a single entry because we skip
  // recording while a drag is in progress and record once when it ends
  // (drag -> null).
  useEffect(() => {
    if (loadedIdRef.current === null) return;
    if (drag) return;
    if (isApplyingHistoryRef.current) {
      isApplyingHistoryRef.current = false;
      return;
    }
    const snap = JSON.stringify({ nodes, edges, areas, elements });
    const hist = historyRef.current;
    const idx = historyIndexRef.current;
    if (idx >= 0 && hist[idx] === snap) return;
    const next = hist.slice(0, idx + 1);
    next.push(snap);
    while (next.length > MAX_UNDO_STEPS + 1) next.shift();
    historyRef.current = next;
    historyIndexRef.current = next.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, [nodes, edges, areas, elements, drag]);

  const applyHistoryAt = useCallback((index: number) => {
    const snap = historyRef.current[index];
    if (snap === undefined) return;
    const parsed = JSON.parse(snap) as MindmapSnapshot;
    isApplyingHistoryRef.current = true;
    setNodes(parsed.nodes);
    setEdges(parsed.edges);
    setAreas(parsed.areas);
    // Older snapshots (recorded before shape elements existed) omit the field.
    setElements(parsed.elements ?? []);
    setDirty(true);
    setSelectedIds((ids) =>
      ids.filter(
        (sid) =>
          parsed.nodes.some((n) => n.id === sid) ||
          parsed.areas.some((a) => a.id === sid),
      ),
    );
    historyIndexRef.current = index;
    setCanUndo(index > 0);
    setCanRedo(index < historyRef.current.length - 1);
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    applyHistoryAt(historyIndexRef.current - 1);
  }, [applyHistoryAt]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    applyHistoryAt(historyIndexRef.current + 1);
  }, [applyHistoryAt]);

  const anyDialogOpen =
    !!detailId ||
    !!viewHotspotId ||
    addOpen ||
    !!areaEditId ||
    !!colorAreaId ||
    !!colorElementId;
  const dialogOpenRef = useRef(anyDialogOpen);
  dialogOpenRef.current = anyDialogOpen;

  // Keyboard shortcuts: Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y =
  // redo. Ignored while typing in a field or with a dialog open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k !== "z" && k !== "y") return;
      if (e.repeat) return;
      if (isEditableTarget(e.target) || dialogOpenRef.current) return;
      if (k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const saveAsync = useCallback(async () => {
    const { nodes: n, edges: e, areas: a, elements: el } = latestRef.current;
    const snapshot = JSON.stringify({
      nodes: n,
      edges: e,
      areas: a,
      elements: el,
    });
    await updateMindmap.mutateAsync({
      mindmapId: id,
      data: { data: { nodes: n, edges: e, areas: a, elements: el } },
    });
    if (JSON.stringify(latestRef.current) === snapshot) {
      setDirty(false);
    }
    queryClient.invalidateQueries({ queryKey: getGetMindmapQueryKey(id) });
    if (workspaceId) {
      queryClient.invalidateQueries({
        queryKey: getListMindmapsQueryKey(workspaceId),
      });
    }
  }, [id, updateMindmap, queryClient, workspaceId]);

  const handleSave = useCallback(() => {
    saveAsync().catch(() => {});
  }, [saveAsync]);

  const openEdit = () => {
    setRenameValue(mindmap?.name ?? "");
    setLinkCopied(false);
    setEditOpen(true);
  };

  const handleRename = () => {
    const value = renameValue.trim();
    if (!value || value === mindmap?.name) {
      setEditOpen(false);
      return;
    }
    updateMindmap.mutate(
      { mindmapId: id, data: { name: value } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetMindmapQueryKey(id),
          });
          if (workspaceId) {
            queryClient.invalidateQueries({
              queryKey: getListMindmapsQueryKey(workspaceId),
            });
          }
          setEditOpen(false);
          toast({ title: "Mapa mental renomeado" });
        },
        onError: () =>
          toast({
            title: "Não foi possível renomear",
            description: "Tente novamente.",
            variant: "destructive",
          }),
      },
    );
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      toast({ title: "Link copiado" });
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast({
        title: "Não foi possível copiar o link",
        description: "Copie o endereço da barra do navegador.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    register({
      isDirty: () => dirtyRef.current,
      save: saveAsync,
      discard: () => setDirty(false),
    });
    return () => register(null);
  }, [register, saveAsync]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Wheel to pan the canvas; Ctrl/Cmd + wheel to zoom toward the cursor. This
  // lets any node/area be brought into view and zoomed, not just the top-left.
  useEffect(() => {
    if (!mindmap) return;
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const z = zoomRef.current;
        const nz = clampZoom(z - Math.sign(e.deltaY) * ZOOM_STEP);
        if (nz === z) return;
        const p = panRef.current;
        setPan({
          x: cx - ((cx - p.x) * nz) / z,
          y: cy - ((cy - p.y) * nz) / z,
        });
        setZoom(nz);
      } else if (e.shiftKey) {
        const d = e.deltaY !== 0 ? e.deltaY : e.deltaX;
        setPan((p) => ({ x: p.x - d, y: p.y }));
      } else {
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [mindmap]);

  // Track the canvas viewport size so the minimap can draw the visible region.
  useEffect(() => {
    if (!mindmap) return;
    const el = canvasRef.current;
    if (!el) return;
    const update = () =>
      setCanvasSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mindmap]);

  // Hold Space to temporarily switch to a hand/pan tool (drag to pan anywhere).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && !isEditableTarget(e.target)) {
        setSpaceHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const openReferencedMap = (targetId: number) => {
    if (!dirtyRef.current) {
      setLocation(`/mindmaps/${targetId}`);
      return;
    }
    updateMindmap.mutate(
      { mindmapId: id, data: { data: { nodes, edges, areas, elements } } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetMindmapQueryKey(id),
          });
          if (workspaceId) {
            queryClient.invalidateQueries({
              queryKey: getListMindmapsQueryKey(workspaceId),
            });
          }
          setLocation(`/mindmaps/${targetId}`);
        },
      },
    );
  };

  const openAdd = () => {
    setAddType("text");
    setAddProjectId("");
    setAddMindmapId("");
    setAddTaskProjectId("");
    setAddTaskId("");
    setAddColor(null);
    setAddOpen(true);
  };

  const confirmAdd = () => {
    const autoColor = NODE_COLORS[nodes.length % NODE_COLORS.length];
    // Place the new node in the center of the area the user is currently
    // viewing (converting the viewport center from screen to world coords),
    // instead of a fixed corner. Offset by ~half the node size so it lands
    // centered, plus a small jitter so repeated adds don't stack exactly.
    const rect = canvasRef.current?.getBoundingClientRect();
    const viewW = rect?.width || canvasSize.width;
    const viewH = rect?.height || canvasSize.height;
    const half =
      addType === "hotspot"
        ? { w: 14, h: 14 }
        : addType === "light"
          ? { w: 24, h: 24 }
          : addType === "label"
            ? { w: 40, h: 12 }
            : { w: 75, h: 28 };
    const jitter = () => (Math.random() - 0.5) * 40;
    const spawn =
      viewW > 0 && viewH > 0
        ? {
            x: (viewW / 2 - pan.x) / zoom - half.w + jitter(),
            y: (viewH / 2 - pan.y) / zoom - half.h + jitter(),
          }
        : { x: 100 + Math.random() * 300, y: 100 + Math.random() * 200 };
    const base = {
      id: genId("n"),
      x: spawn.x,
      y: spawn.y,
      color: addColor ?? autoColor,
      details: null,
    };
    let newNode: MindmapNode;
    if (addType === "project") {
      const project = projects.find((p) => String(p.id) === addProjectId);
      if (!project) return;
      newNode = {
        ...base,
        label: project.name,
        color: addColor ?? (project.accentColor || autoColor),
        type: "project",
        projectId: project.id,
      };
    } else if (addType === "task") {
      const task = addTasks.find((t) => String(t.id) === addTaskId);
      if (!task) return;
      newNode = {
        ...base,
        label: task.title,
        type: "task",
        projectId: task.projectId,
        taskId: task.id,
      };
    } else if (addType === "label") {
      newNode = { ...base, label: "Texto", type: "label", projectId: null };
    } else if (addType === "hotspot") {
      newNode = { ...base, label: "Ponto", type: "hotspot", projectId: null };
    } else if (addType === "light") {
      newNode = {
        ...base,
        label: "Ponto de luz",
        color: addColor ?? ELECTRIC_BLUE,
        type: "light",
        projectId: null,
      };
    } else if (addType === "mindmap") {
      const target = otherMindmaps.find((m) => String(m.id) === addMindmapId);
      if (!target) return;
      newNode = {
        ...base,
        label: target.name,
        type: "mindmap",
        projectId: null,
        mindmapId: target.id,
      };
    } else {
      newNode = { ...base, label: "Nova ideia", type: "text", projectId: null };
    }
    setNodes((n) => [...n, newNode]);
    setDirty(true);
    setAddOpen(false);
    // Light points are visual connectors; the generic details dialog adds
    // nothing, so don't force it open on add.
    if (addType !== "light") openDetails(newNode);
  };

  // ---- Decorative shape elements -------------------------------------------
  const addElement = (shape: ElementShape) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const viewW = rect?.width || canvasSize.width;
    const viewH = rect?.height || canvasSize.height;
    const size =
      shape === "arrow" ? { w: 140, h: 60 } : { w: 100, h: 100 };
    const jitter = () => (Math.random() - 0.5) * 40;
    const spawn =
      viewW > 0 && viewH > 0
        ? {
            x: (viewW / 2 - pan.x) / zoom - size.w / 2 + jitter(),
            y: (viewH / 2 - pan.y) / zoom - size.h / 2 + jitter(),
          }
        : { x: 120 + Math.random() * 240, y: 120 + Math.random() * 160 };
    const element: MindmapElement = {
      id: genId("s"),
      shape,
      x: spawn.x,
      y: spawn.y,
      width: size.w,
      height: size.h,
      rotation: 0,
      color: ELECTRIC_BLUE,
    };
    setElements((prev) => [...prev, element]);
    setSelectedElementId(element.id);
    setDirty(true);
  };

  const deleteElement = (elementId: string) => {
    setElements((prev) => prev.filter((el) => el.id !== elementId));
    setSelectedElementId((sid) => (sid === elementId ? null : sid));
    setDirty(true);
  };

  const setElementColor = (elementId: string, color: string) => {
    setElements((prev) =>
      prev.map((el) => (el.id === elementId ? { ...el, color } : el)),
    );
    setDirty(true);
    setColorElementId(null);
  };

  const addArea = () => {
    const area: MindmapArea = {
      id: genId("a"),
      x: 60,
      y: 60,
      width: 280,
      height: 180,
      color: NODE_COLORS[areas.length % NODE_COLORS.length],
      label: null,
    };
    setAreas((a) => [...a, area]);
    setDirty(true);
  };

  const openProject = (projectId: number) => {
    setLocation(`/projects/${projectId}`);
  };

  const openTask = (taskId: number, projectId: number) => {
    if (!workspaceId) return;
    floatTask({ taskId, projectId, workspaceId });
    openFloating();
  };

  const deleteNode = (nodeId: string) => {
    setNodes((n) => n.filter((x) => x.id !== nodeId));
    setEdges((e) =>
      e.filter((x) => x.source !== nodeId && x.target !== nodeId),
    );
    setDirty(true);
  };

  const deleteArea = (areaId: string) => {
    setAreas((a) => a.filter((x) => x.id !== areaId));
    setDirty(true);
  };

  const deleteEdge = (edgeId: string) => {
    setEdges((e) => e.filter((x) => x.id !== edgeId));
    setDirty(true);
  };

  // Duplicate every selected node (offset a bit) plus the edges whose two
  // endpoints are both inside the selection; the copies become the new
  // selection so the user can drag them right away.
  const duplicateSelected = () => {
    const ids = selectedIds;
    if (ids.length === 0) return;
    const idMap = new Map<string, string>();
    for (const oldId of ids) idMap.set(oldId, genId("n"));
    const clones = nodes
      .filter((n) => ids.includes(n.id))
      .map((n) => ({
        ...n,
        id: idMap.get(n.id)!,
        x: n.x + 32,
        y: n.y + 32,
      }));
    const edgeClones = edges
      .filter((e) => idMap.has(e.source) && idMap.has(e.target))
      .map((e) => ({
        ...e,
        id: genId("e"),
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
      }));
    setNodes((n) => [...n, ...clones]);
    if (edgeClones.length > 0) setEdges((e) => [...e, ...edgeClones]);
    setSelectedIds(clones.map((c) => c.id));
    setDirty(true);
  };

  const deleteSelected = () => {
    const ids = selectedIds;
    if (ids.length === 0) return;
    setNodes((n) => n.filter((x) => !ids.includes(x.id)));
    setEdges((e) =>
      e.filter((x) => !ids.includes(x.source) && !ids.includes(x.target)),
    );
    setSelectedIds([]);
    setDirty(true);
  };

  // Delete/Backspace removes the selected nodes (ignored while typing in a
  // field or with a dialog open).
  useEffect(() => {
    if (selectedIds.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (isEditableTarget(e.target) || dialogOpenRef.current) return;
      e.preventDefault();
      deleteSelected();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  const setAreaColor = (areaId: string, color: string) => {
    setAreas((a) => a.map((x) => (x.id === areaId ? { ...x, color } : x)));
    setDirty(true);
    setColorAreaId(null);
  };

  const startConnect = (source: string, directed: boolean) => {
    setConnect({ source, directed });
  };

  // ---- Node hover toolbar ---------------------------------------------------
  // The action buttons live in a floating bar below the node. It appears after
  // hovering a node for 1s (never while dragging), stays while the mouse is
  // over the node or the bar itself, and collapses 4s after the mouse leaves.
  const clearToolbarTimer = (ref: React.MutableRefObject<number | null>) => {
    if (ref.current != null) {
      window.clearTimeout(ref.current);
      ref.current = null;
    }
  };

  const closeNodeToolbar = (animate: boolean) => {
    clearToolbarTimer(toolbarHideTimerRef);
    clearToolbarTimer(toolbarCloseTimerRef);
    if (animate && !reducedMotion) {
      setNodeToolbar((t) => (t ? { ...t, closing: true } : null));
      toolbarCloseTimerRef.current = window.setTimeout(
        () => setNodeToolbar(null),
        TOOLBAR_ANIM_MS,
      );
    } else {
      setNodeToolbar(null);
    }
  };

  const onNodeHoverStart = (nodeId: string) => {
    if (drag) return;
    if (nodeToolbar?.nodeId === nodeId) {
      // Re-entered the node (or its bar): keep it open.
      clearToolbarTimer(toolbarHideTimerRef);
      if (nodeToolbar.closing) {
        clearToolbarTimer(toolbarCloseTimerRef);
        setNodeToolbar({ nodeId, closing: false });
      }
      return;
    }
    // Hovering a different node collapses the previous bar immediately.
    if (nodeToolbar) closeNodeToolbar(true);
    clearToolbarTimer(toolbarShowTimerRef);
    // Reduced motion: no delays or animations -- show instantly.
    if (reducedMotion) {
      clearToolbarTimer(toolbarHideTimerRef);
      clearToolbarTimer(toolbarCloseTimerRef);
      setNodeToolbar({ nodeId, closing: false });
      return;
    }
    toolbarShowTimerRef.current = window.setTimeout(() => {
      toolbarShowTimerRef.current = null;
      if (dragRef.current) return;
      clearToolbarTimer(toolbarHideTimerRef);
      clearToolbarTimer(toolbarCloseTimerRef);
      setNodeToolbar({ nodeId, closing: false });
    }, TOOLBAR_SHOW_DELAY_MS);
  };

  const onNodeHoverEnd = (nodeId: string) => {
    clearToolbarTimer(toolbarShowTimerRef);
    if (nodeToolbar?.nodeId === nodeId && !nodeToolbar.closing) {
      // Reduced motion: hide instantly instead of waiting/animating.
      if (reducedMotion) {
        closeNodeToolbar(false);
        return;
      }
      clearToolbarTimer(toolbarHideTimerRef);
      toolbarHideTimerRef.current = window.setTimeout(() => {
        toolbarHideTimerRef.current = null;
        closeNodeToolbar(true);
      }, TOOLBAR_HIDE_DELAY_MS);
    }
  };

  // Any drag (node, group, pan, marquee, ...) hides the bar instantly and
  // cancels a pending show.
  useEffect(() => {
    if (!drag) return;
    clearToolbarTimer(toolbarShowTimerRef);
    clearToolbarTimer(toolbarHideTimerRef);
    clearToolbarTimer(toolbarCloseTimerRef);
    setNodeToolbar(null);
  }, [drag]);

  useEffect(
    () => () => {
      clearToolbarTimer(toolbarShowTimerRef);
      clearToolbarTimer(toolbarHideTimerRef);
      clearToolbarTimer(toolbarCloseTimerRef);
    },
    [],
  );

  // Capture each node's rendered (unscaled) size once, so drag snapping and the
  // alignment actions can reason about edges/centers cheaply during a gesture.
  const measureNodeSizes = () => {
    const map = new Map<string, { w: number; h: number }>();
    canvasRef.current
      ?.querySelectorAll<HTMLElement>("[data-node-id]")
      .forEach((el) => {
        const nid = el.dataset.nodeId;
        if (nid) map.set(nid, { w: el.offsetWidth, h: el.offsetHeight });
      });
    nodeSizesRef.current = map;
  };

  // Nodes are text-sized, so widths vary a lot; keep measured sizes fresh and
  // re-render once when they change so edge anchors land on real centers.
  // Keyed on content (not positions) so drags don't remeasure every frame.
  const [, setSizesVersion] = useState(0);
  const sizeSignature = nodes
    .map(
      (n) =>
        `${n.id}:${n.type}:${n.label}:${n.icon ?? ""}:${n.details ? 1 : 0}`,
    )
    .join("|");
  useLayoutEffect(() => {
    const prev = nodeSizesRef.current;
    measureNodeSizes();
    const next = nodeSizesRef.current;
    let changed = prev.size !== next.size;
    if (!changed) {
      for (const [k, v] of next) {
        const p = prev.get(k);
        if (!p || p.w !== v.w || p.h !== v.h) {
          changed = true;
          break;
        }
      }
    }
    if (changed) setSizesVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizeSignature]);

  // Edge anchor at the node's measured center, falling back to the static
  // estimates before the first measurement. Hotspots anchor on the pin circle.
  const anchorFor = (node: MindmapNode): { x: number; y: number } => {
    if (node.type === "hotspot") return { x: node.x + 16, y: node.y + 16 };
    const s = nodeSizesRef.current.get(node.id);
    if (!s || s.w === 0) return nodeAnchor(node);
    return { x: node.x + s.w / 2, y: node.y + s.h / 2 };
  };

  const startPan = (e: React.PointerEvent) => {
    panStart.current = { x: panRef.current.x, y: panRef.current.y };
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragMoved.current = false;
    setDrag({ kind: "pan" });
  };

  // Middle-mouse or Space + left-drag pans from anywhere, even over a node.
  const panGesture = (e: React.PointerEvent): boolean =>
    e.button === 1 || (spaceHeldRef.current && e.button === 0);

  const onNodePointerDown = (e: React.PointerEvent, node: MindmapNode) => {
    if (panGesture(e)) {
      startPan(e);
      return;
    }
    if (connect) {
      if (connect.source !== node.id) {
        const exists = edges.some(
          (x) =>
            (x.source === connect.source && x.target === node.id) ||
            (x.source === node.id && x.target === connect.source),
        );
        if (!exists) {
          const newId = genId("e");
          if (effectsOn) introEdgesRef.current.add(newId);
          setEdges((prev) => [
            ...prev,
            {
              id: newId,
              source: connect.source,
              target: node.id,
              directed: connect.directed,
            },
          ]);
          setDirty(true);
        }
      }
      setConnect(null);
      return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    measureNodeSizes();
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragMoved.current = false;
    if (selectedIds.length > 1 && selectedIds.includes(node.id)) {
      const positions: Record<string, { x: number; y: number }> = {};
      let minX = Infinity;
      let minY = Infinity;
      for (const n of nodes) {
        if (selectedIds.includes(n.id)) {
          positions[n.id] = { x: n.x, y: n.y };
          if (n.x < minX) minX = n.x;
          if (n.y < minY) minY = n.y;
        }
      }
      groupStart.current = { positions, minX, minY };
      setDrag({ kind: "group" });
      return;
    }
    if (!selectedIds.includes(node.id)) setSelectedIds([]);
    dragOffset.current = {
      x: (e.clientX - rect.left - pan.x) / zoom - node.x,
      y: (e.clientY - rect.top - pan.y) / zoom - node.y,
    };
    setDrag({ kind: "node", id: node.id });
  };

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (connect) return;
    // Only react to the empty background (outer container or the transformed
    // content layer), never to clicks that bubbled up from a node/area.
    if (e.target !== e.currentTarget && e.target !== contentRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Middle-mouse or Space + drag always pans, even in selection mode.
    if (panGesture(e)) {
      setSelectedIds([]);
      startPan(e);
      return;
    }
    // Ctrl/Cmd + left-drag (or the selection mode toggle) draws a marquee;
    // a plain left-drag pans the canvas.
    setSelectedElementId(null);
    if (e.button === 0 && (e.ctrlKey || e.metaKey || selectMode)) {
      marqueeStart.current = {
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top - pan.y) / zoom,
      };
      dragStart.current = { x: e.clientX, y: e.clientY };
      dragMoved.current = false;
      setSelectedIds([]);
      setMarquee(null);
      setDrag({ kind: "marquee" });
      return;
    }
    if (e.button !== 0 && e.button !== 1) return;
    setSelectedIds([]);
    startPan(e);
  };

  const onAreaPointerDown = (e: React.PointerEvent, area: MindmapArea) => {
    if (panGesture(e)) {
      startPan(e);
      return;
    }
    if (connect) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffset.current = {
      x: (e.clientX - rect.left - pan.x) / zoom - area.x,
      y: (e.clientY - rect.top - pan.y) / zoom - area.y,
    };
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragMoved.current = false;
    setDrag({ kind: "area", id: area.id });
  };

  const onResizePointerDown = (e: React.PointerEvent, area: MindmapArea) => {
    e.stopPropagation();
    if (panGesture(e)) {
      startPan(e);
      return;
    }
    resizeStart.current = {
      w: area.width,
      h: area.height,
      clientX: e.clientX,
      clientY: e.clientY,
    };
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragMoved.current = false;
    setDrag({ kind: "resize", id: area.id });
  };

  const onElementPointerDown = (e: React.PointerEvent, el: MindmapElement) => {
    if (panGesture(e)) {
      startPan(e);
      return;
    }
    if (connect) return;
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSelectedElementId(el.id);
    dragOffset.current = {
      x: (e.clientX - rect.left - pan.x) / zoom - el.x,
      y: (e.clientY - rect.top - pan.y) / zoom - el.y,
    };
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragMoved.current = false;
    setDrag({ kind: "element", id: el.id });
  };

  const onElementResizeDown = (e: React.PointerEvent, el: MindmapElement) => {
    e.stopPropagation();
    if (panGesture(e)) {
      startPan(e);
      return;
    }
    resizeStart.current = {
      w: el.width,
      h: el.height,
      clientX: e.clientX,
      clientY: e.clientY,
    };
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragMoved.current = false;
    setDrag({ kind: "element-resize", id: el.id });
  };

  const onElementRotateDown = (e: React.PointerEvent, el: MindmapElement) => {
    e.stopPropagation();
    if (panGesture(e)) {
      startPan(e);
      return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Element center in screen coordinates.
    const cx = rect.left + pan.x + (el.x + el.width / 2) * zoom;
    const cy = rect.top + pan.y + (el.y + el.height / 2) * zoom;
    rotateStart.current = {
      cx,
      cy,
      angle0: Math.atan2(e.clientY - cy, e.clientX - cx),
      rotation0: el.rotation ?? 0,
    };
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragMoved.current = false;
    setDrag({ kind: "element-rotate", id: el.id });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    if (!dragMoved.current) {
      if (
        Math.hypot(
          e.clientX - dragStart.current.x,
          e.clientY - dragStart.current.y,
        ) <= 4
      ) {
        return;
      }
      dragMoved.current = true;
      // Capture the pointer so the drag keeps tracking even when the cursor
      // leaves the canvas bounds (e.g. dragging a node up/left past the edge).
      try {
        canvasRef.current?.setPointerCapture(e.pointerId);
      } catch {
        // Ignore browsers/inputs that reject pointer capture.
      }
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (drag.kind === "pan") {
      setPan({
        x: panStart.current.x + (e.clientX - dragStart.current.x),
        y: panStart.current.y + (e.clientY - dragStart.current.y),
      });
      return;
    }
    if (drag.kind === "node") {
      const rawX = (e.clientX - rect.left - pan.x) / zoom - dragOffset.current.x;
      const rawY = (e.clientY - rect.top - pan.y) / zoom - dragOffset.current.y;
      const size = nodeSizesRef.current.get(drag.id) ?? { w: 140, h: 52 };
      // Snap the dragged node's edges/center to nearby nodes, showing guides.
      const snap = 6 / zoom;
      let x = rawX;
      let y = rawY;
      let guideX: number | null = null;
      let guideY: number | null = null;
      let bestDX = snap;
      let bestDY = snap;
      const dragXs = [rawX, rawX + size.w / 2, rawX + size.w];
      const dragYs = [rawY, rawY + size.h / 2, rawY + size.h];
      for (const other of nodes) {
        if (other.id === drag.id) continue;
        const os = nodeSizesRef.current.get(other.id) ?? { w: 140, h: 52 };
        const oXs = [other.x, other.x + os.w / 2, other.x + os.w];
        const oYs = [other.y, other.y + os.h / 2, other.y + os.h];
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            const ddx = oXs[j] - dragXs[i];
            if (Math.abs(ddx) < bestDX) {
              bestDX = Math.abs(ddx);
              x = rawX + ddx;
              guideX = oXs[j];
            }
            const ddy = oYs[j] - dragYs[i];
            if (Math.abs(ddy) < bestDY) {
              bestDY = Math.abs(ddy);
              y = rawY + ddy;
              guideY = oYs[j];
            }
          }
        }
      }
      setGuides({ x: guideX, y: guideY });
      setNodes((n) =>
        n.map((node) => (node.id === drag.id ? { ...node, x, y } : node)),
      );
      spawnSparks(e.clientX - rect.left, e.clientY - rect.top);
    } else if (drag.kind === "group") {
      const { positions } = groupStart.current;
      const dx = (e.clientX - dragStart.current.x) / zoom;
      const dy = (e.clientY - dragStart.current.y) / zoom;
      setNodes((n) =>
        n.map((node) => {
          const start = positions[node.id];
          return start
            ? { ...node, x: start.x + dx, y: start.y + dy }
            : node;
        }),
      );
      spawnSparks(e.clientX - rect.left, e.clientY - rect.top);
    } else if (drag.kind === "marquee") {
      const cx = (e.clientX - rect.left - pan.x) / zoom;
      const cy = (e.clientY - rect.top - pan.y) / zoom;
      setMarquee({
        x: Math.min(marqueeStart.current.x, cx),
        y: Math.min(marqueeStart.current.y, cy),
        w: Math.abs(cx - marqueeStart.current.x),
        h: Math.abs(cy - marqueeStart.current.y),
      });
      const left = Math.min(dragStart.current.x, e.clientX);
      const right = Math.max(dragStart.current.x, e.clientX);
      const top = Math.min(dragStart.current.y, e.clientY);
      const bottom = Math.max(dragStart.current.y, e.clientY);
      const hits: string[] = [];
      const els = canvasRef.current?.querySelectorAll<HTMLElement>(
        "[data-node-id]",
      );
      els?.forEach((el) => {
        const r = el.getBoundingClientRect();
        const overlaps =
          r.left <= right &&
          r.right >= left &&
          r.top <= bottom &&
          r.bottom >= top;
        if (overlaps) {
          const nid = el.dataset.nodeId;
          if (nid) hits.push(nid);
        }
      });
      setSelectedIds(hits);
    } else if (drag.kind === "area") {
      const x = (e.clientX - rect.left - pan.x) / zoom - dragOffset.current.x;
      const y = (e.clientY - rect.top - pan.y) / zoom - dragOffset.current.y;
      setAreas((a) =>
        a.map((area) =>
          area.id === drag.id ? { ...area, x, y } : area,
        ),
      );
    } else if (drag.kind === "element") {
      const x = (e.clientX - rect.left - pan.x) / zoom - dragOffset.current.x;
      const y = (e.clientY - rect.top - pan.y) / zoom - dragOffset.current.y;
      setElements((prev) =>
        prev.map((el) => (el.id === drag.id ? { ...el, x, y } : el)),
      );
    } else if (drag.kind === "element-resize") {
      const dw = (e.clientX - resizeStart.current.clientX) / zoom;
      const dh = (e.clientY - resizeStart.current.clientY) / zoom;
      setElements((prev) =>
        prev.map((el) =>
          el.id === drag.id
            ? {
                ...el,
                width: Math.max(24, resizeStart.current.w + dw),
                height: Math.max(24, resizeStart.current.h + dh),
              }
            : el,
        ),
      );
    } else if (drag.kind === "element-rotate") {
      const { cx, cy, angle0, rotation0 } = rotateStart.current;
      const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
      let deg = rotation0 + ((angle - angle0) * 180) / Math.PI;
      // Shift snaps rotation to 15° increments for tidy diagrams.
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      deg = ((deg % 360) + 360) % 360;
      setElements((prev) =>
        prev.map((el) =>
          el.id === drag.id ? { ...el, rotation: Math.round(deg) } : el,
        ),
      );
    } else {
      const dw = (e.clientX - resizeStart.current.clientX) / zoom;
      const dh = (e.clientY - resizeStart.current.clientY) / zoom;
      setAreas((a) =>
        a.map((area) =>
          area.id === drag.id
            ? {
                ...area,
                width: Math.max(120, resizeStart.current.w + dw),
                height: Math.max(80, resizeStart.current.h + dh),
              }
            : area,
        ),
      );
    }
  };

  const onPointerUp = () => {
    if (drag) {
      if (drag.kind === "marquee") {
        setMarquee(null);
      } else if (
        drag.kind === "node" &&
        !dragMoved.current &&
        !connect
      ) {
        const node = nodes.find((n) => n.id === drag.id);
        if (node?.type === "hotspot") {
          setViewHotspotId(node.id);
        } else if (node) {
          // Single click (press + release without moving): show the options
          // bar immediately, without waiting for the hover delay. A click that
          // turns into a drag never reaches here (dragMoved is set).
          clearToolbarTimer(toolbarShowTimerRef);
          clearToolbarTimer(toolbarHideTimerRef);
          clearToolbarTimer(toolbarCloseTimerRef);
          setNodeToolbar({ nodeId: node.id, closing: false });
        }
      } else if (dragMoved.current && drag.kind !== "pan") {
        setDirty(true);
      }
    }
    setGuides({ x: null, y: null });
    setDrag(null);
  };

  const zoomAt = (next: number, cx: number, cy: number) => {
    const nz = clampZoom(next);
    if (nz === zoom) return;
    setPan({
      x: cx - ((cx - pan.x) * nz) / zoom,
      y: cy - ((cy - pan.y) * nz) / zoom,
    });
    setZoom(nz);
  };
  const adjustZoom = (delta: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    zoomAt(zoom + delta, rect ? rect.width / 2 : 0, rect ? rect.height / 2 : 0);
  };
  const zoomIn = () => adjustZoom(ZOOM_STEP);
  const zoomOut = () => adjustZoom(-ZOOM_STEP);
  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const fitView = () => {
    const el = canvasRef.current;
    if (!el) return;
    const items = el.querySelectorAll<HTMLElement>(
      "[data-node-id], [data-area-id], [data-element-id]",
    );
    if (items.length === 0) {
      resetZoom();
      return;
    }
    const rect = el.getBoundingClientRect();
    const z = zoomRef.current;
    const p = panRef.current;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    items.forEach((c) => {
      const r = c.getBoundingClientRect();
      minX = Math.min(minX, (r.left - rect.left - p.x) / z);
      minY = Math.min(minY, (r.top - rect.top - p.y) / z);
      maxX = Math.max(maxX, (r.right - rect.left - p.x) / z);
      maxY = Math.max(maxY, (r.bottom - rect.top - p.y) / z);
    });
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);
    const pad = 48;
    const nz = clampZoom(
      Math.min(
        (rect.width - pad * 2) / bw,
        (rect.height - pad * 2) / bh,
        ZOOM_MAX,
      ),
    );
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setZoom(nz);
    setPan({ x: rect.width / 2 - cx * nz, y: rect.height / 2 - cy * nz });
  };

  // Re-center the visible area on a world coordinate (used by the minimap).
  const centerOn = (worldX: number, worldY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPan({
      x: rect.width / 2 - worldX * zoom,
      y: rect.height / 2 - worldY * zoom,
    });
  };

  type AlignMode =
    | "left"
    | "hcenter"
    | "right"
    | "top"
    | "vcenter"
    | "bottom";

  const alignNodes = (mode: AlignMode) => {
    if (selectedIds.length < 2) return;
    measureNodeSizes();
    const sizes = nodeSizesRef.current;
    const sel = nodes
      .filter((n) => selectedIds.includes(n.id))
      .map((n) => {
        const s = sizes.get(n.id) ?? { w: 140, h: 52 };
        return { id: n.id, x: n.x, y: n.y, w: s.w, h: s.h };
      });
    const minLeft = Math.min(...sel.map((b) => b.x));
    const maxRight = Math.max(...sel.map((b) => b.x + b.w));
    const minTop = Math.min(...sel.map((b) => b.y));
    const maxBottom = Math.max(...sel.map((b) => b.y + b.h));
    const cX = (minLeft + maxRight) / 2;
    const cY = (minTop + maxBottom) / 2;
    const nextX = new Map<string, number>();
    const nextY = new Map<string, number>();
    for (const b of sel) {
      if (mode === "left") nextX.set(b.id, minLeft);
      else if (mode === "hcenter") nextX.set(b.id, cX - b.w / 2);
      else if (mode === "right") nextX.set(b.id, maxRight - b.w);
      else if (mode === "top") nextY.set(b.id, minTop);
      else if (mode === "vcenter") nextY.set(b.id, cY - b.h / 2);
      else if (mode === "bottom") nextY.set(b.id, maxBottom - b.h);
    }
    setNodes((n) =>
      n.map((node) => {
        if (nextX.has(node.id)) return { ...node, x: nextX.get(node.id)! };
        if (nextY.has(node.id)) return { ...node, y: nextY.get(node.id)! };
        return node;
      }),
    );
    setDirty(true);
  };

  const distributeNodes = (axis: "h" | "v") => {
    if (selectedIds.length < 3) return;
    measureNodeSizes();
    const sizes = nodeSizesRef.current;
    const sel = nodes
      .filter((n) => selectedIds.includes(n.id))
      .map((n) => {
        const s = sizes.get(n.id) ?? { w: 140, h: 52 };
        return { id: n.id, x: n.x, y: n.y, w: s.w, h: s.h };
      });
    const next = new Map<string, number>();
    if (axis === "h") {
      sel.sort((a, b) => a.x + a.w / 2 - (b.x + b.w / 2));
      const first = sel[0].x + sel[0].w / 2;
      const last = sel[sel.length - 1].x + sel[sel.length - 1].w / 2;
      const step = (last - first) / (sel.length - 1);
      sel.forEach((b, i) => {
        if (i > 0 && i < sel.length - 1)
          next.set(b.id, first + step * i - b.w / 2);
      });
      setNodes((n) =>
        n.map((node) =>
          next.has(node.id) ? { ...node, x: next.get(node.id)! } : node,
        ),
      );
    } else {
      sel.sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
      const first = sel[0].y + sel[0].h / 2;
      const last = sel[sel.length - 1].y + sel[sel.length - 1].h / 2;
      const step = (last - first) / (sel.length - 1);
      sel.forEach((b, i) => {
        if (i > 0 && i < sel.length - 1)
          next.set(b.id, first + step * i - b.h / 2);
      });
      setNodes((n) =>
        n.map((node) =>
          next.has(node.id) ? { ...node, y: next.get(node.id)! } : node,
        ),
      );
    }
    setDirty(true);
  };

  const openDetails = (node: MindmapNode) => {
    setDetailId(node.id);
    setDraftLabel(node.label);
    setDraftIcon(node.icon ?? null);
    setDraftColor(node.color ?? null);
    if (node.type === "hotspot") {
      setDraftContent(node.details ?? "");
    } else if (node.type === "mindmap") {
      setDraftMindmapId(node.mindmapId != null ? String(node.mindmapId) : "");
    } else {
      setDraftDetails(node.details ?? "");
    }
  };

  const closeDetails = () => setDetailId(null);

  const detailNode = nodes.find((n) => n.id === detailId) ?? null;
  const detailEdges = detailNode
    ? edges.filter(
        (e) => e.source === detailNode.id || e.target === detailNode.id,
      )
    : [];

  const saveDetails = () => {
    if (!detailNode) return;
    if (detailNode.type === "hotspot") {
      const label = draftLabel.trim() || "Ponto";
      const content = draftContent.trim();
      setNodes((n) =>
        n.map((x) =>
          x.id === detailNode.id
            ? {
                ...x,
                label,
                color: draftColor ?? x.color,
                details: content ? content : null,
              }
            : x,
        ),
      );
    } else if (detailNode.type === "label") {
      const label = draftLabel.trim() || "Texto";
      setNodes((n) =>
        n.map((x) =>
          x.id === detailNode.id
            ? { ...x, label, color: draftColor ?? x.color, details: null }
            : x,
        ),
      );
    } else if (detailNode.type === "mindmap") {
      const target = otherMindmaps.find((m) => String(m.id) === draftMindmapId);
      if (!target) return;
      setNodes((n) =>
        n.map((x) =>
          x.id === detailNode.id
            ? {
                ...x,
                label: target.name,
                color: draftColor ?? x.color,
                mindmapId: target.id,
              }
            : x,
        ),
      );
    } else {
      const label = draftLabel.trim() || "Sem título";
      const details = draftDetails.trim();
      const isProject =
        detailNode.type === "project" || detailNode.type === "task";
      setNodes((n) =>
        n.map((x) =>
          x.id === detailNode.id
            ? {
                ...x,
                label,
                color: draftColor ?? x.color,
                details: details ? details : null,
                ...(isProject ? {} : { icon: draftIcon ?? null }),
              }
            : x,
        ),
      );
    }
    setDirty(true);
    setDetailId(null);
  };

  const openAreaEdit = (area: MindmapArea) => {
    setAreaEditId(area.id);
    setDraftAreaLabel(area.label ?? "");
  };

  const saveAreaEdit = () => {
    if (!areaEditId) return;
    const label = draftAreaLabel.trim();
    setAreas((a) =>
      a.map((x) =>
        x.id === areaEditId ? { ...x, label: label ? label : null } : x,
      ),
    );
    setDirty(true);
    setAreaEditId(null);
  };

  if (isLoading) return <div className="p-8">Carregando editor...</div>;
  if (!mindmap) return <div className="p-8">Mapa não encontrado</div>;

  const nodeById = (nid: string) => nodes.find((n) => n.id === nid);
  const viewNode = nodes.find((n) => n.id === viewHotspotId) ?? null;

  // Floating action bar rendered below the hovered node (inside the node's
  // element, so it follows pan/zoom and hovering it keeps the node "hovered").
  const renderNodeToolbar = (node: MindmapNode) => {
    if (connect) return null;
    if (nodeToolbar?.nodeId !== node.id) return null;
    const closing = nodeToolbar.closing;
    // Every action closes the bar so it never lingers under dialogs/modes.
    const runAction = (action: () => void) => {
      closeNodeToolbar(false);
      action();
    };
    const buttonClass =
      "rounded p-1 text-muted-foreground hover:bg-muted hover:text-primary";
    return (
      // The pt-1.5 wrapper bridges the gap between node and bar so moving the
      // mouse onto the bar never counts as leaving the node.
      <div
        className="absolute left-0 top-full z-30 pt-1.5"
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
      <div
        className={`flex items-center gap-0.5 whitespace-nowrap rounded-md border border-border bg-popover px-1 py-0.5 shadow-md ${
          reducedMotion
            ? ""
            : closing
              ? "mindmap-toolbar-out"
              : "mindmap-toolbar-in"
        }`}
        data-testid={`toolbar-node-${node.id}`}
      >
        {node.type === "project" && node.projectId != null ? (
          <button
            onClick={() => runAction(() => openProject(node.projectId!))}
            className={buttonClass}
            title="Abrir projeto"
            data-testid={`button-node-open-${node.id}`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {node.type === "task" &&
        node.taskId != null &&
        node.projectId != null ? (
          <button
            onClick={() =>
              runAction(() => openTask(node.taskId!, node.projectId!))
            }
            className={buttonClass}
            title="Abrir tarefa"
            data-testid={`button-node-open-${node.id}`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {node.type === "mindmap" &&
        node.mindmapId != null &&
        mindmapInfo.has(node.mindmapId) ? (
          <button
            onClick={() => runAction(() => openReferencedMap(node.mindmapId!))}
            className={buttonClass}
            title="Abrir mapa mental"
            data-testid={`button-node-open-${node.id}`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <button
          onClick={() => runAction(() => openDetails(node))}
          className={buttonClass}
          title="Editar"
          data-testid={`button-node-edit-${node.id}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => runAction(() => startConnect(node.id, false))}
          className={buttonClass}
          title="Conectar (linha)"
          data-testid={`button-node-connect-${node.id}`}
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => runAction(() => startConnect(node.id, true))}
          className={buttonClass}
          title="Seta (direcional)"
          data-testid={`button-node-arrow-${node.id}`}
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => runAction(() => deleteNode(node.id))}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
          title="Excluir"
          data-testid={`button-node-delete-${node.id}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      </div>
    );
  };

  const renderBorderColorPicker = (
    value: string | null,
    onSelect: (c: string | null) => void,
    allowAuto: boolean,
  ) => {
    const isPreset =
      value != null &&
      NODE_COLORS.some((c) => c.toLowerCase() === value.toLowerCase());
    const isCustom = value != null && !isPreset;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {allowAuto && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
              value === null
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            Automático
          </button>
        )}
        {NODE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onSelect(c)}
            title={c}
            aria-label={`Cor ${c}`}
            className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
              value?.toLowerCase() === c.toLowerCase()
                ? "ring-2 ring-offset-2 ring-offset-background ring-primary"
                : ""
            }`}
            style={{ backgroundColor: c, borderColor: c }}
          />
        ))}
        <label
          title="Cor personalizada"
          className={`relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 hover:opacity-90 ${
            isCustom
              ? "ring-2 ring-offset-2 ring-offset-background ring-primary"
              : "border-dashed border-border"
          }`}
          style={isCustom ? { backgroundColor: value, borderColor: value } : undefined}
        >
          <input
            type="color"
            aria-label="Cor personalizada"
            value={value ?? "#64748b"}
            onChange={(e) => onSelect(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <Palette
            className={`h-3.5 w-3.5 ${isCustom ? "text-white" : "text-muted-foreground"}`}
          />
        </label>
      </div>
    );
  };

  const renderNode = (node: MindmapNode) => {
    const isSelected = selectedIds.includes(node.id);
    const isDragging =
      (drag?.kind === "node" && drag.id === node.id) ||
      (drag?.kind === "group" && isSelected);
    const zClass = isDragging ? "z-20" : "z-10";
    const ringClass =
      connect?.source === node.id || isSelected
        ? "ring-2 ring-primary"
        : "hover:ring-2 ring-primary/40";

    if (node.type === "label") {
      // "Liquid glass" title treatment: frosted translucent plate tinted by
      // the node color, with a glossy top highlight and a soft colored glow.
      const labelColor = node.color || ELECTRIC_BLUE;
      return (
        <div
          key={node.id}
          data-node-id={node.id}
          onPointerDown={(e) => onNodePointerDown(e, node)}
          onDoubleClick={() => openDetails(node)}
          onMouseEnter={() => onNodeHoverStart(node.id)}
          onMouseLeave={() => onNodeHoverEnd(node.id)}
          className={`absolute overflow-visible rounded-xl px-3.5 py-1.5 ${zClass} ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          } ${ringClass}`}
          style={{
            left: node.x,
            top: node.y,
            // Mostly transparent: the tint is very light so whatever passes
            // behind (wires, nodes, grid) shows through, blurred.
            background: `linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, ${withAlpha(
              labelColor,
              0.07,
            )} 45%, ${withAlpha(labelColor, 0.02)} 100%)`,
            border: "1px solid rgba(255, 255, 255, 0.25)",
            boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.30), inset 0 -10px 18px ${withAlpha(
              labelColor,
              0.08,
            )}, 0 8px 24px rgba(0, 0, 0, 0.25), 0 0 16px ${withAlpha(labelColor, 0.18)}`,
            backdropFilter: "blur(6px) saturate(1.6)",
            WebkitBackdropFilter: "blur(6px) saturate(1.6)",
          }}
        >
          {/* Glossy reflection on the upper half of the glass. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-[3px] top-[2px] h-1/2 rounded-t-[10px]"
            style={{
              background:
                "linear-gradient(180deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0) 100%)",
            }}
          />
          <span
            className="relative text-sm font-semibold tracking-wide whitespace-pre-wrap"
            style={{
              color: labelColor,
              textShadow: `0 0 10px ${withAlpha(labelColor, 0.5)}`,
            }}
          >
            {node.label}
          </span>
          {renderNodeToolbar(node)}
        </div>
      );
    }

    if (node.type === "hotspot") {
      return (
        <div
          key={node.id}
          data-node-id={node.id}
          onPointerDown={(e) => onNodePointerDown(e, node)}
          onMouseEnter={() => onNodeHoverStart(node.id)}
          onMouseLeave={() => onNodeHoverEnd(node.id)}
          className={`absolute flex items-center gap-1.5 ${zClass} ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          style={{ left: node.x, top: node.y }}
        >
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md ${
              connect?.source === node.id || isSelected
                ? "ring-2 ring-primary"
                : ""
            }`}
            style={{ backgroundColor: node.color || "#64748b" }}
            title="Clique para ver o conteúdo"
          >
            <MapPin className="h-4 w-4" />
          </div>
          <span className="whitespace-nowrap rounded bg-background/80 px-1.5 py-0.5 text-xs font-medium shadow-sm">
            {node.label}
          </span>
          {renderNodeToolbar(node)}
        </div>
      );
    }

    if (node.type === "light") {
      const color = node.color || ELECTRIC_BLUE;
      return (
        <div
          key={node.id}
          data-node-id={node.id}
          onPointerDown={(e) => onNodePointerDown(e, node)}
          onDoubleClick={() => openDetails(node)}
          onMouseEnter={() => onNodeHoverStart(node.id)}
          onMouseLeave={() => onNodeHoverEnd(node.id)}
          className={`absolute ${zClass} ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          style={{ left: node.x, top: node.y }}
        >
          <div
            className={`relative h-12 w-12 rounded-full ${
              connect?.source === node.id || isSelected
                ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                : ""
            }`}
            style={{
              // Glass sphere: dark blue core fading to black, glowing rim.
              background: "radial-gradient(circle, #020c24 0%, #000000 80%)",
              boxShadow: `0 0 16px 3px ${withAlpha(color, 0.45)}, inset 0 0 14px 2px ${withAlpha(
                color,
                0.3,
              )}, inset 0 0 5px rgba(255, 255, 255, 0.2)`,
            }}
            title={node.label || "Ponto de luz"}
          >
            <PlasmaBall size={48} color={color} animate={!reducedMotion} />
          </div>
          {renderNodeToolbar(node)}
        </div>
      );
    }

    if (node.type === "mindmap") {
      const info =
        node.mindmapId != null ? mindmapInfo.get(node.mindmapId) : undefined;
      const name = info?.name ?? node.label;
      const count = info?.count ?? 0;
      return (
        <div
          key={node.id}
          data-node-id={node.id}
          onPointerDown={(e) => onNodePointerDown(e, node)}
          onDoubleClick={() => openDetails(node)}
          onMouseEnter={() => onNodeHoverStart(node.id)}
          onMouseLeave={() => onNodeHoverEnd(node.id)}
          className={`absolute rounded-lg shadow-lg border-2 bg-card px-4 py-3 w-max max-w-[280px] ${zClass} ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          } ${ringClass}`}
          style={{
            left: node.x,
            top: node.y,
            borderColor: node.color || "#64748b",
          }}
        >
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Network className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {name}
          </span>
          <div className="mt-1.5">
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {info
                ? `${count} ${count === 1 ? "nó" : "nós"}`
                : "Mapa indisponível"}
            </span>
          </div>
          {renderNodeToolbar(node)}
        </div>
      );
    }

    return (
      <div
        key={node.id}
        data-node-id={node.id}
        onPointerDown={(e) => onNodePointerDown(e, node)}
        onDoubleClick={() => openDetails(node)}
        onMouseEnter={() => onNodeHoverStart(node.id)}
        onMouseLeave={() => onNodeHoverEnd(node.id)}
        className={`absolute rounded-lg shadow-lg border-2 bg-card px-4 py-3 w-max max-w-[280px] ${zClass} ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        } ${ringClass}`}
        style={{
          left: node.x,
          top: node.y,
          borderColor: node.color || "#64748b",
        }}
      >
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {(() => {
            if (node.type === "project")
              return (
                <FolderKanban className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              );
            if (node.type === "task")
              return (
                <ListChecks className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              );
            const CustomIcon =
              node.icon && iconMod ? iconMod[node.icon] : null;
            if (typeof CustomIcon === "function")
              return (
                <CustomIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              );
            if (node.details)
              return (
                <AlignLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              );
            return null;
          })()}
          {node.label}
        </span>
        {renderNodeToolbar(node)}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => guardedNavigate("/mindmaps")}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {mindmap.name}
              </h1>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground"
                onClick={openEdit}
                title="Editar mapa mental"
                aria-label="Editar mapa mental"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Arraste o fundo para navegar · Ctrl/Cmd + arraste (ou o modo de
              seleção) seleciona vários · Shift + roda move para os lados · Ctrl
              + roda dá zoom
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <WorkspaceSwitcher
            value={workspaceId ?? null}
            onSelect={(wsId) => {
              if (wsId === workspaceId) return;
              guardedNavigate("/mindmaps", () => setActiveWorkspaceId(wsId));
            }}
          />
          <Button variant="outline" onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar
          </Button>
          <Button variant="outline" onClick={addArea}>
            <Square className="mr-2 h-4 w-4" /> Área
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Shapes className="mr-2 h-4 w-4" /> Forma
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-2">
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Seta"
                  aria-label="Adicionar seta"
                  onClick={() => addElement("arrow")}
                >
                  <MoveUpRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Círculo"
                  aria-label="Adicionar círculo"
                  onClick={() => addElement("circle")}
                >
                  <Circle className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Quadrado"
                  aria-label="Adicionar quadrado"
                  onClick={() => addElement("square")}
                >
                  <Square className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Triângulo"
                  aria-label="Adicionar triângulo"
                  onClick={() => addElement("triangle")}
                >
                  <Triangle className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Losango"
                  aria-label="Adicionar losango"
                  onClick={() => addElement("diamond")}
                >
                  <Diamond className="h-4 w-4" />
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            onClick={handleSave}
            disabled={!dirty || updateMindmap.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {dirty ? "Salvar" : "Salvo"}
          </Button>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar mapa mental</DialogTitle>
            <DialogDescription>
              Renomeie, copie o link ou escolha quem pode ver.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="mindmap-rename">Nome</Label>
              <Input
                id="mindmap-rename"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
                placeholder="Nome do mapa mental"
              />
            </div>

            <div className="space-y-2">
              <Label>Link</Label>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleCopyLink}
              >
                {linkCopied ? (
                  <Check className="mr-2 h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                {linkCopied ? "Link copiado" : "Copiar link"}
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Colaborar</Label>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setEditOpen(false);
                  setMembersOpen(true);
                }}
              >
                <Users className="mr-2 h-4 w-4" />
                Quem pode ver além de você
              </Button>
              <p className="text-xs text-muted-foreground">
                O acesso é definido pelos membros do workspace — quem participa
                pode ver este mapa mental.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRename}
              disabled={updateMindmap.isPending || !renameValue.trim()}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {workspaceId ? (
        <WorkspaceMembersDialog
          workspaceId={workspaceId}
          open={membersOpen}
          onOpenChange={setMembersOpen}
        />
      ) : null}

      {connect && (
        <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/30 px-4 py-2 text-sm">
          {connect.directed ? (
            <ArrowUpRight className="h-4 w-4 text-primary" />
          ) : (
            <Link2 className="h-4 w-4 text-primary" />
          )}
          Selecione o nó de destino para{" "}
          {connect.directed ? "criar uma seta" : "conectar"}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7"
            onClick={() => setConnect(null)}
          >
            Cancelar
          </Button>
        </div>
      )}

      <div
        ref={canvasRef}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
        className={`flex-1 min-h-[500px] bg-muted/30 border border-border rounded-xl relative overflow-hidden select-none ${
          drag?.kind === "pan"
            ? "cursor-grabbing"
            : spaceHeld
              ? "cursor-grab"
              : ""
        }`}
        style={{
          backgroundImage:
            "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        <div
          ref={contentRef}
          className="absolute inset-0 origin-top-left"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
        {areas.map((area) => (
          <div
            key={area.id}
            data-area-id={area.id}
            onPointerDown={(e) => onAreaPointerDown(e, area)}
            className={`absolute group z-0 rounded-lg border-2 ${
              drag?.kind === "area" && drag.id === area.id
                ? "cursor-grabbing"
                : "cursor-grab"
            }`}
            style={{
              left: area.x,
              top: area.y,
              width: area.width,
              height: area.height,
              backgroundColor: withAlpha(area.color, 0.12),
              borderColor: withAlpha(area.color, 0.6),
            }}
          >
            {area.label && (
              <span
                className="absolute left-2 top-1 text-xs font-semibold"
                style={{ color: area.color }}
              >
                {area.label}
              </span>
            )}
            <div
              className="absolute right-1 top-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Popover
                open={colorAreaId === area.id}
                onOpenChange={(o) => setColorAreaId(o ? area.id : null)}
              >
                <PopoverTrigger asChild>
                  <button
                    className="rounded bg-background/80 p-1 text-muted-foreground hover:text-primary shadow-sm"
                    title="Cor"
                  >
                    <Palette className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-2">
                  <div className="grid grid-cols-3 gap-1">
                    {NODE_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="h-6 w-6 rounded-sm border border-border"
                        style={{ backgroundColor: c }}
                        aria-label={`Cor ${c}`}
                        onClick={() => setAreaColor(area.id, c)}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <button
                className="rounded bg-background/80 p-1 text-muted-foreground hover:text-primary shadow-sm"
                onClick={() => openAreaEdit(area)}
                title="Renomear seção"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                className="rounded bg-background/80 p-1 text-muted-foreground hover:text-destructive shadow-sm"
                onClick={() => deleteArea(area.id)}
                title="Excluir"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div
              onPointerDown={(e) => onResizePointerDown(e, area)}
              className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
              style={{
                background: `linear-gradient(135deg, transparent 50%, ${withAlpha(
                  area.color,
                  0.7,
                )} 50%)`,
              }}
              title="Redimensionar"
            />
          </div>
        ))}

        {elements.map((el) => {
          const color = el.color || ELECTRIC_BLUE;
          const isSelectedEl = selectedElementId === el.id;
          const isDraggingEl =
            (drag?.kind === "element" ||
              drag?.kind === "element-resize" ||
              drag?.kind === "element-rotate") &&
            drag.id === el.id;
          const shapeSvg = (() => {
            const common = {
              fill: withAlpha(color, 0.18),
              stroke: color,
              strokeWidth: 2.5,
              vectorEffect: "non-scaling-stroke" as const,
              strokeLinejoin: "round" as const,
            };
            switch (el.shape) {
              case "circle":
                return <ellipse cx={50} cy={50} rx={48} ry={48} {...common} />;
              case "square":
                return (
                  <rect x={2} y={2} width={96} height={96} rx={4} {...common} />
                );
              case "triangle":
                return <polygon points="50,4 96,96 4,96" {...common} />;
              case "diamond":
                return <polygon points="50,2 98,50 50,98 2,50" {...common} />;
              case "arrow":
              default:
                return (
                  <polygon
                    points="0,35 58,35 58,12 100,50 58,88 58,65 0,65"
                    fill={color}
                    stroke={color}
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                  />
                );
            }
          })();
          return (
            <div
              key={el.id}
              data-element-id={el.id}
              onPointerDown={(e) => onElementPointerDown(e, el)}
              className={`absolute group z-[2] ${
                isDraggingEl ? "cursor-grabbing" : "cursor-grab"
              }`}
              style={{
                left: el.x,
                top: el.y,
                width: el.width,
                height: el.height,
              }}
            >
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="h-full w-full"
                style={{
                  transform: `rotate(${el.rotation ?? 0}deg)`,
                  overflow: "visible",
                }}
              >
                {shapeSvg}
              </svg>
              {isSelectedEl && (
                <div className="pointer-events-none absolute -inset-1 rounded-sm ring-2 ring-primary/60" />
              )}
              <div
                className={`absolute -right-1 -top-8 flex gap-0.5 transition-opacity ${
                  isSelectedEl
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                }`}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <Popover
                  open={colorElementId === el.id}
                  onOpenChange={(o) => setColorElementId(o ? el.id : null)}
                >
                  <PopoverTrigger asChild>
                    <button
                      className="rounded bg-background/80 p-1 text-muted-foreground hover:text-primary shadow-sm"
                      title="Cor"
                      aria-label="Cor da forma"
                    >
                      <Palette className="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-auto p-2">
                    <div className="grid grid-cols-3 gap-1">
                      {NODE_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className="h-6 w-6 rounded-sm border border-border"
                          style={{ backgroundColor: c }}
                          aria-label={`Cor ${c}`}
                          onClick={() => setElementColor(el.id, c)}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <button
                  className="rounded bg-background/80 p-1 text-muted-foreground hover:text-destructive shadow-sm"
                  onClick={() => deleteElement(el.id)}
                  title="Excluir forma"
                  aria-label="Excluir forma"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div
                onPointerDown={(e) => onElementRotateDown(e, el)}
                className={`absolute -top-8 left-1/2 -ml-3 flex h-6 w-6 cursor-alias items-center justify-center rounded-full bg-background/80 text-muted-foreground shadow-sm hover:text-primary transition-opacity ${
                  isSelectedEl
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                }`}
                title="Girar (Shift = 15°)"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </div>
              <div
                onPointerDown={(e) => onElementResizeDown(e, el)}
                className={`absolute -bottom-1 -right-1 h-4 w-4 cursor-nwse-resize rounded-sm transition-opacity ${
                  isSelectedEl
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                }`}
                style={{
                  background: `linear-gradient(135deg, transparent 50%, ${withAlpha(
                    color,
                    0.8,
                  )} 50%)`,
                }}
                title="Redimensionar"
              />
            </div>
          );
        })}

        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-[5]"
          style={{ overflow: "visible" }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="8"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L8,3 L0,6 Z" fill="hsl(var(--primary))" />
            </marker>
          </defs>
          {edges.map((edge) => {
            const s = nodeById(edge.source);
            const t = nodeById(edge.target);
            if (!s || !t) return null;
            const a = anchorFor(s);
            const b = anchorFor(t);
            let x2 = b.x;
            let y2 = b.y;
            if (edge.directed) {
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const len = Math.hypot(dx, dy) || 1;
              x2 = b.x - (dx / len) * 18;
              y2 = b.y - (dy / len) * 18;
            }
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            return (
              <g
                key={edge.id}
                className="group"
                style={{ pointerEvents: connect ? "none" : "auto" }}
              >
                <EnergyWire
                  edgeId={edge.id}
                  x1={a.x}
                  y1={a.y}
                  x2={x2}
                  y2={y2}
                  directed={edge.directed}
                  registry={wireRegistry}
                  animate={effectsOn}
                  intro={introEdgesRef.current.has(edge.id)}
                  onIntroEnd={() => {
                    introEdgesRef.current.delete(edge.id);
                    // Contact point in screen space (canvas overlay coords).
                    const p = panRef.current;
                    const z = zoomRef.current;
                    spawnBurst(p.x + b.x * z, p.y + b.y * z);
                    flashNode(edge.target);
                  }}
                />
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="transparent"
                  strokeWidth={16}
                  style={{ cursor: "pointer" }}
                />
                <g
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ cursor: "pointer" }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => deleteEdge(edge.id)}
                >
                  <circle
                    cx={mx}
                    cy={my}
                    r={9}
                    fill="hsl(var(--background))"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={1.5}
                  />
                  <line
                    x1={mx - 3.5}
                    y1={my - 3.5}
                    x2={mx + 3.5}
                    y2={my + 3.5}
                    stroke="hsl(var(--destructive))"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                  <line
                    x1={mx - 3.5}
                    y1={my + 3.5}
                    x2={mx + 3.5}
                    y2={my - 3.5}
                    stroke="hsl(var(--destructive))"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                </g>
              </g>
            );
          })}
        </svg>

        {nodes.map((node) => renderNode(node))}

        {marquee && (
          <div
            className="pointer-events-none absolute z-40 rounded-sm border-2 border-primary/70 bg-primary/10"
            style={{
              left: marquee.x,
              top: marquee.y,
              width: marquee.w,
              height: marquee.h,
            }}
          />
        )}

        {nodes.length === 0 && areas.length === 0 && elements.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <p>Mapa vazio</p>
            <Button variant="outline" onClick={openAdd}>
              <Plus className="mr-2 h-4 w-4" /> Criar primeiro elemento
            </Button>
          </div>
        )}
        </div>

        <canvas
          ref={sparkCanvasRef}
          className="pointer-events-none absolute inset-0 z-40 h-full w-full"
        />

        {guides.x != null && (
          <div
            className="pointer-events-none absolute bottom-0 top-0 z-40 w-px"
            style={{ left: guides.x * zoom + pan.x, backgroundColor: "#ec4899" }}
          />
        )}
        {guides.y != null && (
          <div
            className="pointer-events-none absolute left-0 right-0 z-40 h-px"
            style={{ top: guides.y * zoom + pan.y, backgroundColor: "#ec4899" }}
          />
        )}

        {selectedIds.length > 1 && (
          <div className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-background/90 p-1 shadow-md backdrop-blur">
            <span className="px-1.5 text-xs font-medium text-muted-foreground">
              {selectedIds.length} selecionados
            </span>
            <div className="mx-0.5 h-5 w-px bg-border" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => alignNodes("left")}
              title="Alinhar à esquerda"
            >
              <AlignStartVertical className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => alignNodes("hcenter")}
              title="Centralizar horizontalmente"
            >
              <AlignCenterVertical className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => alignNodes("right")}
              title="Alinhar à direita"
            >
              <AlignEndVertical className="h-4 w-4" />
            </Button>
            <div className="mx-0.5 h-5 w-px bg-border" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => alignNodes("top")}
              title="Alinhar ao topo"
            >
              <AlignStartHorizontal className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => alignNodes("vcenter")}
              title="Centralizar verticalmente"
            >
              <AlignCenterHorizontal className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => alignNodes("bottom")}
              title="Alinhar à base"
            >
              <AlignEndHorizontal className="h-4 w-4" />
            </Button>
            <div className="mx-0.5 h-5 w-px bg-border" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => distributeNodes("h")}
              disabled={selectedIds.length < 3}
              title="Distribuir horizontalmente"
            >
              <AlignHorizontalDistributeCenter className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => distributeNodes("v")}
              disabled={selectedIds.length < 3}
              title="Distribuir verticalmente"
            >
              <AlignVerticalDistributeCenter className="h-4 w-4" />
            </Button>
            <div className="mx-0.5 h-5 w-px bg-border" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={duplicateSelected}
              title="Duplicar selecionados"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={deleteSelected}
              title="Excluir selecionados (Delete)"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        <MindmapMinimap
          nodes={nodes}
          areas={areas}
          pan={pan}
          zoom={zoom}
          viewport={canvasSize}
          onNavigate={centerOn}
        />

        <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1 rounded-lg border border-border bg-background/90 p-1 shadow-md backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={undo}
            disabled={!canUndo}
            title="Desfazer (Ctrl+Z)"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={redo}
            disabled={!canRedo}
            title="Refazer (Ctrl+Shift+Z)"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleEnergy}
            aria-pressed={energyOn}
            title={
              energyOn
                ? "Desativar efeitos de energia"
                : "Ativar efeitos de energia"
            }
          >
            {energyOn ? (
              <Zap className="h-4 w-4 text-primary" />
            ) : (
              <ZapOff className="h-4 w-4" />
            )}
          </Button>
          <div className="mx-0.5 h-5 w-px bg-border" />
          <Button
            variant={selectMode ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelectMode((v) => !v)}
            aria-pressed={selectMode}
            title={
              selectMode
                ? "Modo de seleção ativo · arraste para selecionar vários"
                : "Modo de seleção · arraste para selecionar vários"
            }
          >
            <BoxSelect className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={fitView}
            title="Enquadrar tudo"
          >
            <Maximize className="h-4 w-4" />
          </Button>
          <div className="mx-0.5 h-5 w-px bg-border" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={zoomOut}
            disabled={zoom <= ZOOM_MIN}
            title="Diminuir zoom"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <button
            type="button"
            onClick={resetZoom}
            className="min-w-[3rem] text-center text-xs font-medium tabular-nums text-muted-foreground hover:text-primary"
            title="Redefinir zoom (100%)"
          >
            {Math.round(zoom * 100)}%
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={zoomIn}
            disabled={zoom >= ZOOM_MAX}
            title="Aumentar zoom"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={!!detailId} onOpenChange={(o) => !o && closeDetails()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {detailNode?.type === "hotspot"
                ? "Editar ponto"
                : detailNode?.type === "label"
                  ? "Editar texto"
                  : detailNode?.type === "mindmap"
                    ? "Editar mapa mental"
                    : "Detalhes do nó"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {detailNode?.type === "hotspot" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="node-label">Título</Label>
                  <Input
                    id="node-label"
                    value={draftLabel}
                    onChange={(e) => setDraftLabel(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Conteúdo</Label>
                  <MindmapRichText
                    key={detailNode.id}
                    initialContent={draftContent}
                    onChange={setDraftContent}
                  />
                </div>
              </>
            ) : detailNode?.type === "label" ? (
              <div className="space-y-2">
                <Label htmlFor="node-label">Texto</Label>
                <Textarea
                  id="node-label"
                  rows={3}
                  value={draftLabel}
                  onChange={(e) => setDraftLabel(e.target.value)}
                />
              </div>
            ) : detailNode?.type === "mindmap" ? (
              <div className="space-y-2">
                <Label>Mapa mental referenciado</Label>
                <Select
                  value={draftMindmapId}
                  onValueChange={setDraftMindmapId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um mapa mental" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherMindmaps.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Nenhum outro mapa disponível
                      </div>
                    ) : (
                      otherMindmaps.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.name} · {safeMapData(m.data).nodes.length}{" "}
                          {safeMapData(m.data).nodes.length === 1
                            ? "nó"
                            : "nós"}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                {detailNode?.type === "project" ||
                detailNode?.type === "task" ? (
                  <div className="space-y-2">
                    <Label htmlFor="node-label">Título</Label>
                    <Input
                      id="node-label"
                      value={draftLabel}
                      onChange={(e) => setDraftLabel(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex flex-1 flex-col gap-2">
                      <Label htmlFor="node-label">Título</Label>
                      <Input
                        id="node-label"
                        value={draftLabel}
                        onChange={(e) => setDraftLabel(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Ícone</Label>
                      <MindmapIconPicker
                        value={draftIcon}
                        onChange={setDraftIcon}
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="node-details">Detalhes</Label>
                  <Textarea
                    id="node-details"
                    rows={6}
                    placeholder="Adicione detalhes, notas ou contexto para este nó..."
                    value={draftDetails}
                    onChange={(e) => setDraftDetails(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Cor da borda</Label>
              {renderBorderColorPicker(draftColor, setDraftColor, false)}
            </div>
            {detailNode && detailEdges.length > 0 && (
              <div className="space-y-2">
                <Label>Links ({detailEdges.length})</Label>
                <div className="space-y-1">
                  {detailEdges.map((edge) => {
                    const otherId =
                      edge.source === detailNode.id
                        ? edge.target
                        : edge.source;
                    const other = nodeById(otherId);
                    const outgoing = edge.source === detailNode.id;
                    return (
                      <div
                        key={edge.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {edge.directed ? (
                            <ArrowUpRight
                              className={`h-3.5 w-3.5 shrink-0 text-muted-foreground ${
                                outgoing ? "" : "rotate-180"
                              }`}
                            />
                          ) : (
                            <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                          <span className="truncate">
                            {other?.label ?? "Nó removido"}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteEdge(edge.id)}
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          title="Excluir link"
                          aria-label="Excluir link"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDetails}>
              Cancelar
            </Button>
            <Button onClick={saveDetails}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!viewHotspotId}
        onOpenChange={(o) => !o && setViewHotspotId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewNode?.label ?? "Ponto"}</DialogTitle>
          </DialogHeader>
          {viewNode?.details ? (
            <div
              className="rte-content prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(viewNode.details),
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Este ponto ainda não tem conteúdo.
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (viewNode) openDetails(viewNode);
                setViewHotspotId(null);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!areaEditId} onOpenChange={(o) => !o && setAreaEditId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nome da seção</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="area-label">Nome</Label>
            <Input
              id="area-label"
              value={draftAreaLabel}
              placeholder="Ex.: Em andamento"
              onChange={(e) => setDraftAreaLabel(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAreaEditId(null)}>
              Cancelar
            </Button>
            <Button onClick={saveAreaEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar elemento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={addType === "text" ? "default" : "outline"}
                  onClick={() => setAddType("text")}
                >
                  <AlignLeft className="mr-2 h-4 w-4" /> Cartão
                </Button>
                <Button
                  type="button"
                  variant={addType === "project" ? "default" : "outline"}
                  onClick={() => setAddType("project")}
                >
                  <FolderKanban className="mr-2 h-4 w-4" /> Projeto
                </Button>
                <Button
                  type="button"
                  variant={addType === "label" ? "default" : "outline"}
                  onClick={() => setAddType("label")}
                >
                  <Type className="mr-2 h-4 w-4" /> Texto
                </Button>
                <Button
                  type="button"
                  variant={addType === "hotspot" ? "default" : "outline"}
                  onClick={() => setAddType("hotspot")}
                >
                  <MapPin className="mr-2 h-4 w-4" /> Ponto
                </Button>
                <Button
                  type="button"
                  variant={addType === "mindmap" ? "default" : "outline"}
                  onClick={() => setAddType("mindmap")}
                >
                  <Network className="mr-2 h-4 w-4" /> Mapa Mental
                </Button>
                <Button
                  type="button"
                  variant={addType === "task" ? "default" : "outline"}
                  onClick={() => setAddType("task")}
                >
                  <ListChecks className="mr-2 h-4 w-4" /> Tarefa
                </Button>
                <Button
                  type="button"
                  variant={addType === "light" ? "default" : "outline"}
                  onClick={() => setAddType("light")}
                >
                  <Lightbulb className="mr-2 h-4 w-4" /> Ponto de luz
                </Button>
              </div>
            </div>
            {addType === "project" && (
              <div className="space-y-2">
                <Label>Projeto</Label>
                <Select value={addProjectId} onValueChange={setAddProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Nenhum projeto disponível
                      </div>
                    ) : (
                      projects.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            {addType === "mindmap" && (
              <div className="space-y-2">
                <Label>Mapa mental</Label>
                <Select value={addMindmapId} onValueChange={setAddMindmapId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um mapa mental" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherMindmaps.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Nenhum outro mapa disponível
                      </div>
                    ) : (
                      otherMindmaps.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.name} · {safeMapData(m.data).nodes.length}{" "}
                          {safeMapData(m.data).nodes.length === 1
                            ? "nó"
                            : "nós"}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            {addType === "task" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Projeto</Label>
                  <Select
                    value={addTaskProjectId}
                    onValueChange={(v) => {
                      setAddTaskProjectId(v);
                      setAddTaskId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          Nenhum projeto disponível
                        </div>
                      ) : (
                        projects.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {addTaskProjectId && (
                  <div className="space-y-2">
                    <Label>Tarefa</Label>
                    <Select value={addTaskId} onValueChange={setAddTaskId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma tarefa" />
                      </SelectTrigger>
                      <SelectContent>
                        {addTasks.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            Nenhuma tarefa disponível
                          </div>
                        ) : (
                          addTasks.map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>
                              {t.title}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Cor da borda</Label>
              {renderBorderColorPicker(addColor, setAddColor, true)}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmAdd}
              disabled={
                (addType === "project" && !addProjectId) ||
                (addType === "mindmap" && !addMindmapId) ||
                (addType === "task" && !addTaskId)
              }
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
