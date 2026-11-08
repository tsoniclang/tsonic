import type { SourcePointerOperation } from "../../source-pointers.js";
import type { SourceStorageCallEffect } from "./types.js";

export function sourceStoragePointerCallEffect(operation: SourcePointerOperation | undefined): SourceStorageCallEffect | undefined {
  switch (operation?.operation) {
    case "allocate": return Object.freeze({ kind: "result-allocation", allocation: operation.occurrence });
    case "load":
    case "store":
    case "address-of":
    case "bind-pointer":
    case "project-pointer": return Object.freeze({ kind: "no-result-storage" });
    default: return undefined;
  }
}
