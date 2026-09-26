import assert from "node:assert/strict";
import { test } from "node:test";
import { fieldFactKey, pointerOperationFactKey } from "@tsonic/tsts";
import { tsonicCoreSourceExtensionId } from "../../identity.js";
import { tsonicRawMemoryOperationFactKey } from "../../pointers/raw-memory/facts.js";
import { tsonicDataLayoutFactKey, tsonicMemoryFieldLayoutFactKey, tsonicMemoryLayoutFactKey } from "../facts.js";
import {
  readTsonicDataLayout, readTsonicKeepAlive, readTsonicMemoryLayout,
  readTsonicMemoryLayoutQuery, readTsonicRawMemoryOperation,
} from "../readers.js";
import { assertMemoryDiagnostics, cleanMemorySession, memoryCall, memoryCalls, memorySession, memoryTestPrelude, memoryTestRegistration } from "./fixtures.js";

test("raw reinterpretation returns the canonical inferred Pointer and retains nested operation facts", () => {
  const checked = cleanMemorySession(`
    const pointer: Pointer<uint32> | undefined = reinterpretrawptr(raw, uint32Layout);
    const explicit = reinterpretrawptr<uint32>(raw, uint32Layout);
    const chosen: Pointer<uint32> | undefined = raw === undefined ? ordinary : pointer;
    if (chosen !== undefined) storeptr(chosen, loadptr(chosen));
    const address = torawptr(ordinary, uint32Layout);
  `);
  const inferred = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "reinterpretrawptr"));
  const explicit = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "reinterpretrawptr", 1));
  assert.equal(inferred?.operation, "reinterpret");
  assert.equal(explicit?.operation, "reinterpret");
  assert.ok(inferred?.operation === "reinterpret" && explicit?.operation === "reinterpret");
  assert.ok(inferred.pointeeType);
  assert.equal(inferred.explicitPointeeTypeNode, undefined);
  assert.ok(explicit.explicitPointeeTypeNode);
  assert.ok(inferred.pointeeType === explicit.pointeeType);
  assert.equal(readTsonicMemoryLayout(checked.sourceFacts, inferred.layoutExpression)?.byteSize, 4);
  assert.equal(checked.sourceFacts.getFact(memoryCall(checked, "storeptr"), pointerOperationFactKey)?.operation, "store");
  assert.equal(checked.sourceFacts.getFact(memoryCall(checked, "loadptr"), pointerOperationFactKey)?.operation, "load");
  assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "torawptr"))?.operation, "to-raw");
  assert.ok(Object.isFrozen(inferred));
});

test("raw operations support aliases and namespaces without granting same-spelled locals marker facts", () => {
  const checked = cleanMemorySession(`
    import { reinterpretrawptr as convert } from "@tsonic/core/lang.js";
    import * as core from "@tsonic/core/lang.js";
    convert(raw, uint32Layout); core.reinterpretrawptr(raw, uint32Layout);
    function local(raw: RawPointer | undefined) { return raw; }
    { const reinterpretrawptr = local; reinterpretrawptr(raw); }
  `);
  assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "convert"))?.operation, "reinterpret");
  const calls = memoryCalls(checked, "reinterpretrawptr");
  assert.equal(calls.length, 2);
  assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, calls[0])?.operation, "reinterpret");
  assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, calls[1]), undefined);
});

test("source memory descriptors retain explicit ABI, physical field identity and exact observations", () => {
  const checked = cleanMemorySession(`
    interface Header { tag: uint32; count: uint32; }
    const headerLayout = memorylayout<Header>({
      datalayout: abi,
      bytesize: 12,
      bytealignment: 4,
      stride: 12,
      fields: [memoryfield({ select: (header: Header) => header.tag, byteoffset: 0, bytealignment: 4, fieldlayout: uint32Layout }), memoryfield({ select: (header: Header) => header.count, byteoffset: 8, bytealignment: 4, fieldlayout: uint32Layout })],
    });
    sizeof(headerLayout); alignof(headerLayout); strideof(headerLayout);
    fieldoffsetof(headerLayout, header => header.count);
  `);
  const layout = readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memorylayout", 1));
  assert.ok(layout);
  assert.ok(layout.kind === "value");
  assert.equal(layout.byteSize, 12);
  assert.equal(layout.stride, 12);
  assert.equal(layout.fields.length, 2);
  assert.deepEqual(layout.fields.map((field) => field.byteOffset), [0, 8]);
  assert.equal(checked.ast.text(checked.ast.name(layout.fields[1]?.selectedDeclaration)), "count");
  assert.deepEqual(layout.dataLayout.providerDeclaration, memoryTestRegistration.providerDeclaration);
  assert.equal(readTsonicDataLayout(checked.sourceFacts, layout.dataLayoutExpression)?.fingerprint, memoryTestRegistration.descriptor.fingerprint);
  for (const [name, kind] of [["sizeof", "size"], ["alignof", "alignment"], ["strideof", "stride"], ["fieldoffsetof", "field-offset"]] as const) {
    const query = readTsonicMemoryLayoutQuery(checked.sourceFacts, memoryCall(checked, name));
    assert.equal(query?.operation, kind);
    assert.equal(readTsonicMemoryLayout(checked.sourceFacts, query?.layoutExpression)?.call, layout.call);
  }
  const query = readTsonicMemoryLayoutQuery(checked.sourceFacts, memoryCall(checked, "fieldoffsetof"));
  assert.equal(query?.selectedFieldDeclaration, layout.fields[1]?.selectedDeclaration);
  assert.ok(Object.isFrozen(layout.fields));
  assert.ok(Object.isFrozen(layout.fields[0]));
});

test("layout fields infer their selector receiver from the enclosing layout", () => {
  const checked = cleanMemorySession(`
    interface Header { count: uint32; }
    memorylayout<Header>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [memoryfield({ select: header => header.count, byteoffset: 0, bytealignment: 4, fieldlayout: uint32Layout })] });
  `);
  assert.ok(checked.sourceFacts.getFact(memoryCall(checked, "memoryfield"), tsonicMemoryFieldLayoutFactKey));
});

test("value-shape layouts consume finalized fields selected through marker aliases and namespaces", () => {
  const checked = cleanMemorySession(`
    import { struct as valueShape, field as slot } from "@tsonic/core/lang.js";
    import * as core from "@tsonic/core/lang.js";
    const Header = valueShape({ first: slot<uint32>(), second: core.field<uint32>() });
    type HeaderValue = typeof Header;
    const header = memorylayout<HeaderValue>({
      datalayout: abi,
      bytesize: 8,
      bytealignment: 4,
      stride: 8,
      fields: [memoryfield({ select: (value: HeaderValue) => value.first, byteoffset: 0, bytealignment: 4, fieldlayout: uint32Layout }), memoryfield({ select: (value: HeaderValue) => value.second, byteoffset: 4, bytealignment: 4, fieldlayout: uint32Layout })],
    });
    fieldoffsetof(header, value => value.first);
    fieldoffsetof(header, value => value.second);
  `);
  const layout = readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memorylayout", 1));
  assert.ok(layout);
  assert.ok(layout.kind === "value");
  assert.equal(layout.fields.length, 2);
  for (const [index, field] of layout.fields.entries()) {
    assert.equal(checked.ast.kindName(field.selectedDeclaration), "KindPropertyAssignment");
    assert.ok(checked.sourceFacts.getFact(field.selectedDeclaration, fieldFactKey));
    const query = readTsonicMemoryLayoutQuery(checked.sourceFacts, memoryCall(checked, "fieldoffsetof", index));
    assert.equal(query?.selectedFieldDeclaration, field.selectedDeclaration);
    assert.equal(field.byteOffset, index * 4);
    assert.ok(Object.isFrozen(field));
  }
});

for (const [label, declaration, receiver] of [
  ["unmarked assignment", "const Shape = { value: 1 as uint32 };", "typeof Shape"],
  ["same-spelled field function", "function field(): uint32 { return 1; } const Shape = { value: field() };", "typeof Shape"],
  ["getter", "const Shape = { get value(): uint32 { return 1; } };", "typeof Shape"],
  ["optional declaration", "interface Shape { value?: uint32 }", "Shape"],
] as const) {
  test(`physical-field selection rejects ${label} in builders and queries`, () => {
    const checked = memorySession(memoryTestPrelude + `
      ${declaration}
      const shapeLayout = memorylayout<${receiver}>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });
      memoryfield({
        select: (value: ${receiver}) => value.value,
        byteoffset: 0,
        bytealignment: 4,
        fieldlayout: memorylayout<${label === "optional declaration" ? "uint32 | undefined" : "uint32"}>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] }),
      });
      fieldoffsetof(shapeLayout, value => value.value);
    `);
    assert.equal(checked.diagnostics.filter(Boolean).length, 0);
    assert.deepEqual(checked.extensionDiagnostics.map(diagnostic => diagnostic.extensionCode).sort(), [
      "SOURCE_CORE_MEMORY_FIELD_NOT_PROVEN", "SOURCE_CORE_MEMORY_QUERY_FIELD_NOT_PROVEN",
    ]);
    assert.equal(checked.sourceFacts.getFact(memoryCall(checked, "memoryfield"), tsonicMemoryFieldLayoutFactKey), undefined);
    assert.equal(readTsonicMemoryLayoutQuery(checked.sourceFacts, memoryCall(checked, "fieldoffsetof")), undefined);
  });
}

test("layout aliases demand the exact initializer independent of source-file order", () => {
  const checked = memorySession(memoryTestPrelude + `
    import { layout } from "./layout.js";
    const alias = layout;
    sizeof(alias);
  `, { extraFiles: { "/src/layout.ts": `
    import { abi } from "test:abi";
    import type { uint32 } from "@tsonic/core/types.js";
    import { memorylayout } from "@tsonic/core/lang.js";
    export const layout = memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: 4, fields: [] });
  ` } });
  assertMemoryDiagnostics(checked);
  const query = readTsonicMemoryLayoutQuery(checked.sourceFacts, memoryCall(checked, "sizeof"));
  assert.equal(readTsonicMemoryLayout(checked.sourceFacts, query?.layoutExpression)?.byteSize, 4);
});

for (const [type, value, base, signedness, width] of [
  ["int8", "1", "number", "signed", 8], ["uint8", "1", "number", "unsigned", 8],
  ["int16", "1", "number", "signed", 16], ["uint16", "1", "number", "unsigned", 16],
  ["int32", "1", "number", "signed", 32], ["uint32", "1", "number", "unsigned", 32],
  ["int64", "-4n", "bigint", "signed", 64], ["uint64", "4n", "bigint", "unsigned", 64],
  ["int128", "4n", "bigint", "signed", 128], ["uint128", "4n", "bigint", "unsigned", 128],
  ["nativeInt", "1", "number", "signed", 64], ["nativeUint", "1", "number", "unsigned", 64],
] as const) {
  test(`byte offsets retain the exact ${type} domain`, () => {
    const checked = cleanMemorySession(`
      import type { ${type} as Offset } from "@tsonic/core/types.js";
      const amount: Offset = ${value};
      offsetrawptr(raw, amount, abi);
    `);
    const fact = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetrawptr"));
    assert.ok(fact?.operation === "byte-offset");
    assert.equal(fact.offsetRuntimeBase, base);
    assert.equal(fact.offsetSignedness, signedness);
    assert.equal(fact.offsetWidth, width);
  });
}

for (const expression of ["4", "-4", "4n", "-4n"]) {
  test(`byte offsets accept exact in-range unmarked constant ${expression}`, () => {
    const checked = cleanMemorySession(`offsetrawptr(raw, ${expression}, abi);`);
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetrawptr"))?.operation, "byte-offset");
  });
}

for (const [declaration, expression] of [
  ["", "1.5"], ["", "9223372036854775808n"], ["", "9007199254740993"],
  ["declare const amount: number;", "amount"], ["declare const amount: bigint;", "amount"],
  ['import type { float64 } from "@tsonic/core/types.js"; const amount: float64 = 4;', "amount"],
  ['import type { int8 } from "@tsonic/core/types.js"; const amount: int8 = 256;', "amount"],
] as const) {
  test(`byte offsets reject an unproved or out-of-range domain: ${declaration} ${expression}`, () => {
    const checked = memorySession(memoryTestPrelude + `${declaration} offsetrawptr(raw, ${expression}, abi);`);
    assert.ok(checked.extensionDiagnostics.some((entry) => entry.extensionCode === "SOURCE_CORE_MEMORY_OFFSET_INTEGER_NOT_PROVEN"));
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetrawptr")), undefined);
  });
}

test("integer conversions and keepalive retain independent exact operands", () => {
  const checked = cleanMemorySession(`
    const address: uint64 = rawptrtoaddressinteger<uint64>(raw, abi);
    const restored = addressintegertorawptr(address, abi);
    keepalive(ordinary);
  `);
  assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "rawptrtoaddressinteger"))?.operation, "raw-to-address-integer");
  assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "addressintegertorawptr"))?.operation, "address-integer-to-raw");
  const call = memoryCall(checked, "keepalive");
  assert.equal(readTsonicKeepAlive(checked.sourceFacts, call)?.valueExpression, checked.ast.arguments(call)[0]);
});

test("nested same-line raw operations have distinct fact subjects", () => {
  const checked = cleanMemorySession("reinterpretrawptr(offsetrawptr(raw, 4, abi), uint32Layout);");
  const outer = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "reinterpretrawptr"));
  const inner = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, "offsetrawptr"));
  assert.ok(outer?.operation === "reinterpret" && inner?.operation === "byte-offset");
  assert.notEqual(outer.call, inner.call);
  assert.equal(outer.rawExpression, inner.call);
});

test("declaration-only marker occurrences do not produce runtime memory facts", () => {
  const checked = memorySession(memoryTestPrelude + `
    declare class Ambient { [keepalive(raw)]: never; }
    interface Shape { [keepalive(raw)]: never; }
  `);
  for (const call of memoryCalls(checked, "keepalive")) assert.equal(readTsonicKeepAlive(checked.sourceFacts, call), undefined);
});

test("unregistered layout tokens fail without publishing a layout", () => {
  const checked = memorySession(memoryTestPrelude, { registrations: [] });
  assert.ok(checked.extensionDiagnostics.some((entry) => entry.extensionCode === "SOURCE_CORE_MEMORY_LAYOUT_NOT_PROVEN"));
  assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memorylayout")), undefined);
});

test("ABI providers cannot publish source-core-owned layout facts or commit the failed transaction", () => {
  let attempted = false;
  assert.throws(() => memorySession(memoryTestPrelude, { extensions: [{
    identity: { id: "test.illegal-writer", version: "1" },
    dependencies: { dependsOn: [tsonicCoreSourceExtensionId] },
    analyzeSource(context) {
      const subject = {};
      const result = context.facts.set(subject, tsonicDataLayoutFactKey, {
        ...memoryTestRegistration.descriptor, providerDeclaration: memoryTestRegistration.providerDeclaration,
      });
      assert.equal(result, "conflict");
      assert.equal(context.facts.has(subject, tsonicDataLayoutFactKey), false);
      attempted = true;
    },
  }] }), /Cannot commit an extension fact transaction after a fact write failed/u);
  assert.equal(attempted, true);
});

test("missing public source facts stay missing without reconstruction", () => {
  const checked = cleanMemorySession("");
  const subject = memoryCall(checked, "memorylayout");
  assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, subject), undefined);
  assert.equal(readTsonicKeepAlive(checked.sourceFacts, subject), undefined);
  assert.equal(checked.sourceFacts.getFact(subject, tsonicRawMemoryOperationFactKey), undefined);
  assert.ok(checked.sourceFacts.getFact(subject, tsonicMemoryLayoutFactKey));
});
