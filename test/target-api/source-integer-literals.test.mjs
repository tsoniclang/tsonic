import assert from "node:assert/strict";
import test from "node:test";
import { sourceIntegerLiteralValue, parseNativeIntegerLiteral } from "../../packages/target-api/dist/public/source.js";
import { checkedSource, projectSourceFile } from "../fixtures/source-navigation.mjs";

test("native integer values retain exact authored literal tokens across scanner normalization", async () => {
  const inputs = [
    ["9007199254740993", 9007199254740993n],
    ["9_007_199_254_740_993", 9007199254740993n],
    ["9223372036854775807", 9223372036854775807n],
    ["18446744073709551615", 18446744073709551615n],
    ["0x20000000000001", 9007199254740993n],
    ["0b100000000000000000000000000000000000000000000000000001", 9007199254740993n],
    ["9007199254740993.0", 9007199254740993n],
    ["90071992547409930e-1", 9007199254740993n],
    ["340282366920938463463374607431768211455n", (1n << 128n) - 1n],
  ];
  const source = await checkedSource("native-integer-tokens", { "src/index.ts":
    "/* 😀 Unicode and CRLF before token spans */\r\n" + inputs.map(([literal], index) =>
      `export const value${index} = /* exact token */ ${literal};`).join("\r\n") });
  const literals = [];
  const visit = node => {
    if (source.ast.is.IsNumericLiteral(node) || source.ast.is.IsBigIntLiteral(node)) literals.push(node);
    source.ast.forEachChild(node, visit);
  };
  visit(projectSourceFile(source, "src/index.ts"));
  assert.equal(literals.length, inputs.length);
  for (const [index, literal] of literals.entries()) {
    assert.equal(sourceIntegerLiteralValue(source.ast, literal), inputs[index][1], inputs[index][0]);
  }
});

test("native literal parsing bounds magnitude and never rounds fractional values", () => {
  for (const [text, expected] of [["100e-2", 1n], ["0e999999999", 0n], ["0x000000ff", 255n],
    ["0o377", 255n], ["170141183460469231731687303715884105728", 1n << 127n]]) {
    assert.equal(parseNativeIntegerLiteral(text), expected);
  }
  for (const text of ["0.5", "1001e-2", "1e999999999", "1e-999999999", "Infinity", "NaN",
    "0x10000000000000000000000000000000000000000", "1 + 2", "123junk"]) {
    assert.equal(parseNativeIntegerLiteral(text), undefined, text);
  }
});
