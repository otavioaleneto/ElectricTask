import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListNotesQueryKey,
  useCreateNote,
  useDeleteNote,
  useListNotes,
  useListWorkspaces,
  type NoteSummary,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { useWorkspace } from "@/contexts/workspace";
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

const LOCK_ACCENT = "#f59e0b";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

export default function NotesScreen() {
  const colors = useColors();
  const router = useRouter();
  const bottomInset = useBottomInset();
  const queryClient = useQueryClient();
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

  const notesQuery = useListNotes(workspaceId, {
    query: {
      enabled: !!activeWorkspace,
      queryKey: getListNotesQueryKey(workspaceId),
    },
  });
  const notes = notesQuery.data ?? [];

  const createMutation = useCreateNote();
  const deleteMutation = useDeleteNote();

  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: getListNotesQueryKey(workspaceId),
    });

  const onRefresh = async () => {
    setRefreshing(true);
    await notesQuery.refetch();
    setRefreshing(false);
  };

  const handleCreate = () => {
    const title = createTitle.trim();
    if (!title) return;
    createMutation.mutate(
      { workspaceId, data: { title } },
      {
        onSuccess: (detail) => {
          invalidate();
          setShowCreate(false);
          setCreateTitle("");
          router.push(`/note/${detail.note.id}`);
        },
        onError: () => Alert.alert("Erro", "Não foi possível criar a nota."),
      },
    );
  };

  const confirmDelete = (note: NoteSummary) => {
    Alert.alert(
      "Excluir nota",
      `Deseja excluir "${note.title}"? Esta ação não pode ser desfeita.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () =>
            deleteMutation.mutate(
              { noteId: note.id },
              {
                onSuccess: invalidate,
                onError: () =>
                  Alert.alert("Erro", "Não foi possível excluir a nota."),
              },
            ),
        },
      ],
    );
  };

  const renderBody = () => {
    if (!activeWorkspace) {
      return (
        <EmptyState
          icon="albums-outline"
          title="Selecione um workspace"
          subtitle="Escolha um workspace na aba inicial para ver as notas."
        />
      );
    }
    if (notesQuery.isLoading) {
      return <LoadingView label="Carregando notas..." />;
    }
    if (notesQuery.isError) {
      return (
        <ErrorView
          message="Não foi possível carregar as notas."
          onRetry={() => notesQuery.refetch()}
        />
      );
    }
    if (notes.length === 0) {
      return (
        <ScrollView
          contentContainerStyle={styles.emptyScroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <EmptyState
            icon="document-text-outline"
            title="Nenhuma nota"
            subtitle="Crie uma nota para registrar e conectar suas ideias com links [[título]]."
          />
          {canEdit ? (
            <View style={styles.emptyButton}>
              <Button
                label="Criar nota"
                icon="add"
                onPress={() => setShowCreate(true)}
              />
            </View>
          ) : null}
        </ScrollView>
      );
    }
    return (
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: bottomInset }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {notes.map((note) => (
          <Pressable
            key={note.id}
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
            onPress={() => router.push(`/note/${note.id}`)}
          >
            <View style={styles.cardHeader}>
              <View
                style={[styles.cardIcon, { backgroundColor: colors.secondary }]}
              >
                <Ionicons
                  name={note.isLocked ? "lock-closed" : "document-text-outline"}
                  size={18}
                  color={note.isLocked ? LOCK_ACCENT : colors.primary}
                />
              </View>
              <Text
                style={[styles.cardTitle, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {note.title}
              </Text>
              {canEdit ? (
                <IconButton
                  name="trash-outline"
                  size={20}
                  color={colors.mutedForeground}
                  onPress={() => confirmDelete(note)}
                />
              ) : (
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.mutedForeground}
                />
              )}
            </View>
            {note.isLocked ? (
              <View style={styles.lockedRow}>
                <Ionicons name="lock-closed" size={14} color={LOCK_ACCENT} />
                <Text
                  style={[styles.cardExcerpt, { color: colors.mutedForeground }]}
                >
                  Nota protegida
                </Text>
              </View>
            ) : (
              <Text
                style={[styles.cardExcerpt, { color: colors.mutedForeground }]}
                numberOfLines={2}
              >
                {note.excerpt || "Nota vazia"}
              </Text>
            )}
            <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>
              {formatDate(note.updatedAt)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="Notas"
        right={
          activeWorkspace && canEdit ? (
            <IconButton name="add" onPress={() => setShowCreate(true)} />
          ) : undefined
        }
      />

      {renderBody()}

      <SheetModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nova nota"
        footer={
          <Button
            label="Criar"
            icon="add"
            onPress={handleCreate}
            loading={createMutation.isPending}
            disabled={!createTitle.trim()}
          />
        }
      >
        <LabeledInput
          label="Título"
          value={createTitle}
          onChangeText={setCreateTitle}
          placeholder="Ex.: Ideias para campanha"
          autoFocus
        />
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    gap: 14,
  },
  emptyScroll: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyButton: {
    paddingHorizontal: 40,
    marginTop: 8,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardExcerpt: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  cardDate: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
});
