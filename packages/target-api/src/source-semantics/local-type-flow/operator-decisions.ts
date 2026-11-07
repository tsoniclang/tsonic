import type { SourcePrimitiveKind } from "@tsonic/tsts";
import { compareSourceNumericLiteralMagnitude } from "../literal-token.js";
import type { SourceLiteralValue } from "../literal-values-model.js";
import {
  isSourceNativeIntegerPrimitive, sourceNativeIntegerBounds, sourceNativeIntegerWidthRefusal, sourceNativeIntegerWidths,
  type SourceFixedWidthPrimitiveKind, type SourceNativeIntegerPrimitive, type SourceNativeIntegerWidthRefusal,
  type SourceNativeIntegerWidthRefusalCode, type SourcePlatformFacts,
} from "../platform-model.js";

export const sourcePrimitiveOperatorKinds = Object.freeze([
  "bool", "char", "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64",
  "native-int", "native-uint", "float16", "float32", "float64", "decimal", "int128", "uint128",
] as const satisfies readonly SourcePrimitiveKind[]);

export const sourcePrimitiveBinaryOperators = Object.freeze([
  "add", "subtract", "multiply", "divide", "remainder", "power", "bit-and", "bit-or", "bit-xor",
  "shift-left", "shift-right", "shift-right-unsigned", "less", "less-equal", "greater", "greater-equal",
  "equal", "not-equal",
] as const);

export const sourcePrimitiveUnaryOperators = Object.freeze([
  "positive", "negate", "bit-not", "logical-not", "increment", "decrement",
] as const);

export type SourcePrimitiveBinaryOperator = typeof sourcePrimitiveBinaryOperators[number];
export type SourcePrimitiveUnaryOperator = typeof sourcePrimitiveUnaryOperators[number];

export type SourcePrimitiveOperatorOperand =
  | { readonly kind: "fixed"; readonly primitive: SourcePrimitiveKind }
  | { readonly kind: "unbound-literal"; readonly primitive: SourcePrimitiveKind | "bigint"; readonly literal: SourceLiteralValue };

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

type PrimitivePromotionCell = SourcePrimitiveKind | null;
type PrimitivePromotionRow = readonly [
  PrimitivePromotionCell, PrimitivePromotionCell, PrimitivePromotionCell, PrimitivePromotionCell,
  PrimitivePromotionCell, PrimitivePromotionCell, PrimitivePromotionCell, PrimitivePromotionCell,
  PrimitivePromotionCell, PrimitivePromotionCell, PrimitivePromotionCell, PrimitivePromotionCell,
  PrimitivePromotionCell, PrimitivePromotionCell, PrimitivePromotionCell, PrimitivePromotionCell,
  PrimitivePromotionCell, PrimitivePromotionCell,
];

const refused = null;
const primitivePromotions = {
  bool: [refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, refused],
  char: [refused, "int32", "int32", "int32", "int32", "int32", "int32", "uint32", "int64", "uint64", refused, refused, refused, "float32", "float64", "decimal", refused, refused],
  int8: [refused, "int32", "int32", "int32", "int32", "int32", "int32", "int64", "int64", refused, refused, refused, refused, "float32", "float64", "decimal", refused, refused],
  uint8: [refused, "int32", "int32", "int32", "int32", "int32", "int32", "uint32", "int64", "uint64", refused, refused, refused, "float32", "float64", "decimal", refused, refused],
  int16: [refused, "int32", "int32", "int32", "int32", "int32", "int32", "int64", "int64", refused, refused, refused, refused, "float32", "float64", "decimal", refused, refused],
  uint16: [refused, "int32", "int32", "int32", "int32", "int32", "int32", "uint32", "int64", "uint64", refused, refused, refused, "float32", "float64", "decimal", refused, refused],
  int32: [refused, "int32", "int32", "int32", "int32", "int32", "int32", "int64", "int64", refused, refused, refused, refused, "float32", "float64", "decimal", refused, refused],
  uint32: [refused, "uint32", "int64", "uint32", "int64", "uint32", "int64", "uint32", "int64", "uint64", refused, refused, refused, "float32", "float64", "decimal", refused, refused],
  int64: [refused, "int64", "int64", "int64", "int64", "int64", "int64", "int64", "int64", refused, refused, refused, refused, "float32", "float64", "decimal", refused, refused],
  uint64: [refused, "uint64", refused, "uint64", refused, "uint64", refused, "uint64", refused, "uint64", refused, refused, refused, "float32", "float64", "decimal", refused, refused],
  "native-int": [refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, "native-int", refused, refused, refused, refused, refused, refused, refused],
  "native-uint": [refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, "native-uint", refused, refused, refused, refused, refused, refused],
  float16: [refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, "float16", refused, refused, refused, refused, refused],
  float32: [refused, "float32", "float32", "float32", "float32", "float32", "float32", "float32", "float32", "float32", refused, refused, refused, "float32", "float64", refused, refused, refused],
  float64: [refused, "float64", "float64", "float64", "float64", "float64", "float64", "float64", "float64", "float64", refused, refused, refused, "float64", "float64", refused, refused, refused],
  decimal: [refused, "decimal", "decimal", "decimal", "decimal", "decimal", "decimal", "decimal", "decimal", "decimal", refused, refused, refused, refused, refused, "decimal", refused, refused],
  int128: [refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, "int128", refused],
  uint128: [refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, refused, "uint128"],
} as const satisfies Readonly<Record<SourcePrimitiveKind, PrimitivePromotionRow>>;

const primitivePositions: ReadonlyMap<SourcePrimitiveKind, number> = new Map(
  sourcePrimitiveOperatorKinds.map((primitive, index) => [primitive, index]),
);
const smallIntegrals: ReadonlySet<SourcePrimitiveKind> = new Set(["char", "int8", "uint8", "int16", "uint16"]);
const integrals: ReadonlySet<SourcePrimitiveKind> = new Set([
  ...smallIntegrals, "int32", "uint32", "int64", "uint64", "native-int", "native-uint", "int128", "uint128",
]);
const shiftCounts: ReadonlySet<SourcePrimitiveKind> = new Set([...smallIntegrals, "int32", "int64"]);
const comparisonOperators: ReadonlySet<SourcePrimitiveBinaryOperator> = new Set([
  "less", "less-equal", "greater", "greater-equal", "equal", "not-equal",
]);
const equalityOperators: ReadonlySet<SourcePrimitiveBinaryOperator> = new Set(["equal", "not-equal"]);
const bitwiseOperators: ReadonlySet<SourcePrimitiveBinaryOperator> = new Set(["bit-and", "bit-or", "bit-xor"]);
const shiftOperators: ReadonlySet<SourcePrimitiveBinaryOperator> = new Set(["shift-left", "shift-right", "shift-right-unsigned"]);

export function sourcePrimitiveOperatorIsIntegral(kind: SourcePrimitiveKind): boolean {
  return integrals.has(kind);
}

/**
 * The binary operator decision. `platform` is the active target's native integer premise (E24): it is read only when
 * an unbound literal is fitted to native-int / native-uint and the 32-bit and 64-bit answers differ.
 */
export function decideSourcePrimitiveBinaryOperator(
  operator: SourcePrimitiveBinaryOperator,
  left: SourcePrimitiveOperatorOperand,
  right: SourcePrimitiveOperatorOperand,
  platform: SourcePlatformFacts,
  expectedKind?: SourcePrimitiveKind,
): SourcePrimitiveBinaryDecision {
  if (operator === "power") return refusal("Exponentiation has no admitted native operator result.");
  if (shiftOperators.has(operator)) {
    if (left.primitive === "bigint" || !integrals.has(left.primitive)) return refusal("A shift requires an integral left operand.");
    if (right.primitive === "bigint") return refusal("A shift count must be a 32-bit integer or narrower.");
    const count = right.kind === "unbound-literal" && sourcePrimitiveOperatorLiteralFits(right.literal, "int32")
      ? "int32" : right.primitive;
    if (!shiftCounts.has(count)) return refusal("A shift count must be a 32-bit integer or narrower.");
    const result = smallIntegrals.has(left.primitive) ? "int32" : left.primitive;
    return { kind: "resolved", result, left: result, right: count };
  }
  if (left.primitive === "bool" || right.primitive === "bool") {
    return equalityOperators.has(operator) && left.primitive === "bool" && right.primitive === "bool"
      ? { kind: "resolved", result: "bool", left: "bool", right: "bool" }
      : refusal(`Operator '${operator}' requires compatible numeric operands${equalityOperators.has(operator) ? " or two bool operands" : ""}.`);
  }
  let effectiveLeft: SourcePrimitiveKind | "bigint" = left.primitive;
  let effectiveRight: SourcePrimitiveKind | "bigint" = right.primitive;
  const expected = expectedKind === undefined || expectedKind === "bool" ? "outside"
    : expectedOperandsFit(left, right, expectedKind, platform);
  if (typeof expected === "object") return expected;
  if (expected === "fits") {
    effectiveLeft = expectedKind!;
    effectiveRight = expectedKind!;
  } else {
    const leftPartner = literalPartner(left, right.primitive, platform);
    if (typeof leftPartner === "object") return leftPartner;
    const rightPartner = literalPartner(right, left.primitive, platform);
    if (typeof rightPartner === "object") return rightPartner;
    effectiveLeft = leftPartner ?? effectiveLeft;
    effectiveRight = rightPartner ?? effectiveRight;
  }
  if (effectiveLeft === "bigint" || effectiveRight === "bigint") return refusal("A bigint literal has no admitted primitive partner or result.");
  const position = primitivePositions.get(effectiveRight);
  const promoted = position === undefined ? null : primitivePromotions[effectiveLeft][position];
  if (promoted === null || promoted === undefined) return refusal(
    `Operator '${operator}' has no admitted numeric result for '${effectiveLeft}' and '${effectiveRight}'.`,
  );
  if (bitwiseOperators.has(operator) && !integrals.has(promoted)) return refusal("A bitwise operator requires integral operands.");
  return { kind: "resolved", result: comparisonOperators.has(operator) ? "bool" : promoted, left: promoted, right: promoted };
}

/**
 * The partner kind an unbound literal adopts, when it fits. A native partner whose fit depends on an unstated width
 * gives no partner (fail closed); decideSourcePrimitiveBinaryOperator reports that case as the width refusal.
 */
export function sourcePrimitiveOperatorLiteralPartner(operand: SourcePrimitiveOperatorOperand,
  partner: SourcePrimitiveKind | "bigint", platform: SourcePlatformFacts): SourcePrimitiveKind | undefined {
  const selected = literalPartner(operand, partner, platform);
  return typeof selected === "object" ? undefined : selected;
}

function literalPartner(operand: SourcePrimitiveOperatorOperand, partner: SourcePrimitiveKind | "bigint",
  platform: SourcePlatformFacts): SourcePrimitiveKind | undefined | SourceNativeIntegerWidthRefusal {
  if (operand.kind !== "unbound-literal" || partner === "bigint") return undefined;
  const fit = sourcePrimitiveLiteralFit(operand.literal, partner, platform);
  return fit === "fits" ? partner : fit === "outside" ? undefined : fit;
}

export function decideSourcePrimitiveUnaryOperator(
  operator: SourcePrimitiveUnaryOperator,
  operand: SourcePrimitiveKind,
): SourcePrimitiveUnaryDecision {
  if (operator === "logical-not") return operand === "bool"
    ? { kind: "resolved", result: "bool", operand }
    : refusal("Logical negation requires an exact bool operand.");
  if (operator === "bit-not") return integrals.has(operand)
    ? { kind: "resolved", result: operand, operand }
    : refusal("Bitwise complement requires an integral operand.");
  if (operator === "negate") {
    if (operand === "uint64" || operand === "native-uint") return refusal(`Unary minus has no native signed result for '${operand}'.`);
    if (operand === "uint8" || operand === "uint16") return { kind: "resolved", result: "int32", operand: "int32" };
    if (operand === "uint32") return { kind: "resolved", result: "int64", operand: "int64" };
  }
  return operand === "bool" || operand === "char"
    ? refusal(`Unary operator '${operator}' requires a numeric operand.`)
    : { kind: "resolved", result: operand, operand };
}

// Fixed-width integer bounds. native-int / native-uint have no entry: their bounds come from the platform premise.
const integerBounds: Readonly<Partial<Record<SourceFixedWidthPrimitiveKind, readonly [bigint, bigint]>>> = {
  int8: [-128n, 127n], uint8: [0n, 255n], int16: [-32768n, 32767n], uint16: [0n, 65535n],
  int32: [-2147483648n, 2147483647n], uint32: [0n, 4294967295n],
  int64: [-(1n << 63n), (1n << 63n) - 1n], uint64: [0n, (1n << 64n) - 1n],
  int128: [-(1n << 127n), (1n << 127n) - 1n], uint128: [0n, (1n << 128n) - 1n],
};
const float32OverflowThreshold = (1n << 128n) - (1n << 103n);
const decimalOverflowThresholdTwice = (((1n << 96n) - 1n) << 1n) + 1n;

/**
 * Whether the literal fits the primitive kind. A fixed-width kind needs no premise. A native kind reads the active
 * target's premise (E24); when the premise is missing or conflicting and the answer depends on the width, the result
 * is false (fail closed) and sourcePrimitiveLiteralFit names the refusal.
 */
export function sourcePrimitiveOperatorLiteralFits(literal: SourceLiteralValue, primitive: SourceFixedWidthPrimitiveKind): boolean;
export function sourcePrimitiveOperatorLiteralFits(literal: SourceLiteralValue, primitive: SourcePrimitiveKind,
  platform: SourcePlatformFacts): boolean;
export function sourcePrimitiveOperatorLiteralFits(literal: SourceLiteralValue, primitive: SourcePrimitiveKind,
  platform?: SourcePlatformFacts): boolean {
  return literalFit(literal, primitive, platform) === "fits";
}

/** The literal fit with the native width refusal: "fits", "outside", or the refusal when only the unstated width decides. */
export function sourcePrimitiveLiteralFit(literal: SourceLiteralValue, primitive: SourcePrimitiveKind,
  platform: SourcePlatformFacts): SourcePrimitiveLiteralFit {
  return literalFit(literal, primitive, platform);
}

function literalFit(literal: SourceLiteralValue, primitive: SourcePrimitiveKind,
  platform: SourcePlatformFacts | undefined): SourcePrimitiveLiteralFit {
  if (literal.form === "array") return "outside";
  const constant = literal.integerConstant;
  if (primitive === "bool") return fitWhen(literal.form === "true" || literal.form === "false");
  if (primitive === "char") return fitWhen((literal.form === "string" || literal.form === "template") && literal.text.length === 1);
  if (isSourceNativeIntegerPrimitive(primitive)) {
    if (platform === undefined) throw new Error(`A '${primitive}' literal fit requires the active platform premise (E24).`);
    return nativeLiteralFit(constant ?? literal.integer, primitive, platform);
  }
  const bounds = integerBounds[primitive];
  if (bounds !== undefined) return fitWhen(withinBounds(constant ?? literal.integer, bounds));
  return fitWhen(floatingLiteralFits(literal, primitive));
}

/** A native integer fit: under a stated width, its bounds; otherwise the answer shared by every width, or the refusal. */
function nativeLiteralFit(integer: bigint | undefined, primitive: SourceNativeIntegerPrimitive,
  platform: SourcePlatformFacts): SourcePrimitiveLiteralFit {
  if (integer === undefined) return "outside";
  if (platform.kind === "known") return fitWhen(withinBounds(integer, sourceNativeIntegerBounds(primitive, platform.nativeIntegerBits)));
  const answers = new Set(sourceNativeIntegerWidths.map(width => withinBounds(integer, sourceNativeIntegerBounds(primitive, width))));
  return answers.size === 1 ? fitWhen(answers.has(true)) : sourceNativeIntegerWidthRefusal(primitive, platform);
}

function withinBounds(integer: bigint | undefined, bounds: readonly [bigint, bigint]): boolean {
  return integer !== undefined && integer >= bounds[0] && integer <= bounds[1];
}

function fitWhen(fits: boolean): "fits" | "outside" {
  return fits ? "fits" : "outside";
}

function floatingLiteralFits(literal: SourceLiteralValue, primitive: SourceFixedWidthPrimitiveKind): boolean {
  const constant = literal.integerConstant;
  if (constant !== undefined && literal.numeric === undefined) {
    const magnitude = { coefficient: constant < 0n ? -constant : constant, exponent: 0n };
    if (primitive === "float64") return compareSourceNumericLiteralMagnitude(magnitude, (1n << 1024n) - (1n << 970n)) < 0;
    if (primitive === "float16") return compareSourceNumericLiteralMagnitude(magnitude, 65520n) < 0;
    return primitive === "float32" ? compareSourceNumericLiteralMagnitude(magnitude, float32OverflowThreshold) < 0
      : primitive === "decimal" && compareSourceNumericLiteralMagnitude(
        { coefficient: magnitude.coefficient * 2n, exponent: 0n }, decimalOverflowThresholdTwice,
      ) < 0;
  }
  if (primitive === "float64") return literal.number !== undefined && Number.isFinite(literal.number);
  const numeric = literal.numeric;
  if (primitive === "float16") {
    const magnitude = numeric?.kind === "authored" ? Number(numeric.token.decimalText) : literal.number === undefined ? undefined : Math.abs(literal.number);
    return magnitude !== undefined && Number.isFinite(magnitude) && magnitude < 65520;
  }
  if (numeric?.kind !== "authored") return false;
  return primitive === "float32" ? compareSourceNumericLiteralMagnitude(numeric.token, float32OverflowThreshold) < 0
    : primitive === "decimal" && compareSourceNumericLiteralMagnitude(
      { coefficient: numeric.token.coefficient * 2n, exponent: numeric.token.exponent }, decimalOverflowThresholdTwice,
    ) < 0;
}

/**
 * Whether both operands take the expected kind. When either operand definitely cannot, the expected kind is not used
 * and no width is needed; otherwise a width refusal from either operand decides.
 */
function expectedOperandsFit(left: SourcePrimitiveOperatorOperand, right: SourcePrimitiveOperatorOperand,
  primitive: SourcePrimitiveKind, platform: SourcePlatformFacts): SourcePrimitiveLiteralFit {
  const fits = [left, right].map(operand => operand.primitive === primitive ? "fits" as const
    : operand.kind === "unbound-literal" ? literalFit(operand.literal, primitive, platform) : "outside" as const);
  if (fits.includes("outside")) return "outside";
  return fits.find((fit): fit is SourceNativeIntegerWidthRefusal => typeof fit === "object") ?? "fits";
}

function refusal(reason: string): SourcePrimitiveOperatorRefusal {
  return { kind: "refused", code: "TSONIC_LOCAL_TYPE_UNSUPPORTED", reason };
}
