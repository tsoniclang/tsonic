import type { AstReader, Node } from "@tsonic/tsts";
export type SourceBooleanShortCircuitBranch = "left" | "right" | "conditional";
export declare function sourceBooleanShortCircuitBranch(ast: AstReader, left: Node, operator: "&&" | "||"): SourceBooleanShortCircuitBranch;
//# sourceMappingURL=boolean-short-circuit.d.ts.map