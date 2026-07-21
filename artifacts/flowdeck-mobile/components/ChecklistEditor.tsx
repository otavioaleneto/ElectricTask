import React, { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetTaskQueryKey,
  getListChecklistsQueryKey,
  useCreateChecklist,
  useCreateChecklistItem,
  useDeleteChecklist,
  useDeleteChecklistItem,
  useListChecklists,
  useUpdateChecklist,
  useUpdateChecklistItem,
  type Checklist,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { FieldLabel } from "@/components/forms";

export function ChecklistEditor({
  taskId,
  canEdit,
  onChanged,
}: {
  taskId: number;
  canEdit: boolean;
  onChanged?: () => void;
}) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const listKey = getListChecklistsQueryKey(taskId);

  const checklistsQuery = useListChecklists(taskId, {
    query: { queryKey: listKey },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: listKey });
    queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(taskId) });
    onChanged?.();
  };

  const createChecklist = useCreateChecklist({
    mutation: { onSettled: refresh },
  });

  const [newTitle, setNewTitle] = useState("");

  const addChecklist = () => {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle("");
    createChecklist.mutate({ taskId, data: { title } });
  };

  const checklists = [...(checklistsQuery.data ?? [])].sort(
    (a, b) => a.position - b.position,
  );

  return (
    <View style={styles.section}>
      <FieldLabel>Checklists</FieldLabel>
      {checklists.length === 0 ? (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>
          Nenhuma checklist ainda.
        </Text>
      ) : (
        checklists.map((c) => (
          <ChecklistGroupRow
            key={c.id}
            checklist={c}
            canEdit={canEdit}
            onChanged={refresh}
          />
        ))
      )}

      {canEdit ? (
        <View style={styles.addRow}>
          <TextInput
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="Nova checklist"
            placeholderTextColor={colors.mutedForeground}
            onSubmitEditing={addChecklist}
            returnKeyType="done"
            style={[
              styles.addInput,
              {
                backgroundColor: colors.secondary,
                borderColor: colors.border,
                borderRadius: colors.radius,
                color: colors.foreground,
              },
            ]}
          />
          <Pressable
            onPress={addChecklist}
            disabled={!newTitle.trim()}
            style={[
              styles.addBtn,
              {
                backgroundColor: colors.primary,
                borderRadius: colors.radius,
                opacity: newTitle.trim() ? 1 : 0.5,
              },
            ]}
          >
            <Ionicons name="add" size={22} color={colors.primaryForeground} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ChecklistGroupRow({
  checklist,
  canEdit,
  onChanged,
}: {
  checklist: Checklist;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const colors = useColors();
  const [title, setTitle] = useState(checklist.title);
  const [newItem, setNewItem] = useState("");

  const updateChecklist = useUpdateChecklist({
    mutation: { onSettled: onChanged },
  });
  const deleteChecklist = useDeleteChecklist({
    mutation: { onSettled: onChanged },
  });
  const createItem = useCreateChecklistItem({
    mutation: { onSettled: onChanged },
  });
  const updateItem = useUpdateChecklistItem({
    mutation: { onSettled: onChanged },
  });
  const deleteItem = useDeleteChecklistItem({
    mutation: { onSettled: onChanged },
  });

  const items = [...(checklist.items ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  const doneCount = items.filter((i) => i.done).length;

  const commitTitle = () => {
    const t = title.trim();
    if (!t || t === checklist.title) {
      setTitle(checklist.title);
      return;
    }
    updateChecklist.mutate({ checklistId: checklist.id, data: { title: t } });
  };

  const addItem = () => {
    const content = newItem.trim();
    if (!content) return;
    setNewItem("");
    createItem.mutate({ checklistId: checklist.id, data: { content } });
  };

  const confirmDelete = () => {
    Alert.alert(
      "Excluir checklist",
      `Remover "${checklist.title}" e seus itens?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () =>
            deleteChecklist.mutate({ checklistId: checklist.id }),
        },
      ],
    );
  };

  return (
    <View
      style={[
        styles.group,
        { borderColor: colors.border, borderRadius: colors.radius },
      ]}
    >
      <View style={styles.groupHeader}>
        {canEdit ? (
          <TextInput
            value={title}
            onChangeText={setTitle}
            onBlur={commitTitle}
            onSubmitEditing={commitTitle}
            returnKeyType="done"
            style={[styles.groupTitleInput, { color: colors.foreground }]}
          />
        ) : (
          <Text style={[styles.groupTitleInput, { color: colors.foreground }]}>
            {checklist.title}
          </Text>
        )}
        <Text style={[styles.groupCount, { color: colors.mutedForeground }]}>
          {doneCount}/{items.length}
        </Text>
        {canEdit ? (
          <Pressable hitSlop={8} onPress={confirmDelete}>
            <Ionicons
              name="trash-outline"
              size={18}
              color={colors.mutedForeground}
            />
          </Pressable>
        ) : null}
      </View>

      {items.map((item) => (
        <View key={item.id} style={styles.item}>
          <Pressable
            disabled={!canEdit}
            hitSlop={6}
            onPress={() =>
              updateItem.mutate({
                itemId: item.id,
                data: { done: !item.done },
              })
            }
          >
            <Ionicons
              name={item.done ? "checkbox" : "square-outline"}
              size={20}
              color={item.done ? colors.primary : colors.mutedForeground}
            />
          </Pressable>
          <Text
            style={[
              styles.itemText,
              {
                color: item.done ? colors.mutedForeground : colors.foreground,
                textDecorationLine: item.done ? "line-through" : "none",
              },
            ]}
          >
            {item.content}
          </Text>
          {canEdit ? (
            <Pressable
              hitSlop={6}
              onPress={() => deleteItem.mutate({ itemId: item.id })}
            >
              <Ionicons name="close" size={18} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
      ))}

      {canEdit ? (
        <View style={styles.itemAddRow}>
          <Ionicons name="add" size={18} color={colors.mutedForeground} />
          <TextInput
            value={newItem}
            onChangeText={setNewItem}
            placeholder="Adicionar item"
            placeholderTextColor={colors.mutedForeground}
            onSubmitEditing={addItem}
            returnKeyType="done"
            blurOnSubmit={false}
            style={[styles.itemInput, { color: colors.foreground }]}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  empty: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginBottom: 12,
  },
  group: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 10,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  groupTitleInput: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    paddingVertical: 2,
  },
  groupCount: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  itemText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  itemAddRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    paddingVertical: 4,
  },
  itemInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    paddingVertical: 4,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  addInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  addBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
