import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom does not implement the coordinate APIs ProseMirror uses to resolve a
// drop position. Provide minimal implementations that point at the editor's
// content so drag-and-drop handlers can run in tests.
function editorTarget(): Element | null {
  return (
    document.querySelector(".rte-content p") ||
    document.querySelector(".rte-content")
  );
}

if (!document.elementFromPoint) {
  // @ts-expect-error -- polyfilled for jsdom
  document.elementFromPoint = () => editorTarget();
}

if (!document.caretRangeFromPoint) {
  // @ts-expect-error -- polyfilled for jsdom
  document.caretRangeFromPoint = () => {
    const el = editorTarget();
    if (!el) return null;
    const range = document.createRange();
    const node = el.firstChild ?? el;
    try {
      range.setStart(node, 0);
      range.setEnd(node, 0);
    } catch {
      return null;
    }
    return range;
  };
}

const rect = {
  top: 0,
  left: 0,
  right: 100,
  bottom: 20,
  width: 100,
  height: 20,
  x: 0,
  y: 0,
  toJSON() {},
} as DOMRect;

if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () =>
    ({ length: 1, item: () => rect, 0: rect }) as unknown as DOMRectList;
}
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => rect;
}

afterEach(() => {
  cleanup();
});
