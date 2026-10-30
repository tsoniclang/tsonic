import assert from "node:assert/strict";
import test from "node:test";
import { sourceNumericLiteralIsExactlyRepresentableAsBinaryFloat } from "../public/source.js";
import { parseSourceNumericLiteral } from "./literal-token.js";

function token(text: string) {
  const parsed = parseSourceNumericLiteral(text);
  assert.equal(parsed !== undefined, true, `${text}: exact authored token`);
  return parsed!.token;
}

test("numeric spelling preserves an authored decimal point and exponent independently of its exact integer value", () => {
  for (const [text, expected] of [
    ["1", "1"], ["1.", "1."], ["1.0", "1.0"], ["1.e0", "1.e+0"], ["1e0", "1e+0"],
    ["0.", "0."], ["0.e2", "0.e+2"], ["1_0.", "10."], [".5", "0.5"], ["0xff", "255"],
  ] as const) {
    const parsed = parseSourceNumericLiteral(text);
    assert.equal(parsed?.token.decimalText, expected, text);
    assert.equal(parsed?.token.negative, false, `unsigned token ${text}`);
  }
  for (const text of ["1", "1.", "1.0", "1.e0", "1e0"]) {
    const parsed = parseSourceNumericLiteral(text);
    assert.equal(parsed?.integer, 1n, `unchanged exact integer ${text}`);
    assert.equal(parsed?.token.coefficient, 1n, `unchanged coefficient ${text}`);
    assert.equal(parsed?.token.exponent, 0n, `unchanged native exponent ${text}`);
  }
});

test("binary float exactness uses the authored rational, not a rounded double", () => {
  for (const [text, expected] of [
    ["0.1", false], ["0.5", true], ["1.25", true], ["16777216", true],
    ["16777217", false], ["4294967295", false], ["65535", true], ["32767", true],
    ["1.000000059604644775390625", false],
    ["1.0000000596046447753906249999999999999999999999", false],
    ["1.0000000596046447753906250000000000000000000001", false],
  ] as const) {
    assert.equal(sourceNumericLiteralIsExactlyRepresentableAsBinaryFloat(token(text), "float32"), expected, text);
  }
  const neighbor = "1.0000000000000000000000000000000000000001";
  assert.equal(Number(neighbor), 1, "the double representation loses this authored distinction");
  assert.equal(sourceNumericLiteralIsExactlyRepresentableAsBinaryFloat(token(neighbor), "float32"), false,
    "an authored neighbor of one does not acquire exact float32 evidence");
});

test("binary float exactness handles normal and subnormal endpoints on both widths", () => {
  for (const [target, precision, high, low] of [
    ["float32", 24n, 127n, 149n], ["float64", 53n, 1023n, 1074n],
  ] as const) {
    const maximum = ((1n << precision) - 1n) << (high - precision + 1n);
    const subnormal = 5n ** low;
    for (const [text, expected] of [
      [String(maximum), true], [String(maximum + 1n), false], [String(1n << (high + 1n)), false],
      [`${subnormal}e-${low}`, true], [`${subnormal - 1n}e-${low}`, false],
      [`${subnormal + 1n}e-${low}`, false], [`${5n ** (low + 1n)}e-${low + 1n}`, false],
    ] as const) {
      assert.equal(sourceNumericLiteralIsExactlyRepresentableAsBinaryFloat(token(text), target), expected,
        `${target}: ${text}`);
    }
  }
});

test("binary float exactness preserves signed zero and bounds extreme decimal exponents", () => {
  for (const target of ["float32", "float64"] as const) {
    assert.equal(sourceNumericLiteralIsExactlyRepresentableAsBinaryFloat(token("0e9999999999999999999999999"), target), true);
    assert.equal(sourceNumericLiteralIsExactlyRepresentableAsBinaryFloat({ ...token("0"), negative: true }, target), true);
    for (const text of ["1e9999999999999999999999999", "1e-9999999999999999999999999"]) {
      assert.equal(sourceNumericLiteralIsExactlyRepresentableAsBinaryFloat(token(text), target), false, `${target}: ${text}`);
    }
  }
  assert.equal(sourceNumericLiteralIsExactlyRepresentableAsBinaryFloat(token("9007199254740992"), "float64"), true);
  assert.equal(sourceNumericLiteralIsExactlyRepresentableAsBinaryFloat(token("9007199254740993"), "float64"), false);
});
