import { compareSourceNumericLiteralMagnitude } from "../literal-token.js";
import { isSourceNativeIntegerPrimitive, sourceNativeIntegerBounds, sourceNativeIntegerWidthRefusal, sourceNativeIntegerWidths, } from "../platform-model.js";
export const sourcePrimitiveOperatorKinds = Object.freeze([
    "bool", "char", "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64",
    "native-int", "native-uint", "float16", "float32", "float64", "decimal", "int128", "uint128",
]);
export const sourcePrimitiveBinaryOperators = Object.freeze([
    "add", "subtract", "multiply", "divide", "remainder", "power", "bit-and", "bit-or", "bit-xor",
    "shift-left", "shift-right", "shift-right-unsigned", "less", "less-equal", "greater", "greater-equal",
    "equal", "not-equal",
]);
export const sourcePrimitiveUnaryOperators = Object.freeze([
    "positive", "negate", "bit-not", "logical-not", "increment", "decrement",
]);
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
};
const primitivePositions = new Map(sourcePrimitiveOperatorKinds.map((primitive, index) => [primitive, index]));
const smallIntegrals = new Set(["char", "int8", "uint8", "int16", "uint16"]);
const integrals = new Set([
    ...smallIntegrals, "int32", "uint32", "int64", "uint64", "native-int", "native-uint", "int128", "uint128",
]);
const shiftCounts = new Set([...smallIntegrals, "int32", "int64"]);
const comparisonOperators = new Set([
    "less", "less-equal", "greater", "greater-equal", "equal", "not-equal",
]);
const equalityOperators = new Set(["equal", "not-equal"]);
const bitwiseOperators = new Set(["bit-and", "bit-or", "bit-xor"]);
const shiftOperators = new Set(["shift-left", "shift-right", "shift-right-unsigned"]);
export function sourcePrimitiveOperatorIsIntegral(kind) {
    return integrals.has(kind);
}
/**
 * The binary operator decision. `platform` is the active target's native integer premise (E24): it is read only when
 * an unbound literal is fitted to native-int / native-uint and the 32-bit and 64-bit answers differ.
 */
export function decideSourcePrimitiveBinaryOperator(operator, left, right, platform, expectedKind) {
    if (operator === "power")
        return refusal("Exponentiation has no admitted native operator result.");
    if (shiftOperators.has(operator)) {
        if (left.primitive === "bigint" || !integrals.has(left.primitive))
            return refusal("A shift requires an integral left operand.");
        if (right.primitive === "bigint")
            return refusal("A shift count must be a 32-bit integer or narrower.");
        const count = right.kind === "unbound-literal" && sourcePrimitiveOperatorLiteralFits(right.literal, "int32")
            ? "int32" : right.primitive;
        if (!shiftCounts.has(count))
            return refusal("A shift count must be a 32-bit integer or narrower.");
        const result = smallIntegrals.has(left.primitive) ? "int32" : left.primitive;
        return { kind: "resolved", result, left: result, right: count };
    }
    if (left.primitive === "bool" || right.primitive === "bool") {
        return equalityOperators.has(operator) && left.primitive === "bool" && right.primitive === "bool"
            ? { kind: "resolved", result: "bool", left: "bool", right: "bool" }
            : refusal(`Operator '${operator}' requires compatible numeric operands${equalityOperators.has(operator) ? " or two bool operands" : ""}.`);
    }
    let effectiveLeft = left.primitive;
    let effectiveRight = right.primitive;
    const expected = expectedKind === undefined || expectedKind === "bool" ? "outside"
        : expectedOperandsFit(left, right, expectedKind, platform);
    if (typeof expected === "object")
        return expected;
    if (expected === "fits") {
        effectiveLeft = expectedKind;
        effectiveRight = expectedKind;
    }
    else {
        const leftPartner = literalPartner(left, right.primitive, platform);
        if (typeof leftPartner === "object")
            return leftPartner;
        const rightPartner = literalPartner(right, left.primitive, platform);
        if (typeof rightPartner === "object")
            return rightPartner;
        effectiveLeft = leftPartner ?? effectiveLeft;
        effectiveRight = rightPartner ?? effectiveRight;
    }
    if (effectiveLeft === "bigint" || effectiveRight === "bigint")
        return refusal("A bigint literal has no admitted primitive partner or result.");
    const position = primitivePositions.get(effectiveRight);
    const promoted = position === undefined ? null : primitivePromotions[effectiveLeft][position];
    if (promoted === null || promoted === undefined)
        return refusal(`Operator '${operator}' has no admitted numeric result for '${effectiveLeft}' and '${effectiveRight}'.`);
    if (bitwiseOperators.has(operator) && !integrals.has(promoted))
        return refusal("A bitwise operator requires integral operands.");
    return { kind: "resolved", result: comparisonOperators.has(operator) ? "bool" : promoted, left: promoted, right: promoted };
}
/**
 * The partner kind an unbound literal adopts, when it fits. A native partner whose fit depends on an unstated width
 * gives no partner (fail closed); decideSourcePrimitiveBinaryOperator reports that case as the width refusal.
 */
export function sourcePrimitiveOperatorLiteralPartner(operand, partner, platform) {
    const selected = literalPartner(operand, partner, platform);
    return typeof selected === "object" ? undefined : selected;
}
function literalPartner(operand, partner, platform) {
    if (operand.kind !== "unbound-literal" || partner === "bigint")
        return undefined;
    const fit = sourcePrimitiveLiteralFit(operand.literal, partner, platform);
    return fit === "fits" ? partner : fit === "outside" ? undefined : fit;
}
export function decideSourcePrimitiveUnaryOperator(operator, operand) {
    if (operator === "logical-not")
        return operand === "bool"
            ? { kind: "resolved", result: "bool", operand }
            : refusal("Logical negation requires an exact bool operand.");
    if (operator === "bit-not")
        return integrals.has(operand)
            ? { kind: "resolved", result: operand, operand }
            : refusal("Bitwise complement requires an integral operand.");
    if (operator === "negate") {
        if (operand === "uint64" || operand === "native-uint")
            return refusal(`Unary minus has no native signed result for '${operand}'.`);
        if (operand === "uint8" || operand === "uint16")
            return { kind: "resolved", result: "int32", operand: "int32" };
        if (operand === "uint32")
            return { kind: "resolved", result: "int64", operand: "int64" };
    }
    return operand === "bool" || operand === "char"
        ? refusal(`Unary operator '${operator}' requires a numeric operand.`)
        : { kind: "resolved", result: operand, operand };
}
// Fixed-width integer bounds. native-int / native-uint have no entry: their bounds come from the platform premise.
const integerBounds = {
    int8: [-128n, 127n], uint8: [0n, 255n], int16: [-32768n, 32767n], uint16: [0n, 65535n],
    int32: [-2147483648n, 2147483647n], uint32: [0n, 4294967295n],
    int64: [-(1n << 63n), (1n << 63n) - 1n], uint64: [0n, (1n << 64n) - 1n],
    int128: [-(1n << 127n), (1n << 127n) - 1n], uint128: [0n, (1n << 128n) - 1n],
};
const float32OverflowThreshold = (1n << 128n) - (1n << 103n);
const decimalOverflowThresholdTwice = (((1n << 96n) - 1n) << 1n) + 1n;
export function sourcePrimitiveOperatorLiteralFits(literal, primitive, platform) {
    return literalFit(literal, primitive, platform) === "fits";
}
/** The literal fit with the native width refusal: "fits", "outside", or the refusal when only the unstated width decides. */
export function sourcePrimitiveLiteralFit(literal, primitive, platform) {
    return literalFit(literal, primitive, platform);
}
function literalFit(literal, primitive, platform) {
    if (literal.form === "array")
        return "outside";
    const constant = literal.integerConstant;
    if (primitive === "bool")
        return fitWhen(literal.form === "true" || literal.form === "false");
    if (primitive === "char")
        return fitWhen((literal.form === "string" || literal.form === "template") && literal.text.length === 1);
    if (isSourceNativeIntegerPrimitive(primitive)) {
        if (platform === undefined)
            throw new Error(`A '${primitive}' literal fit requires the active platform premise (E24).`);
        return nativeLiteralFit(constant ?? literal.integer, primitive, platform);
    }
    const bounds = integerBounds[primitive];
    if (bounds !== undefined)
        return fitWhen(withinBounds(constant ?? literal.integer, bounds));
    return fitWhen(floatingLiteralFits(literal, primitive));
}
/** A native integer fit: under a stated width, its bounds; otherwise the answer shared by every width, or the refusal. */
function nativeLiteralFit(integer, primitive, platform) {
    if (integer === undefined)
        return "outside";
    if (platform.kind === "known")
        return fitWhen(withinBounds(integer, sourceNativeIntegerBounds(primitive, platform.nativeIntegerBits)));
    const answers = new Set(sourceNativeIntegerWidths.map(width => withinBounds(integer, sourceNativeIntegerBounds(primitive, width))));
    return answers.size === 1 ? fitWhen(answers.has(true)) : sourceNativeIntegerWidthRefusal(primitive, platform);
}
function withinBounds(integer, bounds) {
    return integer !== undefined && integer >= bounds[0] && integer <= bounds[1];
}
function fitWhen(fits) {
    return fits ? "fits" : "outside";
}
function floatingLiteralFits(literal, primitive) {
    const constant = literal.integerConstant;
    if (constant !== undefined && literal.numeric === undefined) {
        const magnitude = { coefficient: constant < 0n ? -constant : constant, exponent: 0n };
        if (primitive === "float64")
            return compareSourceNumericLiteralMagnitude(magnitude, (1n << 1024n) - (1n << 970n)) < 0;
        if (primitive === "float16")
            return compareSourceNumericLiteralMagnitude(magnitude, 65520n) < 0;
        return primitive === "float32" ? compareSourceNumericLiteralMagnitude(magnitude, float32OverflowThreshold) < 0
            : primitive === "decimal" && compareSourceNumericLiteralMagnitude({ coefficient: magnitude.coefficient * 2n, exponent: 0n }, decimalOverflowThresholdTwice) < 0;
    }
    if (primitive === "float64")
        return literal.number !== undefined && Number.isFinite(literal.number);
    const numeric = literal.numeric;
    if (primitive === "float16") {
        const magnitude = numeric?.kind === "authored" ? Number(numeric.token.decimalText) : literal.number === undefined ? undefined : Math.abs(literal.number);
        return magnitude !== undefined && Number.isFinite(magnitude) && magnitude < 65520;
    }
    if (numeric?.kind !== "authored")
        return false;
    return primitive === "float32" ? compareSourceNumericLiteralMagnitude(numeric.token, float32OverflowThreshold) < 0
        : primitive === "decimal" && compareSourceNumericLiteralMagnitude({ coefficient: numeric.token.coefficient * 2n, exponent: numeric.token.exponent }, decimalOverflowThresholdTwice) < 0;
}
/**
 * Whether both operands take the expected kind. When either operand definitely cannot, the expected kind is not used
 * and no width is needed; otherwise a width refusal from either operand decides.
 */
function expectedOperandsFit(left, right, primitive, platform) {
    const fits = [left, right].map(operand => operand.primitive === primitive ? "fits"
        : operand.kind === "unbound-literal" ? literalFit(operand.literal, primitive, platform) : "outside");
    if (fits.includes("outside"))
        return "outside";
    return fits.find((fit) => typeof fit === "object") ?? "fits";
}
function refusal(reason) {
    return { kind: "refused", code: "TSONIC_LOCAL_TYPE_UNSUPPORTED", reason };
}
/**
 * Enum operands (native enums, E-enum rows): a numeric enum value is an operand of its enum's integer primitive (int32,
 * or int64 for a 64-bit enum: enum-constants.ts selects the width), except where the operator keeps the enum domain:
 * `~e` on one enum and `|`, `&`, `^` on two operands of the same enum produce that enum (the native enum operators).
 */
export function sourceEnumOperandPrimitive(width) {
    return width?.kind !== "resolved" ? undefined : width.integerWidth === 64 ? "int64" : "int32";
}
/** Whether an operator over enum operands keeps the enum domain (see sourceEnumOperandPrimitive). */
export function sourceEnumOperatorKeepsDomain(operator, enums) {
    if (enums.length === 0 || enums.some(declaration => declaration === undefined))
        return false;
    if (operator === "bit-not")
        return enums.length === 1;
    return (operator === "bit-and" || operator === "bit-or" || operator === "bit-xor") && enums.length === 2 && enums[0] === enums[1];
}
//# sourceMappingURL=operator-decisions.js.map