import assert from "node:assert/strict";
import test from "node:test";
import type { SourcePrimitiveKind } from "@tsonic/tsts";
import { parseSourceNumericLiteral } from "../literal-token.js";
import type { SourceLiteralValue } from "../literal-values-model.js";
import {
  decideSourcePrimitiveBinaryOperator, decideSourcePrimitiveUnaryOperator,
  sourcePrimitiveBinaryOperators, sourcePrimitiveOperatorKinds, sourcePrimitiveOperatorLiteralFits, sourcePrimitiveOperatorIsIntegral,
  sourcePrimitiveUnaryOperators, type SourcePrimitiveBinaryOperator, type SourcePrimitiveOperatorOperand,
} from "./operator-decisions.js";

const fixed = (primitive: SourcePrimitiveKind): SourcePrimitiveOperatorOperand => ({ kind: "fixed", primitive });
const small = new Set<SourcePrimitiveKind>(["char", "int8", "uint8", "int16", "uint16"]);
const integral = new Set<SourcePrimitiveKind>([...small, "int32", "uint32", "int64", "uint64", "native-int", "native-uint", "int128", "uint128"]);
const shiftCount = new Set<SourcePrimitiveKind>([...small, "int32"]);
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
      const selected = decideSourcePrimitiveBinaryOperator(operator, fixed(left), fixed(right));
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

test("D-A every unary operator classifies all primitive kinds without promoting non-update operands", () => {
  for (const operator of sourcePrimitiveUnaryOperators) {
    let classified = 0;
    for (const primitive of sourcePrimitiveOperatorKinds) {
      const selected = decideSourcePrimitiveUnaryOperator(operator, primitive);
      const admitted = operator === "logical-not" ? primitive === "bool"
        : operator === "bit-not" ? integral.has(primitive) : primitive !== "bool" && primitive !== "char";
      assert.equal(selected.kind === "resolved", admitted, `${operator}: ${primitive}`);
      if (selected.kind === "resolved") {
        assert.equal(selected.result, primitive, `${operator}: ${primitive} preserves its operand kind`);
        assert.equal(selected.operand, primitive);
      } else assert.equal(selected.reason.length > 0, true);
      classified += 1;
    }
    assert.equal(classified, 18, operator);
  }
});

test("D-A numeric promotion and operator admission are different decisions", () => {
  for (const [left, right, result] of [
    ["int8", "int8", "int32"], ["char", "uint32", "uint32"], ["uint32", "int32", "int64"],
    ["int32", "int64", "int64"], ["int32", "float64", "float64"], ["float32", "int64", "float32"],
    ["decimal", "uint64", "decimal"], ["int128", "int128", "int128"], ["float16", "float16", "float16"],
  ] as const) {
    const selected = decideSourcePrimitiveBinaryOperator("add", fixed(left), fixed(right));
    assert.equal(selected.kind === "resolved" && selected.result === result, true, `${left} + ${right}`);
  }
  for (const [left, right] of [["uint64", "int64"], ["decimal", "float64"], ["float16", "float32"],
    ["native-int", "int32"], ["uint128", "uint64"], ["bool", "int32"]] as const) {
    assert.equal(decideSourcePrimitiveBinaryOperator("add", fixed(left), fixed(right)).kind, "refused", `${left} + ${right}`);
    assert.equal(decideSourcePrimitiveBinaryOperator("equal", fixed(left), fixed(right)).kind, "refused", `${left} == ${right}`);
  }
  for (const primitive of ["float16", "float32", "float64", "decimal", "bool"] as const) {
    assert.equal(decideSourcePrimitiveBinaryOperator("bit-and", fixed(primitive), fixed(primitive)).kind, "refused", primitive);
  }
  assert.equal(decideSourcePrimitiveBinaryOperator("equal", fixed("bool"), fixed("bool")).kind, "resolved");
  assert.equal(decideSourcePrimitiveBinaryOperator("less", fixed("bool"), fixed("bool")).kind, "refused");
});

test("D-A shifts admit only implicit 32-bit counts and promote only the left carrier", () => {
  for (const left of sourcePrimitiveOperatorKinds) for (const right of sourcePrimitiveOperatorKinds) {
    const selected = decideSourcePrimitiveBinaryOperator("shift-left", fixed(left), fixed(right), "int64");
    if (integral.has(left) && shiftCount.has(right)) {
      assert.equal(selected.kind === "resolved" && selected.right === right && selected.result === (small.has(left) ? "int32" : left), true, `${left}, ${right}`);
    } else assert.equal(selected.kind, "refused", `${left}, ${right}`);
  }
  for (const primitive of ["uint32", "int64", "uint64", "native-int", "native-uint", "int128", "uint128", "float16", "float32", "float64", "decimal"] as const) {
    const selected = decideSourcePrimitiveBinaryOperator("shift-right", fixed("int64"), fixed(primitive));
    assert.equal(selected.kind === "refused" && selected.reason === "A shift count must be a 32-bit integer or narrower.", true, primitive);
  }
  const literal = unbound("3");
  const selected = decideSourcePrimitiveBinaryOperator("shift-right-unsigned", fixed("uint64"), literal);
  assert.equal(selected.kind === "resolved" && selected.left === "uint64" && selected.right === "int32" && selected.result === "uint64", true);
  assert.equal(decideSourcePrimitiveBinaryOperator("shift-right", fixed("int64"), unboundBigint(3n)).kind, "refused");
});

test("D-A literal adaptation cannot retarget a fixed or already-filled scalar width", () => {
  for (const operator of ["add", "bit-and", "less"] as const) {
    const selected = decideSourcePrimitiveBinaryOperator(operator, fixed("float64"), unbound("2"), "int32");
    assert.equal(operator === "bit-and" ? selected.kind === "refused"
      : selected.kind === "resolved" && selected.left === "float64" && selected.right === "float64" &&
        selected.result === (operator === "less" ? "bool" : "float64"), true, operator);
  }
  const fixedPair = decideSourcePrimitiveBinaryOperator("add", fixed("uint64"), fixed("int64"), "uint64");
  assert.equal(fixedPair.kind, "refused");
  const filled = decideSourcePrimitiveBinaryOperator("add", fixed("float32"), fixed("int64"), "int64");
  assert.equal(filled.kind === "resolved" && filled.left === "float32" && filled.result === "float32", true);
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
    const selected = decideSourcePrimitiveBinaryOperator("add", left, right, expected);
    assert.equal(selected.kind === "resolved" && selected.result === result, true, `${left.primitive}, ${right.primitive}, ${expected ?? "none"}`);
  }
  const overflow = decideSourcePrimitiveBinaryOperator("add", fixed("uint64"), unboundBigint(1n << 64n));
  assert.equal(overflow.kind, "refused", "overflow cannot acquire an invented floating Source kind");
});

test("D-A exact literal bounds never introduce a JS integer precision cap", () => {
  for (const [primitive, minimum, maximum] of [
    ["int8", -128n, 127n], ["uint8", 0n, 255n], ["int16", -32768n, 32767n], ["uint16", 0n, 65535n],
    ["int32", -(1n << 31n), (1n << 31n) - 1n], ["uint32", 0n, (1n << 32n) - 1n],
    ["int64", -(1n << 63n), (1n << 63n) - 1n], ["uint64", 0n, (1n << 64n) - 1n],
    ["native-int", -(1n << 63n), (1n << 63n) - 1n], ["native-uint", 0n, (1n << 64n) - 1n],
    ["int128", -(1n << 127n), (1n << 127n) - 1n], ["uint128", 0n, (1n << 128n) - 1n],
  ] as const) {
    for (const value of [minimum, maximum]) assert.equal(sourcePrimitiveOperatorLiteralFits(bigintLiteral(value), primitive), true, `${primitive}: ${value}`);
    for (const value of [minimum - 1n, maximum + 1n]) assert.equal(sourcePrimitiveOperatorLiteralFits(bigintLiteral(value), primitive), false, `${primitive}: ${value}`);
  }
  assert.equal(sourcePrimitiveOperatorLiteralFits(bigintLiteral(9007199254740993n), "uint64"), true);
  assert.equal(sourcePrimitiveOperatorLiteralFits({ form: "parenthesized", integerConstant: (1n << 127n) - 1n }, "int128"), true);
  assert.equal(sourcePrimitiveOperatorLiteralFits({ form: "binary", integerConstant: 1n << 128n }, "uint128"), false);
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
