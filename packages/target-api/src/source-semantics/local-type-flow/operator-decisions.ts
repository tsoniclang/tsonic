import type { SourcePrimitiveKind } from "@tsonic/tsts";
import { compareSourceNumericLiteralMagnitude } from "../literal-token.js";
import type { SourceLiteralValue } from "../literal-values-model.js";

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
  readonly reason: string;
}

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

export function decideSourcePrimitiveBinaryOperator(
  operator: SourcePrimitiveBinaryOperator,
  left: SourcePrimitiveOperatorOperand,
  right: SourcePrimitiveOperatorOperand,
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
  if (expectedKind !== undefined && expectedKind !== "bool" && canUseExpectedKind(left, expectedKind) && canUseExpectedKind(right, expectedKind)) {
    effectiveLeft = expectedKind;
    effectiveRight = expectedKind;
  } else {
    if (left.kind === "unbound-literal" && right.primitive !== "bigint" && sourcePrimitiveOperatorLiteralFits(left.literal, right.primitive)) effectiveLeft = right.primitive;
    if (right.kind === "unbound-literal" && left.primitive !== "bigint" && sourcePrimitiveOperatorLiteralFits(right.literal, left.primitive)) effectiveRight = left.primitive;
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

const integerBounds: Readonly<Partial<Record<SourcePrimitiveKind, readonly [bigint, bigint]>>> = {
  int8: [-128n, 127n], uint8: [0n, 255n], int16: [-32768n, 32767n], uint16: [0n, 65535n],
  int32: [-2147483648n, 2147483647n], uint32: [0n, 4294967295n],
  int64: [-(1n << 63n), (1n << 63n) - 1n], uint64: [0n, (1n << 64n) - 1n],
  "native-int": [-(1n << 63n), (1n << 63n) - 1n], "native-uint": [0n, (1n << 64n) - 1n],
  int128: [-(1n << 127n), (1n << 127n) - 1n], uint128: [0n, (1n << 128n) - 1n],
};
const float32OverflowThreshold = (1n << 128n) - (1n << 103n);
const decimalOverflowThresholdTwice = (((1n << 96n) - 1n) << 1n) + 1n;

export function sourcePrimitiveOperatorLiteralFits(literal: SourceLiteralValue, primitive: SourcePrimitiveKind): boolean {
  if (literal.form === "array") return false;
  const bounds = integerBounds[primitive];
  const constant = literal.form === "binary" || literal.form === "parenthesized" ? literal.integerConstant : undefined;
  if (constant !== undefined && bounds !== undefined && constant >= bounds[0] && constant <= bounds[1]) return true;
  if (primitive === "bool") return literal.form === "true" || literal.form === "false";
  if (primitive === "char") return (literal.form === "string" || literal.form === "template") && literal.text.length === 1;
  if (bounds !== undefined) return literal.integer !== undefined && literal.integer >= bounds[0] && literal.integer <= bounds[1];
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

function canUseExpectedKind(operand: SourcePrimitiveOperatorOperand, primitive: SourcePrimitiveKind): boolean {
  return operand.primitive === primitive || operand.kind === "unbound-literal" && sourcePrimitiveOperatorLiteralFits(operand.literal, primitive);
}

function refusal(reason: string): SourcePrimitiveOperatorRefusal {
  return { kind: "refused", reason };
}
