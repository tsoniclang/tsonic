import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceHostInput } from "../../host-input/index.js";
import type { SourceTypeFlowRefusal, SourceTypeFlowSource } from "./types.js";
export declare function sourceTypeFlowCallableReturns(ast: AstReader, declaration: Node): {
    readonly returned: readonly Node[];
    readonly absent: boolean;
};
export declare function sourceTypeFlowRecursiveSignatures(source: SourceTypeFlowSource, input: SourceHostInput, nodes: readonly Node[]): ReadonlyMap<Node, SourceTypeFlowRefusal>;
//# sourceMappingURL=callable-returns.d.ts.map