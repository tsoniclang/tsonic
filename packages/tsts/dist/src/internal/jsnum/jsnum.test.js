import { test } from "node:test";
import assert from "node:assert/strict";
import { Inf, MaxSafeInteger, MinSafeInteger, NaN as JsNaN, negativeZero, Number_BitwiseAND, Number_BitwiseNOT, Number_BitwiseOR, Number_BitwiseXOR, Number_Exponentiate, Number_LeftShift, Number_Remainder, Number_SignedRightShift, Number_toInt32, Number_UnsignedRightShift, } from "./jsnum.js";
const float64Buffer = new ArrayBuffer(8);
const float64View = new Float64Array(float64Buffer);
const uint32View = new Uint32Array(float64Buffer);
const bigUint64View = new BigUint64Array(float64Buffer);
function numberFromBits(bits) {
    bigUint64View[0] = bits;
    return float64View[0];
}
function numberToBits(value) {
    float64View[0] = value;
    return bigUint64View[0];
}
function assertEqualNumber(actual, expected) {
    if (globalThis.Number.isNaN(actual) || globalThis.Number.isNaN(expected)) {
        assert.equal(globalThis.Number.isNaN(actual), globalThis.Number.isNaN(expected));
        return;
    }
    assert.ok(actual === expected, `got ${actual}, want ${expected}`);
}
function assertWithinOneULP(actual, expected) {
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
    const cases = [
        { name: "0.0", input: 0, expected: 0 },
        { name: "-0.0", input: negativeZero, expected: 0 },
        { name: "NaN", input: JsNaN(), expected: 0 },
        { name: "+Inf", input: Inf(1), expected: 0 },
        { name: "-Inf", input: Inf(-1), expected: 0 },
        { name: "MaxInt32", input: 2_147_483_647, expected: 2_147_483_647 },
        { name: "MaxInt32+1", input: 2_147_483_648, expected: -2_147_483_648 },
        { name: "MinInt32", input: -2_147_483_648, expected: -2_147_483_648 },
        { name: "MinInt32-1", input: -2_147_483_649, expected: 2_147_483_647 },
        { name: "MIN_SAFE_INTEGER", input: MinSafeInteger, expected: 1 },
        { name: "MIN_SAFE_INTEGER-1", input: (MinSafeInteger - 1), expected: 0 },
        { name: "MIN_SAFE_INTEGER+1", input: (MinSafeInteger + 1), expected: 2 },
        { name: "MAX_SAFE_INTEGER", input: MaxSafeInteger, expected: -1 },
        { name: "MAX_SAFE_INTEGER-1", input: (MaxSafeInteger - 1), expected: -2 },
        { name: "MAX_SAFE_INTEGER+1", input: (MaxSafeInteger + 1), expected: 0 },
        { name: "-8589934590", input: -8_589_934_590, expected: 2 },
        { name: "0xDEADBEEF", input: 0xdeadbeef, expected: -559_038_737 },
        { name: "4294967808", input: 4_294_967_808, expected: 512 },
        { name: "-0.4", input: -0.4, expected: 0 },
        { name: "SmallestNonzeroFloat64", input: 5e-324, expected: 0 },
        { name: "-SmallestNonzeroFloat64", input: -5e-324, expected: 0 },
        { name: "MaxFloat64", input: globalThis.Number.MAX_VALUE, expected: 0 },
        { name: "-MaxFloat64", input: -globalThis.Number.MAX_VALUE, expected: 0 },
        { name: "Largest subnormal number", input: numberFromBits(0x000fffffffffffffn), expected: 0 },
        { name: "Smallest positive normal number", input: numberFromBits(0x0010000000000000n), expected: 0 },
        { name: "math.Pi", input: globalThis.Math.PI, expected: 3 },
        { name: "-math.Pi", input: -globalThis.Math.PI, expected: -3 },
        { name: "math.E", input: globalThis.Math.E, expected: 2 },
        { name: "-math.E", input: -globalThis.Math.E, expected: -2 },
        { name: "2^31 + 0.5", input: 2_147_483_648.5, expected: -2_147_483_648 },
        { name: "-2^31 - 0.5", input: -2_147_483_648.5, expected: -2_147_483_648 },
        { name: "2^40", input: 1_099_511_627_776, expected: 0 },
        { name: "TypeFlagsNarrowable", input: 536_624_127, expected: 536_624_127 },
    ];
    for (const c of cases) {
        assert.equal(Number_toInt32(c.input), c.expected, c.name);
        assertEqualNumber(Number_toInt32(c.input), (c.input | 0));
    }
});
test("Number bitwise operators mirror JavaScript 32-bit coercion", () => {
    const unaryCases = [
        [-2_147_483_649, -2_147_483_648],
        [2_147_483_647, -2_147_483_648],
        [-4_294_967_296, -1],
        [0, -1],
        [2_147_483_648, 2_147_483_647],
        [-2_147_483_648, 2_147_483_647],
        [4_294_967_296, -1],
    ];
    for (const [input, expected] of unaryCases) {
        assertEqualNumber(Number_BitwiseNOT(input), expected);
        assertEqualNumber(Number_BitwiseNOT(input), (~input));
    }
    const binaryCases = [
        [0, 0, 0, 0, 0],
        [0, 1, 0, 1, 1],
        [1, 0, 0, 1, 1],
        [1, 1, 1, 1, 0],
    ];
    for (const [left, right, andExpected, orExpected, xorExpected] of binaryCases) {
        assertEqualNumber(Number_BitwiseAND(left, right), andExpected);
        assertEqualNumber(Number_BitwiseAND(left, right), (left & right));
        assertEqualNumber(Number_BitwiseOR(left, right), orExpected);
        assertEqualNumber(Number_BitwiseOR(left, right), (left | right));
        assertEqualNumber(Number_BitwiseXOR(left, right), xorExpected);
        assertEqualNumber(Number_BitwiseXOR(left, right), (left ^ right));
    }
});
test("Number shifts mirror JavaScript shift-count masking", () => {
    const signedCases = [
        [1, 0, 1],
        [1, 31, 0],
        [1, 32, 1],
        [-4, 1, -2],
        [-4, 4, -1],
        [-4, 33, -2],
    ];
    for (const [left, right, expected] of signedCases) {
        assertEqualNumber(Number_SignedRightShift(left, right), expected);
        assertEqualNumber(Number_SignedRightShift(left, right), (left >> right));
    }
    const unsignedCases = [
        [1, 0, 1],
        [1, 32, 1],
        [-4, 0, 4_294_967_292],
        [-4, 1, 2_147_483_646],
        [-4, 31, 1],
        [-4, 33, 2_147_483_646],
    ];
    for (const [left, right, expected] of unsignedCases) {
        assertEqualNumber(Number_UnsignedRightShift(left, right), expected);
        assertEqualNumber(Number_UnsignedRightShift(left, right), (left >>> right));
    }
    const leftShiftCases = [
        [1, 0, 1],
        [1, 1, 2],
        [1, 31, -2_147_483_648],
        [1, 32, 1],
        [-4, 3, -32],
        [-4, 31, 0],
    ];
    for (const [left, right, expected] of leftShiftCases) {
        assertEqualNumber(Number_LeftShift(left, right), expected);
        assertEqualNumber(Number_LeftShift(left, right), (left << right));
    }
});
test("Number.Remainder mirrors JavaScript remainder semantics", () => {
    const cases = [
        [JsNaN(), 1, JsNaN()],
        [1, JsNaN(), JsNaN()],
        [Inf(1), 1, JsNaN()],
        [Inf(-1), 1, JsNaN()],
        [123, Inf(1), 123],
        [123, Inf(-1), 123],
        [123, 0, JsNaN()],
        [123, negativeZero, JsNaN()],
        [0, 123, 0],
        [negativeZero, 123, negativeZero],
        [10, 3, 1],
        [-10, 3, -1],
        [10, -3, 1],
        [-10, -3, -1],
        [5.5, 2, 1.5],
        [-5.5, 2, -1.5],
        [7, 0.1, (7 % 0.1)],
        [100, 0.3, (100 % 0.3)],
    ];
    for (const [left, right, expected] of cases) {
        assertEqualNumber(Number_Remainder(left, right), expected);
        assertEqualNumber(Number_Remainder(left, right), (left % right));
    }
});
test("Number.Exponentiate mirrors upstream edge cases and native JS within one ULP", () => {
    const cases = [
        [2, 3, 8],
        [Inf(1), 3, Inf(1)],
        [Inf(1), -5, 0],
        [Inf(-1), 3, Inf(-1)],
        [Inf(-1), 4, Inf(1)],
        [Inf(-1), -3, negativeZero],
        [Inf(-1), -4, 0],
        [0, 3, 0],
        [0, -10, Inf(1)],
        [negativeZero, 3, negativeZero],
        [negativeZero, 4, 0],
        [negativeZero, -3, Inf(-1)],
        [negativeZero, -4, Inf(1)],
        [3, Inf(1), Inf(1)],
        [-3, Inf(1), Inf(1)],
        [3, Inf(-1), 0],
        [-3, Inf(-1), 0],
        [JsNaN(), 3, JsNaN()],
        [1, Inf(1), JsNaN()],
        [1, Inf(-1), JsNaN()],
        [-1, Inf(1), JsNaN()],
        [-1, Inf(-1), JsNaN()],
        [1, JsNaN(), JsNaN()],
        [10, 308, numberFromBits(0x7fe1ccf385ebc8a0n)],
        [5, 210, numberFromBits(0x5e68557f31326bbbn)],
        [10, 200, numberFromBits(0x6974e718d7d7625an)],
    ];
    for (const [left, right, expected] of cases) {
        assertEqualNumber(Number_Exponentiate(left, right), expected);
        assertWithinOneULP(Number_Exponentiate(left, right), (left ** right));
    }
});
//# sourceMappingURL=jsnum.test.js.map