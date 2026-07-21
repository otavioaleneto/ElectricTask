import React from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  getListTaskActivityQueryKey,
  useListTaskActivity,
  type Activity,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { Avatar } from "@/components/ui";
import { FieldLabel } from "@/components/forms";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(" ");
}

function describe(a: Activity): string {
  switch (a.action) {
    case "created":
      return "criou a tarefa";
    case "completed":
      return "concluiu a tarefa";
    case "reopened":
      return "reabriu a tarefa";
    case "moved":
      return a.detail ? `moveu para "${a.detail}"` : "moveu a tarefa";
    case "assignee_changed":
      return a.detail
        ? `definiu o responsável como ${a.detail}`
        : "removeu o responsável";
    case "due_changed":
      return a.detail
        ? `definiu a entrega para ${new Date(a.detail).toLocaleDateString("pt-BR")}`
        : "removeu a data de entrega";
    case "timer_started":
      return "iniciou o cronômetro";
    case "timer_paused":
      return a.detail
        ? `pausou o cronômetro (${formatDuration(Number(a.detail))})`
        : "pausou o cronômetro";
    case "timer_finished":
      return a.detail
        ? `finalizou a tarefa pelo cronômetro (${formatDuration(Number(a.detail))})`
        : "finalizou a tarefa pelo cronômetro";
    default:
      return "atualizou a tarefa";
  }
}

export function TaskActivity({ taskId }: { taskId: number }) {
  const colors = useColors();
  const { data: activities = [], isLoading } = useListTaskActivity(taskId, {
    query: { queryKey: getListTaskActivityQueryKey(taskId) },
  });

  return (
    <View style={styles.section}>
      <FieldLabel>Atividade</FieldLabel>
      {isLoading ? (
        <Text style={[styles.muted, { color: colors.mutedForeground }]}>
          Carregando...
        </Text>
      ) : activities.length === 0 ? (
        <Text style={[styles.muted, { color: colors.mutedForeground }]}>
          Nenhuma atividade ainda.
        </Text>
      ) : (
        activities.map((a) => (
          <View key={a.id} style={styles.row}>
            <Avatar
              name={a.actor?.name ?? "?"}
              uri={a.actor?.avatarUrl}
              size={28}
            />
            <View style={styles.body}>
              <Text style={[styles.text, { color: colors.foreground }]}>
                <Text style={styles.actor}>{a.actor?.name ?? "Alguém"}</Text>{" "}
                <Text style={{ color: colors.mutedForeground }}>
                  {describe(a)}
                </Text>
              </Text>
              <Text style={[styles.date, { color: colors.mutedForeground }]}>
                {formatDate(a.createdAt)}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  muted: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  body: {
    flex: 1,
  },
  text: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  actor: {
    fontFamily: "Inter_600SemiBold",
  },
  date: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
});
