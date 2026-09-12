import assert from "node:assert/strict";
import { test } from "node:test";
import { readTsonicMemoryLayout, readTsonicMemoryType, selectTsonicRawLocationOperation } from "../../public/facts.js";
import { checkedRecords, recordIdentity, recordLayouts, recordPrelude } from "./closed-record-fixtures.js";
import { memoryCall, memoryCalls } from "./fixtures.js";

test("independently authored inline child records retain exact field/layout memory identity", () => {
  const checked = checkedRecords(`
    const Parent: { child: { count: int64 } } = struct({ child: field<{ count: int64 }>() });
    const Child: { count: int64 } = struct({ count: field<int64>() });
    const word = memoryLayout<int64>(abi, 8, 8, 8);
    const childLayout = memoryLayout<typeof Child>(abi, 8, 8, 8,
      memoryField((child: typeof Child) => child.count, 0, 8, word));
    const parentLayout = memoryLayout<typeof Parent>(abi, 8, 8, 8,
      memoryField((parent: typeof Parent) => parent.child, 0, 8, childLayout));
    const pointer = allocatePointer<{ count: int64 }>({ count: 1n });
    toRawPointer<{ count: int64 }>(pointer, childLayout);
  `);
  const layout = readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memoryLayout", 1));
  assert.ok(layout);
  const field = readTsonicMemoryType(checked.sourceFacts, memoryCall(checked, "memoryField", 1));
  assert.ok(field);
  assert.equal(field.identity, recordIdentity(checked, layout.call));
  const raw = selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, memoryCall(checked, "toRawPointer"));
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
      memoryLayout<Pointer<${first}>>(abi, 8, 8, 8);
      memoryLayout<Pointer<${second}>>(abi, 8, 8, 8);
    `);
    const calls = memoryCalls(checked, "memoryLayout");
    assert.equal(recordIdentity(checked, calls[0]!), recordIdentity(checked, calls[1]!));
  });
}

test("record declaration order and field order do not change source identity", () => {
  const checked = checkedRecords(recordLayouts);
  assert.equal(recordIdentity(checked, memoryCall(checked, "memoryLayout", 2)),
    recordIdentity(checked, memoryCall(checked, "memoryLayout", 3)));
});

test("existing nominal records with methods retain their physical field contracts", () => {
  checkedRecords(`
    interface Header { count: int64; reset(): void }
    const word = memoryLayout<int64>(abi, 8, 8, 8);
    const layout = memoryLayout<Header>(abi, 8, 8, 8,
      memoryField((value: Header) => value.count, 0, 8, word));
    declare const pointer: Pointer<Header>;
    toRawPointer(pointer, layout);
    fieldOffsetOf(layout, (value: Header) => value.count);
  `);
});

test("imported layouts join inline pointees, aliases, calls, returns and conditional pointer values", () => {
  const checked = checkedRecords(`
    import { layout } from "./barrel.js";
    const pointer = allocatePointer<{ count: int64 }>({ count: 1n });
    const alias = pointer;
    declare function external(): Pointer<{ count: int64 }>;
    function identity<Value>(value: Pointer<Value>): Pointer<Value> { return value; }
    const returned = external();
    declare const flag: boolean;
    toRawPointer(alias, layout);
    toRawPointer(identity(pointer), layout);
    toRawPointer(returned, layout);
    toRawPointer(flag ? pointer : returned, layout);
    toRawPointer(reinterpretRawPointer(toRawPointer(pointer, layout), layout), layout);
  `, {
    "/src/barrel.ts": 'export { layout } from "./layout.js";',
    "/src/layout.ts": recordPrelude + `
      interface Header { count: int64 }
      const word = memoryLayout<int64>(abi, 8, 8, 8);
      export const layout = memoryLayout<Header>(abi, 8, 8, 8,
        memoryField((value: Header) => value.count, 0, 8, word));
    `,
  });
  const calls = memoryCalls(checked, "toRawPointer");
  assert.equal(calls.length, 6);
  for (const call of calls) {
    const selected = selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, call);
    assert.ok(selected?.kind === "resolved");
    assert.equal(selected.memoryType, recordIdentity(checked, selected.layout.call));
  }
});

test("fixed arrays retain equivalent record children and exact bigint extents", () => {
  const checked = checkedRecords(recordLayouts + `
    memoryArrayLayout<First, 2n>(abi, 32, 8, 32, first, 2n);
    memoryArrayLayout<Second, 2n>(abi, 32, 8, 32, second, 2n);
    memoryArrayLayout<Second, 3n>(abi, 48, 8, 48, second, 3n);
  `);
  const calls = memoryCalls(checked, "memoryArrayLayout");
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
      memoryLayout<Pointer<First>>(abi, 8, 8, 8);
      memoryLayout<Pointer<Second>>(abi, 8, 8, 8);
    `);
    assert.notEqual(recordIdentity(checked, memoryCall(checked, "memoryLayout")),
      recordIdentity(checked, memoryCall(checked, "memoryLayout", 1)));
  });
}

for (const [signed, unsigned, size] of [["int32", "uint32", 4], ["int64", "uint64", 8]] as const) {
  test(`checker-equal ${signed}/${unsigned} records cannot share raw storage`, () => {
    checkedRecords(`
      interface Signed { count: ${signed} }
      interface Unsigned { count: ${unsigned} }
      const word = memoryLayout<${signed}>(abi, ${size}, ${size}, ${size});
      const layout = memoryLayout<Signed>(abi, ${size}, ${size}, ${size},
        memoryField((value: Signed) => value.count, 0, ${size}, word));
      declare const pointer: Pointer<Unsigned>;
      toRawPointer(pointer, layout);
    `, {}, ["SOURCE_CORE_MEMORY_POINTEE_LAYOUT_NOT_PROVEN"]);
  });
}

test("open and unproven computed record domains remain rejected", () => {
  checkedRecords(`
    function layout<Value>(value: Value) {
      const record = { value };
      return memoryLayout<typeof record>(abi, 8, 8, 8);
    }
    type Computed<Value> = Value extends int64 ? { count: Value } : never;
    memoryLayout<Computed<int64>>(abi, 8, 8, 8);
  `, {}, ["SOURCE_CORE_MEMORY_TYPE_NOT_PROVEN", "SOURCE_CORE_MEMORY_TYPE_NOT_PROVEN"]);
});
