import type { Node } from "@tsonic/tsts";
import type { TsonicSourceFileAnalysisContext } from "../analysis/context.js";
import type { SelectedProviderSourceCall } from "../analysis/source-call.js";
import type { tsonicMemorySignatureIds } from "./declarations.js";
import type { TsonicMemoryFieldLayoutFact, TsonicMemoryLayoutFact, TsonicValueMemoryLayoutFact } from "./facts.js";
import type { TsonicFixedArrayFact } from "../fixed-arrays/facts.js";

export interface MemorySourceCall {
  readonly selected: SelectedProviderSourceCall;
  readonly context: TsonicSourceFileAnalysisContext;
  readonly name: keyof typeof tsonicMemorySignatureIds;
}

export interface MemoryTypeContracts {
  layout(call: MemorySourceCall): boolean;
  array(call: MemorySourceCall, element: TsonicMemoryLayoutFact,
    count: { readonly value: bigint; readonly runtimeBase: "number" | "bigint" }): TsonicFixedArrayFact | undefined;
  field(call: MemorySourceCall, declaration: Node, selector: Node, layout: TsonicMemoryLayoutFact): boolean;
  queryField(call: MemorySourceCall, declaration: Node, layout: TsonicMemoryLayoutFact): boolean;
  aggregate(call: MemorySourceCall, fields: readonly Node[]): boolean;
  raw(call: MemorySourceCall, layout: TsonicMemoryLayoutFact): boolean;
  binding(call: MemorySourceCall, field: TsonicMemoryFieldLayoutFact): boolean;
  record(call: MemorySourceCall, layout: TsonicValueMemoryLayoutFact): boolean;
  publish(call: MemorySourceCall): void;
}
