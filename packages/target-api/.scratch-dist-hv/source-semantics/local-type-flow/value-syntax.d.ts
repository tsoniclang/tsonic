import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceTypeFlowSource } from "./types.js";
export declare function sourceTypeFlowTypeSyntax(ast: AstReader, node: Node): boolean;
export declare function sourceTypeFlowValueSyntax(ast: AstReader, node: Node): boolean;
export declare function sourceTypeFlowDiscardedSelection(source: SourceTypeFlowSource, node: Node): boolean;
export declare function sourceTypeFlowDiscardedValue(source: SourceTypeFlowSource, node: Node): boolean;
export declare function sourceTypeFlowAssignmentPattern(ast: AstReader, node: Node): boolean;
//# sourceMappingURL=value-syntax.d.ts.map