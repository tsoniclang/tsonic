import { test } from "node:test";
import assert from "node:assert/strict";
import { Map as SyncMapBacking } from "../../go/sync.js";
import { SyncSet_Has } from "../collections/syncset.js";
import {
  BreadthFirstSearchParallel,
  BreadthFirstSearchParallelEx,
} from "./bfs.js";
import type { SyncSet } from "../collections/syncset.js";
import type { BreadthFirstSearchOptions } from "./bfs.js";

function childrenFromGraph(graph: ReadonlyMap<string, readonly string[]>): (node: string) => string[] {
  return (node: string): string[] => [...(graph.get(node) ?? [])];
}

function makeVisitedSet(): SyncSet<string> {
  return {
    m: {
      __tsgoBlank0: [],
      __tsgoBlank1: [],
      m: new SyncMapBacking<string, { readonly __tsgoEmpty?: never }>(),
    },
  } as SyncSet<string>;
}

function makeOptions(visited: SyncSet<string>): BreadthFirstSearchOptions<string, string> {
  return {
    Visited: visited,
    PreprocessLevel: undefined as unknown as BreadthFirstSearchOptions<string, string>["PreprocessLevel"],
  };
}

test("BreadthFirstSearchParallel finds a specific node", () => {
  const graph = new Map<string, readonly string[]>([
    ["A", ["B", "C"]],
    ["B", ["D"]],
    ["C", ["D"]],
    ["D", []],
  ]);

  const result = BreadthFirstSearchParallel("A", childrenFromGraph(graph), (node: string): [boolean, boolean] => {
    return [node === "D", true];
  });

  assert.equal(result.Stopped, true);
  assert.deepEqual(result.Path, ["D", "B", "A"]);
});

test("BreadthFirstSearchParallel visits all nodes when visit never stops", () => {
  const graph = new Map<string, readonly string[]>([
    ["A", ["B", "C"]],
    ["B", ["D"]],
    ["C", ["D"]],
    ["D", []],
  ]);
  const visitedNodes: string[] = [];

  const result = BreadthFirstSearchParallel("A", childrenFromGraph(graph), (node: string): [boolean, boolean] => {
    visitedNodes.push(node);
    return [false, false];
  });

  assert.equal(result.Stopped, false);
  assert.deepEqual(result.Path, []);
  assert.deepEqual(visitedNodes.sort(), ["A", "B", "C", "D"]);
});

test("BreadthFirstSearchParallelEx stops before visiting deeper levels", () => {
  const graph = new Map<string, readonly string[]>([
    ["Root", ["L1A", "L1B"]],
    ["L1A", ["L2A", "L2B"]],
    ["L1B", ["L2C"]],
    ["L2A", ["L3A"]],
    ["L2B", []],
    ["L2C", []],
    ["L3A", []],
  ]);
  const visited = makeVisitedSet();

  BreadthFirstSearchParallelEx(
    "Root",
    childrenFromGraph(graph),
    (node: string): [boolean, boolean] => [node === "L2B", true],
    makeOptions(visited),
    (node: string): string => node,
  );

  assert.equal(SyncSet_Has(visited, "Root"), true);
  assert.equal(SyncSet_Has(visited, "L1A"), true);
  assert.equal(SyncSet_Has(visited, "L1B"), true);
  assert.equal(SyncSet_Has(visited, "L2A"), true);
  assert.equal(SyncSet_Has(visited, "L2B"), true);
  assert.equal(SyncSet_Has(visited, "L3A"), false);
});

test("BreadthFirstSearchParallelEx returns fallback when no stop result exists", () => {
  const graph = new Map<string, readonly string[]>([
    ["A", ["B", "C"]],
    ["B", ["D"]],
    ["C", ["D"]],
    ["D", []],
  ]);
  const visited = makeVisitedSet();

  const result = BreadthFirstSearchParallelEx(
    "A",
    childrenFromGraph(graph),
    (node: string): [boolean, boolean] => [node === "A", false],
    makeOptions(visited),
    (node: string): string => node,
  );

  assert.equal(result.Stopped, false);
  assert.deepEqual(result.Path, ["A"]);
  assert.equal(SyncSet_Has(visited, "B"), true);
  assert.equal(SyncSet_Has(visited, "C"), true);
  assert.equal(SyncSet_Has(visited, "D"), true);
});

test("BreadthFirstSearchParallel prefers a stop result over fallback", () => {
  const graph = new Map<string, readonly string[]>([
    ["A", ["B", "C"]],
    ["B", ["D"]],
    ["C", ["D"]],
    ["D", []],
  ]);

  const result = BreadthFirstSearchParallel("A", childrenFromGraph(graph), (node: string): [boolean, boolean] => {
    switch (node) {
      case "A":
        return [true, false];
      case "D":
        return [true, true];
      default:
        return [false, false];
    }
  });

  assert.equal(result.Stopped, true);
  assert.deepEqual(result.Path, ["D", "B", "A"]);
});
