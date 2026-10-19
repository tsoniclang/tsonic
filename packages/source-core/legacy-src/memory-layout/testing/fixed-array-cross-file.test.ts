import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "@tsonic/target-api/source";
import {
  createTsonicPointerBackingDemands, readTsonicMemoryType, readTsonicRawMemoryOperation,
  selectTsonicRawLocationOperation, tsonicMemoryLayoutFactKey,
} from "../../public/facts.js";
import { memoryCall, memoryCalls } from "./fixtures.js";
import {
  arrayMemoryLayout, arraySession, arrayTestPrelude, assertArrayObservation, cleanArraySession,
} from "./fixed-array-fixtures.js";

const sharedTypes = `
import type { FixedArray, uint32 } from "@tsonic/core/types.js";
export type Pair = FixedArray<uint32, 2>;
export type Matrix = FixedArray<Pair, 2>;
export interface Entry { first: uint32; second: uint32 }
export type Entries = FixedArray<Entry, 2>;
export interface Holder { items: Pair }
export interface EmptyValue {}
`;

function backingSession(local: string, remote: string, type: string) {
  const imports = 'import type { Pair, Matrix, Entry, Entries, Holder } from "./types.js";';
  const checked = cleanArraySession(`
    ${imports}
    import { selected as remote } from "./barrel.js";
    ${local}
    const alias = (remote);
    declare const value: ${type};
    const pointer = allocateptr<${type}>(value);
    torawptr(pointer, layout);
    torawptr(pointer, alias);
    const view = reinterpretrawptr(raw, alias);
    sizeof(layout); sizeof(alias);
  `, { extraFiles: {
    "/src/types.ts": sharedTypes,
    "/src/layout.ts": arrayTestPrelude + imports + remote + "\nexport { layout };",
    "/src/barrel.ts": 'export { layout as selected } from "./layout.js";',
  } });
  const source = createTargetSourceProgram(checked);
  const calls = memoryCalls(checked, "torawptr");
  assert.equal(calls.length, 2);
  const layouts = calls.map(call => {
    const selected = selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, call);
    assert.ok(selected?.kind === "resolved");
    return selected.layout;
  });
  return { checked, source, calls, layouts };
}

function wordArray(stride = 4): string {
  return `const child = memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: ${stride}, fields: [] });
    const layout = memoryarraylayout<uint32, 2>({ datalayout: abi, bytesize: 16, bytealignment: 4, stride: 16, elementlayout: child, length: 2 });`;
}

function recordArray(options: { readonly stride?: number; readonly offset?: number; readonly alignment?: number; readonly swapped?: boolean } = {}): string {
  return `const child = memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: ${options.stride ?? 4}, fields: [] });
    const entry = memorylayout<Entry>({
      datalayout: abi,
      bytesize: 16,
      bytealignment: 4,
      stride: 16,
      fields: [memoryfield({ select: (value: Entry) => value.${options.swapped ? "second" : "first"}, byteoffset: ${options.offset ?? 0}, bytealignment: ${options.alignment ?? 4}, fieldlayout: child }), memoryfield({ select: (value: Entry) => value.${options.swapped ? "first" : "second"}, byteoffset: 8, bytealignment: 4, fieldlayout: child })],
    });
    const layout = memoryarraylayout<Entry, 2>({ datalayout: abi, bytesize: 32, bytealignment: 4, stride: 32, elementlayout: entry, length: 2 });`;
}

function nestedArray(stride = 8): string {
  return `const row = memoryarraylayout<uint32, 2>({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: ${stride}, elementlayout: word, length: 2 });
    const layout = memoryarraylayout<Pair, 2>({ datalayout: abi, bytesize: 32, bytealignment: 4, stride: 32, elementlayout: row, length: 2 });`;
}

function recordOfArray(stride = 4): string {
  return `const child = memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: ${stride}, fields: [] });
    const row = memoryarraylayout({ datalayout: abi, bytesize: 12, bytealignment: 4, stride: 12, elementlayout: child, length: 2 });
    const layout = memorylayout<Holder>({
      datalayout: abi,
      bytesize: 20,
      bytealignment: 4,
      stride: 20,
      fields: [memoryfield({ select: (value: Holder) => value.items, byteoffset: 4, bytealignment: 4, fieldlayout: row })],
    });`;
}

for (const [name, declarations, type, size] of [
  ["array", wordArray(), "Pair", 16],
  ["array of record", recordArray(), "Entries", 32],
  ["nested array", nestedArray(), "Matrix", 32],
  ["record of array", recordOfArray(), "Holder", 20],
] as const) {
  test(`cross-file equivalent ${name} layouts reconcile one real pointer origin in either order`, () => {
    const { checked, source, calls, layouts } = backingSession(declarations, declarations, type);
    const first = readTsonicMemoryType(source.sourceFacts, layouts[0]!.call);
    const second = readTsonicMemoryType(source.sourceFacts, layouts[1]!.call);
    assert.ok(first && second);
    assert.equal(first.identity, second.identity);
    assert.notEqual(layouts[0]!.call, layouts[1]!.call);
    assert.equal(tsonicMemoryLayoutFactKey.equals(layouts[0]!, layouts[1]!), false);
    assertArrayObservation(checked, "sizeof", size);
    assertArrayObservation(checked, "sizeof", size, 1);
    const conversion = memoryCall(checked, "reinterpretrawptr");
    const operation = readTsonicRawMemoryOperation(source.sourceFacts, conversion);
    assert.ok(operation?.operation === "reinterpret");
    assert.equal(operation.explicitPointeeTypeNode, undefined);
    assert.ok(operation.pointeeType);
    const selected = selectTsonicRawLocationOperation(source.ast, source.sourceFacts, conversion);
    assert.ok(selected?.kind === "resolved");
    assert.equal(selected.layout.call, layouts[1]!.call);
    const operationType = readTsonicMemoryType(source.sourceFacts, conversion);
    assert.ok(operationType);
    assert.equal(operationType.sourceType, operation.pointeeType);
    assert.equal(second.sourceType, selected.layout.sourceType);
    assert.equal(operationType.identity, second.identity);
    if (name !== "record of array") assert.notEqual(operation.pointeeType, selected.layout.sourceType);
    assert.equal(operation.layoutExpression, source.ast.arguments(conversion)[1]);
    for (const order of [calls, [...calls].reverse()]) {
      const demands = createTsonicPointerBackingDemands(source);
      for (const call of order) { demands.record(call); demands.record(call); }
      assert.deepEqual(demands.issues(), []);
      assert.equal(demands.entries().length, 1);
      assert.equal(demands.entries()[0]!.origin.operation, "allocate");
    }
  });
}

for (const [name, local, remote, type] of [
  ["element stride", wordArray(), wordArray(8), "Pair"],
  ["nested record leaf stride", recordArray(), recordArray({ stride: 8 }), "Entries"],
  ["nested record field offset", recordArray(), recordArray({ offset: 4 }), "Entries"],
  ["nested record placement alignment", recordArray(), recordArray({ alignment: 2 }), "Entries"],
  ["nested record field identity", recordArray(), recordArray({ swapped: true }), "Entries"],
  ["nested array stride", nestedArray(), nestedArray(16), "Matrix"],
  ["record array child stride", recordOfArray(), recordOfArray(8), "Holder"],
] as const) {
  test(`cross-file ${name} conflicts survive identical outer dimensions`, () => {
    const { source, calls, layouts } = backingSession(local, remote, type);
    assert.equal(layouts[0]!.byteSize, layouts[1]!.byteSize);
    assert.equal(layouts[0]!.byteAlignment, layouts[1]!.byteAlignment);
    assert.equal(layouts[0]!.stride, layouts[1]!.stride);
    for (const order of [calls, [...calls].reverse()]) {
      const demands = createTsonicPointerBackingDemands(source);
      for (const call of order) demands.record(call);
      assert.equal(demands.entries().length, 1);
      assert.deepEqual(demands.issues().map(issue => issue.reason), ["One pointer origin has incompatible physical layout demands."]);
      assert.equal(demands.issues()[0]!.node, order[1]);
    }
  });
}

test("imported huge adjacent array counts remain distinct through aliases and inferred raw observations", () => {
  const checked = cleanArraySession(`
    import type { EmptyValue } from "./types.js";
    import { selected } from "./barrel.js";
    const leaf = memorylayout<EmptyValue>({ datalayout: abi, bytesize: 0, bytealignment: 4, stride: 0, fields: [] });
    const local = memoryarraylayout({ datalayout: abi, bytesize: 0, bytealignment: 4, stride: 0, elementlayout: leaf, length: 9007199254740992n });
    const alias = selected;
    sizeof(local); sizeof(alias);
    reinterpretrawptr(raw, local); reinterpretrawptr(raw, alias);
  `, { extraFiles: {
    "/src/types.ts": sharedTypes,
    "/src/layout.ts": arrayTestPrelude + `
      import type { EmptyValue } from "./types.js";
      const leaf = memorylayout<EmptyValue>({ datalayout: abi, bytesize: 0, bytealignment: 4, stride: 0, fields: [] });
      export const layout = memoryarraylayout({ datalayout: abi, bytesize: 0, bytealignment: 4, stride: 0, elementlayout: leaf, length: 9007199254740993n });
    `,
    "/src/barrel.ts": 'export { layout as selected } from "./layout.js";',
  } });
  const selections = memoryCalls(checked, "reinterpretrawptr").map(call => {
    const selected = selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, call);
    assert.ok(selected?.kind === "resolved");
    assert.ok(selected.operation.operation === "reinterpret");
    assert.equal(selected.operation.explicitPointeeTypeNode, undefined);
    return selected;
  });
  assert.equal(selections.length, 2);
  const lower = arrayMemoryLayout(selections[0]!.layout);
  const upper = arrayMemoryLayout(selections[1]!.layout);
  assert.equal(lower.fixedArray.length, 9007199254740992n);
  assert.equal(upper.fixedArray.length, 9007199254740993n);
  assert.notEqual(selections[0]!.memoryType, selections[1]!.memoryType);
  const lowerElement = readTsonicMemoryType(checked.sourceFacts, lower.elementLayout.call);
  const upperElement = readTsonicMemoryType(checked.sourceFacts, upper.elementLayout.call);
  assert.ok(lowerElement && upperElement);
  assert.equal(lowerElement.identity, upperElement.identity);
  assertArrayObservation(checked, "sizeof", 0);
  assertArrayObservation(checked, "sizeof", 0, 1);
});

test("an imported same-carrier signed array cannot replace an unsigned pointer pointee", () => {
  const checked = arraySession(`
    import type { Pair } from "./types.js";
    import { layout } from "./layout.js";
    declare const value: Pair;
    const pointer = allocateptr<Pair>(value);
    torawptr(pointer, layout);
    reinterpretrawptr<Pair>(raw, layout);
    sizeof(layout);
  `, { extraFiles: {
    "/src/types.ts": sharedTypes,
    "/src/layout.ts": arrayTestPrelude + `
      const signed = memorylayout<int32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });
      export const layout = memoryarraylayout<int32, 2>({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, elementlayout: signed, length: 2 });
    `,
  } });
  assert.equal(checked.diagnostics.filter(Boolean).length, 0);
  assert.equal(checked.extensionDiagnostics.filter(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_POINTEE_LAYOUT_NOT_PROVEN").length, 2);
  for (const name of ["torawptr", "reinterpretrawptr"]) {
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, name)), undefined);
  }
  assertArrayObservation(checked, "sizeof", 8);
});

test("a raw conversion cannot round an imported adjacent bigint array extent into its selected pointee", () => {
  const checked = arraySession(`
    import type { EmptyValue } from "./types.js";
    import { layout } from "./layout.js";
    reinterpretrawptr<FixedArray<EmptyValue, 9007199254740992n>>(raw, layout);
    sizeof(layout);
  `, { extraFiles: {
    "/src/types.ts": sharedTypes,
    "/src/layout.ts": arrayTestPrelude + `
      import type { EmptyValue } from "./types.js";
      const leaf = memorylayout<EmptyValue>({ datalayout: abi, bytesize: 0, bytealignment: 4, stride: 0, fields: [] });
      export const layout = memoryarraylayout({ datalayout: abi, bytesize: 0, bytealignment: 4, stride: 0, elementlayout: leaf, length: 9007199254740993n });
    `,
  } });
  assert.match(formatDiagnostics(checked.diagnostics.filter(entry => entry !== undefined), "/src"), /not assignable/u);
  assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "reinterpretrawptr")), undefined);
  assertArrayObservation(checked, "sizeof", 0);
});
