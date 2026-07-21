import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import {
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useReducedMotion, useSharedValue } from "react-native-reanimated";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMindmapQueryKey,
  getGetTaskQueryKey,
  getListColumnsQueryKey,
  getListMindmapsQueryKey,
  getListProjectsQueryKey,
  useGetMindmap,
  useGetTask,
  useListColumns,
  useListMindmaps,
  useListProjects,
  useListWorkspaces,
  useUpdateMindmap,
  type Column,
  type Mindmap,
  type MindmapArea,
  type MindmapEdge,
  type MindmapElement,
  type MindmapNode,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { useEnergyPref } from "@/hooks/useEnergyPref";
import {
  Button,
  ErrorView,
  Header,
  IconButton,
  LoadingView,
} from "@/components/ui";
import { TaskEditorSheet } from "@/components/TaskEditorSheet";
import {
  MindmapCanvas,
  type ConnectSignal,
} from "@/components/mindmap/MindmapCanvas";
import {
  AddNodeSheet,
  NodeEditorSheet,
  type AddNodeSpec,
} from "@/components/mindmap/sheets";
import { clampZoom, genId, type NodeType } from "@/components/mindmap/shared";

type Connect = { source: string; directed: boolean };

export default function MindmapDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mindmapId = Number(id);
  const validId = Number.isFinite(mindmapId) && mindmapId > 0;

  const mindmapQuery = useGetMindmap(mindmapId, {
    query: {
      enabled: validId,
      queryKey: getGetMindmapQueryKey(mindmapId),
    },
  });
  const mindmap = mindmapQuery.data ?? null;
  const workspaceId = mindmap?.workspaceId ?? 0;

  const projectsQuery = useListProjects(workspaceId, {
    query: {
      enabled: !!mindmap,
      queryKey: getListProjectsQueryKey(workspaceId),
    },
  });
  const mindmapsQuery = useListMindmaps(workspaceId, {
    query: {
      enabled: !!mindmap,
      queryKey: getListMindmapsQueryKey(workspaceId),
    },
  });

  const updateMutation = useUpdateMindmap();

  const [nodes, setNodes] = useState<MindmapNode[]>([]);
  const [edges, setEdges] = useState<MindmapEdge[]>([]);
  const [areas, setAreas] = useState<MindmapArea[]>([]);
  const [elements, setElements] = useState<MindmapElement[]>([]);
  const [dirty, setDirty] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [connect, setConnect] = useState<Connect | null>(null);
  const [connectSignal, setConnectSignal] = useState<ConnectSignal>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [openTask, setOpenTask] = useState<{
    taskId: number;
    projectId: number;
  } | null>(null);

  const workspacesQuery = useListWorkspaces();
  const role = useMemo(
    () =>
      (workspacesQuery.data ?? []).find((w) => w.id === workspaceId)
        ?.currentUserRole,
    [workspacesQuery.data, workspaceId],
  );
  const canEdit = role ? role !== "viewer" : false;

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
  const taskColumns = useMemo<Column[]>(
    () =>
      [...(taskColumnsQuery.data ?? [])].sort((a, b) => a.position - b.position),
    [taskColumnsQuery.data],
  );

  // Energy effects: user toggle (persisted) combined with the system's
  // reduce-motion setting -- reduce-motion always wins.
  const reducedMotion = useReducedMotion();
  const [energyOn, toggleEnergy] = useEnergyPref();
  const effectsOn = energyOn && !reducedMotion;
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const zoom = useSharedValue(1);
  const activeNodeId = useSharedValue<string | null>(null);

  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const seededRef = useRef(false);
  const fittedRef = useRef(false);
  // Bumped on every edit; save() only clears the dirty flag when the
  // generation is unchanged, so edits made during an in-flight save are kept.
  const editGenRef = useRef(0);

  const markDirty = useCallback(() => {
    editGenRef.current += 1;
    dirtyRef.current = true;
    setDirty(true);
  }, []);

  // Seed local state once from the loaded map; local state is the source of
  // truth afterward so background refetches never clobber edits in progress.
  useEffect(() => {
    if (mindmap && !seededRef.current) {
      setNodes(mindmap.data?.nodes ?? []);
      setEdges(mindmap.data?.edges ?? []);
      setAreas(mindmap.data?.areas ?? []);
      setElements(mindmap.data?.elements ?? []);
      seededRef.current = true;
    }
  }, [mindmap]);

  const fitView = useCallback(
    (list: MindmapNode[]) => {
      const { width, height } = canvasSize;
      if (!width || !height) return;
      if (list.length === 0) {
        panX.value = width / 2;
        panY.value = height / 2;
        zoom.value = 1;
        return;
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const n of list) {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + 150);
        maxY = Math.max(maxY, n.y + 60);
      }
      const pad = 80;
      const cw = Math.max(1, maxX - minX);
      const ch = Math.max(1, maxY - minY);
      const z = clampZoom(
        Math.min((width - pad) / cw, (height - pad) / ch, 1),
      );
      zoom.value = z;
      panX.value = width / 2 - z * (minX + cw / 2);
      panY.value = height / 2 - z * (minY + ch / 2);
    },
    [canvasSize, panX, panY, zoom],
  );

  // Fit the viewport to content once, after both data and layout are ready.
  useEffect(() => {
    if (seededRef.current && !fittedRef.current && canvasSize.width > 0) {
      fitView(nodes);
      fittedRef.current = true;
    }
  }, [nodes, canvasSize, fitView]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!mindmap) return false;
    savingRef.current = true;
    const data = { nodes, edges, areas, elements };
    const gen = editGenRef.current;
    try {
      await updateMutation.mutateAsync({ mindmapId, data: { data } });
      queryClient.setQueryData<Mindmap | undefined>(
        getGetMindmapQueryKey(mindmapId),
        (prev) => (prev ? { ...prev, data } : prev),
      );
      queryClient.invalidateQueries({
        queryKey: getGetMindmapQueryKey(mindmapId),
      });
      queryClient.invalidateQueries({
        queryKey: getListMindmapsQueryKey(mindmap.workspaceId),
      });
      // Only clear dirty if nothing was edited while the save was in flight.
      if (editGenRef.current === gen) {
        dirtyRef.current = false;
        setDirty(false);
      }
      return true;
    } catch {
      Alert.alert("Erro", "Não foi possível salvar o mapa mental.");
      return false;
    } finally {
      savingRef.current = false;
    }
  }, [mindmap, nodes, edges, areas, elements, mindmapId, queryClient, updateMutation]);

  const saveRef = useRef(save);
  saveRef.current = save;

  // Unsaved-changes guard for back / swipe / hardware-back.
  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (e: any) => {
      if (!dirtyRef.current || savingRef.current) return;
      e.preventDefault();
      Alert.alert(
        "Alterações não salvas",
        "Deseja salvar antes de sair?",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Descartar",
            style: "destructive",
            onPress: () => {
              dirtyRef.current = false;
              navigation.dispatch(e.data.action);
            },
          },
          {
            text: "Salvar",
            onPress: async () => {
              const ok = await saveRef.current();
              if (ok) navigation.dispatch(e.data.action);
            },
          },
        ],
      );
    });
    return unsub;
  }, [navigation]);

  const spawnPos = useCallback(
    (type: NodeType) => {
      const w = canvasSize.width || 360;
      const h = canvasSize.height || 640;
      const half =
        type === "hotspot"
          ? { w: 16, h: 16 }
          : type === "light"
            ? { w: 20, h: 20 }
            : type === "label"
            ? { w: 40, h: 12 }
            : { w: 75, h: 24 };
      const jitter = () => (Math.random() - 0.5) * 40;
      const cx = (w / 2 - panX.value) / zoom.value;
      const cy = (h / 2 - panY.value) / zoom.value;
      return { x: cx - half.w + jitter(), y: cy - half.h + jitter() };
    },
    [canvasSize, panX, panY, zoom],
  );

  const addNode = useCallback(
    (spec: AddNodeSpec) => {
      const pos = spawnPos(spec.type);
      const base = { id: genId("n"), x: pos.x, y: pos.y };
      let node: MindmapNode;
      switch (spec.type) {
        case "project":
          node = {
            ...base,
            type: "project",
            label: spec.label,
            color: spec.color,
            projectId: spec.projectId,
          };
          break;
        case "task":
          node = {
            ...base,
            type: "task",
            label: spec.label,
            taskId: spec.taskId,
            projectId: spec.projectId,
          };
          break;
        case "mindmap":
          node = {
            ...base,
            type: "mindmap",
            label: spec.label,
            mindmapId: spec.mindmapId,
          };
          break;
        case "label":
          node = { ...base, type: "label", label: "Novo rótulo" };
          break;
        case "hotspot":
          node = { ...base, type: "hotspot", label: "" };
          break;
        case "light":
          node = {
            ...base,
            type: "light",
            label: "Ponto de luz",
            color: "#3b82f6",
          };
          break;
        default:
          node = { ...base, type: "text", label: "Novo nó" };
      }
      setNodes((prev) => [...prev, node]);
      markDirty();
    },
    [spawnPos, markDirty],
  );

  const commitDrag = useCallback(
    (nodeId: string, x: number, y: number) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, x, y } : n)),
      );
      markDirty();
    },
    [markDirty],
  );

  const applyNodePatch = useCallback(
    (
      nodeId: string,
      patch: { label: string; color: string | null; details?: string | null },
    ) => {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n;
          const next: MindmapNode = { ...n, label: patch.label, color: patch.color };
          if ("details" in patch) next.details = patch.details;
          return next;
        }),
      );
      markDirty();
    },
    [markDirty],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
      setEdges((prev) =>
        prev.filter((e) => e.source !== nodeId && e.target !== nodeId),
      );
      setEditingNodeId(null);
      markDirty();
    },
    [markDirty],
  );

  const removeEdge = useCallback(
    (edgeId: string) => {
      setEdges((prev) => prev.filter((e) => e.id !== edgeId));
      markDirty();
    },
    [markDirty],
  );

  const startConnect = useCallback((sourceId: string, directed: boolean) => {
    setEditingNodeId(null);
    setConnect({ source: sourceId, directed });
  }, []);

  const completeConnect = useCallback(
    (target: MindmapNode) => {
      if (!connect) return;
      if (target.id === connect.source) {
        setConnect(null);
        return;
      }
      const exists = edges.some(
        (e) =>
          (e.source === connect.source && e.target === target.id) ||
          (e.source === target.id && e.target === connect.source),
      );
      if (!exists) {
        const edge = {
          id: genId("e"),
          source: connect.source,
          target: target.id,
          directed: connect.directed,
        };
        setEdges((prev) => [...prev, edge]);
        markDirty();
        if (effectsOn) {
          setConnectSignal({
            edgeId: edge.id,
            targetId: target.id,
            nonce: Date.now(),
          });
        }
      }
      setConnect(null);
    },
    [connect, edges, markDirty, effectsOn],
  );

  const openLink = useCallback(
    async (node: MindmapNode) => {
      if (node.type === "mindmap" && node.mindmapId) {
        if (dirtyRef.current) {
          const ok = await save();
          if (!ok) return;
        }
        router.push(`/mindmap/${node.mindmapId}`);
        return;
      }
      if (node.type === "task" && node.taskId && node.projectId) {
        setOpenTask({ taskId: node.taskId, projectId: node.projectId });
        return;
      }
      if (node.type === "project" && node.projectId) {
        router.push(`/project/${node.projectId}`);
      }
    },
    [router, save],
  );

  const onNodeTap = useCallback(
    (node: MindmapNode) => {
      if (connect) {
        completeConnect(node);
        return;
      }
      if (
        node.type === "project" ||
        node.type === "task" ||
        node.type === "mindmap"
      ) {
        void openLink(node);
        return;
      }
      setEditingNodeId(node.id);
    },
    [connect, completeConnect, openLink],
  );

  const onNodeLongPress = useCallback((node: MindmapNode) => {
    setEditingNodeId(node.id);
  }, []);

  const zoomBy = useCallback(
    (factor: number) => {
      const nz = clampZoom(zoom.value * factor);
      const cx = (canvasSize.width || 360) / 2;
      const cy = (canvasSize.height || 640) / 2;
      const ratio = nz / zoom.value;
      panX.value = cx - (cx - panX.value) * ratio;
      panY.value = cy - (cy - panY.value) * ratio;
      zoom.value = nz;
    },
    [canvasSize, panX, panY, zoom],
  );

  const editingNode = useMemo(
    () => nodes.find((n) => n.id === editingNodeId) ?? null,
    [nodes, editingNodeId],
  );

  if (!validId) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header
          title="Mapa mental"
          left={<IconButton name="chevron-back" onPress={() => router.back()} />}
        />
        <ErrorView message="Mapa mental inválido." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title={mindmap?.name ?? "Mapa mental"}
        subtitle={mindmap ? `${nodes.length} nós` : undefined}
        left={
          <IconButton name="chevron-back" onPress={() => navigation.goBack()} />
        }
        right={
          <IconButton
            name="save-outline"
            onPress={() => void save()}
            disabled={!dirty || updateMutation.isPending}
            color={dirty ? colors.primary : colors.mutedForeground}
          />
        }
      />

      {mindmapQuery.isLoading ? (
        <LoadingView label="Carregando mapa..." />
      ) : mindmapQuery.isError || !mindmap ? (
        <ErrorView
          message="Não foi possível carregar o mapa mental."
          onRetry={() => mindmapQuery.refetch()}
        />
      ) : (
        <View style={styles.canvasWrap}>
          <MindmapCanvas
            nodes={nodes}
            edges={edges}
            elements={elements}
            panX={panX}
            panY={panY}
            zoom={zoom}
            activeNodeId={activeNodeId}
            connectSourceId={connect?.source ?? null}
            connectSignal={connectSignal}
            effectsOn={effectsOn}
            onNodeDragEnd={commitDrag}
            onNodeTap={onNodeTap}
            onNodeLongPress={onNodeLongPress}
            onLayoutSize={setCanvasSize}
          />

          {connect ? (
            <View
              style={[
                styles.banner,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name="git-network-outline"
                size={18}
                color={colors.primary}
              />
              <Text
                style={[styles.bannerText, { color: colors.foreground }]}
                numberOfLines={1}
              >
                Toque em outro nó para conectar
              </Text>
              <Pressable hitSlop={8} onPress={() => setConnect(null)}>
                <Text style={[styles.bannerCancel, { color: colors.primary }]}>
                  Cancelar
                </Text>
              </Pressable>
            </View>
          ) : null}

          {nodes.length === 0 && elements.length === 0 ? (
            <View pointerEvents="none" style={styles.hint}>
              <Ionicons
                name="add-circle-outline"
                size={40}
                color={colors.mutedForeground}
              />
              <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                Toque em + para adicionar seu primeiro nó
              </Text>
            </View>
          ) : null}

          <View style={styles.zoomControls}>
            <ZoomButton icon="remove" onPress={() => zoomBy(0.8)} />
            <ZoomButton icon="add" onPress={() => zoomBy(1.25)} />
            <ZoomButton icon="scan-outline" onPress={() => fitView(nodes)} />
            <ZoomButton
              icon={energyOn ? "flash" : "flash-off-outline"}
              color={energyOn ? colors.primary : undefined}
              onPress={toggleEnergy}
              accessibilityLabel={
                energyOn
                  ? "Desativar efeitos de energia"
                  : "Ativar efeitos de energia"
              }
              testID="button-toggle-energy"
            />
          </View>

          <Pressable
            onPress={() => setShowAdd(true)}
            style={[styles.fab, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="add" size={28} color={colors.primaryForeground} />
          </Pressable>
        </View>
      )}

      <AddNodeSheet
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        projects={projectsQuery.data ?? []}
        mindmaps={mindmapsQuery.data ?? []}
        currentMindmapId={mindmapId}
        onAdd={addNode}
      />

      <NodeEditorSheet
        node={editingNode}
        nodes={nodes}
        edges={edges}
        onClose={() => setEditingNodeId(null)}
        onApply={applyNodePatch}
        onDelete={deleteNode}
        onStartConnect={startConnect}
        onRemoveEdge={removeEdge}
        onOpenLink={(node) => void openLink(node)}
      />

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

function ZoomButton({
  icon,
  onPress,
  color,
  accessibilityLabel,
  testID,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  color?: string;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[
        styles.zoomButton,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Ionicons name={icon} size={20} color={color ?? colors.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  canvasWrap: {
    flex: 1,
  },
  banner: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    ...(Platform.OS === "web"
      ? {}
      : {
          shadowColor: "#000",
          shadowOpacity: 0.15,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }),
  },
  bannerText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  bannerCancel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  hint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 40,
  },
  hintText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
  },
  zoomControls: {
    position: "absolute",
    left: 16,
    bottom: 24,
    gap: 10,
  },
  zoomButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
