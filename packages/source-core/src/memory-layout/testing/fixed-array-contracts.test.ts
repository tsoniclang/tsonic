import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { createSourceSemanticsVirtualModuleProvider } from "../../public/extension.js";
import {
  countTsonicMemoryLayoutValues, readTsonicMemoryFieldLayout, readTsonicMemoryLayout,
  readTsonicMemoryType, resolveTsonicMemoryLayoutObservation, tsonicFixedArrayFactKey,
} from "../../public/facts.js";
import { memoryCall, memoryCalls, memoryTestRegistration, valueMemoryLayout } from "./fixtures.js";
import {
  arrayLayoutAt, arrayMemoryLayout, arrayProfileRegistration, arraySession,
  arrayTestProfiles, assertArrayObservation, cleanArraySession,
} from "./fixed-array-fixtures.js";

for (const profile of arrayTestProfiles) {
  test(`fixed-array physical composition preserves ${profile.byteOrder}-${profile.addressWidth} ABI evidence`, () => {
    const pointerSize = profile.addressWidth / 8;
    const registration = arrayProfileRegistration(profile);
    const checked = cleanArraySession(`
      const zero = memoryArrayLayout<uint32, 0>(abi, 0, 4, 0, word, 0);
      const one = memoryArrayLayout<uint32, 1>(abi, 4, 4, 4, word, 1);
      const pair = memoryArrayLayout(abi, 8, 4, 8, word, 2);
      const byte = memoryLayout<uint8>(abi, 1, 1, 1);
      interface Entry { tag: uint8; count: uint32 }
      const entry = memoryLayout<Entry>(abi, 8, 4, 8,
        memoryField((value: Entry) => value.tag, 0, 1, byte),
        memoryField((value: Entry) => value.count, 4, 4, word));
      const entries = memoryArrayLayout<Entry, 2>(abi, 16, 4, 16, entry, 2);
      const nested = memoryArrayLayout<FixedArray<uint32, 2>, 2>(abi, 16, 4, 16, pair, 2);
      const wide = memoryLayout<uint64>(abi, 8, ${profile.wideAlignment}, 8);
      const wides = memoryArrayLayout(abi, 16, ${profile.wideAlignment}, 16, wide, 2);
      const pointer = memoryLayout<Pointer<uint32> | undefined>(abi, ${pointerSize}, ${pointerSize}, ${pointerSize});
      const pointers = memoryArrayLayout(abi, ${pointerSize * 2}, ${pointerSize}, ${pointerSize * 2}, pointer, 2);
      const rawPointer = memoryLayout<RawPointer | undefined>(abi, ${pointerSize}, ${pointerSize}, ${pointerSize});
      const rawPointers = memoryArrayLayout(abi, ${pointerSize * 2}, ${pointerSize}, ${pointerSize * 2}, rawPointer, 2);
      interface Envelope { tag: uint8; values: FixedArray<Entry, 2>; tail: Empty }
      const envelope = memoryLayout<Envelope>(abi, 24, 4, 24,
        memoryField((value: Envelope) => value.tag, 0, 1, byte),
        memoryField((value: Envelope) => value.values, 4, 4, entries),
        memoryField((value: Envelope) => value.tail, 20, 4, empty));
      sizeOf(zero); sizeOf(one); sizeOf(pair); sizeOf(entries); sizeOf(nested);
      sizeOf(wides); sizeOf(pointers); sizeOf(rawPointers); sizeOf(envelope);
      alignOf(wides); strideOf(nested); fieldOffsetOf(envelope, value => value.values);
      fieldOffsetOf(envelope, value => value.tail);
    `, { registrations: [registration] });
    const sizes = [0, 4, 8, 16, 16, 16, pointerSize * 2, pointerSize * 2];
    for (const [index, size] of sizes.entries()) {
      const layout = arrayLayoutAt(checked, index);
      assert.equal(layout.fixedArray.length, BigInt(index < 2 ? index : 2));
      assert.equal(layout.fixedArray.lengthRuntimeBase, "number");
      assert.equal(layout.fixedArray.sourceType, layout.sourceType);
      assert.ok(layout.fixedArray.elementSourceType);
      assert.equal(layout.byteSize, size);
      assert.equal(layout.stride, size);
      assert.equal("fields" in layout, false);
      assert.equal("length" in layout, false);
      assert.equal(layout.elementLayoutExpression, checked.ast.arguments(layout.call)[4]);
      assert.equal(readTsonicMemoryLayout(checked.sourceFacts, layout.elementLayoutExpression)?.call, layout.elementLayout.call);
      assert.ok(tsonicFixedArrayFactKey.equals(layout.fixedArray,
        checked.sourceFacts.getFact(layout.call, tsonicFixedArrayFactKey)!));
      assert.deepEqual(layout.dataLayout, { providerDeclaration: registration.providerDeclaration, ...registration.descriptor });
      assertArrayObservation(checked, "sizeOf", size, index);
    }
    assert.deepEqual(valueMemoryLayout(arrayLayoutAt(checked, 3).elementLayout).fields.map(field => field.byteOffset), [0, 4]);
    assert.equal(arrayMemoryLayout(arrayLayoutAt(checked, 4).elementLayout).fixedArray.length, 2n);
    assert.equal(countTsonicMemoryLayoutValues(arrayLayoutAt(checked, 4), 3), 3);
    assert.notEqual(readTsonicMemoryType(checked.sourceFacts, arrayLayoutAt(checked, 6).call)?.identity,
      readTsonicMemoryType(checked.sourceFacts, arrayLayoutAt(checked, 7).call)?.identity);
    assertArrayObservation(checked, "sizeOf", 24, 8);
    assertArrayObservation(checked, "alignOf", profile.wideAlignment);
    assertArrayObservation(checked, "strideOf", 16);
    assertArrayObservation(checked, "fieldOffsetOf", 4);
    assertArrayObservation(checked, "fieldOffsetOf", 20, 1);
  });
}

test("array minimum extent distinguishes final element size, element stride and explicit trailing padding", () => {
  const checked = cleanArraySession(`
    const spaced = memoryLayout<uint32>(abi, 4, 4, 8);
    const one = memoryArrayLayout(abi, 4, 4, 4, spaced, 1);
    const exact = memoryArrayLayout(abi, 12, 4, 12, spaced, 2);
    const padded = memoryArrayLayout(abi, 16, 4, 20, spaced, 2);
    const emptySpaced = memoryLayout<Empty>(abi, 0, 4, 4);
    const emptyPair = memoryArrayLayout(abi, 4, 4, 4, emptySpaced, 2);
    const zero = memoryArrayLayout(abi, 0, 1, 0, spaced, 0);
    interface Tail { count: uint32; empty: Empty }
    const tail = memoryLayout<Tail>(abi, 8, 4, 8,
      memoryField((value: Tail) => value.count, 0, 4, word),
      memoryField((value: Tail) => value.empty, 4, 4, empty));
    const tails = memoryArrayLayout(abi, 16, 4, 16, tail, 2);
    sizeOf(one); sizeOf(exact); sizeOf(padded); sizeOf(emptyPair); sizeOf(zero); sizeOf(tails);
    strideOf(padded); alignOf(zero);
  `);
  for (const [index, size] of [4, 12, 16, 4, 0, 16].entries()) assertArrayObservation(checked, "sizeOf", size, index);
  assert.equal(arrayLayoutAt(checked, 2).elementLayout.stride, 8);
  assertArrayObservation(checked, "strideOf", 20);
  assertArrayObservation(checked, "alignOf", 1);
  const tail = valueMemoryLayout(arrayLayoutAt(checked, 5).elementLayout);
  assert.equal(tail.fields[1]?.byteOffset, 4);
  assert.equal(tail.fields[1]?.fieldLayout.byteSize, 0);
  assert.equal(tail.byteSize, 8);
});

test("zero-sized array counts remain exact and bounded across the safe-integer boundary", () => {
  const extents = ["0", "1", "2", "2n", "9007199254740991", "9007199254740992n", "9007199254740993n", "9223372036854775808n"];
  const checked = cleanArraySession(extents.map((extent, index) => `
    const array${index} = memoryArrayLayout(abi, 0, 4, 0, empty, ${extent});
    sizeOf(array${index}); strideOf(array${index});
  `).join("\n"));
  for (const [index, extent] of extents.entries()) {
    const layout = arrayLayoutAt(checked, index);
    assert.equal(layout.fixedArray.length, BigInt(extent.replace(/n$/u, "")));
    assert.equal(layout.fixedArray.lengthRuntimeBase, extent.endsWith("n") ? "bigint" : "number");
    assert.equal(countTsonicMemoryLayoutValues(layout, 2), 2);
    assert.equal(countTsonicMemoryLayoutValues(layout, 1), undefined);
    assertArrayObservation(checked, "sizeOf", 0, index);
    assertArrayObservation(checked, "strideOf", 0, index);
  }
  const lower = readTsonicMemoryType(checked.sourceFacts, arrayLayoutAt(checked, 5).call);
  const upper = readTsonicMemoryType(checked.sourceFacts, arrayLayoutAt(checked, 6).call);
  assert.ok(lower && upper);
  assert.notEqual(lower.identity, upper.identity);
});

test("array builder aliases and namespaces retain public declaration identity but same-spelled locals do not", () => {
  const checked = cleanArraySession(`
    import { memoryArrayLayout as physical } from "@tsonic/core/lang.js";
    import * as core from "@tsonic/core/lang.js";
    const selected = physical(abi, 8, 4, 8, word, 2);
    const namespace = core.memoryArrayLayout(abi, 8, 4, 8, word, 2);
    { function memoryArrayLayout(value: number) { return value + 1; }
      const ordinary = memoryArrayLayout(8); }
    sizeOf(selected); sizeOf(namespace);
  `);
  assert.equal(arrayLayoutAt(checked, 0, "physical").fixedArray.length, 2n);
  const calls = memoryCalls(checked, "memoryArrayLayout");
  assert.equal(calls.length, 2);
  assert.equal(readTsonicMemoryLayout(checked.sourceFacts, calls[0])?.kind, "array");
  assert.equal(readTsonicMemoryLayout(checked.sourceFacts, calls[1]), undefined);
  assertArrayObservation(checked, "sizeOf", 8);
  assertArrayObservation(checked, "sizeOf", 8, 1);
});

test("closed generic array aliases preserve explicit element markers and nested inference", () => {
  const checked = cleanArraySession(`
    type Row<Value> = FixedArray<Value, 2>;
    const row: MemoryLayout<Row<uint32>> = memoryArrayLayout<uint32, 2>(abi, 8, 4, 8, word, 2);
    const explicit = memoryArrayLayout<Row<uint32>, 2>(abi, 16, 4, 16, row, 2);
    const inferred = memoryArrayLayout(abi, 16, 4, 16, row, 2);
    sizeOf(explicit); sizeOf(inferred);
  `);
  const explicit = arrayLayoutAt(checked, 1);
  const inferred = arrayLayoutAt(checked, 2);
  assert.equal(arrayMemoryLayout(explicit.elementLayout).fixedArray.length, 2n);
  assert.equal(arrayMemoryLayout(inferred.elementLayout).fixedArray.length, 2n);
  const explicitType = readTsonicMemoryType(checked.sourceFacts, explicit.call);
  const inferredType = readTsonicMemoryType(checked.sourceFacts, inferred.call);
  assert.ok(explicitType && inferredType);
  assert.equal(explicitType.identity, inferredType.identity);
  assert.equal(inferred.fixedArray.elementType, undefined);
  assert.ok(inferred.fixedArray.elementSourceType);
  assertArrayObservation(checked, "sizeOf", 16);
  assertArrayObservation(checked, "sizeOf", 16, 1);
});

const invalidArrays = [
  ["insufficient extent", "", "memoryArrayLayout(abi, 4, 4, 4, word, 2)", "ARRAY_DIMENSIONS_INVALID"],
  ["child stride extent", "const spaced = memoryLayout<uint32>(abi, 4, 4, 8);", "memoryArrayLayout(abi, 8, 4, 8, spaced, 2)", "ARRAY_DIMENSIONS_INVALID"],
  ["whole stride too small", "", "memoryArrayLayout(abi, 8, 4, 4, word, 2)", "ARRAY_DIMENSIONS_INVALID"],
  ["whole stride misaligned", "", "memoryArrayLayout(abi, 8, 4, 10, word, 2)", "ARRAY_DIMENSIONS_INVALID"],
  ["base alignment", "", "memoryArrayLayout(abi, 8, 2, 8, word, 2)", "ARRAY_DIMENSIONS_INVALID"],
  ["zero alignment", "", "memoryArrayLayout(abi, 8, 0, 8, word, 2)", "ARRAY_DIMENSIONS_INVALID"],
  ["unproduced child", "declare const missing: MemoryLayout<uint32>;", "memoryArrayLayout(abi, 8, 4, 8, missing, 2)", "ARRAY_ELEMENT_NOT_PROVEN"],
  ["zero count still requires child", "declare const missing: MemoryLayout<uint32>;", "memoryArrayLayout(abi, 0, 4, 0, missing, 0)", "ARRAY_ELEMENT_NOT_PROVEN"],
  ["signed child", "const signed = memoryLayout<int32>(abi, 4, 4, 4);", "memoryArrayLayout<uint32, 2>(abi, 8, 4, 8, signed, 2)", "ARRAY_TYPE_NOT_PROVEN"],
  ["renamed primitive", 'import type { int32 as Word } from "@tsonic/core/types.js"; const signed = memoryLayout<Word>(abi, 4, 4, 4);', "memoryArrayLayout<uint32, 2>(abi, 8, 4, 8, signed, 2)", "ARRAY_TYPE_NOT_PROVEN"],
  ["disguised primitive", "type Disguised = number; const plain = memoryLayout<Disguised>(abi, 4, 4, 4);", "memoryArrayLayout<uint32, 2>(abi, 8, 4, 8, plain, 2)", "ARRAY_TYPE_NOT_PROVEN"],
  ["asserted child descriptor", "const signed = memoryLayout<int32>(abi, 4, 4, 4);", "memoryArrayLayout<uint32, 2>(abi, 8, 4, 8, signed as MemoryLayout<uint32>, 2)", "ARRAY_ELEMENT_NOT_PROVEN"],
  ["explicit nested FixedArray element marker", "const signed = memoryLayout<int32>(abi, 4, 4, 4); const signedPair = memoryArrayLayout(abi, 8, 4, 8, signed, 2);", "memoryArrayLayout<FixedArray<uint32, 2>, 2>(abi, 16, 4, 16, signedPair, 2)", "ARRAY_TYPE_NOT_PROVEN"],
  ["negative count", "", "memoryArrayLayout(abi, 0, 4, 0, empty, -1)", "ARRAY_LAYOUT_NOT_PROVEN"],
  ["negative bigint count", "", "memoryArrayLayout(abi, 0, 4, 0, empty, -1n)", "ARRAY_LAYOUT_NOT_PROVEN"],
  ["fractional count", "", "memoryArrayLayout(abi, 0, 4, 0, empty, 1.5)", "ARRAY_LAYOUT_NOT_PROVEN"],
  ["unsafe numeric count", "", "memoryArrayLayout(abi, 0, 4, 0, empty, 9007199254740993)", "ARRAY_LAYOUT_NOT_PROVEN"],
  ["open count", "declare const count: number;", "memoryArrayLayout(abi, 0, 4, 0, empty, count)", "ARRAY_LAYOUT_NOT_PROVEN"],
  ["union count", "declare const count: 1 | 2;", "memoryArrayLayout(abi, 0, 4, 0, empty, count)", "ARRAY_LAYOUT_NOT_PROVEN"],
  ["asserted count", "", "memoryArrayLayout<uint32, 2>(abi, 8, 4, 8, word, 1 as 2)", "ARRAY_TYPE_NOT_PROVEN"],
  ["huge nonzero storage", "", "memoryArrayLayout(abi, 9007199254740991, 1, 9007199254740991, word, 9007199254740993n)", "ARRAY_DIMENSIONS_INVALID"],
] as const;

for (const [name, setup, expression, code] of invalidArrays) {
  test(`fixed-array source rejects ${name} without poisoning valid observations`, () => {
    const checked = arraySession(`${setup} const invalid = ${expression}; sizeOf(invalid); sizeOf(word);`);
    assert.equal(checked.diagnostics.filter(Boolean).length, 0, formatDiagnostics(checked.diagnostics.filter(entry => entry !== undefined), "/src"));
    assert.ok(checked.extensionDiagnostics.some(entry => entry.extensionCode === `SOURCE_CORE_MEMORY_${code}`), name);
    assert.ok(checked.extensionDiagnostics.every(entry => entry.extensionCode !== "SOURCE_ANALYSIS_FAILED" && entry.extensionCode !== "OBSERVATION_HOOK_FAILED"));
    const calls = memoryCalls(checked, "memoryArrayLayout");
    assert.equal(readTsonicMemoryLayout(checked.sourceFacts, calls[calls.length - 1]), undefined);
    assert.equal(resolveTsonicMemoryLayoutObservation(checked.sourceFacts, memoryCall(checked, "sizeOf"))?.kind, "rejected");
    assertArrayObservation(checked, "sizeOf", 4, 1);
  });
}

for (const [name, setup, expression] of [
  ["missing length", "", "memoryArrayLayout(abi, 8, 4, 8, word)"],
  ["wrong literal length", "", "memoryArrayLayout<uint32, 2>(abi, 8, 4, 8, word, 1)"],
  ["raw versus typed element", "const child = memoryLayout<RawPointer | undefined>(abi, 8, 8, 8);", "memoryArrayLayout<Pointer<uint32> | undefined, 2>(abi, 16, 8, 16, child, 2)"],
  ["nullable versus nonnullable element", "const child = memoryLayout<Pointer<uint32> | undefined>(abi, 8, 8, 8);", "memoryArrayLayout<Pointer<uint32>, 2>(abi, 16, 8, 16, child, 2)"],
] as const) {
  test(`array public signature rejects ${name}`, () => {
    const checked = arraySession(`${setup} ${expression}; sizeOf(word);`);
    assert.match(formatDiagnostics(checked.diagnostics.filter(entry => entry !== undefined), "/src"), /Expected 6 arguments|not assignable/u);
    assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memoryArrayLayout")), undefined);
    assertArrayObservation(checked, "sizeOf", 4);
  });
}

test("generic layouts cannot finalize direct or aliased fixed arrays without their physical child", () => {
  const checked = arraySession(`
    type Pair = FixedArray<uint32, 2>;
    const direct = memoryLayout<FixedArray<uint32, 2>>(abi, 8, 4, 8);
    const alias = memoryLayout<Pair>(abi, 4, 4, 4);
    const zero = memoryLayout<FixedArray<uint32, 0>>(abi, 0, 4, 0);
    memoryField((value: Pair) => value[0], 0, 4, word);
    sizeOf(direct); sizeOf(alias); sizeOf(zero); sizeOf(word);
  `);
  assert.equal(checked.diagnostics.filter(Boolean).length, 0);
  for (const index of [2, 3, 4]) assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memoryLayout", index)), undefined);
  assert.equal(readTsonicMemoryFieldLayout(checked.sourceFacts, memoryCall(checked, "memoryField")), undefined);
  assert.equal(checked.extensionDiagnostics.filter(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_ARRAY_ELEMENT_REQUIRED").length, 3);
  assert.ok(checked.extensionDiagnostics.some(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_FIELD_NOT_PROVEN"));
  for (const index of [0, 1, 2]) assert.equal(resolveTsonicMemoryLayoutObservation(checked.sourceFacts, memoryCall(checked, "sizeOf", index))?.kind, "rejected");
  assertArrayObservation(checked, "sizeOf", 4, 3);
});

test("array dimensions obey the selected byte-address width without treating it as an extent cap", () => {
  const checked = arraySession(`
    memoryArrayLayout(abi, 4294967296, 4, 4294967296, empty, 0);
    const huge = memoryArrayLayout(abi, 0, 4, 0, empty, 9007199254740993n);
    sizeOf(huge);
  `, { registrations: [arrayProfileRegistration(arrayTestProfiles[0])] });
  assert.equal(checked.diagnostics.filter(Boolean).length, 0);
  assert.ok(checked.extensionDiagnostics.some(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_ARRAY_DIMENSIONS_INVALID"));
  assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memoryArrayLayout")), undefined);
  assert.equal(arrayLayoutAt(checked, 1).fixedArray.length, 9007199254740993n);
  assertArrayObservation(checked, "sizeOf", 0);
});

test("a real second ABI token cannot supply the array element even when dimensions agree", () => {
  const registration = {
    providerDeclaration: {
      providerId: "test.array-other-abi", providerVersion: "1", providerModuleId: "test:array-other-abi",
      moduleSpecifier: "test:array-other-abi", exportId: "other.token",
    },
    descriptor: { fingerprint: "array-other-be32", byteOrder: "big" as const, addressWidth: 32 as const },
  };
  const provider = createSourceSemanticsVirtualModuleProvider({
    id: registration.providerDeclaration.providerId, version: "1", displayName: "Second array test ABI",
    virtualDirectory: "test-array-other-abi", modules: [{ moduleSpecifier: "test:array-other-abi", exports: [] }],
    evidenceMessage: "An independently registered array test ABI",
    importsForModule: () => [{ moduleSpecifier: "@tsonic/core/types.js", namedImports: [{ exportedName: "DataLayout", kind: "type" }], typeOnly: true }],
    exportsForModule: () => [{ id: "other.token", name: "other", kind: "value",
      type: { kind: "provider-ref", moduleSpecifier: "@tsonic/core/types.js", exportName: "DataLayout" } }],
  });
  const checked = arraySession(`
    import { other } from "test:array-other-abi";
    const child = memoryLayout<uint32>(other, 4, 4, 4);
    const invalid = memoryArrayLayout(abi, 8, 4, 8, child, 2);
    sizeOf(invalid); sizeOf(word);
  `, { registrations: [memoryTestRegistration, registration], extensions: [{
    identity: { id: registration.providerDeclaration.providerId, version: "1" },
    initialize(context) { context.registerSourceDeclarationProvider(provider); },
  }] });
  assert.equal(checked.diagnostics.filter(Boolean).length, 0);
  assert.deepEqual(checked.extensionDiagnostics.map(entry => entry.extensionCode), ["SOURCE_CORE_MEMORY_ARRAY_ELEMENT_ABI_MISMATCH"]);
  assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memoryArrayLayout")), undefined);
  assert.equal(resolveTsonicMemoryLayoutObservation(checked.sourceFacts, memoryCall(checked, "sizeOf"))?.kind, "rejected");
  assertArrayObservation(checked, "sizeOf", 4, 1);
});
