import type { Node } from "@tsonic/tsts";
import type { SourceFlowConstruction, SourceFlowContext } from "./construction.js";
import type { SourceFlowOperation } from "./model.js";
import type { SourceBindingWriteValue } from "../../source-navigation/types.js";
export declare function sourceFlowBinding(build: SourceFlowConstruction, reference: Node): Node | undefined;
export declare function sourceFlowPattern(build: SourceFlowConstruction, node: Node, next: number, context: SourceFlowContext, initialization: boolean, value: Extract<SourceFlowOperation, {
    readonly kind: "write";
}>["value"]): number;
export declare function sourceFlowWriteValue(build: SourceFlowConstruction, reference: Node, value: SourceBindingWriteValue): SourceBindingWriteValue;
export declare function sourceFlowWriteValue(build: SourceFlowConstruction, reference: Node, value: SourceBindingWriteValue | undefined): SourceBindingWriteValue | undefined;
export declare function sourceFlowReference(build: SourceFlowConstruction, node: Node, next: number, context: SourceFlowContext, read: boolean): number;
//# sourceMappingURL=bindings.d.ts.map