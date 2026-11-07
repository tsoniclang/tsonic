import type { SourceRefusal } from "../../../public/source/facts.js";
import type { SourcePointerOperationRecord } from "../../../public/source/selections.js";
import type { SourceStorageCallEffect } from "./types.js";

/** The storage effect of a native pointer marker call, from the Host pointer-operation record (facts.selections.pointerOperation). */
export function sourceStoragePointerCallEffect(operation: SourcePointerOperationRecord | SourceRefusal | undefined): SourceStorageCallEffect | undefined {
  if (operation === undefined || "kind" in operation) return undefined;
  switch (operation.operation) {
    case "allocate": return Object.freeze({ resultAllocation: operation.call });
    case "load":
    case "store":
    case "address-of":
    case "bind-pointer":
    case "project-pointer": return Object.freeze({});
    default: return undefined;
  }
}
