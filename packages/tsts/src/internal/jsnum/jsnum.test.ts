import { test } from "node:test";
import assert from "node:assert/strict";
import type { int } from "@tsonic/core/types.js";
import {
  Inf,
  MaxSafeInteger,
  MinSafeInteger,
  NaN as JsNaN,
  negativeZero,
  Number_BitwiseAND,
  Number_BitwiseNOT,
  Number_BitwiseOR,
  Number_BitwiseXOR,
  Number_Exponentiate,
  Number_LeftShift,
  Number_Remainder,
  Number_SignedRightShift,
  Number_toInt32,
  Number_UnsignedRightShift,
} from "./jsnum.js";
import type { Number as JsNumber } from "./jsnum.js";

const float64Buffer = new ArrayBuffer(8);
const float64View = new Float64Array(float64Buffer);
const uint32View = new Uint32Array(float64Buffer);
const bigUint64View = new BigUint64Array(float64Buffer);

function numberFromBits(bits: bigint): JsNumber {
  bigUint64View[0] = bits;
  return float64View[0] as JsNumber;
}

function numberToBits(value: JsNumber): bigint {
  float64View[0] = value;
  return bigUint64View[0]!;
}

function assertEqualNumber(actual: JsNumber, expected: JsNumber): void {
  if (globalThis.Number.isNaN(actual) || globalThis.Number.isNaN(expected)) {
    assert.equal(globalThis.Number.isNaN(actual), globalThis.Number.isNaN(expected));
    return;
  }
  assert.ok(actual === expected, `got ${actual}, want ${expected}`);
}

function assertWithinOneULP(actual: JsNumber, expected: JsNumber): void {
  if (globalThis.Number.isNaN(actual) || globalThis.Number.isNaN(expected)) {
    assert.equal(globalThis.Number.isNaN(actual), globalThis.Number.isNaN(expected));
    return;
  }
  if (actual === expected || numberToBits(actual) === numberToBits(expected)) {
    return;
  }
  const actualBits = numberToBits(actual);
  const expectedBits = numberToBits(expected);
  const ulpDistance = actualBits > expectedBits ? actualBits - expectedBits : expectedBits - actualBits;
  assert.ok(ulpDistance <= 1n, `got ${actual} (${actualBits.toString(16)}), want ${expected} (${expectedBits.toString(16)})`);
}

test("Number.toInt32 mirrors upstream ToInt32 edge cases", () => {
  const cases: Array<{ name: string; input: JsNumber; expected: int }> = [
    { name: "0.0", input: 0 as JsNumber, expected: 0 as int },
    { name: "-0.0", input: negativeZero, expected: 0 as int },
    { name: "NaN", input: JsNaN(), expected: 0 as int },
    { name: "+Inf", input: Inf(1), expected: 0 as int },
    { name: "-Inf", input: Inf(-1), expected: 0 as int },
    { name: "MaxInt32", input: 2_147_483_647 as JsNumber, expected: 2_147_483_647 as int },
    { name: "MaxInt32+1", input: 2_147_483_648 as JsNumber, expected: -2_147_483_648 as int },
    { name: "MinInt32", input: -2_147_483_648 as JsNumber, expected: -2_147_483_648 as int },
    { name: "MinInt32-1", input: -2_147_483_649 as JsNumber, expected: 2_147_483_647 as int },
    { name: "MIN_SAFE_INTEGER", input: MinSafeInteger, expected: 1 as int },
    { name: "MIN_SAFE_INTEGER-1", input: (MinSafeInteger - 1) as JsNumber, expected: 0 as int },
    { name: "MIN_SAFE_INTEGER+1", input: (MinSafeInteger + 1) as JsNumber, expected: 2 as int },
    { name: "MAX_SAFE_INTEGER", input: MaxSafeInteger, expected: -1 as int },
    { name: "MAX_SAFE_INTEGER-1", input: (MaxSafeInteger - 1) as JsNumber, expected: -2 as int },
    { name: "MAX_SAFE_INTEGER+1", input: (MaxSafeInteger + 1) as JsNumber, expected: 0 as int },
    { name: "-8589934590", input: -8_589_934_590 as JsNumber, expected: 2 as int },
    { name: "0xDEADBEEF", input: 0xdeadbeef as JsNumber, expected: -559_038_737 as int },
    { name: "4294967808", input: 4_294_967_808 as JsNumber, expected: 512 as int },
    { name: "-0.4", input: -0.4 as JsNumber, expected: 0 as int },
    { name: "SmallestNonzeroFloat64", input: 5e-324 as JsNumber, expected: 0 as int },
    { name: "-SmallestNonzeroFloat64", input: -5e-324 as JsNumber, expected: 0 as int },
    { name: "MaxFloat64", input: globalThis.Number.MAX_VALUE as JsNumber, expected: 0 as int },
    { name: "-MaxFloat64", input: -globalThis.Number.MAX_VALUE as JsNumber, expected: 0 as int },
    { name: "Largest subnormal number", input: numberFromBits(0x000f_ffff_ffff_ffffn), expected: 0 as int },
    { name: "Smallest positive normal number", input: numberFromBits(0x0010_0000_0000_0000n), expected: 0 as int },
    { name: "math.Pi", input: globalThis.Math.PI as JsNumber, expected: 3 as int },
    { name: "-math.Pi", input: -globalThis.Math.PI as JsNumber, expected: -3 as int },
    { name: "math.E", input: globalThis.Math.E as JsNumber, expected: 2 as int },
    { name: "-math.E", input: -globalThis.Math.E as JsNumber, expected: -2 as int },
    { name: "2^31 + 0.5", input: 2_147_483_648.5 as JsNumber, expected: -2_147_483_648 as int },
    { name: "-2^31 - 0.5", input: -2_147_483_648.5 as JsNumber, expected: -2_147_483_648 as int },
    { name: "2^40", input: 1_099_511_627_776 as JsNumber, expected: 0 as int },
    { name: "TypeFlagsNarrowable", input: 536_624_127 as JsNumber, expected: 536_624_127 as int },
  ];

  for (const c of cases) {
    assert.equal(Number_toInt32(c.input), c.expected, c.name);
    assertEqualNumber(Number_toInt32(c.input) as JsNumber, (c.input | 0) as JsNumber);
  }
});

test("Number bitwise operators mirror JavaScript 32-bit coercion", () => {
  const unaryCases: Array<[JsNumber, JsNumber]> = [
    [-2_147_483_649 as JsNumber, -2_147_483_648 as JsNumber],
    [2_147_483_647 as JsNumber, -2_147_483_648 as JsNumber],
    [-4_294_967_296 as JsNumber, -1 as JsNumber],
    [0 as JsNumber, -1 as JsNumber],
    [2_147_483_648 as JsNumber, 2_147_483_647 as JsNumber],
    [-2_147_483_648 as JsNumber, 2_147_483_647 as JsNumber],
    [4_294_967_296 as JsNumber, -1 as JsNumber],
  ];
  for (const [input, expected] of unaryCases) {
    assertEqualNumber(Number_BitwiseNOT(input), expected);
    assertEqualNumber(Number_BitwiseNOT(input), (~input) as JsNumber);
  }

  const binaryCases: Array<[JsNumber, JsNumber, JsNumber, JsNumber, JsNumber]> = [
    [0 as JsNumber, 0 as JsNumber, 0 as JsNumber, 0 as JsNumber, 0 as JsNumber],
    [0 as JsNumber, 1 as JsNumber, 0 as JsNumber, 1 as JsNumber, 1 as JsNumber],
    [1 as JsNumber, 0 as JsNumber, 0 as JsNumber, 1 as JsNumber, 1 as JsNumber],
    [1 as JsNumber, 1 as JsNumber, 1 as JsNumber, 1 as JsNumber, 0 as JsNumber],
  ];
  for (const [left, right, andExpected, orExpected, xorExpected] of binaryCases) {
    assertEqualNumber(Number_BitwiseAND(left, right), andExpected);
    assertEqualNumber(Number_BitwiseAND(left, right), (left & right) as JsNumber);
    assertEqualNumber(Number_BitwiseOR(left, right), orExpected);
    assertEqualNumber(Number_BitwiseOR(left, right), (left | right) as JsNumber);
    assertEqualNumber(Number_BitwiseXOR(left, right), xorExpected);
    assertEqualNumber(Number_BitwiseXOR(left, right), (left ^ right) as JsNumber);
  }
});

test("Number shifts mirror JavaScript shift-count masking", () => {
  const signedCases: Array<[JsNumber, JsNumber, JsNumber]> = [
    [1 as JsNumber, 0 as JsNumber, 1 as JsNumber],
    [1 as JsNumber, 31 as JsNumber, 0 as JsNumber],
    [1 as JsNumber, 32 as JsNumber, 1 as JsNumber],
    [-4 as JsNumber, 1 as JsNumber, -2 as JsNumber],
    [-4 as JsNumber, 4 as JsNumber, -1 as JsNumber],
    [-4 as JsNumber, 33 as JsNumber, -2 as JsNumber],
  ];
  for (const [left, right, expected] of signedCases) {
    assertEqualNumber(Number_SignedRightShift(left, right), expected);
    assertEqualNumber(Number_SignedRightShift(left, right), (left >> right) as JsNumber);
  }

  const unsignedCases: Array<[JsNumber, JsNumber, JsNumber]> = [
    [1 as JsNumber, 0 as JsNumber, 1 as JsNumber],
    [1 as JsNumber, 32 as JsNumber, 1 as JsNumber],
    [-4 as JsNumber, 0 as JsNumber, 4_294_967_292 as JsNumber],
    [-4 as JsNumber, 1 as JsNumber, 2_147_483_646 as JsNumber],
    [-4 as JsNumber, 31 as JsNumber, 1 as JsNumber],
    [-4 as JsNumber, 33 as JsNumber, 2_147_483_646 as JsNumber],
  ];
  for (const [left, right, expected] of unsignedCases) {
    assertEqualNumber(Number_UnsignedRightShift(left, right), expected);
    assertEqualNumber(Number_UnsignedRightShift(left, right), (left >>> right) as JsNumber);
  }

  const leftShiftCases: Array<[JsNumber, JsNumber, JsNumber]> = [
    [1 as JsNumber, 0 as JsNumber, 1 as JsNumber],
    [1 as JsNumber, 1 as JsNumber, 2 as JsNumber],
    [1 as JsNumber, 31 as JsNumber, -2_147_483_648 as JsNumber],
    [1 as JsNumber, 32 as JsNumber, 1 as JsNumber],
    [-4 as JsNumber, 3 as JsNumber, -32 as JsNumber],
    [-4 as JsNumber, 31 as JsNumber, 0 as JsNumber],
  ];
  for (const [left, right, expected] of leftShiftCases) {
    assertEqualNumber(Number_LeftShift(left, right), expected);
    assertEqualNumber(Number_LeftShift(left, right), (left << right) as JsNumber);
  }
});

test("Number.Remainder mirrors JavaScript remainder semantics", () => {
  const cases: Array<[JsNumber, JsNumber, JsNumber]> = [
    [JsNaN(), 1 as JsNumber, JsNaN()],
    [1 as JsNumber, JsNaN(), JsNaN()],
    [Inf(1), 1 as JsNumber, JsNaN()],
    [Inf(-1), 1 as JsNumber, JsNaN()],
    [123 as JsNumber, Inf(1), 123 as JsNumber],
    [123 as JsNumber, Inf(-1), 123 as JsNumber],
    [123 as JsNumber, 0 as JsNumber, JsNaN()],
    [123 as JsNumber, negativeZero, JsNaN()],
    [0 as JsNumber, 123 as JsNumber, 0 as JsNumber],
    [negativeZero, 123 as JsNumber, negativeZero],
    [10 as JsNumber, 3 as JsNumber, 1 as JsNumber],
    [-10 as JsNumber, 3 as JsNumber, -1 as JsNumber],
    [10 as JsNumber, -3 as JsNumber, 1 as JsNumber],
    [-10 as JsNumber, -3 as JsNumber, -1 as JsNumber],
    [5.5 as JsNumber, 2 as JsNumber, 1.5 as JsNumber],
    [-5.5 as JsNumber, 2 as JsNumber, -1.5 as JsNumber],
    [7 as JsNumber, 0.1 as JsNumber, (7 % 0.1) as JsNumber],
    [100 as JsNumber, 0.3 as JsNumber, (100 % 0.3) as JsNumber],
  ];

  for (const [left, right, expected] of cases) {
    assertEqualNumber(Number_Remainder(left, right), expected);
    assertEqualNumber(Number_Remainder(left, right), (left % right) as JsNumber);
  }
});

test("Number.Exponentiate mirrors upstream edge cases and native JS within one ULP", () => {
  const cases: Array<[JsNumber, JsNumber, JsNumber]> = [
    [2 as JsNumber, 3 as JsNumber, 8 as JsNumber],
    [Inf(1), 3 as JsNumber, Inf(1)],
    [Inf(1), -5 as JsNumber, 0 as JsNumber],
    [Inf(-1), 3 as JsNumber, Inf(-1)],
    [Inf(-1), 4 as JsNumber, Inf(1)],
    [Inf(-1), -3 as JsNumber, negativeZero],
    [Inf(-1), -4 as JsNumber, 0 as JsNumber],
    [0 as JsNumber, 3 as JsNumber, 0 as JsNumber],
    [0 as JsNumber, -10 as JsNumber, Inf(1)],
    [negativeZero, 3 as JsNumber, negativeZero],
    [negativeZero, 4 as JsNumber, 0 as JsNumber],
    [negativeZero, -3 as JsNumber, Inf(-1)],
    [negativeZero, -4 as JsNumber, Inf(1)],
    [3 as JsNumber, Inf(1), Inf(1)],
    [-3 as JsNumber, Inf(1), Inf(1)],
    [3 as JsNumber, Inf(-1), 0 as JsNumber],
    [-3 as JsNumber, Inf(-1), 0 as JsNumber],
    [JsNaN(), 3 as JsNumber, JsNaN()],
    [1 as JsNumber, Inf(1), JsNaN()],
    [1 as JsNumber, Inf(-1), JsNaN()],
    [-1 as JsNumber, Inf(1), JsNaN()],
    [-1 as JsNumber, Inf(-1), JsNaN()],
    [1 as JsNumber, JsNaN(), JsNaN()],
    [10 as JsNumber, 308 as JsNumber, numberFromBits(0x7fe1_ccf3_85eb_c8a0n)],
    [5 as JsNumber, 210 as JsNumber, numberFromBits(0x5e68_557f_3132_6bbbn)],
    [10 as JsNumber, 200 as JsNumber, numberFromBits(0x6974_e718_d7d7_625an)],
  ];

  for (const [left, right, expected] of cases) {
    assertEqualNumber(Number_Exponentiate(left, right), expected);
    assertWithinOneULP(Number_Exponentiate(left, right), (left ** right) as JsNumber);
  }
});
