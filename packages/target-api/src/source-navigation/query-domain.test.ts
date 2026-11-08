import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import { createSourceProgramNavigation } from "./navigation.js";
import { createSourceNodeInventory, createSourceSyntaxDomain } from "./node-inventory.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": 'import { value } from "./value.js"; export const result = value + 1;',
    "/src/value.ts": "export const value = 7;",
    "/src/native.d.ts": "export declare function external(): number;",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "query-domain program checks");
  const file = checked.getSourceFile("/src/index.ts")!;
  const native = checked.getSourceFile("/src/native.d.ts")!;
  const navigation = createSourceProgramNavigation(checked);
  const expression = navigation.nodes.find(node => checked.ast.is.IsBinaryExpression(node));
  assert.equal(expression !== undefined, true, "the original value expression exists");
  if (expression === undefined) throw new Error("Missing query-domain expression.");
  return { checked, file, native, navigation, expression };
}

test("node membership uses original syntax even when a copied node points at the same checked file", () => {
  const current = fixture();
  const foreign = fixture();
  const inventory = createSourceNodeInventory(current.checked, [current.file]);
  const copy: Node = { ...current.expression };
  assert.equal(current.checked.ast.getSourceFile(copy) === current.file, true, "the forged parent chain retains the local file");
  for (const node of [current.expression, current.file, current.native]) {
    assert.equal(inventory.contains(node), true, "original checked syntax is authenticated");
  }
  for (const node of [copy, foreign.expression, foreign.file]) {
    assert.equal(inventory.contains(node), false, "file spelling or copied fields never grant original-node membership");
  }
  assert.equal(inventory.contains(current.expression), true, "failed membership does not poison the original domain");
});

test("finite syntax domains authenticate actual parent-child identity rather than a copied file route", () => {
  const current = fixture();
  const copy: Node = { ...current.expression };
  const contains = createSourceSyntaxDomain(current.checked.ast, current.expression);
  assert.equal(contains(current.expression), true, "original syntax enters its exact file domain");
  assert.equal(contains(copy), false, "copying an original parent pointer is not an original child witness");
  assert.equal(createSourceSyntaxDomain(current.checked.ast, copy)(current.expression), false,
    "a forged query root cannot authorize other operands");
  assert.equal(contains(current.expression), true, "a rejected copy does not poison the original domain");
});

test("module queries authenticate checked file identity before warm memo lookup", () => {
  const current = fixture();
  const foreign = fixture();
  assert.equal(current.checked.ast.getFileName(current.file) === foreign.checked.ast.getFileName(foreign.file), true,
    "the two checked programs deliberately use the same file spelling");
  for (const query of [current.navigation.moduleDependencies, current.navigation.moduleReferences,
    current.navigation.moduleExports, current.navigation.moduleHasTopLevelAwait]) {
    const original = query(current.file);
    assert.equal(query(current.file) === original, true, "the original checked file keeps its memo identity");
    assert.throws(() => query(foreign.file), /exact checked source-file identity/u, "a warm path cannot authorize a foreign file");
    assert.equal(query(current.file) === original, true, "foreign rejection does not replace the original memo");
  }
});

test("value queries reject copied and foreign syntax before warm memo lookup", () => {
  const current = fixture();
  const foreign = fixture();
  const copy: Node = { ...current.expression };
  for (const query of [current.navigation.expressionValueFlow, current.navigation.expressionResultDisposition,
    current.navigation.expressionEffects]) {
    const original = query(current.expression);
    assert.equal(query(current.expression) === original, true, "the original expression retains its publication");
    for (const node of [copy, foreign.expression]) {
      assert.throws(() => query(node), /original checked node/u, "copied fields or equal positions are not ownership");
    }
    assert.equal(query(current.expression) === original, true, "rejected syntax cannot poison the original result");
  }
});

test("callable roles and enclosing owners belong to the authenticated navigation view", () => {
  const current = fixture();
  const foreign = fixture();
  const copy: Node = { ...current.expression };
  const owner = current.navigation.enclosing(current.expression, "execution");
  assert.equal(owner === current.file, true, "module evaluation retains its exact original file owner");
  assert.equal(current.navigation.enclosing(current.expression, "execution") === owner, true, "enclosing memo retains original identity");
  assert.equal(current.navigation.callableRoles(current.file).execution, true, "module roles are published by their owner");
  for (const node of [copy, foreign.expression]) {
    assert.throws(() => current.navigation.enclosing(node, "execution"), /original checked node/u);
    assert.throws(() => current.navigation.callableRoles(node), /original checked node/u);
  }
  assert.equal(current.navigation.enclosing(current.expression, "execution") === owner, true, "foreign syntax never borrows a warm role");
});
