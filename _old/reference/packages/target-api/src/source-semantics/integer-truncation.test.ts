import assert from "node:assert/strict";
import test from "node:test";
import { sourceIntegerTruncationFits } from "./integer-truncation.js";

test("bounded signed and unsigned results must fit the entire native destination domain", () => {
  for (const [signed, unsigned, width] of [
    ["int8", "uint8", 8], ["int16", "uint16", 16], ["int32", "uint32", 32],
    ["int64", "uint64", 64], ["int128", "uint128", 128],
  ] as const) {
    assert.equal(sourceIntegerTruncationFits(width, true, signed), true);
    assert.equal(sourceIntegerTruncationFits(width, false, unsigned), true);
    assert.equal(sourceIntegerTruncationFits(width, false, signed), false);
    assert.equal(sourceIntegerTruncationFits(width - 1, false, signed), true);
    assert.equal(sourceIntegerTruncationFits(1, true, unsigned), false);
    assert.equal(sourceIntegerTruncationFits(0, true, unsigned), true);
    assert.equal(sourceIntegerTruncationFits(width + 1, true, signed), false);
  }
  for (const width of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(sourceIntegerTruncationFits(width, false, "uint128"), false);
  }
  for (const target of ["float32", "float64", "native-int", "native-uint", "bool"] as const) {
    assert.equal(sourceIntegerTruncationFits(0, true, target), false);
  }
});
