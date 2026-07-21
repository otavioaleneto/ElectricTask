import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetProjectQueryKey,
  getGetTaskQueryKey,
  getGetWorkspaceSummaryQueryKey,
  getListProjectsQueryKey,
  getListTasksQueryKey,
  getListWorkspaceMembersQueryKey,
  useCreateTask,
  useDeleteTask,
  useListWorkspaceMembers,
  useUpdateTask,
  type Column,
  type Task,
  type TaskType,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui";
import {
  DateField,
  FieldLabel,
  LabeledInput,
  Segmented,
  SelectField,
  SheetModal,
  type SelectOption,
} from "@/components/forms";
import { ChecklistEditor } from "@/components/ChecklistEditor";
import { RichTextEditor } from "@/components/RichTextEditor";
import { TaskActivity } from "@/components/TaskActivity";
import { TaskAttachments } from "@/components/TaskAttachments";
import { TaskTimer } from "@/components/TaskTimer";
import { TaskVideoLinks } from "@/components/TaskVideoLinks";

type Priority = "low" | "medium" | "high";

const TYPE_OPTIONS: { label: string; value: TaskType }[] = [
  { label: "Padrão", value: "standard" },
  { label: "Vídeo", value: "video" },
];

const PRIORITY_OPTIONS: { label: string; value: Priority }[] = [
  { label: "Baixa", value: "low" },
  { label: "Média", value: "medium" },
  { label: "Alta", value: "high" },
];

const NONE = "none";

function asPriority(p: string | null | undefined): Priority {
  return p === "low" || p === "high" ? p : "medium";
}

export function TaskEditorSheet({
  visible,
  mode,
  projectId,
  workspaceId,
  columns,
  task,
  defaultColumnId,
  canEdit,
  onClose,
}: {
  visible: boolean;
  mode: "create" | "edit";
  projectId: number;
  workspaceId: number;
  columns: Column[];
  task?: Task | null;
  defaultColumnId?: number | null;
  canEdit: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const queryClient = useQueryClient();

  const membersQuery = useListWorkspaceMembers(workspaceId, {
    query: {
      enabled: visible && workspaceId > 0,
      queryKey: getListWorkspaceMembersQueryKey(workspaceId),
    },
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [columnId, setColumnId] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const [taskType, setTaskType] = useState<TaskType>("standard");
  const [initial, setInitial] = useState("");

  const snapshot = (s: {
    title: string;
    description: string;
    priority: Priority;
    dueDate: string | null;
    assigneeId: number | null;
    columnId: number | null;
  }) => JSON.stringify(s);

  useEffect(() => {
    if (!visible) return;
    if (mode === "edit" && task) {
      const next = {
        title: task.title,
        description: task.description ?? "",
        priority: asPriority(task.priority),
        dueDate: task.dueDate ? task.dueDate.slice(0, 10) : null,
        assigneeId: task.assigneeId ?? null,
        columnId: task.columnId,
      };
      setTitle(next.title);
      setDescription(next.description);
      setPriority(next.priority);
      setDueDate(next.dueDate);
      setAssigneeId(next.assigneeId);
      setColumnId(next.columnId);
      setCompleted(!!task.completed);
      setTaskType(task.type === "video" ? "video" : "standard");
      setInitial(snapshot(next));
    } else {
      const next = {
        title: "",
        description: "",
        priority: "medium" as Priority,
        dueDate: null,
        assigneeId: null,
        columnId: defaultColumnId ?? columns[0]?.id ?? null,
      };
      setTitle(next.title);
      setDescription(next.description);
      setPriority(next.priority);
      setDueDate(next.dueDate);
      setAssigneeId(next.assigneeId);
      setColumnId(next.columnId);
      setCompleted(false);
      setTaskType("standard");
      setInitial(snapshot(next));
    }
  }, [visible, mode, task, defaultColumnId, columns]);

  const dirty =
    initial !==
    snapshot({ title, description, priority, dueDate, assigneeId, columnId });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(projectId) });
    queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
    if (workspaceId > 0) {
      queryClient.invalidateQueries({
        queryKey: getListProjectsQueryKey(workspaceId),
      });
      queryClient.invalidateQueries({
        queryKey: getGetWorkspaceSummaryQueryKey(workspaceId),
      });
    }
    if (task) {
      queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(task.id) });
    }
  };

  const createMutation = useCreateTask({
    mutation: {
      onSuccess: () => {
        refresh();
        onClose();
      },
      onError: () =>
        Alert.alert("Erro", "Não foi possível criar a tarefa."),
    },
  });
  const updateMutation = useUpdateTask({
    mutation: {
      onSuccess: () => {
        refresh();
        onClose();
      },
      onError: () =>
        Alert.alert("Erro", "Não foi possível salvar a tarefa."),
    },
  });
  const completeMutation = useUpdateTask({
    mutation: { onSettled: refresh },
  });
  const typeMutation = useUpdateTask({
    mutation: { onSettled: refresh },
  });
  const deleteMutation = useDeleteTask({
    mutation: {
      onSuccess: () => {
        refresh();
        onClose();
      },
      onError: () =>
        Alert.alert("Erro", "Não foi possível excluir a tarefa."),
    },
  });

  const saving =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  const memberOptions = useMemo<SelectOption[]>(() => {
    const opts: SelectOption[] = [
      { value: NONE, label: "Ninguém", avatarName: "?" },
    ];
    for (const m of membersQuery.data ?? []) {
      opts.push({
        value: String(m.userId),
        label: m.name,
        avatarName: m.name,
        avatarUri: m.avatarUrl,
      });
    }
    return opts;
  }, [membersQuery.data]);

  const columnOptions = useMemo<SelectOption[]>(
    () =>
      [...columns]
        .sort((a, b) => a.position - b.position)
        .map((c) => ({
          value: String(c.id),
          label: c.name,
          color: c.color || colors.primary,
        })),
    [columns, colors.primary],
  );

  const handleClose = () => {
    if (canEdit && dirty && !saving) {
      Alert.alert(
        "Descartar alterações?",
        "Suas alterações não foram salvas.",
        [
          { text: "Continuar editando", style: "cancel" },
          { text: "Descartar", style: "destructive", onPress: onClose },
        ],
      );
      return;
    }
    onClose();
  };

  const save = () => {
    const trimmed = title.trim();
    if (!trimmed || !columnId) return;
    if (mode === "create") {
      createMutation.mutate({
        projectId,
        data: {
          title: trimmed,
          columnId,
          description: description.trim() || undefined,
          priority,
          type: taskType,
          dueDate: dueDate || undefined,
          assigneeId: assigneeId ?? undefined,
        },
      });
    } else if (task) {
      updateMutation.mutate({
        taskId: task.id,
        data: {
          title: trimmed,
          description: description.trim() ? description.trim() : null,
          priority,
          dueDate: dueDate ?? null,
          assigneeId,
          columnId,
        },
      });
    }
  };

  const toggleCompleted = () => {
    if (!task) return;
    const next = !completed;
    setCompleted(next);
    completeMutation.mutate({ taskId: task.id, data: { completed: next } });
  };

  const handleTypeChange = (next: TaskType) => {
    setTaskType(next);
    if (mode === "edit" && task) {
      typeMutation.mutate({ taskId: task.id, data: { type: next } });
    }
  };

  const confirmDelete = () => {
    if (!task) return;
    Alert.alert("Excluir tarefa", `Remover "${task.title}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => deleteMutation.mutate({ taskId: task.id }),
      },
    ]);
  };

  const canSave = canEdit && !!title.trim() && !!columnId && !saving;
  const footer = canEdit ? (
    <Button
      label={mode === "create" ? "Criar tarefa" : "Salvar"}
      icon="checkmark"
      onPress={save}
      loading={saving}
      disabled={!canSave}
      testID="task-save"
    />
  ) : (
    <Button label="Fechar" variant="secondary" onPress={onClose} />
  );

  return (
    <SheetModal
      visible={visible}
      onClose={handleClose}
      title={mode === "create" ? "Nova tarefa" : "Editar tarefa"}
      footer={footer}
      fillHeight={mode === "edit"}
    >
      <LabeledInput
        label="Título"
        value={title}
        onChangeText={setTitle}
        placeholder="Nome da tarefa"
        editable={canEdit}
        autoFocus={mode === "create"}
        testID="task-title"
      />
      <RichTextEditor
        label="Descrição"
        value={description}
        onChange={setDescription}
        placeholder="Detalhes (opcional)"
        editable={canEdit}
      />
      <Segmented
        label="Prioridade"
        options={PRIORITY_OPTIONS}
        value={priority}
        onChange={setPriority}
        disabled={!canEdit}
      />
      <DateField
        label="Data de entrega"
        value={dueDate}
        onChange={setDueDate}
        disabled={!canEdit}
      />
      <SelectField
        label="Responsável"
        options={memberOptions}
        value={assigneeId === null ? NONE : String(assigneeId)}
        onSelect={(v) => setAssigneeId(v === NONE ? null : Number(v))}
        disabled={!canEdit}
        testID="task-assignee"
      />
      <SelectField
        label="Coluna"
        options={columnOptions}
        value={columnId === null ? null : String(columnId)}
        onSelect={(v) => setColumnId(Number(v))}
        placeholder="Selecionar coluna"
        disabled={!canEdit}
        testID="task-column"
      />
      <Segmented
        label="Tipo de tarefa"
        options={TYPE_OPTIONS}
        value={taskType}
        onChange={handleTypeChange}
        disabled={!canEdit}
      />

      {mode === "edit" && task ? (
        <>
          <FieldLabel>Status</FieldLabel>
          <Pressable
            disabled={!canEdit}
            onPress={toggleCompleted}
            style={[
              styles.completedRow,
              {
                backgroundColor: colors.secondary,
                borderColor: colors.border,
                borderRadius: colors.radius,
                opacity: canEdit ? 1 : 0.6,
              },
            ]}
          >
            <Ionicons
              name={completed ? "checkmark-circle" : "ellipse-outline"}
              size={22}
              color={completed ? colors.success : colors.mutedForeground}
            />
            <Text style={[styles.completedText, { color: colors.foreground }]}>
              {completed ? "Concluída" : "Marcar como concluída"}
            </Text>
          </Pressable>

          <View style={{ height: 16 }} />
          {taskType === "video" ? (
            <TaskVideoLinks
              taskId={task.id}
              videoLinks={task.videoLinks ?? []}
              canEdit={canEdit}
              onChanged={refresh}
            />
          ) : null}

          <TaskTimer taskId={task.id} canEdit={canEdit} onChanged={refresh} />

          <ChecklistEditor
            taskId={task.id}
            canEdit={canEdit}
            onChanged={refresh}
          />

          <TaskAttachments taskId={task.id} canEdit={canEdit} />

          <TaskActivity taskId={task.id} />

          {canEdit ? (
            <Pressable
              onPress={confirmDelete}
              style={styles.deleteRow}
              testID="task-delete"
            >
              <Ionicons name="trash-outline" size={18} color={colors.destructive} />
              <Text style={[styles.deleteText, { color: colors.destructive }]}>
                Excluir tarefa
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  completedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 4,
  },
  completedText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
  deleteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    marginTop: 4,
  },
  deleteText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
});
