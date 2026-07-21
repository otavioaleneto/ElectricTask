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
  getListMindmapsQueryKey,
  useCreateMindmap,
  useDeleteMindmap,
  useListMindmaps,
  useListWorkspaces,
  useUpdateMindmap,
  type Mindmap,
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
import {
  LabeledInput,
  Segmented,
  SelectField,
  SheetModal,
  type SelectOption,
} from "@/components/forms";

function nodeCountLabel(m: Mindmap): string {
  const count = m.data?.nodes?.length ?? 0;
  return count === 1 ? "1 nó" : `${count} nós`;
}

export default function MindmapsScreen() {
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

  const mindmapsQuery = useListMindmaps(workspaceId, {
    query: {
      enabled: !!activeWorkspace,
      queryKey: getListMindmapsQueryKey(workspaceId),
    },
  });
  const mindmaps = mindmapsQuery.data ?? [];

  const createMutation = useCreateMindmap();
  const updateMutation = useUpdateMindmap();
  const deleteMutation = useDeleteMindmap();

  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [complementParent, setComplementParent] = useState<Mindmap | null>(null);
  const [compMode, setCompMode] = useState<"create" | "link">("create");
  const [compName, setCompName] = useState("");
  const [compLinkId, setCompLinkId] = useState<number | null>(null);

  const topLevel = mindmaps.filter((m) => m.parentId == null);
  const childrenOf = (parentId: number) =>
    mindmaps.filter((m) => m.parentId === parentId);

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: getListMindmapsQueryKey(workspaceId),
    });

  const onRefresh = async () => {
    setRefreshing(true);
    await mindmapsQuery.refetch();
    setRefreshing(false);
  };

  const handleCreate = () => {
    const name = createName.trim();
    if (!name) return;
    createMutation.mutate(
      { workspaceId, data: { name } },
      {
        onSuccess: () => {
          invalidate();
          setShowCreate(false);
          setCreateName("");
        },
        onError: () =>
          Alert.alert("Erro", "Não foi possível criar o mapa mental."),
      },
    );
  };

  const openComplement = (parent: Mindmap) => {
    setComplementParent(parent);
    setCompMode("create");
    setCompName("");
    setCompLinkId(null);
  };

  const linkCandidates = (parent: Mindmap): SelectOption[] =>
    topLevel
      .filter((m) => m.id !== parent.id && childrenOf(m.id).length === 0)
      .map((m) => ({ value: String(m.id), label: m.name }));

  const handleComplement = () => {
    const parent = complementParent;
    if (!parent) return;
    if (compMode === "create") {
      const name = compName.trim();
      if (!name) return;
      createMutation.mutate(
        { workspaceId, data: { name, parentId: parent.id } },
        {
          onSuccess: () => {
            invalidate();
            setComplementParent(null);
          },
          onError: () =>
            Alert.alert("Erro", "Não foi possível criar o mapa complementar."),
        },
      );
    } else {
      if (compLinkId == null) return;
      updateMutation.mutate(
        { mindmapId: compLinkId, data: { parentId: parent.id } },
        {
          onSuccess: () => {
            invalidate();
            setComplementParent(null);
          },
          onError: () =>
            Alert.alert("Erro", "Não foi possível vincular o mapa."),
        },
      );
    }
  };

  const confirmDelete = (m: Mindmap) => {
    Alert.alert(
      "Excluir mapa mental",
      `Deseja excluir "${m.name}"? Esta ação não pode ser desfeita.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () =>
            deleteMutation.mutate(
              { mindmapId: m.id },
              {
                onSuccess: invalidate,
                onError: () =>
                  Alert.alert("Erro", "Não foi possível excluir o mapa."),
              },
            ),
        },
      ],
    );
  };

  const manageChild = (child: Mindmap) => {
    Alert.alert(child.name, "O que deseja fazer com este mapa complementar?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Desvincular",
        onPress: () =>
          updateMutation.mutate(
            { mindmapId: child.id, data: { parentId: null } },
            {
              onSuccess: invalidate,
              onError: () =>
                Alert.alert("Erro", "Não foi possível desvincular o mapa."),
            },
          ),
      },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () =>
          deleteMutation.mutate(
            { mindmapId: child.id },
            {
              onSuccess: invalidate,
              onError: () =>
                Alert.alert("Erro", "Não foi possível excluir o mapa."),
            },
          ),
      },
    ]);
  };

  const renderBody = () => {
    if (!activeWorkspace) {
      return (
        <EmptyState
          icon="albums-outline"
          title="Selecione um workspace"
          subtitle="Escolha um workspace na aba inicial para ver os mapas mentais."
        />
      );
    }
    if (mindmapsQuery.isLoading) {
      return <LoadingView label="Carregando mapas..." />;
    }
    if (mindmapsQuery.isError) {
      return (
        <ErrorView
          message="Não foi possível carregar os mapas mentais."
          onRetry={() => mindmapsQuery.refetch()}
        />
      );
    }
    if (topLevel.length === 0) {
      return (
        <ScrollView
          contentContainerStyle={styles.emptyScroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <EmptyState
            icon="git-network-outline"
            title="Nenhum mapa mental"
            subtitle="Crie seu primeiro mapa mental para organizar ideias e projetos."
          />
          {canEdit ? (
            <View style={styles.emptyButton}>
              <Button
                label="Criar mapa mental"
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
        {topLevel.map((m) => {
          const children = childrenOf(m.id);
          return (
            <View
              key={m.id}
              style={[
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Pressable
                style={styles.cardHeader}
                onPress={() => router.push(`/mindmap/${m.id}`)}
              >
                <View
                  style={[styles.cardIcon, { backgroundColor: colors.secondary }]}
                >
                  <Ionicons
                    name="git-network-outline"
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.cardInfo}>
                  <Text
                    style={[styles.cardTitle, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {m.name}
                  </Text>
                  <Text
                    style={[styles.cardMeta, { color: colors.mutedForeground }]}
                  >
                    {nodeCountLabel(m)}
                    {children.length > 0
                      ? ` · ${children.length} complementar${children.length > 1 ? "es" : ""}`
                      : ""}
                  </Text>
                </View>
                {canEdit ? (
                  <IconButton
                    name="trash-outline"
                    size={20}
                    color={colors.mutedForeground}
                    onPress={() => confirmDelete(m)}
                  />
                ) : (
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.mutedForeground}
                  />
                )}
              </Pressable>

              {children.length > 0 ? (
                <View style={styles.childList}>
                  {children.map((child) => (
                    <Pressable
                      key={child.id}
                      style={[styles.childRow, { borderTopColor: colors.border }]}
                      onPress={() => router.push(`/mindmap/${child.id}`)}
                    >
                      <Ionicons
                        name="return-down-forward-outline"
                        size={16}
                        color={colors.mutedForeground}
                      />
                      <Text
                        style={[styles.childTitle, { color: colors.foreground }]}
                        numberOfLines={1}
                      >
                        {child.name}
                      </Text>
                      <Text
                        style={[
                          styles.childMeta,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {nodeCountLabel(child)}
                      </Text>
                      {canEdit ? (
                        <IconButton
                          name="ellipsis-horizontal"
                          size={18}
                          color={colors.mutedForeground}
                          onPress={() => manageChild(child)}
                        />
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {canEdit ? (
                <Pressable
                  style={[styles.addComplement, { borderTopColor: colors.border }]}
                  onPress={() => openComplement(m)}
                >
                  <Ionicons name="add" size={18} color={colors.primary} />
                  <Text
                    style={[styles.addComplementText, { color: colors.primary }]}
                  >
                    Adicionar mapa complementar
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="Mapas mentais"
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
        title="Novo mapa mental"
        footer={
          <Button
            label="Criar"
            icon="add"
            onPress={handleCreate}
            loading={createMutation.isPending}
            disabled={!createName.trim()}
          />
        }
      >
        <LabeledInput
          label="Nome"
          value={createName}
          onChangeText={setCreateName}
          placeholder="Ex.: Planejamento de conteúdo"
          autoFocus
        />
      </SheetModal>

      <SheetModal
        visible={!!complementParent}
        onClose={() => setComplementParent(null)}
        title="Mapa complementar"
        footer={
          <Button
            label={compMode === "create" ? "Criar" : "Vincular"}
            icon={compMode === "create" ? "add" : "link"}
            onPress={handleComplement}
            loading={createMutation.isPending || updateMutation.isPending}
            disabled={
              compMode === "create" ? !compName.trim() : compLinkId == null
            }
          />
        }
      >
        <Segmented
          options={[
            { label: "Criar novo", value: "create" },
            { label: "Vincular", value: "link" },
          ]}
          value={compMode}
          onChange={setCompMode}
        />
        {compMode === "create" ? (
          <LabeledInput
            label="Nome"
            value={compName}
            onChangeText={setCompName}
            placeholder="Nome do mapa complementar"
          />
        ) : complementParent ? (
          linkCandidates(complementParent).length > 0 ? (
            <SelectField
              label="Mapa existente"
              placeholder="Selecionar mapa"
              options={linkCandidates(complementParent)}
              value={compLinkId != null ? String(compLinkId) : null}
              onSelect={(v) => setCompLinkId(Number(v))}
            />
          ) : (
            <Text style={[styles.noCandidates, { color: colors.mutedForeground }]}>
              Nenhum mapa disponível para vincular.
            </Text>
          )
        ) : null}
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
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  cardMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 2,
  },
  childList: {
    paddingHorizontal: 14,
  },
  childRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingLeft: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  childTitle: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  childMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  addComplement: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addComplementText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  noCandidates: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    paddingVertical: 8,
  },
});
