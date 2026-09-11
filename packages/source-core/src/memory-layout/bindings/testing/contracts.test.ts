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
    storePointer(before, 7);
    const observed = addressOf(physical.count);
    equalPointer(before, observed);
  `);
  const call = memoryCall(checked, "bindMemoryRecord");
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
  for (const name of ["bindMemoryField", "bindMemoryRecord"]) {
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
    const selected = core.bindMemoryField(inheritedField, pointer);
    const record = core.bindMemoryRecord<ExternalHeader>(externalLayout, selected);
  `, {
    "/src/external.ts": bindingPrelude + `
      interface Base { value: uint32 }
      export interface ExternalHeader extends Base {}
      export const inheritedField = memoryField((value: ExternalHeader) => value.value, 0, 4, word);
      export const externalLayout = memoryLayout<ExternalHeader>(abi, 4, 4, 4, inheritedField);
    `,
  });
  assert.equal(selectTsonicMemoryRecordBinding(checked.ast, checked.sourceFacts, memoryCall(checked, "bindMemoryRecord"))?.kind, "resolved");
});

test("field pointers may arrive through parameters, containers, aliases or exact generic returns", () => {
  const checked = bindingSession(`
    function identity<T>(value: Pointer<T>): Pointer<T> { return value; }
    function bind(pointer: Pointer<uint32>, holders: { value: Pointer<uint32> }[]) {
      const alias = identity(pointer);
      return bindMemoryRecord(headerLayout,
        bindMemoryField(countField, alias), bindMemoryField(tagField, holders[0].value));
    }
  `);
  for (const call of memoryCalls(checked, "bindMemoryField")) {
    assert.equal(selectTsonicMemoryFieldBinding(checked.ast, checked.sourceFacts, call)?.kind, "resolved");
  }
});

test("nested bound record results retain exact domains and recursive field locations", () => {
  const checked = bindingSession(boundRecordSource + `
    interface Outer { header: Header }
    const header = memoryField((value: Outer) => value.header, 0, 4, headerLayout);
    const outerLayout = memoryLayout<Outer>(abi, 8, 4, 8, header);
    let physicalRoot = physical;
    let nested = bindMemoryRecord(outerLayout, bindMemoryField(header, addressOf(physicalRoot)));
    toRawPointer(addressOf(nested), outerLayout);
    const nestedAlias = nested;
    addressOf(nestedAlias.header.count);
  `);
  for (const call of memoryCalls(checked, "bindMemoryRecord")) {
    assert.equal(selectTsonicMemoryRecordBinding(checked.ast, checked.sourceFacts, call)?.kind, "resolved");
  }
  assert.equal(selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, memoryCall(checked, "toRawPointer"))?.kind, "resolved");
});

test("physical descriptor views explicitly bind fields while ordinary accessors remain ordinary locations", () => {
  const checked = bindingSession(`
    interface Descriptor { data: RawPointer | undefined; length: uint32 }
    interface Logical { text: string; count: uint32 }
    interface Physical { text: Descriptor; count: uint32 }
    const address = memoryLayout<RawPointer | undefined>(abi, 8, 8, 8);
    const dataField = memoryField((value: Descriptor) => value.data, 0, 8, address);
    const lengthField = memoryField((value: Descriptor) => value.length, 8, 4, word);
    const descriptorLayout = memoryLayout<Descriptor>(abi, 16, 8, 16, dataField, lengthField);
    const textField = memoryField((value: Physical) => value.text, 0, 8, descriptorLayout);
    const physicalCount = memoryField((value: Physical) => value.count, 16, 4, word);
    const physicalLayout = memoryLayout<Physical>(abi, 24, 8, 24, textField, physicalCount);
    declare function encode(value: string): Descriptor;
    declare function decode(value: Descriptor): string;
    let logical: Logical = { text: "old", count: 2 };
    const originalCount = addressOf(logical.count);
    const text = projectPointer<string, Descriptor>(addressOf(logical.text), encode, decode);
    const record = bindMemoryRecord(physicalLayout,
      bindMemoryField(textField, text), bindMemoryField(physicalCount, originalCount));
    const root = viewPointer<Logical, Physical>(addressOf(logical), () => record, next => {
      storePointer(text, next.text); storePointer(originalCount, next.count);
    });
    const raw = toRawPointer(root, physicalLayout);
    const restored = reinterpretRawPointer(raw, physicalLayout);
    const ordinary = { get count() { return loadPointer(originalCount); },
      set count(value: uint32) { storePointer(originalCount, value); } };
    addressOf(ordinary.count);
  `);
  assert.equal(selectTsonicMemoryRecordBinding(checked.ast, checked.sourceFacts, memoryCall(checked, "bindMemoryRecord"))?.kind, "resolved");
  for (const name of ["toRawPointer", "reinterpretRawPointer"]) {
    assert.equal(selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, memoryCall(checked, name))?.kind, "resolved");
  }
  const addresses = memoryCalls(checked, "addressOf");
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
      const element = memoryLayout<Empty>(abi, 0, 1, 0);
      const array = memoryArrayLayout(abi, 0, 1, 0, element, ${length});
      const entries = memoryField((value: Container) => value.entries, 0, 1, array);
      const layout = memoryLayout<Container>(abi, 0, 1, 0, entries);
      declare const pointer: Pointer<FixedArray<Empty, ${length}>>;
      const bound = bindMemoryRecord(layout, bindMemoryField(entries, pointer));
      const empty = bindMemoryRecord(element);
    `);
    const selected = selectTsonicMemoryRecordBinding(checked.ast, checked.sourceFacts, memoryCall(checked, "bindMemoryRecord"));
    assert.ok(selected?.kind === "resolved");
    const array = selected.operation.fields[0]!.binding.field.fieldLayout;
    assert.ok(array.kind === "array");
    assert.equal(array.fixedArray.length, length === "0" ? 0n : 9007199254740993n);
    assert.equal(selectTsonicMemoryRecordBinding(checked.ast, checked.sourceFacts, memoryCall(checked, "bindMemoryRecord", 1))?.kind, "resolved");
  }
});
