import type { BlockId } from "../ids/contract.js";
import type { MirBody, MirStatement, MirTerminator } from "../ir-mir/contract.js";

export interface Lattice<State> {
  readonly bottom: State;
  readonly overflow: State;
  readonly stateBound: number;
  readonly join: (left: State, right: State) => State;
  readonly equals: (left: State, right: State) => boolean;
  readonly isOverflow: (state: State) => boolean;
}

export interface BlockState<State> {
  readonly target: BlockId;
  readonly state: State;
}

export interface ProblemBase<State> {
  readonly lattice: Lattice<State>;
  readonly boundary: State;
  readonly statement: (statement: MirStatement, state: State) => State;
}

export interface ForwardProblem<State> extends ProblemBase<State> {
  readonly direction: "forward";
  readonly terminator: (terminator: MirTerminator, state: State) => readonly BlockState<State>[];
}

export interface BackwardProblem<State> extends ProblemBase<State> {
  readonly direction: "backward";
  readonly terminator: (terminator: MirTerminator, successors: readonly BlockState<State>[]) => State;
}

export type Problem<State> = ForwardProblem<State> | BackwardProblem<State>;

export interface DataflowLimits {
  readonly maximumWork: number;
  readonly maximumResultEntries: number;
}

export type DataflowResult<Value> =
  | { readonly kind: "complete"; readonly value: Value }
  | { readonly kind: "resource-limit"; readonly dimension: "work" | "result-entries" | "state"; readonly maximum: number };

export interface FlowSolution<State> {
  readonly entry: readonly State[];
  readonly exit: readonly State[];
  readonly reachable: readonly boolean[];
}

export interface DirectedGraph<Vertex> {
  readonly vertices: readonly Vertex[];
  readonly successors: readonly (readonly number[])[];
}

export interface GraphOrdering {
  readonly preorder: readonly number[];
  readonly postorder: readonly number[];
  readonly reachable: readonly boolean[];
}

export interface DominatorTree {
  readonly immediate: readonly (number | null)[];
  readonly reachable: readonly boolean[];
}

export interface NaturalLoop {
  readonly header: number;
  readonly backEdges: readonly number[];
  readonly members: readonly number[];
}

export interface GraphComponents {
  readonly components: readonly (readonly number[])[];
  readonly componentOf: readonly number[];
}

export type Solve = <State>(
  body: MirBody,
  problem: Problem<State>,
  limits: DataflowLimits,
) => DataflowResult<FlowSolution<State>>;

export type GraphOfMir = (body: MirBody) => DirectedGraph<BlockId>;
export type Predecessors = <Vertex>(
  graph: DirectedGraph<Vertex>,
  limits: DataflowLimits,
) => DataflowResult<readonly (readonly number[])[]>;
export type OrderGraph = <Vertex>(
  graph: DirectedGraph<Vertex>,
  roots: readonly number[],
  limits: DataflowLimits,
) => DataflowResult<GraphOrdering>;
export type Dominators = <Vertex>(
  graph: DirectedGraph<Vertex>,
  entry: number,
  limits: DataflowLimits,
) => DataflowResult<DominatorTree>;
export type NaturalLoops = <Vertex>(
  graph: DirectedGraph<Vertex>,
  entry: number,
  limits: DataflowLimits,
) => DataflowResult<readonly NaturalLoop[]>;
export type StronglyConnectedComponents = <Vertex>(
  graph: DirectedGraph<Vertex>,
  limits: DataflowLimits,
) => DataflowResult<GraphComponents>;
