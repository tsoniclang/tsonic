import { test } from "node:test";
import assert from "node:assert/strict";
import * as utf8 from "./utf8.js";

test("RuneError / RuneSelf constants", () => {
  assert.equal(utf8.RuneError, 0xfffd);
  assert.equal(utf8.RuneSelf, 0x80);
});

test("DecodeRuneInString ASCII", () => {
  const [r, size] = utf8.DecodeRuneInString("abc");
  assert.equal(r, "a".codePointAt(0)!);
  assert.equal(size, 1);
});

test("DecodeRuneInString multibyte", () => {
  // "é" is 2 UTF-8 bytes (U+00E9).
  const [r, size] = utf8.DecodeRuneInString("é");
  assert.equal(r, 0xe9);
  assert.equal(size, 2);
  // "€" (U+20AC) is 3 bytes.
  const [r3, size3] = utf8.DecodeRuneInString("€");
  assert.equal(r3, 0x20ac);
  assert.equal(size3, 3);
  // "𝄞" (U+1D11E) is 4 bytes.
  const [r4, size4] = utf8.DecodeRuneInString("𝄞");
  assert.equal(r4, 0x1d11e);
  assert.equal(size4, 4);
});

test("DecodeRuneInString empty", () => {
  const [r, size] = utf8.DecodeRuneInString("");
  assert.equal(r, utf8.RuneError);
  assert.equal(size, 0);
});

test("DecodeLastRuneInString", () => {
  const [r, size] = utf8.DecodeLastRuneInString("abc");
  assert.equal(r, "c".codePointAt(0)!);
  assert.equal(size, 1);
  const [r2, size2] = utf8.DecodeLastRuneInString("aé");
  assert.equal(r2, 0xe9);
  assert.equal(size2, 2);
  const [r3, size3] = utf8.DecodeLastRuneInString("");
  assert.equal(r3, utf8.RuneError);
  assert.equal(size3, 0);
});

test("RuneCountInString", () => {
  assert.equal(utf8.RuneCountInString("abc"), 3);
  // 3 runes even though "é" and "€" take more bytes.
  assert.equal(utf8.RuneCountInString("aé€"), 3);
  assert.equal(utf8.RuneCountInString(""), 0);
  assert.equal(utf8.RuneCountInString("𝄞x"), 2);
});

test("RuneLen", () => {
  assert.equal(utf8.RuneLen("a".codePointAt(0)!), 1);
  assert.equal(utf8.RuneLen(0xe9), 2);
  assert.equal(utf8.RuneLen(0x20ac), 3);
  assert.equal(utf8.RuneLen(0x1d11e), 4);
  assert.equal(utf8.RuneLen(-1), -1);
  assert.equal(utf8.RuneLen(0xd800), -1);
});

test("String byte-view helpers preserve Go byte offsets", () => {
  const text = "aé𝄞z";
  assert.equal(utf8.StringByteLen(text), 8);
  assert.equal(utf8.StringByteAt(text, 0), "a".charCodeAt(0));
  assert.equal(utf8.StringByteAt(text, 1), 0xc3);
  assert.equal(utf8.StringByteSlice(text, 1, 3), "é");
  assert.equal(utf8.StringByteSlice(text, 3, 7), "𝄞");
  assert.deepEqual(utf8.DecodeRuneInStringAt(text, 3), [0x1d11e, 4]);
  assert.deepEqual(utf8.DecodeLastRuneInStringBefore(text, 7), [0x1d11e, 4]);
});

test("String byte-view slicing preserves BOM code points", () => {
  const text = "a\uFEFFb";
  assert.equal(utf8.StringByteLen(text), 5);
  assert.equal(utf8.StringByteSlice(text, 1, 4), "\uFEFF");
  assert.equal(utf8.StringByteSlice(text, 1), "\uFEFFb");
  assert.deepEqual(utf8.DecodeRuneInStringAt(text, 1), [0xfeff, 3]);
});

test("String byte-view helpers preserve lone surrogate sentinel bytes", () => {
  const text = "a\uD800x\uDE03z";
  assert.equal(utf8.StringByteLen(text), 9);
  assert.equal(utf8.StringByteAt(text, 1), 0xed);
  assert.equal(utf8.StringByteAt(text, 2), 0xa0);
  assert.equal(utf8.StringByteAt(text, 3), 0x80);
  assert.equal(utf8.StringByteSlice(text, 1, 4), "\uD800");
  assert.equal(utf8.StringByteSlice(text, 5, 8), "\uDE03");
  assert.deepEqual(utf8.DecodeRuneInStringAt(text, 1), [utf8.RuneError, 1]);
});
