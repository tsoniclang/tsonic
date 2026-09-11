import assert from "node:assert/strict";
import { test } from "node:test";
import type { Node, ReadonlySourceFactResolver, Type } from "@tsonic/tsts";
import { selectTsonicMemoryFieldBinding, selectTsonicMemoryRecordBinding, tsonicMemoryFieldBindingFactKey,
  tsonicMemoryRecordBindingFactKey, tsonicMemoryFieldLayoutFactKey, tsonicMemoryLayoutFactKey, tsonicMemoryTypeFactKey,
  tsonicDataLayoutFactKey } from "../../../public/facts.js";
import { memoryCall } from "../../testing/fixtures.js";
import { bindingSession, boundRecordSource } from "./fixtures.js";
import { maximumMemoryLayoutDepth, snapshotMemoryLayout } from "../../facts.js";
import type { TsonicValueMemoryLayoutFact } from "../../facts.js";

test("memory binding snapshots freeze exact relationships without freezing compiler handles", () => {
  const checked = bindingSession(boundRecordSource);
  const fact = checked.sourceFacts.getFact(memoryCall(checked, "bindMemoryRecord"), tsonicMemoryRecordBindingFactKey)!;
  const field = fact.fields[0]!.binding;
  const captured = tsonicMemoryRecordBindingFactKey.snapshot({ ...fact, fields: [...fact.fields] });
  assert.ok(tsonicMemoryRecordBindingFactKey.equals(fact, captured));
  assert.ok(tsonicMemoryFieldBindingFactKey.equals(field, tsonicMemoryFieldBindingFactKey.snapshot({ ...field })));
  assert.ok(Object.isFrozen(captured.fields));
  assert.ok(Object.isFrozen(captured.fields[0]));
  assert.ok(Object.isFrozen(captured.fields[0]!.binding.field.fieldLayout));
  assert.equal(captured.fields[0]!.binding.pointerExpression, field.pointerExpression);
  assert.throws(() => tsonicMemoryRecordBindingFactKey.snapshot({ ...fact, fields: [fact.fields[0]!, fact.fields[0]!] }));
  assert.throws(() => tsonicMemoryRecordBindingFactKey.snapshot({ ...fact, fields: [] }));
  assert.throws(() => tsonicMemoryRecordBindingFactKey.snapshot({ ...fact, inferAliases: true } as never));
  assert.throws(() => tsonicMemoryFieldBindingFactKey.snapshot({ ...field, inferAliases: true } as never));
  const fields = [...fact.fields];
  Object.defineProperty(fields, "0", { get() { assert.fail("Binding capture must not execute accessors."); } });
  assert.throws(() => tsonicMemoryRecordBindingFactKey.snapshot({ ...fact, fields }));
  assert.throws(() => tsonicMemoryFieldBindingFactKey.snapshot(Object.defineProperty({ ...field }, "pointerExpression", {
    get() { assert.fail("Binding capture must not execute accessors."); },
  })));
  assert.ok(!tsonicMemoryFieldBindingFactKey.equals(field, { ...field, pointerExpression: fact.call }));
});

test("public binding readers reject missing, substituted and stale relationship evidence", () => {
  const checked = bindingSession(boundRecordSource);
  const call = memoryCall(checked, "bindMemoryRecord");
  const record = checked.sourceFacts.getFact(call, tsonicMemoryRecordBindingFactKey)!;
  for (const mutation of ["missing-field", "missing-layout", "missing-binding", "missing-type", "stale-abi",
    "record-operand", "field-operand", "field-declaration", "child-layout", "duplicate-field"] as const) {
    const facts: ReadonlySourceFactResolver = {
      getFact(subject, key) {
        const value = checked.sourceFacts.getFact(subject, key);
        if (mutation === "missing-field" && Object.is(key, tsonicMemoryFieldLayoutFactKey)) return undefined;
        if (mutation === "missing-layout" && Object.is(key, tsonicMemoryLayoutFactKey)) return undefined;
        if (mutation === "missing-binding" && Object.is(key, tsonicMemoryFieldBindingFactKey)) return undefined;
        if (mutation === "missing-type" && Object.is(key, tsonicMemoryTypeFactKey)) return undefined;
        if (value === undefined) return value;
        if (mutation === "stale-abi" && Object.is(key, tsonicDataLayoutFactKey)) return { ...value, fingerprint: "stale" };
        if (mutation === "record-operand" && Object.is(key, tsonicMemoryRecordBindingFactKey)) {
          return { ...value, layoutExpression: call };
        }
        if (mutation === "field-operand" && Object.is(key, tsonicMemoryFieldBindingFactKey)) {
          return { ...value, pointerExpression: call };
        }
        if (mutation === "field-declaration" && Object.is(key, tsonicMemoryFieldLayoutFactKey)) {
          return { ...value, selectedDeclaration: call };
        }
        if (mutation === "child-layout" && Object.is(key, tsonicMemoryLayoutFactKey) && subject !== record.layout.call) {
          return { ...value, byteSize: 1 };
        }
        if (mutation === "duplicate-field" && Object.is(key, tsonicMemoryRecordBindingFactKey)) {
          return { ...value, fields: [record.fields[0], record.fields[0]] };
        }
        return value;
      },
      getFacts: subject => checked.sourceFacts.getFacts(subject),
      getVirtualDeclarationDocument: name => checked.sourceFacts.getVirtualDeclarationDocument(name),
    };
    assert.equal(selectTsonicMemoryRecordBinding(checked.ast, facts, call)?.kind, "rejected", mutation);
    if (mutation === "field-operand") {
      assert.equal(selectTsonicMemoryFieldBinding(checked.ast, facts, record.fields[0]!.binding.call)?.kind, "rejected");
    }
  }
});

test("binding a deepest valid layout adds no fictitious physical nesting level", () => {
  const checked = bindingSession(boundRecordSource);
  const fact = checked.sourceFacts.getFact(memoryCall(checked, "bindMemoryRecord"), tsonicMemoryRecordBindingFactKey)!;
  const original = fact.fields[0]!.binding;
  let layout = snapshotMemoryLayout(original.field.fieldLayout) as TsonicValueMemoryLayoutFact;
  for (let depth = 1; depth < maximumMemoryLayoutDepth; depth++) {
    const sourceType = {} as Type;
    const field = { ...original.field, call: {} as Node, selectedDeclaration: {} as Node,
      sourceType, fieldType: layout.sourceType, fieldLayoutExpression: layout.call, fieldLayout: layout, byteOffset: 0 };
    layout = snapshotMemoryLayout({ ...layout, call: {} as Node, sourceType, fields: [field] }) as TsonicValueMemoryLayoutFact;
  }
  const field = layout.fields[0]!;
  const binding = { ...original, sourceType: layout.sourceType, pointeeType: field.fieldType, fieldExpression: field.call, field };
  const captured = tsonicMemoryRecordBindingFactKey.snapshot({ ...fact, sourceType: layout.sourceType,
    layoutExpression: layout.call, layout, fields: [{ expression: binding.call, binding }] });
  assert.equal(captured.fields.length, 1);
  assert.equal(captured.fields[0]!.binding.field.fieldLayout, layout.fields[0]!.fieldLayout);
});
