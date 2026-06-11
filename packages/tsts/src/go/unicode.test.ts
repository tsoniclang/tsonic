import { test } from "node:test";
import assert from "node:assert/strict";
import * as unicode from "./unicode.js";

test("MaxASCII constant", () => {
  assert.equal(unicode.MaxASCII, 0x7f);
});

test("Is with Zs range table", () => {
  // U+0020 SPACE is in Zs.
  assert.equal(unicode.Is(unicode.Zs, 0x20), true);
  // U+00A0 NBSP is in Zs.
  assert.equal(unicode.Is(unicode.Zs, 0xa0), true);
  // U+2003 EM SPACE (within 0x2000-0x200a) is in Zs.
  assert.equal(unicode.Is(unicode.Zs, 0x2003), true);
  // U+3000 IDEOGRAPHIC SPACE is in Zs.
  assert.equal(unicode.Is(unicode.Zs, 0x3000), true);
  // 'a' is not in Zs.
  assert.equal(unicode.Is(unicode.Zs, "a".codePointAt(0)!), false);
  // U+0009 TAB is whitespace but NOT category Zs.
  assert.equal(unicode.Is(unicode.Zs, 0x09), false);
});

test("IsDigit", () => {
  assert.equal(unicode.IsDigit("5".codePointAt(0)!), true);
  assert.equal(unicode.IsDigit("a".codePointAt(0)!), false);
  // Arabic-Indic digit ٥ (U+0665) is category Nd.
  assert.equal(unicode.IsDigit(0x0665), true);
});

test("IsLetter", () => {
  assert.equal(unicode.IsLetter("a".codePointAt(0)!), true);
  assert.equal(unicode.IsLetter("Z".codePointAt(0)!), true);
  assert.equal(unicode.IsLetter("5".codePointAt(0)!), false);
  assert.equal(unicode.IsLetter("é".codePointAt(0)!), true);
});

test("IsLower / IsUpper", () => {
  assert.equal(unicode.IsLower("a".codePointAt(0)!), true);
  assert.equal(unicode.IsLower("A".codePointAt(0)!), false);
  assert.equal(unicode.IsUpper("A".codePointAt(0)!), true);
  assert.equal(unicode.IsUpper("a".codePointAt(0)!), false);
});

test("IsSpace", () => {
  assert.equal(unicode.IsSpace(" ".codePointAt(0)!), true);
  assert.equal(unicode.IsSpace("\t".codePointAt(0)!), true);
  assert.equal(unicode.IsSpace("\n".codePointAt(0)!), true);
  assert.equal(unicode.IsSpace("a".codePointAt(0)!), false);
  assert.equal(unicode.IsSpace(0x3000), true);
});

test("ToLower / ToUpper", () => {
  assert.equal(unicode.ToLower("A".codePointAt(0)!), "a".codePointAt(0)!);
  assert.equal(unicode.ToLower("a".codePointAt(0)!), "a".codePointAt(0)!);
  assert.equal(unicode.ToUpper("a".codePointAt(0)!), "A".codePointAt(0)!);
  assert.equal(unicode.ToUpper("A".codePointAt(0)!), "A".codePointAt(0)!);
  // Non-ASCII: é -> É
  assert.equal(unicode.ToUpper("é".codePointAt(0)!), "É".codePointAt(0)!);
  assert.equal(unicode.ToLower("É".codePointAt(0)!), "é".codePointAt(0)!);
});
