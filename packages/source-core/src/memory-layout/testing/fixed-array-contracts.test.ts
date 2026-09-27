import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { createSourceSemanticsVirtualModuleProvider } from "../../public/extension.js";
import {
  countTsonicMemoryLayoutValues, readTsonicMemoryFieldLayout, readTsonicMemoryLayout,
  readTsonicMemoryType, resolveTsonicMemoryLayoutObservation, tsonicFixedArrayFactKey,
} from "../../public/facts.js";
import { memoryCall, memoryCalls, memoryDescriptorProperty, memoryTestRegistration, valueMemoryLayout } from "./fixtures.js";
import {
  arrayLayoutAt, arrayMemoryLayout, arrayProfileRegistration, arraySession,
  arrayTestProfiles, assertArrayObservation, cleanArraySession,
} from "./fixed-array-fixtures.js";

for (const profile of arrayTestProfiles) {
  test(`fixed-array physical composition preserves ${profile.byteOrder}-${profile.addressWidth} ABI evidence`, () => {
    const pointerSize = profile.addressWidth / 8;
    const registration = arrayProfileRegistration(profile);
    const checked = cleanArraySession(`
      const zero = memoryarraylayout<uint32, 0>({ datalayout: abi, bytesize: 0, bytealignment: 4, stride: 0, elementlayout: word, length: 0 });
      const one = memoryarraylayout<uint32, 1>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, elementlayout: word, length: 1 });
      const pair = memoryarraylayout({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, elementlayout: word, length: 2 });
      const byte = memorylayout<uint8>({ datalayout: abi, bytesize: 1, bytealignment: 1, stride: 1, fields: [] });
      interface Entry { tag: uint8; count: uint32 }
      const entry = memorylayout<Entry>({
        datalayout: abi,
        bytesize: 8,
        bytealignment: 4,
        stride: 8,
        fields: [memoryfield({ select: (value: Entry) => value.tag, byteoffset: 0, bytealignment: 1, fieldlayout: byte }), memoryfield({ select: (value: Entry) => value.count, byteoffset: 4, bytealignment: 4, fieldlayout: word })],
      });
      const entries = memoryarraylayout<Entry, 2>({ datalayout: abi, bytesize: 16, bytealignment: 4, stride: 16, elementlayout: entry, length: 2 });
      const nested = memoryarraylayout<FixedArray<uint32, 2>, 2>({ datalayout: abi, bytesize: 16, bytealignment: 4, stride: 16, elementlayout: pair, length: 2 });
      const wide = memorylayout<uint64>({ datalayout: abi, bytesize: 8, bytealignment: ${profile.wideAlignment}, stride: 8, fields: [] });
      const wides = memoryarraylayout({ datalayout: abi, bytesize: 16, bytealignment: ${profile.wideAlignment}, stride: 16, elementlayout: wide, length: 2 });
      const pointer = memorylayout<Pointer<uint32> | undefined>({ datalayout: abi, bytesize: ${pointerSize}, bytealignment: ${pointerSize}, stride: ${pointerSize}, fields: [] });
      const pointers = memoryarraylayout({ datalayout: abi, bytesize: ${pointerSize * 2}, bytealignment: ${pointerSize}, stride: ${pointerSize * 2}, elementlayout: pointer, length: 2 });
      const rawPointer = memorylayout<RawPointer | undefined>({ datalayout: abi, bytesize: ${pointerSize}, bytealignment: ${pointerSize}, stride: ${pointerSize}, fields: [] });
      const rawPointers = memoryarraylayout({ datalayout: abi, bytesize: ${pointerSize * 2}, bytealignment: ${pointerSize}, stride: ${pointerSize * 2}, elementlayout: rawPointer, length: 2 });
      interface Envelope { tag: uint8; values: FixedArray<Entry, 2>; tail: Empty }
      const envelope = memorylayout<Envelope>({
        datalayout: abi,
        bytesize: 24,
        bytealignment: 4,
        stride: 24,
        fields: [memoryfield({ select: (value: Envelope) => value.tag, byteoffset: 0, bytealignment: 1, fieldlayout: byte }), memoryfield({ select: (value: Envelope) => value.values, byteoffset: 4, bytealignment: 4, fieldlayout: entries }), memoryfield({ select: (value: Envelope) => value.tail, byteoffset: 20, bytealignment: 4, fieldlayout: empty })],
      });
      sizeof(zero); sizeof(one); sizeof(pair); sizeof(entries); sizeof(nested);
      sizeof(wides); sizeof(pointers); sizeof(rawPointers); sizeof(envelope);
      alignof(wides); strideof(nested); fieldoffsetof(envelope, value => value.values);
      fieldoffsetof(envelope, value => value.tail);
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
      assert.equal(layout.elementLayoutExpression, memoryDescriptorProperty(checked, layout.call, "elementlayout"));
      assert.equal(readTsonicMemoryLayout(checked.sourceFacts, layout.elementLayoutExpression)?.call, layout.elementLayout.call);
      assert.ok(tsonicFixedArrayFactKey.equals(layout.fixedArray,
        checked.sourceFacts.getFact(layout.call, tsonicFixedArrayFactKey)!));
      assert.deepEqual(layout.dataLayout, { providerDeclaration: registration.providerDeclaration, ...registration.descriptor });
      assertArrayObservation(checked, "sizeof", size, index);
    }
    assert.deepEqual(valueMemoryLayout(arrayLayoutAt(checked, 3).elementLayout).fields.map(field => field.byteOffset), [0, 4]);
    assert.equal(arrayMemoryLayout(arrayLayoutAt(checked, 4).elementLayout).fixedArray.length, 2n);
    assert.equal(countTsonicMemoryLayoutValues(arrayLayoutAt(checked, 4), 3), 3);
    assert.notEqual(readTsonicMemoryType(checked.sourceFacts, arrayLayoutAt(checked, 6).call)?.identity,
      readTsonicMemoryType(checked.sourceFacts, arrayLayoutAt(checked, 7).call)?.identity);
    assertArrayObservation(checked, "sizeof", 24, 8);
    assertArrayObservation(checked, "alignof", profile.wideAlignment);
    assertArrayObservation(checked, "strideof", 16);
    assertArrayObservation(checked, "fieldoffsetof", 4);
    assertArrayObservation(checked, "fieldoffsetof", 20, 1);
  });
}

test("array minimum extent distinguishes final element size, element stride and explicit trailing padding", () => {
  const checked = cleanArraySession(`
    const spaced = memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 8, fields: [] });
    const one = memoryarraylayout({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, elementlayout: spaced, length: 1 });
    const exact = memoryarraylayout({ datalayout: abi, bytesize: 12, bytealignment: 4, stride: 12, elementlayout: spaced, length: 2 });
    const padded = memoryarraylayout({ datalayout: abi, bytesize: 16, bytealignment: 4, stride: 20, elementlayout: spaced, length: 2 });
    const emptySpaced = memorylayout<Empty>({ datalayout: abi, bytesize: 0, bytealignment: 4, stride: 4, fields: [] });
    const emptyPair = memoryarraylayout({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, elementlayout: emptySpaced, length: 2 });
    const zero = memoryarraylayout({ datalayout: abi, bytesize: 0, bytealignment: 1, stride: 0, elementlayout: spaced, length: 0 });
    interface Tail { count: uint32; empty: Empty }
    const tail = memorylayout<Tail>({
      datalayout: abi,
      bytesize: 8,
      bytealignment: 4,
      stride: 8,
      fields: [memoryfield({ select: (value: Tail) => value.count, byteoffset: 0, bytealignment: 4, fieldlayout: word }), memoryfield({ select: (value: Tail) => value.empty, byteoffset: 4, bytealignment: 4, fieldlayout: empty })],
    });
    const tails = memoryarraylayout({ datalayout: abi, bytesize: 16, bytealignment: 4, stride: 16, elementlayout: tail, length: 2 });
    sizeof(one); sizeof(exact); sizeof(padded); sizeof(emptyPair); sizeof(zero); sizeof(tails);
    strideof(padded); alignof(zero);
  `);
  for (const [index, size] of [4, 12, 16, 4, 0, 16].entries()) assertArrayObservation(checked, "sizeof", size, index);
  assert.equal(arrayLayoutAt(checked, 2).elementLayout.stride, 8);
  assertArrayObservation(checked, "strideof", 20);
  assertArrayObservation(checked, "alignof", 1);
  const tail = valueMemoryLayout(arrayLayoutAt(checked, 5).elementLayout);
  assert.equal(tail.fields[1]?.byteOffset, 4);
  assert.equal(tail.fields[1]?.fieldLayout.byteSize, 0);
  assert.equal(tail.byteSize, 8);
});

test("zero-sized array counts remain exact and bounded across the safe-integer boundary", () => {
  const extents = ["0", "1", "2", "2n", "9007199254740991", "9007199254740992n", "9007199254740993n", "9223372036854775808n"];
  const checked = cleanArraySession(extents.map((extent, index) => `
    const array${index} = memoryarraylayout({ datalayout: abi, bytesize: 0, bytealignment: 4, stride: 0, elementlayout: empty, length: ${extent} });
    sizeof(array${index}); strideof(array${index});
  `).join("\n"));
  for (const [index, extent] of extents.entries()) {
    const layout = arrayLayoutAt(checked, index);
    assert.equal(layout.fixedArray.length, BigInt(extent.replace(/n$/u, "")));
    assert.equal(layout.fixedArray.lengthRuntimeBase, extent.endsWith("n") ? "bigint" : "number");
    assert.equal(countTsonicMemoryLayoutValues(layout, 2), 2);
    assert.equal(countTsonicMemoryLayoutValues(layout, 1), undefined);
    assertArrayObservation(checked, "sizeof", 0, index);
    assertArrayObservation(checked, "strideof", 0, index);
  }
  const lower = readTsonicMemoryType(checked.sourceFacts, arrayLayoutAt(checked, 5).call);
  const upper = readTsonicMemoryType(checked.sourceFacts, arrayLayoutAt(checked, 6).call);
  assert.ok(lower && upper);
  assert.notEqual(lower.identity, upper.identity);
});

test("array builder aliases and namespaces retain public declaration identity but same-spelled locals do not", () => {
  const checked = cleanArraySession(`
    import { memoryarraylayout as physical } from "@tsonic/core/lang.js";
    import * as core from "@tsonic/core/lang.js";
    const selected = physical({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, elementlayout: word, length: 2 });
    const namespace = core.memoryarraylayout({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, elementlayout: word, length: 2 });
    { function memoryarraylayout(value: number) { return value + 1; }
      const ordinary = memoryarraylayout(8); }
    sizeof(selected); sizeof(namespace);
  `);
  assert.equal(arrayLayoutAt(checked, 0, "physical").fixedArray.length, 2n);
  const calls = memoryCalls(checked, "memoryarraylayout");
  assert.equal(calls.length, 2);
  assert.equal(readTsonicMemoryLayout(checked.sourceFacts, calls[0])?.kind, "array");
  assert.equal(readTsonicMemoryLayout(checked.sourceFacts, calls[1]), undefined);
  assertArrayObservation(checked, "sizeof", 8);
  assertArrayObservation(checked, "sizeof", 8, 1);
});

test("closed generic array aliases preserve explicit element markers and nested inference", () => {
  const checked = cleanArraySession(`
    type Row<Value> = FixedArray<Value, 2>;
    const row: MemoryLayout<Row<uint32>> = memoryarraylayout<uint32, 2>({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, elementlayout: word, length: 2 });
    const explicit = memoryarraylayout<Row<uint32>, 2>({ datalayout: abi, bytesize: 16, bytealignment: 4, stride: 16, elementlayout: row, length: 2 });
    const inferred = memoryarraylayout({ datalayout: abi, bytesize: 16, bytealignment: 4, stride: 16, elementlayout: row, length: 2 });
    sizeof(explicit); sizeof(inferred);
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
  assertArrayObservation(checked, "sizeof", 16);
  assertArrayObservation(checked, "sizeof", 16, 1);
});

const invalidArrays = [
  ["insufficient extent", "", "memoryarraylayout({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, elementlayout: word, length: 2 })", "ARRAY_DIMENSIONS_INVALID"],
  ["child stride extent", "const spaced = memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 8, fields: [] });", "memoryarraylayout({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, elementlayout: spaced, length: 2 })", "ARRAY_DIMENSIONS_INVALID"],
  ["whole stride too small", "", "memoryarraylayout({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 4, elementlayout: word, length: 2 })", "ARRAY_DIMENSIONS_INVALID"],
  ["whole stride misaligned", "", "memoryarraylayout({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 10, elementlayout: word, length: 2 })", "ARRAY_DIMENSIONS_INVALID"],
  ["base alignment", "", "memoryarraylayout({ datalayout: abi, bytesize: 8, bytealignment: 2, stride: 8, elementlayout: word, length: 2 })", "ARRAY_DIMENSIONS_INVALID"],
  ["zero alignment", "", "memoryarraylayout({ datalayout: abi, bytesize: 8, bytealignment: 0, stride: 8, elementlayout: word, length: 2 })", "ARRAY_DIMENSIONS_INVALID"],
  ["unproduced child", "declare const missing: MemoryLayout<uint32>;", "memoryarraylayout({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, elementlayout: missing, length: 2 })", "ARRAY_ELEMENT_NOT_PROVEN"],
  ["zero count still requires child", "declare const missing: MemoryLayout<uint32>;", "memoryarraylayout({ datalayout: abi, bytesize: 0, bytealignment: 4, stride: 0, elementlayout: missing, length: 0 })", "ARRAY_ELEMENT_NOT_PROVEN"],
  ["signed child", "const signed = memorylayout<int32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });", "memoryarraylayout<uint32, 2>({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, elementlayout: signed, length: 2 })", "ARRAY_TYPE_NOT_PROVEN"],
  ["renamed primitive", 'import type { int32 as Word } from "@tsonic/core/types.js"; const signed = memorylayout<Word>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });', "memoryarraylayout<uint32, 2>({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, elementlayout: signed, length: 2 })", "ARRAY_TYPE_NOT_PROVEN"],
  ["disguised primitive", "type Disguised = number; const plain = memorylayout<Disguised>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });", "memoryarraylayout<uint32, 2>({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, elementlayout: plain, length: 2 })", "ARRAY_TYPE_NOT_PROVEN"],
  ["asserted child descriptor", "const signed = memorylayout<int32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });", "memoryarraylayout<uint32, 2>({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, elementlayout: signed as MemoryLayout<uint32>, length: 2 })", "ARRAY_ELEMENT_NOT_PROVEN"],
  ["explicit nested FixedArray element marker", "const signed = memorylayout<int32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] }); const signedPair = memoryarraylayout({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, elementlayout: signed, length: 2 });", "memoryarraylayout<FixedArray<uint32, 2>, 2>({ datalayout: abi, bytesize: 16, bytealignment: 4, stride: 16, elementlayout: signedPair, length: 2 })", "ARRAY_TYPE_NOT_PROVEN"],
  ["negative count", "", "memoryarraylayout({ datalayout: abi, bytesize: 0, bytealignment: 4, stride: 0, elementlayout: empty, length: -1 })", "ARRAY_LAYOUT_NOT_PROVEN"],
  ["negative bigint count", "", "memoryarraylayout({ datalayout: abi, bytesize: 0, bytealignment: 4, stride: 0, elementlayout: empty, length: -1n })", "ARRAY_LAYOUT_NOT_PROVEN"],
  ["fractional count", "", "memoryarraylayout({ datalayout: abi, bytesize: 0, bytealignment: 4, stride: 0, elementlayout: empty, length: 1.5 })", "ARRAY_LAYOUT_NOT_PROVEN"],
  ["unsafe numeric count", "", "memoryarraylayout({ datalayout: abi, bytesize: 0, bytealignment: 4, stride: 0, elementlayout: empty, length: 9007199254740993 })", "ARRAY_LAYOUT_NOT_PROVEN"],
  ["open count", "declare const count: number;", "memoryarraylayout({ datalayout: abi, bytesize: 0, bytealignment: 4, stride: 0, elementlayout: empty, length: count })", "ARRAY_LAYOUT_NOT_PROVEN"],
  ["union count", "declare const count: 1 | 2;", "memoryarraylayout({ datalayout: abi, bytesize: 0, bytealignment: 4, stride: 0, elementlayout: empty, length: count })", "ARRAY_LAYOUT_NOT_PROVEN"],
  ["asserted count", "", "memoryarraylayout<uint32, 2>({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, elementlayout: word, length: 1 as 2 })", "ARRAY_TYPE_NOT_PROVEN"],
  ["huge nonzero storage", "", "memoryarraylayout({ datalayout: abi, bytesize: 9007199254740991, bytealignment: 1, stride: 9007199254740991, elementlayout: word, length: 9007199254740993n })", "ARRAY_DIMENSIONS_INVALID"],
] as const;

for (const [name, setup, expression, code] of invalidArrays) {
  test(`fixed-array source rejects ${name} without poisoning valid observations`, () => {
    const checked = arraySession(`${setup} const invalid = ${expression}; sizeof(invalid); sizeof(word);`);
    assert.equal(checked.diagnostics.filter(Boolean).length, 0, formatDiagnostics(checked.diagnostics.filter(entry => entry !== undefined), "/src"));
    assert.ok(checked.extensionDiagnostics.some(entry => entry.extensionCode === `SOURCE_CORE_MEMORY_${code}`), name);
    assert.ok(checked.extensionDiagnostics.every(entry => entry.extensionCode !== "SOURCE_ANALYSIS_FAILED" && entry.extensionCode !== "OBSERVATION_HOOK_FAILED"));
    const calls = memoryCalls(checked, "memoryarraylayout");
    assert.equal(readTsonicMemoryLayout(checked.sourceFacts, calls[calls.length - 1]), undefined);
    assert.equal(resolveTsonicMemoryLayoutObservation(checked.sourceFacts, memoryCall(checked, "sizeof"))?.kind, "rejected");
    assertArrayObservation(checked, "sizeof", 4, 1);
  });
}

for (const [name, setup, expression] of [
  ["missing length", "", "memoryarraylayout({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, elementlayout: word })"],
  ["wrong literal length", "", "memoryarraylayout<uint32, 2>({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, elementlayout: word, length: 1 })"],
  ["raw versus typed element", "const child = memorylayout<RawPointer | undefined>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });", "memoryarraylayout<Pointer<uint32> | undefined, 2>({ datalayout: abi, bytesize: 16, bytealignment: 8, stride: 16, elementlayout: child, length: 2 })"],
  ["nullable versus nonnullable element", "const child = memorylayout<Pointer<uint32> | undefined>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });", "memoryarraylayout<Pointer<uint32>, 2>({ datalayout: abi, bytesize: 16, bytealignment: 8, stride: 16, elementlayout: child, length: 2 })"],
] as const) {
  test(`array public signature rejects ${name}`, () => {
    const checked = arraySession(`${setup} ${expression}; sizeof(word);`);
    const diagnostics = formatDiagnostics(checked.diagnostics.filter(entry => entry !== undefined), "/src");
    assert.match(diagnostics, /not assignable/u);
    if (name === "missing length") assert.match(diagnostics, /'length' is missing/u);
    assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memoryarraylayout")), undefined);
    assertArrayObservation(checked, "sizeof", 4);
  });
}

test("generic layouts cannot finalize direct or aliased fixed arrays without their physical child", () => {
  const checked = arraySession(`
    type Pair = FixedArray<uint32, 2>;
    const direct = memorylayout<FixedArray<uint32, 2>>({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, fields: [] });
    const alias = memorylayout<Pair>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });
    const zero = memorylayout<FixedArray<uint32, 0>>({ datalayout: abi, bytesize: 0, bytealignment: 4, stride: 0, fields: [] });
    memoryfield({ select: (value: Pair) => value[0], byteoffset: 0, bytealignment: 4, fieldlayout: word });
    sizeof(direct); sizeof(alias); sizeof(zero); sizeof(word);
  `);
  assert.equal(checked.diagnostics.filter(Boolean).length, 0);
  for (const index of [2, 3, 4]) assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memorylayout", index)), undefined);
  assert.equal(readTsonicMemoryFieldLayout(checked.sourceFacts, memoryCall(checked, "memoryfield")), undefined);
  assert.equal(checked.extensionDiagnostics.filter(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_ARRAY_ELEMENT_REQUIRED").length, 3);
  assert.ok(checked.extensionDiagnostics.some(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_FIELD_NOT_PROVEN"));
  for (const index of [0, 1, 2]) assert.equal(resolveTsonicMemoryLayoutObservation(checked.sourceFacts, memoryCall(checked, "sizeof", index))?.kind, "rejected");
  assertArrayObservation(checked, "sizeof", 4, 3);
});

test("array dimensions obey the selected byte-address width without treating it as an extent cap", () => {
  const checked = arraySession(`
    memoryarraylayout({ datalayout: abi, bytesize: 4294967296, bytealignment: 4, stride: 4294967296, elementlayout: empty, length: 0 });
    const huge = memoryarraylayout({ datalayout: abi, bytesize: 0, bytealignment: 4, stride: 0, elementlayout: empty, length: 9007199254740993n });
    sizeof(huge);
  `, { registrations: [arrayProfileRegistration(arrayTestProfiles[0])] });
  assert.equal(checked.diagnostics.filter(Boolean).length, 0);
  assert.ok(checked.extensionDiagnostics.some(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_ARRAY_DIMENSIONS_INVALID"));
  assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memoryarraylayout")), undefined);
  assert.equal(arrayLayoutAt(checked, 1).fixedArray.length, 9007199254740993n);
  assertArrayObservation(checked, "sizeof", 0);
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
    const child = memorylayout<uint32>({ datalayout: other, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });
    const invalid = memoryarraylayout({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, elementlayout: child, length: 2 });
    sizeof(invalid); sizeof(word);
  `, { registrations: [memoryTestRegistration, registration], extensions: [{
    identity: { id: registration.providerDeclaration.providerId, version: "1" },
    initialize(context) { context.registerSourceDeclarationProvider(provider); },
  }] });
  assert.equal(checked.diagnostics.filter(Boolean).length, 0);
  assert.deepEqual(checked.extensionDiagnostics.map(entry => entry.extensionCode), ["SOURCE_CORE_MEMORY_ARRAY_ELEMENT_ABI_MISMATCH"]);
  assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memoryarraylayout")), undefined);
  assert.equal(resolveTsonicMemoryLayoutObservation(checked.sourceFacts, memoryCall(checked, "sizeof"))?.kind, "rejected");
  assertArrayObservation(checked, "sizeof", 4, 1);
});
