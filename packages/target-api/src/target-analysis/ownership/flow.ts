import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import { solveSourceFlow } from "../flow/solver.js";
import type { SourceControlFlowGraph, SourceFlowLimits, SourceFlowPoint,
  SourceDeclarationFlowExecutionRegion, SourceFlowUnresolved } from "../flow/model.js";
import { createSourceControlFlowDomain, createSourceDeclarationControlFlow } from "../flow/graph.js";
import { isSourceCallableBodyBoundary } from "../../source-navigation/index.js";
import { createSourceContinuationTransfer } from "./continuation.js";
import type { SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipValue, SourceDeclarationOwnershipValues,
  SourceDeclarationOwnershipUnresolved, SourceDeclarationContinuationDependency, SourceDeclarationPendingOperation } from "./model.js";
import type { SourceDeclarationContinuationDependencyQueries } from "./dependencies.js";
import type { SourceDeclarationSuspensionQueries } from "./suspension.js";
import { sourceDeclarationOwnershipUnresolved } from "./contracts.js";

function sourceContinuationRead(source: TargetSourceProgram, point: SourceFlowPoint): Node | undefined {
  if (point.operation.kind === "read") return point.source;
  if (point.operation.kind === "capture") return point.operation.binding;
  if (point.operation.kind !== "evaluate" || point.source === undefined) return undefined;
  const { ast } = source;
  return ast.kindName(point.source) === "KindThisKeyword" || ast.is.IsPropertyAccessExpression(point.source) ||
    ast.is.IsElementAccessExpression(point.source) ? point.source : undefined;
}

export function sourceDeclarationOwnershipFlowFailure(selected: SourceFlowUnresolved,
  fallback: Node): SourceDeclarationOwnershipUnresolved {
  return selected.resource === undefined
    ? sourceDeclarationOwnershipUnresolved(selected.source ?? fallback, selected.reason)
    : Object.freeze({ kind: "unresolved", at: selected.resource.subject, reason: selected.reason,
        cause: Object.freeze({ kind: "resource-limit", subject: selected.resource.subject,
          category: selected.resource.dimension, limit: selected.resource.limit }) });
}

export function createSourceDeclarationOwnershipValues(input: {
  readonly source: TargetSourceProgram;
  readonly nodes: readonly Node[];
  readonly budget: SourceDeclarationOwnershipBudget;
  readonly limits: Partial<SourceFlowLimits>;
}) {
  const { source, budget } = input;
  const domain = createSourceControlFlowDomain(source, input.nodes);
  const checkedNodes = new Set(input.nodes);
  const graphs = new Map<Node, SourceControlFlowGraph<SourceDeclarationFlowExecutionRegion>>();
  const values = new Map<Node, SourceDeclarationOwnershipValue>();
  const owned = new WeakSet<SourceDeclarationOwnershipValue>();
  const rowsFor = (node: Node) => budget.createRows(node);
  const graphFor = (declaration: Node): SourceDeclarationOwnershipUnresolved |
    { readonly kind: "resolved"; readonly graph: SourceControlFlowGraph<SourceDeclarationFlowExecutionRegion> } => {
    if (!budget.step(declaration)) return budget.failure()!;
    if (domain.kind === "unresolved") return sourceDeclarationOwnershipFlowFailure(domain, declaration);
    const existing = graphs.get(declaration);
    if (existing !== undefined) return Object.freeze({ kind: "resolved", graph: existing });
    const selected = createSourceDeclarationControlFlow(source, declaration, { domain: domain.domain, limits: input.limits });
    if (selected.kind === "unresolved") return sourceDeclarationOwnershipFlowFailure(selected, declaration);
    const rows = rowsFor(declaration);
    if (!rows.add(1)) { rows.release(); return budget.failure()!; }
    graphs.set(declaration, selected.graph);
    return selected;
  };
  const declarationFor = (node: Node): Node | SourceDeclarationOwnershipUnresolved => {
    const visited = new Set<Node>();
    for (let current: Node | undefined = node; current !== undefined; current = source.ast.parent(current)) {
      if (!budget.step(node)) return budget.failure()!;
      if (visited.has(current)) return sourceDeclarationOwnershipUnresolved(node, "A declaration-local value has cyclic checked ancestry.");
      visited.add(current);
      if (isSourceCallableBodyBoundary(source.ast, current) || source.ast.is.IsPropertyDeclaration(current) ||
        source.ast.is.IsClassStaticBlockDeclaration(current) || source.ast.is.IsSourceFile(current)) return current;
    }
    return sourceDeclarationOwnershipUnresolved(node, "A local value requires its actual checked declaration or module owner.");
  };
  const regionFor = (node: Node): SourceDeclarationFlowExecutionRegion | SourceDeclarationOwnershipUnresolved => {
    if (!budget.step(node)) return budget.failure()!;
    const file = source.ast.getSourceFile(node);
    if (file === undefined || !source.semantics.includes(file) || !checkedNodes.has(node))
      return sourceDeclarationOwnershipUnresolved(node, "A local region requires an original node from this checked source program.");
    const declaration = declarationFor(node);
    if ("kind" in declaration) return declaration;
    const selected = graphFor(declaration);
    if (selected.kind === "unresolved") return selected;
    const regions = new Set<SourceDeclarationFlowExecutionRegion>();
    const visited = new Set<Node>();
    let current: Node | undefined = source.ast.is.IsParameterDeclaration(node) || source.ast.is.IsVariableDeclaration(node)
      ? source.ast.name(node) : node;
    if (current === undefined)
      return sourceDeclarationOwnershipUnresolved(node, "A local declared value requires its original checked binding name.");
    while (current !== undefined) {
      if (!budget.step(node)) return budget.failure()!;
      if (visited.has(current)) return sourceDeclarationOwnershipUnresolved(node, "A local graph projection has cyclic checked ancestry.");
      visited.add(current);
      for (const point of selected.graph.sourcePoints.get(current) ?? []) {
        const region = selected.graph.executionRegions.get(point);
        if (region !== undefined) regions.add(region);
      }
      if (regions.size !== 0 || current === declaration) break;
      current = source.ast.parent(current);
    }
    return regions.size === 1 ? [...regions][0]!
      : sourceDeclarationOwnershipUnresolved(node, "A local value requires one exact published declaration execution region.");
  };
  const query: SourceDeclarationOwnershipValues = Object.freeze({
    regionFor,
    owns: (value: SourceDeclarationOwnershipValue) => owned.has(value),
    forNode(node: Node): SourceDeclarationOwnershipValue | SourceDeclarationOwnershipUnresolved {
      if (!budget.step(node)) return budget.failure()!;
      const existing = values.get(node);
      if (existing !== undefined) return existing;
      const region = regionFor(node);
      if ("kind" in region) return region;
      const semantics = source.semantics.forNode(node);
      const call = source.ast.is.IsCallExpression(node) || source.ast.is.IsNewExpression(node)
        ? semantics.operations.call(node) : undefined;
      const selectedType = call?.sourceSelectedSignatureKind === "resolved" ? call.sourceResultType
        : semantics.types.expressionType(node) ?? semantics.declarations.declaredValueType(node);
      if (selectedType === undefined)
        return sourceDeclarationOwnershipUnresolved(node, "A local native value needs its exact completed checked type component.");
      const declaration = call?.sourceSelectedSignatureKind === "resolved"
        ? semantics.declarations.signatureDeclaration(call.selectedSignature) : source.navigation.sourceReferenceFor(node)?.declaration;
      const authoredTypeNode = declaration === undefined ? undefined : source.ast.typeNode(declaration);
      const component = Object.freeze({ selectedType, ...(declaration === undefined ? {} : { declaration }),
        ...(authoredTypeNode === undefined ? {} : { authoredTypeNode }),
        ...(call === undefined ? {} : { contextualCall: call }) });
      const value: SourceDeclarationOwnershipValue = Object.freeze({ node, component, region });
      const rows = rowsFor(node);
      if (!rows.add(2)) { rows.release(); return budget.failure()!; }
      values.set(node, value);
      owned.add(value);
      return value;
    },
  });
  return Object.freeze({ values: query, graphFor, declarationFor });
}

export interface SourceDeclarationContinuationFlowSelection {
  readonly kind: "resolved";
  readonly declaration: Node;
  readonly dependencies: readonly SourceDeclarationContinuationDependency[];
  readonly maySuspend: boolean;
  readonly reads: readonly {
    readonly reference: Node;
    readonly candidate: Node;
    readonly region: SourceDeclarationFlowExecutionRegion;
    readonly pending: ReadonlySet<SourceDeclarationPendingOperation>;
  }[];
  readonly calls: readonly {
    readonly call: Node;
    readonly region: SourceDeclarationFlowExecutionRegion;
    readonly pending: ReadonlySet<SourceDeclarationPendingOperation>;
  }[];
}

export function resolveSourceDeclarationContinuationFlow(input: {
  readonly source: TargetSourceProgram;
  readonly graph: SourceControlFlowGraph<SourceDeclarationFlowExecutionRegion>;
  readonly budget: SourceDeclarationOwnershipBudget;
  readonly suspensions: SourceDeclarationSuspensionQueries;
  readonly dependencies: SourceDeclarationContinuationDependencyQueries;
  readonly limits: Partial<SourceFlowLimits>;
}): SourceDeclarationContinuationFlowSelection | SourceDeclarationOwnershipUnresolved {
  const { source, graph, budget, suspensions } = input;
  const at = graph.declaration;
  const transfer = createSourceContinuationTransfer<SourceDeclarationPendingOperation>({
    step: () => budget.step(at), createRows: () => budget.createRows(at), failure: () => budget.failure()?.reason,
  });
  try {
    let failure: SourceDeclarationOwnershipUnresolved | undefined;
    const solution = solveSourceFlow<ReadonlySet<SourceDeclarationPendingOperation>>(graph, {
      direction: "forward", lattice: transfer.lattice,
      transfer(point, state) {
        if (!budget.step(point.source ?? at)) { failure = budget.failure(); return undefined; }
        if (point.operation.kind !== "await" || point.source === undefined) return state;
        const selected = suspensions.forAwait(point.source);
        if (selected.kind === "unresolved") { failure = selected; return undefined; }
        return selected.kind === "never" ? state : transfer.suspend(state, selected.pending);
      },
    }, input.limits);
    if (solution.kind === "unresolved") return failure ?? sourceDeclarationOwnershipFlowFailure(solution, at);
    const rows = budget.createRows(at);
    let published = false;
    try {
      const dependencies: SourceDeclarationContinuationDependency[] = [];
      const reads: SourceDeclarationContinuationFlowSelection["reads"][number][] = [];
      const calls: SourceDeclarationContinuationFlowSelection["calls"][number][] = [];
      const append = (state: ReadonlySet<SourceDeclarationPendingOperation>, reference: Node,
        region: SourceDeclarationFlowExecutionRegion): SourceDeclarationOwnershipUnresolved | undefined => {
        if (!rows.add(1)) return budget.failure();
        reads.push(Object.freeze({ reference, candidate: region.owner, region, pending: state }));
        const selected = input.dependencies.forRead(state, reference, region.owner);
        if (selected.kind === "unresolved") return selected;
        for (const dependency of selected.dependencies) {
          if (!budget.step(reference)) return budget.failure();
          if (dependencies.some(existing => existing.reference === dependency.reference &&
            existing.suspension === dependency.suspension && existing.retention === dependency.retention)) continue;
          if (!rows.add(1)) return budget.failure();
          dependencies.push(dependency);
        }
        return undefined;
      };
      let maySuspend = false;
      for (const point of graph.points) {
        if (!budget.step(point.source ?? at)) return budget.failure()!;
        if (!solution.reachable.has(point.id) || point.source === undefined) continue;
        const state = solution.before.get(point.id);
        if (state === undefined)
          return sourceDeclarationOwnershipUnresolved(point.source, "A reachable local continuation lacks its completed flow state.");
        const region = graph.executionRegions.get(point.id);
        if (region === undefined) continue;
        const reference = sourceContinuationRead(source, point);
        if (reference !== undefined) {
          const problem = append(state, reference, region);
          if (problem !== undefined) return problem;
        }
        if (point.operation.kind === "evaluate" &&
          (source.ast.is.IsCallExpression(point.source) || source.ast.is.IsNewExpression(point.source))) {
          if (!rows.add(1)) return budget.failure()!;
          calls.push(Object.freeze({ call: point.source, region, pending: state }));
        }
        if (point.operation.kind === "await") {
          const selected = suspensions.forAwait(point.source);
          if (selected.kind === "unresolved") return selected;
          if (selected.kind === "resolved") {
            maySuspend = true;
            const held = transfer.suspend(transfer.lattice.empty(), selected.pending);
            if (held === undefined) return budget.failure()!;
            const problem = append(held, selected.pending.expression, region);
            if (problem !== undefined) return problem;
          }
        }
        if (point.operation.kind === "return" && source.ast.hasModifierKind(at, "async")) {
          const expression = source.ast.is.IsReturnStatement(point.source)
            ? source.ast.as.AsReturnStatement(point.source)?.Expression : point.source;
          if (expression === undefined || source.ast.is.IsAwaitExpression(expression)) continue;
          const selected = suspensions.forResult(expression);
          if (selected.kind === "unresolved") return selected;
          if (selected.kind === "resolved") {
            maySuspend = true;
            const held = transfer.suspend(transfer.lattice.empty(), selected.pending);
            if (held === undefined) return budget.failure()!;
            const problem = append(held, expression, region);
            if (problem !== undefined) return problem;
          }
        }
      }
      published = true;
      return Object.freeze({ kind: "resolved", declaration: at, dependencies: Object.freeze(dependencies), maySuspend,
        reads: Object.freeze(reads), calls: Object.freeze(calls) });
    } finally { if (!published) rows.release(); }
  } finally { transfer.release(); }
}
