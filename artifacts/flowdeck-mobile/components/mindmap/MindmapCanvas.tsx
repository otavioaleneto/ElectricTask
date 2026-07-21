import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import {
  Gesture,
  GestureDetector,
  type GestureType,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Ellipse, Polygon, Rect } from "react-native-svg";
import type {
  MindmapEdge,
  MindmapElement,
  MindmapNode,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { MindmapEdges } from "./MindmapEdges";
import { MindmapNodeView } from "./MindmapNodeView";
import { MindmapSparks, type SparkBurstData } from "./MindmapSparks";
import { clampZoom, nodeAnchor, WORLD_OFFSET, WORLD_SIZE, type Pos } from "./shared";

export type ConnectSignal = {
  edgeId: string;
  targetId: string;
  nonce: number;
} | null;

const MAX_BURSTS = 6;
const DRAG_BURST_MS = 90;

const ELECTRIC_BLUE = "#3b82f6";

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}${a}` : hex;
}

/** Read-only decorative shapes layer (editing shapes is web-only for now). */
function ElementView({ el }: { el: MindmapElement }) {
  const color = el.color || ELECTRIC_BLUE;
  let shape: React.ReactNode;
  switch (el.shape) {
    case "circle":
      shape = (
        <Ellipse
          cx={50}
          cy={50}
          rx={48}
          ry={48}
          fill={withAlpha(color, 0.18)}
          stroke={color}
          strokeWidth={3}
        />
      );
      break;
    case "square":
      shape = (
        <Rect
          x={2}
          y={2}
          width={96}
          height={96}
          rx={4}
          fill={withAlpha(color, 0.18)}
          stroke={color}
          strokeWidth={3}
        />
      );
      break;
    case "triangle":
      shape = (
        <Polygon
          points="50,4 96,96 4,96"
          fill={withAlpha(color, 0.18)}
          stroke={color}
          strokeWidth={3}
        />
      );
      break;
    case "diamond":
      shape = (
        <Polygon
          points="50,2 98,50 50,98 2,50"
          fill={withAlpha(color, 0.18)}
          stroke={color}
          strokeWidth={3}
        />
      );
      break;
    case "arrow":
    default:
      shape = (
        <Polygon
          points="0,35 58,35 58,12 100,50 58,88 58,65 0,65"
          fill={color}
          stroke={color}
          strokeWidth={1}
        />
      );
      break;
  }
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: el.x + WORLD_OFFSET,
        top: el.y + WORLD_OFFSET,
        width: el.width,
        height: el.height,
        transform: [{ rotate: `${el.rotation ?? 0}deg` }],
      }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {shape}
      </Svg>
    </View>
  );
}

export function MindmapCanvas({
  nodes,
  edges,
  elements = [],
  panX,
  panY,
  zoom,
  activeNodeId,
  connectSourceId,
  connectSignal,
  effectsOn,
  onNodeDragEnd,
  onNodeTap,
  onNodeLongPress,
  onLayoutSize,
}: {
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  elements?: MindmapElement[];
  panX: SharedValue<number>;
  panY: SharedValue<number>;
  zoom: SharedValue<number>;
  activeNodeId: SharedValue<string | null>;
  connectSourceId: string | null;
  connectSignal: ConnectSignal;
  // Combined "energy effects" state (user preference AND system reduce-motion
  // already applied by the screen). False renders everything static.
  effectsOn: boolean;
  onNodeDragEnd: (id: string, x: number, y: number) => void;
  onNodeTap: (node: MindmapNode) => void;
  onNodeLongPress: (node: MindmapNode) => void;
  onLayoutSize: (size: { width: number; height: number }) => void;
}) {
  const colors = useColors();
  const [live, setLive] = useState<Record<string, Pos>>({});
  const lastLive = useRef(0);

  const [bursts, setBursts] = useState<SparkBurstData[]>([]);
  const [introEdgeId, setIntroEdgeId] = useState<string | null>(null);
  const [flashNodeId, setFlashNodeId] = useState<string | null>(null);
  const burstIdRef = useRef(0);
  const lastBurstRef = useRef(0);
  // Nonce of the last connection signal already handled, so toggling effects
  // back on doesn't replay the previous connection's intro/flash/burst.
  const lastConnectNonceRef = useRef<number | null>(null);

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const liveRef = useRef(live);
  liveRef.current = live;

  const removeBurst = useCallback((id: string) => {
    setBursts((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const spawnBurst = useCallback((x: number, y: number) => {
    setBursts((prev) => {
      const id = `b${burstIdRef.current++}`;
      const next = [...prev, { id, x, y }];
      return next.length > MAX_BURSTS
        ? next.slice(next.length - MAX_BURSTS)
        : next;
    });
  }, []);

  // If effects turn off mid-animation (toggle or reduce-motion), drop any
  // in-flight effects so they don't linger or replay when re-enabled.
  useEffect(() => {
    if (!effectsOn) {
      setBursts([]);
      setIntroEdgeId(null);
      setFlashNodeId(null);
    }
  }, [effectsOn]);

  // Connection intro + contact burst + target-node border flash.
  useEffect(() => {
    if (!connectSignal || !effectsOn) return;
    if (connectSignal.nonce === lastConnectNonceRef.current) return;
    lastConnectNonceRef.current = connectSignal.nonce;
    const { edgeId, targetId } = connectSignal;
    setIntroEdgeId(edgeId);
    const contact = setTimeout(() => {
      const target = nodesRef.current.find((n) => n.id === targetId);
      if (target) {
        const a = nodeAnchor(target, liveRef.current[target.id]);
        spawnBurst(a.x + WORLD_OFFSET, a.y + WORLD_OFFSET);
      }
      setFlashNodeId(targetId);
    }, 400);
    const clearIntro = setTimeout(() => setIntroEdgeId(null), 700);
    const clearFlash = setTimeout(
      () => setFlashNodeId((cur) => (cur === targetId ? null : cur)),
      1300,
    );
    return () => {
      clearTimeout(contact);
      clearTimeout(clearIntro);
      clearTimeout(clearFlash);
    };
  }, [connectSignal, effectsOn, spawnBurst]);

  const panRef = useRef<GestureType | undefined>(undefined);
  const pinchRef = useRef<GestureType | undefined>(undefined);

  // Dedicated shared values holding the pan/zoom snapshot at gesture start.
  const startPanXSv = useSharedValue(0);
  const startPanYSv = useSharedValue(0);
  const startZoomSv = useSharedValue(1);

  const handleDragLive = useCallback(
    (id: string, x: number, y: number) => {
      const now = Date.now();
      if (now - lastLive.current < 24) return;
      lastLive.current = now;
      setLive((prev) => ({ ...prev, [id]: { x, y } }));
      if (effectsOn && now - lastBurstRef.current >= DRAG_BURST_MS) {
        lastBurstRef.current = now;
        const node = nodesRef.current.find((n) => n.id === id);
        if (node) {
          const a = nodeAnchor(node, { x, y });
          spawnBurst(a.x + WORLD_OFFSET, a.y + WORLD_OFFSET);
        }
      }
    },
    [effectsOn, spawnBurst],
  );

  const handleDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      setLive((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      onNodeDragEnd(id, x, y);
    },
    [onNodeDragEnd],
  );

  const pan = Gesture.Pan()
    .withRef(panRef)
    .onBegin(() => {
      startPanXSv.value = panX.value;
      startPanYSv.value = panY.value;
    })
    .onUpdate((e) => {
      if (activeNodeId.value !== null) return;
      panX.value = startPanXSv.value + e.translationX;
      panY.value = startPanYSv.value + e.translationY;
    });

  const pinch = Gesture.Pinch()
    .withRef(pinchRef)
    .onBegin(() => {
      startZoomSv.value = zoom.value;
      startPanXSv.value = panX.value;
      startPanYSv.value = panY.value;
    })
    .onUpdate((e) => {
      const nz = clampZoom(startZoomSv.value * e.scale);
      const ratio = nz / startZoomSv.value;
      panX.value = e.focalX - (e.focalX - startPanXSv.value) * ratio;
      panY.value = e.focalY - (e.focalY - startPanYSv.value) * ratio;
      zoom.value = nz;
    });

  const composed = Gesture.Simultaneous(pinch, pan);

  const worldStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: panX.value },
      { translateY: panY.value },
      { scale: zoom.value },
    ],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    onLayoutSize({ width, height });
  };

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      onLayout={onLayout}
    >
      <GestureDetector gesture={composed}>
        <Animated.View style={styles.catcher} collapsable={false}>
          <Animated.View style={[styles.world, worldStyle]}>
            {elements.map((el) => (
              <ElementView key={el.id} el={el} />
            ))}
            <MindmapEdges
              nodes={nodes}
              edges={edges}
              live={live}
              color={colors.mutedForeground}
              energyColor={colors.primary}
              reducedMotion={!effectsOn}
              introEdgeId={introEdgeId}
            />
            {nodes.map((n) => (
              <MindmapNodeView
                key={n.id}
                node={n}
                zoom={zoom}
                activeNodeId={activeNodeId}
                panRef={panRef}
                pinchRef={pinchRef}
                isConnectSource={connectSourceId === n.id}
                isFlashing={flashNodeId === n.id}
                onDragLive={handleDragLive}
                onDragEnd={handleDragEnd}
                onTap={onNodeTap}
                onLongPress={onNodeLongPress}
              />
            ))}
            <MindmapSparks bursts={bursts} onDone={removeBurst} />
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  catcher: {
    flex: 1,
  },
  world: {
    // A large, centered layer so nodes at any (including negative) world
    // coordinate stay inside the parent's bounds -- required on native, where
    // touches are not dispatched to children outside an ancestor's frame.
    position: "absolute",
    left: -WORLD_OFFSET,
    top: -WORLD_OFFSET,
    width: WORLD_SIZE,
    height: WORLD_SIZE,
    transformOrigin: "50% 50%",
  },
});
