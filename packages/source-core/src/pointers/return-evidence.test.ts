import assert from "node:assert/strict";
import { test } from "node:test";
import { sourcePrimitiveFactKey } from "@tsonic/tsts";
import { createTargetSourceProgram } from "@tsonic/target-api/source";
import { cleanMemorySession } from "../memory-layout/testing/fixtures.js";
import { createTsonicPointerReturnQueries } from "./return-evidence.js";

function inspect(body: string, maximumValues = 4096) {
  const checked = cleanMemorySession(`
    import { allocatePointer, addressOf } from "@tsonic/core/lang.js";
    ${body}
  `);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const declaration = checked.ast.statements(file).find(node => checked.ast.is.IsFunctionDeclaration(node) &&
    checked.ast.text(checked.ast.name(node)) === "expose");
  assert.ok(declaration);
  const queries = createTsonicPointerReturnQueries(createTargetSourceProgram(checked), maximumValues);
  return { checked, queries, declaration, result: queries.resolve(declaration) };
}

for (const [label, source, count, nullable] of [
  ["direct inferred raw call", "function expose() { return reinterpretRawPointer(raw, uint32Layout); }", 1, true],
  ["forward implementation", "function expose() { return later(); } function later() { return reinterpretRawPointer(raw, uint32Layout); }", 1, true],
  ["local alias", "function expose() { const pointer = reinterpretRawPointer(raw, uint32Layout); return pointer; }", 1, true],
  ["all local writes", "function expose() { let pointer = allocatePointer<uint32>(1); pointer = allocatePointer<uint32>(2); return pointer; }", 2, false],
  ["conditional alternatives", "function expose(flag: boolean) { return flag ? allocatePointer<uint32>(1) : allocatePointer<uint32>(2); }", 2, false],
  ["implicit fallthrough", "function expose(flag: boolean) { if (flag) return allocatePointer<uint32>(1); }", 1, true],
  ["annotated fallthrough", "function expose(flag: boolean): Pointer<uint32> | undefined { if (flag) return allocatePointer<uint32>(1); }", 1, true],
  ["bare return", "function expose(flag: boolean) { if (flag) return; return allocatePointer<uint32>(1); }", 1, true],
  ["annotated parameter", "function expose(pointer: Pointer<uint32> | undefined) { return pointer; }", 1, true],
  ["addressed parameter", "function expose(value: uint32) { return addressOf(value); }", 1, false],
  ["non-null narrowing", "function expose() { return reinterpretRawPointer(raw, uint32Layout)!; }", 1, false],
] as const) {
  test(`pointer return evidence retains ${label}`, () => {
    const { checked, result } = inspect(source);
    assert.ok(result);
    assert.equal(result.pointees.length, count);
    assert.equal(result.nullishTypes.length > 0, nullable);
    assert.ok(result.pointees.every(value => value.typeNode !== undefined &&
      checked.sourceFacts.getFact(value.typeNode, sourcePrimitiveFactKey)?.kind === "uint32"));
    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.pointees));
    assert.ok(result.pointees.every(Object.isFrozen));
  });
}

for (const [label, body, canFallThrough] of [
  ["loop completion", "while (flag) { return allocatePointer<uint32>(1); }", true],
  ["nonterminating alternative", "if (flag) return allocatePointer<uint32>(1); while (true) {}", false],
  ["exhaustive switch", "switch (flag) { case true: return allocatePointer<uint32>(1); case false: return allocatePointer<uint32>(2); }", false],
  ["labeled completion", "exit: { if (flag) break exit; return allocatePointer<uint32>(1); }", true],
] as const) {
  test(`pointer returns consume checker-selected ${label}`, () => {
    const { result, declaration } = inspect(`function expose(flag: boolean) { ${body} }`);
    assert.ok(result);
    assert.equal(result.completion.declaration, declaration);
    assert.equal(result.completion.canFallThrough, canFallThrough);
  });
}

test("pointer return evidence preserves conflicting primitive alternatives for target reconciliation", () => {
  const { checked, result } = inspect(`
    function expose(flag: boolean) {
      return flag ? allocatePointer<uint32>(1) : allocatePointer<int32>(2);
    }
  `);
  assert.ok(result);
  assert.deepEqual(result.pointees.map(value => checked.sourceFacts.getFact(value.typeNode, sourcePrimitiveFactKey)?.kind).sort(), ["int32", "uint32"]);
});

test("pointer return evidence excludes all nested callable and class return bodies", () => {
  const { result } = inspect(`
    function expose() {
      function nested() { return allocatePointer<int32>(2); }
      const arrow = () => allocatePointer<int32>(3);
      const literal = { method() { return allocatePointer<int32>(4); },
        get value() { return allocatePointer<int32>(5); } };
      class Nested { method() { return allocatePointer<int32>(6); } }
      return allocatePointer<uint32>(1);
    }
  `);
  assert.equal(result?.pointees.length, 1);
});

for (const [label, source] of [
  ["unknown source result", "declare function external(): Pointer<uint32>; function expose() { return external(); }"],
  ["unclosed generic result", "function generic<T>(value: Pointer<T>) { return value; } function expose(value: Pointer<uint32>) { return generic(value); }"],
  ["unrepresented return alternative", "function expose(flag: boolean) { return flag ? allocatePointer<uint32>(1) : 2; }"],
  ["unanchored alias cycle", "function expose() { let first; let second; first = second; second = first; return first; }"],
] as const) {
  test(`pointer return evidence does not guess ${label}`, () => {
    assert.equal(inspect(source).result, undefined);
  });
}

test("pointer return evidence never publishes a partial budget result", () => {
  assert.equal(inspect("function expose() { return allocatePointer<uint32>(1); }", 1).result, undefined);
  assert.throws(() => inspect("function expose() { return allocatePointer<uint32>(1); }", 0), /positive finite/u);
});

test("pointer return queries retain a compilation-owned immutable result", () => {
  const { queries, declaration, result } = inspect("function expose() { return allocatePointer<uint32>(1); }");
  assert.ok(result);
  assert.equal(queries.resolve(declaration), result);
  const separate = inspect("function expose() { return allocatePointer<uint32>(1); }");
  assert.notEqual(separate.result, result);
});
