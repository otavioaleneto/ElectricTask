import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeIn, runOnJS, type SharedValue } from "react-native-reanimated";
import type { Task } from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { Avatar, Badge, IconButton, priorityColor } from "@/components/ui";

const MONTHS_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

const PRIORITY_LABEL: Record<string, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

/** Parse the date-only string locally — never via `new Date("YYYY-MM-DD")`. */
function formatDue(due: string | null | undefined): string | null {
  if (!due) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(due);
  if (!match) return null;
  const month = MONTHS_SHORT[Number(match[2]) - 1];
  if (!month) return null;
  return `${Number(match[3])} ${month}`;
}

export type TaskDragValues = {
  x: SharedValue<number>;
  y: SharedValue<number>;
  active: SharedValue<number>;
};

function CardBody({
  task,
  canEdit,
  isFirst,
  isLast,
  busy,
  onMoveLeft,
  onMoveRight,
}: {
  task: Task;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
  busy?: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
}) {
  const colors = useColors();
  const due = formatDue(task.dueDate);
  const pColor = priorityColor(colors, task.priority);
  const hasChecklist = (task.checklistTotal ?? 0) > 0;
  const isVideo = task.type === "video";

  return (
    <>
      <View style={[styles.priorityStripe, { backgroundColor: pColor }]} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text
            numberOfLines={2}
            style={[
              styles.title,
              {
                color: task.completed ? colors.mutedForeground : colors.foreground,
                textDecorationLine: task.completed ? "line-through" : "none",
              },
            ]}
          >
            {task.title}
          </Text>
          {task.completed ? (
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          ) : null}
        </View>

        <View style={styles.metaRow}>
          <Badge
            label={PRIORITY_LABEL[task.priority] ?? task.priority}
            color={pColor}
            bg={colors.secondary}
          />
          {due ? (
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={13} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {due}
              </Text>
            </View>
          ) : null}
          {hasChecklist ? (
            <View style={styles.metaItem}>
              <Ionicons name="checkbox-outline" size={13} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {task.checklistDone}/{task.checklistTotal}
              </Text>
            </View>
          ) : null}
          {isVideo ? (
            <View style={styles.metaItem}>
              <Ionicons name="videocam-outline" size={13} color={colors.primary} />
            </View>
          ) : null}
          {task.assignee ? (
            <View style={styles.assignee}>
              <Avatar
                name={task.assignee.name}
                uri={task.assignee.avatarUrl}
                size={22}
              />
            </View>
          ) : null}
        </View>

        {canEdit ? (
          <View style={[styles.moveRow, { borderTopColor: colors.border }]}>
            <IconButton
              name="arrow-back-circle-outline"
              size={26}
              onPress={onMoveLeft}
              disabled={isFirst || busy}
              color={colors.mutedForeground}
              testID={`move-left-${task.id}`}
            />
            <Text style={[styles.moveHint, { color: colors.mutedForeground }]}>
              Arraste ou mova
            </Text>
            <IconButton
              name="arrow-forward-circle-outline"
              size={26}
              onPress={onMoveRight}
              disabled={isLast || busy}
              color={colors.mutedForeground}
              testID={`move-right-${task.id}`}
            />
          </View>
        ) : null}
      </View>
    </>
  );
}

/**
 * Lightweight visual used by the floating drag overlay. It mirrors the card's
 * look but carries no gestures or interactive buttons.
 */
export function TaskCardPreview({ task, width }: { task: Task; width: number }) {
  const colors = useColors();
  const pColor = priorityColor(colors, task.priority);
  const due = formatDue(task.dueDate);
  return (
    <View
      style={[
        styles.card,
        styles.previewCard,
        {
          width,
          backgroundColor: colors.card,
          borderColor: pColor,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View style={[styles.priorityStripe, { backgroundColor: pColor }]} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text
            numberOfLines={2}
            style={[styles.title, { color: colors.foreground }]}
          >
            {task.title}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Badge
            label={PRIORITY_LABEL[task.priority] ?? task.priority}
            color={pColor}
            bg={colors.secondary}
          />
          {due ? (
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={13} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {due}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function TaskCard({
  task,
  isFirst,
  isLast,
  busy,
  canEdit = true,
  canDrag = false,
  isDragging = false,
  drag,
  registerRef,
  onPress,
  onMoveLeft,
  onMoveRight,
  onDragStart,
  onDragMove,
  onDragDrop,
}: {
  task: Task;
  isFirst: boolean;
  isLast: boolean;
  busy?: boolean;
  canEdit?: boolean;
  canDrag?: boolean;
  isDragging?: boolean;
  drag?: TaskDragValues;
  registerRef?: (node: View | null) => void;
  onPress: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDragStart?: (task: Task) => void;
  onDragMove?: (x: number, y: number) => void;
  onDragDrop?: (x: number, y: number) => void;
}) {
  const colors = useColors();

  const startJS = React.useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    onDragStart?.(task);
  }, [onDragStart, task]);

  const dragEnabled = canEdit && canDrag && !!drag;

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .enabled(dragEnabled)
        .activateAfterLongPress(220)
        .onStart((e) => {
          "worklet";
          if (drag) {
            drag.x.value = e.absoluteX;
            drag.y.value = e.absoluteY;
            drag.active.value = 1;
          }
          if (onDragStart) runOnJS(startJS)();
        })
        .onUpdate((e) => {
          "worklet";
          if (drag) {
            drag.x.value = e.absoluteX;
            drag.y.value = e.absoluteY;
          }
          if (onDragMove) runOnJS(onDragMove)(e.absoluteX, e.absoluteY);
        })
        .onEnd((e) => {
          "worklet";
          if (onDragDrop) runOnJS(onDragDrop)(e.absoluteX, e.absoluteY);
        })
        .onFinalize(() => {
          "worklet";
          if (drag) drag.active.value = 0;
        }),
    [dragEnabled, drag, onDragStart, onDragMove, onDragDrop, startJS],
  );

  const card = (
    <Animated.View
      entering={FadeIn.duration(180)}
      ref={registerRef}
      collapsable={false}
      style={{ opacity: isDragging ? 0.35 : 1 }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
            opacity: busy ? 0.5 : pressed ? 0.85 : 1,
          },
        ]}
      >
        <CardBody
          task={task}
          canEdit={canEdit}
          isFirst={isFirst}
          isLast={isLast}
          busy={busy}
          onMoveLeft={onMoveLeft}
          onMoveRight={onMoveRight}
        />
      </Pressable>
    </Animated.View>
  );

  if (!dragEnabled) return card;

  return <GestureDetector gesture={pan}>{card}</GestureDetector>;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
    overflow: "hidden",
    flexDirection: "row",
  },
  previewCard: {
    marginBottom: 0,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  priorityStripe: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  title: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  assignee: {
    marginLeft: "auto",
  },
  moveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  moveHint: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
