import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDiagnostics, providerVirtualDeclarationFactKey } from "@tsonic/tsts";
import { memoryOperationDeclarations, tsonicMemorySignatureIds } from "../declarations.js";
import { memoryDescriptorDeclarations } from "../descriptor-declarations.js";
import { tsonicMemoryFieldLayoutFactKey, tsonicMemoryLayoutFactKey } from "../facts.js";
import { readTsonicMemoryFieldLayout, readTsonicMemoryLayout, resolveTsonicMemoryLayoutObservation } from "../readers.js";
import {
  cleanMemorySession, memoryCall, memoryCalls, memoryDescriptorProperty, memorySession, memoryTestPrelude, valueMemoryLayout,
} from "./fixtures.js";

const recordDescriptor = "{ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] }";
const fieldDescriptor = "{ select: (header: Header) => header.count, byteoffset: 0, bytealignment: 4, fieldlayout: uint32Layout }";
const arrayDescriptor = "{ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, elementlayout: uint32Layout, length: 2 }";
const prelude = memoryTestPrelude + `
  import { memoryarraylayout } from "@tsonic/core/lang.js";
  interface Header { count: uint32 }
`;

test("each layout constructor has one exact required named descriptor signature", () => {
  const helpers = memoryDescriptorDeclarations();
  const declarations = memoryOperationDeclarations();
  for (const [operation, helper, keys, arguments_] of [
    ["memorylayout", "__TsonicMemoryLayoutDescriptor", ["datalayout", "bytesize", "bytealignment", "stride", "fields"], ["T"]],
    ["memoryarraylayout", "__TsonicMemoryArrayLayoutDescriptor", ["datalayout", "bytesize", "bytealignment", "stride", "elementlayout", "length"], ["T", "TLength"]],
    ["memoryfield", "__TsonicMemoryFieldDescriptor", ["select", "byteoffset", "bytealignment", "fieldlayout"], ["T", "TField"]],
  ] as const) {
    const declaration = declarations.find(entry => entry.name === operation);
    assert.ok(declaration);
    assert.equal(declaration.id, operation);
    assert.equal(declaration.signatures?.length, 1);
    const signature = declaration.signatures?.[0];
    assert.equal(signature?.id, tsonicMemorySignatureIds[operation]);
    assert.equal(signature?.id, `${operation}<${arguments_.join(",")}>(descriptor)`);
    assert.deepEqual(signature?.parameters, [{ name: "descriptor", type: {
      kind: "provider-ref", moduleSpecifier: "@tsonic/core/lang.js", exportName: helper,
      typeArguments: arguments_.map(name => ({ kind: "type-parameter", name })),
    } }]);
    const descriptor = helpers.find(entry => entry.name === helper);
    assert.deepEqual(descriptor?.members?.map(member => member.name), keys);
    for (const member of descriptor?.members ?? []) {
      assert.equal(member.kind, "property");
      assert.equal(member.readonly, true);
      assert.equal(member.optional, undefined);
    }
  }
});

test("named descriptors preserve authored operand nodes, exact selectors and independent array strides", () => {
  const checked = cleanMemorySession(`
    import { memoryarraylayout } from "@tsonic/core/lang.js";
    interface Header { count: uint32 }
    const countField = memoryfield<Header, uint32>({
      fieldlayout: uint32Layout, bytealignment: 4, byteoffset: 4, select: header => header.count,
    });
    const headerLayout = memorylayout<Header>({
      fields: [countField], stride: 12, bytealignment: 4, bytesize: 8, datalayout: abi,
    });
    const entries = memoryarraylayout({
      length: 2, elementlayout: headerLayout, stride: 24, bytealignment: 4, bytesize: 20, datalayout: abi,
    });
    sizeof(entries); strideof(entries); fieldoffsetof(headerLayout, header => header.count);
  `);
  const fieldCall = memoryCall(checked, "memoryfield");
  const layoutCall = memoryCall(checked, "memorylayout", 1);
  const arrayCall = memoryCall(checked, "memoryarraylayout");
  const field = readTsonicMemoryFieldLayout(checked.sourceFacts, fieldCall);
  const layout = valueMemoryLayout(readTsonicMemoryLayout(checked.sourceFacts, layoutCall));
  const array = readTsonicMemoryLayout(checked.sourceFacts, arrayCall);
  assert.ok(field && array?.kind === "array");
  assert.equal(field.selector, memoryDescriptorProperty(checked, fieldCall, "select"));
  assert.equal(field.fieldLayoutExpression, memoryDescriptorProperty(checked, fieldCall, "fieldlayout"));
  assert.equal(field.byteOffset, 4);
  assert.equal(checked.ast.text(checked.ast.name(field.selectedDeclaration)), "count");
  assert.ok(layout.fields[0] && tsonicMemoryFieldLayoutFactKey.equals(layout.fields[0], field));
  assert.equal(layout.dataLayoutExpression, memoryDescriptorProperty(checked, layoutCall, "datalayout"));
  assert.equal(array.elementLayoutExpression, memoryDescriptorProperty(checked, arrayCall, "elementlayout"));
  assert.equal(array.fixedArray.length, 2n);
  assert.equal(array.fixedArray.lengthRuntimeBase, "number");
  assert.equal(array.elementLayout.stride, 12);
  assert.equal(array.byteSize, 20);
  assert.equal(array.stride, 24);
  for (const [name, expected] of [["sizeof", 20], ["strideof", 24], ["fieldoffsetof", 4]] as const) {
    const observation = resolveTsonicMemoryLayoutObservation(checked.sourceFacts, memoryCall(checked, name));
    assert.ok(observation?.kind === "resolved");
    assert.equal(observation.value, expected);
  }
  assert.ok(Object.isFrozen(layout.fields) && Object.isFrozen(field) && Object.isFrozen(array));
});

test("alias and namespace constructor calls retain canonical provider identities and immutable value aliases", () => {
  const checked = cleanMemorySession(`
    import { memorylayout as memoryLayout, memoryfield as memoryField, memoryarraylayout as memoryArrayLayout } from "@tsonic/core/lang.js";
    import * as core from "@tsonic/core/lang.js";
    interface Header { count: uint32 }
    const abiAlias = abi;
    const childAlias = uint32Layout;
    const countField = memoryField({ select: (header: Header) => header.count, byteoffset: 0, bytealignment: 4, fieldlayout: childAlias });
    const fieldAlias = countField;
    const first = memoryLayout<Header>({ datalayout: abiAlias, bytesize: 4, bytealignment: 4, stride: 4, fields: [fieldAlias] });
    core.memorylayout<Header>({ datalayout: abiAlias, bytesize: 4, bytealignment: 4, stride: 4,
      fields: [core.memoryfield({ select: header => header.count, byteoffset: 0, bytealignment: 4, fieldlayout: childAlias })] });
    memoryArrayLayout({ datalayout: abiAlias, bytesize: 8, bytealignment: 4, stride: 8, elementlayout: first, length: 2 });
    core.memoryarraylayout({ datalayout: abiAlias, bytesize: 8, bytealignment: 4, stride: 8, elementlayout: first, length: 2 });
  `);
  const source = checked.getSourceFile("/src/index.ts");
  assert.ok(source);
  const queries = checked.getSourceFileQueries(source);
  for (const [authored, exported, index] of [
    ["memoryLayout", "memorylayout", 0], ["memoryField", "memoryfield", 0], ["memoryArrayLayout", "memoryarraylayout", 0],
    ["memorylayout", "memorylayout", 1], ["memoryfield", "memoryfield", 0], ["memoryarraylayout", "memoryarraylayout", 0],
  ] as const) {
    const call = memoryCall(checked, authored, index);
    const selected = queries.checker.getResolvedCallInfo(call);
    assert.ok(selected?.outcome === "applicable");
    const declaration = queries.checker.getSignatureDeclaration(selected.selectedSignature);
    const identity = checked.sourceFacts.getFact(declaration, providerVirtualDeclarationFactKey);
    assert.equal(identity?.exportId, exported);
    assert.equal(identity?.signatureId, tsonicMemorySignatureIds[exported]);
    assert.ok(exported === "memoryfield" ? readTsonicMemoryFieldLayout(checked.sourceFacts, call)
      : readTsonicMemoryLayout(checked.sourceFacts, call));
  }
});

test("quoted keys and shorthand leaf values use the same exact named schema", () => {
  const checked = cleanMemorySession(`
    import { memoryarraylayout } from "@tsonic/core/lang.js";
    const datalayout = abi;
    const bytesize = 4;
    const bytealignment = 4;
    const stride = 4;
    const fieldlayout = uint32Layout;
    const byteoffset = 0;
    interface Header { count: uint32 }
    const field = memoryfield({ "select": (header: Header) => header.count, byteoffset, bytealignment, fieldlayout });
    const elementlayout = memorylayout<Header>(({ datalayout, bytesize, bytealignment, stride, "fields": [field] }));
    const length = 1n;
    memoryarraylayout({ datalayout, bytesize, bytealignment, stride, elementlayout, length });
  `);
  const array = readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memoryarraylayout"));
  assert.ok(array?.kind === "array");
  assert.equal(array.fixedArray.length, 1n);
  assert.equal(array.fixedArray.lengthRuntimeBase, "bigint");
  assert.equal(array.elementLayout.byteSize, 4);
});

for (const [label, expression] of [
  ["positional value", "memorylayout<uint32>(abi, 4, 4, 4)"],
  ["positional field", "memoryfield((header: Header) => header.count, 0, 4, uint32Layout)"],
  ["positional array", "memoryarraylayout(abi, 8, 4, 8, uint32Layout, 2)"],
  ["quoted value", `memorylayout<uint32>(() => (${recordDescriptor}))`],
  ["quoted field", `memoryfield(() => (${fieldDescriptor}))`],
  ["quoted array", `memoryarraylayout(() => (${arrayDescriptor}))`],
  ["missing fields", "memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4 })"],
  ["missing field layout", "memoryfield({ select: (header: Header) => header.count, byteoffset: 0, bytealignment: 4 })"],
  ["missing array extent", "memoryarraylayout({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, elementlayout: uint32Layout })"],
  ["old record keys", "memorylayout<uint32>({ dataLayout: abi, byteSize: 4, byteAlignment: 4, stride: 4, fields: [] })"],
  ["old field keys", "memoryfield({ select: (header: Header) => header.count, byteOffset: 0, byteAlignment: 4, fieldLayout: uint32Layout })"],
  ["old array key", "memoryarraylayout({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, elementLayout: uint32Layout, length: 2 })"],
  ["unknown property", "memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [], extra: 1 })"],
  ["duplicate property", "memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytesize: 8, bytealignment: 4, stride: 4, fields: [] })"],
  ["field array hole", "memorylayout<Header>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [,] })"],
  ["string selector", "memoryfield<Header, uint32>({ select: 'count', byteoffset: 0, bytealignment: 4, fieldlayout: uint32Layout })"],
] as const) {
  test(`the public descriptor signature rejects ${label}`, () => {
    const checked = memorySession(prelude + expression);
    assert.ok(checked.diagnostics.filter(entry => entry !== undefined).length > 0);
    for (const name of ["memorylayout", "memoryfield", "memoryarraylayout"]) {
      const calls = memoryCalls(checked, name).slice(name === "memorylayout" ? 1 : 0);
      for (const call of calls) {
        assert.equal(readTsonicMemoryLayout(checked.sourceFacts, call), undefined);
        assert.equal(readTsonicMemoryFieldLayout(checked.sourceFacts, call), undefined);
      }
    }
  });
}

for (const [label, expression] of [
  ["spread", `memorylayout<uint32>({ ...${recordDescriptor} })`],
  ["computed key", 'memorylayout<uint32>({ datalayout: abi, ["bytesize"]: 4, bytealignment: 4, stride: 4, fields: [] })'],
  ["getter", "memorylayout<uint32>({ datalayout: abi, get bytesize() { throw 0; }, bytealignment: 4, stride: 4, fields: [] })"],
  ["stored record", `const descriptor = ${recordDescriptor}; memorylayout<uint32>(descriptor);`],
  ["mutated record", `const descriptor = ${recordDescriptor}; descriptor.bytesize = 8; memorylayout<uint32>(descriptor);`],
  ["mutated field", `const descriptor = ${fieldDescriptor}; descriptor.byteoffset = 4; memoryfield(descriptor);`],
  ["mutated array", `const descriptor = ${arrayDescriptor}; descriptor.length = 3; memoryarraylayout(descriptor);`],
  ["mutating call", `const descriptor = ${recordDescriptor}; function change() { descriptor.stride = 8; return descriptor; } memorylayout<uint32>(change());`],
] as const) {
  test(`descriptor source analysis rejects ${label} rather than following a mutable runtime object`, () => {
    const checked = memorySession(prelude + expression);
    const diagnostics = checked.diagnostics.filter(entry => entry !== undefined);
    assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics, "/src"));
    assert.deepEqual(checked.extensionDiagnostics.map(entry => entry.extensionCode), ["SOURCE_CORE_MEMORY_DESCRIPTOR_NOT_PROVEN"]);
    for (const name of ["memorylayout", "memoryfield", "memoryarraylayout"]) {
      for (const call of memoryCalls(checked, name).slice(name === "memorylayout" ? 1 : 0)) {
        assert.equal(checked.sourceFacts.getFact(call, tsonicMemoryLayoutFactKey), undefined);
        assert.equal(checked.sourceFacts.getFact(call, tsonicMemoryFieldLayoutFactKey), undefined);
      }
    }
  });
}

for (const [setup, fields] of [
  ["", "[...[]]"],
  ["const fields = []; fields.push(countField);", "fields"],
  ["const fields = [countField]; fields[0] = countField;", "fields"],
  ["const fields = [countField]; const alias = fields; alias.length = 0;", "fields"],
] as const) {
  test(`field collections require direct immutable metadata syntax: ${setup} ${fields}`, () => {
    const checked = memorySession(prelude + `
      const countField = memoryfield(${fieldDescriptor});
      ${setup}
      memorylayout<Header>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: ${fields} });
    `);
    assert.equal(checked.diagnostics.filter(entry => entry !== undefined).length, 0);
    assert.deepEqual(checked.extensionDiagnostics.map(entry => entry.extensionCode), ["SOURCE_CORE_MEMORY_DESCRIPTOR_FIELDS_NOT_PROVEN"]);
    assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memorylayout", 1)), undefined);
    assert.ok(readTsonicMemoryFieldLayout(checked.sourceFacts, memoryCall(checked, "memoryfield")));
  });
}

test("mutable aliases cannot replace finalized field or element layout identities", () => {
  const checked = memorySession(prelude + `
    const countField = memoryfield(${fieldDescriptor});
    let mutableField = countField;
    const aliasField = mutableField;
    memorylayout<Header>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [aliasField] });
    let mutableLayout = uint32Layout;
    const aliasLayout = mutableLayout;
    memoryarraylayout({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, elementlayout: aliasLayout, length: 2 });
  `);
  assert.equal(checked.diagnostics.filter(entry => entry !== undefined).length, 0);
  assert.deepEqual(checked.extensionDiagnostics.map(entry => entry.extensionCode), [
    "SOURCE_CORE_MEMORY_LAYOUT_FIELD_NOT_PROVEN", "SOURCE_CORE_MEMORY_ARRAY_ELEMENT_NOT_PROVEN",
  ]);
  assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memorylayout", 1)), undefined);
  assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memoryarraylayout")), undefined);
});

test("named shape alone does not turn same-spelled ordinary constructors into metadata", () => {
  const checked = cleanMemorySession(`
    function ordinary() {
      function memorylayout<T>(descriptor: T): T { return descriptor; }
      function memoryLayout<T>(descriptor: T): T { return descriptor; }
      memorylayout(${recordDescriptor});
      memoryLayout(${recordDescriptor});
    }
  `);
  assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memorylayout", 1)), undefined);
  assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memoryLayout")), undefined);
});
