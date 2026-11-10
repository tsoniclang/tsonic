import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseBigIntLiteral,
  parseFiniteNumberLiteral,
} from "../../packages/target-api/dist/public/source.js";

test("source numeric literal parser supports separators and finite JS numeric forms", () => {
  assert.equal(parseFiniteNumberLiteral("1_000"), 1000);
  assert.equal(parseFiniteNumberLiteral("0xFF_FF"), 65535);
  assert.equal(parseFiniteNumberLiteral("0b1010_0101"), 165);
  assert.equal(parseFiniteNumberLiteral("1e3"), 1000);
  assert.equal(parseFiniteNumberLiteral("Infinity"), undefined);
});

test("source bigint literal parser supports separators and rejects invalid text", () => {
  assert.equal(parseBigIntLiteral("1_000n"), 1000n);
  assert.equal(parseBigIntLiteral("0xFF_FFn"), 65535n);
  assert.equal(parseBigIntLiteral("not-a-bigint"), undefined);
});
