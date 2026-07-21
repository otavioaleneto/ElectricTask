import type { MindmapNode } from "@workspace/api-client-react";

export const NODE_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#3b82f6",
  "#22c55e",
  "#8b5cf6",
  "#ec4899",
];

export const ZOOM_MIN = 0.3;
export const ZOOM_MAX = 2;

// The SVG edge layer lives in world coordinates. Because SVG clips to its own
// viewport, we offset it into negative space so edges with negative world
// coordinates still render.
export const WORLD_OFFSET = 2000;
export const WORLD_SIZE = WORLD_OFFSET * 2;

export type NodeType =
  | "text"
  | "project"
  | "label"
  | "hotspot"
  | "mindmap"
  | "task"
  | "light";

export type Pos = { x: number; y: number };

export function genId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/** Fixed anchor offsets mirror the web editor (no DOM measuring on native). */
export function nodeAnchor(node: MindmapNode, live?: Pos): Pos {
  const x = live ? live.x : node.x;
  const y = live ? live.y : node.y;
  if (node.type === "hotspot") return { x: x + 16, y: y + 16 };
  if (node.type === "light") return { x: x + 20, y: y + 20 };
  if (node.type === "label") return { x: x + 24, y: y + 12 };
  return { x: x + 60, y: y + 24 };
}

export function clampZoom(z: number): number {
  "worklet";
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/** Convert stored rich-text HTML details into plain text for mobile editing. */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function typeLabel(type: NodeType): string {
  switch (type) {
    case "project":
      return "Projeto";
    case "task":
      return "Tarefa";
    case "label":
      return "Rótulo";
    case "hotspot":
      return "Ponto";
    case "mindmap":
      return "Mapa mental";
    case "light":
      return "Ponto de luz";
    default:
      return "Texto";
  }
}
