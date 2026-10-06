import assert from "node:assert/strict";
import test from "node:test";
import { targetStronglyConnectedComponents } from "./graph-components.js";

test("graph components preserve directed cycles, isolated nodes and selected subgraphs", () => {
  const vertices = new Set(["left", "right", "self", "tail", "isolated"]);
  const edges = new Map([
    ["left", ["right"]], ["right", ["left", "tail"]], ["self", ["self"]],
    ["tail", ["external"]], ["isolated", []],
  ]);
  const selection = targetStronglyConnectedComponents(vertices, vertex => edges.get(vertex) ?? []);
  assert.equal(selection.kind, "resolved");
  if (selection.kind !== "resolved") return;
  const keys = selection.components.map(component => [...component].sort().join(",")).sort();
  assert.deepEqual(keys, ["isolated", "left,right", "self", "tail"]);
  assert.equal(Object.isFrozen(selection), true);
  assert.equal(Object.isFrozen(selection.components), true);
  assert.equal(selection.components.every(Object.isFrozen), true);
});

test("deep source graphs use an explicit traversal stack", () => {
  const vertices = new Set(Array.from({ length: 20_000 }, (_value, index) => index));
  const selection = targetStronglyConnectedComponents(vertices, vertex => vertex + 1 < vertices.size ? [vertex + 1] : []);
  assert.equal(selection.kind, "resolved");
  if (selection.kind !== "resolved") return;
  assert.equal(selection.components.length, vertices.size);
  assert.equal(selection.components.every(component => component.length === 1), true);
});

test("component identity follows source object identity rather than equal labels", () => {
  const first = { name: "value" };
  const second = { name: "value" };
  const selection = targetStronglyConnectedComponents(new Set([first, second]), vertex => vertex === first ? [second] : []);
  assert.equal(selection.kind, "resolved");
  if (selection.kind !== "resolved") return;
  assert.equal(selection.components.length, 2);
  assert.equal(selection.components[0]?.[0] === second, true);
  assert.equal(selection.components[1]?.[0] === first, true);
});

test("malformed and inadequate budgets reject without returning partial components", () => {
  const vertices = new Set([1, 2]);
  for (const limit of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 1, 2]) {
    const selection = targetStronglyConnectedComponents(vertices, vertex => vertex === 1 ? [2] : [1], limit);
    assert.equal(selection.kind, "unresolved", String(limit));
    assert.equal("components" in selection, false, String(limit));
    assert.equal(Object.isFrozen(selection), true, String(limit));
  }
  assert.equal(targetStronglyConnectedComponents(vertices, vertex => vertex === 1 ? [2] : [1], 16).kind, "resolved");
});

test("generic vertex identity agrees with native Map keys including NaN", () => {
  const selection = targetStronglyConnectedComponents(new Set([NaN, 0, -0]), () => []);
  assert.equal(selection.kind, "resolved");
  if (selection.kind !== "resolved") return;
  assert.equal(selection.components.length, 2);
  assert.equal(selection.components.every(component => component.length === 1), true);
});
