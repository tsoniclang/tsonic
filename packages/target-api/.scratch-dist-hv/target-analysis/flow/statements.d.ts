import type { Node } from "@tsonic/tsts";
import { type SourceFlowConstruction, type SourceFlowContext } from "./construction.js";
export declare function sourceFlowStatement(build: SourceFlowConstruction, node: Node, next: number, context: SourceFlowContext): number;
export declare function sourceFlowStatements(build: SourceFlowConstruction, statements: readonly (Node | undefined)[], next: number, context: SourceFlowContext): number;
//# sourceMappingURL=statements.d.ts.map