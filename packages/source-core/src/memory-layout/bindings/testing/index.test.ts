import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReadonlySourceFactResolver } from "@tsonic/tsts";
import { createTargetSourceProgram } from "@tsonic/target-api/source";
import { createTsonicMemoryBindingIndex, selectTsonicMemoryRecordBinding, tsonicMemoryRecordBindingFactKey } from "../../../public/facts.js";
import { memoryCall } from "../../testing/fixtures.js";
import { bindingSession, boundRecordSource } from "./fixtures.js";

test("binding storage index selects exact validated members without querying semantics", () => {
  const checked = bindingSession(boundRecordSource);
  const source = createTargetSourceProgram(checked);
  const selection = selectTsonicMemoryRecordBinding(checked.ast, checked.sourceFacts, memoryCall(checked, "bindMemoryRecord"));
  assert.ok(selection?.kind === "resolved");
  const index = createTsonicMemoryBindingIndex(new Proxy(source, {
    get(target, property, receiver) {
      assert.notEqual(property, "semantics", "The binding index must not re-query checking.");
      return Reflect.get(target, property, receiver);
    },
  }));
  assert.deepEqual(index.issues, []);
  assert.ok(Object.isFrozen(index));
  assert.ok(Object.isFrozen(index.issues));
  for (const { binding } of selection.operation.fields) {
    assert.equal(index.hasBoundField([binding.field.selectedDeclaration]), true);
    if (binding.field.selectedSymbol !== undefined) assert.equal(index.hasBoundField([binding.field.selectedSymbol]), true);
    assert.equal(index.hasBoundField([binding.pointerExpression]), false);
  }
  const other = bindingSession(boundRecordSource);
  const different = selectTsonicMemoryRecordBinding(other.ast, other.sourceFacts, memoryCall(other, "bindMemoryRecord"));
  assert.ok(different?.kind === "resolved");
  assert.equal(index.hasBoundField([different.operation.fields[0]!.binding.field.selectedDeclaration]), false);
});

test("binding index does not promote an unconsumed field binding into record storage", () => {
  const checked = bindingSession(`
    const value: Header = { count: 1, tag: 2 };
    const unused = bindMemoryField(countField, addressOf(value.count));
  `);
  const index = createTsonicMemoryBindingIndex(createTargetSourceProgram(checked));
  assert.deepEqual(index.issues, []);
  const field = checked.sourceFacts.getFacts(memoryCall(checked, "memoryField"));
  assert.ok(field.length > 0);
  assert.equal(index.hasBoundField([memoryCall(checked, "memoryField")]), false);
});

test("binding index rejects mutated records without accepting their field identities", () => {
  const checked = bindingSession(boundRecordSource);
  const source = createTargetSourceProgram(checked);
  const call = memoryCall(checked, "bindMemoryRecord");
  const selection = selectTsonicMemoryRecordBinding(checked.ast, checked.sourceFacts, call);
  assert.ok(selection?.kind === "resolved");
  const facts: ReadonlySourceFactResolver = {
    getFact(subject, key) {
      const value = source.sourceFacts.getFact(subject, key);
      return value !== undefined && Object.is(key, tsonicMemoryRecordBindingFactKey)
        ? { ...value, layoutExpression: call } : value;
    },
    getFacts: subject => source.sourceFacts.getFacts(subject),
    getVirtualDeclarationDocument: name => source.sourceFacts.getVirtualDeclarationDocument(name),
  };
  const index = createTsonicMemoryBindingIndex({ ...source, sourceFacts: facts });
  assert.equal(index.issues.length, 1);
  assert.equal(index.issues[0]!.node, call);
  assert.equal(index.hasBoundField([selection.operation.fields[0]!.binding.field.selectedDeclaration]), false);
});
