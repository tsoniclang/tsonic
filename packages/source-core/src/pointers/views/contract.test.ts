import assert from "node:assert/strict";
import { test } from "node:test";
import { createTargetSourceProgram } from "@tsonic/target-api/source";
import { formatDiagnostics, pointerOperationFactKey } from "@tsonic/tsts";
import type { ReadonlySourceFactResolver } from "@tsonic/tsts";
import { createTsonicPointerReturnQueries, selectTsonicPointerView, selectTsonicRawLocationOperation, tsonicPointerViewFactKey } from "../../public/facts.js";
import { assertMemoryDiagnostics, cleanMemorySession, memoryCall, memoryCalls, memorySession, memoryTestPrelude } from "../../memory-layout/testing/fixtures.js";

test("viewPointer retains exact read-free operands, generic pointees and both nil dispositions", () => {
  const checked = cleanMemorySession(`
    import { viewPointer as view, addressOf, allocatePointer } from "@tsonic/core/lang.js";
    import * as core from "@tsonic/core/lang.js";
    import type { FixedArray } from "@tsonic/core/types.js";
    function atEnd<Element>(values: Element[], empty: FixedArray<Element, 0>) {
      const position = addressOf(values[values.length]);
      return view(position, () => empty, replacement => { empty = replacement; });
    }
    const cell = allocatePointer<uint32>(3);
    const first = view(cell, (): uint32 => 7, (value: uint32) => {});
    const again = core.viewPointer(first, (): uint32 => 9, (value: uint32) => {});
    const nil = view<uint32, uint32>(undefined, () => 0, value => {});
    const optional = view(ordinary, (): uint32 => 0, (value: uint32) => {});
  `);
  const calls = [...memoryCalls(checked, "view"), ...memoryCalls(checked, "viewPointer")];
  assert.equal(calls.length, 5);
  let optional = 0;
  for (const call of calls) {
    const selected = selectTsonicPointerView(checked.ast, checked.sourceFacts, call);
    assert.ok(selected?.kind === "resolved");
    const operation = selected.operation;
    assert.deepEqual(checked.ast.arguments(call), [operation.pointerExpression, operation.readExpression, operation.writeExpression]);
    assert.ok(Object.isFrozen(operation));
    assert.equal(checked.sourceFacts.getFact(call, pointerOperationFactKey), undefined);
    optional += Number(operation.optional);
  }
  assert.equal(optional, 2);
  const end = checked.sourceFacts.getFact(memoryCall(checked, "addressOf"), pointerOperationFactKey);
  assert.ok(end?.operation === "address-of");
  assert.ok(checked.ast.is.IsElementAccessExpression(end.storageExpression));
});

test("views retain raw-layout and returned-pointee evidence through aliases and calls", () => {
  const checked = cleanMemorySession(`
    import { viewPointer, allocatePointer } from "@tsonic/core/lang.js";
    const cell = allocatePointer<uint32>(3);
    const view = viewPointer<uint32, uint32>(cell, () => 4, value => {});
    const alias = view;
    toRawPointer(alias, uint32Layout);
    const inferred = viewPointer(cell, (): uint32 => 4, (value: uint32) => {});
    toRawPointer(inferred, uint32Layout);
    function identity<T>(value: Pointer<T>): Pointer<T> { return value; }
    function expose() { return identity(viewPointer<uint32, uint32>(cell, () => 7, value => {})); }
  `);
  for (const call of memoryCalls(checked, "toRawPointer")) {
    assert.equal(selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, call)?.kind, "resolved");
  }
  const file = checked.getSourceFile("/src/index.ts")!;
  const declaration = checked.ast.statements(file).find(node => checked.ast.is.IsFunctionDeclaration(node) &&
    checked.ast.text(checked.ast.name(node)) === "expose")!;
  const result = createTsonicPointerReturnQueries(createTargetSourceProgram(checked)).resolve(declaration);
  assert.equal(result?.pointees.length, 1);
  assert.equal(result!.pointees[0]!.subject, memoryCall(checked, "viewPointer", 2));
});

test("ordinary forwarding functions and value projections do not acquire view semantics", () => {
  const checked = cleanMemorySession(`
    import { allocatePointer, projectPointer } from "@tsonic/core/lang.js";
    function viewPointer(value: number) { return value; }
    viewPointer(3);
    const cell = allocatePointer<uint32>(3);
    projectPointer<uint32, uint32>(cell, value => value, value => value);
  `);
  assert.equal(selectTsonicPointerView(checked.ast, checked.sourceFacts, memoryCall(checked, "viewPointer")), undefined);
  const call = memoryCall(checked, "projectPointer");
  assert.equal(selectTsonicPointerView(checked.ast, checked.sourceFacts, call), undefined);
  assert.equal(checked.sourceFacts.getFact(call, pointerOperationFactKey)?.operation, "project-pointer");
});

test("read-free views need no ABI registration or layout operation", () => {
  const checked = memorySession(`
    import type { Pointer } from "@tsonic/core/types.js";
    import { viewPointer } from "@tsonic/core/lang.js";
    function bind<From, To>(pointer: Pointer<From> | undefined, read: () => To, write: (value: To) => void) {
      return viewPointer(pointer, read, write);
    }
  `, { registrations: [] });
  assert.equal(checked.diagnostics.filter(Boolean).length, 0);
  assertMemoryDiagnostics(checked);
  assert.equal(selectTsonicPointerView(checked.ast, checked.sourceFacts, memoryCall(checked, "viewPointer"))?.kind, "resolved");
});

test("view callbacks must be typed and the selected overload must remain applicable", () => {
  const erased = memorySession(memoryTestPrelude + `
    import { viewPointer } from "@tsonic/core/lang.js";
    declare const read: any;
    viewPointer<uint32, uint32>(ordinary, read, value => {});
  `);
  assert.equal(erased.diagnostics.filter(Boolean).length, 0, formatDiagnostics(erased.diagnostics.filter(value => value !== undefined), "/src"));
  assert.ok(erased.extensionDiagnostics.some(diagnostic => diagnostic.extensionCode === "SOURCE_CORE_POINTER_VIEW_NOT_PROVEN"));
  assert.equal(erased.sourceFacts.getFact(memoryCall(erased, "viewPointer"), tsonicPointerViewFactKey), undefined);
  const invalid = memorySession(memoryTestPrelude + `
    import { viewPointer } from "@tsonic/core/lang.js";
    viewPointer<uint32, string>(ordinary, () => 0, (value: string) => {});
  `);
  assert.ok(invalid.diagnostics.filter(Boolean).length > 0);
  assert.equal(invalid.sourceFacts.getFact(memoryCall(invalid, "viewPointer"), tsonicPointerViewFactKey), undefined);
});

test("view snapshot and public reader reject relocated or substituted operands", () => {
  const checked = cleanMemorySession(`
    import { viewPointer } from "@tsonic/core/lang.js";
    viewPointer<uint32, uint32>(ordinary, () => 0, value => {});
  `);
  const call = memoryCall(checked, "viewPointer");
  const fact = checked.sourceFacts.getFact(call, tsonicPointerViewFactKey)!;
  assertMemoryDiagnostics(checked);
  for (const key of ["call", "pointerExpression", "readExpression", "writeExpression"] as const) {
    const replacement = { ...fact, [key]: memoryCall(checked, "memoryLayout") };
    const facts: ReadonlySourceFactResolver = {
      getFact(subject, factKey) {
        return subject === call && Object.is(factKey, tsonicPointerViewFactKey)
          ? replacement as never : checked.sourceFacts.getFact(subject, factKey);
      },
      getFacts: subject => checked.sourceFacts.getFacts(subject),
      getVirtualDeclarationDocument: name => checked.sourceFacts.getVirtualDeclarationDocument(name),
    };
    assert.equal(selectTsonicPointerView(checked.ast, facts, call)?.kind, "rejected", key);
  }
  assert.throws(() => tsonicPointerViewFactKey.snapshot({ ...fact, optional: "yes" } as never));
  assert.throws(() => tsonicPointerViewFactKey.snapshot({ ...fact, implicitLoad: true } as never));
  assert.throws(() => tsonicPointerViewFactKey.snapshot(Object.defineProperty({ ...fact }, "readExpression", {
    get() { assert.fail("Fact capture must not invoke an accessor."); },
  })));
  assert.ok(tsonicPointerViewFactKey.equals(fact, tsonicPointerViewFactKey.snapshot({ ...fact })));
  assert.ok(!tsonicPointerViewFactKey.equals(fact, { ...fact, optional: !fact.optional }));
});
