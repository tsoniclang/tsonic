import { test } from "node:test";
import assert from "node:assert/strict";
import { Map as SyncMapBacking } from "../../go/sync.js";
import { SyncSet_Has } from "../collections/syncset.js";
import { BreadthFirstSearchParallel, BreadthFirstSearchParallelEx, } from "./bfs.js";
function childrenFromGraph(graph) {
    return (node) => [...(graph.get(node) ?? [])];
}
function makeVisitedSet() {
    return {
        m: {
            __tsgoBlank0: [],
            __tsgoBlank1: [],
            m: new SyncMapBacking(),
        },
    };
}
function makeOptions(visited) {
    return {
        Visited: visited,
        PreprocessLevel: undefined,
    };
}
test("BreadthFirstSearchParallel finds a specific node", () => {
    const graph = new Map([
        ["A", ["B", "C"]],
        ["B", ["D"]],
        ["C", ["D"]],
        ["D", []],
    ]);
    const result = BreadthFirstSearchParallel("A", childrenFromGraph(graph), (node) => {
        return [node === "D", true];
    });
    assert.equal(result.Stopped, true);
    assert.deepEqual(result.Path, ["D", "B", "A"]);
});
test("BreadthFirstSearchParallel visits all nodes when visit never stops", () => {
    const graph = new Map([
        ["A", ["B", "C"]],
        ["B", ["D"]],
        ["C", ["D"]],
        ["D", []],
    ]);
    const visitedNodes = [];
    const result = BreadthFirstSearchParallel("A", childrenFromGraph(graph), (node) => {
        visitedNodes.push(node);
        return [false, false];
    });
    assert.equal(result.Stopped, false);
    assert.deepEqual(result.Path, []);
    assert.deepEqual(visitedNodes.sort(), ["A", "B", "C", "D"]);
});
test("BreadthFirstSearchParallelEx stops before visiting deeper levels", () => {
    const graph = new Map([
        ["Root", ["L1A", "L1B"]],
        ["L1A", ["L2A", "L2B"]],
        ["L1B", ["L2C"]],
        ["L2A", ["L3A"]],
        ["L2B", []],
        ["L2C", []],
        ["L3A", []],
    ]);
    const visited = makeVisitedSet();
    BreadthFirstSearchParallelEx("Root", childrenFromGraph(graph), (node) => [node === "L2B", true], makeOptions(visited), (node) => node);
    assert.equal(SyncSet_Has(visited, "Root"), true);
    assert.equal(SyncSet_Has(visited, "L1A"), true);
    assert.equal(SyncSet_Has(visited, "L1B"), true);
    assert.equal(SyncSet_Has(visited, "L2A"), true);
    assert.equal(SyncSet_Has(visited, "L2B"), true);
    assert.equal(SyncSet_Has(visited, "L3A"), false);
});
test("BreadthFirstSearchParallelEx returns fallback when no stop result exists", () => {
    const graph = new Map([
        ["A", ["B", "C"]],
        ["B", ["D"]],
        ["C", ["D"]],
        ["D", []],
    ]);
    const visited = makeVisitedSet();
    const result = BreadthFirstSearchParallelEx("A", childrenFromGraph(graph), (node) => [node === "A", false], makeOptions(visited), (node) => node);
    assert.equal(result.Stopped, false);
    assert.deepEqual(result.Path, ["A"]);
    assert.equal(SyncSet_Has(visited, "B"), true);
    assert.equal(SyncSet_Has(visited, "C"), true);
    assert.equal(SyncSet_Has(visited, "D"), true);
});
test("BreadthFirstSearchParallel prefers a stop result over fallback", () => {
    const graph = new Map([
        ["A", ["B", "C"]],
        ["B", ["D"]],
        ["C", ["D"]],
        ["D", []],
    ]);
    const result = BreadthFirstSearchParallel("A", childrenFromGraph(graph), (node) => {
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
//# sourceMappingURL=bfs.test.js.map