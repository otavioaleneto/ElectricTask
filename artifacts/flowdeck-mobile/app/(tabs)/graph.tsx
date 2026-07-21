import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  Gesture,
  GestureDetector,
  type GestureType,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Line } from "react-native-svg";
import {
  getGetTaskQueryKey,
  getGetWorkspaceGraphQueryKey,
  getListColumnsQueryKey,
  useGetTask,
  useGetWorkspaceGraph,
  useListColumns,
  useListWorkspaces,
  type Column,
  type GraphNode,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { useWorkspace } from "@/contexts/workspace";
import {
  EmptyState,
  ErrorView,
  Header,
  IconButton,
  LoadingView,
} from "@/components/ui";
import { TaskEditorSheet } from "@/components/TaskEditorSheet";

// A large, centered "world" layer so nodes at any (including negative) world
// coordinate stay inside the parent's frame -- required on native, where a
// touch is only dispatched to a child if it falls inside every ancestor's
// bounds. See memory: RN transformed-layer hit-testing.
const WORLD_OFFSET = 2000;
const WORLD_SIZE = WORLD_OFFSET * 2;

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2;

const NODE_W = 132;
const NODE_H = 66;
const CIRCLE_D = 26;

type Pos = { x: number; y: number };
type NodeType = GraphNode["type"];

const TYPE_META: Record<
  NodeType,
  {
    color: string;
    icon: React.ComponentProps<typeof Ionicons>["name"];
    label: string;
  }
> = {
  note: { color: "#3b82f6", icon: "document-text", label: "Notas" },
  mindmap: { color: "#8b5cf6", icon: "git-network", label: "Mapas" },
  task: { color: "#22c55e", icon: "checkbox", label: "Tarefas" },
};

const nodeKey = (n: { type: string; id: number }) => `${n.type}:${n.id}`;

function clampZoom(z: number): number {
  "worklet";
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

// ---------------------------------------------------------------------------
// Force-directed layout (Fruchterman-Reingold-ish). Runs once per graph
// signature and settles to static positions; dragging takes over from there.
// ---------------------------------------------------------------------------
function computeLayout(
  nodes: GraphNode[],
  edges: { sourceType: string; sourceId: number; targetType: string; targetId: number }[],
): Record<string, Pos> {
  const n = nodes.length;
  if (n === 0) return {};

  const keys = nodes.map(nodeKey);
  const pos: Record<string, Pos> = {};
  const seedRadius = Math.max(160, n * 26);
  keys.forEach((k, i) => {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2;
    pos[k] = { x: seedRadius * Math.cos(a), y: seedRadius * Math.sin(a) };
  });
  if (n === 1) return pos;

  const links = edges
    .map(
      (e) =>
        [`${e.sourceType}:${e.sourceId}`, `${e.targetType}:${e.targetId}`] as const,
    )
    .filter(([a, b]) => pos[a] && pos[b] && a !== b);

  const iterations = 320;
  const kRep = 26000; // repulsion strength
  const kSpring = 0.025; // spring stiffness
  const restLen = 150; // desired edge length
  const kCenter = 0.012; // gravity toward origin
  const maxStep = 60;

  const disp: Record<string, Pos> = {};
  for (let it = 0; it < iterations; it++) {
    for (const k of keys) disp[k] = { x: 0, y: 0 };

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = keys[i];
        const b = keys[j];
        let dx = pos[a].x - pos[b].x;
        let dy = pos[a].y - pos[b].y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          d2 = dx * dx + dy * dy + 0.01;
        }
        const d = Math.sqrt(d2);
        const f = kRep / d2;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        disp[a].x += fx;
        disp[a].y += fy;
        disp[b].x -= fx;
        disp[b].y -= fy;
      }
    }

    for (const [a, b] of links) {
      const dx = pos[b].x - pos[a].x;
      const dy = pos[b].y - pos[a].y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = kSpring * (d - restLen);
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      disp[a].x += fx;
      disp[a].y += fy;
      disp[b].x -= fx;
      disp[b].y -= fy;
    }

    const cooling = 1 - it / iterations;
    for (const k of keys) {
      disp[k].x -= pos[k].x * kCenter;
      disp[k].y -= pos[k].y * kCenter;
      let mx = disp[k].x * cooling;
      let my = disp[k].y * cooling;
      const m = Math.sqrt(mx * mx + my * my);
      if (m > maxStep) {
        mx = (mx / m) * maxStep;
        my = (my / m) * maxStep;
      }
      pos[k].x += mx;
      pos[k].y += my;
    }
  }
  return pos;
}

// ---------------------------------------------------------------------------
// Edges (SVG lines in world space)
// ---------------------------------------------------------------------------
function GraphEdgesInner({
  edges,
  positions,
  live,
  color,
}: {
  edges: { id: string; sourceType: string; sourceId: number; targetType: string; targetId: number }[];
  positions: Record<string, Pos>;
  live: Record<string, Pos>;
  color: string;
}) {
  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      width={WORLD_SIZE}
      height={WORLD_SIZE}
    >
      {edges.map((e) => {
        const sKey = `${e.sourceType}:${e.sourceId}`;
        const tKey = `${e.targetType}:${e.targetId}`;
        const s = live[sKey] ?? positions[sKey];
        const t = live[tKey] ?? positions[tKey];
        if (!s || !t) return null;
        return (
          <Line
            key={e.id}
            x1={s.x + WORLD_OFFSET}
            y1={s.y + WORLD_OFFSET}
            x2={t.x + WORLD_OFFSET}
            y2={t.y + WORLD_OFFSET}
            stroke={color}
            strokeWidth={1.5}
            strokeOpacity={0.5}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
}
const GraphEdges = React.memo(GraphEdgesInner);

// ---------------------------------------------------------------------------
// Node (colored circle + label, draggable + tappable)
// ---------------------------------------------------------------------------
function GraphNodeViewInner({
  node,
  x,
  y,
  zoom,
  activeNodeId,
  panRef,
  pinchRef,
  ringColor,
  labelColor,
  onDragLive,
  onDragEnd,
  onTap,
}: {
  node: GraphNode;
  x: number;
  y: number;
  zoom: SharedValue<number>;
  activeNodeId: SharedValue<string | null>;
  panRef: React.MutableRefObject<GestureType | undefined>;
  pinchRef: React.MutableRefObject<GestureType | undefined>;
  ringColor: string;
  labelColor: string;
  onDragLive: (key: string, x: number, y: number) => void;
  onDragEnd: (key: string, x: number, y: number) => void;
  onTap: (node: GraphNode) => void;
}) {
  const key = nodeKey(node);
  const meta = TYPE_META[node.type];
  const posX = useSharedValue(x);
  const posY = useSharedValue(y);
  const startX = useSharedValue(x);
  const startY = useSharedValue(y);

  useEffect(() => {
    posX.value = x;
    posY.value = y;
  }, [x, y, posX, posY]);

  const pan = Gesture.Pan()
    .maxPointers(1)
    .onBegin(() => {
      startX.value = posX.value;
      startY.value = posY.value;
      activeNodeId.value = key;
    })
    .onUpdate((e) => {
      posX.value = startX.value + e.translationX / zoom.value;
      posY.value = startY.value + e.translationY / zoom.value;
      runOnJS(onDragLive)(key, posX.value, posY.value);
    })
    .onEnd(() => {
      runOnJS(onDragEnd)(key, posX.value, posY.value);
    })
    .onFinalize(() => {
      activeNodeId.value = null;
    })
    .simultaneousWithExternalGesture(panRef, pinchRef);

  const tap = Gesture.Tap()
    .maxDuration(250)
    .onEnd(() => {
      runOnJS(onTap)(node);
    });

  const gesture = Gesture.Race(pan, tap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: posX.value + WORLD_OFFSET - NODE_W / 2 },
      { translateY: posY.value + WORLD_OFFSET - CIRCLE_D / 2 },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.node, animatedStyle]}>
        <View
          style={[
            styles.nodeCircle,
            { backgroundColor: meta.color, borderColor: ringColor },
          ]}
        >
          <Ionicons name={meta.icon} size={13} color="#ffffff" />
        </View>
        <Text
          style={[styles.nodeLabel, { color: labelColor }]}
          numberOfLines={2}
        >
          {node.title || "Sem título"}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}
const GraphNodeView = React.memo(GraphNodeViewInner);

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function GraphScreen() {
  const colors = useColors();
  const router = useRouter();
  const { selectedId, setSelectedId, ready } = useWorkspace();

  const workspacesQuery = useListWorkspaces();
  const workspaces = workspacesQuery.data ?? [];

  useEffect(() => {
    if (ready && workspaces.length > 0) {
      const exists = workspaces.some((w) => w.id === selectedId);
      if (!exists) setSelectedId(workspaces[0].id);
    }
  }, [ready, workspaces, selectedId, setSelectedId]);

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === selectedId) ?? null,
    [workspaces, selectedId],
  );
  const workspaceId = activeWorkspace?.id ?? 0;
  const canEdit = activeWorkspace?.currentUserRole
    ? activeWorkspace.currentUserRole !== "viewer"
    : false;

  const graphQuery = useGetWorkspaceGraph(workspaceId, {
    query: {
      enabled: !!activeWorkspace,
      queryKey: getGetWorkspaceGraphQueryKey(workspaceId),
    },
  });

  const nodes = useMemo(() => graphQuery.data?.nodes ?? [], [graphQuery.data]);
  const edges = useMemo(() => graphQuery.data?.edges ?? [], [graphQuery.data]);

  // Signature covers both nodes AND edges so the force layout recomputes when
  // the graph topology changes (links added/removed between the same nodes).
  const sig = useMemo(() => {
    const nodeSig = nodes.map(nodeKey).sort().join("|");
    const edgeSig = edges
      .map((e) => `${e.sourceType}:${e.sourceId}->${e.targetType}:${e.targetId}`)
      .sort()
      .join("|");
    return `${nodeSig}##${edgeSig}`;
  }, [nodes, edges]);

  const layout = useMemo(() => computeLayout(nodes, edges), [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  // Committed positions (seeded from the layout, updated when a node is dropped)
  const [positions, setPositions] = useState<Record<string, Pos>>({});
  // Live positions while a node is being dragged (smooth edge tracking)
  const [live, setLive] = useState<Record<string, Pos>>({});
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    setPositions(layout);
    setLive({});
  }, [layout]);

  // --- Pan / zoom shared values -------------------------------------------
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const zoom = useSharedValue(1);
  const activeNodeId = useSharedValue<string | null>(null);
  const startPanX = useSharedValue(0);
  const startPanY = useSharedValue(0);
  const startZoom = useSharedValue(1);

  const panRef = useRef<GestureType | undefined>(undefined);
  const pinchRef = useRef<GestureType | undefined>(undefined);

  const applyFit = useCallback(
    (map: Record<string, Pos>, size: { width: number; height: number }) => {
      const keys = Object.keys(map);
      if (keys.length === 0 || size.width === 0 || size.height === 0) return;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const k of keys) {
        const p = map[k];
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
      const pad = 160;
      const contentW = Math.max(maxX - minX, 1);
      const contentH = Math.max(maxY - minY, 1);
      const raw = Math.min(
        (size.width - pad) / contentW,
        (size.height - pad) / contentH,
      );
      const fit = Math.max(ZOOM_MIN, Math.min(1, raw));
      const bcx = (minX + maxX) / 2;
      const bcy = (minY + maxY) / 2;
      zoom.value = fit;
      panX.value = size.width / 2 - fit * bcx;
      panY.value = size.height / 2 - fit * bcy;
    },
    [panX, panY, zoom],
  );

  // Auto-fit once whenever the graph (signature) changes and size is known.
  const centeredSig = useRef<string>("");
  useEffect(() => {
    if (!containerSize) return;
    if (centeredSig.current === sig) return;
    if (Object.keys(layout).length === 0) return;
    applyFit(layout, containerSize);
    centeredSig.current = sig;
  }, [layout, containerSize, sig, applyFit]);

  const zoomBy = useCallback(
    (factor: number) => {
      if (!containerSize) return;
      const cx = containerSize.width / 2;
      const cy = containerSize.height / 2;
      const nz = clampZoom(zoom.value * factor);
      const ratio = nz / zoom.value;
      panX.value = cx - (cx - panX.value) * ratio;
      panY.value = cy - (cy - panY.value) * ratio;
      zoom.value = nz;
    },
    [containerSize, panX, panY, zoom],
  );

  const recenter = useCallback(() => {
    if (containerSize) applyFit(positions, containerSize);
  }, [applyFit, positions, containerSize]);

  // --- Node drag callbacks (throttled live updates) ------------------------
  const lastLive = useRef(0);
  const handleDragLive = useCallback((key: string, x: number, y: number) => {
    const now = Date.now();
    if (now - lastLive.current < 24) return;
    lastLive.current = now;
    setLive((prev) => ({ ...prev, [key]: { x, y } }));
  }, []);

  const handleDragEnd = useCallback((key: string, x: number, y: number) => {
    setPositions((prev) => ({ ...prev, [key]: { x, y } }));
    setLive((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // --- Task viewer (no task route on mobile; open the shared editor sheet) --
  const [openTask, setOpenTask] = useState<{
    taskId: number;
    projectId: number;
  } | null>(null);

  const taskQuery = useGetTask(openTask?.taskId ?? 0, {
    query: {
      enabled: !!openTask,
      queryKey: getGetTaskQueryKey(openTask?.taskId ?? 0),
    },
  });
  const taskColumnsQuery = useListColumns(openTask?.projectId ?? 0, {
    query: {
      enabled: !!openTask,
      queryKey: getListColumnsQueryKey(openTask?.projectId ?? 0),
    },
  });
  const taskColumns: Column[] = taskColumnsQuery.data ?? [];

  const handleNodeTap = useCallback(
    (node: GraphNode) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      if (node.type === "note") {
        router.push(`/note/${node.id}`);
      } else if (node.type === "mindmap") {
        router.push(`/mindmap/${node.id}`);
      } else if (node.type === "task" && node.projectId != null) {
        setOpenTask({ taskId: node.id, projectId: node.projectId });
      }
    },
    [router],
  );

  // --- Gestures ------------------------------------------------------------
  const panGesture = Gesture.Pan()
    .withRef(panRef)
    .onBegin(() => {
      startPanX.value = panX.value;
      startPanY.value = panY.value;
    })
    .onUpdate((e) => {
      if (activeNodeId.value !== null) return;
      panX.value = startPanX.value + e.translationX;
      panY.value = startPanY.value + e.translationY;
    });

  const pinchGesture = Gesture.Pinch()
    .withRef(pinchRef)
    .onBegin(() => {
      startZoom.value = zoom.value;
      startPanX.value = panX.value;
      startPanY.value = panY.value;
    })
    .onUpdate((e) => {
      const nz = clampZoom(startZoom.value * e.scale);
      const ratio = nz / startZoom.value;
      panX.value = e.focalX - (e.focalX - startPanX.value) * ratio;
      panY.value = e.focalY - (e.focalY - startPanY.value) * ratio;
      zoom.value = nz;
    });

  const composed = Gesture.Simultaneous(pinchGesture, panGesture);

  const worldStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: panX.value },
      { translateY: panY.value },
      { scale: zoom.value },
    ],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerSize((prev) =>
      prev && prev.width === width && prev.height === height
        ? prev
        : { width, height },
    );
  };

  // --- Render --------------------------------------------------------------
  const headerRight = activeWorkspace ? (
    <IconButton
      name="refresh"
      onPress={() => graphQuery.refetch()}
      disabled={graphQuery.isFetching}
    />
  ) : undefined;

  let body: React.ReactNode;
  if (!activeWorkspace) {
    body = (
      <EmptyState
        icon="albums-outline"
        title="Selecione um workspace"
        subtitle="Escolha um workspace na aba inicial para ver o grafo."
      />
    );
  } else if (graphQuery.isLoading) {
    body = <LoadingView label="Carregando grafo..." />;
  } else if (graphQuery.isError) {
    body = (
      <ErrorView
        message="Não foi possível carregar o grafo de conhecimento."
        onRetry={() => graphQuery.refetch()}
      />
    );
  } else if (nodes.length === 0) {
    body = (
      <EmptyState
        icon="share-social-outline"
        title="Grafo vazio"
        subtitle="Crie notas e mapas mentais e conecte-os com links [[título]] para ver o grafo de conhecimento."
      />
    );
  } else {
    body = (
      <View style={styles.canvas} onLayout={onLayout}>
        <GestureDetector gesture={composed}>
          <Animated.View style={styles.catcher} collapsable={false}>
            <Animated.View style={[styles.world, worldStyle]}>
              <GraphEdges
                edges={edges}
                positions={positions}
                live={live}
                color={colors.mutedForeground}
              />
              {nodes.map((node) => {
                const key = nodeKey(node);
                const p = positions[key];
                if (!p) return null;
                return (
                  <GraphNodeView
                    key={key}
                    node={node}
                    x={p.x}
                    y={p.y}
                    zoom={zoom}
                    activeNodeId={activeNodeId}
                    panRef={panRef}
                    pinchRef={pinchRef}
                    ringColor={colors.background}
                    labelColor={colors.foreground}
                    onDragLive={handleDragLive}
                    onDragEnd={handleDragEnd}
                    onTap={handleNodeTap}
                  />
                );
              })}
            </Animated.View>
          </Animated.View>
        </GestureDetector>

        {/* Zoom / fit controls */}
        <View style={styles.controls} pointerEvents="box-none">
          <ControlButton icon="add" onPress={() => zoomBy(1.25)} colors={colors} />
          <ControlButton
            icon="remove"
            onPress={() => zoomBy(0.8)}
            colors={colors}
          />
          <ControlButton icon="scan" onPress={recenter} colors={colors} />
        </View>

        {/* Legend */}
        <View
          style={[
            styles.legend,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          pointerEvents="none"
        >
          {(Object.keys(TYPE_META) as NodeType[]).map((t) => (
            <View key={t} style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: TYPE_META[t].color }]}
              />
              <Text style={[styles.legendText, { color: colors.foreground }]}>
                {TYPE_META[t].label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="Grafo"
        subtitle={
          nodes.length > 0
            ? `${nodes.length} ${nodes.length === 1 ? "item" : "itens"} · ${edges.length} ${edges.length === 1 ? "conexão" : "conexões"}`
            : undefined
        }
        right={headerRight}
      />
      {body}

      {openTask ? (
        <TaskEditorSheet
          visible={!!taskQuery.data}
          mode="edit"
          projectId={openTask.projectId}
          workspaceId={workspaceId}
          columns={taskColumns}
          task={taskQuery.data ?? null}
          canEdit={canEdit}
          onClose={() => setOpenTask(null)}
        />
      ) : null}
    </View>
  );
}

function ControlButton({
  icon,
  onPress,
  colors,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.control,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={20} color={colors.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    overflow: "hidden",
  },
  catcher: {
    flex: 1,
  },
  world: {
    position: "absolute",
    left: -WORLD_OFFSET,
    top: -WORLD_OFFSET,
    width: WORLD_SIZE,
    height: WORLD_SIZE,
    transformOrigin: "50% 50%",
  },
  node: {
    position: "absolute",
    left: 0,
    top: 0,
    width: NODE_W,
    height: NODE_H,
    alignItems: "center",
  },
  nodeCircle: {
    width: CIRCLE_D,
    height: CIRCLE_D,
    borderRadius: CIRCLE_D / 2,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeLabel: {
    marginTop: 4,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
  },
  controls: {
    position: "absolute",
    top: 16,
    right: 16,
    gap: 8,
  },
  control: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  legend: {
    position: "absolute",
    left: 16,
    bottom: 16,
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
});
