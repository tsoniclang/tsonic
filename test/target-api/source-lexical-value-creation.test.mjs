import assert from "node:assert/strict";
import test from "node:test";
import { createSourceProgramNavigation, sourceLexicalFunctionValueCreation } from "../../packages/target-api/dist/public/source.js";
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
    const result = sourceLexicalFunctionValueCreation(next, ast, navigation, () => true);
    assert.equal(result.kind, "resolved", name);
    const branch = requiredNode(ast, owner, node => ast.is.IsIfStatement(node));
    const expected = name === "separated" ? branch : ast.statements(requiredNode(ast, branch, node => ast.is.IsBlock(node)))[0];
    assert.equal(result.statement === expected, true, name);
    assert.equal(result.inlineReference === undefined, true, name);
  }
});
