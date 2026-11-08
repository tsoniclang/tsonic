import type { SourceControlFlowGraph } from "./model.js";
export declare function sourceFlowOrder(graph: SourceControlFlowGraph<unknown>, direction: "forward" | "backward", step: () => void): {
    reachable: Set<number>;
    order: number[];
};
//# sourceMappingURL=ordering.d.ts.map