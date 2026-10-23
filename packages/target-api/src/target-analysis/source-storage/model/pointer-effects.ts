import type { PointerOperationFact } from "@tsonic/tsts";
import type { SourceStorageCallEffect } from "./types.js";

export function sourceStoragePointerCallEffect(operation: PointerOperationFact | undefined): SourceStorageCallEffect | undefined {
  switch (operation?.operation) {
    case "allocate": return Object.freeze({ resultAllocation: operation.call });
    case "load":
    case "store":
    case "address-of":
    case "bind-pointer":
    case "project-pointer": return Object.freeze({});
    default: return undefined;
  }
}
