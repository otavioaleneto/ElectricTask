import React, { useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  getGetWorkspaceSummaryQueryKey,
  getListProjectsQueryKey,
  useGetWorkspaceSummary,
  useListProjects,
  useListWorkspaces,
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
import { ProjectCard } from "@/components/ProjectCard";
import { CreateProjectSheet } from "@/components/CreateProjectSheet";

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        statStyles.card,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
      ]}
    >
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={[statStyles.label, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

export default function ProjectsScreen() {
  const colors = useColors();
  const router = useRouter();
  const bottomInset = useBottomInset();
  const { selectedId, setSelectedId, ready } = useWorkspace();

  const workspacesQuery = useListWorkspaces();
  const workspaces = workspacesQuery.data ?? [];

  // Default to the first workspace once data loads.
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

  const projectsQuery = useListProjects(workspaceId, {
    query: {
      enabled: !!activeWorkspace,
      queryKey: getListProjectsQueryKey(workspaceId),
    },
  });
  const summaryQuery = useGetWorkspaceSummary(workspaceId, undefined, {
    query: {
      enabled: !!activeWorkspace,
      queryKey: getGetWorkspaceSummaryQueryKey(workspaceId),
    },
  });

  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      workspacesQuery.refetch(),
      projectsQuery.refetch(),
      summaryQuery.refetch(),
    ]);
    setRefreshing(false);
  };

  if (workspacesQuery.isLoading || !ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Projetos" />
        <LoadingView />
      </View>
    );
  }

  if (workspacesQuery.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Projetos" />
        <ErrorView
          message="Não foi possível carregar seus workspaces."
          onRetry={() => workspacesQuery.refetch()}
        />
      </View>
    );
  }

  const projects = projectsQuery.data ?? [];
  const summary = summaryQuery.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="Projetos"
        subtitle={activeWorkspace ? activeWorkspace.name : undefined}
        right={
          canEdit && activeWorkspace ? (
            <IconButton
              name="add"
              onPress={() => setShowCreate(true)}
              testID="add-project"
            />
          ) : undefined
        }
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomInset },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {workspaces.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.wsRow}
          >
            {workspaces.map((w) => {
              const active = w.id === selectedId;
              return (
                <Pressable
                  key={w.id}
                  onPress={() => setSelectedId(w.id)}
                  style={[
                    styles.wsChip,
                    {
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? colors.primaryForeground : colors.foreground,
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 13,
                    }}
                  >
                    {w.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {summary ? (
          <View style={styles.statsRow}>
            <Stat label="Projetos" value={summary.projectCount} color={colors.foreground} />
            <Stat label="Abertas" value={summary.openCount} color={colors.primary} />
            <Stat label="Concluídas" value={summary.completedCount} color={colors.success} />
          </View>
        ) : null}

        {projectsQuery.isLoading ? (
          <View style={{ height: 240 }}>
            <LoadingView />
          </View>
        ) : projectsQuery.isError ? (
          <View style={{ height: 240 }}>
            <ErrorView
              message="Não foi possível carregar os projetos."
              onRetry={() => projectsQuery.refetch()}
            />
          </View>
        ) : projects.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="albums-outline"
              title="Nenhum projeto ainda"
              subtitle={
                canEdit
                  ? "Crie seu primeiro projeto para começar."
                  : "Este workspace ainda não tem projetos."
              }
            />
            {canEdit ? (
              <View style={styles.emptyAction}>
                <Button
                  label="Novo projeto"
                  icon="add"
                  onPress={() => setShowCreate(true)}
                  testID="create-first-project"
                />
              </View>
            ) : null}
          </View>
        ) : (
          projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onPress={() =>
                router.push({ pathname: "/project/[id]", params: { id: String(p.id) } })
              }
            />
          ))
        )}
      </ScrollView>

      <CreateProjectSheet
        visible={showCreate}
        workspaceId={workspaceId}
        onClose={() => setShowCreate(false)}
        onCreated={(id) =>
          router.push({ pathname: "/project/[id]", params: { id: String(id) } })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    ...(Platform.OS === "web"
      ? { maxWidth: 640, width: "100%", alignSelf: "center" }
      : {}),
  },
  wsRow: {
    gap: 8,
    paddingBottom: 16,
  },
  wsChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  emptyWrap: {
    minHeight: 320,
  },
  emptyAction: {
    paddingHorizontal: 40,
    marginTop: 8,
  },
});

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  value: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    marginTop: 2,
  },
});
