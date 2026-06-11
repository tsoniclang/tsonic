// Mirror of internal/ast/positionmap_test.go (the Benchmark* functions are Go
// benchmarks and have no mirrors). Go positions are UTF-8 BYTE offsets and
// `len(text)` / `strings.LastIndex` are byte-based, so the mirror computes
// byte offsets through the UTF-8 encoded view of the JS string.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { int } from "@tsonic/core/types.js";
import { ComputePositionMap, PositionMap_IsAsciiOnly, PositionMap_UTF16ToUTF8, PositionMap_UTF8ToUTF16 } from "./positionmap.js";

const utf8Encoder = new globalThis.TextEncoder();
const byteLen = (s: string): int => utf8Encoder.encode(s).length;
// strings.LastIndex(text, ch): byte offset of the last occurrence.
const lastByteIndex = (text: string, ch: string): int => byteLen(text.slice(0, text.lastIndexOf(ch)));

test("PositionMapASCII", () => {
  const text = "const x = 1;";
  const pm = ComputePositionMap(text);
  assert.ok(PositionMap_IsAsciiOnly(pm), "expected ASCII-only");
  for (let i = 0; i <= byteLen(text); i++) {
    assert.equal(PositionMap_UTF8ToUTF16(pm, i), i, `UTF8ToUTF16(${i})`);
    assert.equal(PositionMap_UTF16ToUTF8(pm, i), i, `UTF16ToUTF8(${i})`);
  }
});

test("PositionMapTwoByte", () => {
  // "café" — é (U+00E9) is 2 bytes UTF-8, 1 code unit UTF-16
  const text = "const café = 1;\nconst x = 2;";
  const pm = ComputePositionMap(text);
  assert.ok(!PositionMap_IsAsciiOnly(pm), "expected non-ASCII");

  // Everything before é (byte offset 9) should be identity
  for (let i = 0; i < 10; i++) {
    assert.equal(PositionMap_UTF8ToUTF16(pm, i), i, `before é: UTF8ToUTF16(${i})`);
  }

  // é starts at UTF-8 byte 9, UTF-16 offset 9: same
  assert.equal(PositionMap_UTF8ToUTF16(pm, 9), 9, "at é: UTF8ToUTF16(9)");

  // After é (byte 11 in UTF-8 = code unit 10 in UTF-16), delta is 1
  assert.equal(PositionMap_UTF8ToUTF16(pm, 11), 10, "after é: UTF8ToUTF16(11)");

  // 'x' on second line: UTF-8 byte 23, UTF-16 offset 22
  const xUTF8 = lastByteIndex(text, "x");
  assert.equal(PositionMap_UTF8ToUTF16(pm, xUTF8), xUTF8 - 1, `at x: UTF8ToUTF16(${xUTF8})`);

  // Reverse: UTF-16 offset 22 should map to UTF-8 byte 23
  const xUTF16 = xUTF8 - 1;
  assert.equal(PositionMap_UTF16ToUTF8(pm, xUTF16), xUTF8, `reverse at x: UTF16ToUTF8(${xUTF16})`);
});

test("PositionMapFourByte", () => {
  // 🎉 (U+1F389) is 4 bytes UTF-8, 2 code units UTF-16
  const text = `const a = "🎉";` + "\nconst b = 2;";
  const pm = ComputePositionMap(text);
  assert.ok(!PositionMap_IsAsciiOnly(pm), "expected non-ASCII");

  // 🎉 starts at byte 11 (after `const a = "`)
  // UTF-8: bytes 11-14 (4 bytes), UTF-16: units 11-12 (2 code units)
  // After 🎉: UTF-8 byte 15, UTF-16 offset 13. Delta = 2.

  // 'b' on second line
  const bUTF8 = lastByteIndex(text, "b");
  const bUTF16 = bUTF8 - 2; // delta of 2 from emoji
  assert.equal(PositionMap_UTF8ToUTF16(pm, bUTF8), bUTF16, `at b: UTF8ToUTF16(${bUTF8})`);
  assert.equal(PositionMap_UTF16ToUTF8(pm, bUTF16), bUTF8, `reverse at b: UTF16ToUTF8(${bUTF16})`);
});

test("PositionMapMultipleNonASCII", () => {
  // Mix of 2-byte and 4-byte characters
  // "à" (U+00E0) = 2 bytes UTF-8, 1 code unit UTF-16 (delta +1)
  // "🎉" (U+1F389) = 4 bytes UTF-8, 2 code units UTF-16 (delta +2)
  const text = "à🎉x";
  const pm = ComputePositionMap(text);

  // à: UTF-8 [0,2), UTF-16 [0,1)
  // 🎉: UTF-8 [2,6), UTF-16 [1,3)
  // x: UTF-8 [6,7), UTF-16 [3,4)
  const tests: Array<{ utf8: int; utf16: int }> = [
    { utf8: 0, utf16: 0 },
    { utf8: 2, utf16: 1 }, // start of 🎉
    { utf8: 6, utf16: 3 }, // x
    { utf8: 7, utf16: 4 }, // end
  ];
  for (const tt of tests) {
    assert.equal(PositionMap_UTF8ToUTF16(pm, tt.utf8), tt.utf16, `UTF8ToUTF16(${tt.utf8})`);
    assert.equal(PositionMap_UTF16ToUTF8(pm, tt.utf16), tt.utf8, `UTF16ToUTF8(${tt.utf16})`);
  }
});

test("PositionMapRoundtrip", () => {
  const text = "let café = \"🎉\"; // naïve";
  const pm = ComputePositionMap(text);

  // Convert every valid UTF-16 position to UTF-8 and back
  const utf16Len = PositionMap_UTF8ToUTF16(pm, byteLen(text));
  for (let i = 0; i <= utf16Len; i++) {
    const utf8Pos = PositionMap_UTF16ToUTF8(pm, i);
    const back = PositionMap_UTF8ToUTF16(pm, utf8Pos);
    assert.equal(back, i, `roundtrip UTF16->UTF8->UTF16: ${i} -> ${utf8Pos} -> ${back}`);
  }
});
