import assert from "node:assert/strict";
import test from "node:test";
import { sourceStorageConstructedClass } from "../../packages/target-api/dist/target-analysis/source-storage/construction.js";

function fixture() {
  const selected = { kind: "class" };
  const reference = { declaration: selected };
  const alias = { kind: "variable", initializer: reference };
  const aliased = { declaration: alias };
  const invocation = { kind: "new", expression: aliased };
  const source = {
    ast: {
      is: {
        IsExpressionStatement: () => false, IsReturnStatement: () => false,
        IsThrowStatement: () => false, IsIfStatement: () => false,
        IsWhileStatement: () => false, IsDoStatement: () => false,
        IsForOfStatement: () => false, IsForInStatement: () => false,
        IsPropertyAccessExpression: () => false, IsElementAccessExpression: () => false,
        IsCallExpression: () => false,
        IsNewExpression: node => node.kind === "new",
        IsClassDeclaration: node => node.kind === "class",
        IsClassExpression: node => node.kind === "class-expression",
        IsVariableDeclaration: node => node.kind === "variable",
        IsParenthesizedExpression: node => node.kind === "parenthesized",
        IsAsExpression: () => false, IsSatisfiesExpression: () => false,
        IsNonNullExpression: () => false, IsTypeAssertion: () => false,
      },
      as: {
        AsNewExpression: node => ({ Expression: node.expression }),
        AsParenthesizedExpression: node => ({ Expression: node.expression }),
        AsVariableDeclaration: node => ({ Initializer: node.initializer }),
      },
    },
    navigation: {
      sourceReferenceFor: node => node.declaration === undefined ? undefined : { declaration: node.declaration },
      declarationUseSummary: node => ({ bindingWritten: node.mutable === true }),
      isProjectDeclaration: node => node === selected,
    },
  };
  return { selected, reference, alias, aliased, invocation, source };
}

test("construction storage follows exact immutable aliases without inferring identity from result types", () => {
  const value = fixture();
  assert.equal(sourceStorageConstructedClass(value.invocation, value.source, () => true) === value.selected, true);
  value.alias.initializer = { kind: "parenthesized", expression: value.reference };
  assert.equal(sourceStorageConstructedClass(value.invocation, value.source, () => true) === value.selected, true);
  value.alias.mutable = true;
  assert.equal(sourceStorageConstructedClass(value.invocation, value.source, () => true) === undefined, true,
    "a mutable constructor alias cannot select its initializer as its only origin");
});

test("construction storage rejects foreign, cyclic, missing and budget-exhausted identities", () => {
  const value = fixture();
  assert.equal(sourceStorageConstructedClass(value.invocation, value.source, () => false) === undefined, true);
  value.alias.initializer = value.aliased;
  assert.equal(sourceStorageConstructedClass(value.invocation, value.source, () => true) === undefined, true, "cycle");
  value.alias.initializer = { declaration: { kind: "class" } };
  assert.equal(sourceStorageConstructedClass(value.invocation, value.source, () => true) === undefined, true, "foreign class");
  value.alias.initializer = undefined;
  assert.equal(sourceStorageConstructedClass(value.invocation, value.source, () => true) === undefined, true, "absent initializer");
  value.alias.initializer = { declaration: { kind: "parameter" } };
  assert.equal(sourceStorageConstructedClass(value.invocation, value.source, () => true) === undefined, true,
    "a constructor parameter's result type is not its runtime identity");
  assert.equal(sourceStorageConstructedClass({ kind: "call" }, value.source, () => true) === undefined, true);
});
