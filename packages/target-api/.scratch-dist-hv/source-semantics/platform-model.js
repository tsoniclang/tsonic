export function isSourceNativeIntegerPrimitive(kind) {
    return kind === "native-int" || kind === "native-uint";
}
/** The widths a premise can name; a decision that holds for both needs no premise. */
export const sourceNativeIntegerWidths = Object.freeze([32, 64]);
/** Inclusive bounds of a native integer kind at one width. */
export function sourceNativeIntegerBounds(primitive, width) {
    const bits = BigInt(width);
    return primitive === "native-int" ? [-(1n << (bits - 1n)), (1n << (bits - 1n)) - 1n] : [0n, (1n << bits) - 1n];
}
/**
 * The refusal for a native-int / native-uint width decision under a missing or conflicting premise. Callers ask only
 * where a width decision is actually needed: the answer differs between the 32-bit and the 64-bit width.
 */
export function sourceNativeIntegerWidthRefusal(primitive, platform) {
    if (platform.kind === "missing")
        return Object.freeze({
            kind: "refused",
            code: "TSONIC_NATIVE_INTEGER_WIDTH_MISSING",
            reason: `A '${primitive}' value here needs the native integer width of the active target, which states none: ` +
                `${platform.reason} Use a fixed-width integer type, or configure the target architecture.`,
        });
    const stated = platform.premises.map(premise => `${premise.nativeIntegerBits}-bit (${premise.basis})`).join(", ");
    return Object.freeze({
        kind: "refused",
        code: "TSONIC_NATIVE_INTEGER_WIDTH_CONFLICTING",
        reason: `A '${primitive}' value here needs the native integer width of the active target, which states ` +
            `conflicting widths: ${stated}. Use a fixed-width integer type, or configure one target architecture.`,
    });
}
//# sourceMappingURL=platform-model.js.map