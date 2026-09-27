import assert from "node:assert/strict";
import { test } from "node:test";
import { checkedRecords, recordIdentity, recordPrelude } from "./closed-record-fixtures.js";
import { memoryCall, memoryCalls } from "./fixtures.js";
import { createMemoryDomainRelation } from "../type-contract/relations.js";
import type { MemoryTypeDomain } from "../type-contract/domains.js";

for (const signed of [true, false]) {
  test(`recursive record comparison ${signed ? "retains equivalent cycles" : "rejects a conflicting leaf after a cycle"}`, () => {
    const checked = checkedRecords(`
      interface First { next: Pointer<First> | undefined; count: int64 }
      interface Second { next: Pointer<Second> | undefined; count: ${signed ? "int64" : "uint64"} }
      memorylayout<Pointer<First>>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
      memorylayout<Pointer<Second>>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
    `);
    const first = recordIdentity(checked, memoryCall(checked, "memorylayout"));
    const second = recordIdentity(checked, memoryCall(checked, "memorylayout", 1));
    assert.equal(first === second, signed);
  });
}

test("shared record subgraphs are compared once per pair rather than expanded as trees", () => {
  const declarations = ["interface First0 { count: int64 }", "interface Second0 { count: int64 }"];
  for (let depth = 1; depth <= 24; depth += 1) {
    declarations.push(`interface First${depth} { left: First${depth - 1}; right: First${depth - 1} }`,
      `interface Second${depth} { right: Second${depth - 1}; left: Second${depth - 1} }`);
  }
  const checked = checkedRecords(declarations.join("\n") + `
    memorylayout<Pointer<First24>>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
    memorylayout<Pointer<Second24>>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
  `);
  assert.equal(recordIdentity(checked, memoryCall(checked, "memorylayout")),
    recordIdentity(checked, memoryCall(checked, "memorylayout", 1)));
});

test("many independently authored imported records share one program-scoped identity", () => {
  const count = 32;
  const files = Object.fromEntries(Array.from({ length: count }, (_, index) => [
    `/src/record${index}.ts`, recordPrelude + `
      export interface Record${index} { count: int64 }
      export const layout = memorylayout<Pointer<Record${index}>>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
    `,
  ]));
  const source = Array.from({ length: count }, (_, index) => `
    import { layout as layout${index} } from "./record${index}.js";
    declare const raw${index}: RawPointer | undefined;
    reinterpretrawptr(raw${index}, layout${index});
  `).join("\n");
  const checked = checkedRecords(source, files);
  const calls = memoryCalls(checked, "reinterpretrawptr");
  assert.equal(calls.length, count);
  assert.equal(new Set(calls.map(call => recordIdentity(checked, call))).size, 1);
  const foreign = checkedRecords(source, files);
  assert.notEqual(recordIdentity(checked, calls[0]!), recordIdentity(foreign, memoryCall(foreign, "reinterpretrawptr")));
});

test("record correspondence beyond the proof depth remains a bounded rejection", () => {
  const checked = checkedRecords("");
  const source = checked.getSourceFile("/src/index.ts");
  assert.ok(source);
  const equal = createMemoryDomainRelation(checked.getSourceFileQueries(source), () => undefined, () => undefined);
  const leaf: MemoryTypeDomain = Object.freeze({ kind: "source", key: 0, children: [], head: undefined });
  function nested(depth: number): MemoryTypeDomain {
    let domain = leaf;
    for (let index = 0; index < depth; index += 1) {
      domain = Object.freeze({ kind: "pointer", key: index + 1, children: Object.freeze([domain]), head: "readwrite" });
    }
    return domain;
  }
  assert.equal(equal(nested(24), nested(24)), true);
  assert.equal(equal(nested(140), nested(140)), false);
});
