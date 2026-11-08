import { type AstReader } from "@tsonic/tsts";
import type { SourceTypeDescriptor, SourceTypeFlowAnalysisContext, SourceTypeFlowGraph, SourceTypeFlowUse } from "./types.js";
export declare function sourceTypeFlowIsBroadSlot(type: SourceTypeDescriptor): boolean;
/**
 * Whether a descriptor constrains its values (R4: the one classifier). "top": any or unknown (no value is excluded);
 * "type-parameter": a type parameter reference (its values are fixed only per instantiation); "closed": everything
 * else, including unions and options, whose arms are classified one by one. Each site asks its own question through
 * this classifier: a test on an arm is undecided when the arm is not "closed"; a value with a "top" arm may be absent.
 */
export declare function sourceTypeDescriptorOpenness(ast: Pick<AstReader, "is">, type: SourceTypeDescriptor): "top" | "type-parameter" | "closed";
export declare function sourceTypeFlowBroadSlotKind(type: SourceTypeDescriptor): "unknown" | "any" | "object" | "void" | undefined;
export declare function collectSourceTypeFlowUses(context: SourceTypeFlowAnalysisContext, graph: SourceTypeFlowGraph): readonly SourceTypeFlowUse[];
//# sourceMappingURL=uses.d.ts.map