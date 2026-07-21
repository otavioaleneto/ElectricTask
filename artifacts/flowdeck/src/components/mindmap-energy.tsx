// Visual "energy" effects for the mindmap editor (ElectricTask brand):
// - EnergyWire: edges rendered as live power cables (oscillating path with a
//   glow halo and a bright pulse travelling along the wire).
// - useEnergyParticles: canvas-based blue sparks emitted while dragging nodes.
// All animation runs outside React (single rAF loops mutating DOM/canvas), so
// no React re-renders happen per frame. Everything is disabled when the user
// prefers reduced motion.
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

export interface WireEntry {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  phase: number;
  glow: SVGPathElement | null;
  cable: SVGPathElement | null;
  pulse: SVGPathElement | null;
}

export type WireRegistry = Map<string, WireEntry>;

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

// Deterministic per-edge phase so wires don't all wave in sync.
function hashPhase(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 1000) / 1000) * Math.PI * 2;
}

// Builds the wavy "energized cable" path between two points at a given time.
// The endpoints stay fixed (sin(0)=sin(PI)=0 envelope) so arrows/anchors and
// the mid-edge delete button remain aligned with the straight chord.
function wirePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  time: number,
  phase: number,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 12) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const nx = -dy / len;
  const ny = dx / len;
  const segs = Math.min(24, Math.max(6, Math.round(len / 24)));
  const amp = Math.min(5, 2 + len * 0.015);
  // Sample the oscillating offsets, then join the samples with quadratic
  // curves (through segment midpoints) so the cable bends smoothly instead of
  // looking like straight segments chained together.
  const pts: Array<[number, number]> = [[x1, y1]];
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const env = i === segs ? 0 : Math.sin(Math.PI * t);
    const wave =
      Math.sin(t * len * 0.045 + time * 0.006 + phase) * amp +
      Math.sin(t * len * 0.11 - time * 0.011 + phase * 2) * amp * 0.35;
    const off = env * wave;
    pts.push([x1 + dx * t + nx * off, y1 + dy * t + ny * off]);
  }
  let d = `M ${x1} ${y1}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    const mx = (px + pts[i + 1][0]) / 2;
    const my = (py + pts[i + 1][1]) / 2;
    d += ` Q ${px.toFixed(2)} ${py.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  d += ` L ${lx.toFixed(2)} ${ly.toFixed(2)}`;
  return d;
}

// Single rAF loop that animates every registered wire (no per-edge loops and
// no React state involved).
export function useEnergyWires(
  registry: MutableRefObject<WireRegistry>,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const tick = (now: number) => {
      for (const w of registry.current.values()) {
        const d = wirePath(w.x1, w.y1, w.x2, w.y2, now, w.phase);
        w.glow?.setAttribute("d", d);
        w.cable?.setAttribute("d", d);
        w.pulse?.setAttribute("d", d);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, registry]);
}

export function EnergyWire({
  edgeId,
  x1,
  y1,
  x2,
  y2,
  directed,
  registry,
  animate,
  intro,
  onIntroEnd,
}: {
  edgeId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  directed?: boolean | null;
  registry: MutableRefObject<WireRegistry>;
  animate: boolean;
  /** Play a one-shot "grow from source to target" reveal on this wire. */
  intro?: boolean;
  /** Fired once when the grow reveal reaches the target endpoint. */
  onIntroEnd?: () => void;
}) {
  const glowRef = useRef<SVGPathElement>(null);
  const cableRef = useRef<SVGPathElement>(null);
  const pulseRef = useRef<SVGPathElement>(null);
  const phase = useMemo(() => hashPhase(edgeId), [edgeId]);
  const [growing, setGrowing] = useState(() => !!intro);
  // Only treat the wire as growing while effects are on; if effects get
  // toggled off mid-reveal the wire falls back to its final static look.
  const grow = animate && growing;

  // Keep the registry entry fresh on every render (endpoints move during
  // drags) and paint an initial wavy path synchronously so there is never a
  // straight-line flash between a React commit and the next rAF tick.
  useLayoutEffect(() => {
    if (!animate) return;
    registry.current.set(edgeId, {
      x1,
      y1,
      x2,
      y2,
      phase,
      glow: glowRef.current,
      cable: cableRef.current,
      pulse: pulseRef.current,
    });
    const d = wirePath(x1, y1, x2, y2, performance.now(), phase);
    glowRef.current?.setAttribute("d", d);
    cableRef.current?.setAttribute("d", d);
    pulseRef.current?.setAttribute("d", d);
  });

  useLayoutEffect(() => {
    const reg = registry.current;
    return () => {
      reg.delete(edgeId);
    };
  }, [edgeId, registry]);

  // Frozen (but still curved) cable for reduced motion / effects off.
  const staticD = useMemo(
    () => wirePath(x1, y1, x2, y2, 0, phase),
    [x1, y1, x2, y2, phase],
  );
  // While growing, normalize the path length and animate the dash offset so
  // the wire visibly extends from the source toward the target.
  const growProps = grow
    ? {
        pathLength: 100,
        strokeDasharray: "100 100",
        className: "mindmap-energy-grow",
      }
    : {};

  return (
    <>
      <path
        ref={glowRef}
        d={animate ? undefined : staticD}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={6}
        strokeOpacity={0.14}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...growProps}
      />
      <path
        ref={cableRef}
        d={animate ? undefined : staticD}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        strokeOpacity={0.55}
        strokeLinejoin="round"
        markerEnd={directed && !grow ? "url(#arrowhead)" : undefined}
        {...growProps}
        onAnimationEnd={
          grow
            ? () => {
                setGrowing(false);
                onIntroEnd?.();
              }
            : undefined
        }
      />
      {animate && !grow && (
        <path
          ref={pulseRef}
          className="mindmap-energy-pulse"
          fill="none"
          pathLength={100}
          strokeDasharray="10 90"
          stroke="hsl(var(--primary))"
          strokeWidth={3.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            animationDelay: `-${((phase / (Math.PI * 2)) * 1.6).toFixed(2)}s`,
          }}
        />
      )}
    </>
  );
}

// ---- Plasma ball ("ponto de luz") ------------------------------------------
// Canvas-based Tesla plasma ball: jittery electric rays wander from a bright
// white core to the glass edge, in hues derived from the node color. Static
// single frame when `animate` is false (reduced motion / effects off).

function hexToHue(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 217; // brand blue fallback
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 217;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return Math.round(((h * 60) + 360) % 360);
}

export function PlasmaBall({
  size = 48,
  color = "#3b82f6",
  animate,
}: {
  size?: number;
  color?: string;
  animate: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 1.5;
    const coreRadius = Math.max(2.2, size * 0.06);
    const hue = hexToHue(color);
    const segments = 9;
    const jitterAmount = size * 0.18;

    const rays = Array.from({ length: 7 }, () => ({
      angle: Math.random() * Math.PI * 2,
      speed: (Math.random() - 0.5) * 0.05,
      hue: hue - 10 + Math.random() * 40,
      thickness: Math.random() * 0.6 + 0.45,
    }));

    const drawRay = (
      targetX: number,
      targetY: number,
      strokeStyle: string,
      thickness: number,
    ) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      let px = cx;
      let py = cy;
      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        // Noise is strongest mid-ray and fades toward both ends.
        const jitter = jitterAmount * Math.sin(t * Math.PI);
        px = cx + (targetX - cx) * t + (Math.random() - 0.5) * jitter;
        py = cy + (targetY - cy) * t + (Math.random() - 0.5) * jitter;
        ctx.lineTo(px, py);
      }
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = thickness;
      ctx.shadowBlur = 6;
      ctx.shadowColor = strokeStyle;
      ctx.stroke();
      // Spark where the ray touches the glass.
      ctx.beginPath();
      ctx.arc(px, py, thickness * 1.4, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    };

    let raf = 0;
    const frame = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      for (const ray of rays) {
        ray.angle += ray.speed;
        drawRay(
          cx + Math.cos(ray.angle) * radius,
          cy + Math.sin(ray.angle) * radius,
          `hsl(${ray.hue}, 100%, 70%)`,
          ray.thickness,
        );
      }
      // Bright white electrode core with a colored glow.
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 12;
      ctx.shadowColor = `hsl(${hue}, 100%, 55%)`;
      ctx.fill();
      // Pulsing halo around the core.
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        coreRadius + (animate ? Math.random() * 1.6 + 1.2 : 1.6),
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = `hsla(${hue}, 100%, 60%, 0.4)`;
      ctx.fill();
      if (animate) raf = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [size, color, animate]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="rounded-full"
      aria-hidden
    />
  );
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  r: number;
  color: string;
}

const SPARK_COLORS = ["#3b82f6", "#60a5fa", "#93c5fd"];
const MAX_SPARKS = 160;

// Canvas overlay (screen space) that draws short-lived blue sparks. The loop
// only runs while sparks are alive; spawning is distance-throttled.
export function useEnergyParticles(enabled: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastSpawnRef = useRef<{ x: number; y: number } | null>(null);
  const lastTimeRef = useRef(0);

  const loopRef = useRef<(now: number) => void>(() => {});
  loopRef.current = (now: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      rafRef.current = null;
      sparksRef.current = [];
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const dt = Math.min(48, now - (lastTimeRef.current || now));
    lastTimeRef.current = now;
    const friction = Math.pow(0.94, dt / 16);
    const alive: Spark[] = [];
    ctx.globalCompositeOperation = "lighter";
    for (const s of sparksRef.current) {
      s.life -= dt;
      if (s.life <= 0) continue;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= friction;
      s.vy = s.vy * friction + 0.0015 * dt;
      const a = s.life / s.maxLife;
      ctx.fillStyle = s.color;
      ctx.globalAlpha = a * 0.3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      alive.push(s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    sparksRef.current = alive;
    if (alive.length > 0) {
      rafRef.current = requestAnimationFrame((t) => loopRef.current(t));
    } else {
      ctx.clearRect(0, 0, w, h);
      rafRef.current = null;
      lastTimeRef.current = 0;
    }
  };

  // Radial burst used when a new connection reaches its target node.
  const spawnBurst = (x: number, y: number) => {
    if (!enabled) return;
    const count = 14 + Math.floor(Math.random() * 6);
    const sparks = sparksRef.current;
    if (sparks.length + count > MAX_SPARKS) {
      sparks.splice(0, sparks.length + count - MAX_SPARKS);
    }
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.7;
      const speed = 0.08 + Math.random() * 0.22;
      const maxLife = 420 + Math.random() * 380;
      sparks.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.03,
        life: maxLife,
        maxLife,
        r: 1.2 + Math.random() * 1.8,
        color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
      });
    }
    if (rafRef.current == null) {
      lastTimeRef.current = 0;
      rafRef.current = requestAnimationFrame((t) => loopRef.current(t));
    }
  };

  const spawnSparks = (x: number, y: number) => {
    if (!enabled) return;
    const prev = lastSpawnRef.current;
    if (prev && Math.hypot(x - prev.x, y - prev.y) < 7) return;
    lastSpawnRef.current = { x, y };
    const count = 2 + Math.floor(Math.random() * 3);
    const sparks = sparksRef.current;
    if (sparks.length + count > MAX_SPARKS) {
      sparks.splice(0, sparks.length + count - MAX_SPARKS);
    }
    for (let i = 0; i < count; i++) {
      const maxLife = 380 + Math.random() * 320;
      sparks.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16 - 0.02,
        life: maxLife,
        maxLife,
        r: 1 + Math.random() * 1.6,
        color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
      });
    }
    if (rafRef.current == null) {
      lastTimeRef.current = 0;
      rafRef.current = requestAnimationFrame((t) => loopRef.current(t));
    }
  };

  useEffect(() => {
    if (!enabled) {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      sparksRef.current = [];
      lastTimeRef.current = 0;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [enabled]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return { sparkCanvasRef: canvasRef, spawnSparks, spawnBurst };
}
