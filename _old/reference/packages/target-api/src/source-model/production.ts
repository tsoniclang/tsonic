import type { SourceResult, SourceTypeComponent } from "../public/source/contracts.js";

export type SourceProductionResult<Value> = SourceResult<Value> | {
  readonly kind: "pending";
  readonly dependencies: readonly SourceTypeComponent[];
};
