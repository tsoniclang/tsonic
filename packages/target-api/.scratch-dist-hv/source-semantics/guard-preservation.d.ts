import type { Node } from "@tsonic/tsts";
import type { SourceValueFlowQueryContext } from "./value-flow-model.js";
export declare function sourceGuardPreservesBinding(context: Pick<SourceValueFlowQueryContext, "ast" | "navigation" | "sourceFacts" | "effects">, condition: Node, reference: Node, assumed: boolean, enter: (node: Node) => boolean): boolean;
//# sourceMappingURL=guard-preservation.d.ts.map