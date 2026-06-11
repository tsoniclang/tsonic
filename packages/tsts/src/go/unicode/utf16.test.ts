import { test } from "node:test";
import assert from "node:assert/strict";
import * as utf16 from "./utf16.js";

test("RuneLen", () => {
  assert.equal(utf16.RuneLen("a".codePointAt(0)!), 1);
  assert.equal(utf16.RuneLen(0xe9), 1);
  assert.equal(utf16.RuneLen(0x20ac), 1);
  // Astral plane char needs a surrogate pair (2 words).
  assert.equal(utf16.RuneLen(0x1d11e), 2);
  // Surrogate halves are invalid.
  assert.equal(utf16.RuneLen(0xd800), -1);
  assert.equal(utf16.RuneLen(-1), -1);
});

test("AppendRune BMP and astral", () => {
  const a = utf16.AppendRune([], "a".codePointAt(0)!);
  assert.deepEqual(a, [0x61]);
  // Astral char -> surrogate pair appended.
  const b = utf16.AppendRune(a, 0x1d11e);
  assert.deepEqual(b, [0x61, 0xd834, 0xdd1e]);
  // Original slice not mutated (Go-append style returns a new slice).
  assert.deepEqual(a, [0x61]);
});

test("Decode round-trips", () => {
  // 'a' then surrogate pair for U+1D11E.
  const units = [0x61, 0xd834, 0xdd1e];
  assert.deepEqual(utf16.Decode(units), [0x61, 0x1d11e]);
});

test("Decode unpaired surrogate becomes replacement char", () => {
  // Lone high surrogate.
  assert.deepEqual(utf16.Decode([0xd834]), [0xfffd]);
  // Lone low surrogate.
  assert.deepEqual(utf16.Decode([0xdd1e]), [0xfffd]);
});

test("Encode mirrors AppendRune", () => {
  assert.deepEqual(utf16.Encode([0x61, 0x1d11e]), [0x61, 0xd834, 0xdd1e]);
});

test("IsSurrogate / DecodeRune / EncodeRune", () => {
  assert.equal(utf16.IsSurrogate(0xd834), true);
  assert.equal(utf16.IsSurrogate(0x61), false);
  const [r1, r2] = utf16.EncodeRune(0x1d11e);
  assert.equal(r1, 0xd834);
  assert.equal(r2, 0xdd1e);
  assert.equal(utf16.DecodeRune(r1, r2), 0x1d11e);
  assert.equal(utf16.DecodeRune(0x61, 0x62), 0xfffd);
});
