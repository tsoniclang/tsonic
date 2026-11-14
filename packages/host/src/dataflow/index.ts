import type {
  Dominators,
  GraphOfMir,
  NaturalLoops,
  OrderGraph,
  Predecessors,
  Solve,
  StronglyConnectedComponents,
} from "./contract.js";
import { componentsOfGraph } from "./components.js";
import { dominatorsOfGraph } from "./dominators.js";
import { mirGraph, predecessorsOfGraph } from "./graph.js";

import { loopsOfGraph } from "./loops.js";
import { orderingOfGraph } from "./ordering.js";
import { solveProblem } from "./solve.js";
import { createMeter, failureOf, recordRefusal, takeEntries, takeWork } from "./account.js";
import type { AccountFailure, ChargeResultEntries, ChargeWork, CreateAccount, RefuseAccount } from "./contract.js";

export const createAccount: CreateAccount = createMeter;
export const chargeWork: ChargeWork = takeWork;
export const chargeResultEntries: ChargeResultEntries = takeEntries;
export const accountFailure: AccountFailure = failureOf;
export const refuseAccount: RefuseAccount = recordRefusal;

export const solve: Solve = solveProblem;
export const graphOfMir: GraphOfMir = mirGraph;
export const predecessors: Predecessors = predecessorsOfGraph;
export const orderGraph: OrderGraph = orderingOfGraph;
export const dominators: Dominators = dominatorsOfGraph;
export const naturalLoops: NaturalLoops = loopsOfGraph;
export const stronglyConnectedComponents: StronglyConnectedComponents = componentsOfGraph;
