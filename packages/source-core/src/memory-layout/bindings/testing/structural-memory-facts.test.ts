import assert from "node:assert/strict";
import test from "node:test";
import type { ReadonlySourceFactResolver } from "@tsonic/tsts";
import { selectTsonicMemoryFieldBindingFacts, selectTsonicMemoryRecordBindingFacts } from "../selection.js";
import { selectTsonicRawLocationFacts } from "../../../pointers/raw-memory/selection.js";
import { tsonicRawMemoryOperationFactKey } from "../../../pointers/raw-memory/facts.js";
import { tsonicMemoryTypeFactKey } from "../../type-contract/facts.js";
import { memoryCall, memoryCalls } from "../../testing/fixtures.js";
import { bindingSession, boundRecordSource } from "./fixtures.js";

function structuralFacts(facts: ReadonlySourceFactResolver): ReadonlySourceFactResolver {
  return {
    getFact(subject, key) {
      assert.equal(Object.is(key, tsonicMemoryTypeFactKey), false,
        "The structural selection never consumes the legacy cross-body domain identity.");
      return facts.getFact(subject, key);
    },
    getFacts() { return assert.fail("Structural selection does not enumerate the extension fact store."); },
    getVirtualDeclarationDocument: name => facts.getVirtualDeclarationDocument(name),
  };
}

test("raw location facts retain exact selected operands and layouts without legacy domain reads", () => {
  const checked = bindingSession(`
    const pointer = allocateptr<uint32>(7);
    const raw = torawptr(pointer, word);
    reinterpretrawptr<uint32>(raw, word);
  `);
  const facts = structuralFacts(checked.sourceFacts);
  for (const name of ["torawptr", "reinterpretrawptr"]) {
    const call = memoryCall(checked, name);
    const selected = selectTsonicRawLocationFacts(checked.ast, facts, call);
    assert.equal(selected?.kind, "resolved");
    if (selected?.kind !== "resolved") return;
    assert.equal(selected.operation.call === call && selected.layout.call !== call, true);
    assert.equal(checked.ast.arguments(call)[0] === selected.expression, true);
  }
});

test("field and record facts preserve selected field order without legacy domain reads", () => {
  const checked = bindingSession(boundRecordSource);
  const facts = structuralFacts(checked.sourceFacts);
  for (const call of memoryCalls(checked, "bindmemoryfield")) {
    assert.equal(selectTsonicMemoryFieldBindingFacts(checked.ast, facts, call)?.kind, "resolved");
  }
  const selected = selectTsonicMemoryRecordBindingFacts(checked.ast, facts, memoryCall(checked, "bindmemoryrecord"));
  assert.equal(selected?.kind, "resolved");
  if (selected?.kind !== "resolved") return;
  assert.equal(selected.operation.fields.length, 2);
  assert.equal(selected.operation.fields[0]!.binding.field.selectedDeclaration ===
    selected.operation.layout.fields[1]!.selectedDeclaration, true);
  assert.equal(selected.operation.fields[1]!.binding.field.selectedDeclaration ===
    selected.operation.layout.fields[0]!.selectedDeclaration, true);
});

test("structural raw selection still rejects a changed selected layout operand", () => {
  const checked = bindingSession(`torawptr(allocateptr<uint32>(7), word);`);
  const call = memoryCall(checked, "torawptr");
  const facts = structuralFacts({
    getFact(subject, key) {
      const value = checked.sourceFacts.getFact(subject, key);
      return value !== undefined && Object.is(key, tsonicRawMemoryOperationFactKey)
        ? { ...value, layoutExpression: call } : value;
    },
    getFacts: subject => checked.sourceFacts.getFacts(subject),
    getVirtualDeclarationDocument: name => checked.sourceFacts.getVirtualDeclarationDocument(name),
  });
  const selected = selectTsonicRawLocationFacts(checked.ast, facts, call);
  assert.equal(selected?.kind, "rejected");
  if (selected?.kind !== "rejected") return;
  assert.equal(selected.reason, "Raw location conversion requires its exact selected operands and finalized layout/ABI identity.");
});
