import assert from "node:assert/strict";
import { test } from "node:test";
import { createTargetSourceProgram } from "@tsonic/target-api/source";
import { pointerOperationFactKey } from "@tsonic/tsts";
import { createTsonicMemoryMetadataIndex, readTsonicMemoryType, selectTsonicMemoryFieldBinding, selectTsonicMemoryRecordBinding,
  selectTsonicRawLocationOperation, tsonicMemoryFieldBindingFactKey, tsonicMemoryRecordBindingFactKey } from "../../../public/facts.js";
import { memoryCall, memoryCalls } from "../../testing/fixtures.js";
import { bindingPrelude, bindingSession, boundRecordSource } from "./fixtures.js";

test("bound record selects reordered fields and preserves already captured logical field operands", () => {
  const checked = bindingSession(boundRecordSource + `
    storeptr(before, 7);
    const observed = addressof(physical.count);
    equalptr(before, observed);
  `);
  const call = memoryCall(checked, "bindmemoryrecord");
  const selected = selectTsonicMemoryRecordBinding(checked.ast, checked.sourceFacts, call);
  assert.ok(selected?.kind === "resolved");
  const { operation } = selected;
  assert.equal(operation.fields.length, 2);
  assert.equal(operation.fields[0]!.binding.field.selectedDeclaration, operation.layout.fields[1]!.selectedDeclaration);
  assert.equal(operation.fields[1]!.binding.field.selectedDeclaration, operation.layout.fields[0]!.selectedDeclaration);
  assert.equal(checked.ast.text(operation.fields[1]!.binding.pointerExpression), "before");
  assert.equal(readTsonicMemoryType(checked.sourceFacts, call)?.identity,
    readTsonicMemoryType(checked.sourceFacts, operation.layout.call)?.identity);
  for (const entry of operation.fields) {
    assert.ok(Object.isFrozen(entry.binding));
    assert.equal(selectTsonicMemoryFieldBinding(checked.ast, checked.sourceFacts, entry.binding.call)?.kind, "resolved");
  }
});

test("layout metadata is erased only at its binding operand, never at the runtime binding or pointer", () => {
  const checked = bindingSession(boundRecordSource);
  const source = createTargetSourceProgram(checked);
  const index = createTsonicMemoryMetadataIndex(source);
  for (const name of ["bindmemoryfield", "bindmemoryrecord"]) {
    const call = memoryCall(checked, name);
    const args = checked.ast.arguments(call);
    assert.equal(index.isCompileTimeExpression(args[0]!), true);
    assert.equal(index.isCompileTimeExpression(args[1]!), false);
    assert.equal(index.isCompileTimeExpression(call), false);
    assert.equal(index.value(call), undefined);
  }
  const file = checked.getSourceFile("/src/index.ts")!;
  const visit = (node: typeof file): void => {
    if (checked.ast.is.IsVariableDeclaration(node)) assert.equal(index.declaration(node)?.issues.length ?? 0, 0);
    for (const child of checked.ast.children(node)) if (child !== undefined) visit(child as typeof file);
  };
  visit(file);
});

test("cross-file layouts, type aliases, inherited members and namespace binding imports retain exact identities", () => {
  const checked = bindingSession(`
    import type { ExternalHeader } from "./external.js";
    import { externalLayout, inheritedField } from "./external.js";
    import * as core from "@tsonic/core/lang.js";
    declare const pointer: Pointer<uint32>;
    const selected = core.bindmemoryfield(inheritedField, pointer);
    const record = core.bindmemoryrecord<ExternalHeader>(externalLayout, selected);
  `, {
    "/src/external.ts": bindingPrelude + `
      interface Base { value: uint32 }
      export interface ExternalHeader extends Base {}
      export const inheritedField = memoryfield({ select: (value: ExternalHeader) => value.value, byteoffset: 0, bytealignment: 4, fieldlayout: word });
      export const externalLayout = memorylayout<ExternalHeader>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [inheritedField] });
    `,
  });
  assert.equal(selectTsonicMemoryRecordBinding(checked.ast, checked.sourceFacts, memoryCall(checked, "bindmemoryrecord"))?.kind, "resolved");
});

test("field pointers may arrive through parameters, containers, aliases or exact generic returns", () => {
  const checked = bindingSession(`
    function identity<T>(value: Pointer<T>): Pointer<T> { return value; }
    function bind(pointer: Pointer<uint32>, holders: { value: Pointer<uint32> }[]) {
      const alias = identity(pointer);
      return bindmemoryrecord(headerLayout,
        bindmemoryfield(countField, alias), bindmemoryfield(tagField, holders[0].value));
    }
  `);
  for (const call of memoryCalls(checked, "bindmemoryfield")) {
    assert.equal(selectTsonicMemoryFieldBinding(checked.ast, checked.sourceFacts, call)?.kind, "resolved");
  }
});

test("nested bound record results retain exact domains and recursive field locations", () => {
  const checked = bindingSession(boundRecordSource + `
    interface Outer { header: Header }
    const header = memoryfield({ select: (value: Outer) => value.header, byteoffset: 0, bytealignment: 4, fieldlayout: headerLayout });
    const outerLayout = memorylayout<Outer>({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, fields: [header] });
    let physicalRoot = physical;
    let nested = bindmemoryrecord(outerLayout, bindmemoryfield(header, addressof(physicalRoot)));
    torawptr(addressof(nested), outerLayout);
    const nestedAlias = nested;
    addressof(nestedAlias.header.count);
  `);
  for (const call of memoryCalls(checked, "bindmemoryrecord")) {
    assert.equal(selectTsonicMemoryRecordBinding(checked.ast, checked.sourceFacts, call)?.kind, "resolved");
  }
  assert.equal(selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, memoryCall(checked, "torawptr"))?.kind, "resolved");
});

test("physical descriptor views explicitly bind fields while ordinary accessors remain ordinary locations", () => {
  const checked = bindingSession(`
    interface Descriptor { data: RawPointer | undefined; length: uint32 }
    interface Logical { text: string; count: uint32 }
    interface Physical { text: Descriptor; count: uint32 }
    const address = memorylayout<RawPointer | undefined>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
    const dataField = memoryfield({ select: (value: Descriptor) => value.data, byteoffset: 0, bytealignment: 8, fieldlayout: address });
    const lengthField = memoryfield({ select: (value: Descriptor) => value.length, byteoffset: 8, bytealignment: 4, fieldlayout: word });
    const descriptorLayout = memorylayout<Descriptor>({ datalayout: abi, bytesize: 16, bytealignment: 8, stride: 16, fields: [dataField, lengthField] });
    const textField = memoryfield({ select: (value: Physical) => value.text, byteoffset: 0, bytealignment: 8, fieldlayout: descriptorLayout });
    const physicalCount = memoryfield({ select: (value: Physical) => value.count, byteoffset: 16, bytealignment: 4, fieldlayout: word });
    const physicalLayout = memorylayout<Physical>({ datalayout: abi, bytesize: 24, bytealignment: 8, stride: 24, fields: [textField, physicalCount] });
    declare function encode(value: string): Descriptor;
    declare function decode(value: Descriptor): string;
    let logical: Logical = { text: "old", count: 2 };
    const originalCount = addressof(logical.count);
    const text = projectptr<string, Descriptor>(addressof(logical.text), encode, decode);
    const record = bindmemoryrecord(physicalLayout,
      bindmemoryfield(textField, text), bindmemoryfield(physicalCount, originalCount));
    const root = viewptr<Logical, Physical>(addressof(logical), () => record, next => {
      storeptr(text, next.text); storeptr(originalCount, next.count);
    });
    const raw = torawptr(root, physicalLayout);
    const restored = reinterpretrawptr(raw, physicalLayout);
    const ordinary = { get count() { return loadptr(originalCount); },
      set count(value: uint32) { storeptr(originalCount, value); } };
    addressof(ordinary.count);
  `);
  assert.equal(selectTsonicMemoryRecordBinding(checked.ast, checked.sourceFacts, memoryCall(checked, "bindmemoryrecord"))?.kind, "resolved");
  for (const name of ["torawptr", "reinterpretrawptr"]) {
    assert.equal(selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, memoryCall(checked, name))?.kind, "resolved");
  }
  const addresses = memoryCalls(checked, "addressof");
  const ordinary = addresses[addresses.length - 1]!;
  assert.equal(checked.sourceFacts.getFact(ordinary, pointerOperationFactKey)?.operation, "address-of");
  assert.equal(checked.sourceFacts.getFact(ordinary, tsonicMemoryFieldBindingFactKey), undefined);
  assert.equal(checked.sourceFacts.getFact(ordinary, tsonicMemoryRecordBindingFactKey), undefined);
});

test("zero-count and exact huge fixed-array children remain bounded recursive field layouts", () => {
  for (const length of ["0", "9007199254740993n"]) {
    const checked = bindingSession(`
      interface Empty {}
      interface Container { entries: FixedArray<Empty, ${length}> }
      const element = memorylayout<Empty>({ datalayout: abi, bytesize: 0, bytealignment: 1, stride: 0, fields: [] });
      const array = memoryarraylayout({ datalayout: abi, bytesize: 0, bytealignment: 1, stride: 0, elementlayout: element, length: ${length} });
      const entries = memoryfield({ select: (value: Container) => value.entries, byteoffset: 0, bytealignment: 1, fieldlayout: array });
      const layout = memorylayout<Container>({ datalayout: abi, bytesize: 0, bytealignment: 1, stride: 0, fields: [entries] });
      declare const pointer: Pointer<FixedArray<Empty, ${length}>>;
      const bound = bindmemoryrecord(layout, bindmemoryfield(entries, pointer));
      const empty = bindmemoryrecord(element);
    `);
    const selected = selectTsonicMemoryRecordBinding(checked.ast, checked.sourceFacts, memoryCall(checked, "bindmemoryrecord"));
    assert.ok(selected?.kind === "resolved");
    const array = selected.operation.fields[0]!.binding.field.fieldLayout;
    assert.ok(array.kind === "array");
    assert.equal(array.fixedArray.length, length === "0" ? 0n : 9007199254740993n);
    assert.equal(selectTsonicMemoryRecordBinding(checked.ast, checked.sourceFacts, memoryCall(checked, "bindmemoryrecord", 1))?.kind, "resolved");
  }
});
