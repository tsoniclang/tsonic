import type { AstReader, Node, SourcePrimitiveKind } from "@tsonic/tsts";
import type { SourceLiteralValue } from "../literal-values-model.js";
import type { SourceTypeFlowDeclaredSlot } from "./declared-slots.js";
import type { SourceTypeDescriptor } from "./types.js";
import type { SourceNativeIntegerWidthRefusal, SourcePlatformFacts } from "../platform-model.js";
export type SourceTypeFlowScalarCalculationArm = {
    readonly kind: "resolved";
    readonly primitive: SourcePrimitiveKind;
} | {
    readonly kind: "unfitted";
}
/** A native-int / native-uint arm whose fit depends on a width the platform premise does not state would win (E24). */
 | {
    readonly kind: "width-refused";
    readonly refusal: SourceNativeIntegerWidthRefusal;
};
export declare function sourceTypeFlowScalarCalculationArm(type: SourceTypeDescriptor, literal: SourceLiteralValue, platform: SourcePlatformFacts): SourceTypeFlowScalarCalculationArm;
export declare function sourceTypeFlowConstructionSlot(ast: AstReader, node: Node, type: SourceTypeDescriptor, authority: SourceTypeFlowDeclaredSlot["authority"]): SourceTypeFlowDeclaredSlot;
//# sourceMappingURL=construction-slots.d.ts.map