import assert from "node:assert/strict";
import test from "node:test";
import type {
  Node,
} from "@tsonic/tsts";
import {
  sourceCallableUsesLexicalThis,
} from "./lexical-this.js";

test("lexical-this selection enters arrows and stops at independent callables", () => {
  const directThis = node("KindThisKeyword");
  const arrowThis = node("KindThisKeyword");
  const nestedFunctionThis = node("KindThisKeyword");
  const method = node("KindMethodDeclaration", [
    node("KindBlock", [
      directThis,
      node("KindArrowFunction", [node("KindBlock", [arrowThis])]),
      node("KindFunctionExpression", [
        node("KindBlock", [nestedFunctionThis]),
      ]),
    ]),
  ]);

  assert.equal(sourceCallableUsesLexicalThis(ast(), method), true);
});

test("lexical-this selection ignores this owned by nested functions and classes", () => {
  const method = node("KindMethodDeclaration", [
    node("KindBlock", [
      node("KindFunctionExpression", [
        node("KindBlock", [node("KindThisKeyword")]),
      ]),
      node("KindClassDeclaration", [
        node("KindMethodDeclaration", [
          node("KindBlock", [node("KindThisKeyword")]),
        ]),
      ]),
    ]),
  ]);

  assert.equal(sourceCallableUsesLexicalThis(ast(), method), false);
});

function node(kind: string, children: readonly Node[] = []): Node {
  return { kind, children } as never;
}

function ast() {
  return {
    body(value: Node | undefined): Node | undefined {
      if (value === undefined) {
        return undefined;
      }
      return (value as never as { readonly children: readonly Node[] })
        .children[0];
    },
    children(value: Node | undefined): readonly Node[] {
      if (value === undefined) {
        return [];
      }
      return (value as never as { readonly children: readonly Node[] })
        .children;
    },
    kindName(value: Node | undefined): string {
      if (value === undefined) {
        return "KindUnknown";
      }
      return (value as never as { readonly kind: string }).kind;
    },
  };
}
