// Mirror of internal/printer/utilities_test.go (TestEscapeString,
// TestEscapeNonAsciiString, TestEscapeJsxAttributeString,
// TestIsRecognizedTripleSlashComment).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { bool } from "../../go/scalars.js";
import type { CommentRange } from "../ast/ast.js";
import { KindMultiLineCommentTrivia, KindSingleLineCommentTrivia, KindUnknown } from "../ast/generated/kinds.js";
import type { Kind } from "../ast/generated/kinds.js";
import { NewTextRange } from "../core/text.js";
import type { QuoteChar } from "./utilities.js";
import { EscapeString, IsRecognizedTripleSlashComment, QuoteCharBacktick, QuoteCharDoubleQuote, QuoteCharSingleQuote, escapeJsxAttributeString, escapeNonAsciiString } from "./utilities.js";

test("EscapeString", () => {
  const data: Array<{ s: string; quoteChar: QuoteChar; expected: string }> = [
    { s: "", quoteChar: QuoteCharDoubleQuote, expected: "" },
    { s: "abc", quoteChar: QuoteCharDoubleQuote, expected: "abc" },
    { s: 'ab"c', quoteChar: QuoteCharDoubleQuote, expected: 'ab\\"c' },
    { s: "ab\tc", quoteChar: QuoteCharDoubleQuote, expected: "ab\\tc" },
    { s: "ab\nc", quoteChar: QuoteCharDoubleQuote, expected: "ab\\nc" },
    { s: "ab'c", quoteChar: QuoteCharDoubleQuote, expected: "ab'c" },
    { s: "ab'c", quoteChar: QuoteCharSingleQuote, expected: "ab\\'c" },
    { s: 'ab"c', quoteChar: QuoteCharSingleQuote, expected: 'ab"c' },
    { s: "ab`c", quoteChar: QuoteCharBacktick, expected: "ab\\`c" },
    { s: "", quoteChar: QuoteCharBacktick, expected: "\\u001F" },
    { s: "\t\v\f \u00A0\uFEFF", quoteChar: QuoteCharDoubleQuote, expected: "\\t\\v\\f \u00A0\uFEFF" },
  ];
  for (let i = 0; i < data.length; i++) {
    const rec = data[i]!;
    assert.equal(EscapeString(rec.s, rec.quoteChar), rec.expected, `[${i}] escapeString(${JSON.stringify(rec.s)}, ${rec.quoteChar})`);
  }
});

test("EscapeNonAsciiString", () => {
  const data: Array<{ s: string; quoteChar: QuoteChar; expected: string }> = [
    { s: "", quoteChar: QuoteCharDoubleQuote, expected: "" },
    { s: "abc", quoteChar: QuoteCharDoubleQuote, expected: "abc" },
    { s: 'ab"c', quoteChar: QuoteCharDoubleQuote, expected: 'ab\\"c' },
    { s: "ab\tc", quoteChar: QuoteCharDoubleQuote, expected: "ab\\tc" },
    { s: "ab\nc", quoteChar: QuoteCharDoubleQuote, expected: "ab\\nc" },
    { s: "ab'c", quoteChar: QuoteCharDoubleQuote, expected: "ab'c" },
    { s: "ab'c", quoteChar: QuoteCharSingleQuote, expected: "ab\\'c" },
    { s: 'ab"c', quoteChar: QuoteCharSingleQuote, expected: 'ab"c' },
    { s: "ab`c", quoteChar: QuoteCharBacktick, expected: "ab\\`c" },
    { s: "abc", quoteChar: QuoteCharDoubleQuote, expected: "ab\\u008Fc" },
    { s: "𝟘𝟙", quoteChar: QuoteCharDoubleQuote, expected: "\\uD835\\uDFD8\\uD835\\uDFD9" },
    { s: "\uFEFF", quoteChar: QuoteCharDoubleQuote, expected: "\\uFEFF" },
  ];
  for (let i = 0; i < data.length; i++) {
    const rec = data[i]!;
    assert.equal(escapeNonAsciiString(rec.s, rec.quoteChar), rec.expected, `[${i}] escapeNonAsciiString(${JSON.stringify(rec.s)}, ${rec.quoteChar})`);
  }
});

test("EscapeJsxAttributeString", () => {
  const data: Array<{ s: string; quoteChar: QuoteChar; expected: string }> = [
    { s: "", quoteChar: QuoteCharDoubleQuote, expected: "" },
    { s: "abc", quoteChar: QuoteCharDoubleQuote, expected: "abc" },
    { s: 'ab"c', quoteChar: QuoteCharDoubleQuote, expected: "ab&quot;c" },
    { s: "ab\tc", quoteChar: QuoteCharDoubleQuote, expected: "ab&#x9;c" },
    { s: "ab\nc", quoteChar: QuoteCharDoubleQuote, expected: "ab&#xA;c" },
    { s: "ab'c", quoteChar: QuoteCharDoubleQuote, expected: "ab'c" },
    { s: "ab'c", quoteChar: QuoteCharSingleQuote, expected: "ab&apos;c" },
    { s: 'ab"c', quoteChar: QuoteCharSingleQuote, expected: 'ab"c' },
    { s: "abc", quoteChar: QuoteCharDoubleQuote, expected: "abc" },
    { s: "𝟘𝟙", quoteChar: QuoteCharDoubleQuote, expected: "𝟘𝟙" },
  ];
  for (let i = 0; i < data.length; i++) {
    const rec = data[i]!;
    assert.equal(escapeJsxAttributeString(rec.s, rec.quoteChar), rec.expected, `[${i}] escapeJsxAttributeString(${JSON.stringify(rec.s)}, ${rec.quoteChar})`);
  }
});

test("IsRecognizedTripleSlashComment", () => {
  const utf8Encoder = new globalThis.TextEncoder();
  const data: Array<{ s: string; kind?: Kind; expected: bool }> = [
    { s: "", kind: KindMultiLineCommentTrivia, expected: false },
    { s: "", kind: KindSingleLineCommentTrivia, expected: false },
    { s: "/a", expected: false },
    { s: "//", expected: false },
    { s: "//a", expected: false },
    { s: "///", expected: false },
    { s: "///a", expected: false },
    { s: '///<reference path="foo" />', expected: true },
    { s: '///<reference types="foo" />', expected: true },
    { s: '///<reference lib="foo" />', expected: true },
    { s: '///<reference no-default-lib="foo" />', expected: true },
    { s: '///<amd-dependency path="foo" />', expected: true },
    { s: "///<amd-module />", expected: true },
    { s: '/// <reference path="foo" />', expected: true },
    { s: '/// <reference types="foo" />', expected: true },
    { s: '/// <reference lib="foo" />', expected: true },
    { s: '/// <reference no-default-lib="foo" />', expected: true },
    { s: '/// <amd-dependency path="foo" />', expected: true },
    { s: "/// <amd-module />", expected: true },
    { s: '/// <reference path="foo"/>', expected: true },
    { s: '/// <reference types="foo"/>', expected: true },
    { s: '/// <reference lib="foo"/>', expected: true },
    { s: '/// <reference no-default-lib="foo"/>', expected: true },
    { s: '/// <amd-dependency path="foo"/>', expected: true },
    { s: "/// <amd-module/>", expected: true },
    { s: "/// <reference path='foo' />", expected: true },
    { s: "/// <reference types='foo' />", expected: true },
    { s: "/// <reference lib='foo' />", expected: true },
    { s: "/// <reference no-default-lib='foo' />", expected: true },
    { s: "/// <amd-dependency path='foo' />", expected: true },
    { s: '/// <reference path="foo" />  ', expected: true },
    { s: '/// <reference types="foo" />  ', expected: true },
    { s: '/// <reference lib="foo" />  ', expected: true },
    { s: '/// <reference no-default-lib="foo" />  ', expected: true },
    { s: '/// <amd-dependency path="foo" />  ', expected: true },
    { s: "/// <amd-module />  ", expected: true },
    { s: "/// <foo />", expected: false },
    { s: "/// <reference />", expected: false },
    { s: "/// <amd-dependency />", expected: false },
  ];
  for (let i = 0; i < data.length; i++) {
    const rec = data[i]!;
    // Go: when the table leaves Kind zero (KindUnknown), the runner fills in a
    // single-line comment kind and a TextRange over len(s) (a byte length).
    let kind = rec.kind ?? KindUnknown;
    let range = NewTextRange(0, 0);
    if (kind === KindUnknown) {
      kind = KindSingleLineCommentTrivia;
      range = NewTextRange(0, utf8Encoder.encode(rec.s).length);
    }
    const commentRange = { ...range, Kind: kind, HasTrailingNewLine: false } as CommentRange;
    assert.equal(IsRecognizedTripleSlashComment(rec.s, commentRange), rec.expected, `[${i}] isRecognizedTripleSlashComment(${JSON.stringify(rec.s)})`);
  }
});
