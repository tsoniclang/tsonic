import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceLexicalCapture } from "../../source-navigation/lexical-captures.js";
import type { SourceControlFlowGraph, SourceFlowEdge, SourceFlowEdgeKind,
  SourceFlowExecutionRegion, SourceFlowLimits, SourceFlowOperation, SourceFlowPoint } from "./model.js";
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
  readonly parameterInitializers: ReadonlySet<Node> | undefined;
  readonly superInitializers: readonly Node[];
  readonly captures: (source: Node) => readonly SourceLexicalCapture[];
  readonly point: (source: Node | undefined, operation: SourceFlowOperation) => number;
  readonly edge: (from: number, to: number, kind?: SourceFlowEdgeKind) => void;
  readonly emit: (source: Node, operation: SourceFlowOperation, next: number,
    context: SourceFlowContext, mayThrow?: boolean, kind?: SourceFlowEdgeKind) => number;
  readonly expression: (source: Node, next: number, context: SourceFlowContext) => number;
  readonly statement: (source: Node, next: number, context: SourceFlowContext) => number;
  readonly pattern: (source: Node, next: number, context: SourceFlowContext, initialization: boolean) => number;
  readonly step: (source?: Node) => void;
}

export function createSourceFlowConstruction(declaration: Node,
  limits: SourceFlowLimits) {
  const points: OpenPoint[] = [];
  const sourcePoints = new Map<Node, number[]>();
  const bindings = new Set<Node>();
  const budget = createSourceFlowBudget(limits);
  let edges = 0;
  let depth = 0;
  const point = (origin: Node | undefined, operation: SourceFlowOperation): number => {
    budget.step(origin);
    if (points.length >= limits.maximumPoints) throw new SourceFlowFailure("Source flow exceeds its finite point budget.", origin);
    const id = points.length;
    points.push({ id, source: origin, operation: Object.freeze(operation), successors: [], predecessors: [] });
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
    if (edges >= limits.maximumEdges) throw new SourceFlowFailure("Source flow exceeds its finite edge budget.", sourcePoint.source);
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
    if (depth >= limits.maximumDepth) throw new SourceFlowFailure("Source flow exceeds its finite syntax depth budget.", node);
    depth += 1;
    try { return visit(); } finally { depth -= 1; }
  };
  return {
    point, edge, emit, step: budget.step,
    nested,
    finish(entry: number, exit: number, exceptionExit: number,
      executionRegions: ReadonlyMap<Node, SourceFlowExecutionRegion>): SourceControlFlowGraph {
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
