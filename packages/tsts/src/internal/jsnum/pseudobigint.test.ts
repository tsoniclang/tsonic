import { test } from "node:test";
import assert from "node:assert/strict";
import { Number_String } from "./string.js";
import { ParsePseudoBigInt } from "./pseudobigint.js";
import type { Number as JsNumber } from "./jsnum.js";

test("ParsePseudoBigInt strips decimal leading zeroes", () => {
  const testNumbers: JsNumber[] = [];
  for (let value = 0; value < 1_000; value++) {
    testNumbers.push(value as JsNumber);
  }
  for (let bits = 0; bits < 53; bits++) {
    const power = 2 ** bits;
    testNumbers.push(power as JsNumber, (power - 1) as JsNumber);
  }

  for (const testNumber of testNumbers) {
    const text = Number_String(testNumber);
    for (let leadingZeros = 0; leadingZeros < 10; leadingZeros++) {
      assert.equal(ParsePseudoBigInt(`${"0".repeat(leadingZeros)}${text}n`), text);
    }
  }
});

test("ParsePseudoBigInt parses non-decimal bases", () => {
  const cases: Array<[string, string]> = [
    ["0b0n", "0"],
    ["0b1n", "1"],
    ["0b1010n", "10"],
    ["0b1010_0101n", "165"],
    ["0B1101n", "13"],
    ["0o0n", "0"],
    ["0o7n", "7"],
    ["0o755n", "493"],
    ["0o7_5_5n", "493"],
    ["0O12n", "10"],
    ["0x0n", "0"],
    ["0xFn", "15"],
    ["0xFFn", "255"],
    ["0xF_Fn", "255"],
    ["0X1Fn", "31"],
  ];

  for (const [literal, expected] of cases) {
    assert.equal(ParsePseudoBigInt(literal), expected, literal);
  }
});

test("ParsePseudoBigInt parses large literals", () => {
  assert.equal(ParsePseudoBigInt("123456789012345678901234567890n"), "123456789012345678901234567890");
  assert.equal(
    ParsePseudoBigInt("0b1100011101110100100001111111101101100001101110011111000001110111001001110001111110000101011010010n"),
    "123456789012345678901234567890",
  );
  assert.equal(ParsePseudoBigInt("0o143564417755415637016711617605322n"), "123456789012345678901234567890");
  assert.equal(ParsePseudoBigInt("0x18ee90ff6c373e0ee4e3f0ad2n"), "123456789012345678901234567890");
});
