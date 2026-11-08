import type { Node } from "@tsonic/tsts";
import type { SourceFlowConstruction } from "./construction.js";
export declare function sourceFlowBooleanEdges(build: SourceFlowConstruction, point: number, condition: Node, whenTrue: number, whenFalse: number): void;
export declare function sourceFlowNullishEdges(build: SourceFlowConstruction, point: number, condition: Node, nullish: number, present: number): void;
//# sourceMappingURL=conditions.d.ts.map