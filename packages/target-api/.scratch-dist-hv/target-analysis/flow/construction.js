import { createSourceFlowBudget, SourceFlowFailure } from "./resources.js";
export function createSourceFlowConstruction(declaration, limits) {
    const points = [];
    const sourcePoints = new Map();
    const executionRegions = new Map();
    let execution;
    const bindings = new Set();
    const budget = createSourceFlowBudget(limits, declaration);
    let edges = 0;
    let depth = 0;
    const point = (origin, operation) => {
        budget.step(origin);
        if (points.length >= limits.maximumPoints)
            throw new SourceFlowFailure("Source flow exceeds its finite point budget.", origin, { subject: declaration, dimension: "maximumPoints", limit: limits.maximumPoints });
        const id = points.length;
        points.push({ id, source: origin, operation: Object.freeze(operation), successors: [], predecessors: [] });
        if (execution !== undefined)
            executionRegions.set(id, execution);
        if (origin !== undefined) {
            const existing = sourcePoints.get(origin);
            if (existing === undefined)
                sourcePoints.set(origin, [id]);
            else
                existing.push(id);
        }
        if ("binding" in operation)
            bindings.add(operation.binding);
        return id;
    };
    const edge = (from, to, kind = "normal") => {
        budget.step();
        const sourcePoint = points[from];
        const targetPoint = points[to];
        if (sourcePoint === undefined || targetPoint === undefined)
            throw new Error("Source flow edge requires owned points.");
        if (edges >= limits.maximumEdges)
            throw new SourceFlowFailure("Source flow exceeds its finite edge budget.", sourcePoint.source, { subject: declaration, dimension: "maximumEdges", limit: limits.maximumEdges });
        const selected = Object.freeze({ from, to, kind });
        sourcePoint.successors.push(selected);
        targetPoint.predecessors.push(selected);
        edges += 1;
    };
    const emit = (origin, operation, next, context, mayThrow = false, kind = "normal") => {
        const id = point(origin, operation);
        edge(id, next, kind);
        if (mayThrow)
            edge(id, context.throwTo, "exception");
        return id;
    };
    const nested = (node, visit) => {
        budget.step(node);
        if (depth >= limits.maximumDepth)
            throw new SourceFlowFailure("Source flow exceeds its finite syntax depth budget.", node, { subject: declaration, dimension: "maximumDepth", limit: limits.maximumDepth });
        depth += 1;
        try {
            return visit();
        }
        finally {
            depth -= 1;
        }
    };
    return {
        point, edge, emit, step: budget.step,
        nested,
        withExecution(selected, visit) {
            const previous = execution;
            execution = selected;
            try {
                return visit();
            }
            finally {
                execution = previous;
            }
        },
        finish(entry, exit, exceptionExit) {
            const sealed = points.map(selected => Object.freeze({ ...selected,
                successors: Object.freeze(selected.successors), predecessors: Object.freeze(selected.predecessors) }));
            return Object.freeze({ declaration, entry, exit, exceptionExit, points: Object.freeze(sealed),
                sourcePoints: new Map([...sourcePoints].map(([node, ids]) => [node, Object.freeze(ids)])), bindings, executionRegions });
        },
    };
}
export function sourceFlowSequence(nodes, next, context, visit) {
    let entry = next;
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
        const node = nodes[index];
        if (node !== undefined)
            entry = visit(node, entry, context);
    }
    return entry;
}
export function sourceFlowCleanupScope(build, declaration, next, context) {
    if (!build.includes(declaration))
        return { next, context };
    build.step(declaration);
    const selected = build.source.facts.selections.resource(declaration);
    const declarationKind = build.source.ast.variableDeclarationKind(declaration);
    if (selected === undefined || "kind" in selected || selected.declaration !== declaration ||
        (declarationKind !== "using" && declarationKind !== "await using") || selected.async !== (declarationKind === "await using")) {
        throw new SourceFlowFailure("Source flow requires the exact Host resource selection of this using declaration.", declaration);
    }
    const asynchronous = selected.async;
    const routes = new Map();
    const route = (destination) => {
        const existing = routes.get(destination);
        if (existing !== undefined)
            return existing;
        const completion = asynchronous
            ? build.emit(declaration, { kind: "await", awaitKind: "resource-cleanup", declaration }, destination, context, true, "resume")
            : destination;
        const disposal = build.emit(declaration, { kind: "dispose", declaration, asynchronous }, completion, context, true);
        const branch = build.point(declaration, { kind: "branch" });
        build.edge(branch, completion, "nullish");
        build.edge(branch, disposal, "present");
        const read = build.emit(declaration, { kind: "read", binding: declaration }, branch, context);
        routes.set(destination, read);
        return read;
    };
    return {
        next: route(next),
        context: {
            returnTo: route(context.returnTo),
            throwTo: route(context.throwTo),
            breaks: new Map([...context.breaks].map(([target, destination]) => [target, route(destination)])),
            continues: new Map([...context.continues].map(([target, destination]) => [target, route(destination)])),
        },
    };
}
export function sourceFlowResourceScope(build, declarations, next, context, body, acquire = (declaration, continuation, acquisitionContext) => build.pattern(declaration, continuation, acquisitionContext, true, undefined)) {
    const acquisitions = [];
    let completion = next;
    let active = context;
    for (const declaration of declarations) {
        if (!build.includes(declaration))
            continue;
        acquisitions.push({ declaration, context: active });
        const scope = sourceFlowCleanupScope(build, declaration, completion, active);
        completion = scope.next;
        active = scope.context;
    }
    let entry = body(completion, active);
    for (let index = acquisitions.length - 1; index >= 0; index -= 1) {
        const acquisition = acquisitions[index];
        entry = acquire(acquisition.declaration, entry, acquisition.context);
    }
    return entry;
}
//# sourceMappingURL=construction.js.map