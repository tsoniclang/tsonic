import type { TsonicSourceFileAnalysisContext } from "./source-context.js";
import type { SelectedProviderSourceCall } from "./provider-calls.js";
import type { tsonicMemorySignatureIds } from "../memory-layout/declarations.js";
import type { createMemoryPublicationOwner } from "./memory-publications.js";

export interface MemorySourceCall {
  readonly selected: SelectedProviderSourceCall;
  readonly context: TsonicSourceFileAnalysisContext;
  readonly name: keyof typeof tsonicMemorySignatureIds;
  readonly publications: ReturnType<typeof createMemoryPublicationOwner>;
}
