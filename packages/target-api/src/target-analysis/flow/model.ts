import type { Node } from "@tsonic/tsts";
import type { SourceBindingWriteValue } from "../../source-navigation/types.js";
import type { TargetSourceProgram } from "../../source-semantics/types.js";

export type SourceFlowEdgeKind = "normal" | "true" | "false" | "nullish" | "present" |
  "case" | "default" | "exception" | "return" | "break" | "continue" | "resume";

export interface SourceFlowEdge {
  readonly from: number;
  readonly to: number;
  readonly kind: SourceFlowEdgeKind;
}

export type SourceFlowOperation =
  | { readonly kind: "entry" | "exit" | "exception-exit" | "merge" | "branch" |
      "evaluate" | "iteration" | "catch" | "yield" | "return" | "throw" }
  | { readonly kind: "await"; readonly value: Node | undefined }
  | { readonly kind: "read"; readonly binding: Node }
  | { readonly kind: "declare"; readonly binding: Node }
  | { readonly kind: "capture"; readonly binding: Node }
  | { readonly kind: "dispose"; readonly declaration: Node; readonly asynchronous: boolean }
  | { readonly kind: "write-location"; readonly location: Node; readonly value: SourceBindingWriteValue }
  | { readonly kind: "write"; readonly binding: Node; readonly reference: Node; readonly initialization: boolean;
      readonly value: SourceBindingWriteValue | undefined };

export interface SourceFlowPoint {
  readonly id: number;
  readonly source: Node | undefined;
  readonly operation: SourceFlowOperation;
  readonly successors: readonly SourceFlowEdge[];
  readonly predecessors: readonly SourceFlowEdge[];
}

export interface SourceControlFlowGraph<Region = SourceDeclarationFlowExecutionRegion> {
  readonly declaration: Node;
  readonly entry: number;
  readonly exit: number;
  readonly exceptionExit: number;
  readonly points: readonly SourceFlowPoint[];
  readonly sourcePoints: ReadonlyMap<Node, readonly number[]>;
  readonly bindings: ReadonlySet<Node>;
  readonly executionRegions: ReadonlyMap<number, Region>;
}

export interface SourceDeclarationFlowExecutionRegion {
  readonly owner: Node;
  readonly root: Node;
  readonly role: "body" | "parameter-initializer" | "instance-initializer" | "module" | "static-initializer";
}

export interface SourceFlowUnresolved {
  readonly kind: "unresolved";
  readonly reason: string;
  readonly source: Node | undefined;
  readonly resource?: {
    readonly subject: Node;
    readonly dimension: keyof SourceFlowLimits;
    readonly limit: number;
  };
}

export type SourceControlFlowSelection<Region = SourceDeclarationFlowExecutionRegion> =
  | { readonly kind: "resolved"; readonly graph: SourceControlFlowGraph<Region> }
  | SourceFlowUnresolved;

export interface SourceFlowLimits {
  readonly maximumPoints: number;
  readonly maximumEdges: number;
  readonly maximumSteps: number;
  readonly maximumDepth: number;
}

export interface SourceControlFlowSelectedDomain {
  readonly kind: "selected";
  readonly source: TargetSourceProgram;
  readonly nodes: readonly Node[];
}

export interface SourceDeclarationControlFlowOptions {
  readonly domain: { readonly kind: "source" } | SourceControlFlowSelectedDomain;
  readonly limits?: Partial<SourceFlowLimits>;
}

export interface SourceFlowWork {
  step(): void;
}

export interface SourceFlowLattice<State> {
  empty(): State;
  join(left: State, right: State, work: SourceFlowWork): State | undefined;
  equals(left: State, right: State, work: SourceFlowWork): boolean;
}

export interface SourceFlowProblem<State> {
  readonly direction: "forward" | "backward";
  readonly lattice: SourceFlowLattice<State>;
  readonly transfer: (point: SourceFlowPoint, input: State, work: SourceFlowWork) => State | undefined;
  readonly boundary?: ReadonlyMap<number, State>;
}

export type SourceFlowSolution<State> =
  | { readonly kind: "resolved"; readonly before: ReadonlyMap<number, State>;
      readonly after: ReadonlyMap<number, State>; readonly reachable: ReadonlySet<number>;
      readonly steps: number }
  | SourceFlowUnresolved;
