import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Mindmap } from "@workspace/db";
import { toMindmap } from "../lib/serialize";

// `toMindmap` must always serialize `data` as a valid mindmap document, even
// for legacy/malformed rows (null, stringified JSON from MariaDB LONGTEXT,
// wrong shapes). A bad row must never white-screen clients reading
// `data.nodes` directly.

function row(data: unknown): Mindmap {
  return {
    id: 1,
    workspaceId: 1,
    name: "Mapa",
    data,
    taskId: null,
    parentId: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  } as Mindmap;
}

const node = {
  id: "n1",
  type: "text",
  x: 10,
  y: 20,
  text: "Olá",
};
const edge = { id: "e1", source: "n1", target: "n2" };
const area = {
  id: "a1",
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  color: "#3b82f6",
};

const element = {
  id: "s1",
  shape: "circle",
  x: 5,
  y: 6,
  width: 80,
  height: 80,
  rotation: 45,
  color: "#3b82f6",
};

describe("toMindmap data normalization", () => {
  it("passes through a valid document unchanged", () => {
    const out = toMindmap(
      row({ nodes: [node], edges: [edge], areas: [area], elements: [element] }),
    );
    assert.deepEqual(out.data.nodes, [node]);
    assert.deepEqual(out.data.edges, [edge]);
    assert.deepEqual(out.data.areas, [area]);
    assert.deepEqual(out.data.elements, [element]);
  });

  it("omits elements when absent and drops non-array elements", () => {
    const out = toMindmap(row({ nodes: [], edges: [] }));
    assert.ok(!("elements" in out.data));
    const bad = toMindmap(row({ nodes: [], edges: [], elements: "oops" }));
    assert.ok(!("elements" in bad.data));
  });

  it("preserves elements through stringified JSON rows", () => {
    const out = toMindmap(
      row(JSON.stringify({ nodes: [], edges: [], elements: [element] })),
    );
    assert.deepEqual(out.data.elements, [element]);
  });

  it("omits areas when absent (optional field)", () => {
    const out = toMindmap(row({ nodes: [], edges: [] }));
    assert.deepEqual(out.data, { nodes: [], edges: [] });
    assert.ok(!("areas" in out.data));
  });

  it("normalizes null data to an empty document", () => {
    const out = toMindmap(row(null));
    assert.deepEqual(out.data, { nodes: [], edges: [] });
  });

  it("normalizes undefined data to an empty document", () => {
    const out = toMindmap(row(undefined));
    assert.deepEqual(out.data, { nodes: [], edges: [] });
  });

  it("parses stringified JSON (MariaDB LONGTEXT behavior)", () => {
    const out = toMindmap(
      row(JSON.stringify({ nodes: [node], edges: [], areas: [area] })),
    );
    assert.deepEqual(out.data.nodes, [node]);
    assert.deepEqual(out.data.edges, []);
    assert.deepEqual(out.data.areas, [area]);
  });

  it("recovers double-encoded JSON strings (legacy imports)", () => {
    const out = toMindmap(
      row(JSON.stringify(JSON.stringify({ nodes: [node], edges: [edge] }))),
    );
    assert.deepEqual(out.data.nodes, [node]);
    assert.deepEqual(out.data.edges, [edge]);
  });

  it("normalizes an unparseable string to an empty document", () => {
    const out = toMindmap(row("not json {"));
    assert.deepEqual(out.data, { nodes: [], edges: [] });
  });

  it("normalizes non-object shapes (array, number) to an empty document", () => {
    assert.deepEqual(toMindmap(row([1, 2, 3])).data, { nodes: [], edges: [] });
    assert.deepEqual(toMindmap(row(42)).data, { nodes: [], edges: [] });
  });

  it("coerces missing/non-array fields while keeping valid ones", () => {
    const out = toMindmap(row({ nodes: "oops", edges: [edge], areas: "bad" }));
    assert.deepEqual(out.data.nodes, []);
    assert.deepEqual(out.data.edges, [edge]);
    assert.ok(!("areas" in out.data));
  });
});
