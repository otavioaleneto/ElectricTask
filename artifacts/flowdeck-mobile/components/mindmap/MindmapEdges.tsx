import React, { useEffect } from "react";
import Svg, { Line, Path, Polygon } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import type { MindmapEdge, MindmapNode } from "@workspace/api-client-react";

import { nodeAnchor, WORLD_OFFSET, WORLD_SIZE, type Pos } from "./shared";

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Deterministic per-edge phase so wires don't all wave in sync (mirrors web).
function hashPhase(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 1000) / 1000) * Math.PI * 2;
}

// Wavy "energized cable" path. Endpoints stay fixed (sin(0)=sin(PI)=0 envelope
// + last-segment env forced to 0) so arrowheads stay aligned with the chord.
// Same wave math as the web editor, segments capped at 14 for native perf.
function wirePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  time: number,
  phase: number,
): string {
  "worklet";
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 12) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const nx = -dy / len;
  const ny = dx / len;
  const segs = Math.min(14, Math.max(6, Math.round(len / 40)));
  const amp = Math.min(5, 2 + len * 0.015);
  let d = `M ${x1} ${y1}`;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const env = i === segs ? 0 : Math.sin(Math.PI * t);
    const wave =
      Math.sin(t * len * 0.045 + time * 0.006 + phase) * amp +
      Math.sin(t * len * 0.11 - time * 0.011 + phase * 2) * amp * 0.35;
    const off = env * wave;
    d += ` L ${(x1 + dx * t + nx * off).toFixed(2)} ${(
      y1 +
      dy * t +
      ny * off
    ).toFixed(2)}`;
  }
  return d;
}

function arrowHead(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  color: string,
  key: string,
) {
  const angle = Math.atan2(by - ay, bx - ax);
  const size = 12;
  const spread = Math.PI / 7;
  const left = angle + Math.PI - spread;
  const right = angle + Math.PI + spread;
  const p1x = bx + size * Math.cos(left);
  const p1y = by + size * Math.sin(left);
  const p2x = bx + size * Math.cos(right);
  const p2y = by + size * Math.sin(right);
  return (
    <Polygon
      key={key}
      points={`${bx},${by} ${p1x},${p1y} ${p2x},${p2y}`}
      fill={color}
    />
  );
}

function EnergyEdge({
  ax,
  ay,
  bx,
  by,
  phase,
  directed,
  color,
  clock,
  isIntro,
}: {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  phase: number;
  directed: boolean | null | undefined;
  color: string;
  clock: SharedValue<number>;
  isIntro: boolean;
}) {
  const len = Math.hypot(bx - ax, by - ay);
  const pulseSeg = Math.max(8, len * 0.12);
  const growth = useSharedValue(isIntro ? 0 : 1);

  // Connection intro: grow from source -> target (dashoffset len -> 0).
  useEffect(() => {
    if (isIntro) {
      growth.value = 0;
      growth.value = withTiming(1, { duration: 450 });
    } else {
      growth.value = 1;
    }
  }, [isIntro, growth]);

  const glowProps = useAnimatedProps(() => ({
    d: wirePath(ax, ay, bx, by, clock.value, phase),
  }));
  const cableProps = useAnimatedProps(() => ({
    d: wirePath(ax, ay, bx, by, clock.value, phase),
  }));
  const pulseProps = useAnimatedProps(() => ({
    d: wirePath(ax, ay, bx, by, clock.value, phase),
    strokeDashoffset: -((clock.value * 0.12) % (len + pulseSeg)),
  }));
  const growProps = useAnimatedProps(() => ({
    d: wirePath(ax, ay, bx, by, clock.value, phase),
    strokeDashoffset: len * (1 - growth.value),
  }));

  return (
    <>
      <AnimatedPath
        animatedProps={glowProps}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeOpacity={0.14}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <AnimatedPath
        animatedProps={cableProps}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeOpacity={0.55}
        strokeLinejoin="round"
      />
      {/* Pulse and arrowhead stay hidden while the intro wire is growing
          (matches the web editor's behavior). */}
      {!isIntro ? (
        <AnimatedPath
          animatedProps={pulseProps}
          fill="none"
          stroke={color}
          strokeWidth={3.25}
          strokeOpacity={0.9}
          strokeDasharray={[pulseSeg, len]}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {isIntro ? (
        <AnimatedPath
          animatedProps={growProps}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeDasharray={[len, len]}
          strokeLinecap="round"
        />
      ) : null}
      {directed && !isIntro ? arrowHead(ax, ay, bx, by, color, "arrow") : null}
    </>
  );
}

function MindmapEdgesInner({
  nodes,
  edges,
  live,
  color,
  energyColor,
  reducedMotion,
  introEdgeId,
}: {
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  live: Record<string, Pos>;
  color: string;
  energyColor: string;
  reducedMotion: boolean;
  introEdgeId: string | null;
}) {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Single shared clock driving every wire worklet (no per-frame React state).
  const clock = useSharedValue(0);
  const frame = useFrameCallback((info) => {
    "worklet";
    clock.value = info.timeSinceFirstFrame;
  }, false);
  useEffect(() => {
    frame.setActive(!reducedMotion);
  }, [reducedMotion, frame]);

  return (
    <Svg
      pointerEvents="none"
      style={{ position: "absolute", left: 0, top: 0 }}
      width={WORLD_SIZE}
      height={WORLD_SIZE}
    >
      {edges.map((e) => {
        const s = byId.get(e.source);
        const t = byId.get(e.target);
        if (!s || !t) return null;
        const a = nodeAnchor(s, live[s.id]);
        const b = nodeAnchor(t, live[t.id]);
        const ax = a.x + WORLD_OFFSET;
        const ay = a.y + WORLD_OFFSET;
        const bx = b.x + WORLD_OFFSET;
        const by = b.y + WORLD_OFFSET;

        if (reducedMotion) {
          return (
            <React.Fragment key={e.id}>
              <Line
                x1={ax}
                y1={ay}
                x2={bx}
                y2={by}
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
              />
              {e.directed
                ? arrowHead(ax, ay, bx, by, color, `${e.id}-arrow`)
                : null}
            </React.Fragment>
          );
        }

        return (
          <EnergyEdge
            key={e.id}
            ax={ax}
            ay={ay}
            bx={bx}
            by={by}
            phase={hashPhase(e.id)}
            directed={e.directed}
            color={energyColor}
            clock={clock}
            isIntro={introEdgeId === e.id}
          />
        );
      })}
    </Svg>
  );
}

export const MindmapEdges = React.memo(MindmapEdgesInner);
