import { defineExtensionFactKey } from "@tsonic/tsts";
import type { Node, Type } from "@tsonic/tsts";
import { tsonicCoreSourceExtensionId } from "../../identity.js";
import { exactRecord, opaqueSubject, recordsEqual } from "../../memory-layout/snapshots.js";

export interface TsonicPointerViewFact {
  readonly call: Node;
  readonly resultType: Type;
  readonly sourcePointeeType: Type;
  readonly pointeeType: Type;
  readonly explicitPointeeTypeNode?: Node;
  readonly pointerExpression: Node;
  readonly pointerType: Type;
  readonly readExpression: Node;
  readonly readType: Type;
  readonly writeExpression: Node;
  readonly writeType: Type;
  readonly optional: boolean;
}

export const tsonicPointerViewFactKey = defineExtensionFactKey<TsonicPointerViewFact>({
  extensionId: tsonicCoreSourceExtensionId, name: "pointerView",
  snapshot(value) {
    const result = exactRecord(value, ["call", "resultType", "sourcePointeeType", "pointeeType", "pointerExpression",
      "pointerType", "readExpression", "readType", "writeExpression", "writeType", "optional"], ["explicitPointeeTypeNode"]);
    if (typeof result.optional !== "boolean") throw new Error("Pointer view requires its selected nil disposition.");
    for (const [key, subject] of Object.entries(result)) if (key !== "optional") opaqueSubject(subject as object);
    return result;
  },
  equals: recordsEqual,
});
