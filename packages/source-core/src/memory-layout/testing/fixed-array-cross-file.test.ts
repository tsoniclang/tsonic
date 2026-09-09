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
    const pointer = allocatePointer<${type}>(value);
    toRawPointer(pointer, layout);
    toRawPointer(pointer, alias);
    const view = reinterpretRawPointer(raw, alias);
    sizeOf(layout); sizeOf(alias);
  `, { extraFiles: {
    "/src/types.ts": sharedTypes,
    "/src/layout.ts": arrayTestPrelude + imports + remote + "\nexport { layout };",
    "/src/barrel.ts": 'export { layout as selected } from "./layout.js";',
  } });
  const source = createTargetSourceProgram(checked);
  const calls = memoryCalls(checked, "toRawPointer");
  assert.equal(calls.length, 2);
  const layouts = calls.map(call => {
    const selected = selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, call);
    assert.ok(selected?.kind === "resolved");
    return selected.layout;
  });
  return { checked, source, calls, layouts };
}

function wordArray(stride = 4): string {
  return `const child = memoryLayout<uint32>(abi, 4, 4, ${stride});
    const layout = memoryArrayLayout<uint32, 2>(abi, 16, 4, 16, child, 2);`;
}

function recordArray(options: { readonly stride?: number; readonly offset?: number; readonly alignment?: number; readonly swapped?: boolean } = {}): string {
  return `const child = memoryLayout<uint32>(abi, 4, 4, ${options.stride ?? 4});
    const entry = memoryLayout<Entry>(abi, 16, 4, 16,
      memoryField((value: Entry) => value.${options.swapped ? "second" : "first"}, ${options.offset ?? 0}, ${options.alignment ?? 4}, child),
      memoryField((value: Entry) => value.${options.swapped ? "first" : "second"}, 8, 4, child));
    const layout = memoryArrayLayout<Entry, 2>(abi, 32, 4, 32, entry, 2);`;
}

function nestedArray(stride = 8): string {
  return `const row = memoryArrayLayout<uint32, 2>(abi, 8, 4, ${stride}, word, 2);
    const layout = memoryArrayLayout<Pair, 2>(abi, 32, 4, 32, row, 2);`;
}

function recordOfArray(stride = 4): string {
  return `const child = memoryLayout<uint32>(abi, 4, 4, ${stride});
    const row = memoryArrayLayout(abi, 12, 4, 12, child, 2);
    const layout = memoryLayout<Holder>(abi, 20, 4, 20,
      memoryField((value: Holder) => value.items, 4, 4, row));`;
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
    assertArrayObservation(checked, "sizeOf", size);
    assertArrayObservation(checked, "sizeOf", size, 1);
    const conversion = memoryCall(checked, "reinterpretRawPointer");
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
    const leaf = memoryLayout<EmptyValue>(abi, 0, 4, 0);
    const local = memoryArrayLayout(abi, 0, 4, 0, leaf, 9007199254740992n);
    const alias = selected;
    sizeOf(local); sizeOf(alias);
    reinterpretRawPointer(raw, local); reinterpretRawPointer(raw, alias);
  `, { extraFiles: {
    "/src/types.ts": sharedTypes,
    "/src/layout.ts": arrayTestPrelude + `
      import type { EmptyValue } from "./types.js";
      const leaf = memoryLayout<EmptyValue>(abi, 0, 4, 0);
      export const layout = memoryArrayLayout(abi, 0, 4, 0, leaf, 9007199254740993n);
    `,
    "/src/barrel.ts": 'export { layout as selected } from "./layout.js";',
  } });
  const selections = memoryCalls(checked, "reinterpretRawPointer").map(call => {
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
  assertArrayObservation(checked, "sizeOf", 0);
  assertArrayObservation(checked, "sizeOf", 0, 1);
});

test("an imported same-carrier signed array cannot replace an unsigned pointer pointee", () => {
  const checked = arraySession(`
    import type { Pair } from "./types.js";
    import { layout } from "./layout.js";
    declare const value: Pair;
    const pointer = allocatePointer<Pair>(value);
    toRawPointer(pointer, layout);
    reinterpretRawPointer<Pair>(raw, layout);
    sizeOf(layout);
  `, { extraFiles: {
    "/src/types.ts": sharedTypes,
    "/src/layout.ts": arrayTestPrelude + `
      const signed = memoryLayout<int32>(abi, 4, 4, 4);
      export const layout = memoryArrayLayout<int32, 2>(abi, 8, 4, 8, signed, 2);
    `,
  } });
  assert.equal(checked.diagnostics.filter(Boolean).length, 0);
  assert.equal(checked.extensionDiagnostics.filter(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_POINTEE_LAYOUT_NOT_PROVEN").length, 2);
  for (const name of ["toRawPointer", "reinterpretRawPointer"]) {
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, name)), undefined);
  }
  assertArrayObservation(checked, "sizeOf", 8);
});

test("a raw conversion cannot round an imported adjacent bigint array extent into its selected pointee", () => {
  const checked = arraySession(`
    import type { EmptyValue } from "./types.js";
    import { layout } from "./layout.js";
    reinterpretRawPointer<FixedArray<EmptyValue, 9007199254740992n>>(raw, layout);
    sizeOf(layout);
  `, { extraFiles: {
    "/src/types.ts": sharedTypes,
    "/src/layout.ts": arrayTestPrelude + `
      import type { EmptyValue } from "./types.js";
      const leaf = memoryLayout<EmptyValue>(abi, 0, 4, 0);
      export const layout = memoryArrayLayout(abi, 0, 4, 0, leaf, 9007199254740993n);
    `,
  } });
  assert.match(formatDiagnostics(checked.diagnostics.filter(entry => entry !== undefined), "/src"), /not assignable/u);
  assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "reinterpretRawPointer")), undefined);
  assertArrayObservation(checked, "sizeOf", 0);
});
