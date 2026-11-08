import type { SourceControlFlowGraph, SourceFlowLimits, SourceFlowProblem, SourceFlowSolution } from "./model.js";
export declare function solveSourceFlow<State>(graph: SourceControlFlowGraph<unknown>, problem: SourceFlowProblem<State>, limits?: Partial<SourceFlowLimits>): SourceFlowSolution<State>;
//# sourceMappingURL=solver.d.ts.map