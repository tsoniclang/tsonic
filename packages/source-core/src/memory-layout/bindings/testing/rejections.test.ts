import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { tsonicMemoryFieldBindingFactKey, tsonicMemoryRecordBindingFactKey } from "../../../public/facts.js";
import { memoryCall, memorySession } from "../../testing/fixtures.js";
import { bindingPrelude } from "./fixtures.js";

for (const [name, body, code, marker] of [
  ["signed instead of unsigned field", `
    const pointer = allocateptr<int32>(3);
    bindmemoryfield(countField, pointer);
  `, "FIELD_BINDING_NOT_PROVEN", "bindmemoryfield"],
  ["forged field metadata", `
    import type { MemoryFieldLayout } from "@tsonic/core/types.js";
    const field = {} as MemoryFieldLayout<Header>;
    bindmemoryfield(field, allocateptr<uint32>(3));
  `, "FIELD_BINDING_NOT_PROVEN", "bindmemoryfield"],
  ["mutable field metadata", `
    let field = countField;
    bindmemoryfield(field, allocateptr<uint32>(3));
  `, "FIELD_BINDING_NOT_PROVEN", "bindmemoryfield"],
  ["missing field", `
    bindmemoryrecord(headerLayout, bindmemoryfield(countField, allocateptr<uint32>(3)));
  `, "RECORD_BINDING_NOT_PROVEN", "bindmemoryrecord"],
  ["duplicated field", `
    const field = bindmemoryfield(countField, allocateptr<uint32>(3));
    bindmemoryrecord(headerLayout, field, field);
  `, "RECORD_FIELD_BINDINGS_NOT_PROVEN", "bindmemoryrecord"],
  ["extra field", `
    const field = bindmemoryfield(countField, allocateptr<uint32>(3));
    bindmemoryrecord(headerLayout, field, field, field);
  `, "RECORD_BINDING_NOT_PROVEN", "bindmemoryrecord"],
  ["same-shaped unrelated owner", `
    interface Other { count: uint32; tag: uint32 }
    const field = memoryfield({ select: (value: Other) => value.count, byteoffset: 0, bytealignment: 4, fieldlayout: word });
    bindmemoryrecord(headerLayout,
      bindmemoryfield(field, allocateptr<uint32>(3)), bindmemoryfield(tagField, allocateptr<uint32>(5)));
  `, "RECORD_FIELD_BINDINGS_NOT_PROVEN", "bindmemoryrecord"],
  ["mutable binding", `
    let count = bindmemoryfield(countField, allocateptr<uint32>(3));
    const tag = bindmemoryfield(tagField, allocateptr<uint32>(5));
    bindmemoryrecord(headerLayout, count, tag);
  `, "RECORD_FIELD_BINDINGS_NOT_PROVEN", "bindmemoryrecord"],
  ["forged binding", `
    import type { MemoryFieldBinding } from "@tsonic/core/types.js";
    const count = {} as MemoryFieldBinding<Header>;
    const tag = bindmemoryfield(tagField, allocateptr<uint32>(5));
    bindmemoryrecord(headerLayout, count, tag);
  `, "RECORD_FIELD_BINDINGS_NOT_PROVEN", "bindmemoryrecord"],
  ["incomplete source record", `
    const incomplete = memorylayout<Header>({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, fields: [countField] });
    bindmemoryrecord(incomplete, bindmemoryfield(countField, allocateptr<uint32>(3)));
  `, "RECORD_BINDING_NOT_PROVEN", "bindmemoryrecord"],
  ["scalar layout", "bindmemoryrecord(word);", "RECORD_BINDING_NOT_PROVEN", "bindmemoryrecord"],
  ["array layout", `
    const array = memoryarraylayout({ datalayout: abi, bytesize: 0, bytealignment: 4, stride: 0, elementlayout: word, length: 0 });
    bindmemoryrecord(array);
  `, "RECORD_BINDING_NOT_PROVEN", "bindmemoryrecord"],
] as const) {
  test(`memory bindings reject ${name}`, () => {
    const checked = memorySession(bindingPrelude + body);
    assert.equal(checked.diagnostics.filter(Boolean).length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"));
    assert.ok(checked.extensionDiagnostics.some(diagnostic => diagnostic.extensionCode === `SOURCE_CORE_MEMORY_${code}`),
      checked.extensionDiagnostics.map(diagnostic => `${diagnostic.extensionCode}: ${diagnostic.message}`).join("\n"));
    const call = memoryCall(checked, marker);
    if (marker === "bindmemoryfield") assert.equal(checked.sourceFacts.getFact(call, tsonicMemoryFieldBindingFactKey), undefined);
    else assert.equal(checked.sourceFacts.getFact(call, tsonicMemoryRecordBindingFactKey), undefined);
    assert.ok(!checked.extensionDiagnostics.some(diagnostic => diagnostic.extensionCode === "ANALYZE_SOURCE_HOOK_FAILED"));
  });
}

test("nil field pointers and incompatible callbacks fail ordinary checking rather than acquire alias facts", () => {
  const checked = memorySession(bindingPrelude + "bindmemoryfield(countField, undefined);");
  assert.ok(checked.diagnostics.filter(Boolean).length > 0);
  assert.equal(checked.sourceFacts.getFact(memoryCall(checked, "bindmemoryfield"), tsonicMemoryFieldBindingFactKey), undefined);
});

test("same-spelled ordinary record helpers receive no memory binding facts", () => {
  const checked = memorySession(`
    function bindmemoryfield(value: number) { return value; }
    function bindmemoryrecord(value: number) { return value; }
    bindmemoryrecord(bindmemoryfield(3));
  `);
  assert.equal(checked.diagnostics.filter(Boolean).length, 0);
  assert.equal(checked.extensionDiagnostics.length, 0);
  assert.equal(checked.sourceFacts.getFact(memoryCall(checked, "bindmemoryfield"), tsonicMemoryFieldBindingFactKey), undefined);
  assert.equal(checked.sourceFacts.getFact(memoryCall(checked, "bindmemoryrecord"), tsonicMemoryRecordBindingFactKey), undefined);
});
