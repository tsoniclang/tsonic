import assert from "node:assert/strict";
import test from "node:test";
import { createSourceTypeFlowTestProgram } from "./type-flow-test-program.js";
import type { SourcePrimitiveKind } from "@tsonic/tsts";
import { createCompilerSessionFromFiles, type AstReader, type Node } from "@tsonic/tsts";
import { analyzeSourceLiteralValues } from "../literal-values.js";
import { parseSourceNumericLiteral } from "../literal-token.js";
import type { SourceLiteralValue } from "../literal-values-model.js";
import {
  decideSourcePrimitiveBinaryOperator, decideSourcePrimitiveUnaryOperator,
  sourcePrimitiveBinaryOperators, sourcePrimitiveOperatorKinds, sourcePrimitiveOperatorLiteralFits, sourcePrimitiveOperatorIsIntegral,
  sourcePrimitiveOperatorLiteralPartner, sourcePrimitiveLiteralFit,
  sourcePrimitiveUnaryOperators, type SourcePrimitiveBinaryOperator, type SourcePrimitiveOperatorOperand,
} from "./operator-decisions.js";
import type { SourcePlatformFacts } from "../platform-model.js";

// E24 (N5) unit controls: neutral premises only; no 32-bit runtime target exists.
const known64: SourcePlatformFacts = Object.freeze({ kind: "known", nativeIntegerBits: 64, basis: "unit control: 64-bit" });
const known32: SourcePlatformFacts = Object.freeze({ kind: "known", nativeIntegerBits: 32, basis: "unit control: 32-bit" });
const missing: SourcePlatformFacts = Object.freeze({ kind: "missing", reason: "The unit control states no architecture." });
const conflicting: SourcePlatformFacts = Object.freeze({ kind: "conflicting", premises: Object.freeze([
  Object.freeze({ nativeIntegerBits: 64 as const, basis: "first statement" }),
  Object.freeze({ nativeIntegerBits: 32 as const, basis: "second statement" }),
]) });
const fixed = (primitive: SourcePrimitiveKind): SourcePrimitiveOperatorOperand => ({ kind: "fixed", primitive });
const small = new Set<SourcePrimitiveKind>(["char", "int8", "uint8", "int16", "uint16"]);
const integral = new Set<SourcePrimitiveKind>([...small, "int32", "uint32", "int64", "uint64", "native-int", "native-uint", "int128", "uint128"]);
const shiftCount = new Set<SourcePrimitiveKind>([...small, "int32", "int64"]);
const nonMixing = new Set<SourcePrimitiveKind>(["float16", "native-int", "native-uint", "int128", "uint128"]);
const decimalIntegral = new Set<SourcePrimitiveKind>([...small, "int32", "uint32", "int64", "uint64"]);
const comparisons = new Set<SourcePrimitiveBinaryOperator>(["less", "less-equal", "greater", "greater-equal", "equal", "not-equal"]);
const equalities = new Set<SourcePrimitiveBinaryOperator>(["equal", "not-equal"]);
const bitwise = new Set<SourcePrimitiveBinaryOperator>(["bit-and", "bit-or", "bit-xor"]);
const shifts = new Set<SourcePrimitiveBinaryOperator>(["shift-left", "shift-right", "shift-right-unsigned"]);

function referencePromotion(left: SourcePrimitiveKind, right: SourcePrimitiveKind): SourcePrimitiveKind | null {
  if (left === "bool" || right === "bool") return null;
  if (left === right) return small.has(left) ? "int32" : left;
  if (nonMixing.has(left) || nonMixing.has(right)) return null;
  if (left === "decimal" || right === "decimal") return decimalIntegral.has(left === "decimal" ? right : left) ? "decimal" : null;
  if (left === "float64" || right === "float64") return "float64";
  if (left === "float32" || right === "float32") return "float32";
  if (left === "uint64" || right === "uint64") return new Set<SourcePrimitiveKind>(["char", "uint8", "uint16", "uint32", "uint64"])
    .has(left === "uint64" ? right : left) ? "uint64" : null;
  if (left === "int64" || right === "int64") return "int64";
  if (left === "uint32" || right === "uint32") return new Set<SourcePrimitiveKind>(["int8", "int16", "int32"])
    .has(left === "uint32" ? right : left) ? "int64" : "uint32";
  return "int32";
}

function expectedBinary(operator: SourcePrimitiveBinaryOperator, left: SourcePrimitiveKind, right: SourcePrimitiveKind): SourcePrimitiveKind | null {
  if (operator === "power") return null;
  if (shifts.has(operator)) return integral.has(left) && shiftCount.has(right) ? small.has(left) ? "int32" : left : null;
  if (equalities.has(operator) && left === "bool" && right === "bool") return "bool";
  const promoted = referencePromotion(left, right);
  return promoted === null || bitwise.has(operator) && !integral.has(promoted) ? null : comparisons.has(operator) ? "bool" : promoted;
}

test("D-A every operator family classifies all 18 by 18 primitive pairs with a result or precise refusal", () => {
  assert.equal(sourcePrimitiveOperatorKinds.length, 18);
  assert.equal(new Set(sourcePrimitiveOperatorKinds).size, 18);
  for (const operator of sourcePrimitiveBinaryOperators) {
    let classified = 0;
    for (const left of sourcePrimitiveOperatorKinds) for (const right of sourcePrimitiveOperatorKinds) {
      const selected = decideSourcePrimitiveBinaryOperator(operator, fixed(left), fixed(right), known64);
      const expected = expectedBinary(operator, left, right);
      const label = `${operator}: ${left}, ${right}`;
      assert.equal(selected.kind === "resolved" ? selected.result : null, expected, label);
      if (selected.kind === "refused") assert.equal(selected.reason.length > 0, true, label);
      else {
        assert.equal(sourcePrimitiveOperatorKinds.includes(selected.left), true, label);
        assert.equal(sourcePrimitiveOperatorKinds.includes(selected.right), true, label);
      }
      classified += 1;
    }
    assert.equal(classified, 324, operator);
  }
});

test("the integral boundary shares the operator owner's exact finite classification", () => {
  for (const kind of sourcePrimitiveOperatorKinds) {
    assert.equal(sourcePrimitiveOperatorIsIntegral(kind), integral.has(kind), kind);
  }
});

test("D-A every unary operator classifies all primitive kinds with the ruled unsigned negation", () => {
  for (const operator of sourcePrimitiveUnaryOperators) {
    let classified = 0;
    for (const primitive of sourcePrimitiveOperatorKinds) {
      const selected = decideSourcePrimitiveUnaryOperator(operator, primitive);
      const admitted = operator === "logical-not" ? primitive === "bool"
        : operator === "bit-not" ? integral.has(primitive)
        : primitive !== "bool" && primitive !== "char" &&
          !(operator === "negate" && (primitive === "uint64" || primitive === "native-uint"));
      assert.equal(selected.kind === "resolved", admitted, `${operator}: ${primitive}`);
      if (selected.kind === "resolved") {
        const expected = operator === "negate" && (primitive === "uint8" || primitive === "uint16") ? "int32"
          : operator === "negate" && primitive === "uint32" ? "int64" : primitive;
        assert.equal(selected.result, expected, `${operator}: ${primitive} has its exact ruled result`);
        assert.equal(selected.operand, expected);
      } else assert.equal(selected.reason.length > 0, true);
      classified += 1;
    }
    assert.equal(classified, 18, operator);
  }
});

test("Q10 unsigned negation has signed results without changing positive, complement or updates", () => {
  for (const [operand, result] of [["uint8", "int32"], ["uint16", "int32"], ["uint32", "int64"]] as const) {
    const selected = decideSourcePrimitiveUnaryOperator("negate", operand);
    assert.equal(selected.kind === "resolved" && selected.result === result && selected.operand === result, true, operand);
  }
  for (const operand of ["uint64", "native-uint"] as const) {
    const refused = decideSourcePrimitiveUnaryOperator("negate", operand);
    assert.equal(refused.kind === "refused" && refused.reason === `Unary minus has no native signed result for '${operand}'.`, true);
  }
  for (const operator of ["positive", "bit-not", "increment", "decrement"] as const) {
    for (const operand of ["uint8", "uint16", "uint32", "uint64", "native-uint"] as const) {
      const selected = decideSourcePrimitiveUnaryOperator(operator, operand);
      assert.equal(selected.kind === "resolved" && selected.result === operand && selected.operand === operand, true, `${operator}: ${operand}`);
    }
  }
});

test("D-A numeric promotion and operator admission are different decisions", () => {
  for (const [left, right, result] of [
    ["int8", "int8", "int32"], ["char", "uint32", "uint32"], ["uint32", "int32", "int64"],
    ["int32", "int64", "int64"], ["int32", "float64", "float64"], ["float32", "int64", "float32"],
    ["decimal", "uint64", "decimal"], ["int128", "int128", "int128"], ["float16", "float16", "float16"],
  ] as const) {
    const selected = decideSourcePrimitiveBinaryOperator("add", fixed(left), fixed(right), known64);
    assert.equal(selected.kind === "resolved" && selected.result === result, true, `${left} + ${right}`);
  }
  for (const [left, right] of [["uint64", "int64"], ["decimal", "float64"], ["float16", "float32"],
    ["native-int", "int32"], ["uint128", "uint64"], ["bool", "int32"]] as const) {
    assert.equal(decideSourcePrimitiveBinaryOperator("add", fixed(left), fixed(right), known64).kind, "refused", `${left} + ${right}`);
    assert.equal(decideSourcePrimitiveBinaryOperator("equal", fixed(left), fixed(right), known64).kind, "refused", `${left} == ${right}`);
  }
  for (const primitive of ["float16", "float32", "float64", "decimal", "bool"] as const) {
    assert.equal(decideSourcePrimitiveBinaryOperator("bit-and", fixed(primitive), fixed(primitive), known64).kind, "refused", primitive);
  }
  assert.equal(decideSourcePrimitiveBinaryOperator("equal", fixed("bool"), fixed("bool"), known64).kind, "resolved");
  assert.equal(decideSourcePrimitiveBinaryOperator("less", fixed("bool"), fixed("bool"), known64).kind, "refused");
});

test("D-A shifts admit narrow counts and checked int64 counts and promote only the left carrier", () => {
  for (const left of sourcePrimitiveOperatorKinds) for (const right of sourcePrimitiveOperatorKinds) {
    const selected = decideSourcePrimitiveBinaryOperator("shift-left", fixed(left), fixed(right), known64, "int64");
    if (integral.has(left) && shiftCount.has(right)) {
      assert.equal(selected.kind === "resolved" && selected.right === right && selected.result === (small.has(left) ? "int32" : left), true, `${left}, ${right}`);
    } else assert.equal(selected.kind, "refused", `${left}, ${right}`);
  }
  for (const primitive of ["uint32", "uint64", "native-int", "native-uint", "int128", "uint128", "float16", "float32", "float64", "decimal"] as const) {
    const selected = decideSourcePrimitiveBinaryOperator("shift-right", fixed("int64"), fixed(primitive), known64);
    assert.equal(selected.kind === "refused" && selected.reason === "A shift count must be a 32-bit integer or narrower.", true, primitive);
  }
  const literal = unbound("3");
  const selected = decideSourcePrimitiveBinaryOperator("shift-right-unsigned", fixed("uint64"), literal, known64);
  assert.equal(selected.kind === "resolved" && selected.left === "uint64" && selected.right === "int32" && selected.result === "uint64", true);
  assert.equal(decideSourcePrimitiveBinaryOperator("shift-right", fixed("int64"), unboundBigint(3n), known64).kind, "refused");
});

test("D-A literal adaptation cannot retarget a fixed or already-filled scalar width", () => {
  for (const operator of ["add", "bit-and", "less"] as const) {
    const selected = decideSourcePrimitiveBinaryOperator(operator, fixed("float64"), unbound("2"), known64, "int32");
    assert.equal(operator === "bit-and" ? selected.kind === "refused"
      : selected.kind === "resolved" && selected.left === "float64" && selected.right === "float64" &&
        selected.result === (operator === "less" ? "bool" : "float64"), true, operator);
  }
  const fixedPair = decideSourcePrimitiveBinaryOperator("add", fixed("uint64"), fixed("int64"), known64, "uint64");
  assert.equal(fixedPair.kind, "refused");
  const filled = decideSourcePrimitiveBinaryOperator("add", fixed("float32"), fixed("int64"), known64, "int64");
  assert.equal(filled.kind === "resolved" && filled.left === "float32" && filled.result === "float32", true);
});

test("F6 one C14 literal partner owner preserves actual receipt, fixed widths and nonfit refusal", () => {
  const whole = unbound("17");
  assert.equal(sourcePrimitiveOperatorLiteralPartner(whole, "float32", known64), "float32");
  assert.equal(sourcePrimitiveOperatorLiteralPartner(whole, "int8", known64), "int8");
  assert.equal(sourcePrimitiveOperatorLiteralPartner(fixed("int64"), "float32", known64) === undefined, true);
  assert.equal(sourcePrimitiveOperatorLiteralPartner(whole, "bigint", known64) === undefined, true);
  assert.equal(sourcePrimitiveOperatorLiteralPartner(unbound("256"), "uint8", known64) === undefined, true);
  assert.equal(sourcePrimitiveOperatorLiteralPartner(unbound("1.5"), "int32", known64) === undefined, true);
  for (const [left, right] of [[whole, fixed("float32")], [fixed("float32"), whole]] as const) {
    const result = decideSourcePrimitiveBinaryOperator("add", left, right, known64);
    assert.equal(result.kind === "resolved" && result.result === "float32" && result.left === "float32" && result.right === "float32", true);
  }
});

test("D-A one decision owner adapts retained unbound literals and exact all-literal expectations", () => {
  for (const [left, right, expected, result] of [
    [fixed("int32"), unbound("2"), undefined, "int32"],
    [fixed("float32"), unbound("1.5"), undefined, "float32"],
    [fixed("int32"), unbound("0.5"), undefined, "float64"],
    [unbound("7"), unbound("2"), "uint8", "int32"],
    [unbound("1.5"), unbound("2.5"), "float32", "float32"],
    [unbound("7"), unbound("2.5"), "int32", "float64"],
    [fixed("uint64"), unboundBigint(9007199254740993n), undefined, "uint64"],
    [fixed("int128"), unboundBigint((1n << 127n) - 1n), undefined, "int128"],
  ] as const) {
    const selected = decideSourcePrimitiveBinaryOperator("add", left, right, known64, expected);
    assert.equal(selected.kind === "resolved" && selected.result === result, true, `${left.primitive}, ${right.primitive}, ${expected ?? "none"}`);
  }
  const overflow = decideSourcePrimitiveBinaryOperator("add", fixed("uint64"), unboundBigint(1n << 64n), known64);
  assert.equal(overflow.kind, "refused", "overflow cannot acquire an invented floating Source kind");
});

test("D-A exact literal bounds never introduce a JS integer precision cap", () => {
  for (const [primitive, minimum, maximum] of [
    ["int8", -128n, 127n], ["uint8", 0n, 255n], ["int16", -32768n, 32767n], ["uint16", 0n, 65535n],
    ["int32", -(1n << 31n), (1n << 31n) - 1n], ["uint32", 0n, (1n << 32n) - 1n],
    ["int64", -(1n << 63n), (1n << 63n) - 1n], ["uint64", 0n, (1n << 64n) - 1n],
    ["int128", -(1n << 127n), (1n << 127n) - 1n], ["uint128", 0n, (1n << 128n) - 1n],
  ] as const) {
    for (const value of [minimum, maximum]) assert.equal(sourcePrimitiveOperatorLiteralFits(bigintLiteral(value), primitive), true, `${primitive}: ${value}`);
    for (const value of [minimum - 1n, maximum + 1n]) assert.equal(sourcePrimitiveOperatorLiteralFits(bigintLiteral(value), primitive), false, `${primitive}: ${value}`);
  }
  assert.equal(sourcePrimitiveOperatorLiteralFits(bigintLiteral(9007199254740993n), "uint64"), true);
  assert.equal(sourcePrimitiveOperatorLiteralFits({ form: "parenthesized", integerConstant: (1n << 127n) - 1n }, "int128"), true);
  assert.equal(sourcePrimitiveOperatorLiteralFits({ form: "binary", integerConstant: 1n << 128n }, "uint128"), false);
});

test("E24 native-int / native-uint literal bounds follow the stated 32-bit or 64-bit premise", () => {
  for (const [platform, primitive, minimum, maximum] of [
    [known64, "native-int", -(1n << 63n), (1n << 63n) - 1n], [known64, "native-uint", 0n, (1n << 64n) - 1n],
    [known32, "native-int", -(1n << 31n), (1n << 31n) - 1n], [known32, "native-uint", 0n, (1n << 32n) - 1n],
  ] as const) {
    const label = `${platform.kind === "known" ? platform.nativeIntegerBits : "?"}-bit ${primitive}`;
    for (const value of [minimum, maximum]) {
      assert.equal(sourcePrimitiveOperatorLiteralFits(bigintLiteral(value), primitive, platform), true, `${label}: ${value}`);
      assert.equal(sourcePrimitiveLiteralFit(bigintLiteral(value), primitive, platform), "fits", `${label}: ${value}`);
    }
    for (const value of [minimum - 1n, maximum + 1n]) {
      assert.equal(sourcePrimitiveOperatorLiteralFits(bigintLiteral(value), primitive, platform), false, `${label}: ${value}`);
      assert.equal(sourcePrimitiveLiteralFit(bigintLiteral(value), primitive, platform), "outside", `${label}: ${value}`);
    }
  }
  // The Q1 int64 default is not pointer-sized: its bounds take no premise and stay 64-bit.
  assert.equal(sourcePrimitiveOperatorLiteralFits(bigintLiteral((1n << 63n) - 1n), "int64"), true);
  for (const platform of [known64, known32, missing, conflicting]) {
    assert.equal(sourcePrimitiveOperatorLiteralFits(bigintLiteral((1n << 63n) - 1n), "int64", platform), true);
    assert.equal(sourcePrimitiveOperatorLiteralFits(bigintLiteral(1n << 63n), "int64", platform), false);
    assert.equal(sourcePrimitiveOperatorLiteralFits({ form: "string", text: "x" }, "native-int", platform), false,
      "a non-integer literal fits no native kind under any premise");
  }
});

test("E24 a missing or conflicting premise refuses only a fit the 32-bit and 64-bit widths answer differently", () => {
  for (const [platform, code] of [
    [missing, "TSONIC_NATIVE_INTEGER_WIDTH_MISSING"], [conflicting, "TSONIC_NATIVE_INTEGER_WIDTH_CONFLICTING"],
  ] as const) {
    // Width-independent answers need no premise.
    for (const [value, primitive, expected] of [
      [5n, "native-int", "fits"], [-(1n << 31n), "native-int", "fits"], [(1n << 31n) - 1n, "native-int", "fits"],
      [(1n << 32n) - 1n, "native-uint", "fits"], [-1n, "native-uint", "outside"],
      [1n << 63n, "native-int", "outside"], [1n << 64n, "native-uint", "outside"],
    ] as const) assert.equal(sourcePrimitiveLiteralFit(bigintLiteral(value), primitive, platform), expected, `${code}: ${primitive} ${value}`);
    // Width-dependent answers are the precise refusal; the boolean fit fails closed.
    for (const [value, primitive] of [
      [1n << 31n, "native-int"], [-(1n << 31n) - 1n, "native-int"], [(1n << 63n) - 1n, "native-int"], [1n << 32n, "native-uint"],
    ] as const) {
      const fit = sourcePrimitiveLiteralFit(bigintLiteral(value), primitive, platform);
      assert.equal(typeof fit === "object" && fit.kind === "refused" && fit.code === code, true, `${code}: ${primitive} ${value}`);
      assert.equal(typeof fit === "object" && fit.reason.includes(`'${primitive}'`), true, `${code}: the refusal names the kind`);
      assert.equal(sourcePrimitiveOperatorLiteralFits(bigintLiteral(value), primitive, platform), false, `${code}: ${primitive} ${value}`);
      assert.equal(sourcePrimitiveOperatorLiteralPartner(unboundBigintFloat(value), primitive, platform) === undefined, true);
    }
  }
  const conflict = sourcePrimitiveLiteralFit(bigintLiteral(1n << 31n), "native-int", conflicting);
  assert.equal(typeof conflict === "object" && conflict.reason.includes("64-bit (first statement), 32-bit (second statement)"), true,
    "the conflicting refusal lists every stated width with its basis");
  const absent = sourcePrimitiveLiteralFit(bigintLiteral(1n << 31n), "native-int", missing);
  assert.equal(typeof absent === "object" && absent.reason.includes("The unit control states no architecture."), true,
    "the missing refusal carries the target's reason");
});

test("E24 operator decisions read the premise only where a literal is fitted to a native integer kind", () => {
  const wide = unbound("2147483648");
  // A native partner whose fit depends on the width: known widths decide, unknown premises refuse precisely.
  const at64 = decideSourcePrimitiveBinaryOperator("add", fixed("native-int"), wide, known64);
  assert.equal(at64.kind === "resolved" && at64.result === "native-int" && at64.right === "native-int", true);
  const at32 = decideSourcePrimitiveBinaryOperator("add", fixed("native-int"), wide, known32);
  assert.equal(at32.kind === "refused" && at32.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED", true, "outside the 32-bit range");
  for (const [platform, code] of [
    [missing, "TSONIC_NATIVE_INTEGER_WIDTH_MISSING"], [conflicting, "TSONIC_NATIVE_INTEGER_WIDTH_CONFLICTING"],
  ] as const) {
    const refused = decideSourcePrimitiveBinaryOperator("add", unbound("4294967296"), fixed("native-uint"), platform);
    assert.equal(refused.kind === "refused" && refused.code === code, true, code);
    const expected = decideSourcePrimitiveBinaryOperator("add", unbound("7"), wide, platform, "native-int");
    assert.equal(expected.kind === "refused" && expected.code === code, true, `${code}: expected native kind`);
    // No width decision: width-independent literals, two fixed native operands, shifts and unary operators.
    const narrow = decideSourcePrimitiveBinaryOperator("add", fixed("native-int"), unbound("2"), platform);
    assert.equal(narrow.kind === "resolved" && narrow.result === "native-int", true, `${code}: 2 fits every width`);
    const pair = decideSourcePrimitiveBinaryOperator("multiply", fixed("native-uint"), fixed("native-uint"), platform);
    assert.equal(pair.kind === "resolved" && pair.result === "native-uint", true, code);
    const shift = decideSourcePrimitiveBinaryOperator("shift-left", fixed("native-int"), unbound("3"), platform);
    assert.equal(shift.kind === "resolved" && shift.result === "native-int" && shift.right === "int32", true, code);
    assert.equal(decideSourcePrimitiveUnaryOperator("bit-not", "native-uint").kind, "resolved");
    // The expected native kind is not usable when a fixed operand differs, so no width is needed.
    const unused = decideSourcePrimitiveBinaryOperator("add", fixed("int32"), wide, platform, "native-int");
    assert.equal(unused.kind === "resolved" && unused.result === "float64", true, `${code}: expected kind not taken`);
    // int64 decisions are unchanged.
    const int64 = decideSourcePrimitiveBinaryOperator("add", fixed("int64"), unbound("9223372036854775807"), platform);
    assert.equal(int64.kind === "resolved" && int64.result === "int64" && int64.right === "int64", true, code);
  }
});

test("E24 fixed-operand decisions are identical under every premise", () => {
  for (const operator of sourcePrimitiveBinaryOperators) {
    for (const left of sourcePrimitiveOperatorKinds) for (const right of sourcePrimitiveOperatorKinds) {
      const reference = decideSourcePrimitiveBinaryOperator(operator, fixed(left), fixed(right), known64);
      const others: readonly SourcePlatformFacts[] = [known32, missing, conflicting];
      for (const platform of others) {
        assert.deepEqual(decideSourcePrimitiveBinaryOperator(operator, fixed(left), fixed(right), platform), reference,
          `${operator}: ${left}, ${right}`);
      }
    }
  }
});

test("D-A floating literal adaptation uses original authored magnitude and checked provenance", () => {
  for (const [text, primitive, expected] of [
    ["65519", "float16", true], ["65520", "float16", false], ["1e-100000", "float32", true],
    ["3.4028235e38", "float32", true], ["3.4028236e38", "float32", false],
    ["79228162514264337593543950335", "decimal", true], ["79228162514264337593543950336", "decimal", false],
  ] as const) assert.equal(sourcePrimitiveOperatorLiteralFits(numericLiteral(text), primitive), expected, `${text}: ${primitive}`);
  const checked: SourceLiteralValue = { form: "numeric", number: 1.5, numeric: { kind: "checked-float64", value: 1.5 } };
  assert.equal(sourcePrimitiveOperatorLiteralFits(checked, "float32"), false);
  assert.equal(sourcePrimitiveOperatorLiteralFits(checked, "float64"), true);
  assert.equal(sourcePrimitiveOperatorLiteralFits({ form: "true" }, "bool"), true);
  assert.equal(sourcePrimitiveOperatorLiteralFits({ form: "string", text: "x" }, "char"), true);
  assert.equal(sourcePrimitiveOperatorLiteralFits({ form: "string", text: "xx" }, "char"), false);
  assert.equal(sourcePrimitiveOperatorLiteralFits({ form: "array", elements: [] }, "int32"), false);
});

test("D-A binary and parenthesized whole receipts fit floating kinds without inventing numeric provenance", () => {
  const cases = [false, true].flatMap(parenthesized => ([
    ["8 / 2 + 1", 5n], ["-8 + 3", -5n], ["8 - 8", 0n],
  ] as const).map(([expression, constant]) => ({
    expression: parenthesized ? `(${expression})` : expression, constant,
    form: parenthesized ? "parenthesized" : "binary",
  })));
  const literals = operatorLiteralFacts(cases.map(row => row.expression));
  for (const [index, row] of cases.entries()) {
    const literal = literals[index]!;
    assert.equal(literal.form, row.form, row.expression);
    assert.equal(literal.integerConstant, row.constant, row.expression);
    assert.equal(literal.integer === undefined && literal.number === undefined && literal.numeric === undefined, true, row.expression);
    for (const primitive of ["float16", "float32", "float64", "decimal"] as const) {
      assert.equal(sourcePrimitiveOperatorLiteralFits(literal, primitive), true, `${row.expression}: ${primitive}`);
    }
    assert.equal(literal.integerConstant, row.constant, "fit checks retain the same exact receipt");
  }
});

test("D-A folded floating overflow compares exact signed bigint magnitude at each finite boundary", () => {
  const cases = ([
    ["float16", 65520n], ["float32", (1n << 128n) - (1n << 103n)], ["decimal", 1n << 96n],
  ] as const).flatMap(([primitive, firstRefused]) => [-1n, 0n, 1n].flatMap(offset =>
    [-1n, 1n].flatMap(sign => [false, true].map(parenthesized => {
      const constant = sign * (firstRefused + offset);
      const expression = `${constant} + 0`;
      return { primitive, constant, admitted: offset < 0n, expression: parenthesized ? `(${expression})` : expression };
    }))));
  const literals = operatorLiteralFacts(cases.map(row => row.expression));
  for (const [index, row] of cases.entries()) {
    const literal = literals[index]!;
    assert.equal(literal.integerConstant, row.constant, row.expression);
    assert.equal(literal.numeric === undefined && literal.number === undefined, true, row.expression);
    assert.equal(sourcePrimitiveOperatorLiteralFits(literal, row.primitive), row.admitted, `${row.primitive}: ${row.expression}`);
    assert.equal(sourcePrimitiveOperatorLiteralFits(literal, "float64"), true, row.expression);
  }
});

test("D-A large folded integers keep every source digit while an explicit float64 may round finitely", () => {
  const cases = [9007199254740993n, -9007199254740993n, (1n << 131n) + 1n, -((1n << 131n) + 1n)]
    .flatMap(constant => [false, true].map(parenthesized => {
      const expression = `${constant} + 0`;
      return { constant, expression: parenthesized ? `(${expression})` : expression };
    }));
  const literals = operatorLiteralFacts(cases.map(row => row.expression));
  for (const [index, row] of cases.entries()) {
    const literal = literals[index]!;
    assert.equal(literal.integerConstant, row.constant, row.expression);
    assert.equal(literal.integer === undefined && literal.number === undefined && literal.numeric === undefined, true, row.expression);
    assert.equal(Object.isFrozen(literal), true, row.expression);
    assert.equal(sourcePrimitiveOperatorLiteralFits(literal, "float64"), true, row.expression);
    assert.equal(sourcePrimitiveOperatorLiteralFits(literal, "int128"), row.constant > -(1n << 127n) && row.constant < (1n << 127n), row.expression);
    assert.equal(literal.integerConstant, row.constant, row.expression);
  }
});

test("H2 prefix integer constants use the sole literal fit owner without losing their signed whole receipt", () => {
  const cases = [
    { expression: "-(7 / 2)", integer: -3n, fits: true },
    { expression: "+(-(7 / 2))", integer: -3n, fits: true },
    { expression: "-(-(7 / 2))", integer: 3n, fits: true },
    { expression: "-(9223372036854775808 + 0)", integer: -(1n << 63n), fits: true },
    { expression: "-(9223372036854775809 + 0)", integer: -(1n << 63n) - 1n, fits: false },
    { expression: "+((9223372036854775807 + 0))", integer: (1n << 63n) - 1n, fits: true },
    { expression: "+((9223372036854775808 + 0))", integer: 1n << 63n, fits: false },
  ];
  const literals = operatorLiteralFacts(cases.map(row => row.expression));
  for (const [index, row] of cases.entries()) {
    const literal = literals[index]!;
    assert.equal(literal.integerConstant === row.integer && Object.isFrozen(literal), true, row.expression);
    assert.equal(sourcePrimitiveOperatorLiteralFits(literal, "int64"), row.fits, row.expression);
    assert.equal(literal.integerConstant, row.integer, "admission never replaces or rounds the original receipt");
  }
});

test("D-A float64 native rounding never admits an infinite authored value or fabricates an oversized folded receipt", () => {
  const midpoint = (1n << 1024n) - (1n << 970n);
  const cases = [-1n, 0n, 1n].flatMap(offset => [-1n, 1n].flatMap(sign =>
    [false, true].map(parenthesized => {
      const expression = String(sign * (midpoint + offset));
      return { admitted: offset < 0n, expression: parenthesized ? `(${expression})` : expression };
    })));
  const literals = operatorLiteralFacts(cases.map(row => row.expression));
  for (const [index, row] of cases.entries()) {
    const literal = literals[index]!;
    assert.equal(literal.numeric?.kind, "authored", row.expression);
    assert.equal(literal.integerConstant === undefined, true, "the existing bounded integer reader does not invent a receipt");
    assert.equal(sourcePrimitiveOperatorLiteralFits(literal, "float64"), row.admitted, row.expression);
  }
});

test("D-A parenthesized checked values do not gain authored float32 or decimal authority from an integer constant", () => {
  const expressions = ["(1)", "(0)", "(-0)", "(1.5)"];
  const authored = operatorLiteralFacts(expressions);
  const checked = operatorLiteralFacts(expressions, "checked");
  for (const [index, expression] of expressions.entries()) {
    assert.equal(authored[index]!.numeric?.kind, "authored", expression);
    assert.equal(checked[index]!.numeric?.kind, "checked-float64", expression);
    if (index < 3) assert.equal(checked[index]!.integerConstant, index === 0 ? 1n : 0n, expression);
    for (const primitive of ["float32", "decimal"] as const) {
      assert.equal(sourcePrimitiveOperatorLiteralFits(authored[index]!, primitive), true, `${expression}: ${primitive}`);
      assert.equal(sourcePrimitiveOperatorLiteralFits(checked[index]!, primitive), false, `${expression}: ${primitive}`);
    }
    for (const primitive of ["float16", "float64"] as const) {
      assert.equal(sourcePrimitiveOperatorLiteralFits(checked[index]!, primitive), true, `${expression}: ${primitive}`);
    }
  }
  assert.equal(Object.is(authored[2]!.number, -0), true);
  assert.equal(Object.is(checked[2]!.number, -0), true);
});

test("D-A folded floating fit leaves integer bounds, fixed operand widths and shift counts unchanged", () => {
  const cases = [-2147483649n, -2147483648n, 3n, 2147483647n, 2147483648n].flatMap(constant =>
    [false, true].map(parenthesized => {
      const expression = `${constant} + 0`;
      return { constant, expression: parenthesized ? `(${expression})` : expression };
    }));
  const literals = operatorLiteralFacts(cases.map(row => row.expression));
  for (const [index, row] of cases.entries()) {
    const literal = literals[index]!;
    const operand: SourcePrimitiveOperatorOperand = { kind: "unbound-literal", primitive: "float64", literal };
    const fits = row.constant >= -2147483648n && row.constant <= 2147483647n;
    assert.equal(sourcePrimitiveOperatorLiteralFits(literal, "int32"), fits, row.expression);
    const shifted = decideSourcePrimitiveBinaryOperator("shift-left", fixed("int64"), operand, known64, "int64");
    assert.equal(shifted.kind === "resolved", fits, row.expression);
    if (shifted.kind === "resolved") {
      assert.equal(shifted.result === "int64" && shifted.left === "int64" && shifted.right === "int32", true, row.expression);
    }
    const fixedWidth = decideSourcePrimitiveBinaryOperator("add", fixed("float64"), operand, known64, "int32");
    assert.equal(fixedWidth.kind === "resolved" && fixedWidth.left === "float64" && fixedWidth.result === "float64", true, row.expression);
  }
  assert.equal(decideSourcePrimitiveBinaryOperator("shift-left", fixed("int64"), fixed("int64"), known64, "int32").kind, "resolved",
    "Q3 admits the unchanged int64 count through the existing checked Native index conversion");
  for (const primitive of ["uint32", "uint64", "native-int", "native-uint", "int128", "uint128", "float16", "float32", "float64", "decimal"] as const) {
    assert.equal(decideSourcePrimitiveBinaryOperator("shift-left", fixed("int64"), fixed(primitive), known64, "int32").kind, "refused", primitive);
  }
});

function operatorLiteralFacts(expressions: readonly string[], provenance: "authored" | "checked" = "authored"): readonly SourceLiteralValue[] {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": expressions.map((expression, index) => `export const value${index} = ${expression};`).join("\n"),
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0);
  const source = createSourceTypeFlowTestProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  if (file === undefined) throw new Error("The checked literal program requires its source file.");
  const ast: AstReader = provenance === "checked"
    ? { ...source.ast, authoredRange: () => ({ kind: "synthetic" }) } : source.ast;
  const values = analyzeSourceLiteralValues(ast, [file]);
  const literals: SourceLiteralValue[] = [];
  const visit = (node: Node): void => {
    const initializer = ast.is.IsVariableDeclaration(node) ? ast.as.AsVariableDeclaration(node)?.Initializer : undefined;
    if (initializer !== undefined) {
      const literal = values.literalValue.get(initializer);
      if (literal === undefined) throw new Error(`The original Source literal receipt ${literals.length} is required.`);
      literals.push(literal);
    }
    ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.equal(literals.length, expressions.length);
  return literals;
}

function numericLiteral(text: string): SourceLiteralValue {
  const parsed = parseSourceNumericLiteral(text);
  if (parsed === undefined) throw new Error(`A test numeric token requires exact authored evidence: ${text}`);
  return { form: "numeric", number: Number(text), ...(parsed.integer === undefined ? {} : { integer: parsed.integer }),
    numeric: { kind: "authored", token: parsed.token } };
}

function unbound(text: string): SourcePrimitiveOperatorOperand {
  return { kind: "unbound-literal", primitive: "float64", literal: numericLiteral(text) };
}

function bigintLiteral(integer: bigint): SourceLiteralValue {
  return { form: "bigint", integer };
}

function unboundBigint(integer: bigint): SourcePrimitiveOperatorOperand {
  return { kind: "unbound-literal", primitive: "bigint", literal: bigintLiteral(integer) };
}

/** An unbound folded whole number (for example `(2147483648)` or `-(2147483649)`) with its exact integer receipt. */
function unboundBigintFloat(integer: bigint): SourcePrimitiveOperatorOperand {
  return { kind: "unbound-literal", primitive: "float64", literal: { form: "parenthesized", integerConstant: integer } };
}
