import type { Node, SourcePrimitiveKind } from "@tsonic/tsts";
import type { SourceLiteralValue } from "../literal-values-model.js";
import { type SourceFixedWidthPrimitiveKind, type SourceNativeIntegerWidthRefusal, type SourceNativeIntegerWidthRefusalCode, type SourcePlatformFacts } from "../platform-model.js";
export declare const sourcePrimitiveOperatorKinds: readonly ["bool", "char", "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64", "native-int", "native-uint", "float16", "float32", "float64", "decimal", "int128", "uint128"];
export declare const sourcePrimitiveBinaryOperators: readonly ["add", "subtract", "multiply", "divide", "remainder", "power", "bit-and", "bit-or", "bit-xor", "shift-left", "shift-right", "shift-right-unsigned", "less", "less-equal", "greater", "greater-equal", "equal", "not-equal"];
export declare const sourcePrimitiveUnaryOperators: readonly ["positive", "negate", "bit-not", "logical-not", "increment", "decrement"];
export type SourcePrimitiveBinaryOperator = typeof sourcePrimitiveBinaryOperators[number];
export type SourcePrimitiveUnaryOperator = typeof sourcePrimitiveUnaryOperators[number];
export type SourcePrimitiveOperatorOperand = {
    readonly kind: "fixed";
    readonly primitive: SourcePrimitiveKind;
} | {
    readonly kind: "unbound-literal";
    readonly primitive: SourcePrimitiveKind | "bigint";
    readonly literal: SourceLiteralValue;
};
export interface SourcePrimitiveOperatorRefusal {
    readonly kind: "refused";
    /**
     * TSONIC_LOCAL_TYPE_UNSUPPORTED: the operator form has no admitted native rule. A native integer width code: the
     * decision fitted a literal to native-int / native-uint and its answer depends on a width the active target's
     * premise does not state (E24, N5).
     */
    readonly code: "TSONIC_LOCAL_TYPE_UNSUPPORTED" | SourceNativeIntegerWidthRefusalCode;
    readonly reason: string;
}
/** A literal fit against one primitive kind. Compare with the string results; the refusal is an object. */
export type SourcePrimitiveLiteralFit = "fits" | "outside" | SourceNativeIntegerWidthRefusal;
export type SourcePrimitiveBinaryDecision = SourcePrimitiveOperatorRefusal | {
    readonly kind: "resolved";
    readonly result: SourcePrimitiveKind;
    readonly left: SourcePrimitiveKind;
    readonly right: SourcePrimitiveKind;
};
export type SourcePrimitiveUnaryDecision = SourcePrimitiveOperatorRefusal | {
    readonly kind: "resolved";
    readonly result: SourcePrimitiveKind;
    readonly operand: SourcePrimitiveKind;
};
export declare function sourcePrimitiveOperatorIsIntegral(kind: SourcePrimitiveKind): boolean;
/**
 * The binary operator decision. `platform` is the active target's native integer premise (E24): it is read only when
 * an unbound literal is fitted to native-int / native-uint and the 32-bit and 64-bit answers differ.
 */
export declare function decideSourcePrimitiveBinaryOperator(operator: SourcePrimitiveBinaryOperator, left: SourcePrimitiveOperatorOperand, right: SourcePrimitiveOperatorOperand, platform: SourcePlatformFacts, expectedKind?: SourcePrimitiveKind): SourcePrimitiveBinaryDecision;
/**
 * The partner kind an unbound literal adopts, when it fits. A native partner whose fit depends on an unstated width
 * gives no partner (fail closed); decideSourcePrimitiveBinaryOperator reports that case as the width refusal.
 */
export declare function sourcePrimitiveOperatorLiteralPartner(operand: SourcePrimitiveOperatorOperand, partner: SourcePrimitiveKind | "bigint", platform: SourcePlatformFacts): SourcePrimitiveKind | undefined;
export declare function decideSourcePrimitiveUnaryOperator(operator: SourcePrimitiveUnaryOperator, operand: SourcePrimitiveKind): SourcePrimitiveUnaryDecision;
/**
 * Whether the literal fits the primitive kind. A fixed-width kind needs no premise. A native kind reads the active
 * target's premise (E24); when the premise is missing or conflicting and the answer depends on the width, the result
 * is false (fail closed) and sourcePrimitiveLiteralFit names the refusal.
 */
export declare function sourcePrimitiveOperatorLiteralFits(literal: SourceLiteralValue, primitive: SourceFixedWidthPrimitiveKind): boolean;
export declare function sourcePrimitiveOperatorLiteralFits(literal: SourceLiteralValue, primitive: SourcePrimitiveKind, platform: SourcePlatformFacts): boolean;
/** The literal fit with the native width refusal: "fits", "outside", or the refusal when only the unstated width decides. */
export declare function sourcePrimitiveLiteralFit(literal: SourceLiteralValue, primitive: SourcePrimitiveKind, platform: SourcePlatformFacts): SourcePrimitiveLiteralFit;
/**
 * Enum operands (native enums, E-enum rows): a numeric enum value is an operand of its enum's integer primitive (int32,
 * or int64 for a 64-bit enum: enum-constants.ts selects the width), except where the operator keeps the enum domain:
 * `~e` on one enum and `|`, `&`, `^` on two operands of the same enum produce that enum (the native enum operators).
 */
export declare function sourceEnumOperandPrimitive(width: {
    readonly kind: "resolved";
    readonly integerWidth: 32 | 64;
} | {
    readonly kind: "rejected";
} | undefined): "int32" | "int64" | undefined;
/** Whether an operator over enum operands keeps the enum domain (see sourceEnumOperandPrimitive). */
export declare function sourceEnumOperatorKeepsDomain(operator: SourcePrimitiveUnaryOperator | SourcePrimitiveBinaryOperator, enums: readonly (Node | undefined)[]): boolean;
//# sourceMappingURL=operator-decisions.d.ts.map