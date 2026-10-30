import assert from "node:assert/strict";

import { test } from "node:test";

import type { ReadonlySourceFactResolver } from "@tsonic/tsts";

import { readTsonicMemoryLayout, readTsonicMemoryType, selectTsonicRawLocationOperation, tsonicMemoryTypeFactKey } from "../../public/facts.js";

import { memoryCall, memoryCalls, memorySession } from "./fixtures.js";

import { prelude, clean, identity } from "./cross-file-types-fixtures.js";

test("closed generic record arguments and their defaults retain selected primitive domains", () => {
  const checked = clean(`
    interface Cell<Value = uint32> { value: Value }
    memorylayout<Pointer<Cell> | undefined>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
    memorylayout<Pointer<Cell<uint32>> | undefined>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
    memorylayout<Pointer<Cell<int32>> | undefined>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
    const word = memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });
    memorylayout<Cell<uint32>>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [memoryfield({ select: (cell: Cell<uint32>) => cell.value, byteoffset: 0, bytealignment: 4, fieldlayout: word })] });
  `);
  const calls = memoryCalls(checked, "memorylayout");
  assert.equal(identity(checked, calls[0]!), identity(checked, calls[1]!));
  assert.notEqual(identity(checked, calls[0]!), identity(checked, calls[2]!));
});

test("captured generic fields cannot hide an unbound type behind typeof", () => {
  const checked = memorySession(prelude + `function layout<Value>(value: Value) {
    const record = { value }; return memorylayout<typeof record>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
  }`);
  assert.ok(checked.extensionDiagnostics.some(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_TYPE_NOT_PROVEN"));
  assert.equal(readTsonicMemoryType(checked.sourceFacts, memoryCall(checked, "memorylayout")), undefined);
});

for (const value of ["() => value", "{} as { [key: string]: Value }"]){
test(`captured generic ${value} cannot acquire a closed layout through typeof`, () => {
    const checked = memorySession(prelude + `function layout<Value>(value: Value) {
      const record = ${value}; return memorylayout<typeof record>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
    }`);
    assert.ok(checked.extensionDiagnostics.some(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_TYPE_NOT_PROVEN"));
    assert.equal(readTsonicMemoryType(checked.sourceFacts, memoryCall(checked, "memorylayout")), undefined);
    assert.ok(checked.extensionDiagnostics.every(entry => entry.extensionCode !== "SOURCE_ANALYSIS_FAILED"));
  });
}

test("unsupported marker-bearing type computations cannot silently erase their primitive domains", () => {
  const checked = memorySession(prelude + `type Computed<Value> = Value extends number ? Pointer<Value> : never;
    memorylayout<Computed<uint32>>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });`);
  assert.ok(checked.extensionDiagnostics.some(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_TYPE_NOT_PROVEN"));
  assert.equal(readTsonicMemoryType(checked.sourceFacts, memoryCall(checked, "memorylayout")), undefined);
});

test("unbound generic memory domains fail precisely instead of acquiring a reusable identity", () => {
  const checked = memorySession(prelude + "function layout<Value>() { return memorylayout<Pointer<Value>>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] }); }");
  assert.ok(checked.extensionDiagnostics.some(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_TYPE_NOT_PROVEN"));
  assert.equal(readTsonicMemoryType(checked.sourceFacts, memoryCall(checked, "memorylayout")), undefined);
  assert.ok(checked.extensionDiagnostics.every(entry => entry.extensionCode !== "SOURCE_ANALYSIS_FAILED"));
});

test("invalid descriptors do not publish their prepared type contracts", () => {
  const checked = memorySession(prelude + "memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 3, stride: 4, fields: [] });");
  assert.equal(readTsonicMemoryType(checked.sourceFacts, memoryCall(checked, "memorylayout")), undefined);
});

for (const [label, first, second] of [
  ["signedness", "Pointer<int32> | undefined", "Pointer<uint32> | undefined"],
  ["nested signedness", "Pointer<Pointer<int32>> | undefined", "Pointer<Pointer<uint32>> | undefined"],
  ["nullability", "Pointer<uint32>", "Pointer<uint32> | undefined"],
  ["pointer depth", "Pointer<Pointer<uint32>> | undefined", "Pointer<uint32> | undefined"],
  ["raw and typed pointers", "RawPointer | undefined", "Pointer<uint32> | undefined"],
] as const){
test(`memory identities distinguish ${label}`, () => {
    const checked = clean(`memorylayout<${first}>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] }); memorylayout<${second}>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });`);
    const calls = memoryCalls(checked, "memorylayout");
    assert.notEqual(identity(checked, calls[0]!), identity(checked, calls[1]!));
  });
}

test("memory identities use one native absence for null and undefined", () => {
  const checked = clean("memorylayout<Pointer<uint32> | null>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] }); memorylayout<Pointer<uint32> | undefined>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });");
  const calls = memoryCalls(checked, "memorylayout");
  assert.equal(identity(checked, calls[0]!), identity(checked, calls[1]!), "native absence never acquires a second JS-only tag");
});

for (const operation of ["reinterpret", "to-raw", "field"] as const){
test(`${operation} rejects a distinct primitive domain despite equal number carriers`, () => {
    const checked = memorySession(prelude + `
      const signed = memorylayout<int32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });
      declare const raw: RawPointer | undefined;
      declare const unsigned: Pointer<uint32>;
      interface Header { value: uint32 }
      ${operation === "reinterpret" ? "reinterpretrawptr<uint32>(raw, signed);"
        : operation === "to-raw" ? "torawptr(unsigned, signed);"
          : "memoryfield({ select: (value: Header) => value.value, byteoffset: 0, bytealignment: 4, fieldlayout: signed });"}
    `);
    assert.equal(checked.diagnostics.filter(Boolean).length, 0);
    assert.ok(checked.extensionDiagnostics.some(entry => entry.extensionCode ===
      (operation === "field" ? "SOURCE_CORE_MEMORY_FIELD_LAYOUT_NOT_PROVEN" : "SOURCE_CORE_MEMORY_POINTEE_LAYOUT_NOT_PROVEN")));
    assert.ok(checked.extensionDiagnostics.every(entry => entry.extensionCode !== "SOURCE_ANALYSIS_FAILED"));
  });
}

test("missing, stale, forged and foreign type evidence rejects at the shared selector", () => {
  const build = () => clean(`const layout = memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });
    declare const raw: RawPointer | undefined; reinterpretrawptr(raw, layout);`);
  const checked = build();
  const foreign = build();
  const call = memoryCall(checked, "reinterpretrawptr");
  const layoutCall = memoryCall(checked, "memorylayout");
  const contract = readTsonicMemoryType(checked.sourceFacts, call)!;
  const foreignContract = readTsonicMemoryType(foreign.sourceFacts, memoryCall(foreign, "reinterpretrawptr"))!;
  for (const mutation of ["missing-operation", "missing-layout", "empty-contract", "foreign-type", "foreign-identity", "both-foreign-identities", "wrong-call"] as const) {
    const facts: ReadonlySourceFactResolver = {
      getFact(subject, key) {
        if (Object.is(key, tsonicMemoryTypeFactKey)) {
          if (mutation === "missing-operation" && subject === call || mutation === "missing-layout" && subject === layoutCall) return undefined;
          const value = checked.sourceFacts.getFact(subject, tsonicMemoryTypeFactKey);
          if (value !== undefined && (subject === call || mutation === "both-foreign-identities")) {
            if (mutation === "empty-contract") return { call, sourceType: undefined, identity: {} } as never;
            if (mutation === "foreign-type") return { ...value, sourceType: foreignContract.sourceType } as never;
            if (mutation === "foreign-identity" || mutation === "both-foreign-identities") return { ...value, identity: foreignContract.identity } as never;
            if (mutation === "wrong-call") return { ...value, call: layoutCall } as never;
          }
        }
        return checked.sourceFacts.getFact(subject, key);
      },
      getFacts: subject => checked.sourceFacts.getFacts(subject),
      getVirtualDeclarationDocument: name => checked.sourceFacts.getVirtualDeclarationDocument(name),
    };
    if (mutation === "empty-contract") assert.equal(readTsonicMemoryType(facts, call), undefined);
    assert.equal(selectTsonicRawLocationOperation(checked.ast, facts, call)?.kind, "rejected", mutation);
  }
  assert.throws(() => tsonicMemoryTypeFactKey.snapshot!({ ...contract, identity: foreignContract.identity }));
  assert.throws(() => tsonicMemoryTypeFactKey.snapshot!({ ...contract, identity: Object.freeze({}) as typeof contract.identity }));
  assert.throws(() => tsonicMemoryTypeFactKey.snapshot!({ ...contract, get identity(): typeof contract.identity { throw new Error("accessor ran"); } }), /accessor/);
});

test("identity is program scoped and does not stand in for selected physical layout dimensions", () => {
  const source = "memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] }); memorylayout<uint32>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });";
  const checked = clean(source);
  const calls = memoryCalls(checked, "memorylayout");
  assert.equal(identity(checked, calls[0]!), identity(checked, calls[1]!));
  assert.notEqual(readTsonicMemoryLayout(checked.sourceFacts, calls[0])?.stride, readTsonicMemoryLayout(checked.sourceFacts, calls[1])?.stride);
  const foreign = clean(source);
  assert.notEqual(identity(checked, calls[0]!), identity(foreign, memoryCall(foreign, "memorylayout")));
});

test("32 independently authored imported layouts reuse one memory identity", () => {
  const files = Object.fromEntries(Array.from({ length: 32 }, (_, index) => [
    `/src/layout${index}.ts`, prelude + "export const layout = memorylayout<Pointer<uint32> | undefined>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });",
  ]));
  const checked = clean(Array.from({ length: 32 }, (_, index) => `
    import { layout as layout${index} } from "./layout${index}.js"; sizeof(layout${index});
  `).join("\n"), files);
  const identities = memoryCalls(checked, "sizeof").map(call => {
    const layout = readTsonicMemoryLayout(checked.sourceFacts, checked.ast.arguments(call)[0]);
    assert.ok(layout);
    return identity(checked, layout.call);
  });
  assert.equal(new Set(identities).size, 1);
});
