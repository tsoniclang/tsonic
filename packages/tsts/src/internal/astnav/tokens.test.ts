// Mirror of internal/astnav/tokens_test.go — the self-contained regression
// subtests of TestGetTokenAtPosition ("JSDoc type assertion", "JSDoc type
// assertion with comment", "pointer equality"). The "baseline" subtests
// compare against Strada via jstest/NodeJS plus checked-in astnav baselines;
// they belong to the suite-side baseline gating and are not mirrored here.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { SourceFileParseOptions } from "../ast/parseoptions.js";
import { KindIdentifier, KindParenthesizedExpression } from "../ast/generated/kinds.js";
import { ScriptKindJS, ScriptKindTS } from "../core/scriptkind.js";
import { ParseSourceFile } from "../parser/parser/statements-declarations.js";
import { GetTokenAtPosition, GetTouchingPropertyName } from "./tokens.js";

test("GetTokenAtPosition / JSDoc type assertion", () => {
  const fileText = `function foo(x) {
    const s = /**@type {string}*/(x)
}`;
  const file = ParseSourceFile({ FileName: "/test.js", Path: "/test.js" } as SourceFileParseOptions, fileText, ScriptKindJS);

  // Position of 'x' inside the parenthesized expression (position 52)
  const position = 52;

  // This should not panic - it previously panicked with:
  // "did not expect KindParenthesizedExpression to have KindIdentifier in its trivia"
  const token = GetTouchingPropertyName(file, position);
  assert.ok(token !== undefined, "Expected to get a token, got nil");

  // The function may return either the identifier itself or the containing
  // parenthesized expression, depending on how the AST is structured
  assert.ok(
    token!.Kind === KindIdentifier || token!.Kind === KindParenthesizedExpression,
    `Expected identifier or parenthesized expression, got ${token!.Kind}`,
  );
});

test("GetTokenAtPosition / JSDoc type assertion with comment", () => {
  // Exact code from the issue report
  const fileText = `function foo(x) {
    const s = /**@type {string}*/(x)  // Go-to-definition on x causes panic
}`;
  const file = ParseSourceFile({ FileName: "/test.js", Path: "/test.js" } as SourceFileParseOptions, fileText, ScriptKindJS);

  // Find position of 'x' in the type assertion
  const xPos = 52; // Position of 'x' in (x)

  // This should not panic
  const token = GetTouchingPropertyName(file, xPos);
  assert.ok(token !== undefined, "Expected to get a token");
});

test("GetTokenAtPosition / pointer equality", () => {
  const fileText = `
			function foo() {
				return 0;
			}
		`;
  const file = ParseSourceFile({ FileName: "/file.ts", Path: "/file.ts" } as SourceFileParseOptions, fileText, ScriptKindTS);
  assert.strictEqual(GetTokenAtPosition(file, 0), GetTokenAtPosition(file, 0));
});
