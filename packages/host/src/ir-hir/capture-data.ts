import type { Cause } from "../diag/contract.js";

export type CapturedFact<Value> =
  | { readonly kind: "available"; readonly value: Value }
  | { readonly kind: "unavailable"; readonly reason: "checker-error" | "parameter-dependent" | "not-provided" | "missing-original-component" | "incomplete-association" | "unsupported-checked-structure"; readonly causes: readonly Cause[] };
