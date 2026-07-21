import React, { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetTaskTimerQueryKey,
  getListTaskActivityQueryKey,
  useGetTaskTimer,
  useStartTimer,
  useStopTimer,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { FieldLabel } from "@/components/forms";

function formatTimer(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function TaskTimer({
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

  const { data: timer } = useGetTaskTimer(taskId, {
    query: { queryKey: getGetTaskTimerQueryKey(taskId) },
  });
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();

  const [seconds, setSeconds] = useState(0);
  const running = timer?.running ?? false;

  useEffect(() => {
    setSeconds(timer?.totalSeconds ?? 0);
  }, [timer]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: getGetTaskTimerQueryKey(taskId),
    });
    queryClient.invalidateQueries({
      queryKey: getListTaskActivityQueryKey(taskId),
    });
    onChanged?.();
  };

  const handleStart = () => {
    startTimer.mutate({ taskId }, { onSuccess: refresh });
  };

  const handleStop = (finished: boolean) => {
    stopTimer.mutate({ taskId, data: { finished } }, { onSuccess: refresh });
  };

  const confirmStop = () => {
    Alert.alert(
      "Tarefa finalizada?",
      "Deseja finalizar a tarefa e marcá-la como concluída, ou apenas pausar o cronômetro?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Apenas pausar", onPress: () => handleStop(false) },
        {
          text: "Finalizar tarefa",
          style: "destructive",
          onPress: () => handleStop(true),
        },
      ],
    );
  };

  const busy = startTimer.isPending || stopTimer.isPending;

  return (
    <View style={styles.section}>
      <FieldLabel>Cronômetro</FieldLabel>
      <View
        style={[
          styles.row,
          { borderColor: colors.border, borderRadius: colors.radius },
        ]}
      >
        <View style={styles.left}>
          <Ionicons
            name="time-outline"
            size={22}
            color={running ? colors.primary : colors.mutedForeground}
          />
          <View>
            <Text style={[styles.time, { color: colors.foreground }]}>
              {formatTimer(seconds)}
            </Text>
            <Text style={[styles.caption, { color: colors.mutedForeground }]}>
              Tempo total da tarefa
            </Text>
          </View>
        </View>
        {canEdit ? (
          running ? (
            <Pressable
              onPress={confirmStop}
              disabled={busy}
              style={[
                styles.btn,
                {
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  opacity: busy ? 0.6 : 1,
                },
              ]}
              testID="timer-pause"
            >
              <Ionicons name="pause" size={16} color={colors.foreground} />
              <Text style={[styles.btnText, { color: colors.foreground }]}>
                Pausar
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleStart}
              disabled={busy}
              style={[
                styles.btn,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                  borderRadius: colors.radius,
                  opacity: busy ? 0.6 : 1,
                },
              ]}
              testID="timer-start"
            >
              <Ionicons name="play" size={16} color={colors.primaryForeground} />
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>
                Iniciar
              </Text>
            </Pressable>
          )
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  time: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    fontVariant: ["tabular-nums"],
  },
  caption: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 2,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
