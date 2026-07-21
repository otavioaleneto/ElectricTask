import React, { useEffect } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector, type GestureType } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import type { MindmapNode } from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { WORLD_OFFSET } from "./shared";

type Colors = ReturnType<typeof useColors>;
type GestureRef = React.MutableRefObject<GestureType | undefined>;

function iconFor(type: MindmapNode["type"]): React.ComponentProps<typeof Ionicons>["name"] | null {
  switch (type) {
    case "project":
      return "folder-open-outline";
    case "task":
      return "checkbox-outline";
    case "mindmap":
      return "git-network-outline";
    default:
      return null;
  }
}

function alphaHex(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "transparent";
  const int = parseInt(m[1], 16);
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
}

function triggerHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }
}

function MindmapNodeViewInner({
  node,
  zoom,
  activeNodeId,
  panRef,
  pinchRef,
  isConnectSource,
  isFlashing,
  onDragLive,
  onDragEnd,
  onTap,
  onLongPress,
}: {
  node: MindmapNode;
  zoom: SharedValue<number>;
  activeNodeId: SharedValue<string | null>;
  panRef: GestureRef;
  pinchRef: GestureRef;
  isConnectSource: boolean;
  isFlashing: boolean;
  onDragLive: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTap: (node: MindmapNode) => void;
  onLongPress: (node: MindmapNode) => void;
}) {
  const colors = useColors();
  const posX = useSharedValue(node.x);
  const posY = useSharedValue(node.y);
  const startX = useSharedValue(node.x);
  const startY = useSharedValue(node.y);
  const flash = useSharedValue(0);

  useEffect(() => {
    posX.value = node.x;
    posY.value = node.y;
  }, [node.x, node.y, posX, posY]);

  // Connection contact flashes the target node's border blue, then fades.
  useEffect(() => {
    if (isFlashing) {
      flash.value = withSequence(
        withTiming(1, { duration: 120 }),
        withTiming(0, { duration: 680 }),
      );
    }
  }, [isFlashing, flash]);

  const pan = Gesture.Pan()
    .maxPointers(1)
    .onBegin(() => {
      startX.value = posX.value;
      startY.value = posY.value;
      activeNodeId.value = node.id;
    })
    .onUpdate((e) => {
      posX.value = startX.value + e.translationX / zoom.value;
      posY.value = startY.value + e.translationY / zoom.value;
      runOnJS(onDragLive)(node.id, posX.value, posY.value);
    })
    .onEnd(() => {
      runOnJS(onDragEnd)(node.id, posX.value, posY.value);
    })
    .onFinalize(() => {
      activeNodeId.value = null;
    })
    .simultaneousWithExternalGesture(panRef, pinchRef);

  const tap = Gesture.Tap()
    .maxDuration(250)
    .onEnd(() => {
      runOnJS(onTap)(node);
    });

  const longPress = Gesture.LongPress()
    .minDuration(350)
    .onStart(() => {
      runOnJS(triggerHaptic)();
      runOnJS(onLongPress)(node);
    });

  const gesture = Gesture.Race(pan, longPress, tap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: posX.value + WORLD_OFFSET },
      { translateY: posY.value + WORLD_OFFSET },
    ],
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value,
  }));

  const color = node.color ?? colors.primary;

  let body: React.ReactNode;
  if (node.type === "label") {
    // "Liquid glass" title look (matches web): translucent tinted plate with
    // a light frosted border, colored glow and a glossy top highlight.
    body = (
      <View style={[styles.labelPlate, { shadowColor: color }]}>
        <BlurView
          intensity={25}
          tint="dark"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: alphaHex(color, 0.07) },
          ]}
          pointerEvents="none"
        />
        <View style={styles.labelGloss} pointerEvents="none" />
        <Text style={[styles.labelText, { color }]} numberOfLines={2}>
          {node.label || "Rótulo"}
        </Text>
      </View>
    );
  } else if (node.type === "light") {
    // "Plasma ball" look: dark sphere with a glowing colored ring and a thin
    // bright inner ring (static approximation of the web plasma animation).
    body = (
      <View
        style={[
          styles.light,
          {
            borderColor: color,
            shadowColor: color,
          },
          isConnectSource ? styles.connectSource : null,
        ]}
      >
        <View style={styles.lightInnerRing} />
        <View style={[styles.lightCore, { backgroundColor: color }]} />
      </View>
    );
  } else if (node.type === "hotspot") {
    body = (
      <View style={styles.hotspotRow}>
        <View style={[styles.hotspot, { backgroundColor: color }]}>
          <Ionicons name="location" size={18} color="#ffffff" />
        </View>
        {node.label ? (
          <View
            style={[
              styles.hotspotChip,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text
              style={[styles.hotspotChipText, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {node.label}
            </Text>
          </View>
        ) : null}
      </View>
    );
  } else {
    const icon = iconFor(node.type);
    body = (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: color,
            borderRadius: colors.radius,
          },
          isConnectSource ? styles.connectSource : null,
        ]}
      >
        {icon ? <Ionicons name={icon} size={16} color={color} /> : null}
        <Text
          style={[styles.cardText, { color: colors.foreground }]}
          numberOfLines={2}
        >
          {node.label || "Sem título"}
        </Text>
        {node.details ? (
          <Ionicons
            name="reader-outline"
            size={13}
            color={colors.mutedForeground}
          />
        ) : null}
      </View>
    );
  }

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.wrap, animatedStyle]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flashRing,
            { borderColor: colors.primary, borderRadius: colors.radius + 4 },
            flashStyle,
          ]}
        />
        {body}
      </Animated.View>
    </GestureDetector>
  );
}

export const MindmapNodeView = React.memo(MindmapNodeViewInner);

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  flashRing: {
    position: "absolute",
    left: -4,
    top: -4,
    right: -4,
    bottom: -4,
    borderWidth: 2,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 120,
    maxWidth: 220,
  },
  connectSource: {
    borderStyle: "dashed",
  },
  cardText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    flexShrink: 1,
  },
  labelText: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    maxWidth: 200,
  },
  labelPlate: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    overflow: "hidden",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  labelGloss: {
    position: "absolute",
    left: 2,
    right: 2,
    top: 1,
    height: "50%",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
  },
  hotspotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  light: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#060c1b",
    borderWidth: 3,
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  lightInnerRing: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.75)",
  },
  lightCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.85,
  },
  hotspot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  hotspotChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 160,
  },
  hotspotChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
});
