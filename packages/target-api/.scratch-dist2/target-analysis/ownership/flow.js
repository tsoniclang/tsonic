import { sourceAnalysisIncludesFile, sourceAnalysisValueType } from "../analysis-program.js";
import { solveSourceFlow } from "../flow/solver.js";
import { createSourceControlFlowDomain, createSourceDeclarationControlFlow } from "../flow/graph.js";
import { isSourceCallableBodyBoundary } from "../../source-navigation/index.js";
import { createSourceContinuationTransfer } from "./continuation.js";
import { sourceDeclarationOwnershipUnresolved } from "./contracts.js";
function sourceContinuationRead(source, point) {
    if (point.operation.kind === "read")
        return point.source;
    if (point.operation.kind === "capture")
        return point.operation.binding;
    if (point.operation.kind !== "evaluate" || point.source === undefined)
        return undefined;
    const { ast } = source;
    return ast.kindName(point.source) === "KindThisKeyword" || ast.is.IsPropertyAccessExpression(point.source) ||
        ast.is.IsElementAccessExpression(point.source) ? point.source : undefined;
}
export function sourceDeclarationOwnershipFlowFailure(selected, fallback) {
    return selected.resource === undefined
        ? sourceDeclarationOwnershipUnresolved(selected.source ?? fallback, selected.reason)
        : Object.freeze({ kind: "unresolved", at: selected.resource.subject, reason: selected.reason,
            cause: Object.freeze({ kind: "resource-limit", subject: selected.resource.subject,
                category: selected.resource.dimension, limit: selected.resource.limit }) });
}
export function createSourceDeclarationOwnershipValues(input) {
    const { source, budget } = input;
    const domain = createSourceControlFlowDomain(source, input.sourceNodes);
    const checkedNodes = new Set(input.nodes);
    const runtimeSubset = domain.kind === "resolved" && domain.domain.nodes.reduce((count, node) => count + (checkedNodes.has(node) ? 1 : 0), 0) === checkedNodes.size;
    const graphs = new Map();
    const values = new Map();
    const owned = new WeakSet();
    const rowsFor = (node) => budget.createRows(node);
    const graphFor = (declaration) => {
        if (!budget.step(declaration))
            return budget.failure();
        if (domain.kind === "unresolved")
            return sourceDeclarationOwnershipFlowFailure(domain, declaration);
        if (!runtimeSubset)
            return sourceDeclarationOwnershipUnresolved(declaration, "Materialized continuation nodes must belong to their complete checked source syntax domain.");
        const existing = graphs.get(declaration);
        if (existing !== undefined)
            return Object.freeze({ kind: "resolved", graph: existing });
        const selected = createSourceDeclarationControlFlow(source, declaration, { domain: domain.domain, limits: input.limits });
        if (selected.kind === "unresolved")
            return sourceDeclarationOwnershipFlowFailure(selected, declaration);
        const rows = rowsFor(declaration);
        if (!rows.add(1)) {
            rows.release();
            return budget.failure();
        }
        graphs.set(declaration, selected.graph);
        return selected;
    };
    const declarationFor = (node) => {
        const visited = new Set();
        const creation = isSourceCallableBodyBoundary(source.ast, node) || source.ast.is.IsClassDeclaration(node) ||
            source.ast.is.IsClassExpression(node);
        for (let current = creation ? source.ast.parent(node) : node; current !== undefined; current = source.ast.parent(current)) {
            if (!budget.step(node))
                return budget.failure();
            if (visited.has(current))
                return sourceDeclarationOwnershipUnresolved(node, "A declaration-local value has cyclic checked ancestry.");
            visited.add(current);
            if (isSourceCallableBodyBoundary(source.ast, current) || source.ast.is.IsPropertyDeclaration(current) ||
                source.ast.is.IsClassStaticBlockDeclaration(current) || source.ast.is.IsSourceFile(current))
                return current;
        }
        return sourceDeclarationOwnershipUnresolved(node, "A local value requires its actual checked declaration or module owner.");
    };
    const regionFor = (node) => {
        if (!budget.step(node))
            return budget.failure();
        const file = source.ast.getSourceFile(node);
        if (!sourceAnalysisIncludesFile(source, file) || !checkedNodes.has(node))
            return sourceDeclarationOwnershipUnresolved(node, "A local region requires an original node from this checked source program.");
        const declaration = declarationFor(node);
        if ("kind" in declaration)
            return declaration;
        const selected = graphFor(declaration);
        if (selected.kind === "unresolved")
            return selected;
        const regions = new Set();
        const visited = new Set();
        let current = source.ast.is.IsParameterDeclaration(node) || source.ast.is.IsVariableDeclaration(node)
            ? source.ast.name(node) : node;
        if (current === undefined)
            return sourceDeclarationOwnershipUnresolved(node, "A local declared value requires its original checked binding name.");
        while (current !== undefined) {
            if (!budget.step(node))
                return budget.failure();
            if (visited.has(current))
                return sourceDeclarationOwnershipUnresolved(node, "A local graph projection has cyclic checked ancestry.");
            visited.add(current);
            for (const point of selected.graph.sourcePoints.get(current) ?? []) {
                const region = selected.graph.executionRegions.get(point);
                if (region !== undefined)
                    regions.add(region);
            }
            if (regions.size !== 0 || current === declaration)
                break;
            current = source.ast.parent(current);
        }
        return regions.size === 1 ? [...regions][0]
            : sourceDeclarationOwnershipUnresolved(node, "A local value requires one exact published declaration execution region.");
    };
    const query = Object.freeze({
        regionFor,
        owns: (value) => owned.has(value),
        forNode(node) {
            if (!budget.step(node))
                return budget.failure();
            const existing = values.get(node);
            if (existing !== undefined)
                return existing;
            const region = regionFor(node);
            if ("kind" in region)
                return region;
            // The value's Host component: its descriptor (values.type, the call's result for a call), the selected signature
            // declaration of a call, else the referenced declaration.
            const call = source.ast.is.IsCallExpression(node) || source.ast.is.IsNewExpression(node)
                ? source.navigation.call(node) : undefined;
            const type = sourceAnalysisValueType(source, node);
            if (type === undefined)
                return sourceDeclarationOwnershipUnresolved(node, "A local native value needs its exact completed Host type component.");
            const declaration = call?.selection === "resolved" ? call.signature : source.navigation.sourceReferenceFor(node)?.declaration;
            const authoredTypeNode = declaration === undefined ? undefined : source.ast.typeNode(declaration);
            const component = Object.freeze({ type, ...(declaration === undefined ? {} : { declaration }),
                ...(authoredTypeNode === undefined ? {} : { authoredTypeNode }),
                ...(call === undefined ? {} : { call: node }) });
            const value = Object.freeze({ node, component, region });
            const rows = rowsFor(node);
            if (!rows.add(2)) {
                rows.release();
                return budget.failure();
            }
            values.set(node, value);
            owned.add(value);
            return value;
        },
    });
    return Object.freeze({ values: query, graphFor, declarationFor, runtimeNodes: checkedNodes });
}
export function resolveSourceDeclarationContinuationFlow(input) {
    const { source, graph, budget, suspensions } = input;
    const at = graph.declaration;
    const suspensionFor = (operation, node) => {
        if (operation.awaitKind === "authored")
            return suspensions.forAwait(node);
        return operation.declaration === node ? suspensions.forResourceCleanup(node)
            : sourceDeclarationOwnershipUnresolved(node, "Cleanup suspension requires its original flow declaration identity.");
    };
    const transfer = createSourceContinuationTransfer({
        step: () => budget.step(at), createRows: () => budget.createRows(at), failure: () => budget.failure()?.reason,
    });
    try {
        let failure;
        const solution = solveSourceFlow(graph, {
            direction: "forward", lattice: transfer.lattice,
            transfer(point, state) {
                if (!budget.step(point.source ?? at)) {
                    failure = budget.failure();
                    return undefined;
                }
                if (point.operation.kind !== "await" || point.source === undefined)
                    return state;
                const selected = suspensionFor(point.operation, point.source);
                if (selected.kind === "unresolved") {
                    failure = selected;
                    return undefined;
                }
                return selected.kind === "never" ? state : transfer.suspend(state, selected.pending);
            },
        }, input.limits);
        if (solution.kind === "unresolved")
            return failure ?? sourceDeclarationOwnershipFlowFailure(solution, at);
        const rows = budget.createRows(at);
        let published = false;
        try {
            const dependencies = [];
            const reads = [];
            const calls = [];
            const append = (state, reference, region) => {
                if (!rows.add(1))
                    return budget.failure();
                reads.push(Object.freeze({ reference, candidate: region.owner, region, pending: state }));
                const selected = input.dependencies.forRead(state, reference, region.owner);
                if (selected.kind === "unresolved")
                    return selected;
                for (const dependency of selected.dependencies) {
                    if (!budget.step(reference))
                        return budget.failure();
                    if (dependencies.some(existing => existing.reference === dependency.reference &&
                        existing.suspension === dependency.suspension && existing.retention === dependency.retention))
                        continue;
                    if (!rows.add(1))
                        return budget.failure();
                    dependencies.push(dependency);
                }
                return undefined;
            };
            let maySuspend = false;
            for (const point of graph.points) {
                if (!budget.step(point.source ?? at))
                    return budget.failure();
                if (!solution.reachable.has(point.id) || point.source === undefined)
                    continue;
                const state = solution.before.get(point.id);
                if (state === undefined)
                    return sourceDeclarationOwnershipUnresolved(point.source, "A reachable local continuation lacks its completed flow state.");
                const region = graph.executionRegions.get(point.id);
                if (region === undefined)
                    continue;
                const reference = sourceContinuationRead(source, point);
                if (reference !== undefined && input.runtimeNodes.has(reference)) {
                    const problem = append(state, reference, region);
                    if (problem !== undefined)
                        return problem;
                }
                if (point.operation.kind === "evaluate" &&
                    (source.ast.is.IsCallExpression(point.source) || source.ast.is.IsNewExpression(point.source))) {
                    if (!rows.add(1))
                        return budget.failure();
                    calls.push(Object.freeze({ call: point.source, region, pending: state }));
                }
                if (point.operation.kind === "await") {
                    const selected = suspensionFor(point.operation, point.source);
                    if (selected.kind === "unresolved")
                        return selected;
                    if (selected.kind === "resolved") {
                        maySuspend = true;
                        const held = transfer.suspend(transfer.lattice.empty(), selected.pending);
                        if (held === undefined)
                            return budget.failure();
                        const reference = selected.pending.kind === "expression" ? selected.pending.expression
                            : selected.pending.declaration;
                        const problem = append(held, reference, region);
                        if (problem !== undefined)
                            return problem;
                    }
                }
                if (point.operation.kind === "return") {
                    const expression = source.ast.is.IsReturnStatement(point.source)
                        ? source.ast.as.AsReturnStatement(point.source)?.Expression : point.source;
                    if (expression === undefined || source.ast.is.IsAwaitExpression(expression))
                        continue;
                    const selected = suspensions.forResult(expression);
                    if (selected.kind === "unresolved")
                        return selected;
                    if (selected.kind === "resolved") {
                        maySuspend = true;
                        const held = transfer.suspend(transfer.lattice.empty(), selected.pending);
                        if (held === undefined)
                            return budget.failure();
                        const problem = append(held, expression, region);
                        if (problem !== undefined)
                            return problem;
                    }
                }
            }
            published = true;
            return Object.freeze({ kind: "resolved", declaration: at, dependencies: Object.freeze(dependencies), maySuspend,
                reads: Object.freeze(reads), calls: Object.freeze(calls) });
        }
        finally {
            if (!published)
                rows.release();
        }
    }
    finally {
        transfer.release();
    }
}
//# sourceMappingURL=flow.js.map