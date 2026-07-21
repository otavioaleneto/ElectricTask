import { useRef } from "react";
import type { MindmapNode, MindmapArea } from "@workspace/api-client-react";

const MM_W = 180;
const MM_H = 130;
const MM_PAD = 8;

function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function nodeSize(n: MindmapNode): { w: number; h: number } {
  if (n.type === "hotspot") return { w: 28, h: 28 };
  if (n.type === "label")
    return {
      w: Math.min(220, Math.max(40, (n.label?.length ?? 4) * 7 + 12)),
      h: 24,
    };
  return { w: 150, h: 56 };
}

interface MinimapProps {
  nodes: MindmapNode[];
  areas: MindmapArea[];
  pan: { x: number; y: number };
  zoom: number;
  viewport: { width: number; height: number };
  onNavigate: (worldX: number, worldY: number) => void;
}

export function MindmapMinimap({
  nodes,
  areas,
  pan,
  zoom,
  viewport,
  onNavigate,
}: MinimapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  if (nodes.length === 0 && areas.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const boxes = nodes.map((n) => {
    const s = nodeSize(n);
    return { id: n.id, x: n.x, y: n.y, w: s.w, h: s.h, color: n.color || "#64748b" };
  });
  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  for (const a of areas) {
    minX = Math.min(minX, a.x);
    minY = Math.min(minY, a.y);
    maxX = Math.max(maxX, a.x + a.width);
    maxY = Math.max(maxY, a.y + a.height);
  }

  const hasViewport = viewport.width > 0 && viewport.height > 0;
  const vx0 = -pan.x / zoom;
  const vy0 = -pan.y / zoom;
  const vx1 = (viewport.width - pan.x) / zoom;
  const vy1 = (viewport.height - pan.y) / zoom;
  if (hasViewport) {
    minX = Math.min(minX, vx0);
    minY = Math.min(minY, vy0);
    maxX = Math.max(maxX, vx1);
    maxY = Math.max(maxY, vy1);
  }

  const worldW = Math.max(1, maxX - minX);
  const worldH = Math.max(1, maxY - minY);
  const innerW = MM_W - MM_PAD * 2;
  const innerH = MM_H - MM_PAD * 2;
  const scale = Math.min(innerW / worldW, innerH / worldH);
  const offX = MM_PAD + (innerW - worldW * scale) / 2;
  const offY = MM_PAD + (innerH - worldH * scale) / 2;
  const mm = (wx: number, wy: number) => ({
    x: offX + (wx - minX) * scale,
    y: offY + (wy - minY) * scale,
  });

  const navigate = (clientX: number, clientY: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const wx = (clientX - r.left - offX) / scale + minX;
    const wy = (clientY - r.top - offY) / scale + minY;
    onNavigate(wx, wy);
  };

  const vp = hasViewport ? mm(vx0, vy0) : null;

  return (
    <div
      ref={ref}
      className="absolute bottom-3 left-3 z-30 cursor-pointer overflow-hidden rounded-lg border border-border bg-background/90 shadow-md backdrop-blur"
      style={{ width: MM_W, height: MM_H }}
      title="Minimapa - clique ou arraste para navegar"
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        dragging.current = true;
        ref.current?.setPointerCapture(e.pointerId);
        navigate(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (dragging.current) navigate(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        dragging.current = false;
        ref.current?.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    >
      {areas.map((a) => {
        const p = mm(a.x, a.y);
        return (
          <div
            key={a.id}
            className="absolute rounded-[2px]"
            style={{
              left: p.x,
              top: p.y,
              width: Math.max(2, a.width * scale),
              height: Math.max(2, a.height * scale),
              backgroundColor: withAlpha(a.color, 0.15),
              border: `1px solid ${withAlpha(a.color, 0.5)}`,
            }}
          />
        );
      })}
      {boxes.map((b) => {
        const p = mm(b.x, b.y);
        return (
          <div
            key={b.id}
            className="absolute rounded-[1px]"
            style={{
              left: p.x,
              top: p.y,
              width: Math.max(2, b.w * scale),
              height: Math.max(2, b.h * scale),
              backgroundColor: b.color,
            }}
          />
        );
      })}
      {vp && (
        <div
          className="pointer-events-none absolute rounded-[2px] border border-primary bg-primary/10"
          style={{
            left: vp.x,
            top: vp.y,
            width: (vx1 - vx0) * scale,
            height: (vy1 - vy0) * scale,
          }}
        />
      )}
    </div>
  );
}
