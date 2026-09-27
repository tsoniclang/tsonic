import assert from "node:assert/strict";
import { test } from "node:test";
import { readTsonicMemoryLayout, readTsonicMemoryType, selectTsonicRawLocationOperation } from "../../public/facts.js";
import { checkedRecords, recordIdentity, recordLayouts, recordPrelude } from "./closed-record-fixtures.js";
import { memoryCall, memoryCalls } from "./fixtures.js";

test("independently authored inline child records retain exact field/layout memory identity", () => {
  const checked = checkedRecords(`
    const Parent: { child: { count: int64 } } = struct({ child: field<{ count: int64 }>() });
    const Child: { count: int64 } = struct({ count: field<int64>() });
    const word = memorylayout<int64>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
    const childLayout = memorylayout<typeof Child>({
      datalayout: abi,
      bytesize: 8,
      bytealignment: 8,
      stride: 8,
      fields: [memoryfield({ select: (child: typeof Child) => child.count, byteoffset: 0, bytealignment: 8, fieldlayout: word })],
    });
    const parentLayout = memorylayout<typeof Parent>({
      datalayout: abi,
      bytesize: 8,
      bytealignment: 8,
      stride: 8,
      fields: [memoryfield({ select: (parent: typeof Parent) => parent.child, byteoffset: 0, bytealignment: 8, fieldlayout: childLayout })],
    });
    const pointer = allocateptr<{ count: int64 }>({ count: 1n });
    torawptr<{ count: int64 }>(pointer, childLayout);
  `);
  const layout = readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memorylayout", 1));
  assert.ok(layout);
  const field = readTsonicMemoryType(checked.sourceFacts, memoryCall(checked, "memoryfield", 1));
  assert.ok(field);
  assert.equal(field.identity, recordIdentity(checked, layout.call));
  const raw = selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, memoryCall(checked, "torawptr"));
  assert.ok(raw?.kind === "resolved");
  assert.equal(raw.memoryType, field.identity);
  assert.ok(raw.operation.pointeeType !== layout.sourceType);
});

for (const [name, declarations, first, second] of [
  ["interfaces", "interface First { count: int64 } interface Second { count: int64 }", "First", "Second"],
  ["type aliases", "type First = { count: int64 }; type Second = { count: int64 };", "First", "Second"],
  ["inherited members", "interface Base { count: int64 } interface First extends Base {} interface Second { count: int64 }", "First", "Second"],
  ["closed generic records", "interface First<Value> { count: Value } interface Second<Value> { count: Value }", "First<int64>", "Second<int64>"],
  ["nested record fields", "interface First { child: { count: int64 } } interface Second { child: { count: int64 } }", "First", "Second"],
  ["empty records", "interface First {} interface Second {}", "First", "Second"],
] as const) {
  test(`equivalent independent ${name} share a memory identity`, () => {
    const checked = checkedRecords(`
      ${declarations}
      memorylayout<Pointer<${first}>>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
      memorylayout<Pointer<${second}>>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
    `);
    const calls = memoryCalls(checked, "memorylayout");
    assert.equal(recordIdentity(checked, calls[0]!), recordIdentity(checked, calls[1]!));
  });
}

test("record declaration order and field order do not change source identity", () => {
  const checked = checkedRecords(recordLayouts);
  assert.equal(recordIdentity(checked, memoryCall(checked, "memorylayout", 2)),
    recordIdentity(checked, memoryCall(checked, "memorylayout", 3)));
});

test("existing nominal records with methods retain their physical field contracts", () => {
  checkedRecords(`
    interface Header { count: int64; reset(): void }
    const word = memorylayout<int64>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
    const layout = memorylayout<Header>({
      datalayout: abi,
      bytesize: 8,
      bytealignment: 8,
      stride: 8,
      fields: [memoryfield({ select: (value: Header) => value.count, byteoffset: 0, bytealignment: 8, fieldlayout: word })],
    });
    declare const pointer: Pointer<Header>;
    torawptr(pointer, layout);
    fieldoffsetof(layout, (value: Header) => value.count);
  `);
});

test("imported layouts join inline pointees, aliases, calls, returns and conditional pointer values", () => {
  const checked = checkedRecords(`
    import { layout } from "./barrel.js";
    const pointer = allocateptr<{ count: int64 }>({ count: 1n });
    const alias = pointer;
    declare function external(): Pointer<{ count: int64 }>;
    function identity<Value>(value: Pointer<Value>): Pointer<Value> { return value; }
    const returned = external();
    declare const flag: boolean;
    torawptr(alias, layout);
    torawptr(identity(pointer), layout);
    torawptr(returned, layout);
    torawptr(flag ? pointer : returned, layout);
    torawptr(reinterpretrawptr(torawptr(pointer, layout), layout), layout);
  `, {
    "/src/barrel.ts": 'export { layout } from "./layout.js";',
    "/src/layout.ts": recordPrelude + `
      interface Header { count: int64 }
      const word = memorylayout<int64>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
      export const layout = memorylayout<Header>({
        datalayout: abi,
        bytesize: 8,
        bytealignment: 8,
        stride: 8,
        fields: [memoryfield({ select: (value: Header) => value.count, byteoffset: 0, bytealignment: 8, fieldlayout: word })],
      });
    `,
  });
  const calls = memoryCalls(checked, "torawptr");
  assert.equal(calls.length, 6);
  for (const call of calls) {
    const selected = selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, call);
    assert.ok(selected?.kind === "resolved");
    assert.equal(selected.memoryType, recordIdentity(checked, selected.layout.call));
  }
});

test("fixed arrays retain equivalent record children and exact bigint extents", () => {
  const checked = checkedRecords(recordLayouts + `
    memoryarraylayout<First, 2n>({ datalayout: abi, bytesize: 32, bytealignment: 8, stride: 32, elementlayout: first, length: 2n });
    memoryarraylayout<Second, 2n>({ datalayout: abi, bytesize: 32, bytealignment: 8, stride: 32, elementlayout: second, length: 2n });
    memoryarraylayout<Second, 3n>({ datalayout: abi, bytesize: 48, bytealignment: 8, stride: 48, elementlayout: second, length: 3n });
  `);
  const calls = memoryCalls(checked, "memoryarraylayout");
  assert.equal(recordIdentity(checked, calls[0]!), recordIdentity(checked, calls[1]!));
  assert.notEqual(recordIdentity(checked, calls[0]!), recordIdentity(checked, calls[2]!));
});

for (const [name, first, second] of [
  ["32-bit signedness", "count: int32", "count: uint32"],
  ["64-bit signedness", "count: int64", "count: uint64"],
  ["integer width", "count: uint8", "count: uint32"],
  ["nested markers", "child: { count: int64 }", "child: { count: uint64 }"],
  ["pointer nullability", "count: Pointer<int64>", "count: Pointer<int64> | undefined"],
  ["pointer depth", "count: Pointer<int64>", "count: Pointer<Pointer<int64>>"],
  ["raw versus typed", "count: RawPointer", "count: Pointer<int64>"],
  ["optional member", "count: int64", "count?: int64"],
  ["readonly member", "count: int64", "readonly count: int64"],
  ["missing member", "count: int64; tag: uint8", "count: int64"],
  ["different selected field", "count: int64", "size: int64"],
] as const) {
  test(`independent record identity preserves ${name}`, () => {
    const checked = checkedRecords(`
      interface First { ${first} }
      interface Second { ${second} }
      memorylayout<Pointer<First>>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
      memorylayout<Pointer<Second>>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
    `);
    assert.notEqual(recordIdentity(checked, memoryCall(checked, "memorylayout")),
      recordIdentity(checked, memoryCall(checked, "memorylayout", 1)));
  });
}

for (const [signed, unsigned, size] of [["int32", "uint32", 4], ["int64", "uint64", 8]] as const) {
  test(`checker-equal ${signed}/${unsigned} records cannot share raw storage`, () => {
    checkedRecords(`
      interface Signed { count: ${signed} }
      interface Unsigned { count: ${unsigned} }
      const word = memorylayout<${signed}>({ datalayout: abi, bytesize: ${size}, bytealignment: ${size}, stride: ${size}, fields: [] });
      const layout = memorylayout<Signed>({
        datalayout: abi,
        bytesize: ${size},
        bytealignment: ${size},
        stride: ${size},
        fields: [memoryfield({ select: (value: Signed) => value.count, byteoffset: 0, bytealignment: ${size}, fieldlayout: word })],
      });
      declare const pointer: Pointer<Unsigned>;
      torawptr(pointer, layout);
    `, {}, ["SOURCE_CORE_MEMORY_POINTEE_LAYOUT_NOT_PROVEN"]);
  });
}

test("open and unproven computed record domains remain rejected", () => {
  checkedRecords(`
    function layout<Value>(value: Value) {
      const record = { value };
      return memorylayout<typeof record>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
    }
    type Computed<Value> = Value extends int64 ? { count: Value } : never;
    memorylayout<Computed<int64>>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
  `, {}, ["SOURCE_CORE_MEMORY_TYPE_NOT_PROVEN", "SOURCE_CORE_MEMORY_TYPE_NOT_PROVEN"]);
});
