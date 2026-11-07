import { defineExtensionFactKey } from "@tsonic/tsts";
import type { Node } from "@tsonic/tsts";
import { tsonicCoreSourceExtensionId } from "../../identity.js";
import { memoryLayoutsEqual, snapshotMemoryField, snapshotMemoryLayout, tsonicMemoryFieldLayoutFactKey } from "../facts.js";
import type { TsonicMemoryFieldLayoutFact, TsonicValueMemoryLayoutFact } from "../facts.js";
import { exactRecord, opaqueSubject, recordsEqual, snapshotDataArray } from "../snapshots.js";

// Legacy-extension binding witnesses: selected nodes and layouts only. No checker Type (I1); the Host publishes the
// bound field and record descriptors (`TsonicMemoryBindings`, host-records.ts).
export interface TsonicMemoryFieldBindingFact {
  readonly call: Node;
  readonly fieldExpression: Node;
  readonly field: TsonicMemoryFieldLayoutFact;
  readonly pointerExpression: Node;
}

export interface TsonicMemoryRecordBindingFact {
  readonly call: Node;
  readonly layoutExpression: Node;
  readonly layout: TsonicValueMemoryLayoutFact;
  readonly fields: readonly {
    readonly expression: Node;
    readonly binding: TsonicMemoryFieldBindingFact;
  }[];
}

function snapshotFieldBinding(value: TsonicMemoryFieldBindingFact): TsonicMemoryFieldBindingFact {
  const result = exactRecord(value, ["call", "fieldExpression", "field", "pointerExpression"]);
  for (const [key, subject] of Object.entries(result)) if (key !== "field") opaqueSubject(subject);
  return Object.freeze({ ...result, field: snapshotMemoryField(result.field) });
}

export const tsonicMemoryFieldBindingFactKey = defineExtensionFactKey<TsonicMemoryFieldBindingFact>({
  extensionId: tsonicCoreSourceExtensionId, name: "memoryFieldBinding",
  snapshot: snapshotFieldBinding,
  equals(left, right) {
    return recordsEqual({ ...left, field: undefined }, { ...right, field: undefined }) &&
      tsonicMemoryFieldLayoutFactKey.equals(left.field, right.field);
  },
});

export const tsonicMemoryRecordBindingFactKey = defineExtensionFactKey<TsonicMemoryRecordBindingFact>({
  extensionId: tsonicCoreSourceExtensionId, name: "memoryRecordBinding",
  snapshot(value) {
    const result = exactRecord(value, ["call", "layoutExpression", "layout", "fields"]);
    for (const key of ["call", "layoutExpression"] as const) opaqueSubject(result[key]);
    const layout = snapshotMemoryLayout(result.layout);
    if (layout.kind !== "value") throw new Error("Record bindings require a field layout, not an array layout.");
    if (!Array.isArray(result.fields) || result.fields.length !== layout.fields.length) {
      throw new Error("Record bindings must cover every selected physical field exactly once.");
    }
    const selectedFields = new Map(layout.fields.map(field => [field.call, field]));
    const fields = snapshotDataArray(result.fields, entry => {
      const selected = exactRecord(entry, ["expression", "binding"]);
      opaqueSubject(selected.expression);
      const binding = snapshotFieldBinding(selected.binding);
      const field = selectedFields.get(binding.field.call);
      if (field === undefined || !tsonicMemoryFieldLayoutFactKey.equals(field, binding.field)) {
        throw new Error("Record binding requires one exact occurrence of each selected layout field.");
      }
      selectedFields.delete(field.call);
      return Object.freeze({ expression: selected.expression, binding });
    });
    return Object.freeze({ ...result, layout, fields });
  },
  equals(left, right) {
    return left.call === right.call && left.layoutExpression === right.layoutExpression && memoryLayoutsEqual(left.layout, right.layout) &&
      left.fields.length === right.fields.length && left.fields.every((field, index) =>
        field.expression === right.fields[index]!.expression &&
        tsonicMemoryFieldBindingFactKey.equals(field.binding, right.fields[index]!.binding));
  },
});
