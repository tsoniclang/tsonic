import assert from "node:assert/strict";
import { test } from "node:test";
import type { Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "@tsonic/target-api/source";
import { createTsonicMemoryMetadataIndex } from "../metadata-index.js";
import { cleanMemorySession, memoryCall } from "./fixtures.js";

function inspect(text: string) {
  const checked = cleanMemorySession(text);
  const source = createTargetSourceProgram(checked);
  const index = createTsonicMemoryMetadataIndex(source);
  function declaration(name: string): Node {
    const pending: Node[] = [checked.getSourceFile("/src/index.ts")!];
    while (pending.length > 0) {
      const node = pending.pop()!;
      if (source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === name) return node;
      for (const child of source.ast.children(node)) if (child !== undefined) pending.push(child);
    }
    throw new Error(`Missing declaration ${name}`);
  }
  return { checked, source, index, declaration };
}

test("memory metadata follows immutable aliases and exact query inputs", () => {
  const { checked, source, index, declaration } = inspect(`
    const alias = (uint32Layout);
    const size = sizeOf(alias);
    toRawPointer(ordinary, alias);
  `);
  for (const name of ["uint32Layout", "alias"]) {
    const selected = index.declaration(declaration(name));
    assert.equal(selected?.value.kind, "memory-layout");
    assert.deepEqual(selected?.issues, []);
    assert.equal(index.declaration(declaration(name)), selected);
    assert.ok(Object.isFrozen(selected));
  }
  assert.equal(index.declaration(declaration("size")), undefined);
  const arguments_ = source.ast.arguments(memoryCall(checked, "toRawPointer"));
  assert.equal(index.isCompileTimeExpression(arguments_[0]!), false);
  assert.equal(index.isCompileTimeExpression(arguments_[1]!), true);
  assert.equal(index.isCompileTimeExpression(memoryCall(checked, "memoryLayout")), true);
});

test("memory field selectors are metadata but their query result is a runtime value", () => {
  const { checked, index, declaration, source } = inspect(`
    interface Header { count: uint32 }
    const field = memoryField((value: Header) => value.count, 0, 4);
    const layout = memoryLayout<Header>(abi, 4, 4, 4, field);
    const offset = fieldOffsetOf(layout, value => value.count);
  `);
  assert.deepEqual(index.declaration(declaration("field"))?.issues, []);
  assert.deepEqual(index.declaration(declaration("layout"))?.issues, []);
  const query = memoryCall(checked, "fieldOffsetOf");
  assert.equal(index.isCompileTimeExpression(query), false);
  assert.equal(index.isCompileTimeExpression(source.ast.arguments(query)[1]!), true);
});

for (const [name, statement] of [
  ["return", "function escape() { return uint32Layout; }"],
  ["ordinary call", "function consume(value: MemoryLayout<uint32>) {} consume(uint32Layout);"],
  ["container", "const values = [uint32Layout];"],
  ["mutable alias", "let mutable = uint32Layout;"],
] as const) {
  test(`runtime ${name} cannot consume erased layout metadata`, () => {
    const { index, declaration } = inspect(statement);
    const selected = index.declaration(declaration("uint32Layout"));
    assert.equal(selected?.issues.length, 1);
    assert.match(selected!.issues[0]!.reason, /runtime value/u);
  });
}

test("same-spelled ordinary functions never become compile-time metadata", () => {
  const { index, declaration } = inspect(`
    function demo() {
      function memoryLayout(value: number): number { return value + 1; }
      const ordinaryLayout = memoryLayout(4);
      return ordinaryLayout;
    }
  `);
  assert.equal(index.declaration(declaration("ordinaryLayout")), undefined);
});

test("creating the metadata index does not walk or query an unrelated source program", () => {
  const { source } = inspect("const value = 1;");
  const forbidden = new Proxy(source, { get() { throw new Error("eager source query"); } });
  assert.throws(() => createTsonicMemoryMetadataIndex(forbidden), /eager source query/u);
  const index = createTsonicMemoryMetadataIndex({ ...source,
    ast: new Proxy(source.ast, { get() { throw new Error("eager AST query"); } }),
    sourceFacts: new Proxy(source.sourceFacts, { get() { throw new Error("eager fact query"); } }),
    navigation: new Proxy(source.navigation, { get() { throw new Error("eager navigation query"); } }),
  });
  assert.ok(Object.isFrozen(index));
});
