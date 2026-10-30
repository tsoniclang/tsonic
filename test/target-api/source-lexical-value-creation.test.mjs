import assert from "node:assert/strict";
import test from "node:test";
import * as sourceNavigation from "../../packages/target-api/dist/public/source.js";
import { createSourceProgramNavigation, sourceBindingScope, sourceLexicalCaptures } from "../../packages/target-api/dist/public/source.js";
import { checkedSource, namedDeclaration, projectSourceFile, requiredNode } from "../fixtures/source-navigation.mjs";

test("lexical value creation selects the deepest shared nonrepeated activation", async () => {
  const source = await checkedSource("lexical-value-activation", { "src/index.ts": `
    export function branch(flag: boolean): (() => number) | null {
      function next() { return 1; }
      if (flag) { const left = next; const right = next; return left === right ? left : null; }
      return null;
    }
    export function separated(flag: boolean): (() => number) | null {
      function next() { return 1; }
      if (flag) { const left = next; return left; }
      const right = next;
      return right;
    }
    export function deferred(flag: boolean): (() => () => number) | null {
      function next() { return 1; }
      if (flag) { const left = () => next; const right = () => next; return left; }
      return null;
    }
    export function forwarded(flag: boolean): (() => () => number) | null {
      function next() { return 1; }
      function read() { return next; }
      if (flag) { const left = read; const right = read; return left; }
      return null;
    }
  ` });
  const { ast } = source;
  const file = projectSourceFile(source, "src/index.ts");
  const navigation = createSourceProgramNavigation(source);
  for (const name of ["branch", "separated", "deferred", "forwarded"]) {
    const owner = namedDeclaration(ast, file, name);
    const next = requiredNode(ast, owner, node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === "next");
    const result = sourceLexicalCaptures(next, [next], ast, navigation, "source");
    assert.equal(sourceBindingScope(next, ast) === ast.body(owner), true,
      `${name}: approved C-1388 original declaration and lexical scope`);
    const branch = requiredNode(ast, owner, node => ast.is.IsIfStatement(node));
    const expected = name === "separated" ? branch : ast.statements(requiredNode(ast, branch, node => ast.is.IsBlock(node)))[0];
    assert.equal(ast.parent(expected) === (name === "separated" ? ast.body(owner)
      : requiredNode(ast, branch, node => ast.is.IsBlock(node))), true,
    `${name}: the original evaluated statement and its own branch remain unchanged`);
    assert.equal(result.captures.length, 0, `${name}: no captured state or allocation is invented`);
    const references = navigation.declarationUseSummary(next).uses.filter(use => use.kind === "first-class");
    assert.equal(references.length > 0 && references.every(use =>
      navigation.sourceReferenceFor(use.reference)?.declaration === next), true,
    `${name}: every original reference retains the same checked callable identity`);
    assert.equal("sourceLexicalFunctionValueCreation" in sourceNavigation, false,
      "the deleted caller-selected activation API is absent");
  }
});
