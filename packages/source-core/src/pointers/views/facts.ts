// Legacy-extension witness of a pointer view (viewptr): the selected operand nodes and nil disposition only. No checker
// Type (I1): the Host publishes the descriptors (`TsonicPointerViewRecord`, pointers/host-records.ts).
import { defineExtensionFactKey } from "@tsonic/tsts";
import type { Node } from "@tsonic/tsts";
import { tsonicCoreSourceExtensionId } from "../../identity.js";
import { exactRecord, opaqueSubject, recordsEqual } from "../../memory-layout/snapshots.js";

export interface TsonicPointerViewFact {
  readonly call: Node;
  readonly explicitPointeeTypeNode?: Node;
  readonly pointerExpression: Node;
  readonly readExpression: Node;
  readonly writeExpression: Node;
  readonly optional: boolean;
}

export const tsonicPointerViewFactKey = defineExtensionFactKey<TsonicPointerViewFact>({
  extensionId: tsonicCoreSourceExtensionId, name: "pointerView",
  snapshot(value) {
    const result = exactRecord(value, ["call", "pointerExpression", "readExpression", "writeExpression", "optional"],
      ["explicitPointeeTypeNode"]);
    if (typeof result.optional !== "boolean") throw new Error("Pointer view requires its selected nil disposition.");
    for (const [key, subject] of Object.entries(result)) if (key !== "optional" && subject !== undefined) opaqueSubject(subject as object);
    return result;
  },
  equals: recordsEqual,
});
