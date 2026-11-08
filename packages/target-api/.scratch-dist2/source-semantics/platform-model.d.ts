import type { SourcePrimitiveKind } from "@tsonic/tsts";
export type SourceNativeIntegerBits = 32 | 64;
/** One width statement of the selected target, with the target's own description of where it comes from. */
export interface SourceNativeIntegerPremise {
    readonly nativeIntegerBits: SourceNativeIntegerBits;
    /** Target-authored provenance text (for refusal messages only; the Host never branches on it). */
    readonly basis: string;
}
export type SourcePlatformFacts = ({
    readonly kind: "known";
} & SourceNativeIntegerPremise) | {
    readonly kind: "missing";
    readonly reason: string;
} | {
    readonly kind: "conflicting";
    readonly premises: readonly SourceNativeIntegerPremise[];
};
export type SourceNativeIntegerPrimitive = "native-int" | "native-uint";
/** Every primitive whose width is fixed by its kind; a literal fit against one never needs the platform premise. */
export type SourceFixedWidthPrimitiveKind = Exclude<SourcePrimitiveKind, SourceNativeIntegerPrimitive>;
export type SourceNativeIntegerWidthRefusalCode = "TSONIC_NATIVE_INTEGER_WIDTH_MISSING" | "TSONIC_NATIVE_INTEGER_WIDTH_CONFLICTING";
export interface SourceNativeIntegerWidthRefusal {
    readonly kind: "refused";
    readonly code: SourceNativeIntegerWidthRefusalCode;
    readonly reason: string;
}
export declare function isSourceNativeIntegerPrimitive(kind: SourcePrimitiveKind): kind is SourceNativeIntegerPrimitive;
/** The widths a premise can name; a decision that holds for both needs no premise. */
export declare const sourceNativeIntegerWidths: readonly SourceNativeIntegerBits[];
/** Inclusive bounds of a native integer kind at one width. */
export declare function sourceNativeIntegerBounds(primitive: SourceNativeIntegerPrimitive, width: SourceNativeIntegerBits): readonly [bigint, bigint];
/**
 * The refusal for a native-int / native-uint width decision under a missing or conflicting premise. Callers ask only
 * where a width decision is actually needed: the answer differs between the 32-bit and the 64-bit width.
 */
export declare function sourceNativeIntegerWidthRefusal(primitive: SourceNativeIntegerPrimitive, platform: Exclude<SourcePlatformFacts, {
    readonly kind: "known";
}>): SourceNativeIntegerWidthRefusal;
//# sourceMappingURL=platform-model.d.ts.map