import assert from "node:assert/strict";
import test from "node:test";

import {
  createSourceProgramNavigation,
} from "../../packages/target-api/dist/public/source.js";
import {
  isTypeSyntaxNode,
  referenceQueryNode,
} from "../../packages/target-api/dist/source-navigation/syntax.js";
import {
  checkedSource,
  projectSourceFile,
  requiredNode,
} from "../fixtures/source-navigation.mjs";

test("source navigation resolves exact authored type-query expressions", async () => {
  const checked = await checkedSource("type-query-navigation", {
    "src/index.ts": [
      'import * as api from "./api.js";',
      "const storage = { count: 1 };",
      "type RootStorage = typeof storage;",
      "type ImportedStorage = typeof api.storage;",
      "export function nested(): number {",
      "  const storage = { count: 2 };",
      "  type NestedStorage = typeof storage;",
      "  const selected: NestedStorage = storage;",
      "  return selected.count;",
      "}",
      "void storage;",
      "",
    ].join("\n"),
    "src/api.ts": "export const storage = { count: 3 };\n",
  });
  const { ast } = checked;
  const indexFile = projectSourceFile(checked, "src/index.ts");
  const apiFile = projectSourceFile(checked, "src/api.ts");
  const navigation = createSourceProgramNavigation(checked);
  const queries = allNodes(ast, indexFile, (node) => ast.is.IsTypeQueryNode(node));
  const rootQuery = requiredSelection(
    queries,
    (node) => !isWithinNamedFunction(ast, node, "nested") &&
      ast.text(referenceQueryNode(ast, node)) === "storage",
  );
  const importedQuery = requiredSelection(
    queries,
    (node) => ast.text(referenceQueryNode(ast, node)) === "api.storage",
  );
  const nestedQuery = requiredSelection(
    queries,
    (node) => isWithinNamedFunction(ast, node, "nested"),
  );
  const rootStorage = requiredNode(ast, indexFile, (node) =>
    ast.is.IsVariableDeclaration(node) &&
    ast.text(ast.name(node)) === "storage" &&
    !isWithinNamedFunction(ast, node, "nested"));
  const nestedStorage = requiredNode(ast, indexFile, (node) =>
    ast.is.IsVariableDeclaration(node) &&
    ast.text(ast.name(node)) === "storage" &&
    isWithinNamedFunction(ast, node, "nested"));
  const importedStorage = requiredNode(ast, apiFile, (node) =>
    ast.is.IsVariableDeclaration(node) && ast.text(ast.name(node)) === "storage");

  for (const query of queries) {
    assert.equal(isTypeSyntaxNode(ast, query), true);
    assert.equal(referenceQueryNode(ast, query), ast.as.AsTypeQueryNode(query)?.ExprName);
  }
  assert.equal(
    navigation.sourceReferenceFor(rootQuery)?.declaration,
    rootStorage,
  );
  assert.equal(
    navigation.sourceReferenceFor(nestedQuery)?.declaration,
    nestedStorage,
  );
  assert.equal(
    navigation.sourceReferenceFor(importedQuery)?.declaration,
    importedStorage,
  );
  assert.notEqual(
    navigation.sourceReferenceFor(rootQuery)?.declaration,
    navigation.sourceReferenceFor(nestedQuery)?.declaration,
  );
});

function allNodes(ast, root, predicate) {
  const selected = [];
  const pending = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) continue;
    if (predicate(node)) selected.push(node);
    pending.push(...ast.children(node));
  }
  return selected;
}

function requiredSelection(nodes, predicate) {
  const matches = nodes.filter(predicate);
  assert.equal(matches.length, 1);
  return matches[0];
}

function isWithinNamedFunction(ast, node, name) {
  let current = ast.parent(node);
  while (current !== undefined) {
    if (
      ast.is.IsFunctionDeclaration(current) &&
      ast.text(ast.name(current)) === name
    ) {
      return true;
    }
    current = ast.parent(current);
  }
  return false;
}
