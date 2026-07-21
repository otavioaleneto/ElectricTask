import React, { useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import {
  getGetProjectQueryKey,
  getGetWorkspaceSummaryQueryKey,
  getListColumnsQueryKey,
  getListProjectsQueryKey,
  getListTasksQueryKey,
  useCreateColumn,
  useDeleteColumn,
  useGetProject,
  useListColumns,
  useListTasks,
  useListWorkspaces,
  useMoveTask,
  type Column,
  type Task,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import {
  Button,
  EmptyState,
  ErrorView,
  Header,
  IconButton,
  LoadingView,
  useBottomInset,
} from "@/components/ui";
import { LabeledInput, SheetModal } from "@/components/forms";
import { TaskCard, TaskCardPreview } from "@/components/TaskCard";
import { TaskEditorSheet } from "@/components/TaskEditorSheet";

const COLUMN_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#64748b",
];

type EditorState = {
  mode: "create" | "edit";
  task?: Task | null;
  columnId?: number | null;
};

export default function ProjectBoardScreen() {
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const bottomInset = useBottomInset(8);
  const queryClient = useQueryClient();

  const params = useLocalSearchParams<{ id: string }>();
  const projectId = Number(params.id);

  const projectQuery = useGetProject(projectId, {
    query: {
      enabled: Number.isFinite(projectId),
      queryKey: getGetProjectQueryKey(projectId),
    },
  });
  const columnsQuery = useListColumns(projectId, {
    query: {
      enabled: Number.isFinite(projectId),
      queryKey: getListColumnsQueryKey(projectId),
    },
  });
  const tasksQuery = useListTasks(projectId, undefined, {
    query: {
      enabled: Number.isFinite(projectId),
      queryKey: getListTasksQueryKey(projectId),
    },
  });
  const workspacesQuery = useListWorkspaces();

  const tasksKey = getListTasksQueryKey(projectId);

  const workspaceId = projectQuery.data?.workspaceId ?? 0;
  const role = useMemo(
    () =>
      (workspacesQuery.data ?? []).find((w) => w.id === workspaceId)
        ?.currentUserRole,
    [workspacesQuery.data, workspaceId],
  );
  // Default to read-only until the role is known.
  const canEdit = role ? role !== "viewer" : false;

  const [movingId, setMovingId] = useState<number | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnColor, setNewColumnColor] = useState(COLUMN_COLORS[0]);

  // --- Drag-and-drop state -------------------------------------------------
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const [targetColumnId, setTargetColumnId] = useState<number | null>(null);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragActive = useSharedValue(0);
  const drag = useMemo(
    () => ({ x: dragX, y: dragY, active: dragActive }),
    [dragX, dragY, dragActive],
  );
  const columnRefs = React.useRef(new Map<number, View>());
  const cardRefs = React.useRef(new Map<number, View>());
  const dragSnapshotRef = React.useRef<{
    cols: { id: number; left: number; right: number }[];
    cards: Map<number, { id: number; centerY: number }[]>;
  } | null>(null);

  const registerColumnRef = React.useCallback(
    (id: number, node: View | null) => {
      if (node) columnRefs.current.set(id, node);
      else columnRefs.current.delete(id);
    },
    [],
  );
  const registerCardRef = React.useCallback(
    (id: number, node: View | null) => {
      if (node) cardRefs.current.set(id, node);
      else cardRefs.current.delete(id);
    },
    [],
  );

  const previewWidth = Math.min(width * 0.82, 360) - 12;
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: dragActive.value,
    transform: [
      { translateX: dragX.value - previewWidth / 2 },
      { translateY: dragY.value - 28 },
      { scale: 1.04 },
    ],
  }));

  const moveMutation = useMoveTask({
    mutation: {
      onMutate: async (vars: {
        taskId: number;
        data: { columnId: number; position: number };
      }) => {
        setMovingId(vars.taskId);
        await queryClient.cancelQueries({ queryKey: tasksKey });
        const prev = queryClient.getQueryData<Task[]>(tasksKey);
        if (prev) {
          queryClient.setQueryData<Task[]>(
            tasksKey,
            prev.map((t) =>
              t.id === vars.taskId
                ? { ...t, columnId: vars.data.columnId, position: vars.data.position }
                : t,
            ),
          );
        }
        return { prev };
      },
      onError: (_e, _vars, ctx) => {
        const context = ctx as { prev?: Task[] } | undefined;
        if (context?.prev) queryClient.setQueryData(tasksKey, context.prev);
      },
      onSettled: () => {
        setMovingId(null);
        queryClient.invalidateQueries({ queryKey: tasksKey });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      },
    },
  });

  const createColumnMutation = useCreateColumn({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListColumnsQueryKey(projectId) });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        setShowAddColumn(false);
        setNewColumnName("");
        setNewColumnColor(COLUMN_COLORS[0]);
      },
      onError: () => Alert.alert("Erro", "Não foi possível criar a coluna."),
    },
  });

  const deleteColumnMutation = useDeleteColumn({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListColumnsQueryKey(projectId) });
        queryClient.invalidateQueries({ queryKey: tasksKey });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        if (workspaceId > 0) {
          queryClient.invalidateQueries({
            queryKey: getListProjectsQueryKey(workspaceId),
          });
          queryClient.invalidateQueries({
            queryKey: getGetWorkspaceSummaryQueryKey(workspaceId),
          });
        }
      },
      onError: () => Alert.alert("Erro", "Não foi possível excluir a coluna."),
    },
  });

  const columns = useMemo<Column[]>(
    () => [...(columnsQuery.data ?? [])].sort((a, b) => a.position - b.position),
    [columnsQuery.data],
  );

  const tasksByColumn = useMemo(() => {
    const map = new Map<number, Task[]>();
    for (const c of columns) map.set(c.id, []);
    for (const t of tasksQuery.data ?? []) {
      if (!map.has(t.columnId)) map.set(t.columnId, []);
      map.get(t.columnId)!.push(t);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [columns, tasksQuery.data]);

  const moveToColumn = (task: Task, targetColumnId: number) => {
    if (task.columnId === targetColumnId) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    const targetCount = tasksByColumn.get(targetColumnId)?.length ?? 0;
    moveMutation.mutate({
      taskId: task.id,
      data: { columnId: targetColumnId, position: targetCount },
    });
  };

  const moveByOffset = (task: Task, offset: number) => {
    const idx = columns.findIndex((c) => c.id === task.columnId);
    const target = columns[idx + offset];
    if (target) moveToColumn(task, target.id);
  };

  // Capture every column's and card's on-screen rectangle so the drag can
  // hit-test against fixed positions (the board cannot scroll while dragging).
  const buildDragSnapshot = React.useCallback(() => {
    const taskColumn = new Map<number, number>();
    for (const [colId, list] of tasksByColumn) {
      for (const t of list) taskColumn.set(t.id, colId);
    }

    const cols: { id: number; left: number; right: number }[] = [];
    const cards = new Map<number, { id: number; centerY: number }[]>();
    const jobs: Promise<void>[] = [];

    columnRefs.current.forEach((node, id) => {
      jobs.push(
        new Promise<void>((resolve) => {
          node.measureInWindow((x, _y, w) => {
            cols.push({ id, left: x, right: x + w });
            resolve();
          });
        }),
      );
    });

    cardRefs.current.forEach((node, id) => {
      const colId = taskColumn.get(id);
      if (colId == null) return;
      jobs.push(
        new Promise<void>((resolve) => {
          node.measureInWindow((_x, y, _w, h) => {
            const arr = cards.get(colId) ?? [];
            arr.push({ id, centerY: y + h / 2 });
            cards.set(colId, arr);
            resolve();
          });
        }),
      );
    });

    Promise.all(jobs).then(() => {
      for (const arr of cards.values()) arr.sort((a, b) => a.centerY - b.centerY);
      dragSnapshotRef.current = { cols, cards };
    });
  }, [tasksByColumn]);

  const handleDragStart = React.useCallback(
    (task: Task) => {
      setDraggingTask(task);
      setTargetColumnId(task.columnId);
      buildDragSnapshot();
    },
    [buildDragSnapshot],
  );

  const columnAt = React.useCallback((absX: number) => {
    const snap = dragSnapshotRef.current;
    if (!snap) return null;
    return snap.cols.find((c) => absX >= c.left && absX <= c.right) ?? null;
  }, []);

  const handleDragMove = React.useCallback(
    (absX: number, _absY: number) => {
      const col = columnAt(absX);
      const id = col?.id ?? null;
      setTargetColumnId((prev) => (prev === id ? prev : id));
    },
    [columnAt],
  );

  const handleDragDrop = React.useCallback(
    (absX: number, absY: number) => {
      const snap = dragSnapshotRef.current;
      const task = draggingTask;
      setDraggingTask(null);
      setTargetColumnId(null);
      if (!snap || !task) return;

      const col = snap.cols.find((c) => absX >= c.left && absX <= c.right);
      if (!col) return; // released outside any column → cancel

      const others = (snap.cards.get(col.id) ?? []).filter((c) => c.id !== task.id);
      const index = others.filter((c) => c.centerY < absY).length;

      const currentList = tasksByColumn.get(task.columnId) ?? [];
      const currentIndex = currentList.findIndex((t) => t.id === task.id);
      if (col.id === task.columnId && index === currentIndex) return; // no-op

      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      moveMutation.mutate({
        taskId: task.id,
        data: { columnId: col.id, position: index },
      });
    },
    [draggingTask, tasksByColumn, moveMutation],
  );

  const addColumn = () => {
    const name = newColumnName.trim();
    if (!name) return;
    createColumnMutation.mutate({
      projectId,
      data: { name, color: newColumnColor, position: columns.length },
    });
  };

  const confirmDeleteColumn = (column: Column) => {
    const count = tasksByColumn.get(column.id)?.length ?? 0;
    const detail =
      count > 0
        ? `A coluna "${column.name}" e suas ${count} tarefa(s) serão removidas.`
        : `A coluna "${column.name}" será removida.`;
    Alert.alert("Excluir coluna", detail, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => deleteColumnMutation.mutate({ columnId: column.id }),
      },
    ]);
  };

  const isLoading =
    projectQuery.isLoading || columnsQuery.isLoading || tasksQuery.isLoading;
  const isError =
    projectQuery.isError || columnsQuery.isError || tasksQuery.isError;

  const backButton = (
    <IconButton name="chevron-back" onPress={() => router.back()} />
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Quadro" left={backButton} />
        <LoadingView />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Quadro" left={backButton} />
        <ErrorView
          message="Não foi possível carregar este quadro."
          onRetry={() => {
            projectQuery.refetch();
            columnsQuery.refetch();
            tasksQuery.refetch();
          }}
        />
      </View>
    );
  }

  const columnWidth = Math.min(width * 0.82, 360);
  const taskCount = tasksQuery.data?.length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title={projectQuery.data?.name ?? "Quadro"}
        subtitle={`${taskCount} ${taskCount === 1 ? "tarefa" : "tarefas"}`}
        left={backButton}
        right={
          canEdit && columns.length > 0 ? (
            <IconButton
              name="add"
              onPress={() =>
                setEditor({ mode: "create", columnId: columns[0].id })
              }
              testID="add-task-header"
            />
          ) : undefined
        }
      />

      {columns.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="grid-outline"
            title="Sem colunas"
            subtitle={
              canEdit
                ? "Crie a primeira coluna para começar a adicionar tarefas."
                : "Este projeto ainda não tem colunas."
            }
          />
          {canEdit ? (
            <View style={styles.emptyAction}>
              <Button
                label="Criar coluna"
                icon="add"
                onPress={() => setShowAddColumn(true)}
                testID="create-first-column"
              />
            </View>
          ) : null}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.boardRow}
          decelerationRate="fast"
          snapToInterval={columnWidth + 14}
          scrollEnabled={!draggingTask}
        >
          {columns.map((column, colIndex) => {
            const colTasks = tasksByColumn.get(column.id) ?? [];
            const isTarget =
              !!draggingTask && targetColumnId === column.id;
            return (
              <View
                key={column.id}
                ref={(node) => registerColumnRef(column.id, node)}
                collapsable={false}
                style={[
                  styles.column,
                  { width: columnWidth },
                  isTarget && {
                    backgroundColor: colors.secondary,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <View style={styles.columnHeader}>
                  <View style={styles.columnHeaderLeft}>
                    <View
                      style={[
                        styles.colDot,
                        { backgroundColor: column.color || colors.primary },
                      ]}
                    />
                    <Text
                      numberOfLines={1}
                      style={[styles.columnTitle, { color: colors.foreground }]}
                    >
                      {column.name}
                    </Text>
                  </View>
                  <View style={styles.columnHeaderRight}>
                    <View
                      style={[styles.countPill, { backgroundColor: colors.secondary }]}
                    >
                      <Text style={[styles.countText, { color: colors.mutedForeground }]}>
                        {colTasks.length}
                      </Text>
                    </View>
                    {canEdit ? (
                      <IconButton
                        name="trash-outline"
                        size={18}
                        color={colors.mutedForeground}
                        onPress={() => confirmDeleteColumn(column)}
                        testID={`delete-column-${column.id}`}
                      />
                    ) : null}
                  </View>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: bottomInset }}
                  scrollEnabled={!draggingTask}
                >
                  {colTasks.length === 0 ? (
                    <View
                      style={[
                        styles.columnEmpty,
                        { borderColor: colors.border, borderRadius: colors.radius },
                      ]}
                    >
                      <Text style={[styles.columnEmptyText, { color: colors.mutedForeground }]}>
                        Sem tarefas
                      </Text>
                    </View>
                  ) : (
                    colTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isFirst={colIndex === 0}
                        isLast={colIndex === columns.length - 1}
                        busy={movingId === task.id}
                        canEdit={canEdit}
                        canDrag={canEdit && columns.length > 1}
                        drag={drag}
                        isDragging={draggingTask?.id === task.id}
                        registerRef={(node) => registerCardRef(task.id, node)}
                        onPress={() => setEditor({ mode: "edit", task })}
                        onMoveLeft={() => moveByOffset(task, -1)}
                        onMoveRight={() => moveByOffset(task, 1)}
                        onDragStart={handleDragStart}
                        onDragMove={handleDragMove}
                        onDragDrop={handleDragDrop}
                      />
                    ))
                  )}

                  {canEdit ? (
                    <Pressable
                      onPress={() =>
                        setEditor({ mode: "create", columnId: column.id })
                      }
                      style={[
                        styles.addTaskBtn,
                        { borderColor: colors.border, borderRadius: colors.radius },
                      ]}
                      testID={`add-task-${column.id}`}
                    >
                      <Ionicons name="add" size={18} color={colors.primary} />
                      <Text style={[styles.addTaskText, { color: colors.primary }]}>
                        Tarefa
                      </Text>
                    </Pressable>
                  ) : null}
                </ScrollView>
              </View>
            );
          })}

          {canEdit ? (
            <Pressable
              onPress={() => setShowAddColumn(true)}
              style={[
                styles.ghostColumn,
                {
                  width: columnWidth * 0.6,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
              testID="add-column"
            >
              <Ionicons name="add" size={22} color={colors.mutedForeground} />
              <Text style={[styles.ghostColumnText, { color: colors.mutedForeground }]}>
                Nova coluna
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}

      {draggingTask ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.dragOverlay, overlayStyle]}
        >
          <TaskCardPreview task={draggingTask} width={previewWidth} />
        </Animated.View>
      ) : null}

      <TaskEditorSheet
        visible={!!editor}
        mode={editor?.mode ?? "edit"}
        projectId={projectId}
        workspaceId={workspaceId}
        columns={columns}
        task={editor?.task ?? null}
        defaultColumnId={editor?.columnId ?? null}
        canEdit={canEdit}
        onClose={() => setEditor(null)}
      />

      <SheetModal
        visible={showAddColumn}
        onClose={() => setShowAddColumn(false)}
        title="Nova coluna"
        footer={
          <Button
            label="Criar coluna"
            icon="checkmark"
            onPress={addColumn}
            loading={createColumnMutation.isPending}
            disabled={!newColumnName.trim() || createColumnMutation.isPending}
            testID="column-save"
          />
        }
      >
        <LabeledInput
          label="Nome"
          value={newColumnName}
          onChangeText={setNewColumnName}
          placeholder="Ex.: A fazer"
          autoFocus
          testID="column-name"
        />
        <Text style={[styles.swatchLabel, { color: colors.mutedForeground }]}>
          Cor
        </Text>
        <View style={styles.swatchRow}>
          {COLUMN_COLORS.map((c) => {
            const active = c === newColumnColor;
            return (
              <Pressable
                key={c}
                onPress={() => setNewColumnColor(c)}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: c,
                    borderColor: active ? colors.foreground : "transparent",
                  },
                ]}
              >
                {active ? (
                  <Ionicons name="checkmark" size={16} color="#ffffff" />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  dragOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 1000,
  },
  boardRow: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
  },
  column: {
    flex: 1,
  },
  columnHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  columnHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  columnHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  colDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  columnTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    flexShrink: 1,
  },
  countPill: {
    minWidth: 26,
    height: 22,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  countText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  columnEmpty: {
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
    paddingVertical: 28,
    alignItems: "center",
  },
  columnEmptyText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  addTaskBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
    paddingVertical: 12,
    marginTop: 10,
  },
  addTaskText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  ghostColumn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
    marginTop: 4,
    paddingVertical: 40,
  },
  ghostColumnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  emptyWrap: {
    flex: 1,
  },
  emptyAction: {
    paddingHorizontal: 40,
    marginTop: -20,
    marginBottom: 60,
  },
  swatchLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    marginBottom: 8,
  },
  swatchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  swatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
});
