// Source-core analyses published to targets as SourceProgramFacts.analyses.extension(tsonicCoreAnalysisKey).
// The composition root registers `tsonicCoreSourceAnalyses` with createTargetSourceProgram; targets never call the
// program-taking factories below directly (supervisor ruling 2026-11-07: Host analyses are facts members).
import type { Node } from "@tsonic/tsts";
import { createSourceAnalysisKey, hostSourceProgramOfAnalysisHost } from "@tsonic/target-api/host";
import type { SourceAnalysisExtension, SourceAnalysisHost, SourceAnalysisKey } from "@tsonic/target-api/source";
import { createTsonicMemoryMetadataIndex, type TsonicMemoryMetadataIndex } from "../memory-layout/metadata-index.js";
import { createTsonicClosedArrayStorageQueries, type TsonicClosedArrayStorage } from "../pointers/backing/array-storage.js";
import { selectTsonicProviderPointerShape, type TsonicProviderPointerSelection } from "../pointers/provider-return-evidence.js";

/** Source-value budget of one closed native array proof (the value C# used, now owned by the Host). */
export const tsonicClosedArrayStorageValueBudget = 131_072;

export interface TsonicCoreSourceAnalyses {
  /** Compile-time memory metadata (data layouts, memory layouts, memory fields) and their use issues. */
  readonly memoryMetadata: TsonicMemoryMetadataIndex;
  /** Closed native array storage behind an element access, or why it is unproven. */
  closedArrayStorage(access: Node): TsonicClosedArrayStorage;
  /** Pointer result shape of a provider call; fold it with foldTsonicProviderPointerResult. Undefined: no pointer result. */
  providerPointerResult(call: Node): TsonicProviderPointerSelection | undefined;
}

export const tsonicCoreAnalysisKey: SourceAnalysisKey<TsonicCoreSourceAnalyses> =
  createSourceAnalysisKey<TsonicCoreSourceAnalyses>("tsonic.source-core");

export const tsonicCoreSourceAnalyses: SourceAnalysisExtension<TsonicCoreSourceAnalyses> = Object.freeze({
  key: tsonicCoreAnalysisKey,
  create(handle: SourceAnalysisHost) {
    const host = hostSourceProgramOfAnalysisHost(handle);
    const arrays = createTsonicClosedArrayStorageQueries(host, tsonicClosedArrayStorageValueBudget);
    return Object.freeze({
      memoryMetadata: createTsonicMemoryMetadataIndex(host),
      closedArrayStorage: (access: Node) => arrays.resolve(access),
      providerPointerResult: (call: Node) => selectTsonicProviderPointerShape(host, call),
    });
  },
});
