import assert from "node:assert/strict";

import { test } from "node:test";

import { createTargetSourceProgram } from "@tsonic/target-api/source";

import { readTsonicMemoryLayout, readTsonicMemoryType, selectTsonicRawLocationOperation } from "../../public/facts.js";

import { resolveTsonicMemoryLayoutObservation } from "../readers.js";

import { assertMemoryDiagnostics, memoryCall, memoryCalls, memorySession } from "./fixtures.js";

import { createSourceSemanticsVirtualModuleProvider } from "../../extension/semantics-virtual-modules.js";

import { prelude, clean, identity } from "./cross-file-types-fixtures.js";

for (const [label, localType, otherType, aliases] of [
  ["direct", "Pointer<uint32> | undefined", "Pointer<uint32> | undefined", ""],
  ["reordered nullable union", "undefined | Pointer<uint32>", "Pointer<uint32> | undefined", ""],
  ["nested pointer", "Pointer<Pointer<uint32> | undefined> | undefined", "Pointer<Pointer<uint32> | undefined> | undefined", ""],
  ["closed generic alias", "Link<uint32>", "Pointer<uint32> | undefined", "type Link<Value> = Pointer<Value> | undefined;"],
  ["nested generic aliases", "Link<uint32>", "Pointer<Pointer<uint32> | undefined> | undefined", "type Inner<Value> = Pointer<Value> | undefined; type Link<Value> = Pointer<Inner<Value>> | undefined;"],
] as const){
test(`cross-file memory identity preserves ${label}`, () => {
    const checked = clean(`
      import { other } from "./other.js";
      ${aliases}
      const local = memorylayout<${localType}>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
      declare const slot: Pointer<${localType}>;
      export const view = reinterpretrawptr(torawptr(slot, local), other);
    `, { "/src/other.ts": prelude + `export const other = memorylayout<${otherType}>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });` });
    const conversion = memoryCall(checked, "reinterpretrawptr");
    const result = selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, conversion);
    assert.ok(result?.kind === "resolved");
    const local = memoryCall(checked, "memorylayout");
    assert.equal(identity(checked, local), identity(checked, result.layout.call));
    assert.equal(result.memoryType, identity(checked, local));
    assert.equal(result.memoryType, identity(checked, memoryCall(checked, "torawptr")));
    assert.equal(selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, conversion)?.kind, "resolved");
  });
}

test("the reported allocation/import reproduction retains each checker-local type and joins shared evidence", () => {
  const checked = clean(`
    import { other } from "./other.js";
    const local = memorylayout<Pointer<uint32> | undefined>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
    const slot = allocateptr<Pointer<uint32> | undefined>(allocateptr<uint32>(3));
    export const view = reinterpretrawptr(torawptr(slot, local), other);
  `, { "/src/other.ts": prelude + "export const other = memorylayout<Pointer<uint32> | undefined>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });" });
  const conversion = memoryCall(checked, "reinterpretrawptr");
  const result = selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, conversion);
  assert.ok(result?.kind === "resolved");
  const source = createTargetSourceProgram(checked);
  const selectedCall = source.semantics.forNode(conversion).operations.call(conversion);
  const operationType = readTsonicMemoryType(checked.sourceFacts, conversion);
  const layoutType = readTsonicMemoryType(checked.sourceFacts, result.layout.call);
  const selectedLayout = readTsonicMemoryLayout(checked.sourceFacts, result.operation.layoutExpression);
  assert.equal(result.operation.call === conversion, true, "the original checked conversion owns the pointee");
  assert.equal(result.operation.pointeeType === selectedCall?.sourceSelectedMethodTypeArguments?.[0]?.selectedType,
    true, "the original checked conversion supplies its exact pointee type");
  assert.equal(result.operation.layoutExpression === checked.ast.arguments(conversion)[1], true,
    "the original selected layout argument is retained");
  assert.equal(selectedLayout !== undefined && selectedLayout.call === result.layout.call, true,
    "the selected argument retains its original layout declaration");
  assert.equal(operationType?.sourceType === result.operation.pointeeType && layoutType?.sourceType === result.layout.sourceType,
    true, "each original checked site retains its own source type");
  assert.equal(operationType?.identity === layoutType?.identity && operationType?.identity === result.memoryType,
    true, "both checked selections share the same exact native memory identity");
  assert.equal(result.memoryType, identity(checked, result.layout.call));
});

test("import aliases, type aliases and reexports preserve one independently authored layout domain", () => {
  const checked = clean(`
    import type { Link } from "./barrel.js";
    import { selected as remote } from "./barrel.js";
    const local = memorylayout<Link>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
    const alias = remote;
    declare const raw: RawPointer | undefined;
    reinterpretrawptr(raw, alias);
  `, {
    "/src/barrel.ts": 'export { other as selected } from "./other.js"; export type { Link } from "./other.js";',
    "/src/other.ts": prelude + `type Alias = uint32; export type Link = Pointer<Alias> | undefined;
      export const other = memorylayout<Link>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });`,
  });
  const result = selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, memoryCall(checked, "reinterpretrawptr"));
  assert.ok(result?.kind === "resolved");
  assert.equal(identity(checked, memoryCall(checked, "memorylayout")), result.memoryType);
});

test("allocated, returned and raw-backed pointer values retain exact pointees through immutable aliases", () => {
  const checked = clean(`
    const word = memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });
    const allocated = allocateptr<uint32>(3);
    const alias = allocated;
    const raw = torawptr(alias, word);
    const view = reinterpretrawptr(raw, word);
    const viewAlias = view;
    torawptr(viewAlias, word);
    torawptr(reinterpretrawptr(raw, word), word);
    declare function external(): Pointer<uint32>;
    const returned = external();
    torawptr(returned, word);
  `);
  const expected = identity(checked, memoryCall(checked, "memorylayout"));
  for (const call of memoryCalls(checked, "torawptr")) {
    const selected = selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, call);
    assert.ok(selected?.kind === "resolved");
    assert.equal(selected.memoryType, expected);
  }
});

for (const [name, setup, expression] of [
  ["numeric array index", "const values: Pointer<uint32>[] = [allocateptr<uint32>(3)];", "values[0]"],
  ["shorthand field", "const pointer = allocateptr<uint32>(3); const holder = { pointer };", "holder.pointer"],
  ["conditional mutable binding", "let pointer = allocateptr<uint32>(3); pointer = allocateptr<uint32>(4);", "true ? pointer : undefined"],
  ["inferred default return", "function get(value: Pointer<uint32> = allocateptr<uint32>(3)) { return value; }", "get()"],
  ["generic return", "function identity<Value>(value: Pointer<Value>): Pointer<Value> { return value; }", "identity(allocateptr<uint32>(3))"],
] as const){
for (const signed of [false, true]){
test(`${name} preserves the pointee domain${signed ? " and rejects signed layout substitution" : ""}`, () => {
      const checked = memorySession(prelude + `
        const layout = memorylayout<${signed ? "int32" : "uint32"}>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });
        ${setup} torawptr(${expression}, layout);
      `);
      assert.equal(checked.diagnostics.filter(Boolean).length, 0);
      if (signed) {
        assert.ok(checked.extensionDiagnostics.some(value => value.extensionCode === "SOURCE_CORE_MEMORY_POINTEE_LAYOUT_NOT_PROVEN"));
      } else {
        assertMemoryDiagnostics(checked);
        const selected = selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, memoryCall(checked, "torawptr"));
        assert.ok(selected?.kind === "resolved");
        assert.equal(selected.memoryType, identity(checked, memoryCall(checked, "memorylayout")));
      }
    });
}
}

for (const primitive of ["uint32", "int32"] as const){
test(`retained provider ${primitive} fields are not reduced to their number annotation`, () => {
    const provider = createSourceSemanticsVirtualModuleProvider({
      id: "test.memory-fields", version: "1", displayName: "Memory fields", virtualDirectory: "memory-fields",
      modules: [{ moduleSpecifier: "test:fields", exports: [] }], evidenceMessage: "Exact memory field model",
      exportsForModule: () => [{ id: "field-owner", name: "Header", kind: "interface", members: [
        { id: "field-slot", name: "count", kind: "property", type: { kind: "source-primitive", name: primitive } },
      ] }],
    });
    const checked = memorySession(prelude + `
      import type { Header } from "test:fields";
      const word = memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });
      memorylayout<Header>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [memoryfield({ select: (value: Header) => value.count, byteoffset: 0, bytealignment: 4, fieldlayout: word })] });
    `, { extensions: [{ identity: { id: "test.memory-fields", version: "1" },
      initialize(context) { context.registerSourceDeclarationProvider(provider); } }] });
    assert.equal(checked.diagnostics.filter(Boolean).length, 0);
    if (primitive === "uint32") assertMemoryDiagnostics(checked);
    else assert.ok(checked.extensionDiagnostics.some(value => value.extensionCode === "SOURCE_CORE_MEMORY_FIELD_LAYOUT_NOT_PROVEN"));
  });
}

for (const [expression, pointee] of [
  ["torawptr(allocateptr<uint32>(3), word)", "RawPointer | undefined"],
  ["reinterpretrawptr(raw, word)", "Pointer<uint32> | undefined"],
] as const){
test(`inferred allocations preserve the complete raw-operation result: ${pointee}`, () => {
    const checked = clean(`
      const word = memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });
      declare const raw: RawPointer | undefined;
      const slot = allocateptr(${expression});
      const layout = memorylayout<${pointee}>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
      torawptr(slot, layout);
    `);
    const calls = memoryCalls(checked, "torawptr");
    assert.equal(selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, calls[calls.length - 1]!)?.kind, "resolved");
  });
}

test("closed generic array aliases preserve element markers without depending on their spelling", () => {
  const checked = clean(`
    type Items<Value> = Value[];
    memorylayout<Pointer<Items<uint32>>>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
    memorylayout<Pointer<uint32[]>>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
    memorylayout<Pointer<int32[]>>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
  `);
  const calls = memoryCalls(checked, "memorylayout");
  assert.equal(identity(checked, calls[0]!), identity(checked, calls[1]!));
  assert.notEqual(identity(checked, calls[0]!), identity(checked, calls[2]!));
});

test("cross-file aggregate and physical field joins use the same source-owned contracts", () => {
  const checked = clean(`
    import { word, count } from "./other.js";
    import type { Header } from "./other.js";
    const header = memorylayout<Header>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [count] });
    memoryfield({ select: (value: Header) => value.count, byteoffset: 0, bytealignment: 4, fieldlayout: word });
    sizeof(header);
  `, { "/src/other.ts": prelude + `
    export interface Header { count: uint32 }
    export const word = memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });
    export const count = memoryfield({ select: (value: Header) => value.count, byteoffset: 0, bytealignment: 4, fieldlayout: word });
  ` });
  assert.equal(resolveTsonicMemoryLayoutObservation(checked.sourceFacts, memoryCall(checked, "sizeof"))?.kind, "resolved");
});

test("nil conversions retain their explicitly selected pointee/layout contract", () => {
  const checked = clean(`const word = memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });
    torawptr<uint32>(undefined, word); reinterpretrawptr<uint32>(undefined, word);`);
  for (const name of ["torawptr", "reinterpretrawptr"]) {
    assert.equal(selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, memoryCall(checked, name))?.kind, "resolved");
  }
});
