import type { BlockId } from "../ids/contract.js";
import type { MirBody, MirStatement, MirTerminator } from "../ir-mir/contract.js";

import type { InvocationAccount, DataflowLimits, CallerRefusal, DataflowStop } from "./account.js";
export type { DataflowLimits, CallerRefusal, DataflowRefusal, DataflowStop } from "./account.js";

export type DataflowAccount = InvocationAccount;

export type CreateAccount = (limits: DataflowLimits) => DataflowAccount;
export type ChargeWork = (account: DataflowAccount, units: number) => DataflowStop | null;
export type ChargeResultEntries = (account: DataflowAccount, entries: number) => DataflowStop | null;
export type AccountFailure = (account: DataflowAccount) => DataflowStop | null;
export type RefuseAccount = (account: DataflowAccount, refusal: CallerRefusal) => DataflowStop;

export interface Lattice<State> {
  readonly bottom: State;
  readonly overflow: State;
  readonly stateBound: number;
  readonly join: (left: State, right: State, account: DataflowAccount) => State;
  readonly equals: (left: State, right: State, account: DataflowAccount) => boolean;
  readonly isOverflow: (state: State, account: DataflowAccount) => boolean;
}

export interface BlockState<State> {
  readonly target: BlockId;
  readonly state: State;
}

export interface ProblemBase<State> {
  readonly lattice: Lattice<State>;
  readonly boundary: State;
  readonly statement: (statement: MirStatement, state: State, account: DataflowAccount) => State;
}

export interface ForwardProblem<State> extends ProblemBase<State> {
  readonly direction: "forward";
  readonly terminator: (terminator: MirTerminator, state: State, account: DataflowAccount) => readonly BlockState<State>[];
}

export interface BackwardProblem<State> extends ProblemBase<State> {
  readonly direction: "backward";
  readonly terminator: (terminator: MirTerminator, successors: readonly BlockState<State>[], boundaryState: State | null, account: DataflowAccount) => State;
}

export type Problem<State> = ForwardProblem<State> | BackwardProblem<State>;

export type DataflowResult<Value> =
  | { readonly kind: "complete"; readonly value: Value }
  | DataflowStop;

export interface FlowSolution<State> {
  readonly entry: readonly State[];
  readonly exit: readonly State[];
  readonly reachable: readonly boolean[];
}

export interface DirectedGraph {
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

// An execution is a body instance and an entry, and an entry is named by its count of supplied fixed arguments
// (the execution key). `provided` is that count; the solution starts at the block of the entry the body offers for it
// and nowhere else.
export type Solve = <State>(
  body: MirBody,
  provided: number,
  problem: Problem<State>,
  account: DataflowAccount,
) => DataflowResult<FlowSolution<State>>;

export type GraphOfMir = (body: MirBody, account: DataflowAccount) => DataflowResult<DirectedGraph>;
export type Predecessors = (
  graph: DirectedGraph,
  account: DataflowAccount,
) => DataflowResult<readonly (readonly number[])[]>;
export type OrderGraph = (
  graph: DirectedGraph,
  roots: readonly number[],
  account: DataflowAccount,
) => DataflowResult<GraphOrdering>;
export type Dominators = (
  graph: DirectedGraph,
  entry: number,
  account: DataflowAccount,
) => DataflowResult<DominatorTree>;
export type NaturalLoops = (
  graph: DirectedGraph,
  entry: number,
  account: DataflowAccount,
) => DataflowResult<readonly NaturalLoop[]>;
export type StronglyConnectedComponents = (
  graph: DirectedGraph,
  account: DataflowAccount,
) => DataflowResult<GraphComponents>;
