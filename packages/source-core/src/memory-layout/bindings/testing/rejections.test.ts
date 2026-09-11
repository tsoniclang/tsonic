import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { tsonicMemoryFieldBindingFactKey, tsonicMemoryRecordBindingFactKey } from "../../../public/facts.js";
import { memoryCall, memorySession } from "../../testing/fixtures.js";
import { bindingPrelude } from "./fixtures.js";

for (const [name, body, code, marker] of [
  ["signed instead of unsigned field", `
    const pointer = allocatePointer<int32>(3);
    bindMemoryField(countField, pointer);
  `, "FIELD_BINDING_NOT_PROVEN", "bindMemoryField"],
  ["forged field metadata", `
    import type { MemoryFieldLayout } from "@tsonic/core/types.js";
    const field = {} as MemoryFieldLayout<Header>;
    bindMemoryField(field, allocatePointer<uint32>(3));
  `, "FIELD_BINDING_NOT_PROVEN", "bindMemoryField"],
  ["mutable field metadata", `
    let field = countField;
    bindMemoryField(field, allocatePointer<uint32>(3));
  `, "FIELD_BINDING_NOT_PROVEN", "bindMemoryField"],
  ["missing field", `
    bindMemoryRecord(headerLayout, bindMemoryField(countField, allocatePointer<uint32>(3)));
  `, "RECORD_BINDING_NOT_PROVEN", "bindMemoryRecord"],
  ["duplicated field", `
    const field = bindMemoryField(countField, allocatePointer<uint32>(3));
    bindMemoryRecord(headerLayout, field, field);
  `, "RECORD_FIELD_BINDINGS_NOT_PROVEN", "bindMemoryRecord"],
  ["extra field", `
    const field = bindMemoryField(countField, allocatePointer<uint32>(3));
    bindMemoryRecord(headerLayout, field, field, field);
  `, "RECORD_BINDING_NOT_PROVEN", "bindMemoryRecord"],
  ["same-shaped unrelated owner", `
    interface Other { count: uint32; tag: uint32 }
    const field = memoryField((value: Other) => value.count, 0, 4, word);
    bindMemoryRecord(headerLayout,
      bindMemoryField(field, allocatePointer<uint32>(3)), bindMemoryField(tagField, allocatePointer<uint32>(5)));
  `, "RECORD_FIELD_BINDINGS_NOT_PROVEN", "bindMemoryRecord"],
  ["mutable binding", `
    let count = bindMemoryField(countField, allocatePointer<uint32>(3));
    const tag = bindMemoryField(tagField, allocatePointer<uint32>(5));
    bindMemoryRecord(headerLayout, count, tag);
  `, "RECORD_FIELD_BINDINGS_NOT_PROVEN", "bindMemoryRecord"],
  ["forged binding", `
    import type { MemoryFieldBinding } from "@tsonic/core/types.js";
    const count = {} as MemoryFieldBinding<Header>;
    const tag = bindMemoryField(tagField, allocatePointer<uint32>(5));
    bindMemoryRecord(headerLayout, count, tag);
  `, "RECORD_FIELD_BINDINGS_NOT_PROVEN", "bindMemoryRecord"],
  ["incomplete source record", `
    const incomplete = memoryLayout<Header>(abi, 8, 4, 8, countField);
    bindMemoryRecord(incomplete, bindMemoryField(countField, allocatePointer<uint32>(3)));
  `, "RECORD_BINDING_NOT_PROVEN", "bindMemoryRecord"],
  ["scalar layout", "bindMemoryRecord(word);", "RECORD_BINDING_NOT_PROVEN", "bindMemoryRecord"],
  ["array layout", `
    const array = memoryArrayLayout(abi, 0, 4, 0, word, 0);
    bindMemoryRecord(array);
  `, "RECORD_BINDING_NOT_PROVEN", "bindMemoryRecord"],
] as const) {
  test(`memory bindings reject ${name}`, () => {
    const checked = memorySession(bindingPrelude + body);
    assert.equal(checked.diagnostics.filter(Boolean).length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"));
    assert.ok(checked.extensionDiagnostics.some(diagnostic => diagnostic.extensionCode === `SOURCE_CORE_MEMORY_${code}`),
      checked.extensionDiagnostics.map(diagnostic => `${diagnostic.extensionCode}: ${diagnostic.message}`).join("\n"));
    const call = memoryCall(checked, marker);
    if (marker === "bindMemoryField") assert.equal(checked.sourceFacts.getFact(call, tsonicMemoryFieldBindingFactKey), undefined);
    else assert.equal(checked.sourceFacts.getFact(call, tsonicMemoryRecordBindingFactKey), undefined);
    assert.ok(!checked.extensionDiagnostics.some(diagnostic => diagnostic.extensionCode === "ANALYZE_SOURCE_HOOK_FAILED"));
  });
}

test("nil field pointers and incompatible callbacks fail ordinary checking rather than acquire alias facts", () => {
  const checked = memorySession(bindingPrelude + "bindMemoryField(countField, undefined);");
  assert.ok(checked.diagnostics.filter(Boolean).length > 0);
  assert.equal(checked.sourceFacts.getFact(memoryCall(checked, "bindMemoryField"), tsonicMemoryFieldBindingFactKey), undefined);
});

test("same-spelled ordinary record helpers receive no memory binding facts", () => {
  const checked = memorySession(`
    function bindMemoryField(value: number) { return value; }
    function bindMemoryRecord(value: number) { return value; }
    bindMemoryRecord(bindMemoryField(3));
  `);
  assert.equal(checked.diagnostics.filter(Boolean).length, 0);
  assert.equal(checked.extensionDiagnostics.length, 0);
  assert.equal(checked.sourceFacts.getFact(memoryCall(checked, "bindMemoryField"), tsonicMemoryFieldBindingFactKey), undefined);
  assert.equal(checked.sourceFacts.getFact(memoryCall(checked, "bindMemoryRecord"), tsonicMemoryRecordBindingFactKey), undefined);
});
