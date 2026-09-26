import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReadonlySourceFactResolver } from "@tsonic/tsts";
import { createTargetSourceProgram } from "@tsonic/target-api/source";
import { createTsonicPointerBackingDemands } from "../../pointers/backing/demands.js";
import { selectTsonicMemoryFieldBinding, selectTsonicMemoryRecordBinding } from "../bindings/selection.js";
import { readTsonicMemoryLayout, resolveTsonicMemoryLayoutObservation } from "../readers.js";
import { tsonicMemoryFieldLayoutFactKey, tsonicMemoryLayoutFactKey, tsonicMemoryLayoutQueryFactKey } from "../facts.js";
import { tsonicMemoryTypeFactKey } from "../type-contract/facts.js";
import { checkedRecords, recordIdentity, recordLayouts, recordPrelude } from "./closed-record-fixtures.js";
import { memoryCall, memoryCalls, valueMemoryLayout } from "./fixtures.js";

test("record bindings preserve exact field locations across equivalent owner declarations", () => {
  const checked = checkedRecords(recordLayouts + `
    const count = memoryfield({ select: (value: First) => value.count, byteoffset: 0, bytealignment: 8, fieldlayout: word });
    const tag = memoryfield({ select: (value: First) => value.tag, byteoffset: 8, bytealignment: 1, fieldlayout: byte });
    const layout = memorylayout<First>({ datalayout: abi, bytesize: 16, bytealignment: 8, stride: 16, fields: [count, tag] });
    const countBinding = bindmemoryfield<Second, int64>(count, allocateptr<int64>(7n));
    const tagBinding = bindmemoryfield<Second, uint8>(tag, allocateptr<uint8>(3));
    const record = bindmemoryrecord<Second>(layout, tagBinding, countBinding);
    torawptr(allocateptr(record), second);
  `);
  for (const call of memoryCalls(checked, "bindmemoryfield")) {
    assert.equal(selectTsonicMemoryFieldBinding(checked.ast, checked.sourceFacts, call)?.kind, "resolved");
  }
  const binding = selectTsonicMemoryRecordBinding(checked.ast, checked.sourceFacts, memoryCall(checked, "bindmemoryrecord"));
  assert.ok(binding?.kind === "resolved");
  assert.equal(recordIdentity(checked, binding.operation.call), recordIdentity(checked, binding.operation.layout.call));
});

test("field observations keep the authored selector and prove its corresponding physical member", () => {
  const checked = checkedRecords(recordLayouts + `
    fieldoffsetof(first, (value: Second) => value.count);
    fieldoffsetof<First, uint8>(second, (value: First) => value.tag);
  `);
  const calls = memoryCalls(checked, "fieldoffsetof");
  for (const [index, offset] of [0, 8].entries()) {
    const selected = resolveTsonicMemoryLayoutObservation(checked.sourceFacts, calls[index]!);
    assert.ok(selected?.kind === "resolved");
    assert.equal(selected.value, offset);
    const layout = valueMemoryLayout(selected.layout);
    assert.ok(layout.fields.every(field => field.selectedDeclaration !== selected.query.selectedFieldDeclaration));
  }
});

for (const swapped of [false, true]) {
  test(`independent imported record backing demands ${swapped ? "reject shifted fields" : "agree despite declaration order"}`, () => {
    const checked = checkedRecords(recordLayouts + `
      import { remote } from "./layout.js";
      const pointer = allocateptr<First>({ count: 1n, tag: 2 });
      torawptr(pointer, first);
      torawptr(pointer, remote);
    `, {
      "/src/layout.ts": recordPrelude + `
        interface Remote { tag: uint8; count: int64 }
        const word = memorylayout<int64>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
        const byte = memorylayout<uint8>({ datalayout: abi, bytesize: 1, bytealignment: 1, stride: 1, fields: [] });
        export const remote = memorylayout<Remote>({
          datalayout: abi,
          bytesize: 16,
          bytealignment: 8,
          stride: 16,
          fields: [memoryfield({ select: (value: Remote) => value.tag, byteoffset: ${swapped ? 0 : 8}, bytealignment: 1, fieldlayout: byte }), memoryfield({ select: (value: Remote) => value.count, byteoffset: ${swapped ? 8 : 0}, bytealignment: 8, fieldlayout: word })],
        });
      `,
    });
    const source = createTargetSourceProgram(checked);
    const calls = memoryCalls(checked, "torawptr");
    for (const order of [calls, [...calls].reverse()]) {
      const demands = createTsonicPointerBackingDemands(source);
      for (const call of order) demands.record(call);
      assert.equal(demands.entries().length, 1);
      assert.deepEqual(demands.issues().map(issue => issue.reason), swapped
        ? ["One pointer origin has incompatible physical layout demands."] : []);
    }
  });
}

for (const [name, bindings] of [
  ["duplicate", "firstBinding, firstBinding"],
  ["unrelated", "firstBinding, unrelatedBinding"],
] as const) {
  test(`equivalent records still reject ${name} explicit field bindings`, () => {
    checkedRecords(recordLayouts + `
      const count = memoryfield({ select: (value: First) => value.count, byteoffset: 0, bytealignment: 8, fieldlayout: word });
      const tag = memoryfield({ select: (value: First) => value.tag, byteoffset: 8, bytealignment: 1, fieldlayout: byte });
      const unrelated = memoryfield({ select: (value: Second) => value.tag, byteoffset: 8, bytealignment: 1, fieldlayout: byte });
      const layout = memorylayout<First>({ datalayout: abi, bytesize: 16, bytealignment: 8, stride: 16, fields: [count, tag] });
      const firstBinding = bindmemoryfield(count, allocateptr<int64>(1n));
      const unrelatedBinding = bindmemoryfield(unrelated, allocateptr<uint8>(1));
      bindmemoryrecord<Second>(layout, ${bindings});
    `, {}, ["SOURCE_CORE_MEMORY_RECORD_FIELD_BINDINGS_NOT_PROVEN"]);
  });
}

test("a copied equivalent declaration cannot replace an authored field or offset selection", () => {
  const checked = checkedRecords(recordLayouts + "fieldoffsetof(first, (value: Second) => value.count);");
  const layout = valueMemoryLayout(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memorylayout", 2)));
  const peer = valueMemoryLayout(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memorylayout", 3)));
  const queryCall = memoryCall(checked, "fieldoffsetof");
  const field = layout.fields[0]!;
  const other = peer.fields[1]!;
  assert.ok(field.selectedDeclaration !== other.selectedDeclaration);
  for (const mutation of ["field-declaration", "query-declaration", "missing-query-contract", "foreign-query-contract"] as const) {
    const foreign = mutation === "foreign-query-contract"
      ? checkedRecords(recordLayouts + "fieldoffsetof(first, (value: Second) => value.count);") : undefined;
    const replacement = { ...field, selectedDeclaration: other.selectedDeclaration, selectedSymbol: other.selectedSymbol };
    const rewritten = { ...layout, fields: [replacement, ...layout.fields.slice(1)] };
    const facts: ReadonlySourceFactResolver = {
      ...checked.sourceFacts,
      getFact(subject, key) {
        const value = checked.sourceFacts.getFact(subject, key);
        if (mutation === "field-declaration") {
          if (Object.is(key, tsonicMemoryLayoutFactKey) && value !== undefined && (value as typeof layout).call === layout.call) {
            return rewritten as typeof value;
          }
          if (Object.is(key, tsonicMemoryFieldLayoutFactKey) && subject === field.call) return replacement as typeof value;
        }
        if (mutation === "query-declaration" && Object.is(key, tsonicMemoryLayoutQueryFactKey) && subject === queryCall) {
          return { ...value, selectedFieldDeclaration: field.selectedDeclaration } as typeof value;
        }
        if (Object.is(key, tsonicMemoryTypeFactKey) && subject === queryCall) {
          if (mutation === "missing-query-contract") return undefined;
          if (foreign !== undefined) return foreign.sourceFacts.getFact(memoryCall(foreign, "fieldoffsetof"), key);
        }
        return value;
      },
    };
    assert.equal(resolveTsonicMemoryLayoutObservation(facts, queryCall)?.kind, "rejected", mutation);
  }
});

test("separate declarations cannot bind the same logical field twice in one layout", () => {
  checkedRecords(`
    interface First { count: int64 }
    interface Second { count: int64 }
    const word = memorylayout<int64>({ datalayout: abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
    memorylayout<First>({
      datalayout: abi,
      bytesize: 16,
      bytealignment: 8,
      stride: 16,
      fields: [memoryfield({ select: (value: First) => value.count, byteoffset: 0, bytealignment: 8, fieldlayout: word }), memoryfield({ select: (value: Second) => value.count, byteoffset: 8, bytealignment: 8, fieldlayout: word })],
    });
  `, {}, ["SOURCE_CORE_MEMORY_LAYOUT_FIELD_NOT_PROVEN"]);
});
