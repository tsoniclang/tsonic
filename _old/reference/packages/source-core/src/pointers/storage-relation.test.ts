import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageQuery } from "@tsonic/target-api/analysis";
import { createTargetSourceProgram } from "@tsonic/target-api/source";
import { cleanMemorySession, memoryCalls } from "../memory-layout/testing/fixtures.js";
import { tsonicRawMemoryOperationFactKey } from "../host-input/raw-memory-facts.js";
import { createTsonicPointerStorageRelation } from "./storage-relation.js";

function fixture(text: string) {
  const checked = cleanMemorySession(`
    import { allocateptr, addressof, bindptr, projectptr } from "@tsonic/core/lang.js";
    ${text}
  `);
  const source = createTargetSourceProgram(checked);
  const storage = createSourceStorageQuery(source, source.sourceFiles);
  const relation = createTsonicPointerStorageRelation(source, storage);
  const selections = memoryCalls(checked, "torawptr").map(call => {
    const operation = source.sourceFacts.getFact(call, tsonicRawMemoryOperationFactKey);
    assert.equal(operation?.operation === "to-raw", true, "The checked raw use owns its exact pointer expression.");
    if (operation?.operation !== "to-raw") throw new Error("Missing checked pointer use.");
    return relation.value(operation.pointerExpression);
  });
  return { checked, source, storage, relation, selections };
}

test("pointer storage selects checked physical allocation and address producers", () => {
  const current = fixture(`
    let value: uint32 = 1;
    torawptr(allocateptr<uint32>(value), uint32Layout);
    torawptr(addressof(value), uint32Layout);
  `);
  assert.equal(current.selections.length, 2);
  for (const [index, selected] of current.selections.entries()) {
    assert.equal(selected.kind, "complete");
    if (selected.kind !== "complete") return;
    assert.equal(selected.includesAbsence, false);
    assert.equal(selected.producers.length, 1);
    const producer = selected.producers[0]!;
    assert.equal(producer.operation.operation, index === 0 ? "allocate" : "address-of");
    assert.equal(producer.storage.subject.node === producer.operation.call, true);
    assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.producers), true);
  }
});

test("pointer storage keeps separate activations of one allocation AST", () => {
  const current = fixture(`
    function make(value: uint32): Pointer<uint32> { return allocateptr<uint32>(value); }
    torawptr(make(1), uint32Layout);
    torawptr(make(2), uint32Layout);
  `);
  const [first, second] = current.selections;
  assert.equal(first?.kind === "complete" && second?.kind === "complete", true);
  if (first?.kind !== "complete" || second?.kind !== "complete") return;
  assert.equal(first.producers.length === 1 && second.producers.length === 1, true);
  assert.equal(first.producers[0]!.operation === second.producers[0]!.operation, true);
  assert.equal(first.producers[0]!.storage.bindings === second.producers[0]!.storage.bindings, false,
    "One checked allocation site retains two distinct actual caller activations.");
});

test("pointer storage preserves absence through an aliased source return", () => {
  const current = fixture(`
    function make(flag: boolean): Pointer<uint32> | undefined {
      const absent = void 0;
      return flag ? allocateptr<uint32>(1) : absent;
    }
    torawptr(make(true), uint32Layout);
  `);
  const selected = current.selections[0]!;
  assert.equal(selected.kind, "complete");
  if (selected.kind !== "complete") return;
  assert.equal(selected.includesAbsence, true);
  assert.equal(selected.producers.length, 1);
});

test("pointer storage keeps an annotated exported parameter as an open checked return boundary", () => {
  const current = fixture(`
    export function pass(value: Pointer<uint32>): Pointer<uint32> { return value; }
  `);
  const declaration = current.storage.nodes.find(node => current.source.ast.is.IsFunctionDeclaration(node) &&
    current.source.ast.text(current.source.ast.name(node)) === "pass");
  assert.equal(declaration !== undefined, true);
  if (declaration === undefined) return;
  const selected = current.relation.returned(declaration);
  assert.equal(selected.kind, "open");
  if (selected.kind !== "open") return;
  assert.equal(selected.boundaries.length > 0, true);
  assert.equal(selected.producers.length, 0);
  assert.equal(selected.boundaries.every(boundary =>
    current.storage.typeFor(boundary.subject).kind === "resolved"), true,
  "The open boundary preserves its original checked declaration type.");
});

test("pointer storage never admits a logical projection as physical backing", () => {
  const current = fixture(`
    const pointer = allocateptr<uint32>(1);
    torawptr(projectptr<uint32, uint32>(pointer, value => value, value => value), uint32Layout);
  `);
  const selected = current.selections[0]!;
  assert.equal(selected.kind, "complete");
  if (selected.kind !== "complete") return;
  assert.equal(selected.includesAbsence, false);
  assert.equal(selected.producers.length, 1);
  assert.equal(selected.producers[0]!.operation.operation, "project-pointer",
    "A logical terminal preserves its native location domain without becoming a physical backing operation.");
});

test("pointer storage retains one checked logical binding through value and return queries", () => {
  const current = fixture(`
    function make(): Pointer<uint32> {
      const identity = {};
      let value: uint32 = 1;
      return bindptr<uint32>(identity, () => value, next => { value = next; });
    }
    torawptr(make(), uint32Layout);
  `);
  const declaration = current.storage.nodes.find(node => current.source.ast.is.IsFunctionDeclaration(node) &&
    current.source.ast.text(current.source.ast.name(node)) === "make");
  assert.equal(declaration !== undefined, true);
  if (declaration === undefined) return;
  for (const selected of [current.selections[0]!, current.relation.returned(declaration)]) {
    assert.equal(selected.kind, "complete");
    if (selected.kind !== "complete") return;
    assert.equal(selected.includesAbsence, false);
    assert.equal(selected.producers.length, 1);
    const producer = selected.producers[0]!;
    assert.equal(producer.operation.operation, "bind-pointer");
    assert.equal(producer.storage.subject.node === producer.operation.call, true);
    assert.equal(current.storage.typeFor(producer.storage.subject).kind, "resolved",
      "The original checked component remains available to native pointee completion.");
    assert.equal(current.storage.boundActivationsFor(declaration, producer.storage.bindings).kind, "resolved",
      "The retained producer bindings belong to the exact original declaration activation.");
  }
});

test("pointer storage rejects foreign scoped bindings without an unbound retry", () => {
  const current = fixture("torawptr(allocateptr<uint32>(1), uint32Layout);");
  const other = createSourceStorageQuery(current.source, current.source.sourceFiles);
  const call = memoryCalls(current.checked, "allocateptr")[0]!;
  assert.equal(current.relation.value(call, other.emptyBindings).kind, "unresolved");
  assert.equal(createTsonicPointerStorageRelation(current.source, other).value(call).kind, "complete");
});

test("pointer storage rejects a query owned by another checked source program", () => {
  const current = fixture("torawptr(allocateptr<uint32>(1), uint32Layout);");
  const other = fixture("torawptr(allocateptr<uint32>(2), uint32Layout);");
  const call = memoryCalls(current.checked, "allocateptr")[0]!;
  assert.equal(createTsonicPointerStorageRelation(current.source, other.storage).value(call).kind, "unresolved");
});

test("pointer storage uses the canonical nested field address after a pointer write", () => {
  const current = fixture(`
    let value: { header: { count: uint32 }; prefix: uint32 } = { header: { count: 7 }, prefix: 1 };
    const pointer = addressof(value);
    const field = addressof(value.header.count);
    storeptr(field, 9);
    const saved = loadptr(pointer);
    torawptr(field, uint32Layout);
  `);
  assert.equal(current.selections[0]!.kind, "complete");
  const read = memoryCalls(current.checked, "loadptr")[0]!;
  const subject = current.storage.subjectFor(read);
  assert.equal(subject.kind, "resolved");
  if (subject.kind !== "resolved") return;
  const selected = current.storage.storageProducersFor(subject.subject);
  assert.equal(selected.kind, "complete", selected.kind === "unresolved" ? selected.reason : "Exact field storage stays closed.");
});
