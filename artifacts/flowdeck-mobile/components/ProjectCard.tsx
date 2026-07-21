import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import type { Project } from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { PlatformIcon, ProgressBar } from "@/components/ui";

function shade(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const num = parseInt(clean, 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function ProjectCard({
  project,
  onPress,
}: {
  project: Project;
  onPress: () => void;
}) {
  const colors = useColors();
  const accent = project.accentColor || colors.primary;
  const total = project.taskCount ?? 0;
  const done = project.completedCount ?? 0;
  const ratio = total > 0 ? done / total : 0;

  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== "web") {
          Haptics.selectionAsync().catch(() => {});
        }
        onPress();
      }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      <View style={[styles.cover, { borderTopLeftRadius: colors.radius, borderTopRightRadius: colors.radius }]}>
        {project.coverImageUrl ? (
          <Image
            source={{ uri: project.coverImageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <LinearGradient
            colors={[shade(accent, 20), shade(accent, -50)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View style={styles.platformChip}>
          <PlatformIcon platform={project.platform} size={16} color="#ffffff" />
          <Text style={styles.platformText}>{project.platform}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>
          {project.name}
        </Text>
        {project.description ? (
          <Text
            numberOfLines={2}
            style={[styles.description, { color: colors.mutedForeground }]}
          >
            {project.description}
          </Text>
        ) : null}

        <View style={styles.progressRow}>
          <ProgressBar value={ratio} color={accent} />
        </View>
        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {done}/{total} concluídas
          </Text>
          <Text style={[styles.metaPct, { color: accent }]}>
            {Math.round(ratio * 100)}%
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: 16,
  },
  cover: {
    height: 116,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  platformChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    margin: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.45)",
    gap: 6,
  },
  platformText: {
    color: "#ffffff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    textTransform: "capitalize",
  },
  body: {
    padding: 16,
  },
  name: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  description: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  progressRow: {
    marginTop: 14,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  metaText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  metaPct: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
});
