import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

// Blue spark palette mirrors the web editor (mindmap-energy.tsx).
const SPARK_COLORS = ["#3b82f6", "#60a5fa", "#93c5fd"];
const PARTICLE_COUNT = 10;

export type SparkBurstData = { id: string; x: number; y: number };

type ParticleSpec = {
  angle: number;
  dist: number;
  size: number;
  color: string;
};

function Particle({
  spec,
  progress,
}: {
  spec: ParticleSpec;
  progress: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const d = spec.dist * p;
    return {
      transform: [
        { translateX: Math.cos(spec.angle) * d },
        { translateY: Math.sin(spec.angle) * d },
        { scale: 1 - p * 0.6 },
      ],
      opacity: 1 - p,
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: spec.size,
          height: spec.size,
          borderRadius: spec.size / 2,
          backgroundColor: spec.color,
        },
        style,
      ]}
    />
  );
}

function SparkBurst({
  id,
  x,
  y,
  onDone,
}: SparkBurstData & { onDone: (id: string) => void }) {
  const progress = useSharedValue(0);
  const particles = useMemo<ParticleSpec[]>(
    () =>
      Array.from({ length: PARTICLE_COUNT }, () => ({
        angle: Math.random() * Math.PI * 2,
        dist: 14 + Math.random() * 24,
        size: 3 + Math.random() * 3,
        color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
      })),
    [],
  );

  useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: 450 + Math.random() * 150 },
      (finished) => {
        if (finished) runOnJS(onDone)(id);
      },
    );
  }, [id, onDone, progress]);

  return (
    <View pointerEvents="none" style={[styles.burst, { left: x, top: y }]}>
      {particles.map((spec, i) => (
        <Particle key={i} spec={spec} progress={progress} />
      ))}
    </View>
  );
}

function MindmapSparksInner({
  bursts,
  onDone,
}: {
  bursts: SparkBurstData[];
  onDone: (id: string) => void;
}) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bursts.map((b) => (
        <SparkBurst key={b.id} {...b} onDone={onDone} />
      ))}
    </View>
  );
}

export const MindmapSparks = React.memo(MindmapSparksInner);

const styles = StyleSheet.create({
  burst: {
    position: "absolute",
    width: 0,
    height: 0,
  },
});
