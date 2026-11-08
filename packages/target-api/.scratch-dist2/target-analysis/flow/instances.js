import { solveSourceFlow } from "./solver.js";
import { SourceFlowFailure } from "./resources.js";
export function analyzeSourceLiveness(graph, additionalReads, limits = {}) {
    if (additionalReads === undefined || additionalReads === null || typeof additionalReads.get !== "function" ||
        typeof additionalReads[Symbol.iterator] !== "function")
        return Object.freeze({ kind: "unresolved",
            reason: "Source liveness requires an explicit graph-point read inventory.", source: graph.declaration });
    let readsChecked = false;
    const solution = solveSourceFlow(graph, {
        direction: "backward", lattice: sourceFlowSetLattice("union", new Set()),
        transfer(point, input, work) {
            if (!readsChecked) {
                for (const [id, bindings] of additionalReads) {
                    work.step();
                    if (!Number.isSafeInteger(id) || id < 0 || graph.points[id]?.id !== id || !Array.isArray(bindings))
                        throw new SourceFlowFailure("Source liveness additional reads require exact graph points and dense binding data.", graph.declaration);
                    for (let index = 0; index < bindings.length; index += 1) {
                        work.step();
                        const descriptor = Object.getOwnPropertyDescriptor(bindings, index);
                        if (descriptor === undefined || !("value" in descriptor) || descriptor.value === undefined || descriptor.value === null)
                            throw new SourceFlowFailure("Source liveness additional reads require dense binding data.", graph.declaration);
                    }
                }
                readsChecked = true;
            }
            const operation = point.operation;
            const additional = additionalReads.get(point.id);
            if (!("binding" in operation) && (additional === undefined || additional.length === 0))
                return input;
            const live = copySet(input, work);
            if ("binding" in operation) {
                if (operation.kind === "read" || operation.kind === "capture")
                    live.add(operation.binding);
                else
                    live.delete(operation.binding);
            }
            for (const binding of additional ?? []) {
                work.step();
                live.add(binding);
            }
            return live;
        },
    }, limits);
    if (solution.kind === "unresolved")
        return solution;
    const lastUsePoints = new Set();
    const sourceUses = new Map();
    for (const point of graph.points) {
        if (!solution.reachable.has(point.id) || point.operation.kind !== "read" || point.source === undefined)
            continue;
        const last = !solution.after.get(point.id).has(point.operation.binding);
        if (last)
            lastUsePoints.add(point.id);
        sourceUses.set(point.source, (sourceUses.get(point.source) ?? true) && last);
    }
    const lastUses = new Set([...sourceUses].filter(([, last]) => last).map(([source]) => source));
    return Object.freeze({ ...solution, lastUsePoints, lastUses });
}
export function analyzeSourceDefiniteAssignment(graph, limits = {}) {
    const initial = new Set(graph.bindings);
    for (const point of graph.points) {
        const operation = point.operation;
        if (operation.kind === "declare" || operation.kind === "write" && operation.initialization)
            initial.delete(operation.binding);
    }
    const solution = solveSourceFlow(graph, {
        direction: "forward", lattice: sourceFlowSetLattice("intersection", graph.bindings),
        boundary: new Map([[graph.entry, initial]]),
        transfer(point, input, work) {
            const operation = point.operation;
            if (operation.kind !== "declare" && operation.kind !== "write")
                return input;
            const assigned = copySet(input, work);
            if (operation.kind === "write")
                assigned.add(operation.binding);
            else
                assigned.delete(operation.binding);
            return assigned;
        },
    }, limits);
    if (solution.kind === "unresolved")
        return solution;
    const unassignedReads = new Set();
    for (const point of graph.points) {
        if (solution.reachable.has(point.id) && point.operation.kind === "read" && point.source !== undefined &&
            !solution.before.get(point.id).has(point.operation.binding))
            unassignedReads.add(point.source);
    }
    return Object.freeze({ ...solution, unassignedReads });
}
export function analyzeSourceWrites(graph, limits = {}) {
    const empty = new Map();
    const solution = solveSourceFlow(graph, {
        direction: "forward",
        lattice: {
            empty: () => empty,
            equals(left, right, work) {
                if (left === right)
                    return true;
                if (left.size !== right.size)
                    return false;
                for (const [binding, count] of left) {
                    work.step();
                    if (right.get(binding) !== count)
                        return false;
                }
                return true;
            },
            join(left, right, work) {
                if (left === right || right.size === 0)
                    return left;
                if (left.size === 0)
                    return right;
                const joined = copyCounts(left, work);
                for (const [binding, count] of right) {
                    work.step();
                    if (count > (joined.get(binding) ?? 0))
                        joined.set(binding, count);
                }
                return joined;
            },
        },
        transfer(point, input, work) {
            const operation = point.operation;
            if (operation.kind !== "write" && operation.kind !== "declare")
                return input;
            const counts = copyCounts(input, work);
            if (operation.kind === "declare")
                counts.delete(operation.binding);
            else
                counts.set(operation.binding, operation.initialization || (counts.get(operation.binding) ?? 0) === 0 ? 1 : 2);
            return counts;
        },
    }, limits);
    if (solution.kind === "unresolved")
        return solution;
    const maximum = new Map();
    for (const state of solution.after.values()) {
        for (const [binding, count] of state)
            if (count > (maximum.get(binding) ?? 0))
                maximum.set(binding, count);
    }
    return Object.freeze({ ...solution, maximum });
}
function sourceFlowSetLattice(mode, empty) {
    return {
        empty: () => empty,
        equals(left, right, work) {
            if (left === right)
                return true;
            if (left.size !== right.size)
                return false;
            for (const binding of left) {
                work.step();
                if (!right.has(binding))
                    return false;
            }
            return true;
        },
        join(left, right, work) {
            if (left === right)
                return left;
            if (mode === "union" && right.size === 0)
                return left;
            if (mode === "union" && left.size === 0)
                return right;
            const joined = mode === "union" ? copySet(left, work) : new Set();
            for (const binding of mode === "union" ? right : left) {
                work.step();
                if (mode === "union" || right.has(binding))
                    joined.add(binding);
            }
            return joined;
        },
    };
}
function copySet(input, work) {
    const result = new Set();
    for (const binding of input) {
        work.step();
        result.add(binding);
    }
    return result;
}
function copyCounts(input, work) {
    const result = new Map();
    for (const [binding, count] of input) {
        work.step();
        result.set(binding, count);
    }
    return result;
}
//# sourceMappingURL=instances.js.map