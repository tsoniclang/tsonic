import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Inf,
  MaxSafeInteger,
  MinSafeInteger,
  NaN as JsNaN,
  negativeZero,
} from "./jsnum.js";
import type { Number as JsNumber } from "./jsnum.js";
import { FromString, Number_String } from "./string.js";

const float64Buffer = new ArrayBuffer(8);
const float64View = new Float64Array(float64Buffer);
const bigUint64View = new BigUint64Array(float64Buffer);
const maxMantissa = (1n << 53n) - 1n;

function numberFromBits(bits: bigint): JsNumber {
  bigUint64View[0] = bits;
  return float64View[0] as JsNumber;
}

function ieeeParts2Double(sign: boolean, ieeeExponent: number, ieeeMantissa: bigint): JsNumber {
  if (ieeeExponent > 2047) {
    throw new Error("ieeeExponent > 2047");
  }
  if (ieeeMantissa > maxMantissa) {
    throw new Error("ieeeMantissa > maxMantissa");
  }
  const signBit = sign ? 1n : 0n;
  return numberFromBits((signBit << 63n) | (BigInt(ieeeExponent) << 52n) | ieeeMantissa);
}

function assertEqualNumber(actual: JsNumber, expected: JsNumber): void {
  if (globalThis.Number.isNaN(actual) || globalThis.Number.isNaN(expected)) {
    assert.equal(globalThis.Number.isNaN(actual), globalThis.Number.isNaN(expected));
    return;
  }
  assert.ok(actual === expected, `got ${actual}, want ${expected}`);
}

const ryuStringTests: Array<[JsNumber, string]> = [
  [2.2250738585072014e-308 as JsNumber, "2.2250738585072014e-308"],
  [numberFromBits(0x7fefffffffffffffn), "1.7976931348623157e+308"],
  [numberFromBits(1n), "5e-324"],
  [2.98023223876953125e-8 as JsNumber, "2.9802322387695312e-8"],
  [-2.109808898695963e16 as JsNumber, "-21098088986959630"],
  [4.940656e-318 as JsNumber, "4.940656e-318"],
  [1.18575755e-316 as JsNumber, "1.18575755e-316"],
  [2.989102097996e-312 as JsNumber, "2.989102097996e-312"],
  [9.0608011534336e15 as JsNumber, "9060801153433600"],
  [4.708356024711512e18 as JsNumber, "4708356024711512000"],
  [9.409340012568248e18 as JsNumber, "9409340012568248000"],
  [1.2345678 as JsNumber, "1.2345678"],
  [numberFromBits(0x4830f0cf064dd592n), "5.764607523034235e+39"],
  [numberFromBits(0x4840f0cf064dd592n), "1.152921504606847e+40"],
  [numberFromBits(0x4850f0cf064dd592n), "2.305843009213694e+40"],
  [1.2345678901234567 as JsNumber, "1.2345678901234567"],
  [4.294967296 as JsNumber, "4.294967296"],
  [ieeeParts2Double(false, 4, 0n), "1.7800590868057611e-307"],
  [ieeeParts2Double(false, 6, maxMantissa), "2.8480945388892175e-306"],
  [ieeeParts2Double(false, 1077, 0n), "18014398509481984"],
  [ieeeParts2Double(false, 1076, maxMantissa), "36028797018963964"],
  [ieeeParts2Double(false, 934, 0x000fa7161a4d6e0cn), "3.196104012172126e-27"],
  [9007199254740991.0 as JsNumber, "9007199254740991"],
  [9007199254740992.0 as JsNumber, "9007199254740992"],
  [1.234567890123456e15 as JsNumber, "1234567890123456"],
  [1000000000000001 as JsNumber, "1000000000000001"],
  [8796093022208000 as JsNumber, "8796093022208000"],
];

const stringTests: Array<[JsNumber, string]> = [
  [JsNaN(), "NaN"],
  [Inf(1), "Infinity"],
  [Inf(-1), "-Infinity"],
  [0 as JsNumber, "0"],
  [negativeZero, "0"],
  [1 as JsNumber, "1"],
  [-1 as JsNumber, "-1"],
  [0.3 as JsNumber, "0.3"],
  [-0.3 as JsNumber, "-0.3"],
  [1.5 as JsNumber, "1.5"],
  [-1.5 as JsNumber, "-1.5"],
  [1e308 as JsNumber, "1e+308"],
  [-1e308 as JsNumber, "-1e+308"],
  [globalThis.Math.PI as JsNumber, "3.141592653589793"],
  [-globalThis.Math.PI as JsNumber, "-3.141592653589793"],
  [MaxSafeInteger, "9007199254740991"],
  [MinSafeInteger, "-9007199254740991"],
  [numberFromBits(0x000fffffffffffffn), "2.225073858507201e-308"],
  [numberFromBits(0x0010000000000000n), "2.2250738585072014e-308"],
  [1234567.8 as JsNumber, "1234567.8"],
  [19686109595169230000 as JsNumber, "19686109595169230000"],
  [123.456 as JsNumber, "123.456"],
  [-123.456 as JsNumber, "-123.456"],
  [444123.789123456789875436 as JsNumber, "444123.7891234568"],
  [-444123.78963636363636363636 as JsNumber, "-444123.7896363636"],
  [1e21 as JsNumber, "1e+21"],
  [1e20 as JsNumber, "100000000000000000000"],
  ...ryuStringTests,
];

const fromStringTests: Array<[JsNumber, string]> = [
  [JsNaN(), "    NaN"],
  [Inf(1), "Infinity    "],
  [Inf(-1), "    -Infinity"],
  [1 as JsNumber, "1."],
  [1 as JsNumber, "1.0   "],
  [1 as JsNumber, "+1"],
  [1 as JsNumber, "+1."],
  [1 as JsNumber, "+1.0"],
  [JsNaN(), "whoops"],
  [0 as JsNumber, ""],
  [0 as JsNumber, "0"],
  [0 as JsNumber, "0."],
  [0 as JsNumber, "0.0"],
  [0 as JsNumber, "0.0000"],
  [0 as JsNumber, ".0000"],
  [negativeZero, "-0"],
  [negativeZero, "-0."],
  [negativeZero, "-0.0"],
  [negativeZero, "-.0"],
  [JsNaN(), "."],
  [JsNaN(), "e"],
  [JsNaN(), ".e"],
  [JsNaN(), "+"],
  [0 as JsNumber, "0X0"],
  [JsNaN(), "e0"],
  [JsNaN(), "E0"],
  [JsNaN(), "1e"],
  [JsNaN(), "1e+"],
  [JsNaN(), "1e-"],
  [1 as JsNumber, "1e+0"],
  [JsNaN(), "++0"],
  [JsNaN(), "0_0"],
  [Inf(1), "1e1000"],
  [Inf(-1), "-1e1000"],
  [0 as JsNumber, ".0e0"],
  [JsNaN(), "0e++0"],
  [10 as JsNumber, "0XA"],
  [0b1010 as JsNumber, "0b1010"],
  [0b1010 as JsNumber, "0B1010"],
  [0o12 as JsNumber, "0o12"],
  [0o12 as JsNumber, "0O12"],
  [0x123456789abcdef0 as JsNumber, "0x123456789abcdef0"],
  [0x123456789abcdef0 as JsNumber, "0X123456789ABCDEF0"],
  [18446744073709552000 as JsNumber, "0X10000000000000000"],
  [18446744073709597000 as JsNumber, "0X1000000000000A801"],
  [JsNaN(), "0B0.0"],
  [1.231235345083403e91 as JsNumber, "12312353450834030486384068034683603046834603806830644850340602384608368034634603680348603864"],
  [JsNaN(), "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX8OOOOOOOOOOOOOOOOOOO"],
  [Inf(1), "+Infinity"],
  [1234.56 as JsNumber, "  \t1234.56  "],
  [JsNaN(), "\u200b"],
  [0 as JsNumber, " "],
  [0 as JsNumber, "\n"],
  [0 as JsNumber, "\r"],
  [0 as JsNumber, "\r\n"],
  [0 as JsNumber, "\u2028"],
  [0 as JsNumber, "\u2029"],
  [0 as JsNumber, "\t"],
  [0 as JsNumber, "\v"],
  [0 as JsNumber, "\f"],
  [0 as JsNumber, "\ufeff"],
  [0 as JsNumber, "\u00a0"],
  [10000000000000000000 as JsNumber, "010000000000000000000"],
  [JsNaN(), "0x1.fffffffffffffp1023"],
  [JsNaN(), "0X_1FFFP-16"],
  [JsNaN(), "1_000"],
  [0 as JsNumber, "0x0"],
  [0 as JsNumber, "0X0"],
  [JsNaN(), "0xOOPS"],
  [0xabcdef as JsNumber, "0xABCDEF"],
  [0 as JsNumber, "0o0"],
  [0 as JsNumber, "0O0"],
  [JsNaN(), "0o8"],
  [JsNaN(), "0O8"],
  [0o12345 as JsNumber, "0o12345"],
  [0o12345 as JsNumber, "0O12345"],
  [0 as JsNumber, "0b0"],
  [0 as JsNumber, "0B0"],
  [JsNaN(), "0b2"],
  [0b10101 as JsNumber, "0b10101"],
  [0b10101 as JsNumber, "0B10101"],
  [JsNaN(), "1.f"],
  [JsNaN(), "1.e"],
  [JsNaN(), "1.0ef"],
  [JsNaN(), "1.0e"],
  [JsNaN(), ".f"],
  [JsNaN(), ".e"],
  [JsNaN(), ".0ef"],
  [JsNaN(), ".0e"],
  [JsNaN(), "a.f"],
  [JsNaN(), "a.e"],
  [JsNaN(), "a.0ef"],
  [JsNaN(), "a.0e"],
];

test("Number.String mirrors upstream fixed and Ryu cases", () => {
  for (const [number, expected] of stringTests) {
    assert.equal(Number_String(number), expected, expected);
  }
});

test("FromString mirrors upstream accepted and rejected strings", () => {
  for (const [number, text] of stringTests) {
    assertEqualNumber(FromString(text), number);
    assertEqualNumber(FromString(`${text} `), number);
    assertEqualNumber(FromString(` ${text}`), number);
  }

  for (const [number, text] of fromStringTests) {
    assertEqualNumber(FromString(text), number);
  }
});

test("Number.String round-trips through FromString", () => {
  for (const [, text] of stringTests) {
    assert.equal(Number_String(FromString(text)), text);
  }
});
