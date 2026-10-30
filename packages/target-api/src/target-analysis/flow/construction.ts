import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceLexicalCapture } from "../../source-navigation/lexical-captures.js";
import type { SourceControlFlowGraph, SourceFlowEdge, SourceFlowEdgeKind, SourceFlowExecutionRegion, SourceFlowLimits, SourceFlowOperation, SourceFlowPoint } from "./model.js";
import { createSourceFlowBudget, SourceFlowFailure } from "./resources.js";

export interface SourceFlowContext {
  readonly returnTo: number;
  readonly throwTo: number;
  readonly breaks: ReadonlyMap<Node, number>;
  readonly continues: ReadonlyMap<Node, number>;
}

interface OpenPoint {
  readonly id: number;
  readonly source: Node | undefined;
  readonly operation: SourceFlowOperation;
  readonly successors: SourceFlowEdge[];
  readonly predecessors: SourceFlowEdge[];
}

export interface SourceFlowConstruction {
  readonly source: TargetSourceProgram;
  readonly includes: (node: Node) => boolean;
  readonly parameterInitializers: ReadonlySet<Node> | undefined;
  readonly initializeSuper: (next: number, context: SourceFlowContext) => number;
  readonly captures: (source: Node) => readonly SourceLexicalCapture[];
  readonly point: (source: Node | undefined, operation: SourceFlowOperation) => number;
  readonly edge: (from: number, to: number, kind?: SourceFlowEdgeKind) => void;
  readonly emit: (source: Node, operation: SourceFlowOperation, next: number,
    context: SourceFlowContext, mayThrow?: boolean, kind?: SourceFlowEdgeKind) => number;
  readonly expression: (source: Node, next: number, context: SourceFlowContext) => number;
  readonly statement: (source: Node, next: number, context: SourceFlowContext) => number;
  readonly pattern: (source: Node, next: number, context: SourceFlowContext, initialization: boolean,
    value: Extract<SourceFlowOperation, { readonly kind: "write" }>["value"]) => number;
  readonly step: (source?: Node) => void;
}

export function createSourceFlowConstruction<Region = SourceFlowExecutionRegion>(declaration: Node,
  limits: SourceFlowLimits) {
  const points: OpenPoint[] = [];
  const sourcePoints = new Map<Node, number[]>();
  const executionRegions = new Map<number, Region>();
  let execution: Region | undefined;
  const bindings = new Set<Node>();
  const budget = createSourceFlowBudget(limits, declaration);
  let edges = 0;
  let depth = 0;
  const point = (origin: Node | undefined, operation: SourceFlowOperation): number => {
    budget.step(origin);
    if (points.length >= limits.maximumPoints) throw new SourceFlowFailure("Source flow exceeds its finite point budget.", origin,
      { subject: declaration, dimension: "maximumPoints", limit: limits.maximumPoints });
    const id = points.length;
    points.push({ id, source: origin, operation: Object.freeze(operation), successors: [], predecessors: [] });
    if (execution !== undefined) executionRegions.set(id, execution);
    if (origin !== undefined) {
      const existing = sourcePoints.get(origin);
      if (existing === undefined) sourcePoints.set(origin, [id]);
      else existing.push(id);
    }
    if ("binding" in operation) bindings.add(operation.binding);
    return id;
  };
  const edge = (from: number, to: number, kind: SourceFlowEdgeKind = "normal"): void => {
    budget.step();
    const sourcePoint = points[from];
    const targetPoint = points[to];
    if (sourcePoint === undefined || targetPoint === undefined) throw new Error("Source flow edge requires owned points.");
    if (edges >= limits.maximumEdges) throw new SourceFlowFailure("Source flow exceeds its finite edge budget.", sourcePoint.source,
      { subject: declaration, dimension: "maximumEdges", limit: limits.maximumEdges });
    const selected = Object.freeze({ from, to, kind });
    sourcePoint.successors.push(selected);
    targetPoint.predecessors.push(selected);
    edges += 1;
  };
  const emit: SourceFlowConstruction["emit"] = (origin, operation, next, context, mayThrow = false, kind = "normal") => {
    const id = point(origin, operation);
    edge(id, next, kind);
    if (mayThrow) edge(id, context.throwTo, "exception");
    return id;
  };
  const nested = <Result>(node: Node, visit: () => Result): Result => {
    budget.step(node);
    if (depth >= limits.maximumDepth) throw new SourceFlowFailure("Source flow exceeds its finite syntax depth budget.", node,
      { subject: declaration, dimension: "maximumDepth", limit: limits.maximumDepth });
    depth += 1;
    try { return visit(); } finally { depth -= 1; }
  };
  return {
    point, edge, emit, step: budget.step,
    nested,
    withExecution<Result>(selected: Region | undefined, visit: () => Result): Result {
      const previous = execution;
      execution = selected;
      try { return visit(); } finally { execution = previous; }
    },
    finish(entry: number, exit: number, exceptionExit: number): SourceControlFlowGraph<Region> {
      const sealed: SourceFlowPoint[] = points.map(selected => Object.freeze({ ...selected,
        successors: Object.freeze(selected.successors), predecessors: Object.freeze(selected.predecessors) }));
      return Object.freeze({ declaration, entry, exit, exceptionExit, points: Object.freeze(sealed),
        sourcePoints: new Map([...sourcePoints].map(([node, ids]) => [node, Object.freeze(ids)])), bindings, executionRegions });
    },
  };
}

export function sourceFlowSequence(nodes: readonly (Node | undefined)[], next: number,
  context: SourceFlowContext, visit: SourceFlowConstruction["expression"]): number {
  let entry = next;
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    if (node !== undefined) entry = visit(node, entry, context);
  }
  return entry;
}

export interface SourceFlowCleanupScope {
  readonly next: number;
  readonly context: SourceFlowContext;
}

export function sourceFlowCleanupScope(build: SourceFlowConstruction, declaration: Node,
  next: number, context: SourceFlowContext): SourceFlowCleanupScope {
  if (!build.includes(declaration)) return { next, context };
  build.step(declaration);
  const checked = build.source.semantics.forNode(declaration).operations.resourceManagement(declaration);
  const declarationKind = build.source.ast.variableDeclarationKind(declaration);
  if (checked === undefined || checked.declaration !== declaration || checked.declarationKind !== declarationKind) {
    throw new SourceFlowFailure("Source flow requires exact checked resource acquisition and cleanup evidence.", declaration);
  }
  const asynchronous = checked.declarationKind === "await using";
  const routes = new Map<number, number>();
  const route = (destination: number): number => {
    const existing = routes.get(destination);
    if (existing !== undefined) return existing;
    const completion = asynchronous
      ? build.emit(declaration, { kind: "await", value: undefined }, destination, context, true, "resume")
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

export function sourceFlowResourceScope(build: SourceFlowConstruction, declarations: readonly Node[],
  next: number, context: SourceFlowContext,
  body: (next: number, context: SourceFlowContext) => number,
  acquire: (declaration: Node, next: number, context: SourceFlowContext) => number =
    (declaration, continuation, acquisitionContext) => build.pattern(declaration, continuation, acquisitionContext, true, undefined),
): number {
  const acquisitions: { readonly declaration: Node; readonly context: SourceFlowContext }[] = [];
  let completion = next;
  let active = context;
  for (const declaration of declarations) {
    if (!build.includes(declaration)) continue;
    acquisitions.push({ declaration, context: active });
    const scope = sourceFlowCleanupScope(build, declaration, completion, active);
    completion = scope.next;
    active = scope.context;
  }
  let entry = body(completion, active);
  for (let index = acquisitions.length - 1; index >= 0; index -= 1) {
    const acquisition = acquisitions[index]!;
    entry = acquire(acquisition.declaration, entry, acquisition.context);
  }
  return entry;
}
