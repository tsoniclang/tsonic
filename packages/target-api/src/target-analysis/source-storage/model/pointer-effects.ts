import type { PointerOperationFact } from "@tsonic/tsts";
import type { SourceStorageCallEffect } from "./types.js";

export function sourceStoragePointerCallEffect(operation: PointerOperationFact | undefined): SourceStorageCallEffect | undefined {
  switch (operation?.operation) {
    case "allocate": return Object.freeze({ resultAllocation: operation.call,
      preservedInputs: Object.freeze([operation.initialExpression]) });
    case "load": return Object.freeze({ preservedInputs: Object.freeze([operation.pointerExpression]) });
    case "store": return Object.freeze({ preservedInputs: Object.freeze([operation.pointerExpression, operation.valueExpression]) });
    default: return undefined;
  }
}
