import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import type { CheckedSourceProgram, Node, ReadonlySourceFactResolver } from "@tsonic/tsts";
import {
  readTsonicMemoryLayout, readTsonicMemoryType, selectTsonicRawLocationOperation,
  tsonicMemoryTypeFactKey,
} from "../../public/facts.js";
import { resolveTsonicMemoryLayoutObservation } from "../readers.js";
import { assertMemoryDiagnostics, memoryCall, memoryCalls, memorySession } from "./fixtures.js";
import { createSourceSemanticsVirtualModuleProvider } from "../../extension/semantics-virtual-modules.js";

const prelude = `
import { abi } from "test:abi";
import type { Pointer, RawPointer, uint32, int32, uint64 } from "@tsonic/core/types.js";
import { memoryLayout, memoryField, sizeOf, allocatePointer, toRawPointer, reinterpretRawPointer } from "@tsonic/core/lang.js";
`;

function clean(source: string, extraFiles: Readonly<Record<string, string>> = {}): CheckedSourceProgram {
  const checked = memorySession(prelude + source, { extraFiles });
  const diagnostics = checked.diagnostics.filter(entry => entry !== undefined);
  assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics, "/src"));
  assertMemoryDiagnostics(checked);
  return checked;
}

function identity(checked: CheckedSourceProgram, node: Node) {
  const fact = readTsonicMemoryType(checked.sourceFacts, node);
  assert.ok(fact);
  assert.ok(Object.isFrozen(fact));
  assert.ok(Object.isFrozen(fact.identity));
  return fact.identity;
}

for (const [label, localType, otherType, aliases] of [
  ["direct", "Pointer<uint32> | undefined", "Pointer<uint32> | undefined", ""],
  ["reordered nullable union", "undefined | Pointer<uint32>", "Pointer<uint32> | undefined", ""],
  ["nested pointer", "Pointer<Pointer<uint32> | undefined> | undefined", "Pointer<Pointer<uint32> | undefined> | undefined", ""],
  ["closed generic alias", "Link<uint32>", "Pointer<uint32> | undefined", "type Link<Value> = Pointer<Value> | undefined;"],
  ["nested generic aliases", "Link<uint32>", "Pointer<Pointer<uint32> | undefined> | undefined", "type Inner<Value> = Pointer<Value> | undefined; type Link<Value> = Pointer<Inner<Value>> | undefined;"],
] as const) {
  test(`cross-file memory identity preserves ${label}`, () => {
    const checked = clean(`
      import { other } from "./other.js";
      ${aliases}
      const local = memoryLayout<${localType}>(abi, 8, 8, 8);
      declare const slot: Pointer<${localType}>;
      export const view = reinterpretRawPointer(toRawPointer(slot, local), other);
    `, { "/src/other.ts": prelude + `export const other = memoryLayout<${otherType}>(abi, 8, 8, 8);` });
    const conversion = memoryCall(checked, "reinterpretRawPointer");
    const result = selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, conversion);
    assert.ok(result?.kind === "resolved");
    const local = memoryCall(checked, "memoryLayout");
    assert.equal(identity(checked, local), identity(checked, result.layout.call));
    assert.equal(result.memoryType, identity(checked, local));
    assert.equal(result.memoryType, identity(checked, memoryCall(checked, "toRawPointer")));
    assert.equal(selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, conversion)?.kind, "resolved");
  });
}

test("the reported allocation/import reproduction retains each checker-local type and joins shared evidence", () => {
  const checked = clean(`
    import { other } from "./other.js";
    const local = memoryLayout<Pointer<uint32> | undefined>(abi, 8, 8, 8);
    const slot = allocatePointer<Pointer<uint32> | undefined>(allocatePointer<uint32>(3));
    export const view = reinterpretRawPointer(toRawPointer(slot, local), other);
  `, { "/src/other.ts": prelude + "export const other = memoryLayout<Pointer<uint32> | undefined>(abi, 8, 8, 8);" });
  const result = selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, memoryCall(checked, "reinterpretRawPointer"));
  assert.ok(result?.kind === "resolved");
  assert.notEqual(result.operation.pointeeType, result.layout.sourceType);
  assert.equal(result.memoryType, identity(checked, result.layout.call));
});

test("import aliases, type aliases and reexports preserve one independently authored layout domain", () => {
  const checked = clean(`
    import type { Link } from "./barrel.js";
    import { selected as remote } from "./barrel.js";
    const local = memoryLayout<Link>(abi, 8, 8, 8);
    const alias = remote;
    declare const raw: RawPointer | undefined;
    reinterpretRawPointer(raw, alias);
  `, {
    "/src/barrel.ts": 'export { other as selected } from "./other.js"; export type { Link } from "./other.js";',
    "/src/other.ts": prelude + `type Alias = uint32; export type Link = Pointer<Alias> | undefined;
      export const other = memoryLayout<Link>(abi, 8, 8, 8);`,
  });
  const result = selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, memoryCall(checked, "reinterpretRawPointer"));
  assert.ok(result?.kind === "resolved");
  assert.equal(identity(checked, memoryCall(checked, "memoryLayout")), result.memoryType);
});

test("allocated, returned and raw-backed pointer values retain exact pointees through immutable aliases", () => {
  const checked = clean(`
    const word = memoryLayout<uint32>(abi, 4, 4, 4);
    const allocated = allocatePointer<uint32>(3);
    const alias = allocated;
    const raw = toRawPointer(alias, word);
    const view = reinterpretRawPointer(raw, word);
    const viewAlias = view;
    toRawPointer(viewAlias, word);
    toRawPointer(reinterpretRawPointer(raw, word), word);
    declare function external(): Pointer<uint32>;
    const returned = external();
    toRawPointer(returned, word);
  `);
  const expected = identity(checked, memoryCall(checked, "memoryLayout"));
  for (const call of memoryCalls(checked, "toRawPointer")) {
    const selected = selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, call);
    assert.ok(selected?.kind === "resolved");
    assert.equal(selected.memoryType, expected);
  }
});

for (const [name, setup, expression] of [
  ["numeric array index", "const values: Pointer<uint32>[] = [allocatePointer<uint32>(3)];", "values[0]"],
  ["shorthand field", "const pointer = allocatePointer<uint32>(3); const holder = { pointer };", "holder.pointer"],
  ["conditional mutable binding", "let pointer = allocatePointer<uint32>(3); pointer = allocatePointer<uint32>(4);", "true ? pointer : undefined"],
  ["inferred default return", "function get(value: Pointer<uint32> = allocatePointer<uint32>(3)) { return value; }", "get()"],
  ["generic return", "function identity<Value>(value: Pointer<Value>): Pointer<Value> { return value; }", "identity(allocatePointer<uint32>(3))"],
] as const) {
  for (const signed of [false, true]) {
    test(`${name} preserves the pointee domain${signed ? " and rejects signed layout substitution" : ""}`, () => {
      const checked = memorySession(prelude + `
        const layout = memoryLayout<${signed ? "int32" : "uint32"}>(abi, 4, 4, 4);
        ${setup} toRawPointer(${expression}, layout);
      `);
      assert.equal(checked.diagnostics.filter(Boolean).length, 0);
      if (signed) {
        assert.ok(checked.extensionDiagnostics.some(value => value.extensionCode === "SOURCE_CORE_MEMORY_POINTEE_LAYOUT_NOT_PROVEN"));
      } else {
        assertMemoryDiagnostics(checked);
        const selected = selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, memoryCall(checked, "toRawPointer"));
        assert.ok(selected?.kind === "resolved");
        assert.equal(selected.memoryType, identity(checked, memoryCall(checked, "memoryLayout")));
      }
    });
  }
}

for (const primitive of ["uint32", "int32"] as const) {
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
      const word = memoryLayout<uint32>(abi, 4, 4, 4);
      memoryLayout<Header>(abi, 4, 4, 4, memoryField((value: Header) => value.count, 0, 4, word));
    `, { extensions: [{ identity: { id: "test.memory-fields", version: "1" },
      initialize(context) { context.registerSourceDeclarationProvider(provider); } }] });
    assert.equal(checked.diagnostics.filter(Boolean).length, 0);
    if (primitive === "uint32") assertMemoryDiagnostics(checked);
    else assert.ok(checked.extensionDiagnostics.some(value => value.extensionCode === "SOURCE_CORE_MEMORY_FIELD_LAYOUT_NOT_PROVEN"));
  });
}

for (const [expression, pointee] of [
  ["toRawPointer(allocatePointer<uint32>(3), word)", "RawPointer | undefined"],
  ["reinterpretRawPointer(raw, word)", "Pointer<uint32> | undefined"],
] as const) {
  test(`inferred allocations preserve the complete raw-operation result: ${pointee}`, () => {
    const checked = clean(`
      const word = memoryLayout<uint32>(abi, 4, 4, 4);
      declare const raw: RawPointer | undefined;
      const slot = allocatePointer(${expression});
      const layout = memoryLayout<${pointee}>(abi, 8, 8, 8);
      toRawPointer(slot, layout);
    `);
    const calls = memoryCalls(checked, "toRawPointer");
    assert.equal(selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, calls[calls.length - 1]!)?.kind, "resolved");
  });
}

test("closed generic array aliases preserve element markers without depending on their spelling", () => {
  const checked = clean(`
    type Items<Value> = Value[];
    memoryLayout<Pointer<Items<uint32>>>(abi, 8, 8, 8);
    memoryLayout<Pointer<uint32[]>>(abi, 8, 8, 8);
    memoryLayout<Pointer<int32[]>>(abi, 8, 8, 8);
  `);
  const calls = memoryCalls(checked, "memoryLayout");
  assert.equal(identity(checked, calls[0]!), identity(checked, calls[1]!));
  assert.notEqual(identity(checked, calls[0]!), identity(checked, calls[2]!));
});

test("cross-file aggregate and physical field joins use the same source-owned contracts", () => {
  const checked = clean(`
    import { word, count } from "./other.js";
    import type { Header } from "./other.js";
    const header = memoryLayout<Header>(abi, 4, 4, 4, count);
    memoryField((value: Header) => value.count, 0, 4, word);
    sizeOf(header);
  `, { "/src/other.ts": prelude + `
    export interface Header { count: uint32 }
    export const word = memoryLayout<uint32>(abi, 4, 4, 4);
    export const count = memoryField((value: Header) => value.count, 0, 4, word);
  ` });
  assert.equal(resolveTsonicMemoryLayoutObservation(checked.sourceFacts, memoryCall(checked, "sizeOf"))?.kind, "resolved");
});

test("nil conversions retain their explicitly selected pointee/layout contract", () => {
  const checked = clean(`const word = memoryLayout<uint32>(abi, 4, 4, 4);
    toRawPointer<uint32>(undefined, word); reinterpretRawPointer<uint32>(undefined, word);`);
  for (const name of ["toRawPointer", "reinterpretRawPointer"]) {
    assert.equal(selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, memoryCall(checked, name))?.kind, "resolved");
  }
});

test("closed generic record arguments and their defaults retain selected primitive domains", () => {
  const checked = clean(`
    interface Cell<Value = uint32> { value: Value }
    memoryLayout<Pointer<Cell> | undefined>(abi, 8, 8, 8);
    memoryLayout<Pointer<Cell<uint32>> | undefined>(abi, 8, 8, 8);
    memoryLayout<Pointer<Cell<int32>> | undefined>(abi, 8, 8, 8);
    const word = memoryLayout<uint32>(abi, 4, 4, 4);
    memoryLayout<Cell<uint32>>(abi, 4, 4, 4, memoryField((cell: Cell<uint32>) => cell.value, 0, 4, word));
  `);
  const calls = memoryCalls(checked, "memoryLayout");
  assert.equal(identity(checked, calls[0]!), identity(checked, calls[1]!));
  assert.notEqual(identity(checked, calls[0]!), identity(checked, calls[2]!));
});

test("captured generic fields cannot hide an unbound type behind typeof", () => {
  const checked = memorySession(prelude + `function layout<Value>(value: Value) {
    const record = { value }; return memoryLayout<typeof record>(abi, 8, 8, 8);
  }`);
  assert.ok(checked.extensionDiagnostics.some(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_TYPE_NOT_PROVEN"));
  assert.equal(readTsonicMemoryType(checked.sourceFacts, memoryCall(checked, "memoryLayout")), undefined);
});

for (const value of ["() => value", "{} as { [key: string]: Value }"]) {
  test(`captured generic ${value} cannot acquire a closed layout through typeof`, () => {
    const checked = memorySession(prelude + `function layout<Value>(value: Value) {
      const record = ${value}; return memoryLayout<typeof record>(abi, 8, 8, 8);
    }`);
    assert.ok(checked.extensionDiagnostics.some(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_TYPE_NOT_PROVEN"));
    assert.equal(readTsonicMemoryType(checked.sourceFacts, memoryCall(checked, "memoryLayout")), undefined);
    assert.ok(checked.extensionDiagnostics.every(entry => entry.extensionCode !== "SOURCE_ANALYSIS_FAILED"));
  });
}

test("unsupported marker-bearing type computations cannot silently erase their primitive domains", () => {
  const checked = memorySession(prelude + `type Computed<Value> = Value extends number ? Pointer<Value> : never;
    memoryLayout<Computed<uint32>>(abi, 8, 8, 8);`);
  assert.ok(checked.extensionDiagnostics.some(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_TYPE_NOT_PROVEN"));
  assert.equal(readTsonicMemoryType(checked.sourceFacts, memoryCall(checked, "memoryLayout")), undefined);
});

test("unbound generic memory domains fail precisely instead of acquiring a reusable identity", () => {
  const checked = memorySession(prelude + "function layout<Value>() { return memoryLayout<Pointer<Value>>(abi, 8, 8, 8); }");
  assert.ok(checked.extensionDiagnostics.some(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_TYPE_NOT_PROVEN"));
  assert.equal(readTsonicMemoryType(checked.sourceFacts, memoryCall(checked, "memoryLayout")), undefined);
  assert.ok(checked.extensionDiagnostics.every(entry => entry.extensionCode !== "SOURCE_ANALYSIS_FAILED"));
});

test("invalid descriptors do not publish their prepared type contracts", () => {
  const checked = memorySession(prelude + "memoryLayout<uint32>(abi, 4, 3, 4);");
  assert.equal(readTsonicMemoryType(checked.sourceFacts, memoryCall(checked, "memoryLayout")), undefined);
});

for (const [label, first, second] of [
  ["signedness", "Pointer<int32> | undefined", "Pointer<uint32> | undefined"],
  ["nested signedness", "Pointer<Pointer<int32>> | undefined", "Pointer<Pointer<uint32>> | undefined"],
  ["null and undefined", "Pointer<uint32> | null", "Pointer<uint32> | undefined"],
  ["nullability", "Pointer<uint32>", "Pointer<uint32> | undefined"],
  ["pointer depth", "Pointer<Pointer<uint32>> | undefined", "Pointer<uint32> | undefined"],
  ["raw and typed pointers", "RawPointer | undefined", "Pointer<uint32> | undefined"],
] as const) {
  test(`memory identities distinguish ${label}`, () => {
    const checked = clean(`memoryLayout<${first}>(abi, 8, 8, 8); memoryLayout<${second}>(abi, 8, 8, 8);`);
    const calls = memoryCalls(checked, "memoryLayout");
    assert.notEqual(identity(checked, calls[0]!), identity(checked, calls[1]!));
  });
}

for (const operation of ["reinterpret", "to-raw", "field"] as const) {
  test(`${operation} rejects a distinct primitive domain despite equal number carriers`, () => {
    const checked = memorySession(prelude + `
      const signed = memoryLayout<int32>(abi, 4, 4, 4);
      declare const raw: RawPointer | undefined;
      declare const unsigned: Pointer<uint32>;
      interface Header { value: uint32 }
      ${operation === "reinterpret" ? "reinterpretRawPointer<uint32>(raw, signed);"
        : operation === "to-raw" ? "toRawPointer(unsigned, signed);"
          : "memoryField((value: Header) => value.value, 0, 4, signed);"}
    `);
    assert.equal(checked.diagnostics.filter(Boolean).length, 0);
    assert.ok(checked.extensionDiagnostics.some(entry => entry.extensionCode ===
      (operation === "field" ? "SOURCE_CORE_MEMORY_FIELD_LAYOUT_NOT_PROVEN" : "SOURCE_CORE_MEMORY_POINTEE_LAYOUT_NOT_PROVEN")));
    assert.ok(checked.extensionDiagnostics.every(entry => entry.extensionCode !== "SOURCE_ANALYSIS_FAILED"));
  });
}

test("missing, stale, forged and foreign type evidence rejects at the shared selector", () => {
  const build = () => clean(`const layout = memoryLayout<uint32>(abi, 4, 4, 4);
    declare const raw: RawPointer | undefined; reinterpretRawPointer(raw, layout);`);
  const checked = build();
  const foreign = build();
  const call = memoryCall(checked, "reinterpretRawPointer");
  const layoutCall = memoryCall(checked, "memoryLayout");
  const contract = readTsonicMemoryType(checked.sourceFacts, call)!;
  const foreignContract = readTsonicMemoryType(foreign.sourceFacts, memoryCall(foreign, "reinterpretRawPointer"))!;
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
  const source = "memoryLayout<uint32>(abi, 4, 4, 4); memoryLayout<uint32>(abi, 8, 8, 8);";
  const checked = clean(source);
  const calls = memoryCalls(checked, "memoryLayout");
  assert.equal(identity(checked, calls[0]!), identity(checked, calls[1]!));
  assert.notEqual(readTsonicMemoryLayout(checked.sourceFacts, calls[0])?.stride, readTsonicMemoryLayout(checked.sourceFacts, calls[1])?.stride);
  const foreign = clean(source);
  assert.notEqual(identity(checked, calls[0]!), identity(foreign, memoryCall(foreign, "memoryLayout")));
});

test("32 independently authored imported layouts reuse one memory identity", () => {
  const files = Object.fromEntries(Array.from({ length: 32 }, (_, index) => [
    `/src/layout${index}.ts`, prelude + "export const layout = memoryLayout<Pointer<uint32> | undefined>(abi, 8, 8, 8);",
  ]));
  const checked = clean(Array.from({ length: 32 }, (_, index) => `
    import { layout as layout${index} } from "./layout${index}.js"; sizeOf(layout${index});
  `).join("\n"), files);
  const identities = memoryCalls(checked, "sizeOf").map(call => {
    const layout = readTsonicMemoryLayout(checked.sourceFacts, checked.ast.arguments(call)[0]);
    assert.ok(layout);
    return identity(checked, layout.call);
  });
  assert.equal(new Set(identities).size, 1);
});
