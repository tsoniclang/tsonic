// E24 (N5): the active target/toolchain ABI premise for pointer-sized integers (native-int / native-uint).
// The selected target supplies it for the compilation being built (TargetSourceProgramOptions.platform); the Host
// publishes it unchanged as facts.analyses.platform and decides every native-int / native-uint width question from it.
// The Host never derives it from the coordinating machine, a provider data layout or a target name. The fixed int64
// default (Q1) is not pointer-sized and never reads it.
// A premise is required input: a composition that cannot name the width passes `missing` with its reason.
import type { SourcePrimitiveKind } from "@tsonic/tsts";

export type SourceNativeIntegerBits = 32 | 64;

/** One width statement of the selected target, with the target's own description of where it comes from. */
export interface SourceNativeIntegerPremise {
  readonly nativeIntegerBits: SourceNativeIntegerBits;
  /** Target-authored provenance text (for refusal messages only; the Host never branches on it). */
  readonly basis: string;
}

export type SourcePlatformFacts =
  | ({ readonly kind: "known" } & SourceNativeIntegerPremise)
  | { readonly kind: "missing"; readonly reason: string }
  | { readonly kind: "conflicting"; readonly premises: readonly SourceNativeIntegerPremise[] };

export type SourceNativeIntegerPrimitive = "native-int" | "native-uint";
/** Every primitive whose width is fixed by its kind; a literal fit against one never needs the platform premise. */
export type SourceFixedWidthPrimitiveKind = Exclude<SourcePrimitiveKind, SourceNativeIntegerPrimitive>;

export type SourceNativeIntegerWidthRefusalCode =
  | "TSONIC_NATIVE_INTEGER_WIDTH_MISSING"
  | "TSONIC_NATIVE_INTEGER_WIDTH_CONFLICTING";

export interface SourceNativeIntegerWidthRefusal {
  readonly kind: "refused";
  readonly code: SourceNativeIntegerWidthRefusalCode;
  readonly reason: string;
}

export function isSourceNativeIntegerPrimitive(kind: SourcePrimitiveKind): kind is SourceNativeIntegerPrimitive {
  return kind === "native-int" || kind === "native-uint";
}

/** The widths a premise can name; a decision that holds for both needs no premise. */
export const sourceNativeIntegerWidths: readonly SourceNativeIntegerBits[] = Object.freeze([32, 64]);

/** Inclusive bounds of a native integer kind at one width. */
export function sourceNativeIntegerBounds(primitive: SourceNativeIntegerPrimitive, width: SourceNativeIntegerBits):
  readonly [bigint, bigint] {
  const bits = BigInt(width);
  return primitive === "native-int" ? [-(1n << (bits - 1n)), (1n << (bits - 1n)) - 1n] : [0n, (1n << bits) - 1n];
}

/**
 * The refusal for a native-int / native-uint width decision under a missing or conflicting premise. Callers ask only
 * where a width decision is actually needed: the answer differs between the 32-bit and the 64-bit width.
 */
export function sourceNativeIntegerWidthRefusal(
  primitive: SourceNativeIntegerPrimitive,
  platform: Exclude<SourcePlatformFacts, { readonly kind: "known" }>,
): SourceNativeIntegerWidthRefusal {
  if (platform.kind === "missing") return Object.freeze({
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
