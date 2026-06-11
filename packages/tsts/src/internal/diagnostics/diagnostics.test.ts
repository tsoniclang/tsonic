import { test } from "node:test";
import assert from "node:assert/strict";
import type { Tag } from "../../go/golang.org/x/text/language.js";
import { English, MustParse, Und } from "../../go/golang.org/x/text/language.js";
import { Identifier_expected, The_parser_expected_to_find_a_1_to_match_the_0_token_here, X_0_expected } from "./generated/messages.js";
import { Localize, Message_Localize } from "./diagnostics.js";

test("Message.Localize mirrors upstream localized diagnostic cases", () => {
  const cases: Array<{ name: string; locale: Tag; args?: string[]; expected: string }> = [
    {
      name: "english default",
      locale: English,
      expected: "Identifier expected.",
    },
    {
      name: "undefined locale uses english",
      locale: Und,
      expected: "Identifier expected.",
    },
    {
      name: "fallback to english for unknown locale",
      locale: MustParse("af-ZA"),
      expected: "Identifier expected.",
    },
    {
      name: "german",
      locale: MustParse("de-DE"),
      expected: "Es wurde ein Bezeichner erwartet.",
    },
    {
      name: "french",
      locale: MustParse("fr-FR"),
      expected: "Identificateur attendu.",
    },
    {
      name: "spanish",
      locale: MustParse("es-ES"),
      expected: "Se esperaba un identificador.",
    },
    {
      name: "japanese",
      locale: MustParse("ja-JP"),
      expected: "識別子が必要です。",
    },
    {
      name: "chinese simplified",
      locale: MustParse("zh-CN"),
      expected: "应为标识符。",
    },
    {
      name: "korean",
      locale: MustParse("ko-KR"),
      expected: "식별자가 필요합니다.",
    },
    {
      name: "russian",
      locale: MustParse("ru-RU"),
      expected: "Ожидался идентификатор.",
    },
  ];

  for (const testCase of cases) {
    assert.equal(Message_Localize(Identifier_expected, testCase.locale, ...(testCase.args ?? [])), testCase.expected, testCase.name);
  }
});

test("Message.Localize mirrors upstream placeholder formatting", () => {
  assert.equal(Message_Localize(X_0_expected, English, ")"), "')' expected.");
  assert.equal(
    Message_Localize(The_parser_expected_to_find_a_1_to_match_the_0_token_here, English, "{", "}"),
    "The parser expected to find a '}' to match the '{' token here.",
  );
  assert.equal(Message_Localize(X_0_expected, MustParse("de-DE"), ")"), "\")\" wurde erwartet.");
});

test("Localize by key mirrors upstream diagnostic lookup", () => {
  assert.equal(Localize(English, undefined, "Identifier_expected_1003"), "Identifier expected.");
  assert.equal(Localize(English, undefined, "_0_expected_1005", ")"), "')' expected.");
});
