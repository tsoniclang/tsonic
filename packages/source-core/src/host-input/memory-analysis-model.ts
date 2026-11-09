import type { Node } from "@tsonic/tsts";
import type { TsonicSourceFileAnalysisContext } from "./source-context.js";
import type { SelectedProviderSourceCall } from "./provider-calls.js";
import type { tsonicMemorySignatureIds } from "../memory-layout/declarations.js";

export interface MemorySourceCall {
  readonly selected: SelectedProviderSourceCall;
  readonly context: TsonicSourceFileAnalysisContext;
  readonly name: keyof typeof tsonicMemorySignatureIds;
}
